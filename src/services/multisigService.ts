import * as multisig from "@sqds/multisig";
import { Connection, Keypair, PublicKey, TransactionMessage, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface MultisigConfig {
  rpcUrl: string;
  multisigPda?: string;
  createKey?: string;
  threshold: number;
  timeLock?: number;
  members: Array<{
    publicKey: string;
    permissions: string[];
  }>;
}

export interface TransferRequest {
  fromWallet: string;
  toWallet: string;
  amount: number;
  currency?: string;
  memo?: string;
}

export class MultisigService {
  private connection: Connection;
  private multisigPda?: PublicKey;
  private createKey?: PublicKey;
  private threshold: number;
  private timeLock: number;
  private members: Array<{ publicKey: string; permissions: string[] }>;

  constructor(config: MultisigConfig) {
    this.connection = new Connection(config.rpcUrl);
    this.threshold = config.threshold;
    this.timeLock = config.timeLock || 0;
    this.members = config.members;

    if (config.multisigPda) {
      this.multisigPda = new PublicKey(config.multisigPda);
    }
    if (config.createKey) {
      this.createKey = new PublicKey(config.createKey);
    }
  }

  /**
   * Create a new multisig account
   */
  async createMultisig(creator: Keypair): Promise<{
    multisigPda: string;
    createKey: string;
    transaction: any;
  }> {
    if (!this.createKey) {
      this.createKey = Keypair.generate().publicKey;
    }

    const [multisigPda] = multisig.getMultisigPda({
      createKey: this.createKey,
    });

    this.multisigPda = multisigPda;

    const programConfigPda = multisig.getProgramConfigPda({})[0];
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
      this.connection,
      programConfigPda
    );

    const configTreasury = programConfig.treasury;

    // Convert permissions
    const { Permission, Permissions } = multisig.types;
    const members = this.members.map(member => ({
      key: new PublicKey(member.publicKey),
      permissions: this.convertPermissions(member.permissions),
    }));

    const instruction = await multisig.instructions.multisigCreateV2({
      createKey: this.createKey,
      creator: creator.publicKey,
      multisigPda,
      configAuthority: null,
      timeLock: this.timeLock,
      members,
      threshold: this.threshold,
      treasury: configTreasury,
      rentCollector: null,
    });

    return {
      multisigPda: multisigPda.toString(),
      createKey: this.createKey.toString(),
      transaction: instruction,
    };
  }

  /**
   * Create a vault transaction for external transfers
   */
  async createVaultTransaction(
    fromWallet: string,
    toWallet: string,
    amount: number,
    memo?: string
  ): Promise<{
    transactionIndex: bigint;
    instruction: any;
  }> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    // Get multisig info
    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      this.connection,
      this.multisigPda
    );

    const currentTransactionIndex = Number(multisigInfo.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);

    // Derive vault PDA
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: this.multisigPda,
      index: 0,
    });

    // Create transfer instruction using SystemProgram
    const { SystemProgram } = await import('@solana/web3.js');
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: new PublicKey(fromWallet),
      toPubkey: new PublicKey(toWallet),
      lamports: BigInt(amount * LAMPORTS_PER_SOL),
    });

    // Build transaction message
    const transactionMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
      instructions: [transferInstruction],
    });

    const instruction = await multisig.instructions.vaultTransactionCreate({
      multisigPda: this.multisigPda,
      transactionIndex: newTransactionIndex,
      creator: new PublicKey(this.members[0].publicKey), // First member as creator
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage,
      memo: memo || "External transfer via multisig",
    });

    return {
      transactionIndex: newTransactionIndex,
      instruction,
    };
  }

  /**
   * Create a proposal for a transaction
   */
  async createProposal(
    transactionIndex: bigint,
    proposerKey: string
  ): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    const instruction = await multisig.instructions.proposalCreate({
      multisigPda: this.multisigPda,
      transactionIndex,
      creator: new PublicKey(proposerKey),
    });

    return instruction;
  }

  /**
   * Approve a proposal
   */
  async approveProposal(
    transactionIndex: bigint,
    memberKey: string
  ): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    const instruction = await multisig.instructions.proposalApprove({
      multisigPda: this.multisigPda,
      transactionIndex,
      member: new PublicKey(memberKey),
    });

    return instruction;
  }

  /**
   * Reject a proposal
   */
  async rejectProposal(
    transactionIndex: bigint,
    memberKey: string
  ): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    const instruction = await multisig.instructions.proposalReject({
      multisigPda: this.multisigPda,
      transactionIndex,
      member: new PublicKey(memberKey),
    });

    return instruction;
  }

  /**
   * Execute a vault transaction
   */
  async executeVaultTransaction(
    transactionIndex: bigint,
    executorKey: string
  ): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    const instruction = await multisig.instructions.vaultTransactionExecute({
      connection: this.connection,
      multisigPda: this.multisigPda,
      transactionIndex,
      member: new PublicKey(executorKey),
    });

    return instruction;
  }

  /**
   * Get multisig information
   */
  async getMultisigInfo(): Promise<any> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    return await multisig.accounts.Multisig.fromAccountAddress(
      this.connection,
      this.multisigPda
    );
  }

  /**
   * Check if a transaction is approved
   */
  async isTransactionApproved(transactionIndex: bigint): Promise<boolean> {
    if (!this.multisigPda) {
      throw new Error("Multisig not initialized");
    }

    try {
      const [proposalPda] = multisig.getProposalPda({
        multisigPda: this.multisigPda,
        transactionIndex,
      });

      const proposal = await multisig.accounts.Proposal.fromAccountAddress(
        this.connection,
        proposalPda
      );

      // Check if proposal is approved (status 1)
      return (proposal.status as any) === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert permission strings to Squads permissions
   */
  private convertPermissions(permissions: string[]): any {
    const { Permission, Permissions } = multisig.types;
    
    if (permissions.includes("all")) {
      return Permissions.all();
    }

    const permissionList = permissions.map(perm => {
      switch (perm.toLowerCase()) {
        case "propose":
          return Permission.Initiate;
        case "vote":
          return Permission.Vote;
        case "execute":
          return Permission.Execute;
        default:
          throw new Error(`Unknown permission: ${perm}`);
      }
    });

    return Permissions.fromPermissions(permissionList);
  }

  /**
   * Save multisig to database
   */
  async saveMultisigToDatabase(
    multisigPda: string,
    createKey: string,
    name: string = "Main Multisig"
  ): Promise<any> {
    return await prisma.multisig.create({
      data: {
        multisigPda,
        createKey,
        name,
        threshold: this.threshold,
        timeLock: this.timeLock,
        members: {
          create: this.members.map(member => ({
            publicKey: member.publicKey,
            permissions: JSON.stringify(member.permissions),
          })),
        },
      },
      include: {
        members: true,
      },
    });
  }

  /**
   * Save multisig transaction to database
   */
  async saveTransactionToDatabase(
    multisigId: number,
    transactionIndex: bigint,
    fromWallet: string,
    toWallet: string,
    amount: number,
    currency: string = "SOL",
    memo?: string
  ): Promise<any> {
    return await prisma.multisigTransaction.create({
      data: {
        multisigId,
        transactionIndex,
        fromWallet,
        toWallet,
        amount,
        currency,
        memo,
      },
    });
  }

  /**
   * Save proposal to database
   */
  async saveProposalToDatabase(
    multisigTransactionId: number,
    proposerKey: string
  ): Promise<any> {
    return await prisma.multisigProposal.create({
      data: {
        multisigTransactionId,
        proposerKey,
      },
    });
  }

  /**
   * Save approval to database
   */
  async saveApprovalToDatabase(
    multisigTransactionId: number,
    memberId: number,
    approvalType: "APPROVE" | "REJECT"
  ): Promise<any> {
    return await prisma.multisigApproval.create({
      data: {
        multisigTransactionId,
        memberId,
        approvalType,
      },
    });
  }

  /**
   * Get multisig from database
   */
  async getMultisigFromDatabase(multisigPda: string): Promise<any> {
    return await prisma.multisig.findUnique({
      where: { multisigPda },
      include: {
        members: true,
        transactions: {
          include: {
            proposals: true,
            approvals: {
              include: {
                member: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transactionIndex: bigint,
    status: "PENDING" | "PROPOSED" | "APPROVED" | "EXECUTED" | "REJECTED" | "CANCELLED" | "FAILED"
  ): Promise<any> {
    return await prisma.multisigTransaction.updateMany({
      where: { transactionIndex },
      data: { status },
    });
  }

  /**
   * Update proposal status
   */
  async updateProposalStatus(
    multisigTransactionId: number,
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "STALE"
  ): Promise<any> {
    return await prisma.multisigProposal.updateMany({
      where: { multisigTransactionId },
      data: { status },
    });
  }
}

// Singleton instance
let multisigServiceInstance: MultisigService | null = null;

export function getMultisigService(): MultisigService {
  if (!multisigServiceInstance) {
    const config: MultisigConfig = {
      rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      multisigPda: process.env.MULTISIG_PDA,
      createKey: process.env.MULTISIG_CREATE_KEY,
      threshold: parseInt(process.env.MULTISIG_THRESHOLD || "2"),
      timeLock: parseInt(process.env.MULTISIG_TIME_LOCK || "0"),
      members: JSON.parse(process.env.MULTISIG_MEMBERS || '[]'),
    };
    multisigServiceInstance = new MultisigService(config);
  }
  return multisigServiceInstance;
}
