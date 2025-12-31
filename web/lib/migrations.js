// Database migration system
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("fly.io")
    ? { rejectUnauthorized: false }
    : false,
});

// Migration definitions
// Each migration has an id, name, and up function
// Migrations are run in order by id
const migrations = [
  {
    id: 1,
    name: "add_metadata_column",
    up: async (client) => {
      await client.query(`
        ALTER TABLE wrapped_stats 
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metadata_sdk_version 
        ON wrapped_stats((metadata->>'sdk_version'))
      `);
    },
  },
  {
    id: 2,
    name: "add_user_fingerprint_index",
    up: async (client) => {
      // Add index on user_fingerprint for efficient lookups when replacing wraps
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_metadata_user_fingerprint 
        ON wrapped_stats((metadata->>'user_fingerprint'))
      `);
      
      // Add compound index for finding existing wraps by fingerprint + year
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_fingerprint_year 
        ON wrapped_stats((metadata->>'user_fingerprint'), year)
      `);
    },
  },
  {
    id: 3,
    name: "add_updated_at_and_version_tracking",
    up: async (client) => {
      // Add updated_at column to track when wraps are modified
      await client.query(`
        ALTER TABLE wrapped_stats 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
      `);
      
      // Initialize updated_at for existing rows (set to created_at)
      await client.query(`
        UPDATE wrapped_stats 
        SET updated_at = created_at 
        WHERE updated_at IS NULL
      `);
      
      // Add NOT NULL constraint after initialization
      await client.query(`
        ALTER TABLE wrapped_stats 
        ALTER COLUMN updated_at SET DEFAULT NOW(),
        ALTER COLUMN updated_at SET NOT NULL
      `);
      
      // Add index for querying recently updated wraps
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_updated_at 
        ON wrapped_stats(updated_at DESC)
      `);
      
      // Initialize version_history array in metadata for existing rows
      // This stores the history of updates (SDK versions, timestamps)
      await client.query(`
        UPDATE wrapped_stats 
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{version_history}',
          '[]'::jsonb,
          true
        )
        WHERE metadata->>'version_history' IS NULL
      `);
    },
  },
  {
    id: 4,
    name: "add_hydrated_data_and_unlock_code",
    up: async (client) => {
      // Add hydrated_data column to store contact names separately
      await client.query(`
        ALTER TABLE wrapped_stats 
        ADD COLUMN IF NOT EXISTS hydrated_data JSONB
      `);
      
      // Add unlock_code column to store the 6-character unlock code
      await client.query(`
        ALTER TABLE wrapped_stats 
        ADD COLUMN IF NOT EXISTS unlock_code TEXT
      `);
      
      // Add index on unlock_code for efficient lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_unlock_code 
        ON wrapped_stats(unlock_code) WHERE unlock_code IS NOT NULL
      `);
    },
  },
  // Add future migrations here with incrementing ids
];

/**
 * Initialize the migrations table
 */
async function initMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

/**
 * Get list of applied migration ids
 */
async function getAppliedMigrations() {
  const result = await pool.query(
    "SELECT id FROM schema_migrations ORDER BY id"
  );
  return result.rows.map((row) => row.id);
}

/**
 * Run a single migration
 */
async function runMigration(migration) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Run the migration
    await migration.up(client);
    
    // Record that it was applied
    await client.query(
      "INSERT INTO schema_migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [migration.id, migration.name]
    );
    
    await client.query("COMMIT");
    console.log(`✓ Applied migration ${migration.id}: ${migration.name}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations() {
  try {
    // Ensure migrations table exists
    await initMigrationsTable();
    
    // Get list of applied migrations
    const appliedIds = await getAppliedMigrations();
    
    // Find pending migrations
    const pendingMigrations = migrations.filter(
      (m) => !appliedIds.includes(m.id)
    );
    
    if (pendingMigrations.length === 0) {
      console.log("Database migrations: up to date");
      return;
    }
    
    console.log(`Running ${pendingMigrations.length} pending migration(s)...`);
    
    // Run each pending migration in order
    for (const migration of pendingMigrations) {
      await runMigration(migration);
    }
    
    console.log("All migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * Get migration status
 */
export async function getMigrationStatus() {
  try {
    await initMigrationsTable();
    const appliedIds = await getAppliedMigrations();
    
    return migrations.map((m) => ({
      id: m.id,
      name: m.name,
      applied: appliedIds.includes(m.id),
    }));
  } catch (error) {
    console.error("Failed to get migration status:", error);
    return [];
  }
}

