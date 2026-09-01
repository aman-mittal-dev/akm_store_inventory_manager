"""Party balance helpers — consolidate carried outstanding into new invoices."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.transaction import StockTransaction


def normalize_party_key(name: str, contact: str | None) -> str:
    normalized_name = " ".join(name.strip().lower().split())
    phone_digits = "".join(character for character in (contact or "") if character.isdigit())
    return f"{normalized_name}|{phone_digits}"


def party_outstanding_total(
    db: Session,
    owner_id,
    transaction_type: str,
    party_name: str,
    party_contact: str | None,
) -> float:
    party_key = normalize_party_key(party_name, party_contact)
    total = 0.0
    records = (
        db.query(StockTransaction)
        .filter(
            StockTransaction.owner_id == owner_id,
            StockTransaction.transaction_type == transaction_type,
            StockTransaction.pending_amount > 0,
        )
        .all()
    )
    for record in records:
        if normalize_party_key(record.contact_name, record.contact_phone) != party_key:
            continue
        total += float(record.pending_amount)
    return round(total, 2)


def apply_carried_outstanding(
    db: Session,
    owner_id,
    transaction_type: str,
    party_name: str,
    party_contact: str | None,
    carry_amount: float,
    consolidating_bill_number: str,
    consolidate_date: datetime,
) -> None:
    """Move outstanding from older party bills into a new invoice (FIFO)."""
    if carry_amount <= 0:
        return

    records = (
        db.query(StockTransaction)
        .filter(
            StockTransaction.owner_id == owner_id,
            StockTransaction.transaction_type == transaction_type,
            StockTransaction.pending_amount > 0,
        )
        .order_by(StockTransaction.transaction_date.asc())
        .all()
    )

    party_key = normalize_party_key(party_name, party_contact)
    remaining = round(carry_amount, 2)

    for record in records:
        if remaining <= 0:
            break
        if normalize_party_key(record.contact_name, record.contact_phone) != party_key:
            continue

        pending = round(float(record.pending_amount), 2)
        applied = round(min(remaining, pending), 2)
        if applied <= 0:
            continue

        new_pending = round(pending - applied, 2)
        new_paid = round(float(record.paid_amount) + applied, 2)

        record.pending_amount = new_pending
        record.paid_amount = new_paid
        record.payment_status = "paid" if new_pending <= 0 else "partial"

        items_json = dict(record.items_json)
        history = list(items_json.get("paymentHistory") or [])
        history.append(
            {
                "id": f"consol-{consolidating_bill_number}-{record.bill_number}",
                "amount": applied,
                "date": consolidate_date.isoformat(),
                "method": "consolidation",
                "notes": f"Balance carried to invoice {consolidating_bill_number}",
            }
        )
        items_json["paymentHistory"] = history
        record.items_json = items_json

        remaining = round(remaining - applied, 2)
