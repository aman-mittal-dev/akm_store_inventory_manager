from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel, Field, field_validator
from uuid import UUID

class TransactionItemIn(BaseModel):
    itemId: UUID | None = None
    itemName: str
    sku: str
    quantity: int
    pricePerUnit: float
    totalPrice: float

    @field_validator("itemId", mode="before")
    @classmethod
    def validate_item_id(cls, value):
        # Custom/manual item को existing database item नहीं माना जाएगा
        if value is None or value == "":
            return None

        if isinstance(value, str) and value.startswith("custom-"):
            return None

        # Valid UUID string होने पर Pydantic इसे UUID में बदल देगा
        return value


class PaymentRecordIn(BaseModel):
    id: str
    amount: float
    date: datetime
    method: str | None = None
    notes: str | None = None


class IncomingTransactionCreate(BaseModel):
    items: list[TransactionItemIn]
    totalCost: float
    paidAmount: float
    pendingAmount: float
    paymentStatus: Literal["paid", "partial", "unpaid"]
    supplierName: str
    supplierContact: str | None = None
    previousOutstandingCarried: float = 0
    date: datetime
    notes: str | None = None
    billNumber: str
    paymentHistory: list[PaymentRecordIn] | None = None


class OutgoingTransactionCreate(BaseModel):
    items: list[TransactionItemIn]
    totalRevenue: float
    totalProfit: float
    paidAmount: float
    pendingAmount: float
    paymentStatus: Literal["paid", "partial", "unpaid"]
    customerName: str
    customerContact: str | None = None
    previousOutstandingCarried: float = 0
    date: datetime
    notes: str | None = None
    billNumber: str
    paymentHistory: list[PaymentRecordIn] | None = None


class TransactionOut(BaseModel):
    id: str
    transactionType: Literal["incoming", "outgoing"]
    billNumber: str
    paymentStatus: Literal["paid", "partial", "unpaid"]
    totalAmount: float
    totalProfit: float | None = None
    paidAmount: float
    pendingAmount: float
    contactName: str
    contactPhone: str | None = None
    date: datetime
    notes: str | None = None
    items: list[TransactionItemIn]
    previousOutstandingCarried: float = 0
    paymentHistory: list[PaymentRecordIn] = []


class PaymentStatusUpdate(BaseModel):
    paymentStatus: Literal["paid", "partial", "unpaid"]
    paidAmount: float
    pendingAmount: float
    paymentHistory: list[PaymentRecordIn] = []


class ApiResponse(BaseModel):
    data: Any | None = None
    message: str
    status: int