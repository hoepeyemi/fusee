# Fusee Backend

A secure Express.js backend with Prisma, PostgreSQL, and comprehensive security features for Solana wallet integration.

## Features

- 🚀 Express.js with TypeScript
- 🗄️ Prisma ORM with PostgreSQL
- 📚 Swagger API documentation
- 🔒 **Comprehensive Security Implementation**
- 🛡️ XSS Protection & Data Sanitization
- 🔐 CSRF Protection with Tokens
- ⚡ Rate Limiting & DDoS Protection
- 🔍 Input Validation & Sanitization
- 🌐 Secure CORS Configuration
- 🏥 Health check endpoint
- 💰 Solana Wallet Integration
- 🔄 Cryptocurrency Transfer System
- 👤 First Name to Wallet Address Mapping

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Update the `.env` file with your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/fusee_db?schema=public"
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET="your-super-secret-session-key-change-in-production"
   ALLOWED_ORIGINS="http://localhost:3000,https://yourdomain.com"
   ```

3. **Set up the database:**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database (for development)
   npm run db:push
   
   # Or run migrations (for production)
   npm run db:migrate
   
   # Seed the database with sample data
   npm run db:seed
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health
- **API Info**: http://localhost:3000/

## Security Features

### 🔒 **Comprehensive Security Implementation**

This API includes enterprise-grade security features:

- **Input Validation**: All inputs are validated using express-validator with custom rules
- **XSS Protection**: Automatic sanitization of all request data to prevent cross-site scripting
- **CSRF Protection**: Token-based protection against cross-site request forgery attacks
- **Rate Limiting**: 100 requests per 15 minutes per IP address
- **Speed Limiting**: Delays requests after 50 requests in 15 minutes
- **Security Headers**: Comprehensive security headers including CSP, X-Frame-Options, etc.
- **Data Sanitization**: All data is sanitized before database operations
- **CORS Protection**: Secure cross-origin resource sharing configuration

### 🛡️ **Security Endpoints**

- `GET /api/csrf-token` - Get CSRF token for frontend integration
- All other endpoints require valid CSRF tokens in the `X-CSRF-Token` header

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data

## API Endpoints

### 🔐 **Protected Endpoints** (Require CSRF Token)

#### Users
- `POST /api/users` - Create a new user with Solana wallet
- `GET /api/users/:id` - Get user details by ID

#### Transfers
- `POST /api/transfers` - Send cryptocurrency to another user by first name
- `GET /api/transfers/sender/:senderId` - Get all transfers sent by a user
- `GET /api/transfers/receiver/:receiverId` - Get all transfers received by a user
- `GET /api/transfers/wallets` - Get all active wallet addresses by first name

#### Security
- `GET /api/csrf-token` - Get CSRF token for frontend

### 🌐 **Public Endpoints**

#### General
- `GET /` - API information and available endpoints
- `GET /health` - Health check with security headers
- `GET /api-docs` - Swagger API documentation

## API Usage Examples

### Creating a User (with CSRF Protection)

1. **Get CSRF Token:**
   ```bash
   curl -X GET http://localhost:3000/api/csrf-token
   ```

2. **Create User:**
   ```bash
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
     -d '{
       "email": "john.doe@example.com",
       "fullName": "John Doe",
       "phoneNumber": "+1234567890",
       "solanaWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
     }'
   ```

3. **Get User Details:**
   ```bash
   curl -X GET http://localhost:3000/api/users/1 \
     -H "X-CSRF-Token: YOUR_CSRF_TOKEN"
   ```

### Sending Cryptocurrency (by First Name)

1. **Send Transfer:**
   ```bash
   curl -X POST http://localhost:3000/api/transfers \
     -H "Content-Type: application/json" \
     -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
     -d '{
       "senderId": 1,
       "receiverFirstName": "Jane",
       "amount": 0.5,
       "currency": "SOL",
       "notes": "Payment for services"
     }'
   ```

2. **Get All Wallets:**
   ```bash
   curl -X GET http://localhost:3000/api/transfers/wallets \
     -H "X-CSRF-Token: YOUR_CSRF_TOKEN"
   ```

3. **Get User's Transfer History:**
   ```bash
   # Sent transfers
   curl -X GET http://localhost:3000/api/transfers/sender/1 \
     -H "X-CSRF-Token: YOUR_CSRF_TOKEN"
   
   # Received transfers
   curl -X GET http://localhost:3000/api/transfers/receiver/2 \
     -H "X-CSRF-Token: YOUR_CSRF_TOKEN"
   ```

## Database Schema

The application uses a comprehensive schema for user registration and cryptocurrency transfers:

### User Model
- `id` (Int, Primary Key, Auto-increment)
- `email` (String, Unique, Required) - Validated email format
- `fullName` (String, Required) - User's full name (2-100 characters)
- `firstName` (String, Required) - Extracted first name for wallet lookup
- `phoneNumber` (String, Optional) - Mobile phone number with validation
- `solanaWallet` (String, Unique, Required) - Solana wallet address (32-44 chars, base58)
- `createdAt` (DateTime, Auto-generated)
- `updatedAt` (DateTime, Auto-updated)
- `sentTransfers` (Relation to Transfer[]) - Transfers sent by this user
- `receivedTransfers` (Relation to Transfer[]) - Transfers received by this user

### Wallet Model
- `id` (Int, Primary Key, Auto-increment)
- `firstName` (String, Unique, Required) - First name for wallet lookup
- `address` (String, Unique, Required) - Associated wallet address
- `isActive` (Boolean, Default: true) - Whether wallet is active
- `createdAt` (DateTime, Auto-generated)
- `updatedAt` (DateTime, Auto-updated)

### Transfer Model
- `id` (Int, Primary Key, Auto-increment)
- `senderId` (Int, Foreign Key) - Sender user ID
- `receiverId` (Int, Foreign Key) - Receiver user ID
- `amount` (Decimal, Required) - Transfer amount (18 digits, 8 decimals)
- `currency` (String, Default: "SOL") - Currency type
- `status` (Enum, Default: PENDING) - Transfer status (PENDING, COMPLETED, FAILED, CANCELLED)
- `transactionHash` (String, Optional) - Blockchain transaction hash
- `notes` (String, Optional) - Transfer notes
- `createdAt` (DateTime, Auto-generated)
- `updatedAt` (DateTime, Auto-updated)
- `sender` (Relation to User) - Sender user details
- `receiver` (Relation to User) - Receiver user details

## Input Validation Rules

### Email Validation
- Required field
- Must be valid email format
- Automatically normalized

### Full Name Validation
- Required field
- 2-100 characters length
- Only letters, spaces, hyphens, and apostrophes allowed

### Phone Number Validation
- Optional field
- Must be valid mobile phone format
- Supports international formats

### Solana Wallet Validation
- Required field
- 32-44 characters length
- Must be valid base58 encoded string
- Unique constraint enforced

### Transfer Validation
- Sender ID: Required, must be positive integer
- Receiver First Name: Required, non-empty string
- Amount: Required, positive number, max 1,000,000
- Currency: Optional, must be string (default: SOL)
- Notes: Optional, must be string

## Error Handling

The API provides comprehensive error handling with detailed error messages:

- **400 Bad Request**: Validation errors with field-specific messages
- **403 Forbidden**: CSRF token missing or invalid
- **404 Not Found**: Resource not found
- **409 Conflict**: Email or wallet address already exists
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side errors

## Security Considerations

### Production Deployment
- Change `SESSION_SECRET` to a strong, random value
- Configure `ALLOWED_ORIGINS` with your actual domain
- Use HTTPS in production
- Consider implementing JWT authentication for user sessions
- Monitor rate limiting and security logs

### CSRF Token Management
- Tokens are IP-based and expire after 24 hours
- Frontend must include tokens in `X-CSRF-Token` header
- Tokens are automatically generated for each request

## Development

The project uses TypeScript with strict type checking. All API routes include comprehensive Swagger documentation for easy testing and integration.

### Project Structure
```
src/
├── middleware/
│   ├── security.ts    # Security middleware (validation, XSS, rate limiting)
│   └── csrf.ts        # CSRF protection
├── routes/
│   └── users.ts       # User API routes
├── lib/
│   └── prisma.ts      # Prisma client
├── server.ts          # Main server file
└── swagger.ts         # Swagger configuration
```

## Testing

Run the security test suite:
```bash
node test-security.js
```

## License

ISC
