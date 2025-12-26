#!/bin/bash

# Script to install git hooks for the project
# Run this after cloning the repository

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

echo "🔧 Installing git hooks..."

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/sh

# Pre-commit hook to run linters and type checkers on staged files
# Runs Python checks (ruff, ty) if Python files are staged
# Runs Next.js lint if JS/JSX/TS/TSX files are staged

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Check for Python files
PYTHON_FILES=$(echo "$STAGED_FILES" | grep -E '\.py$' || true)

# Check for JS/TS files in web directory
WEB_FILES=$(echo "$STAGED_FILES" | grep -E '^web/.*\.(js|jsx|ts|tsx)$' || true)

EXIT_CODE=0

# Run Python checks
if [ -n "$PYTHON_FILES" ]; then
  echo "${BLUE}🐍 Detected Python files in commit...${NC}"

  # Check if ruff is available
  if ! command -v ruff > /dev/null 2>&1; then
    echo "${YELLOW}⚠ ruff not found. Install with: pip install -e '.[dev]'${NC}"
  else
    echo "${YELLOW}⚙️  Running ruff linter...${NC}"
    ruff check $PYTHON_FILES
    if [ $? -ne 0 ]; then
      echo "${RED}✗ Ruff linting failed!${NC}"
      EXIT_CODE=1
    else
      echo "${GREEN}✓ Ruff linting passed${NC}"
    fi

    echo "${YELLOW}⚙️  Checking code formatting...${NC}"
    ruff format --check $PYTHON_FILES
    if [ $? -ne 0 ]; then
      echo "${RED}✗ Code formatting check failed!${NC}"
      echo "${YELLOW}Run 'make format' to fix formatting${NC}"
      EXIT_CODE=1
    else
      echo "${GREEN}✓ Code formatting passed${NC}"
    fi
  fi

  # Check if ty is available
  if ! command -v ty > /dev/null 2>&1; then
    echo "${YELLOW}⚠ ty not found. Install with: pip install -e '.[dev]'${NC}"
  else
    echo "${YELLOW}⚙️  Running ty type checker...${NC}"
    # Get directories containing Python files
    PYTHON_DIRS=$(echo "$PYTHON_FILES" | xargs dirname | sort -u)

    # Run ty on the src directory if any Python files are in it
    if echo "$PYTHON_DIRS" | grep -q "^src"; then
      ty check src/ 2>&1 | head -20
      if [ $? -ne 0 ]; then
        echo "${RED}✗ Type checking failed!${NC}"
        EXIT_CODE=1
      else
        echo "${GREEN}✓ Type checking passed${NC}"
      fi
    fi
  fi
fi

# Run Next.js lint for web files
if [ -n "$WEB_FILES" ]; then
  echo "${BLUE}🌐 Detected web files in commit...${NC}"

  if [ -d "web/node_modules" ]; then
    echo "${YELLOW}⚙️  Running Next.js linter...${NC}"
    cd web

    # Run lint only on staged files
    npm run lint > /dev/null 2>&1
    if [ $? -ne 0 ]; then
      echo "${RED}✗ Next.js linting failed!${NC}"
      npm run lint
      EXIT_CODE=1
    else
      echo "${GREEN}✓ Next.js linting passed${NC}"
    fi
    cd ..
  else
    echo "${YELLOW}⚠ web/node_modules not found. Run 'npm ci' in web directory${NC}"
  fi
fi

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "${RED}Pre-commit checks failed!${NC}"
  echo "${RED}Fix the issues above and try again.${NC}"
  echo "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "${YELLOW}To bypass hooks (not recommended): git commit --no-verify${NC}"
  exit 1
fi

echo ""
echo "${GREEN}✓ All pre-commit checks passed!${NC}"
exit 0
EOF

# Make pre-commit hook executable
chmod +x "$HOOKS_DIR/pre-commit"

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

# Make pre-push hook executable
chmod +x "$HOOKS_DIR/pre-push"

echo "✅ Git hooks installed successfully!"
echo ""
echo "The following hooks are now active:"
echo "  - pre-commit: Runs linting/type checking on staged Python & web files"
echo "  - pre-push: Validates web build before pushing to main"
echo ""
echo "To bypass hooks (not recommended):"
echo "  - git commit --no-verify"
echo "  - git push --no-verify"
