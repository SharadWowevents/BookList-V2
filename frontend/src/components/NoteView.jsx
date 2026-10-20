import { useRef, useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { ACCENTS } from '../utils/constants';
import { sharesAPI } from '../services/api';
import {
  parseInk, serializeInk, drawStroke, inkToPng, distSeg, inPoly,
  INK_W, INK_COLORS, HL_COLORS, SIZES, getInkInk
} from '../utils/ink';
import {
  BackIcon, GlobeIcon, ShareIcon, TrashIcon, UndoIcon, RedoIcon,
  ColorIcon, UlIcon, OlIcon, ChecklistIcon, QuoteIcon, CodeIcon,
  HrIcon, LinkIcon, ImageIcon, DrawIcon, AlignLeftIcon, AlignCenterIcon,
  AlignRightIcon, IndentIcon, OutdentIcon, ClearFormatIcon, MicIcon,
  XIcon, DownloadIcon, CopyIcon, PencilIcon, EyeIcon, DoneIcon,
  SketchPencilIcon, MarkerIcon, EraserIcon, LassoIcon, RulerIcon, HandIcon
} from './Icons';

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts), now = new Date();
  const t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(/\s?(AM|PM)$/i, m => m.trim().toLowerCase());
  if (d.toDateString() === now.toDateString()) return t;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "yesterday, " + t;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) }) + ", " + t;
}

const slugify = (t) => (t || "note").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "note";

function shrink(file, max = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

const TEXT_COLORS = [
  ["none", "Default"],
  ["#D2463C", "Red"],
  ["#D9822B", "Orange"],
  ["#2F9E5B", "Green"],
  ["#2F7FD8", "Blue"],
  ["#8A5CD6", "Purple"]
];

const HILITES = [
  ["none", "None"],
  ["rgba(250,204,21,.45)", "Yellow"],
  ["rgba(52,211,153,.38)", "Green"],
  ["rgba(96,165,250,.38)", "Blue"],
  ["rgba(244,114,182,.38)", "Pink"]
];

export const NoteView = () => {
  const {
    board, updateBoard, ui, setUi, session, photo,
    loadNoteBody, saveNoteBody, deleteNoteBody, showToast, accent
  } = useApp();

  const editorRef = useRef(null);
  const titleInputRef = useRef(null);
  const loadedNoteIdRef = useRef(null);
  const imgInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const [wordCount, setWordCount] = useState(0);
  const [showColorBar, setShowColorBar] = useState(false);
  const [showLinkBar, setShowLinkBar] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [dictateHint, setDictateHint] = useState('');
  const [savedRange, setSavedRange] = useState(null);

  // Publish state
  const [gaId, setGaId] = useState(() => localStorage.getItem('listbook:ga') || '');
  const [pubAuthor, setPubAuthor] = useState(() => localStorage.getItem('listbook:pubAuthor') !== 'false');
  const [isPublishing, setIsPublishing] = useState(false);

  // Drawing state
  const activeInkDivRef = useRef(null);
  const [isInkActive, setIsInkActive] = useState(false);
  const [inkTool, setInkTool] = useState('pen');
  const [inkColor, setInkColor] = useState('k');
  const [inkHlColor, setInkHlColor] = useState('y');
  const [inkSize, setInkSize] = useState(1);
  const [inkFinger, setInkFinger] = useState(() => {
    try {
      const f = localStorage.getItem('listbook:fingerDraw');
      return f !== null ? JSON.parse(f) : true;
    } catch {
      return true;
    }
  });
  const [inkUndo, setInkUndo] = useState([]);
  const [inkRedo, setInkRedo] = useState([]);
  const [inkSel, setInkSel] = useState(null);
  const [inkConfirmDel, setInkConfirmDel] = useState(false);

  const activeNote = board.notes.find(n => n.id === board.activeNoteId) || board.notes[0];
  const activeNoteId = activeNote ? activeNote.id : null;

  const isShared = !!activeNote?.shared;
  const isOwn = activeNote?.shared ? !!activeNote.shared.own : true;
  const canEdit = isOwn || (activeNote?.shared?.mode === 'edit');
  const ro = !canEdit;

  const [shareMode, setShareMode] = useState(() => activeNote?.shared?.mode || 'edit');
  const [shareSid, setShareSid] = useState(() => activeNote?.shared?.sid || '');
  const [pubSid, setPubSid] = useState(() => activeNote?.shared?.sid || '');

  useEffect(() => {
    if (activeNote?.shared?.mode) {
      setShareMode(activeNote.shared.mode);
    }
    if (activeNote?.shared?.sid) {
      setShareSid(activeNote.shared.sid);
      setPubSid(activeNote.shared.sid);
    } else {
      setPubSid('');
    }
  }, [activeNote?.id, activeNote?.shared?.mode, activeNote?.shared?.sid]);

  useEffect(() => {
    if (ui.sharing && activeNote?.id && !shareSid) {
      sharesAPI.createShare({ itemId: activeNote.id, kind: 'note', mode: shareMode })
        .then(res => {
          if (res?.sid) {
            setShareSid(res.sid);
            updateBoard({
              notes: board.notes.map(n => n.id === activeNote.id ? {
                ...n,
                shared: { sid: res.sid, mode: res.mode, own: true, ownerName: session?.name || 'You' }
              } : n)
            });
          }
        })
        .catch(() => {});
    }
  }, [ui.sharing, activeNote?.id, shareSid, shareMode, session?.name, updateBoard]);

  // Extract clean HTML (without canvas contents) for storage
  const getEditorHTML = useCallback(() => {
    if (!editorRef.current) return '';
    const clone = editorRef.current.cloneNode(true);
    clone.querySelectorAll('div.ink').forEach(d => {
      d.innerHTML = '';
      d.removeAttribute('contenteditable');
      d.removeAttribute('style');
      d.className = 'ink';
    });
    return clone.innerHTML;
  }, []);

  const handleNoteChanged = useCallback(() => {
    if (!editorRef.current || !activeNoteId) return;
    const html = getEditorHTML();
    saveNoteBody(activeNoteId, html);

    // Update word count
    const words = (editorRef.current.innerText.match(/\S+/g) || []).length;
    setWordCount(words);

    // Check if editor is empty
    const isEmpty = !editorRef.current.textContent.trim() &&
      !editorRef.current.querySelector('li,hr,blockquote,pre,h1,h2,h3,img,div.ink');
    editorRef.current.classList.toggle('is-empty', isEmpty);
  }, [activeNoteId, getEditorHTML, saveNoteBody]);

  // Activate an ink drawing block
  const activateInkBlock = useCallback((div) => {
    if (activeInkDivRef.current && activeInkDivRef.current !== div) {
      activeInkDivRef.current.classList.remove('active');
    }
    activeInkDivRef.current = div;
    setIsInkActive(true);
    div.classList.add('active');
    setInkUndo([]);
    setInkRedo([]);
    setInkSel(null);
    setInkConfirmDel(false);

    const mainEl = document.querySelector('.main');
    if (mainEl) mainEl.classList.add('inking');
  }, []);

  const deactivateInkBlock = useCallback(() => {
    const div = activeInkDivRef.current;
    if (div) {
      div.classList.remove('active');
      const g = div._ctxFor ? div._ctxFor('.ink-live') : null;
      if (g) g.clearRect(0, 0, div.clientWidth, div.clientHeight);
    }
    activeInkDivRef.current = null;
    setIsInkActive(false);
    setInkSel(null);
    setInkConfirmDel(false);
    const mainEl = document.querySelector('.main');
    if (mainEl) mainEl.classList.remove('inking');
    handleNoteChanged();
  }, [handleNoteChanged]);

  // Canvas hydration inside editor
  const hydrateInk = useCallback((ed) => {
    if (!ed) return;
    ed.querySelectorAll('div.ink').forEach(div => {
      if (div._hydrated) return;
      div._hydrated = true;
      div.setAttribute('contenteditable', 'false');
      div.innerHTML = `
        <canvas class="ink-base"></canvas>
        <canvas class="ink-live"></canvas>
        <button type="button" class="ink-edit" title="Draw here" aria-label="Draw in this sketch">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/></svg>
        </button>
        <div class="ink-grow" title="Drag to make the drawing area taller"></div>
      `;

      div._strokes = parseInk(div.getAttribute('data-ink'));
      div._h = parseInt(div.getAttribute('data-h'), 10) || 600;

      const sizeInk = () => {
        const w = div.clientWidth || 600;
        const scale = w / INK_W;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        div._scale = scale;
        div._dpr = dpr;
        const h = Math.round(div._h * scale);
        div.style.height = h + "px";
        div.querySelectorAll("canvas").forEach(c => {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        });
      };

      const ctxFor = (cls) => {
        const c = div.querySelector(cls);
        if (!c) return null;
        const g = c.getContext("2d");
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, c.width, c.height);
        g.setTransform(div._dpr * div._scale, 0, 0, div._dpr * div._scale, 0, 0);
        return g;
      };

      const renderBaseInk = (skip) => {
        const g = ctxFor(".ink-base");
        if (!g) return;
        div._strokes.forEach((st, i) => {
          if (!skip || !skip.has(i)) drawStroke(g, st);
        });
      };

      div._sizeInk = sizeInk;
      div._renderBaseInk = renderBaseInk;
      div._ctxFor = ctxFor;

      sizeInk();
      renderBaseInk();

      // Click edit button
      const editBtn = div.querySelector('.ink-edit');
      if (editBtn) {
        editBtn.onclick = (e) => {
          e.preventDefault();
          activateInkBlock(div);
        };
      }

      // Height grow handle
      const growHandle = div.querySelector('.ink-grow');
      if (growHandle) {
        growHandle.onpointerdown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          try { growHandle.setPointerCapture(e.pointerId); } catch {}
          const y0 = e.clientY;
          const h0 = div._h;

          const onMove = (ev) => {
            div._h = Math.max(200, Math.min(8000, Math.round(h0 + (ev.clientY - y0) / div._scale)));
            sizeInk();
            renderBaseInk();
          };

          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (div._h !== h0) {
              div.setAttribute('data-h', String(div._h));
              handleNoteChanged();
            }
          };

          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        };
      }
    });
  }, [activateInkBlock, handleNoteChanged]);

  // Wire drawing pointer events on activeInkDivRef
  useEffect(() => {
    const div = activeInkDivRef.current;
    if (!div || !isInkActive) return;

    const liveCanvas = div.querySelector('.ink-live');
    if (!liveCanvas) return;

    let cur = null;

    const toUnits = (e) => {
      const r = div.getBoundingClientRect();
      const pr = e.pointerType === "pen" ? Math.round(Math.max(0.05, Math.min(1, e.pressure || 0.5)) * 9) : 5;
      return {
        x: Math.round((e.clientX - r.left) / div._scale),
        y: Math.round((e.clientY - r.top) / div._scale),
        p: pr
      };
    };

    const pushHistory = (snap) => {
      const s = snap || JSON.stringify({ s: div._strokes, h: div._h });
      setInkUndo(prev => [...prev.slice(-80), s]);
      setInkRedo([]);
    };

    const drawLive = () => {
      const g = div._ctxFor(".ink-live");
      if (!g) return;

      if (cur && cur.stroke) {
        drawStroke(g, cur.stroke);
      }

      if (cur && cur.lasso) {
        g.save();
        g.setLineDash([6, 5]);
        g.lineWidth = 1.6;
        g.strokeStyle = getInkInk();
        g.beginPath();
        for (let i = 0; i < cur.lasso.length; i += 2) {
          i ? g.lineTo(cur.lasso[i], cur.lasso[i + 1]) : g.moveTo(cur.lasso[0], cur.lasso[1]);
        }
        g.stroke();
        g.restore();
      }

      if (inkSel) {
        const m = cur && cur.move ? cur.move : { dx: 0, dy: 0 };
        if (cur && cur.move) {
          inkSel.idx.forEach(i => drawStroke(g, div._strokes[i], m.dx, m.dy));
        }
        const b = inkSel.bbox;
        g.save();
        g.setLineDash([7, 5]);
        g.lineWidth = 1.6;
        const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1E6B57';
        g.strokeStyle = acc;
        g.strokeRect(b.x + m.dx, b.y + m.dy, b.w, b.h);
        g.restore();
      }

      if (cur && cur.eraserAt) {
        g.save();
        g.lineWidth = 1.5;
        g.strokeStyle = getInkInk();
        g.globalAlpha = 0.5;
        g.beginPath();
        g.arc(cur.eraserAt.x, cur.eraserAt.y, SIZES.er[inkSize], 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    };

    const eraseAt = (pt) => {
      const r = SIZES.er[inkSize];
      const keep = div._strokes.filter(([, , w, p]) => {
        const n = p.length / 3, rr = r + w / 2;
        for (let i = 0; i < n; i++) {
          if (i && distSeg(pt.x, pt.y, p[(i - 1) * 3], p[(i - 1) * 3 + 1], p[i * 3], p[i * 3 + 1]) < rr) return false;
          if (Math.hypot(pt.x - p[i * 3], pt.y - p[i * 3 + 1]) < rr) return false;
        }
        return true;
      });

      if (keep.length !== div._strokes.length) {
        if (!cur.erased) {
          pushHistory(cur.snap);
          cur.erased = true;
        }
        div._strokes = keep;
        div._renderBaseInk();
      }
    };

    const selectLasso = (poly) => {
      if (poly.length < 6) {
        setInkSel(null);
        return;
      }
      const idx = [];
      div._strokes.forEach((st, i) => {
        const p = st[3], n = p.length / 3;
        let c = 0;
        for (let k = 0; k < n; k++) {
          if (inPoly(p[k * 3], p[k * 3 + 1], poly)) c++;
        }
        if (c / n >= 0.5) idx.push(i);
      });

      if (!idx.length) {
        setInkSel(null);
        return;
      }

      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      idx.forEach(i => {
        const [, , w, p] = div._strokes[i];
        for (let k = 0; k < p.length; k += 3) {
          x0 = Math.min(x0, p[k] - w);
          y0 = Math.min(y0, p[k + 1] - w);
          x1 = Math.max(x1, p[k] + w);
          y1 = Math.max(y1, p[k + 1] + w);
        }
      });
      setInkSel({ idx, bbox: { x: x0 - 6, y: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12 } });
    };

    const onPointerDown = (e) => {
      if (e.pointerType === 'touch' && !inkFinger) return;
      e.preventDefault();
      try { liveCanvas.setPointerCapture(e.pointerId); } catch {}

      const pt = toUnits(e);
      const snap = JSON.stringify({ s: div._strokes, h: div._h });
      cur = { id: e.pointerId, snap };

      if (inkTool === 'er') {
        cur.eraserAt = pt;
        eraseAt(pt);
      } else if (inkTool === 'lasso') {
        const b = inkSel && inkSel.bbox;
        if (b && pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
          cur.move = { x0: pt.x, y0: pt.y, dx: 0, dy: 0 };
          div._renderBaseInk(new Set(inkSel.idx));
        } else {
          setInkSel(null);
          cur.lasso = [pt.x, pt.y];
        }
      } else {
        const col = inkTool === 'hl' ? inkHlColor : inkColor;
        cur.stroke = [inkTool, col, SIZES[inkTool][inkSize], [pt.x, pt.y, pt.p]];
      }
      drawLive();
    };

    const onPointerMove = (e) => {
      if (!cur || e.pointerId !== cur.id) return;
      e.preventDefault();

      const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
      for (const ev of evs) {
        const pt = toUnits(ev);
        if (inkTool === 'er') {
          cur.eraserAt = pt;
          eraseAt(pt);
        } else if (cur.lasso) {
          cur.lasso.push(pt.x, pt.y);
        } else if (cur.move) {
          cur.move.dx = pt.x - cur.move.x0;
          cur.move.dy = pt.y - cur.move.y0;
        } else if (cur.stroke) {
          const p = cur.stroke[3];
          if (cur.stroke[0] === 'ln') {
            p.length = 3;
            p.push(pt.x, pt.y, pt.p);
          } else {
            const lx = p[p.length - 3], ly = p[p.length - 2];
            if (Math.hypot(pt.x - lx, pt.y - ly) >= 1.5) {
              p.push(pt.x, pt.y, pt.p);
            }
          }
        }
      }
      drawLive();
    };

    const onPointerUp = () => {
      if (!cur) return;
      const c = cur;
      cur = null;

      if (c.stroke) {
        pushHistory(c.snap);
        div._strokes.push(c.stroke);
        div._renderBaseInk();
        div.setAttribute('data-ink', serializeInk(div._strokes));
        handleNoteChanged();
      } else if (c.lasso) {
        selectLasso(c.lasso);
      } else if (c.move) {
        const { dx, dy } = c.move;
        if (dx || dy) {
          pushHistory(c.snap);
          inkSel.idx.forEach(i => {
            const p = div._strokes[i][3];
            for (let k = 0; k < p.length; k += 3) {
              p[k] += dx;
              p[k + 1] += dy;
            }
          });
          const newBbox = {
            ...inkSel.bbox,
            x: inkSel.bbox.x + dx,
            y: inkSel.bbox.y + dy
          };
          setInkSel(prev => ({ ...prev, bbox: newBbox }));
          div.setAttribute('data-ink', serializeInk(div._strokes));
          handleNoteChanged();
        }
        div._renderBaseInk();
      } else if (c.erased) {
        div.setAttribute('data-ink', serializeInk(div._strokes));
        handleNoteChanged();
      }
      drawLive();
    };

    liveCanvas.addEventListener('pointerdown', onPointerDown);
    liveCanvas.addEventListener('pointermove', onPointerMove);
    liveCanvas.addEventListener('pointerup', onPointerUp);
    liveCanvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      liveCanvas.removeEventListener('pointerdown', onPointerDown);
      liveCanvas.removeEventListener('pointermove', onPointerMove);
      liveCanvas.removeEventListener('pointerup', onPointerUp);
      liveCanvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isInkActive, inkTool, inkColor, inkHlColor, inkSize, inkFinger, inkSel, handleNoteChanged]);

  // Focus title automatically if newly created note with no title
  useEffect(() => {
    if (activeNote && !activeNote.title && !ro) {
      titleInputRef.current?.focus();
    }
  }, [activeNoteId]);

  // Load active note body ONLY when switching to a different note
  useEffect(() => {
    if (!activeNoteId || !editorRef.current) return;
    if (loadedNoteIdRef.current === activeNoteId) return;
    loadedNoteIdRef.current = activeNoteId;

    const body = loadNoteBody(activeNoteId);
    editorRef.current.innerHTML = body.html || '';
    hydrateInk(editorRef.current);

    const words = (editorRef.current.innerText.match(/\S+/g) || []).length;
    setWordCount(words);

    const isEmpty = !editorRef.current.textContent.trim() &&
      !editorRef.current.querySelector('li,hr,blockquote,pre,h1,h2,h3,img,div.ink');
    editorRef.current.classList.toggle('is-empty', isEmpty);
  }, [activeNoteId, loadNoteBody, hydrateInk]);

  // Handle checklist item toggles
  useEffect(() => {
    const edEl = editorRef.current;
    if (!edEl) return;

    const handleChecklistClick = (e) => {
      const li = e.target.closest && e.target.closest('ul.checklist > li');
      if (!li || !edEl.contains(li) || e.target !== li) return;
      const r = li.getBoundingClientRect();
      if (e.clientX - r.left < 32 && e.clientY - r.top < 34) {
        li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
        handleNoteChanged();
      }
    };

    edEl.addEventListener('click', handleChecklistClick);
    return () => edEl.removeEventListener('click', handleChecklistClick);
  }, [handleNoteChanged]);

  if (!activeNote) {
    return (
      <>
        <div className="main-head">
          <button className="icon-btn back" onClick={() => setUi(prev => ({ ...prev, viewing: false }))}>
            <BackIcon />
          </button>
        </div>
        <p className="empty" style={{ paddingLeft: '24px' }}>
          Tap the new-note icon to start writing.
        </p>
      </>
    );
  }

  const exec = (cmd, val = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand(cmd, false, val);
    handleNoteChanged();
  };

  const execBlock = (tag) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    let cur = '';
    try { cur = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, ''); } catch {}
    document.execCommand('formatBlock', false, cur === tag && tag !== 'p' ? '<p>' : `<${tag}>`);
    handleNoteChanged();
  };

  const toggleChecklist = () => {
    exec('defaultParagraphSeparator', 'p');
    exec('insertUnorderedList');
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (sel.rangeCount) {
      let n = sel.anchorNode;
      if (n && n.nodeType !== 1) n = n.parentElement;
      const ul = n && n.closest('ul');
      if (ul) {
        ul.classList.toggle('checklist');
        ul.querySelectorAll('li:not([data-checked])').forEach(li => li.setAttribute('data-checked', 'false'));
      }
    }
    handleNoteChanged();
  };

  const handleApplyColor = (kind, val) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const cmd = kind === 'fore' ? 'foreColor' : 'hiliteColor';
    document.execCommand('styleWithCSS', false, true);
    if (val === 'none') {
      document.execCommand(cmd, false, '#010203');
      editorRef.current.querySelectorAll('[style],font[color]').forEach(el => {
        if (el.tagName === 'FONT' && el.getAttribute('color') === '#010203') {
          el.replaceWith(...el.childNodes);
          return;
        }
        const v = (el.style.getPropertyValue(kind === 'fore' ? 'color' : 'background-color') || '').replace(/\s/g, '');
        if (v === 'rgb(1,2,3)') {
          el.style.removeProperty(kind === 'fore' ? 'color' : 'background-color');
          if (!el.getAttribute('style').trim()) {
            el.removeAttribute('style');
            if (el.tagName === 'SPAN') el.replaceWith(...el.childNodes);
          }
        }
      });
    } else {
      document.execCommand(cmd, false, val);
    }
    document.execCommand('styleWithCSS', false, false);
    handleNoteChanged();
  };

  const handleOpenLinkBar = () => {
    if (showLinkBar) {
      setShowLinkBar(false);
      return;
    }
    setShowColorBar(false);
    const sel = window.getSelection();
    if (sel.rangeCount && editorRef.current.contains(sel.anchorNode)) {
      setSavedRange(sel.getRangeAt(0).cloneRange());
      const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      const a = node && node.closest('#editor a');
      setLinkUrl(a ? a.getAttribute('href') : '');
    }
    setShowLinkBar(true);
  };

  const handleApplyLink = (e) => {
    e.preventDefault();
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^(https?:|mailto:)/i.test(url)) {
      url = (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url) ? "mailto:" : "https://") + url;
    }
    editorRef.current.focus();
    const sel = window.getSelection();
    if (savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    if (sel.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${url.replace(/^mailto:/, '')}</a>&nbsp;`);
    } else {
      document.execCommand('createLink', false, url);
      editorRef.current.querySelectorAll('a').forEach(a => {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      });
    }
    setShowLinkBar(false);
    handleNoteChanged();
  };

  const handleUnlink = () => {
    editorRef.current.focus();
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    document.execCommand('unlink');
    setShowLinkBar(false);
    handleNoteChanged();
  };

  // Insert image
  const handleInsertImages = async (e) => {
    const files = [...(e.target.files || [])].filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;

    showToast(files.length > 1 ? `Adding ${files.length} images…` : 'Adding image…', 15000);
    let added = 0;
    for (const f of files) {
      try {
        const src = await shrink(f, 1400, 0.72);
        editorRef.current.focus();
        document.execCommand('insertHTML', false, `<img src="${src}" alt="" /><p><br></p>`);
        added++;
        handleNoteChanged();
      } catch {
        showToast("Couldn't add image.");
      }
    }
    if (added) showToast(added > 1 ? `${added} images added.` : 'Image added.');
  };

  // Insert drawing
  const handleInsertDrawing = () => {
    editorRef.current.focus();
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand('insertHTML', false, `<div class="ink" data-h="600" data-ink='${serializeInk([])}'></div><p><br></p>`);
    hydrateInk(editorRef.current);
    handleNoteChanged();

    // Auto-activate the newly added ink block
    const all = editorRef.current.querySelectorAll('div.ink');
    const newlyAdded = all[all.length - 1];
    if (newlyAdded) {
      activateInkBlock(newlyAdded);
      newlyAdded.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  // Voice dictation
  const toggleDictation = () => {
    if (isDictating && recognitionRef.current) {
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
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      setIsDictating(true);
      setDictateHint('Listening… tap mic again to stop.');
    };

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          let text = r[0].transcript.trim();
          if (!text) continue;
          editorRef.current.focus();
          const sel = window.getSelection();
          const node = sel.anchorNode;
          const off = sel.anchorOffset;
          const before = node && node.nodeType === 3 ? node.textContent.slice(0, off) : '';
          if (!before || /[.!?]\s*$/.test(before)) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
          }
          document.execCommand('insertText', false, (before && !/\s$/.test(before) ? ' ' : '') + text + ' ');
          handleNoteChanged();
        } else {
          interim += r[0].transcript;
        }
      }
      setDictateHint(interim ? `Listening… ${interim}` : 'Listening… tap mic again to stop.');
    };

    rec.onerror = (ev) => {
      if (ev.error !== 'aborted') showToast('Voice input stopped.');
    };

    rec.onend = () => {
      setIsDictating(false);
      setDictateHint('');
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      showToast("Couldn't start microphone.");
    }
  };

  // Delete note
  const handleDeleteNote = () => {
    const title = activeNote.title || 'Untitled note';
    const isSharedNonOwner = isShared && !isOwn;

    if (shareSid && isOwn) {
      sharesAPI.deleteShare(shareSid).catch(() => {});
    }

    if (!isSharedNonOwner) {
      deleteNoteBody(activeNote.id);
    }

    const remaining = board.notes.filter(n => n.id !== activeNote.id);
    const nextActive = remaining[0] ? remaining[0].id : null;
    updateBoard({
      notes: remaining,
      activeNoteId: nextActive
    });
    setUi(prev => ({ ...prev, confirm: false, viewing: false }));
    showToast(isSharedNonOwner ? 'Removed from your notes.' : `Note “${title}” deleted.`);
  };

  // Publish note as standalone web page
  const handlePublishNote = async () => {
    setIsPublishing(true);
    try {
      const clone = editorRef.current.cloneNode(true);
      clone.querySelectorAll('div.ink').forEach(d => {
        const raw = d.getAttribute('data-ink') || '';
        const h = parseInt(d.getAttribute('data-h'), 10) || 600;
        const png = inkToPng(raw, h);
        if (png) {
          const fig = document.createElement('figure');
          fig.className = 'ink';
          const im = document.createElement('img');
          im.src = png;
          im.alt = 'Drawing';
          fig.appendChild(im);
          d.replaceWith(fig);
        } else {
          d.remove();
        }
      });

      const bodyHtml = clone.innerHTML;
      const title = (activeNote.title || 'Untitled note').trim();
      const desc = (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      const name = session?.name || 'You';
      const when = fmtTime(Date.now());
      const accentL = ACCENTS[accent] ? ACCENTS[accent].l : '#1E6B57';
      const accentD = ACCENTS[accent] ? ACCENTS[accent].d : '#4FB394';

      const gaScript = gaId ? `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
        <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${gaId}");</script>
      ` : '';

      const avatarHtml = photo
        ? `<img class="av" src="${photo}" alt="" />`
        : `<span class="av">${name.trim().charAt(0).toUpperCase()}</span>`;

      const fullHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title><meta name="description" content="${desc}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:type" content="article">
${gaScript}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@600;700&family=Figtree:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<style>
:root{--bg:#F5F6F4;--panel:#fff;--ink:#16191A;--muted:#6B7270;--line:#E2E5E2;--soft:#ECEFEC;--accent:${accentL};--accent-ink:#fff;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0F1211;--panel:#171B1A;--ink:#EEF1EF;--muted:#97A09C;--line:#2A302E;--soft:#222826;--accent:${accentD};--accent-ink:#0B0F12;color-scheme:dark}}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:400 1.15rem/1.7 "Figtree","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:760px;margin:0 auto;padding:48px max(20px,env(safe-area-inset-right)) 64px max(20px,env(safe-area-inset-left))}
h1.t{font:700 clamp(2.2rem,6vw,3.2rem)/1.08 "Familjen Grotesk","Helvetica Neue",Arial,sans-serif;letter-spacing:-.03em;margin:0 0 14px;text-wrap:balance}
.by{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:1.02rem;margin-bottom:36px}.by b{color:var(--ink);font-weight:600}
.av{width:40px;height:40px;border-radius:50%;object-fit:cover;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink);font:700 1.05rem "Familjen Grotesk",sans-serif;flex:none}
article{overflow-wrap:anywhere}
article h1,article h2,article h3{font-family:"Familjen Grotesk","Helvetica Neue",Arial,sans-serif;letter-spacing:-.02em;line-height:1.18;text-wrap:balance}
article h1{font-size:2rem;margin:1.2em 0 .4em}article h2{font-size:1.6rem;margin:1.1em 0 .35em}article h3{font-size:1.3rem;margin:1em 0 .3em}
article p,article div{margin:0 0 .7em}article ul,article ol{padding-left:1.4em}article li{margin:.2em 0}
article blockquote{margin:.8em 0;padding:.1em 0 .1em 18px;border-left:3px solid var(--accent);color:var(--muted)}
article pre{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:1rem;background:var(--soft);padding:14px 16px;border-radius:12px;white-space:pre-wrap}
article a{color:var(--accent)}article hr{border:0;border-top:1.5px solid var(--line);margin:1.6em 0}
article img{display:block;max-width:100%;height:auto;border-radius:14px;margin:1em 0}
article figure.ink{margin:1em 0}article figure.ink img{background:#fff;border:1px solid var(--line);margin:0}
article ul.checklist{list-style:none;padding-left:0}article ul.checklist ul.checklist{padding-left:1.2em}
article ul.checklist>li{position:relative;padding-left:36px}
article ul.checklist>li::before{content:"";position:absolute;left:1px;top:.25em;width:22px;height:22px;box-sizing:border-box;border:2px solid var(--line);border-radius:7px;background:var(--panel)}
article ul.checklist>li[data-checked="true"]::before{background:var(--accent);border-color:var(--accent)}
article ul.checklist>li[data-checked="true"]::after{content:"";position:absolute;left:9px;top:calc(.25em + 4px);width:6px;height:11px;border:solid var(--accent-ink);border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
article ul.checklist>li[data-checked="true"]{color:var(--muted);text-decoration:line-through}
footer{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
</style></head>
<body><main>
<h1 class="t">${title}</h1>
${pubAuthor ? `<div class="by">${avatarHtml}<span><b>${name}</b>${when ? ` • Last updated ${when}` : ''}</span></div>` : ''}
<article>${bodyHtml}</article>
<footer>Published with MyDeepwork</footer>
</main></body></html>`;

      const filename = slugify(title) + '.html';
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);

      showToast('Web page downloaded.');
      setUi(prev => ({ ...prev, publishing: false }));
    } catch {
      showToast("Couldn't build web page. Try again.");
    }
    setIsPublishing(false);
  };

  const handleCreatePublicLink = async () => {
    setIsPublishing(true);
    try {
      let sid = shareSid || activeNote?.shared?.sid;
      if (!sid) {
        const res = await sharesAPI.createShare({
          itemId: activeNote.id,
          kind: 'note',
          mode: 'view'
        });
        sid = res.sid;
        setShareSid(sid);
      }
      setPubSid(sid);
      updateBoard({
        notes: board.notes.map(n => n.id === activeNote.id ? {
          ...n,
          shared: { ...(n.shared || {}), sid, mode: n.shared?.mode || 'view', own: true, isPublic: true, ownerName: session?.name || 'You' }
        } : n)
      });
      showToast('Public view link created!');
    } catch {
      showToast("Couldn't create public link.");
    } finally {
      setIsPublishing(false);
    }
  };

  const copyPublicLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#p.${pubSid}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Public link copied to clipboard.');
    } catch {
      showToast('Link: ' + url);
    }
  };

  const handleStopPublishing = async () => {
    try {
      if (pubSid) {
        await sharesAPI.deleteShare(pubSid);
      }
    } catch {}
    setPubSid('');
    setShareSid('');
    updateBoard({
      notes: board.notes.map(n => n.id === activeNote.id ? { ...n, shared: null } : n)
    });
    setUi(prev => ({ ...prev, publishing: false }));
    showToast("Public link removed. Document is private again.");
  };

  const handleShareModeChange = async (newMode) => {
    setShareMode(newMode);
    try {
      if (shareSid) {
        await sharesAPI.updateShare(shareSid, { mode: newMode });
      } else {
        const res = await sharesAPI.createShare({ itemId: activeNote.id, kind: 'note', mode: newMode });
        if (res?.sid) setShareSid(res.sid);
      }
      updateBoard({
        notes: board.notes.map(n => n.id === activeNote.id ? {
          ...n,
          shared: { ...(n.shared || {}), sid: shareSid || n.shared?.sid, mode: newMode, own: true }
        } : n)
      });
      showToast(newMode === 'edit' ? 'People with the link can now edit.' : 'People with the link can now only view.');
    } catch {
      showToast(newMode === 'edit' ? 'People with the link can edit.' : 'People with the link can view only.');
    }
  };

  const handleStopSharing = async () => {
    try {
      if (shareSid) {
        await sharesAPI.deleteShare(shareSid);
      }
    } catch {}
    setShareSid('');
    updateBoard({
      notes: board.notes.map(n => n.id === activeNote.id ? { ...n, shared: null } : n)
    });
    setUi(prev => ({ ...prev, sharing: false }));
    showToast("Sharing stopped. It's private again.");
  };

  const copyNoteShareLink = async () => {
    try {
      let sid = shareSid;
      if (!sid) {
        const res = await sharesAPI.createShare({ itemId: activeNote.id, kind: 'note', mode: shareMode });
        sid = res.sid;
        setShareSid(sid);
        updateBoard({
          notes: board.notes.map(n => n.id === activeNote.id ? {
            ...n,
            shared: { sid: res.sid, mode: res.mode, own: true, ownerName: session?.name || 'You' }
          } : n)
        });
      }
      const url = `${window.location.origin}${window.location.pathname}#s.${sid}`;
      await navigator.clipboard.writeText(url);
      showToast('Share link copied.');
    } catch {
      const url = `${window.location.origin}${window.location.pathname}#s.local.${activeNote.id}`;
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
    : `${window.location.origin}${window.location.pathname}#s.local.${activeNote?.id}`;

  const renderAvatar = () => {
    if (photo) {
      return (
        <span className="avatar sm">
          <img src={photo} alt="" />
        </span>
      );
    }
    const letter = (session?.name || 'Y').trim().charAt(0).toUpperCase();
    return <span className="avatar sm">{letter}</span>;
  };

  const activeInkDiv = activeInkDivRef.current;

  return (
    <>
      <div className="main-head">
        <button
          type="button"
          className="icon-btn back"
          id="back"
          aria-label="Back to notes"
          onClick={() => setUi(prev => ({ ...prev, viewing: false }))}
        >
          <BackIcon />
        </button>
        <div className="title-wrap">
          <input
            ref={titleInputRef}
            className="title"
            id="noteTitle"
            value={activeNote.title || ''}
            placeholder="Untitled note"
            aria-label="Note title"
            maxLength={80}
            readOnly={ro}
            onChange={(e) => {
              if (ro) return;
              const val = e.target.value;
              updateBoard({
                notes: board.notes.map(n => n.id === activeNote.id ? { ...n, title: val } : n)
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                titleInputRef.current?.blur();
                editorRef.current?.focus();
              }
            }}
          />
          <div className="byline">
            {renderAvatar()}
            <span className="txt">
              <b>{activeNote.shared?.ownerName || session?.name || 'You'}</b>
              {ro ? '' : ` • ${dictateHint || `${wordCount} word${wordCount === 1 ? '' : 's'}`}`}
            </span>
            {isShared && (
              <span className="share-chip">
                {activeNote.shared.mode === 'edit' ? <PencilIcon /> : <EyeIcon />}
                {activeNote.shared.own ? 'Shared' : (activeNote.shared.mode === 'edit' ? 'Can edit' : 'View only')}
              </span>
            )}
          </div>
        </div>
        <div className="head-actions">
          {isOwn && (
            <button
              type="button"
              className={`icon-btn ${ui.publishing || activeNote?.shared?.isPublic || pubSid ? 'shared-on' : ''}`}
              id="publishBtn"
              title={pubSid ? "Public view link (active)" : "Public view link"}
              aria-label="Public view link"
              onClick={() => setUi(prev => ({ ...prev, publishing: !prev.publishing, sharing: false, confirm: false }))}
            >
              <GlobeIcon />
            </button>
          )}
          <button
            type="button"
            className={`icon-btn ${isShared || ui.sharing ? 'shared-on' : ''}`}
            id="shareBtn"
            title="Share"
            aria-label="Share note"
            onClick={() => setUi(prev => ({ ...prev, sharing: !prev.sharing, publishing: false, confirm: false }))}
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            id="askDelete"
            title={isShared && !isOwn ? "Remove from my notes" : "Delete note"}
            aria-label={isShared && !isOwn ? "Remove from my notes" : "Delete note"}
            onClick={() => setUi(prev => ({ ...prev, confirm: !prev.confirm, sharing: false, publishing: false }))}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {ui.publishing && isOwn && (
        <div className="sheet" id="publishSheet">
          <div className="sheet-top">
            Public view link
            <button
              type="button"
              className="icon-btn"
              onClick={() => setUi(prev => ({ ...prev, publishing: false }))}
              aria-label="Close"
            >
              <XIcon />
            </button>
          </div>
          <p>
            Publishes this note to a public view link that anyone can open in any browser, no login needed.
          </p>

          {pubSid ? (
            <>
              <div className="link-row" style={{ marginTop: '12px' }}>
                <input
                  className="input"
                  readOnly
                  value={`${window.location.origin}${window.location.pathname}#p.${pubSid}`}
                  aria-label="Public view link"
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="pill ink"
                  onClick={copyPublicLink}
                  title="Copy public link"
                  aria-label="Copy public link"
                >
                  <CopyIcon />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                <a
                  href={`${window.location.origin}${window.location.pathname}#p.${pubSid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pill plain"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <EyeIcon size={14} /> Open public page
                </a>
                <button
                  type="button"
                  className="text-btn danger"
                  onClick={handleStopPublishing}
                  style={{ marginLeft: 'auto' }}
                >
                  Stop publishing
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="pill ink pub-go"
              id="doPublish"
              disabled={isPublishing}
              onClick={handleCreatePublicLink}
              style={{ marginTop: '8px' }}
            >
              <GlobeIcon />
              <span>{isPublishing ? 'Creating link…' : 'Create public view link'}</span>
            </button>
          )}

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
            <div className="field">
              <label htmlFor="gaId">Google Analytics ID for view counts (optional)</label>
              <input
                className="input"
                id="gaId"
                placeholder="G-XXXXXXXXXX"
                value={gaId}
                onChange={(e) => {
                  setGaId(e.target.value.toUpperCase());
                  localStorage.setItem('listbook:ga', e.target.value.toUpperCase());
                }}
              />
            </div>
            <label className="chk">
              <input
                type="checkbox"
                id="pubAuthor"
                checked={pubAuthor}
                onChange={(e) => {
                  setPubAuthor(e.target.checked);
                  localStorage.setItem('listbook:pubAuthor', JSON.stringify(e.target.checked));
                }}
              />
              Show my name, photo and last-updated time
            </label>
            <div style={{ marginTop: '14px' }}>
              <button
                type="button"
                className="pill plain"
                style={{ fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={handlePublishNote}
                title="Download an offline copy as an HTML file"
              >
                <DownloadIcon size={14} /> Download offline HTML backup
              </button>
            </div>
          </div>
        </div>
      )}

      {ui.sharing && (
        <div className="sheet">
          <div className="sheet-top">
            {isShared && !isOwn ? (
              <span className="byline">
                {renderAvatar()}
                <span className="txt">Shared by {activeNote.shared?.ownerName || 'Someone'}</span>
              </span>
            ) : (
              'Share this note'
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
              {activeNote.shared?.mode === 'edit'
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
              readOnly
              value={shareUrl}
              aria-label="Share link"
            />
            <button
              type="button"
              className="pill ink"
              onClick={copyNoteShareLink}
              aria-label="Copy link"
            >
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
              ? `Remove “${activeNote.title || 'Untitled note'}” from your notes? The owner keeps it.`
              : `Delete “${activeNote.title || 'Untitled note'}”? This can't be undone.${isShared ? ' It will disappear for everyone it’s shared with.' : ''}`}
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
            onClick={handleDeleteNote}
          >
            {isShared && !isOwn ? 'Remove' : 'Delete note'}
          </button>
        </div>
      )}

      {!ro && (
        <div className="toolbar" id="toolbar" role="toolbar" aria-label="Formatting">
          <button type="button" className="tb" title="Undo" onClick={() => exec('undo')}><UndoIcon /></button>
          <button type="button" className="tb" title="Redo" onClick={() => exec('redo')}><RedoIcon /></button>
          <span className="sep" aria-hidden="true"></span>
          <button type="button" className="tb" title="Body text" onClick={() => execBlock('p')}><span className="tt">T</span></button>
          <button type="button" className="tb" title="Heading 1" onClick={() => execBlock('h1')}><span className="tt">H1</span></button>
          <button type="button" className="tb" title="Heading 2" onClick={() => execBlock('h2')}><span className="tt">H2</span></button>
        <button type="button" className="tb" title="Heading 3" onClick={() => execBlock('h3')}><span className="tt">H3</span></button>
        <span className="sep" aria-hidden="true"></span>
        <button type="button" className="tb" title="Bold" onClick={() => exec('bold')}><b className="tt">B</b></button>
        <button type="button" className="tb" title="Italic" onClick={() => exec('italic')}><i className="tt serif">I</i></button>
        <button type="button" className="tb" title="Underline" onClick={() => exec('underline')}><u className="tt">U</u></button>
        <button type="button" className="tb" title="Strikethrough" onClick={() => exec('strikeThrough')}><s className="tt">S</s></button>
        <button type="button" className={`tb ${showColorBar ? 'on' : ''}`} title="Text color and highlight" onClick={() => { setShowColorBar(!showColorBar); setShowLinkBar(false); }}><ColorIcon /></button>
        <span className="sep" aria-hidden="true"></span>
        <button type="button" className="tb" title="Bulleted list" onClick={() => exec('insertUnorderedList')}><UlIcon /></button>
        <button type="button" className="tb" title="Numbered list" onClick={() => exec('insertOrderedList')}><OlIcon /></button>
        <button type="button" className="tb" title="Checklist" onClick={toggleChecklist}><ChecklistIcon /></button>
        <button type="button" className="tb" title="Quote" onClick={() => execBlock('blockquote')}><QuoteIcon /></button>
        <button type="button" className="tb" title="Code block" onClick={() => execBlock('pre')}><CodeIcon /></button>
        <button type="button" className="tb" title="Divider" onClick={() => exec('insertHorizontalRule')}><HrIcon /></button>
        <button type="button" className={`tb ${showLinkBar ? 'on' : ''}`} title="Link" onClick={handleOpenLinkBar}><LinkIcon /></button>
        <button type="button" className="tb" title="Insert image" onClick={() => imgInputRef.current && imgInputRef.current.click()}><ImageIcon /></button>
        <button type="button" className="tb" title="Draw or handwrite" onClick={handleInsertDrawing}><DrawIcon /></button>
        <span className="sep" aria-hidden="true"></span>
        <button type="button" className="tb" title="Align left" onClick={() => exec('justifyLeft')}><AlignLeftIcon /></button>
        <button type="button" className="tb" title="Align center" onClick={() => exec('justifyCenter')}><AlignCenterIcon /></button>
        <button type="button" className="tb" title="Align right" onClick={() => exec('justifyRight')}><AlignRightIcon /></button>
        <button type="button" className="tb" title="Decrease indent" onClick={() => exec('outdent')}><OutdentIcon /></button>
        <button type="button" className="tb" title="Increase indent" onClick={() => exec('indent')}><IndentIcon /></button>
        <span className="sep" aria-hidden="true"></span>
        <button type="button" className="tb" title="Clear formatting" onClick={() => { exec('removeFormat'); exec('unlink'); }}><ClearFormatIcon /></button>
        <button type="button" className={`tb ${isDictating ? 'live' : ''}`} title="Dictate into note" onClick={toggleDictation}><MicIcon size={20} /></button>
      </div>
      )}

      {!ro && showColorBar && (
        <div className="subbar" id="colorbar">
          <div className="sw-row">
            <span className="lbl">Text</span>
            {TEXT_COLORS.map(([c, l]) => (
              <button
                key={c}
                type="button"
                className="sw"
                title={l}
                aria-label={`Text color ${l}`}
                style={c === 'none' ? {} : { color: c }}
                onClick={() => handleApplyColor('fore', c)}
              >
                A
              </button>
            ))}
          </div>
          <div className="sw-row">
            <span className="lbl">Highlight</span>
            {HILITES.map(([c, l]) => (
              <button
                key={c}
                type="button"
                className="sw"
                title={l}
                aria-label={`Highlight ${l}`}
                style={c === 'none' ? {} : { background: c }}
                onClick={() => handleApplyColor('hilite', c)}
              >
                {c === 'none' ? <XIcon size={16} /> : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {!ro && showLinkBar && (
        <form className="subbar" id="linkbar" onSubmit={handleApplyLink} autoComplete="off">
          <input
            ref={linkInputRef}
            className="input"
            id="linkUrl"
            placeholder="Paste a link, e.g. drive.google.com/…"
            aria-label="Link address"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            autoFocus
          />
          <button className="pill ink" type="submit">Apply</button>
          <button className="pill plain" type="button" onClick={handleUnlink}>Remove link</button>
        </form>
      )}

      {!ro && (
        <input
          ref={imgInputRef}
          type="file"
          id="imgInput"
          accept="image/*"
          multiple
          hidden
          onChange={handleInsertImages}
        />
      )}

      {/* Floating Ink Bar when a drawing is active */}
      {!ro && isInkActive && (
        <div className="inkbar" id="inkbar" role="toolbar" aria-label="Drawing tools">
          <button
            type="button"
            className={`tb ${inkTool === 'pen' ? 'on' : ''}`}
            title="Pen"
            onClick={() => { setInkTool('pen'); setInkSel(null); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/></svg>
          </button>
          <button
            type="button"
            className={`tb ${inkTool === 'pcl' ? 'on' : ''}`}
            title="Pencil"
            onClick={() => { setInkTool('pcl'); setInkSel(null); }}
          >
            <SketchPencilIcon />
          </button>
          <button
            type="button"
            className={`tb ${inkTool === 'hl' ? 'on' : ''}`}
            title="Highlighter"
            onClick={() => { setInkTool('hl'); setInkSel(null); }}
          >
            <MarkerIcon />
          </button>
          <button
            type="button"
            className={`tb ${inkTool === 'er' ? 'on' : ''}`}
            title="Eraser"
            onClick={() => { setInkTool('er'); setInkSel(null); }}
          >
            <EraserIcon />
          </button>
          <button
            type="button"
            className={`tb ${inkTool === 'lasso' ? 'on' : ''}`}
            title="Lasso select"
            onClick={() => setInkTool('lasso')}
          >
            <LassoIcon />
          </button>
          <button
            type="button"
            className={`tb ${inkTool === 'ln' ? 'on' : ''}`}
            title="Straight line"
            onClick={() => { setInkTool('ln'); setInkSel(null); }}
          >
            <RulerIcon />
          </button>

          {inkTool !== 'er' && (
            <>
              <span className="sep"></span>
              {(inkTool === 'hl' ? Object.keys(HL_COLORS) : Object.keys(INK_COLORS)).map(k => (
                <button
                  key={k}
                  type="button"
                  className={`ink-sw ${(inkTool === 'hl' ? inkHlColor === k : inkColor === k) ? 'on' : ''}`}
                  style={{ background: inkTool === 'hl' ? HL_COLORS[k] : (INK_COLORS[k] || 'var(--ink)') }}
                  onClick={() => {
                    if (inkTool === 'hl') setInkHlColor(k);
                    else setInkColor(k);
                  }}
                />
              ))}
            </>
          )}

          {inkTool !== 'lasso' && (
            <>
              <span className="sep"></span>
              {[0, 1, 2].map(i => {
                const d = Math.max(4, Math.min(18, inkTool === 'hl' ? 7 + i * 5 : inkTool === 'er' ? 6 + i * 5 : 4 + i * 4));
                return (
                  <button
                    key={i}
                    type="button"
                    className={`ink-size ${inkSize === i ? 'on' : ''}`}
                    onClick={() => setInkSize(i)}
                  >
                    <i style={{ width: `${d}px`, height: `${d}px` }} />
                  </button>
                );
              })}
            </>
          )}

          <span className="sep"></span>
          <button
            type="button"
            className="tb"
            disabled={!inkUndo.length}
            title="Undo"
            onClick={() => {
              if (!inkUndo.length || !activeInkDiv) return;
              const snap = inkUndo[inkUndo.length - 1];
              setInkUndo(prev => prev.slice(0, -1));
              setInkRedo(prev => [...prev, JSON.stringify({ s: activeInkDiv._strokes, h: activeInkDiv._h })]);
              const d = JSON.parse(snap);
              activeInkDiv._strokes = d.s;
              activeInkDiv._h = d.h;
              activeInkDiv._sizeInk();
              activeInkDiv._renderBaseInk();
              activeInkDiv.setAttribute('data-ink', serializeInk(d.s));
              handleNoteChanged();
            }}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="tb"
            disabled={!inkRedo.length}
            title="Redo"
            onClick={() => {
              if (!inkRedo.length || !activeInkDiv) return;
              const snap = inkRedo[inkRedo.length - 1];
              setInkRedo(prev => prev.slice(0, -1));
              setInkUndo(prev => [...prev, JSON.stringify({ s: activeInkDiv._strokes, h: activeInkDiv._h })]);
              const d = JSON.parse(snap);
              activeInkDiv._strokes = d.s;
              activeInkDiv._h = d.h;
              activeInkDiv._sizeInk();
              activeInkDiv._renderBaseInk();
              activeInkDiv.setAttribute('data-ink', serializeInk(d.s));
              handleNoteChanged();
            }}
          >
            <RedoIcon />
          </button>

          {inkSel && (
            <button
              type="button"
              className="tb"
              title="Delete selection"
              onClick={() => {
                if (!inkSel || !activeInkDiv) return;
                const s = new Set(inkSel.idx);
                activeInkDiv._strokes = activeInkDiv._strokes.filter((_, i) => !s.has(i));
                setInkSel(null);
                activeInkDiv._renderBaseInk();
                activeInkDiv.setAttribute('data-ink', serializeInk(activeInkDiv._strokes));
                handleNoteChanged();
              }}
            >
              <TrashIcon />
            </button>
          )}

          <button
            type="button"
            className={`tb ${inkFinger ? 'on' : ''}`}
            title={inkFinger ? "Finger draws (tap to scroll)" : "Finger scrolls (tap to draw)"}
            onClick={() => {
              const next = !inkFinger;
              setInkFinger(next);
              try { localStorage.setItem('listbook:fingerDraw', JSON.stringify(next)); } catch {}
              showToast(next ? "Finger draws. Use two fingers to scroll." : "Finger scrolls. Draw with stylus or mouse.", 2600);
            }}
          >
            <HandIcon />
          </button>

          <button
            type="button"
            className={`tb ${inkConfirmDel ? 'danger-on' : ''}`}
            title={inkConfirmDel ? "Tap again to delete this drawing" : "Delete drawing"}
            onClick={() => {
              if (!inkConfirmDel) {
                setInkConfirmDel(true);
              } else {
                setInkConfirmDel(false);
                if (activeInkDiv) {
                  activeInkDiv.remove();
                  deactivateInkBlock();
                  showToast('Drawing deleted.');
                }
              }
            }}
          >
            {inkConfirmDel ? 'Delete?' : <XIcon />}
          </button>

          <button
            type="button"
            className="ink-done"
            onClick={deactivateInkBlock}
          >
            <DoneIcon />
            <span>Done</span>
          </button>
        </div>
      )}

      <div className={`note-scroll ${ro ? 'ro' : ''}`}>
        <div
          ref={editorRef}
          className="editor"
          id="editor"
          contentEditable={!ro}
          spellCheck={!ro}
          role="textbox"
          aria-multiline="true"
          aria-readonly={ro}
          aria-label="Note"
          data-placeholder={ro ? 'This note is empty.' : 'Start writing…'}
          suppressContentEditableWarning
          onInput={ro ? undefined : handleNoteChanged}
          onBlur={ro ? undefined : handleNoteChanged}
        />
      </div>
    </>
  );
};


