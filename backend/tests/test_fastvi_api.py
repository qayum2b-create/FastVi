"""FastVi backend API tests — covers auth, registration, admin, passes, calls, kiosk, activity."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fastvi-doorbell.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@fastvi.com", "password": "admin123"}
GUARD = {"email": "guard@fastvi.com", "password": "guard123"}
RESIDENT = {"email": "resident@fastvi.com", "password": "resident123"}


def session_login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    body = r.json()
    return s, body


@pytest.fixture(scope="module")
def admin_session():
    s, body = session_login(ADMIN)
    return s, body


@pytest.fixture(scope="module")
def guard_session():
    s, body = session_login(GUARD)
    return s, body


@pytest.fixture(scope="module")
def resident_session():
    s, body = session_login(RESIDENT)
    return s, body


# --------------------------- AUTH ---------------------------
class TestAuth:
    def test_login_admin_returns_token_and_cookies(self):
        s, body = session_login(ADMIN)
        assert body["email"] == ADMIN["email"]
        assert body["role"] == "admin"
        assert body.get("access_token") and isinstance(body["access_token"], str)
        # cookie set
        assert s.cookies.get("access_token"), "access_token cookie not set"

    def test_login_guard(self):
        _, body = session_login(GUARD)
        assert body["role"] == "guard"
        assert body.get("access_token")

    def test_login_resident_has_unit(self):
        _, body = session_login(RESIDENT)
        assert body["role"] == "resident"
        assert body.get("unit_id"), "resident should be assigned to a unit"
        assert body.get("building_id")

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "no@x.com", "password": "x"})
        assert r.status_code == 401

    def test_me_authenticated(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN["email"]
        assert body.get("access_token"), "me response should include access_token"

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# --------------------------- REGISTRATION ---------------------------
class TestRegistration:
    def test_register_resident_with_building_code(self):
        unique_email = f"TEST_reg_{uuid.uuid4().hex[:8]}@fastvi.com"
        payload = {
            "email": unique_email,
            "password": "testpass123",
            "name": "TEST Reg User",
            "role": "resident",
            "building_code": "FASTVI",
            "unit_number": "202",
        }
        r = requests.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == unique_email.lower()
        assert body["role"] == "resident"
        assert body.get("unit_id"), "unit should be assigned"
        assert body.get("building_id"), "building should be assigned"
        assert body.get("access_token")

    def test_register_duplicate_email_rejected(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": ADMIN["email"], "password": "x123456", "name": "Dup", "role": "resident"
        })
        assert r.status_code == 400

    def test_register_invalid_role(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_role_{uuid.uuid4().hex[:6]}@x.com",
            "password": "x123456", "name": "Bad", "role": "superuser"
        })
        assert r.status_code == 400


# --------------------------- ADMIN ENDPOINTS ---------------------------
class TestAdmin:
    def test_stats(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/stats/admin")
        assert r.status_code == 200
        data = r.json()
        for k in ["units", "residents", "guards", "buildings", "daily_activity", "online_users"]:
            assert k in data, f"missing {k}"
        assert data["buildings"] >= 1
        assert data["units"] >= 4

    def test_list_buildings(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/buildings")
        assert r.status_code == 200
        bs = r.json()
        assert any(b["code"] == "FASTVI" for b in bs)
        # ensure _id not leaked
        for b in bs:
            assert "_id" not in b and "id" in b

    def test_list_units(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/units")
        assert r.status_code == 200
        units = r.json()
        assert len(units) >= 4
        for u in units:
            assert "_id" not in u

    def test_list_users(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/users")
        assert r.status_code == 200
        users = r.json()
        emails = [u["email"] for u in users]
        assert ADMIN["email"] in emails

    def test_non_admin_cannot_create_building(self, resident_session):
        s, _ = resident_session
        r = s.post(f"{API}/buildings", json={"name": "X", "address": "Y", "code": "ZZTOPX"})
        assert r.status_code == 403

    def test_admin_creates_building(self, admin_session):
        s, _ = admin_session
        code = f"TST{uuid.uuid4().hex[:5].upper()}"
        r = s.post(f"{API}/buildings", json={"name": "TEST Bldg", "address": "1 Test Way", "code": code})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["code"] == code.upper()
        assert "id" in body


# --------------------------- VISITOR PASSES ---------------------------
class TestPasses:
    def test_resident_create_pass_and_guard_validate(self, resident_session, guard_session):
        rs, _ = resident_session
        gs, _ = guard_session
        # create
        r = rs.post(f"{API}/passes", json={"visitor_name": "TEST Visitor", "valid_hours": 2})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "active"
        assert p.get("code") and len(p["code"]) >= 6
        code = p["code"]
        # validate
        r2 = gs.post(f"{API}/passes/validate", json={"code": code})
        assert r2.status_code == 200
        v = r2.json()
        assert v["valid"] is True
        assert v["pass"]["status"] == "used"
        # second validate => already_used
        r3 = gs.post(f"{API}/passes/validate", json={"code": code})
        assert r3.status_code == 200
        v3 = r3.json()
        assert v3["valid"] is False
        assert v3["reason"] == "already_used"

    def test_validate_unknown_code(self, guard_session):
        gs, _ = guard_session
        r = gs.post(f"{API}/passes/validate", json={"code": "ZZNONEXISTZZ"})
        assert r.status_code == 404


# --------------------------- KIOSK + CALLS ---------------------------
class TestKioskCalls:
    def test_public_units(self):
        r = requests.get(f"{API}/public/units", params={"building_code": "FASTVI"})
        assert r.status_code == 200
        data = r.json()
        assert data["building"]["code"] == "FASTVI"
        nums = [u["number"] for u in data["units"]]
        for expected in ["101", "102", "201", "202"]:
            assert expected in nums
        unit101 = next(u for u in data["units"] if u["number"] == "101")
        assert unit101["has_residents"] is True

    def test_initiate_call_public_for_unit_101(self):
        # find unit 101 via public endpoint
        r = requests.get(f"{API}/public/units", params={"building_code": "FASTVI"})
        unit101 = next(u for u in r.json()["units"] if u["number"] == "101")
        # initiate (no auth)
        ic = requests.post(f"{API}/calls/initiate", json={
            "unit_id": unit101["id"], "visitor_name": "TEST Kiosk Visitor"
        })
        assert ic.status_code == 200, ic.text
        body = ic.json()
        assert body["status"] == "ringing"
        assert body.get("id")
        TestKioskCalls.call_id = body["id"]

    def test_initiate_call_empty_unit_fails(self):
        r = requests.get(f"{API}/public/units", params={"building_code": "FASTVI"})
        unit102 = next(u for u in r.json()["units"] if u["number"] == "102")
        ic = requests.post(f"{API}/calls/initiate", json={
            "unit_id": unit102["id"], "visitor_name": "X"
        })
        assert ic.status_code == 400

    def test_resident_accepts_then_ends_call(self, resident_session):
        s, _ = resident_session
        call_id = getattr(TestKioskCalls, "call_id", None)
        assert call_id, "call_id not set from previous test"
        r = s.post(f"{API}/calls/action", json={"call_id": call_id, "action": "accept"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "accepted"
        r2 = s.post(f"{API}/calls/action", json={"call_id": call_id, "action": "end"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "ended"

    def test_get_call_public(self):
        call_id = getattr(TestKioskCalls, "call_id", None)
        assert call_id
        r = requests.get(f"{API}/calls/{call_id}")
        assert r.status_code == 200
        assert r.json()["status"] in ("ended", "accepted")

    def test_reject_action_on_new_call(self, resident_session):
        rr = requests.get(f"{API}/public/units", params={"building_code": "FASTVI"})
        unit101 = next(u for u in rr.json()["units"] if u["number"] == "101")
        ic = requests.post(f"{API}/calls/initiate", json={"unit_id": unit101["id"], "visitor_name": "Reject Test"})
        cid = ic.json()["id"]
        s, _ = resident_session
        r = s.post(f"{API}/calls/action", json={"call_id": cid, "action": "reject"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"


# --------------------------- ACTIVITY ---------------------------
class TestActivity:
    def test_activity_admin(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/activity")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_activity_resident_scoped(self, resident_session):
        s, _ = resident_session
        r = s.get(f"{API}/activity")
        assert r.status_code == 200
        items = r.json()
        # should contain some events; if not empty all should be for resident's unit
        if items:
            # at least one call_* event should be present after previous tests
            assert any("call" in (it.get("type") or "") or it.get("type") == "qr_entry" for it in items)
