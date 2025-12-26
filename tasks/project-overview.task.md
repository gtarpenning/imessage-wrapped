# Task: iMessage Wrapped - Complete Project Overview

## Project Summary

Build **iMessage Wrapped** - a "Spotify Wrapped"-style year in review for iMessage data. The tool analyzes a user's message history and generates beautiful statistics and visualizations.

**Distribution targets:**
1. **Standalone macOS .app** - Double-click, grant permission, see results
2. **Python CLI via pip** - `pip install imessage-wrapped && imessage-wrapped`

---

## Architecture

```
imessage-wrapped/
├── src/imessage_wrapped/
│   ├── __init__.py
│   ├── cli.py              # Click-based CLI entry point
│   ├── app.py              # GUI application (for .app bundle)
│   ├── db_reader.py        # SQLite database reader
│   ├── models.py           # Data models (Message, Conversation, Stats)
│   ├── stats.py            # Statistics computation
│   ├── charts.py           # Visualization generation
│   ├── report.py           # HTML report builder
│   └── permissions.py      # macOS permission utilities
├── assets/
│   ├── template.html       # Report HTML template
│   ├── style.css           # Report styling
│   └── icon.icns           # App icon
├── pyproject.toml          # Project config & dependencies
├── build.py                # PyInstaller build script
└── README.md
```

---

## Core Components

### 1. Database Reader (`db_reader.py`)
*See: `imessage-json-exporter.task.md` for full specification*

- Read from `~/Library/Messages/chat.db`
- Export to intermediate JSON format
- Handle permission errors gracefully
- Filter by year (default: current year)

### 2. Data Models (`models.py`)

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Message:
    id: int
    timestamp: datetime
    timestamp_read: datetime | None
    is_from_me: bool
    sender: str  # phone/email or "Me"
    text: str
    conversation_id: str
    is_group_chat: bool
    has_attachment: bool
    tapbacks: list[dict]  # [{"type": "love", "by": "sender"}]

@dataclass  
class Conversation:
    id: str
    display_name: str | None
    participants: list[str]
    is_group_chat: bool
    messages: list[Message]

@dataclass
class YearStats:
    year: int
    total_sent: int
    total_received: int
    busiest_day: dict  # {date, sent, received, total}
    top_contacts_sent: list[dict]
    top_contacts_received: list[dict]
    quickest_responder: dict
    # ... all other stats
```

### 3. Statistics Engine (`stats.py`)

Compute all statistics from the spec. Key functions:

```python
class StatsCalculator:
    def __init__(self, messages: list[Message], year: int):
        self.messages = messages
        self.year = year
        
    def compute_all(self) -> YearStats:
        """Compute all statistics and return YearStats object."""
        
    # Volume stats
    def total_sent_received(self) -> tuple[int, int]: ...
    def messages_by_day(self) -> dict[date, dict]: ...
    def busiest_day(self) -> dict: ...
    def messages_by_hour(self) -> dict[int, int]: ...
    def messages_by_weekday(self) -> dict[int, int]: ...
    def longest_streak(self) -> int: ...
    
    # People stats (require min_messages threshold)
    def top_contacts(self, direction: str, limit: int = 10, min_messages: int = 10) -> list[dict]: ...
    def quickest_responder(self, min_exchanges: int = 10) -> dict: ...
    def slowest_responder(self, min_exchanges: int = 10) -> dict: ...
    def night_owl_friends(self, after_hour: int = 0, before_hour: int = 5) -> list[dict]: ...
    
    # Conversation stats
    def group_vs_individual_ratio(self) -> dict: ...
    def most_active_group(self) -> dict: ...
    def double_text_frequency(self) -> float: ...
    
    # Content stats
    def most_used_emoji(self, limit: int = 10) -> list[dict]: ...
    def most_used_words(self, limit: int = 20, exclude_stopwords: bool = True) -> list[dict]: ...
    def average_message_length(self) -> dict: ...
    
    # Timing stats
    def average_response_time(self, direction: str) -> timedelta: ...
    def response_time_distribution(self) -> dict: ...
    
    # Tapback stats
    def tapback_stats(self) -> dict: ...
```

### 4. Charts Generator (`charts.py`)

Use **plotly** for interactive charts that embed well in HTML.

```python
import plotly.graph_objects as go
import plotly.express as px

class ChartGenerator:
    def __init__(self, stats: YearStats, theme: str = "dark"):
        self.stats = stats
        self.theme = theme
        
    def messages_over_time(self) -> str:
        """Line chart of messages by month. Returns HTML string."""
        
    def hour_distribution(self) -> str:
        """Bar chart of messages by hour of day."""
        
    def day_distribution(self) -> str:
        """Bar chart of messages by day of week."""
        
    def top_contacts_chart(self) -> str:
        """Horizontal bar chart of top contacts."""
        
    def heatmap_calendar(self) -> str:
        """GitHub-style contribution calendar."""
        
    def emoji_chart(self) -> str:
        """Emoji frequency visualization."""
        
    def response_time_histogram(self) -> str:
        """Distribution of your response times."""
```

**Theme:** Dark mode, vibrant accent colors. Think Spotify Wrapped meets iOS aesthetics.

### 5. Report Builder (`report.py`)

Generate a single-page HTML report with embedded charts and stats.

```python
class ReportBuilder:
    def __init__(self, stats: YearStats, charts: dict[str, str]):
        self.stats = stats
        self.charts = charts
        
    def build(self) -> str:
        """Generate complete HTML report."""
        
    def save(self, output_path: str) -> None:
        """Save report to file."""
        
    def open_in_browser(self) -> None:
        """Open the report in default browser."""
```

**Report sections:**
1. Hero: "Your 2025 in Messages" with big total numbers
2. Volume: Charts + busiest day callout
3. Your People: Top contacts, quickest responder stories
4. Timing: When you text, response times
5. Content: Emoji, word cloud, message lengths
6. Fun Facts: Double texts, night owl friends, etc.

### 6. CLI (`cli.py`)

```python
import click
from rich.console import Console

@click.group()
def cli():
    """iMessage Wrapped - Your year in messages."""
    pass

@cli.command()
@click.option('--year', default=2025, help='Year to analyze')
@click.option('--output', '-o', default='./imessage-wrapped-report.html', help='Output file')
@click.option('--json', 'export_json', is_flag=True, help='Also export raw stats as JSON')
def generate(year: int, output: str, export_json: bool):
    """Generate your iMessage Year in Review."""
    console = Console()
    
    with console.status("[bold green]Reading messages..."):
        # 1. Check permissions
        # 2. Read database
        # 3. Filter to year
        
    with console.status("[bold green]Computing statistics..."):
        # Calculate all stats
        
    with console.status("[bold green]Generating visualizations..."):
        # Create charts
        
    with console.status("[bold green]Building report..."):
        # Generate HTML
        
    console.print(f"[bold green]✓[/] Report saved to {output}")
    # Auto-open in browser

@cli.command()
def export():
    """Export raw message data to JSON."""
    pass

if __name__ == '__main__':
    cli()
```

### 7. GUI App (`app.py`)

Simple GUI using **tkinter** (built-in, no extra deps):

```python
import tkinter as tk
from tkinter import ttk
import webbrowser

class iMessageWrappedApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("iMessage Wrapped")
        self.setup_ui()
        
    def setup_ui(self):
        # Simple UI:
        # - Year selector dropdown
        # - "Generate Report" button
        # - Progress bar
        # - Status text
        # - "Open Report" button (after generation)
        pass
        
    def check_permissions(self) -> bool:
        """Check Full Disk Access, show dialog if missing."""
        pass
        
    def generate_report(self):
        """Run the analysis in background thread."""
        pass
        
    def run(self):
        self.root.mainloop()
```

---

## Dependencies

```toml
# pyproject.toml
[project]
name = "imessage-wrapped"
version = "1.0.0"
description = "Your iMessage Year in Review"
requires-python = ">=3.10"
dependencies = [
    "click>=8.0",
    "rich>=13.0",
    "plotly>=5.0",
]

[project.optional-dependencies]
dev = [
    "pyinstaller>=6.0",
    "pytest>=7.0",
]

[project.scripts]
imessage-wrapped = "imessage_wrapped.cli:cli"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Core deps (3 only!):**
- `click` - CLI framework
- `rich` - Beautiful terminal output
- `plotly` - Interactive charts (self-contained HTML)

---

## Build & Distribution

### PyPI Distribution (pip install)

```bash
# Build
python -m build

# Upload to PyPI
twine upload dist/*

# Users install with:
pip install imessage-wrapped
imessage-wrapped generate --year 2025
```

### Standalone macOS App

```python
# build.py
import PyInstaller.__main__

PyInstaller.__main__.run([
    'src/imessage_wrapped/app.py',
    '--name=iMessage Wrapped',
    '--onefile',
    '--windowed',
    '--icon=assets/icon.icns',
    '--add-data=assets:assets',
    '--osx-bundle-identifier=com.yourname.imessage-wrapped',
])
```

**Build steps:**
```bash
# Install build deps
pip install pyinstaller

# Build the .app
python build.py

# Create DMG for distribution
hdiutil create -volname "iMessage Wrapped" -srcfolder "dist/iMessage Wrapped.app" -ov -format UDZO "dist/iMessage-Wrapped.dmg"
```

**Code signing (optional but recommended):**
```bash
# Requires Apple Developer account ($99/year)
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" "dist/iMessage Wrapped.app"
```

Without signing, users see "unidentified developer" warning. Include instructions:
> Right-click the app → Open → Click "Open" in the dialog

---

## Permission Handling Flow

```
App Launch
    │
    ▼
Check Full Disk Access
    │
    ├─► Has Permission ──► Proceed to analysis
    │
    └─► No Permission
            │
            ▼
        Show Dialog:
        "iMessage Wrapped needs Full Disk Access
         to read your messages.
         
         [Open System Settings]  [Quit]"
            │
            ▼
        Open: x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles
            │
            ▼
        User adds app, restarts
            │
            ▼
        Proceed to analysis
```

---

## Report Design Spec

### Visual Style
- **Background:** Dark (#0a0a0a) with subtle gradient
- **Accent colors:** Vibrant gradients (blue→purple, pink→orange)
- **Typography:** SF Pro Display (system font) or fallback to -apple-system
- **Cards:** Frosted glass effect (backdrop-filter: blur)
- **Animations:** Subtle fade-ins on scroll

### Layout (Single Page, Scrolling)
```
┌─────────────────────────────────────┐
│         YOUR 2025 IN MESSAGES       │
│                                     │
│    12,847 sent    15,293 received   │
│                                     │
│         [Animated counter]          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📊 YOUR BUSIEST DAY                │
│                                     │
│  March 15 - 559 messages            │
│  "That was the day..."              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📈 MESSAGES OVER TIME              │
│  [Line chart - monthly]             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  👥 YOUR TOP PEOPLE                 │
│  [Horizontal bar chart]             │
│                                     │
│  🏆 Your Ride or Die: Mom           │
│     "Responded in avg 42 seconds"   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ⏰ WHEN YOU TEXT                   │
│  [Hour heatmap] [Day of week bars]  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  😂 YOUR EMOJI GAME                 │
│  [Emoji grid with counts]           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  🎭 FUN FACTS                       │
│                                     │
│  • You double-texted 847 times      │
│  • Your 3AM buddy: [name]           │
│  • Longest convo: 6 hours with...   │
└─────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)
- [ ] `db_reader.py` - Read chat.db, export to internal format
- [ ] `models.py` - Data classes
- [ ] `stats.py` - Basic stats (totals, top contacts, busiest day)
- [ ] `cli.py` - Basic CLI with `generate` command
- [ ] Permission checking with helpful error

**Deliverable:** CLI that outputs stats to terminal

### Phase 2: Visualizations
- [ ] `charts.py` - All chart types with plotly
- [ ] `report.py` - HTML template + builder
- [ ] Polished dark theme CSS
- [ ] Auto-open report in browser

**Deliverable:** Beautiful HTML report

### Phase 3: Advanced Stats
- [ ] Response time calculations
- [ ] Streak detection
- [ ] Double-text detection
- [ ] Tapback analysis
- [ ] Emoji/word frequency

**Deliverable:** Full stats spec implemented

### Phase 4: Distribution
- [ ] `app.py` - Simple tkinter GUI
- [ ] PyInstaller build script
- [ ] DMG packaging
- [ ] PyPI packaging
- [ ] README with install instructions

**Deliverable:** Distributable .app and pip package

### Phase 5: Polish
- [ ] App icon design
- [ ] Animations in report
- [ ] Edge case handling
- [ ] Performance optimization for large databases
- [ ] User testing & feedback

---

## Testing Checklist

- [ ] Empty database (new Mac)
- [ ] Small database (<1000 messages)
- [ ] Large database (>100k messages)
- [ ] Group chats with many participants
- [ ] Messages with only emoji
- [ ] Messages with only attachments (no text)
- [ ] Permission denied scenario
- [ ] Different macOS versions (12, 13, 14, 15)
- [ ] Year with sparse data
- [ ] Current year (partial data)

---

## Success Metrics

1. **Installation:** User can install and run in <2 minutes
2. **Performance:** Analysis completes in <30 seconds for 100k messages
3. **Accuracy:** Stats match manual spot-checks
4. **Delight:** Report is shareable and generates "wow" reactions

---

## Future Ideas (v2+)

- Share cards for individual stats (social media images)
- Compare year-over-year
- Export to PDF
- Contact name resolution from Contacts.app
- Sentiment analysis on conversations
- "Your texting personality" classification
- Integration with Shortcuts.app


