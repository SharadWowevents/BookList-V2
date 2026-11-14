import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import boardRoutes from './routes/boardRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import shareRoutes from './routes/shareRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import crmRoutes from './routes/crmRoutes.js';
import audioRoutes from './routes/audioRoutes.js';
import journalRoutes from './routes/journalRoutes.js';
import { setupMcpSseRoutes } from './mcp/sseHandler.js';
import { setupOAuthRoutes } from './mcp/oauth.js';
import { startAutoBackupScheduler } from './services/backupService.js';
import { initWebSocketServer } from './services/websocketService.js';

dotenv.config();

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 5016;

// Connect to MongoDB
connectDB();

// Start Background Auto-Backup Scheduler (Max 5 Backups)
startAutoBackupScheduler();

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
app.use('/api/crm', crmRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/journal', journalRoutes);

// Model Context Protocol (MCP) & OAuth Routes
setupOAuthRoutes(app);
setupMcpSseRoutes(app);

// Root path redirect to wowos.in
app.get('/', (req, res) => {
  res.redirect(301, 'https://wowos.in');
});

// Public view link redirect
app.get('/p/:sid', (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'https://mydeepwork.in';
  res.redirect(`${clientUrl}/p/${req.params.sid}`);
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

const server = http.createServer(app);
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`[MyDeepwork Server] Running on http://localhost:${PORT}`);
});
