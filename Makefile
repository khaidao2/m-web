.PHONY: dev build deploy test clean

dev:
	docker-compose up -d

dev-down:
	docker-compose down

build:
	docker build -t pgnexus/backend:latest ./backend
	docker build -t pgnexus/frontend:latest ./frontend

load:
	kind load docker-image pgnexus/backend:latest --name tien-web
	kind load docker-image pgnexus/frontend:latest --name tien-web

deploy: build load
	kubectl --context=kind-tien-web apply -k k8s/base/
	kubectl --context=kind-tien-web -n pgnexus rollout status deployment/backend
	kubectl --context=kind-tien-web -n pgnexus rollout status deployment/frontend

migrate:
	kubectl --context=kind-tien-web exec -it -n pgnexus deployment/backend -- alembic upgrade head

seed:
	kubectl --context=kind-tien-web exec -it -n pgnexus deployment/backend -- python scripts/seed.py

test:
	docker-compose exec backend pytest tests/ -v --cov=app --cov-report=term-missing

keycloak-setup:
	bash scripts/setup-keycloak.sh

clean:
	docker-compose down -v

status:
	kubectl --context=kind-tien-web get all -n pgnexus

logs-backend:
	kubectl --context=kind-tien-web logs -n pgnexus -l app=backend -f

logs-frontend:
	kubectl --context=kind-tien-web logs -n pgnexus -l app=frontend -f
