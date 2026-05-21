import { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { getDaysUntilExpiry, getExpiryBadgeClass, getExpiryLabel } from '../utils/expiry';
import { CATEGORY_ICONS, UNITS } from '../utils/constants';
import './InventoryView.css';

export default function InventoryView() {
  const { items, updateItem, deleteItem, clearAll, getCategories } = useInventory();
  const categories = getCategories();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('expiry');
  const [sortDir, setSortDir] = useState('asc');
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }

    // Category
    if (activeCategory !== 'all') {
      result = result.filter(i => i.category === activeCategory);
    }

    // Sort
    result.sort((a, b) => {
      let va, vb;
      switch (sortBy) {
        case 'name':
          va = a.name.toLowerCase();
          vb = b.name.toLowerCase();
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'expiry':
          va = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
          vb = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
          return sortDir === 'asc' ? va - vb : vb - va;
        case 'added':
          va = new Date(a.addedDate).getTime();
          vb = new Date(b.addedDate).getTime();
          return sortDir === 'asc' ? vb - va : va - vb;
        case 'category':
          va = a.category || '';
          vb = b.category || '';
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        default:
          return 0;
      }
    });

    return result;
  }, [items, search, activeCategory, sortBy, sortDir]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
    });
  };

  // Close edit modal on Escape key
  useEffect(() => {
    if (!editingItem) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setEditingItem(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editingItem]);

  const saveEdit = async () => {
    if (!editForm.name?.trim()) return;
    const qty = Number(editForm.quantity);
    if (isNaN(qty) || qty < 1) return;
    await updateItem(editingItem.id, {
      ...editForm,
      name: editForm.name.trim(),
      quantity: qty,
    });
    setEditingItem(null);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Remove "${name}" from your fridge?`)) {
      await deleteItem(id);
    }
  };

  const sortIcon = (field) => {
    if (sortBy !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="inventory-view">
      <h1>Inventory</h1>
      <p>Track and manage all items in your fridge</p>

      {/* Toolbar */}
      <div className="inventory-toolbar">
        <div className="inventory-search">
          <span className="inventory-search-icon">🔍</span>
          <input
            className="input"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="category-filters">
          <button
            className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All ({items.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_ICONS[cat] || '📦'} {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="inventory-table-wrapper glass-panel">
        {filteredItems.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px' }}>
            <div className="empty-state-icon">🧊</div>
            <div className="empty-state-title">
              {items.length === 0 ? 'Your fridge is empty' : 'No matching items'}
            </div>
            <div className="empty-state-text">
              {items.length === 0
                ? 'Scan or add food items to start tracking'
                : 'Try adjusting your search or filters'}
            </div>
          </div>
        ) : (
          <>
            <table className="inventory-table">
              <thead>
                <tr>
                  <th className={sortBy === 'name' ? 'sorted' : ''} onClick={() => handleSort('name')}>
                    Item{sortIcon('name')}
                  </th>
                  <th className={sortBy === 'category' ? 'sorted' : ''} onClick={() => handleSort('category')}>
                    Category{sortIcon('category')}
                  </th>
                  <th>Qty</th>
                  <th className={sortBy === 'expiry' ? 'sorted' : ''} onClick={() => handleSort('expiry')}>
                    Expiry{sortIcon('expiry')}
                  </th>
                  <th className={sortBy === 'added' ? 'sorted' : ''} onClick={() => handleSort('added')}>
                    Added{sortIcon('added')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const days = getDaysUntilExpiry(item.expiryDate);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="item-name-cell">
                          <div className="item-thumb">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} />
                            ) : (
                              <span className="category-icon">{CATEGORY_ICONS[item.category] || '📦'}</span>
                            )}
                          </div>
                          <span className="item-name">{item.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-category">{item.category}</span>
                      </td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>
                        <span className={`badge ${getExpiryBadgeClass(days)}`}>
                          {getExpiryLabel(days)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {item.addedDate ? new Date(item.addedDate).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div className="item-actions">
                          <button className="item-action-btn" onClick={() => openEdit(item)}>✏️</button>
                          <button className="item-action-btn delete" onClick={() => handleDelete(item.id, item.name)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="inventory-footer">
              <span>Showing {filteredItems.length} of {items.length} items</span>
              {items.length > 0 && (
                <button className="btn btn-danger btn-sm" onClick={() => window.confirm('Clear all items?') && clearAll()}>
                  🗑️ Clear All
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>✏️ Edit Item</h3>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="input"
                  value={editForm.category}
                  onChange={(e) => setEditForm(p => ({ ...p, category: e.target.value }))}
                >
                  {Object.keys(CATEGORY_ICONS).map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Quantity</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm(p => ({ ...p, quantity: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Unit</label>
                  <select
                    className="input"
                    value={editForm.unit}
                    onChange={(e) => setEditForm(p => ({ ...p, unit: e.target.value }))}
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <input
                  className="input"
                  type="date"
                  value={editForm.expiryDate}
                  onChange={(e) => setEditForm(p => ({ ...p, expiryDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditingItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
