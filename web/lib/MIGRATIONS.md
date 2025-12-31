# Database Migrations

This project uses a simple, principled migration system to manage database schema changes over time.

## How It Works

1. **Migrations Table**: A `schema_migrations` table tracks which migrations have been applied
2. **Migration Files**: All migrations are defined in `lib/migrations.js`
3. **Automatic Execution**: Migrations run automatically when the server starts
4. **Idempotent**: Each migration can be run multiple times safely
5. **Transactional**: Migrations run in a transaction and roll back on failure

## Adding a New Migration

To add a new migration, edit `lib/migrations.js` and add a new entry to the `migrations` array:

```javascript
{
  id: 2,  // Increment from the last migration
  name: "add_new_feature",
  up: async (client) => {
    // Your migration code here
    await client.query(`
      ALTER TABLE wrapped_stats 
      ADD COLUMN IF NOT EXISTS new_column TEXT
    `);
  },
},
```

**Important Rules:**
- Always increment the `id` sequentially (never skip numbers)
- Give migrations descriptive names in snake_case
- Use `IF NOT EXISTS` / `IF EXISTS` to make migrations idempotent
- Never modify existing migrations that have been deployed
- Test migrations locally before deploying

## Running Migrations

### Automatic (Recommended)
Migrations run automatically when you start the server:

```bash
node server.js
# or
npm run dev
```

### Manual
You can also run migrations manually:

```bash
node scripts/migrate-add-metadata.js
```

This is useful for:
- Testing migrations before deploying
- Running migrations in CI/CD pipelines
- Troubleshooting migration issues

## Migration Status

To check which migrations have been applied, the script shows the current status:

```
Current migration status:
  ✓ 1: add_metadata_column
  ○ 2: add_new_feature
```

## Example Migrations

### Adding a Column
```javascript
{
  id: 2,
  name: "add_feature_flag",
  up: async (client) => {
    await client.query(`
      ALTER TABLE wrapped_stats 
      ADD COLUMN IF NOT EXISTS feature_enabled BOOLEAN DEFAULT false
    `);
  },
}
```

### Creating a New Table
```javascript
{
  id: 3,
  name: "create_user_preferences",
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        preferences JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
      ON user_preferences(user_id)
    `);
  },
}
```

### Adding an Index
```javascript
{
  id: 4,
  name: "add_index_on_year_views",
  up: async (client) => {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_year_views 
      ON wrapped_stats(year, views)
    `);
  },
}
```

## Troubleshooting

### Migration Failed
If a migration fails:
1. Check the error message in the console
2. The migration is rolled back automatically (transaction safety)
3. Fix the migration code
4. Restart the server or run migrations manually

### Migration Already Applied
The system tracks applied migrations, so running migrations multiple times is safe. Already-applied migrations are skipped.

### Resetting Migrations (Development Only)
**Warning: This will delete all data!**

To reset your local database:
```sql
DROP TABLE schema_migrations CASCADE;
DROP TABLE wrapped_stats CASCADE;
DROP TABLE llm_cache CASCADE;
DROP TABLE wrapped_comparisons CASCADE;
```

Then restart the server to recreate everything from scratch.

## Deployment

When deploying:
1. Migrations run automatically when the server starts
2. If migrations fail, the server logs the error but continues
3. Check deployment logs to verify migrations succeeded
4. For critical migrations, consider running them manually before deploying

## Best Practices

1. **Keep migrations small**: One logical change per migration
2. **Test locally first**: Always test migrations on local database before deploying
3. **Make them reversible**: Consider what happens if you need to rollback
4. **Document complex changes**: Add comments explaining why a migration exists
5. **Use transactions**: The system handles this, but be aware each migration is atomic
6. **Handle data carefully**: When changing columns, consider existing data

