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
            currency: {
              type: 'string',
              description: 'Currency type',
              example: 'SOL',
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
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Fusee Backend API Documentation',
  }));
};
