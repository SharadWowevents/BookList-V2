import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  PLANS,
  SESSION_TYPES,
  LABELS,
  parseYMD,
  today0,
  addMonths,
  ymd,
  fmtDate,
  timeLeft,
  dayName,
  fmtDow,
  squareImage,
  initials,
  normLinkedIn
} from '../utils/constants';
import {
  XIcon,
  PlusIcon,
  CheckIcon,
  CameraIcon,
  MicIcon,
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  NotesIcon,
  ArchetypeIcon
} from './Icons';

export const CrmModal = () => {
  const {
    crmModal,
    setCrmModal,
    closeCrmModal,
    saveCrmMember,
    deleteCrmMember,
    saveCrmSession,
    deleteCrmSession,
    showToast,
    session
  } = useApp();

  if (!crmModal) return null;

  const isEdit = Boolean(crmModal.id);
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(crmModal.draft)));
  const [activeTab, setActiveTab] = useState(crmModal.tab || 'details');
  const [error, setError] = useState('');

  // Follow-up inputs
  const [fuDate, setFuDate] = useState('');
  const [fuNote, setFuNote] = useState('');

  // Delete confirmation
  const [confirmDel, setConfirmDel] = useState(false);

  // New session state
  const [sessDate, setSessDate] = useState(() => ymd(today0()));
  const [sessType, setSessType] = useState('Session');
  const [sessText, setSessText] = useState('');
  const [sessBusy, setSessBusy] = useState(false);

  // Editing existing session state
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState('Session');
  const [editText, setEditText] = useState('');
  const [confirmDelSessionId, setConfirmDelSessionId] = useState(null);

  // Speech Recognition (Dictation) state
  const [isListening, setIsListening] = useState(false);
  const recognizerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop dictation when unmounting or switching tabs
  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        try { recognizerRef.current.stop(); } catch {}
      }
    };
  }, []);

  const toggleDictation = () => {
    if (isListening) {
      if (recognizerRef.current) {
        try { recognizerRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      let baseText = sessText.trim();

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (ev) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalTrans += r[0].transcript;
          else interimTrans += r[0].transcript;
        }

        if (finalTrans) {
          const t = finalTrans.trim();
          baseText = (baseText ? baseText + (/[.!?]$/.test(baseText) ? ' ' : '. ') : '') + t.charAt(0).toUpperCase() + t.slice(1);
        }

        setSessText(baseText + (interimTrans ? ' ' + interimTrans : ''));
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setSessText(baseText);
      };

      recognizerRef.current = rec;
      rec.start();
    } catch {
      showToast("Couldn't start speech recognition.");
      setIsListening(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;

    try {
      const dataUri = await squareImage(file, 240);
      setDraft(prev => ({ ...prev, photo: dataUri }));
      showToast(isEdit ? 'Photo added. Click Save changes to keep it.' : 'Photo added.');
    } catch {
      showToast("That image couldn't be used. Try a JPG or PNG.");
    }
  };

  const handleRemovePhoto = () => {
    setDraft(prev => ({ ...prev, photo: '' }));
  };

  const handleQuickEnd = (months) => {
    const st = parseYMD(draft.start) || today0();
    const end = ymd(new Date(addMonths(st, months).getTime() - 864e5));
    setDraft(prev => ({
      ...prev,
      start: prev.start || ymd(st),
      end
    }));
  };

  const toggleFollowUpDone = (fid) => {
    setDraft(prev => ({
      ...prev,
      followUps: prev.followUps.map(f => f.id === fid ? { ...f, done: !f.done } : f)
    }));
  };

  const deleteFollowUp = (fid) => {
    setDraft(prev => ({
      ...prev,
      followUps: prev.followUps.filter(f => f.id !== fid)
    }));
  };

  const handleSubmitMember = async (e) => {
    e.preventDefault();
    if (activeTab !== 'details') return;
    setError('');

    if (!draft.name.trim()) {
      setError("Enter the member's name.");
      return;
    }

    const digits = (draft.mobile || '').replace(/\D/g, '');
    if (draft.mobile && (digits.length < 7 || digits.length > 15)) {
      setError('Enter a valid mobile number, for example 98100 12345.');
      return;
    }

    const rawEmail = (draft.email || '').trim();
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      setError('Enter a valid email ID, like name@company.com.');
      return;
    }

    const rawLinkedIn = (draft.linkedin || '').trim();
    if (rawLinkedIn && !normLinkedIn(rawLinkedIn)) {
      setError('Enter a LinkedIn profile link, like linkedin.com/in/rohan-mehta.');
      return;
    }

    if (draft.start && draft.end && draft.end < draft.start) {
      setError('The end date is before the start date.');
      return;
    }

    // Include pending follow-up if typed
    let nextFollowUps = [...draft.followUps];
    if (fuDate || fuNote.trim()) {
      if (!fuDate) {
        setError('Pick a date for the new follow-up, or clear its note.');
        return;
      }
      nextFollowUps.push({
        id: Math.random().toString(36).slice(2, 10),
        date: fuDate,
        note: fuNote.trim(),
        done: false,
        by: session?.username || '',
        byName: session?.name || ''
      });
    }

    const payload = {
      ...draft,
      email: rawEmail,
      linkedin: rawLinkedIn ? (normLinkedIn(rawLinkedIn) || rawLinkedIn) : '',
      followUps: nextFollowUps
    };

    const saved = await saveCrmMember(payload);
    if (saved) {
      closeCrmModal();
      showToast(isEdit ? 'Changes saved.' : `${saved.name} added to ${saved.plan}. Open the card to add session notes.`);
    }
  };

  const handleDeleteMember = async () => {
    if (!crmModal.id) return;
    const name = draft.name || 'Member';
    const ok = await deleteCrmMember(crmModal.id);
    if (ok) {
      closeCrmModal();
      showToast(`${name} deleted.`);
    }
  };

  const handleAddSession = async () => {
    if (!sessText.trim()) {
      setError('Write the session notes first.');
      return;
    }
    if (!sessDate) {
      setError('Pick the session date.');
      return;
    }

    if (isListening && recognizerRef.current) {
      try { recognizerRef.current.stop(); } catch {}
      setIsListening(false);
    }

    setSessBusy(true);
    setError('');
    const ok = await saveCrmSession(crmModal.id, {
      date: sessDate,
      type: sessType,
      text: sessText.trim()
    });
    setSessBusy(false);

    if (ok) {
      setSessText('');
      showToast('Session note saved.');
    }
  };

  const handleStartEditSession = (s) => {
    setEditingSessionId(s.id);
    setEditDate(s.date);
    setEditType(s.type);
    setEditText(s.text);
    setConfirmDelSessionId(null);
  };

  const handleUpdateSession = async (sid) => {
    if (!editText.trim()) {
      setError("A note can't be empty. Delete it instead.");
      return;
    }
    setError('');
    const ok = await saveCrmSession(crmModal.id, {
      id: sid,
      date: editDate,
      type: editType,
      text: editText.trim()
    });
    if (ok) {
      setEditingSessionId(null);
      showToast('Note updated.');
    }
  };

  const handleDeleteSession = async (sid) => {
    const ok = await deleteCrmSession(crmModal.id, sid);
    if (ok) {
      setConfirmDelSessionId(null);
      showToast('Note deleted.');
    }
  };

  const sortedFollowUps = [...draft.followUps].sort((a, b) => (a.done - b.done) || a.date.localeCompare(b.date));
  const tl = timeLeft(draft.end);
  const sessions = crmModal.sessions || [];

  return (
    <div
      className="modal-back"
      id="crmBack"
      onClick={(e) => {
        if (e.target.id === 'crmBack') closeCrmModal();
      }}
    >
      <form
        className="modal"
        id="crmForm"
        autoComplete="off"
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="crmTitle"
        onSubmit={handleSubmitMember}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeCrmModal();
        }}
      >
        <div className="modal-head">
          {isEdit && (
            <span className="mav sm">
              {draft.photo ? <img src={draft.photo} alt={draft.name} /> : initials(draft.name)}
            </span>
          )}
          <h2 id="crmTitle">{isEdit ? (draft.name || 'Edit member') : 'Add Member'}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close"
            onClick={closeCrmModal}
          >
            <XIcon />
          </button>
        </div>

        {isEdit && (
          <div className="mtabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={activeTab === 'details' ? 'on' : ''}
              aria-selected={activeTab === 'details'}
              onClick={() => { setActiveTab('details'); setError(''); }}
            >
              Details
            </button>
            <button
              type="button"
              role="tab"
              className={activeTab === 'sessions' ? 'on' : ''}
              aria-selected={activeTab === 'sessions'}
              onClick={() => { setActiveTab('sessions'); setError(''); }}
            >
              Session notes <span className="n">{sessions.length}</span>
            </button>
          </div>
        )}

        <div className="modal-body">
          {activeTab === 'details' ? (
            <>
              <div className="m-photo">
                <label
                  className="photo-pick"
                  htmlFor="mPhotoIn"
                  title={draft.photo ? 'Change photo' : 'Add photo'}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="mav lg">
                    {draft.photo ? <img src={draft.photo} alt={draft.name} /> : initials(draft.name)}
                  </span>
                  <span className="cam"><CameraIcon size={16} /></span>
                </label>
                <div className="m-photo-text">
                  <span className="m-photo-title">Member photo</span>
                  <span className="photo-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label
                      className="text-btn"
                      htmlFor="mPhotoIn"
                      style={{ cursor: 'pointer' }}
                    >
                      {draft.photo ? 'Change photo' : 'Add photo'}
                    </label>
                    {draft.photo && (
                      <button
                        type="button"
                        className="text-btn muted"
                        onClick={handleRemovePhoto}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </div>
                <input
                  type="file"
                  id="mPhotoIn"
                  ref={fileInputRef}
                  accept="image/*"
                  hidden
                  onChange={handlePhotoUpload}
                />
              </div>

              <div className="mgrid">
                <div className="field">
                  <label htmlFor="mName">Member name</label>
                  <input
                    className="input"
                    id="mName"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    maxLength={80}
                    placeholder="e.g. Rohan Mehta"
                    required
                    autoFocus={!isEdit}
                  />
                </div>
                <div className="field">
                  <label htmlFor="mMobile">Mobile number</label>
                  <input
                    className="input"
                    id="mMobile"
                    value={draft.mobile}
                    onChange={(e) => setDraft({ ...draft, mobile: e.target.value })}
                    maxLength={20}
                    inputMode="tel"
                    placeholder="e.g. 98100 12345"
                    required
                  />
                </div>
                <div className="field full">
                  <label htmlFor="mEmail">Email ID</label>
                  <input
                    className="input"
                    id="mEmail"
                    type="email"
                    value={draft.email ?? ''}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    maxLength={120}
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="name@company.com"
                  />
                </div>
                <div className="field full">
                  <label htmlFor="mLinked">
                    LinkedIn profile{' '}
                    {draft.linkedin ? (
                      <a
                        className="field-link"
                        href={normLinkedIn(draft.linkedin) || draft.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open profile ↗
                      </a>
                    ) : null}
                  </label>
                  <input
                    className="input"
                    id="mLinked"
                    value={draft.linkedin || ''}
                    onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })}
                    maxLength={300}
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="linkedin.com/in/member-name"
                  />
                </div>
                <div className="field full">
                  <label htmlFor="mPlan">Plan type</label>
                  <select
                    className="input"
                    id="mPlan"
                    value={draft.plan}
                    onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
                  >
                    {PLANS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="field full">
                  <label htmlFor="mLabel">Label</label>
                  <select
                    className="input"
                    id="mLabel"
                    value={draft.label || ''}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  >
                    <option value="">No label</option>
                    {Object.entries(LABELS).map(([k, L]) => (
                      <option key={k} value={k}>
                        {L.name} — {L.stage} · {L.avatar}
                      </option>
                    ))}
                  </select>
                  {draft.label && LABELS[draft.label] && (
                    <div className={`lbl-preview lbl-${draft.label}`}>
                      <span className="m-band-ic">
                        <ArchetypeIcon label={draft.label} size={26} />
                      </span>
                      <div className="lbl-pv-t">
                        <b>{LABELS[draft.label].avatar}</b>
                        <small>{LABELS[draft.label].name} · {LABELS[draft.label].stage}</small>
                      </div>
                      <div className="m-kw">
                        {LABELS[draft.label].keywords.map(w => (
                          <span key={w}>{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="mStart">Start date</label>
                  <input
                    className="input"
                    id="mStart"
                    type="date"
                    value={draft.start}
                    onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="mEnd">End date</label>
                  <input
                    className="input"
                    id="mEnd"
                    type="date"
                    value={draft.end}
                    onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  />
                </div>
                <div className="quick-end full">
                  <span>Set end date:</span>
                  {[3, 6, 12].map(n => (
                    <button
                      key={n}
                      type="button"
                      className="mini-pill"
                      onClick={() => handleQuickEnd(n)}
                    >
                      +{n} months
                    </button>
                  ))}
                  {tl && <span className={`chip ${tl.status}`}>{tl.label}</span>}
                </div>
                <div className="field full">
                  <label htmlFor="mComment">Comment</label>
                  <textarea
                    className="input"
                    id="mComment"
                    rows={3}
                    maxLength={2000}
                    placeholder="Context, goals, anything the team should know"
                    value={draft.comment}
                    onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
                  />
                </div>
              </div>

              <div className="fu-block">
                <div className="fu-title">
                  <CalendarIcon size={20} />
                  <span>Follow-ups</span>
                </div>
                {Boolean(sortedFollowUps.length) && (
                  <div className="fu-list">
                    {sortedFollowUps.map(f => (
                      <div key={f.id} className={`fu ${f.done ? 'done' : ''}`}>
                        <button
                          type="button"
                          className="check"
                          onClick={() => toggleFollowUpDone(f.id)}
                          aria-label={f.done ? 'Mark not done' : 'Mark done'}
                        >
                          <span className="box">{f.done ? <CheckIcon size={14} /> : null}</span>
                        </button>
                        <div className="fu-text">
                          <b>{f.date ? fmtDate(f.date) : 'No date'}</b>
                          {f.note ? ` · ${f.note}` : ''}
                        </div>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => deleteFollowUp(f.id)}
                          aria-label="Delete follow-up"
                        >
                          <XIcon size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="fu-new">
                  <div className="field">
                    <label htmlFor="fuDate">New follow-up</label>
                    <input
                      className="input"
                      id="fuDate"
                      type="date"
                      value={fuDate}
                      onChange={(e) => setFuDate(e.target.value)}
                    />
                  </div>
                  <div className="field grow">
                    <label htmlFor="fuNote">Note</label>
                    <input
                      className="input"
                      id="fuNote"
                      maxLength={500}
                      placeholder="e.g. Renewal call, share QBR deck"
                      value={fuNote}
                      onChange={(e) => setFuNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Session notes pane */}
              <div className="sess-new">
                <div className="sess-row">
                  <div className="field">
                    <label htmlFor="sDate">
                      Session date <span className="dow">{dayName(sessDate)}</span>
                    </label>
                    <input
                      className="input"
                      type="date"
                      id="sDate"
                      value={sessDate}
                      onChange={(e) => setSessDate(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sType">Type</label>
                    <select
                      className="input"
                      id="sType"
                      value={sessType}
                      onChange={(e) => setSessType(e.target.value)}
                    >
                      {SESSION_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="sText">Notes / MoM</label>
                  <div className="sess-text-wrap">
                    <textarea
                      className="input"
                      id="sText"
                      rows={6}
                      maxLength={10000}
                      placeholder="What was discussed, decisions, action items, next steps…"
                      value={sessText}
                      onChange={(e) => setSessText(e.target.value)}
                    />
                    <button
                      type="button"
                      className={`mic sess-mic ${isListening ? 'live' : ''}`}
                      onClick={toggleDictation}
                      aria-label="Dictate notes"
                      title={isListening ? 'Stop dictation' : 'Start speech-to-text dictation'}
                    >
                      <MicIcon size={20} />
                    </button>
                  </div>
                </div>
                <div className="sess-actions">
                  <span className="hint">
                    {isListening ? 'Listening… speak into your mic, tap again to stop.' : ''}
                  </span>
                  <button
                    type="button"
                    className="pill ink"
                    disabled={sessBusy}
                    onClick={handleAddSession}
                  >
                    <PlusIcon size={18} />
                    <span>{sessBusy ? 'Saving…' : 'Save note'}</span>
                  </button>
                </div>
              </div>

              <div className="sess-history">
                <div className="fu-title">
                  <NotesIcon size={20} />
                  <span>History</span>
                  <span className="count">{sessions.length}</span>
                </div>
                {!crmModal.sessLoaded ? (
                  <p className="card-note">Loading notes…</p>
                ) : !sessions.length ? (
                  <p className="card-note">No session notes yet. Notes you save appear here, newest first.</p>
                ) : (
                  sessions.map(s => {
                    const isEditingThis = editingSessionId === s.id;
                    const canManage = s.by === (session?.username || '') || session?.role === 'admin';

                    if (isEditingThis) {
                      return (
                        <article key={s.id} className="sess editing">
                          <div className="sess-form" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div className="sess-row">
                              <div className="edate">
                                <input
                                  className="input"
                                  type="date"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  aria-label="Session date"
                                />
                                <span className="dow">{dayName(editDate)}</span>
                              </div>
                              <select
                                className="input"
                                value={editType}
                                onChange={(e) => setEditType(e.target.value)}
                                aria-label="Type"
                              >
                                {SESSION_TYPES.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                            <textarea
                              className="input"
                              rows={6}
                              maxLength={10000}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              aria-label="Session notes"
                            />
                            <div className="sess-actions">
                              <button
                                type="button"
                                className="pill plain"
                                onClick={() => setEditingSessionId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="pill ink"
                                onClick={() => handleUpdateSession(s.id)}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    }

                    const who = s.by === (session?.username || '') ? (session?.name || 'You') : (s.byName || s.by || 'Team member');

                    return (
                      <article key={s.id} className="sess">
                        <header className="sess-head">
                          <b>{fmtDow(s.date) || 'No date'}</b>
                          <span className={`sess-type t-${(s.type || 'session').toLowerCase()}`}>
                            {s.type}
                          </span>
                          <span className="sess-by">
                            by {who}{s.updatedAt && s.updatedAt - s.createdAt > 60000 ? ' · edited' : ''}
                          </span>
                          {canManage && (
                            <span className="sess-tools">
                              {confirmDelSessionId === s.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="pill danger sm"
                                    onClick={() => handleDeleteSession(s.id)}
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    className="pill plain sm"
                                    onClick={() => setConfirmDelSessionId(null)}
                                  >
                                    Keep
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label="Edit note"
                                    onClick={() => handleStartEditSession(s)}
                                  >
                                    <PencilIcon size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label="Delete note"
                                    onClick={() => setConfirmDelSessionId(s.id)}
                                  >
                                    <TrashIcon size={16} />
                                  </button>
                                </>
                              )}
                            </span>
                          )}
                        </header>
                        <div className="sess-text">{s.text}</div>
                      </article>
                    );
                  })
                )}
              </div>
            </>
          )}

          {error && <div className="err" style={{ padding: '0 4px' }}>{error}</div>}
        </div>

        {activeTab === 'details' ? (
          <div className="modal-foot">
            {isEdit && (
              confirmDel ? (
                <>
                  <button
                    type="button"
                    className="pill danger"
                    onClick={handleDeleteMember}
                  >
                    Delete member
                  </button>
                  <button
                    type="button"
                    className="pill plain"
                    onClick={() => setConfirmDel(false)}
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-btn danger"
                  onClick={() => setConfirmDel(true)}
                >
                  Delete
                </button>
              )
            )}
            <span className="grow" />
            <button
              type="button"
              className="pill plain"
              onClick={closeCrmModal}
            >
              Cancel
            </button>
            <button type="submit" className="pill ink">
              {isEdit ? 'Save changes' : 'Add member'}
            </button>
          </div>
        ) : (
          <div className="modal-foot">
            <span className="grow" />
            <button
              type="button"
              className="pill plain"
              onClick={closeCrmModal}
            >
              Close
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

