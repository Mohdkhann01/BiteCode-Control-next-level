# Implemented: Event Challenges + QR Attendance

## Event challenge architecture
- Basic coding problems use `Problem.hackathon = null`.
- Event challenges use `Problem.hackathon = <event id>`.
- Participant problem APIs expose published basic problems plus published challenges for the current event only.
- Admin Problem Studio can create/edit either a basic problem or an event challenge.
- Team challenge assignment remains event-scoped.

## QR attendance
- Every participant receives a secure random attendance credential.
- Existing participant accounts are backfilled automatically at backend startup.
- Participant dashboard has **My Attendance** with a generated QR image and attendance history.
- Authorized Admin/Judge/Mentor/Volunteer users get an **Attendance Scanner**.
- Camera scanning uses the browser scanner library loaded from the public CDN; manual `BITEATT:` token entry is available as a fallback.
- The backend validates event, participant status, payment approval for paid events, attendance feature state, and scanner role.
- Duplicate event check-ins are rejected.
- Attendance records are event-scoped and audited.
- Admin can search, delete incorrect records, and download `attendance.csv`.
- Operations Center includes attendance feature control and live checked-in count.

## Running
1. Backend: `cd backend && npm install && npm start`
2. Frontend: `cd frontend && npm install && npm run dev`
3. Ensure `backend/.env` has a working `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_URL`.
4. For camera scanning, the browser needs camera permission and internet access to load the scanner library.
