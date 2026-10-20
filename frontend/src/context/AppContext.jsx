import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ACCENTS, starterBoard } from '../utils/constants';
import { authAPI, boardAPI, notesAPI, sharesAPI, setToken, getToken } from '../services/api';

const normalizeBoard = (b) => {
  if (!b) return starterBoard();
  const res = { ...b };
  if (!Array.isArray(res.lists)) res.lists = [];
  if (!Array.isArray(res.notes)) res.notes = [];
  res.lists = res.lists.filter(l => l && l.id && Array.isArray(l.todos));
  res.notes = res.notes.filter(n => n && n.id);
  if (res.tab !== "notes") res.tab = "lists";
  if (!res.lists.find(l => l.id === res.activeId)) res.activeId = res.lists[0] ? res.lists[0].id : null;
  if (!res.notes.find(n => n.id === res.activeNoteId)) res.activeNoteId = res.notes[0] ? res.notes[0].id : null;
  return res;
};

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [session, setSessionState] = useState(() => {
    try {
      const saved = localStorage.getItem('listbook:session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [accent, setAccentState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('listbook:accent')) || 'green';
    } catch {
      return 'green';
    }
  });

  const [theme, setThemeState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('listbook:theme')) || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [collapsed, setCollapsedState] = useState(() => {
    try {
      return !!JSON.parse(localStorage.getItem('listbook:collapsed'));
    } catch {
      return false;
    }
  });

  const [board, setBoardState] = useState(() => {
    if (!session) return starterBoard();
    try {
      const key = `listbook:board:${session.username || session.key || 'default'}`;
      const saved = localStorage.getItem(key);
      return saved ? normalizeBoard(JSON.parse(saved)) : starterBoard();
    } catch {
      return starterBoard();
    }
  });

  const [ui, setUi] = useState(() => ({
    viewing: false,
    adding: false,
    showDone: true,
    confirm: false,
    menu: false,
    sharing: false,
    publishing: false,
    admin: false,
    collapsed
  }));

  const [pendingShareSid, setPendingShareSid] = useState(() => {
    try {
      const hash = window.location.hash || '';
      const m = /^#s\.(?:([A-Za-z0-9_-]+)\.)?([a-z0-9]+)$/i.exec(hash);
      if (m && m[2] && m[2] !== 'local') {
        sessionStorage.setItem('listbook:pending_share', m[2]);
        return m[2];
      }
      return sessionStorage.getItem('listbook:pending_share') || null;
    } catch {
      return null;
    }
  });

  const setCollapsed = useCallback((val) => {
    setCollapsedState(val);
    setUi(prev => ({ ...prev, collapsed: val }));
    try { localStorage.setItem('listbook:collapsed', JSON.stringify(val)); } catch {}
  }, []);

  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', undoFn: null });
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, ms = 3200) => {
    clearTimeout(toastTimerRef.current);
    setToast({ visible: true, message: msg, undoFn: null });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, ms);
  }, []);

  const showUndoToast = useCallback((msg, undoFn, ms = 5000) => {
    clearTimeout(toastTimerRef.current);
    setToast({ visible: true, message: msg, undoFn });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false, undoFn: null }));
    }, ms);
  }, []);

  const triggerUndo = useCallback(() => {
    if (toast.undoFn) {
      toast.undoFn();
      setToast({ visible: false, message: '', undoFn: null });
    }
  }, [toast]);

  // Accent & theme effects
  useEffect(() => {
    const validAccent = ACCENTS[accent] ? accent : 'green';
    document.documentElement.setAttribute('data-accent', validAccent);
    try { localStorage.setItem('listbook:accent', JSON.stringify(validAccent)); } catch {}
  }, [accent]);

  useEffect(() => {
    const r = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      r.setAttribute('data-theme', theme);
    } else {
      r.removeAttribute('data-theme');
    }
    try { localStorage.setItem('listbook:theme', JSON.stringify(theme)); } catch {}
  }, [theme]);

  // Profile photo state
  const [photo, setPhotoState] = useState(() => {
    if (!session) return null;
    try {
      return session.photo || localStorage.getItem(`listbook:photo:${session.username || session.key}`) || null;
    } catch {
      return null;
    }
  });

  const savePhoto = useCallback(async (url) => {
    if (!session) return;
    try {
      const key = session.username || session.key;
      if (url) {
        localStorage.setItem(`listbook:photo:${key}`, url);
        setPhotoState(url);
      } else {
        localStorage.removeItem(`listbook:photo:${key}`);
        setPhotoState(null);
      }

      // Sync with MongoDB backend
      if (getToken()) {
        await authAPI.updateProfile({ photo: url });
      }
    } catch {}
  }, [session]);

  const removePhoto = useCallback(() => {
    savePhoto(null);
  }, [savePhoto]);

  // Notes cache management
  const noteCacheRef = useRef({});
  const getNoteKey = useCallback((noteId) => {
    return session ? `listbook:note:${session.username || session.key}:${noteId}` : `listbook:note:anon:${noteId}`;
  }, [session]);

  const loadNoteBody = useCallback((noteId) => {
    if (!noteId) return { html: '', updatedAt: 0 };
    if (noteCacheRef.current[noteId]) return noteCacheRef.current[noteId];
    try {
      const saved = localStorage.getItem(getNoteKey(noteId));
      if (saved) {
        const parsed = JSON.parse(saved);
        noteCacheRef.current[noteId] = parsed;
        return parsed;
      }
    } catch {}

    const init = { html: '', updatedAt: 0 };
    noteCacheRef.current[noteId] = init;

    // Background fetch from MongoDB if authenticated
    if (getToken()) {
      notesAPI.getNote(noteId).then(remoteNote => {
        if (remoteNote && remoteNote.html) {
          const rec = { html: remoteNote.html, updatedAt: new Date(remoteNote.updatedAt).getTime() };
          noteCacheRef.current[noteId] = rec;
          try { localStorage.setItem(getNoteKey(noteId), JSON.stringify(rec)); } catch {}
        }
      }).catch(() => {});
    }

    return init;
  }, [getNoteKey]);

  // Debounce ref for note syncing
  const noteSaveTimers = useRef({});

  const saveNoteBody = useCallback((noteId, html) => {
    if (!noteId) return;
    const rec = { html, updatedAt: Date.now() };
    noteCacheRef.current[noteId] = rec;
    try {
      localStorage.setItem(getNoteKey(noteId), JSON.stringify(rec));
    } catch {}

    // Check if this note is shared and sync to share endpoint if permitted
    const note = board.notes.find(n => n.id === noteId);
    if (note?.shared?.sid && (note.shared.own || note.shared.mode === 'edit')) {
      sharesAPI.updateShare(note.shared.sid, {
        content: { title: note.title, html }
      }).catch(() => {});
    }

    // Debounced sync with MongoDB
    if (getToken()) {
      clearTimeout(noteSaveTimers.current[noteId]);
      noteSaveTimers.current[noteId] = setTimeout(() => {
        notesAPI.updateNote(noteId, { html }).catch(() => {});
      }, 600);
    }
  }, [getNoteKey, board.notes]);

  const deleteNoteBody = useCallback((noteId) => {
    delete noteCacheRef.current[noteId];
    try {
      localStorage.removeItem(getNoteKey(noteId));
    } catch {}

    if (getToken()) {
      notesAPI.deleteNote(noteId).catch(() => {});
    }
  }, [getNoteKey]);

  // Debounced board sync
  const boardSyncTimer = useRef(null);

  const updateBoard = useCallback((updates) => {
    setBoardState(prev => {
      const next = normalizeBoard({ ...prev, ...updates, updatedAt: Date.now() });
      if (session) {
        const key = `listbook:board:${session.username || session.key || 'default'}`;
        try { localStorage.setItem(key, JSON.stringify(next)); } catch {}

        // Sync with MongoDB
        if (getToken()) {
          clearTimeout(boardSyncTimer.current);
          boardSyncTimer.current = setTimeout(() => {
            boardAPI.syncBoard({
              lists: next.lists,
              notes: next.notes,
              activeId: next.activeId,
              activeNoteId: next.activeNoteId,
              tab: next.tab
            }).catch(() => {});
          }, 500);
        }
      }
      return next;
    });
  }, [session]);

  const ingestShare = useCallback(async (sid, targetSession = session, baseBoard = null) => {
    if (!sid || sid === 'local') return;
    try {
      const share = await sharesAPI.getShare(sid);
      if (!share) return;

      // Clear pending storage & hash
      try { sessionStorage.removeItem('listbook:pending_share'); } catch {}
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {
        try { window.location.hash = ''; } catch {}
      }
      setPendingShareSid(null);

      const isOwn = !!share.own;
      const canEdit = isOwn || share.mode === 'edit';
      const sess = targetSession || session;

      setBoardState(prev => {
        const current = baseBoard || prev;

        if (share.kind === 'note') {
          const existing = current.notes.find(n => n.shared?.sid === sid || n.id === share.itemId);
          const noteId = existing ? existing.id : (share.itemId || ('shared_' + sid));
          const noteItem = {
            id: noteId,
            title: share.content?.title || 'Shared note',
            starred: existing ? existing.starred : false,
            shared: {
              sid,
              mode: share.mode,
              own: isOwn,
              ownerName: share.ownerName
            },
            canEdit
          };

          // Save note body to cache and localStorage
          if (share.content?.html !== undefined) {
            const rec = { html: share.content.html, updatedAt: Date.now() };
            noteCacheRef.current[noteId] = rec;
            const key = sess ? `listbook:note:${sess.username || sess.key || sess.id}:${noteId}` : `listbook:note:anon:${noteId}`;
            try { localStorage.setItem(key, JSON.stringify(rec)); } catch {}
          }

          const updatedNotes = existing
            ? current.notes.map(n => n.id === noteId ? noteItem : n)
            : [noteItem, ...current.notes];

          const nextBoard = {
            ...current,
            tab: 'notes',
            activeNoteId: noteId,
            notes: updatedNotes
          };

          if (sess) {
            const key = `listbook:board:${sess.username || sess.key || sess.id || 'default'}`;
            try { localStorage.setItem(key, JSON.stringify(nextBoard)); } catch {}

            if (getToken()) {
              boardAPI.syncBoard({
                lists: nextBoard.lists,
                notes: nextBoard.notes,
                activeId: nextBoard.activeId,
                activeNoteId: nextBoard.activeNoteId,
                tab: nextBoard.tab
              }).catch(() => {});
            }
          }

          return nextBoard;
        } else {
          // List
          const existing = current.lists.find(l => l.shared?.sid === sid || l.id === share.itemId);
          const listId = existing ? existing.id : (share.itemId || ('shared_' + sid));
          const listItem = {
            id: listId,
            name: share.content?.name || 'Shared list',
            todos: Array.isArray(share.content?.todos) ? share.content.todos : [],
            starred: existing ? existing.starred : false,
            shared: {
              sid,
              mode: share.mode,
              own: isOwn,
              ownerName: share.ownerName
            },
            canEdit
          };

          const updatedLists = existing
            ? current.lists.map(l => l.id === listId ? listItem : l)
            : [listItem, ...current.lists];

          const nextBoard = {
            ...current,
            tab: 'lists',
            activeId: listId,
            lists: updatedLists
          };

          if (sess) {
            const key = `listbook:board:${sess.username || sess.key || sess.id || 'default'}`;
            try { localStorage.setItem(key, JSON.stringify(nextBoard)); } catch {}

            if (getToken()) {
              boardAPI.syncBoard({
                lists: nextBoard.lists,
                notes: nextBoard.notes,
                activeId: nextBoard.activeId,
                activeNoteId: nextBoard.activeNoteId,
                tab: nextBoard.tab
              }).catch(() => {});
            }
          }

          return nextBoard;
        }
      });

      setUi(prev => ({ ...prev, viewing: true, admin: false }));
      showToast(`Added to your ${share.kind === 'note' ? 'notes' : 'lists'}. ${canEdit ? 'You can edit it.' : 'You can view it.'}`);
    } catch (err) {
      console.error('Failed to ingest share:', err);
      try { sessionStorage.removeItem('listbook:pending_share'); } catch {}
      showToast('This shared item no longer exists or the link has expired.', 4500);
    }
  }, [session, showToast]);

  // Initialize and verify backend session on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      authAPI.getMe().then(res => {
        if (res.user) {
          setSessionState(res.user);
          if (res.user.photo) setPhotoState(res.user.photo);
          if (res.user.prefs?.accent) setAccentState(res.user.prefs.accent);
          if (res.user.prefs?.theme) setThemeState(res.user.prefs.theme);

          // Fetch board from MongoDB
          boardAPI.getBoard().then(remoteBoard => {
            let normalized = starterBoard();
            if (remoteBoard && Array.isArray(remoteBoard.lists)) {
              normalized = normalizeBoard(remoteBoard);
              setBoardState(normalized);
              const key = `listbook:board:${res.user.username || res.user.id}`;
              try { localStorage.setItem(key, JSON.stringify(normalized)); } catch {}
            }

            // Check if there is a pending share waiting
            const pending = sessionStorage.getItem('listbook:pending_share');
            if (pending) {
              ingestShare(pending, res.user, normalized);
            }
          }).catch(() => {
            const pending = sessionStorage.getItem('listbook:pending_share');
            if (pending) {
              ingestShare(pending, res.user);
            }
          });
        }
      }).catch(err => {
        if (err.status === 401 || err.status === 403) {
          setToken(null);
          setSessionState(null);
        }
      });
    }
  }, [ingestShare]);

  // Handle share links in URL hash: #s.<sid> or #s.<owner>.<sid>
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      const m = /^#s\.(?:([A-Za-z0-9_-]+)\.)?([a-z0-9]+)$/i.exec(hash);
      if (!m) return;
      const sid = m[2];
      if (!sid || sid === 'local') return;

      if (!session) {
        // User not logged in: stash pending share for login screen
        try { sessionStorage.setItem('listbook:pending_share', sid); } catch {}
        setPendingShareSid(sid);
      } else {
        // User is logged in: ingest immediately
        ingestShare(sid);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [session, ingestShare]);

  const setSession = useCallback((sess) => {
    setSessionState(sess);
    if (sess) {
      try {
        localStorage.setItem('listbook:session', JSON.stringify(sess));
        const key = `listbook:board:${sess.username || sess.key || sess.id || 'default'}`;
        const saved = localStorage.getItem(key);
        let b = saved ? normalizeBoard(JSON.parse(saved)) : starterBoard();
        setBoardState(b);
        localStorage.setItem(key, JSON.stringify(b));
        if (sess.photo) setPhotoState(sess.photo);

        // Fetch user board from backend and process any pending share
        if (getToken()) {
          boardAPI.getBoard().then(remoteBoard => {
            let activeBoard = b;
            if (remoteBoard && Array.isArray(remoteBoard.lists)) {
              activeBoard = normalizeBoard(remoteBoard);
              setBoardState(activeBoard);
              try { localStorage.setItem(key, JSON.stringify(activeBoard)); } catch {}
            }

            const pending = sessionStorage.getItem('listbook:pending_share');
            if (pending) {
              ingestShare(pending, sess, activeBoard);
            }
          }).catch(() => {
            const pending = sessionStorage.getItem('listbook:pending_share');
            if (pending) {
              ingestShare(pending, sess, b);
            }
          });
        } else {
          const pending = sessionStorage.getItem('listbook:pending_share');
          if (pending) {
            ingestShare(pending, sess, b);
          }
        }
      } catch {}
    } else {
      setToken(null);
      try { localStorage.removeItem('listbook:session'); } catch {}
      setPhotoState(null);
    }
  }, [ingestShare]);

  const signOut = useCallback((msg) => {
    setToken(null);
    setSessionState(null);
    try { localStorage.removeItem('listbook:session'); } catch {}
    setUi({
      viewing: false,
      adding: false,
      showDone: true,
      confirm: false,
      menu: false,
      sharing: false,
      publishing: false,
      admin: false,
      collapsed: false
    });
    setPhotoState(null);
    noteCacheRef.current = {};
    if (msg) showToast(msg);
  }, [showToast]);

  return (
    <AppContext.Provider value={{
      session,
      setSession,
      signOut,
      board,
      updateBoard,
      ui,
      setUi,
      accent,
      setAccent: setAccentState,
      theme,
      setTheme: setThemeState,
      collapsed,
      setCollapsed,
      photo,
      savePhoto,
      removePhoto,
      toast,
      showToast,
      showUndoToast,
      triggerUndo,
      loadNoteBody,
      saveNoteBody,
      deleteNoteBody,
      pendingShareSid,
      ingestShare
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
