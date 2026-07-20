from pydantic import BaseModel, EmailStr


class StoreSettingsUpdate(BaseModel):
    storeName: str
    gstNumber: str | None = None
    address: str | None = None
    phoneNumber: str | None = None
    email: EmailStr | None = None


class StoreSettingsOut(BaseModel):
    id: str
    storeName: str
    gstNumber: str | None
    address: str | None
    phoneNumber: str | None
    email: str | None