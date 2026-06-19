import Database from "better-sqlite3";
import path from "path";

let db: Database.Database;

export function initDatabase(dbPath?: string): Database.Database {
  const databasePath = dbPath || path.join(process.cwd(), "nannycert.db");
  db = new Database(databasePath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  createTables();

  return db;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_card TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      avatar TEXT,
      service_types TEXT NOT NULL,
      health_status TEXT NOT NULL,
      years_of_experience INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_review',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      service_type TEXT NOT NULL,
      level TEXT NOT NULL,
      training_certificate TEXT NOT NULL,
      practical_assessment_record TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      issued_at TEXT,
      expires_at TEXT,
      review_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS service_type_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      required_level TEXT NOT NULL,
      description TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_certifications_worker_id ON certifications(worker_id);
    CREATE INDEX IF NOT EXISTS idx_certifications_service_type ON certifications(service_type);
    CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
  `);
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
}
