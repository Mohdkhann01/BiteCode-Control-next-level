# BiteCode Control — Reliable API 2.1

This release focuses on production reliability without replacing the existing UI.

## Changes
- Production API has a stable `/api` and `/api/health` endpoint.
- Added `/api/system/status` for service diagnostics.
- CORS now validates configured frontend origins safely.
- Frontend uses the live Render API and ignores the obsolete `-2.onrender.com` host.
- Frontend API client has a 20-second timeout and one retry for temporary network failures.
- Feedback remains independent of Gmail/notification failures.
- Razorpay verification no longer permanently marks a payment failed when Razorpay is temporarily unavailable.
- Razorpay still verifies the signed order/payment response server-side.
- Automatic demo/mock coding data is disabled. Production startup never creates BC-01 automatically.
- `AUTO_SEED` is now false by default and is not called during normal production startup.
- Compiler errors expose a stable `COMPILER_DISABLED` code when an administrator has intentionally disabled the compiler.
- Existing indexes and API routes are preserved.

## Production environment
Required server variables include `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`.
Razorpay requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
Judge0 requires `JUDGE0_URL` and, if the provider requires it, `JUDGE0_AUTH_TOKEN`.
Do not commit `backend/.env`.

## Important
If an existing MongoDB event was manually switched OFF for compiler/payments, the application preserves that administrator choice. Turn the service ON from the Admin Operations/Coding Lab controls.
