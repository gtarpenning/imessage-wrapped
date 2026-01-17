# iMessage Wrapped

Export and analyze your iMessage conversations from the macOS SQLite database.

<img width="1507" alt="image" src="https://github.com/user-attachments/assets/87f11171-c375-4d62-a41f-9938e798d4a6" />
<img width="1507" height="494" alt="image" src="https://github.com/user-attachments/assets/33cc9f63-5257-4442-9775-477ca7608d43" />

## Quick Start

### 🖥️ Desktop App

[**Download for macOS**](https://imessage-wrapped.fly.dev/api/download)

1. Download and open `iMessage-Wrapped.dmg`
2. Drag to Applications folder
3. Launch the app and click "Analyze My Messages"
4. Your wrapped opens in browser automatically

### 💻 Command Line

```bash
pip install imessage-wrapped
imexport
```

That's it! The command will auto-export your messages, analyze patterns, upload anonymized statistics, and give you a shareable URL.

**Common options:**
- `imexport --no-share` - View results in terminal only
- `imexport --year 2024` - Analyze specific year
- `imexport --help` - See all options

## Features

✅ **Interactive Dashboard** - Visualizations of your messaging patterns  
✅ **Easy Sharing** - One command to get a shareable link  
✅ **Privacy First** - Your message content never leaves your computer  
✅ **Favorite Phrases** - Automatically surfaces your most-used sayings  

## 🔒 Data Privacy

**Your message content NEVER leaves your computer.**

We only upload aggregated statistics (counts, averages, distributions, emojis, dates). We never upload:
- Message text or content (except for a few most common patterns)
- Contact names (unless exclicitly allowed)
- Phone numbers or emails (hashed only)
- Attachments or personal information

## Requirements & Installation

- **macOS** with Full Disk Access permission
- **Python 3.10+** (for CLI only)

**Installation:**
```bash
pip install imessage-wrapped
```

**macOS Permissions:**
1. Open **System Settings → Privacy & Security → Full Disk Access**
2. Add Terminal (for CLI) or the Desktop App
3. Restart the application
