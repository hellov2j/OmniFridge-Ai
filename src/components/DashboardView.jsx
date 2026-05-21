import { useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { getDaysUntilExpiry, getExpiryBadgeClass, getExpiryLabel } from '../utils/expiry';
import './DashboardView.css';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardView({ onNavigate }) {
  const { items, getExpiringItems, getExpiredItems, getCategories } = useInventory();

  const expiringItems = useMemo(() => getExpiringItems(3), [items]);
  const expiredItems = useMemo(() => getExpiredItems(), [items]);
  const categories = useMemo(() => getCategories(), [items]);
  const recentItems = useMemo(() => [...items]
    .sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate))
    .slice(0, 5), [items]);

  const allAlertItems = useMemo(() => [...expiredItems, ...expiringItems]
    .sort((a, b) => {
      const da = getDaysUntilExpiry(a.expiryDate);
      const db2 = getDaysUntilExpiry(b.expiryDate);
      return (da ?? 999) - (db2 ?? 999);
    })
    .slice(0, 6), [expiredItems, expiringItems]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Your smart fridge at a glance</p>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="quick-action-card glass-panel" role="button" tabIndex={0} onClick={() => onNavigate('scan')} onKeyDown={(e) => e.key === 'Enter' && onNavigate('scan')}>
          <span className="quick-action-icon">📷</span>
          <div className="quick-action-text">
            <h4>Scan Food</h4>
            <p>Use camera or upload image</p>
          </div>
        </div>
        <div className="quick-action-card glass-panel" role="button" tabIndex={0} onClick={() => onNavigate('recipes')} onKeyDown={(e) => e.key === 'Enter' && onNavigate('recipes')}>
          <span className="quick-action-icon">🍳</span>
          <div className="quick-action-text">
            <h4>Get Recipes</h4>
            <p>AI-powered suggestions</p>
          </div>
        </div>
        <div className="quick-action-card glass-panel" role="button" tabIndex={0} onClick={() => onNavigate('inventory')} onKeyDown={(e) => e.key === 'Enter' && onNavigate('inventory')}>
          <span className="quick-action-icon">📋</span>
          <div className="quick-action-text">
            <h4>View Inventory</h4>
            <p>{items.length} items tracked</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card glass-panel stat-card--total">
          <div className="stat-card-accent" />
          <div className="stat-card-icon">📦</div>
          <div className="stat-card-value">{items.length}</div>
          <div className="stat-card-label">Total Items</div>
        </div>
        <div className="stat-card glass-panel stat-card--expiring">
          <div className="stat-card-accent" />
          <div className="stat-card-icon">⚠️</div>
          <div className="stat-card-value">{expiringItems.length}</div>
          <div className="stat-card-label">Expiring Soon</div>
        </div>
        <div className="stat-card glass-panel stat-card--expired">
          <div className="stat-card-accent" />
          <div className="stat-card-icon">🚫</div>
          <div className="stat-card-value">{expiredItems.length}</div>
          <div className="stat-card-label">Expired</div>
        </div>
        <div className="stat-card glass-panel stat-card--categories">
          <div className="stat-card-accent" />
          <div className="stat-card-icon">🏷️</div>
          <div className="stat-card-value">{categories.length}</div>
          <div className="stat-card-label">Categories</div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="dashboard-grid">
        {/* Expiring Soon */}
        <div className="dashboard-section glass-panel">
          <div className="dashboard-section-header">
            <h3 className="dashboard-section-title">⚠️ Attention Required</h3>
          </div>
          {allAlertItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">All Fresh!</div>
              <div className="empty-state-text">No items expiring soon</div>
            </div>
          ) : (
            <div className="expiring-list">
              {allAlertItems.map(item => {
                const days = getDaysUntilExpiry(item.expiryDate);
                return (
                  <div key={item.id} className="expiring-item">
                    <div className="expiring-item-info">
                      <span className="expiring-item-name">{item.name}</span>
                      <span className="expiring-item-category">{item.category}</span>
                    </div>
                    <span className={`badge ${getExpiryBadgeClass(days)}`}>
                      {getExpiryLabel(days)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="dashboard-section glass-panel">
          <div className="dashboard-section-header">
            <h3 className="dashboard-section-title">🕐 Recently Added</h3>
          </div>
          {recentItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No Items Yet</div>
              <div className="empty-state-text">Scan or add food to get started</div>
            </div>
          ) : (
            <div className="activity-list">
              {recentItems.map(item => (
                <div key={item.id} className="activity-item">
                  <span className="activity-icon">➕</span>
                  <span className="activity-text">
                    Added <strong>{item.name}</strong> ({item.quantity} {item.unit})
                  </span>
                  <span className="activity-time">{timeAgo(item.addedDate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
