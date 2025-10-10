import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fusee Backend API',
      version: '1.0.0',
      description: 'Secure User Registration API with Solana Wallet Integration',
    },
    servers: [
      {
        url: 'https://fusee.onrender.com',
        description: 'Production server',
      },
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
        components: {
      securitySchemes: {
        csrf: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF token for protection against cross-site request forgery'
        }
      },
      schemas: {
        Wallet: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Wallet ID',
            },
            firstName: {
              type: 'string',
              description: 'First name associated with wallet',
            },
            address: {
              type: 'string',
              description: 'Wallet address',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether wallet is active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Wallet creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Wallet last update date',
            },
          },
        },
            Transfer: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'Transfer ID',
                },
                senderId: {
                  type: 'integer',
                  description: 'Sender user ID',
                },
                receiverId: {
                  type: 'integer',
                  description: 'Receiver user ID',
                },
                amount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Transfer amount',
                },
                fee: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Transfer fee (0.001%)',
                },
                netAmount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Amount after fee deduction',
                },
                currency: {
                  type: 'string',
                  description: 'Currency type',
                  example: 'USDC',
                },
                status: {
                  type: 'string',
                  enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
                  description: 'Transfer status',
                },
                transactionHash: {
                  type: 'string',
                  description: 'Blockchain transaction hash',
                },
                notes: {
                  type: 'string',
                  description: 'Transfer notes',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Transfer creation date',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Transfer last update date',
                },
                sender: {
                  type: 'object',
                  description: 'Sender user details',
                },
                receiver: {
                  type: 'object',
                  description: 'Receiver user details',
                },
              },
            },
            Vault: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'Vault ID',
                },
                address: {
                  type: 'string',
                  description: 'Vault wallet address',
                },
                name: {
                  type: 'string',
                  description: 'Vault name',
                },
                totalBalance: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Total vault balance',
                },
                feeBalance: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Total fees collected',
                },
                currency: {
                  type: 'string',
                  description: 'Vault currency',
                },
                isActive: {
                  type: 'boolean',
                  description: 'Whether vault is active',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Vault creation date',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Vault last update date',
                },
              },
            },
        Deposit: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Deposit ID',
            },
            userId: {
              type: 'integer',
              description: 'User ID',
            },
            vaultId: {
              type: 'integer',
              description: 'Vault ID',
            },
            amount: {
              type: 'number',
              format: 'decimal',
              description: 'Deposit amount',
            },
            currency: {
              type: 'string',
              description: 'Currency type',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
              description: 'Deposit status',
            },
            transactionHash: {
              type: 'string',
              description: 'Blockchain transaction hash',
            },
            notes: {
              type: 'string',
              description: 'Deposit notes',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Deposit creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Deposit last update date',
            },
          },
        },
            Withdrawal: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'Withdrawal ID',
                },
                userId: {
                  type: 'integer',
                  description: 'User ID',
                },
                vaultId: {
                  type: 'integer',
                  description: 'Vault ID',
                },
                amount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Withdrawal amount',
                },
                currency: {
                  type: 'string',
                  description: 'Currency type',
                },
                status: {
                  type: 'string',
                  enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
                  description: 'Withdrawal status',
                },
                transactionHash: {
                  type: 'string',
                  description: 'Blockchain transaction hash',
                },
                notes: {
                  type: 'string',
                  description: 'Withdrawal notes',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Withdrawal creation date',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Withdrawal last update date',
                },
              },
            },
            Fee: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'Fee ID',
                },
                transferId: {
                  type: 'integer',
                  description: 'Transfer ID',
                },
                vaultId: {
                  type: 'integer',
                  description: 'Vault ID',
                },
                amount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Fee amount',
                },
                currency: {
                  type: 'string',
                  description: 'Currency type',
                },
                feeRate: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Fee rate (0.001% = 0.00001)',
                },
                status: {
                  type: 'string',
                  enum: ['COLLECTED', 'REFUNDED', 'PENDING'],
                  description: 'Fee status',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Fee creation date',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Fee last update date',
                },
              },
            },
            WalletTransfer: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'Wallet transfer ID',
                },
                fromWallet: {
                  type: 'string',
                  description: 'Source wallet address',
                },
                toWallet: {
                  type: 'string',
                  description: 'Destination wallet address',
                },
                amount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Transfer amount',
                },
                fee: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Transfer fee (0.001%)',
                },
                netAmount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Amount after fee deduction',
                },
                currency: {
                  type: 'string',
                  description: 'Currency type',
                },
                status: {
                  type: 'string',
                  enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
                  description: 'Transfer status',
                },
                transactionHash: {
                  type: 'string',
                  description: 'Blockchain transaction hash',
                },
                feeWalletAddress: {
                  type: 'string',
                  description: 'Address where fee was sent',
                },
                notes: {
                  type: 'string',
                  description: 'Transfer notes',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Transfer creation date',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Transfer last update date',
                },
                fees: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/WalletFee'
                  },
                  description: 'Associated fee records',
                },
              },
            },
            WalletFee: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'Wallet fee ID',
                },
                walletTransferId: {
                  type: 'integer',
                  description: 'Wallet transfer ID',
                },
                amount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Fee amount',
                },
                currency: {
                  type: 'string',
                  description: 'Currency type',
                },
                feeRate: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Fee rate (0.001% = 0.00001)',
                },
                feeWalletAddress: {
                  type: 'string',
                  description: 'Address where fee was sent',
                },
                status: {
                  type: 'string',
                  enum: ['COLLECTED', 'REFUNDED', 'PENDING'],
                  description: 'Fee status',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Fee creation date',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Fee last update date',
                },
              },
            },
            ExternalTransfer: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'External transfer ID',
                },
                userId: {
                  type: 'integer',
                  description: 'User ID making the transfer',
                },
                fromWallet: {
                  type: 'string',
                  description: 'User wallet address',
                },
                toExternalWallet: {
                  type: 'string',
                  description: 'External wallet address',
                },
                amount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Transfer amount',
                },
                fee: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Transfer fee (0.001%)',
                },
                netAmount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Amount after fee deduction',
                },
                currency: {
                  type: 'string',
                  description: 'Currency type',
                },
                status: {
                  type: 'string',
                  enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
                  description: 'Transfer status',
                },
                transactionHash: {
                  type: 'string',
                  description: 'Blockchain transaction hash',
                },
                feeWalletAddress: {
                  type: 'string',
                  description: 'Address where fee was sent',
                },
                notes: {
                  type: 'string',
                  description: 'Transfer notes',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Transfer creation date',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Transfer last update date',
                },
                user: {
                  type: 'object',
                  description: 'User details',
                },
                fees: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/ExternalFee'
                  },
                  description: 'Associated fee records',
                },
              },
            },
            ExternalFee: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'External fee ID',
                },
                externalTransferId: {
                  type: 'integer',
                  description: 'External transfer ID',
                },
                amount: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Fee amount',
                },
                currency: {
                  type: 'string',
                  description: 'Currency type',
                },
                feeRate: {
                  type: 'number',
                  format: 'decimal',
                  description: 'Fee rate (0.001% = 0.00001)',
                },
                feeWalletAddress: {
                  type: 'string',
                  description: 'Address where fee was sent',
                },
                status: {
                  type: 'string',
                  enum: ['COLLECTED', 'REFUNDED', 'PENDING'],
                  description: 'Fee status',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Fee creation date',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Fee last update date',
                },
              },
            },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            phoneNumber: {
              type: 'string',
              description: 'User phone number (optional)',
            },
            solanaWallet: {
              type: 'string',
              description: 'User Solana wallet address',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update date',
            },
          },
        },
        Multisig: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Multisig ID',
            },
            multisigPda: {
              type: 'string',
              description: 'Multisig PDA address',
            },
            createKey: {
              type: 'string',
              description: 'Create key used to derive the multisig',
            },
            name: {
              type: 'string',
              description: 'Multisig name',
            },
            threshold: {
              type: 'integer',
              description: 'Number of approvals required',
            },
            timeLock: {
              type: 'integer',
              description: 'Time lock in seconds',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether multisig is active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Multisig creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Multisig last update date',
            },
          },
        },
        MultisigMember: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Member ID',
            },
            multisigId: {
              type: 'integer',
              description: 'Multisig ID',
            },
            publicKey: {
              type: 'string',
              description: 'Member public key',
            },
            permissions: {
              type: 'string',
              description: 'JSON string of permissions',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether member is active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Member creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Member last update date',
            },
          },
        },
        MultisigTransaction: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Transaction ID',
            },
            multisigId: {
              type: 'integer',
              description: 'Multisig ID',
            },
            transactionIndex: {
              type: 'string',
              description: 'Transaction index from multisig',
            },
            fromWallet: {
              type: 'string',
              description: 'Source wallet address',
            },
            toWallet: {
              type: 'string',
              description: 'Destination wallet address',
            },
            amount: {
              type: 'number',
              format: 'decimal',
              description: 'Transfer amount',
            },
            currency: {
              type: 'string',
              description: 'Currency type',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PROPOSED', 'APPROVED', 'EXECUTED', 'REJECTED', 'CANCELLED', 'FAILED'],
              description: 'Transaction status',
            },
            transactionHash: {
              type: 'string',
              description: 'Blockchain transaction hash',
            },
            memo: {
              type: 'string',
              description: 'Transaction memo',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction last update date',
            },
          },
        },
        MultisigProposal: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Proposal ID',
            },
            multisigTransactionId: {
              type: 'integer',
              description: 'Multisig transaction ID',
            },
            proposerKey: {
              type: 'string',
              description: 'Proposer public key',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'STALE'],
              description: 'Proposal status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Proposal creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Proposal last update date',
            },
          },
        },
        MultisigApproval: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Approval ID',
            },
            multisigTransactionId: {
              type: 'integer',
              description: 'Multisig transaction ID',
            },
            memberId: {
              type: 'integer',
              description: 'Member ID',
            },
            approvalType: {
              type: 'string',
              enum: ['APPROVE', 'REJECT'],
              description: 'Approval type',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Approval creation date',
            },
          },
        },
        MultisigSignerRemoval: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Removal record ID',
            },
            multisigId: {
              type: 'integer',
              description: 'Multisig ID',
            },
            removedMemberId: {
              type: 'integer',
              description: 'ID of the removed member',
            },
            removedBy: {
              type: 'integer',
              description: 'ID of the member who initiated removal',
            },
            reason: {
              type: 'string',
              description: 'Reason for removal',
              example: 'INACTIVE_48H',
            },
            transactionIndex: {
              type: 'string',
              description: 'Transaction index if removal was part of a transaction',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Removal creation date',
            },
            removedMember: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                },
                publicKey: {
                  type: 'string',
                },
                permissions: {
                  type: 'string',
                },
              },
            },
            removedByMember: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                },
                publicKey: {
                  type: 'string',
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message',
            },
            error: {
              type: 'string',
              description: 'Error type',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/server.ts'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve as any);
  app.get('/api-docs', swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Fusee Backend API Documentation',
  }) as any);
};
