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
    # Generate at larger size to maintain quality (qlmanage makes square images)
    qlmanage -t -s 1200 -o . dmg-background.svg
    mv dmg-background.svg.png dmg-background-temp.png 2>/dev/null || true
    # qlmanage creates square images (1200x1200), we need 4:3 ratio (1200x900)
    # Crop with minimal offset to maximize visible content
    sips --cropOffset 15 0 --cropToHeightWidth 900 1200 dmg-background-temp.png --out dmg-background-temp.png
    # Now resize to final dimensions
    sips -z 450 600 dmg-background-temp.png --out dmg-background.png
    rm -f dmg-background-temp.png
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

