import { useState, useRef, useEffect, useMemo } from 'react';
import Sortable from 'sortablejs';
import { useApp } from '../context/AppContext';
import {
  PLANS,
  crmMatches,
  timeLeft,
  nextFollowUp,
  dueInfo,
  fmtDate,
  waLink,
  initials
} from '../utils/constants';
import {
  PlusIcon,
  BackIcon,
  SearchIcon,
  KanbanIcon,
  RowsIcon,
  XIcon,
  ChatIcon,
  CalendarIcon,
  NotesIcon,
  ProfileIcon
} from './Icons';

export const CrmView = () => {
  const {
    crmMembers,
    crmLoaded,
    crmErr,
    crmView,
    setCrmView,
    crmFilter,
    setCrmFilter,
    crmSearch,
    setCrmSearch,
    openCrmModal,
    saveCrmMember,
    showToast,
    setUi
  } = useApp();

  const sortablesRef = useRef([]);
  const membersRef = useRef(crmMembers);
  useEffect(() => {
    membersRef.current = crmMembers;
  }, [crmMembers]);

  // Counts for expiring soon and follow-ups due
  const soonCount = useMemo(
    () => crmMembers.filter(m => crmMatches(m, { kind: 'expiring' })).length,
    [crmMembers]
  );
  const dueCount = useMemo(
    () => crmMembers.filter(m => crmMatches(m, { kind: 'due' })).length,
    [crmMembers]
  );

  // Filter and search
  const filteredMembers = useMemo(() => {
    const q = (crmSearch || '').trim().toLowerCase();
    const qd = q.replace(/\D/g, '');

    return crmMembers
      .filter(m => {
        if (!crmMatches(m, crmFilter)) return false;
        if (!q) return true;
        const nameMatch = (m.name || '').toLowerCase().includes(q);
        const mobileMatch = qd && (m.mobile || '').replace(/\D/g, '').includes(qd);
        const emailMatch = m.email && m.email.toLowerCase().includes(q);
        return nameMatch || mobileMatch || emailMatch;
      })
      .sort((a, b) => (a.end || '9999').localeCompare(b.end || '9999') || (a.name || '').localeCompare(b.name || ''));
  }, [crmMembers, crmFilter, crmSearch]);

  const title = useMemo(() => {
    if (crmFilter.kind === 'plan') return crmFilter.plan;
    if (crmFilter.kind === 'expiring') return 'Expiring in 30 days';
    if (crmFilter.kind === 'due') return 'Follow-ups due';
    if (crmFilter.kind === 'expired') return 'Expired';
    return 'CRM';
  }, [crmFilter]);

  // Setup Kanban Sortable drag & drop
  useEffect(() => {
    sortablesRef.current.forEach(s => s.destroy());
    sortablesRef.current = [];

    if (crmView !== 'kanban') return;

    const cols = document.querySelectorAll('.kb-body');
    cols.forEach(col => {
      const s = Sortable.create(col, {
        group: 'crm-kanban',
        animation: 160,
        delay: 200,
        delayOnTouchOnly: true,
        touchStartThreshold: 6,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: async evt => {
          const { item, to } = evt;
          const memberId = item.dataset.member;
          const toPlan = to.dataset.plan;
          const member = membersRef.current.find(x => x.id === memberId);
          if (member && toPlan && toPlan !== member.plan) {
            const fromPlan = member.plan;
            const updated = { ...member, plan: toPlan };
            await saveCrmMember(updated);
            showToast(`${member.name || 'Member'} moved from ${fromPlan} to ${toPlan}.`);
          }
        }
      });
      sortablesRef.current.push(s);
    });

    return () => {
      sortablesRef.current.forEach(s => s.destroy());
      sortablesRef.current = [];
    };
  }, [crmView, filteredMembers, saveCrmMember, showToast]);

  const renderAvatar = (m, cls = '') => (
    <span className={`mav ${cls}`}>
      {m.photo ? (
        <img src={m.photo} alt={m.name} />
      ) : (
        initials(m.name)
      )}
    </span>
  );

  const renderCard = (m) => {
    const tl = timeLeft(m.end);
    const nf = dueInfo(nextFollowUp(m));
    const wa = waLink(m.mobile);

    return (
      <article
        key={m.id}
        className="mcard"
        data-member={m.id}
        tabIndex={0}
        aria-label={m.name || 'Member'}
        onClick={() => openCrmModal(m.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') openCrmModal(m.id);
        }}
      >
        <div className="mcard-top">
          {renderAvatar(m)}
          <div className="mcard-id">
            <div className="mname">{m.name || 'Unnamed'}</div>
            {m.mobile && <div className="mmob">{m.mobile}</div>}
          </div>
          <span className="m-links">
            {wa && (
              <a
                className="wa"
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                title={`WhatsApp ${m.name || ''}`}
                aria-label={`WhatsApp ${m.name || ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                <ChatIcon />
              </a>
            )}
            {m.linkedin && (
              <a
                className="li"
                href={m.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${m.name || ''}'s LinkedIn profile`}
                aria-label={`LinkedIn profile of ${m.name || ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                <ProfileIcon size={18} />
              </a>
            )}
          </span>
        </div>
        <div className="mrows">
          <div className="mrow">
            {m.end ? (
              <>
                Expires on <b>{fmtDate(m.end)}</b>
              </>
            ) : (
              <span className="muted">No end date</span>
            )}
          </div>
          {tl && <span className={`chip ${tl.status}`}>{tl.label}</span>}
          {nf && (
            <div className={`mrow due ${nf.status}`}>
              <CalendarIcon size={16} />
              <span>{nf.label}</span>
            </div>
          )}
          {Boolean(m.sessionCount) && (
            <div className="mrow sess-sum">
              <NotesIcon size={16} />
              <span>
                Last session {fmtDate(m.lastSession)} · {m.sessionCount} note{m.sessionCount === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </article>
    );
  };

  const plansToShow = crmFilter.kind === 'plan' ? [crmFilter.plan] : PLANS;

  return (
    <>
      <div className="main-head crm-head">
        <button
          type="button"
          className="icon-btn back"
          id="back"
          aria-label="Back"
          onClick={() => setUi(prev => ({ ...prev, viewing: false }))}
        >
          <BackIcon />
        </button>
        <div className="title-wrap">
          <div className="title">{title}</div>
          <div className="sub">
            {crmLoaded
              ? `${crmMembers.length} member${crmMembers.length === 1 ? '' : 's'} · ${soonCount} expiring soon · ${dueCount} follow-up${dueCount === 1 ? '' : 's'} due`
              : 'Loading…'}
          </div>
        </div>
        <button
          type="button"
          className="pill ink add-member"
          onClick={() => openCrmModal(null, crmFilter.kind === 'plan' ? crmFilter.plan : null)}
        >
          <PlusIcon size={18} />
          <span>Add Member</span>
        </button>
      </div>

      <div className="crm-tools">
        <label className="crm-search">
          <SearchIcon size={18} />
          <input
            id="crmSearch"
            placeholder="Search name, mobile or email"
            value={crmSearch}
            onChange={(e) => setCrmSearch(e.target.value)}
            aria-label="Search members"
          />
          {crmSearch && (
            <button
              type="button"
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              onClick={() => setCrmSearch('')}
              aria-label="Clear search"
            >
              <XIcon size={14} />
            </button>
          )}
        </label>

        <div className="view-seg" role="group" aria-label="View">
          <button
            type="button"
            className={crmView === 'kanban' ? 'on' : ''}
            onClick={() => setCrmView('kanban')}
            aria-pressed={crmView === 'kanban'}
          >
            <KanbanIcon />
            <span>Kanban</span>
          </button>
          <button
            type="button"
            className={crmView === 'list' ? 'on' : ''}
            onClick={() => setCrmView('list')}
            aria-pressed={crmView === 'list'}
          >
            <RowsIcon />
            <span>List</span>
          </button>
        </div>

        {crmFilter.kind !== 'all' && (
          <button
            type="button"
            className="filter-chip"
            onClick={() => setCrmFilter({ kind: 'all' })}
          >
            {title} <XIcon size={14} />
          </button>
        )}
      </div>

      <div className="crm-main" id="crmMain">
        {crmErr ? (
          <p className="empty" style={{ paddingLeft: 24 }}>{crmErr}</p>
        ) : !crmLoaded ? (
          <p className="empty" style={{ paddingLeft: 24 }}>Loading members…</p>
        ) : !crmMembers.length ? (
          <div className="crm-empty">
            <div className="card-title">No members yet</div>
            <p className="card-note">Add your first member to start tracking renewals and follow-ups.</p>
            <button
              type="button"
              className="pill ink add-member"
              onClick={() => openCrmModal(null, PLANS[0])}
            >
              <PlusIcon size={18} />
              <span>Add Member</span>
            </button>
          </div>
        ) : crmView === 'kanban' ? (
          <div className="kanban" id="kanban">
            {plansToShow.map(p => {
              const ms = filteredMembers.filter(m => m.plan === p);
              return (
                <section key={p} className="kb-col">
                  <header className="kb-head">
                    <span>{p}</span>
                    <span className="count">{ms.length}</span>
                  </header>
                  <div className="kb-body" data-plan={p}>
                    {ms.map(renderCard)}
                  </div>
                  <button
                    type="button"
                    className="kb-add"
                    onClick={() => openCrmModal(null, p)}
                  >
                    <PlusIcon size={18} /> Add to {p}
                  </button>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="crm-list" role="table" aria-label="Members">
            <div className="crm-tr crm-th" role="row">
              <span>Member</span>
              <span>Plan</span>
              <span>Mobile</span>
              <span>Start</span>
              <span>Expires</span>
              <span>Time left</span>
              <span>Next follow-up</span>
              <span>Last session</span>
            </div>
            {filteredMembers.length ? (
              filteredMembers.map(m => {
                const tl = timeLeft(m.end);
                const nf = dueInfo(nextFollowUp(m));
                const wa = waLink(m.mobile);
                return (
                  <div
                    key={m.id}
                    className="crm-tr"
                    role="row"
                    tabIndex={0}
                    onClick={() => openCrmModal(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openCrmModal(m.id);
                    }}
                  >
                    <span className="c-name">
                      {renderAvatar(m, 'sm')}
                      <b>{m.name || 'Unnamed'}</b>
                    </span>
                    <span className="c-plan">
                      <span className="plan-tag">{m.plan}</span>
                    </span>
                    <span className="c-mob">
                      {m.mobile || '—'}
                      {wa && (
                        <a
                          className="wa sm"
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ChatIcon size={14} />
                        </a>
                      )}
                      {m.linkedin && (
                        <a
                          className="li sm"
                          href={m.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open ${m.name || ''}'s LinkedIn profile`}
                          aria-label={`LinkedIn profile of ${m.name || ''}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ProfileIcon size={14} />
                        </a>
                      )}
                    </span>
                    <span className="c-start">{m.start ? fmtDate(m.start) : '—'}</span>
                    <span className="c-end">{m.end ? fmtDate(m.end) : '—'}</span>
                    <span className="c-left">
                      {tl ? <span className={`chip ${tl.status}`}>{tl.label}</span> : '—'}
                    </span>
                    <span className={`c-due ${nf ? nf.status : 'none'}`}>
                      {nf ? nf.label : '—'}
                    </span>
                    <span className={`c-sess ${m.sessionCount ? '' : 'none'}`}>
                      {m.sessionCount ? (
                        <>
                          {fmtDate(m.lastSession)}{' '}
                          <span className="muted">· {m.sessionCount}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="card-note" style={{ padding: 16 }}>No members match.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
};

