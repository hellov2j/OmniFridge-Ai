// Shared expiry utility functions

export function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
}

export function getExpiryBadgeClass(days) {
  if (days === null) return 'badge-category';
  if (days < 0) return 'badge-expired';
  if (days <= 1) return 'badge-critical';
  if (days <= 3) return 'badge-warning';
  return 'badge-fresh';
}

export function getExpiryLabel(days) {
  if (days === null) return 'No expiry';
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}
