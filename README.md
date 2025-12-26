# iMessage Year Review

Export and analyze your iMessage conversations from the macOS SQLite database.

## Quick Install & Run

```bash
./install.sh          # Install the mexport command
mexport -y 2024       # Export messages from 2024
mexport --help        # Show all options
```

## 🌐 Web Sharing (NEW!)

Share your iMessage Wrapped with friends via a beautiful web dashboard!

### Quick Start

```bash
# 1. Setup web server (one-time)
cd web
npm install
cp env.example .env.local
# Edit .env.local with your DATABASE_URL

# 2. Start server
npm run dev

# 3. In another terminal: Analyze & Share
imessage-wrapped analyze --share
```

You'll get a shareable URL like: `http://localhost:3000/2025/abc123xyz`

### Features

✅ **Privacy First** - Only anonymized aggregate stats uploaded (no message content)  
✅ **Beautiful Dashboard** - Interactive visualizations of your messaging patterns  
✅ **Easy Sharing** - One command to upload and get a shareable link  
✅ **Secure** - HTTPS, rate limiting, encrypted database  
✅ **Deploy Anywhere** - Fly.io ready (free tier available)  

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

## Architecture

The codebase follows a clean layered architecture with strong separation of concerns:

```
src/imessage_wrapped/
├── models.py          # Data models (Message, Conversation, ExportData)
├── utils.py           # Pure utility functions (timestamps, formatting)
├── db_reader.py       # Database access layer
├── service.py         # Business logic (MessageProcessor, MessageService)
├── exporter.py        # Serialization layer (Protocol-based)
├── permissions.py     # macOS permission handling
├── cli.py             # Command-line interface
└── __init__.py        # Public API
```

### Layer Responsibilities

**Models** (`models.py`)
- Immutable data structures using dataclasses
- Domain entities with computed properties
- No business logic

**Utilities** (`utils.py`)
- Pure functions for timestamp conversion
- Text extraction from attributed bodies
- Tapback type mapping

**Database** (`db_reader.py`)
- SQLite connection management
- Query execution with streaming support
- Context manager interface

**Service** (`service.py`)
- `MessageProcessor`: Transforms raw DB rows into domain models
- `MessageService`: Orchestrates the export process
- Handles tapback linking and conversation grouping

**Exporter** (`exporter.py`)
- Protocol-based serialization (easily extensible)
- `JSONSerializer` implementation
- File I/O abstraction

**Permissions** (`permissions.py`)
- Database access validation
- User-friendly error messages with rich formatting

## Usage

### As a Library

```python
from imessage_wrapped import MessageService, Exporter

service = MessageService()
data = service.export_year(2025)

exporter = Exporter()
exporter.export_to_file(data, "messages_2025.json")
```

See `example_usage.py` for a complete working example.

### As a CLI

After installation, use the `mexport` command:

```bash
# Export current year (default)
mexport

# Export specific year
mexport -y 2024

# Custom output path
mexport -o my_messages.json

# Custom database path (for testing)
mexport -d /path/to/test/chat.db

# Compact JSON (no indentation)
mexport --indent 0

# All options together
mexport -y 2023 -o archive.json -d ~/test.db --indent 4

# Show help
mexport --help
```

**Alternatively**, run without installation:

```bash
python -m imessage_wrapped -y 2024
```

**CLI Options:**
- `-y, --year`: Year to export (default: current year)
- `-o, --output`: Output file path (default: `imessage_export_YEAR.json`)
- `-d, --database`: Custom database path (default: `~/Library/Messages/chat.db`)
- `--indent`: JSON indentation (default: 2, use 0 for compact)
- `--skip-permission-check`: Skip permission validation (testing only)

## Requirements

- Python 3.10+
- macOS with Full Disk Access permission
- `rich` library for terminal output

## Installation

### Install in Development Mode

```bash
pip install -e .
```

This installs the package and creates the `mexport` command.

### Install Dependencies Only

```bash
pip install -r requirements.txt
```

## Quick Start

1. **Install the package:**

```bash
./install.sh
# or manually: pip install -e .
```

2. **Run the exporter:**

```bash
mexport -y 2024 -o my_messages.json
```

3. **Run the test script:**

```bash
./test_export.sh
```

Or test manually:

```bash
# Quick test with current year
mexport -o test.json

# Test with custom year
mexport -y 2024 -o test_2024.json

# Test library usage
python example_usage.py
```

## Extending

### Custom Serializers

Implement the `Serializer` protocol:

```python
from imessage_wrapped import Exporter, ExportData

class CSVSerializer:
    def serialize(self, data: ExportData) -> str:
        # Your implementation
        pass

exporter = Exporter(serializer=CSVSerializer())
```

### Custom Database Paths

```python
service = MessageService(db_path="/path/to/chat.db")
```

## macOS Permissions

This application requires **Full Disk Access** to read the iMessage database:

1. Open **System Settings**
2. Go to **Privacy & Security → Full Disk Access**
3. Add Terminal or your Python application
4. Restart the application

