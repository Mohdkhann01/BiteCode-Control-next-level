# BiteCode Control — Hackathon Management Platform

A full-stack hackathon operations platform with participant, administrator and judge workspaces, team management, coding challenges, online compiler, AI assistant, judging, attendance, submissions, certificates, announcements and public results.

## Run locally

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. Set `OPENROUTER_API_KEY` if AI is required.
4. Configure Judge0 (`JUDGE0_URL` and optional auth token) for code execution.
5. From the project root:

```bash
npm run install:all
npm start
```

Frontend: http://localhost:5173
Backend health: http://localhost:5000/api/health

If you already installed dependencies separately, `npm start` is enough.

## First run

With `AUTO_SEED=true`, the backend creates an active BiteCode event and a published `BC-01` coding problem when the database is empty. The administrator account is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` if it does not already exist.

## Important behavior

- Administrators always retain access to the AI assistant. The admin switch controls participant AI access.
- Compiler access is stored on the active event and is enforced by the backend.
- Playground compiler runs are temporary and are not saved as submissions.
- Registered coding submissions are stored with the participant, team, problem, language, source code and execution result.
- Admin team creation can create an incomplete one-member team; the event minimum is enforced before final submission.
- Judges are created as real accounts and can be assigned multiple teams using selection controls rather than manually entering MongoDB IDs.
- Judge views are restricted to assigned teams for judging/submission review.
- Hidden coding test cases are never returned to participants.
- Certificates have unique IDs and can be verified through the certificate verification API.
- API validation converts common MongoDB cast/duplicate/validation failures into controlled HTTP responses instead of raw crashes.

## MongoDB Atlas DNS fallback

If your Windows/ISP DNS cannot resolve the Atlas SRV record, you can set `MONGODB_DNS_SERVERS` and, when necessary, explicit `MONGODB_FALLBACK_HOSTS` plus `MONGODB_REPLICA_SET`. The fallback hosts must come from your current Atlas cluster; do not copy old hosts after changing clusters.
