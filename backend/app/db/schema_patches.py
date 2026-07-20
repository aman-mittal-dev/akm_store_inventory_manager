"""Apply lightweight ALTERs for existing DBs (create_all does not add new columns)."""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def apply_startup_schema_patches(engine: Engine) -> None:
    dialect = engine.dialect.name
    if dialect != "postgresql":
        logger.info("Skipping user OAuth schema patches (dialect=%s)", dialect)
        return

    try:
        insp = inspect(engine)
        if not insp.has_table("users"):
            return

        cols = {c["name"] for c in insp.get_columns("users")}

        with engine.begin() as conn:
            if "google_sub" not in cols:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)")
                )
                logger.info("Added column users.google_sub")

            conn.execute(
                text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
            )

            conn.execute(
                text(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub_unique
                    ON users (google_sub)
                    WHERE google_sub IS NOT NULL
                    """
                )
            )

            cols = {c["name"] for c in insp.get_columns("users")}
            if "stripe_customer_id" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)"))
                logger.info("Added column users.stripe_customer_id")
            if "stripe_subscription_id" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255)"))
                logger.info("Added column users.stripe_subscription_id")
            if "subscription_status" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN subscription_status VARCHAR(32)"))
                logger.info("Added column users.subscription_status")
            if "subscription_plan" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(32)"))
                logger.info("Added column users.subscription_plan")
            if "subscription_start_at" not in cols:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN subscription_start_at TIMESTAMPTZ")
                )
                logger.info("Added column users.subscription_start_at")
            if "subscription_current_period_end" not in cols:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN subscription_current_period_end TIMESTAMPTZ")
                )
                logger.info("Added column users.subscription_current_period_end")
            if "subscription_cancel_at_period_end" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN subscription_cancel_at_period_end BOOLEAN DEFAULT false NOT NULL"
                    )
                )
                logger.info("Added column users.subscription_cancel_at_period_end")
            if "subscription_amount_inr" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN subscription_amount_inr INTEGER"))
                logger.info("Added column users.subscription_amount_inr")
            if "subscription_custom_months" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN subscription_custom_months INTEGER"))
                logger.info("Added column users.subscription_custom_months")
    except Exception:
        logger.exception(
            "Could not apply users OAuth schema patches; run SQL manually (see backend README)"
        )
