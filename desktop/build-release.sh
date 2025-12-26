#!/bin/bash
# Production build script - creates standalone distributable app

set -e

VERSION="1.0.14"

echo "🏗️  Building iMessage Wrapped v${VERSION} (Production)..."
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
echo "🔍 DEBUG: Listing mounted volumes before cleanup:"
mount | grep -i "iMessage\|disk" || echo "  No relevant mounts found"
echo ""

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

echo "🔍 DEBUG: Checking for existing mounts at ${MOUNT_DIR}..."
if [ -d "${MOUNT_DIR}" ]; then
    echo "  ⚠️  Mount point already exists, attempting cleanup..."
    hdiutil detach "${MOUNT_DIR}" -force 2>/dev/null || true
    sleep 1
fi

echo "🔍 DEBUG: Cleaning up any existing temp.dmg..."
rm -f "${TEMP_DMG}"

# Create a temporary DMG
echo "🔍 DEBUG: Creating temporary DMG..."
hdiutil create -size 300m -fs HFS+ -volname "${VOLUME_NAME}" "${TEMP_DMG}"

# Mount it
echo "🔍 DEBUG: Mounting DMG at ${MOUNT_DIR}..."
hdiutil attach "${TEMP_DMG}" -mountpoint "${MOUNT_DIR}" -nobrowse
echo "🔍 DEBUG: Mount successful"
echo "🔍 DEBUG: Current mounts:"
mount | grep -i "iMessage\|/Volumes" || echo "  No relevant mounts found"

# Copy the app
echo "🔍 DEBUG: Copying app to DMG..."
cp -R "dist/iMessage Wrapped.app" "${MOUNT_DIR}/"
echo "🔍 DEBUG: App copy complete"

# Create Applications folder symlink
echo "🔍 DEBUG: Creating Applications symlink..."
ln -s /Applications "${MOUNT_DIR}/Applications"
echo "🔍 DEBUG: Symlink created"

# Create background image if it doesn't exist
if [ ! -f "dmg-background.png" ]; then
    echo "Creating DMG background image..."
    bash create-dmg-background.sh
fi

# Copy background image to DMG (hidden)
echo "🔍 DEBUG: Adding background image..."
mkdir -p "${MOUNT_DIR}/.background"
cp dmg-background.png "${MOUNT_DIR}/.background/"
echo "🔍 DEBUG: Background added"

# Note: Window appearance will be configured by sign-dmg.sh
# Skipping AppleScript here to avoid "Resource busy" errors during automated builds

echo "🔍 DEBUG: Syncing filesystem..."
sync
sleep 2

echo "🔍 DEBUG: Checking for processes accessing the volume..."
lsof | grep "${MOUNT_DIR}" || echo "  No processes found accessing ${MOUNT_DIR}"

echo "🔍 DEBUG: Attempting to unmount ${MOUNT_DIR}..."
echo "🔍 DEBUG: Current mounts before detach:"
mount | grep -i "iMessage\|/Volumes" || echo "  No relevant mounts found"

# Unmount quickly with retry logic
DETACH_SUCCESS=0
for i in {1..5}; do
    echo "🔍 DEBUG: Detach attempt $i/5..."
    if hdiutil detach "${MOUNT_DIR}" -quiet 2>/dev/null; then
        echo "🔍 DEBUG: ✅ Successfully detached on attempt $i"
        DETACH_SUCCESS=1
        break
    fi
    echo "🔍 DEBUG: Detach failed, waiting 2 seconds..."
    sleep 2
done

if [ $DETACH_SUCCESS -eq 0 ]; then
    echo "🔍 DEBUG: ⚠️  Regular detach failed, trying force detach..."
    if hdiutil detach "${MOUNT_DIR}" -force; then
        echo "🔍 DEBUG: ✅ Force detach successful"
    else
        echo "🔍 DEBUG: ❌ Even force detach failed!"
        echo "🔍 DEBUG: Listing all disk images:"
        hdiutil info
        exit 1
    fi
fi

echo "🔍 DEBUG: Mounts after detach:"
mount | grep -i "iMessage\|/Volumes" || echo "  No relevant mounts found"

# Convert to compressed DMG
echo "🔍 DEBUG: Converting to compressed DMG format..."
echo "🔍 DEBUG: Input: ${TEMP_DMG}, Output: ${DMG_NAME}"
hdiutil convert "${TEMP_DMG}" -format UDZO -o "${DMG_NAME}"
echo "🔍 DEBUG: Conversion complete"

# Cleanup
echo "🔍 DEBUG: Removing temporary DMG..."
rm "${TEMP_DMG}"
echo "🔍 DEBUG: Cleanup complete"

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

