import smtplib
import secrets
from email.mime.text import MIMEText
from datetime import datetime, timedelta
import config


def generate_token(length=48):
    """Generate a cryptographically secure random token."""
    return secrets.token_hex(length)


def send_verification_email(to_email, token):
    """Send verification email via SMTP, or log URL if SMTP not configured."""
    app_url = config.APP_URL
    verify_url = f"{app_url.rstrip('/')}/verify?token={token}"

    subject = "Verify your email — music-self"
    body = f"""
Thank you for signing up to music-self!

Please verify your email address by clicking the link below:

{verify_url}

This link expires in 24 hours.

— music-self
"""

    if config.SMTP_HOST and config.SMTP_USER and config.SMTP_PASS:
        msg = MIMEText(body.strip())
        msg["Subject"] = subject
        msg["From"] = config.SMTP_FROM
        msg["To"] = to_email

        try:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
                server.starttls()
                server.login(config.SMTP_USER, config.SMTP_PASS)
                server.send_message(msg)
            print(f"[email] Verification sent to {to_email}")
            return True, None
        except Exception as e:
            print(f"[email] SMTP failed for {to_email}: {e}")
            return False, str(e)
    else:
        # Dev mode: just log the URL
        print(f"\n{'='*60}")
        print(f"  [DEV] Verification URL for {to_email}:")
        print(f"  {verify_url}")
        print(f"{'='*60}\n")
        return True, None


def get_verification_expiry(hours=24):
    """Return a datetime `hours` from now."""
    return datetime.utcnow() + timedelta(hours=hours)
