import resend

from app.config import settings


def send_owner_invite(to_email: str, temp_password: str, salon_name: str) -> bool:
    """Send the salon-owner invite email. Returns True if sent, False if skipped or failed. Never raises."""
    if not settings.resend_api_key:
        print(f"[email skipped: no RESEND_API_KEY] Would invite {to_email} to manage {salon_name}")
        return False

    resend.api_key = settings.resend_api_key
    login_url = f"{settings.frontend_url}/admin/login"
    try:
        resend.Emails.send(
            {
                "from": "Ceylon Bellezza <onboarding@resend.dev>",
                "to": to_email,
                "subject": f"You're set up to manage {salon_name} on Ceylon Bellezza",
                "html": (
                    f"<p>Log in at <a href='{login_url}'>{login_url}</a></p>"
                    f"<p>Email: {to_email}<br>Temporary password: <strong>{temp_password}</strong></p>"
                    f"<p>Please log in and note your credentials safely.</p>"
                ),
            }
        )
        return True
    except Exception:
        return False
