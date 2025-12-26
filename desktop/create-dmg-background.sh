#!/bin/bash
# Create DMG background image from SVG

set -e

echo "🎨 Creating DMG background image..."
echo "Target size: 600x450 pixels (exact Finder window size)"

# Convert SVG to PNG at exact window dimensions
# DMG backgrounds must match the exact pixel size of the window
if command -v convert &> /dev/null; then
    convert -density 72 -background transparent dmg-background.svg -resize 600x450! dmg-background.png
    echo "✅ Created dmg-background.png with ImageMagick"
elif command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w 600 -h 450 dmg-background.svg -o dmg-background.png
    echo "✅ Created dmg-background.png with rsvg-convert"
else
    # Fallback: use macOS built-in qlmanage to render
    # qlmanage creates larger images, so we'll need to resize with sips
    qlmanage -t -s 600 -o . dmg-background.svg
    mv dmg-background.svg.png dmg-background.png 2>/dev/null || true
    # Resize to exact dimensions with sips (built into macOS)
    sips -z 450 600 dmg-background.png --out dmg-background.png &>/dev/null
    echo "✅ Created dmg-background.png with qlmanage + sips"
fi

if [ -f "dmg-background.png" ]; then
    echo "✅ Background image created successfully"
    ls -lh dmg-background.png
else
    echo "❌ Failed to create background image"
    echo "Please install ImageMagick: brew install imagemagick"
    exit 1
fi

