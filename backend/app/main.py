import threading
import time

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.schema_patches import apply_startup_schema_patches
from app.db.session import SessionLocal, engine
from app.models import BillDelivery, BillPdfPublicToken, Item, PrintedBill, StockTransaction, User  # noqa: F401
from app.services.bill_delivery_dispatch import process_due_scheduled

app = FastAPI(title=settings.APP_NAME, debug=settings.APP_DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


def _scheduled_delivery_poller() -> None:
    interval = max(15, int(settings.BILL_DELIVERY_POLL_SECONDS))
    while True:
        time.sleep(interval)
        db = SessionLocal()
        try:
            process_due_scheduled(db)
        finally:
            db.close()


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    apply_startup_schema_patches(engine)
    threading.Thread(
        target=_scheduled_delivery_poller,
        name="bill-delivery-poller",
        daemon=True,
    ).start()


@app.get("/health", tags=["Health"])
def health():
    return {"data": {"app": settings.APP_NAME}, "message": "Healthy", "status": status.HTTP_200_OK}

@app.get("/", tags=["Home"])
def home():
    return {"data": {"app": settings.APP_NAME}, "message": f"Welcome to the {settings.APP_NAME}!", "status": status.HTTP_200_OK}
