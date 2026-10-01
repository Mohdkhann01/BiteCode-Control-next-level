# BiteCode Control — Verification Status

## Payment system
- Registration payments are Razorpay-only.
- Legacy manual UPI/payment-proof endpoints and UI have been removed.
- Razorpay order creation is server-side.
- Razorpay Checkout receives only the public key ID.
- Payment callback signature is verified server-side.
- Razorpay payment status is fetched server-side before marking the registration paid.
- Razorpay webhook signature is verified.
- Admin can view Razorpay payments and sync a payment from Razorpay.

## Syntax verification
- Backend JavaScript: `node --check` passed for all backend JS files.
- Frontend/backend JS + JSX: parsed successfully with Babel parser for all 11 source JS/JSX files.

## Build environment note
The source is syntax-checked, but a complete Vite production build could not be completed in this build environment because the extracted dependency cache is missing Rollup's platform-specific optional binary. Run `npm ci` (or `npm install`) in `frontend` on the target machine, then `npm run build`.

## Secrets
Do not commit `backend/.env`. Configure Razorpay credentials on the backend/Render environment using `backend/.env.example`.
