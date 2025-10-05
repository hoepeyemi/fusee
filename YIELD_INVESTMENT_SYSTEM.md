# Yield Investment System with Lulo.fi Integration

This document describes the comprehensive yield investment system that allows users to invest USDC to earn yield through the Lulo.fi protocol with multisig governance protection.

## 🎯 **Overview**

The Yield Investment System enables users to:
- **Invest USDC** in protected and regular yield pools
- **Earn Yield** through the Lulo.fi protocol
- **Withdraw Funds** with multisig approval
- **Track Performance** with real-time rates and pool data
- **Refer Others** and earn referral fees

## 🏗️ **Architecture**

### **Core Components**
1. **YieldInvestmentService** - Lulo.fi API integration and business logic
2. **MultisigProposalService** - Multisig governance for yield operations
3. **Database Models** - Yield investment tracking and history
4. **API Routes** - RESTful endpoints for yield operations
5. **Lulo.fi Integration** - Direct integration with Lulo protocol

### **Technology Stack**
- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: Solana (USDC transfers)
- **Yield Protocol**: Lulo.fi API
- **Multisig**: Squads Multisig SDK
- **API**: Express.js with Swagger documentation

## 🔧 **Implementation Details**

### **YieldInvestmentService**

The core service handles all Lulo.fi API interactions:

```typescript
export class YieldInvestmentService {
  // Lulo API configuration
  private static readonly LULO_API_BASE_URL = 'https://api.lulo.fi/v1';
  private static readonly USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  private static readonly DEFAULT_PRIORITY_FEE = '50000';

  // Core methods
  public static async initializeReferrer(userId, owner, feePayer, priorityFee)
  public static async createYieldInvestment(request: YieldInvestmentRequest)
  public static async withdrawProtected(request: YieldWithdrawalRequest)
  public static async initiateRegularWithdrawal(request: YieldWithdrawalRequest)
  public static async completeRegularWithdrawal(userId, owner, feePayer, pendingWithdrawalId, priorityFee)
  public static async getAccountData(owner: string)
  public static async getPoolData(owner?: string)
  public static async getRates(owner?: string)
  public static async getPendingWithdrawals(owner: string)
  public static async getReferrerData(owner: string)
}
```

### **Multisig Integration**

All yield investment operations go through multisig approval:

```typescript
// Create multisig proposal for yield investment
const proposal = await proposalService.createYieldInvestmentProposal({
  userId: request.userId,
  owner: request.owner,
  amount: totalAmount,
  type: investmentType,
  regularAmount: request.regularAmount,
  protectedAmount: request.protectedAmount,
  referrer: request.referrer,
  transaction: response.transaction
});
```

### **Database Schema**

```prisma
model YieldInvestment {
  id              Int      @id @default(autoincrement())
  userId          Int      // User who made the investment
  owner           String   // Owner wallet address
  type            String   // Investment type
  amount          Decimal  @db.Decimal(18, 8) // Total amount
  regularAmount   Decimal? @db.Decimal(18, 8) // Regular (boosted) amount
  protectedAmount Decimal? @db.Decimal(18, 8) // Protected amount
  status          YieldInvestmentStatus @default(PENDING)
  transactionHash String?  // Blockchain transaction hash
  luloAccount     String?  // Lulo account address
  referrerAccount String?  // Referrer account address
  proposalId      Int?     // Associated multisig proposal ID
  notes           String?  // Optional notes
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  user            User     @relation("UserYieldInvestments", fields: [userId], references: [id])
}

enum YieldInvestmentStatus {
  PENDING
  PENDING_APPROVAL
  COMPLETED
  FAILED
  CANCELLED
}
```

## 🚀 **API Endpoints**

### **Referrer Management**

#### **Initialize Referrer**
```http
POST /api/yield-investments/initialize-referrer
```

**Request Body:**
```json
{
  "userId": 1,
  "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "feePayer": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "priorityFee": "50000"
}
```

**Response:**
```json
{
  "message": "Referrer initialized successfully",
  "transaction": "serialized_transaction",
  "referrerAccount": "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb"
}
```

### **Investment Operations**

#### **Create Yield Investment (Deposit)**
```http
POST /api/yield-investments/deposit
```

**Request Body:**
```json
{
  "userId": 1,
  "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "feePayer": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "mintAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "regularAmount": 100,
  "protectedAmount": 100,
  "referrer": "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb",
  "priorityFee": "50000"
}
```

**Response:**
```json
{
  "message": "Yield investment created successfully",
  "investmentId": 1,
  "transactionHash": "serialized_transaction",
  "amount": 200,
  "type": "both",
  "status": "PENDING_APPROVAL",
  "luloAccount": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "referrerAccount": "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb"
}
```

#### **Withdraw Protected Amount**
```http
POST /api/yield-investments/withdraw-protected
```

**Request Body:**
```json
{
  "userId": 1,
  "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "feePayer": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
  "mintAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": 100,
  "priorityFee": "50000"
}
```

**Response:**
```json
{
  "message": "Protected withdrawal created successfully",
  "investmentId": 2,
  "transactionHash": "serialized_transaction",
  "amount": 100,
  "status": "PENDING_APPROVAL"
}
```

### **Information Endpoints**

#### **Get Pool Information**
```http
GET /api/yield-investments/pools?owner=34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB
```

**Response:**
```json
{
  "message": "Pool data retrieved successfully",
  "poolData": {
    "regular": {
      "type": "regular",
      "apy": 0.05362,
      "maxWithdrawalAmount": 6522716.075627998,
      "price": 1.0265194276154868
    },
    "protected": {
      "type": "protected",
      "apy": 0.03391,
      "openCapacity": 10969601.169450996,
      "price": 1.013087634928608
    },
    "averagePoolRate": 0.044989999999999995,
    "totalLiquidity": 18184662.880863,
    "availableLiquidity": 18092032.575819,
    "regularLiquidityAmount": 10471727.472168999,
    "protectedLiquidityAmount": 7712877.666794,
    "regularAvailableAmount": 10379154.909024999
  }
}
```

#### **Get Current Rates**
```http
GET /api/yield-investments/rates?owner=34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB
```

**Response:**
```json
{
  "message": "Rates retrieved successfully",
  "rates": {
    "regular": {
      "CURRENT": 5.361737287044537,
      "1HR": 5.352833333333333,
      "1YR": 6.149049862132353,
      "24HR": 5.219689655172414,
      "30DAY": 6.149049862132353,
      "7DAY": 5.356581602373887
    },
    "protected": {
      "CURRENT": 3.3912778882139367,
      "1HR": 3.385666666666667,
      "1YR": 3.4463903952205883,
      "24HR": 3.3047724137931036,
      "30DAY": 3.4463903952205883,
      "7DAY": 3.40368743818002
    }
  }
}
```

#### **Get User's Yield Investments**
```http
GET /api/yield-investments/user/1
```

**Response:**
```json
{
  "message": "User yield investments retrieved successfully",
  "investments": [
    {
      "id": 1,
      "userId": 1,
      "owner": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
      "type": "BOTH",
      "amount": 200,
      "regularAmount": 100,
      "protectedAmount": 100,
      "status": "COMPLETED",
      "transactionHash": "abc123...",
      "luloAccount": "34uJxiy6ZjVAALgjdhbWjdC51W2sauqpZrYG6x3wqgyB",
      "referrerAccount": "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb",
      "proposalId": 1,
      "notes": "Yield investment: both - 200 USDC",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## 🔒 **Security Features**

### **Multisig Protection**
- **All Operations**: Every yield investment operation requires multisig approval
- **Proposal Creation**: Automatic proposal creation for all transactions
- **Approval Process**: Multiple signers must approve before execution
- **Transaction Safety**: No direct execution without proper approvals

### **Input Validation**
- **Amount Validation**: Ensures positive amounts for all operations
- **Address Validation**: Validates Solana wallet addresses
- **User Validation**: Verifies user existence before operations
- **Currency Validation**: Only USDC is supported for yield investments

### **Error Handling**
- **API Errors**: Comprehensive error handling for Lulo.fi API failures
- **Validation Errors**: Clear error messages for invalid inputs
- **Database Errors**: Graceful handling of database operation failures
- **Transaction Errors**: Proper error handling for blockchain operations

## 📊 **Investment Types**

### **Protected Investments**
- **Lower Risk**: Capital protection with lower yield
- **Stable Returns**: More predictable returns
- **Immediate Withdrawal**: Can be withdrawn immediately
- **Lower APY**: Typically 3-4% APY

### **Regular (Boosted) Investments**
- **Higher Risk**: Higher yield potential
- **Variable Returns**: Returns can fluctuate
- **Withdrawal Delay**: Requires initiation and completion process
- **Higher APY**: Typically 5-6% APY

### **Combined Investments**
- **Balanced Approach**: Mix of protected and regular
- **Risk Management**: Diversified risk profile
- **Flexible Withdrawal**: Different withdrawal rules for each type
- **Optimized Returns**: Balance between safety and yield

## 🔄 **Workflow**

### **Investment Workflow**
1. **User Request**: User initiates yield investment
2. **Validation**: System validates inputs and user
3. **Lulo API Call**: Generate transaction from Lulo.fi
4. **Multisig Proposal**: Create multisig proposal for approval
5. **Approval Process**: Multisig members approve the transaction
6. **Execution**: Execute approved transaction
7. **Status Update**: Update investment status in database

### **Withdrawal Workflow**
1. **Withdrawal Request**: User requests withdrawal
2. **Validation**: Validate withdrawal amount and user
3. **Lulo API Call**: Generate withdrawal transaction
4. **Multisig Proposal**: Create multisig proposal
5. **Approval Process**: Multisig members approve
6. **Execution**: Execute withdrawal transaction
7. **Status Update**: Update withdrawal status

## 🛠️ **Configuration**

### **Environment Variables**
```bash
# Lulo.fi API Configuration
LULO_API_KEY=your_lulo_api_key_here

# Solana Configuration
RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_PRIVATE_KEY=your_solana_private_key

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/fusee_backend
```

### **API Configuration**
- **Base URL**: `https://api.lulo.fi/v1`
- **USDC Mint**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Default Priority Fee**: `50000` lamports
- **Timeout**: 30 seconds for API calls

## 📈 **Performance Monitoring**

### **Key Metrics**
- **Investment Volume**: Total USDC invested
- **Yield Generated**: Total yield earned by users
- **Withdrawal Volume**: Total USDC withdrawn
- **Success Rate**: Percentage of successful operations
- **Average APY**: Average yield rate across all investments

### **Monitoring Endpoints**
- **Pool Data**: Real-time pool information
- **Current Rates**: Live yield rates
- **User Investments**: Individual user performance
- **Pending Withdrawals**: Withdrawal queue status

## 🚨 **Error Handling**

### **Common Errors**

#### **API Errors**
```json
{
  "message": "Failed to communicate with Lulo API",
  "error": "Internal Server Error",
  "details": "Lulo API error: 400 - Invalid request"
}
```

#### **Validation Errors**
```json
{
  "message": "Missing required fields",
  "error": "Bad Request",
  "required": ["userId", "owner", "feePayer"]
}
```

#### **User Errors**
```json
{
  "message": "User not found",
  "error": "Bad Request",
  "details": "User with ID 1 does not exist"
}
```

### **Error Recovery**
- **Retry Logic**: Automatic retry for transient failures
- **Fallback Mechanisms**: Alternative approaches for failed operations
- **User Notifications**: Clear error messages for users
- **Logging**: Comprehensive error logging for debugging

## 🔧 **Testing**

### **Unit Tests**
```typescript
describe('YieldInvestmentService', () => {
  test('should create yield investment successfully', async () => {
    const request = {
      userId: 1,
      owner: 'test_wallet',
      feePayer: 'test_wallet',
      protectedAmount: 100
    };
    
    const result = await YieldInvestmentService.createYieldInvestment(request);
    expect(result.status).toBe('PENDING_APPROVAL');
  });
});
```

### **Integration Tests**
```typescript
describe('Yield Investment API', () => {
  test('POST /api/yield-investments/deposit', async () => {
    const response = await request(app)
      .post('/api/yield-investments/deposit')
      .send({
        userId: 1,
        owner: 'test_wallet',
        feePayer: 'test_wallet',
        protectedAmount: 100
      });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Yield investment created successfully');
  });
});
```

## 🚀 **Deployment**

### **Prerequisites**
1. **Lulo.fi API Key**: Obtain API key from Lulo.fi
2. **Database Setup**: PostgreSQL database with Prisma schema
3. **Solana Configuration**: RPC URL and private keys
4. **Multisig Setup**: Configured multisig accounts

### **Deployment Steps**
1. **Environment Setup**: Configure environment variables
2. **Database Migration**: Run Prisma migrations
3. **API Key Configuration**: Set Lulo.fi API key
4. **Service Deployment**: Deploy to production environment
5. **Health Checks**: Verify all endpoints are working

## 📋 **Future Enhancements**

### **Planned Features**
- **Auto-Compounding**: Automatic reinvestment of yield
- **Yield Analytics**: Advanced analytics and reporting
- **Portfolio Management**: Multi-pool portfolio management
- **Risk Assessment**: Automated risk scoring
- **Yield Optimization**: AI-powered yield optimization

### **Integration Opportunities**
- **Additional Protocols**: Integration with other yield protocols
- **Cross-Chain**: Support for other blockchains
- **Mobile App**: Native mobile application
- **Dashboard**: Advanced user dashboard
- **Notifications**: Real-time yield notifications

## 🎯 **Benefits**

### **For Users**
- **Earn Yield**: Generate passive income from USDC
- **Capital Protection**: Protected investments with lower risk
- **Flexibility**: Choose between protected and regular investments
- **Transparency**: Real-time rates and pool information
- **Security**: Multisig protection for all operations

### **For Platform**
- **Revenue Generation**: Fee collection from yield operations
- **User Retention**: Increased user engagement through yield earning
- **Competitive Advantage**: Unique yield earning feature
- **Scalability**: Efficient handling of multiple users and investments
- **Compliance**: Proper audit trail and transaction tracking

The Yield Investment System provides a comprehensive, secure, and user-friendly way for users to earn yield on their USDC investments through the Lulo.fi protocol with full multisig governance protection! 🎉

