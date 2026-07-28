# Inventory Management System

Full-stack inventory management app: **React + Vite** frontend and **FastAPI + PostgreSQL** backend.

## Repository layout

```
Inventory Management System/
├── frontend/                 # React (Vite) SPA
│   └── src/app/
│       ├── components/       # Pages + UI (Layout, Login, Pricing, …)
│       ├── context/          # AuthContext, InventoryContext
│       ├── lib/              # API client (access + refresh tokens)
│       ├── services/         # authService, paymentService, …
│       ├── utils/
│       └── routes.tsx
├── backend/                  # FastAPI API (not backend-fastapi/)
│   └── app/
│       ├── api/routes/       # auth, items, payments, bills, …
│       ├── core/             # config, security (JWT)
│       ├── db/               # session, schema_patches
│       ├── models/           # User, RefreshToken, Item, …
│       ├── schemas/
│       └── services/         # token_service, stripe_billing, google_auth, …
├── docs/                     # Extra docs (optional)
├── README.md
└── CHANGELOG.md
```

## Recent features

- **Access + refresh tokens** for email/password and Google sign-in (rotated refresh tokens stored hashed in DB).
- **Post-login routing**: active paid plan or free **14-day trial** → dashboard (`/`); otherwise → `/pricing`.
- **User profile menu** on the main app shell and on pricing / account / checkout pages.
- **Stripe subscriptions**: checkout, verify session (returns updated user), billing portal, webhooks.
- **Bill sharing**, **Parties hub**, and prior outstanding on new invoices (see `CHANGELOG.md`).

## Tech stack

| Layer | Stack |
|--------|--------|
| Frontend | React 18, Vite 6, React Router, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, Stripe, Google ID token verify |

## Quick start — frontend

```bash
cd frontend
npm install
# Copy .env.example → .env (set VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID)
npm run dev
```

## Quick start — backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Copy .env.example → .env (JWT, DB, Stripe, Google, …)
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

## Auth & subscription behavior

| Event | Result |
|--------|--------|
| Login / Signup / Google | Issues `access_token` + `refresh_token` |
| Access expired | Frontend calls `POST /api/v1/auth/refresh` and retries |
| Logout | `POST /api/v1/auth/logout` revokes refresh token |
| Active sub or trial | Dashboard + full Layout (profile menu) |
| Expired / no access | `/pricing` (profile menu still available) |
| After Stripe checkout | Verify returns user + subscription; redirect to dashboard |

## Production notes

- Do not put secrets in frontend `VITE_*` env vars.
- Keep JWT secret, DB URL, Stripe keys, SMTP/WhatsApp credentials in **backend** `.env` only.

## Contributing

When you change behavior or UI, update **`README.md`** and **`CHANGELOG.md`**.
