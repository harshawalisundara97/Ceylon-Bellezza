from fastapi import FastAPI

from app.routers import auth, content, gallery, salons, services, staff

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)
app.include_router(services.router)
app.include_router(staff.router)
app.include_router(gallery.router)
app.include_router(content.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
