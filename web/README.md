# iMessage Wrapped - Web Dashboard

Beautiful, shareable dashboards for your iMessage statistics.

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp env.example .env.local
# Edit .env.local: Set DATABASE_URL

# Initialize database (if using Postgres)
npm run init-db

# Start server
npm run dev
```

Visit http://localhost:3000

## Requirements

- Node.js 18+
- Database: PostgreSQL or SQLite
  - PostgreSQL: Better for production
  - SQLite: Simpler for local testing

## Environment Setup

### SQLite (Easiest)

```bash
# .env.local
DATABASE_URL=sqlite:///./wrapped.db
BASE_URL=http://localhost:3000
```

Database file created automatically.

### PostgreSQL (Production)

```bash
# Install Postgres
brew install postgresql
brew services start postgresql

# Create database
createdb imessage_wrapped

# .env.local
DATABASE_URL=postgresql://localhost:5432/imessage_wrapped
BASE_URL=http://localhost:3000

# Initialize schema
npm run init-db
```

## Testing

### Test API Endpoints

```bash
# Make sure server is running first
npm run dev

# In another terminal:
./scripts/test-api.sh
```

### Test Full Flow

```bash
./scripts/test-full-flow.sh
```

This tests health checks, upload, fetch, and PII sanitization.

## API Endpoints

### POST `/api/upload`

Upload wrapped statistics and get shareable link.

**Request:**
```json
{
  "year": 2025,
  "statistics": {
    "volume": {...},
    "contacts": {...},
    "temporal": {...}
  }
}
```

**Response:**
```json
{
  "id": "abc123xyz",
  "url": "http://localhost:3000/2025/abc123xyz",
  "year": 2025
}
```

**Rate Limit:** 5 uploads per hour per IP

### GET `/api/wrapped/[year]/[id]`

Fetch wrapped statistics by ID.

**Response:**
```json
{
  "id": "abc123xyz",
  "year": 2025,
  "statistics": {...},
  "created_at": "2025-12-25T10:00:00Z",
  "views": 42
}
```

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-25T10:00:00Z"
}
```

## Security Features

### Data Privacy
- No PII stored (phone numbers and emails are one-way hashed)
- No message content stored (only aggregate statistics)
- Automatic sanitization before storage

### Network Security
- HTTPS enforced in production
- CORS configured
- Rate limiting

### Database Security
- Parameterized queries (SQL injection protection)
- SSL connections required for production
- Encrypted at rest

## Deployment

See [DEPLOY.md](DEPLOY.md) for complete deployment guide.

**Quick Fly.io deployment:**

```bash
# Install Fly CLI
brew install flyctl
fly auth login

# Create app
fly launch --name imessage-wrapped --region lax --no-deploy --no-db --copy-config -y

# Create database
fly postgres create \
  --name imessage-wrapped-db \
  --region lax \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1
fly postgres attach imessage-wrapped-db --app imessage-wrapped

# Set secrets
fly secrets set BASE_URL="https://imessage-wrapped.fly.dev" -a imessage-wrapped
fly secrets set OPENAI_API_KEY="sk-..." -a imessage-wrapped  # Optional

# Deploy
fly deploy

# Initialize database
fly ssh console -a imessage-wrapped -C "node scripts/init-db.js"

# Test
curl https://imessage-wrapped.fly.dev/api/health
```

## Project Structure

```
web/
├── app/
│   ├── api/
│   │   ├── upload/route.js              # POST: Upload stats
│   │   ├── wrapped/[year]/[id]/route.js # GET: Fetch stats
│   │   └── health/route.js              # GET: Health check
│   ├── [year]/[id]/page.js              # Dashboard UI
│   ├── page.js                          # Landing page
│   ├── layout.js                        # Root layout
│   └── globals.css                      # Global styles
├── lib/
│   ├── db.js                            # Database queries
│   ├── privacy.js                       # PII sanitization
│   └── rateLimit.js                     # Rate limiting
├── scripts/
│   ├── init-db.js                       # Initialize schema
│   ├── setup-local.sh                   # Quick setup
│   ├── test-api.sh                      # Test endpoints
│   └── test-full-flow.sh                # Integration test
├── server.js                            # Custom Node server
├── fly.toml                             # Fly.io config
└── package.json                         # Dependencies
```

## Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run init-db    # Initialize database schema
```

### Adding Features

- **New API Endpoint**: Add to `app/api/`
- **New Page**: Add to `app/`
- **New Utility**: Add to `lib/`
- **New Style**: Edit `app/globals.css`

## Troubleshooting

### Database connection failed

```bash
# Check Postgres is running
brew services list | grep postgresql

# Or use SQLite instead
echo "DATABASE_URL=sqlite:///./wrapped.db" > .env.local
```

### Module not found

```bash
rm -rf node_modules package-lock.json
npm install
```

### Port 3000 already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Upload failed from CLI

```bash
# For local development
cd web && npm run dev
imexport analyze --share --server-url http://localhost:3000

# For production
imexport analyze --share --server-url https://imessage-wrapped.fly.dev
```

## Database Schema

```sql
CREATE TABLE wrapped_stats (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  views INTEGER DEFAULT 0
);

CREATE INDEX idx_year ON wrapped_stats(year);
CREATE INDEX idx_created_at ON wrapped_stats(created_at);
```

## Cost Estimates

### Local Development
- Cost: Free
- Database: SQLite or local Postgres

### Fly.io (Hobby)
- Cost: $1-3/month
- Includes: 2x app VMs (auto-stop), 1GB Postgres, 160GB bandwidth
- Good for: Personal use, light traffic

### Fly.io (Production)
- Cost: $10-20/month
- Includes: More VMs, storage, bandwidth
- Good for: Higher traffic

## Documentation

- [DEPLOY.md](DEPLOY.md) - Complete deployment guide
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture

## License

See parent project LICENSE file.
