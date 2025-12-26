#!/bin/bash
# Quick installation script

echo "📦 Installing iMessage Wrapped..."
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.10 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✓ Found Python $PYTHON_VERSION"

# Install in editable mode for development
echo ""
echo "Installing package in editable mode (development)..."
pip install -e .

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Installation complete!"
    echo ""
    echo "You can now use the 'imexport' command:"
    echo "  imexport export --year 2024"
    echo "  imexport analyze --share"
    echo "  imexport --help"
else
    echo ""
    echo "❌ Installation failed"
    exit 1
fi

