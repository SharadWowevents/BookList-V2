import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { User } from '../models/User.js';

export const getBoard = async (req, res) => {
  try {
    const userId = req.user._id;

    let lists = await List.find({ userId }).sort({ order: 1, createdAt: 1 });
    const notes = await Note.find({ userId }).sort({ order: 1, createdAt: -1 });

    const user = await User.findById(userId);

    res.json({
      lists: lists.map(l => ({
        id: l.id,
        name: l.name,
        starred: l.starred,
        todos: l.todos
      })),
      notes: notes.map(n => ({
        id: n.id,
        title: n.title,
        starred: n.starred
      })),
      activeId: user.activeId || (lists[0] ? lists[0].id : null),
      activeNoteId: user.activeNoteId || (notes[0] ? notes[0].id : null),
      tab: user.tab || 'lists',
      prefs: user.prefs
    });
  } catch (err) {
    console.error('getBoard error:', err);
    res.status(500).json({ message: 'Error loading board.' });
  }
};

export const syncBoard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lists, notes, activeId, activeNoteId, tab } = req.body;

    // Sync lists
    if (Array.isArray(lists)) {
      for (let i = 0; i < lists.length; i++) {
        const item = lists[i];
        await List.findOneAndUpdate(
          { userId, id: item.id },
          {
            userId,
            id: item.id,
            name: item.name || 'Untitled list',
            starred: !!item.starred,
            order: i,
            todos: item.todos || []
          },
          { upsert: true, new: true }
        );
      }
      // Remove any list not in incoming list array
      const currentIds = lists.map(l => l.id);
      await List.deleteMany({ userId, id: { $nin: currentIds } });
    }

    // Sync notes order / metadata
    if (Array.isArray(notes)) {
      for (let i = 0; i < notes.length; i++) {
        const item = notes[i];
        await Note.findOneAndUpdate(
          { userId, id: item.id },
          {
            $set: {
              title: item.title || '',
              starred: !!item.starred,
              order: i
            }
          },
          { upsert: true }
        );
      }
      const currentNoteIds = notes.map(n => n.id);
      await Note.deleteMany({ userId, id: { $nin: currentNoteIds } });
    }

    // Update user active state
    await User.findByIdAndUpdate(userId, {
      ...(activeId !== undefined && { activeId }),
      ...(activeNoteId !== undefined && { activeNoteId }),
      ...(tab && { tab })
    });

    res.json({ success: true, updatedAt: Date.now() });
  } catch (err) {
    console.error('syncBoard error:', err);
    res.status(500).json({ message: 'Error syncing board data.' });
  }
};

export const createList = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id, name, starred = false, todos = [] } = req.body;

    const count = await List.countDocuments({ userId });
    const newList = await List.create({
      userId,
      id,
      name: name.trim() || 'Untitled list',
      starred,
      order: count,
      todos
    });

    res.status(201).json({
      id: newList.id,
      name: newList.name,
      starred: newList.starred,
      todos: newList.todos
    });
  } catch (err) {
    console.error('createList error:', err);
    res.status(500).json({ message: 'Error creating list.' });
  }
};

export const updateList = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { name, starred, todos } = req.body;

    const list = await List.findOne({ userId, id });
    if (!list) return res.status(404).json({ message: 'List not found.' });

    if (name !== undefined) list.name = name.trim();
    if (starred !== undefined) list.starred = starred;
    if (Array.isArray(todos)) list.todos = todos;

    await list.save();

    res.json({
      id: list.id,
      name: list.name,
      starred: list.starred,
      todos: list.todos
    });
  } catch (err) {
    console.error('updateList error:', err);
    res.status(500).json({ message: 'Error updating list.' });
  }
};

export const deleteList = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const result = await List.findOneAndDelete({ userId, id });
    if (!result) return res.status(404).json({ message: 'List not found.' });

    res.json({ message: 'List deleted successfully.' });
  } catch (err) {
    console.error('deleteList error:', err);
    res.status(500).json({ message: 'Error deleting list.' });
  }
};

