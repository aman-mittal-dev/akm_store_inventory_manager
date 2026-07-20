import uuid
from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.bill_delivery import BillDelivery
from app.models.user import User
from app.schemas.delivery import (
    BillDeliveryOut,
    DeliverBillRequest,
    ApiResponse,
    BillApiResponse,
    DeliveryConfigOut,
)
from app.services.bill_delivery_dispatch import ensure_printed_bill_id, execute_delivery
from app.services.bill_delivery_config import (
    delivery_config_public,
    resolve_email_provider,
    resolve_whatsapp_provider,
)

router = APIRouter(prefix="/bills", tags=["Bill-Delivery"])

def _to_out(d: BillDelivery) -> BillDeliveryOut:
    return BillDeliveryOut(
        id=str(d.id),
        billNumber=d.bill_number,
        printedBillId=str(d.printed_bill_id) if d.printed_bill_id else None,
        channel=d.channel,
        provider=d.provider,
        recipientEmail=d.recipient_email,
        recipientPhoneE164=d.recipient_phone_e164,
        sendMode=d.send_mode,
        scheduledAt=d.scheduled_at,
        status=d.status,
        isResend=d.is_resend,
        errorMessage=d.error_message,
        providerMessageId=d.provider_message_id,
        sentAt=d.sent_at,
        createdAt=d.created_at,
    )


@router.get("/delivery-config", response_model=ApiResponse)
def get_delivery_config(res: Response, current_user: User = Depends(get_current_user)):
    _ = current_user
    cfg = delivery_config_public()
    res.status_code = status.HTTP_200_OK
    return {
        "data": DeliveryConfigOut(**cfg).model_dump(),
        "message": "Delivery configuration",
        "status": status.HTTP_200_OK,
    }


@router.post("/{bill_number}/deliver", response_model=ApiResponse)
def create_delivery(res: Response, bill_number: str, body: DeliverBillRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bn = bill_number.strip()
        if not bn:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None, 
                "message": "Bill number cannot be empty", 
                "status": status.HTTP_400_BAD_REQUEST
            }

        fmt = (body.billFormat or "full").strip()
        if fmt not in ("full", "compact"):
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None, 
                "message": "billFormat must be full or compact", 
                "status": status.HTTP_400_BAD_REQUEST
            }
        
        inv = (body.invoiceType or "customer").strip()
        if inv not in ("internal", "customer"):
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None, 
                "message": "invoiceType must be internal or customer", 
                "status": status.HTTP_400_BAD_REQUEST
            }

        try:
            pb_id = ensure_printed_bill_id(
                db,
                owner_id=current_user.id,
                bill_number=bn,
                pdf_base64=body.pdfBase64,
                bill_format=fmt,
                invoice_type=inv,
                file_name=body.fileName,
            )
        except ValueError as exc:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None, 
                "message": str(exc), 
                "status": status.HTTP_400_BAD_REQUEST
            }

        channel = body.channel.lower()
        provider = (body.provider or "").strip().lower()
        if not provider:
            if channel == "email":
                provider = resolve_email_provider() or ""
                if not provider:
                    res.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
                    return {
                        "data": None,
                        "message": "Email delivery is not configured on the server (set SendGrid or SMTP/Brevo credentials).",
                        "status": status.HTTP_503_SERVICE_UNAVAILABLE,
                    }
            else:
                provider = resolve_whatsapp_provider() or ""
                if not provider:
                    res.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
                    return {
                        "data": None,
                        "message": "WhatsApp delivery is not configured on the server (set Meta Cloud API or Twilio credentials).",
                        "status": status.HTTP_503_SERVICE_UNAVAILABLE,
                    }

        mode = body.sendMode.lower()
        if mode == "now":
            send_mode = "immediate"
            sched_at = None
            st = "pending"
        else:
            send_mode = "scheduled"
            sched_at = body.scheduledAt
            if not sched_at:
                res.status_code = status.HTTP_400_BAD_REQUEST
                return {
                    "data": None, 
                    "message": "scheduledAt is required for send later", 
                    "status": status.HTTP_400_BAD_REQUEST
                }
            st = "scheduled"

        delivery = BillDelivery(
            owner_id=current_user.id,
            bill_number=bn,
            printed_bill_id=pb_id,
            channel=channel,
            provider=provider,
            recipient_email=(body.recipientEmail or "").strip() or None,
            recipient_phone_e164=(body.recipientPhoneE164 or "").strip() or None,
            send_mode=send_mode,
            scheduled_at=sched_at,
            status=st,
            is_resend=bool(body.isResend),
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        if mode == "now":
            execute_delivery(db, delivery.id)
            db.refresh(delivery)

        res.status_code = status.HTTP_201_CREATED
        return {
            "data": _to_out(delivery), 
            "message": "Delivery created successfully", 
            "status": status.HTTP_201_CREATED
        }

    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None, 
            "message": "An error occurred while creating the delivery", 
            "status": status.HTTP_400_BAD_REQUEST
        }

@router.get("/{bill_number}/deliveries", response_model=BillApiResponse)
def list_deliveries(res: Response, bill_number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bn = bill_number.strip()
        rows = (
            db.query(BillDelivery)
            .filter(BillDelivery.owner_id == current_user.id, BillDelivery.bill_number == bn)
            .order_by(BillDelivery.created_at.desc())
            .all()
        )
        res.status_code = status.HTTP_200_OK
        return {
            "data": [_to_out(r) for r in rows],
            "message": "Deliveries fetched successfully",
            "status": status.HTTP_200_OK
        }
    
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None, 
            "message": "An error occurred while fetching deliveries", 
            "status": status.HTTP_400_BAD_REQUEST
        }

@router.post("/{bill_number}/deliver/{delivery_id}/retry", response_model=BillDeliveryOut)
def retry_failed_delivery(res: Response, bill_number: str, delivery_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        row = (
            db.query(BillDelivery)
            .filter(
                BillDelivery.id == delivery_id,
                BillDelivery.owner_id == current_user.id,
                BillDelivery.bill_number == bill_number.strip(),
            )
            .first()
        )
        if not row:
            res.status_code = status.HTTP_404_NOT_FOUND
            return {
                "data": None, 
                "message": "Delivery not found", 
                "status": status.HTTP_404_NOT_FOUND
            }

        if row.status == "sent":
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None, 
                "message": "Already sent", 
                "status": status.HTTP_400_BAD_REQUEST
            }

        if row.status == "failed":
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None, 
                "message": "Failed delivery cannot be retried", 
                "status": status.HTTP_400_BAD_REQUEST
            }
        
        row.status = "pending"
        row.error_message = None
        db.commit()
        execute_delivery(db, row.id)
        db.refresh(row)

        res.status_code = status.HTTP_200_OK
        return {
            "data": _to_out(row),
            "message": "Delivery retried successfully",
            "status": status.HTTP_200_OK
        }

    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None, 
            "message": "An error occurred while retrying the delivery", 
            "status": status.HTTP_400_BAD_REQUEST
        }
