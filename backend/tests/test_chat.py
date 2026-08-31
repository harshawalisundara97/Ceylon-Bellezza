from unittest.mock import MagicMock, patch

import anthropic

from app.chat_rate_limit import _requests
from app.models import Salon, Service


def _mock_response(text: str):
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    return response


def test_chat_returns_reply_grounded_in_active_salons(client, db_session):
    active = Salon(
        slug="glamour-lk", name="Glamour Salon", category="unisex", address="Addr", city="Colombo", status="active"
    )
    suspended = Salon(
        slug="closed-salon", name="Closed Salon", category="unisex", address="Addr", city="Galle", status="suspended"
    )
    db_session.add_all([active, suspended])
    db_session.commit()
    db_session.add(Service(salon_id=active.id, name="Haircut", category="hair", price=1500.0, duration_minutes=30))
    db_session.commit()

    _requests.clear()
    with patch(
        "app.routers.chat.client.messages.create",
        return_value=_mock_response("Glamour Salon offers a Haircut for Rs. 1500."),
    ) as mock_create:
        response = client.post("/chat", json={"message": "What salons do haircuts?", "history": []})

    assert response.status_code == 200
    assert response.json() == {"reply": "Glamour Salon offers a Haircut for Rs. 1500."}

    system_prompt = mock_create.call_args.kwargs["system"]
    assert "Glamour Salon" in system_prompt
    assert "Closed Salon" not in system_prompt


def test_chat_returns_502_on_anthropic_failure(client, db_session):
    _requests.clear()
    error = anthropic.APIConnectionError(request=MagicMock())
    with patch("app.routers.chat.client.messages.create", side_effect=error):
        response = client.post("/chat", json={"message": "Hello", "history": []})

    assert response.status_code == 502
    assert response.json() == {"detail": "The assistant is temporarily unavailable."}


def test_chat_rate_limits_after_ten_requests(client, db_session):
    _requests.clear()
    with patch("app.routers.chat.client.messages.create", return_value=_mock_response("ok")):
        for _ in range(10):
            response = client.post("/chat", json={"message": "hi", "history": []})
            assert response.status_code == 200

        response = client.post("/chat", json={"message": "hi", "history": []})

    assert response.status_code == 429
    assert response.json() == {"detail": "Too many messages — please wait a moment."}
