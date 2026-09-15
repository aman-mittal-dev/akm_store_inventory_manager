# FastAPI Backend (PostgreSQL)

Backend for the Inventory Management System (`backend/`).

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
| `CORS_ORIGINS` | Allowed frontend origins |
| Email / WhatsApp vars | Bill delivery (SendGrid or SMTP; Meta or Twilio) |
| `AWS_*` / `PUBLIC_BASE_URL` | Optional S3 images + public PDF links |

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
│   └── routes/              # auth, items, transactions, store, bills, payments, public
├── core/
│   ├── config.py
│   └── security.py          # password hash, access JWT, refresh helpers
├── db/
│   ├── session.py
│   └── schema_patches.py    # startup ALTERs + refresh_tokens table
├── models/
│   ├── user.py
│   ├── refresh_token.py
│   ├── store.py
│   ├── item.py
│   ├── transaction.py
│   ├── printed_bill.py
│   └── …
├── schemas/
└── services/
    ├── token_service.py
    ├── user_payload.py
    ├── google_auth.py
    ├── stripe_billing.py
    ├── bill_delivery_dispatch.py
    └── email_*/whatsapp_*
```

## 4) Auth endpoints

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/auth/signup` | Returns `access_token`, `refresh_token`, `user` |
| `POST` | `/api/v1/auth/login` | Same token pair (password accounts) |
| `POST` | `/api/v1/auth/google` | Body: `{ "idToken": "…" }` → same token pair |
| `POST` | `/api/v1/auth/refresh` | Body: `{ "refresh_token": "…" }` → rotated pair |
| `POST` | `/api/v1/auth/logout` | Body: `{ "refresh_token": "…" }` → revoke |
| `GET` | `/api/v1/auth/me` | Bearer access token → `{ user }` |

Refresh tokens are **opaque**, stored as **SHA-256 hashes** in `refresh_tokens`, and **rotated** on each refresh.

## 5) Payments (Stripe)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/payments/stripe/public-config` | Publishable key |
| `POST` | `/api/v1/payments/stripe/create-checkout-session` | Start Checkout |
| `POST` | `/api/v1/payments/stripe/verify-checkout-session` | Syncs Stripe → user; returns `{ ok, user }` |
| `POST` | `/api/v1/payments/stripe/billing-portal` | Customer portal URL |
| `POST` | `/api/v1/payments/stripe/webhook` | Stripe webhooks |

## 6) Inventory, transactions, store

| Area | Endpoints | Notes |
|------|-----------|--------|
| Items | `GET/POST /api/v1/items`, `PATCH/DELETE /api/v1/items/{id}`, `POST …/images/upload` | Owner-scoped |
| Transactions | `GET /api/v1/transactions`, `POST …/incoming`, `POST …/outgoing`, `PATCH …/{id}/payment-status` | Stock updated server-side |
| Store | `GET /api/v1/store`, `PUT /api/v1/store` | Per-owner store settings for invoices |

### Outgoing (sales) custom lines

- Frontend may send `itemId` as `null` or a `custom-*` string (schema coerces `custom-*` → `null`).
- Lines with `itemId is None` are **bill-only**: no stock availability check and **no stock decrement**.
- Inventory UUID lines still require stock and decrement `current_stock`.

### Incoming (purchases) custom lines

- `itemId is None` creates a new inventory item and sets initial stock from the line quantity.

### Outstanding carry

- Optional `previousOutstandingCarried` on create payloads; validated against party outstanding and stored in `items_json`.

## 7) Bills & delivery

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/bills/print-records` | Persist client-captured PDF (`billFormat`: `full` \| `compact`) |
| `GET` | `/api/v1/bills/delivery-config` | Which channels are configured |
| `POST` | `/api/v1/bills/{bill_number}/deliver` | Queue/send email or WhatsApp |
| `GET` | `/api/v1/bills/{bill_number}/deliveries` | History |
| `POST` | `/api/v1/bills/{bill_number}/deliver/{id}/retry` | Retry failed |
| `GET` | `/api/v1/public/bill-pdf/{token}` | Temporary public PDF URL (e.g. Twilio) |

Client generates PDFs: **full = A4**, **compact ≈ 80mm × content height**.

## 8) Schema notes

On startup, `Base.metadata.create_all` runs, then `schema_patches`:

- `users.google_sub`, nullable `password_hash`, Stripe subscription columns
- `refresh_tokens` table
- Other incremental column/table patches as needed

If the refresh table is missing, create it manually (see older docs or `schema_patches.py`).

## 9) Changelog

API and schema changes: [`CHANGELOG.md`](./CHANGELOG.md).
