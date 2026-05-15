# FastAPI Backend (PostgreSQL)

This folder contains a backend service separated from the frontend.

## 1) Setup

1. `cd backend-fastapi`
2. `python -m venv .venv`
3. Windows: `.venv\Scripts\activate`
4. `pip install -r requirements.txt`
5. Copy `.env.example` and create a `.env` file
6. Create a PostgreSQL database named: `inventory_db`

## 2) Run

`uvicorn app.main:app --reload --port 8000`

API documentation:
- `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## 3) Important Endpoints

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/google` — Sign in with Google (JSON body: `idToken`)
- `GET /api/v1/auth/me`
- `GET /api/v1/items`
- `POST /api/v1/items`
- `POST /api/v1/items/images/upload` — multipart field `file` (JPEG/PNG/WebP, max 5 MB); returns `{ url }` for `imageUrl` on items (requires AWS S3 environment variables)
- `PATCH /api/v1/items/{item_id}`
- `DELETE /api/v1/items/{item_id}`
- `GET /api/v1/transactions`
- `POST /api/v1/transactions/incoming`
- `POST /api/v1/transactions/outgoing`
- `POST /api/v1/bills/print-records`
- `POST /api/v1/bills/{bill_number}/deliver` — queue email (SendGrid or SMTP) or WhatsApp (Twilio or Meta); optional **Send later** with `scheduledAt`
- `GET /api/v1/bills/{bill_number}/deliveries` — dispatch log (each send and resend)
- `POST /api/v1/bills/{bill_number}/deliver/{delivery_id}/retry` — retry a failed delivery
- `GET /api/v1/public/bill-pdf/{token}` — unauthenticated PDF (temporary link for Twilio MediaUrl only)

## 4) Notes

- This scaffold uses `Base.metadata.create_all(...)` for quick setup.
- **Google Sign-In**: set `GOOGLE_CLIENT_ID` to your OAuth **Web client** ID (same as frontend `VITE_GOOGLE_CLIENT_ID`).

On startup, the API automatically applies a small PostgreSQL patch:
- Adds `users.google_sub`
- Makes `password_hash` nullable
- Creates a unique index on `google_sub`

If the automatic patch fails, run these SQL commands manually:

```sql
ALTER TABLE users ADD COLUMN google_sub VARCHAR(255);

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub_unique
ON users (google_sub)
WHERE google_sub IS NOT NULL;