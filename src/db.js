import Dexie from 'dexie';

const db = new Dexie('SmartFridgeDB');

db.version(1).stores({
  foodItems: '++id, name, category, quantity, unit, addedDate, expiryDate, imageUrl',
});

db.version(2).stores({
  foodItems: '++id, name, category, quantity, unit, addedDate, expiryDate, imageUrl',
  shoppingList: '++id, name, category, quantity, unit, addedDate, source, purchased',
});

export default db;
