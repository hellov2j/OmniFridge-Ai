import Dexie from 'dexie';

const db = new Dexie('SmartFridgeDB');

db.version(1).stores({
  foodItems: '++id, name, category, quantity, unit, addedDate, expiryDate, imageUrl',
});

export default db;
