import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { User } from '../models/User.js';
import { Share } from '../models/Share.js';
import { CrmMember } from '../models/CrmMember.js';
import { syncShareAcrossAllUsers } from '../utils/shareSync.js';
import { getBackups, createBackup, getBackupConfig } from '../services/backupService.js';
import { getLogs, undoLogEntry } from '../services/auditLogService.js';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const escapeRegex = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  // Share sync notification helpers
  const notifyListShare = async (user, list) => {
    try {
      let sid = list.shared?.sid;
      if (!sid) {
        const sh = await Share.findOne({ ownerId: user._id, itemId: list.id });
        if (sh) sid = sh.sid;
      }
      if (sid) {
        await syncShareAcrossAllUsers({
          sid,
          kind: 'list',
          content: { name: list.name, todos: list.todos },
          updatedBy: user.name
        });
      }
    } catch {}
  };

  const notifyNoteShare = async (user, note) => {
    try {
      let sid = note.shared?.sid;
      if (!sid) {
        const sh = await Share.findOne({ ownerId: user._id, itemId: note.id });
        if (sh) sid = sh.sid;
      }
      if (sid) {
        await syncShareAcrossAllUsers({
          sid,
          kind: 'note',
          content: { title: note.title, html: note.html },
          updatedBy: user.name
        });
      }
    } catch {}
  };

  // Resilient lookup helpers: by ID OR Name
  const findList = async (userId, identifier) => {
    if (!identifier) return null;
    const idStr = String(identifier).trim();
    let list = await List.findOne({ userId, id: idStr });
    if (!list) {
      list = await List.findOne({ userId, name: new RegExp('^' + escapeRegex(idStr) + '$', 'i') });
    }
    if (!list) {
      list = await List.findOne({ userId, name: new RegExp(escapeRegex(idStr), 'i') });
    }
    return list;
  };

  const findTodoAcrossLists = async (userId, todoIdentifier, listIdentifier = null) => {
    if (!todoIdentifier) return null;
    const tStr = String(todoIdentifier).trim();

    let targetLists = [];
    if (listIdentifier) {
      const l = await findList(userId, listIdentifier);
      if (l) targetLists = [l];
    }
    if (targetLists.length === 0) {
      targetLists = await List.find({ userId });
    }

    for (const list of targetLists) {
      // 1. By ID
      let idx = list.todos.findIndex(t => t.id === tStr);
      if (idx >= 0) return { list, todo: list.todos[idx], index: idx };

      // 2. By exact text
      idx = list.todos.findIndex(t => t.text.toLowerCase() === tStr.toLowerCase());
      if (idx >= 0) return { list, todo: list.todos[idx], index: idx };

      // 3. By partial text
      idx = list.todos.findIndex(t => t.text.toLowerCase().includes(tStr.toLowerCase()));
      if (idx >= 0) return { list, todo: list.todos[idx], index: idx };
    }
    return null;
  };

  const findNote = async (userId, identifier) => {
    if (!identifier) return null;
    const nStr = String(identifier).trim();
    let note = await Note.findOne({ userId, id: nStr });
    if (!note) {
      note = await Note.findOne({ userId, title: new RegExp('^' + escapeRegex(nStr) + '$', 'i') });
    }
    if (!note) {
      note = await Note.findOne({ userId, title: new RegExp(escapeRegex(nStr), 'i') });
    }
    return note;
  };

  const findMember = async (identifier) => {
    if (!identifier) return null;
    const mStr = String(identifier).trim();
    let member = await CrmMember.findOne({ id: mStr });
    if (!member) {
      member = await CrmMember.findOne({ name: new RegExp('^' + escapeRegex(mStr) + '$', 'i') });
    }
    if (!member) {
      member = await CrmMember.findOne({ mobile: mStr });
    }
    if (!member) {
      member = await CrmMember.findOne({ name: new RegExp(escapeRegex(mStr), 'i') });
    }
    return member;
  };

  const computeMemberStatus = (m) => {
    if (m.plan === 'Alumni') return 'Alumni';
    if (!m.end) return 'Active';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(m.end);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.round((end - today) / 86400000);
    if (diffDays < 0) return 'Expired';
    if (diffDays <= 30) return 'Expiring';
    return 'Active';
  };

  // ====================================================
  // GROUP 1: BOARD & AUTH TOOLS (4 tools)
  // ====================================================

  server.tool(
    'get_board',
    'Get complete user board overview: all lists, todos, notes, CRM summary, active tab, and current user info.',
    {},
    async () => {
      const user = authManager.requireAuth();
      const lists = await List.find({ userId: user._id }).sort({ order: 1, createdAt: 1 });
      const notes = await Note.find({ userId: user._id }).sort({ order: 1, createdAt: -1 });

      let crmStats = null;
      if (user.crm || user.role === 'admin') {
        const members = await CrmMember.find({});
        crmStats = {
          totalMembers: members.length,
          active: members.filter(m => computeMemberStatus(m) === 'Active').length,
          expiring: members.filter(m => computeMemberStatus(m) === 'Expiring').length,
          expired: members.filter(m => computeMemberStatus(m) === 'Expired').length,
          alumni: members.filter(m => computeMemberStatus(m) === 'Alumni').length
        };
      }

      const overview = {
        authenticatedUser: {
          username: user.username,
          name: user.name,
          role: user.role,
          hasCrmAccess: !!(user.crm || user.role === 'admin'),
          activeTab: user.tab || 'lists'
        },
        lists: lists.map(l => ({
          id: l.id,
          name: l.name,
          starred: l.starred,
          openCount: l.todos.filter(t => !t.done).length,
          doneCount: l.todos.filter(t => t.done).length,
          total: l.todos.length,
          todos: l.todos.map(t => ({ id: t.id, text: t.text, done: t.done, starred: t.starred })),
          isShared: !!l.shared
        })),
        notes: notes.map(n => ({
          id: n.id,
          title: n.title || 'Untitled note',
          starred: n.starred,
          isShared: !!n.shared,
          updatedAt: n.updatedAt
        })),
        crmSummary: crmStats
      };

      return { content: [{ type: 'text', text: JSON.stringify(overview, null, 2) }] };
    }
  );

  server.tool(
    'get_board_stats',
    'Get high-level numerical statistics for lists, open/done tasks, notes, and CRM members.',
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

      let crmCount = 0;
      if (user.crm || user.role === 'admin') {
        crmCount = await CrmMember.countDocuments({});
      }

      const stats = {
        account: `@${user.username} (${user.name})`,
        totalLists: lists.length,
        starredLists,
        totalTodos,
        openTodos,
        doneTodos,
        starredTodos,
        totalNotes: notesCount,
        totalCrmMembers: crmCount
      };

      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    }
  );

  server.tool(
    'get_current_user',
    'Get details about the currently authenticated user session (username, display name, role, CRM permission).',
    {},
    async () => {
      const user = authManager.requireAuth();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            username: user.username,
            name: user.name,
            role: user.role,
            status: user.status,
            crmAccess: !!(user.crm || user.role === 'admin'),
            activeTab: user.tab || 'lists'
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'search_all',
    'Search across all user lists, todos, notes, and CRM records matching a search query.',
    {
      query: z.string().describe('Search query keyword')
    },
    async ({ query }) => {
      const user = authManager.requireAuth();
      const q = String(query).trim().toLowerCase();
      if (!q) return { content: [{ type: 'text', text: 'Search query cannot be empty.' }], isError: true };

      const lists = await List.find({ userId: user._id });
      const notes = await Note.find({ userId: user._id });

      const matchedLists = [];
      const matchedTodos = [];
      for (const l of lists) {
        if (l.name.toLowerCase().includes(q)) {
          matchedLists.push({ id: l.id, name: l.name, totalTodos: l.todos.length });
        }
        for (const t of l.todos) {
          if (t.text.toLowerCase().includes(q)) {
            matchedTodos.push({
              listId: l.id,
              listName: l.name,
              todoId: t.id,
              text: t.text,
              done: t.done,
              starred: t.starred
            });
          }
        }
      }

      const matchedNotes = [];
      for (const n of notes) {
        const plain = htmlToText(n.html || '');
        if ((n.title && n.title.toLowerCase().includes(q)) || plain.toLowerCase().includes(q)) {
          matchedNotes.push({ id: n.id, title: n.title, preview: plain.slice(0, 150) });
        }
      }

      let matchedMembers = [];
      if (user.crm || user.role === 'admin') {
        const members = await CrmMember.find({
          $or: [
            { name: new RegExp(escapeRegex(q), 'i') },
            { mobile: new RegExp(escapeRegex(q), 'i') },
            { comment: new RegExp(escapeRegex(q), 'i') }
          ]
        });
        matchedMembers = members.map(m => ({
          id: m.id,
          name: m.name,
          mobile: m.mobile,
          plan: m.plan,
          status: computeMemberStatus(m)
        }));
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query,
            totalMatches: matchedLists.length + matchedTodos.length + matchedNotes.length + matchedMembers.length,
            lists: matchedLists,
            todos: matchedTodos,
            notes: matchedNotes,
            crmMembers: matchedMembers
          }, null, 2)
        }]
      };
    }
  );

  // ====================================================
  // GROUP 2: LISTS MANAGEMENT (4 tools)
  // ====================================================

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
    'Get a specific todo list by its ID or Name, including all its todo items.',
    {
      identifier: z.string().describe('List ID or list name (e.g. "Ideas", "Project Links")')
    },
    async ({ identifier }) => {
      const user = authManager.requireAuth();
      const list = await findList(user._id, identifier);

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
    'Create a new todo list with an optional array of initial todo item texts.',
    {
      name: z.string().describe('Title / name of the new list'),
      starred: z.boolean().optional().describe('Whether the list is starred (default: false)'),
      initialTodos: z.array(z.string()).optional().describe('Optional list of initial todo texts')
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
    'manage_list',
    'Rename, star/unstar, delete a list, or clear all lists. Accepts list ID or Name.',
    {
      action: z.enum(['rename', 'star', 'unstar', 'delete', 'clear_all']).describe('Action: "rename", "star", "unstar", "delete", or "clear_all"'),
      identifier: z.string().optional().describe('List ID or list Name (required for rename, star, unstar, delete)'),
      newName: z.string().optional().describe('New name when action is "rename"')
    },
    async ({ action, identifier, newName }) => {
      const user = authManager.requireAuth();

      if (action === 'clear_all') {
        const count = await List.countDocuments({ userId: user._id });
        await List.deleteMany({ userId: user._id });
        return { content: [{ type: 'text', text: `Deleted all ${count} lists and their tasks.` }] };
      }

      if (!identifier) {
        return { content: [{ type: 'text', text: 'identifier (List ID or Name) is required.' }], isError: true };
      }

      const list = await findList(user._id, identifier);
      if (!list) {
        return { content: [{ type: 'text', text: `List "${identifier}" not found.` }], isError: true };
      }

      if (action === 'delete') {
        await List.findOneAndDelete({ userId: user._id, id: list.id });
        await Share.findOneAndDelete({ ownerId: user._id, itemId: list.id });
        return { content: [{ type: 'text', text: `List "${list.name}" (ID: ${list.id}) deleted successfully.` }] };
      }

      if (action === 'rename') {
        const name = (newName || '').trim();
        if (!name) return { content: [{ type: 'text', text: 'newName cannot be empty.' }], isError: true };
        list.name = name;
        await list.save();
        await notifyListShare(user, list);
        return { content: [{ type: 'text', text: `Renamed list to "${list.name}".` }] };
      }

      if (action === 'star' || action === 'unstar') {
        list.starred = action === 'star';
        await list.save();
        return { content: [{ type: 'text', text: `List "${list.name}" is now ${list.starred ? 'starred' : 'unstarred'}.` }] };
      }

      return { content: [{ type: 'text', text: `Unknown action "${action}".` }], isError: true };
    }
  );

  // ====================================================
  // GROUP 3: TODOS MANAGEMENT (5 tools)
  // ====================================================

  server.tool(
    'list_todos',
    'List todos across all lists or inside a specific list, with optional status filter.',
    {
      listIdentifier: z.string().optional().describe('Optional list ID or list Name (if omitted, lists all todos from all lists)'),
      filter: z.enum(['all', 'open', 'done', 'starred']).optional().describe('Filter by status: "all", "open", "done", "starred"')
    },
    async ({ listIdentifier, filter = 'all' }) => {
      const user = authManager.requireAuth();

      let lists = [];
      if (listIdentifier) {
        const l = await findList(user._id, listIdentifier);
        if (!l) return { content: [{ type: 'text', text: `List "${listIdentifier}" not found.` }], isError: true };
        lists = [l];
      } else {
        lists = await List.find({ userId: user._id }).sort({ order: 1, createdAt: 1 });
      }

      const allTodos = [];
      for (const l of lists) {
        let todos = l.todos;
        if (filter === 'open') todos = todos.filter(t => !t.done);
        else if (filter === 'done') todos = todos.filter(t => t.done);
        else if (filter === 'starred') todos = todos.filter(t => t.starred);

        for (const t of todos) {
          allTodos.push({
            listId: l.id,
            listName: l.name,
            todoId: t.id,
            text: t.text,
            done: t.done,
            starred: t.starred
          });
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            filter,
            totalTodos: allTodos.length,
            todos: allTodos
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'add_todo',
    'Add a new todo item to a list (accepts list ID or list Name). Auto-creates list if it does not exist.',
    {
      listIdentifier: z.string().describe('The list ID or list Name to add to (e.g. "Ideas", "This Week")'),
      text: z.string().describe('The task/todo text to add'),
      starred: z.boolean().optional().describe('Whether the new todo is starred (default: false)')
    },
    async ({ listIdentifier, text, starred = false }) => {
      const user = authManager.requireAuth();
      const trimmed = text.trim();
      if (!trimmed) return { content: [{ type: 'text', text: 'Todo text cannot be empty.' }], isError: true };

      let list = await findList(user._id, listIdentifier);
      if (!list) {
        // Auto-create list with that name
        const count = await List.countDocuments({ userId: user._id });
        list = await List.create({
          userId: user._id,
          id: uid(),
          name: listIdentifier.trim(),
          starred: false,
          order: count,
          todos: []
        });
      }

      const newTodo = {
        id: uid(),
        text: trimmed,
        done: false,
        starred: !!starred
      };

      list.todos.push(newTodo);
      await list.save();
      await notifyListShare(user, list);

      return {
        content: [{
          type: 'text',
          text: `Added todo "${newTodo.text}" (ID: ${newTodo.id}) to list "${list.name}".`
        }]
      };
    }
  );

  server.tool(
    'update_todo',
    'Update a todo (text, completed status, starred status). Accepts todo ID or task text. List is optional.',
    {
      todoIdentifier: z.string().describe('The todo item ID or task text to update'),
      listIdentifier: z.string().optional().describe('Optional list ID or list Name'),
      text: z.string().optional().describe('New text for the todo'),
      done: z.boolean().optional().describe('Set completed status (true = completed, false = open)'),
      starred: z.boolean().optional().describe('Set starred status (true/false)')
    },
    async ({ todoIdentifier, listIdentifier, text, done, starred }) => {
      const user = authManager.requireAuth();
      const found = await findTodoAcrossLists(user._id, todoIdentifier, listIdentifier);

      if (!found) {
        return { content: [{ type: 'text', text: `Todo "${todoIdentifier}" not found.` }], isError: true };
      }

      const { list, todo } = found;
      if (text !== undefined) todo.text = text.trim();
      if (done !== undefined) todo.done = !!done;
      if (starred !== undefined) todo.starred = !!starred;

      await list.save();
      await notifyListShare(user, list);

      return {
        content: [{
          type: 'text',
          text: `Updated todo "${todo.text}" (Status: ${todo.done ? 'Done' : 'Open'}, Starred: ${todo.starred}) in list "${list.name}".`
        }]
      };
    }
  );

  server.tool(
    'delete_todo',
    'Delete one or more todo items by ID or text across any list, or clear all todos.',
    {
      todoIdentifier: z.string().optional().describe('Todo item ID or exact task text to delete'),
      todoIdentifiers: z.array(z.string()).optional().describe('Array of todo IDs or task texts to bulk delete'),
      listIdentifier: z.string().optional().describe('Optional list ID or list Name'),
      deleteAll: z.boolean().optional().describe('Set to true to delete ALL todos across the board')
    },
    async ({ todoIdentifier, todoIdentifiers, listIdentifier, deleteAll }) => {
      const user = authManager.requireAuth();

      if (deleteAll) {
        const lists = await List.find({ userId: user._id });
        let removed = 0;
        for (const l of lists) {
          removed += l.todos.length;
          l.todos = [];
          await l.save();
          await notifyListShare(user, l);
        }
        return { content: [{ type: 'text', text: `Deleted all ${removed} todos across all lists.` }] };
      }

      const toDelete = [];
      if (todoIdentifier) toDelete.push(todoIdentifier);
      if (Array.isArray(todoIdentifiers)) toDelete.push(...todoIdentifiers);

      if (toDelete.length === 0) {
        return { content: [{ type: 'text', text: 'Provide todoIdentifier or set deleteAll: true.' }], isError: true };
      }

      let deletedCount = 0;
      const results = [];

      for (const idOrText of toDelete) {
        const found = await findTodoAcrossLists(user._id, idOrText, listIdentifier);
        if (found) {
          const { list, todo, index } = found;
          list.todos.splice(index, 1);
          await list.save();
          await notifyListShare(user, list);
          deletedCount++;
          results.push(`Deleted "${todo.text}" from list "${list.name}".`);
        } else {
          results.push(`Todo "${idOrText}" not found.`);
        }
      }

      return {
        content: [{
          type: 'text',
          text: `Processed ${toDelete.length} item(s) (${deletedCount} deleted):\n- ` + results.join('\n- ')
        }]
      };
    }
  );

  server.tool(
    'move_or_clean_todos',
    'Move a todo between lists, or clear all completed (done) todos from lists.',
    {
      action: z.enum(['move', 'clear_completed']).describe('Action: "move" to move a todo, or "clear_completed" to remove completed tasks'),
      todoIdentifier: z.string().optional().describe('Todo ID or text to move (required for "move")'),
      targetListIdentifier: z.string().optional().describe('Destination list ID or Name (required for "move")'),
      listIdentifier: z.string().optional().describe('Specific list ID or Name for clear_completed (optional)')
    },
    async ({ action, todoIdentifier, targetListIdentifier, listIdentifier }) => {
      const user = authManager.requireAuth();

      if (action === 'clear_completed') {
        let lists = [];
        if (listIdentifier) {
          const l = await findList(user._id, listIdentifier);
          if (l) lists = [l];
        } else {
          lists = await List.find({ userId: user._id });
        }

        let totalCleared = 0;
        for (const l of lists) {
          const before = l.todos.length;
          l.todos = l.todos.filter(t => !t.done);
          const cleared = before - l.todos.length;
          if (cleared > 0) {
            totalCleared += cleared;
            await l.save();
            await notifyListShare(user, l);
          }
        }
        return { content: [{ type: 'text', text: `Cleared ${totalCleared} completed todo(s).` }] };
      }

      if (action === 'move') {
        if (!todoIdentifier || !targetListIdentifier) {
          return { content: [{ type: 'text', text: 'todoIdentifier and targetListIdentifier are required for "move".' }], isError: true };
        }

        const targetList = await findList(user._id, targetListIdentifier);
        if (!targetList) {
          return { content: [{ type: 'text', text: `Target list "${targetListIdentifier}" not found.` }], isError: true };
        }

        const found = await findTodoAcrossLists(user._id, todoIdentifier);
        if (!found) {
          return { content: [{ type: 'text', text: `Todo "${todoIdentifier}" not found.` }], isError: true };
        }

        const { list: sourceList, todo, index } = found;
        sourceList.todos.splice(index, 1);
        await sourceList.save();
        await notifyListShare(user, sourceList);

        targetList.todos.push(todo);
        await targetList.save();
        await notifyListShare(user, targetList);

        return {
          content: [{
            type: 'text',
            text: `Moved todo "${todo.text}" from "${sourceList.name}" to "${targetList.name}".`
          }]
        };
      }

      return { content: [{ type: 'text', text: `Unknown action "${action}".` }], isError: true };
    }
  );

  // ====================================================
  // GROUP 4: NOTES MANAGEMENT (3 tools)
  // ====================================================

  server.tool(
    'list_notes',
    'List all user notes with IDs, titles, starred status, and last modified date.',
    {},
    async () => {
      const user = authManager.requireAuth();
      const notes = await Note.find({ userId: user._id }).sort({ order: 1, createdAt: -1 });
      const result = notes.map(n => ({
        id: n.id,
        title: n.title || 'Untitled note',
        starred: n.starred,
        isShared: !!n.shared,
        preview: htmlToText(n.html || '').slice(0, 100),
        updatedAt: n.updatedAt
      }));
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_note',
    'Get full content of a note by note ID or title (returns plain text and HTML).',
    {
      identifier: z.string().describe('Note ID or note title')
    },
    async ({ identifier }) => {
      const user = authManager.requireAuth();
      const note = await findNote(user._id, identifier);

      if (!note) {
        return { content: [{ type: 'text', text: `Note "${identifier}" not found.` }], isError: true };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: note.id,
            title: note.title,
            starred: note.starred,
            plainText: htmlToText(note.html || ''),
            html: note.html || '',
            shared: note.shared,
            updatedAt: note.updatedAt
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'manage_note',
    'Create, update, append to, star/unstar, or delete notes. Accepts note ID or title.',
    {
      action: z.enum(['create', 'update', 'append', 'star', 'unstar', 'delete']).describe('Action: "create", "update", "append", "star", "unstar", or "delete"'),
      identifier: z.string().optional().describe('Note ID or title (required for update, append, star, unstar, delete)'),
      title: z.string().optional().describe('Title of the note'),
      content: z.string().optional().describe('Content (plain text or HTML)'),
      starred: z.boolean().optional().describe('Whether note is starred')
    },
    async ({ action, identifier, title, content = '', starred = false }) => {
      const user = authManager.requireAuth();

      if (action === 'create') {
        const noteId = uid();
        const count = await Note.countDocuments({ userId: user._id });
        const html = content.includes('<') ? content : content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');

        const newNote = await Note.create({
          userId: user._id,
          id: noteId,
          title: (title || 'Untitled note').trim(),
          starred: !!starred,
          order: count,
          html
        });

        await User.findByIdAndUpdate(user._id, { activeNoteId: noteId, tab: 'notes' });

        return {
          content: [{
            type: 'text',
            text: `Created note "${newNote.title}" (ID: ${newNote.id}).`
          }]
        };
      }

      if (!identifier) {
        return { content: [{ type: 'text', text: 'identifier (Note ID or title) is required.' }], isError: true };
      }

      const note = await findNote(user._id, identifier);
      if (!note) {
        return { content: [{ type: 'text', text: `Note "${identifier}" not found.` }], isError: true };
      }

      if (action === 'delete') {
        await Note.findOneAndDelete({ userId: user._id, id: note.id });
        await Share.findOneAndDelete({ ownerId: user._id, itemId: note.id });
        return { content: [{ type: 'text', text: `Note "${note.title}" (ID: ${note.id}) deleted.` }] };
      }

      if (action === 'update') {
        if (title !== undefined) note.title = title.trim();
        if (content !== undefined) {
          note.html = content.includes('<') ? content : content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
        }
        if (starred !== undefined) note.starred = !!starred;
        await note.save();
        await notifyNoteShare(user, note);
        return { content: [{ type: 'text', text: `Updated note "${note.title}".` }] };
      }

      if (action === 'append') {
        const toAdd = content.includes('<') ? content : content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
        note.html = (note.html || '') + toAdd;
        await note.save();
        await notifyNoteShare(user, note);
        return { content: [{ type: 'text', text: `Appended content to note "${note.title}".` }] };
      }

      if (action === 'star' || action === 'unstar') {
        note.starred = action === 'star';
        await note.save();
        return { content: [{ type: 'text', text: `Note "${note.title}" is now ${note.starred ? 'starred' : 'unstarred'}.` }] };
      }

      return { content: [{ type: 'text', text: `Unknown action "${action}".` }], isError: true };
    }
  );

  // ====================================================
  // GROUP 5: CRM MANAGEMENT (5 tools)
  // ====================================================

  const requireCrm = (user) => {
    if (user.role === 'admin' || user.crm) return;
    throw new Error('Access denied: Your account does not have CRM permissions. Ask an admin to enable CRM access.');
  };

  server.tool(
    'crm_get_dashboard',
    'Complete CRM dashboard: overview stats (members, active, expiring, expired, alumni), due followups, and upcoming renewals.',
    {},
    async () => {
      const user = authManager.requireAuth();
      requireCrm(user);

      const members = await CrmMember.find({}).sort({ end: 1, name: 1 });
      const stats = {
        total: members.length,
        active: members.filter(m => computeMemberStatus(m) === 'Active').length,
        expiring: members.filter(m => computeMemberStatus(m) === 'Expiring').length,
        expired: members.filter(m => computeMemberStatus(m) === 'Expired').length,
        alumni: members.filter(m => computeMemberStatus(m) === 'Alumni').length
      };

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const in30Days = new Date(now.getTime() + 30 * 86400000);
      const in30DaysStr = `${in30Days.getFullYear()}-${String(in30Days.getMonth() + 1).padStart(2, '0')}-${String(in30Days.getDate()).padStart(2, '0')}`;

      const dueFollowups = [];
      const upcomingRenewals = [];

      for (const m of members) {
        for (const f of m.followUps || []) {
          if (!f.done && f.date && f.date <= todayStr) {
            dueFollowups.push({
              memberId: m.id,
              memberName: m.name,
              memberMobile: m.mobile,
              followupId: f.id,
              task: f.note,
              date: f.date,
              overdue: f.date < todayStr
            });
          }
        }
        if (m.end && m.end >= todayStr && m.end <= in30DaysStr && m.plan !== 'Alumni') {
          upcomingRenewals.push({
            id: m.id,
            name: m.name,
            mobile: m.mobile,
            plan: m.plan,
            endDate: m.end
          });
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            stats,
            dueFollowupsCount: dueFollowups.length,
            dueFollowups,
            upcomingRenewalsCount: upcomingRenewals.length,
            upcomingRenewals
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    'crm_manage_member',
    'Member management for CRM: list members with filters, get member details, add member, update member, or delete member.',
    {
      action: z.enum(['list', 'get', 'create', 'update', 'delete']).describe('Action: "list", "get", "create", "update", or "delete"'),
      identifier: z.string().optional().describe('Member ID, Name, or Mobile (for get, update, delete)'),
      filter: z.enum(['all', 'active', 'expiring', 'expired', 'alumni']).optional().describe('Status filter when action is "list"'),
      name: z.string().optional().describe('Member full name (for create or update)'),
      mobile: z.string().optional().describe('Mobile / WhatsApp number (e.g. 98100 12345)'),
      plan: z.string().optional().describe('Plan name: "Boardroom", "QBR", "FT 1", "FT 2", "FT 3", "FT Continuity", "Alumni"'),
      start: z.string().optional().describe('Start date YYYY-MM-DD'),
      end: z.string().optional().describe('End date YYYY-MM-DD'),
      comment: z.string().optional().describe('Member notes / comments')
    },
    async ({ action, identifier, filter = 'all', name, mobile, plan, start, end, comment }) => {
      const user = authManager.requireAuth();
      requireCrm(user);

      if (action === 'list') {
        const members = await CrmMember.find({}).sort({ end: 1, name: 1 });
        let list = members.map(m => ({
          id: m.id,
          name: m.name,
          mobile: m.mobile,
          plan: m.plan,
          start: m.start,
          end: m.end,
          status: computeMemberStatus(m),
          openFollowups: (m.followUps || []).filter(f => !f.done).length,
          sessionsCount: (m.sessions || []).length,
          lastSession: m.lastSession || ''
        }));

        if (filter !== 'all') {
          list = list.filter(m => m.status.toLowerCase() === filter.toLowerCase());
        }

        return { content: [{ type: 'text', text: JSON.stringify({ filter, count: list.length, members: list }, null, 2) }] };
      }

      if (action === 'create') {
        if (!name || !name.trim()) {
          return { content: [{ type: 'text', text: 'Member name is required.' }], isError: true };
        }
        const memberId = uid();
        const validPlans = ["Boardroom", "QBR", "FT 1", "FT 2", "FT 3", "FT Continuity", "Alumni"];
        const selectedPlan = validPlans.includes(plan) ? plan : "Boardroom";

        const newMember = await CrmMember.create({
          id: memberId,
          name: name.trim(),
          mobile: (mobile || '').trim(),
          plan: selectedPlan,
          start: start || '',
          end: end || '',
          comment: comment || '',
          followUps: [],
          sessions: [],
          lastSession: '',
          sessionCount: 0,
          updatedBy: user.username,
          updatedByName: user.name
        });

        return {
          content: [{
            type: 'text',
            text: `Created CRM member "${newMember.name}" (ID: ${newMember.id}, Plan: ${newMember.plan}, Status: ${computeMemberStatus(newMember)}).`
          }]
        };
      }

      if (!identifier) {
        return { content: [{ type: 'text', text: 'identifier (Member ID, Name, or Mobile) is required.' }], isError: true };
      }

      const member = await findMember(identifier);
      if (!member) {
        return { content: [{ type: 'text', text: `Member "${identifier}" not found.` }], isError: true };
      }

      if (action === 'get') {
        const details = {
          ...member.toObject(),
          computedStatus: computeMemberStatus(member)
        };
        return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
      }

      if (action === 'delete') {
        await CrmMember.deleteOne({ id: member.id });
        return { content: [{ type: 'text', text: `Deleted CRM member "${member.name}" (ID: ${member.id}).` }] };
      }

      if (action === 'update') {
        if (name !== undefined) member.name = name.trim();
        if (mobile !== undefined) member.mobile = mobile.trim();
        if (plan !== undefined) member.plan = plan;
        if (start !== undefined) member.start = start;
        if (end !== undefined) member.end = end;
        if (comment !== undefined) member.comment = comment;

        member.updatedAt = Date.now();
        member.updatedBy = user.username;
        member.updatedByName = user.name;
        await member.save();

        return { content: [{ type: 'text', text: `Updated member "${member.name}" (Plan: ${member.plan}, Status: ${computeMemberStatus(member)}).` }] };
      }

      return { content: [{ type: 'text', text: `Unknown action "${action}".` }], isError: true };
    }
  );

  server.tool(
    'crm_manage_followup',
    'Manage member follow-ups: list due followups, add a followup, toggle completed, or delete a followup.',
    {
      action: z.enum(['list_due', 'add', 'toggle', 'delete']).describe('Action: "list_due", "add", "toggle", or "delete"'),
      memberIdentifier: z.string().optional().describe('Member ID, Name, or Mobile (required for add, toggle, delete)'),
      followupId: z.string().optional().describe('Followup ID for toggle or delete'),
      task: z.string().optional().describe('Followup note / task text when action is "add"'),
      dueDate: z.string().optional().describe('Due date YYYY-MM-DD when action is "add"')
    },
    async ({ action, memberIdentifier, followupId, task, dueDate }) => {
      const user = authManager.requireAuth();
      requireCrm(user);

      if (action === 'list_due') {
        const members = await CrmMember.find({});
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const dueList = [];

        for (const m of members) {
          for (const f of m.followUps || []) {
            if (!f.done && f.date && f.date <= todayStr) {
              dueList.push({
                memberId: m.id,
                memberName: m.name,
                memberMobile: m.mobile,
                followupId: f.id,
                task: f.note,
                date: f.date,
                overdue: f.date < todayStr
              });
            }
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: dueList.length, followups: dueList }, null, 2) }] };
      }

      if (!memberIdentifier) {
        return { content: [{ type: 'text', text: 'memberIdentifier is required.' }], isError: true };
      }

      const member = await findMember(memberIdentifier);
      if (!member) {
        return { content: [{ type: 'text', text: `Member "${memberIdentifier}" not found.` }], isError: true };
      }

      if (action === 'add') {
        if (!task || !task.trim()) return { content: [{ type: 'text', text: 'task note is required.' }], isError: true };
        const newFollowup = {
          id: uid(),
          date: dueDate || '',
          note: task.trim(),
          done: false,
          by: user.username,
          byName: user.name
        };
        member.followUps = member.followUps || [];
        member.followUps.push(newFollowup);
        await member.save();
        return { content: [{ type: 'text', text: `Added followup "${newFollowup.note}" (Due: ${newFollowup.date || 'No date'}) for ${member.name}.` }] };
      }

      if (action === 'toggle' || action === 'delete') {
        if (!followupId) return { content: [{ type: 'text', text: 'followupId is required.' }], isError: true };
        const idx = (member.followUps || []).findIndex(f => f.id === followupId);
        if (idx < 0) return { content: [{ type: 'text', text: `Followup ID "${followupId}" not found for ${member.name}.` }], isError: true };

        if (action === 'delete') {
          const removed = member.followUps.splice(idx, 1)[0];
          await member.save();
          return { content: [{ type: 'text', text: `Deleted followup "${removed.note}" for ${member.name}.` }] };
        }

        if (action === 'toggle') {
          member.followUps[idx].done = !member.followUps[idx].done;
          await member.save();
          return { content: [{ type: 'text', text: `Followup "${member.followUps[idx].note}" marked ${member.followUps[idx].done ? 'Completed' : 'Pending'}.` }] };
        }
      }

      return { content: [{ type: 'text', text: `Unknown action "${action}".` }], isError: true };
    }
  );

  server.tool(
    'crm_manage_session',
    'Manage member session notes and MoM history: list sessions, add a session note, update or delete a session note.',
    {
      action: z.enum(['list', 'add', 'update', 'delete']).describe('Action: "list", "add", "update", or "delete"'),
      memberIdentifier: z.string().describe('Member ID, Name, or Mobile'),
      sessionId: z.string().optional().describe('Session note ID for update or delete'),
      type: z.enum(['Session', 'MoM', 'Review', 'Call']).optional().describe('Session type'),
      date: z.string().optional().describe('Session date YYYY-MM-DD'),
      note: z.string().optional().describe('Detailed session note content / MoM')
    },
    async ({ action, memberIdentifier, sessionId, type = 'Session', date, note = '' }) => {
      const user = authManager.requireAuth();
      requireCrm(user);

      const member = await findMember(memberIdentifier);
      if (!member) {
        return { content: [{ type: 'text', text: `Member "${memberIdentifier}" not found.` }], isError: true };
      }

      if (action === 'list') {
        return { content: [{ type: 'text', text: JSON.stringify({ member: member.name, sessions: member.sessions || [] }, null, 2) }] };
      }

      if (action === 'add') {
        if (!note.trim()) return { content: [{ type: 'text', text: 'Session note content is required.' }], isError: true };
        const now = new Date();
        const dateStr = date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const newSession = {
          id: uid(),
          type: type || 'Session',
          date: dateStr,
          text: note.trim(),
          by: user.username,
          byName: user.name,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        member.sessions = member.sessions || [];
        member.sessions.unshift(newSession);
        member.sessionCount = member.sessions.length;
        member.lastSession = dateStr;
        await member.save();
        return { content: [{ type: 'text', text: `Added ${newSession.type} note for ${member.name} on ${newSession.date} (ID: ${newSession.id}).` }] };
      }

      if (action === 'update' || action === 'delete') {
        if (!sessionId) return { content: [{ type: 'text', text: 'sessionId is required.' }], isError: true };
        const idx = (member.sessions || []).findIndex(s => s.id === sessionId);
        if (idx < 0) return { content: [{ type: 'text', text: `Session ID "${sessionId}" not found.` }], isError: true };

        if (action === 'delete') {
          member.sessions.splice(idx, 1);
          member.sessionCount = member.sessions.length;
          member.lastSession = member.sessions.reduce((latest, s) => (s.date > latest ? s.date : latest), '');
          await member.save();
          return { content: [{ type: 'text', text: `Deleted session note for ${member.name}.` }] };
        }

        if (action === 'update') {
          if (type) member.sessions[idx].type = type;
          if (date) member.sessions[idx].date = date;
          if (note) member.sessions[idx].text = note.trim();
          member.sessions[idx].updatedAt = Date.now();
          member.lastSession = member.sessions.reduce((latest, s) => (s.date > latest ? s.date : latest), '');
          await member.save();
          return { content: [{ type: 'text', text: `Updated session note for ${member.name}.` }] };
        }
      }

      return { content: [{ type: 'text', text: `Unknown action "${action}".` }], isError: true };
    }
  );

  server.tool(
    'crm_list_expiring',
    'List all CRM members whose subscriptions/memberships expire within the next N days (default 30 days) for renewal outreach.',
    {
      days: z.number().optional().describe('Number of days to check ahead (default: 30)')
    },
    async ({ days = 30 }) => {
      const user = authManager.requireAuth();
      requireCrm(user);

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const targetDate = new Date(now.getTime() + days * 86400000);
      const targetStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      const members = await CrmMember.find({
        end: { $gte: todayStr, $lte: targetStr },
        plan: { $ne: 'Alumni' }
      }).sort({ end: 1 });

      const list = members.map(m => ({
        id: m.id,
        name: m.name,
        mobile: m.mobile,
        plan: m.plan,
        endDate: m.end,
        status: computeMemberStatus(m)
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ daysWindow: days, count: list.length, expiringMembers: list }, null, 2)
        }]
      };
    }
  );

  // ====================================================
  // GROUP 6: SHARES & ADMIN MANAGEMENT (2 tools)
  // ====================================================

  server.tool(
    'manage_share',
    'Create, inspect, or revoke shareable collaboration links for any list or note.',
    {
      action: z.enum(['create', 'get', 'revoke']).describe('Action: "create", "get", or "revoke"'),
      itemKind: z.enum(['list', 'note']).optional().describe('Item kind ("list" or "note") when action is "create"'),
      itemId: z.string().optional().describe('List or Note ID/Name when action is "create"'),
      mode: z.enum(['view', 'edit']).optional().describe('Share permission mode ("view" or "edit", default: "edit")'),
      sid: z.string().optional().describe('Share ID / link token when action is "get" or "revoke"')
    },
    async ({ action, itemKind, itemId, mode = 'edit', sid }) => {
      const user = authManager.requireAuth();

      if (action === 'create') {
        if (!itemKind || !itemId) {
          return { content: [{ type: 'text', text: 'itemKind and itemId are required for "create".' }], isError: true };
        }

        let item = null;
        let content = null;
        if (itemKind === 'list') {
          item = await findList(user._id, itemId);
          if (!item) return { content: [{ type: 'text', text: `List "${itemId}" not found.` }], isError: true };
          content = { name: item.name, todos: item.todos };
        } else {
          item = await findNote(user._id, itemId);
          if (!item) return { content: [{ type: 'text', text: `Note "${itemId}" not found.` }], isError: true };
          content = { title: item.title, html: item.html };
        }

        // Delete existing share if any
        await Share.findOneAndDelete({ ownerId: user._id, itemId: item.id });

        const newSid = uid();
        const share = await Share.create({
          sid: newSid,
          ownerId: user._id,
          ownerName: user.name || user.username,
          kind: itemKind,
          itemId: item.id,
          mode: mode || 'edit',
          content
        });

        // Update item with share sid
        item.shared = { sid: newSid, mode: share.mode, own: true, ownerName: user.name };
        await item.save();

        const shareLink = `https://mydeepwork.in/#s.${newSid}`;
        return {
          content: [{
            type: 'text',
            text: `Created ${share.mode} share link for ${itemKind} "${itemKind === 'list' ? item.name : item.title}":\nLink: ${shareLink}\nShare ID (sid): ${newSid}`
          }]
        };
      }

      if (action === 'get') {
        if (!sid) return { content: [{ type: 'text', text: 'sid is required for "get".' }], isError: true };
        const share = await Share.findOne({ sid });
        if (!share) return { content: [{ type: 'text', text: `Share "${sid}" not found or expired.` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(share, null, 2) }] };
      }

      if (action === 'revoke') {
        if (!sid) return { content: [{ type: 'text', text: 'sid is required for "revoke".' }], isError: true };
        const share = await Share.findOneAndDelete({ sid, ownerId: user._id });
        if (!share) return { content: [{ type: 'text', text: `Share "${sid}" not found or not owned by you.` }], isError: true };

        // Clean up item shared field
        if (share.kind === 'list') {
          await List.findOneAndUpdate({ userId: user._id, id: share.itemId }, { $unset: { shared: 1 } });
        } else {
          await Note.findOneAndUpdate({ userId: user._id, id: share.itemId }, { $unset: { shared: 1 } });
        }

        return { content: [{ type: 'text', text: `Revoked share "${sid}". The link is now inactive.` }] };
      }

      return { content: [{ type: 'text', text: `Unknown action "${action}".` }], isError: true };
    }
  );

  server.tool(
    'admin_manage_users',
    'Admin user administration: list registered users, create a new user, toggle user active status, rename a user, or toggle CRM access.',
    {
      action: z.enum(['list', 'create', 'toggle_status', 'rename', 'toggle_crm']).describe('Admin action'),
      targetUsername: z.string().optional().describe('Username of target user to manage'),
      newUsername: z.string().optional().describe('New username/name for create or rename'),
      password: z.string().optional().describe('Password or PIN when creating a user'),
      role: z.enum(['admin', 'member']).optional().describe('Role when creating user (default: "member")'),
      crmAccess: z.boolean().optional().describe('Grant or revoke CRM access')
    },
    async ({ action, targetUsername, newUsername, password, role = 'member', crmAccess }) => {
      const user = authManager.requireAuth();
      if (user.role !== 'admin') {
        throw new Error('Access denied: Admin role required for user administration.');
      }

      if (action === 'list') {
        const users = await User.find({}, 'username name status role crm createdAt').sort({ createdAt: -1 });
        return { content: [{ type: 'text', text: JSON.stringify({ count: users.length, users }, null, 2) }] };
      }

      if (action === 'create') {
        const u = (newUsername || '').trim().toLowerCase();
        if (!u || !password) return { content: [{ type: 'text', text: 'newUsername and password are required.' }], isError: true };

        const existing = await User.findOne({ username: u });
        if (existing) return { content: [{ type: 'text', text: `User "${u}" already exists.` }], isError: true };

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password.trim(), salt);
        const newUser = await User.create({
          username: u,
          name: newUsername.trim(),
          passwordHash,
          role: role || 'member',
          status: 'active',
          crm: !!crmAccess
        });

        return { content: [{ type: 'text', text: `Created user @${newUser.username} (${newUser.name}, Role: ${newUser.role}, CRM: ${newUser.crm}).` }] };
      }

      if (!targetUsername) {
        return { content: [{ type: 'text', text: 'targetUsername is required.' }], isError: true };
      }

      const target = await User.findOne({ username: targetUsername.trim().toLowerCase() });
      if (!target) return { content: [{ type: 'text', text: `User "${targetUsername}" not found.` }], isError: true };

      if (action === 'toggle_status') {
        target.status = target.status === 'active' ? 'inactive' : 'active';
        await target.save();
        return { content: [{ type: 'text', text: `User @${target.username} is now ${target.status}.` }] };
      }

      if (action === 'rename') {
        if (!newUsername || !newUsername.trim()) return { content: [{ type: 'text', text: 'newUsername is required.' }], isError: true };
        const oldName = target.name;
        target.name = newUsername.trim();
        await target.save();
        return { content: [{ type: 'text', text: `Renamed user from "${oldName}" to "${target.name}".` }] };
      }

      if (action === 'toggle_crm') {
        target.crm = crmAccess !== undefined ? !!crmAccess : !target.crm;
        await target.save();
        return { content: [{ type: 'text', text: `CRM access for @${target.username} is now ${target.crm ? 'Enabled' : 'Disabled'}.` }] };
      }

      return { content: [{ type: 'text', text: `Unknown action "${action}".` }], isError: true };
    }
  );

  /* ---------------- BACKUP & AUDIT LOG TOOLS ---------------- */

  server.tool(
    'get_backups',
    'List all available database snapshots (max 5 capacity) and current auto-backup schedule config.',
    {},
    async () => {
      const user = authManager.requireAuth();
      if (user.role !== 'admin') {
        return { content: [{ type: 'text', text: 'Admin privileges required to view backups.' }], isError: true };
      }

      const backups = await getBackups();
      const config = await getBackupConfig();

      const summary = {
        config,
        totalBackups: backups.length,
        capacity: 5,
        backups: backups.map(b => ({
          id: b.id,
          type: b.type,
          label: b.label,
          sizeKb: (b.size / 1024).toFixed(1),
          counts: b.counts,
          createdAt: b.createdAt
        }))
      };

      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    'create_backup',
    'Create an immediate full workspace backup (lists, notes, CRM records, users). Maximum 5 backups stored; oldest is pruned if limit reached.',
    {
      label: z.string().optional().describe('Optional descriptive label for the backup')
    },
    async ({ label = '' }) => {
      const user = authManager.requireAuth();
      if (user.role !== 'admin') {
        return { content: [{ type: 'text', text: 'Admin privileges required to create backups.' }], isError: true };
      }

      const bkp = await createBackup({
        type: 'manual',
        createdBy: user.username,
        createdByName: user.name,
        label
      });

      return { content: [{ type: 'text', text: `Successfully created backup "${bkp.label}" (${bkp.id}, ${(bkp.size / 1024).toFixed(1)} KB, Lists: ${bkp.counts.lists}, Notes: ${bkp.counts.notes}, CRM: ${bkp.counts.crmMembers}).` }] };
    }
  );

  server.tool(
    'get_activity_logs',
    'Retrieve recent activity audit logs (max 200 capacity) with optional category and search filters.',
    {
      category: z.enum(['all', 'lists', 'notes', 'crm', 'backup', 'admin']).optional().describe('Filter by category'),
      search: z.string().optional().describe('Search keyword in actor or details'),
      limit: z.number().optional().describe('Max logs to return (default 50, max 200)')
    },
    async ({ category = 'all', search = '', limit = 50 }) => {
      const user = authManager.requireAuth();
      if (user.role !== 'admin') {
        return { content: [{ type: 'text', text: 'Admin privileges required to view activity logs.' }], isError: true };
      }

      const logs = await getLogs({ category, search, limit });
      const formatted = logs.map(l => ({
        id: l.id,
        category: l.category,
        action: l.action,
        actor: l.actorName || l.actorUsername,
        details: l.details,
        canUndo: l.canUndo,
        isUndone: l.isUndone,
        createdAt: l.createdAt
      }));

      return { content: [{ type: 'text', text: JSON.stringify({ count: formatted.length, maxCapacity: 200, logs: formatted }, null, 2) }] };
    }
  );

  server.tool(
    'undo_activity_log',
    'Undo a past action from the activity logs by its log ID (e.g. restore a deleted list/note/member or remove a created item).',
    {
      logId: z.string().describe('The log ID to undo (e.g. log_...)')
    },
    async ({ logId }) => {
      const user = authManager.requireAuth();
      if (user.role !== 'admin') {
        return { content: [{ type: 'text', text: 'Admin privileges required to undo actions.' }], isError: true };
      }

      try {
        const result = await undoLogEntry(logId, user);
        return { content: [{ type: 'text', text: `Successfully reverted action: "${result.details}".` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Failed to undo: ${err.message}` }], isError: true };
      }
    }
  );
}
