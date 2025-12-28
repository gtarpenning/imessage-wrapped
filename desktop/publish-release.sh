#!/bin/bash
# Create GitHub release with signed DMG

set -e

REPO="gtarpenning/imessage-wrapped"

# Check for required arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./publish-release.sh <version> <signed-dmg-path>"
    echo "Example: ./publish-release.sh 1.0.5 signed-iMessage-Wrapped-1.0.5.dmg"
    exit 1
fi

VERSION="$1"
SIGNED_DMG="$2"
TAG="desktop-v${VERSION}"

if [ ! -f "$SIGNED_DMG" ]; then
    echo "❌ Signed DMG not found: $SIGNED_DMG"
    exit 1
fi

SIGNED_DMG_ABS="$(cd "$(dirname "$SIGNED_DMG")" && pwd)/$(basename "$SIGNED_DMG")"
SIGNED_DMG_NAME="$(basename "$SIGNED_DMG_ABS")"
SIGNED_DMG_SHA256="$(shasum -a 256 "$SIGNED_DMG_ABS" | awk '{print $1}')"

echo "🔍 Verifying DMG before upload..."
echo "  File: ${SIGNED_DMG_ABS}"
echo "  Size: $(stat -f "%z" "$SIGNED_DMG_ABS") bytes"
echo "  SHA256: ${SIGNED_DMG_SHA256}"
echo ""
echo "  Checking code signature..."
if ! codesign -dv --verbose=4 "$SIGNED_DMG_ABS" >/dev/null 2>&1; then
    echo "❌ DMG is not codesigned. Refusing to publish."
    echo "   Fix: run ./sign-dmg.sh <dmg> and ensure it succeeds."
    exit 1
fi

echo "  Checking Gatekeeper assessment..."
if ! spctl --assess --type open --context context:primary-signature --verbose=4 "$SIGNED_DMG_ABS" >/dev/null 2>&1; then
    echo "❌ Gatekeeper does not accept this DMG. Refusing to publish."
    echo "   (Try: xcrun stapler staple \"$SIGNED_DMG_ABS\" and re-check)"
    exit 1
fi

echo "  Checking stapled notarization ticket..."
if ! xcrun stapler validate "$SIGNED_DMG_ABS" >/dev/null 2>&1; then
    echo "❌ No stapled notarization ticket found. Refusing to publish."
    echo "   Fix: re-run ./sign-dmg.sh <dmg> and ensure stapling succeeds."
    exit 1
fi

echo "✅ DMG looks good"
echo ""

echo "📦 Publishing release ${TAG}..."
echo ""

# Check if tag exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "⚠️  Tag $TAG already exists"
    read -p "Delete and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$TAG"
        git push origin ":refs/tags/$TAG" 2>/dev/null || true
    else
        exit 1
    fi
fi

# Create and push tag
echo "🏷️  Creating tag: $TAG"
git tag "$TAG"
git push origin "$TAG"

echo "✅ Tag pushed"
echo ""

echo "📤 Creating GitHub release..."
gh release create "$TAG" \
  --repo "$REPO" \
  --title "Desktop v${VERSION}" \
  --generate-notes

echo ""
echo "📦 Uploading DMG asset..."
gh release upload "$TAG" \
  "$SIGNED_DMG_ABS" \
  --clobber \
  --repo "$REPO"

echo ""
echo "🔍 Verifying uploaded asset on GitHub..."
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${SIGNED_DMG_NAME}"
TMP_DL="/tmp/${TAG}-${SIGNED_DMG_NAME}"
rm -f "$TMP_DL"

if curl -L --fail --silent --show-error -o "$TMP_DL" "$DOWNLOAD_URL"; then
    UPLOADED_SHA256="$(shasum -a 256 "$TMP_DL" | awk '{print $1}')"
    echo "  URL: ${DOWNLOAD_URL}"
    echo "  Downloaded SHA256: ${UPLOADED_SHA256}"
    echo "  Expected SHA256:   ${SIGNED_DMG_SHA256}"

    if [ "$UPLOADED_SHA256" != "$SIGNED_DMG_SHA256" ]; then
        echo ""
        echo "❌ Uploaded DMG does not match local file!"
        echo "   This suggests the wrong bytes were uploaded or the asset was replaced."
        echo "   Try re-uploading with:"
        echo "     gh release upload \"${TAG}\" \"${SIGNED_DMG_ABS}\" --clobber --repo \"${REPO}\""
        exit 1
    fi

    if ! codesign -dv --verbose=4 "$TMP_DL" >/dev/null 2>&1; then
        echo ""
        echo "❌ Uploaded DMG is missing a code signature!"
        exit 1
    fi

    if ! spctl --assess --type open --context context:primary-signature --verbose=4 "$TMP_DL" >/dev/null 2>&1; then
        echo ""
        echo "❌ Uploaded DMG is not accepted by Gatekeeper!"
        exit 1
    fi

    if ! xcrun stapler validate "$TMP_DL" >/dev/null 2>&1; then
        echo ""
        echo "❌ Uploaded DMG does not have a stapled notarization ticket!"
        exit 1
    fi

    echo "✅ Uploaded asset matches and validates"
else
    echo "⚠️  Could not download asset back from GitHub for verification"
    echo "   URL: ${DOWNLOAD_URL}"
    echo "   (You can manually verify later with curl + shasum)"
fi

echo ""
echo "🎉 Release published!"
echo ""
echo "View at: https://github.com/$REPO/releases/tag/$TAG"
echo "Download: https://imessage-wrapped.fly.dev/api/download"

