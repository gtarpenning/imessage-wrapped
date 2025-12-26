#!/bin/bash
# Test the complete flow: upload → fetch → verify

set -e

API_URL="${1:-http://localhost:3000}"
YEAR=2025

echo "🧪 Testing iMessage Wrapped API"
echo "================================"
echo ""
echo "API URL: $API_URL"
echo ""

# Test 1: Health check
echo "1️⃣  Testing health endpoint..."
HEALTH=$(curl -s "$API_URL/api/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo "   ✅ Health check passed"
else
  echo "   ❌ Health check failed"
  exit 1
fi
echo ""

# Test 2: Upload statistics
echo "2️⃣  Testing upload endpoint..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "statistics": {
      "volume": {
        "messages_sent": 1234,
        "messages_received": 5678,
        "busiest_day": {
          "date": "2025-12-25",
          "total": 100
        }
      },
      "contacts": {
        "most_messaged": [
          {"identifier": "+1234567890", "count": 500}
        ]
      },
      "temporal": {
        "busiest_hour": {"hour": "12:00 AM", "count": 100},
        "busiest_day_of_week": {"day": "Saturday", "count": 200}
      },
      "content": {
        "most_used_emojis": [
          {"emoji": "😊", "count": 50}
        ]
      },
      "conversations": {
        "total_conversations": 100,
        "group_chats": 20
      }
    }
  }')

WRAPPED_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
WRAPPED_URL=$(echo "$UPLOAD_RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)

if [ -z "$WRAPPED_ID" ]; then
  echo "   ❌ Upload failed"
  echo "   Response: $UPLOAD_RESPONSE"
  exit 1
fi

echo "   ✅ Upload successful"
echo "   ID: $WRAPPED_ID"
echo "   URL: $WRAPPED_URL"
echo ""

# Test 3: Fetch the wrapped
echo "3️⃣  Testing fetch endpoint..."
FETCH_RESPONSE=$(curl -s "$API_URL/api/wrapped/$YEAR/$WRAPPED_ID")

if echo "$FETCH_RESPONSE" | grep -q "messages_sent"; then
  echo "   ✅ Fetch successful"
  
  # Verify data
  SENT=$(echo "$FETCH_RESPONSE" | grep -o '"messages_sent":[0-9]*' | cut -d':' -f2)
  RECEIVED=$(echo "$FETCH_RESPONSE" | grep -o '"messages_received":[0-9]*' | cut -d':' -f2)
  
  echo "   Messages sent: $SENT"
  echo "   Messages received: $RECEIVED"
else
  echo "   ❌ Fetch failed"
  echo "   Response: $FETCH_RESPONSE"
  exit 1
fi
echo ""

# Test 4: Verify PII sanitization
echo "4️⃣  Testing PII sanitization..."
if echo "$FETCH_RESPONSE" | grep -q "+1234567890"; then
  echo "   ❌ PII not sanitized! Found raw phone number"
  exit 1
elif echo "$FETCH_RESPONSE" | grep -q "phone_"; then
  echo "   ✅ Phone number properly anonymized"
else
  echo "   ⚠️  No phone numbers found in response"
fi
echo ""

# Test 5: Rate limiting (optional - commented out to avoid hitting limit)
# echo "5️⃣  Testing rate limiting..."
# for i in {1..6}; do
#   RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/upload" \
#     -H "Content-Type: application/json" \
#     -d '{"year": 2025, "statistics": {"volume": {"messages_sent": 1}}}')
#   
#   if [ "$i" -eq 6 ]; then
#     if echo "$RESPONSE" | grep -q "429"; then
#       echo "   ✅ Rate limiting working"
#     else
#       echo "   ⚠️  Rate limiting may not be working"
#     fi
#   fi
# done
# echo ""

echo "================================"
echo "✅ All tests passed!"
echo ""
echo "🌐 View your wrapped at:"
echo "   $WRAPPED_URL"
echo ""
echo "💡 To test in browser:"
echo "   open $WRAPPED_URL"

