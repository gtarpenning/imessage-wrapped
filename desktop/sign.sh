#!/bin/bash
# Code signing and notarization script

set -e

VERSION="1.0.2"
APP_PATH="dist/iMessage Wrapped.app"
DMG_NAME="iMessage-Wrapped-${VERSION}.dmg"

# TODO: Replace these with your actual values
SIGNING_IDENTITY="Developer ID Application: YOUR NAME (TEAM_ID)"
APPLE_ID="your@email.com"
TEAM_ID="YOUR_TEAM_ID"
# Store app-specific password in keychain:
# security add-generic-password -a "$APPLE_ID" -w "your-app-specific-password" -s "notarization-password"

echo "🔐 Code Signing iMessage Wrapped..."
echo ""

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo "❌ App not found at $APP_PATH"
    echo "   Run ./build-release.sh first"
    exit 1
fi

# Step 1: Sign the app bundle
echo "📝 Signing app bundle..."
codesign --deep --force --verify --verbose \
  --options runtime \
  --sign "$SIGNING_IDENTITY" \
  "$APP_PATH"

echo "✅ App signed"

# Verify signature
echo "🔍 Verifying signature..."
codesign --verify --verbose "$APP_PATH"
spctl --assess --verbose "$APP_PATH"

# Step 2: Sign the DMG (if it exists)
if [ -f "$DMG_NAME" ]; then
    echo "📝 Signing DMG..."
    codesign --sign "$SIGNING_IDENTITY" "$DMG_NAME"
    echo "✅ DMG signed"
else
    echo "⚠️  DMG not found, skipping DMG signing"
fi

# Step 3: Notarize
echo ""
echo "📤 Submitting for notarization..."
echo "   This may take a few minutes..."

# Get password from keychain
APP_PASSWORD=$(security find-generic-password -a "$APPLE_ID" -s "notarization-password" -w)

xcrun notarytool submit "$DMG_NAME" \
  --apple-id "$APPLE_ID" \
  --password "$APP_PASSWORD" \
  --team-id "$TEAM_ID" \
  --wait

echo "✅ Notarization complete"

# Step 4: Staple the notarization
echo "📎 Stapling notarization ticket..."
xcrun stapler staple "$DMG_NAME"

echo "✅ Stapled"

# Final verification
echo ""
echo "🔍 Final verification..."
spctl --assess --type open --context context:primary-signature --verbose "$DMG_NAME"

echo ""
echo "🎉 All done!"
echo ""
echo "Your signed and notarized DMG is ready:"
echo "   $DMG_NAME"
echo ""
echo "No security warnings will appear when users open it!"

