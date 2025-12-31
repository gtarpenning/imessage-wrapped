#!/usr/bin/env node

/**
 * Manual migration script - runs all pending migrations.
 * This is useful for running migrations manually or in deployment scripts.
 * 
 * Usage:
 *   node scripts/migrate-add-metadata.js
 * 
 * Note: The server also runs migrations automatically on startup.
 */

import { runMigrations, getMigrationStatus } from "../lib/migrations.js";

async function main() {
  console.log("Database Migration Tool\n");
  
  try {
    // Show current status
    console.log("Current migration status:");
    const status = await getMigrationStatus();
    status.forEach((m) => {
      const symbol = m.applied ? "✓" : "○";
      console.log(`  ${symbol} ${m.id}: ${m.name}`);
    });
    console.log();
    
    // Run pending migrations
    await runMigrations();
    
    process.exit(0);
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  }
}

main();

