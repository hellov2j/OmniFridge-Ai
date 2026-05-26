import { useState, useCallback, useRef, useEffect } from 'react';
import { useExpiryChecker } from './hooks/useExpiryChecker';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import ScanView from './components/ScanView';
import InventoryView from './components/InventoryView';
import ShoppingListView from './components/ShoppingListView';
import RecipesView from './components/RecipesView';
import SettingsView from './components/SettingsView';
import VoiceAssistant from './components/VoiceAssistant';

export default function AppContent() {
  const [activeView, setActiveView] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  const toastTimersRef = useRef(new Map());
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('smartfridge_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('smartfridge_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      // Cap at 5 visible toasts
      return next.length > 5 ? next.slice(-5) : next;
    });
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastTimersRef.current.delete(id);
    }, 5000);
    toastTimersRef.current.set(id, timer);
  }, []);

  // Cleanup toast timers on unmount
  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Expiry checker with in-app toast notifications
  useExpiryChecker({
    onExpiringItems: (items) => {
      items.forEach(item => {
        addToast(
          `${item.name} ${item.daysLeft === 0 ? 'expires today!' : `expires in ${item.daysLeft} day(s)`}`,
          item.daysLeft === 0 ? 'error' : 'warning'
        );
      });
    },
  });

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView onNavigate={setActiveView} />;
      case 'scan':
        return <ScanView />;
      case 'inventory':
        return <InventoryView />;
      case 'shopping':
        return <ShoppingListView />;
      case 'recipes':
        return <RecipesView />;
      case 'settings':
        return <SettingsView theme={theme} onThemeToggle={toggleTheme} />;
      default:
        return <DashboardView onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} onViewChange={setActiveView} theme={theme} onThemeToggle={toggleTheme} />
      <main className="main-content">
        {renderView()}
      </main>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <span>{toast.type === 'error' ? '🚫' : toast.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
              <span>{toast.message}</span>
              <button
                className="toast-close"
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Voice Assistant FAB */}
      <VoiceAssistant />
    </div>
  );
}
