# Fusee Backend

A modern Express.js backend with Prisma, PostgreSQL, and Swagger documentation.

## Features

- 🚀 Express.js with TypeScript
- 🗄️ Prisma ORM with PostgreSQL
- 📚 Swagger API documentation
- 🔄 CORS enabled
- 🌱 Database seeding
- 🏥 Health check endpoint

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

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user
- `GET /api/users/:id` - Get user by ID

### Posts
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create a new post
- `GET /api/posts/:id` - Get post by ID

### General
- `GET /` - Welcome message
- `GET /health` - Health check

## Database Schema

The application includes two main models:

### User
- `id` (Int, Primary Key)
- `email` (String, Unique)
- `name` (String, Optional)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
- `posts` (Relation to Post[])

### Post
- `id` (Int, Primary Key)
- `title` (String)
- `content` (String, Optional)
- `published` (Boolean, Default: false)
- `authorId` (Int, Foreign Key)
- `author` (Relation to User)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

## Development

The project uses TypeScript with strict type checking. All API routes include comprehensive Swagger documentation for easy testing and integration.

## License

ISC
