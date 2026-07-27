from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from app.auth.security import create_access_token, decode_access_token, verify_password
from app.config import settings
from app.database import engine, SessionLocal
from app.models.admin import PlatformAdmin, SalonAdmin
from app.models.booking import Booking
from app.models.content import ContentBlock
from app.models.gallery import GalleryItem
from app.models.lead import SalonLead
from app.models.salon import Salon
from app.models.service import Service
from app.models.staff import Staff, StaffAvailability


class PlatformAdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        email, password = form.get("username"), form.get("password")
        db = SessionLocal()
        try:
            admin = db.query(PlatformAdmin).filter(PlatformAdmin.email == email).first()
        finally:
            db.close()
        if not admin or not verify_password(password, admin.password_hash):
            return False
        request.session["token"] = create_access_token({"sub": str(admin.id), "role": "platform_admin"})
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        if not token:
            return False
        try:
            payload = decode_access_token(token)
        except Exception:
            return False
        return payload.get("role") == "platform_admin"


class SalonView(ModelView, model=Salon):
    column_list = [Salon.id, Salon.name, Salon.slug, Salon.city, Salon.category, Salon.status]
    column_searchable_list = [Salon.name, Salon.slug, Salon.city]
    column_sortable_list = [Salon.name, Salon.city, Salon.status, Salon.created_at]
    form_excluded_columns = [Salon.created_at]


class PlatformAdminView(ModelView, model=PlatformAdmin):
    name = "Platform Admin"
    column_list = [PlatformAdmin.id, PlatformAdmin.email]
    form_excluded_columns = [PlatformAdmin.password_hash]


class SalonAdminView(ModelView, model=SalonAdmin):
    name = "Salon Admin"
    column_list = [SalonAdmin.id, SalonAdmin.email, SalonAdmin.salon_id]
    form_excluded_columns = [SalonAdmin.password_hash]


class ServiceView(ModelView, model=Service):
    column_list = [Service.id, Service.name, Service.salon_id, Service.category, Service.price, Service.duration_minutes]
    column_searchable_list = [Service.name, Service.category]


class StaffView(ModelView, model=Staff):
    name = "Staff"
    column_list = [Staff.id, Staff.name, Staff.salon_id]
    column_searchable_list = [Staff.name]


class StaffAvailabilityView(ModelView, model=StaffAvailability):
    name = "Staff Availability"
    column_list = [StaffAvailability.id, StaffAvailability.staff_id, StaffAvailability.day_of_week, StaffAvailability.start_time, StaffAvailability.end_time]


class GalleryItemView(ModelView, model=GalleryItem):
    name = "Gallery Item"
    column_list = [GalleryItem.id, GalleryItem.salon_id, GalleryItem.caption]


class ContentBlockView(ModelView, model=ContentBlock):
    name = "Content Block"
    column_list = [ContentBlock.id, ContentBlock.salon_id, ContentBlock.key]


class BookingView(ModelView, model=Booking):
    column_list = [
        Booking.id,
        Booking.salon_id,
        Booking.customer_name,
        Booking.customer_phone,
        Booking.gender,
        Booking.scheduled_at,
        Booking.status,
    ]
    column_searchable_list = [Booking.customer_name, Booking.customer_phone, Booking.customer_email]
    column_sortable_list = [Booking.scheduled_at, Booking.status]


class SalonLeadView(ModelView, model=SalonLead):
    name = "Salon Lead"
    column_list = [
        SalonLead.id,
        SalonLead.contact_name,
        SalonLead.contact_email,
        SalonLead.status,
        SalonLead.created_at,
    ]
    column_sortable_list = [SalonLead.created_at, SalonLead.status]
    form_excluded_columns = [SalonLead.created_at]


def register_admin(app: FastAPI) -> None:
    admin = Admin(app, engine, authentication_backend=PlatformAdminAuth(secret_key=settings.jwt_secret_key))
    for view in (
        SalonView,
        PlatformAdminView,
        SalonAdminView,
        ServiceView,
        StaffView,
        StaffAvailabilityView,
        GalleryItemView,
        ContentBlockView,
        BookingView,
        SalonLeadView,
    ):
        admin.add_view(view)

