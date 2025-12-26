#!/bin/bash
# Quick setup script for local development

set -e

echo "🚀 Setting up iMessage Wrapped Web Server"
echo ""

# Check if in web directory
if [ ! -f "package.json" ]; then
  echo "❌ Please run this script from the web/ directory"
  exit 1
fi

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  echo "📝 Creating .env.local file..."
  cat > .env.local << EOF
# Using SQLite for simplicity (no Postgres required)
DATABASE_URL=sqlite:///./wrapped.db
BASE_URL=http://localhost:3000
EOF
  echo "✅ Created .env.local with SQLite configuration"
else
  echo "ℹ️  .env.local already exists, skipping..."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  npm run dev"
echo ""
echo "Then in another terminal, run:"
echo "  imessage-wrapped analyze --share"

