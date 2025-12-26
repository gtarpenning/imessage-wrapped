// Initialize database schema
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("fly.io")
    ? { rejectUnauthorized: false }
    : false,
});

async function initDatabase() {
  try {
    console.log("Creating tables...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wrapped_stats (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        views INTEGER DEFAULT 0
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_year ON wrapped_stats(year);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_created_at ON wrapped_stats(created_at);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS llm_cache (
        prompt_hash TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        completion TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_llm_created_at ON llm_cache(created_at);
    `);

    console.log("✓ Database initialized successfully");

    // Test insert/select
    console.log("Testing database...");
    const testId = "test_" + Date.now();

    await pool.query(
      "INSERT INTO wrapped_stats (id, year, data) VALUES ($1, $2, $3)",
      [testId, 2025, JSON.stringify({ test: true })],
    );

    const result = await pool.query(
      "SELECT * FROM wrapped_stats WHERE id = $1",
      [testId],
    );

    if (result.rows.length > 0) {
      console.log("✓ Database is working correctly");
    }

    // Clean up test data
    await pool.query("DELETE FROM wrapped_stats WHERE id = $1", [testId]);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
}

initDatabase();
