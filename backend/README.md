# FastAPI Backend (PostgreSQL)

Backend for the Inventory Management System (`backend/`, not `backend-fastapi/`).

## 1) Setup

1. `cd backend`
2. `python -m venv .venv`
3. Windows: `.venv\Scripts\activate`
4. `pip install -r requirements.txt`
5. Copy `.env.example` (if present) and create a `.env` file
6. Create a PostgreSQL database named: `inventory_db`

### Important env vars

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Signs access JWTs |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL (default **15**) |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL (default **30**) |
| `GOOGLE_CLIENT_ID` | Google Sign-In (same as frontend `VITE_GOOGLE_CLIENT_ID`) |
| `STRIPE_*` / `FRONTEND_BASE_URL` | Subscriptions (Checkout + portal + webhooks) |

## 2) Run

```bash
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

## 3) Folder structure

```
backend/app/
├── api/
│   ├── deps.py              # Bearer JWT → current user
│   └── routes/              # auth, payments, items, transactions, bills, …
├── core/
│   ├── config.py
│   └── security.py          # password hash, access JWT, refresh token helpers
├── db/
│   ├── session.py
│   └── schema_patches.py    # startup ALTERs + refresh_tokens table
├── models/
│   ├── user.py
│   ├── refresh_token.py     # hashed refresh tokens
│   └── …
├── schemas/
└── services/
    ├── token_service.py     # issue / rotate / revoke token pairs
    ├── user_payload.py      # serialize user + subscription for API
    ├── google_auth.py
    └── stripe_billing.py
```

## 4) Auth endpoints

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/auth/signup` | Returns `access_token`, `refresh_token`, `user` |
| `POST` | `/api/v1/auth/login` | Same token pair (password accounts) |
| `POST` | `/api/v1/auth/google` | Body: `{ "idToken": "…" }` → same token pair |
| `POST` | `/api/v1/auth/refresh` | Body: `{ "refresh_token": "…" }` → rotated pair |
| `POST` | `/api/v1/auth/logout` | Body: `{ "refresh_token": "…" }` → revoke |
| `GET` | `/api/v1/auth/me` | Bearer access token → `{ user }` (includes Stripe subscription when present) |

Refresh tokens are **opaque**, stored as **SHA-256 hashes** in `refresh_tokens`, and **rotated** on each refresh.

## 5) Payments (Stripe)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/payments/stripe/public-config` | Publishable key |
| `POST` | `/api/v1/payments/stripe/create-checkout-session` | Start Checkout |
| `POST` | `/api/v1/payments/stripe/verify-checkout-session` | Syncs Stripe → user; returns `{ ok, user }` |
| `POST` | `/api/v1/payments/stripe/billing-portal` | Customer portal URL |
| `POST` | `/api/v1/payments/stripe/webhook` | Stripe webhooks |

## 6) Other important endpoints

- `GET/POST/PATCH/DELETE /api/v1/items` (+ image upload)
- `GET/POST /api/v1/transactions` (incoming / outgoing)
- `POST /api/v1/bills/print-records`
- `POST/GET /api/v1/bills/{bill_number}/deliver(y|ies)` (+ retry)
- `GET /api/v1/public/bill-pdf/{token}` — temporary PDF URL for Twilio

## 7) Schema notes

On startup, `Base.metadata.create_all` runs, then `schema_patches`:

- `users.google_sub`, nullable `password_hash`, Stripe subscription columns
- `refresh_tokens` table (id, user_id, token_hash, expires_at, revoked_at)

If patches fail, create the refresh table manually:

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);
```
