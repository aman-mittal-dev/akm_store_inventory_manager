from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.bill_delivery import router as bill_delivery_router
from app.api.routes.bills import router as bills_router
from app.api.routes.items import router as items_router
from app.api.routes.payments import router as payments_router
from app.api.routes.public_bills import router as public_bills_router
from app.api.routes.transactions import router as transactions_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(bills_router)
api_router.include_router(bill_delivery_router)
api_router.include_router(public_bills_router)
api_router.include_router(items_router)
api_router.include_router(payments_router)
api_router.include_router(transactions_router)
