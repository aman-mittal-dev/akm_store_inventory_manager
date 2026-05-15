from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class DeliverBillRequest(BaseModel):
    channel: str = Field(description="email | whatsapp")
    provider: str = Field(description="sendgrid | smtp_brevo | twilio_whatsapp | meta_whatsapp")
    recipientEmail: str | None = None
    recipientPhoneE164: str | None = Field(default=None, description="E.164 including +")
    sendMode: str = Field(description="now | later")
    scheduledAt: datetime | None = None
    pdfBase64: str | None = None
    fileName: str | None = Field(default=None, description="Attachment file name for email/WA")
    billFormat: str | None = Field(default="full", description="full | compact when saving pdfBase64")
    invoiceType: str | None = Field(default="customer", description="internal | customer when saving pdfBase64")
    isResend: bool = False

    @model_validator(mode="after")
    def validate_fields(self):
        c = self.channel.lower()
        p = self.provider.lower()
        if c not in ("email", "whatsapp"):
            raise ValueError("channel must be email or whatsapp")
        if p not in ("sendgrid", "smtp_brevo", "twilio_whatsapp", "meta_whatsapp"):
            raise ValueError("invalid provider")
        if c == "email" and p not in ("sendgrid", "smtp_brevo"):
            raise ValueError("email channel requires sendgrid or smtp_brevo")
        if c == "whatsapp" and p not in ("twilio_whatsapp", "meta_whatsapp"):
            raise ValueError("whatsapp channel requires twilio_whatsapp or meta_whatsapp")
        mode = self.sendMode.lower()
        if mode not in ("now", "later"):
            raise ValueError("sendMode must be now or later")
        if mode == "later" and not self.scheduledAt:
            raise ValueError("scheduledAt is required when sendMode is later")
        if c == "email" and not (self.recipientEmail and self.recipientEmail.strip()):
            raise ValueError("recipientEmail is required for email")
        if c == "whatsapp" and not (self.recipientPhoneE164 and self.recipientPhoneE164.strip()):
            raise ValueError("recipientPhoneE164 is required for whatsapp")
        return self


class BillDeliveryOut(BaseModel):
    id: str
    billNumber: str
    printedBillId: str | None
    channel: str
    provider: str
    recipientEmail: str | None
    recipientPhoneE164: str | None
    sendMode: str
    scheduledAt: datetime | None
    status: str
    isResend: bool
    errorMessage: str | None
    providerMessageId: str | None
    sentAt: datetime | None
    createdAt: datetime

    model_config = {"from_attributes": False}

class ApiResponse(BaseModel):
    data: dict | None = None
    message: str
    status: int