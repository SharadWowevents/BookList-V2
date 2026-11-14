import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatLastOnline } from '../utils/constants';
import { XIcon, UsersIcon, SearchIcon } from './Icons';

export const OnlinePresenceModal = () => {
  const { ui, setUi, presenceUsers, onlineUsers, isUserOnline, session } = useApp();
  const [filter, setFilter] = useState('online'); // 'online' | 'all'
  const [search, setSearch] = useState('');

  // Close on Escape key
  useEffect(() => {
    if (!ui.onlineModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setUi(prev => ({ ...prev, onlineModal: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ui.onlineModal, setUi]);

  const list = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    const all = presenceUsers || [];

    return all.filter(u => {
      const uName = (u.name || '').toLowerCase();
      const uUser = (u.u || u.username || '').toLowerCase();
      const matchesSearch = !q || uName.includes(q) || uUser.includes(q);
      if (!matchesSearch) return false;

      const online = isUserOnline(u.u || u.username);
      if (filter === 'online') return online;
      return true;
    }).sort((a, b) => {
      // Sort online users first, then by lastSeen desc
      const aOnline = isUserOnline(a.u || a.username);
      const bOnline = isUserOnline(b.u || b.username);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      const aSeen = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
      const bSeen = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
      return bSeen - aSeen;
    });
  }, [presenceUsers, filter, search, isUserOnline]);

  if (!ui.onlineModal) return null;

  const onlineCount = onlineUsers?.size || 0;
  const totalCount = presenceUsers?.length || 0;

  return (
    <div
      className="modal-mask"
      role="dialog"
      aria-modal="true"
      aria-labelledby="presenceModalTitle"
      onClick={() => setUi(prev => ({ ...prev, onlineModal: false }))}
    >
      <div
        className="modal-card presence-modal-card"
        onClick={e => e.stopPropagation()}
      >
        <div className="presence-modal-header">
          <div className="presence-modal-title-group">
            <div className="presence-modal-icon-badge">
              <UsersIcon size={20} />
            </div>
            <div>
              <h2 id="presenceModalTitle" className="presence-modal-title">
                Who's Online
              </h2>
              <p className="presence-modal-subtitle">
                <span className="live-pulse-dot" />
                <b>{onlineCount}</b> {onlineCount === 1 ? 'member' : 'members'} online now
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setUi(prev => ({ ...prev, onlineModal: false }))}
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="presence-controls">
          <div className="presence-tabs">
            <button
              type="button"
              className={`presence-tab ${filter === 'online' ? 'active' : ''}`}
              onClick={() => setFilter('online')}
            >
              <span className="live-pulse-dot" /> Online ({onlineCount})
            </button>
            <button
              type="button"
              className={`presence-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Team ({totalCount})
            </button>
          </div>

          {totalCount > 4 && (
            <div className="presence-search-wrap">
              <SearchIcon size={15} />
              <input
                type="text"
                className="input presence-search-input"
                placeholder="Search teammates…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  className="icon-btn presence-clear-search"
                  onClick={() => setSearch('')}
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="presence-list">
          {list.length === 0 ? (
            <div className="presence-empty">
              {filter === 'online'
                ? 'No one else is online right now.'
                : 'No team members found.'}
            </div>
          ) : (
            list.map(u => {
              const username = (u.u || u.username || '').toLowerCase();
              const isSelf = session?.username?.toLowerCase() === username;
              const online = isUserOnline(username);
              const displayName = u.name || username;
              const letter = displayName.trim().charAt(0).toUpperCase();

              return (
                <div key={username} className="presence-row">
                  <div className="presence-avatar-wrap">
                    <span className="avatar sm">
                      {u.photo ? (
                        <img src={u.photo} alt={displayName} />
                      ) : (
                        letter
                      )}
                    </span>
                    <span
                      className={`status-indicator-dot ${online ? 'online' : 'offline'}`}
                      title={online ? 'Online now' : u.lastSeen ? `Last online: ${formatLastOnline(u.lastSeen)}` : "Hasn't signed in yet"}
                    />
                  </div>

                  <div className="presence-info">
                    <div className="presence-name-line">
                      <span className="presence-name">{displayName}</span>
                      {isSelf && (
                        <span className="pill-state is-on" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          You
                        </span>
                      )}
                      {u.role === 'admin' && (
                        <span className="pill-state is-admin" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="presence-sub-line">
                      @{username}
                    </div>
                  </div>

                  <div className="presence-status-col">
                    {online ? (
                      <span className="pill-state is-online">
                        <span className="live-pulse-dot" /> Online
                      </span>
                    ) : (
                      <span
                        className="presence-last-seen"
                        title={u.lastSeen ? new Date(u.lastSeen).toLocaleString() : ''}
                      >
                        {u.lastSeen ? formatLastOnline(u.lastSeen) : "Hasn't signed in"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
