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

// Find existing wrap by user fingerprint and year
export async function findExistingWrap(userFingerprint, year) {
  if (!userFingerprint) {
    return null;
  }
  
  const sql = `
    SELECT id, year, created_at, metadata
    FROM wrapped_stats
    WHERE metadata->>'user_fingerprint' = $1 AND year = $2
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const result = await pool.query(sql, [userFingerprint, year]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Create a version history entry for tracking updates
 * 
 * This function is designed to be extensible - add any new metadata fields
 * you want to track in the historyEntry object below.
 * 
 * @param {object} oldMetadata - Previous metadata object
 * @param {object} newMetadata - New metadata object
 * @returns {object} - Metadata with updated version_history
 */
function addVersionHistoryEntry(oldMetadata, newMetadata) {
  const versionHistory = oldMetadata?.version_history || [];
  
  // Create a history entry with the OLD version info (before update)
  // EXTENSIBILITY: Add new fields here to track them in version history
  const historyEntry = {
    timestamp: new Date().toISOString(),
    sdk_version: oldMetadata?.sdk_version || null,
    dmg_version: oldMetadata?.dmg_version || null,
    platform: oldMetadata?.platform || null,
    // Future fields can be added here, e.g.:
    // python_version: oldMetadata?.python_version || null,
    // os_version: oldMetadata?.os_version || null,
  };
  
  // Only add if there's meaningful data to track
  // This prevents cluttering history with empty entries
  const hasData = Object.values(historyEntry).some(
    val => val !== null && val !== 'timestamp'
  );
  
  if (hasData) {
    versionHistory.push(historyEntry);
  }
  
  // Return new metadata with updated history
  // This preserves all new metadata fields while adding history
  return {
    ...newMetadata,
    version_history: versionHistory,
  };
}

/**
 * Get the update history for a wrap
 * @param {string} id - Wrap ID
 * @returns {Promise<Array>} - Array of version history entries
 */
export async function getWrapUpdateHistory(id) {
  const sql = `
    SELECT metadata, created_at, updated_at
    FROM wrapped_stats
    WHERE id = $1
  `;
  
  const result = await pool.query(sql, [id]);
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const metadata = row.metadata || {};
  const versionHistory = metadata.version_history || [];
  
  return {
    created_at: row.created_at,
    updated_at: row.updated_at,
    current_version: {
      sdk_version: metadata.sdk_version || null,
      dmg_version: metadata.dmg_version || null,
      platform: metadata.platform || null,
    },
    history: versionHistory,
    update_count: versionHistory.length,
  };
}

// Delete a wrap by ID
export async function deleteWrap(id) {
  const sql = `DELETE FROM wrapped_stats WHERE id = $1`;
  await pool.query(sql, [id]);
}

// Save wrapped statistics to database
// If a wrap with the same user_fingerprint and year exists, it will be UPDATED (not replaced)
// This preserves the ID, views, and comparisons while refreshing the data
export async function createWrapped(year, data, userName = null, metadata = null, hydratedData = null, unlockCode = null) {
  // Store metadata as JSON (defaults to empty object if not provided)
  const metadataJson = metadata || {};
  
  // Include user_name in the data if provided
  const wrappedData = { ...data };
  if (userName) {
    wrappedData.user_name = userName;
  }
  
  // Check if this user already has a wrap for this year
  const userFingerprint = metadataJson.user_fingerprint;
  if (userFingerprint) {
    const existingWrap = await findExistingWrap(userFingerprint, year);
    if (existingWrap) {
      // UPDATE existing wrap instead of deleting
      // This preserves the ID, URL, views, and any comparisons
      const oldMetadata = existingWrap.metadata || {};
      const updatedMetadata = addVersionHistoryEntry(oldMetadata, metadataJson);
      
      const sql = `
        UPDATE wrapped_stats 
        SET 
          data = $1, 
          metadata = $2, 
          hydrated_data = $3,
          unlock_code = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING id, year, created_at, updated_at
      `;
      
      const result = await pool.query(sql, [
        JSON.stringify(wrappedData),
        JSON.stringify(updatedMetadata),
        hydratedData ? JSON.stringify(hydratedData) : null,
        unlockCode,
        existingWrap.id
      ]);
      
      console.log(
        `Updated existing wrap ${existingWrap.id} for user ${userFingerprint} year ${year}` +
        (oldMetadata.sdk_version && metadataJson.sdk_version 
          ? ` (${oldMetadata.sdk_version} → ${metadataJson.sdk_version})`
          : '')
      );
      
      return result.rows[0];
    }
  }
  
  // No existing wrap found - create a new one
  const id = generateId();

  const sql = `
    INSERT INTO wrapped_stats (
      id, year, data, created_at, updated_at, views, metadata, hydrated_data, unlock_code
    )
    VALUES ($1, $2, $3, NOW(), NOW(), 0, $4, $5, $6)
    RETURNING id, year, created_at, updated_at
  `;

  const result = await pool.query(sql, [
    id, year, JSON.stringify(wrappedData), JSON.stringify(metadataJson),
    hydratedData ? JSON.stringify(hydratedData) : null, unlockCode
  ]);
  
  console.log(`Created new wrap ${id} for year ${year}${unlockCode ? ' with unlock code' : ''}`);
  return result.rows[0];
}

// Get wrapped statistics by ID and year
export async function getWrapped(year, id) {
  const sql = `
    SELECT id, year, data, created_at, updated_at, views, metadata, hydrated_data
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
    updated_at: wrapped.updated_at,
    views: wrapped.views + 1,
    metadata: wrapped.metadata || {},
    hydrated_data: wrapped.hydrated_data || null,
  };
}

// Get all wraps with aggregated statistics
export async function getAllWraps() {
  const sql = `
    SELECT 
      id, year, data, created_at, updated_at, views, metadata
    FROM wrapped_stats
    ORDER BY updated_at DESC
  `;

  const result = await pool.query(sql);
  return result.rows.map(row => {
    const metadata = row.metadata || {};
    const versionHistory = metadata.version_history || [];
    const wasUpdated = row.updated_at && row.created_at && 
                       new Date(row.updated_at).getTime() !== new Date(row.created_at).getTime();
    
    return {
      id: row.id,
      year: row.year,
      statistics: row.data,
      user_name: row.data.user_name || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      views: row.views,
      metadata: metadata,
      // Convenience accessors for common metadata fields
      sdk_version: metadata.sdk_version || null,
      dmg_version: metadata.dmg_version || null,
      platform: metadata.platform || null,
      user_fingerprint: metadata.user_fingerprint || null,
      // Update tracking
      was_updated: wasUpdated,
      update_count: versionHistory.length,
      version_history: versionHistory,
    };
  });
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
      w2.data as year2_data,
      w1.hydrated_data as year1_hydrated_data,
      w2.hydrated_data as year2_hydrated_data
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
    year1_id: comparison.year1_id,
    year2_id: comparison.year2_id,
    year1_statistics: comparison.year1_data,
    year2_statistics: comparison.year2_data,
    year1_user_name: comparison.year1_data.user_name || null,
    year2_user_name: comparison.year2_data.user_name || null,
    year1_hydrated_data: comparison.year1_hydrated_data || null,
    year2_hydrated_data: comparison.year2_hydrated_data || null,
    created_at: comparison.created_at,
    views: comparison.views + 1,
  };
}

// Initialize database schema (base tables only)
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
  console.log("Database schema initialized");
  
  // Run migrations for any schema changes
  const { runMigrations } = await import("./migrations.js");
  await runMigrations();
}
