import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ACCENTS, uid } from '../utils/constants';
import {
  PlusIcon, StarIcon, GripIcon, PanelIcon, ListPlusIcon, NotePlusIcon,
  ListsIcon, NotesIcon, GearIcon, SunIcon, MoonIcon, MonitorIcon,
  LogoutIcon, ShieldIcon, CameraIcon, EyeIcon, UsersIcon
} from './Icons';

export const Sidebar = () => {
  const {
    board, updateBoard, ui, setUi, session, signOut,
    accent, setAccent, theme, setTheme,
    collapsed, setCollapsed, photo, savePhoto, removePhoto,
    showToast
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

  // Reorder items via drag & drop
  const [draggedItemId, setDraggedItemId] = useState(null);

  const handleDragStart = (e, id) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetId, kind) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) return;
    const listKey = kind === 'list' ? 'lists' : 'notes';
    const items = [...board[listKey]];
    const fromIdx = items.findIndex(x => x.id === draggedItemId);
    const toIdx = items.findIndex(x => x.id === targetId);
    if (fromIdx >= 0 && toIdx >= 0) {
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      updateBoard({ [listKey]: items });
    }
    setDraggedItemId(null);
  };

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
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, item.id, isList ? 'lists' : 'notes')}
          onClick={() => {
            updateBoard({
              [isList ? 'activeId' : 'activeNoteId']: item.id,
              tab: isList ? 'lists' : 'notes'
            });
            setUi(prev => ({ ...prev, viewing: true, admin: false, confirm: false, sharing: false, publishing: false }));
          }}
        >
          <span className="grip" aria-hidden="true"><GripIcon /></span>
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
        <div className="group">
          {starred.map(item => <ItemRow key={item.id} item={item} />)}
        </div>
        {starred.length > 0 && others.length > 0 && (
          <div className="sec-label">{isList ? 'Lists' : 'Notes'}</div>
        )}
        <div className="group">
          {others.map(item => <ItemRow key={item.id} item={item} />)}
        </div>
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

        <div className="tabs" role="tablist">
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
        </div>
      </div>

      <div className="lists">
        {board.tab === 'lists' ? renderItems(board.lists, 'lists') : renderItems(board.notes, 'notes')}
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
            <span className="me-sub">Saved locally</span>
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
