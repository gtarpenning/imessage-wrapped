# Web App

Next.js dashboard for viewing iMessage Wrapped statistics.

## Quick Start

```bash
npm install
npm run dev
```

Visit: http://localhost:3000

## Deploy

```bash
fly deploy
```

See [../RELEASE-GUIDE.md](../RELEASE-GUIDE.md) for quick deployment reference.

See [DEPLOY.md](DEPLOY.md) for complete Fly.io setup guide.

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-set by Fly.io)
- `BASE_URL` - Your app's public URL
- `OPENAI_API_KEY` - Optional, for AI features

## Structure

- `app/` - Next.js App Router pages and API routes
- `components/` - React components for visualizations
- `lib/` - Database, privacy, and rate limiting utilities
- `public/` - Static assets
- `scripts/` - Deployment and testing scripts
