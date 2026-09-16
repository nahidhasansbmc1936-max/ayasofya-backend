const Database = require('better-sqlite3');
const path = require('path');
const { schema, migrations } = require('./schema');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './ayasofya.db';
const dbPath  = path.resolve(DB_PATH);

let db;

function getDB() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create all tables (IF NOT EXISTS — safe for existing DBs)
    db.exec(schema);

    // Run migrations — each ALTER TABLE is idempotent via try/catch
    // SQLite doesn't support IF NOT EXISTS on ALTER TABLE
    for (const sql of migrations) {
      try {
        db.exec(sql);
      } catch (_) {
        // Column already exists — ignore
      }
    }
  }
  return db;
}

module.exports = { getDB };
