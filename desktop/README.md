# iMessage Wrapped - Desktop App

A native macOS menu bar app for analyzing your iMessage history.

## Quick Start

```bash
# Run directly (development)
python gui.py

# Build standalone app
./build-release.sh

# Deploy to Fly.io
./deploy-to-web.sh
```

## Features

- 💌 Lives in menu bar (unobtrusive)
- Native macOS notifications for progress
- Auto-opens browser with results
- One-click analysis
- No configuration needed

## Requirements

- macOS 12.0+
- Python 3.10+ (for development/building)
- Full Disk Access permission

## How It Works

1. 💌 icon appears in menu bar
2. Click → "Analyze My Messages"
3. Grant Full Disk Access if prompted
4. Watch notifications (icon changes to ⏳)
5. Browser opens automatically with your wrapped
6. Done! (icon shows ✅ then returns to 💌)

## Building

### Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run app
python gui.py
```

### Production

```bash
# Clean build
rm -rf build dist *.dmg

# Build standalone app + DMG
./build-release.sh

# Output: iMessage-Wrapped-1.0.0.dmg (~15-20 MB)
```

## Distribution

See `DEPLOY.md` for deployment instructions.

## Files

- `gui.py` - Main app (rumps menu bar app)
- `setup.py` - py2app build configuration
- `requirements.txt` - Dependencies
- `icon.icns` - App icon (💌 emoji)
- `build.sh` - Fast dev builds
- `build-release.sh` - Production builds
- `deploy-to-web.sh` - Deploy to Fly.io
- `generate-emoji-icon.py` - Regenerate icon from emoji
- `create-icon.sh` - Convert PNG to .icns

## Customization

### Change Icon

```python
# In gui.py, line ~20
super().__init__(
    "📱",  # Change to any emoji
    title="iMessage Wrapped",
    quit_button=None
)
```

### Change Server URL

```python
# In gui.py, line ~100
uploader = StatsUploader(
    base_url="https://your-server.com"
)
```

## Troubleshooting

### Icon doesn't appear

```bash
# Check if running
ps aux | grep "python gui.py"

# Check logs
open -a Console  # Search for "iMessage Wrapped"
```

### Permission denied

- System Settings → Privacy & Security → Full Disk Access
- Add Terminal (for testing) or the app
- Restart app

### Build fails

```bash
# Reinstall dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

## Tech Stack

- **Framework**: rumps (menu bar apps)
- **Packaging**: py2app (standalone macOS apps)
- **Backend**: imessage_wrapped (from `../src`)

## License

MIT (same as main project)
