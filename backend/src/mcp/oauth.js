import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

// In-memory stores for OAuth
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
  const m = String(method || 'S256').toUpperCase();
  if (m === 'PLAIN') return codeVerifier === codeChallenge;
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return base64Url(hash) === codeChallenge;
}

export function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5016';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  // For remote/production servers (e.g. mydeepwork.in), always enforce https://
  const proto = isLocal ? (forwardedProto || req.protocol || 'http') : 'https';
  return `${proto}://${host}`;
}

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderLoginPage({ client_id, redirect_uri, state, code_challenge, code_challenge_method, scope, username, error }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Listbook · Model Context Protocol</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --border: #E2E8F0;
      --text: #0F172A;
      --muted: #64748B;
      --brand: #165B40;
      --brand-hover: #0F3F2D;
      --input-bg: #F8FAFC;
      --input-border: #E2E8F0;
      --danger: #DC2626;
      --danger-bg: #FEF2F2;
      --danger-border: #FECACA;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 36px 32px;
      width: 100%;
      max-width: 430px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03);
    }
    .badge-pill {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      background: #F1F5F9;
      border: 1px solid var(--border);
      border-radius: 9999px;
      padding: 5px 12px;
      margin-bottom: 18px;
    }
    h1.title {
      font-size: 1.85rem;
      font-weight: 700;
      color: var(--brand);
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    p.desc {
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .error-box {
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger);
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 0.88rem;
      line-height: 1.4;
      margin-bottom: 20px;
      font-weight: 500;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 7px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 8px;
      color: var(--text);
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(22, 91, 64, 0.12);
      background: #FFFFFF;
    }
    input::placeholder {
      color: #94A3B8;
    }
    .btn {
      width: 100%;
      padding: 13px 20px;
      background: var(--brand);
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s, transform 0.05s;
      margin-top: 6px;
    }
    .btn:hover {
      background: var(--brand-hover);
    }
    .btn:active {
      transform: scale(0.99);
    }
    .footer-note {
      text-align: center;
      margin-top: 22px;
      color: #94A3B8;
      font-size: 11.5px;
      letter-spacing: 0.01em;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge-pill">MODEL CONTEXT PROTOCOL • OAUTH 2.0</div>
    <h1 class="title">Listbook</h1>
    <p class="desc">Authenticate with your ListBook account to authorize access for your AI assistant.</p>

    ${error ? `<div class="error-box">${error}</div>` : ''}

    <form method="POST" action="">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id || '')}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri || '')}">
      <input type="hidden" name="state" value="${escapeHtml(state || '')}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge || '')}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || '')}">
      <input type="hidden" name="scope" value="${escapeHtml(scope || 'mcp:all')}">

      <div class="form-group">
        <label for="username">USERNAME</label>
        <input type="text" id="username" name="username" placeholder="e.g. admin or demo" required autofocus autocomplete="username" value="${escapeHtml(username || '')}">
      </div>

      <div class="form-group">
        <label for="password">PASSWORD / 4-DIGIT PIN</label>
        <input type="password" id="password" name="password" placeholder="••••" required autocomplete="current-password">
      </div>

      <button type="submit" class="btn">Authorize & Connect</button>

      <div class="footer-note">
        ListBook AI Security • Access scopes to your private board
      </div>
    </form>
  </div>
</body>
</html>`;
}

export function renderCredentialsHub({ user, accessToken, baseUrl }) {
  const sseEndpoint = `${baseUrl}/api/mcp/sse?token=${accessToken}`;
  const claudeConfig = JSON.stringify({
    mcpServers: {
      listbook: {
        url: sseEndpoint
      }
    }
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Listbook · MCP Connection Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --border: #E2E8F0;
      --text: #0F172A;
      --muted: #64748B;
      --brand: #165B40;
      --brand-hover: #0F3F2D;
      --code-bg: #F1F5F9;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 36px 32px;
      width: 100%;
      max-width: 580px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03);
    }
    .badge-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #047857;
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      border-radius: 9999px;
      padding: 4px 12px;
      margin-bottom: 16px;
    }
    h1.title {
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--brand);
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }
    p.desc {
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .section {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
    }
    .sec-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .code-box {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      word-break: break-all;
      color: #0F172A;
      position: relative;
    }
    .copy-btn {
      background: var(--brand);
      color: #FFFFFF;
      border: none;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .copy-btn:hover {
      background: var(--brand-hover);
    }
    .copy-btn.copied {
      background: #047857;
    }
    .grid-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    .info-card {
      background: #F8FAFC;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }
    .info-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .info-val {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      word-break: break-all;
    }
    .footer-actions {
      margin-top: 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .link-btn {
      color: var(--muted);
      font-size: 13px;
      text-decoration: none;
      font-weight: 500;
    }
    .link-btn:hover {
      color: var(--text);
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge-pill">✓ AUTHENTICATION SUCCESSFUL</div>
    <h1 class="title">Connected to Listbook</h1>
    <p class="desc">Authenticated as <strong>@${escapeHtml(user.username)}</strong> (${escapeHtml(user.name || user.username)}). Use these credentials to connect any AI assistant, bot, or client.</p>

    <div class="section" style="border-top: none; padding-top: 0;">
      <div class="sec-label">
        <span>Direct MCP SSE URL (Claude Desktop, Cursor, Any Bot)</span>
        <button class="copy-btn" onclick="copyText('${escapeHtml(sseEndpoint)}', this)">Copy URL</button>
      </div>
      <div class="code-box">${escapeHtml(sseEndpoint)}</div>
    </div>

    <div class="section">
      <div class="sec-label">
        <span>Personal MCP Access Token (Bearer Auth)</span>
        <button class="copy-btn" onclick="copyText('${escapeHtml(accessToken)}', this)">Copy Token</button>
      </div>
      <div class="code-box">${escapeHtml(accessToken.slice(0, 40))}...${escapeHtml(accessToken.slice(-15))}</div>
    </div>

    <div class="section">
      <div class="sec-label">
        <span>Claude Desktop / Cursor Config</span>
        <button class="copy-btn" onclick="copyText(JSON.stringify(${JSON.stringify(JSON.parse(claudeConfig))}, null, 2), this)">Copy Config</button>
      </div>
      <pre class="code-box" style="white-space: pre-wrap;">${escapeHtml(claudeConfig)}</pre>
    </div>

    <div class="section">
      <div class="sec-label">
        <span>ChatGPT / Custom Action Settings</span>
      </div>
      <div class="grid-info">
        <div class="info-card">
          <div class="info-title">Server URL</div>
          <div class="info-val">${escapeHtml(baseUrl)}/api/mcp</div>
        </div>
        <div class="info-card">
          <div class="info-title">Auth Type</div>
          <div class="info-val">OAuth 2.0</div>
        </div>
        <div class="info-card">
          <div class="info-title">Authorization URL</div>
          <div class="info-val">${escapeHtml(baseUrl)}/api/oauth/authorize</div>
        </div>
        <div class="info-card">
          <div class="info-title">Token URL</div>
          <div class="info-val">${escapeHtml(baseUrl)}/api/oauth/token</div>
        </div>
      </div>
    </div>

    <div class="footer-actions">
      <a href="${escapeHtml(baseUrl)}/api/mcp" class="link-btn">← Back to Login</a>
      <span style="font-size: 11.5px; color: var(--muted);">Token valid for 90 days</span>
    </div>
  </div>

  <script>
    function copyText(text, btn) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.innerText;
        btn.innerText = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerText = orig;
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

export const handleAuthorizePost = async (req, res) => {
  const params = { ...req.query, ...req.body };
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scope,
    username,
    password
  } = params;

  if (!username || !password) {
    return res.status(400).send(renderLoginPage({
      ...params,
      error: 'Please enter both your Username and Password/PIN.'
    }));
  }

  try {
    const uStr = String(username).trim().toLowerCase();
    const secretStr = String(password).trim();

    // Find user in MongoDB User DB
    let user = await User.findOne({ username: uStr });
    if (!user) {
      user = await User.findOne({ name: new RegExp('^' + escapeRegex(uStr) + '$', 'i') });
    }

    if (!user) {
      return res.status(400).send(renderLoginPage({
        ...params,
        error: `User "${username}" not found in User DB.`
      }));
    }

    if (user.status !== 'active') {
      return res.status(403).send(renderLoginPage({
        ...params,
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
        ...params,
        error: 'Incorrect password or PIN. Please try again.'
      }));
    }

    // User authenticated successfully!
    const jwtSecret = process.env.JWT_SECRET || 'mydeepwork_secret';
    const accessToken = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role, scope: 'mcp:all' },
      jwtSecret,
      { expiresIn: '90d' }
    );

    // If OAuth flow with redirect_uri, redirect back to client (ChatGPT, etc.)
    if (redirect_uri) {
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

      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);

      return res.redirect(redirectUrl.toString());
    }

    // Otherwise, direct browser login on /api/mcp: show credentials & bot connection hub
    const base = getBaseUrl(req);
    return res.send(renderCredentialsHub({
      user,
      accessToken,
      baseUrl: base
    }));
  } catch (err) {
    console.error('[OAuth Authorize Error]:', err);
    return res.status(500).send(renderLoginPage({
      ...params,
      error: `Server error during authorization: ${err.message}`
    }));
  }
};

export function setupOAuthRoutes(app) {
  // ----------------------------------------------------
  // 1. OAUTH 2.0 PROTECTED RESOURCE METADATA (RFC 9728)
  // ----------------------------------------------------
  const handleProtectedResourceMetadata = (req, res) => {
    const base = getBaseUrl(req);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.json({
      resource: `${base}/api/mcp`,
      authorization_servers: [`${base}/api`, base],
      scopes_supported: ['mcp:all', 'mcp:tools', 'mcp:resources', 'mcp:prompts', 'offline_access'],
      bearer_methods_supported: ['header'],
      resource_documentation: `${base}/api/mcp`
    });
  };

  app.get('/api/.well-known/oauth-protected-resource', handleProtectedResourceMetadata);
  app.get('/api/mcp/.well-known/oauth-protected-resource', handleProtectedResourceMetadata);
  app.get('/.well-known/oauth-protected-resource', handleProtectedResourceMetadata);

  // ----------------------------------------------------
  // 2. AUTHORIZATION SERVER METADATA (RFC 8414 & OIDC)
  // ----------------------------------------------------
  const handleAuthServerMetadata = (req, res) => {
    const base = getBaseUrl(req);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      userinfo_endpoint: `${base}/api/oauth/userinfo`,
      introspection_endpoint: `${base}/api/oauth/introspect`,
      jwks_uri: `${base}/api/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256', 'plain'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      scopes_supported: ['mcp:all', 'mcp:tools', 'mcp:resources', 'mcp:prompts', 'offline_access'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256']
    });
  };

  app.get('/api/.well-known/oauth-authorization-server', handleAuthServerMetadata);
  app.get('/api/mcp/.well-known/oauth-authorization-server', handleAuthServerMetadata);
  app.get('/.well-known/oauth-authorization-server', handleAuthServerMetadata);

  app.get('/api/.well-known/openid-configuration', handleAuthServerMetadata);
  app.get('/api/mcp/.well-known/openid-configuration', handleAuthServerMetadata);
  app.get('/.well-known/openid-configuration', handleAuthServerMetadata);

  // JWKS endpoint for JWT verification
  const handleJwks = (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.json({ keys: [] });
  };
  app.get('/api/.well-known/jwks.json', handleJwks);
  app.get('/api/mcp/.well-known/jwks.json', handleJwks);
  app.get('/.well-known/jwks.json', handleJwks);

  // ----------------------------------------------------
  // 3. DYNAMIC CLIENT REGISTRATION (RFC 7591)
  // ----------------------------------------------------
  const handleClientRegistration = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const body = req.body || {};
    const clientId = 'mcp_client_' + crypto.randomBytes(8).toString('hex');
    const clientSecret = crypto.randomBytes(24).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    const redirectUris = Array.isArray(body.redirect_uris) && body.redirect_uris.length > 0
      ? body.redirect_uris
      : (body.redirect_uri ? [body.redirect_uri] : ['https://chatgpt.com/connector/oauth/callback']);

    const clientData = {
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: now,
      client_secret_expires_at: 0,
      client_name: body.client_name || 'ChatGPT Custom MCP',
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: body.token_endpoint_auth_method || 'none'
    };

    registeredClients.set(clientId, clientData);

    return res.status(201).json(clientData);
  };

  app.post('/api/oauth/register', handleClientRegistration);
  app.post('/oauth/register', handleClientRegistration);

  // ----------------------------------------------------
  // 4. AUTHORIZATION ENDPOINT (RFC 6749)
  // ----------------------------------------------------
  const handleAuthorizeGet = (req, res) => {
    const {
      client_id = '',
      redirect_uri = '',
      response_type = 'code',
      state = '',
      code_challenge = '',
      code_challenge_method = 'S256',
      scope = 'mcp:all',
      username = ''
    } = req.query;

    res.send(renderLoginPage({
      client_id,
      redirect_uri,
      response_type,
      state,
      code_challenge,
      code_challenge_method,
      scope,
      username,
      error: null
    }));
  };

  app.get('/api/oauth/authorize', handleAuthorizeGet);
  app.get('/oauth/authorize', handleAuthorizeGet);
  app.post('/api/oauth/authorize', handleAuthorizePost);
  app.post('/oauth/authorize', handleAuthorizePost);

  // ----------------------------------------------------
  // 5. TOKEN ENDPOINT (RFC 6749)
  // ----------------------------------------------------
  const handleTokenPost = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    const grantType = req.body.grant_type;

    if (grantType === 'authorization_code') {
      const { code, code_verifier } = req.body;

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
        { expiresIn: '90d' }
      );
      const refreshToken = jwt.sign(
        { id: user._id.toString(), type: 'refresh' },
        jwtSecret,
        { expiresIn: '180d' }
      );

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 7776000, // 90 days
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
          { expiresIn: '90d' }
        );

        return res.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 7776000,
          refresh_token,
          scope: 'mcp:all'
        });
      } catch {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token.' });
      }
    }

    return res.status(400).json({ error: 'unsupported_grant_type', error_description: `Grant type "${grantType}" not supported.` });
  };

  app.post('/api/oauth/token', handleTokenPost);
  app.post('/oauth/token', handleTokenPost);

  // ----------------------------------------------------
  // 6. USERINFO & INTROSPECTION
  // ----------------------------------------------------
  const handleUserInfo = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    try {
      const token = auth.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mydeepwork_secret');
      const user = await User.findById(decoded.id);
      if (!user) return res.status(404).json({ error: 'user_not_found' });

      return res.json({
        sub: user._id.toString(),
        preferred_username: user.username,
        name: user.name,
        role: user.role
      });
    } catch {
      return res.status(401).json({ error: 'invalid_token' });
    }
  };

  const handleIntrospect = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const token = req.body.token;
    if (!token) return res.json({ active: false });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mydeepwork_secret');
      const user = await User.findById(decoded.id);
      if (!user || user.status !== 'active') return res.json({ active: false });
      return res.json({
        active: true,
        scope: 'mcp:all',
        client_id: 'booklist_mcp',
        username: user.username,
        sub: user._id.toString(),
        exp: decoded.exp
      });
    } catch {
      return res.json({ active: false });
    }
  };

  app.get('/api/oauth/userinfo', handleUserInfo);
  app.get('/oauth/userinfo', handleUserInfo);
  app.post('/api/oauth/introspect', handleIntrospect);
  app.post('/oauth/introspect', handleIntrospect);
}
