const Database = require('better-sqlite3');
const path = require('path');
const schema = require('./schema');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './ayasofya.db';
const dbPath = path.resolve(DB_PATH);

let db;

function getDB() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(schema);
  }
  return db;
}

module.exports = { getDB };
