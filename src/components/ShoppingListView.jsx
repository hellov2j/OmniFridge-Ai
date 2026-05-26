import { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { CATEGORY_ICONS, UNITS } from '../utils/constants';
import './ShoppingListView.css';

const SOURCE_LABELS = {
  consumed: '🍽️ Used up',
  expired: '⏰ Expired',
  manual: '✏️ Added manually',
};

export default function ShoppingListView() {
  const {
    shoppingList,
    addShoppingItem,
    toggleShoppingItem,
    deleteShoppingItem,
    clearPurchasedItems,
    clearShoppingList,
  } = useInventory();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: 1, unit: 'pieces' });

  const unpurchased = useMemo(
    () => shoppingList.filter(i => !i.purchased),
    [shoppingList]
  );
  const purchased = useMemo(
    () => shoppingList.filter(i => i.purchased),
    [shoppingList]
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await addShoppingItem({
      name: form.name.trim(),
      quantity: Number(form.quantity) || 1,
      unit: form.unit,
    });
    setForm({ name: '', quantity: 1, unit: 'pieces' });
    setShowForm(false);
  };

  return (
    <div className="shopping-view">
      <div className="shopping-header">
        <div>
          <h1>Shopping List</h1>
          <p>Items to buy on your next grocery run</p>
        </div>
        <div className="shopping-header-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '➕ Add Item'}
          </button>
          {purchased.length > 0 && (
            <button className="btn btn-ghost" onClick={clearPurchasedItems}>
              🧹 Clear Purchased
            </button>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form className="shopping-add-form glass-panel" onSubmit={handleAdd}>
          <div className="shopping-add-grid">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Item Name</label>
              <input
                className="input"
                placeholder="e.g., Milk, Eggs, Bread..."
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                autoFocus
                required
              />
            </div>
            <div className="form-group" style={{ flex: 0.7 }}>
              <label className="form-label">Qty</label>
              <input
                className="input"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm(p => ({ ...p, quantity: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Unit</label>
              <select
                className="input"
                value={form.unit}
                onChange={(e) => setForm(p => ({ ...p, unit: e.target.value }))}
              >
                {UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary shopping-add-btn">
              Add
            </button>
          </div>
        </form>
      )}

      {/* Shopping List */}
      {shoppingList.length === 0 ? (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-state-icon">🛒</div>
            <div className="empty-state-title">Shopping list is empty</div>
            <div className="empty-state-text">
              Items will appear here when you remove them from your fridge, or you can add items manually
            </div>
          </div>
        </div>
      ) : (
        <div className="shopping-list-container">
          {/* Unpurchased items */}
          {unpurchased.length > 0 && (
            <div className="shopping-section">
              <h3 className="shopping-section-title">
                🛒 To Buy ({unpurchased.length})
              </h3>
              <div className="shopping-items glass-panel">
                {unpurchased.map(item => (
                  <div key={item.id} className="shopping-item">
                    <button
                      className="shopping-check"
                      onClick={() => toggleShoppingItem(item.id)}
                      aria-label={`Mark ${item.name} as purchased`}
                    >
                      <span className="shopping-check-box" />
                    </button>
                    <div className="shopping-item-info">
                      <div className="shopping-item-name">
                        {CATEGORY_ICONS[item.category] || '📦'} {item.name}
                      </div>
                      <div className="shopping-item-meta">
                        {item.quantity} {item.unit}
                        <span className="shopping-item-source">
                          {SOURCE_LABELS[item.source] || item.source}
                        </span>
                      </div>
                    </div>
                    <button
                      className="shopping-item-remove"
                      onClick={() => deleteShoppingItem(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchased items */}
          {purchased.length > 0 && (
            <div className="shopping-section">
              <h3 className="shopping-section-title purchased-title">
                ✅ Purchased ({purchased.length})
              </h3>
              <div className="shopping-items glass-panel purchased-section">
                {purchased.map(item => (
                  <div key={item.id} className="shopping-item purchased">
                    <button
                      className="shopping-check checked"
                      onClick={() => toggleShoppingItem(item.id)}
                      aria-label={`Unmark ${item.name}`}
                    >
                      <span className="shopping-check-box">✓</span>
                    </button>
                    <div className="shopping-item-info">
                      <div className="shopping-item-name strikethrough">
                        {CATEGORY_ICONS[item.category] || '📦'} {item.name}
                      </div>
                      <div className="shopping-item-meta">
                        {item.quantity} {item.unit}
                      </div>
                    </div>
                    <button
                      className="shopping-item-remove"
                      onClick={() => deleteShoppingItem(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          {shoppingList.length > 0 && (
            <div className="shopping-footer">
              <span className="shopping-footer-count">
                {unpurchased.length} remaining · {purchased.length} purchased
              </span>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => window.confirm('Clear the entire shopping list?') && clearShoppingList()}
              >
                🗑️ Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
