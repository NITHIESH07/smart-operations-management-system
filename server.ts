import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer as createViteServer } from 'vite';
import { connectDB } from './server/src/config/db.ts';
import './server/src/models/index.ts';
import authRouter from './server/src/routes/auth.ts';
import projectsRouter from './server/src/routes/projects.ts';
import usersRouter from './server/src/routes/users.ts';
import tasksRouter from './server/src/routes/tasks.ts';
import dashboardRouter from './server/src/routes/dashboard.ts';

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser middleware
  app.use(express.json());

  // Connect to MongoDB
  await connectDB();

  // Authentication & Management API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/dashboard', dashboardRouter);

  // Basic API Health check route
  app.get('/api/health', async (req, res) => {
    // If not connected yet but MONGODB_URI is provided, attempt connection
    if (mongoose.connection.readyState === 0 && process.env.MONGODB_URI) {
      await connectDB();
    }

    const dbState = mongoose.connection.readyState;
    const isDbConnected = dbState === 1;
    const stateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    res.json({
      status: 'ok',
      service: 'Smart Operations Management System API',
      database: {
        connected: isDbConnected,
        state: stateMap[dbState] || 'disconnected',
        host: isDbConnected ? mongoose.connection.host : undefined,
        name: isDbConnected ? mongoose.connection.name : undefined,
        models: Object.keys(mongoose.models),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware for SPA development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
