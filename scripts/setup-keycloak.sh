#!/bin/bash

# Configuration
KC_URL="http://localhost:30180"
KC_USER="admin"
KC_PASS="pgnexus_pass" # from postgres-secret
REALM="pgnexus"

echo "Waiting for Keycloak to be ready at $KC_URL..."
until curl -sf $KC_URL/health/ready; do
    echo "Waiting 5s..."
    sleep 5
done

echo "Getting admin token..."
TOKEN=$(curl -s -d "client_id=admin-cli" -d "username=$KC_USER" -d "password=$KC_PASS" -d "grant_type=password" "$KC_URL/realms/master/protocol/openid-connect/token" | jq -r .access_token)

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "Failed to get admin token. Did you set the password correctly?"
    exit 1
fi

echo "Creating Realm $REALM..."
curl -s -X POST "$KC_URL/admin/realms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"realm\": \"$REALM\", \"enabled\": true}"

echo "Creating frontend client..."
curl -s -X POST "$KC_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "pgnexus-frontend",
    "enabled": true,
    "publicClient": true,
    "directAccessGrantsEnabled": true,
    "standardFlowEnabled": true,
    "redirectUris": ["http://localhost:3000/*", "http://pgnexus.local/*"],
    "webOrigins": ["+"]
  }'

echo "Creating backend client..."
curl -s -X POST "$KC_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "pgnexus-backend",
    "enabled": true,
    "bearerOnly": true
  }'

echo "Creating roles..."
for ROLE in pg supervisor admin; do
  curl -s -X POST "$KC_URL/admin/realms/$REALM/roles" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$ROLE\"}"
done

echo "Keycloak setup completed!"
