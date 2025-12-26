# iMessage Wrapped Architecture

## Three Distribution Modes

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTION MODES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CLI Package (imexport)          PyPI → pip install          │
│     └─ Python 3.10+ required                                    │
│                                                                 │
│  2. Desktop App (iMessage Wrapped)  GitHub Releases             │
│     └─ Standalone .dmg (py2app)                                 │
│     └─ Menu bar app (rumps)                                     │
│                                                                 │
│  3. Web Dashboard                   Fly.io → Next.js            │
│     └─ Shareable wrapped URLs                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Complete System Flow

```
┌─────────────────────────── LOCAL (macOS) ──────────────────────────┐
│                                                                    │
│  iMessage DB              Python Core Package                      │
│  ~/Library/Messages/      (src/imessage_wrapped/)                  │
│  chat.db                                                           │
│     │                     ┌──────────────────────────┐             │
│     │                     │  db_reader.py            │             │
│     └────────────────────▶│  • SQLite queries        │             │
│                           │  • Batch fetching        │             │
│                           │  • Apple timestamp conv  │             │
│                           └─────────┬────────────────┘             │
│                                     │                              │
│                           ┌─────────▼────────────────┐             │
│                           │  service.py              │             │
│                           │  • MessageProcessor      │             │
│                           │  • Conversation builder  │             │
│                           │  • Tapback association   │             │
│                           └─────────┬────────────────┘             │
│                                     │                              │
│                           ┌─────────▼────────────────┐             │
│                           │  exporter.py             │             │
│                           │  • JSON/JSONL serialize  │             │
│                           │  • File writer           │             │
│                           └─────────┬────────────────┘             │
│                                     │                              │
│                           ┌─────────▼────────────────┐             │
│                           │  exports/                │             │
│                           │  imessage_export_*.jsonl │             │
│                           └─────────┬────────────────┘             │
│                                     │                              │
│                           ┌─────────▼────────────────┐             │
│                           │  loader.py               │             │
│                           │  • Deserialize JSONL     │             │
│                           │  • Rebuild models        │             │
│                           └─────────┬────────────────┘             │
│                                     │                              │
│                           ┌─────────▼────────────────┐             │
│                           │  analyzer.py             │             │
│                           │  • Volume stats          │             │
│                           │  • Temporal patterns     │             │
│                           │  • Contact analytics     │             │
│                           │  • Content analysis      │             │
│                           │  • Response times        │             │
│                           │  • Tapback distribution  │             │
│                           │  • Streak detection      │             │
│                           └─────────┬────────────────┘             │
│                                     │                              │
│                  ┌──────────────────┴──────────────────┐           │
│                  │                                      │          │
│          Terminal Display                      Web Upload          │
│          (displays/terminal.py)                (uploader.py)       │
│          • Rich tables/panels                  • Sanitize stats    │
│          • Brief/full modes                    • POST to server    │
│                                                 • Return share URL │
│                                                         │          │
└─────────────────────────────────────────────────────────┼──────────┘
                                                          │
                                            HTTPS POST /api/upload
                                                          │
┌───────────────────────────── CLOUD (Fly.io) ───────────▼──────────┐
│                                                                   │
│  Next.js Web App (web/)                                           │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐           │
│  │  API Routes (app/api/)                             │           │
│  │  ┌────────────────┐  ┌──────────────────────────┐  │           │
│  │  │ /upload        │  │ /wrapped/[year]/[id]     │  │           │
│  │  │ • Rate limit   │  │ • Fetch from DB          │  │           │
│  │  │ • Sanitize     │  │ • Increment views        │  │           │
│  │  │ • Store JSONB  │  │ • Return stats           │  │           │
│  │  │ • Return URL   │  │                          │  │           │
│  │  └────────┬───────┘  └───────────┬──────────────┘  │           │
│  └───────────┼──────────────────────┼─────────────────┘           │
│              │                      │                             │
│  ┌───────────▼──────────────────────▼─────────────────┐           │
│  │  Middleware Layer                                  │           │
│  │  • lib/rateLimit.js (in-memory LRU, 5/hr)          │           │
│  │  • lib/privacy.js (recursive PII scanner)          │           │
│  │  • lib/db.js (PostgreSQL pool)                     │           │
│  └──────────────────────────┬─────────────────────────┘           │
│                             │                                     │
│  ┌──────────────────────────▼──────────────────────────┐          │
│  │  PostgreSQL Database                                │          │
│  │  wrapped_stats (id, year, data JSONB, views, ...)   │          │
│  │  • idx_year, idx_created_at                         │          │
│  │  • SSL enforced, encrypted at rest                  │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐           │
│  │  React UI (app/[year]/[id]/page.js)                │           │
│  │  • HeroSection, VolumeSection, HeatmapSection      │           │
│  │  • ContactsSection, TemporalSection                │           │
│  │  • ContentSection, ResponseTimesSection            │           │
│  │  • TapbacksSection, StreaksSection                 │           │
│  │  • Recharts visualizations                         │           │
│  └────────────────────────────────────────────────────┘           │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Core Python Package Structure

```
src/imessage_wrapped/
├── __init__.py          # Package exports
├── __main__.py          # Entry point
├── cli.py               # CLI interface (argparse, subcommands)
├── models.py            # Data classes (Message, Conversation, Tapback)
├── db_reader.py         # SQLite queries, Apple timestamp handling
├── service.py           # MessageProcessor, business logic
├── exporter.py          # JSON/JSONL serializers
├── loader.py            # ExportLoader (deserialize JSONL/JSON)
├── analyzer.py          # RawStatisticsAnalyzer (8 analysis categories)
├── uploader.py          # StatsUploader (HTTP POST to web server)
├── permissions.py       # Full Disk Access checker
├── utils.py             # Apple epoch, tapback mapping, GUID parsing
└── displays/
    ├── base.py          # Abstract Display protocol
    └── terminal.py      # TerminalDisplay (rich tables/panels)
```

## Desktop App Architecture

```
desktop/
├── gui.py               # rumps menu bar app
│   └─ IMessageWrappedApp
│      ├─ Analyze messages (background thread)
│      ├─ Copy link (to clipboard)
│      ├─ View logs (open Console.app)
│      └─ About/Quit
│
├── setup.py             # py2app configuration
│   └─ Bundle: iMessage Wrapped.app
│      ├─ LSUIElement: true (menu bar only)
│      ├─ Packages: imessage_wrapped, rich, rumps, requests
│      └─ Icon: icon.icns
│
├── build.sh             # Development build (alias mode, fast)
├── build-release.sh     # Production build (standalone .dmg)
│   └─ Steps:
│      1. Clean dist/build
│      2. py2app (optimize 2, strip binaries)
│      3. Create DMG with background image
│      4. Symlink /Applications
│      5. Compress DMG (UDZO)
│
├── sign-dmg.sh          # Code signing & notarization
│   └─ codesign → notarytool → staple
│
├── release.py           # Automated release pipeline
│   └─ Version bump → Build → Sign → Publish to GitHub
│
└── publish-release.sh   # GitHub release with gh CLI
```

## Web Server Architecture

```
web/
├── server.js            # Custom Node.js server (Fly.io)
│   └─ Port 3000, handles Next.js requests
│
├── app/
│   ├── api/
│   │   ├── upload/route.js         POST /api/upload
│   │   ├── wrapped/[year]/[id]/    GET /api/wrapped/:year/:id
│   │   ├── health/route.js         GET /api/health
│   │   └── download/route.js       GET /api/download (redirects to DMG)
│   │
│   ├── [year]/[id]/page.js         React dashboard (client-side)
│   └── layout.js, globals.css
│
├── components/          # React visualization components
│   ├── HeroSection.js             (animated title, total messages)
│   ├── VolumeSection.js           (sent/received breakdown)
│   ├── HeatmapSection.js          (daily activity calendar)
│   ├── ContactsSection.js         (top contacts, anonymized)
│   ├── TemporalSection.js         (hour/day/month charts)
│   ├── ContentSection.js          (emoji, length, questions)
│   ├── ConversationsSection.js    (group vs 1:1)
│   ├── ResponseTimesSection.js    (median response times)
│   ├── TapbacksSection.js         (reaction distribution)
│   ├── StreaksSection.js          (longest consecutive days)
│   └── WrappedFooter.js           (view counter, share)
│
├── lib/
│   ├── db.js            # PostgreSQL pool, queries
│   ├── privacy.js       # sanitizeStatistics, anonymizeIdentifier
│   └── rateLimit.js     # In-memory LRU (5 uploads/hr per IP)
│
├── scripts/
│   ├── init-db.js       # CREATE TABLE wrapped_stats
│   └── test-api.sh      # curl tests for API endpoints
│
└── Dockerfile, fly.toml # Fly.io deployment config
```

## Data Models

```python
# models.py
@dataclass
class Message:
    id: int
    guid: str                      # Apple's unique identifier
    timestamp: datetime
    is_from_me: bool
    sender: str                    # "Me" or contact identifier
    text: str | None
    service: str                   # "iMessage" or "SMS"
    has_attachment: bool
    date_read_after_seconds: float | None
    tapbacks: list[Tapback]

@dataclass
class Tapback:
    type: str                      # "love", "like", "dislike", etc.
    by: str                        # "Me" or contact identifier

@dataclass
class Conversation:
    chat_id: int
    chat_identifier: str           # Phone/email
    display_name: str | None
    is_group_chat: bool
    participants: list[str]
    messages: list[Message]

@dataclass
class ExportData:
    export_date: datetime
    year: int
    conversations: dict[str, Conversation]
```

## Analysis Categories

```python
# analyzer.py - RawStatisticsAnalyzer

1. Volume
   • total_messages, total_sent, total_received
   • busiest_day (date, count)
   • daily_activity (heatmap data)
   • active_days

2. Temporal
   • hour_distribution (24-hour)
   • day_of_week_distribution (Mon-Sun)
   • month_distribution (Jan-Dec)
   • busiest_hour, busiest_day_of_week

3. Contacts
   • top_sent_to, top_received_from (top 10)
   • unique_contacts_messaged/received_from
   • social_butterfly_day (most unique contacts messaged)
   • fan_club_day (most unique contacts received from)

4. Content
   • avg_message_length (sent/received)
   • most_used_emojis (top 10)
   • questions_asked, exclamations_sent
   • links_shared, attachments_sent/received
   • double_text_count (messages <5min apart)

5. Conversations
   • total_conversations, group_chats, one_on_one
   • group_vs_1on1_ratio
   • most_active_thread, most_active_group_chat

6. Response Times
   • median_response_time (you vs them)
   • formatted duration strings
   • total_responses count

7. Tapbacks
   • total_tapbacks_given/received
   • favorite_tapback, most_received_tapback
   • tapback_distribution

8. Streaks
   • longest_streak_days (consecutive days)
   • longest_streak_contact
```

## Privacy & Security

```
┌─────────────────────────────────────────────────┐
│              Security Architecture              │
└─────────────────────────────────────────────────┘

Layer 1: Local Privacy (Export Phase)
  • Message text NEVER leaves local machine
  • Database read-only access (SQLite uri mode)
  • Export files stay in local exports/ folder

Layer 2: Upload Privacy (privacy.js)
  • sanitizeStatistics() - recursive PII scanner
  • Remove: name, display_name, message_text, content_samples
  • anonymizeIdentifier() - SHA256 hash contact IDs
    → "+15555551234" becomes "phone_a7f2c9d4e5f6"

Layer 3: Transport Security
  • HTTPS enforced (Fly.io auto-SSL)
  • TLS 1.2+ only
  • Let's Encrypt certificates

Layer 4: Rate Limiting (rateLimit.js)
  • 5 uploads/hour per IP
  • In-memory LRU cache (Map with TTL)
  • 429 response on exceed

Layer 5: Database Security
  • PostgreSQL with SSL required
  • JSONB for flexible stats storage
  • Parameterized queries (SQL injection prevention)
  • No user auth (read-only by ID)

Layer 6: macOS App Security (Desktop)
  • Code signing (Developer ID)
  • Notarization (Apple)
  • Hardened runtime
  • Sandboxed (Full Disk Access required)
```

## Build & Release Pipeline

```
┌────────────────────────────────────────────────────────────────┐
│                   CLI Package (PyPI)                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Makefile targets:                                             │
│  • make bump-patch        → Increment version in pyproject     │
│  • make build             → python -m build (wheel + tar.gz)   │
│  • make upload            → twine upload dist/*                │
│  • make build-upgrade-deploy → All of the above               │
│                                                                │
│  Artifacts:                                                    │
│  • dist/imessage_wrapped-X.Y.Z-py3-none-any.whl               │
│  • dist/imessage_wrapped-X.Y.Z.tar.gz                         │
│                                                                │
│  Entry point: imexport → imessage_wrapped.cli:main            │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│               Desktop App (GitHub Releases)                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  desktop/release.py (automated):                               │
│  1. Version bump (build-release.sh, setup.py)                 │
│  2. Git commit version changes                                │
│  3. ./build-release.sh                                        │
│     └─ py2app → DMG creation                                  │
│  4. ./sign-dmg.sh <dmg>                                       │
│     └─ codesign → notarytool submit → staple                  │
│  5. ./publish-release.sh <version> <dmg>                      │
│     └─ gh release create (GitHub CLI)                         │
│                                                                │
│  Code signing requirements:                                    │
│  • Developer ID Application certificate                        │
│  • Keychain access for notarytool                             │
│  • Apple ID with App-Specific Password                        │
│                                                                │
│  Artifacts:                                                    │
│  • dist/iMessage Wrapped.app (standalone bundle)              │
│  • iMessage-Wrapped-X.Y.Z.dmg (signed & notarized)            │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                  Web App (Fly.io)                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Deployment:                                                   │
│  • fly deploy (from web/ directory)                           │
│  • Dockerfile → Node.js 20 → npm install → npm start          │
│  • Auto-scaling based on traffic                              │
│                                                                │
│  Environment secrets (fly secrets set):                       │
│  • DATABASE_URL=postgresql://...                              │
│  • BASE_URL=https://imessage-wrapped.fly.dev                  │
│                                                                │
│  Database setup:                                               │
│  • npm run init-db (runs scripts/init-db.js)                  │
│  • Creates wrapped_stats table + indexes                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Database Schemas

### Local: iMessage DB (SQLite, Read-Only)

```sql
-- ~/Library/Messages/chat.db (macOS system database)

message
  • ROWID (int)
  • guid (text)              -- e.g. "p:0/A7B8C9D0-E1F2..."
  • text (text)              -- Plain message text
  • attributedBody (blob)    -- Rich text with attachments
  • date (int)               -- Apple nanoseconds since 2001-01-01
  • date_read (int)
  • is_from_me (bool)
  • cache_has_attachments (bool)
  • associated_message_guid (text)  -- For tapbacks
  • associated_message_type (int)   -- 2000-2005, 3000-3005
  • handle_id (int)          -- FK to handle

handle
  • ROWID (int)
  • id (text)                -- Phone number or email
  • service (text)           -- "iMessage" or "SMS"

chat
  • ROWID (int)
  • chat_identifier (text)   -- Group ID or contact
  • display_name (text)      -- Group name
  
chat_message_join           -- Many-to-many
  • chat_id (int)
  • message_id (int)

chat_handle_join            -- Group participants
  • chat_id (int)
  • handle_id (int)

Key queries:
1. Fetch messages by year (date range)
2. Join with handle for sender info
3. Join with chat for conversation context
4. Separate query for tapback parent messages (cross-year)
```

### Cloud: PostgreSQL (Fly.io)

```sql
CREATE TABLE wrapped_stats (
  id TEXT PRIMARY KEY,           -- base64url, 12 chars (crypto.randomBytes(6))
  year INTEGER NOT NULL,         -- 2020-2030
  data JSONB NOT NULL,           -- Full statistics object
  created_at TIMESTAMP DEFAULT NOW(),
  views INTEGER DEFAULT 0        -- Incremented on each GET
);

CREATE INDEX idx_year ON wrapped_stats(year);
CREATE INDEX idx_created_at ON wrapped_stats(created_at);

-- Example row:
{
  "id": "a7B2c9D4e5F6",
  "year": 2025,
  "data": {
    "raw": {
      "volume": { ... },
      "temporal": { ... },
      "contacts": { ... },
      "content": { ... },
      "conversations": { ... },
      "response_times": { ... },
      "tapbacks": { ... },
      "streaks": { ... }
    }
  },
  "created_at": "2025-12-25T10:30:00Z",
  "views": 42
}

Operations:
• INSERT: On upload (with generated ID)
• SELECT: On view (with views++ UPDATE)
• No DELETE: Data retained indefinitely
• No user table: Anonymous, no auth required
```

## Key Implementation Details

### 1. Apple Timestamp Conversion

```python
# utils.py
APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)
TIMESTAMP_FACTOR = 1_000_000_000  # nanoseconds

def apple_timestamp_to_datetime(ns: int) -> datetime:
    seconds = ns / TIMESTAMP_FACTOR
    return APPLE_EPOCH + timedelta(seconds=seconds)
```

### 2. Tapback Association (Cross-Year)

```python
# service.py - MessageProcessor._build_conversations()

1. Fetch all messages for target year
2. Identify tapbacks by associated_message_type (2000-2005)
3. Queue tapbacks separately (don't add to messages list)
4. Extract parent GUIDs from associated_message_guid
5. If parent not found, batch fetch by GUID (cross-year lookup)
6. Apply tapbacks to parent messages in index
```

### 3. Privacy Sanitization

```javascript
// web/lib/privacy.js

export function sanitizeStatistics(statistics) {
  // 1. Deep clone to avoid mutation
  const clean = JSON.parse(JSON.stringify(statistics))
  
  // 2. Remove forbidden keys recursively
  const forbiddenKeys = ['sample_messages', 'message_text', 'content_samples', 'text']
  removeForbiddenKeys(clean)
  
  // 3. Scan and anonymize all identifiers
  //    name/display_name → null
  //    identifier → SHA256 hash with prefix
  return scanObject(clean)
}
```

### 4. Rate Limiting (In-Memory)

```javascript
// web/lib/rateLimit.js

const uploadAttempts = new Map()  // IP → { count, resetAt }

export function checkRateLimit(ip) {
  const now = Date.now()
  const data = uploadAttempts.get(ip)
  
  if (!data || now > data.resetAt) {
    uploadAttempts.set(ip, {
      count: 1,
      resetAt: now + (60 * 60 * 1000)  // 1 hour window
    })
    return { allowed: true, remaining: 4 }
  }
  
  if (data.count >= 5) {
    return { allowed: false, remaining: 0 }
  }
  
  data.count += 1
  return { allowed: true, remaining: 5 - data.count }
}
```

### 5. Desktop App Background Processing

```python
# desktop/gui.py - IMessageWrappedApp

def _run_analysis(self):
    # Runs in background thread to avoid blocking UI
    thread = threading.Thread(target=self._run_analysis, daemon=True)
    
    # Steps:
    # 1. Check if export exists, create if needed
    # 2. Load and analyze with RawStatisticsAnalyzer
    # 3. Upload to server via StatsUploader
    # 4. Open browser with share URL
    # 5. Update menu bar icon (⏳ → ✅ or ❌)
    # 6. Show macOS notifications at each step
```

### 6. JSONL Format (Streaming Friendly)

```python
# exporter.py - JSONLSerializer

# Each line = one message with conversation context
{
  "export_date": "2025-12-25T10:30:00Z",
  "year": 2025,
  "conversation_key": "chat_123",
  "chat_identifier": "+15555551234",
  "display_name": "John Doe",
  "is_group_chat": false,
  "participants": ["+15555551234"],
  "message": {
    "id": 456,
    "guid": "p:0/ABC123",
    "timestamp": "2025-06-15T14:30:00Z",
    "is_from_me": true,
    "sender": "Me",
    "text": "Hello!",
    "service": "iMessage",
    "has_attachment": false,
    "tapbacks": []
  }
}

# Advantages:
# - Stream processing for large exports
# - Line-by-line parsing (no full file in memory)
# - Easy to grep/filter with jq
```

## Performance & Scalability

```
Operation                    Time         Notes
────────────────────────────────────────────────────────────
Local export (10K msgs)      2-5s         SQLite read, JSONL write
Local analysis (10K msgs)    1-3s         Pure Python computation
Upload statistics            100-500ms    HTTP POST + DB write
Dashboard load (cold)        200-800ms    DB query + React render
Dashboard load (warm)        50-200ms     Browser cache
Fly.io cold start            ~2s          Auto-wake from sleep
Desktop app build (dev)      10-20s       py2app alias mode
Desktop app build (prod)     2-5min       py2app + DMG + signing

Bottlenecks:
• Export: SQLite disk I/O (mitigated by batch fetching)
• Analysis: Emoji regex (mitigated by compiled patterns)
• Upload: Network latency (mitigated by compression)
• Dashboard: Chart rendering (mitigated by Recharts)

Scalability:
• CLI: Single-machine, no network dependencies
• Desktop: Single-machine, background processing
• Web: Horizontal scaling on Fly.io (stateless)
• Database: PostgreSQL handles 100K+ wraps easily
• Rate limiting: In-memory (lost on restart, acceptable)
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Package                             │
├─────────────────────────────────────────────────────────────────┤
│ Python 3.10+          Core language (requires >=3.10)          │
│ rich 13.0+            Terminal UI (tables, panels, progress)    │
│ questionary 2.0+      Interactive prompts                       │
│ requests 2.31+        HTTP client for upload                    │
│ sqlite3               Built-in (iMessage DB access)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Desktop App                              │
├─────────────────────────────────────────────────────────────────┤
│ rumps                 macOS menu bar framework                  │
│ py2app                Bundle Python → .app                      │
│ All CLI dependencies  Embedded in bundle                        │
│ codesign              Apple code signing tool                   │
│ notarytool            Apple notarization                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          Web App                                │
├─────────────────────────────────────────────────────────────────┤
│ Next.js 14            React framework (App Router)              │
│ React 18              UI library                                │
│ Node.js 20            Runtime                                   │
│ pg 8.11               PostgreSQL client                         │
│ Recharts 2.10         Chart library (responsive)                │
│ dotenv 16.4           Environment config                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Infrastructure                             │
├─────────────────────────────────────────────────────────────────┤
│ Fly.io                PaaS hosting (auto-scaling)               │
│ PostgreSQL 14         Relational database (JSONB support)       │
│ GitHub Actions        CI/CD (optional)                          │
│ GitHub Releases       Desktop app distribution                  │
│ PyPI                  CLI package distribution                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Format: JSONL (JSON Lines)

```
Why JSONL over JSON?
─────────────────────────────────────────────────
✅ Streamable       Process line-by-line
✅ Appendable       Add messages without rewriting file
✅ Grep-friendly    Each line is valid JSON
✅ Memory efficient No need to load entire file
✅ Human-readable   Pretty-print any line with jq

Example workflow:
• Export 100K messages → 500MB JSONL file
• Analyze without loading all into memory
• Filter by date: cat export.jsonl | jq 'select(.message.timestamp | startswith("2025"))'
```

## Project Structure Summary

```
msg-review/
├── src/imessage_wrapped/      Python package (CLI + library)
├── desktop/                   macOS menu bar app (py2app)
├── web/                       Next.js web dashboard
├── exports/                   Generated JSONL files (gitignored)
├── dist/                      Build artifacts (gitignored)
├── pyproject.toml             Python package config
├── Makefile                   Build automation
├── ARCHITECTURE.md            This file
├── RELEASE-GUIDE.md           Deployment instructions
└── README.md                  User-facing docs
```

## Design Principles

```
1. Privacy First
   • Message content NEVER leaves local machine
   • Only aggregated statistics uploaded
   • One-way hashing for contact identifiers
   • No user accounts or authentication

2. Zero Config
   • CLI works out-of-box with `pip install`
   • Desktop app requires no terminal knowledge
   • Web dashboard auto-generates shareable URLs
   • Auto-export if no cached data found

3. Offline Capable
   • Export + analyze work fully offline
   • Upload is optional (--no-share flag)
   • Desktop app caches exports locally
   • Terminal display shows full stats

4. Developer Friendly
   • Clean separation: CLI/Desktop/Web
   • Type hints throughout (Python 3.10+)
   • Modular analyzers (easy to extend)
   • Rich logging for debugging

5. Production Ready
   • Code signing (Desktop)
   • Notarization (macOS)
   • Rate limiting (Web)
   • Error handling everywhere
   • No hardcoded credentials
```

## Deployment Status

```
Component         Status    URL/Distribution
─────────────────────────────────────────────────────────────
CLI Package       ✅ Live   pip install imessage-wrapped
Desktop App       ✅ Live   GitHub Releases (DMG)
Web Dashboard     ✅ Live   https://imessage-wrapped.fly.dev
Database          ✅ Live   Fly.io PostgreSQL
Download API      ✅ Live   /api/download → latest DMG
```

---

**Architecture Philosophy:**
- Single source of truth: Python package
- Multiple interfaces: CLI, Desktop, Web
- Privacy by design: Local-first processing
- Simple deployment: One command per component
- LLM-friendly: Modular, well-documented, type-hinted