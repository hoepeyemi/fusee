import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSwagger } from './swagger';
import userRoutes from './routes/users';
import transferRoutes from './routes/transfers';
import vaultRoutes from './routes/vault';
import walletTransferRoutes from './routes/walletTransfers';
import externalTransferRoutes from './routes/externalTransfers';
import multisigRoutes from './routes/multisig';
import signerManagementRoutes from './routes/signerManagement';
import { BackgroundJobs } from './services/backgroundJobs';
import { 
  helmetMiddleware, 
  rateLimiter, 
  speedLimiter, 
  xssProtection, 
  securityHeaders 
} from './middleware/security';
import { generateCSRFToken, verifyCSRFToken, getCSRFToken } from './middleware/csrf';

// Load environment variables
dotenv.config({ path: '.env' });

console.log('🚀 Starting server...');
console.log('📁 Environment:', process.env.NODE_ENV || 'development');

const app: Express = express();
const PORT = process.env.PORT || 3000;

console.log('⚙️  Configuring middleware...');

// Security middleware (order matters!)
app.use(helmetMiddleware);
app.use(securityHeaders);
app.use(rateLimiter);
app.use(speedLimiter);

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('CORS allowing request with no origin');
      return callback(null, true);
    }
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://fusee.onrender.com'
    ];
    
    // In production, be more permissive for render.com domains
    if (process.env.NODE_ENV === 'production') {
      if (origin.includes('render.com') || origin.includes('fusee.onrender.com')) {
        console.log('CORS allowing render.com origin:', origin);
        return callback(null, true);
      }
    }
    
    // In development, be more permissive for localhost
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        console.log('CORS allowing localhost origin:', origin);
        return callback(null, true);
      }
    }
    
    // Log for debugging
    console.log('CORS checking origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    if (allowedOrigins.includes(origin)) {
      console.log('CORS allowing origin:', origin);
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Additional CORS fallback for production
if (process.env.NODE_ENV === 'production') {
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin && (origin.includes('render.com') || origin.includes('fusee.onrender.com'))) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, Accept');
    }
    next();
  });
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// XSS protection
app.use(xssProtection);

// CSRF protection
app.use(generateCSRFToken);

// Setup Swagger documentation
setupSwagger(app);

// CSRF token endpoint
app.get('/api/csrf-token', getCSRFToken);

// Routes with CSRF protection
app.use('/api/users', verifyCSRFToken, userRoutes);
app.use('/api/transfers', verifyCSRFToken, transferRoutes);
app.use('/api/vault', verifyCSRFToken, vaultRoutes);
app.use('/api/wallet-transfers', verifyCSRFToken, walletTransferRoutes);
app.use('/api/external-transfers', verifyCSRFToken, externalTransferRoutes);
app.use('/api/multisig', verifyCSRFToken, multisigRoutes);
app.use('/api/signer-management', verifyCSRFToken, signerManagementRoutes);

/**
 * @swagger
 * /:
 *   get:
 *     summary: API Information
 *     tags: [General]
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Fusee Backend API - User Registration Service"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     createUser:
 *                       type: string
 *                       example: "POST /api/users"
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Fusee Backend API - User Registration Service',
    version: '1.0.0',
        endpoints: {
          createUser: 'POST /api/users',
          getUser: 'GET /api/users/{id}',
          sendTransfer: 'POST /api/transfers',
          getSentTransfers: 'GET /api/transfers/sender/{senderId}',
          getReceivedTransfers: 'GET /api/transfers/receiver/{receiverId}',
          getWallets: 'GET /api/transfers/wallets',
          getUserBalance: 'GET /api/vault/balance/{userId}',
          deposit: 'POST /api/vault/deposit',
          withdraw: 'POST /api/vault/withdraw',
          vaultStatus: 'GET /api/vault/status',
          getWalletAddress: 'GET /api/vault/wallet/address',
          getFeeWalletInfo: 'GET /api/vault/fee-wallet/info',
          getFeeWalletAddress: 'GET /api/vault/fee-wallet/address',
          walletTransfer: 'POST /api/wallet-transfers',
          getWalletTransfer: 'GET /api/wallet-transfers/{id}',
          getWalletTransfers: 'GET /api/wallet-transfers/wallet/{address}',
          walletTransferStats: 'GET /api/wallet-transfers/statistics',
          externalTransfer: 'POST /api/external-transfers',
          getExternalTransfer: 'GET /api/external-transfers/{id}',
          getExternalTransfersByUser: 'GET /api/external-transfers/user/{userId}',
          getExternalTransfersByWallet: 'GET /api/external-transfers/external-wallet/{address}',
          externalTransferStats: 'GET /api/external-transfers/statistics',
          createMultisig: 'POST /api/multisig/create',
          getMultisig: 'GET /api/multisig/{multisigPda}',
          createTransaction: 'POST /api/multisig/{multisigPda}/transactions',
          createProposal: 'POST /api/multisig/{multisigPda}/proposals',
          approveProposal: 'POST /api/multisig/{multisigPda}/approve',
          rejectProposal: 'POST /api/multisig/{multisigPda}/reject',
          executeTransaction: 'POST /api/multisig/{multisigPda}/execute',
          getTransactionStatus: 'GET /api/multisig/{multisigPda}/status/{transactionIndex}'
        }
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: 'Route not found',
    error: 'Not Found',
  });
});

console.log('🌐 Starting server...');
app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
  console.log(`📚[docs]: API documentation available at http://localhost:${PORT}/api-docs`);
  
  // Start background jobs
  BackgroundJobs.start();
});

console.log('✅ Server setup complete');