#!/bin/bash
# Fix broken symlinks in py2app bundle before signing

set -e

if [ -z "$1" ]; then
    echo "Usage: ./fix-symlinks.sh <path-to-app>"
    echo "Example: ./fix-symlinks.sh 'dist/iMessage Wrapped.app'"
    exit 1
fi

APP="$1"

if [ ! -d "$APP" ]; then
    echo "❌ App not found: $APP"
    exit 1
fi

echo "🔧 Fixing broken symlinks in: $APP"
echo ""

# Find all broken symlinks
echo "🔍 Searching for broken symlinks..."
BROKEN_LINKS=$(find "$APP" -type l ! -exec test -e {} \; -print 2>/dev/null || true)

if [ -z "$BROKEN_LINKS" ]; then
    echo "✅ No broken symlinks found"
    exit 0
fi

echo "Found broken symlinks:"
echo "$BROKEN_LINKS"
echo ""

# Fix each broken symlink
echo "🔧 Fixing symlinks..."
while IFS= read -r link; do
    if [ -n "$link" ]; then
        echo "  Removing: $link"
        rm "$link"
        
        # Check if the target exists elsewhere
        TARGET=$(readlink "$link" 2>/dev/null || true)
        if [ -n "$TARGET" ]; then
            echo "    (was pointing to: $TARGET)"
        fi
    fi
done <<< "$BROKEN_LINKS"

echo ""
echo "✅ Fixed all broken symlinks"
echo ""
echo "Verification:"
REMAINING=$(find "$APP" -type l ! -exec test -e {} \; -print 2>/dev/null || true)
if [ -z "$REMAINING" ]; then
    echo "✅ No broken symlinks remaining"
else
    echo "⚠️  Still have broken symlinks:"
    echo "$REMAINING"
fi

