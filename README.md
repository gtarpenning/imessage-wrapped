# iMessage Wrapped

Export and analyze your iMessage conversations from the macOS SQLite database.

<img width="1507" height="810" alt="image" src="https://github.com/user-attachments/assets/704e42ea-4df7-48f8-b21d-8f16d935c815" />
<img width="1507" alt="image" src="https://github.com/user-attachments/assets/bcc55823-34b8-4f26-94ba-418f9bce455b" />


## Quick Install & Run

```bash
pip install imessage-wrapped
imexport export --year 2024
imexport analyze --share
```

## 🌐 Web Sharing

Share your iMessage Wrapped with friends via a web dashboard

### Quick Start

```bash
imessage-wrapped analyze --share
```

You'll get a shareable URL like: `https://imessage-wrapped.fly.dev/2025/abc123xyz`

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

After installation, use the `imexport` command:

```bash
# Export current year (default)
imexport export

# Export specific year
imexport export --year 2024

# Custom output path
imexport export --output my_messages.json

# Custom database path (for testing)
imexport export --database /path/to/test/chat.db

# Compact JSON (no indentation)
imexport export --indent 0

# Analyze and share
imexport analyze --share

# Show help
imexport --help
```

**Alternatively**, run without installation:

```bash
python -m imessage_wrapped export --year 2024
```

**CLI Commands:**
- `imexport export`: Export iMessage conversations to JSON
- `imexport analyze`: Analyze and display statistics

**Export Options:**
- `--year, -y`: Year to export (default: current year)
- `--output, -o`: Output file path (default: `exports/imessage_export_YEAR.jsonl`)
- `--database, -d`: Custom database path (default: `~/Library/Messages/chat.db`)
- `--format`: Export format (jsonl or json, default: jsonl)
- `--indent`: JSON indentation (default: 2, use 0 for compact)
- `--skip-permission-check`: Skip permission validation (testing only)

**Analyze Options:**
- `--share`: Upload statistics and get shareable URL
- `--server-url`: Web server URL for sharing
- `--analyzers`: Comma-separated analyzers to run (raw,nlp,llm)

## Requirements

- Python 3.10+
- macOS with Full Disk Access permission
- `rich` library for terminal output

## Installation

### Install in Development Mode

```bash
pip install -e .
```

This installs the package and creates the `imexport` command.

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
imexport export --year 2024 --output my_messages.json
```

3. **Analyze your messages:**

```bash
# Analyze locally
imexport analyze

# Analyze and share online
imexport analyze --share
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

