#!/usr/bin/env bash
# Creates the cluster secrets once. Git never holds them and Argo CD does not manage them.
# Re-running is safe: an existing secret is left untouched.
set -euo pipefail
NS=${NS:-pgnexus}
echo "cluster: $(kubectl config current-context) ($(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'))"
kubectl get namespace "$NS" >/dev/null 2>&1 || kubectl create namespace "$NS"
if kubectl -n "$NS" get secret pgnexus-secrets >/dev/null 2>&1; then
  echo "secret $NS/pgnexus-secrets already exists — leaving it unchanged"
  exit 0
fi
gen() { openssl rand -base64 24 | tr -d '/+=' | cut -c1-24; }
kubectl -n "$NS" create secret generic pgnexus-secrets \
  --from-literal=POSTGRES_PASSWORD="$(gen)" \
  --from-literal=KC_ADMIN_PASSWORD="$(gen)" \
  --from-literal=DEMO_PG_PASSWORD="$(gen)" \
  --from-literal=DEMO_SUP_PASSWORD="$(gen)"
echo "created $NS/pgnexus-secrets"
echo "demo logins: pg01..pg03 and sup01 — read passwords with:"
echo "  kubectl -n $NS get secret pgnexus-secrets -o jsonpath='{.data.DEMO_PG_PASSWORD}' | base64 -d"
