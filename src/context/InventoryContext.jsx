import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import db from '../db';

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const [items, setItems] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
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

  const loadShoppingList = useCallback(async () => {
    try {
      const all = await db.shoppingList.toArray();
      setShoppingList(all);
    } catch (err) {
      console.error('Failed to load shopping list:', err);
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadShoppingList();
  }, [loadItems, loadShoppingList]);

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

  // Delete item AND add it to the shopping list
  const deleteItemAndShop = async (id, reason = 'consumed') => {
    try {
      const item = await db.foodItems.get(id);
      if (item) {
        await db.shoppingList.add({
          name: item.name,
          category: item.category || 'other',
          quantity: item.quantity || 1,
          unit: item.unit || 'pieces',
          addedDate: new Date().toISOString(),
          source: reason,
          purchased: 0,
        });
      }
      await db.foodItems.delete(id);
      await loadItems();
      await loadShoppingList();
    } catch (err) {
      console.error('Failed to delete item and add to shopping list:', err);
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

  // ── Shopping List Methods ──────────────────────────────────────────

  const addShoppingItem = async (item) => {
    try {
      await db.shoppingList.add({
        name: item.name,
        category: item.category || 'other',
        quantity: item.quantity || 1,
        unit: item.unit || 'pieces',
        addedDate: new Date().toISOString(),
        source: 'manual',
        purchased: 0,
      });
      await loadShoppingList();
    } catch (err) {
      console.error('Failed to add shopping item:', err);
      throw err;
    }
  };

  const toggleShoppingItem = async (id) => {
    try {
      const item = await db.shoppingList.get(id);
      if (item) {
        await db.shoppingList.update(id, { purchased: item.purchased ? 0 : 1 });
        await loadShoppingList();
      }
    } catch (err) {
      console.error('Failed to toggle shopping item:', err);
      throw err;
    }
  };

  const deleteShoppingItem = async (id) => {
    try {
      await db.shoppingList.delete(id);
      await loadShoppingList();
    } catch (err) {
      console.error('Failed to delete shopping item:', err);
      throw err;
    }
  };

  const clearPurchasedItems = async () => {
    try {
      await db.shoppingList.where('purchased').equals(1).delete();
      await loadShoppingList();
    } catch (err) {
      console.error('Failed to clear purchased items:', err);
      throw err;
    }
  };

  const clearShoppingList = async () => {
    try {
      await db.shoppingList.clear();
      await loadShoppingList();
    } catch (err) {
      console.error('Failed to clear shopping list:', err);
      throw err;
    }
  };

  // ── Computed Helpers ───────────────────────────────────────────────

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

  const unpurchasedCount = useMemo(
    () => shoppingList.filter(i => !i.purchased).length,
    [shoppingList]
  );

  const value = useMemo(() => ({
    items,
    loading,
    addItem,
    addItems,
    updateItem,
    deleteItem,
    deleteItemAndShop,
    clearAll,
    getExpiringItems,
    getExpiredItems,
    getItemsByCategory,
    getNonExpiredItems,
    getCategories,
    refreshItems: loadItems,
    // Shopping list
    shoppingList,
    unpurchasedCount,
    addShoppingItem,
    toggleShoppingItem,
    deleteShoppingItem,
    clearPurchasedItems,
    clearShoppingList,
  }), [items, loading, shoppingList, unpurchasedCount]);

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
