#!/bin/bash

# Script to install git hooks for the project
# Run this after cloning the repository

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "🔧 Installing git hooks..."

# Create pre-push hook
cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/sh

# Pre-push hook to validate web build when pushing to main
# This prevents broken builds from reaching the main branch

remote="$1"
url="$2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

while read local_ref local_oid remote_ref remote_oid
do
  # Check if pushing to main branch
  if echo "$remote_ref" | grep -q 'refs/heads/main'; then
    echo "${YELLOW}🔍 Detected push to main branch...${NC}"
    echo "${YELLOW}⚙️  Running web build validation...${NC}"
    
    # Check if web directory exists
    if [ ! -d "web" ]; then
      echo "${RED}✗ web directory not found${NC}"
      exit 0
    fi
    
    # Check if package.json exists
    if [ ! -f "web/package.json" ]; then
      echo "${YELLOW}⚠ web/package.json not found, skipping build check${NC}"
      exit 0
    fi
    
    # Store current directory
    CURRENT_DIR=$(pwd)
    
    # Navigate to web directory
    cd web || exit 1
    
    # Check if node_modules exists, if not install
    if [ ! -d "node_modules" ]; then
      echo "${YELLOW}📦 Installing dependencies...${NC}"
      npm ci || {
        echo "${RED}✗ Failed to install dependencies${NC}"
        cd "$CURRENT_DIR"
        exit 1
      }
    fi
    
    # Run the build
    echo "${YELLOW}🔨 Building application...${NC}"
    npm run build > /dev/null 2>&1
    
    if [ $? -ne 0 ]; then
      echo "${RED}✗ Build failed! Cannot push to main.${NC}"
      echo "${RED}Fix the build errors and try again.${NC}"
      cd "$CURRENT_DIR"
      exit 1
    fi
    
    echo "${GREEN}✓ Build successful!${NC}"
    
    # Return to original directory
    cd "$CURRENT_DIR"
  fi
done

exit 0
EOF

# Make hook executable
chmod +x "$HOOKS_DIR/pre-push"

echo "✅ Git hooks installed successfully!"
echo ""
echo "The following hooks are now active:"
echo "  - pre-push: Validates web build before pushing to main"
echo ""
echo "To bypass hooks (not recommended): git push --no-verify"

