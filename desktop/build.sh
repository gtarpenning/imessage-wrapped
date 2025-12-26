#!/bin/bash
# Development build script - fast builds for testing

set -e

echo "🏗️  Building iMessage Wrapped (Development)..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf build dist

# Build with py2app in alias mode (faster, not standalone)
echo "📦 Building app..."
python setup.py py2app -A

echo "✅ Build complete!"
echo "📱 App location: dist/iMessage Wrapped.app"
echo ""
echo "To test: open 'dist/iMessage Wrapped.app'"
echo ""
echo "⚠️  Note: This is a development build."
echo "   It requires Python to be installed."
echo "   For production, use ./build-release.sh"

