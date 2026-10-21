import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { McpAuthManager } from './auth.js';
import { registerMcpTools } from './tools.js';
import { registerMcpResources } from './resources.js';
import { registerMcpPrompts } from './prompts.js';
import { getBaseUrl } from './oauth.js';

const transports = new Map();

export function setupMcpSseRoutes(app) {
  const handleSseConnection = async (req, res) => {
    try {
      const base = getBaseUrl(req);
      const authManager = new McpAuthManager();

      // Check for authentication via Bearer token, query token, or credentials
      const authHeader = req.headers.authorization;
      const token = req.query.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
      const queryUser = req.query.username;
      const queryPass = req.query.password;

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mydeepwork_secret');
          const user = await User.findById(decoded.id);
          if (user && user.status === 'active') {
            authManager.currentUser = user;
          }
        } catch (err) {
          console.error('[MCP SSE Token Invalid]:', err.message);
        }
      } else if (queryUser && queryPass) {
        await authManager.authenticate(queryUser, queryPass);
      }

      // If client didn't authenticate, we still allow connection so tools like 'login' can be used,
      // but we add WWW-Authenticate header so OAuth clients (like ChatGPT) discover the auth metadata
      res.setHeader('WWW-Authenticate', `Bearer realm="mcp", resource_metadata="${base}/api/.well-known/oauth-protected-resource"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');

      const messageEndpoint = '/api/mcp/messages';
      const transport = new SSEServerTransport(messageEndpoint, res);

      const server = new McpServer({
        name: 'booklist-mcp-server-http',
        version: '1.0.0'
      });

      registerMcpTools(server, authManager);
      registerMcpResources(server, authManager);
      registerMcpPrompts(server);

      transports.set(transport.sessionId, transport);

      req.on('close', () => {
        transports.delete(transport.sessionId);
      });

      await server.connect(transport);
    } catch (err) {
      console.error('[MCP SSE Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to initialize MCP SSE connection.' });
      }
    }
  };

  const handlePostMessage = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const sessionId = req.query.sessionId;
    const transport = sessionId ? transports.get(sessionId) : null;

    if (!transport) {
      // If it's a JSON-RPC probe (e.g. OpenAI / ping / initialize)
      if (req.body && req.body.jsonrpc === '2.0') {
        const method = req.body.method;
        if (method === 'initialize') {
          return res.json({
            jsonrpc: '2.0',
            id: req.body.id ?? 1,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: true },
                resources: { subscribe: false, listChanged: true },
                prompts: { listChanged: true }
              },
              serverInfo: {
                name: 'booklist-mcp-server-http',
                version: '1.0.0'
              }
            }
          });
        }
        if (method === 'ping') {
          return res.json({
            jsonrpc: '2.0',
            id: req.body.id ?? 1,
            result: {}
          });
        }
        return res.status(200).json({
          jsonrpc: '2.0',
          id: req.body.id ?? null,
          error: {
            code: -32000,
            message: sessionId ? `MCP Session "${sessionId}" expired.` : 'Session ID required for stateful MCP calls. Connect via SSE endpoint /api/mcp/sse first.'
          }
        });
      }

      return res.status(404).json({ message: sessionId ? `MCP Session "${sessionId}" not found or expired.` : 'Missing sessionId query parameter.' });
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (err) {
      console.error('[MCP PostMessage Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error handling MCP message.' });
      }
    }
  };

  // Support /api/mcp/sse
  app.get('/api/mcp/sse', handleSseConnection);

  // Support /api/mcp/messages
  app.post('/api/mcp/messages', handlePostMessage);

  // Support /api/mcp for both SSE and JSON discovery depending on Accept header
  app.all('/api/mcp', async (req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      return res.sendStatus(204);
    }

    if (req.method === 'POST') {
      return handlePostMessage(req, res);
    }

    if (req.method === 'GET') {
      const accept = req.headers.accept || '';
      if (accept.includes('text/event-stream')) {
        return handleSseConnection(req, res);
      }

      // Otherwise return discovery JSON
      const base = getBaseUrl(req);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('WWW-Authenticate', `Bearer realm="mcp", resource_metadata="${base}/api/.well-known/oauth-protected-resource"`);
      return res.json({
        name: 'BookList MCP Server',
        version: '1.0.0',
        protocols: ['mcp/1.0'],
        authentication: {
          type: 'oauth2',
          authorization_url: `${base}/api/oauth/authorize`,
          token_url: `${base}/api/oauth/token`,
          registration_url: `${base}/api/oauth/register`,
          discovery_url: `${base}/api/.well-known/oauth-authorization-server`
        },
        transports: {
          sse: {
            endpoint: `${base}/api/mcp/sse`,
            messageEndpoint: `${base}/api/mcp/messages`
          },
          stdio: {
            command: 'node',
            args: ['backend/src/mcp/index.js'],
            npmScript: 'npm run mcp'
          }
        },
        status: 'active',
        description: 'Model Context Protocol server for BookList & MyDeepwork. Log in with your User DB credentials to manage lists, tasks, notes, and CRM members, renewals, follow-ups, and session history.'
      });
    }

    next();
  });
}
