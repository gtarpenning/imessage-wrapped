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
- `ADMIN_KEY` - Optional, for admin dashboard authentication

## Admin Dashboard

Access aggregated statistics for all wraps at `/admin/wraps`.

Features:
- **Overview**: Total wraps, views, and averages
- **Volume**: Message counts, busiest days across all wraps
- **Temporal**: Hourly/daily/monthly histograms, weekday vs weekend averages
- **Contacts**: Distribution charts, unique contact stats
- **Content**: Top emojis, attachments, double texts, word count distributions
- **Sentiment**: Aggregated sentiment analysis scores
- **Message Length**: Distribution histograms and statistics
- **Conversations**: Total conversations, longest conversations
- **Ghosts**: Ghost statistics across all users
- **Response Times**: Average and median response times
- **Tapbacks**: Distribution by type (❤️ 👍 😂 ❗ 👎 ❓)
- **Streaks**: Longest and current streak statistics
- **All Wraps Table**: Complete list with links to individual wraps

All statistics show min, max, avg, median, and total across all wraps. Visual charts use histograms and gradients from the `lib/histogram.js` and `lib/pieChart.js` utilities.

To enable authentication, set the `ADMIN_KEY` environment variable. Access requires Bearer token authentication.
  
## Structure

- `app/` - Next.js App Router pages and API routes
  - `app/admin/wraps/` - Admin dashboard
  - `app/api/admin/wraps/` - Admin API endpoint
- `components/` - React components for visualizations
- `lib/` - Database, privacy, and rate limiting utilities
- `public/` - Static assets
- `scripts/` - Deployment and testing scripts
