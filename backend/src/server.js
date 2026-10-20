import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import boardRoutes from './routes/boardRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import shareRoutes from './routes/shareRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { setupMcpSseRoutes } from './mcp/sseHandler.js';
import { setupOAuthRoutes } from './mcp/oauth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5016;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'MyDeepwork Backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/admin', adminRoutes);

// Model Context Protocol (MCP) & OAuth Routes
setupOAuthRoutes(app);
setupMcpSseRoutes(app);

// Public view link redirect
app.get('/p/:sid', (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  res.redirect(`${clientUrl}/#p.${req.params.sid}`);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`[MyDeepwork Server] Running on http://localhost:${PORT}`);
});
