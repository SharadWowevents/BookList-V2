import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { ListView } from './components/ListView';
import { NoteView } from './components/NoteView';
import { AdminPanel } from './components/AdminPanel';
import { Login } from './components/Login';
import './App.css';

const Shell = () => {
  const { session, board, ui, toast, triggerUndo } = useApp();

  if (!session) return <Login />;

  return (
    <div className={`app ${ui.viewing ? 'viewing' : ''} ${ui.collapsed ? 'collapsed' : ''}`}>
      <Sidebar />
      <main className="main">
        {ui.admin ? (
          <AdminPanel />
        ) : board.tab === 'lists' ? (
          <ListView key={board.activeId} />
        ) : (
          <NoteView key={board.activeNoteId} />
        )}
      </main>
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


