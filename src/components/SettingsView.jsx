import { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import './SettingsView.css';

export default function SettingsView({ theme, onThemeToggle }) {
  const { clearAll, items } = useInventory();
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast & capable (recommended)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: 'Fastest, lowest quota usage' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Most capable, higher quota usage' },
  ];

  // Deprecated model IDs that need migration
  const isDeprecatedModel = (m) => m.startsWith('gemini-1.') || m.startsWith('gemini-2.0') || m === 'gemini-3.1-flash';

  useEffect(() => {
    const stored = localStorage.getItem('smartfridge_gemini_key') || '';
    const storedModel = localStorage.getItem('smartfridge_gemini_model') || 'gemini-2.5-flash';
    // Auto-upgrade deprecated model names
    if (isDeprecatedModel(storedModel)) {
      localStorage.setItem('smartfridge_gemini_model', 'gemini-2.5-flash');
      setSelectedModel('gemini-2.5-flash');
    } else {
      setSelectedModel(storedModel);
    }
    setApiKey(stored);
    setDemoMode(localStorage.getItem('smartfridge_demo_mode') !== 'false');
    setNotificationsEnabled('Notification' in window && Notification.permission === 'granted');
  }, []);

  const handleSave = () => {
    localStorage.setItem('smartfridge_gemini_key', apiKey.trim());
    localStorage.setItem('smartfridge_gemini_model', selectedModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleToggleDemo = () => {
    const newVal = !demoMode;
    setDemoMode(newVal);
    localStorage.setItem('smartfridge_demo_mode', String(newVal));
  };

  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      // Browser doesn't allow programmatic notification revocation
      setNotificationsEnabled(true);
      return;
    }
    const perm = await Notification.requestPermission();
    setNotificationsEnabled(perm === 'granted');
  };

  const hasKey = apiKey.trim().length > 0;

  return (
    <div className="settings-view">
      <h1>Settings</h1>
      <p>Configure your SmartFridge application</p>

      {/* Appearance */}
      <div className="settings-section glass-panel">
        <h3>🎨 Appearance</h3>
        <div className="notification-toggle">
          <div className="notification-toggle-info">
            <span className="notification-toggle-label">Light Mode</span>
            <span className="notification-toggle-hint">
              Toggle between the FrostByte (dark) and CrystalFrost (light) themes
            </span>
          </div>
          <button
            className={`toggle-switch ${theme === 'light' ? 'active' : ''}`}
            onClick={onThemeToggle}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          />
        </div>
      </div>

      {/* Demo Mode */}
      <div className="settings-section glass-panel" style={{ borderColor: demoMode ? 'var(--accent-primary)' : undefined }}>
        <h3>🧪 Demo Mode</h3>
        <div className="notification-toggle">
          <div className="notification-toggle-info">
            <span className="notification-toggle-label">Enable Demo Mode</span>
            <span className="notification-toggle-hint">
              Uses simulated AI responses — no API key or quota needed. Perfect for demonstrations.
            </span>
          </div>
          <button
            className={`toggle-switch ${demoMode ? 'active' : ''}`}
            onClick={handleToggleDemo}
          />
        </div>
        {demoMode && (
          <div className="settings-status connected" style={{ marginTop: 'var(--space-md)' }}>
            ✅ Demo Mode active — AI features use mock data
          </div>
        )}
      </div>

      {/* API Key */}
      <div className="settings-section glass-panel">
        <h3>🔑 Gemini API Key</h3>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <div className="api-key-input-wrapper">
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              placeholder="Enter your Gemini API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="btn btn-ghost" onClick={() => setShowKey(!showKey)}>
              {showKey ? '🙈' : '👁️'}
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
          <div className="settings-hint">
            Get your free API key from{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
              Google AI Studio
            </a>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
          <label className="form-label">AI Model</label>
          <select
            className="input"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.desc}</option>
            ))}
          </select>
          <div className="settings-hint">
            Switch models if you hit rate limits. Each model has a separate quota.
          </div>
        </div>
        <div className={`settings-status ${hasKey ? 'connected' : 'disconnected'}`}>
          {hasKey ? '✅ API key configured' : '⚠️ No API key set — AI features won\'t work'}
        </div>
        {saved && (
          <div className="settings-status connected" style={{ marginTop: '8px' }}>
            ✅ API key saved successfully!
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="settings-section glass-panel">
        <h3>🔔 Notifications</h3>
        <div className="notification-toggle">
          <div className="notification-toggle-info">
            <span className="notification-toggle-label">Browser Notifications</span>
            <span className="notification-toggle-hint">
              Get alerts when food items are about to expire
            </span>
          </div>
          <button
            className={`toggle-switch ${notificationsEnabled ? 'active' : ''}`}
            onClick={handleToggleNotifications}
          />
        </div>
      </div>

      {/* About */}
      <div className="settings-section glass-panel">
        <h3>ℹ️ About</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p><strong>SmartFridge AI</strong> — v1.0.0</p>
          <p>Powered by Google Gemini API</p>
          <p>Built with React + Vite + IndexedDB</p>
          <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
            📦 {items.length} items in database
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-section glass-panel settings-danger-zone">
        <h3>⚠️ Danger Zone</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
          Clear all food items from your fridge database. This action cannot be undone.
        </p>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm('Are you sure you want to delete all items? This cannot be undone.')) {
              clearAll();
            }
          }}
        >
          🗑️ Clear All Data
        </button>
      </div>
    </div>
  );
}
