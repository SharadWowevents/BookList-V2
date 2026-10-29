import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { ListView } from './components/ListView';
import { NoteView } from './components/NoteView';
import { CrmView } from './components/CrmView';
import { CrmModal } from './components/CrmModal';
import { JournalView } from './components/JournalView';
import { AdminPanel } from './components/AdminPanel';
import { Login } from './components/Login';
import { PublicNoteView } from './components/PublicNoteView';
import './App.css';

const Shell = () => {
  const { session, board, ui, toast, triggerUndo } = useApp();

  // Detect public view links in URL: #p.<sid> or /p/<sid>
  const extractPublicSid = () => {
    const hash = window.location.hash;
    const mHash = /^#p\.(?:([A-Za-z0-9_-]+)\.)?([a-z0-9]+)$/i.exec(hash);
    if (mHash) return mHash[2];
    const mPath = /^\/p\/([a-z0-9]+)$/i.exec(window.location.pathname);
    return mPath ? mPath[1] : null;
  };

  const [publicSid, setPublicSid] = useState(extractPublicSid);

  useEffect(() => {
    const checkHash = () => {
      setPublicSid(extractPublicSid());
    };
    window.addEventListener('hashchange', checkHash);
    window.addEventListener('popstate', checkHash);
    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('popstate', checkHash);
    };
  }, []);

  if (publicSid) {
    return (
      <PublicNoteView
        sid={publicSid}
        onExit={() => {
          if (window.location.pathname.startsWith('/p/')) {
            window.history.pushState(null, '', '/');
          }
          window.location.hash = '';
          setPublicSid(null);
        }}
      />
    );
  }

  if (!session) return <Login />;

  return (
    <div className={`app ${ui.viewing ? 'viewing' : ''} ${ui.collapsed ? 'collapsed' : ''}`}>
      <Sidebar />
      <main className="main">
        {ui.admin && session?.role === 'admin' ? (
          <AdminPanel />
        ) : board.tab === 'crm' ? (
          <CrmView />
        ) : board.tab === 'journal' ? (
          <JournalView />
        ) : board.tab === 'lists' ? (
          <ListView key={board.activeId} />
        ) : (
          <NoteView key={board.activeNoteId} />
        )}
      </main>
      <CrmModal />
      {toast.visible && (
        <div id="toast" className="toast">
          {toast.message}
          {toast.undoFn && (
            <button
              className="link"
              onClick={triggerUndo}
              style={{ color: 'inherit', marginLeft: '8px', cursor: 'pointer' }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}


