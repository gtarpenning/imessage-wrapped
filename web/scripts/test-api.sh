#!/bin/bash
# Test API endpoints

echo "Testing health endpoint..."
curl -s http://localhost:3000/api/health | jq .

echo ""
echo "Testing upload endpoint..."
curl -s -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "statistics": {
      "volume": {
        "messages_sent": 100,
        "messages_received": 150
      },
      "contacts": {
        "most_messaged": [
          {"identifier": "+1234567890", "count": 50}
        ]
      }
    }
  }' | jq .

echo ""
echo "If you see a URL above, the API is working!"

