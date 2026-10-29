import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { BackIcon, SmileIcon, ImageIcon, XIcon } from './Icons';

export const MOODS = [
  ["😄", "Great"],
  ["🙂", "Good"],
  ["😌", "Calm"],
  ["🙏", "Grateful"],
  ["🥳", "Celebrating"],
  ["😐", "Okay"],
  ["😴", "Tired"],
  ["😔", "Low"],
  ["😢", "Sad"],
  ["😠", "Angry"],
  ["😰", "Stressed"],
  ["🤒", "Unwell"]
];

export const JPROMPT = "Health / Family / Work";

export const moodName = (emoji) => {
  const found = MOODS.find(m => m[0] === emoji);
  return found ? found[1] : '';
};

export const pad2 = (n) => String(n).padStart(2, '0');
export const mmdd = (d) => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const today0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const jHas = (e) => !!(e && ((e.t && e.t.trim()) || e.img || e.mood));

export const monLabel = (d) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

export const JournalView = () => {
  const {
    journalYears,
    loadJournalYears,
    patchJournalEntry,
    uploadJournalPhoto,
    removeJournalPhoto,
    journalViewMode,
    setJournalViewMode,
    journalCenter,
    setJournalCenter,
    journalMonth,
    setJournalMonth,
    journalStatus,
    setUi,
    showToast
  } = useApp();

  const fileInputRef = useRef(null);
  const [photoTargetDate, setPhotoTargetDate] = useState(null); // Date obj

  // Mood popover state
  const [moodAnchor, setMoodAnchor] = useState(null); // { el, date: Date }
  // Photo modal state
  const [viewingPhotoDate, setViewingPhotoDate] = useState(null); // Date obj
  // Tooltip / popover card state
  const [popData, setPopData] = useState(null); // { x, y, date, entry, isLastYear }

  const tableRef = useRef(null);
  const scrolledTodayRef = useRef(false);

  // Compute days for active view
  const days = useMemo(() => {
    const out = [];
    const t = today0();
    if (journalViewMode === 'month') {
      const cur = journalMonth || { y: t.getFullYear(), m: t.getMonth() };
      const n = new Date(cur.y, cur.m + 1, 0).getDate();
      for (let i = 1; i <= n; i++) {
        out.push(new Date(cur.y, cur.m, i));
      }
    } else {
      const c = journalCenter ? new Date(journalCenter) : t;
      for (let i = -5; i <= 5; i++) {
        const d = new Date(c);
        d.setDate(c.getDate() + i);
        out.push(d);
      }
    }
    return out;
  }, [journalViewMode, journalCenter, journalMonth]);

  // Ensure necessary years are loaded
  useEffect(() => {
    if (!days.length) return;
    const requiredYears = new Set();
    days.forEach(d => {
      requiredYears.add(d.getFullYear());
      requiredYears.add(d.getFullYear() - 1);
    });
    loadJournalYears(Array.from(requiredYears));
  }, [days, loadJournalYears]);

  // Scroll "today" row into view once on mount or when returning to today
  useEffect(() => {
    if (!scrolledTodayRef.current && tableRef.current) {
      const todayRow = tableRef.current.querySelector('.j-tr.today');
      if (todayRow) {
        todayRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
        scrolledTodayRef.current = true;
      }
    }
  }, [days]);

  // Header dates formatting
  const first = days[0] || today0();
  const last = days[days.length - 1] || today0();
  const span = first.getMonth() === last.getMonth()
    ? monLabel(first)
    : `${first.toLocaleDateString(undefined, { month: 'short' })} – ${monLabel(last)}`;

  const spanLast = useMemo(() => {
    const a = new Date(first);
    const b = new Date(last);
    a.setFullYear(a.getFullYear() - 1);
    b.setFullYear(b.getFullYear() - 1);
    return a.getMonth() === b.getMonth()
      ? monLabel(a)
      : `${a.toLocaleDateString(undefined, { month: 'short' })} – ${monLabel(b)}`;
  }, [first, last]);

  // Helper to get entry from local cache
  const getEntry = useCallback((d) => {
    const y = d.getFullYear();
    const k = mmdd(d);
    return journalYears[y]?.entries?.[k] || { t: '', img: '', mood: '' };
  }, [journalYears]);

  // Check if year is loaded
  const isYearLoaded = useCallback((y) => {
    return !!journalYears[y]?.loaded;
  }, [journalYears]);

  // Navigation handlers
  const handleNav = (step) => {
    const t = today0();
    if (journalViewMode === 'month') {
      if (step === 0) {
        setJournalMonth(null);
      } else {
        const cur = journalMonth || { y: t.getFullYear(), m: t.getMonth() };
        const d = new Date(cur.y, cur.m + step, 1);
        setJournalMonth({ y: d.getFullYear(), m: d.getMonth() });
      }
    } else {
      if (step === 0) {
        setJournalCenter(null);
      } else {
        const c = new Date(journalCenter || t);
        c.setDate(c.getDate() + step * 5);
        setJournalCenter(c);
      }
    }
    closePopovers();
  };

  const closePopovers = () => {
    setMoodAnchor(null);
    setPopData(null);
  };

  // Close floating popovers on Esc or outside click
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closePopovers();
        setViewingPhotoDate(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Handle Photo selection
  const handlePhotoClick = (d, existingImg) => {
    closePopovers();
    if (existingImg) {
      setViewingPhotoDate(d);
    } else {
      setPhotoTargetDate(d);
      if (fileInputRef.current) fileInputRef.current.click();
    }
  };

  const onFileInputChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    const target = photoTargetDate;
    setPhotoTargetDate(null);
    if (!file || !target) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.');
      return;
    }

    try {
      await uploadJournalPhoto(target.getFullYear(), mmdd(target), file);
      showToast(`Photo added to ${target.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.`);
    } catch {
      showToast('Failed to upload photo. Try another image.');
    }
  };

  // Handle Mood click
  const handleMoodClick = (e, d) => {
    e.stopPropagation();
    setPopData(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const w = 330;
    const h = 230;
    let x = Math.min(Math.max(12, rect.left), window.innerWidth - w - 12);
    let y = rect.bottom + 6;
    if (y + h > window.innerHeight - 12) {
      y = Math.max(12, rect.top - h - 6);
    }
    setMoodAnchor({
      date: d,
      x,
      y
    });
  };

  const selectMood = (emoji) => {
    if (!moodAnchor) return;
    const d = moodAnchor.date;
    patchJournalEntry(d.getFullYear(), mmdd(d), { mood: emoji });
    setMoodAnchor(null);
  };

  // Hover Popover logic
  const handleMouseEnterCell = (e, d, isLastYear) => {
    if (moodAnchor) return;
    const entry = getEntry(d);
    if (!entry.img && !entry.t.trim() && !entry.mood) return;

    const cellRect = e.currentTarget.getBoundingClientRect();
    const pw = entry.img ? Math.min(420, window.innerWidth - 32) : Math.min(320, window.innerWidth - 32);
    const ph = entry.img ? 280 : 120;

    let x = Math.min(Math.max(16, cellRect.left + 8), window.innerWidth - pw - 16);
    let y = cellRect.bottom + 6;
    if (y + ph > window.innerHeight - 12) {
      y = Math.max(12, cellRect.top - ph - 6);
    }

    setPopData({
      x,
      y,
      date: d,
      entry,
      isLastYear
    });
  };

  const handleMouseLeaveCell = () => {
    setPopData(null);
  };

  // Keyboard navigation across input rows
  const handleInputKeyDown = (e, idx) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.querySelector(`input[data-jidx="${idx + 1}"]`);
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.querySelector(`input[data-jidx="${idx - 1}"]`);
      if (prevInput) prevInput.focus();
    }
  };

  const t0 = today0();
  const tk = ymd(t0);

  return (
    <>
      <div className="main-head">
        <button
          type="button"
          className="icon-btn back"
          id="back"
          aria-label="Back to sidebar"
          onClick={() => setUi(prev => ({ ...prev, viewing: false }))}
        >
          <BackIcon />
        </button>
        <div className="title-wrap">
          <div className="title">Journal</div>
          <div className="sub">One line a day, next to the same day last year</div>
        </div>
      </div>

      <div className="crm-tools j-tools">
        <div className="view-seg" role="group" aria-label="View Mode">
          <button
            type="button"
            className={journalViewMode === 'range' ? 'on' : ''}
            onClick={() => {
              setJournalViewMode('range');
              setJournalCenter(null);
            }}
          >
            Date range
          </button>
          <button
            type="button"
            className={journalViewMode === 'month' ? 'on' : ''}
            onClick={() => {
              setJournalViewMode('month');
              setJournalMonth(null);
            }}
          >
            Month
          </button>
        </div>

        <div className="j-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => handleNav(-1)}
            aria-label={journalViewMode === 'month' ? 'Previous month' : 'Earlier days'}
          >
            <BackIcon size={20} />
          </button>
          <span className="j-label">
            {journalViewMode === 'month' ? monLabel(days[0] || today0()) : span}
          </span>
          <button
            type="button"
            className="icon-btn j-next"
            onClick={() => handleNav(1)}
            aria-label={journalViewMode === 'month' ? 'Next month' : 'Later days'}
          >
            <BackIcon size={20} />
          </button>
          <button
            type="button"
            className="pill plain"
            onClick={() => handleNav(0)}
          >
            Today
          </button>
        </div>

        <span className="j-status" id="jStatus">
          {journalStatus}
        </span>
      </div>

      <div className="j-scroll" id="jMain" ref={tableRef} onScroll={closePopovers}>
        <div className="j-table">
          <div className="j-tr j-th">
            <span></span>
            <span>
              {spanLast} <small>· {JPROMPT}</small>
            </span>
            <span></span>
            <span>
              {journalViewMode === 'month' ? monLabel(days[0] || today0()) : span} <small>· {JPROMPT}</small>
            </span>
          </div>

          {days.map((d, idx) => {
            const key = ymd(d);
            const isToday = key === tk;
            const isFuture = d > t0;

            const ld = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
            const le = ld.getMonth() === d.getMonth() ? getEntry(ld) : { t: '', img: '', mood: '' };
            const e = getEntry(d);
            const yrLoaded = isYearLoaded(d.getFullYear());

            const newMonth = d.getDate() === 1 || d === days[0];
            const wd = d.toLocaleDateString(undefined, { weekday: 'short' });

            return (
              <div
                key={key}
                className={`j-tr ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''} ${jHas(e) ? 'has' : ''}`}
                data-date={key}
              >
                {/* Day column */}
                <span className="j-day">
                  <b>{d.getDate()}</b>
                  {newMonth && journalViewMode === 'range' && (
                    <small>{d.toLocaleDateString(undefined, { month: 'short' })}</small>
                  )}
                  <small className="j-wd-m">{wd}</small>
                </span>

                {/* Last year column */}
                <span
                  className={`j-last ${jHas(le) ? '' : 'j-none'}`}
                  onMouseEnter={(ev) => handleMouseEnterCell(ev, ld, true)}
                  onMouseLeave={handleMouseLeaveCell}
                >
                  <small className="j-ly">{d.getFullYear() - 1}</small>
                  {le.img && (
                    <span className="j-lthumb">
                      <img src={le.img} alt="" />
                    </span>
                  )}
                  {le.mood && (
                    <span className="j-lmood" title={moodName(le.mood)}>
                      {le.mood}
                    </span>
                  )}
                  <span className="j-txt">
                    {le.t ? le.t : jHas(le) ? '' : '—'}
                  </span>
                </span>

                {/* Weekday column */}
                <span className="j-wd">{wd}</span>

                {/* This year column */}
                <span
                  className="j-this"
                  onMouseEnter={(ev) => handleMouseEnterCell(ev, d, false)}
                  onMouseLeave={handleMouseLeaveCell}
                >
                  {/* Photo button */}
                  <button
                    type="button"
                    className={`j-ph ${e.img ? 'has' : ''}`}
                    onClick={() => handlePhotoClick(d, e.img)}
                    disabled={!yrLoaded}
                    aria-label={e.img ? 'Photo for this day' : 'Add photo'}
                    title={e.img ? 'View or change photo' : 'Add a photo'}
                  >
                    {e.img ? <img src={e.img} alt="" /> : <ImageIcon size={18} />}
                  </button>

                  {/* Mood button */}
                  <button
                    type="button"
                    className={`j-mood ${e.mood ? 'has' : ''}`}
                    onClick={(ev) => handleMoodClick(ev, d)}
                    disabled={!yrLoaded}
                    aria-label={e.mood ? `Mood: ${moodName(e.mood)}. Change mood` : 'Pick a mood'}
                    title={e.mood ? moodName(e.mood) : 'How did the day feel?'}
                  >
                    {e.mood || <SmileIcon size={20} />}
                  </button>

                  {/* Single line text input */}
                  <input
                    className="j-in"
                    data-jidx={idx}
                    value={e.t || ''}
                    maxLength={300}
                    autoComplete="off"
                    placeholder={
                      !yrLoaded
                        ? 'Loading…'
                        : isToday
                          ? `How was today? ${JPROMPT}`
                          : isFuture
                            ? ''
                            : 'Add a line'
                    }
                    readOnly={!yrLoaded}
                    aria-label={`Journal for ${d.toDateString()}`}
                    onChange={(ev) => {
                      patchJournalEntry(d.getFullYear(), mmdd(d), { t: ev.target.value });
                    }}
                    onKeyDown={(ev) => handleInputKeyDown(ev, idx)}
                  />
                </span>
              </div>
            );
          })}
        </div>

        {/* Hidden File Input for Photos */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          hidden
          onChange={onFileInputChange}
        />
      </div>

      {/* FLOATING MOOD PICKER */}
      {moodAnchor && (
        <div
          className="j-emoji"
          id="jEmoji"
          style={{ left: moodAnchor.x, top: moodAnchor.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="j-emoji-title">
            How did {moodAnchor.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })} feel?
          </div>
          <div className="j-emoji-grid">
            {MOODS.map(([emoji, label]) => {
              const curMood = getEntry(moodAnchor.date).mood;
              return (
                <button
                  key={emoji}
                  type="button"
                  className={emoji === curMood ? 'on' : ''}
                  onClick={() => selectMood(emoji)}
                  title={label}
                  aria-label={label}
                >
                  <span>{emoji}</span>
                  <small>{label}</small>
                </button>
              );
            })}
          </div>
          {getEntry(moodAnchor.date).mood && (
            <button
              type="button"
              className="text-btn muted j-emoji-clear"
              onClick={() => selectMood('')}
            >
              Clear mood
            </button>
          )}
        </div>
      )}

      {/* HOVER TOOLTIP CARD */}
      {popData && (
        <div
          className="j-pop"
          id="jPop"
          style={{ left: popData.x, top: popData.y }}
        >
          {popData.entry.img && (
            <div className="j-pop-img">
              <img src={popData.entry.img} alt="" />
            </div>
          )}
          <small>
            {popData.date.toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
            {popData.entry.mood ? ` · ${moodName(popData.entry.mood)}` : ''}
          </small>
          {(popData.entry.mood || popData.entry.t) && (
            <div className="j-pop-text">
              {popData.entry.mood && <span className="j-pop-mood">{popData.entry.mood}</span>}
              {popData.entry.t}
            </div>
          )}
        </div>
      )}

      {/* PHOTO PREVIEW & MANAGE MODAL */}
      {viewingPhotoDate && (
        <div
          className="modal-back"
          onClick={() => setViewingPhotoDate(null)}
        >
          <div
            className="modal j-photo"
            role="dialog"
            aria-modal="true"
            aria-label={`Photo for ${viewingPhotoDate.toDateString()}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>
                {viewingPhotoDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
                {getEntry(viewingPhotoDate).mood && (
                  <span className="j-pm"> {getEntry(viewingPhotoDate).mood}</span>
                )}
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setViewingPhotoDate(null)}
                aria-label="Close"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="j-photo-img">
              <img src={getEntry(viewingPhotoDate).img} alt="" />
            </div>

            {getEntry(viewingPhotoDate).t && (
              <p className="j-photo-text">{getEntry(viewingPhotoDate).t}</p>
            )}

            <div className="modal-foot">
              <button
                type="button"
                className="text-btn danger"
                onClick={() => {
                  const target = viewingPhotoDate;
                  setViewingPhotoDate(null);
                  removeJournalPhoto(target.getFullYear(), mmdd(target), getEntry(target).img);
                }}
              >
                Remove photo
              </button>
              <span className="grow"></span>
              <button
                type="button"
                className="pill plain"
                onClick={() => {
                  const target = viewingPhotoDate;
                  setViewingPhotoDate(null);
                  setPhotoTargetDate(target);
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
              >
                Change photo
              </button>
              <button
                type="button"
                className="pill ink"
                onClick={() => setViewingPhotoDate(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
