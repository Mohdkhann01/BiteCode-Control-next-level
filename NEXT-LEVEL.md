# BiteCode Control — Next Level Upgrade

This version builds on the existing platform instead of replacing it.

## What was upgraded

- Operations Center for live event monitoring.
- Event feature switches for AI, compiler, teams, submissions, judging, announcements and certificates.
- Live operational metrics: participants, approved payments, teams, submissions, judging workload and pending payments.
- System health checks for MongoDB, Judge0, JWT configuration and upload storage.
- Balanced one-click judge auto-assignment. Existing assignments are preserved and judges receive an in-app notification.
- Notification center with unread state and mark-all-read.
- Automatic session recovery: expired API sessions return users to login instead of leaving pages in an invalid-session state.
- Fixed the Code Lab problem-loading bug caused by an undefined active-event variable.
- Fixed the coding submission event comparison bug caused by an undefined variable.
- Added safer application-level duplicate protection for judge/team assignments.
- Added role-permission update endpoints for administrators.
- Added indexes for notification retrieval.

## Important existing behavior retained

- Admin AI access is separate from participant AI access.
- Playground execution is not stored as a submission.
- Challenge submissions are stored with their participant/team/problem context.
- Hidden coding test cases are never returned to participants.
- Team formation can create an incomplete team and complete it later.
- Judges log in using their normal judge account.
- Certificates remain database-backed and publicly verifiable.

## Run

Backend:

```text
cd backend
npm install
npm start
```

Frontend:

```text
cd frontend
npm install
npm run dev
```

Use your existing `backend/.env` and `frontend/.env` configuration. Do not commit secrets.

## New admin page

After login as an administrator:

`/admin/operations`

Use **Operations Center** in the sidebar.
