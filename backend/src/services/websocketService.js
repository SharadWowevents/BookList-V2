import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

// Map of username -> Set of active WebSocket instances
const userSockets = new Map();

// Map of username -> user profile cache { id, username, name, photo, role, lastSeen }
const userMeta = new Map();

let wssInstance = null;

export const getOnlineUsernames = () => {
  return Array.from(userSockets.keys());
};

export const isUserOnline = (username) => {
  if (!username) return false;
  const set = userSockets.get(username.toLowerCase());
  return !!(set && set.size > 0);
};

export const broadcastPresence = (payload) => {
  if (!wssInstance) return;
  const message = JSON.stringify(payload);
  for (const client of wssInstance.clients) {
    if (client.readyState === WebSocket.OPEN && client.user) {
      try {
        client.send(message);
      } catch (err) {
        console.error('[WS] Broadcast send error:', err);
      }
    }
  }
};

export const getAllUsersPresence = async () => {
  try {
    const users = await User.find({ status: 'active' })
      .select('username name photo role lastSeen')
      .lean();
    const onlineSet = new Set(getOnlineUsernames());
    return users.map(u => ({
      u: u.username,
      name: u.name,
      photo: u.photo || null,
      role: u.role,
      lastSeen: u.lastSeen,
      isOnline: onlineSet.has(u.username)
    }));
  } catch (err) {
    console.error('[WS] getAllUsersPresence error:', err);
    return [];
  }
};

const authenticateToken = async (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mydeepwork_secret');
    if (!decoded || !decoded.id) return null;
    const user = await User.findById(decoded.id).select('-pinHash -passwordHash');
    if (!user || user.status !== 'active') return null;
    return user;
  } catch {
    return null;
  }
};

const handleUserConnected = async (ws, user) => {
  const username = user.username.toLowerCase();
  ws.user = {
    id: user._id.toString(),
    username,
    name: user.name,
    photo: user.photo,
    role: user.role
  };
  ws.isAlive = true;

  const wasOnline = userSockets.has(username) && userSockets.get(username).size > 0;

  if (!userSockets.has(username)) {
    userSockets.set(username, new Set());
  }
  userSockets.get(username).add(ws);

  const now = new Date();
  userMeta.set(username, {
    id: user._id.toString(),
    username,
    name: user.name,
    photo: user.photo,
    role: user.role,
    lastSeen: now
  });

  // Update lastSeen in database
  User.updateOne({ _id: user._id }, { $set: { lastSeen: now } }).catch(err => {
    console.error('[WS] Error updating user lastSeen on connect:', err);
  });

  // Send initial presence state to newly connected client
  const allPresence = await getAllUsersPresence();
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'presence:init',
        onlineUsers: getOnlineUsernames(),
        users: allPresence,
        timestamp: now.toISOString()
      }));
    }
  } catch (err) {
    console.error('[WS] Send init error:', err);
  }

  // If this user just came online (first active socket), broadcast to everyone
  if (!wasOnline) {
    broadcastPresence({
      type: 'presence:change',
      username,
      name: user.name,
      photo: user.photo,
      isOnline: true,
      lastSeen: now.toISOString()
    });
  }
};

const handleUserDisconnected = (ws) => {
  if (!ws.user) return;
  const username = ws.user.username.toLowerCase();
  const sockets = userSockets.get(username);

  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      userSockets.delete(username);
      const now = new Date();

      // Update cached lastSeen
      if (userMeta.has(username)) {
        userMeta.get(username).lastSeen = now;
      }

      // Persist lastSeen to database
      User.updateOne({ username }, { $set: { lastSeen: now } }).catch(err => {
        console.error('[WS] Error updating user lastSeen on disconnect:', err);
      });

      // Broadcast offline change
      broadcastPresence({
        type: 'presence:change',
        username,
        name: ws.user.name,
        photo: ws.user.photo,
        isOnline: false,
        lastSeen: now.toISOString()
      });
    }
  }
};

export const initWebSocketServer = (httpServer) => {
  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const host = request.headers.host || 'localhost';
      const url = new URL(request.url, `http://${host}`);
      const pathname = url.pathname;

      if (pathname === '/api/ws' || pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch (err) {
      console.error('[WS] Upgrade handler error:', err);
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, req) => {
    ws.isAlive = true;
    ws.user = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Check if token was passed in query parameter: ?token=...
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url, `http://${host}`);
      const token = url.searchParams.get('token');

      if (token) {
        const user = await authenticateToken(token);
        if (user) {
          await handleUserConnected(ws, user);
        } else {
          ws.send(JSON.stringify({ type: 'auth:error', message: 'Authentication failed.' }));
          ws.close(4001, 'Unauthorized');
          return;
        }
      }
    } catch (err) {
      console.error('[WS] Connection query auth error:', err);
    }

    // Set timeout to close unauthenticated sockets after 15s
    const authTimeout = setTimeout(() => {
      if (!ws.user && ws.readyState === WebSocket.OPEN) {
        ws.close(4002, 'Auth timeout');
      }
    }, 15000);

    ws.on('message', async (data) => {
      try {
        const messageStr = typeof data === 'string' ? data : data.toString();
        const msg = JSON.parse(messageStr);

        if (msg.type === 'auth') {
          clearTimeout(authTimeout);
          const user = await authenticateToken(msg.token);
          if (user) {
            await handleUserConnected(ws, user);
          } else {
            ws.send(JSON.stringify({ type: 'auth:error', message: 'Authentication failed.' }));
            ws.close(4001, 'Unauthorized');
          }
        } else if (msg.type === 'ping') {
          ws.isAlive = true;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } else if (msg.type === 'activity') {
          // Client user interaction event: keep user active & update lastSeen
          if (ws.user) {
            ws.isAlive = true;
            const now = new Date();
            if (userMeta.has(ws.user.username)) {
              userMeta.get(ws.user.username).lastSeen = now;
            }
          }
        }
      } catch (err) {
        console.error('[WS] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      handleUserDisconnected(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Socket error for user:', ws.user?.username, err);
      clearTimeout(authTimeout);
      handleUserDisconnected(ws);
    });
  });

  // Heartbeat ping interval every 30 seconds
  const pingInterval = setInterval(() => {
    if (!wssInstance) return;
    for (const ws of wssInstance.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
      } else {
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {
          ws.terminate();
        }
      }
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  console.log('[WebSocket Server] Initialized for /api/ws and /ws');
  return wss;
};
