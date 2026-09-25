"""Super admin backend endpoint tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fastvi-doorbell.preview.emergentagent.com").rstrip("/")

SUPER = {"email": "qayum@smrtin.net", "password": "Apple@786"}
ADMIN = {"email": "admin@fastvi.com", "password": "admin123"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    return s, r


def test_super_admin_login():
    s, r = _login(SUPER)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["role"] == "super_admin"
    assert isinstance(data.get("access_token"), str) and len(data["access_token"]) > 10


def test_platform_stats_shape():
    s, r = _login(SUPER)
    assert r.status_code == 200
    r2 = s.get(f"{BASE_URL}/api/stats/platform", timeout=15)
    assert r2.status_code == 200, r2.text
    d = r2.json()
    for k in ["users_total", "admins", "residents", "guards", "buildings", "units",
              "passes_total", "passes_active", "calls_total", "weekly_activity", "online_users"]:
        assert k in d, f"missing {k}"
        assert isinstance(d[k], int), f"{k} not int: {d[k]!r}"


def test_platform_users_list():
    s, _ = _login(SUPER)
    r = s.get(f"{BASE_URL}/api/platform/users", timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert any(u.get("email") == SUPER["email"] for u in arr)


def test_platform_activity_list():
    s, _ = _login(SUPER)
    r = s.get(f"{BASE_URL}/api/platform/activity", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.parametrize("path", ["/api/stats/platform", "/api/platform/users", "/api/platform/activity"])
def test_non_super_admin_forbidden(path):
    s, r = _login(ADMIN)
    assert r.status_code == 200
    r2 = s.get(f"{BASE_URL}{path}", timeout=15)
    assert r2.status_code == 403, f"{path} expected 403, got {r2.status_code}: {r2.text}"


def test_building_admin_login_role():
    s, r = _login(ADMIN)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
