from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import secrets
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Dict

import bcrypt
import jwt
from bson import ObjectId
from fastapi import (
    FastAPI, APIRouter, Depends, HTTPException, Request, Response,
    WebSocket, WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------------------------------------------------------------------------
# Mongo / App setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="FastVi API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("fastvi")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
ROLE_RESIDENT = "resident"
ROLE_ADMIN = "admin"
ROLE_GUARD = "guard"
VALID_ROLES = {ROLE_RESIDENT, ROLE_ADMIN, ROLE_GUARD}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": now_utc() + timedelta(hours=12), "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=12 * 3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=7 * 86400, path="/")

def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")

def public_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc["name"],
        "role": doc["role"],
        "phone": doc.get("phone"),
        "building_id": doc.get("building_id"),
        "unit_id": doc.get("unit_id"),
        "created_at": doc.get("created_at"),
        "access_token": doc.get("__access_token"),  # only included when freshly issued
    }

async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*roles: str):
    async def _dep(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role {roles}")
        return user
    return _dep

def safe_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)
    role: str = ROLE_RESIDENT
    phone: Optional[str] = None
    building_code: Optional[str] = None
    unit_number: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class BuildingIn(BaseModel):
    name: str
    address: str
    code: str

class UnitIn(BaseModel):
    building_id: str
    number: str
    label: Optional[str] = None

class AssignResidentIn(BaseModel):
    user_id: str
    unit_id: str

class VisitorPassIn(BaseModel):
    visitor_name: str
    purpose: Optional[str] = "visit"
    valid_hours: int = 24
    unit_id: Optional[str] = None

class CallInitiateIn(BaseModel):
    unit_id: str
    visitor_name: str
    photo_data_url: Optional[str] = None

class CallActionIn(BaseModel):
    call_id: str
    action: str

class ValidatePassIn(BaseModel):
    code: str

# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self) -> None:
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        old = self.active.get(user_id)
        if old is not None:
            try:
                await old.close()
            except Exception:
                pass
        self.active[user_id] = ws

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        if self.active.get(user_id) is ws:
            self.active.pop(user_id, None)

    async def send(self, user_id: str, payload: Dict[str, Any]) -> bool:
        ws = self.active.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_text(json.dumps(payload))
            return True
        except Exception:
            self.active.pop(user_id, None)
            return False

    def online_ids(self) -> List[str]:
        return list(self.active.keys())

manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    building_id = None
    unit_id = None
    if payload.role == ROLE_RESIDENT and payload.building_code:
        building = await db.buildings.find_one({"code": payload.building_code.upper().strip()})
        if not building:
            raise HTTPException(status_code=400, detail="Invalid building code")
        building_id = str(building["_id"])
        if payload.unit_number:
            unit = await db.units.find_one({
                "building_id": building_id,
                "number": payload.unit_number.strip()
            })
            if unit:
                unit_id = str(unit["_id"])
            else:
                new_unit = {
                    "building_id": building_id,
                    "number": payload.unit_number.strip(),
                    "label": None,
                    "resident_ids": [],
                    "created_at": iso(now_utc()),
                }
                result = await db.units.insert_one(new_unit)
                unit_id = str(result.inserted_id)

    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": payload.role,
        "phone": payload.phone,
        "building_id": building_id,
        "unit_id": unit_id,
        "created_at": iso(now_utc()),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id

    if unit_id:
        await db.units.update_one(
            {"_id": ObjectId(unit_id)},
            {"$addToSet": {"resident_ids": str(result.inserted_id)}}
        )

    access = create_access_token(str(result.inserted_id), email, payload.role)
    refresh = create_refresh_token(str(result.inserted_id))
    set_auth_cookies(response, access, refresh)
    doc["__access_token"] = access
    return public_user(doc)

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_access_token(str(user["_id"]), email, user["role"])
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    user["__access_token"] = access
    return public_user(user)

@api.post("/auth/logout")
async def logout(response: Response, _user=Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(request: Request, user=Depends(get_current_user)):
    # also return a fresh access token (needed for WS signaling)
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    user["__access_token"] = token
    return public_user(user)

# ---------------------------------------------------------------------------
# Buildings & Units
# ---------------------------------------------------------------------------
@api.post("/buildings")
async def create_building(payload: BuildingIn, user=Depends(require_role(ROLE_ADMIN))):
    code = payload.code.upper().strip()
    if await db.buildings.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Building code already in use")
    doc = {
        "name": payload.name.strip(),
        "address": payload.address.strip(),
        "code": code,
        "admin_id": str(user["_id"]),
        "created_at": iso(now_utc()),
    }
    res = await db.buildings.insert_one(doc)
    return {
        "id": str(res.inserted_id),
        "name": doc["name"], "address": doc["address"], "code": doc["code"],
        "admin_id": doc["admin_id"], "created_at": doc["created_at"],
    }

@api.get("/buildings")
async def list_buildings(_user=Depends(get_current_user)):
    out = []
    async for b in db.buildings.find({}):
        out.append({
            "id": str(b["_id"]),
            "name": b["name"], "address": b["address"], "code": b["code"],
            "admin_id": b.get("admin_id"), "created_at": b.get("created_at"),
        })
    return out

@api.post("/units")
async def create_unit(payload: UnitIn, _user=Depends(require_role(ROLE_ADMIN))):
    safe_object_id(payload.building_id)
    if await db.units.find_one({"building_id": payload.building_id, "number": payload.number}):
        raise HTTPException(status_code=400, detail="Unit already exists")
    doc = {
        "building_id": payload.building_id,
        "number": payload.number.strip(),
        "label": payload.label,
        "resident_ids": [],
        "created_at": iso(now_utc()),
    }
    res = await db.units.insert_one(doc)
    return {
        "id": str(res.inserted_id),
        "building_id": doc["building_id"],
        "number": doc["number"],
        "label": doc["label"],
        "resident_ids": [],
    }

@api.get("/units")
async def list_units(building_id: Optional[str] = None, _user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if building_id:
        query["building_id"] = building_id
    out = []
    async for u in db.units.find(query):
        out.append({
            "id": str(u["_id"]),
            "building_id": u["building_id"],
            "number": u["number"],
            "label": u.get("label"),
            "resident_ids": u.get("resident_ids", []),
        })
    return out

# Public endpoint for the visitor kiosk (no auth required)
@api.get("/public/units")
async def public_units(building_code: str):
    building = await db.buildings.find_one({"code": building_code.upper().strip()})
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    out = []
    async for u in db.units.find({"building_id": str(building["_id"])}):
        out.append({
            "id": str(u["_id"]),
            "building_id": u["building_id"],
            "number": u["number"],
            "label": u.get("label"),
            "has_residents": bool(u.get("resident_ids")),
        })
    out.sort(key=lambda x: x["number"])
    return {"building": {"id": str(building["_id"]), "name": building["name"], "code": building["code"]},
            "units": out}

@api.get("/users")
async def list_users(role: Optional[str] = None, _user=Depends(require_role(ROLE_ADMIN))):
    query: Dict[str, Any] = {}
    if role:
        query["role"] = role
    out = []
    async for u in db.users.find(query):
        out.append(public_user(u))
    return out

@api.post("/units/assign")
async def assign_resident(payload: AssignResidentIn, _user=Depends(require_role(ROLE_ADMIN))):
    unit = await db.units.find_one({"_id": safe_object_id(payload.unit_id)})
    target = await db.users.find_one({"_id": safe_object_id(payload.user_id)})
    if not unit or not target:
        raise HTTPException(status_code=404, detail="Unit or user not found")
    await db.units.update_one({"_id": unit["_id"]},
                              {"$addToSet": {"resident_ids": str(target["_id"])}})
    await db.users.update_one({"_id": target["_id"]},
                              {"$set": {"unit_id": str(unit["_id"]),
                                         "building_id": unit["building_id"]}})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Visitor passes (QR)
# ---------------------------------------------------------------------------
def gen_pass_code() -> str:
    return secrets.token_urlsafe(9).replace("-", "X").replace("_", "Y")[:12].upper()

@api.post("/passes")
async def create_pass(payload: VisitorPassIn, user=Depends(get_current_user)):
    if user["role"] not in (ROLE_RESIDENT, ROLE_ADMIN):
        raise HTTPException(status_code=403, detail="Only residents/admins can create passes")
    unit_id = payload.unit_id or user.get("unit_id")
    if not unit_id:
        raise HTTPException(status_code=400, detail="No unit associated")
    code = gen_pass_code()
    doc = {
        "code": code,
        "visitor_name": payload.visitor_name.strip(),
        "purpose": payload.purpose,
        "unit_id": unit_id,
        "building_id": user.get("building_id"),
        "issued_by": str(user["_id"]),
        "issued_by_name": user.get("name"),
        "valid_until": iso(now_utc() + timedelta(hours=max(1, payload.valid_hours))),
        "status": "active",
        "created_at": iso(now_utc()),
    }
    res = await db.passes.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc

@api.get("/passes")
async def list_passes(user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if user["role"] == ROLE_RESIDENT:
        query["issued_by"] = str(user["_id"])
    elif user["role"] == ROLE_GUARD:
        query["building_id"] = user.get("building_id")
    out = []
    async for p in db.passes.find(query).sort("created_at", -1).limit(100):
        p["id"] = str(p["_id"])
        p.pop("_id", None)
        out.append(p)
    return out

@api.post("/passes/validate")
async def validate_pass(payload: ValidatePassIn, user=Depends(require_role(ROLE_GUARD, ROLE_ADMIN))):
    pass_doc = await db.passes.find_one({"code": payload.code.upper().strip()})
    if not pass_doc:
        raise HTTPException(status_code=404, detail="Pass not found")
    valid_until = pass_doc.get("valid_until")
    expired = False
    if isinstance(valid_until, str):
        try:
            expired = datetime.fromisoformat(valid_until) < now_utc()
        except Exception:
            expired = False
    pass_doc["id"] = str(pass_doc["_id"])
    pass_doc.pop("_id", None)
    if expired or pass_doc.get("status") == "expired":
        return {"valid": False, "reason": "expired", "pass": pass_doc}
    if pass_doc.get("status") == "used":
        return {"valid": False, "reason": "already_used", "pass": pass_doc}

    await db.passes.update_one({"code": pass_doc["code"]},
                               {"$set": {"status": "used", "used_at": iso(now_utc()),
                                          "used_by_guard": str(user["_id"])}})
    await db.activity.insert_one({
        "type": "qr_entry",
        "visitor_name": pass_doc["visitor_name"],
        "unit_id": pass_doc.get("unit_id"),
        "building_id": pass_doc.get("building_id"),
        "guard_id": str(user["_id"]),
        "pass_code": pass_doc["code"],
        "created_at": iso(now_utc()),
    })
    pass_doc["status"] = "used"
    return {"valid": True, "pass": pass_doc}

# ---------------------------------------------------------------------------
# Calls
# ---------------------------------------------------------------------------
@api.post("/calls/initiate")
async def initiate_call(payload: CallInitiateIn):
    unit = await db.units.find_one({"_id": safe_object_id(payload.unit_id)})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    residents = unit.get("resident_ids", [])
    if not residents:
        raise HTTPException(status_code=400, detail="No residents in this unit")
    doc = {
        "unit_id": str(unit["_id"]),
        "unit_number": unit.get("number"),
        "building_id": unit["building_id"],
        "visitor_name": (payload.visitor_name or "Visitor").strip(),
        "photo_data_url": payload.photo_data_url,
        "resident_ids": residents,
        "status": "ringing",
        "created_at": iso(now_utc()),
    }
    res = await db.calls.insert_one(doc)
    call_id = str(res.inserted_id)
    doc["id"] = call_id
    doc.pop("_id", None)

    notified = []
    for r in residents:
        ok = await manager.send(r, {
            "type": "incoming_call",
            "call_id": call_id,
            "visitor_name": doc["visitor_name"],
            "photo_data_url": doc.get("photo_data_url"),
            "unit_id": doc["unit_id"],
            "unit_number": doc["unit_number"],
        })
        if ok:
            notified.append(r)

    await db.activity.insert_one({
        "type": "call_ringing",
        "visitor_name": doc["visitor_name"],
        "unit_id": doc.get("unit_id"),
        "building_id": doc.get("building_id"),
        "call_id": call_id,
        "created_at": iso(now_utc()),
    })

    doc["notified"] = notified
    return doc

@api.post("/calls/action")
async def call_action(payload: CallActionIn, user=Depends(get_current_user)):
    call = await db.calls.find_one({"_id": safe_object_id(payload.call_id)})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if user["role"] == ROLE_RESIDENT and str(user["_id"]) not in call.get("resident_ids", []):
        raise HTTPException(status_code=403, detail="Not your call")

    new_status = {"accept": "accepted", "reject": "rejected", "end": "ended"}.get(payload.action)
    if not new_status:
        raise HTTPException(status_code=400, detail="Invalid action")
    update: Dict[str, Any] = {"status": new_status}
    if new_status == "accepted":
        update["answered_by"] = str(user["_id"])
        update["answered_at"] = iso(now_utc())
    if new_status == "ended":
        update["ended_at"] = iso(now_utc())
    await db.calls.update_one({"_id": call["_id"]}, {"$set": update})

    # notify the kiosk
    kiosk_id = f"kiosk:{payload.call_id}"
    await manager.send(kiosk_id, {"type": "call_status", "call_id": payload.call_id, "status": new_status,
                                   "from_user": str(user["_id"])})

    await db.activity.insert_one({
        "type": f"call_{new_status}",
        "visitor_name": call["visitor_name"],
        "unit_id": call.get("unit_id"),
        "building_id": call.get("building_id"),
        "resident_id": str(user["_id"]),
        "call_id": str(call["_id"]),
        "created_at": iso(now_utc()),
    })
    return {"ok": True, "status": new_status}

@api.get("/calls")
async def list_calls(user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if user["role"] == ROLE_RESIDENT:
        query["resident_ids"] = str(user["_id"])
    elif user["role"] == ROLE_GUARD:
        query["building_id"] = user.get("building_id")
    out = []
    async for c in db.calls.find(query).sort("created_at", -1).limit(100):
        c["id"] = str(c["_id"])
        c.pop("_id", None)
        out.append(c)
    return out

@api.get("/calls/{call_id}")
async def get_call(call_id: str):
    """Public read for kiosk to confirm state."""
    call = await db.calls.find_one({"_id": safe_object_id(call_id)})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    call["id"] = str(call["_id"])
    call.pop("_id", None)
    return call

# ---------------------------------------------------------------------------
# Activity & stats
# ---------------------------------------------------------------------------
@api.get("/activity")
async def list_activity(user=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if user["role"] in (ROLE_GUARD, ROLE_ADMIN):
        if user.get("building_id"):
            query["building_id"] = user["building_id"]
    elif user["role"] == ROLE_RESIDENT:
        query["unit_id"] = user.get("unit_id")
    out = []
    async for a in db.activity.find(query).sort("created_at", -1).limit(200):
        a["id"] = str(a["_id"])
        a.pop("_id", None)
        out.append(a)
    return out

@api.get("/stats/admin")
async def admin_stats(_user=Depends(require_role(ROLE_ADMIN))):
    units = await db.units.count_documents({})
    residents = await db.users.count_documents({"role": ROLE_RESIDENT})
    guards = await db.users.count_documents({"role": ROLE_GUARD})
    buildings = await db.buildings.count_documents({})
    today_iso = iso(now_utc().replace(hour=0, minute=0, second=0, microsecond=0))
    daily = await db.activity.count_documents({"created_at": {"$gte": today_iso}})
    return {
        "units": units, "residents": residents, "guards": guards,
        "buildings": buildings, "daily_activity": daily,
        "online_users": len(manager.online_ids()),
    }

# ---------------------------------------------------------------------------
# WebSockets
# ---------------------------------------------------------------------------
@app.websocket("/api/ws/{user_id}")
async def ws_endpoint(websocket: WebSocket, user_id: str, token: Optional[str] = None):
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("sub") != user_id or payload.get("type") != "access":
            await websocket.close(code=4403)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            target = msg.get("to")
            if not target:
                continue
            await manager.send(target, {**msg, "from": user_id})
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception as e:
        logger.warning(f"ws error: {e}")
        manager.disconnect(user_id, websocket)

@app.websocket("/api/ws-kiosk/{call_id}")
async def ws_kiosk(websocket: WebSocket, call_id: str):
    kiosk_id = f"kiosk:{call_id}"
    await manager.connect(kiosk_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            target = msg.get("to")
            if not target:
                continue
            await manager.send(target, {**msg, "from": kiosk_id})
    except WebSocketDisconnect:
        manager.disconnect(kiosk_id, websocket)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.buildings.create_index("code", unique=True)
    await db.units.create_index([("building_id", 1), ("number", 1)], unique=True)
    await db.passes.create_index("code", unique=True)
    await db.activity.create_index("created_at")
    await db.calls.create_index("created_at")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fastvi.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "FastVi Admin",
            "role": ROLE_ADMIN,
            "phone": None,
            "building_id": None,
            "unit_id": None,
            "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"_id": existing["_id"]},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    demo_code = "FASTVI"
    building = await db.buildings.find_one({"code": demo_code})
    if not building:
        admin = await db.users.find_one({"email": admin_email})
        bres = await db.buildings.insert_one({
            "name": "FastVi Heights",
            "address": "221B Baker Street, London",
            "code": demo_code,
            "admin_id": str(admin["_id"]),
            "created_at": iso(now_utc()),
        })
        building_id = str(bres.inserted_id)
        for n in ["101", "102", "201", "202"]:
            await db.units.insert_one({
                "building_id": building_id,
                "number": n,
                "label": None,
                "resident_ids": [],
                "created_at": iso(now_utc()),
            })

        guard_email = "guard@fastvi.com"
        if not await db.users.find_one({"email": guard_email}):
            await db.users.insert_one({
                "email": guard_email,
                "password_hash": hash_password("guard123"),
                "name": "Front Desk Guard",
                "role": ROLE_GUARD,
                "phone": None,
                "building_id": building_id,
                "unit_id": None,
                "created_at": iso(now_utc()),
            })

        resident_email = "resident@fastvi.com"
        if not await db.users.find_one({"email": resident_email}):
            unit = await db.units.find_one({"building_id": building_id, "number": "101"})
            rres = await db.users.insert_one({
                "email": resident_email,
                "password_hash": hash_password("resident123"),
                "name": "Sam Resident",
                "role": ROLE_RESIDENT,
                "phone": None,
                "building_id": building_id,
                "unit_id": str(unit["_id"]),
                "created_at": iso(now_utc()),
            })
            await db.units.update_one({"_id": unit["_id"]},
                                      {"$addToSet": {"resident_ids": str(rres.inserted_id)}})

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

# ---------------------------------------------------------------------------
# Register router + CORS
# ---------------------------------------------------------------------------
app.include_router(api)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip() and o.strip() != "*"]
allowed_origins = list({frontend_url, "http://localhost:3000", *extra_origins})

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
