"""Admin CLI — inspect backend state from the production server.

Usage:
    # Run locally on your database
    cd project/backend
    python admin.py users        # List all users
    python admin.py playlists    # List all playlists
    python admin.py tracks       # Track count
    python admin.py netease      # Netease connections
    python admin.py all          # Everything
"""

import sys
import os

# Add backend dir to path so we can import models
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import models


def cmd_users():
    conn = models.get_db()
    rows = conn.execute("SELECT id, email, created_at FROM users ORDER BY id").fetchall()
    conn.close()
    print(f"\n{'='*60}")
    print(f"  Users ({len(rows)} total)")
    print(f"{'='*60}")
    print(f"  {'ID':<4} {'Email':<35} {'Created'}")
    print(f"  {'-'*55}")
    for r in rows:
        print(f"  {r['id']:<4} {r['email']:<35} {r['created_at']}")
    print()


def cmd_playlists():
    conn = models.get_db()
    rows = conn.execute("""
        SELECT p.id, u.email, p.name, p.track_count, p.imported_at
        FROM playlists p
        JOIN users u ON u.id = p.user_id
        ORDER BY p.imported_at DESC
    """).fetchall()
    conn.close()
    print(f"\n{'='*60}")
    print(f"  Playlists ({len(rows)} total)")
    print(f"{'='*60}")
    for r in rows:
        print(f"  [{r['id']}] {r['email']} — \"{r['name']}\" ({r['track_count']} tracks, {r['imported_at']})")
    print()


def cmd_tracks():
    conn = models.get_db()
    count = conn.execute("SELECT COUNT(*) as c FROM tracks").fetchone()["c"]
    top = conn.execute("SELECT name, artist, album FROM tracks ORDER BY id DESC LIMIT 10").fetchall()
    conn.close()
    print(f"\n{'='*60}")
    print(f"  Tracks: {count} total")
    print(f"{'='*60}")
    print(f"  Last 10 imported:")
    for r in top:
        print(f"    {r['name']} — {r['artist']} [{r['album']}]")
    print()


def cmd_netease():
    conn = models.get_db()
    rows = conn.execute("""
        SELECT nt.id, u.email, nt.netease_nickname, nt.netease_user_id, nt.updated_at
        FROM netease_tokens nt
        JOIN users u ON u.id = nt.user_id
    """).fetchall()
    conn.close()
    print(f"\n{'='*60}")
    print(f"  Netease Connections ({len(rows)} total)")
    print(f"{'='*60}")
    for r in rows:
        print(f"  {r['email']} → {r['netease_nickname']} (UID: {r['netease_user_id']}, last: {r['updated_at']})")
    print()


def cmd_all():
    cmd_users()
    cmd_netease()
    cmd_playlists()
    cmd_tracks()


if __name__ == "__main__":
    cmds = {
        "users": cmd_users,
        "playlists": cmd_playlists,
        "tracks": cmd_tracks,
        "netease": cmd_netease,
        "all": cmd_all,
    }
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        print(f"Usage: python admin.py <{'|'.join(cmds.keys())}>")
        sys.exit(1)
    cmds[sys.argv[1]]()
