# System Architecture

## Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User's Mac (Local)                         │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐                     │
│  │  iMessage DB     │───▶│  Python CLI      │                     │
│  │  (chat.db)       │    │  (mexport)       │                     │
│  └──────────────────┘    └────────┬─────────┘                     │
│                                    │                               │
│                                    │ 1. Export                     │
│                                    ▼                               │
│                          ┌──────────────────┐                      │
│                          │  JSONL File      │                      │
│                          │  (exports/)      │                      │
│                          └────────┬─────────┘                      │
│                                   │                                │
│                                   │ 2. Analyze                     │
│                                   ▼                                │
│                          ┌──────────────────┐                      │
│                          │  Statistics      │                      │
│                          │  (in memory)     │                      │
│                          └────────┬─────────┘                      │
│                                   │                                │
│                                   │ 3. Sanitize & Upload (--share) │
└───────────────────────────────────┼────────────────────────────────┘
                                    │
                                    │ HTTPS POST
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Web Server (Fly.io)                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    Next.js Application                       │ │
│  │                                                              │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │ │
│  │  │  API Routes    │  │  React Pages   │  │  Server.js    │ │ │
│  │  │                │  │                │  │  (Custom)     │ │ │
│  │  │  /api/upload   │  │  /[year]/[id]  │  │  Port: 3000   │ │ │
│  │  │  /api/wrapped  │  │  Dashboard UI  │  │               │ │ │
│  │  └───────┬────────┘  └────────┬───────┘  └───────────────┘ │ │
│  │          │                    │                             │ │
│  │          │                    │                             │ │
│  │  ┌───────▼────────────────────▼───────────────────────────┐ │ │
│  │  │              Middleware Layer                          │ │ │
│  │  │  • Rate Limiting (5/hour)                             │ │ │
│  │  │  • PII Sanitization                                   │ │ │
│  │  │  • Error Handling                                     │ │ │
│  │  └────────────────────┬──────────────────────────────────┘ │ │
│  └─────────────────────────┼────────────────────────────────────┘ │
│                            │                                       │
│                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                PostgreSQL Database                           │ │
│  │  • Encrypted at rest                                         │ │
│  │  • SSL connections                                           │ │
│  │  • JSONB storage                                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS GET
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     User's Browser (Viewer)                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                  Interactive Dashboard                       │ │
│  │  • Message counts with animations                            │ │
│  │  • Time patterns visualization                               │ │
│  │  • Top contacts (anonymized)                                 │ │
│  │  • Emoji usage                                               │ │
│  │  • Shareable link                                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Detail

### 1. Export Phase (Local)

```
iMessage DB → Python Reader → Message Models → JSONL Export
~/Library/Messages/chat.db
          ↓
    db_reader.py (SQL queries)
          ↓
    service.py (business logic)
          ↓
    models.py (Message, Conversation)
          ↓
    exporter.py (serialization)
          ↓
    exports/imessage_export_2025.jsonl
```

### 2. Analysis Phase (Local)

```
JSONL File → Loader → Analyzers → Statistics
exports/*.jsonl
          ↓
    loader.py (deserialize)
          ↓
    analyzer.py (compute stats)
          ↓
    displays/terminal.py (render)
          ↓
    Rich Console Output
```

### 3. Upload Phase (Network)

```
Statistics → Sanitize → HTTP POST → API → Database
{volume, contacts, ...}
          ↓
    uploader.py (Python)
          ↓
    privacy.js (remove PII)
          ↓
    db.js (store JSONB)
          ↓
    PostgreSQL (wrapped_stats table)
          ↓
    Return: {id: "abc123", url: "https://..."}
```

### 4. View Phase (Browser)

```
URL → API → Database → React → Dashboard
https://.../2025/abc123
          ↓
    route.js (fetch data)
          ↓
    db.js (query by ID)
          ↓
    page.js (render UI)
          ↓
    Beautiful Dashboard
```

## Security Layers

```
┌─────────────────────────────────────────────────┐
│              Security Architecture              │
└─────────────────────────────────────────────────┘

Layer 1: Transport (TLS/HTTPS)
  ├─ Fly.io automatic SSL
  ├─ Let's Encrypt certificates
  └─ Force HTTPS redirect

Layer 2: Application (Rate Limiting)
  ├─ 5 uploads/hour per IP
  ├─ 100 views/minute per IP
  └─ In-memory LRU cache

Layer 3: Data (Sanitization)
  ├─ Remove all message content
  ├─ Hash phone numbers/emails
  ├─ Strip contact names
  └─ Recursive PII scanning

Layer 4: Database (Encryption)
  ├─ Disk encryption (dm-crypt)
  ├─ SSL connections required
  ├─ Parameterized queries
  └─ Minimal permissions

Layer 5: Secrets (Environment)
  ├─ Fly.io encrypted secrets
  ├─ No hardcoded keys
  └─ .env.local gitignored
```

## Component Responsibilities

### Python CLI (`src/imessage_wrapped/`)

```
cli.py
  ├─ Command parsing
  ├─ User interaction
  └─ Orchestration

uploader.py
  ├─ HTTP client
  ├─ Upload logic
  └─ Error handling

analyzer.py
  ├─ Statistics computation
  ├─ Raw stats (counts, patterns)
  └─ Display formatting

service.py
  ├─ Database reading
  ├─ Message processing
  └─ Export coordination
```

### Web Server (`web/`)

```
app/api/
  ├─ upload/route.js      (POST /api/upload)
  ├─ wrapped/.../route.js (GET /api/wrapped/:year/:id)
  └─ health/route.js      (GET /api/health)

app/[year]/[id]/
  └─ page.js              (React dashboard)

lib/
  ├─ db.js                (Database queries)
  ├─ privacy.js           (PII sanitization)
  └─ rateLimit.js         (Rate limiting)

server.js
  └─ Custom Node.js server (for Fly.io)
```

## Database Schema

```sql
┌─────────────────────────────────────────┐
│          wrapped_stats table            │
├─────────────────────────────────────────┤
│ id             TEXT PRIMARY KEY         │  ← Random 12-char ID
│ year           INTEGER NOT NULL         │  ← Year of wrapped
│ data           JSONB NOT NULL           │  ← All statistics
│ created_at     TIMESTAMP                │  ← When created
│ views          INTEGER DEFAULT 0        │  ← View counter
└─────────────────────────────────────────┘
         │
         ├─ INDEX idx_year (year)
         └─ INDEX idx_created_at (created_at)

Example data JSONB structure:
{
  "volume": {
    "messages_sent": 10000,
    "messages_received": 15000,
    "busiest_day": {...}
  },
  "contacts": {
    "most_messaged": [
      {"identifier": "phone_a7f2c9", "count": 500}
    ]
  },
  "temporal": {...},
  "content": {...}
}
```

## Deployment Topology

### Development (Local)

```
┌──────────────┐     ┌──────────────┐
│  PostgreSQL  │────▶│  Next.js     │
│  localhost   │     │  :3000       │
└──────────────┘     └──────────────┘
        ↑                    ↑
        │                    │
    Python CLI          Browser
```

### Production (Fly.io)

```
┌─────────────────────────────────────────┐
│           Fly.io Network                │
│                                         │
│  ┌──────────────┐   ┌──────────────┐  │
│  │  Postgres    │──▶│  Next.js App │  │
│  │  (Internal)  │   │  (Public)    │  │
│  └──────────────┘   └──────┬───────┘  │
│                             │           │
└─────────────────────────────┼──────────┘
                              │
                          ┌───▼──────┐
                          │  Users   │
                          │  HTTPS   │
                          └──────────┘
```

## Performance Characteristics

```
Operation                 Time        Notes
─────────────────────────────────────────────────
Export 10K messages       2-5s        Local DB read
Analyze 10K messages      1-3s        Pure computation
Upload statistics         100-500ms   Network + DB write
Dashboard load            200-800ms   DB query + render
Cold start (Fly.io)       ~2s         Auto-wake from sleep
```

## Technology Stack

```
┌──────────────────┐  ┌──────────────────┐
│     Backend      │  │     Frontend     │
├──────────────────┤  ├──────────────────┤
│ Python 3.10+     │  │ Next.js 14       │
│ Rich (terminal)  │  │ React 18         │
│ Requests (HTTP)  │  │ Recharts (viz)   │
└──────────────────┘  └──────────────────┘
         │                     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │    Infrastructure   │
         ├─────────────────────┤
         │ Node.js 20          │
         │ PostgreSQL 14       │
         │ Fly.io (hosting)    │
         └─────────────────────┘
```

## Scalability Plan

```
Stage        Users/Month    Infrastructure           Cost/Month
────────────────────────────────────────────────────────────────
MVP          0-100          1 VM, 1 DB (free)        $0
Growth       100-1K         1-2 VMs, 1 DB           $2-5
Scale        1K-10K         3-5 VMs, 1 DB           $10-20
Enterprise   10K+           Multi-region, replicas   $50+
```

## Monitoring & Observability

```
Logs                    Fly.io built-in logging
  ├─ Application logs (stdout/stderr)
  ├─ Database logs
  └─ Real-time streaming via `fly logs`

Metrics                 Database queries
  ├─ Total wraps created (COUNT)
  ├─ Views per wrap (views column)
  └─ Popular years (GROUP BY year)

Alerts                  Manual (future: automated)
  ├─ Database size threshold
  ├─ Error rate spike
  └─ Rate limit hits
```

---

**This architecture is designed to be:**
- ✅ Simple to understand
- ✅ Easy to deploy
- ✅ Secure by default
- ✅ Scalable when needed
- ✅ Cost-effective for MVPs

