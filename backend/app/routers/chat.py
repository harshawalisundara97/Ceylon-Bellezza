import anthropic
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.chat_rate_limit import is_rate_limited
from app.config import settings
from app.database import get_db
from app.models import Salon, Service

router = APIRouter(tags=["chat"])

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

MODEL = "claude-haiku-4-5"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


def build_system_prompt(db: Session) -> str:
    salons = db.query(Salon).filter(Salon.status == "active").all()
    lines = [
        "You are a helpful assistant for Ceylon Bellezza, a Sri Lankan salon booking website. "
        "Answer questions ONLY using the salon data below. If you don't know something from this "
        "data, say so honestly instead of guessing. When relevant, point the user to the named "
        "salon's page so they can book there themselves — you cannot create a booking.",
        "",
        "Salons:",
    ]
    for salon in salons:
        services = db.query(Service).filter(Service.salon_id == salon.id).all()
        service_lines = (
            ", ".join(f"{s.name} ({s.category}, Rs. {s.price})" for s in services) or "no services listed"
        )
        lines.append(f"- {salon.name} ({salon.category}, {salon.city}): {service_lines}")
    return "\n".join(lines)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many messages — please wait a moment."
        )

    system_prompt = build_system_prompt(db)
    messages = [{"role": m.role, "content": m.content} for m in payload.history[-10:]]
    messages.append({"role": "user", "content": payload.message})

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
    except (anthropic.APIStatusError, anthropic.APIConnectionError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="The assistant is temporarily unavailable."
        )

    reply = "".join(block.text for block in response.content if block.type == "text")
    return ChatResponse(reply=reply)
