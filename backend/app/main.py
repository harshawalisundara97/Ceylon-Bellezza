from fastapi import FastAPI

app = FastAPI(title="Ceylon Bellezza API")


@app.get("/health")
def health_check():
    return {"status": "ok"}
