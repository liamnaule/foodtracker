import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "foodtracker.db");

export function openDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,                 -- ISO date (YYYY-MM-DD)
      type TEXT NOT NULL,                 -- 'revenue' | 'expense'
      category TEXT NOT NULL,             -- e.g. 'ingredients', 'labor', 'sales'
      description TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL,      -- positive integer cents
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS person_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      date TEXT NOT NULL,                 -- date they ordered (YYYY-MM-DD)
      cost_cents INTEGER NOT NULL,        -- cost for that day
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_person_orders_person_date
      ON person_orders(person_id, date);
  `);

  return db;
}

