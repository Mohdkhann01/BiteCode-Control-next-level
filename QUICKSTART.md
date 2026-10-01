# Quick Start

## 1. Configure environment

Copy `backend/.env.example` to `backend/.env` and set:

- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `OPENROUTER_API_KEY` (for AI)
- Judge0 variables (for compiler)

If Atlas SRV DNS is unreliable on Windows, configure `MONGODB_DNS_SERVERS` and the current cluster's `MONGODB_FALLBACK_HOSTS`/`MONGODB_REPLICA_SET`.

## 2. Install

From the project root:

```bash
npm run install:all
```

## 3. Start

```bash
npm start
```

Open `http://localhost:5173`.

## 4. First-run workflow

1. Sign in as the administrator.
2. Open Events and configure the event.
3. Add participant accounts.
4. Form teams; incomplete teams are allowed while members are being added.
5. Create judge accounts.
6. Assign one judge to one or multiple teams.
7. Create/publish coding problems.
8. Enable/disable AI and compiler from the admin controls.
9. Participants use the temporary Playground for unsaved code or a published challenge for stored submissions.
10. Judges evaluate assigned teams.
11. Publish results and issue certificates.

The server automatically creates a default event and `BC-01` coding problem when `AUTO_SEED=true` and the database has no active event/problem.
