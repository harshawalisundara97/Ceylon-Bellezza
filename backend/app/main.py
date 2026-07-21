from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, bookings_dashboard, content, gallery, public, salons, services, staff

app = FastAPI(title="Ceylon Bellezza API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(salons.router)
app.include_router(services.router)
app.include_router(staff.router)
app.include_router(gallery.router)
app.include_router(content.router)
app.include_router(public.router)
app.include_router(bookings_dashboard.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
