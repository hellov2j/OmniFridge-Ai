import { useEffect, useCallback, useRef } from 'react';
import { useInventory } from '../context/InventoryContext';

const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useExpiryChecker({ onExpiringItems } = {}) {
  const { items } = useInventory();
  const notifiedRef = useRef(new Set());

  const checkExpiry = useCallback(() => {
    const now = new Date();
    const expiring = [];

    items.forEach(item => {
      if (!item.expiryDate) return;
      const expiry = new Date(item.expiryDate);
      const diffMs = expiry - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 2 && diffDays >= 0 && !notifiedRef.current.has(item.id)) {
        expiring.push({ ...item, daysLeft: diffDays });
        notifiedRef.current.add(item.id);
      }
    });

    if (expiring.length > 0) {
      // Browser notification (guarded)
      if ('Notification' in window && Notification.permission === 'granted') {
        const names = expiring.map(i => i.name).join(', ');
        new Notification('🧊 SmartFridge Alert', {
          body: `${expiring.length} item(s) expiring soon: ${names}`,
          icon: '/fridge-icon.png',
          tag: 'expiry-alert',
        });
      }

      // Callback for in-app toast
      if (onExpiringItems) {
        onExpiringItems(expiring);
      }
    }

    return expiring;
  }, [items, onExpiringItems]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Reset notification tracking when items change (e.g., expiry date updated)
  useEffect(() => {
    notifiedRef.current = new Set();
  }, [items]);

  // Run check on mount and periodically
  useEffect(() => {
    checkExpiry();
    const interval = setInterval(checkExpiry, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkExpiry]);

  return { checkExpiry };
}
