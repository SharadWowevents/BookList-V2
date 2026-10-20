import { useRef, useEffect, useState, useCallback } from 'react';
import {
  parseInk, serializeInk, drawStroke, SIZES, getInkInk,
  INK_W, INK_COLORS, HL_COLORS, distSeg, inPoly
} from '../utils/ink';
import {
  PenIcon, SketchPencilIcon, MarkerIcon, EraserIcon, LassoIcon,
  RulerIcon, HandIcon, DoneIcon, UndoIcon, RedoIcon, TrashIcon, XIcon
} from './Icons';

export const InkBlock = ({
  initialDataInk,
  initialH = 600,
  isEditable = true,
  onChange,
  onDelete
}) => {
  const containerRef = useRef(null);
  const baseCanvasRef = useRef(null);
  const liveCanvasRef = useRef(null);

  const [strokes, setStrokes] = useState(() => parseInk(initialDataInk));
  const [height, setHeight] = useState(initialH);
  const strokesRef = useRef(strokes);
  const heightRef = useRef(height);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  const scaleRef = useRef(1);
  const dprRef = useRef(1);

  const [isActive, setIsActive] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('k');
  const [hlColor, setHlColor] = useState('y');
  const [sizeIdx, setSizeIdx] = useState(1);
  const [finger, setFinger] = useState(() => {
    try {
      const f = localStorage.getItem('listbook:fingerDraw');
      return f !== null ? JSON.parse(f) : true;
    } catch {
      return true;
    }
  });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedStrokes, setSelectedStrokes] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const curRef = useRef(null);
  const rafRef = useRef(0);

  const sizeCanvas = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 600;
    const scale = w / INK_W;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    scaleRef.current = scale;
    dprRef.current = dpr;

    const displayH = Math.round(heightRef.current * scale);
    containerRef.current.style.height = displayH + "px";

    [baseCanvasRef.current, liveCanvasRef.current].forEach(c => {
      if (c) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(displayH * dpr);
      }
    });
  }, []);

  const ctxFor = useCallback((canvas) => {
    if (!canvas) return null;
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dprRef.current * scaleRef.current, 0, 0, dprRef.current * scaleRef.current, 0, 0);
    return g;
  }, []);

  const renderBase = useCallback((skipSet = null) => {
    const g = ctxFor(baseCanvasRef.current);
    if (!g) return;
    strokesRef.current.forEach((st, i) => {
      if (!skipSet || !skipSet.has(i)) drawStroke(g, st);
    });
  }, [ctxFor]);

  const drawLive = useCallback(() => {
    rafRef.current = 0;
    const g = ctxFor(liveCanvasRef.current);
    if (!g) return;
    const cur = curRef.current;

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

    if (selectedStrokes && isActive) {
      const m = cur && cur.move ? cur.move : { dx: 0, dy: 0 };
      if (cur && cur.move) {
        selectedStrokes.idx.forEach(i => drawStroke(g, strokesRef.current[i], m.dx, m.dy));
      }
      const b = selectedStrokes.bbox;
      g.save();
      g.setLineDash([7, 5]);
      g.lineWidth = 1.6;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1E6B57';
      g.strokeStyle = accent;
      g.strokeRect(b.x + m.dx, b.y + m.dy, b.w, b.h);
      g.restore();
    }

    if (cur && cur.eraserAt) {
      g.save();
      g.lineWidth = 1.5;
      g.strokeStyle = getInkInk();
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(cur.eraserAt.x, cur.eraserAt.y, SIZES.er[sizeIdx], 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }, [ctxFor, isActive, selectedStrokes, sizeIdx]);

  const queueLive = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(drawLive);
    }
  }, [drawLive]);

  useEffect(() => {
    sizeCanvas();
    renderBase();
    drawLive();

    const handleResize = () => {
      sizeCanvas();
      renderBase();
      drawLive();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sizeCanvas, renderBase, drawLive]);

  const pushHistory = (snap) => {
    const s = snap || JSON.stringify({ s: strokesRef.current, h: heightRef.current });
    setUndoStack(prev => [...prev.slice(-80), s]);
    setRedoStack([]);
  };

  const notifyChange = (updatedStrokes, updatedH) => {
    if (onChange) {
      onChange(serializeInk(updatedStrokes || strokesRef.current), updatedH || heightRef.current);
    }
  };

  const toUnits = (e) => {
    const r = containerRef.current.getBoundingClientRect();
    const pr = e.pointerType === "pen" ? Math.round(Math.max(0.05, Math.min(1, e.pressure || 0.5)) * 9) : 5;
    return {
      x: Math.round((e.clientX - r.left) / scaleRef.current),
      y: Math.round((e.clientY - r.top) / scaleRef.current),
      p: pr
    };
  };

  const growIfNeeded = (y) => {
    if (y > heightRef.current - 90 && heightRef.current < 8000) {
      const nextH = Math.min(8000, heightRef.current + 300);
      setHeight(nextH);
      heightRef.current = nextH;
      sizeCanvas();
      renderBase();
    }
  };

  const eraseAt = (pt) => {
    const r = SIZES.er[sizeIdx];
    const keep = strokesRef.current.filter(([, , w, p]) => {
      const n = p.length / 3, rr = r + w / 2;
      for (let i = 0; i < n; i++) {
        if (i && distSeg(pt.x, pt.y, p[(i - 1) * 3], p[(i - 1) * 3 + 1], p[i * 3], p[i * 3 + 1]) < rr) return false;
        if (Math.hypot(pt.x - p[i * 3], pt.y - p[i * 3 + 1]) < rr) return false;
      }
      return true;
    });

    if (keep.length !== strokesRef.current.length) {
      if (!curRef.current.erased) {
        pushHistory(curRef.current.snap);
        curRef.current.erased = true;
      }
      setStrokes(keep);
      strokesRef.current = keep;
      renderBase();
    }
  };

  const selectLasso = (poly) => {
    if (poly.length < 6) {
      setSelectedStrokes(null);
      return;
    }
    const idx = [];
    strokesRef.current.forEach((st, i) => {
      const p = st[3], n = p.length / 3;
      let c = 0;
      for (let k = 0; k < n; k++) {
        if (inPoly(p[k * 3], p[k * 3 + 1], poly)) c++;
      }
      if (c / n >= 0.5) idx.push(i);
    });

    if (!idx.length) {
      setSelectedStrokes(null);
      return;
    }

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    idx.forEach(i => {
      const [, , w, p] = strokesRef.current[i];
      for (let k = 0; k < p.length; k += 3) {
        x0 = Math.min(x0, p[k] - w);
        y0 = Math.min(y0, p[k + 1] - w);
        x1 = Math.max(x1, p[k] + w);
        y1 = Math.max(y1, p[k + 1] + w);
      }
    });
    setSelectedStrokes({ idx, bbox: { x: x0 - 6, y: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12 } });
  };

  const handlePointerDown = (e) => {
    if (!isEditable) return;
    if (!isActive) {
      if (e.pointerType === 'pen') {
        setIsActive(true);
      } else {
        return;
      }
    }

    if (e.pointerType === 'touch' && !finger) return;

    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch {}

    const pt = toUnits(e);
    const snap = JSON.stringify({ s: strokesRef.current, h: heightRef.current });
    curRef.current = { id: e.pointerId, snap };

    if (tool === 'er') {
      curRef.current.eraserAt = pt;
      eraseAt(pt);
    } else if (tool === 'lasso') {
      const b = selectedStrokes && selectedStrokes.bbox;
      if (b && pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
        curRef.current.move = { x0: pt.x, y0: pt.y, dx: 0, dy: 0 };
        renderBase(new Set(selectedStrokes.idx));
      } else {
        setSelectedStrokes(null);
        curRef.current.lasso = [pt.x, pt.y];
      }
    } else {
      const col = tool === 'hl' ? hlColor : color;
      curRef.current.stroke = [tool, col, SIZES[tool][sizeIdx], [pt.x, pt.y, pt.p]];
    }
    queueLive();
  };

  const handlePointerMove = (e) => {
    const cur = curRef.current;
    if (!cur || e.pointerId !== cur.id) return;
    e.preventDefault();

    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const pt = toUnits(ev);
      if (tool === 'er') {
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
        growIfNeeded(pt.y);
      }
    }
    queueLive();
  };

  const handlePointerUp = (e) => {
    const cur = curRef.current;
    if (!cur || e.pointerId !== cur.id) return;
    curRef.current = null;

    if (cur.stroke) {
      pushHistory(cur.snap);
      const nextStrokes = [...strokesRef.current, cur.stroke];
      setStrokes(nextStrokes);
      strokesRef.current = nextStrokes;
      renderBase();
      notifyChange(nextStrokes);
    } else if (cur.lasso) {
      selectLasso(cur.lasso);
    } else if (cur.move) {
      const { dx, dy } = cur.move;
      if (dx || dy) {
        pushHistory(cur.snap);
        const nextStrokes = strokesRef.current.map((st, i) => {
          if (selectedStrokes.idx.includes(i)) {
            const p = [...st[3]];
            for (let k = 0; k < p.length; k += 3) {
              p[k] += dx;
              p[k + 1] += dy;
            }
            return [st[0], st[1], st[2], p];
          }
          return st;
        });
        setStrokes(nextStrokes);
        strokesRef.current = nextStrokes;

        const nextBbox = {
          ...selectedStrokes.bbox,
          x: selectedStrokes.bbox.x + dx,
          y: selectedStrokes.bbox.y + dy
        };
        setSelectedStrokes({ idx: selectedStrokes.idx, bbox: nextBbox });
        growIfNeeded(nextBbox.y + nextBbox.h);
        notifyChange(nextStrokes);
      }
      renderBase();
    } else if (cur.erased) {
      notifyChange();
    }
    drawLive();
  };

  const handleGrowPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.target.setPointerCapture(e.pointerId); } catch {}
    const y0 = e.clientY;
    const h0 = heightRef.current;
    const snap = JSON.stringify({ s: strokesRef.current, h: heightRef.current });

    const handleGrowMove = (ev) => {
      const nextH = Math.max(200, Math.min(8000, Math.round(h0 + (ev.clientY - y0) / scaleRef.current)));
      setHeight(nextH);
      heightRef.current = nextH;
      sizeCanvas();
      renderBase();
      drawLive();
    };

    const handleGrowUp = () => {
      window.removeEventListener('pointermove', handleGrowMove);
      window.removeEventListener('pointerup', handleGrowUp);
      if (heightRef.current !== h0) {
        pushHistory(snap);
        notifyChange();
      }
    };

    window.addEventListener('pointermove', handleGrowMove);
    window.addEventListener('pointerup', handleGrowUp);
  };

  const handleUndo = () => {
    if (!undoStack.length) return;
    const snap = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, JSON.stringify({ s: strokesRef.current, h: heightRef.current })]);
    const d = JSON.parse(snap);
    setStrokes(d.s);
    strokesRef.current = d.s;
    setHeight(d.h);
    heightRef.current = d.h;
    setSelectedStrokes(null);
    sizeCanvas();
    renderBase();
    drawLive();
    notifyChange(d.s, d.h);
  };

  const handleRedo = () => {
    if (!redoStack.length) return;
    const snap = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, JSON.stringify({ s: strokesRef.current, h: heightRef.current })]);
    const d = JSON.parse(snap);
    setStrokes(d.s);
    strokesRef.current = d.s;
    setHeight(d.h);
    heightRef.current = d.h;
    setSelectedStrokes(null);
    sizeCanvas();
    renderBase();
    drawLive();
    notifyChange(d.s, d.h);
  };

  const handleDeleteSelection = () => {
    if (!selectedStrokes) return;
    pushHistory();
    const s = new Set(selectedStrokes.idx);
    const nextStrokes = strokesRef.current.filter((_, i) => !s.has(i));
    setStrokes(nextStrokes);
    strokesRef.current = nextStrokes;
    setSelectedStrokes(null);
    renderBase();
    drawLive();
    notifyChange(nextStrokes);
  };

  const toggleFinger = () => {
    const next = !finger;
    setFinger(next);
    try { localStorage.setItem('listbook:fingerDraw', JSON.stringify(next)); } catch {}
  };

  const showColors = tool !== 'er' && (tool !== 'lasso' || selectedStrokes);
  const isHl = tool === 'hl' || (tool === 'lasso' && selectedStrokes && selectedStrokes.idx.every(i => strokes[i] && strokes[i][0] === 'hl'));
  const colorKeys = isHl ? Object.keys(HL_COLORS) : Object.keys(INK_COLORS);
  const curColorKey = isHl ? hlColor : color;
  const sizeTool = tool === 'lasso' ? null : tool;

  const handleColorChange = (k) => {
    if (tool === 'lasso' && selectedStrokes) {
      pushHistory();
      const hl = !!HL_COLORS[k];
      const nextStrokes = strokesRef.current.map((st, i) => {
        if (selectedStrokes.idx.includes(i) && (st[0] === 'hl') === hl) {
          return [st[0], k, st[2], st[3]];
        }
        return st;
      });
      setStrokes(nextStrokes);
      strokesRef.current = nextStrokes;
      renderBase();
      notifyChange(nextStrokes);
    } else if (tool === 'hl') {
      setHlColor(k);
    } else {
      setColor(k);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`ink ${isActive ? 'active' : ''}`}
      style={{ height: `${height}px` }}
    >
      <canvas ref={baseCanvasRef} className="ink-base" />
      <canvas
        ref={liveCanvasRef}
        className="ink-live"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {isEditable && !isActive && (
        <button
          type="button"
          className="ink-edit"
          title="Draw here"
          aria-label="Draw in this sketch"
          onClick={() => setIsActive(true)}
        >
          <PenIcon />
        </button>
      )}

      {isEditable && (
        <div
          className="ink-grow"
          title="Drag to make the drawing area taller"
          onPointerDown={handleGrowPointerDown}
        />
      )}

      {isActive && (
        <div className="inkbar" role="toolbar" aria-label="Drawing tools">
          <button
            type="button"
            className={`tb ${tool === 'pen' ? 'on' : ''}`}
            title="Pen"
            aria-label="Pen"
            onClick={() => { setTool('pen'); setSelectedStrokes(null); }}
          >
            <PenIcon />
          </button>
          <button
            type="button"
            className={`tb ${tool === 'pcl' ? 'on' : ''}`}
            title="Pencil"
            aria-label="Pencil"
            onClick={() => { setTool('pcl'); setSelectedStrokes(null); }}
          >
            <SketchPencilIcon />
          </button>
          <button
            type="button"
            className={`tb ${tool === 'hl' ? 'on' : ''}`}
            title="Highlighter"
            aria-label="Highlighter"
            onClick={() => { setTool('hl'); setSelectedStrokes(null); }}
          >
            <MarkerIcon />
          </button>
          <button
            type="button"
            className={`tb ${tool === 'er' ? 'on' : ''}`}
            title="Eraser"
            aria-label="Eraser"
            onClick={() => { setTool('er'); setSelectedStrokes(null); }}
          >
            <EraserIcon />
          </button>
          <button
            type="button"
            className={`tb ${tool === 'lasso' ? 'on' : ''}`}
            title="Lasso select"
            aria-label="Lasso select"
            onClick={() => { setTool('lasso'); }}
          >
            <LassoIcon />
          </button>
          <button
            type="button"
            className={`tb ${tool === 'ln' ? 'on' : ''}`}
            title="Straight line"
            aria-label="Straight line"
            onClick={() => { setTool('ln'); setSelectedStrokes(null); }}
          >
            <RulerIcon />
          </button>

          {showColors && (
            <>
              <span className="sep"></span>
              {colorKeys.map(k => (
                <button
                  key={k}
                  type="button"
                  className={`ink-sw ${k === curColorKey ? 'on' : ''}`}
                  style={{ background: isHl ? HL_COLORS[k] : (INK_COLORS[k] || 'var(--ink)') }}
                  onClick={() => handleColorChange(k)}
                />
              ))}
            </>
          )}

          {sizeTool && (
            <>
              <span className="sep"></span>
              {[0, 1, 2].map(i => {
                const d = Math.max(4, Math.min(18, sizeTool === 'hl' ? 7 + i * 5 : sizeTool === 'er' ? 6 + i * 5 : 4 + i * 4));
                return (
                  <button
                    key={i}
                    type="button"
                    className={`ink-size ${sizeIdx === i ? 'on' : ''}`}
                    onClick={() => setSizeIdx(i)}
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
            disabled={!undoStack.length}
            title="Undo"
            onClick={handleUndo}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="tb"
            disabled={!redoStack.length}
            title="Redo"
            onClick={handleRedo}
          >
            <RedoIcon />
          </button>

          {selectedStrokes && (
            <button
              type="button"
              className="tb"
              title="Delete selection"
              onClick={handleDeleteSelection}
            >
              <TrashIcon />
            </button>
          )}

          <button
            type="button"
            className={`tb ${finger ? 'on' : ''}`}
            title={finger ? "Finger draws (tap to scroll with finger)" : "Finger scrolls (tap to draw with finger)"}
            onClick={toggleFinger}
          >
            <HandIcon />
          </button>

          <button
            type="button"
            className={`tb ${confirmDel ? 'danger-on' : ''}`}
            title={confirmDel ? "Tap again to delete this drawing" : "Delete drawing"}
            onClick={() => {
              if (!confirmDel) {
                setConfirmDel(true);
              } else {
                if (onDelete) onDelete();
              }
            }}
          >
            {confirmDel ? 'Delete?' : <XIcon />}
          </button>

          <button
            type="button"
            className="ink-done"
            onClick={() => {
              setIsActive(false);
              setSelectedStrokes(null);
              setConfirmDel(false);
            }}
          >
            <DoneIcon />
            <span>Done</span>
          </button>
        </div>
      )}
    </div>
  );
};
