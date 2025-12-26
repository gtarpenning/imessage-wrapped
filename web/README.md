# iMessage Wrapped - Web Dashboard

Beautiful, shareable dashboards for your iMessage statistics.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp env.example .env.local
# Edit .env.local: Set DATABASE_URL

# 3. Initialize database (if using Postgres)
npm run init-db

# 4. Start server
npm run dev
```

Visit http://localhost:3000

## 📋 Requirements

- **Node.js** 18+ 
- **Database**: PostgreSQL or SQLite
  - PostgreSQL: Better for production
  - SQLite: Simpler for local testing

## 🔧 Environment Setup

### Option 1: SQLite (Easiest)

```bash
# .env.local
DATABASE_URL=sqlite:///./wrapped.db
BASE_URL=http://localhost:3000
```

No additional setup needed! Database file created automatically.

### Option 2: PostgreSQL (Production-ready)

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

## 🧪 Testing

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

This tests:
- ✅ Health check
- ✅ Upload statistics
- ✅ Fetch by ID
- ✅ PII sanitization

## 📡 API Endpoints

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

## 🔐 Security Features

### Data Privacy
- ✅ **No PII Stored**: Phone numbers and emails are one-way hashed
- ✅ **No Message Content**: Only aggregate statistics
- ✅ **Automatic Sanitization**: Recursive PII scanning before storage

### Network Security
- ✅ **HTTPS Only**: Forced in production (automatic on Fly.io)
- ✅ **CORS Configured**: Restricts API access
- ✅ **Rate Limiting**: Prevents abuse

### Database Security
- ✅ **Parameterized Queries**: SQL injection protection
- ✅ **SSL Connections**: Required for production databases
- ✅ **Encrypted at Rest**: Fly.io Postgres has disk encryption

## 🚀 Deploy to Fly.io

See [DEPLOY.md](DEPLOY.md) for complete deployment guide.

**Quick version:**

```bash
# 1. Install Fly CLI
brew install flyctl
fly auth login

# 2. Create app (without expensive auto-database)
fly launch --name imessage-wrapped --region lax --no-deploy --no-db --copy-config -y

# 3. Create database (CHEAP: ~$1-2/month)
fly postgres create \
  --name imessage-wrapped-db \
  --region lax \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1
fly postgres attach imessage-wrapped-db --app imessage-wrapped

# 4. Set secrets
fly secrets set BASE_URL="https://imessage-wrapped.fly.dev" -a imessage-wrapped
fly secrets set OPENAI_API_KEY="sk-..." -a imessage-wrapped  # Optional

# 5. Deploy
fly deploy

# 6. Initialize database
fly ssh console -a imessage-wrapped -C "node scripts/init-db.js"

# 7. Test
curl https://imessage-wrapped.fly.dev/api/health
```

## 📁 Project Structure

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
├── package.json                         # Dependencies
└── README.md                            # This file
```

## 🛠️ Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run init-db    # Initialize database schema
```

### Adding New Features

1. **New API Endpoint**: Add to `app/api/`
2. **New Page**: Add to `app/`
3. **New Utility**: Add to `lib/`
4. **New Style**: Edit `app/globals.css`

### Code Style

- Use **functional components** (React)
- Use **async/await** (not callbacks)
- **Comment** complex logic
- **Error handling** on all async operations

## 🐛 Troubleshooting

### "Database connection failed"

```bash
# Check Postgres is running
brew services list | grep postgresql

# Or use SQLite instead
echo "DATABASE_URL=sqlite:///./wrapped.db" > .env.local
```

### "Module not found"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "Port 3000 already in use"

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### "Upload failed" from CLI

```bash
# For local development - make sure server is running
cd web && npm run dev
mexport analyze --share --server-url http://localhost:3000

# For production - use your Fly.io URL
mexport analyze --share --server-url https://imessage-wrapped.fly.dev
```

## 📊 Database Schema

```sql
CREATE TABLE wrapped_stats (
  id TEXT PRIMARY KEY,           -- Random 12-char ID
  year INTEGER NOT NULL,         -- Year of wrapped
  data JSONB NOT NULL,           -- Anonymized statistics
  created_at TIMESTAMP DEFAULT NOW(),
  views INTEGER DEFAULT 0        -- View counter
);

CREATE INDEX idx_year ON wrapped_stats(year);
CREATE INDEX idx_created_at ON wrapped_stats(created_at);
```

## 🎨 Customization

### Change Colors

Edit `app/globals.css`:

```css
.gradient-text {
  background: linear-gradient(135deg, #your-color 0%, #your-color 100%);
}
```

### Add New Dashboard Section

Edit `app/[year]/[id]/page.js`:

```javascript
{stats.your_new_section && (
  <div className="section">
    <h2 className="section-title">Your New Section</h2>
    {/* Your content here */}
  </div>
)}
```

### Modify Privacy Rules

Edit `lib/privacy.js`:

```javascript
export function sanitizeStatistics(statistics) {
  // Add your custom sanitization logic
}
```

## 💰 Cost Estimates

### Local Development
- **Cost**: $0/month
- **Database**: SQLite (free) or local Postgres

### Fly.io Development Setup (Recommended)
- **Cost**: ~$1-3/month
- **Includes**: 
  - 2x app VMs (auto-stop when idle)
  - 1GB Postgres (shared-cpu-1x)
  - 160GB bandwidth
- **Perfect for**: Personal use, 0-1K users/month

### Fly.io Production
- **Cost**: $10-20/month
- **Includes**: More VMs, storage, bandwidth
- **Perfect for**: 1K-10K users/month

**⚠️ Avoid**: Managed Postgres ($38/month) - only needed for high-availability production apps

## 📚 Additional Documentation

- **[DEPLOY.md](DEPLOY.md)** - Complete Fly.io deployment guide
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Command cheat sheet
- **[../QUICKSTART.md](../QUICKSTART.md)** - Overall project quick start
- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** - System architecture

## 🤝 Contributing

1. Keep code simple and readable
2. Add comments for complex logic
3. Test before committing
4. Follow existing code style

## 📝 License

See parent project LICENSE file.

## 🆘 Support

- **Issues**: Check troubleshooting section above
- **Fly.io Docs**: https://fly.io/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Ready to deploy?** Follow [DEPLOY.md](DEPLOY.md)

**Need help?** Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

