import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'car_rental.db');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH);
  await fs.ensureDir(dataDir);
}

// Database connection
let db: sqlite3.Database | null = null;

async function getDatabase(): Promise<sqlite3.Database> {
  if (!db) {
    await ensureDataDir();
    
    return new Promise((resolve, reject) => {
      db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  }
  return db;
}

// Database initialization
export async function initializeDatabase() {
  const database = await getDatabase();
  
  const tables = [
    // Cars table
    `CREATE TABLE IF NOT EXISTS cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      plate TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL,
      daily_rate REAL NOT NULL DEFAULT 50.0,
      km_rate REAL NOT NULL DEFAULT 0.25,
      km_included_per_day INTEGER NOT NULL DEFAULT 200,
      status TEXT NOT NULL DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Customers table
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Rentals table
    `CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      start_km INTEGER NOT NULL,
      end_km INTEGER,
      start_date DATETIME NOT NULL,
      end_date DATETIME,
      daily_rate REAL NOT NULL,
      km_charges REAL DEFAULT 0.0,
      total_amount REAL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'active',
      paid BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (car_id) REFERENCES cars(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`,
    
    // Damages table
    `CREATE TABLE IF NOT EXISTS damages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id INTEGER NOT NULL,
      rental_id INTEGER,
      description TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'minor',
      reported_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      repaired_date DATETIME,
      photo_url TEXT,
      status TEXT NOT NULL DEFAULT 'reported',
      FOREIGN KEY (car_id) REFERENCES cars(id),
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    )`,
    
    // ID Verifications table
    `CREATE TABLE IF NOT EXISTS id_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      rental_id INTEGER,
      license_front_url TEXT,
      license_back_url TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    )`,
    
    // Videos table
    `CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id INTEGER NOT NULL,
      rental_id INTEGER,
      video_type TEXT NOT NULL,
      video_url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      delete_after_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (car_id) REFERENCES cars(id),
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    )`,

    // Payments table
    `CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    )`
  ];
  
  for (const sql of tables) {
    await new Promise<void>((resolve, reject) => {
      database.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

// Type definitions
export interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  daily_rate: number;
  km_rate: number;
  km_included_per_day: number;
  status: 'available' | 'rented' | 'maintenance';
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface Rental {
  id: number;
  car_id: number;
  customer_id: number;
  start_km: number;
  end_km?: number;
  start_date: string;
  end_date?: string;
  daily_rate: number;
  km_charges: number;
  total_amount: number;
  status: 'active' | 'completed' | 'cancelled';
  paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface Damage {
  id: number;
  car_id: number;
  rental_id?: number;
  description: string;
  severity: 'minor' | 'major' | 'severe';
  reported_date: string;
  repaired_date?: string;
  photo_url?: string;
  status: 'reported' | 'repaired' | 'pending';
}

export interface IDVerification {
  id: number;
  customer_id: number;
  rental_id?: number;
  license_front_url?: string;
  license_back_url?: string;
  verified_at?: string;
  created_at: string;
}

export interface Video {
  id: number;
  car_id: number;
  rental_id?: number;
  video_type: 'before' | 'after';
  video_url: string;
  file_size: number;
  recorded_at: string;
  delete_after_date?: string;
  created_at: string;
}

export interface Payment {
  id: number;
  rental_id: number;
  amount: number;
  payment_method?: string;
  payment_date: string;
  notes?: string;
  created_at: string;
}

// Database helper functions
export async function runQuery(sql: string, params: any[] = []): Promise<any> {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    database.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

export async function getQuery(sql: string, params: any[] = []): Promise<any> {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

export async function allQuery(sql: string, params: any[] = []): Promise<any[]> {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Close database connection
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}