# Feedback submission fix — 2026-10-01

This build fixes the participant/judge/mentor/volunteer/admin feedback submission flow.

- Feedback is saved before notifications/email are attempted.
- Admin notification failures no longer make a successful feedback submission appear failed.
- Confirmation email failures remain non-blocking.
- The frontend sends the active hackathon ID when available.
- The frontend now displays the server error message when submission fails.
- Existing feedback UI, role-locking, admin feedback center, and Razorpay payment code are preserved.
