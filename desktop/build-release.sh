#!/bin/bash
# Production build script - creates standalone distributable app

set -e

VERSION="1.0.1"

echo "🏗️  Building iMessage Wrapped v${VERSION} (Production)..."
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf build dist

# Build standalone app with py2app
echo "📦 Building standalone app..."
python setup.py py2app

if [ ! -d "dist/iMessage Wrapped.app" ]; then
    echo "❌ Build failed - app not found"
    exit 1
fi

# Get app size
APP_SIZE=$(du -sh "dist/iMessage Wrapped.app" | cut -f1)
echo "✅ App built successfully (${APP_SIZE})"

# Create DMG
echo "📀 Creating DMG..."
DMG_NAME="iMessage-Wrapped-${VERSION}.dmg"

hdiutil create -volname "iMessage Wrapped" \
  -srcfolder "dist/iMessage Wrapped.app" \
  -ov -format UDZO "${DMG_NAME}"

DMG_SIZE=$(du -sh "${DMG_NAME}" | cut -f1)
echo "✅ DMG created successfully (${DMG_SIZE})"

echo ""
echo "🎉 Build complete!"
echo ""
echo "📦 Distributable file: ${DMG_NAME}"
echo "📱 App bundle: dist/iMessage Wrapped.app"
echo ""
echo "Next steps:"
echo "  1. Test: open 'dist/iMessage Wrapped.app'"
echo "  2. Sign (optional): codesign --deep --force --sign 'Developer ID' 'dist/iMessage Wrapped.app'"
echo "  3. Distribute: Upload ${DMG_NAME} to GitHub Releases"
echo ""

# Optional: Open dist folder
read -p "Open dist folder? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open dist
fi

