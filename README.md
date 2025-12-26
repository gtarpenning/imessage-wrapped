# iMessage Wrapped

Export and analyze your iMessage conversations from the macOS SQLite database.

<img width="1507" height="810" alt="image" src="https://github.com/user-attachments/assets/704e42ea-4df7-48f8-b21d-8f16d935c815" />
<img width="1507" alt="image" src="https://github.com/user-attachments/assets/bcc55823-34b8-4f26-94ba-418f9bce455b" />


## Quick Install & Run

```bash
pip install imessage-wrapped
imexport analyze
```

## 🌐 Web Sharing

Share your iMessage Wrapped with friends via a web dashboard

### Quick Start

```bash
imexport analyze
```

That's it! By default, the command will:
1. 🔄 Auto-export your messages (if not already exported)
2. 📊 Analyze your messaging patterns
3. ☁️ Upload anonymized statistics
4. 🔗 Give you a shareable URL like: `https://imessage-wrapped.fly.dev/2025/abc123xyz`

Want to see full details in the terminal instead? Use `imexport analyze --no-share`

### Features

✅ **Dashboard** - Interactive visualizations of your messaging patterns  
✅ **Easy Sharing** - One command to upload and get a shareable link  
✅ **Secure** - HTTPS, encrypted database  
✅ **Deploy Anywhere** - Fly.io ready (free tier available)  

## 🔒 Data Privacy

**Your message content NEVER leaves your computer.**

By default, we only upload aggregated statistics to create your shareable link. Here's exactly what is and isn't uploaded:

### ✅ What IS Uploaded (Statistics Only)

- **Counts**: Total messages sent/received, tapbacks given/received, attachments, etc.
- **Averages**: Message length, response times, punctuation usage
- **Distributions**: Hour of day, day of week, month patterns
- **Emojis**: Which emojis you used and how often
- **Dates**: Your busiest messaging days, streak lengths
- **Anonymized Identifiers**: Contact identifiers are SHA256-hashed (e.g., `phone_a3b2c1d4e5f6`)

### ❌ What is NOT Uploaded (Stays Private)

- **Message Text**: No actual message content is ever sent
- **Contact Names**: All names are stripped out before upload
- **Phone Numbers/Emails**: Original identifiers are one-way hashed
- **Conversation Content**: No snippets, samples, or quotes
- **Attachments**: No photos, videos, or file content
- **Personal Info**: Nothing that could identify you or your contacts

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

# Analyze and share (default behavior)
imexport analyze

# Analyze with full terminal output (no sharing)
imexport analyze --no-share

# Show help
imexport --help
```

**Alternatively**, run without installation:

```bash
python -m imessage_wrapped export --year 2024
```

**CLI Commands:**
- `imexport export`: Export iMessage conversations to JSON
- `imexport analyze`: Analyze and share your wrapped (auto-exports if needed, use `--no-share` for full terminal output)

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

## macOS Permissions

This application requires **Full Disk Access** to read the iMessage database:

1. Open **System Settings**
2. Go to **Privacy & Security → Full Disk Access**
3. Add Terminal or your Python application
4. Restart the application

