import { useApp } from '../context/AppContext';
import { ListsIcon, NotesIcon, JournalIcon, CrmIcon, FolderIcon, PlusIcon, TrashIcon, ShareIcon } from './Icons';
import { uid } from '../utils/constants';

export const FoldSideRail = () => {
  const {
    board,
    updateBoard,
    ui,
    setUi,
    navigate,
    isCrmAllowed,
    foldMode,
    crmMembers,
    showToast
  } = useApp();

  const isListActive = board.tab === 'lists' && !ui.admin;
  const isNotesActive = board.tab === 'notes' && !ui.admin;
  const isJournalActive = board.tab === 'journal' && !ui.admin;
  const isCrmActive = board.tab === 'crm' && !ui.admin;

  const handleListsClick = () => {
    if (!isListActive) {
      updateBoard({ tab: 'lists' });
      setUi(prev => ({ ...prev, admin: false, viewing: true, drawer: false }));
      navigate('/lists');
    } else {
      // Toggle sidebar drawer sheet so user can choose another list
      setUi(prev => ({ ...prev, drawer: !prev.drawer }));
    }
  };

  const handleNotesClick = () => {
    if (!isNotesActive) {
      updateBoard({ tab: 'notes' });
      setUi(prev => ({ ...prev, admin: false, viewing: true, drawer: false }));
      navigate('/notes');
    } else {
      // Toggle sidebar drawer sheet so user can choose another note
      setUi(prev => ({ ...prev, drawer: !prev.drawer }));
    }
  };

  const handleJournalClick = () => {
    updateBoard({ tab: 'journal' });
    setUi(prev => ({ ...prev, admin: false, viewing: true, drawer: false }));
    navigate('/journal');
  };

  const handleCrmClick = () => {
    updateBoard({ tab: 'crm' });
    setUi(prev => ({ ...prev, admin: false, viewing: true, drawer: false }));
    navigate('/crm');
  };

  const handleDeleteClick = () => {
    setUi(prev => ({ ...prev, confirm: !prev.confirm, sharing: false }));
  };

  const handleFolderClick = () => {
    setUi(prev => ({ ...prev, drawer: !prev.drawer }));
  };

  const handleShareClick = () => {
    setUi(prev => ({ ...prev, sharing: !prev.sharing, confirm: false }));
  };

  const handleAddClick = () => {
    if (board.tab === 'notes') {
      const newNote = { id: uid(), title: '', starred: false };
      updateBoard({
        notes: [newNote, ...(board.notes || [])],
        activeNoteId: newNote.id,
        tab: 'notes'
      });
      setUi(prev => ({ ...prev, adding: false, viewing: true, admin: false, drawer: false }));
      navigate('/notes');
      showToast('New note created');
    } else if (board.tab === 'lists') {
      const composerInput = document.querySelector('.composer .input');
      if (composerInput) {
        composerInput.focus();
      } else {
        setUi(prev => ({ ...prev, drawer: true }));
      }
    } else if (board.tab === 'crm') {
      setUi(prev => ({ ...prev, crmModal: { open: true, member: null } }));
    }
  };

  return (
    <aside className="fold-side-rail" aria-label="Quick navigation rail">
      <button
        type="button"
        className={`fold-rail-btn ${isListActive ? 'active' : ''}`}
        onClick={handleListsClick}
        title="Lists"
        aria-label="Lists"
      >
        <ListsIcon size={20} />
      </button>

      <button
        type="button"
        className={`fold-rail-btn ${isNotesActive ? 'active' : ''}`}
        onClick={handleNotesClick}
        title="Notes"
        aria-label="Notes"
      >
        <NotesIcon size={20} />
      </button>

      <button
        type="button"
        className={`fold-rail-btn ${isJournalActive ? 'active' : ''}`}
        onClick={handleJournalClick}
        title="Journal"
        aria-label="Journal"
      >
        <JournalIcon size={20} />
      </button>

      {isCrmAllowed && (
        <button
          type="button"
          className={`fold-rail-btn ${isCrmActive ? 'active' : ''}`}
          onClick={handleCrmClick}
          title="CRM"
          aria-label="CRM"
        >
          <CrmIcon size={20} />
          {crmMembers?.length > 0 && (
            <span className="fold-rail-badge">{crmMembers.length}</span>
          )}
        </button>
      )}

      <div className="fold-rail-sep" aria-hidden="true" />

      <button
        type="button"
        className={`fold-rail-btn fold-rail-del ${ui.confirm ? 'active' : ''}`}
        onClick={handleDeleteClick}
        title="Delete current item"
        aria-label="Delete"
      >
        <TrashIcon size={19} />
      </button>

      <button
        type="button"
        className={`fold-rail-btn ${ui.drawer ? 'active' : ''}`}
        onClick={handleFolderClick}
        title="Folder / All lists & notes"
        aria-label="Folder / Browse all"
      >
        <FolderIcon size={19} />
      </button>

      <button
        type="button"
        className={`fold-rail-btn ${ui.sharing ? 'active' : ''}`}
        onClick={handleShareClick}
        title="Share"
        aria-label="Share"
      >
        <ShareIcon size={19} />
      </button>

      <button
        type="button"
        className="fold-rail-btn fold-rail-add"
        onClick={handleAddClick}
        title="Quick add"
        aria-label="New item"
      >
        <PlusIcon size={20} />
      </button>
    </aside>
  );
};
