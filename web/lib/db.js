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
export async function createWrapped(year, data, userName = null) {
  const id = generateId();

  // Include user_name in the data if provided
  const wrappedData = { ...data };
  if (userName) {
    wrappedData.user_name = userName;
  }

  const sql = `
    INSERT INTO wrapped_stats (id, year, data, created_at, views)
    VALUES ($1, $2, $3, NOW(), 0)
    RETURNING id, year, created_at
  `;

  const result = await pool.query(sql, [id, year, JSON.stringify(wrappedData)]);
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
    user_name: wrapped.data.user_name || null,
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
    user_name: row.data.user_name || null,
    created_at: row.created_at,
    views: row.views,
  }));
}

// Create a comparison entry
export async function createComparison(year1Id, year2Id, year1, year2) {
  const id = generateId();

  const sql = `
    INSERT INTO wrapped_comparisons (id, year1_id, year2_id, year1, year2, created_at, views)
    VALUES ($1, $2, $3, $4, $5, NOW(), 0)
    RETURNING id, year1, year2, created_at
  `;

  const result = await pool.query(sql, [id, year1Id, year2Id, year1, year2]);
  return result.rows[0];
}

// Get comparison by ID
export async function getComparison(year1, year2, id) {
  const sql = `
    SELECT 
      c.id, 
      c.year1, 
      c.year2, 
      c.year1_id,
      c.year2_id,
      c.created_at, 
      c.views,
      w1.data as year1_data,
      w2.data as year2_data
    FROM wrapped_comparisons c
    JOIN wrapped_stats w1 ON c.year1_id = w1.id
    JOIN wrapped_stats w2 ON c.year2_id = w2.id
    WHERE c.id = $1 AND c.year1 = $2 AND c.year2 = $3
  `;

  const result = await pool.query(sql, [id, year1, year2]);

  if (result.rows.length === 0) {
    return null;
  }

  const comparison = result.rows[0];

  // Increment view counter
  await pool.query(
    "UPDATE wrapped_comparisons SET views = views + 1 WHERE id = $1",
    [id]
  );

  return {
    id: comparison.id,
    year1: comparison.year1,
    year2: comparison.year2,
    year1_statistics: comparison.year1_data,
    year2_statistics: comparison.year2_data,
    year1_user_name: comparison.year1_data.user_name || null,
    year2_user_name: comparison.year2_data.user_name || null,
    created_at: comparison.created_at,
    views: comparison.views + 1,
  };
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
    
    CREATE TABLE IF NOT EXISTS wrapped_comparisons (
      id TEXT PRIMARY KEY,
      year1_id TEXT NOT NULL,
      year2_id TEXT NOT NULL,
      year1 INTEGER NOT NULL,
      year2 INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      views INTEGER DEFAULT 0,
      FOREIGN KEY (year1_id) REFERENCES wrapped_stats(id) ON DELETE CASCADE,
      FOREIGN KEY (year2_id) REFERENCES wrapped_stats(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_comparison_years ON wrapped_comparisons(year1, year2);
    CREATE INDEX IF NOT EXISTS idx_comparison_created_at ON wrapped_comparisons(created_at);
  `;

  await pool.query(sql);
  console.log("Database initialized");
}
