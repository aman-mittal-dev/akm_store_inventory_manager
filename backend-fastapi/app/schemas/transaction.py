from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel


class TransactionItemIn(BaseModel):
    itemId: str
    itemName: str
    sku: str
    quantity: int
    pricePerUnit: float
    totalPrice: float


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


class ApiResponse(BaseModel):
    data: Any | None = None
    message: str
    status: int