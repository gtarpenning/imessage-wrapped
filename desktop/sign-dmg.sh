#!/bin/bash
# Sign and notarize a local DMG file

set -e

REPO="gtarpenning/imessage-wrapped"

# Check for required environment variables
MISSING_VARS=()
[ -z "$SIGNING_IDENTITY" ] && MISSING_VARS+=("SIGNING_IDENTITY")
[ -z "$APPLE_ID" ] && MISSING_VARS+=("APPLE_ID")
[ -z "$TEAM_ID" ] && MISSING_VARS+=("TEAM_ID")

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "These are required for code signing and notarization."
    echo "Make sure they are set in your shell environment (e.g., ~/.zshrc)"
    exit 1
fi

echo "✓ All required environment variables present"
echo ""

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

# Check for entitlements file
if [ ! -f "entitlements.plist" ]; then
    echo "❌ entitlements.plist not found in current directory"
    echo "   This file is required for proper code signing"
    exit 1
fi

echo "🔐 Signing: $ORIGINAL_DMG"
echo ""

# Mount and extract
echo "📂 Extracting contents from DMG..."
hdiutil attach "$ORIGINAL_DMG" -mountpoint /Volumes/iMessageWrapped -nobrowse -quiet
cp -R "/Volumes/iMessageWrapped/iMessage Wrapped.app" ./

# Preserve the background and DS_Store from original DMG
echo "  Preserving DMG appearance settings..."
if [ -d "/Volumes/iMessageWrapped/.background" ]; then
    cp -R "/Volumes/iMessageWrapped/.background" ./dmg-background-temp/ 2>/dev/null || true
fi
if [ -f "/Volumes/iMessageWrapped/.DS_Store" ]; then
    cp "/Volumes/iMessageWrapped/.DS_Store" ./DS_Store.temp 2>/dev/null || true
fi

hdiutil detach /Volumes/iMessageWrapped -quiet
echo "✅ Extracted"

APP_PATH="iMessage Wrapped.app"

# Fix broken symlinks (Gatekeeper rejects apps with invalid symlinks)
echo ""
echo "🔧 Checking for broken symlinks..."
echo "  Scanning app bundle: $APP_PATH"

# Find all symlinks first
ALL_SYMLINKS=$(find "$APP_PATH" -type l 2>/dev/null || true)
if [ -n "$ALL_SYMLINKS" ]; then
    echo "  Found $(echo "$ALL_SYMLINKS" | wc -l | tr -d ' ') total symlinks"
    echo "  Checking which ones are broken..."
fi

# Find broken symlinks
BROKEN_LINKS=$(find "$APP_PATH" -type l ! -exec test -e {} \; -print 2>/dev/null || true)
if [ -n "$BROKEN_LINKS" ]; then
    echo "  ⚠️  Found broken symlinks (Gatekeeper will reject these):"
    while IFS= read -r link; do
        if [ -n "$link" ]; then
            TARGET=$(readlink "$link" 2>/dev/null || echo "unknown")
            echo "    ❌ $link -> $TARGET"
        fi
    done <<< "$BROKEN_LINKS"
    
    echo "  Removing broken symlinks..."
    REMOVED_COUNT=0
    while IFS= read -r link; do
        if [ -n "$link" ] && [ -L "$link" ]; then
            rm "$link" && REMOVED_COUNT=$((REMOVED_COUNT + 1))
        fi
    done <<< "$BROKEN_LINKS"
    
    echo "✅ Removed $REMOVED_COUNT broken symlink(s)"
    
    # Verify removal
    STILL_BROKEN=$(find "$APP_PATH" -type l ! -exec test -e {} \; -print 2>/dev/null || true)
    if [ -n "$STILL_BROKEN" ]; then
        echo "⚠️  Warning: Some broken symlinks remain:"
        echo "$STILL_BROKEN" | sed 's/^/    /'
    fi
else
    echo "✅ No broken symlinks found"
fi

# Sign all binaries inside the app
echo ""
echo "📝 Signing all internal binaries..."

# Sign all .so files
echo "  Signing Python extension modules..."
find "$APP_PATH" -type f -name "*.so" | while read file; do
    codesign --force --sign "$SIGNING_IDENTITY" --options runtime --timestamp --entitlements entitlements.plist "$file" 2>&1 | grep -v "signed Mach-O" || true
done

# Sign all .dylib files  
echo "  Signing dynamic libraries..."
find "$APP_PATH" -type f -name "*.dylib" | while read file; do
    codesign --force --sign "$SIGNING_IDENTITY" --options runtime --timestamp --entitlements entitlements.plist "$file" 2>&1 | grep -v "signed Mach-O" || true
done

# Sign frameworks
echo "  Signing frameworks..."
find "$APP_PATH/Contents/Frameworks" -type d -name "*.framework" 2>/dev/null | while read framework; do
    codesign --force --sign "$SIGNING_IDENTITY" --options runtime --timestamp --entitlements entitlements.plist "$framework" 2>&1 | grep -v "signed Mach-O" || true
done

echo "✅ All internal binaries signed"

# Sign the main app bundle
echo ""
echo "📝 Signing app bundle..."
codesign --force --sign "$SIGNING_IDENTITY" \
    --options runtime \
    --timestamp \
    --entitlements entitlements.plist \
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
SIGNED_DMG="$(basename "$ORIGINAL_DMG")"
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

# Verify symlink was created correctly
if [ ! -L "${MOUNT_DIR}/Applications" ]; then
    echo "❌ Applications symlink was not created"
    exit 1
fi
if [ ! -e "${MOUNT_DIR}/Applications" ]; then
    echo "❌ Applications symlink is broken (doesn't point to valid target)"
    exit 1
fi
echo "✅ Applications symlink verified"

# Restore background folder from original DMG, or create new one
if [ -d "dmg-background-temp" ]; then
    echo "Restoring background from original DMG..."
    cp -R dmg-background-temp "${MOUNT_DIR}/.background"
else
    # Create background image if it doesn't exist
    if [ ! -f "dmg-background.png" ]; then
        echo "Creating DMG background image..."
        bash create-dmg-background.sh
    fi
    
    # Copy background image to DMG (hidden)
    echo "Adding background image..."
    mkdir -p "${MOUNT_DIR}/.background"
    cp dmg-background.png "${MOUNT_DIR}/.background/"
fi

# Prioritize .DS_Store template (never opens windows!)
DS_STORE_APPLIED=false

if [ -f "dmg-template/DS_Store_template" ]; then
    echo "Using .DS_Store template (no windows will open)..."
    cp "dmg-template/DS_Store_template" "${MOUNT_DIR}/.DS_Store"
    DS_STORE_APPLIED=true
    echo "✅ Window appearance configured from template"
elif [ -f "DS_Store.temp" ]; then
    echo "Restoring window settings from original DMG..."
    cp DS_Store.temp "${MOUNT_DIR}/.DS_Store"
    DS_STORE_APPLIED=true
    echo "✅ Window appearance restored from original"
fi

# Clean up temp files
rm -rf dmg-background-temp DS_Store.temp 2>/dev/null || true

echo "Syncing..."
sync

# Only use AppleScript as a last resort (this WILL open windows on your desktop!)
if [ "$DS_STORE_APPLIED" = false ]; then
    echo ""
    echo "⚠️  WARNING: No .DS_Store template found!"
    echo "   This will open Finder windows on your screen."
    echo "   To avoid this in the future, run: ./create-dmg-template-manual.sh"
    echo "   (It takes 30 seconds and only needs to be done once)"
    echo ""
    echo "Configuring DMG window appearance with AppleScript..."
    echo "  (A Finder window will open briefly - sorry!)"
    echo ""
    sleep 2
    
    # Run AppleScript with better error handling
    if osascript <<EOF
tell application "Finder"
    tell disk "${VOLUME_NAME}"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {100, 100, 700, 550}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 100
        -- Set background picture (must use POSIX file path)
        set background picture of viewOptions to POSIX file "${MOUNT_DIR}/.background/dmg-background.png"
        -- Wait for Finder to refresh and show all items
        delay 1
        update without registering applications
        delay 1
        -- Position items (use try/catch in case items aren't ready yet)
        try
            set position of item "iMessage Wrapped.app" of container window to {150, 235}
        end try
        try
            set position of item "Applications" of container window to {450, 235}
        end try
        update without registering applications
        delay 2
        close
    end tell
end tell
EOF
    then
        echo "✅ DMG appearance configured with AppleScript"
    else
        echo "⚠️  AppleScript configuration had issues, but continuing..."
    fi
    
    # Close any Finder windows and wait for .DS_Store to be written
    echo "Finalizing DMG settings..."
    osascript -e "tell application \"Finder\" to close every window" 2>/dev/null || true
    sleep 3
fi

sync

echo "Detaching volume..."
for i in {1..5}; do
    if hdiutil detach "${MOUNT_DIR}" -quiet 2>/dev/null; then
        echo "✅ Volume unmounted cleanly"
        break
    fi
    echo "  Waiting for Finder to release volume (attempt $i/5)..."
    sleep 2
    if [ $i -eq 5 ]; then
        echo "  Using force unmount..."
        hdiutil detach "${MOUNT_DIR}" -force || true
    fi
done
echo "Converting to compressed DMG..."
hdiutil convert "${TEMP_DMG}" -format UDZO -o "${SIGNED_DMG}"
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
    rm -rf dmg-background-temp DS_Store.temp 2>/dev/null || true
    
    echo ""
    echo "🎉 SUCCESS!"
    echo ""
    echo "Signed & Notarized: ${SIGNED_DMG}"
    echo ""
else
    echo "❌ Notarization failed"
    echo "Check logs with:"
    echo "  xcrun notarytool history --apple-id $APPLE_ID"
    rm -rf "$APP_PATH" dmg-background-temp DS_Store.temp 2>/dev/null || true
    exit 1
fi

