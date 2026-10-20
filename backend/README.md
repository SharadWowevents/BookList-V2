# MyDeepwork Backend

Express.js and MongoDB REST API backend for the MyDeepwork application.

## Prerequisites
- Node.js v18+
- MongoDB running locally on `mongodb://127.0.0.1:27017` (or MongoDB Atlas connection string)

## Environment Variables (.env)
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/mydeepwork
JWT_SECRET=mydeepwork_super_secret_jwt_key_2026
CLIENT_URL=http://localhost:5173
```

## Running the Server
```bash
# Install dependencies
npm install

# Run in development mode (with auto-restart)
npm run dev

# Run in production mode
npm start
```

## API Endpoints

### 1. Authentication (`/api/auth`)
- `POST /api/auth/pin-login` - Authenticate with name and 4-digit PIN (creates user + starter board if new)
- `POST /api/auth/team-login` - Authenticate with team username & password
- `GET /api/auth/me` - Get current authenticated user profile
- `PUT /api/auth/profile` - Update display name, profile photo, preferences (accent, theme, collapsed)

### 2. Board & Lists (`/api/board`)
- `GET /api/board` - Retrieve user's lists, notes, and active selection
- `PUT /api/board` - Bulk synchronize board state (reordered lists, active tabs, etc.)
- `POST /api/board/lists` - Create a new list
- `PUT /api/board/lists/:id` - Update list name, starred state, or todos array
- `DELETE /api/board/lists/:id` - Delete list

### 3. Notes (`/api/notes`)
- `GET /api/notes/:id` - Retrieve full note with HTML body & ink drawings
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update note title, HTML content, or starred state
- `DELETE /api/notes/:id` - Delete note

### 4. Sharing (`/api/shares`)
- `POST /api/shares` - Share a list or note (returns unique share token `sid`)
- `GET /api/shares/:sid` - Publicly access shared list/note by token
- `PUT /api/shares/:sid` - Edit shared content (if permission is `edit`)
- `DELETE /api/shares/:sid` - Stop sharing item

### 5. Team Admin (`/api/admin`)
- `GET /api/admin/config` - Get system config (`requireLogin`)
- `PUT /api/admin/config` - Toggle `requireLogin` requirement
- `GET /api/admin/users` - View all team members and their activity
- `POST /api/admin/users` - Add new team member (username, name, password)
- `PUT /api/admin/users/:username/status` - Toggle member status (`active` / `off`)
- `PUT /api/admin/users/:username/reset-password` - Reset member password
- `DELETE /api/admin/users/:username` - Delete member and associated data

