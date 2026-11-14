import { useEffect } from 'react';
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
import { PrivacyModal } from './components/PrivacyModal';
import './App.css';

const Shell = () => {
  const { session, board, ui, toast, triggerUndo, route, navigate, foldMode } = useApp();

  // 1. Root route: redirect to wowos.in immediately
  useEffect(() => {
    if (route.name === 'root') {
      window.location.replace('https://wowos.in');
    }
  }, [route.name]);

  if (route.name === 'root') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#888',
        fontFamily: 'Figtree, sans-serif'
      }}>
        Redirecting to wowos.in…
      </div>
    );
  }

  // 2. Public shared note view (/p/:sid or #p.:sid)
  if (route.name === 'public' && route.sid) {
    return (
      <PublicNoteView
        sid={route.sid}
        onExit={() => {
          if (session) {
            navigate('/' + (board.tab || 'notes'));
          } else {
            navigate('/login');
          }
        }}
      />
    );
  }

  // 3. Unauthenticated state handling
  if (!session) {
    if (route.name !== 'login' && route.name !== 'share') {
      const redirectTarget = window.location.pathname + window.location.search;
      navigate(`/login?redirect=${encodeURIComponent(redirectTarget)}`, { replace: true });
    }
    return (
      <>
        <Login />
        <PrivacyModal />
      </>
    );
  }

  // 4. If logged in and on /login, redirect to redirect target or active workspace tab
  if (route.name === 'login') {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect && redirect.startsWith('/') && redirect !== '/login' && redirect !== '/') {
      navigate(redirect, { replace: true });
    } else {
      navigate('/' + (board.tab || 'notes'), { replace: true });
    }
    return null;
  }

  // 5. If on /admin but not admin, bounce to active tab
  if (route.name === 'admin' && session.role !== 'admin') {
    navigate('/' + (board.tab || 'notes'), { replace: true });
    return null;
  }

  // 6. Handle unknown routes for logged in users
  if (route.name === 'unknown') {
    navigate('/' + (board.tab || 'notes'), { replace: true });
    return null;
  }

  // 7. Main authenticated workspace view
  const isDualVertical = foldMode === 'dual-vertical';
  return (
    <div
      className={`app ${ui.viewing ? 'viewing' : ''} ${ui.collapsed && !isDualVertical ? 'collapsed' : ''} ${ui.drawer ? 'drawer-open' : ''}`}
      data-tab={board.tab}
      data-fold={foldMode}
    >
      {ui.drawer && (
        <div
          className="fold-drawer-backdrop"
          onClick={() => setUi(prev => ({ ...prev, drawer: false }))}
          aria-hidden="true"
        />
      )}
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
      <PrivacyModal />
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
