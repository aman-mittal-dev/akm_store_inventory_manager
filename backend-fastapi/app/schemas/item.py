from datetime import datetime
from pydantic import BaseModel, Field


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: str = Field(min_length=1, max_length=120)
    category: str = "General"
    purchasePrice: float = 0
    sellingPrice: float = 0
    currentStock: int = 0
    lowStockThreshold: int = 0
    imageUrl: str | None = None
    description: str | None = None
    isBundle: bool = False


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: str | None = Field(default=None, max_length=120)
    category: str = "General"
    purchasePrice: float = 0
    sellingPrice: float = 0
    currentStock: int = 0
    lowStockThreshold: int = 0
    imageUrl: str | None = None
    description: str | None = None
    isBundle: bool = False


class ItemUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    category: str | None = None
    purchasePrice: float | None = None
    sellingPrice: float | None = None
    currentStock: int | None = None
    lowStockThreshold: int | None = None
    imageUrl: str | None = None
    description: str | None = None
    isBundle: bool | None = None


class ItemOut(ItemBase):
    id: str
    createdAt: datetime
    updatedAt: datetime | None = None

class ApiResponse(BaseModel):
    data: dict | None = None
    message: str
    status: int