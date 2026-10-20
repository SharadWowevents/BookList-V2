import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { User } from '../models/User.js';
import { Share } from '../models/Share.js';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const htmlToText = (html = '') => {
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
};

export function registerMcpTools(server, authManager) {
  // ----------------------------------------------------
  // 1. AUTHENTICATION TOOLS
  // ----------------------------------------------------
  server.tool(
    'login',
    'Authenticate with username/ID and password (or PIN) verified against the User database. Required before accessing private lists, todos, and notes.',
    {
      username: z.string().describe('User ID or username (e.g. "admin", "sharad", "alice")'),
      password: z.string().describe('Password or 4-digit PIN')
    },
    async ({ username, password }) => {
      const res = await authManager.authenticate(username, password);
      if (!res.success) {
        return {
          content: [{ type: 'text', text: `Authentication failed: ${res.error}` }],
          isError: true
        };
      }
      return {
        content: [{
          type: 'text',
          text: `Successfully authenticated as ${res.user.name} (@${res.user.username}). Role: ${res.user.role}. You can now perform any list, todo, note, or search activity.`
        }]
      };
    }
  );

  server.tool(
    'logout',
    'Log out of the current authenticated session.',
    {},
    async () => {
      const res = authManager.logout();
      return { content: [{ type: 'text', text: res.message }] };
    }
  );

  server.tool(
    'get_current_user',
    'Get information about the currently authenticated user and active session.',
    {},
    async () => {
      const user = authManager.getUser();
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: 'No active session. Please authenticate using the "login" tool with your username and password.'
          }]
        };
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: user._id.toString(),
            username: user.username,
            name: user.name,
            role: user.role,
            status: user.status,
            authType: user.authType,
            activeTab: user.tab || 'lists',
            prefs: user.prefs,
            lastSeen: user.lastSeen
          }, null, 2)
        }]
      };
    }
  );

  // ----------------------------------------------------
  // 2. BOARD OVERVIEW & STATS
  // ----------------------------------------------------
  server.tool(
    'get_board',
    'Retrieve the entire board overview for the authenticated user, including all lists with todo summaries, all notes, and active selection state.',
    {},
    async () => {
      const user = authManager.requireAuth();
      const lists = await List.find({ userId: user._id }).sort({ order: 1, createdAt: 1 });
      const notes = await Note.find({ userId: user._id }).sort({ order: 1, createdAt: -1 });

      const overview = {
        user: {
          username: user.username,
          name: user.name,
          activeTab: user.tab || 'lists'
        },
        lists: lists.map(l => ({
          id: l.id,
          name: l.name,
          starred: l.starred,
          totalTodos: l.todos.length,
          openTodos: l.todos.filter(t => !t.done).length,
          doneTodos: l.todos.filter(t => t.done).length,
          starredTodos: l.todos.filter(t => t.starred).length,
          isShared: !!l.shared
        })),
        notes: notes.map(n => ({
          id: n.id,
          title: n.title || 'Untitled note',
          starred: n.starred,
          isShared: !!n.shared,
          updatedAt: n.updatedAt
        }))
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(overview, null, 2) }]
      };
    }
  );

  server.tool(
    'get_board_stats',
    'Get high-level numerical statistics for the user board (total lists, total open/done todos, total notes).',
    {},
    async () => {
      const user = authManager.requireAuth();
      const lists = await List.find({ userId: user._id });
      const notesCount = await Note.countDocuments({ userId: user._id });

      let totalTodos = 0;
      let openTodos = 0;
      let doneTodos = 0;
      let starredTodos = 0;
      let starredLists = 0;

      for (const l of lists) {
        if (l.starred) starredLists++;
        totalTodos += l.todos.length;
        for (const t of l.todos) {
          if (t.done) doneTodos++;
          else openTodos++;
          if (t.starred) starredTodos++;
        }
      }

      const stats = {
        totalLists: lists.length,
        starredLists,
        totalTodos,
        openTodos,
        doneTodos,
        starredTodos,
        totalNotes: notesCount
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }]
      };
    }
  );

  // ----------------------------------------------------
  // 3. LISTS MANAGEMENT
  // ----------------------------------------------------
  server.tool(
    'list_lists',
    'List all todo lists belonging to the current user.',
    {},
    async () => {
      const user = authManager.requireAuth();
      const lists = await List.find({ userId: user._id }).sort({ order: 1, createdAt: 1 });
      const result = lists.map(l => ({
        id: l.id,
        name: l.name,
        starred: l.starred,
        openCount: l.todos.filter(t => !t.done).length,
        doneCount: l.todos.filter(t => t.done).length,
        total: l.todos.length
      }));
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_list',
    'Get a specific todo list by its ID or exact name, including all its todo items.',
    {
      identifier: z.string().describe('List ID or list name')
    },
    async ({ identifier }) => {
      const user = authManager.requireAuth();
      const list = await List.findOne({
        userId: user._id,
        $or: [{ id: identifier }, { name: identifier }]
      });

      if (!list) {
        return {
          content: [{ type: 'text', text: `List "${identifier}" not found.` }],
          isError: true
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: list.id,
            name: list.name,
            starred: list.starred,
            todos: list.todos,
            shared: list.shared
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'create_list',
    'Create a new todo list with an optional array of initial todo strings.',
    {
      name: z.string().describe('Title / name of the new list'),
      starred: z.boolean().optional().describe('Whether the list is starred (default: false)'),
      initialTodos: z.array(z.string()).optional().describe('Optional list of initial todo item texts')
    },
    async ({ name, starred = false, initialTodos = [] }) => {
      const user = authManager.requireAuth();
      const trimmed = name.trim();
      if (!trimmed) {
        return { content: [{ type: 'text', text: 'List name cannot be empty.' }], isError: true };
      }

      const listId = uid();
      const count = await List.countDocuments({ userId: user._id });
      const todos = (initialTodos || []).map(t => ({
        id: uid(),
        text: String(t).trim(),
        done: false,
        starred: false
      }));

      const newList = await List.create({
        userId: user._id,
        id: listId,
        name: trimmed,
        starred: !!starred,
        order: count,
        todos
      });

      // Update user activeId
      await User.findByIdAndUpdate(user._id, { activeId: listId, tab: 'lists' });

      return {
        content: [{
          type: 'text',
          text: `Created list "${newList.name}" (ID: ${newList.id}) with ${todos.length} todo(s).`
        }]
      };
    }
  );

  server.tool(
    'rename_list',
    'Rename an existing todo list.',
    {
      listId: z.string().describe('The ID of the list to rename'),
      newName: z.string().describe('The new name for the list')
    },
    async ({ listId, newName }) => {
      const user = authManager.requireAuth();
      const name = newName.trim();
      if (!name) return { content: [{ type: 'text', text: 'New name cannot be empty.' }], isError: true };

      const list = await List.findOneAndUpdate(
        { userId: user._id, id: listId },
        { name },
        { new: true }
      );

      if (!list) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      // Also update any active share
      await Share.findOneAndUpdate(
        { ownerId: user._id, itemId: listId },
        { 'content.name': name, updatedBy: user.name }
      );

      return {
        content: [{ type: 'text', text: `Renamed list to "${list.name}".` }]
      };
    }
  );

  server.tool(
    'delete_list',
    'Delete a todo list by ID.',
    {
      listId: z.string().describe('The ID of the list to delete')
    },
    async ({ listId }) => {
      const user = authManager.requireAuth();
      const deleted = await List.findOneAndDelete({ userId: user._id, id: listId });
      if (!deleted) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      // Delete any associated shares
      await Share.findOneAndDelete({ ownerId: user._id, itemId: listId });

      return {
        content: [{ type: 'text', text: `List "${deleted.name}" (ID: ${listId}) deleted successfully.` }]
      };
    }
  );

  server.tool(
    'toggle_star_list',
    'Star or unstar a list.',
    {
      listId: z.string().describe('The ID of the list'),
      starred: z.boolean().optional().describe('Force set starred status (true/false). If omitted, toggles current value.')
    },
    async ({ listId, starred }) => {
      const user = authManager.requireAuth();
      const list = await List.findOne({ userId: user._id, id: listId });
      if (!list) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      list.starred = starred !== undefined ? !!starred : !list.starred;
      await list.save();

      return {
        content: [{ type: 'text', text: `List "${list.name}" is now ${list.starred ? 'starred' : 'unstarred'}.` }]
      };
    }
  );

  server.tool(
    'reorder_lists',
    'Reorder lists by providing the complete or partial ordered array of list IDs.',
    {
      orderedListIds: z.array(z.string()).describe('Array of list IDs in the desired order')
    },
    async ({ orderedListIds }) => {
      const user = authManager.requireAuth();
      for (let i = 0; i < orderedListIds.length; i++) {
        await List.findOneAndUpdate(
          { userId: user._id, id: orderedListIds[i] },
          { order: i }
        );
      }
      return {
        content: [{ type: 'text', text: `Updated list ordering for ${orderedListIds.length} lists.` }]
      };
    }
  );

  // ----------------------------------------------------
  // 4. TODOS MANAGEMENT
  // ----------------------------------------------------
  server.tool(
    'list_todos',
    'List all todo items inside a specific list, with optional status filter.',
    {
      listId: z.string().describe('The ID of the list'),
      filter: z.enum(['all', 'open', 'done', 'starred']).optional().describe('Filter todos by status (default: "all")')
    },
    async ({ listId, filter = 'all' }) => {
      const user = authManager.requireAuth();
      const list = await List.findOne({ userId: user._id, id: listId });
      if (!list) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      let todos = list.todos;
      if (filter === 'open') todos = todos.filter(t => !t.done);
      else if (filter === 'done') todos = todos.filter(t => t.done);
      else if (filter === 'starred') todos = todos.filter(t => t.starred);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            listName: list.name,
            totalInList: list.todos.length,
            filteredCount: todos.length,
            todos
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'add_todo',
    'Add a new todo item to a list.',
    {
      listId: z.string().describe('The ID of the list to add to'),
      text: z.string().describe('The task/todo text to add'),
      starred: z.boolean().optional().describe('Whether the new todo is starred (default: false)')
    },
    async ({ listId, text, starred = false }) => {
      const user = authManager.requireAuth();
      const trimmed = text.trim();
      if (!trimmed) return { content: [{ type: 'text', text: 'Todo text cannot be empty.' }], isError: true };

      const list = await List.findOne({ userId: user._id, id: listId });
      if (!list) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      const newTodo = {
        id: uid(),
        text: trimmed,
        done: false,
        starred: !!starred
      };

      list.todos.push(newTodo);
      await list.save();

      // Sync share if exists
      await Share.findOneAndUpdate(
        { ownerId: user._id, itemId: listId },
        { 'content.todos': list.todos, updatedBy: user.name }
      );

      return {
        content: [{
          type: 'text',
          text: `Added todo "${newTodo.text}" (ID: ${newTodo.id}) to list "${list.name}".`
        }]
      };
    }
  );

  server.tool(
    'toggle_todo',
    'Mark a todo item as completed (done) or incomplete.',
    {
      listId: z.string().describe('The ID of the list containing the todo'),
      todoId: z.string().describe('The ID of the todo item to toggle'),
      done: z.boolean().optional().describe('Explicit done status. If omitted, toggles current value.')
    },
    async ({ listId, todoId, done }) => {
      const user = authManager.requireAuth();
      const list = await List.findOne({ userId: user._id, id: listId });
      if (!list) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      const todo = list.todos.find(t => t.id === todoId);
      if (!todo) return { content: [{ type: 'text', text: `Todo ID "${todoId}" not found in list.` }], isError: true };

      todo.done = done !== undefined ? !!done : !todo.done;
      await list.save();

      // Sync share if exists
      await Share.findOneAndUpdate(
        { ownerId: user._id, itemId: listId },
        { 'content.todos': list.todos, updatedBy: user.name }
      );

      return {
        content: [{
          type: 'text',
          text: `Todo "${todo.text}" is now ${todo.done ? 'COMPLETED (done)' : 'OPEN (pending)'}.`
        }]
      };
    }
  );

  server.tool(
    'update_todo',
    'Update the text or properties of an existing todo.',
    {
      listId: z.string().describe('The ID of the list'),
      todoId: z.string().describe('The ID of the todo item'),
      text: z.string().optional().describe('New text for the todo'),
      starred: z.boolean().optional().describe('Starred status'),
      done: z.boolean().optional().describe('Done status')
    },
    async ({ listId, todoId, text, starred, done }) => {
      const user = authManager.requireAuth();
      const list = await List.findOne({ userId: user._id, id: listId });
      if (!list) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      const todo = list.todos.find(t => t.id === todoId);
      if (!todo) return { content: [{ type: 'text', text: `Todo ID "${todoId}" not found in list.` }], isError: true };

      if (text !== undefined) todo.text = text.trim();
      if (starred !== undefined) todo.starred = !!starred;
      if (done !== undefined) todo.done = !!done;

      await list.save();

      // Sync share if exists
      await Share.findOneAndUpdate(
        { ownerId: user._id, itemId: listId },
        { 'content.todos': list.todos, updatedBy: user.name }
      );

      return {
        content: [{ type: 'text', text: `Updated todo "${todo.text}".` }]
      };
    }
  );

  server.tool(
    'delete_todo',
    'Delete a todo item from a list.',
    {
      listId: z.string().describe('The ID of the list'),
      todoId: z.string().describe('The ID of the todo to delete')
    },
    async ({ listId, todoId }) => {
      const user = authManager.requireAuth();
      const list = await List.findOne({ userId: user._id, id: listId });
      if (!list) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      const idx = list.todos.findIndex(t => t.id === todoId);
      if (idx < 0) return { content: [{ type: 'text', text: `Todo ID "${todoId}" not found.` }], isError: true };

      const [deleted] = list.todos.splice(idx, 1);
      await list.save();

      // Sync share if exists
      await Share.findOneAndUpdate(
        { ownerId: user._id, itemId: listId },
        { 'content.todos': list.todos, updatedBy: user.name }
      );

      return {
        content: [{ type: 'text', text: `Deleted todo "${deleted.text}".` }]
      };
    }
  );

  server.tool(
    'move_todo',
    'Move a todo from one list to another list.',
    {
      sourceListId: z.string().describe('The list ID where the todo currently is'),
      targetListId: z.string().describe('The list ID where the todo should be moved to'),
      todoId: z.string().describe('The ID of the todo to move')
    },
    async ({ sourceListId, targetListId, todoId }) => {
      const user = authManager.requireAuth();
      const source = await List.findOne({ userId: user._id, id: sourceListId });
      const target = await List.findOne({ userId: user._id, id: targetListId });

      if (!source) return { content: [{ type: 'text', text: `Source list "${sourceListId}" not found.` }], isError: true };
      if (!target) return { content: [{ type: 'text', text: `Target list "${targetListId}" not found.` }], isError: true };

      const idx = source.todos.findIndex(t => t.id === todoId);
      if (idx < 0) return { content: [{ type: 'text', text: `Todo "${todoId}" not in source list.` }], isError: true };

      const [todoItem] = source.todos.splice(idx, 1);
      target.todos.push(todoItem);

      await source.save();
      await target.save();

      return {
        content: [{
          type: 'text',
          text: `Moved todo "${todoItem.text}" from "${source.name}" to "${target.name}".`
        }]
      };
    }
  );

  server.tool(
    'clear_completed_todos',
    'Remove all completed (done) todos from a list.',
    {
      listId: z.string().describe('The list ID')
    },
    async ({ listId }) => {
      const user = authManager.requireAuth();
      const list = await List.findOne({ userId: user._id, id: listId });
      if (!list) return { content: [{ type: 'text', text: `List ID "${listId}" not found.` }], isError: true };

      const originalCount = list.todos.length;
      list.todos = list.todos.filter(t => !t.done);
      const removedCount = originalCount - list.todos.length;
      await list.save();

      return {
        content: [{ type: 'text', text: `Cleared ${removedCount} completed todo(s) from "${list.name}".` }]
      };
    }
  );

  // ----------------------------------------------------
  // 5. NOTES & DOCUMENTS MANAGEMENT
  // ----------------------------------------------------
  server.tool(
    'list_notes',
    'List all documents / notes belonging to the current user.',
    {},
    async () => {
      const user = authManager.requireAuth();
      const notes = await Note.find({ userId: user._id }).sort({ order: 1, createdAt: -1 });
      const result = notes.map(n => ({
        id: n.id,
        title: n.title || 'Untitled note',
        starred: n.starred,
        isShared: !!n.shared,
        preview: htmlToText(n.html).slice(0, 100),
        updatedAt: n.updatedAt
      }));
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_note',
    'Retrieve the full document / note content (title, HTML, and plaintext).',
    {
      noteId: z.string().describe('The ID of the note/document')
    },
    async ({ noteId }) => {
      const user = authManager.requireAuth();
      const note = await Note.findOne({ userId: user._id, id: noteId });
      if (!note) return { content: [{ type: 'text', text: `Note ID "${noteId}" not found.` }], isError: true };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: note.id,
            title: note.title || 'Untitled note',
            starred: note.starred,
            plainText: htmlToText(note.html),
            html: note.html || '',
            updatedAt: note.updatedAt
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'create_note',
    'Create a new document / note with a title and optional body content.',
    {
      title: z.string().describe('Title of the document'),
      content: z.string().optional().describe('Body content (plaintext, markdown, or HTML)'),
      starred: z.boolean().optional().describe('Whether the note is starred (default: false)')
    },
    async ({ title, content = '', starred = false }) => {
      const user = authManager.requireAuth();
      const noteId = uid();
      const count = await Note.countDocuments({ userId: user._id });

      // If content doesn't look like HTML tags, wrap paragraphs
      let formattedHtml = content;
      if (content && !/<[a-z][\s\S]*>/i.test(content)) {
        formattedHtml = content
          .split(/\n\s*\n/)
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
      }

      const note = await Note.create({
        userId: user._id,
        id: noteId,
        title: title.trim(),
        html: formattedHtml,
        starred: !!starred,
        order: count
      });

      // Update user activeNoteId
      await User.findByIdAndUpdate(user._id, { activeNoteId: noteId, tab: 'notes' });

      return {
        content: [{
          type: 'text',
          text: `Created document "${note.title || 'Untitled note'}" (ID: ${note.id}).`
        }]
      };
    }
  );

  server.tool(
    'update_note',
    'Update an existing document/note title, body, or starred status.',
    {
      noteId: z.string().describe('The ID of the note to update'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content (plaintext or HTML; replaces existing body)'),
      starred: z.boolean().optional().describe('Starred status')
    },
    async ({ noteId, title, content, starred }) => {
      const user = authManager.requireAuth();
      const note = await Note.findOne({ userId: user._id, id: noteId });
      if (!note) return { content: [{ type: 'text', text: `Note ID "${noteId}" not found.` }], isError: true };

      if (title !== undefined) note.title = title.trim();
      if (content !== undefined) {
        let formatted = content;
        if (content && !/<[a-z][\s\S]*>/i.test(content)) {
          formatted = content
            .split(/\n\s*\n/)
            .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('');
        }
        note.html = formatted;
      }
      if (starred !== undefined) note.starred = !!starred;

      await note.save();

      // Sync share if exists
      await Share.findOneAndUpdate(
        { ownerId: user._id, itemId: noteId },
        { 'content.title': note.title, 'content.html': note.html, updatedBy: user.name }
      );

      return {
        content: [{ type: 'text', text: `Updated document "${note.title || 'Untitled note'}".` }]
      };
    }
  );

  server.tool(
    'append_to_note',
    'Append new text or HTML content to the end of an existing document.',
    {
      noteId: z.string().describe('The ID of the note'),
      contentToAppend: z.string().describe('Text or HTML to append')
    },
    async ({ noteId, contentToAppend }) => {
      const user = authManager.requireAuth();
      const note = await Note.findOne({ userId: user._id, id: noteId });
      if (!note) return { content: [{ type: 'text', text: `Note ID "${noteId}" not found.` }], isError: true };

      let addition = contentToAppend;
      if (!/<[a-z][\s\S]*>/i.test(addition)) {
        addition = addition
          .split(/\n\s*\n/)
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
      }

      note.html = (note.html || '') + addition;
      await note.save();

      // Sync share if exists
      await Share.findOneAndUpdate(
        { ownerId: user._id, itemId: noteId },
        { 'content.html': note.html, updatedBy: user.name }
      );

      return {
        content: [{ type: 'text', text: `Appended content to "${note.title || 'Untitled note'}".` }]
      };
    }
  );

  server.tool(
    'delete_note',
    'Delete a document / note by ID.',
    {
      noteId: z.string().describe('The ID of the note to delete')
    },
    async ({ noteId }) => {
      const user = authManager.requireAuth();
      const deleted = await Note.findOneAndDelete({ userId: user._id, id: noteId });
      if (!deleted) return { content: [{ type: 'text', text: `Note ID "${noteId}" not found.` }], isError: true };

      await Share.findOneAndDelete({ ownerId: user._id, itemId: noteId });

      return {
        content: [{ type: 'text', text: `Deleted document "${deleted.title || 'Untitled note'}".` }]
      };
    }
  );

  server.tool(
    'toggle_star_note',
    'Star or unstar a document / note.',
    {
      noteId: z.string().describe('The ID of the note'),
      starred: z.boolean().optional().describe('Force set starred status')
    },
    async ({ noteId, starred }) => {
      const user = authManager.requireAuth();
      const note = await Note.findOne({ userId: user._id, id: noteId });
      if (!note) return { content: [{ type: 'text', text: `Note ID "${noteId}" not found.` }], isError: true };

      note.starred = starred !== undefined ? !!starred : !note.starred;
      await note.save();

      return {
        content: [{ type: 'text', text: `Document "${note.title || 'Untitled note'}" is now ${note.starred ? 'starred' : 'unstarred'}.` }]
      };
    }
  );

  // ----------------------------------------------------
  // 6. SEARCH ACROSS EVERYTHING
  // ----------------------------------------------------
  server.tool(
    'search_all',
    'Search across all lists, todos, and note documents for a keyword or phrase.',
    {
      query: z.string().describe('Search query string')
    },
    async ({ query }) => {
      const user = authManager.requireAuth();
      const q = query.trim().toLowerCase();
      if (!q) return { content: [{ type: 'text', text: 'Query cannot be empty.' }], isError: true };

      const lists = await List.find({ userId: user._id });
      const notes = await Note.find({ userId: user._id });

      const matchedLists = [];
      const matchedTodos = [];
      const matchedNotes = [];

      for (const l of lists) {
        if (l.name.toLowerCase().includes(q)) {
          matchedLists.push({ id: l.id, name: l.name, totalTodos: l.todos.length });
        }
        for (const t of l.todos) {
          if (t.text.toLowerCase().includes(q)) {
            matchedTodos.push({ listId: l.id, listName: l.name, todoId: t.id, text: t.text, done: t.done });
          }
        }
      }

      for (const n of notes) {
        const plain = htmlToText(n.html).toLowerCase();
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const bodyMatch = plain.includes(q);

        if (titleMatch || bodyMatch) {
          matchedNotes.push({
            id: n.id,
            title: n.title || 'Untitled note',
            snippet: plain.slice(0, 150)
          });
        }
      }

      const results = {
        query,
        lists: matchedLists,
        todos: matchedTodos,
        notes: matchedNotes,
        summary: `Found ${matchedLists.length} list(s), ${matchedTodos.length} todo(s), and ${matchedNotes.length} note(s).`
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
      };
    }
  );

  // ----------------------------------------------------
  // 7. SHARING MANAGEMENT
  // ----------------------------------------------------
  server.tool(
    'create_share',
    'Generate or update a share link for a list or note.',
    {
      itemId: z.string().describe('List ID or Note ID to share'),
      kind: z.enum(['list', 'note']).describe('Kind of item'),
      mode: z.enum(['view', 'edit']).optional().describe('Permission mode ("view" or "edit", default "edit")')
    },
    async ({ itemId, kind, mode = 'edit' }) => {
      const user = authManager.requireAuth();
      let content = {};

      if (kind === 'list') {
        const list = await List.findOne({ userId: user._id, id: itemId });
        if (!list) return { content: [{ type: 'text', text: `List "${itemId}" not found.` }], isError: true };
        content = { name: list.name, todos: list.todos };
      } else {
        const note = await Note.findOne({ userId: user._id, id: itemId });
        if (!note) return { content: [{ type: 'text', text: `Note "${itemId}" not found.` }], isError: true };
        content = { title: note.title, html: note.html };
      }

      let share = await Share.findOne({ ownerId: user._id, itemId });
      if (share) {
        share.mode = mode;
        share.content = content;
        share.updatedBy = user.name;
        await share.save();
      } else {
        const sid = uid();
        share = await Share.create({
          sid,
          ownerId: user._id,
          ownerName: user.name,
          itemId,
          kind,
          mode,
          content,
          updatedBy: user.name
        });
      }

      // Update shared mark on item
      const sharedMeta = { sid: share.sid, mode: share.mode, own: true, ownerName: user.name };
      if (kind === 'list') {
        await List.findOneAndUpdate({ userId: user._id, id: itemId }, { shared: sharedMeta });
      } else {
        await Note.findOneAndUpdate({ userId: user._id, id: itemId }, { shared: sharedMeta });
      }

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const shareUrl = `${clientUrl}/#s.${share.sid}`;
      const publicViewUrl = `${clientUrl}/#p.${share.sid}`;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            sid: share.sid,
            mode: share.mode,
            shareUrl,
            publicViewUrl,
            message: `Shared as ${share.mode === 'edit' ? 'editable by link' : 'view-only'}.`
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'get_share_info',
    'Get sharing status and link for a list or note.',
    {
      itemId: z.string().describe('Item ID (list or note)')
    },
    async ({ itemId }) => {
      const user = authManager.requireAuth();
      const share = await Share.findOne({ ownerId: user._id, itemId });
      if (!share) {
        return { content: [{ type: 'text', text: `Item "${itemId}" is currently private (not shared).` }] };
      }

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            sid: share.sid,
            kind: share.kind,
            mode: share.mode,
            ownerName: share.ownerName,
            shareUrl: `${clientUrl}/#s.${share.sid}`,
            publicViewUrl: `${clientUrl}/#p.${share.sid}`,
            updatedAt: share.updatedAt
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'revoke_share',
    'Stop sharing an item and make it completely private again.',
    {
      itemId: z.string().describe('Item ID (list or note)')
    },
    async ({ itemId }) => {
      const user = authManager.requireAuth();
      await Share.findOneAndDelete({ ownerId: user._id, itemId });
      await List.findOneAndUpdate({ userId: user._id, id: itemId }, { shared: null });
      await Note.findOneAndUpdate({ userId: user._id, id: itemId }, { shared: null });

      return {
        content: [{ type: 'text', text: `Sharing stopped for item "${itemId}". It is now private.` }]
      };
    }
  );

  // ----------------------------------------------------
  // 8. ADMIN TOOLS (Admin users only)
  // ----------------------------------------------------
  server.tool(
    'admin_list_users',
    'List all team accounts in the system (requires Admin role).',
    {},
    async () => {
      authManager.requireAdmin();
      const users = await User.find({}).sort({ createdAt: 1 });
      const list = users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        name: u.name,
        role: u.role,
        authType: u.authType,
        status: u.status,
        lastSeen: u.lastSeen,
        createdAt: u.createdAt
      }));
      return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }
  );

  server.tool(
    'admin_create_user',
    'Create a new user account in the User DB (requires Admin role).',
    {
      username: z.string().describe('Unique username'),
      name: z.string().describe('Full display name'),
      password: z.string().describe('Initial password or PIN'),
      role: z.enum(['admin', 'member']).optional().describe('Role: "member" (default) or "admin"'),
      authType: z.enum(['password', 'pin']).optional().describe('Auth type: "password" (default) or "pin"')
    },
    async ({ username, name, password, role = 'member', authType = 'password' }) => {
      authManager.requireAdmin();
      const u = username.trim().toLowerCase();
      const existing = await User.findOne({ username: u });
      if (existing) {
        return { content: [{ type: 'text', text: `Username "${u}" already exists.` }], isError: true };
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password.trim(), salt);

      const newUser = await User.create({
        username: u,
        name: name.trim(),
        role,
        authType,
        passwordHash: authType === 'password' ? hash : null,
        pinHash: authType === 'pin' ? hash : null,
        status: 'active'
      });

      return {
        content: [{
          type: 'text',
          text: `Created user @${newUser.username} (${newUser.name}) with role "${newUser.role}".`
        }]
      };
    }
  );

  server.tool(
    'admin_toggle_user_status',
    'Turn a user account on (active) or off (requires Admin role).',
    {
      username: z.string().describe('Username of the account to update'),
      status: z.enum(['active', 'off']).describe('Account status ("active" or "off")')
    },
    async ({ username, status }) => {
      const admin = authManager.requireAdmin();
      const u = username.trim().toLowerCase();
      if (admin.username === u && status === 'off') {
        return { content: [{ type: 'text', text: 'You cannot turn off your own admin account.' }], isError: true };
      }

      const user = await User.findOneAndUpdate({ username: u }, { status }, { new: true });
      if (!user) return { content: [{ type: 'text', text: `User "@${u}" not found.` }], isError: true };

      return {
        content: [{ type: 'text', text: `User @${user.username} account status is now "${user.status}".` }]
      };
    }
  );

  server.tool(
    'admin_rename_user',
    'Rename any user (or the admin themselves) by updating their full display name and optionally their username handle (requires Admin role).',
    {
      username: z.string().describe('Current username of the user to rename (e.g. "admin", "aditi.rao")'),
      name: z.string().describe('New full display name for the user'),
      newUsername: z.string().optional().describe('Optional new username handle')
    },
    async ({ username, name, newUsername }) => {
      const admin = authManager.requireAdmin();
      const u = username.trim().toLowerCase();
      const user = await User.findOne({ username: u });
      if (!user) {
        return { content: [{ type: 'text', text: `User "@${u}" not found in database.` }], isError: true };
      }

      if (!name || !name.trim()) {
        return { content: [{ type: 'text', text: 'Display name cannot be empty.' }], isError: true };
      }

      const trimmedName = name.trim();
      const oldName = user.name;
      user.name = trimmedName;

      let oldU = user.username;
      let uMsg = '';

      if (newUsername && newUsername.trim()) {
        const targetU = newUsername.trim().toLowerCase();
        if (targetU !== user.username) {
          if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(targetU)) {
            return {
              content: [{
                type: 'text',
                text: 'Invalid username format. Must be 3–30 lowercase letters, numbers, dots, dashes or underscores.'
              }],
              isError: true
            };
          }
          const existing = await User.findOne({ username: targetU });
          if (existing && existing._id.toString() !== user._id.toString()) {
            return { content: [{ type: 'text', text: `Username "${targetU}" is already taken.` }], isError: true };
          }
          user.username = targetU;
          uMsg = ` (username updated from @${oldU} to @${targetU})`;
        }
      }

      await user.save();
      await Share.updateMany({ ownerId: user._id }, { ownerName: trimmedName });

      // If the admin renamed themselves, keep active session in sync
      if (admin.username === oldU) {
        authManager.currentUser = user;
      }

      return {
        content: [{
          type: 'text',
          text: `Successfully renamed user @${oldU}: "${oldName}" ➔ "${user.name}"${uMsg}.`
        }]
      };
    }
  );
}

