

# Inventory Management System (Frontend)

Modern inventory management frontend built with React + Vite.

This repository currently contains the frontend application. It can be used as:
- Standalone demo (local state)
- Production SaaS frontend connected to a Python backend (FastAPI or Django)

## Recent features

- **Bill delivery** (with FastAPI backend): from each bill view, send **email** (SendGrid or SMTP/Brevo) or **WhatsApp** (Meta Cloud API or Twilio) with **Send now** / **Send later** above the bill; every send and resend is logged with timestamps. Configure provider keys in `backend-fastapi/.env` (see `backend-fastapi/.env.example` and `backend-fastapi/README.md`).
- **Parties hub** (`/parties`): see which **customers owe you** (receivable) and which **suppliers you owe** (payable), based on pending amounts on recorded bills.
- **Party drill-down**: `/parties/customer/...` or `/parties/supplier/...` shows **all invoices** for that identity and lets you edit **extra profile fields** (email, GST, address, notes) saved in-browser until backend party endpoints exist.
- **Roll prior balance into new bill**: On **Record Sale** and **Purchase Stock**, after you enter a customer/supplier that already has unpaid history, you can **add prior outstanding** onto the **current invoice total** (matching is by **normalized name + phone digits** — same person must use consistent contact fields).
  - Persisted server-side inside each transaction JSON as **`previousOutstandingCarried`** (`backend-fastapi`).

Details of API fields and versioning notes live in **`CHANGELOG.md`**.

## Tech stack

- React 18
- Vite 6
- React Router
- Tailwind CSS

## Quick start

1. Install dependencies:
   - `npm install`
2. Create env file:
   - Copy `.env.example` to `.env`
3. Run dev server:
   - `npm run dev`

## Production notes

- Do not store secrets in frontend env files (`VITE_*` variables are public in browser).
- Use backend APIs for:
  - Authentication
  - Inventory CRUD
  - Transactions
  - Subscription and billing logic
- Keep DB, payment keys, JWT secrets, SMTP credentials only in backend env.

## Backend integration guide

Detailed step-by-step SaaS + backend plan is available in:
- `SAAS_BACKEND_IMPLEMENTATION_GUIDE.md`
- `FRONTEND_API_WIRING_STEPS.md`

## New backend folder

FastAPI + PostgreSQL scaffold is available in:
- `backend-fastapi/`

## Contributing & documentation policy

Whenever you add or change a feature (even small), please update **`README.md`**, **`CHANGELOG.md`**, and follow the checklist in **`GIT_GITHUB_GUIDELINES.md`** (documentation section).
# akm_store_inventory_manager
# akm_store_inventory_manager
