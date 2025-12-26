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

# Create GitHub release
echo "📤 Creating GitHub release..."

gh release create "$TAG" \
    "$SIGNED_DMG" \
    --repo "$REPO" \
    --title "Desktop v${VERSION}" \
    --generate-notes

echo ""
echo "🎉 Release published!"
echo ""
echo "View at: https://github.com/$REPO/releases/tag/$TAG"
echo "Download: https://imessage-wrapped.fly.dev/api/download"

