# Deploy to Fly.io - Complete Guide

## ⚠️ Important: Avoid the $38/month Database Trap

**DO NOT** let `fly launch` automatically create a database - it defaults to the expensive Managed Postgres ($38/month). 

**Instead:** Follow this guide to create a development database for ~$1-2/month.

## Prerequisites

- Fly.io account (free tier available)
- `flyctl` CLI installed
- Code ready to deploy

## Step-by-Step Deployment

### 1. Install Fly CLI

```bash
# macOS
brew install flyctl
```

### 2. Login to Fly.io

```bash
fly auth login
```

This opens your browser for authentication.

### 3. Create Your App

```bash
cd web
fly launch --name imessage-wrapped --region lax --no-deploy --no-db --copy-config -y
```

**Options:**
- `--name`: Your app name (must be unique globally)
- `--region`: Closest to you (use `fly platform regions` to list all)
- `--no-deploy`: Don't deploy yet, we need to setup database first
- `--no-db`: Skip automatic database creation (we'll create a cheaper one manually)
- `--copy-config`: Use existing fly.toml without prompting
- `-y`: Auto-confirm to avoid interactive prompts

This creates the app using `fly.toml` (already included in repo).

### 4. Create PostgreSQL Database

```bash
# Create database cluster (CHEAP OPTION: ~$1-2/month)
fly postgres create \
  --name imessage-wrapped-db \
  --region lax \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1

# Attach to your app (sets DATABASE_URL secret automatically)
fly postgres attach imessage-wrapped-db --app imessage-wrapped
```

**Development Tier Specs:**
- 1 GB storage (volume-size 1)
- Shared CPU (shared-cpu-1x, 256MB RAM)
- Cost: ~$1-2/month
- Perfect for MVP and personal projects

**⚠️ Important:** Don't use `fly launch` with automatic database creation - it defaults to the $38/month managed plan. Always create the database manually with these flags for the cheap option.

### 5. Initialize Database Schema

```bash
# SSH into your app
fly ssh console -a imessage-wrapped

# Run initialization script
node scripts/init-db.js

# Exit SSH
exit
```

Or manually:
```bash
fly postgres connect -a imessage-wrapped-db

CREATE TABLE wrapped_stats (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  views INTEGER DEFAULT 0
);

CREATE INDEX idx_year ON wrapped_stats(year);
CREATE INDEX idx_created_at ON wrapped_stats(created_at);

\q
```

### 6. Set Secrets

```bash
# Required: Your app's public URL
fly secrets set BASE_URL="https://imessage-wrapped.fly.dev" -a imessage-wrapped

# Optional: OpenAI API key (for future AI features)
fly secrets set OPENAI_API_KEY="sk-proj-..." -a imessage-wrapped
```

**Security Note:** Secrets are encrypted at rest and never logged.

### 7. Deploy!

```bash
fly deploy
```

This builds and deploys your app. First deploy takes ~2-3 minutes.

### 8. Verify Deployment

```bash
# Check status
fly status

# View logs
fly logs

# Open in browser
fly open

# Test health endpoint
curl https://imessage-wrapped.fly.dev/api/health
```

## Using Your Production Server

Once deployed, update your local CLI to use production instead of localhost:

```bash
# Use your production server
mexport analyze --share --server-url https://imessage-wrapped.fly.dev

# Or set as environment variable (so you don't have to type it each time)
export IMESSAGE_SERVER_URL="https://imessage-wrapped.fly.dev"
mexport analyze --share --server-url $IMESSAGE_SERVER_URL

# Or add to your shell config (~/.zshrc or ~/.bashrc)
echo 'export IMESSAGE_SERVER_URL="https://imessage-wrapped.fly.dev"' >> ~/.zshrc
```

**Replace** `imessage-wrapped.fly.dev` with your actual app URL.

## Scaling & Performance

### Add More Regions

```bash
# Add machines in multiple regions
fly scale count 3 --region lax,dfw,iad
```

### Auto-Start/Stop (Save Money)

```bash
# Machines auto-stop when idle
fly scale count 1 --max-per-region 2
```

Your app will automatically:
- Stop after 5 minutes of inactivity
- Start on first request (~2 seconds cold start)
- Scale up during traffic spikes

### Upgrade Resources

```bash
# More memory (if needed)
fly scale memory 2048 -a imessage-wrapped

# More CPU
fly scale vm shared-cpu-2x -a imessage-wrapped
```

## Monitoring

### View Logs

```bash
# Real-time logs
fly logs -a imessage-wrapped

# Follow logs
fly logs -a imessage-wrapped -f
```

### Check Database

```bash
# Connect to database
fly postgres connect -a imessage-wrapped-db

# Check stats
SELECT COUNT(*) FROM wrapped_stats;
SELECT year, COUNT(*) FROM wrapped_stats GROUP BY year;
\q
```

### Monitor Usage

```bash
# App dashboard (opens browser)
fly dashboard -a imessage-wrapped

# Database dashboard
fly dashboard -a imessage-wrapped-db
```

## Debugging

### SSH into App

```bash
fly ssh console -a imessage-wrapped

# Check environment
env | grep DATABASE_URL

# Test database connection
node -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});p.query('SELECT 1').then(()=>console.log('✓ DB connected')).catch(e=>console.error('✗',e))"

exit
```

### Common Issues

**"No machines in group app"**
```bash
fly scale count 1
```

**"Database connection failed"**
```bash
# Check database is attached
fly postgres list
fly secrets list | grep DATABASE_URL

# Re-attach if needed
fly postgres attach imessage-wrapped-db
```

**"502 Bad Gateway"**
```bash
# Check logs
fly logs

# Restart app
fly apps restart imessage-wrapped
```

## Security Checklist

Before going public:

- [ ] Secrets set (BASE_URL, OPENAI_API_KEY)
- [ ] Database attached and initialized
- [ ] HTTPS working (automatic via Fly.io)
- [ ] Rate limiting active (check `lib/rateLimit.js`)
- [ ] Test upload with real data
- [ ] Verify PII sanitization working
- [ ] Check error handling (try invalid requests)

## Cost Estimation

**Development Setup (Recommended):**
- App VMs: 2x shared-cpu-1x (auto-stop when idle)
  - **Cost: $0-2/month** (mostly free with auto-stop)
- Postgres Development: 1GB storage, shared-cpu-1x (256MB RAM)
  - **Cost: ~$1-2/month**
- Bandwidth: 160GB/month free tier
  - **Cost: $0** (unless you exceed)

**Total Monthly Cost: ~$1-3/month** for typical personal use

**If You Need More:**
- More storage: ~$0.15/GB/month
- More CPU: shared-cpu-2x ~$4-5/month
- Managed Postgres: $38/month (avoid unless you need HA & support)

**Cost by Usage:**
- **0-100 users/month**: $1-3/month
- **100-1K users/month**: $3-8/month
- **1K-10K users/month**: $10-20/month

## Updating Your App

```bash
# Pull latest code
cd web
git pull

# Deploy
fly deploy

# Check deployment
fly logs
```

## Backup & Recovery

### Backup Database

```bash
# Manual backup
fly postgres connect -a imessage-wrapped-db
pg_dump > backup.sql
\q

# Or use Fly's automated backups (paid feature)
```

### Restore from Backup

```bash
fly postgres connect -a imessage-wrapped-db < backup.sql
```

## Custom Domain (Optional)

### Add Your Domain

```bash
# Add domain
fly certs create wrapped.yourdomain.com -a imessage-wrapped

# Get DNS records
fly certs show wrapped.yourdomain.com -a imessage-wrapped
```

Add the provided DNS records to your domain registrar.

### Update Secrets

```bash
fly secrets set BASE_URL="https://wrapped.yourdomain.com"
```

## Cleanup & Teardown

### Delete App

```bash
fly apps destroy imessage-wrapped --yes
```

### Delete Database

```bash
fly apps destroy imessage-wrapped-db --yes
```

## Support

- **Fly.io Docs**: https://fly.io/docs
- **Community Forum**: https://community.fly.io
- **Status**: https://status.fly.io

## Next Steps

1. ✅ Deploy to production
2. Test with real data
3. Share with friends
4. Monitor usage
5. Iterate and improve!

---

**Your app will be available at:**
https://imessage-wrapped.fly.dev (or your custom domain)

**Production command:**
```bash
imessage-wrapped analyze --share --server-url https://imessage-wrapped.fly.dev
```

🎉 **You're live!**

