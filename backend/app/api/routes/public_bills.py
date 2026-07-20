"""Unauthenticated one-time PDF fetch for Twilio MediaUrl."""

from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.bill_pdf_token import BillPdfPublicToken
from app.models.printed_bill import PrintedBill

router = APIRouter(prefix="/public", tags=["Public"])

@router.get("/bill-pdf/{token}")
def fetch_public_bill_pdf(res: Response, token: str, db: Session = Depends(get_db)):
    try:
        row = db.query(BillPdfPublicToken).filter(BillPdfPublicToken.token == token).first()
        if not row:
            res.status_code = status.HTTP_404_NOT_FOUND
            return {
                "data": None,
                "message": "Not found",
                "status": status.HTTP_404_NOT_FOUND
            }

        exp = row.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
            
        if exp < datetime.now(timezone.utc):
            res.status_code = status.HTTP_410_GONE
            return {
                "data": None,
                "message": "Link expired",
                "status": status.HTTP_410_GONE
            }

        pdf: bytes | None = None
        if row.printed_bill_id:
            pb = db.query(PrintedBill).filter(PrintedBill.id == row.printed_bill_id).first()
            if pb:
                pdf = pb.pdf_bytes
        
        if pdf is None and row.pdf_bytes:
            pdf = row.pdf_bytes
        
        if not pdf:
            res.status_code = status.HTTP_404_NOT_FOUND
            return {
                "data": None, 
                "message": "PDF not available", 
                "status": status.HTTP_404_NOT_FOUND
            }

        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{row.file_name}"'},
        )
    
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred",
            "status": status.HTTP_400_BAD_REQUEST
        }