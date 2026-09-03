from datetime import datetime
from pydantic import BaseModel
from typing import Generic, TypeVar

class PrintedBillCreate(BaseModel):
    billNumber: str
    billFormat: str
    invoiceType: str
    fileName: str
    pdfBase64: str

class PrintedBillOut(BaseModel):
    id: str
    billNumber: str
    billFormat: str
    invoiceType: str
    fileName: str
    createdAt: datetime

# class ApiResponse(BaseModel):
#     data: dict | None = None
#     message: str
#     status: int

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    data: T | None = None
    message: str
    status: int
