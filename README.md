# PG NEXUS · Digital Passport & AI Voice Simulator 360°

Mobile-first e-learning web app for Masan Consumer PGs at Bách hoá Xanh (Chrome & Safari on phones).

- **Hôm nay** – onboarding path (3-min quiz → 7-min voice test → SUP field check), daily 3-minute quests (Red Flag first)
- **Học tập** – Kahoot-style 180-second quiz (2 questions per group), brand/USP cards, 5 sales steps, 7 competencies
- **Thực chiến** – 50 roleplay scenarios (KH/CHT/NV/KM/BH) with a voice persona, scoring C1–C6 on 0–10 with evidence
- **Passport** – 7-competency radar, levels, Red Flags (< 5.0 opens, ≥ 7.0 + SUP stamp closes; unassessed ≠ 0)
- **Thành tích** – week/month/quarter leaderboard, top-3 podium, change vs previous period, what to improve/keep
- **Scan bill D-day** – PG joins a SUP-configured program (shift + self-declared hours), photographs the bill; server OCR
  (Tesseract, Vietnamese) drafts bill no./time/store/lines, MCH SKUs are matched from `backend/app/data/sku_catalog.json`,
  the PG corrects and confirms (every edit logged), checks mark Hợp lệ / Cần xem xét / Loại (duplicate photo or bill no.,
  wrong day/store, totals mismatch, no MCH); bills are never deleted, only voided with a reason. Results: MCH value,
  value/hour, multi-category rate, value/bill, per-SKU volume, CSV export. SUP reviews flagged bills.
- **SUP** – pilot KPIs, Red Flag queue, listen back to recordings, AI-vs-SUP scoring, Stamp, field audit (revenue, D-day, C7)

## AI (mock)

The doc's Whisper / Claude / ElevenLabs stack is mocked for the pilot:
speech-to-text uses the phone browser (vi-VN); the persona's voice is rendered server-side by
[Piper](https://github.com/rhasspy/piper) with the `vi_VN-vais1000-medium` voice (trained on the VAIS-1000 corpus,
CC BY 4.0), so every phone hears the same Vietnamese voice; and `backend/app/services/mock_ai.py`
plays the persona from each scenario's hidden info and reactions and scores with a transparent rubric.
Swap that module for real providers later; the API and data model stay the same.

## Architecture

```
Cloudflare Tunnel (masan_lms) → Traefik (k3s) ─┬─ /            → frontend (Next.js)
                                               ├─ /api         → backend (FastAPI) → Postgres
                                               └─ /auth/…/token|logout|certs → Keycloak
```

Login is the app's own form; Keycloak verifies passwords, locks out brute force and signs tokens,
but its pages and admin console are not exposed.

Content lives in the repo: `backend/app/data/scenarios.json` (import from the Google Doc with
`backend/scripts/import_scenarios.py`) and `backend/app/data/quiz_bank.json` (simulated until Sales Cap's set arrives).

## Local development

Create a gitignored `.env` in the repo root with these keys (any values):

| Key | Used for |
| --- | --- |
| `POSTGRES_PASSWORD` | local Postgres |
| `KC_ADMIN_PASSWORD` | Keycloak admin (http://localhost:8180/auth/admin) |
| `DEMO_PG_PASSWORD` | log in as `pg01`, `pg02`, `pg03` |
| `DEMO_SUP_PASSWORD` | log in as `sup01` |

```bash
make dev        # http://localhost:3000
make test lint  # tests use the pgnexus_test database, never the app database
```

## CI/CD (GitOps)

A push to `main` runs backend tests (Postgres), frontend lint/typecheck/build and a manifest render, then builds
`ghcr.io/khaidao2/m-web-{backend,frontend}:<sha>`, pins those tags in `k8s/overlays/prod`, and **Argo CD** syncs the
cluster automatically (prune + self-heal). Pull requests run the checks only.

One-time cluster bootstrap (`KUBECONFIG=~/.kube/k3s-fedora.yaml`):

```bash
make secrets    # generates pgnexus-secrets on the cluster (never in git)
make argocd     # registers the Argo CD application
```

Argo CD UI: `kubectl -n argocd port-forward svc/argocd-server 8443:443`, then open https://localhost:8443
(user `admin`; password in the `argocd-initial-admin-secret` secret).

Public access: Cloudflare Tunnel `masan_lms` on fedora-1 (`deploy/cloudflared/config.yml`) → https://masan-lms.sentpul.click.
