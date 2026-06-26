# FastVi — Product Requirements Document

## Original problem statement
> Want to create an app like doorvi, named FastVi with full functions and fast

## Architecture
- **Backend:** FastAPI + Motor (MongoDB), bcrypt password hashing, PyJWT (JWT cookies + Bearer), WebSocket signaling (`/api/ws/{user_id}` for residents/admins, `/api/ws-kiosk/{call_id}` for the public kiosk). All API routes prefixed `/api`.
- **Frontend:** React 19 + React Router 7 + Tailwind + Shadcn UI + Sonner. WebRTC via native browser APIs (STUN: stun.l.google.com), QR codes via `qrcode.react`, scanner via `html5-qrcode`.
- **Auth:** Email/password JWT. `SameSite=None; Secure` cookies cross-origin. `access_token` also returned in `/auth/me` and login responses for WebSocket signaling.
- **Roles:** `resident`, `admin`, `guard`. Each lands on its own dashboard.

## Core requirements (static)
- Multi-role onboarding (admin/guard/resident) with role-based route guards.
- Lobby kiosk that places real WebRTC video calls to a unit's resident.
- Resident-issued QR visitor passes, scannable & validatable by guards.
- Admin control room: buildings/units CRUD, residents-to-unit assignment, activity log.
- Guard dashboard: live QR scanner, manual code entry, pass queue, activity feed.
- Live notifications: persistent WS shows toast + auto-opens call screen on incoming.

## User personas
- **Resident:** Approves calls from the lobby, generates QR passes for guests/deliveries.
- **Guard:** Scans QR passes at the lobby, monitors live activity, denies expired/used codes.
- **Admin:** Provisions buildings & units, manages people, audits activity.
- **Visitor (no account):** Uses the public kiosk to select a unit and place a video call.

## Implemented (2026-02-26)
- JWT auth (register, login, logout, me) with bcrypt + httpOnly cross-site cookies; admin/guard/resident seeded on startup.
- Buildings/units/users CRUD + resident assignment (RBAC: admin only).
- QR visitor passes (create, list, validate); validation flips `active → used`, second use rejected.
- Public kiosk: `GET /api/public/units`, `POST /api/calls/initiate`, `GET /api/calls/{id}` (no auth).
- Calls: ringing → accepted/rejected/ended via `/api/calls/action`; activity entries on every state change.
- WebSockets: signaling forwarder + `incoming_call` push notification to residents.
- Frontend: Landing, Auth (login + register), Resident dashboard (call history + QR pass creator + active passes list), Admin dashboard (stats + buildings/units/people/activity tabs), Guard dashboard (QR scanner via camera + manual entry + activity), Visitor kiosk (camera snapshot + unit selector + ring), full-screen Call screen (WebRTC PC, mute/video/end, glassmorphism controls, pulse ring), QR pass ticket view.
- Design: Cabinet Grotesk + Outfit + JetBrains Mono, bone-white/obsidian/safety-amber palette, glassmorphism call controls, fade-up entrance animations, data-testid coverage.

## Tested (2026-02-26)
- Backend pytest suite: **25/25 passing**.
- Frontend flows verified by testing agent: landing → login (demo buttons) → role dashboards, admin building creation, guard manual validation, resident pass creation, kiosk → /call/:id navigation, protected route guards.

## Backlog
### P1
- Skeleton loaders for stat cards on admin dashboard.
- Push notifications / browser Notification API on incoming call (today: in-app toast).
- Pass usage history per resident (deep dive on a single pass).
- Avatar uploads for residents.

### P2
- Split `server.py` into routers (auth/buildings/passes/calls).
- TURN server config (currently STUN-only — works on most home networks but not symmetric NAT).
- Building-level branding (logo upload).
- Per-building analytics (peak hours, visitor types).
- iOS/Android wrapper (PWA already mostly works).

## Next tasks (post-finish)
1. Add skeleton loaders + smoother loading states.
2. Add live "online residents" badge on the kiosk per unit (using the WS presence we already track).
3. Optional: bulk import residents via CSV for the admin.
4. Optional: TURN server integration (Twilio NTS or coturn).
