#!/bin/bash
# Deploy to Fly.io with CHEAP database option (~$1-3/month)
# This script helps you avoid the $38/month Managed Postgres trap

set -e

APP_NAME="${1:-imessage-wrapped}"
DB_NAME="${APP_NAME}-db"
REGION="${2:-lax}"

echo "🚀 Deploying $APP_NAME to Fly.io (cheap setup)"
echo "   Region: $REGION"
echo ""

# Check if flyctl is installed
if ! command -v fly &> /dev/null; then
    echo "❌ flyctl not installed. Install with: brew install flyctl"
    exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo "🔐 Please log in to Fly.io"
    fly auth login
fi

echo "📦 Step 1: Creating app (without expensive auto-database)..."
fly launch \
  --name "$APP_NAME" \
  --region "$REGION" \
  --no-deploy \
  --no-db \
  --copy-config \
  -y

echo ""
echo "💾 Step 2: Creating CHEAP Postgres database..."
echo "   ⚠️  This uses: 1GB storage, shared-cpu-1x (256MB RAM)"
echo "   💰 Cost: ~$1-2/month 
echo ""

fly postgres create \
  --name "$DB_NAME" \
  --region "$REGION" \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1

echo ""
echo "🔗 Step 3: Attaching database to app..."
fly postgres attach "$DB_NAME" --app "$APP_NAME"

echo ""
echo "🔑 Step 4: Setting secrets..."
BASE_URL="https://${APP_NAME}.fly.dev"
fly secrets set BASE_URL="$BASE_URL" -a "$APP_NAME"

echo ""
echo "🚢 Step 5: Deploying app..."
fly deploy

echo ""
echo "🗄️  Step 6: Initializing database schema..."
fly ssh console -a "$APP_NAME" -C "node scripts/init-db.js"

echo ""
echo "✅ Step 7: Testing deployment..."
curl -s "$BASE_URL/api/health" | jq '.'

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "   App URL: $BASE_URL"
echo "   App Dashboard: https://fly.io/apps/$APP_NAME"
echo "   DB Dashboard: https://fly.io/apps/$DB_NAME"
echo ""
echo "💰 Expected monthly cost: ~$1-3"
echo "   - App VMs: $0-2 (auto-stop when idle)"
echo "   - Postgres: ~$1-2"
echo ""
echo "📊 Monitor your app:"
echo "   fly logs -a $APP_NAME"
echo "   fly status -a $APP_NAME"
echo "   fly status -a $DB_NAME"

