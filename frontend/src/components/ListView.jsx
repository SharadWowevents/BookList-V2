import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { uid } from '../utils/constants';
import { sharesAPI } from '../services/api';
import {
  BackIcon, ShareIcon, TrashIcon, CheckIcon, StarIcon, XIcon,
  MicIcon, PlusIcon, ChevronRightIcon, ChevronDownIcon, CopyIcon,
  PencilIcon, EyeIcon
} from './Icons';

export const ListView = () => {
  const { board, updateBoard, ui, setUi, session, showToast, showUndoToast } = useApp();
  const [newTodoText, setNewTodoText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState('');
  const [draggedTodoId, setDraggedTodoId] = useState(null);
  const recognitionRef = useRef(null);

  const activeList = board.lists.find(l => l.id === board.activeId) || board.lists[0];

  const isShared = !!activeList?.shared;
  const isOwn = activeList?.shared ? !!activeList.shared.own : true;
  const canEdit = isOwn || (activeList?.shared?.mode === 'edit');
  const ro = !canEdit;

  const [shareMode, setShareMode] = useState(() => activeList?.shared?.mode || 'edit');
  const [shareSid, setShareSid] = useState(() => activeList?.shared?.sid || '');

  useEffect(() => {
    if (activeList?.shared?.mode) setShareMode(activeList.shared.mode);
    if (activeList?.shared?.sid) setShareSid(activeList.shared.sid);
  }, [activeList?.id, activeList?.shared?.mode, activeList?.shared?.sid]);

  useEffect(() => {
    if (ui.sharing && activeList?.id && !shareSid) {
      sharesAPI.createShare({ itemId: activeList.id, kind: 'list', mode: shareMode })
        .then(res => {
          if (res?.sid) {
            setShareSid(res.sid);
            updateBoard({
              lists: board.lists.map(l => l.id === activeList.id ? {
                ...l,
                shared: { sid: res.sid, mode: res.mode, own: true, ownerName: session?.name || 'You' }
              } : l)
            });
          }
        })
        .catch(() => {});
    }
  }, [ui.sharing, activeList?.id, shareSid, shareMode, session?.name, updateBoard]);

  if (!activeList) {
    return (
      <>
        <div className="main-head">
          <button className="icon-btn back" onClick={() => setUi(prev => ({ ...prev, viewing: false }))}>
            <BackIcon />
          </button>
        </div>
        <p className="empty" style={{ paddingLeft: '24px' }}>
          Create a list to get started.
        </p>
      </>
    );
  }

  const updateListTodos = (newTodos) => {
    if (ro) return;
    updateBoard({
      lists: board.lists.map(l => l.id === activeList.id ? { ...l, todos: newTodos } : l)
    });
    if (shareSid && canEdit) {
      sharesAPI.updateShare(shareSid, { content: { name: activeList.name, todos: newTodos } }).catch(() => {});
    }
  };

  const handleTitleChange = (e) => {
    if (ro) return;
    const val = e.target.value;
    updateBoard({
      lists: board.lists.map(l => l.id === activeList.id ? { ...l, name: val } : l)
    });
    if (shareSid && canEdit) {
      sharesAPI.updateShare(shareSid, { content: { name: val, todos: activeList.todos } }).catch(() => {});
    }
  };

  const handleAddTodo = (e) => {
    if (e) e.preventDefault();
    if (ro) return;
    const text = newTodoText.trim();
    if (!text) return;
    const newTodo = { id: uid(), text, done: false, starred: false };
    updateListTodos([...activeList.todos, newTodo]);
    setNewTodoText('');
  };

  const toggleCheck = (todoId) => {
    if (ro) return;
    updateListTodos(activeList.todos.map(t => t.id === todoId ? { ...t, done: !t.done } : t));
  };

  const toggleStar = (todoId) => {
    if (ro) return;
    updateListTodos(activeList.todos.map(t => t.id === todoId ? { ...t, starred: !t.starred } : t));
  };

  const deleteTodo = (todoId) => {
    if (ro) return;
    const idx = activeList.todos.findIndex(t => t.id === todoId);
    if (idx < 0) return;
    const removed = activeList.todos[idx];
    const newTodos = activeList.todos.filter(t => t.id !== todoId);
    updateListTodos(newTodos);

    showUndoToast('Todo deleted.', () => {
      // Undo restoration
      const current = board.lists.find(l => l.id === activeList.id);
      if (current) {
        const restored = [...current.todos];
        restored.splice(Math.min(idx, restored.length), 0, removed);
        updateBoard({
          lists: board.lists.map(l => l.id === activeList.id ? { ...l, todos: restored } : l)
        });
      }
    });
  };

  const startEditing = (todo) => {
    if (ro) return;
    setEditingTodoId(todo.id);
    setEditingText(todo.text);
  };

  const saveEdit = (todoId) => {
    if (ro || !editingTodoId) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      updateListTodos(activeList.todos.map(t => t.id === todoId ? { ...t, text: trimmed } : t));
    }
    setEditingTodoId(null);
  };

  // Voice recognition
  const toggleVoice = () => {
    if (voiceListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast("Voice input isn't supported in this browser. Try Chrome or Safari.");
      return;
    }

    const rec = new SpeechRec();
    rec.lang = navigator.language && navigator.language.startsWith('en') ? navigator.language : 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';

    rec.onstart = () => {
      setVoiceListening(true);
      setVoiceHint('Listening… say your todo.');
    };

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setNewTodoText((finalText + interim).trim());
    };

    rec.onerror = (ev) => {
      if (ev.error !== 'aborted') {
        showToast('Voice input stopped. Try again.');
      }
    };

    rec.onend = () => {
      setVoiceListening(false);
      setVoiceHint('');
      const text = finalText.trim();
      if (text) {
        const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
        const newTodo = { id: uid(), text: capitalized, done: false, starred: false };
        updateListTodos([...activeList.todos, newTodo]);
        setNewTodoText('');
        showToast('Added: ' + capitalized, 2200);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      showToast("Couldn't start the microphone. Try again.");
    }
  };

  // Delete list
  const handleDeleteList = () => {
    const listName = activeList.name;
    const isSharedNonOwner = isShared && !isOwn;

    if (shareSid && isOwn) {
      sharesAPI.deleteShare(shareSid).catch(() => {});
    }

    const remaining = board.lists.filter(l => l.id !== activeList.id);
    const nextActive = remaining[0] ? remaining[0].id : null;
    updateBoard({
      lists: remaining,
      activeId: nextActive
    });
    setUi(prev => ({ ...prev, confirm: false, viewing: false }));
    showToast(isSharedNonOwner ? 'Removed from your lists.' : `List “${listName}” deleted.`);
  };

  // Drag and drop todos
  const handleTodoDragStart = (e, id) => {
    if (ro) return;
    setDraggedTodoId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTodoDragOver = (e) => {
    if (ro) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleTodoDrop = (e, targetId) => {
    if (ro) return;
    e.preventDefault();
    if (!draggedTodoId || draggedTodoId === targetId) return;
    const todos = [...activeList.todos];
    const fromIdx = todos.findIndex(t => t.id === draggedTodoId);
    const toIdx = todos.findIndex(t => t.id === targetId);
    if (fromIdx >= 0 && toIdx >= 0) {
      const [moved] = todos.splice(fromIdx, 1);
      todos.splice(toIdx, 0, moved);
      updateListTodos(todos);
    }
    setDraggedTodoId(null);
  };

  // Move todo to another list
  const handleDropOnList = (e, targetListId) => {
    if (ro) return;
    e.preventDefault();
    if (!draggedTodoId || targetListId === activeList.id) return;
    const todoToMove = activeList.todos.find(t => t.id === draggedTodoId);
    const targetList = board.lists.find(l => l.id === targetListId);
    if (!todoToMove || !targetList) return;

    // Remove from active list
    const newActiveTodos = activeList.todos.filter(t => t.id !== draggedTodoId);
    // Add to target list
    const newTargetTodos = [...targetList.todos, todoToMove];

    updateBoard({
      lists: board.lists.map(l => {
        if (l.id === activeList.id) return { ...l, todos: newActiveTodos };
        if (l.id === targetListId) return { ...l, todos: newTargetTodos };
        return l;
      })
    });

    setDraggedTodoId(null);
    showUndoToast(`Moved to “${targetList.name}”.`, () => {
      // Undo move
      const curSource = board.lists.find(l => l.id === activeList.id);
      const curTarget = board.lists.find(l => l.id === targetListId);
      if (curSource && curTarget) {
        updateBoard({
          lists: board.lists.map(l => {
            if (l.id === activeList.id) return { ...l, todos: [...l.todos, todoToMove] };
            if (l.id === targetListId) return { ...l, todos: l.todos.filter(t => t.id !== todoToMove.id) };
            return l;
          })
        });
      }
    });
  };

  const handleShareModeChange = async (newMode) => {
    setShareMode(newMode);
    try {
      if (shareSid) {
        await sharesAPI.updateShare(shareSid, { mode: newMode });
      } else {
        const res = await sharesAPI.createShare({ itemId: activeList.id, kind: 'list', mode: newMode });
        if (res?.sid) setShareSid(res.sid);
      }
      updateBoard({
        lists: board.lists.map(l => l.id === activeList.id ? {
          ...l,
          shared: { ...(l.shared || {}), sid: shareSid || l.shared?.sid, mode: newMode, own: true }
        } : l)
      });
      showToast(newMode === 'edit' ? 'People with the link can now edit.' : 'People with the link can now only view.');
    } catch {
      showToast(newMode === 'edit' ? 'People with the link can edit.' : 'People with the link can view only.');
    }
  };

  const handleStopSharing = async () => {
    try {
      if (shareSid) await sharesAPI.deleteShare(shareSid);
    } catch {}
    setShareSid('');
    updateBoard({
      lists: board.lists.map(l => l.id === activeList.id ? { ...l, shared: null } : l)
    });
    setUi(prev => ({ ...prev, sharing: false }));
    showToast("Sharing stopped. It's private again.");
  };

  const sOpen = activeList.todos.filter(t => !t.done && t.starred);
  const open = activeList.todos.filter(t => !t.done && !t.starred);
  const done = activeList.todos.filter(t => t.done);
  const total = activeList.todos.length;

  const copyShareLink = async () => {
    try {
      let sid = shareSid;
      if (!sid) {
        const res = await sharesAPI.createShare({ itemId: activeList.id, kind: 'list', mode: shareMode });
        sid = res.sid;
        setShareSid(sid);
        updateBoard({
          lists: board.lists.map(l => l.id === activeList.id ? {
            ...l,
            shared: { sid: res.sid, mode: res.mode, own: true, ownerName: session?.name || 'You' }
          } : l)
        });
      }
      const url = `${window.location.origin}${window.location.pathname}#s.${sid}`;
      await navigator.clipboard.writeText(url);
      showToast('Share link copied.');
    } catch {
      const url = `${window.location.origin}${window.location.pathname}#s.local.${activeList.id}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied.');
      } catch {
        showToast('Link: ' + url);
      }
    }
  };

  const shareUrl = shareSid
    ? `${window.location.origin}${window.location.pathname}#s.${shareSid}`
    : `${window.location.origin}${window.location.pathname}#s.local.${activeList.id}`;

  const renderTodoRow = (t) => {
    const isEditing = editingTodoId === t.id && !ro;
    return (
      <div
        key={t.id}
        className={`todo ${t.done ? 'done' : ''}`}
        draggable={!ro}
        onDragStart={(e) => !ro && handleTodoDragStart(e, t.id)}
        onDragOver={ro ? undefined : handleTodoDragOver}
        onDrop={(e) => !ro && handleTodoDrop(e, t.id)}
      >
        <button
          type="button"
          className="check"
          disabled={ro}
          onClick={() => !ro && toggleCheck(t.id)}
          aria-label={t.done ? 'Mark not done' : 'Mark done'}
        >
          <span className="box">{t.done && <CheckIcon />}</span>
        </button>

        {isEditing ? (
          <input
            className="todo-edit"
            autoFocus
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={() => saveEdit(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(t.id);
              if (e.key === 'Escape') setEditingTodoId(null);
            }}
          />
        ) : (
          <span
            className="todo-text"
            onClick={() => !ro && startEditing(t)}
            title={ro ? undefined : 'Click to edit'}
          >
            {t.text}
          </span>
        )}

        {ro ? (
          t.starred ? (
            <span className="icon-btn star-btn on" aria-label="Starred">
              <StarIcon filled={true} />
            </span>
          ) : null
        ) : (
          <>
            <button
              type="button"
              className={`icon-btn star-btn ${t.starred ? 'on' : ''}`}
              onClick={() => toggleStar(t.id)}
              aria-label={t.starred ? 'Unstar' : 'Star'}
            >
              <StarIcon filled={t.starred} />
            </button>
            <button
              type="button"
              className="icon-btn del"
              onClick={() => deleteTodo(t.id)}
              aria-label="Delete todo"
            >
              <XIcon />
            </button>
          </>
        )}
      </div>
    );
  };

  const otherLists = board.lists.filter(l => l.id !== activeList.id);

  return (
    <>
      <div className="main-head">
        <button
          type="button"
          className="icon-btn back"
          id="back"
          aria-label="Back to lists"
          onClick={() => setUi(prev => ({ ...prev, viewing: false }))}
        >
          <BackIcon />
        </button>
        <div className="title-wrap">
          <input
            className="title"
            id="listTitle"
            value={activeList.name}
            onChange={handleTitleChange}
            aria-label="List name"
            maxLength={60}
            readOnly={ro}
          />
          <div className="sub">
            {total ? `${total - done.length} open · ${done.length} done` : 'No todos yet'}
          </div>
          {isShared && (
            <div className="byline">
              <span className="avatar sm">
                {(activeList.shared?.ownerName || 'Y').trim().charAt(0).toUpperCase()}
              </span>
              <span className="txt">
                {isOwn
                  ? `Shared by you • ${activeList.shared.mode === 'edit' ? 'others can edit' : 'others can view'}`
                  : `${activeList.shared.ownerName || 'Someone'} • ${activeList.shared.mode === 'edit' ? 'You can edit' : 'View only'}`
                }
              </span>
            </div>
          )}
        </div>
        <div className="head-actions">
          <button
            type="button"
            className={`icon-btn ${isShared || ui.sharing ? 'shared-on' : ''}`}
            id="shareBtn"
            title="Share"
            aria-label="Share list"
            onClick={() => setUi(prev => ({ ...prev, sharing: !prev.sharing, confirm: false }))}
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            id="askDelete"
            title={isShared && !isOwn ? "Remove from my lists" : "Delete list"}
            aria-label={isShared && !isOwn ? "Remove from my lists" : "Delete list"}
            onClick={() => setUi(prev => ({ ...prev, confirm: !prev.confirm, sharing: false }))}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {ui.sharing && (
        <div className="sheet">
          <div className="sheet-top">
            {isShared && !isOwn ? (
              <span className="byline">
                <span className="avatar sm">
                  {(activeList.shared?.ownerName || 'Y').trim().charAt(0).toUpperCase()}
                </span>
                <span className="txt">Shared by {activeList.shared?.ownerName || 'Someone'}</span>
              </span>
            ) : (
              'Share this list'
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={() => setUi(prev => ({ ...prev, sharing: false }))}
              aria-label="Close"
            >
              <XIcon />
            </button>
          </div>

          {isShared && !isOwn ? (
            <p>
              {activeList.shared?.mode === 'edit'
                ? 'You can edit this. Changes show up for everyone it’s shared with.'
                : 'You can view this. Only the owner can change it.'}
            </p>
          ) : (
            <>
              <p>Choose what people with the link can do. You can change this later.</p>
              <div className="mode-seg">
                <button
                  type="button"
                  className={shareMode === 'edit' ? 'on' : ''}
                  onClick={() => handleShareModeChange('edit')}
                >
                  <PencilIcon /> Can edit
                </button>
                <button
                  type="button"
                  className={shareMode === 'view' ? 'on' : ''}
                  onClick={() => handleShareModeChange('view')}
                >
                  <EyeIcon /> Can view
                </button>
              </div>
            </>
          )}

          <div className="link-row">
            <input
              className="input"
              id="shareLink"
              readOnly
              value={shareUrl}
              aria-label="Share link"
            />
            <button type="button" className="pill ink" onClick={copyShareLink} aria-label="Copy link">
              <CopyIcon />
            </button>
          </div>

          {isOwn && (
            <button
              type="button"
              className="text-btn danger"
              onClick={handleStopSharing}
            >
              Stop sharing
            </button>
          )}
        </div>
      )}

      {ui.confirm && (
        <div className="confirm">
          <span>
            {isShared && !isOwn
              ? `Remove “${activeList.name}” from your lists? The owner keeps it.`
              : `Delete “${activeList.name}” and its ${total} todo${total === 1 ? '' : 's'}?${isShared ? ' It will disappear for everyone it’s shared with.' : ''}`}
          </span>
          <button
            type="button"
            className="pill plain"
            onClick={() => setUi(prev => ({ ...prev, confirm: false }))}
          >
            Keep
          </button>
          <button
            type="button"
            className="pill danger"
            onClick={handleDeleteList}
          >
            {isShared && !isOwn ? 'Remove' : 'Delete list'}
          </button>
        </div>
      )}

      <div className="todos">
        <div className="todo-inner">
          {!total && (
            <p className="empty">
              {ro ? 'Nothing here yet.' : 'Nothing here yet. Type below or tap the mic and say your first todo.'}
            </p>
          )}

          {sOpen.length > 0 && <div className="sec-label">Starred</div>}
          <div className="group">
            {sOpen.map(renderTodoRow)}
          </div>

          {sOpen.length > 0 && open.length > 0 && <div className="sec-label">Todos</div>}
          <div className="group">
            {open.map(renderTodoRow)}
          </div>

          {done.length > 0 && (
            <>
              <button
                type="button"
                className="done-toggle"
                onClick={() => setUi(prev => ({ ...prev, showDone: !prev.showDone }))}
              >
                {ui.showDone ? <ChevronDownIcon /> : <ChevronRightIcon />} Done · {done.length}
              </button>
              {ui.showDone && (
                <div className="group">
                  {done.map(renderTodoRow)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {ro ? (
        <div className="composer ro">
          <EyeIcon />
          <span>View only. {activeList.shared?.ownerName || 'The owner'} can make changes.</span>
        </div>
      ) : (
        <div className="composer">
          <form onSubmit={handleAddTodo} autoComplete="off">
            <input
              className="input"
              id="newTodo"
              placeholder="Add todo"
              maxLength={300}
              aria-label="Add todo"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
            />
            <button
              type="button"
              className={`mic ${voiceListening ? 'live' : ''}`}
              id="mic"
              aria-label="Add todo by voice"
              onClick={toggleVoice}
            >
              <MicIcon />
            </button>
            <button type="submit" className="send" aria-label="Add">
              <PlusIcon />
            </button>
          </form>
          {voiceHint && <div className="hint">{voiceHint}</div>}
        </div>
      )}

      {!ro && draggedTodoId && otherLists.length > 0 && (
        <div className="tray" id="tray">
          <div className="tray-label">Drop on a list to move it</div>
          <div className="tray-chips">
            {otherLists.map(l => (
              <div
                key={l.id}
                className="chip"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnList(e, l.id)}
              >
                {l.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
