import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { McpAuthManager } from './auth.js';
import { registerMcpTools } from './tools.js';
import { registerMcpResources } from './resources.js';
import { registerMcpPrompts } from './prompts.js';
import { getBaseUrl, renderLoginPage, handleAuthorizePost } from './oauth.js';

const transports = new Map();

// Helper to instantiate server for stateless HTTP requests (OpenAI action discovery and tool calls)
const createStatelessServer = async (req) => {
  const authManager = new McpAuthManager();
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
      console.error('[MCP Stateless Auth Invalid]:', err.message);
    }
  } else if (queryUser && queryPass) {
    await authManager.authenticate(queryUser, queryPass);
  }

  const server = new McpServer({
    name: 'booklist-mcp-server-http',
    version: '1.0.0'
  });

  registerMcpTools(server, authManager);
  registerMcpResources(server, authManager);
  registerMcpPrompts(server);

  const mockTransport = {
    start: async () => {},
    onclose: null,
    onerror: null,
    onmessage: null,
    send: async () => {}
  };
  await server.connect(mockTransport);

  return { server, authManager };
};

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
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const sessionId = req.query.sessionId;
    const transport = sessionId ? transports.get(sessionId) : null;

    if (transport) {
      try {
        await transport.handlePostMessage(req, res);
      } catch (err) {
        console.error('[MCP PostMessage Error]:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error handling MCP message.' });
        }
      }
      return;
    }

    // Stateless Streamable HTTP handling (for OpenAI / ChatGPT discovery & direct calls)
    if (req.body && req.body.jsonrpc === '2.0') {
      const { id, method, params } = req.body;

      if (method === 'initialize') {
        return res.json({
          jsonrpc: '2.0',
          id: id ?? 1,
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
          id: id ?? 1,
          result: {}
        });
      }

      try {
        const { server } = await createStatelessServer(req);
        const handler = server.server._requestHandlers.get(method);

        if (handler) {
          const result = await handler({ method, params });
          return res.json({
            jsonrpc: '2.0',
            id: id ?? 1,
            result
          });
        }

        return res.status(200).json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: -32601,
            message: `Method "${method}" not found.`
          }
        });
      } catch (err) {
        console.error(`[MCP Stateless Method "${method}" Error]:`, err);
        return res.status(200).json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: -32000,
            message: err.message || 'Error processing MCP request.'
          }
        });
      }
    }

    return res.status(404).json({ message: sessionId ? `MCP Session "${sessionId}" not found or expired.` : 'Missing sessionId query parameter.' });
  };

  // Support /api/mcp/sse
  app.get('/api/mcp/sse', handleSseConnection);

  // Support /api/mcp/messages
  app.post('/api/mcp/messages', handlePostMessage);

  // Support /api/mcp for Browser UI (screenshot), SSE, Stateless POST, and Discovery JSON
  app.all('/api/mcp', async (req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      return res.sendStatus(204);
    }

    if (req.method === 'POST') {
      // Check if this is an HTML form submission from the login page
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/x-www-form-urlencoded') || (req.body && !req.body.jsonrpc && req.body.username)) {
        return handleAuthorizePost(req, res);
      }
      return handlePostMessage(req, res);
    }

    if (req.method === 'GET') {
      const accept = req.headers.accept || '';
      if (accept.includes('text/event-stream')) {
        return handleSseConnection(req, res);
      }

      // If requested by a web browser expecting HTML, render the Auth card from the screenshot!
      if (accept.includes('text/html') || (!accept.includes('application/json') && !req.headers['authorization'])) {
        return res.send(renderLoginPage({
          client_id: req.query.client_id || '',
          redirect_uri: req.query.redirect_uri || '',
          state: req.query.state || '',
          code_challenge: req.query.code_challenge || '',
          code_challenge_method: req.query.code_challenge_method || 'S256',
          scope: req.query.scope || 'mcp:all',
          username: req.query.username || '',
          error: null
        }));
      }

      // Otherwise return discovery JSON for API / MCP clients
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
