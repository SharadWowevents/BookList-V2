import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ACCENTS, starterBoard, PLANS, ymd, today0, uid } from '../utils/constants';
import { authAPI, boardAPI, notesAPI, sharesAPI, crmAPI, setToken, getToken } from '../services/api';

const normalizeBoard = (b) => {
  if (!b) return starterBoard();
  const res = { ...b };
  if (!Array.isArray(res.lists)) res.lists = [];
  if (!Array.isArray(res.notes)) res.notes = [];
  res.lists = res.lists.filter(l => l && l.id && Array.isArray(l.todos));
  res.notes = res.notes.filter(n => n && n.id);
  if (res.tab === 'note' || res.tab === 'notes') {
    res.tab = 'notes';
  } else if (res.tab === 'crm') {
    res.tab = 'crm';
  } else {
    res.tab = 'lists';
  }
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
      const val = localStorage.getItem('listbook:accent');
      if (val) {
        try {
          const parsed = JSON.parse(val);
          return ACCENTS[parsed] ? parsed : 'green';
        } catch {
          return ACCENTS[val] ? val : 'green';
        }
      }
      return 'green';
    } catch {
      return 'green';
    }
  });

  const [theme, setThemeState] = useState(() => {
    try {
      const val = localStorage.getItem('listbook:theme');
      if (val) {
        try {
          const parsed = JSON.parse(val);
          return (parsed === 'light' || parsed === 'dark') ? parsed : 'auto';
        } catch {
          return (val === 'light' || val === 'dark') ? val : 'auto';
        }
      }
      return 'auto';
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
      if (!hash || hash.startsWith('#s.local.')) return null;
      const m = /^#s\.(?:([A-Za-z0-9_-]+)\.)?([a-z0-9]+)$/i.exec(hash);
      if (m && m[1] !== 'local' && m[2] && m[2] !== 'local') {
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

  // ----------------------------------------------------
  // CRM STATE & ACTIONS
  // ----------------------------------------------------
  const [crmMembers, setCrmMembers] = useState([]);
  const [crmLoaded, setCrmLoaded] = useState(false);
  const [crmErr, setCrmErr] = useState('');
  const [crmView, setCrmViewState] = useState(() => {
    try {
      return localStorage.getItem('listbook:crmView') || 'kanban';
    } catch {
      return 'kanban';
    }
  });
  const setCrmView = (v) => {
    setCrmViewState(v);
    try { localStorage.setItem('listbook:crmView', v); } catch {}
  };
  const [crmFilter, setCrmFilter] = useState({ kind: 'all' });
  const [crmSearch, setCrmSearch] = useState('');
  const [crmModal, setCrmModal] = useState(null);

  const isCrmAllowed = Boolean(session && (session.role === 'admin' || session.crm));

  const loadCrmMembers = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await crmAPI.getMembers();
      setCrmMembers(res.members || []);
      setCrmLoaded(true);
      setCrmErr('');
    } catch (err) {
      console.error('loadCrmMembers error:', err);
      if (err.status === 403) {
        setCrmMembers([]);
        setCrmErr("You don't have access to the CRM.");
      } else {
        setCrmErr("Couldn't load members. Check connection.");
      }
      setCrmLoaded(true);
    }
  }, []);

  const saveCrmMember = useCallback(async (memberData) => {
    try {
      let res;
      if (memberData.id && crmMembers.some(m => m.id === memberData.id)) {
        res = await crmAPI.updateMember(memberData.id, memberData);
      } else {
        res = await crmAPI.createMember(memberData);
      }
      const saved = res.member;
      setCrmMembers(prev => {
        const idx = prev.findIndex(m => m.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      return saved;
    } catch (err) {
      console.error('saveCrmMember error:', err);
      showToast(err.message || "Couldn't save member.");
      return null;
    }
  }, [crmMembers, showToast]);

  const deleteCrmMember = useCallback(async (memberId) => {
    try {
      await crmAPI.deleteMember(memberId);
      setCrmMembers(prev => prev.filter(m => m.id !== memberId));
      return true;
    } catch (err) {
      console.error('deleteCrmMember error:', err);
      showToast(err.message || "Couldn't delete member.");
      return false;
    }
  }, [showToast]);

  const openCrmModal = useCallback((id = null, plan = null, tab = 'details') => {
    const m = id ? crmMembers.find(x => x.id === id) : null;
    const initialPlan = plan || (crmFilter.kind === 'plan' ? crmFilter.plan : PLANS[0]);
    const draft = m
      ? JSON.parse(JSON.stringify(m))
      : {
          id: uid(),
          name: '',
          mobile: '',
          plan: initialPlan,
          start: ymd(today0()),
          end: '',
          comment: '',
          photo: '',
          followUps: []
        };

    setCrmModal({
      id: m ? m.id : null,
      draft,
      tab: tab || 'details',
      sessions: m?.sessions || [],
      sessLoaded: !m,
      editing: null,
      confirmSess: null,
      confirmDel: false
    });

    if (m) {
      crmAPI.getSessions(m.id).then(res => {
        setCrmModal(cur => cur && cur.id === m.id ? { ...cur, sessions: res.sessions || [], sessLoaded: true } : cur);
      }).catch(() => {
        setCrmModal(cur => cur && cur.id === m.id ? { ...cur, sessLoaded: true } : cur);
      });
    }
  }, [crmMembers, crmFilter]);

  const closeCrmModal = useCallback(() => {
    setCrmModal(null);
  }, []);

  const saveCrmSession = useCallback(async (memberId, sessData) => {
    try {
      let res;
      if (sessData.id && crmModal?.sessions?.some(s => s.id === sessData.id)) {
        res = await crmAPI.updateSession(memberId, sessData.id, sessData);
      } else {
        res = await crmAPI.addSession(memberId, sessData);
      }
      if (res && res.member) {
        setCrmMembers(prev => prev.map(m => m.id === memberId ? res.member : m));
        setCrmModal(cur => {
          if (!cur || cur.id !== memberId) return cur;
          const nextSessions = (res.member.sessions || []).slice().sort((a, b) => {
            const dc = (b.date || '').localeCompare(a.date || '');
            if (dc !== 0) return dc;
            return (b.createdAt || 0) - (a.createdAt || 0);
          });
          return { ...cur, sessions: nextSessions, editing: null };
        });
      }
      return true;
    } catch (err) {
      console.error('saveCrmSession error:', err);
      showToast(err.message || "Couldn't save session note.");
      return false;
    }
  }, [crmModal, showToast]);

  const deleteCrmSession = useCallback(async (memberId, sessionId) => {
    try {
      const res = await crmAPI.deleteSession(memberId, sessionId);
      if (res && res.member) {
        setCrmMembers(prev => prev.map(m => m.id === memberId ? res.member : m));
        setCrmModal(cur => {
          if (!cur || cur.id !== memberId) return cur;
          const nextSessions = (res.member.sessions || []).slice().sort((a, b) => {
            const dc = (b.date || '').localeCompare(a.date || '');
            if (dc !== 0) return dc;
            return (b.createdAt || 0) - (a.createdAt || 0);
          });
          return { ...cur, sessions: nextSessions, confirmSess: null };
        });
      }
      return true;
    } catch (err) {
      console.error('deleteCrmSession error:', err);
      showToast(err.message || "Couldn't delete session note.");
      return false;
    }
  }, [showToast]);

  useEffect(() => {
    if (isCrmAllowed) {
      loadCrmMembers();
      const interval = setInterval(loadCrmMembers, 15000);
      return () => clearInterval(interval);
    } else {
      setCrmMembers([]);
      setCrmLoaded(false);
    }
  }, [isCrmAllowed, loadCrmMembers]);

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

  const setAccent = useCallback((val) => {
    const a = ACCENTS[val] ? val : 'green';
    setAccentState(a);
    try { localStorage.setItem('listbook:accent', JSON.stringify(a)); } catch {}
    document.documentElement.setAttribute('data-accent', a);
    if (getToken()) {
      authAPI.updateProfile({ prefs: { accent: a } }).catch(() => {});
    }
  }, []);

  const setTheme = useCallback((val) => {
    const t = (val === 'light' || val === 'dark') ? val : 'auto';
    setThemeState(t);
    try { localStorage.setItem('listbook:theme', JSON.stringify(t)); } catch {}
    const r = document.documentElement;
    if (t === 'light' || t === 'dark') {
      r.setAttribute('data-theme', t);
    } else {
      r.removeAttribute('data-theme');
    }
    if (getToken()) {
      authAPI.updateProfile({ prefs: { theme: t } }).catch(() => {});
    }
  }, []);

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
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const saveNoteBody = useCallback((noteId, html) => {
    if (!noteId) return;
    const rec = { html, updatedAt: Date.now() };
    noteCacheRef.current[noteId] = rec;
    try {
      localStorage.setItem(getNoteKey(noteId), JSON.stringify(rec));
    } catch {}

    // Check if this note is shared and sync to share endpoint if permitted
    const note = boardRef.current?.notes?.find(n => n.id === noteId);
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
  }, [getNoteKey]);

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

  const ingestShareRef = useRef(ingestShare);
  useEffect(() => {
    ingestShareRef.current = ingestShare;
  }, [ingestShare]);

  // Live SSE synchronization for shared items
  useEffect(() => {
    let es = null;
    let retryTimer = null;
    let isCancelled = false;

    const connect = () => {
      if (isCancelled) return;
      try {
        const streamUrl = '/api/shares/stream';
        es = new EventSource(streamUrl);

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (!data || !data.sid) return;

            if (data.type === 'share_revoked') {
              setBoardState(prev => {
                let changed = false;
                const newLists = prev.lists.map(l => {
                  if (l.shared?.sid === data.sid) {
                    changed = true;
                    return { ...l, shared: null };
                  }
                  return l;
                });
                const newNotes = prev.notes.map(n => {
                  if (n.shared?.sid === data.sid) {
                    changed = true;
                    return { ...n, shared: null };
                  }
                  return n;
                });
                if (!changed) return prev;
                const next = { ...prev, lists: newLists, notes: newNotes };
                if (session) {
                  const key = `listbook:board:${session.username || session.key || 'default'}`;
                  try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
                }
                return next;
              });
              showToast('A shared item was made private by its owner.');
              return;
            }

            if (data.type === 'share_updated') {
              const { sid, kind, content, updatedBy, mode } = data;
              if (!content) return;

              setBoardState(prev => {
                if (kind === 'list') {
                  const target = prev.lists.find(l => l.shared?.sid === sid);
                  if (!target) return prev;

                  // Check if identical to prevent re-render loop
                  const sameName = content.name === undefined || content.name === target.name;
                  const sameTodos = !Array.isArray(content.todos) || JSON.stringify(content.todos) === JSON.stringify(target.todos);
                  if (sameName && sameTodos && (!mode || mode === target.shared?.mode)) {
                    return prev;
                  }

                  const updatedLists = prev.lists.map(l => {
                    if (l.shared?.sid === sid) {
                      return {
                        ...l,
                        name: content.name !== undefined ? content.name : l.name,
                        todos: Array.isArray(content.todos) ? content.todos : l.todos,
                        shared: {
                          ...(l.shared || {}),
                          ...(mode && { mode })
                        }
                      };
                    }
                    return l;
                  });

                  const next = { ...prev, lists: updatedLists };
                  if (session) {
                    const key = `listbook:board:${session.username || session.key || 'default'}`;
                    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
                  }
                  return next;
                } else if (kind === 'note') {
                  const target = prev.notes.find(n => n.shared?.sid === sid);
                  if (!target) return prev;

                  const noteId = target.id;

                  // Update note body cache and localStorage
                  if (content.html !== undefined) {
                    const currentCached = noteCacheRef.current[noteId];
                    if (!currentCached || currentCached.html !== content.html) {
                      const rec = { html: content.html, updatedAt: Date.now() };
                      noteCacheRef.current[noteId] = rec;
                      const noteKey = session
                        ? `listbook:note:${session.username || session.key || session.id}:${noteId}`
                        : `listbook:note:anon:${noteId}`;
                      try { localStorage.setItem(noteKey, JSON.stringify(rec)); } catch {}

                      // Dispatch event for active NoteView
                      window.dispatchEvent(new CustomEvent('mydeepwork:remote_note_updated', {
                        detail: { noteId, html: content.html, updatedBy }
                      }));
                    }
                  }

                  const sameTitle = content.title === undefined || content.title === target.title;
                  if (sameTitle && (!mode || mode === target.shared?.mode)) {
                    return prev;
                  }

                  const updatedNotes = prev.notes.map(n => {
                    if (n.shared?.sid === sid) {
                      return {
                        ...n,
                        title: content.title !== undefined ? content.title : n.title,
                        shared: {
                          ...(n.shared || {}),
                          ...(mode && { mode })
                        }
                      };
                    }
                    return n;
                  });

                  const next = { ...prev, notes: updatedNotes };
                  if (session) {
                    const key = `listbook:board:${session.username || session.key || 'default'}`;
                    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
                  }
                  return next;
                }
                return prev;
              });
            }
          } catch {}
        };

        es.onerror = () => {
          if (es) {
            es.close();
            es = null;
          }
          if (!isCancelled) {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(connect, 5000);
          }
        };
      } catch {
        if (!isCancelled) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(connect, 6000);
        }
      }
    };

    connect();

    return () => {
      isCancelled = true;
      if (es) es.close();
      clearTimeout(retryTimer);
    };
  }, [session, showToast]);

  // Window focus re-sync for shared items
  useEffect(() => {
    const handleFocus = () => {
      if (getToken()) {
        boardAPI.getBoard().then(remoteBoard => {
          if (remoteBoard && Array.isArray(remoteBoard.lists)) {
            const active = normalizeBoard(remoteBoard);
            setBoardState(prev => {
              if (JSON.stringify(prev.lists) !== JSON.stringify(active.lists) ||
                  JSON.stringify(prev.notes) !== JSON.stringify(active.notes)) {
                return active;
              }
              return prev;
            });
          }
        }).catch(() => {});
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Initialize and verify backend session on mount (once)
  useEffect(() => {
    const token = getToken();
    if (token) {
      authAPI.getMe().then(res => {
        if (res.user) {
          setSessionState(res.user);
          if (res.user.photo) setPhotoState(res.user.photo);

          // Respect local theme & accent if already set in localStorage
          const localTheme = localStorage.getItem('listbook:theme');
          if (localTheme) {
            try {
              const parsed = JSON.parse(localTheme);
              if (parsed && parsed !== res.user.prefs?.theme) {
                authAPI.updateProfile({ prefs: { theme: parsed } }).catch(() => {});
              }
            } catch {}
          } else if (res.user.prefs?.theme) {
            setTheme(res.user.prefs.theme);
          }

          const localAccent = localStorage.getItem('listbook:accent');
          if (localAccent) {
            try {
              const parsed = JSON.parse(localAccent);
              if (parsed && parsed !== res.user.prefs?.accent) {
                authAPI.updateProfile({ prefs: { accent: parsed } }).catch(() => {});
              }
            } catch {}
          } else if (res.user.prefs?.accent) {
            setAccent(res.user.prefs.accent);
          }

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
              ingestShareRef.current(pending, res.user, normalized);
            }
          }).catch(() => {
            const pending = sessionStorage.getItem('listbook:pending_share');
            if (pending) {
              ingestShareRef.current(pending, res.user);
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
  }, []);

  // Handle share links in URL hash: #s.<sid> or #s.<owner>.<sid>
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash || hash.startsWith('#s.local.')) return;
      const m = /^#s\.(?:([A-Za-z0-9_-]+)\.)?([a-z0-9]+)$/i.exec(hash);
      if (!m || m[1] === 'local') return;
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
      setAccent,
      theme,
      setTheme,
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
      ingestShare,
      crmMembers,
      crmLoaded,
      crmErr,
      crmView,
      setCrmView,
      crmFilter,
      setCrmFilter,
      crmSearch,
      setCrmSearch,
      crmModal,
      setCrmModal,
      isCrmAllowed,
      loadCrmMembers,
      saveCrmMember,
      deleteCrmMember,
      openCrmModal,
      closeCrmModal,
      saveCrmSession,
      deleteCrmSession
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
