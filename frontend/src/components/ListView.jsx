import { useState, useRef, useEffect, useCallback } from 'react';
import Sortable from 'sortablejs';
import { useApp } from '../context/AppContext';
import { uid, reorderSubset } from '../utils/constants';
import { sharesAPI, boardAPI } from '../services/api';
import {
  IDB,
  fmtDur,
  pickMime,
  storeAudio,
  audioURL,
  cleanAudio
} from '../utils/audioStorage';
import {
  BackIcon, ShareIcon, TrashIcon, CheckIcon, StarIcon, XIcon,
  MicIcon, PlusIcon, ChevronRightIcon, ChevronDownIcon, CopyIcon,
  PencilIcon, EyeIcon, WaveIcon, AudioPlayIcon, AudioPauseIcon, StopIcon
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

  // Audio Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingAudio, setPendingAudio] = useState(null); // { blob, dur, url }
  const [isSavingAudio, setIsSavingAudio] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartTimeRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const audioInputRef = useRef(null);
  const previewAudioRef = useRef(new Audio());

  // Audio Player state for items in the list
  const [playingTodoId, setPlayingTodoId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState(0);
  const playerRef = useRef(new Audio());

  const activeList = board.lists.find(l => l.id === board.activeId) || board.lists[0];

  const isShared = !!activeList?.shared;
  const isOwn = activeList?.shared ? !!activeList.shared.own : true;
  const canEdit = isOwn || (activeList?.shared?.mode === 'edit');
  const ro = !canEdit;

  const [shareMode, setShareMode] = useState(() => activeList?.shared?.mode || 'edit');
  const [shareSid, setShareSid] = useState(() => activeList?.shared?.sid || '');

  const updateListTodos = useCallback((newTodos) => {
    if (!activeList || ro) return;
    updateBoard({
      lists: board.lists.map(l => l.id === activeList.id ? { ...l, todos: newTodos } : l)
    });
    if (shareSid && canEdit) {
      sharesAPI.updateShare(shareSid, { content: { name: activeList.name, todos: newTodos } }).catch(() => {});
    }
  }, [activeList, ro, updateBoard, board.lists, shareSid, canEdit]);

  // Drag and drop todos with SortableJS
  const sOpenGroupRef = useRef(null);
  const openGroupRef = useRef(null);
  const doneGroupRef = useRef(null);
  const todoSortablesRef = useRef([]);

  const activeListRef = useRef(activeList);
  const updateListTodosRef = useRef(updateListTodos);

  useEffect(() => {
    activeListRef.current = activeList;
  }, [activeList]);

  useEffect(() => {
    updateListTodosRef.current = updateListTodos;
  }, [updateListTodos]);

  // Audio player listeners
  useEffect(() => {
    const player = playerRef.current;
    player.preload = 'auto';

    const onTimeUpdate = () => {
      setPlaybackCurrentTime(player.currentTime || 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      player.currentTime = 0;
      setPlayingTodoId(null);
      setIsPlaying(false);
      setPlaybackCurrentTime(0);
    };
    const onError = () => {
      setPlayingTodoId(null);
      setIsPlaying(false);
      setPlaybackCurrentTime(0);
    };

    player.addEventListener('timeupdate', onTimeUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    player.addEventListener('error', onError);

    return () => {
      player.pause();
      player.removeEventListener('timeupdate', onTimeUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
      player.removeEventListener('error', onError);
    };
  }, []);

  // When changing lists or unmounting, pause audio
  useEffect(() => {
    playerRef.current?.pause();
    setPlayingTodoId(null);
    setIsPlaying(false);
    setPlaybackCurrentTime(0);
  }, [activeList?.id]);

  // Toggle play audio note
  const togglePlayAudio = async (todo) => {
    if (!todo?.audio?.src) return;
    const player = playerRef.current;

    if (playingTodoId === todo.id) {
      if (player.paused) {
        player.play().catch(() => {});
      } else {
        player.pause();
      }
      return;
    }

    try {
      player.pause();
      const playableSrc = await audioURL(todo.audio.src);
      player.src = playableSrc;
      setPlayingTodoId(todo.id);
      await player.play();
    } catch (err) {
      console.error('Audio play error:', err);
      setPlayingTodoId(null);
      setIsPlaying(false);
      showToast(err && err.message === 'missing'
        ? "This audio note is saved on another device, so it can't play here."
        : "Couldn't play this audio note.");
    }
  };

  // Toggle preview of pending recording
  const togglePlayPreview = () => {
    if (!pendingAudio?.url) return;
    const preview = previewAudioRef.current;
    if (!preview.paused) {
      preview.pause();
      setIsPlayingPreview(false);
      return;
    }
    preview.src = pendingAudio.url;
    preview.play().catch(() => showToast("Couldn't play recording."));
    setIsPlayingPreview(true);
    preview.onpause = () => setIsPlayingPreview(false);
    preview.onended = () => setIsPlayingPreview(false);
  };

  // Start recording
  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showToast("This browser can't record here. Choose an audio file instead.", 3500);
      audioInputRef.current?.click();
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      showToast(denied
        ? 'Microphone access is blocked. Allow the microphone for this site in your browser settings, or choose an audio file.'
        : 'No microphone found. Choose an audio file instead.', 5500);
      if (!denied) audioInputRef.current?.click();
      return;
    }

    const mime = pickMime();
    let mr;
    try {
      mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
    } catch {
      stream.getTracks().forEach(t => t.stop());
      showToast("Couldn't start recording in this browser.");
      return;
    }

    const chunks = [];
    chunksRef.current = chunks;
    mediaRecorderRef.current = mr;
    streamRef.current = stream;
    recordingStartTimeRef.current = Date.now();

    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };

    mr.onstop = () => {
      clearInterval(recordingTimerRef.current);
      stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);

      const dur = (Date.now() - recordingStartTimeRef.current) / 1000;
      if (!mr._cancelled && chunks.length && dur >= 0.6) {
        const blob = new Blob(chunks, { type: (mr.mimeType || mime || 'audio/webm').split(';')[0] });
        if (pendingAudio?.url) URL.revokeObjectURL(pendingAudio.url);
        const url = URL.createObjectURL(blob);
        setPendingAudio({ blob, dur, url });
      } else if (!mr._cancelled) {
        showToast('That recording was too short. Hold on a little longer.', 2600);
      }
    };

    mr.start(1000);
    setIsRecording(true);
    setRecordingDuration(0);

    recordingTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
      setRecordingDuration(elapsed);
      if (elapsed > 15 * 60) {
        showToast('Audio notes stop at 15 minutes.');
        stopRecording(false);
      }
    }, 250);
  };

  // Stop or Cancel recording
  const stopRecording = (cancel = false) => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr._cancelled = !!cancel;
    try {
      if (mr.state !== 'inactive') mr.stop();
      else mr.onstop && mr.onstop();
    } catch {
      mr.onstop && mr.onstop();
    }
  };

  // Attach audio file
  const attachAudioFile = (file) => {
    if (!file) return;
    if (!/^audio\/|^video\/(mp4|webm|quicktime)/.test(file.type) && !/\.(m4a|mp3|wav|aac|ogg|webm|opus|caf)$/i.test(file.name)) {
      showToast('Choose an audio file, like a voice memo.');
      return;
    }
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    probe.preload = 'metadata';
    const done = (d) => {
      if (pendingAudio?.url) URL.revokeObjectURL(pendingAudio.url);
      setPendingAudio({ blob: file, dur: isFinite(d) ? d : 0, url });
    };
    probe.onloadedmetadata = () => done(probe.duration);
    probe.onerror = () => done(0);
    probe.src = url;
  };

  useEffect(() => {
    todoSortablesRef.current.forEach(s => s.destroy());
    todoSortablesRef.current = [];

    if (!activeList || ro) return;

    const opts = {
      animation: 160,
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      filter: ".todo-edit, .check, .star-btn, .del, .todo-audio",
      preventOnFilter: false,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      onEnd(evt) {
        const { from, oldIndex, newIndex } = evt;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;

        // 1. Capture new order of IDs
        const ids = Array.from(from.children).map(c => c.dataset.id).filter(Boolean);

        // 2. Revert DOM mutation so React can cleanly reconcile without VDOM desync
        const item = evt.item;
        const targetNode = from.children[oldIndex > newIndex ? oldIndex + 1 : oldIndex];
        from.insertBefore(item, targetNode || null);

        // 3. Update active list todos
        if (activeListRef.current?.todos) {
          const reordered = reorderSubset(activeListRef.current.todos, ids);
          updateListTodosRef.current(reordered);
        }
      }
    };

    if (sOpenGroupRef.current) {
      todoSortablesRef.current.push(Sortable.create(sOpenGroupRef.current, opts));
    }
    if (openGroupRef.current) {
      todoSortablesRef.current.push(Sortable.create(openGroupRef.current, opts));
    }
    if (doneGroupRef.current && ui.showDone) {
      todoSortablesRef.current.push(Sortable.create(doneGroupRef.current, opts));
    }

    return () => {
      todoSortablesRef.current.forEach(s => s.destroy());
      todoSortablesRef.current = [];
    };
  }, [activeList?.id, activeList?.todos, ro, ui.showDone, activeList]);

  useEffect(() => {
    if (activeList?.shared?.mode) setShareMode(activeList.shared.mode);
    if (activeList?.shared?.sid) setShareSid(activeList.shared.sid);
  }, [activeList?.id, activeList?.shared?.mode, activeList?.shared?.sid]);

  useEffect(() => {
    if (ui.sharing && activeList?.id && !shareSid) {
      sharesAPI.createShare({
        itemId: activeList.id,
        kind: 'list',
        mode: shareMode,
        content: { name: activeList.name, todos: activeList.todos },
        ownerName: session?.name || 'You'
      })
        .then(res => {
          if (res?.sid) {
            setShareSid(res.sid);
            updateBoard({
              lists: board.lists.map(l => l.id === activeList.id ? {
                ...l,
                shared: { sid: res.sid, mode: res.mode, own: true, ownerName: res.ownerName || session?.name || 'You' }
              } : l)
            });
          }
        })
        .catch(err => {
          console.error('Failed to create list share:', err);
        });
    }
  }, [ui.sharing, activeList?.id, activeList?.name, activeList?.todos, shareSid, shareMode, session?.name, updateBoard]);

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

  const handleAddTodo = async (e) => {
    if (e) e.preventDefault();
    if (ro) return;
    const text = newTodoText.trim();
    if (!text && !pendingAudio) return;

    let audioMeta = null;
    if (pendingAudio) {
      if (isSavingAudio) return;
      setIsSavingAudio(true);
      showToast('Saving audio note…', 20000);
      try {
        audioMeta = await storeAudio(pendingAudio.blob, pendingAudio.dur);
      } catch (err) {
        setIsSavingAudio(false);
        showToast(err?.userMsg || "Couldn't save audio note. Try again.", 5000);
        return;
      }
      setIsSavingAudio(false);
      if (pendingAudio.url) URL.revokeObjectURL(pendingAudio.url);
      setPendingAudio(null);
    }

    const newTodo = {
      id: uid(),
      text: text || (audioMeta ? 'Audio note' : 'New task'),
      done: false,
      starred: false,
      ...(audioMeta ? { audio: audioMeta } : {})
    };

    updateListTodos([...activeList.todos, newTodo]);
    setNewTodoText('');
    if (audioMeta) {
      showToast('Todo added with audio note.', 2200);
    }
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

  // Voice recognition (Speech to text)
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

    if (isOwn) {
      boardAPI.deleteList(activeList.id).catch(() => {});
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
        const res = await sharesAPI.createShare({
          itemId: activeList.id,
          kind: 'list',
          mode: newMode,
          content: { name: activeList.name, todos: activeList.todos },
          ownerName: session?.name || 'You'
        });
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
        showToast('Generating share link…');
        const res = await sharesAPI.createShare({
          itemId: activeList.id,
          kind: 'list',
          mode: shareMode,
          content: { name: activeList.name, todos: activeList.todos },
          ownerName: session?.name || 'You'
        });
        if (!res?.sid) throw new Error('No sid returned');
        sid = res.sid;
        setShareSid(sid);
        updateBoard({
          lists: board.lists.map(l => l.id === activeList.id ? {
            ...l,
            shared: { sid: res.sid, mode: res.mode, own: true, ownerName: res.ownerName || session?.name || 'You' }
          } : l)
        });
      }
      const url = `${window.location.origin}${window.location.pathname}#s.${sid}`;
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard.');
    } catch (err) {
      console.error('Failed to copy share link:', err);
      showToast('Could not create share link. Please try again.');
    }
  };

  const shareUrl = shareSid
    ? `${window.location.origin}${window.location.pathname}#s.${shareSid}`
    : 'Generating link…';

  const renderTodoRow = (t) => {
    const isEditing = editingTodoId === t.id && !ro;
    const isThisPlaying = playingTodoId === t.id && isPlaying;
    const hasAudio = t.audio && cleanAudio(t.audio);

    return (
      <div
        key={t.id}
        data-id={t.id}
        className={`todo ${t.done ? 'done' : ''}`}
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

        <div className="todo-main">
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

          {hasAudio && (
            <button
              type="button"
              className={`todo-audio ${isThisPlaying ? 'on' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                togglePlayAudio(t);
              }}
              aria-label={`${isThisPlaying ? 'Pause' : 'Play'} audio note`}
            >
              <span className="ta-ic">
                {isThisPlaying ? <AudioPauseIcon /> : <AudioPlayIcon />}
              </span>
              <span className="ta-wave" aria-hidden="true">
                <i></i><i></i><i></i><i></i><i></i>
              </span>
              <span className="ta-time">
                {isThisPlaying && playbackCurrentTime > 0
                  ? `${fmtDur(playbackCurrentTime)} / `
                  : ''}
                {fmtDur(t.audio.dur)}
              </span>
            </button>
          )}
        </div>

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
          {sOpen.length > 0 && (
            <div className="group" ref={sOpenGroupRef}>
              {sOpen.map(renderTodoRow)}
            </div>
          )}

          {sOpen.length > 0 && open.length > 0 && <div className="sec-label">Todos</div>}
          {open.length > 0 && (
            <div className="group" ref={openGroupRef}>
              {open.map(renderTodoRow)}
            </div>
          )}

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
                <div className="group" ref={doneGroupRef}>
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
      ) : isRecording ? (
        <div className="composer rec">
          <div className="rec-bar">
            <span className="rec-dot" aria-hidden="true"></span>
            <span className="rec-time" id="recTime">{fmtDur(recordingDuration)}</span>
            <span className="rec-label">Recording audio note…</span>
            <button
              type="button"
              className="pill plain"
              id="recCancel"
              onClick={() => stopRecording(true)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="send rec-stop"
              id="recStop"
              aria-label="Stop recording"
              onClick={() => stopRecording(false)}
            >
              <StopIcon />
            </button>
          </div>
        </div>
      ) : (
        <div className="composer">
          {pendingAudio && (
            <div className="audio-pending">
              <button
                type="button"
                className="ap-play"
                id="apPlay"
                onClick={togglePlayPreview}
                aria-label={isPlayingPreview ? "Pause recording" : "Play recording"}
              >
                {isPlayingPreview ? <AudioPauseIcon /> : <AudioPlayIcon />}
              </button>
              <span className="ap-text">
                <WaveIcon size={18} />
                <b>Audio note</b> · {fmtDur(pendingAudio.dur)}
              </span>
              <span className="ap-hint">Add text (optional), then tap +</span>
              <button
                type="button"
                className="icon-btn"
                id="apRemove"
                onClick={() => {
                  if (pendingAudio.url) URL.revokeObjectURL(pendingAudio.url);
                  previewAudioRef.current?.pause();
                  setIsPlayingPreview(false);
                  setPendingAudio(null);
                }}
                aria-label="Remove audio note"
              >
                <XIcon />
              </button>
            </div>
          )}
          <form onSubmit={handleAddTodo} autoComplete="off">
            <input
              className="input"
              id="newTodo"
              placeholder={pendingAudio ? "Add a title for this audio note" : "Add todo"}
              maxLength={300}
              aria-label="Add todo"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
            />
            <button
              type="button"
              className={`mic ${voiceListening ? 'live' : ''}`}
              id="mic"
              aria-label="Type by voice"
              title="Type by voice"
              onClick={toggleVoice}
            >
              <MicIcon />
            </button>
            <button
              type="button"
              className="mic rec-btn"
              id="recBtn"
              aria-label="Record an audio note"
              title="Record an audio note"
              onClick={startRecording}
            >
              <WaveIcon />
            </button>
            <button type="submit" className="send" aria-label="Add">
              {isSavingAudio ? '…' : <PlusIcon />}
            </button>
          </form>
          <input
            type="file"
            ref={audioInputRef}
            accept="audio/*,video/mp4,video/webm"
            capture="microphone"
            hidden
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = '';
              if (f) attachAudioFile(f);
            }}
          />
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
