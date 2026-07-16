from flask import Blueprint, request, session, jsonify
import bcrypt
import models

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
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Email already registered"}), 409

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    cur = conn.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, pw_hash))
    conn.commit()
    user_id = cur.lastrowid
    conn.close()

    session["user_id"] = user_id
    return jsonify({"user": {"id": user_id, "email": email}}), 201


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
    row = conn.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), row["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = row["id"]
    return jsonify({"user": {"id": row["id"], "email": row["email"]}})


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@auth_bp.route("/me", methods=["GET"])
def me():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"user": None}), 401

    conn = models.get_db()
    row = conn.execute("SELECT id, email FROM users WHERE id = ?", (uid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"user": None}), 401

    return jsonify({"user": {"id": row["id"], "email": row["email"]}})
