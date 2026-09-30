# PROJECT PG-NEXUS: Digital Passport & AI Voice Simulator 360°

Hệ thống Số hóa Năng lực Thực chiến & Giả lập Tình huống Giọng nói cho Lực lượng PG Masan Consumer tại kênh MT (Bách Hoá Xanh).

## Architecture

```
Internet → Ingress → Frontend (Next.js) → Backend (FastAPI)
                                         ↓
                              PostgreSQL + Redis + Keycloak
```

## Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Auth**: Keycloak 26
- **Infra**: Kubernetes (kind) + Docker

## Quick Start
```bash
make dev          # local docker-compose
make deploy       # deploy to kind cluster
```
