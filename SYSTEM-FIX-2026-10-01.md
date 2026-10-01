# BiteCode Control — Production API / Razorpay / Feedback System Fix

## Root cause found
The deployed frontend was configured with an obsolete Render API hostname:
`https://bitecode-control-next-level-2.onrender.com/api`

The Render backend shown in the deployment log is:
`https://bitecode-control-next-level.onrender.com`

This mismatch caused frontend API calls such as feedback, payment configuration/order, attendance and other protected operations to hit the wrong service and return 404/failed requests.

## Changes
- Production frontend API is pinned to the current Render backend hostname.
- A stale `-2.onrender.com` Vite setting can no longer override the production API base.
- AI assistant uses the same production API base.
- Removed the duplicate Mongoose index declaration for `razorpayOrderId`; the unique schema index remains.
- Invalid `MONGODB_DNS_SERVERS` values are ignored instead of being passed to `dns.setServers`.
- Added a JSON API 404 diagnostic so an actually missing API route reports method/path clearly.
- Existing feedback non-blocking notification/email fix retained.
- Existing Razorpay order/verify/webhook implementation retained.
- Existing attendance camera/scanning fixes retained.

## Render environment
The `MONGODB_DNS_SERVERS` value shown in the Render log is invalid. Remove that environment variable unless it contains real DNS IP addresses such as `8.8.8.8,1.1.1.1`. The application now ignores invalid values safely, but cleaning the Render variable is recommended.

Razorpay production environment variables must exist on the Render backend:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET (for webhook verification)

The frontend does not contain Razorpay secrets.
