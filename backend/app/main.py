from fastapi import FastAPI

from app.routers import auth, salons, services

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)
app.include_router(services.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
