#!/bin/bash
# Production build script - creates standalone distributable app

set -e

VERSION="1.0.27"

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

# Check for ALL mounts at this path (there could be multiple!)
EXISTING_MOUNTS=$(mount | grep "/Volumes/${VOLUME_NAME}" | awk '{print $1}' || true)
if [ -n "$EXISTING_MOUNTS" ]; then
    while IFS= read -r device; do
        if [ -n "$device" ]; then
            hdiutil detach "$device" -force 2>/dev/null || true
        fi
    done <<< "$EXISTING_MOUNTS"
    sleep 1
fi

# Remove any existing DMG files
rm -f "${TEMP_DMG}" "${DMG_NAME}"

# Create a temporary DMG
hdiutil create -size 300m -fs HFS+ -volname "${VOLUME_NAME}" "${TEMP_DMG}"

# Mount it and capture the device identifier
ATTACH_OUTPUT=$(hdiutil attach "${TEMP_DMG}" -mountpoint "${MOUNT_DIR}" -nobrowse)
MOUNTED_DEVICE=$(echo "$ATTACH_OUTPUT" | grep "/dev/disk" | awk '{print $1}' | head -n 1)

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

# Note: Window appearance will be configured by sign-dmg.sh
# Skipping AppleScript here to avoid "Resource busy" errors during automated builds

sync
sleep 2

# Unmount by DEVICE not path (handles multiple mounts at same path)
DETACH_SUCCESS=0
for i in {1..5}; do
    if hdiutil detach "${MOUNTED_DEVICE}" -quiet 2>/dev/null; then
        DETACH_SUCCESS=1
        break
    fi
    sleep 2
done

if [ $DETACH_SUCCESS -eq 0 ]; then
    if ! hdiutil detach "${MOUNTED_DEVICE}" -force; then
        echo "❌ Failed to unmount DMG"
        exit 1
    fi
fi

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

# Open dist folder automatically
open dist
