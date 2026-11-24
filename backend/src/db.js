import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ensureSeedAssets } from './seedAssets.js';

const dataDir = path.resolve('data');
const uploadsDir = path.resolve('uploads');
fs.mkdirSync(dataDir, { recursive: true });
ensureSeedAssets(uploadsDir);

const dbPath = path.join(dataDir, 'rental.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Dress',
    type TEXT NOT NULL,
    color TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    priceVisible INTEGER NOT NULL DEFAULT 1,
    isAvailable INTEGER NOT NULL DEFAULT 1,
    storageLocation TEXT NOT NULL DEFAULT '',
    imageUrl TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL DEFAULT '',
    functionDate TEXT NOT NULL,
    collectionDate TEXT NOT NULL,
    returnDate TEXT NOT NULL,
    basePrice REAL NOT NULL,
    discountType TEXT NOT NULL DEFAULT 'none',
    discountValue REAL NOT NULL DEFAULT 0,
    discountAmount REAL NOT NULL DEFAULT 0,
    finalPrice REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed',
    notes TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
  );
`);

function seedInitialData() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (countRow.count > 0) return;

  const insertProduct = db.prepare(`
    INSERT INTO products (name, category, type, color, price, priceVisible, isAvailable, storageLocation, imageUrl, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedProducts = [
    [
      'Maharani Kundan Bridal Necklace',
      'Jewelry',
      'Necklace Set',
      'Gold & Ruby',
      4500,
      1,
      1,
      'Vault A - Tray 02',
      '/uploads/seed-kundan-necklace.svg',
      'Handcrafted 22k gold-plated Kundan bridal necklace with ruby drops and South Sea pearl accents.'
    ],
    [
      'Royal Crimson Zardozi Lehenga',
      'Dress',
      'Bridal Lehenga',
      'Crimson Red',
      8500,
      1,
      1,
      'Rack B - Section 04',
      '/uploads/seed-crimson-lehenga.svg',
      'Heavy velvet bridal lehenga with antique gold zari embroidery and sheer net dupatta.'
    ],
    [
      'Nizam Emerald Polki Choker',
      'Jewelry',
      'Choker Set',
      'Emerald Green',
      3800,
      0,
      1,
      'Vault A - Tray 05',
      '/uploads/seed-emerald-choker.svg',
      'Regal uncut polki choker inlaid with Zambian emerald cabochons. Exclusive boutique piece.'
    ],
    [
      'Ivory Pearl Reception Gown',
      'Dress',
      'Evening Gown',
      'Ivory',
      6200,
      1,
      1,
      'Rack C - Section 01',
      '/uploads/seed-ivory-gown.svg',
      'Flowing satin-organza reception gown with champagne belt detailing.'
    ],
    [
      'Temple Gold Kemp Jhumkas',
      'Jewelry',
      'Earrings',
      'Antique Gold',
      1400,
      1,
      1,
      'Vault B - Drawer 01',
      '/uploads/seed-temple-jhumkas.svg',
      'Traditional South Indian temple bell jhumkas with pearl hangings.'
    ],
    [
      'Royal Midnight Velvet Sherwani',
      'Dress',
      'Sherwani',
      'Navy Blue',
      5400,
      0,
      1,
      'Rack A - Section 03',
      '/uploads/seed-navy-sherwani.svg',
      'Structured bandhgala sherwani with antique brass buttons and subtle zari piping.'
    ]
  ];

  for (const p of seedProducts) {
    insertProduct.run(...p);
  }
}

seedInitialData();
