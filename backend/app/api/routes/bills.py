import base64
from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.printed_bill import PrintedBill
from app.models.user import User
from app.schemas.bill import PrintedBillCreate, PrintedBillOut, ApiResponse

router = APIRouter(prefix="/bills", tags=["Bills"])

def _serialize(record: PrintedBill) -> PrintedBillOut:
    return PrintedBillOut(
        id=str(record.id),
        billNumber=record.bill_number,
        billFormat=record.bill_format,
        invoiceType=record.invoice_type,
        fileName=record.file_name,
        createdAt=record.created_at,
    )


@router.post("/print-records", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_print_record(res: Response, payload: PrintedBillCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        try:
            pdf_bytes = base64.b64decode(payload.pdfBase64, validate=True)
        except Exception as e:  # noqa: BLE001
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None, 
                "message": "Invalid PDF payload", 
                "status": status.HTTP_400_BAD_REQUEST
            }

        if not pdf_bytes:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None, 
                "message": "PDF payload is empty", 
                "status": status.HTTP_400_BAD_REQUEST
            }

        record = PrintedBill(
            owner_id=current_user.id,
            bill_number=payload.billNumber,
            bill_format=payload.billFormat,
            invoice_type=payload.invoiceType,
            file_name=payload.fileName,
            pdf_bytes=pdf_bytes,
        )

        db.add(record)
        db.commit()
        db.refresh(record)

        res.status_code = status.HTTP_201_CREATED
        return {
            "data": _serialize(record), 
            "message": "Print record saved successfully", 
            "status": status.HTTP_201_CREATED
        }

    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None, 
            "message": "An error occurred while saving the print record", 
            "status": status.HTTP_400_BAD_REQUEST
        }
