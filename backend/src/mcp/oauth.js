import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

// In-memory stores for OAuth (or can be persisted if needed)
const registeredClients = new Map();
const authCodes = new Map();

function base64Url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function verifyPkce(codeVerifier, codeChallenge, method = 'S256') {
  if (!codeChallenge) return true;
  if (!codeVerifier) return false;
  if (method === 'plain') return codeVerifier === codeChallenge;
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return base64Url(hash) === codeChallenge;
}

export function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5016';
  return `${proto}://${host}`;
}

export function setupOAuthRoutes(app) {
  // ----------------------------------------------------
  // 1. OAUTH 2.0 PROTECTED RESOURCE METADATA (RFC 9728)
  // ----------------------------------------------------
  const handleProtectedResourceMetadata = (req, res) => {
    const base = getBaseUrl(req);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      scopes_supported: ['mcp:all', 'mcp:tools', 'mcp:resources', 'mcp:prompts', 'offline_access'],
      bearer_methods_supported: ['header'],
      resource_documentation: `${base}/api/mcp`
    });
  };

  app.get('/.well-known/oauth-protected-resource', handleProtectedResourceMetadata);
  app.get('/api/mcp/.well-known/oauth-protected-resource', handleProtectedResourceMetadata);
  app.get('/api/.well-known/oauth-protected-resource', handleProtectedResourceMetadata);

  // ----------------------------------------------------
  // 2. AUTHORIZATION SERVER METADATA (RFC 8414 & OIDC)
  // ----------------------------------------------------
  const handleAuthServerMetadata = (req, res) => {
    const base = getBaseUrl(req);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      userinfo_endpoint: `${base}/oauth/userinfo`,
      introspection_endpoint: `${base}/oauth/introspect`,
      jwks_uri: `${base}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256', 'plain'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      scopes_supported: ['mcp:all', 'mcp:tools', 'mcp:resources', 'mcp:prompts', 'offline_access']
    });
  };

  app.get('/.well-known/oauth-authorization-server', handleAuthServerMetadata);
  app.get('/api/mcp/.well-known/oauth-authorization-server', handleAuthServerMetadata);
  app.get('/.well-known/openid-configuration', handleAuthServerMetadata);
  app.get('/api/mcp/.well-known/openid-configuration', handleAuthServerMetadata);

  // JWKS dummy endpoint for JWT verification
  app.get('/.well-known/jwks.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ keys: [] });
  });

  // ----------------------------------------------------
  // 3. DYNAMIC CLIENT REGISTRATION (RFC 7591)
  // ----------------------------------------------------
  app.post('/oauth/register', (req, res) => {
    const body = req.body || {};
    const clientId = 'mcp_client_' + crypto.randomBytes(8).toString('hex');
    const clientSecret = crypto.randomBytes(24).toString('hex');

    const clientData = {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: body.client_name || 'ChatGPT Custom MCP',
      redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: body.token_endpoint_auth_method || 'none'
    };

    registeredClients.set(clientId, clientData);

    res.status(201).json(clientData);
  });

  // ----------------------------------------------------
  // 4. AUTHORIZATION ENDPOINT (GET = UI, POST = SUBMIT)
  // ----------------------------------------------------
  app.get('/oauth/authorize', (req, res) => {
    const {
      client_id = '',
      redirect_uri = '',
      response_type = 'code',
      state = '',
      code_challenge = '',
      code_challenge_method = 'S256',
      scope = 'mcp:all'
    } = req.query;

    res.send(renderLoginPage({
      client_id,
      redirect_uri,
      response_type,
      state,
      code_challenge,
      code_challenge_method,
      scope,
      error: null
    }));
  });

  app.post('/oauth/authorize', async (req, res) => {
    const {
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      username,
      password
    } = req.body;

    if (!username || !password) {
      return res.status(400).send(renderLoginPage({
        ...req.body,
        error: 'Please enter both your Username/ID and Password.'
      }));
    }

    try {
      const uStr = String(username).trim().toLowerCase();
      const secretStr = String(password).trim();

      // Find user in MongoDB User DB
      let user = await User.findOne({ username: uStr });
      if (!user) {
        user = await User.findOne({ name: new RegExp('^' + uStr + '$', 'i') });
      }

      if (!user) {
        return res.status(400).send(renderLoginPage({
          ...req.body,
          error: `User "${username}" not found in User DB.`
        }));
      }

      if (user.status !== 'active') {
        return res.status(403).send(renderLoginPage({
          ...req.body,
          error: `Your account (@${user.username}) is currently deactivated.`
        }));
      }

      // Check password or PIN
      let isMatch = false;
      if (user.passwordHash) {
        isMatch = await bcrypt.compare(secretStr, user.passwordHash);
      }
      if (!isMatch && user.pinHash) {
        isMatch = await bcrypt.compare(secretStr, user.pinHash);
      }

      if (!isMatch) {
        return res.status(400).send(renderLoginPage({
          ...req.body,
          error: 'Incorrect password or PIN. Please try again.'
        }));
      }

      // User authenticated successfully! Generate authorization code
      const code = 'authcode_' + crypto.randomBytes(16).toString('hex');
      authCodes.set(code, {
        userId: user._id.toString(),
        username: user.username,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        redirectUri: redirect_uri,
        clientId: client_id,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      });

      // Redirect back to ChatGPT / client redirect_uri
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);

      return res.redirect(redirectUrl.toString());
    } catch (err) {
      console.error('[OAuth Authorize Error]:', err);
      return res.status(500).send(renderLoginPage({
        ...req.body,
        error: `Server error during authorization: ${err.message}`
      }));
    }
  });

  // ----------------------------------------------------
  // 5. TOKEN ENDPOINT (RFC 6749)
  // ----------------------------------------------------
  app.post('/oauth/token', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const grantType = req.body.grant_type;

    if (grantType === 'authorization_code') {
      const { code, code_verifier, redirect_uri } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'Missing authorization code.' });
      }

      const authData = authCodes.get(code);
      if (!authData) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code.' });
      }

      if (Date.now() > authData.expiresAt) {
        authCodes.delete(code);
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code has expired.' });
      }

      // Verify PKCE
      if (authData.codeChallenge) {
        const pkceValid = verifyPkce(code_verifier, authData.codeChallenge, authData.codeChallengeMethod || 'S256');
        if (!pkceValid) {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed.' });
        }
      }

      // Remove single-use code
      authCodes.delete(code);

      const user = await User.findById(authData.userId);
      if (!user || user.status !== 'active') {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'User not found or deactivated.' });
      }

      // Issue tokens
      const jwtSecret = process.env.JWT_SECRET || 'mydeepwork_secret';
      const accessToken = jwt.sign(
        { id: user._id.toString(), username: user.username, role: user.role, scope: 'mcp:all' },
        jwtSecret,
        { expiresIn: '30d' }
      );
      const refreshToken = jwt.sign(
        { id: user._id.toString(), type: 'refresh' },
        jwtSecret,
        { expiresIn: '90d' }
      );

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 2592000, // 30 days
        refresh_token: refreshToken,
        scope: 'mcp:all'
      });
    }

    if (grantType === 'refresh_token') {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh token.' });
      }

      try {
        const jwtSecret = process.env.JWT_SECRET || 'mydeepwork_secret';
        const decoded = jwt.verify(refresh_token, jwtSecret);
        const user = await User.findById(decoded.id);

        if (!user || user.status !== 'active') {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid user session.' });
        }

        const accessToken = jwt.sign(
          { id: user._id.toString(), username: user.username, role: user.role, scope: 'mcp:all' },
          jwtSecret,
          { expiresIn: '30d' }
        );

        return res.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 2592000,
          scope: 'mcp:all'
        });
      } catch {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token.' });
      }
    }

    return res.status(400).json({ error: 'unsupported_grant_type', error_description: `Grant type "${grantType}" not supported.` });
  });

  // ----------------------------------------------------
  // 6. USERINFO & INTROSPECTION
  // ----------------------------------------------------
  app.get('/oauth/userinfo', async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    try {
      const token = auth.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mydeepwork_secret');
      const user = await User.findById(decoded.id);
      if (!user) return res.status(404).json({ error: 'user_not_found' });

      res.json({
        sub: user._id.toString(),
        preferred_username: user.username,
        name: user.name,
        role: user.role
      });
    } catch {
      res.status(401).json({ error: 'invalid_token' });
    }
  });
}

function renderLoginPage({ client_id, redirect_uri, state, code_challenge, code_challenge_method, error }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect BookList to ChatGPT</title>
  <style>
    :root {
      --bg: #0F172A;
      --card: #1E293B;
      --border: #334155;
      --text: #F8FAFC;
      --muted: #94A3B8;
      --accent: #10B981;
      --accent-hover: #059669;
      --danger: #EF4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 36px 32px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--accent);
      color: #042F2E;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 20px;
    }
    h1 {
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    p.desc {
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--danger);
      color: #FCA5A5;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 0.9rem;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      background: #0B1120;
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      font-size: 1rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: var(--accent);
    }
    .btn {
      width: 100%;
      padding: 14px;
      background: var(--accent);
      color: #042F2E;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, transform 0.05s;
      margin-top: 8px;
    }
    .btn:hover {
      background: var(--accent-hover);
    }
    .btn:active {
      transform: scale(0.99);
    }
    .scope-box {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.5;
    }
    .scope-box strong {
      color: var(--text);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="badge">B</div>
      <div>
        <h1>Connect to ChatGPT</h1>
        <div style="font-size: 0.85rem; color: var(--muted);">BookList MCP Integration</div>
      </div>
    </div>

    <p class="desc">Log in with your BookList & MyDeepwork ID and password to grant ChatGPT access to your lists, tasks, notes, and CRM records.</p>

    ${error ? `<div class="error">${error}</div>` : ''}

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id || '')}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri || '')}">
      <input type="hidden" name="state" value="${escapeHtml(state || '')}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge || '')}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || '')}">

      <div class="form-group">
        <label for="username">Username or User ID</label>
        <input type="text" id="username" name="username" placeholder="e.g. aditi rao, karan.patel, sharad" required autofocus autocomplete="username">
      </div>

      <div class="form-group">
        <label for="password">Password or PIN</label>
        <input type="password" id="password" name="password" placeholder="Enter your password or PIN" required autocomplete="current-password">
      </div>

      <button type="submit" class="btn">Authorize & Connect</button>

      <div class="scope-box">
        ChatGPT will be granted access to read and update your <strong>lists</strong>, <strong>todos</strong>, <strong>notes</strong>, and <strong>CRM members, renewals, & sessions</strong> as your authenticated user.
      </div>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

