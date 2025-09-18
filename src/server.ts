import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSwagger } from './swagger';
import userRoutes from './routes/users';
import transferRoutes from './routes/transfers';
import vaultRoutes from './routes/vault';
import walletTransferRoutes from './routes/walletTransfers';
import externalTransferRoutes from './routes/externalTransfers';
import { 
  helmetMiddleware, 
  rateLimiter, 
  speedLimiter, 
  xssProtection, 
  securityHeaders 
} from './middleware/security';
import { generateCSRFToken, verifyCSRFToken, getCSRFToken } from './middleware/csrf';

// Load environment variables
dotenv.config();

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
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

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
          externalTransferStats: 'GET /api/external-transfers/statistics'
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
});

console.log('✅ Server setup complete');