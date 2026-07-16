from flask import Blueprint, request, session, jsonify
import bcrypt
import config
import models
from email_service import generate_token, send_verification_email, get_verification_expiry
from datetime import datetime

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body required"}), 400

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    conn = models.get_db()
    existing = conn.execute("SELECT id, email_verified FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Email already registered"}), 409

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    cur = conn.execute(
        "INSERT INTO users (email, password_hash, email_verified) VALUES (?, ?, 0)",
        (email, pw_hash)
    )
    conn.commit()

    # Fetch the user_id (works for both SQLite and PG)
    user_row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    user_id = user_row["id"]
    session["user_id"] = user_id

    # ── Verification setup (best-effort — user is created regardless) ──
    verification_sent = False
    verification_url = None

    try:
        token = generate_token()
        expires = get_verification_expiry(24)
        conn.execute(
            "INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user_id, token, expires.isoformat())
        )
        conn.commit()
        conn.close()

        sent, _ = send_verification_email(email, token)
        verification_sent = sent
        # In dev mode, include the URL so the frontend can show it
        if not config.SMTP_HOST:
            app_url = config.APP_URL
            verification_url = f"{app_url.rstrip('/')}/verify?token={token}"
    except Exception as e:
        print(f"[auth] signup verification setup failed (non-fatal): {e}")
        try:
            conn.close()
        except Exception:
            pass

    return jsonify({
        "user": {"id": user_id, "email": email, "email_verified": False},
        "verification_sent": verification_sent,
        "verification_url": verification_url,
        "message": "Account created! You can now explore the app."
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body required"}), 400

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    conn = models.get_db()
    row = conn.execute(
        "SELECT id, email, password_hash, email_verified FROM users WHERE email = ?",
        (email,)
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), row["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = row["id"]
    return jsonify({
        "user": {
            "id": row["id"],
            "email": row["email"],
            "email_verified": bool(row["email_verified"])
        }
    })


@auth_bp.route("/verify/<token>", methods=["GET"])
def verify_email(token):
    """Verify email using a token from the verification email link."""
    if not token:
        return jsonify({"error": "Token required"}), 400

    conn = models.get_db()
    row = conn.execute(
        "SELECT id, user_id, expires_at FROM email_verifications WHERE token = ?",
        (token,)
    ).fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "Invalid or expired verification link"}), 404

    # Check expiry
    try:
        expires = datetime.fromisoformat(row["expires_at"])
        if datetime.utcnow() > expires:
            conn.execute("DELETE FROM email_verifications WHERE id = ?", (row["id"],))
            conn.commit()
            conn.close()
            return jsonify({"error": "Verification link has expired. Please request a new one."}), 410
    except (ValueError, TypeError):
        pass

    user_id = row["user_id"]

    # Mark user as verified
    conn.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user_id,))
    conn.execute("DELETE FROM email_verifications WHERE id = ?", (row["id"],))
    conn.commit()
    conn.close()

    # Log the user in if they're not already
    session["user_id"] = user_id

    return jsonify({"ok": True, "message": "Email verified! You are now logged in."})


@auth_bp.route("/resend-verification", methods=["POST"])
def resend_verification():
    """Resend the verification email to the current user."""
    uid = session.get("user_id")
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401

    conn = models.get_db()
    user = conn.execute(
        "SELECT id, email, email_verified FROM users WHERE id = ?", (uid,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    if user["email_verified"]:
        conn.close()
        return jsonify({"message": "Email already verified."}), 200

    # Delete old tokens
    conn.execute("DELETE FROM email_verifications WHERE user_id = ?", (uid,))

    # Generate new token
    token = generate_token()
    expires = get_verification_expiry(24)
    conn.execute(
        "INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)",
        (uid, token, expires.isoformat())
    )
    conn.commit()
    conn.close()

    sent, _ = send_verification_email(user["email"], token)
    return jsonify({
        "verification_sent": sent,
        "message": "Verification email sent." if sent else "Failed to send email."
    })


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@auth_bp.route("/_smtp-test", methods=["GET"])
def smtp_test():
    """Diagnostic: test SMTP connection with current config."""
    uid = session.get("user_id")
    if not uid:
        return jsonify({"error": "Not authenticated"}), 401

    result = {
        "SMTP_HOST": config.SMTP_HOST or "(not set)",
        "SMTP_PORT": config.SMTP_PORT,
        "SMTP_USER": config.SMTP_USER or "(not set)",
        "SMTP_PASS_set": bool(config.SMTP_PASS),
        "SMTP_FROM": config.SMTP_FROM,
        "APP_URL": config.APP_URL,
    }

    if not config.SMTP_HOST or not config.SMTP_USER or not config.SMTP_PASS:
        result["error"] = "SMTP not fully configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in Render Environment."
        return jsonify(result)

    # Try connecting to SMTP
    import smtplib
    from email.mime.text import MIMEText
    try:
        server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15)
        result["connection"] = "connected"
        code, msg = server.starttls()
        result["starttls"] = f"{code} {msg.decode() if isinstance(msg, bytes) else msg}"
        server.login(config.SMTP_USER, config.SMTP_PASS)
        result["login"] = "ok"
        server.quit()
        result["status"] = "SMTP working ✅"
    except smtplib.SMTPAuthenticationError as e:
        result["status"] = "SMTP login failed ❌"
        result["error_detail"] = f"Authentication error: check SMTP_USER (should be your Brevo email) and SMTP_PASS (should be the SMTP key, not password)"
    except smtplib.SMTPException as e:
        result["status"] = "SMTP error ❌"
        result["error_detail"] = str(e)[:300]
    except Exception as e:
        result["status"] = "Connection failed ❌"
        result["error_detail"] = str(e)[:300]

    return jsonify(result)


@auth_bp.route("/me", methods=["GET"])
def me():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"user": None}), 401

    conn = models.get_db()
    row = conn.execute(
        "SELECT id, email, email_verified FROM users WHERE id = ?", (uid,)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"user": None}), 401

    return jsonify({
        "user": {
            "id": row["id"],
            "email": row["email"],
            "email_verified": bool(row["email_verified"])
        }
    })
