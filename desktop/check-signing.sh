#!/bin/bash
# Check code signing setup

echo "🔍 Checking code signing setup..."
echo ""

echo "Available code signing certificates:"
security find-identity -v -p codesigning

echo ""
echo "---"
echo ""
echo "If you see certificates listed above, copy the full identity name."
echo "It looks like: 'Developer ID Application: Your Name (ABC123XYZ)'"
echo ""
echo "Then edit sign.sh and update:"
echo "  - SIGNING_IDENTITY"
echo "  - APPLE_ID"
echo "  - TEAM_ID (the part in parentheses)"

