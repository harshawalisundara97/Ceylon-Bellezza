from fastapi import FastAPI

from app.routers import auth, salons

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
