from fastapi import APIRouter, Depends, status, Response, UploadFile, File
import secrets
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate, ApiResponse
from app.services.s3_images import upload_item_image_bytes

router = APIRouter(prefix="/items", tags=["Items"])


def _generate_unique_sku(db: Session, owner_id) -> str:
    for _ in range(64):
        candidate = f"SKU-{secrets.token_hex(4).upper()}"
        exists = db.query(Item).filter(Item.owner_id == owner_id, Item.sku == candidate).first()
        if not exists:
            return candidate
    raise RuntimeError("Could not allocate a unique SKU")


def serialize_item(item: Item) -> ItemOut:
    return ItemOut(
        id=str(item.id),
        name=item.name,
        sku=item.sku,
        category=item.category,
        purchasePrice=float(item.purchase_price),
        sellingPrice=float(item.selling_price),
        currentStock=item.current_stock,
        lowStockThreshold=item.low_stock_threshold,
        imageUrl=item.image_url,
        description=item.description,
        isBundle=item.is_bundle,
        createdAt=item.created_at,
        updatedAt=item.updated_at,
    )


@router.post("/images/upload", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def upload_item_image(
    res: Response,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    try:
        body = await file.read()
        url = upload_item_image_bytes(
            owner_id=str(current_user.id),
            content_type=file.content_type or "application/octet-stream",
            body=body,
        )
        res.status_code = status.HTTP_201_CREATED
        return {
            "data": {"url": url},
            "message": "Image uploaded successfully",
            "status": status.HTTP_201_CREATED,
        }
    except ValueError as exc:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": str(exc),
            "status": status.HTTP_400_BAD_REQUEST,
        }
    except Exception as exc:
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {
            "data": None,
            "message": str(exc)[:500],
            "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
        }


@router.get("", response_model=ApiResponse)
def get_items(res: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        items = db.query(Item).filter(Item.owner_id == current_user.id).order_by(Item.created_at.desc()).all()
        res.status_code = status.HTTP_200_OK
        return {
            "data": {"items": [serialize_item(item) for item in items]},
            "message": "Items fetched successfully",
            "status": status.HTTP_200_OK
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while fetching items",
            "status": status.HTTP_400_BAD_REQUEST
        }

@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_item(res: Response, payload: ItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        sku_in = (payload.sku or "").strip()
        sku = sku_in if sku_in else _generate_unique_sku(db, current_user.id)

        existing = db.query(Item).filter(Item.owner_id == current_user.id, Item.sku == sku).first()
        if existing:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "message": "SKU already exists", 
                "status": status.HTTP_400_BAD_REQUEST
            }

        item = Item(
            owner_id=current_user.id,
            name=payload.name,
            sku=sku,
            category=payload.category,
            purchase_price=payload.purchasePrice,
            selling_price=payload.sellingPrice,
            current_stock=payload.currentStock,
            low_stock_threshold=payload.lowStockThreshold,
            image_url=payload.imageUrl,
            description=payload.description,
            is_bundle=payload.isBundle,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        res.status_code = status.HTTP_201_CREATED
        return {
            "data": {"item":serialize_item(item)},
            "message": "Item created successfully",
            "status": status.HTTP_201_CREATED
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while creating the item",
            "status": status.HTTP_400_BAD_REQUEST
        }


@router.patch("/{item_id}", response_model=ApiResponse)
def update_item(res: Response, item_id: str, payload: ItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        item = db.query(Item).filter(Item.id == item_id, Item.owner_id == current_user.id).first()
        if not item:
            res.status_code = status.HTTP_404_NOT_FOUND
            return {
                "data": None, 
                "message": "Item not found", 
                "status": status.HTTP_404_NOT_FOUND
            }
        
        data = payload.model_dump(exclude_unset=True)
        field_map = {
            "purchasePrice": "purchase_price",
            "sellingPrice": "selling_price",
            "currentStock": "current_stock",
            "lowStockThreshold": "low_stock_threshold",
            "imageUrl": "image_url",
            "isBundle": "is_bundle",
        }
        for key, value in data.items():
            setattr(item, field_map.get(key, key), value)

        db.commit()
        db.refresh(item)
        res.status_code = status.HTTP_200_OK
        return {
            "data": {"item": serialize_item(item)}, 
            "message": "Item updated successfully",
            "status": status.HTTP_200_OK
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while updating the item",
            "status": status.HTTP_400_BAD_REQUEST
        }


@router.delete("/{item_id}")
def delete_item(res: Response, item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        item = db.query(Item).filter(Item.id == item_id, Item.owner_id == current_user.id).first()
        if not item:
            res.status_code = status.HTTP_404_NOT_FOUND
            return {
                "data": None, 
                "message": "Item not found", 
                "status": status.HTTP_404_NOT_FOUND
            }
    
        db.delete(item)
        db.commit()
        res.status_code = status.HTTP_200_OK
        return {
            "data": None,
            "message": "Item deleted successfully",
            "status": status.HTTP_204_NO_CONTENT
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while deleting the item",
            "status": status.HTTP_400_BAD_REQUEST
        }