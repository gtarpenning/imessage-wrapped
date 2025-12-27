# iMessage Wrapped

Export and analyze your iMessage conversations from the macOS SQLite database.

<img width="1507" height="810" alt="image" src="https://github.com/user-attachments/assets/704e42ea-4df7-48f8-b21d-8f16d935c815" />
<img width="1507" height="494" alt="image" src="https://github.com/user-attachments/assets/33cc9f63-5257-4442-9775-477ca7608d43" />


## Quick Start

### 🖥️ Desktop App (No Terminal Required!)

[**Download for macOS**](https://imessage-wrapped.fly.dev/api/download)

1. Download and open `iMessage-Wrapped.dmg`
2. Drag to Applications folder
3. Launch the app
4. Click "Analyze My Messages"
5. Your wrapped opens in browser automatically

See [`desktop/`](desktop/) for building from source.

### 💻 Command Line

```bash
pip install imessage-wrapped
imexport
```

That's it! By default, the command will:
1. 🔄 Auto-export your messages (if not already exported)
2. 📊 Analyze your messaging patterns
3. ☁️ Upload anonymized statistics
4. 🔗 Give you a shareable URL like: `https://imessage-wrapped.fly.dev/2025/abc123xyz`

Want to see full details in the terminal instead? Use `imexport --no-share`

### Features

✅ **Dashboard** - Interactive visualizations of your messaging patterns  
✅ **Easy Sharing** - One command to upload and get a shareable link  
✅ **Secure** - HTTPS, encrypted database  
✅ **Favorite Phrases** - Automatically surfaces the sayings you repeat most  
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
# Analyze and share (default behavior)
imexport

# Analyze with full terminal output (no sharing)
imexport --no-share

# Export specific year
imexport --year 2024

# Replace cached export
imexport --replace-cache

# Use local dev server
imexport --dev

# Custom database path
imexport --database /path/to/test/chat.db

# Save statistics to file
imexport --output stats.json

# Show help
imexport --help
```

**Alternatively**, run without installation:

```bash
python -m imessage_wrapped --year 2024
```

## Requirements

- Python 3.10+
- macOS with Full Disk Access permission
- `rich` library for terminal output

## Installation

### From PyPI

```bash
pip install imessage-wrapped
imexport
```

### From Source (Development)

```bash
git clone https://github.com/gtarpenning/imessage-wrapped.git
cd imessage-wrapped
pip install -e .

# Install git hooks (recommended for contributors)
./scripts/install-git-hooks.sh
```

**Git Hooks**: 
- **pre-commit**: Automatically runs linting and type checking on staged Python/web files
- **pre-push**: Validates that the web build compiles before pushing to `main`

## macOS Permissions

Requires **Full Disk Access** to read the iMessage database:

1. Open **System Settings**
2. Go to **Privacy & Security → Full Disk Access**
3. Add Terminal (for CLI) or the Desktop App
4. Restart the application

## Deployment

See [RELEASE-GUIDE.md](RELEASE-GUIDE.md) for deploying the CLI, Desktop App, or Web App.
