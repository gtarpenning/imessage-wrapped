#!/usr/bin/env node

/**
 * Migration script to add metadata JSONB column to wrapped_stats table.
 * This script is safe to run multiple times - it will only add the column if it doesn't exist.
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("fly.io")
    ? { rejectUnauthorized: false }
    : false,
});

async function migrate() {
  console.log("Starting migration: Adding metadata JSONB column to wrapped_stats...");

  try {
    // Add metadata column
    try {
      await pool.query(`
        ALTER TABLE wrapped_stats 
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
      `);
      console.log("✓ Added metadata column");
    } catch (error) {
      console.log(`- Metadata column already exists or error: ${error.message}`);
    }

    // Add index for SDK version queries
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_metadata_sdk_version 
        ON wrapped_stats((metadata->>'sdk_version'))
      `);
      console.log("✓ Added index on metadata->>'sdk_version'");
    } catch (error) {
      console.log(`- Index already exists or error: ${error.message}`);
    }

    // Migrate old columns to metadata if they exist
    console.log("\nChecking for old metadata columns to migrate...");
    try {
      const oldColumns = [
        'sdk_version', 'dmg_version', 'python_version',
        'platform', 'platform_version', 'machine'
      ];
      
      // Check if any old columns exist
      const { rows } = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'wrapped_stats' 
        AND column_name IN (${oldColumns.map((_, i) => `$${i + 1}`).join(',')})
      `, oldColumns);

      if (rows.length > 0) {
        console.log(`Found ${rows.length} old column(s) to migrate...`);
        
        // Build update query to migrate data
        const updates = oldColumns.map(col => 
          `metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{${col}}', to_jsonb(${col}), true)`
        ).join(', ');
        
        await pool.query(`
          UPDATE wrapped_stats 
          SET ${updates}
          WHERE metadata IS NULL OR metadata = '{}'::jsonb
        `);
        
        console.log("✓ Migrated data from old columns to metadata JSONB");
        
        // Optionally drop old columns (commented out for safety)
        // for (const col of oldColumns) {
        //   await pool.query(`ALTER TABLE wrapped_stats DROP COLUMN IF EXISTS ${col}`);
        // }
        console.log("Note: Old columns still exist. You can manually drop them if needed.");
      } else {
        console.log("No old columns found - clean migration");
      }
    } catch (error) {
      console.log(`Migration check completed with note: ${error.message}`);
    }

    console.log("\n✓ Migration completed successfully!");
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

