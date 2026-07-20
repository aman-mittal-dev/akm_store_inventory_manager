from datetime import datetime

from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.item import Item
from app.models.transaction import StockTransaction
from app.models.user import User
from app.schemas.transaction import (
    IncomingTransactionCreate,
    OutgoingTransactionCreate,
    PaymentRecordIn,
    PaymentStatusUpdate,
    TransactionOut,
    ApiResponse,
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _build_items_json(
    items: list[dict],
    previous_outstanding_carried: float,
    payment_history: list[PaymentRecordIn] | None = None,
    paid_amount: float = 0,
    transaction_date: datetime | None = None,
) -> dict:
    history = list(payment_history or [])
    if not history and paid_amount > 0 and transaction_date is not None:
        history = [
            PaymentRecordIn(
                id="legacy",
                amount=paid_amount,
                date=transaction_date,
                method=None,
                notes="Previously recorded payment",
            )
        ]

    return {
        "items": items,
        "previousOutstandingCarried": previous_outstanding_carried,
        "paymentHistory": [entry.model_dump(mode="json") for entry in history],
    }


def _payment_history_records(transaction: StockTransaction) -> list[PaymentRecordIn]:
    raw = transaction.items_json.get("paymentHistory")
    if isinstance(raw, list) and raw:
        return [PaymentRecordIn.model_validate(entry) for entry in raw]

    paid = float(transaction.paid_amount)
    if paid > 0:
        return [
            PaymentRecordIn(
                id="legacy",
                amount=paid,
                date=transaction.transaction_date,
                method=None,
                notes="Previously recorded payment",
            )
        ]
    return []


def _serialize(transaction: StockTransaction) -> TransactionOut:
    carried = transaction.items_json.get("previousOutstandingCarried") or 0
    try:
        carried_float = float(carried)
    except (TypeError, ValueError):
        carried_float = 0.0
    return TransactionOut(
        id=str(transaction.id),
        transactionType=transaction.transaction_type,  # type: ignore[arg-type]
        billNumber=transaction.bill_number,
        paymentStatus=transaction.payment_status,  # type: ignore[arg-type]
        totalAmount=float(transaction.total_amount),
        totalProfit=float(transaction.total_profit) if transaction.total_profit is not None else None,
        paidAmount=float(transaction.paid_amount),
        pendingAmount=float(transaction.pending_amount),
        contactName=transaction.contact_name,
        contactPhone=transaction.contact_phone,
        date=transaction.transaction_date,
        notes=transaction.notes,
        items=transaction.items_json.get("items", []),
        previousOutstandingCarried=carried_float,
        paymentHistory=_payment_history_records(transaction),
    )


@router.get("", response_model=ApiResponse) # response_model=list[TransactionOut])
def list_transactions(res: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        records = (
            db.query(StockTransaction)
            .filter(StockTransaction.owner_id == current_user.id)
            .order_by(StockTransaction.transaction_date.desc())
            .all()
        )
        if not records:
            res.status_code = status.HTTP_200_OK
            return {
                "data": [], 
                "message": "No transactions found", 
                "status": status.HTTP_200_OK
            }
        
        res.status_code = status.HTTP_200_OK
        return {
            "data": [_serialize(record) for record in records], 
            "message": "Transactions found", 
            "status": status.HTTP_200_OK
        }
    
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None, 
            "message": "An error occurred while fetching transactions", 
            "status": status.HTTP_400_BAD_REQUEST
        }

@router.post("/incoming", response_model=ApiResponse)
def create_incoming(res: Response, payload: IncomingTransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        for entry in payload.items:
            item = db.query(Item).filter(Item.id == entry.itemId, Item.owner_id == current_user.id).first()
            if item:
                item.current_stock += entry.quantity

        transaction = StockTransaction(
            owner_id=current_user.id,
            transaction_type="incoming",
            bill_number=payload.billNumber,
            contact_name=payload.supplierName,
            contact_phone=payload.supplierContact,
            transaction_date=payload.date,
            notes=payload.notes,
            payment_status=payload.paymentStatus,
            paid_amount=payload.paidAmount,
            pending_amount=payload.pendingAmount,
            total_amount=payload.totalCost,
            total_profit=None,
            items_json=_build_items_json(
                items=[item.model_dump() for item in payload.items],
                previous_outstanding_carried=payload.previousOutstandingCarried or 0,
                payment_history=payload.paymentHistory,
                paid_amount=payload.paidAmount,
                transaction_date=payload.date,
            ),
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)

        res.status_code = status.HTTP_201_CREATED
        return {
            "data": _serialize(transaction), 
            "message": "Transaction created successfully", 
            "status": status.HTTP_201_CREATED
        }
    
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while creating the transaction",
            "status": status.HTTP_400_BAD_REQUEST
        }


@router.post("/outgoing", response_model=ApiResponse)
def create_outgoing(res: Response, payload: OutgoingTransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        for entry in payload.items:
            item = db.query(Item).filter(Item.id == entry.itemId, Item.owner_id == current_user.id).first()
            if item:
                item.current_stock -= entry.quantity

        transaction = StockTransaction(
            owner_id=current_user.id,
            transaction_type="outgoing",
            bill_number=payload.billNumber,
            contact_name=payload.customerName,
            contact_phone=payload.customerContact,
            transaction_date=payload.date,
            notes=payload.notes,
            payment_status=payload.paymentStatus,
            paid_amount=payload.paidAmount,
            pending_amount=payload.pendingAmount,
            total_amount=payload.totalRevenue,
            total_profit=payload.totalProfit,
            items_json=_build_items_json(
                items=[item.model_dump() for item in payload.items],
                previous_outstanding_carried=payload.previousOutstandingCarried or 0,
                payment_history=payload.paymentHistory,
                paid_amount=payload.paidAmount,
                transaction_date=payload.date,
            ),
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)

        res.status_code = status.HTTP_201_CREATED
        return {
            "data": _serialize(transaction), 
            "message": "Transaction created successfully", 
            "status": status.HTTP_201_CREATED
        }
    
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while creating the transaction",
            "status": status.HTTP_400_BAD_REQUEST
        }


@router.patch("/{transaction_id}/payment-status", response_model=ApiResponse)
def update_payment_status(
    transaction_id: str,
    payload: PaymentStatusUpdate,
    res: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        transaction = (
            db.query(StockTransaction)
            .filter(
                StockTransaction.id == transaction_id,
                StockTransaction.owner_id == current_user.id,
            )
            .first()
        )

        if not transaction:
            res.status_code = status.HTTP_404_NOT_FOUND
            return {
                "data": None,
                "message": "Transaction not found",
                "status": status.HTTP_404_NOT_FOUND,
            }

        # Update fields
        transaction.payment_status = payload.paymentStatus
        transaction.paid_amount = payload.paidAmount
        transaction.pending_amount = payload.pendingAmount
        items_json = dict(transaction.items_json)
        items_json["paymentHistory"] = [
            entry.model_dump(mode="json") for entry in payload.paymentHistory
        ]
        transaction.items_json = items_json

        db.commit()
        db.refresh(transaction)

        res.status_code = status.HTTP_200_OK
        return {
            "data": _serialize(transaction),
            "message": "Payment status updated successfully",
            "status": status.HTTP_200_OK,
        }

    except Exception as e:
        db.rollback()

        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while updating payment status",
            "status": status.HTTP_400_BAD_REQUEST,
        }