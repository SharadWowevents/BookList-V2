# BookList Model Context Protocol (MCP) Server Guide

This project includes a full-featured **Model Context Protocol (MCP)** server that allows AI assistants (Claude Desktop, Antigravity, Cursor, Windsurf, custom agents) to perform **any type of activity** on your BookList / MyDeepwork application.

---

## 1. Authentication with ID and Password from User DB

The MCP server connects directly to your MongoDB User collection and supports authenticating as any registered user.

### Method A: Auto-Authentication via Environment Variables
Set the following environment variables in your MCP client configuration:
- `BOOKLIST_USERNAME`: Your user ID or username (e.g. `karan.patel`, `sharad`, `aditi rao`)
- `BOOKLIST_PASSWORD`: Your account password or 4-digit PIN

When the MCP server starts up, it automatically validates your credentials against the User DB using bcrypt, verifies active account status, and scopes all actions to your private workspace.

### Method B: Dynamic Tool Authentication
Any AI assistant can authenticate dynamically during a conversation using the `login` tool:
```json
{
  "name": "login",
  "arguments": {
    "username": "karan.patel",
    "password": "your_password_or_pin"
  }
}
```

---

## 2. Available Activities & Tools (33 Tools)

### Authentication
- `login`: Authenticate with username/ID and password/PIN from the User DB.
- `logout`: Clear the active authenticated session.
- `get_current_user`: Get information about the authenticated user, role, preferences, and active tab.

### Board & Intelligence
- `get_board`: Retrieve the complete board with lists, todo summaries, notes, and active selection state.
- `get_board_stats`: Retrieve aggregate statistics (total lists, open/done/starred todos, total notes).
- `search_all`: Full-text search across all lists, todos, and document contents.

### Lists Management
- `list_lists`: Get all lists with IDs, names, starred state, and open/done counts.
- `get_list`: Get detailed list information including all its todos.
- `create_list`: Create a new list with title, starred state, and optional initial todos.
- `rename_list`: Rename an existing list.
- `delete_list`: Delete a list and its todos.
- `toggle_star_list`: Star or unstar a list.
- `reorder_lists`: Set a new ordering for all lists.

### Todos / Tasks Management
- `list_todos`: View todos in a list with optional filter (`all`, `open`, `done`, `starred`).
- `add_todo`: Add a new task to a list.
- `toggle_todo`: Mark a task as completed (done) or open (pending).
- `update_todo`: Edit task text, star status, or completion state.
- `delete_todo`: Remove a task from a list.
- `move_todo`: Move a task from one list to another list.
- `clear_completed_todos`: Batch remove all completed tasks from a list.

### Notes & Documents Management
- `list_notes`: List all documents with titles, preview snippet, and update timestamps.
- `get_note`: Read full document content (plaintext and HTML).
- `create_note`: Create a new document with title, body content, and starred state.
- `update_note`: Update title, body content (plaintext or HTML), or star status.
- `append_to_note`: Append text/HTML to the end of an existing document.
- `delete_note`: Delete a document.
- `toggle_star_note`: Star or unstar a document.

### Sharing & Collaboration
- `create_share`: Generate or update a public share link (`view` or `edit` permission).
- `get_share_info`: Check if an item is shared and get its public URLs.
- `revoke_share`: Stop sharing and make an item private again.

### Team Administration (Admin Role)
- `admin_list_users`: List all team accounts, roles, statuses, and last seen timestamps.
- `admin_create_user`: Create a new team user account in the User DB.
- `admin_rename_user`: Rename any user (or the admin themselves) by updating display name and optionally username.
- `admin_toggle_user_status`: Activate or deactivate a user account.

---

## 3. How to Connect Your AI Client

### A. Claude Desktop
Add this to your Claude Desktop config file (`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "booklist": {
      "command": "node",
      "args": [
        "d:/C_lang/Code/Web/WowEvents/BookList_version2/backend/src/mcp/index.js"
      ],
      "env": {
        "MONGO_URI": "mongodb://127.0.0.1:27017/mydeepwork",
        "BOOKLIST_USERNAME": "your_username",
        "BOOKLIST_PASSWORD": "your_password_or_pin"
      }
    }
  }
}
```

### B. Antigravity / Cursor / Windsurf
Add to your project's MCP configuration or settings:

```json
{
  "mcpServers": {
    "booklist": {
      "command": "node",
      "args": [
        "d:/C_lang/Code/Web/WowEvents/BookList_version2/backend/src/mcp/index.js"
      ],
      "env": {
        "MONGO_URI": "mongodb://127.0.0.1:27017/mydeepwork"
      }
    }
  }
}
```

### C. Run Standalone via Terminal
From the project root:
```bash
npm run mcp
```
Or with CLI flags:
```bash
node backend/src/mcp/index.js --username your_username --password your_password
```

### D. ChatGPT Custom MCP Server (Web & Plugins)
When adding your server to ChatGPT via **Plugins -> Add custom MCP server**:

1. **Connection URL:**
   Enter your public HTTPS URL (e.g. your dev tunnel or production domain):
   ```
   https://xq9lnsbr-5016.inc1.devtunnels.ms/api/mcp
   ```
2. **Authentication:**
   Select **OAuth**.
3. **Automatic Discovery:**
   ChatGPT will automatically discover the OAuth endpoints from:
   - `/.well-known/oauth-protected-resource`
   - `/.well-known/oauth-authorization-server`
   - `/.well-known/openid-configuration`
4. **Manual Settings (if entering manually under "Advanced OAuth settings"):**
   - **Authorization URL:** `https://xq9lnsbr-5016.inc1.devtunnels.ms/oauth/authorize`
   - **Token URL:** `https://xq9lnsbr-5016.inc1.devtunnels.ms/oauth/token`
   - **Registration URL (DCR):** `https://xq9lnsbr-5016.inc1.devtunnels.ms/oauth/register`
   - **Default Scopes:** `mcp:all`
5. **Login Screen:**
   When connecting, ChatGPT opens the authorization page where you log in with your **BookList Username/ID and Password (or PIN)** directly from your User DB!

---

### E. Over HTTP / Server-Sent Events (SSE)
When the backend server is running (`npm run server` or `PORT=5000`):
- Discovery endpoint: `GET http://localhost:5000/api/mcp`
- SSE Stream: `GET http://localhost:5000/api/mcp/sse?username=...&password=...`
- Message endpoint: `POST http://localhost:5000/api/mcp/messages?sessionId=...`

