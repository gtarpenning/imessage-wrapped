#!/bin/bash
# Production build script - creates standalone distributable app

set -e

VERSION="1.0.11"

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

# Create DMG with Applications folder
echo "📀 Creating DMG with installer UI..."
DMG_NAME="iMessage-Wrapped-${VERSION}.dmg"
TEMP_DMG="temp.dmg"
VOLUME_NAME="iMessage Wrapped"
MOUNT_DIR="/Volumes/${VOLUME_NAME}"

# Create a temporary DMG
hdiutil create -size 300m -fs HFS+ -volname "${VOLUME_NAME}" "${TEMP_DMG}"

# Mount it
hdiutil attach "${TEMP_DMG}" -mountpoint "${MOUNT_DIR}"

# Copy the app
cp -R "dist/iMessage Wrapped.app" "${MOUNT_DIR}/"

# Create Applications folder symlink
ln -s /Applications "${MOUNT_DIR}/Applications"

# Create background image if it doesn't exist
if [ ! -f "dmg-background.png" ]; then
    echo "Creating DMG background image..."
    bash create-dmg-background.sh
fi

# Copy background image to DMG (hidden)
mkdir -p "${MOUNT_DIR}/.background"
cp dmg-background.png "${MOUNT_DIR}/.background/"

# Configure DMG appearance with AppleScript
echo '
   tell application "Finder"
     tell disk "'${VOLUME_NAME}'"
           open
           set current view of container window to icon view
           set toolbar visible of container window to false
           set statusbar visible of container window to false
           set the bounds of container window to {100, 100, 700, 550}
           set viewOptions to the icon view options of container window
           set arrangement of viewOptions to not arranged
           set icon size of viewOptions to 100
           set background picture of viewOptions to file ".background:dmg-background.png"
           set position of item "iMessage Wrapped.app" of container window to {150, 200}
           set position of item "Applications" of container window to {450, 200}
           update without registering applications
           delay 1
     end tell
   end tell
' | osascript || true

# Unmount (force if needed, don't fail the build)
sleep 1
hdiutil detach "${MOUNT_DIR}" 2>/dev/null || hdiutil detach "${MOUNT_DIR}" -force || true

# Convert to compressed DMG
hdiutil convert "${TEMP_DMG}" -format UDZO -o "${DMG_NAME}"

# Cleanup
rm "${TEMP_DMG}"

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

