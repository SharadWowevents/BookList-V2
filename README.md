# MyDeepwork Full Stack Application

A complete, responsive productivity workspace for lists, todos, rich notes, and vector drawings — ported 1:1 from the single-file HTML version into a modern full-stack **React + Express + MongoDB** architecture.

## Project Structure

```
BookList_version2/
├── backend/                  # Express.js & MongoDB REST API
│   ├── src/
│   │   ├── config/db.js      # Mongoose database connection
│   │   ├── models/           # User, List, Note, Share, Config models
│   │   ├── controllers/      # Auth, Board, Note, Share, Admin controllers
│   │   ├── routes/           # REST endpoints
│   │   ├── middleware/       # JWT auth & admin guard
│   │   └── server.js         # Express app entrypoint
│   ├── .env                  # Port, MongoDB URI, JWT secret
│   └── package.json
│
├── frontend/                 # React 19 + Vite Frontend
│   ├── src/
│   │   ├── components/       # Sidebar, ListView, NoteView, AdminPanel, Login, Icons
│   │   ├── context/          # AppContext state & offline fallback
│   │   ├── services/         # API client communicating with backend
│   │   ├── utils/            # Ink drawing engine & constants
│   │   ├── App.jsx           # Main shell & toast host
│   │   └── App.css           # 9 accent themes, light/dark, responsive styling
│   └── package.json
│
├── mydeepwork.html           # Original reference file
└── package.json              # Root workspace convenience scripts
```

## Quick Start

### 1. Ensure MongoDB is Running
Make sure MongoDB is running on `mongodb://127.0.0.1:27017` (default port).

### 2. Start Backend & Frontend

From the root directory:
```bash
# Start backend server (runs on port 5000)
npm run server

# In another terminal, start React frontend (runs on port 5173)
npm run client
```

Or run each directory individually:
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173** in your browser. All API calls (`/api/...`) are automatically proxied from Vite to the Express backend.

## Features
- **Local PIN & Team Authentication**: 4-digit PIN authentication with SHA-256/bcrypt hashing, plus admin-managed team accounts.
- **Lists & Todos**: Starred, open, and collapsible completed sections, click-to-edit, drag-and-drop reordering, and voice input via Web Speech API.
- **Rich Note Editor**: 27-button formatting toolbar, headings, lists, interactive checklists, link insertion, image upload, and dictation.
- **Vector Inking (Drawing)**: Resolution-independent drawing engine with Pen, Pencil, Highlighter, Eraser, Lasso, Ruler, height-grow handle, and stroke undo/redo.
- **Export & Sharing**: Web page publishing (generates standalone HTML with embedded fonts, CSS, and rasterized drawings) and live link sharing.
- **Admin Dashboard**: Member directory, password resets, active/off toggles, and global sign-in requirements.

