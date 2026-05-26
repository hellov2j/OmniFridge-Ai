import { useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import './Sidebar.css';

const navItems = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'scan', icon: '📷', label: 'Scan & Add' },
  { id: 'inventory', icon: '🧊', label: 'Inventory' },
  { id: 'shopping', icon: '🛒', label: 'Shopping List' },
  { id: 'recipes', icon: '🍳', label: 'Recipes' },
];

export default function Sidebar({ activeView, onViewChange, theme, onThemeToggle }) {
  const { items, getExpiringItems, getExpiredItems, unpurchasedCount } = useInventory();
  const expiringCount = useMemo(
    () => getExpiringItems(2).length + getExpiredItems().length,
    [items]
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🧊</div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">SmartFridge</span>
          <span className="sidebar-logo-subtitle">AI Powered</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
            aria-current={activeView === item.id ? 'page' : undefined}
            onClick={() => onViewChange(item.id)}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
            {item.id === 'inventory' && expiringCount > 0 && (
              <span className="sidebar-nav-badge">{expiringCount}</span>
            )}
            {item.id === 'shopping' && unpurchasedCount > 0 && (
              <span className="sidebar-nav-badge sidebar-nav-badge--shopping">{unpurchasedCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-nav-item theme-toggle-btn"
          onClick={onThemeToggle}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className="sidebar-nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="sidebar-nav-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button
          className={`sidebar-nav-item ${activeView === 'settings' ? 'active' : ''}`}
          aria-current={activeView === 'settings' ? 'page' : undefined}
          onClick={() => onViewChange('settings')}
        >
          <span className="sidebar-nav-icon">⚙️</span>
          <span className="sidebar-nav-label">Settings</span>
        </button>
      </div>
    </aside>
  );
}
