// Database connection and queries
import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("fly.io")
    ? { rejectUnauthorized: false }
    : false,
});

// Test connection
pool.on("error", (err) => {
  console.error("Database connection error:", err);
});

// Generate a unique ID for a wrapped
export function generateId() {
  return crypto.randomBytes(6).toString("base64url");
}

// Save wrapped statistics to database
export async function createWrapped(year, data) {
  const id = generateId();

  const sql = `
    INSERT INTO wrapped_stats (id, year, data, created_at, views)
    VALUES ($1, $2, $3, NOW(), 0)
    RETURNING id, year, created_at
  `;

  const result = await pool.query(sql, [id, year, JSON.stringify(data)]);
  return result.rows[0];
}

// Get wrapped statistics by ID and year
export async function getWrapped(year, id) {
  const sql = `
    SELECT id, year, data, created_at, views
    FROM wrapped_stats
    WHERE id = $1 AND year = $2
  `;

  const result = await pool.query(sql, [id, year]);

  if (result.rows.length === 0) {
    return null;
  }

  const wrapped = result.rows[0];

  // Increment view counter
  await pool.query("UPDATE wrapped_stats SET views = views + 1 WHERE id = $1", [
    id,
  ]);

  return {
    id: wrapped.id,
    year: wrapped.year,
    statistics: wrapped.data,
    created_at: wrapped.created_at,
    views: wrapped.views + 1,
  };
}

// Get all wraps with aggregated statistics
export async function getAllWraps() {
  const sql = `
    SELECT id, year, data, created_at, views
    FROM wrapped_stats
    ORDER BY created_at DESC
  `;

  const result = await pool.query(sql);
  return result.rows.map(row => ({
    id: row.id,
    year: row.year,
    statistics: row.data,
    created_at: row.created_at,
    views: row.views,
  }));
}

// Initialize database schema
export async function initDatabase() {
  const sql = `
    CREATE TABLE IF NOT EXISTS wrapped_stats (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      views INTEGER DEFAULT 0
    );
    
    CREATE INDEX IF NOT EXISTS idx_year ON wrapped_stats(year);
    CREATE INDEX IF NOT EXISTS idx_created_at ON wrapped_stats(created_at);
    
    CREATE TABLE IF NOT EXISTS llm_cache (
      prompt_hash TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      completion TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_llm_created_at ON llm_cache(created_at);
  `;

  await pool.query(sql);
  console.log("Database initialized");
}
