# app/api/routes/store.py

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.store import Store
from app.models.user import User
from app.schemas.transaction import ApiResponse
from app.schemas.store import StoreSettingsUpdate, StoreSettingsOut

router = APIRouter(prefix="/store", tags=["Store"])

def _serialize(store: Store) -> StoreSettingsOut:
    return StoreSettingsOut(
        id=str(store.id),
        storeName=store.store_name,
        gstNumber=store.gst_number,
        address=store.address,
        phoneNumber=store.phone_number,
        email=store.email,
    )

@router.get("", response_model=ApiResponse)
def get_store_information(
    res: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        store = (
            db.query(Store)
            .filter(Store.owner_id == current_user.id)
            .first()
        )

        if not store:
            store = Store(
                owner_id=current_user.id,
                store_name="Store Inventory Manager",
                gst_number="",
                address="",
                phone_number="",
                email=current_user.email,
            )

            db.add(store)
            db.commit()
            db.refresh(store)

        return {
            "data": _serialize(store),
            "message": "Store settings found",
            "status": status.HTTP_200_OK,
        }

    except Exception:
        return {
            "data": None,
            "message": "Failed to fetch store settings",
            "status": status.HTTP_400_BAD_REQUEST,
        }
    
@router.put("", response_model=ApiResponse)
def update_store_information(
    payload: StoreSettingsUpdate,
    res: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:

        store = (
            db.query(Store)
            .filter(Store.owner_id == current_user.id)
            .first()
        )

        if not store:
            store = Store(
                owner_id=current_user.id,
                store_name=payload.storeName,
                gst_number=payload.gstNumber,
                address=payload.address,
                phone_number=payload.phoneNumber,
                email=payload.email,
            )

            db.add(store)

        else:
            store.store_name = payload.storeName
            store.gst_number = payload.gstNumber
            store.address = payload.address
            store.phone_number = payload.phoneNumber
            store.email = payload.email

        db.commit()
        db.refresh(store)

        res.status_code = status.HTTP_200_OK

        return {
            "data": _serialize(store),
            "message": "Store settings saved successfully",
            "status": status.HTTP_200_OK,
        }

    except Exception as e:
        db.rollback()

        res.status_code = status.HTTP_400_BAD_REQUEST

        return {
            "data": None,
            "message": "Failed to save store settings",
            "status": status.HTTP_400_BAD_REQUEST,
        }