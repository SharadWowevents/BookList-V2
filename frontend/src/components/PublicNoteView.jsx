import { useState, useEffect, useRef, useCallback } from 'react';
import { sharesAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { parseInk, drawStroke, INK_W } from '../utils/ink';
import { SunIcon, MoonIcon, BackIcon } from './Icons';

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(/\s?(AM|PM)$/i, m => m.trim().toLowerCase());
  if (d.toDateString() === now.toDateString()) return t;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'yesterday, ' + t;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }) + ', ' + t;
}

export const PublicNoteView = ({ sid, onExit }) => {
  const { session, theme, setTheme } = useApp() || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareData, setShareData] = useState(null);
  const contentRef = useRef(null);

  // Canvas hydration for sketches in public view
  const hydrateInk = useCallback((container) => {
    if (!container) return;
    container.querySelectorAll('div.ink').forEach(div => {
      if (div._hydrated) return;
      div._hydrated = true;
      div.setAttribute('contenteditable', 'false');
      div.innerHTML = '<canvas class="ink-base"></canvas>';

      div._strokes = parseInk(div.getAttribute('data-ink'));
      div._h = parseInt(div.getAttribute('data-h'), 10) || 600;

      const sizeInk = () => {
        const w = div.clientWidth || 600;
        const scale = w / INK_W;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        div._scale = scale;
        div._dpr = dpr;
        const h = Math.round(div._h * scale);
        div.style.height = h + 'px';
        div.querySelectorAll('canvas').forEach(c => {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        });
      };

      const ctxFor = (cls) => {
        const c = div.querySelector(cls);
        if (!c) return null;
        const g = c.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, c.width, c.height);
        g.setTransform(div._dpr * div._scale, 0, 0, div._dpr * div._scale, 0, 0);
        return g;
      };

      const renderBaseInk = () => {
        const g = ctxFor('.ink-base');
        if (!g) return;
        div._strokes.forEach(st => drawStroke(g, st));
      };

      sizeInk();
      renderBaseInk();
    });
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    sharesAPI.getShare(sid)
      .then(res => {
        if (!ignore) {
          if (res && res.content) {
            setShareData(res);
          } else {
            setError('This document is not available or the link has expired.');
          }
          setLoading(false);
        }
      })
      .catch(err => {
        if (!ignore) {
          setError(err.message || 'This document is no longer available or the link has expired.');
          setLoading(false);
        }
      });

    return () => { ignore = true; };
  }, [sid]);

  // Live SSE listener for real-time document updates
  useEffect(() => {
    if (!sid) return;
    let es = null;
    let isCancelled = false;

    const connect = () => {
      if (isCancelled) return;
      try {
        es = new EventSource('/api/shares/stream');
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data && data.sid === sid && data.type === 'share_updated' && data.content) {
              setShareData(prev => ({
                ...(prev || {}),
                content: data.content,
                updatedAt: data.updatedAt,
                updatedBy: data.updatedBy
              }));
            }
          } catch {}
        };
        es.onerror = () => {
          if (es) {
            es.close();
            es = null;
          }
        };
      } catch {}
    };

    connect();

    return () => {
      isCancelled = true;
      if (es) es.close();
    };
  }, [sid]);

  useEffect(() => {
    if (contentRef.current && shareData?.content?.html) {
      contentRef.current.innerHTML = shareData.content.html;
      hydrateInk(contentRef.current);
    }
  }, [shareData, hydrateInk]);

  const toggleTheme = () => {
    if (setTheme) {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  if (loading) {
    return (
      <div className="pub-page">
        <header className="pub-nav">
          <div className="pub-brand">My<span>Deepwork</span></div>
        </header>
        <main className="pub-main" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
          <p style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>Loading document…</p>
        </main>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="pub-page">
        <header className="pub-nav">
          <div className="pub-brand">My<span>Deepwork</span></div>
          {onExit && (
            <button type="button" className="pill ink" onClick={onExit}>
              Go to MyDeepwork
            </button>
          )}
        </header>
        <main className="pub-main" style={{ textAlign: 'center', paddingTop: '80px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '12px' }}>Document Unavailable</h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.1rem', marginBottom: '24px' }}>
            {error || 'This public document does not exist or has been made private.'}
          </p>
          {onExit && (
            <button type="button" className="btn btn-primary" onClick={onExit}>
              Return to App
            </button>
          )}
        </main>
      </div>
    );
  }

  const title = shareData.content?.title || 'Untitled document';
  const author = shareData.ownerName || 'Author';
  const when = fmtTime(shareData.updatedAt);
  const letter = author.trim().charAt(0).toUpperCase();

  return (
    <div className="pub-page">
      {/* <header className="pub-nav">
        <div className="pub-brand">
          My<span>Deepwork</span>
        </div>
        <div className="pub-nav-actions">
          {setTheme && (
            <button
              type="button"
              className="icon-btn"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          )}
          {onExit && (
            <button type="button" className="pill ink" onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BackIcon size={14} /> {session ? 'Back to my notes' : 'Sign in'}
            </button>
          )}
        </div>
      </header> */}

      <main className="pub-main">
        <h1 className="pub-title">{title}</h1>

        <div className="pub-byline">
          <span className="pub-avatar">{letter}</span>
          <span>
            <b>{author}</b>
            {when ? ` • Last updated ${when}` : ''}
          </span>
        </div>

        <article
          ref={contentRef}
          className="pub-content editor is-empty"
          style={{ minHeight: 'auto', padding: 0 }}
        />

        <footer className="pub-foot">
          <span>Published with <b>MyDeepwork</b></span>
        </footer>
      </main>
    </div>
  );
};

