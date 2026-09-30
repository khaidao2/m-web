.PHONY: dev api-dev web-dev test lint secrets argocd status logs

# Always target the k3s cluster, even if the shell exports another KUBECONFIG
K3S_KUBECONFIG ?= $(HOME)/.kube/k3s-fedora.yaml
KUBECTL := KUBECONFIG=$(K3S_KUBECONFIG) kubectl
PY ?= python3

## Local: Postgres + Keycloak + API in Docker, Next.js dev server on :3000 (same-origin proxy)
dev:
	@test -f .env || { echo "create .env first (see README)"; exit 1; }
	docker compose up -d --build
	cd frontend && BACKEND_URL=http://localhost:8000 KEYCLOAK_URL=http://localhost:8180 npm run dev

## Tests need a *_test database (never the app database)
test:
	docker compose exec -T postgres psql -U pgnexus -tc "SELECT 1 FROM pg_database WHERE datname='pgnexus_test'" | grep -q 1 || \
	  docker compose exec -T postgres psql -U pgnexus -c "CREATE DATABASE pgnexus_test"
	cd backend && TEST_DATABASE_URL=postgresql+asyncpg://pgnexus:$$(grep ^POSTGRES_PASSWORD ../.env | cut -d= -f2)@localhost:55432/pgnexus_test $(PY) -m pytest -q

lint:
	cd backend && ruff check app tests scripts
	cd frontend && npm run lint && npm run typecheck

## Cluster (k3s: fedora control plane + fedora-1 worker)
secrets:
	KUBECONFIG=$(K3S_KUBECONFIG) ./scripts/bootstrap-secrets.sh

argocd:
	$(KUBECTL) apply -f deploy/argocd/masan-lms.yaml

status:
	$(KUBECTL) -n pgnexus get pods,ingress
	$(KUBECTL) -n argocd get application masan-lms

logs:
	$(KUBECTL) -n pgnexus logs deploy/backend -f
