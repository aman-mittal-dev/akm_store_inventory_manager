# Inventory Management System

Full-stack inventory management app: **React + Vite** frontend and **FastAPI + PostgreSQL** backend.

## Repository layout

```
Inventory Management System/
├── frontend/                 # React (Vite) SPA
│   ├── guidelines/           # Frontend AI / design guidelines
│   ├── ATTRIBUTIONS.md
│   └── src/app/
│       ├── components/       # Pages + UI (Layout, ViewBill, Parties, …)
│       ├── context/          # AuthContext, InventoryContext
│       ├── lib/              # API client (access + refresh tokens)
│       ├── services/         # auth, inventory, payments, bills
│       ├── utils/            # currency, party, dateTime, …
│       └── routes.tsx
├── backend/                  # FastAPI API
│   ├── README.md
│   ├── CHANGELOG.md
│   └── app/
│       ├── api/routes/       # auth, items, transactions, store, bills, payments
│       ├── core/             # config, security (JWT)
│       ├── db/               # session, schema_patches
│       ├── models/
│       ├── schemas/
│       └── services/         # tokens, Stripe, Google, email/WhatsApp, …
├── docs/                     # Guides (API wiring, Git, SaaS)
├── README.md
└── CHANGELOG.md              # Product-facing changelog
```

## Features

- **Auth**: email/password + Google; access JWT + rotated refresh tokens.
- **Subscriptions**: 14-day trial, Stripe Checkout / portal / webhooks; gated app shell.
- **Inventory**: items CRUD, optional images (S3), low-stock awareness.
- **Purchases & sales**: multi-line carts with **inline edit** (name, qty, price); **custom / ad-hoc lines** on sales (no stock deduction).
- **Store settings**: persisted via `GET/PUT /api/v1/store` (invoices use saved store info).
- **Parties**: Customers & Suppliers hub + party detail; optional prior outstanding on new bills.
- **Transaction history**: Sales / Purchases tabs; summary cards with Sale/Purchase badges; View Bill only (no per-line SKU dump).
- **Bills**: full-page (A4) or **compact 80mm** receipt; print, save PDF, email / WhatsApp share.
- **Accurate bill times**: transaction date uses selected calendar day + **system clock** (`dateWithSystemTime`).

See `CHANGELOG.md` and `backend/CHANGELOG.md` for release notes.

## Tech stack

| Layer | Stack |
|--------|--------|
| Frontend | React 18, Vite 6, React Router 7, Tailwind CSS 4, jsPDF, html2canvas |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, Stripe, Google ID token verify |

## Quick start — frontend

```bash
cd frontend
npm install
# Copy .env.example → .env (VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID)
npm run dev
```

## Quick start — backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Copy .env.example → .env (JWT, DB, Stripe, Google, bill delivery, …)
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

More detail: [`backend/README.md`](backend/README.md), [`docs/FRONTEND_API_WIRING_STEPS.md`](docs/FRONTEND_API_WIRING_STEPS.md).

## Auth & subscription behavior

| Event | Result |
|--------|--------|
| Login / Signup / Google | Issues `access_token` + `refresh_token` |
| Access expired | Frontend calls `POST /api/v1/auth/refresh` and retries |
| Logout | `POST /api/v1/auth/logout` revokes refresh token |
| Active sub or trial | Dashboard + full Layout |
| Expired / no access | `/pricing` (profile menu still available) |
| After Stripe checkout | Verify returns user + subscription; redirect to dashboard |

## Production notes

- Do not put secrets in frontend `VITE_*` env vars.
- Keep JWT secret, DB URL, Stripe keys, SMTP/WhatsApp credentials in **backend** `.env` only.

## Contributing

When you change behavior or UI, update:

1. Root **`CHANGELOG.md`** (and **`backend/CHANGELOG.md`** for API/schema changes)
2. Root **`README.md`** and/or **`backend/README.md`**
3. Relevant files under **`docs/`** when wiring or process changes

See [`docs/GIT_GITHUB_GUIDELINES.md`](docs/GIT_GITHUB_GUIDELINES.md).
