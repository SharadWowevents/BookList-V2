#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { McpAuthManager } from './auth.js';
import { registerMcpTools } from './tools.js';
import { registerMcpResources } from './resources.js';
import { registerMcpPrompts } from './prompts.js';

// Ensure stderr is used for all logging so stdout is reserved exclusively for MCP JSON-RPC
const originalLog = console.log;
console.log = (...args) => console.error('[MCP Info]', ...args);
console.info = (...args) => console.error('[MCP Info]', ...args);

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mydeepwork';
  try {
    await mongoose.connect(mongoUri);
    console.error(`[MCP] Connected to MongoDB at ${mongoUri}`);
  } catch (err) {
    console.error(`[MCP] Failed to connect to MongoDB: ${err.message}`);
    process.exit(1);
  }

  const authManager = new McpAuthManager();

  // Check for auto-login credentials via CLI flags or environment variables
  const args = process.argv.slice(2);
  let initialUsername = process.env.BOOKLIST_USERNAME || process.env.MCP_USERNAME || null;
  let initialPassword = process.env.BOOKLIST_PASSWORD || process.env.MCP_PASSWORD || null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--username' || args[i] === '-u') && args[i + 1]) {
      initialUsername = args[++i];
    } else if ((args[i] === '--password' || args[i] === '-p') && args[i + 1]) {
      initialPassword = args[++i];
    }
  }

  if (initialUsername && initialPassword) {
    const authRes = await authManager.authenticate(initialUsername, initialPassword);
    if (authRes.success) {
      console.error(`[MCP] Auto-authenticated as @${authRes.user.username} (${authRes.user.name})`);
    } else {
      console.error(`[MCP] Auto-authentication failed: ${authRes.error}`);
    }
  } else {
    console.error('[MCP] Starting without pre-authentication. AI can authenticate using the "login" tool.');
  }

  const server = new McpServer({
    name: 'booklist-mcp-server',
    version: '1.0.0'
  });

  registerMcpTools(server, authManager);
  registerMcpResources(server, authManager);
  registerMcpPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] BookList MCP Server running on Stdio transport.');
}

main().catch(err => {
  console.error('[MCP Fatal Error]:', err);
  process.exit(1);
});

