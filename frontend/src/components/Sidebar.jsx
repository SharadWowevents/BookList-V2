import { useState, useRef, useEffect } from 'react';
import Sortable from 'sortablejs';
import { useApp } from '../context/AppContext';
import { authAPI } from '../services/api';
import { ACCENTS, uid, reorderSubset, PLANS, LABELS, crmMatches } from '../utils/constants';
import {
  PlusIcon, StarIcon, GripIcon, PanelIcon, ListPlusIcon, NotePlusIcon,
  ListsIcon, NotesIcon, GearIcon, SunIcon, MoonIcon, MonitorIcon,
  LogoutIcon, ShieldIcon, CameraIcon, EyeIcon, UsersIcon, CrmIcon, JournalIcon, ArchetypeIcon, MailIcon,
  XIcon
} from './Icons';
import { mmdd, today0, jHas, moodName } from './JournalView';

export const Sidebar = () => {
  const {
    board, updateBoard, ui, setUi, session, setSession, signOut,
    accent, setAccent, theme, setTheme,
    collapsed, setCollapsed, photo, savePhoto, removePhoto,
    showToast,
    crmMembers, crmFilter, setCrmFilter, isCrmAllowed,
    journalYears, journalViewMode, setJournalViewMode, setJournalCenter, setJournalMonth,
    navigate, openPrivacyPolicy, foldMode,
    sidebarWidth, setSidebarWidth, setSidebarWidthState
  } = useApp();

  const isAdmin = session?.role === 'admin';

  // Sidebar drag to resize
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    document.body.classList.add('is-resizing-sidebar');

    const onPointerMove = (moveEvent) => {
      moveEvent.preventDefault();
      const minW = 240;
      const maxW = Math.min(650, Math.round(window.innerWidth * 0.65));
      const targetWidth = Math.max(minW, Math.min(Math.round(moveEvent.clientX), maxW));

      document.documentElement.style.setProperty('--sidebar-width', `${targetWidth}px`);
      setSidebarWidthState(targetWidth);
    };

    const onPointerUp = (upEvent) => {
      document.body.classList.remove('is-resizing-sidebar');
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const minW = 240;
      const maxW = Math.min(650, Math.round(window.innerWidth * 0.65));
      const finalWidth = Math.max(minW, Math.min(Math.round(upEvent.clientX), maxW));
      setSidebarWidth(finalWidth);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handleRailPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    document.body.classList.add('is-resizing-sidebar');
    let hasExpanded = false;

    const onMove = (moveEvt) => {
      if (moveEvt.clientX >= 140) {
        if (!hasExpanded) {
          hasExpanded = true;
          setCollapsed(false);
        }
        const minW = 240;
        const maxW = Math.min(650, Math.round(window.innerWidth * 0.65));
        const targetWidth = Math.max(minW, Math.min(Math.round(moveEvt.clientX), maxW));
        document.documentElement.style.setProperty('--sidebar-width', `${targetWidth}px`);
        setSidebarWidthState(targetWidth);
      }
    };

    const onUp = (upEvt) => {
      document.body.classList.remove('is-resizing-sidebar');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (upEvt.clientX >= 140) {
        setSidebarWidth(upEvt.clientX);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    setSidebarWidth(320);
    document.documentElement.style.setProperty('--sidebar-width', '320px');
    showToast('Sidebar reset to default width.');
  };

  const [newListName, setNewListName] = useState('');
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  // Recovery email editing state
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(session?.email || '');
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    setEmailInput(session?.email || '');
  }, [session?.email]);

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast('Please enter a valid email address.');
      return;
    }
    setSavingEmail(true);
    try {
      const res = await authAPI.updateProfile({ email: cleanEmail || null });
      if (res?.user) {
        setSession(res.user);
      }
      setEditingEmail(false);
      showToast('Recovery email updated.');
    } catch (err) {
      showToast(err.message || 'Could not update recovery email.');
    } finally {
      setSavingEmail(false);
    }
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ui.menu && menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('#meBtn') && !e.target.closest('#settingsBtn')) {
        setUi(prev => ({ ...prev, menu: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ui.menu, setUi]);

  const handleAddList = (e) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) {
      setUi(prev => ({ ...prev, adding: false }));
      return;
    }
    const newList = { id: uid(), name, starred: false, todos: [] };
    updateBoard({
      lists: [...board.lists, newList],
      activeId: newList.id,
      tab: 'lists'
    });
    setNewListName('');
    setUi(prev => ({ ...prev, adding: false, viewing: true, admin: false }));
    navigate('/lists');
  };

  const handleAddNote = () => {
    const newNote = { id: uid(), title: '', starred: false };
    updateBoard({
      notes: [newNote, ...board.notes],
      activeNoteId: newNote.id,
      tab: 'notes'
    });
    setUi(prev => ({ ...prev, adding: false, viewing: true, admin: false }));
    navigate('/notes');
  };

  const toggleStar = (e, item, kind) => {
    e.stopPropagation();
    const isList = kind === 'list' || kind === 'lists';
    const listKey = isList ? 'lists' : 'notes';
    updateBoard({
      [listKey]: board[listKey].map(x => x.id === item.id ? { ...x, starred: !x.starred } : x)
    });
  };

  // Reorder items via SortableJS
  const starredGroupRef = useRef(null);
  const othersGroupRef = useRef(null);
  const sortablesRef = useRef([]);
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    sortablesRef.current.forEach(s => s.destroy());
    sortablesRef.current = [];

    const isList = board.tab === 'lists';
    const listKey = isList ? 'lists' : 'notes';

    const opts = {
      animation: 160,
      handle: '.grip',
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd(evt) {
        const { from, oldIndex, newIndex } = evt;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;

        // 1. Capture new order of IDs from the DOM before revert
        const ids = Array.from(from.children).map(c => c.dataset.id).filter(Boolean);

        // 2. Revert DOM mutation so React can cleanly reconcile without VDOM desync
        const item = evt.item;
        const targetNode = from.children[oldIndex > newIndex ? oldIndex + 1 : oldIndex];
        from.insertBefore(item, targetNode || null);

        // 3. Update React board state
        const currentArr = boardRef.current[listKey];
        const reordered = reorderSubset(currentArr, ids);
        updateBoard({ [listKey]: reordered });
      }
    };

    if (starredGroupRef.current) {
      sortablesRef.current.push(Sortable.create(starredGroupRef.current, opts));
    }
    if (othersGroupRef.current) {
      sortablesRef.current.push(Sortable.create(othersGroupRef.current, opts));
    }

    return () => {
      sortablesRef.current.forEach(s => s.destroy());
      sortablesRef.current = [];
    };
  }, [board.tab, board.lists, board.notes, updateBoard]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please choose an image file (JPG, PNG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 192;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const m = Math.min(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        savePhoto(dataUrl);
        showToast('Profile photo updated.');
        setUi(prev => ({ ...prev, menu: false }));
        if (e.target) e.target.value = '';
      };
      img.onerror = () => {
        showToast("Couldn't read image file.");
        if (e.target) e.target.value = '';
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const renderAvatar = (cls = "") => {
    if (photo) {
      return (
        <span className={`avatar ${cls}`}>
          <img src={photo} alt="" />
        </span>
      );
    }
    const letter = (session?.name || 'Y').trim().charAt(0).toUpperCase();
    return (
      <span className={`avatar ${cls}`}>{letter}</span>
    );
  };

  const renderItems = (items, kind) => {
    const starred = items.filter(x => x.starred);
    const others = items.filter(x => !x.starred);
    const isList = kind === 'list' || kind === 'lists';

    const renderItemRow = (item) => {
      const isActive = isList ? board.activeId === item.id : board.activeNoteId === item.id;
      const openCount = isList ? item.todos.filter(t => !t.done).length : 0;
      const label = isList ? item.name : (item.title || 'Untitled note');

      return (
        <div
          key={item.id}
          className={`list-row ${isActive ? 'active' : ''}`}
          data-id={item.id}
          onClick={() => {
            updateBoard({
              [isList ? 'activeId' : 'activeNoteId']: item.id,
              tab: isList ? 'lists' : 'notes'
            });
            setUi(prev => ({ ...prev, viewing: true, drawer: false, admin: false, confirm: false, sharing: false, publishing: false }));
            navigate(isList ? '/lists' : '/notes');
          }}
        >
          <span className="grip" aria-hidden="true" title="Drag to reorder"><GripIcon /></span>
          <button className="list-open" type="button">
            <span className={`list-name ${!isList && !item.title ? 'untitled' : ''}`}>
              {label}
            </span>
            {item.shared && (
              <span
                className="share-mark"
                title={item.shared.mode === 'view' && !item.shared.own ? 'Shared with you · view only' : item.shared.own ? 'Shared by you' : 'Shared with you'}
              >
                {item.shared.mode === 'view' && !item.shared.own ? <EyeIcon size={14} /> : <UsersIcon size={14} />}
              </span>
            )}
            {isList && openCount > 0 && <span className="count">{openCount}</span>}
          </button>
          <button
            className={`icon-btn star-btn ${item.starred ? 'on' : ''}`}
            onClick={(e) => toggleStar(e, item, kind)}
            type="button"
            aria-label={item.starred ? 'Unstar' : 'Star'}
          >
            <StarIcon filled={item.starred} />
          </button>
        </div>
      );
    };

    return (
      <>
        {starred.length > 0 && <div className="sec-label">Starred</div>}
        {starred.length > 0 && (
          <div className="group" ref={starredGroupRef}>
            {starred.map(item => renderItemRow(item))}
          </div>
        )}
        {starred.length > 0 && others.length > 0 && (
          <div className="sec-label">{isList ? 'Lists' : 'Notes'}</div>
        )}
        {others.length > 0 && (
          <div className="group" ref={othersGroupRef}>
            {others.map(item => renderItemRow(item))}
          </div>
        )}
        {items.length === 0 && (
          <p className="side-empty">
            {isList
              ? 'No lists yet. Tap the new-list icon above.'
              : 'No notes yet. Tap the new-note icon above to write your first one.'}
          </p>
        )}
      </>
    );
  };

  const menuDropdown = ui.menu && (
    <div className="menu" id="menu" ref={menuRef} role="menu">
      <div className="menu-profile">
        <label className="photo-pick" htmlFor="sidebarPhotoInput" title="Change profile photo">
          {renderAvatar('lg')}
          <span className="cam"><CameraIcon /></span>
        </label>
        <div className="me-text">
          <span className="me-name">{session?.name || 'You'}</span>
          {session?.username && (
            <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>@{session.username}</span>
          )}
          <span className="photo-actions">
            <label className="text-btn" htmlFor="sidebarPhotoInput">
              {photo ? 'Change photo' : 'Add photo'}
            </label>
            {photo && (
              <button
                type="button"
                className="text-btn muted"
                onClick={() => { removePhoto(); setUi(prev => ({ ...prev, menu: false })); }}
              >
                Remove
              </button>
            )}
          </span>
        </div>
        <input
          type="file"
          id="sidebarPhotoInput"
          ref={fileInputRef}
          accept="image/*"
          hidden
          onChange={handlePhotoUpload}
        />
      </div>

      {/* Recovery Email Box */}
      <div style={{ padding: '8px 12px 10px', background: 'var(--soft)', borderRadius: '12px', margin: '4px 10px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MailIcon size={13} /> Recovery Email
          </span>
          {!editingEmail && (
            <button
              type="button"
              className="text-btn"
              style={{ fontSize: '.8rem' }}
              onClick={() => setEditingEmail(true)}
            >
              {session?.email ? 'Edit' : 'Add'}
            </button>
          )}
        </div>
        {editingEmail ? (
          <form onSubmit={handleSaveEmail} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <input
              type="email"
              className="input"
              style={{ fontSize: '.88rem', padding: '6px 10px' }}
              placeholder="your@email.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              autoFocus
              disabled={savingEmail}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="submit"
                className="pill ink"
                style={{ fontSize: '.78rem', padding: '3px 9px' }}
                disabled={savingEmail}
              >
                {savingEmail ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="pill plain"
                style={{ fontSize: '.78rem', padding: '3px 8px' }}
                onClick={() => { setEditingEmail(false); setEmailInput(session?.email || ''); }}
                disabled={savingEmail}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div style={{ fontSize: '.88rem', color: session?.email ? 'var(--ink)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={session?.email || ''}>
            {session?.email || 'None (needed for OTP reset)'}
          </div>
        )}
      </div>

      <div className="menu-sep"></div>
      <div className="menu-label">Theme colour</div>
      <div className="accent-row">
        {Object.entries(ACCENTS).map(([k, a]) => (
          <button
            key={k}
            type="button"
            className={`accent-sw ${k === accent ? 'on' : ''}`}
            title={a.name}
            aria-label={a.name}
            style={{ '--sw-l': a.l, '--sw-d': a.d }}
            onClick={() => setAccent(k)}
          />
        ))}
      </div>

      <div className="menu-label">Appearance</div>
      <div className="seg">
        <button
          type="button"
          className={theme === 'auto' ? 'on' : ''}
          title="Match device"
          aria-label="Match device theme"
          onClick={() => setTheme('auto')}
        >
          <MonitorIcon />
        </button>
        <button
          type="button"
          className={theme === 'light' ? 'on' : ''}
          title="Light"
          aria-label="Light theme"
          onClick={() => setTheme('light')}
        >
          <SunIcon />
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'on' : ''}
          title="Dark"
          aria-label="Dark theme"
          onClick={() => setTheme('dark')}
        >
          <MoonIcon />
        </button>
      </div>

      <div className="menu-sep"></div>
      {isAdmin && (
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setUi(prev => ({ ...prev, menu: false, admin: true, viewing: true }));
            navigate('/admin');
          }}
        >
          <ShieldIcon /> Admin · People
        </button>
      )}
      <button
        type="button"
        className="menu-item"
        onClick={() => {
          setUi(prev => ({ ...prev, menu: false }));
          openPrivacyPolicy('view');
        }}
      >
        <ShieldIcon /> Privacy Policy (DPDP)
      </button>
      <button
        type="button"
        className="menu-item"
        onClick={() => {
          setUi(prev => ({ ...prev, menu: false }));
          signOut();
        }}
      >
        <LogoutIcon /> Sign out
      </button>
    </div>
  );

  const renderCrmSide = () => {
    const all = crmMembers || [];
    const count = fl => all.filter(m => crmMatches(m, fl)).length;

    const row = (fl, label, n, warn, sub) => {
      const on = crmFilter.kind === fl.kind &&
        (fl.kind !== "plan" || crmFilter.plan === fl.plan) &&
        (fl.kind !== "label" || crmFilter.label === fl.label);

      return (
        <button
          key={fl.kind + (fl.plan || '') + (fl.label || '')}
          type="button"
          className={`crm-filter ${on ? 'active' : ''} ${fl.label && fl.label !== 'none' ? `lf lbl-${fl.label}` : ''}`}
          onClick={() => {
            if (fl.kind === 'plan') {
              setCrmFilter({ kind: 'plan', plan: fl.plan });
            } else if (fl.kind === 'label') {
              setCrmFilter({ kind: 'label', label: fl.label });
            } else {
              setCrmFilter({ kind: fl.kind });
            }
            setUi(prev => ({ ...prev, viewing: true, drawer: false }));
          }}
        >
          {fl.label && fl.label !== 'none' && LABELS[fl.label] && (
            <span className="lf-ic">
              <ArchetypeIcon label={fl.label} size={18} />
            </span>
          )}
          <span className="list-name">
            {label}
            {sub && <small className="lf-sub">{sub}</small>}
          </span>
          <span className={`count ${warn && n ? 'warn' : ''}`}>{n}</span>
        </button>
      );
    };

    return (
      <>
        {row({ kind: 'all' }, 'All members', all.length)}
        {row({ kind: 'expiring' }, 'Expiring in 30 days', count({ kind: 'expiring' }), true)}
        {row({ kind: 'due' }, 'Follow-ups due', count({ kind: 'due' }), true)}
        {row({ kind: 'expired' }, 'Expired', count({ kind: 'expired' }), true)}
        <div className="sec-label">Labels</div>
        {Object.entries(LABELS).map(([k, L]) =>
          row({ kind: 'label', label: k }, L.avatar, count({ kind: 'label', label: k }), false, `${L.name} · ${L.stage}`)
        )}
        {row({ kind: 'label', label: 'none' }, 'No label', count({ kind: 'label', label: 'none' }))}
        <div className="sec-label">Plans</div>
        {PLANS.map(p => row({ kind: 'plan', plan: p }, p, count({ kind: 'plan', plan: p })))}
      </>
    );
  };

  const renderJournalSide = () => {
    const t = today0();
    const curYear = t.getFullYear();
    const curYearEntries = journalYears[curYear]?.entries || {};
    const prefix = mmdd(t).slice(0, 2);
    const monthCount = Object.entries(curYearEntries).filter(([k, v]) => k.startsWith(prefix) && jHas(v)).length;
    const yearCount = Object.values(curYearEntries).filter(jHas).length;

    // Calculate streak
    let streak = 0;
    const checkDate = today0();
    const getE = (d) => {
      const y = d.getFullYear();
      const k = mmdd(d);
      return journalYears[y]?.entries?.[k];
    };
    if (!jHas(getE(checkDate))) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (streak < 3660 && jHas(getE(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Last year same day
    const lastYear = curYear - 1;
    const todayKey = mmdd(t);
    const ly = journalYears[lastYear]?.entries?.[todayKey] || { t: '', img: '', mood: '' };

    return (
      <>
        <button
          type="button"
          className={`crm-filter ${journalViewMode === 'range' ? 'active' : ''}`}
          onClick={() => {
            setJournalViewMode('range');
            setJournalCenter(null);
            setUi(prev => ({ ...prev, viewing: true, drawer: false }));
          }}
        >
          <span className="list-name">Around today</span>
        </button>
        <button
          type="button"
          className={`crm-filter ${journalViewMode === 'month' ? 'active' : ''}`}
          onClick={() => {
            setJournalViewMode('month');
            setJournalMonth(null);
            setUi(prev => ({ ...prev, viewing: true, drawer: false }));
          }}
        >
          <span className="list-name">This month</span>
        </button>

        <div className="sec-label">At a glance</div>
        <div className="j-stats">
          <div>
            <b>{streak}</b>
            <span>day streak</span>
          </div>
          <div>
            <b>{monthCount}</b>
            <span>this month</span>
          </div>
          <div>
            <b>{yearCount}</b>
            <span>this year</span>
          </div>
        </div>

        <div className="sec-label">On this day, {lastYear}</div>
        <div className={`j-otd ${jHas(ly) ? '' : 'muted'}`}>
          {ly.img && (
            <div className="j-otd-img">
              <img src={ly.img} alt="" />
            </div>
          )}
          <p>
            {ly.mood && (
              <span className="j-otd-mood" title={moodName(ly.mood)}>
                {ly.mood}
              </span>
            )}{' '}
            {jHas(ly) ? (ly.t || '') : 'Nothing written on this day last year.'}
          </p>
        </div>
      </>
    );
  };

  // Collapsed rail view (not used on dual-screen Surface Duo, where Screen 1 is dedicated to sidebar)
  if (collapsed && foldMode !== 'dual-vertical') {
    return (
      <aside className="side rail">
        <button
          type="button"
          className="hbtn"
          id="collapse"
          title="Expand sidebar"
          aria-label="Expand sidebar"
          onClick={() => setCollapsed(false)}
        >
          <PanelIcon />
        </button>
        <button
          type="button"
          className="hbtn add"
          title="New list"
          aria-label="New list"
          onClick={() => {
            setCollapsed(false);
            setUi(prev => ({ ...prev, adding: true, admin: false }));
          }}
        >
          <ListPlusIcon />
        </button>
        <button
          type="button"
          className="hbtn add"
          title="New note"
          aria-label="New note"
          onClick={handleAddNote}
        >
          <NotePlusIcon />
        </button>
        <span className="rail-sep"></span>
        <button
          type="button"
          className={`hbtn ${board.tab === 'lists' && !ui.admin ? 'on' : ''}`}
          title="Lists"
          aria-label="Lists"
          onClick={() => {
            updateBoard({ tab: 'lists' });
            setUi(prev => ({ ...prev, admin: false }));
            navigate('/lists');
          }}
        >
          <ListsIcon />
        </button>
        <button
          type="button"
          className={`hbtn ${board.tab === 'notes' && !ui.admin ? 'on' : ''}`}
          title="Notes"
          aria-label="Notes"
          onClick={() => {
            updateBoard({ tab: 'notes' });
            setUi(prev => ({ ...prev, admin: false }));
            navigate('/notes');
          }}
        >
          <NotesIcon />
        </button>
        <button
          type="button"
          className={`hbtn ${board.tab === 'journal' && !ui.admin ? 'on' : ''}`}
          title="Journal"
          aria-label="Journal"
          onClick={() => {
            updateBoard({ tab: 'journal' });
            setUi(prev => ({ ...prev, admin: false }));
            navigate('/journal');
          }}
        >
          <JournalIcon />
        </button>
        {isCrmAllowed && (
          <button
            type="button"
            className={`hbtn ${board.tab === 'crm' && !ui.admin ? 'on' : ''}`}
            title="CRM"
            aria-label="CRM"
            onClick={() => {
              updateBoard({ tab: 'crm' });
              setUi(prev => ({ ...prev, admin: false }));
              navigate('/crm');
            }}
          >
            <CrmIcon />
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            className={`hbtn ${ui.admin ? 'on' : ''}`}
            title="Admin · People"
            aria-label="Admin page"
            onClick={() => {
              setUi(prev => ({ ...prev, admin: true, viewing: true }));
              navigate('/admin');
            }}
          >
            <ShieldIcon />
          </button>
        )}
        <span className="rail-spacer"></span>
        <button
          type="button"
          className="me"
          id="meBtn"
          title={`${session?.name || 'You'} · Settings`}
          aria-label="Profile and settings"
          onClick={() => setUi(prev => ({ ...prev, menu: !prev.menu }))}
        >
          {renderAvatar()}
        </button>
        {menuDropdown}
        <div
          className="side-resizer"
          onPointerDown={handleRailPointerDown}
          title="Drag right to expand sidebar"
          aria-label="Expand sidebar"
          role="separator"
          aria-orientation="vertical"
        />
      </aside>
    );
  }

  // Expanded sidebar view
  return (
    <aside className="side">
      <div className="side-head">
        <div className="side-top">
          <div className="side-brand">My<span>Deepwork</span></div>
          <div className="hdr">
            <button
              type="button"
              className="hbtn add"
              id="addList"
              title="New list"
              aria-label="New list"
              onClick={() => {
                updateBoard({ tab: 'lists' });
                setUi(prev => ({ ...prev, adding: !prev.adding, admin: false }));
                navigate('/lists');
              }}
            >
              <ListPlusIcon />
            </button>
            <button
              type="button"
              className="hbtn add"
              id="addNote"
              title="New note"
              aria-label="New note"
              onClick={handleAddNote}
            >
              <NotePlusIcon />
            </button>
            {isAdmin && (
              <button
                type="button"
                className={`hbtn ${ui.admin ? 'on' : ''}`}
                title="Admin · People"
                aria-label="Admin page"
                onClick={() => {
                  setUi(prev => ({ ...prev, admin: true, viewing: true }));
                  navigate('/admin');
                }}
              >
                <ShieldIcon />
              </button>
            )}
            <button
              type="button"
              className="hbtn collapse-btn"
              id="collapse"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              <PanelIcon />
            </button>
            {ui.drawer && (
              <button
                type="button"
                className="hbtn fold-drawer-close"
                onClick={() => setUi(prev => ({ ...prev, drawer: false }))}
                title="Close drawer"
                aria-label="Close drawer"
              >
                <XIcon size={20} />
              </button>
            )}
          </div>
        </div>

        {ui.adding && (
          <form className="new-list" id="newListForm" onSubmit={handleAddList} autoComplete="off">
            <input
              className="input"
              id="newListName"
              placeholder="List name"
              maxLength={60}
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              autoFocus
              onBlur={() => {
                if (!newListName.trim()) {
                  setTimeout(() => setUi(prev => ({ ...prev, adding: false })), 150);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setUi(prev => ({ ...prev, adding: false }));
              }}
            />
            <button className="send" type="submit" aria-label="Create list">
              <PlusIcon />
            </button>
          </form>
        )}

        <div className={`tabs ${isCrmAllowed ? 'four' : 'three'}`} role="tablist">
          <button
            type="button"
            className={`tab ${board.tab === 'lists' && !ui.admin ? 'on' : ''}`}
            role="tab"
            aria-selected={board.tab === 'lists' && !ui.admin}
            onClick={() => {
              updateBoard({ tab: 'lists' });
              setUi(prev => ({ ...prev, admin: false, adding: false }));
              navigate('/lists');
            }}
          >
            <ListsIcon />
            <span className="n">{board.lists.length}</span>
          </button>
          <button
            type="button"
            className={`tab ${board.tab === 'notes' && !ui.admin ? 'on' : ''}`}
            role="tab"
            aria-selected={board.tab === 'notes' && !ui.admin}
            onClick={() => {
              updateBoard({ tab: 'notes' });
              setUi(prev => ({ ...prev, admin: false, adding: false }));
              navigate('/notes');
            }}
          >
            <NotesIcon />
            <span className="n">{board.notes.length}</span>
          </button>
          <button
            type="button"
            className={`tab ${board.tab === 'journal' && !ui.admin ? 'on' : ''}`}
            role="tab"
            aria-selected={board.tab === 'journal' && !ui.admin}
            onClick={() => {
              updateBoard({ tab: 'journal' });
              setUi(prev => ({ ...prev, admin: false, adding: false }));
              navigate('/journal');
            }}
            title="Journal"
            aria-label="Journal"
          >
            <JournalIcon />
          </button>
          {isCrmAllowed && (
            <button
              type="button"
              className={`tab ${board.tab === 'crm' && !ui.admin ? 'on' : ''}`}
              role="tab"
              aria-selected={board.tab === 'crm' && !ui.admin}
              onClick={() => {
                updateBoard({ tab: 'crm' });
                setUi(prev => ({ ...prev, admin: false, adding: false }));
                navigate('/crm');
              }}
            >
              <CrmIcon />
              <span className="n">{crmMembers.length}</span>
            </button>
          )}
        </div>
      </div>

      <div className="lists">
        {board.tab === 'crm'
          ? renderCrmSide()
          : board.tab === 'journal'
          ? renderJournalSide()
          : board.tab === 'lists'
          ? renderItems(board.lists, 'lists')
          : renderItems(board.notes, 'notes')}
      </div>

      <div className="side-foot">
        <button
          type="button"
          className="me"
          id="meBtn"
          aria-label="Profile and settings"
          onClick={() => setUi(prev => ({ ...prev, menu: !prev.menu }))}
        >
          {renderAvatar()}
          <span className="me-text">
            <span className="me-name">{session?.name || 'You'}</span>
            <span className="me-sub">{session?.username ? `@${session.username}` : 'Saved locally'}</span>
          </span>
        </button>
        <button
          type="button"
          className="hbtn"
          id="settingsBtn"
          title="Settings"
          aria-label="Settings"
          onClick={() => setUi(prev => ({ ...prev, menu: !prev.menu }))}
        >
          <GearIcon />
        </button>
      </div>

      {menuDropdown}
      <div
        className={`side-resizer ${isDragging ? 'dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        title="Drag to resize sidebar (Double-click to reset)"
        aria-label="Resize sidebar"
        role="separator"
        aria-orientation="vertical"
      />
    </aside>
  );
};
