#!/bin/bash
set -e

echo "Building images..."
docker build -t pgnexus/backend:latest ./backend
docker build -t pgnexus/frontend:latest ./frontend

echo "Loading images into kind..."
kind load docker-image pgnexus/backend:latest --name tien-web
kind load docker-image pgnexus/frontend:latest --name tien-web

echo "Applying manifests..."
kubectl --context=kind-tien-web apply -k k8s/base/

echo "Waiting for deployments..."
kubectl --context=kind-tien-web -n pgnexus rollout status deployment/postgres --timeout=120s || true
kubectl --context=kind-tien-web -n pgnexus rollout status deployment/redis --timeout=120s || true
kubectl --context=kind-tien-web -n pgnexus rollout status deployment/keycloak --timeout=180s || true
kubectl --context=kind-tien-web -n pgnexus rollout status deployment/backend --timeout=120s || true
kubectl --context=kind-tien-web -n pgnexus rollout status deployment/frontend --timeout=120s || true

echo "Configuring Keycloak..."
bash scripts/setup-keycloak.sh

echo ""
echo "Done! Access the app at:"
echo "Frontend: http://pgnexus.local (make sure to add '127.0.0.1 pgnexus.local auth.pgnexus.local' to /etc/hosts)"
echo "Auth: http://auth.pgnexus.local:30180"
