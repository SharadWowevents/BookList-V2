import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { User } from '../models/User.js';
import { Share } from '../models/Share.js';
import { syncShareAcrossAllUsers } from '../utils/shareSync.js';

export const getBoard = async (req, res) => {
  try {
    const userId = req.user._id;

    let lists = await List.find({ userId }).sort({ order: 1, createdAt: 1 });
    let notes = await Note.find({ userId }).sort({ order: 1, createdAt: -1 });

    const user = await User.findById(userId);

    // Fetch freshest shared content for any shared lists or notes
    const shareSids = [
      ...lists.map(l => l.shared?.sid).filter(Boolean),
      ...notes.map(n => n.shared?.sid).filter(Boolean)
    ];

    if (shareSids.length > 0) {
      const shares = await Share.find({ sid: { $in: shareSids } });
      const shareMap = new Map(shares.map(s => [s.sid, s]));

      lists = lists.map(l => {
        const sid = l.shared?.sid;
        if (sid && shareMap.has(sid)) {
          const sh = shareMap.get(sid);
          return {
            id: l.id,
            name: sh.content?.name ?? l.name,
            starred: l.starred,
            todos: sh.content?.todos ?? l.todos,
            shared: {
              ...(l.shared || {}),
              mode: sh.mode,
              ownerName: sh.ownerName
            }
          };
        }
        return {
          id: l.id,
          name: l.name,
          starred: l.starred,
          todos: l.todos,
          shared: l.shared || null
        };
      });

      notes = notes.map(n => {
        const sid = n.shared?.sid;
        if (sid && shareMap.has(sid)) {
          const sh = shareMap.get(sid);
          return {
            id: n.id,
            title: sh.content?.title ?? n.title,
            starred: n.starred,
            shared: {
              ...(n.shared || {}),
              mode: sh.mode,
              ownerName: sh.ownerName
            }
          };
        }
        return {
          id: n.id,
          title: n.title,
          starred: n.starred,
          shared: n.shared || null
        };
      });
    } else {
      lists = lists.map(l => ({
        id: l.id,
        name: l.name,
        starred: l.starred,
        todos: l.todos,
        shared: l.shared || null
      }));
      notes = notes.map(n => ({
        id: n.id,
        title: n.title,
        starred: n.starred,
        shared: n.shared || null
      }));
    }

    res.json({
      lists,
      notes,
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
            todos: item.todos || [],
            shared: item.shared || null
          },
          { upsert: true, new: true }
        );

        // If this list is shared, propagate changes to Share and all collaborators
        if (item.shared?.sid) {
          syncShareAcrossAllUsers({
            sid: item.shared.sid,
            kind: 'list',
            content: { name: item.name, todos: item.todos },
            updatedBy: req.user?.name || 'Someone'
          }).catch(() => {});
        }
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
              order: i,
              shared: item.shared || null
            }
          },
          { upsert: true }
        );

        // If this note is shared, propagate title change
        if (item.shared?.sid && item.title) {
          syncShareAcrossAllUsers({
            sid: item.shared.sid,
            kind: 'note',
            content: { title: item.title },
            updatedBy: req.user?.name || 'Someone'
          }).catch(() => {});
        }
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

