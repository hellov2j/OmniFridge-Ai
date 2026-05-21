import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import db from '../db';

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      const allItems = await db.foodItems.toArray();
      setItems(allItems);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const addItem = async (item) => {
    try {
      const id = await db.foodItems.add({
        ...item,
        addedDate: new Date().toISOString(),
      });
      await loadItems();
      return id;
    } catch (err) {
      console.error('Failed to add item:', err);
      throw err;
    }
  };

  const addItems = async (itemsToAdd) => {
    try {
      const prepared = itemsToAdd.map(item => ({
        ...item,
        addedDate: new Date().toISOString(),
      }));
      await db.foodItems.bulkAdd(prepared);
      await loadItems();
    } catch (err) {
      console.error('Failed to add items:', err);
      throw err;
    }
  };

  const updateItem = async (id, changes) => {
    try {
      await db.foodItems.update(id, changes);
      await loadItems();
    } catch (err) {
      console.error('Failed to update item:', err);
      throw err;
    }
  };

  const deleteItem = async (id) => {
    try {
      await db.foodItems.delete(id);
      await loadItems();
    } catch (err) {
      console.error('Failed to delete item:', err);
      throw err;
    }
  };

  const clearAll = async () => {
    try {
      await db.foodItems.clear();
      await loadItems();
    } catch (err) {
      console.error('Failed to clear all items:', err);
      throw err;
    }
  };

  const getExpiringItems = (daysThreshold = 2) => {
    const now = new Date();
    return items.filter(item => {
      if (!item.expiryDate) return false;
      const expiry = new Date(item.expiryDate);
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      return diffDays <= daysThreshold && diffDays >= 0;
    });
  };

  const getExpiredItems = () => {
    const now = new Date();
    return items.filter(item => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate) < now;
    });
  };

  const getItemsByCategory = (category) => {
    if (!category || category === 'all') return items;
    return items.filter(item => item.category === category);
  };

  const getNonExpiredItems = () => {
    const now = new Date();
    return items.filter(item => {
      if (!item.expiryDate) return true;
      return new Date(item.expiryDate) >= now;
    });
  };

  const getCategories = () => {
    const cats = new Set(items.map(i => i.category).filter(Boolean));
    return Array.from(cats).sort();
  };

  const value = useMemo(() => ({
    items,
    loading,
    addItem,
    addItems,
    updateItem,
    deleteItem,
    clearAll,
    getExpiringItems,
    getExpiredItems,
    getItemsByCategory,
    getNonExpiredItems,
    getCategories,
    refreshItems: loadItems,
  }), [items, loading]);

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
