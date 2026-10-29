import { useState, useRef, useEffect } from 'react';
import Sortable from 'sortablejs';
import { useApp } from '../context/AppContext';
import { ACCENTS, uid, reorderSubset, PLANS, crmMatches } from '../utils/constants';
import {
  PlusIcon, StarIcon, GripIcon, PanelIcon, ListPlusIcon, NotePlusIcon,
  ListsIcon, NotesIcon, GearIcon, SunIcon, MoonIcon, MonitorIcon,
  LogoutIcon, ShieldIcon, CameraIcon, EyeIcon, UsersIcon, CrmIcon, JournalIcon
} from './Icons';
import { mmdd, today0, jHas, moodName } from './JournalView';

export const Sidebar = () => {
  const {
    board, updateBoard, ui, setUi, session, signOut,
    accent, setAccent, theme, setTheme,
    collapsed, setCollapsed, photo, savePhoto, removePhoto,
    showToast,
    crmMembers, crmFilter, setCrmFilter, isCrmAllowed,
    journalYears, journalViewMode, setJournalViewMode, setJournalCenter, setJournalMonth
  } = useApp();

  const isAdmin = session?.role === 'admin';

  const [newListName, setNewListName] = useState('');
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

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
  };

  const handleAddNote = () => {
    const newNote = { id: uid(), title: '', starred: false };
    updateBoard({
      notes: [newNote, ...board.notes],
      activeNoteId: newNote.id,
      tab: 'notes'
    });
    setUi(prev => ({ ...prev, adding: false, viewing: true, admin: false }));
  };

  const toggleStar = (e, item, kind) => {
    e.stopPropagation();
    const listKey = kind === 'list' ? 'lists' : 'notes';
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
      };
      img.onerror = () => showToast("Couldn't read image file.");
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

    const ItemRow = ({ item }) => {
      const isActive = isList ? board.activeId === item.id : board.activeNoteId === item.id;
      const openCount = isList ? item.todos.filter(t => !t.done).length : 0;
      const label = isList ? item.name : (item.title || 'Untitled note');

      return (
        <div
          className={`list-row ${isActive ? 'active' : ''}`}
          data-id={item.id}
          onClick={() => {
            updateBoard({
              [isList ? 'activeId' : 'activeNoteId']: item.id,
              tab: isList ? 'lists' : 'notes'
            });
            setUi(prev => ({ ...prev, viewing: true, admin: false, confirm: false, sharing: false, publishing: false }));
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
            {starred.map(item => <ItemRow key={item.id} item={item} />)}
          </div>
        )}
        {starred.length > 0 && others.length > 0 && (
          <div className="sec-label">{isList ? 'Lists' : 'Notes'}</div>
        )}
        {others.length > 0 && (
          <div className="group" ref={othersGroupRef}>
            {others.map(item => <ItemRow key={item.id} item={item} />)}
          </div>
        )}
        {items.length === 0 && (
          <p className="side-empty">
            {kind === 'list'
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

    const row = (fl, label, n, warn) => {
      const on = crmFilter.kind === fl.kind && (fl.kind !== "plan" || crmFilter.plan === fl.plan);
      return (
        <button
          key={fl.kind + (fl.plan || '')}
          type="button"
          className={`crm-filter ${on ? 'active' : ''}`}
          onClick={() => {
            setCrmFilter(fl.kind === 'plan' ? { kind: 'plan', plan: fl.plan } : { kind: fl.kind });
            setUi(prev => ({ ...prev, viewing: true }));
          }}
        >
          <span className="list-name">{label}</span>
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
            setUi(prev => ({ ...prev, viewing: true }));
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
            setUi(prev => ({ ...prev, viewing: true }));
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

  // Collapsed rail view
  if (collapsed) {
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
          onClick={() => updateBoard({ tab: 'lists' })}
        >
          <ListsIcon />
        </button>
        <button
          type="button"
          className={`hbtn ${board.tab === 'notes' && !ui.admin ? 'on' : ''}`}
          title="Notes"
          aria-label="Notes"
          onClick={() => updateBoard({ tab: 'notes' })}
        >
          <NotesIcon />
        </button>
        <button
          type="button"
          className={`hbtn ${board.tab === 'journal' && !ui.admin ? 'on' : ''}`}
          title="Journal"
          aria-label="Journal"
          onClick={() => updateBoard({ tab: 'journal' })}
        >
          <JournalIcon />
        </button>
        {isCrmAllowed && (
          <button
            type="button"
            className={`hbtn ${board.tab === 'crm' && !ui.admin ? 'on' : ''}`}
            title="CRM"
            aria-label="CRM"
            onClick={() => updateBoard({ tab: 'crm' })}
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
            onClick={() => setUi(prev => ({ ...prev, admin: true, viewing: true }))}
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
                onClick={() => setUi(prev => ({ ...prev, admin: true, viewing: true }))}
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
    </aside>
  );
};
