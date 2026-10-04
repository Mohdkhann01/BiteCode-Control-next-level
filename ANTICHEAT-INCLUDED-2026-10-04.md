# BiteCode Control — Anti-Cheat Complete Build

This package includes the Anti-Cheat/proctoring implementation integrated into the existing BiteCode Control project.

Included:
- Participant coding/playground AntiCheatGuard
- Tab hidden / visible detection
- Window blur detection
- Fullscreen exit detection
- Copy / cut / paste blocking and incident logging
- Context-menu blocking and incident logging
- Optional camera movement detection
- BiteCode-page screenshot capture for incidents
- Admin Anti-Cheat page at `/admin/anticheat`
- Admin sidebar Anti-Cheat navigation
- Backend `POST /api/anticheat/incident`
- Backend `GET /api/admin/anticheat`
- MongoDB AntiCheat model and index

Razorpay/payment code is not changed by this Anti-Cheat package.

Production API used by the frontend:
https://bitecode-control-next-level.onrender.com/api

After extracting, run the normal project commands from the README/QUICKSTART files.
