#!/bin/bash
# Sign and notarize a local DMG file

set -e

REPO="gtarpenning/imessage-wrapped"

# Check for DMG argument
if [ -z "$1" ]; then
    echo "Usage: ./sign-dmg.sh <path-to-dmg>"
    echo "Example: ./sign-dmg.sh iMessage-Wrapped-1.0.5.dmg"
    exit 1
fi

ORIGINAL_DMG="$1"

if [ ! -f "$ORIGINAL_DMG" ]; then
    echo "❌ DMG not found: $ORIGINAL_DMG"
    exit 1
fi

echo "🔐 Signing: $ORIGINAL_DMG"
echo ""

# Mount and extract
echo "📂 Extracting app from DMG..."
hdiutil attach "$ORIGINAL_DMG" -mountpoint /Volumes/iMessageWrapped -nobrowse -quiet
cp -R "/Volumes/iMessageWrapped/iMessage Wrapped.app" ./
hdiutil detach /Volumes/iMessageWrapped -quiet
echo "✅ Extracted"

APP_PATH="iMessage Wrapped.app"

# Sign all binaries inside the app
echo ""
echo "📝 Signing all internal binaries..."

# Sign all .so files
echo "  Signing Python extension modules..."
find "$APP_PATH" -type f -name "*.so" | while read file; do
    codesign --force --sign "$SIGNING_IDENTITY" --options runtime --timestamp "$file" 2>&1 | grep -v "signed Mach-O" || true
done

# Sign all .dylib files  
echo "  Signing dynamic libraries..."
find "$APP_PATH" -type f -name "*.dylib" | while read file; do
    codesign --force --sign "$SIGNING_IDENTITY" --options runtime --timestamp "$file" 2>&1 | grep -v "signed Mach-O" || true
done

# Sign frameworks
echo "  Signing frameworks..."
find "$APP_PATH/Contents/Frameworks" -type d -name "*.framework" 2>/dev/null | while read framework; do
    codesign --force --sign "$SIGNING_IDENTITY" --options runtime --timestamp "$framework" 2>&1 | grep -v "signed Mach-O" || true
done

echo "✅ All internal binaries signed"

# Sign the main app bundle
echo ""
echo "📝 Signing app bundle..."
codesign --force --sign "$SIGNING_IDENTITY" \
    --options runtime \
    --timestamp \
    --deep \
    "$APP_PATH"

echo "✅ App bundle signed"

# Verify
echo ""
echo "🔍 Verifying signature..."
if codesign --verify --verbose=2 "$APP_PATH" 2>&1; then
    echo "✅ Signature valid"
else
    echo "⚠️  Verification had warnings but continuing..."
fi

# Create new DMG
echo ""
echo "📀 Creating signed DMG..."
SIGNED_DMG="signed-$(basename "$ORIGINAL_DMG")"
TEMP_DMG="temp.dmg"
VOLUME_NAME="iMessage Wrapped"
MOUNT_DIR="/Volumes/${VOLUME_NAME}"

# Cleanup any previous runs
echo "Cleaning up any previous runs..."
rm -f "${TEMP_DMG}" "${SIGNED_DMG}"
hdiutil detach "${MOUNT_DIR}" 2>/dev/null || true

echo "Creating temporary DMG..."
hdiutil create -size 300m -fs HFS+ -volname "${VOLUME_NAME}" "${TEMP_DMG}"

echo "Attaching temporary DMG..."
# Unmount if already mounted
hdiutil detach "${MOUNT_DIR}" 2>/dev/null || true
hdiutil attach "${TEMP_DMG}" -mountpoint "${MOUNT_DIR}" -nobrowse

echo "Copying app bundle to temporary DMG..."
cp -R "$APP_PATH" "${MOUNT_DIR}/" || { echo "❌ Copy failed"; exit 1; }

echo "Creating Applications symlink..."
ln -s /Applications "${MOUNT_DIR}/Applications" || { echo "❌ Symlink failed"; exit 1; }

echo "Syncing..."
sync

# Icon layout (with timeout to prevent hanging)
# timeout 10 osascript <<EOF 2>/dev/null || true
# tell application "Finder"
#   tell disk "${VOLUME_NAME}"
#     open
#     set current view of container window to icon view
#     set toolbar visible of container window to false
#     set statusbar visible of container window to false
#     set the bounds of container window to {400, 100, 900, 500}
#     set viewOptions to the icon view options of container window
#     set arrangement of viewOptions to not arranged
#     set icon size of viewOptions to 100
#     set position of item "iMessage Wrapped.app" of container window to {120, 160}
#     set position of item "Applications" of container window to {380, 160}
#     close
#     update without registering applications
#   end tell
# end tell
# EOF

echo "Detaching volume..."
hdiutil detach "${MOUNT_DIR}" -quiet
echo "Converting to compressed DMG..."
hdiutil convert "${TEMP_DMG}" -format UDZO -o "${SIGNED_DMG}" -quiet
echo "Removing temporary DMG..."
rm "${TEMP_DMG}"

echo "✅ DMG created"

# Sign DMG
echo ""
echo "📝 Signing DMG..."
codesign --sign "$SIGNING_IDENTITY" "${SIGNED_DMG}"
echo "✅ DMG signed"

# Notarize
echo ""
echo "📤 Submitting for notarization..."
echo "   This will take 2-5 minutes..."

APP_PASSWORD=$(security find-generic-password -a $APPLE_ID -s notarization-password -w)

xcrun notarytool submit "${SIGNED_DMG}" \
  --apple-id "$APPLE_ID" \
  --password "$APP_PASSWORD" \
  --team-id "$TEAM_ID" \
  --wait

NOTARIZE_STATUS=$?

if [ $NOTARIZE_STATUS -eq 0 ]; then
    echo "✅ Notarization complete"
    
    # Staple
    echo "📎 Stapling..."
    if xcrun stapler staple "${SIGNED_DMG}" 2>&1; then
        echo "✅ Stapled"
    else
        echo "⚠️  Stapling failed, but notarization succeeded"
        echo "   The DMG is still valid - users just need internet to verify"
        echo "   Apple's CDN may need time to propagate. Try again in 5-10 minutes:"
        echo "   xcrun stapler staple '${SIGNED_DMG}'"
    fi
    
    # Verify
    echo ""
    echo "🔍 Final verification..."
    spctl --assess --type open --context context:primary-signature --verbose "${SIGNED_DMG}"
    
    # Cleanup
    rm -rf "$APP_PATH"
    
    echo ""
    echo "🎉 SUCCESS!"
    echo ""
    echo "Signed & Notarized: ${SIGNED_DMG}"
    echo ""
else
    echo "❌ Notarization failed"
    echo "Check logs with:"
    echo "  xcrun notarytool history --apple-id $APPLE_ID"
    exit 1
fi

