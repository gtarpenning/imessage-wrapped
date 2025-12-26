# Converting iMessage Wrapped to a macOS App

This document outlines the steps required to convert the `imessage-wrapped` Python module into a proper macOS application bundle (.app).

## Overview

Currently, `imessage-wrapped` is a Python CLI tool. Converting it to a macOS app involves:
1. Bundling Python + dependencies into a standalone executable
2. Creating a macOS .app bundle structure
3. Code signing and notarization for distribution
4. Creating an installer (DMG)
5. Handling Full Disk Access permissions properly

## Approach Options

### Option 1: CLI App Bundle (Recommended for Start)
Keep the CLI interface but package it as a macOS app that can be double-clicked.
- **Pros**: Minimal code changes, leverages existing CLI
- **Cons**: Terminal-based UI, less native feel
- **Tools**: py2app or PyInstaller

### Option 2: GUI Wrapper Around CLI
Add a simple GUI frontend that calls the existing CLI.
- **Pros**: More user-friendly, native feel
- **Cons**: Additional GUI development
- **Tools**: py2app + Tkinter/PyQt/Rumps (menu bar app)

### Option 3: Full Native macOS App
Rebuild using Swift/SwiftUI with Python bridge or pure Swift.
- **Pros**: Fully native, best user experience, App Store eligible
- **Cons**: Significant rewrite, Swift learning curve
- **Tools**: Xcode, Swift

## Recommended Path: Start with Option 1, Evolve to Option 2

---

## Step 1: Install Build Tools

### Using py2app (Recommended for macOS)

```bash
pip install py2app
```

py2app is specifically designed for macOS and creates proper .app bundles.

### Alternative: PyInstaller

```bash
pip install pyinstaller
```

PyInstaller is cross-platform but works well on macOS.

---

## Step 2: Create Application Entry Point

### For py2app

Create `setup_app.py` in project root:

```python
from setuptools import setup

APP = ['src/imessage_wrapped/__main__.py']
DATA_FILES = []
OPTIONS = {
    'argv_emulation': True,
    'packages': ['rich', 'imessage_wrapped'],
    'iconfile': 'assets/icon.icns',  # Optional: custom icon
    'plist': {
        'CFBundleName': 'iMessage Wrapped',
        'CFBundleDisplayName': 'iMessage Wrapped',
        'CFBundleIdentifier': 'com.yourdomain.imessage-wrapped',
        'CFBundleVersion': '0.1.0',
        'CFBundleShortVersionString': '0.1.0',
        'NSRequiresAquaSystemAppearance': False,  # Support dark mode
        'NSAppleEventsUsageDescription': 'Export your iMessage data',
        'NSSystemAdministrationUsageDescription': 'Access iMessage database',
    }
}

setup(
    app=APP,
    name='iMessage Wrapped',
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
```

### For PyInstaller

Create `imessage_wrapped.spec`:

```python
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['src/imessage_wrapped/__main__.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['rich', 'imessage_wrapped'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='iMessage Wrapped',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Set to False for no console window
    disable_windowed_traceback=False,
    argv_emulation=True,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/icon.icns',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='iMessage Wrapped',
)

app = BUNDLE(
    coll,
    name='iMessage Wrapped.app',
    icon='assets/icon.icns',
    bundle_identifier='com.yourdomain.imessage-wrapped',
    info_plist={
        'NSRequiresAquaSystemAppearance': False,
        'NSAppleEventsUsageDescription': 'Export your iMessage data',
        'NSSystemAdministrationUsageDescription': 'Access iMessage database',
    },
)
```

---

## Step 3: Create App Icon

macOS apps need an `.icns` icon file containing multiple resolutions.

### Create Icon Assets

1. Design a 1024x1024 PNG icon
2. Convert to .icns format:

```bash
mkdir assets
mkdir assets/icon.iconset

# Create required sizes
sips -z 16 16     icon_1024.png --out assets/icon.iconset/icon_16x16.png
sips -z 32 32     icon_1024.png --out assets/icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon_1024.png --out assets/icon.iconset/icon_32x32.png
sips -z 64 64     icon_1024.png --out assets/icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon_1024.png --out assets/icon.iconset/icon_128x128.png
sips -z 256 256   icon_1024.png --out assets/icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon_1024.png --out assets/icon.iconset/icon_256x256.png
sips -z 512 512   icon_1024.png --out assets/icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon_1024.png --out assets/icon.iconset/icon_512x512.png
sips -z 1024 1024 icon_1024.png --out assets/icon.iconset/icon_512x512@2x.png

# Convert to icns
iconutil -c icns assets/icon.iconset -o assets/icon.icns
```

---

## Step 4: Build the Application

### Using py2app

```bash
# Development build (alias mode - faster)
python setup_app.py py2app -A

# Production build
python setup_app.py py2app

# Output: dist/iMessage Wrapped.app
```

### Using PyInstaller

```bash
pyinstaller imessage_wrapped.spec

# Output: dist/iMessage Wrapped.app
```

---

## Step 5: Test the Application

```bash
# Run the built app
open "dist/iMessage Wrapped.app"

# Or run directly
./dist/iMessage\ Wrapped.app/Contents/MacOS/iMessage\ Wrapped
```

### Testing Checklist

- [ ] App launches without errors
- [ ] Can access command-line arguments (if needed)
- [ ] Can read iMessage database with Full Disk Access
- [ ] Rich terminal output displays correctly
- [ ] Export functionality works end-to-end

---

## Step 6: Code Signing

Required for distribution and to avoid "unidentified developer" warnings.

### Prerequisites

1. Apple Developer account ($99/year)
2. Developer ID Application certificate installed in Keychain

### Sign the Application

```bash
# Find your signing identity
security find-identity -v -p codesigning

# Sign the app
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --options runtime \
  --entitlements entitlements.plist \
  "dist/iMessage Wrapped.app"

# Verify signature
codesign --verify --deep --strict --verbose=2 "dist/iMessage Wrapped.app"
spctl -a -vvv -t install "dist/iMessage Wrapped.app"
```

### Create entitlements.plist

Required for Full Disk Access and notarization:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

---

## Step 7: Notarization

Apple's notarization service scans your app for malicious content.

### Create App-Specific Password

1. Go to https://appleid.apple.com
2. Sign in → Security → App-Specific Passwords
3. Generate password for "notarization"
4. Save securely

### Store Credentials

```bash
xcrun notarytool store-credentials "notarization-profile" \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password"
```

### Create ZIP and Submit

```bash
# Create zip archive
ditto -c -k --keepParent "dist/iMessage Wrapped.app" "dist/iMessage-Wrapped.zip"

# Submit for notarization
xcrun notarytool submit "dist/iMessage-Wrapped.zip" \
  --keychain-profile "notarization-profile" \
  --wait

# Staple the notarization ticket (after success)
xcrun stapler staple "dist/iMessage Wrapped.app"

# Verify
xcrun stapler validate "dist/iMessage Wrapped.app"
```

---

## Step 8: Create DMG Installer

Professional macOS apps are distributed as DMG files.

### Using create-dmg Tool

```bash
# Install create-dmg
brew install create-dmg

# Create DMG
create-dmg \
  --volname "iMessage Wrapped" \
  --volicon "assets/icon.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "iMessage Wrapped.app" 200 190 \
  --hide-extension "iMessage Wrapped.app" \
  --app-drop-link 600 185 \
  --no-internet-enable \
  "dist/iMessage-Wrapped-v0.1.0.dmg" \
  "dist/iMessage Wrapped.app"
```

### Sign and Notarize DMG

```bash
# Sign DMG
codesign --sign "Developer ID Application: Your Name (TEAM_ID)" \
  "dist/iMessage-Wrapped-v0.1.0.dmg"

# Notarize DMG
xcrun notarytool submit "dist/iMessage-Wrapped-v0.1.0.dmg" \
  --keychain-profile "notarization-profile" \
  --wait

# Staple
xcrun stapler staple "dist/iMessage-Wrapped-v0.1.0.dmg"
```

---

## Step 9: Full Disk Access Handling

The app needs Full Disk Access to read `~/Library/Messages/chat.db`.

### Update Permission Checking

Modify `src/imessage_wrapped/permissions.py` to include GUI-friendly instructions:

```python
def require_database_access(db_path: str = None) -> None:
    """Check and guide user through Full Disk Access setup."""
    if not can_access_database(db_path):
        console = Console()
        panel = Panel(
            "[bold yellow]Full Disk Access Required[/]\n\n"
            "To read your iMessage database, this app needs Full Disk Access.\n\n"
            "[bold]Steps:[/]\n"
            "1. Open System Settings\n"
            "2. Go to Privacy & Security → Full Disk Access\n"
            "3. Click the [+] button\n"
            "4. Navigate to Applications and add 'iMessage Wrapped'\n"
            "5. Restart this app\n\n"
            "[dim]After granting access, you may need to restart your Mac.[/]",
            title="⚠️  Permission Needed",
            border_style="yellow",
        )
        console.print(panel)
        
        # Optionally open System Settings
        import subprocess
        response = console.input("\nOpen System Settings now? (y/n): ")
        if response.lower() == 'y':
            subprocess.run([
                "open",
                "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
            ])
        
        raise PermissionError("Database access denied")
```

---

## Step 10: Automation Script

Create `build_app.sh` to automate the build process:

```bash
#!/bin/bash
set -e

VERSION="0.1.0"
APP_NAME="iMessage Wrapped"
BUNDLE_ID="com.yourdomain.imessage-wrapped"
SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

echo "🔨 Building $APP_NAME v$VERSION"

# Clean previous builds
rm -rf build dist

# Build with py2app
echo "📦 Building app bundle..."
python setup_app.py py2app

# Sign the app
echo "✍️  Code signing..."
codesign --deep --force --verify --verbose \
  --sign "$SIGNING_IDENTITY" \
  --options runtime \
  --entitlements entitlements.plist \
  "dist/$APP_NAME.app"

# Verify
echo "✅ Verifying signature..."
codesign --verify --deep --strict --verbose=2 "dist/$APP_NAME.app"

# Create zip for notarization
echo "📦 Creating archive..."
ditto -c -k --keepParent "dist/$APP_NAME.app" "dist/$APP_NAME.zip"

# Notarize
echo "📮 Submitting for notarization..."
xcrun notarytool submit "dist/$APP_NAME.zip" \
  --keychain-profile "notarization-profile" \
  --wait

# Staple
echo "📎 Stapling ticket..."
xcrun stapler staple "dist/$APP_NAME.app"

# Create DMG
echo "💿 Creating DMG installer..."
create-dmg \
  --volname "$APP_NAME" \
  --volicon "assets/icon.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "$APP_NAME.app" 200 190 \
  --hide-extension "$APP_NAME.app" \
  --app-drop-link 600 185 \
  "dist/$APP_NAME-v$VERSION.dmg" \
  "dist/$APP_NAME.app"

# Sign DMG
echo "✍️  Signing DMG..."
codesign --sign "$SIGNING_IDENTITY" "dist/$APP_NAME-v$VERSION.dmg"

# Notarize DMG
echo "📮 Notarizing DMG..."
xcrun notarytool submit "dist/$APP_NAME-v$VERSION.dmg" \
  --keychain-profile "notarization-profile" \
  --wait

# Staple DMG
xcrun stapler staple "dist/$APP_NAME-v$VERSION.dmg"

echo ""
echo "✅ Build complete!"
echo "📦 App: dist/$APP_NAME.app"
echo "💿 DMG: dist/$APP_NAME-v$VERSION.dmg"
```

Make it executable:

```bash
chmod +x build_app.sh
```

---

## Optional Enhancements

### Option A: Add Menu Bar App (Rumps)

Create a simple menu bar interface:

```bash
pip install rumps
```

Create `src/imessage_wrapped/gui_menubar.py`:

```python
import rumps
from .cli import main as cli_main

class iMessageWrappedApp(rumps.App):
    def __init__(self):
        super().__init__("iMessage Wrapped", icon="assets/icon.png")
        self.menu = [
            "Export Current Year",
            "Export 2024",
            "Export 2023",
            None,
            "About"
        ]
    
    @rumps.clicked("Export Current Year")
    def export_current(self, _):
        # Call CLI in background
        import subprocess
        subprocess.Popen(["mexport"])
    
    @rumps.clicked("About")
    def about(self, _):
        rumps.alert("iMessage Wrapped", "Export your iMessage data\nVersion 0.1.0")

def main():
    iMessageWrappedApp().run()
```

### Option B: Add Simple GUI (Tkinter)

Create `src/imessage_wrapped/gui_window.py`:

```python
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from datetime import datetime
from . import MessageService, Exporter

class iMessageWrappedGUI:
    def __init__(self, root):
        self.root = root
        root.title("iMessage Wrapped")
        root.geometry("500x400")
        
        # Year selection
        ttk.Label(root, text="Export Year:").pack(pady=10)
        self.year_var = tk.IntVar(value=datetime.now().year)
        ttk.Entry(root, textvariable=self.year_var).pack()
        
        # Output path
        ttk.Label(root, text="Output File:").pack(pady=10)
        self.output_var = tk.StringVar()
        ttk.Entry(root, textvariable=self.output_var, width=40).pack()
        ttk.Button(root, text="Browse...", command=self.browse_output).pack()
        
        # Export button
        ttk.Button(root, text="Export Messages", command=self.export).pack(pady=20)
        
        # Status
        self.status = tk.Label(root, text="", fg="blue")
        self.status.pack()
    
    def browse_output(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if path:
            self.output_var.set(path)
    
    def export(self):
        try:
            year = self.year_var.get()
            output = self.output_var.get()
            
            if not output:
                output = f"imessage_export_{year}.json"
            
            self.status.config(text="Exporting...", fg="blue")
            self.root.update()
            
            service = MessageService()
            data = service.export_year(year)
            
            exporter = Exporter()
            exporter.export_to_file(data, output)
            
            self.status.config(text=f"✓ Exported {data.total_messages} messages!", fg="green")
            messagebox.showinfo("Success", f"Exported to {output}")
        except Exception as e:
            self.status.config(text=f"Error: {e}", fg="red")
            messagebox.showerror("Error", str(e))

def main():
    root = tk.Tk()
    app = iMessageWrappedGUI(root)
    root.mainloop()
```

Update `setup_app.py` to use GUI entry point:

```python
APP = ['src/imessage_wrapped/gui_window.py']
OPTIONS = {
    'argv_emulation': False,  # Disable for GUI
    'packages': ['rich', 'imessage_wrapped', 'tkinter'],
    # ... rest of options
}
```

---

## Checklist for Production Release

- [ ] Icon designed and converted to .icns
- [ ] App builds without errors (py2app or PyInstaller)
- [ ] App functions correctly when double-clicked
- [ ] Full Disk Access prompts and instructions work
- [ ] Export functionality tested end-to-end
- [ ] Code signing certificate obtained
- [ ] App signed with Developer ID
- [ ] Entitlements configured correctly
- [ ] App notarized by Apple
- [ ] Notarization ticket stapled
- [ ] DMG installer created
- [ ] DMG signed and notarized
- [ ] Tested on clean macOS install
- [ ] README updated with installation instructions
- [ ] Version numbers consistent across files

---

## File Structure After Completion

```
msg-review/
├── assets/
│   ├── icon.icns
│   └── icon.iconset/
├── build/               # Build artifacts (gitignored)
├── dist/                # Distribution files (gitignored)
│   ├── iMessage Wrapped.app
│   └── iMessage-Wrapped-v0.1.0.dmg
├── setup_app.py         # py2app configuration
├── entitlements.plist   # macOS entitlements
├── build_app.sh         # Automated build script
└── src/imessage_wrapped/
    └── gui_window.py    # Optional GUI
```

---

## Resources

- [py2app Documentation](https://py2app.readthedocs.io/)
- [PyInstaller Manual](https://pyinstaller.org/)
- [Apple Code Signing Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow)
- [create-dmg Tool](https://github.com/create-dmg/create-dmg)
- [macOS App Bundle Structure](https://developer.apple.com/library/archive/documentation/CoreFoundation/Conceptual/CFBundles/BundleTypes/BundleTypes.html)

---

## Next Steps

1. **Phase 1**: Build basic CLI app bundle with py2app
2. **Phase 2**: Add code signing and notarization
3. **Phase 3**: Create professional DMG installer
4. **Phase 4**: (Optional) Add simple GUI or menu bar interface
5. **Phase 5**: Distribute via website or explore App Store submission

Choose your path based on your target audience and distribution goals.

