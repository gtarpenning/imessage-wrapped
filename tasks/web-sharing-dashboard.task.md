# Task: Web-Based Sharing Dashboard for iMessage Wrapped

## Overview

Enable users to upload their analysis results to a web server and receive a shareable link to an interactive dashboard. This creates a viral sharing mechanism similar to Spotify Wrapped's social features.

**User Flow:**
1. User runs local analysis → generates statistics
2. User opts to share → data uploads to server
3. System returns shareable URL → `https://wrapped.imsg.io/2025/abc123xyz`
4. User opens link → sees beautiful interactive dashboard
5. User shares link with friends → friends see their stats

**Key Goals:**
- Zero-friction sharing (one command)
- Privacy-first (anonymous IDs, no PII stored)
- Fast loading (<2s page load)
- Mobile-responsive design
- Social media preview cards (OpenGraph)

---

## Architecture

### System Overview

```
┌─────────────────┐
│  Local CLI/App  │
│  (User's Mac)   │
└────────┬────────┘
         │ POST /api/upload
         │ (JSON payload)
         ▼
┌─────────────────────────────────┐
│  Backend API Server             │
│  (FastAPI + PostgreSQL)         │
│  - Receives statistics          │
│  - Generates unique ID          │
│  - Stores in database           │
│  - Returns shareable URL        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Frontend Dashboard             │
│  (React + Vite)                 │
│  - Fetches data by ID           │
│  - Renders interactive charts   │
│  - Handles animations           │
│  - Generates social cards       │
└─────────────────────────────────┘
```

### Tech Stack

**Backend:**
- **Framework:** FastAPI (Python) - Fast, async, auto-docs
- **Database:** PostgreSQL (on Fly.io)
- **Hosting:** Fly.io 

**Frontend:**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite (fast dev/build)
- **Charts:** Recharts or Chart.js (lightweight)
- **Styling:** Tailwind CSS + custom gradients
- **Animations:** Framer Motion
- **Hosting:** Vercel / Netlify (static deploy)

**Why these choices:**
- FastAPI: Pythonic, matches existing codebase, great for data APIs
- React: Component-based, perfect for interactive dashboards
- Tailwind: Rapid prototyping, modern aesthetic
- Railway/Vercel: Free tiers, instant deploys, production-ready

---

## Critical MVP Steps

### Phase 1: Backend API (Week 1)

**Deliverable:** Working API that accepts stats and returns IDs

#### 1.1 Setup Backend Project
```bash
mkdir backend
cd backend
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy psycopg2-binary pydantic
```

#### 1.2 Create Data Models

```python
# backend/models.py
from sqlalchemy import Column, String, JSON, DateTime, Integer
from datetime import datetime
import secrets

class WrappedStats(Base):
    __tablename__ = "wrapped_stats"
    
    id = Column(String(12), primary_key=True)  # e.g., "abc123xyz789"
    year = Column(Integer, nullable=False)
    data = Column(JSON, nullable=False)  # All statistics as JSON
    created_at = Column(DateTime, default=datetime.utcnow)
    views = Column(Integer, default=0)
    
    @staticmethod
    def generate_id() -> str:
        """Generate URL-safe unique ID (12 chars)."""
        return secrets.token_urlsafe(9)[:12]
```

#### 1.3 Create API Endpoints

```python
# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any

app = FastAPI(title="iMessage Wrapped API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_methods=["GET", "POST"],
)

class UploadRequest(BaseModel):
    year: int
    statistics: dict[str, Any]

class UploadResponse(BaseModel):
    id: str
    url: str
    year: int

@app.post("/api/upload", response_model=UploadResponse)
async def upload_stats(request: UploadRequest):
    """
    Upload wrapped statistics and get shareable link.
    
    Input: { year: 2025, statistics: {...} }
    Output: { id: "abc123", url: "https://...", year: 2025 }
    """
    # Validate data
    if request.year < 2020 or request.year > 2030:
        raise HTTPException(400, "Invalid year")
    
    # Generate unique ID
    wrapped_id = WrappedStats.generate_id()
    
    # Save to database
    stats = WrappedStats(
        id=wrapped_id,
        year=request.year,
        data=request.statistics
    )
    db.add(stats)
    db.commit()
    
    # Return shareable URL
    base_url = "https://wrapped.imsg.io"  # Your domain
    return UploadResponse(
        id=wrapped_id,
        url=f"{base_url}/{request.year}/{wrapped_id}",
        year=request.year
    )

@app.get("/api/wrapped/{year}/{id}")
async def get_stats(year: int, id: str):
    """
    Fetch wrapped statistics by ID.
    
    Returns: { year: 2025, statistics: {...}, created_at: "..." }
    """
    stats = db.query(WrappedStats).filter_by(
        id=id,
        year=year
    ).first()
    
    if not stats:
        raise HTTPException(404, "Wrapped not found")
    
    # Increment view counter
    stats.views += 1
    db.commit()
    
    return {
        "year": stats.year,
        "statistics": stats.data,
        "created_at": stats.created_at.isoformat()
    }

@app.get("/health")
async def health():
    return {"status": "ok"}
```

#### 1.4 Database Setup

```python
# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://user:pass@localhost/imessage_wrapped"
# Or for SQLite MVP: "sqlite:///./wrapped.db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

def init_db():
    Base.metadata.create_all(bind=engine)
```

#### 1.5 Deploy Backend

```bash
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"

# Deploy
railway login
railway init
railway up
```

**Checkpoint:** API is live, can POST stats and GET by ID

---

### Phase 2: Local Integration (Week 1)

**Deliverable:** CLI can upload stats and print share link

#### 2.1 Add Upload Function to CLI

```python
# src/imessage_wrapped/uploader.py
import requests
from typing import Optional
from rich.console import Console

API_BASE_URL = "https://your-api.railway.app"

class StatsUploader:
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.console = Console()
    
    def upload(self, year: int, statistics: dict) -> Optional[str]:
        """
        Upload statistics to server.
        
        Returns: Shareable URL or None if failed
        """
        try:
            with self.console.status("[bold green]Uploading to server..."):
                response = requests.post(
                    f"{self.base_url}/api/upload",
                    json={
                        "year": year,
                        "statistics": statistics
                    },
                    timeout=30
                )
                response.raise_for_status()
                
            data = response.json()
            return data["url"]
            
        except requests.RequestException as e:
            self.console.print(f"[red]Upload failed: {e}[/]")
            return None
```

#### 2.2 Update Analyzer to Support Upload

```python
# In analyzer.py or service.py
from .uploader import StatsUploader

class AnalysisService:
    # ... existing code ...
    
    def analyze_and_share(
        self,
        data: ExportData,
        year: int,
        display: Display,
        share: bool = False
    ) -> Optional[str]:
        """
        Analyze data, display results, optionally upload for sharing.
        
        Returns: Share URL if uploaded, None otherwise
        """
        # Run analysis
        statistics = self.analyze(data)
        
        # Display locally
        display.render(statistics)
        
        # Upload if requested
        share_url = None
        if share:
            uploader = StatsUploader()
            share_url = uploader.upload(year, statistics)
            
            if share_url:
                console = Console()
                console.print()
                console.print("─" * 60)
                console.print("[bold green]✓ Shareable link created![/]")
                console.print()
                console.print(f"  🔗 {share_url}")
                console.print()
                console.print("  Copy this link to share your Wrapped with friends!")
                console.print("─" * 60)
        
        return share_url
```

#### 2.3 Add CLI Flag

```python
# In cli.py
@app.command()
def analyze(
    input_file: str,
    year: int = 2025,
    share: bool = typer.Option(False, "--share", help="Upload and get shareable link")
):
    """Analyze exported messages."""
    
    # Load data
    loader = ExportLoader()
    data = loader.load_jsonl(input_file)
    
    # Analyze
    service = AnalysisService()
    display = TerminalDisplay()
    
    share_url = service.analyze_and_share(
        data=data,
        year=year,
        display=display,
        share=share
    )
```

**Usage:**
```bash
# Analyze locally only
imessage-wrapped analyze exports/2025.jsonl

# Analyze and upload for sharing
imessage-wrapped analyze exports/2025.jsonl --share
```

**Checkpoint:** Users can generate and share links from CLI

---

### Phase 3: Frontend Dashboard (Week 2-3)

**Deliverable:** Beautiful interactive web dashboard

#### 3.1 Setup React Project

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install recharts framer-motion tailwindcss
npm install react-router-dom
npx tailwindcss init
```

#### 3.2 Create Route Structure

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import WrappedDashboard from './pages/WrappedDashboard'
import NotFound from './pages/NotFound'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:year/:id" element={<WrappedDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
```

#### 3.3 Fetch Data Hook

```typescript
// src/hooks/useWrappedData.ts
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const API_BASE = 'https://your-api.railway.app'

interface WrappedData {
  year: number
  statistics: Record<string, any>
  created_at: string
}

export function useWrappedData() {
  const { year, id } = useParams()
  const [data, setData] = useState<WrappedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/api/wrapped/${year}/${id}`)
        if (!response.ok) throw new Error('Not found')
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [year, id])

  return { data, loading, error }
}
```

#### 3.4 Dashboard Layout

```typescript
// src/pages/WrappedDashboard.tsx
import { useWrappedData } from '../hooks/useWrappedData'
import HeroSection from '../components/HeroSection'
import VolumeSection from '../components/VolumeSection'
import ContactsSection from '../components/ContactsSection'
import TimingSection from '../components/TimingSection'
import EmojiSection from '../components/EmojiSection'
import FunFactsSection from '../components/FunFactsSection'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorPage from '../components/ErrorPage'

export default function WrappedDashboard() {
  const { data, loading, error } = useWrappedData()

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorPage message={error} />
  if (!data) return <ErrorPage message="No data found" />

  const stats = data.statistics

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Hero */}
      <HeroSection 
        year={data.year}
        totalSent={stats.volume.messages_sent}
        totalReceived={stats.volume.messages_received}
      />
      
      {/* Sections */}
      <VolumeSection stats={stats.volume} />
      <ContactsSection stats={stats.contacts} />
      <TimingSection stats={stats.temporal} />
      <EmojiSection stats={stats.content} />
      <FunFactsSection stats={stats} />
      
      {/* Footer */}
      <footer className="text-center py-12 text-gray-400">
        <p>Create your own at imessage-wrapped.com</p>
      </footer>
    </div>
  )
}
```

#### 3.5 Example Component: Hero Section

```typescript
// src/components/HeroSection.tsx
import { motion } from 'framer-motion'
import CountUp from 'react-countup'

interface Props {
  year: number
  totalSent: number
  totalReceived: number
}

export default function HeroSection({ year, totalSent, totalReceived }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <h1 className="text-7xl font-bold text-white mb-8">
        Your <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
          {year}
        </span> in Messages
      </h1>
      
      <div className="grid grid-cols-2 gap-8 mt-12">
        <StatCard
          label="Messages Sent"
          value={totalSent}
          color="from-blue-500 to-cyan-500"
        />
        <StatCard
          label="Messages Received"
          value={totalReceived}
          color="from-pink-500 to-purple-500"
        />
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="mt-16 text-gray-400"
      >
        Scroll to see more →
      </motion.div>
    </motion.section>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center">
      <p className="text-gray-300 text-sm uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-6xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
        <CountUp end={value} duration={2} separator="," />
      </p>
    </div>
  )
}
```

#### 3.6 Charts Components

```typescript
// src/components/charts/MessagesByHourChart.tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

export default function MessagesByHourChart({ data }) {
  const chartData = Object.entries(data).map(([hour, count]) => ({
    hour: `${hour}:00`,
    messages: count
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <XAxis dataKey="hour" stroke="#9CA3AF" />
        <YAxis stroke="#9CA3AF" />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#1F2937', 
            border: 'none',
            borderRadius: '8px'
          }}
        />
        <Bar dataKey="messages" fill="url(#gradient)" radius={[8, 8, 0, 0]} />
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

#### 3.7 Responsive Design

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-900 text-white font-sans antialiased;
  }
}

@layer utilities {
  .glass {
    @apply bg-white/10 backdrop-blur-lg border border-white/20;
  }
  
  .gradient-text {
    @apply bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent;
  }
}
```

#### 3.8 Social Media Meta Tags

```typescript
// src/components/SEO.tsx
import { Helmet } from 'react-helmet'

interface Props {
  year: number
  totalMessages: number
  topContact: string
}

export default function SEO({ year, totalMessages, topContact }: Props) {
  const title = `My ${year} iMessage Wrapped`
  const description = `I sent ${totalMessages.toLocaleString()} messages this year! Check out my iMessage Wrapped.`
  const imageUrl = `https://wrapped.imsg.io/api/og-image/${year}/${id}`  // Generate dynamic OG image

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* OpenGraph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:type" content="website" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  )
}
```

#### 3.9 Deploy Frontend

```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod

# Or Netlify
netlify deploy --prod --dir=dist
```

**Checkpoint:** Dashboard is live, loads data from API, looks beautiful

---

## Data Privacy & Security

### Privacy Principles

1. **No PII Storage:** Never store contact names, phone numbers, or message content
2. **Anonymization:** All contacts should be anonymized before upload
3. **Opt-in Only:** Sharing is always optional
4. **Expiration:** Links expire after 30 days (configurable)
5. **No Analytics:** Don't track user behavior beyond view counts

### Data Sanitization

```python
# src/imessage_wrapped/privacy.py
import hashlib
from typing import Any, Dict

def anonymize_contact(identifier: str) -> str:
    """
    Hash contact identifiers (phone/email) to anonymous IDs.
    
    "+14155551234" -> "contact_a7f2c9e1"
    """
    hash_obj = hashlib.sha256(identifier.encode())
    return f"contact_{hash_obj.hexdigest()[:8]}"

def sanitize_statistics(stats: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove all PII from statistics before upload.
    
    - Replace contact identifiers with hashes
    - Remove message content (keep only lengths/counts)
    - Remove attachment filenames
    """
    sanitized = stats.copy()
    
    # Anonymize top contacts
    if "contacts" in sanitized:
        for contact_list in ["most_messaged", "most_received_from"]:
            if contact_list in sanitized["contacts"]:
                for contact in sanitized["contacts"][contact_list]:
                    contact["identifier"] = anonymize_contact(contact["identifier"])
    
    # Remove any message text samples
    if "content" in sanitized and "sample_messages" in sanitized["content"]:
        del sanitized["content"]["sample_messages"]
    
    # Keep only aggregate stats, no individual message data
    
    return sanitized
```

### Backend Security

```python
# backend/main.py additions

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/upload")
@limiter.limit("5/hour")  # Max 5 uploads per hour per IP
async def upload_stats(request: UploadRequest):
    # ... existing code ...
    pass

@app.get("/api/wrapped/{year}/{id}")
@limiter.limit("100/minute")  # Prevent scraping
async def get_stats(year: int, id: str):
    # ... existing code ...
    pass
```

### Data Retention Policy

```python
# backend/cleanup.py
from datetime import datetime, timedelta

async def cleanup_expired_wrapped():
    """
    Delete wrapped data older than 30 days.
    Run this as a cron job daily.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=30)
    
    deleted = db.query(WrappedStats).filter(
        WrappedStats.created_at < cutoff_date
    ).delete()
    
    db.commit()
    
    logger.info(f"Cleaned up {deleted} expired wrapped stats")
```

---

## Testing Checklist

### Backend Testing
- [ ] Upload endpoint accepts valid data
- [ ] Upload endpoint rejects invalid data (bad year, malformed JSON)
- [ ] Get endpoint returns correct data by ID
- [ ] Get endpoint returns 404 for non-existent IDs
- [ ] Rate limiting works (blocks after 5 uploads)
- [ ] Database persists data correctly
- [ ] Cleanup job deletes old records

### Frontend Testing
- [ ] Dashboard loads data from API
- [ ] Dashboard shows loading state
- [ ] Dashboard handles 404 gracefully
- [ ] Charts render with real data
- [ ] Mobile responsive (test on phone)
- [ ] Animations don't lag on slower devices
- [ ] Social share meta tags work (test with Facebook debugger)

### Integration Testing
- [ ] End-to-end: CLI upload → API → Frontend display
- [ ] Share link works immediately after upload
- [ ] Multiple users can view same link simultaneously
- [ ] Links work in incognito/private browsing

### Load Testing
- [ ] API handles 100 concurrent requests
- [ ] Database queries complete <100ms
- [ ] Frontend loads <2 seconds on 3G

---

## Deployment

### Backend Deployment (Railway)

```bash
# 1. Create railway.toml
cat > railway.toml << EOF
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn backend.main:app --host 0.0.0.0 --port \$PORT"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF

# 2. Add requirements.txt
cat > requirements.txt << EOF
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
pydantic==2.5.0
slowapi==0.1.9
EOF

# 3. Deploy
railway login
railway init
railway link
railway up

# 4. Add PostgreSQL
railway add --plugin postgresql

# 5. Set environment variables
railway variables set DATABASE_URL=$RAILWAY_DATABASE_URL
railway variables set FRONTEND_URL=https://wrapped.imsg.io
```

### Frontend Deployment (Vercel)

```bash
# 1. Create vercel.json
cat > vercel.json << EOF
{
  "rewrites": [
    { "source": "/:year/:id", "destination": "/index.html" }
  ]
}
EOF

# 2. Deploy
vercel --prod

# 3. Add environment variable
vercel env add VITE_API_URL production
# Enter: https://your-api.railway.app
```

### Domain Setup

```
1. Buy domain: wrapped.imsg.io or imessage-wrapped.com
2. Point to Vercel (frontend)
3. Add subdomain api.wrapped.imsg.io → Railway (backend)
4. Update CORS settings in backend
5. Update API_BASE_URL in frontend
```

---

## Cost Estimate (Monthly)

**MVP Tier (< 1000 users):**
- Railway: $0 (free tier: 500 hours/month)
- Vercel: $0 (free tier: 100 GB bandwidth)
- Domain: $12/year ≈ $1/month
- **Total: ~$1/month**

**Growth Tier (1K-10K users):**
- Railway: $5/month (Starter plan)
- Vercel: $0 (free tier sufficient)
- PostgreSQL: $5/month (Railway addon)
- **Total: ~$10/month**

**Scale Tier (10K-100K users):**
- Railway: $20/month (Pro plan)
- Vercel: $20/month (Pro plan)
- PostgreSQL: $15/month (larger instance)
- **Total: ~$55/month**

---

## Future Enhancements

### V2 Features
- [ ] User accounts (optional) - save multiple years
- [ ] Comparison mode - "How did 2025 compare to 2024?"
- [ ] Custom themes - let users pick color schemes
- [ ] Download as PDF/image
- [ ] Social share buttons with pre-filled text
- [ ] Embed widgets for blogs/websites

### Advanced Features
- [ ] Real-time collaboration - view with friends simultaneously
- [ ] Comments/reactions on shared wrapped
- [ ] Leaderboards (opt-in) - "Top 100 most active"
- [ ] Year-over-year trends
- [ ] Custom domain support for organizations
- [ ] API for third-party integrations

### Monetization Ideas (Optional)
- [ ] Premium themes ($0.99)
- [ ] Extended storage (keep forever) ($4.99/year)
- [ ] Advanced analytics (sentiment, AI insights) ($9.99)
- [ ] White-label for businesses ($99/month)

---

## Success Metrics

**Week 1 (MVP):**
- [ ] Backend deployed and healthy
- [ ] Can upload from CLI
- [ ] Basic dashboard displays data

**Week 2:**
- [ ] Beautiful dashboard with all sections
- [ ] Mobile responsive
- [ ] Share links work end-to-end

**Week 3:**
- [ ] Social meta tags working
- [ ] Performance optimized
- [ ] 10+ beta testers sharing links

**Month 1:**
- [ ] 100+ wrapped created
- [ ] <2s page load time
- [ ] Zero downtime
- [ ] Positive user feedback

**Long-term:**
- [ ] 10,000+ wrapped created
- [ ] 50,000+ wrapped views
- [ ] Featured on Product Hunt / Hacker News
- [ ] Users organically sharing on social media

---

## Implementation Timeline

### Week 1: Backend + CLI Integration
**Day 1-2:** Setup FastAPI, create models, implement endpoints
**Day 3:** Deploy to Railway, test with Postman
**Day 4-5:** Add upload function to CLI, test end-to-end
**Day 6-7:** Add privacy/sanitization, rate limiting, testing

### Week 2: Frontend Foundation
**Day 1-2:** Setup React project, routing, data fetching
**Day 3-4:** Build Hero + Volume sections with charts
**Day 5-6:** Build Contacts + Timing + Emoji sections
**Day 7:** Polish, mobile responsive, loading states

### Week 3: Polish + Launch
**Day 1-2:** Fun facts section, animations, micro-interactions
**Day 3:** Social meta tags, SEO, OG images
**Day 4:** Performance optimization, testing
**Day 5:** Beta testing with 10 users
**Day 6:** Fix bugs, final polish
**Day 7:** Public launch 🚀

---

## Getting Started Checklist

- [ ] Clone/create new repos: `backend/` and `frontend/`
- [ ] Setup Python virtual environment for backend
- [ ] Install FastAPI dependencies
- [ ] Create database models and migrations
- [ ] Implement upload and get endpoints
- [ ] Test API with curl/Postman
- [ ] Deploy backend to Railway
- [ ] Create React app with Vite
- [ ] Setup routing and data fetching
- [ ] Build one section completely (as template)
- [ ] Replicate for all sections
- [ ] Deploy frontend to Vercel
- [ ] Test end-to-end flow
- [ ] Invite beta testers
- [ ] Launch! 🎉

---

## LLM Implementation Tips

When implementing this:

1. **Start with backend** - API first ensures CLI can upload immediately
2. **Use TypeScript** - Type safety prevents bugs in frontend
3. **Component-first** - Build one perfect section, copy for others
4. **Test incrementally** - Don't wait until end to test integrations
5. **Mobile-first design** - Most sharing happens on phones
6. **Performance matters** - Use React.memo, lazy loading, optimize images
7. **Error handling** - Graceful failures enhance trust
8. **Documentation** - Comment complex logic, especially data transformations

**Common Pitfalls:**
- Don't store PII without explicit user consent
- Don't skip rate limiting (prevents abuse)
- Don't forget CORS configuration
- Don't hardcode API URLs (use environment variables)
- Don't neglect loading states (users will see them)
- Don't skip mobile testing (80% of shares are mobile)

**Quick Wins:**
- Use Tailwind's built-in gradients for instant polish
- Framer Motion's variants make animations declarative
- Recharts has great defaults, minimal config needed
- Railway and Vercel have zero-config deployments
- OpenGraph meta tags = free social media previews

---

## Resources

**Backend:**
- FastAPI docs: https://fastapi.tiangolo.com
- Railway docs: https://docs.railway.app
- SQLAlchemy: https://docs.sqlalchemy.org

**Frontend:**
- Vite: https://vitejs.dev
- Recharts: https://recharts.org
- Framer Motion: https://www.framer.com/motion
- Tailwind: https://tailwindcss.com

**Design Inspiration:**
- Spotify Wrapped: spotify.com/wrapped
- GitHub Year in Review
- Duolingo Year in Review
- Strava Year in Sport

**Tools:**
- OpenGraph debugger: https://opengraph.dev
- Lighthouse (performance): Chrome DevTools
- Railway logs: `railway logs`
- Vercel logs: Vercel dashboard

---

## Questions for Implementation

Before starting, clarify:

1. **Domain:** Have you purchased a domain? If not, use Railway/Vercel free domains
2. **Database:** PostgreSQL or SQLite for MVP? (SQLite = simpler, Postgres = scalable)
3. **Analytics:** Do you want view counters? Click tracking?
4. **Retention:** 30-day expiration or keep forever?
5. **Auth:** Public links only, or optional user accounts?

**Recommended MVP answers:**
1. Start with Railway free domain, buy custom domain later
2. SQLite for MVP (single file, no setup), migrate to Postgres later
3. Just view counters (simple)
4. 30-day expiration (reduces storage costs)
5. Public links only (simpler)

Start simple, add complexity only when needed.

