import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSwagger } from './swagger';
import userRoutes from './routes/users';

// Load environment variables
dotenv.config();

console.log('🚀 Starting server...');
console.log('📁 Environment:', process.env.NODE_ENV || 'development');

const app: Express = express();
const PORT = process.env.PORT || 3000;

console.log('⚙️  Configuring middleware...');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Swagger documentation
setupSwagger(app);

// Routes
app.use('/api/users', userRoutes);

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
      createUser: 'POST /api/users'
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