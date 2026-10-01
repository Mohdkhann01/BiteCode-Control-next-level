# BiteCode Control – AI + Code Lab Upgrade

This build keeps the existing hackathon platform and adds/fixes the requested operational features:

- **Admin AI is always available.**
- **Participant AI access is controlled by the administrator** from the Admin Control Center.
- The AI switch does **not** remove AI from the administrator. When participant access is disabled, participants receive a clear backend-enforced message while admin AI continues to work.
- **Online Code Lab / compiler** is available from the participant Problems and Code Lab pages.
- Code execution supports Python, JavaScript, C, C++, Java, C#, Go, Rust, PHP, Ruby and Kotlin through Judge0.
- Existing admin team management supports manual team formation, adding/removing members, leadership transfer, challenge assignment, status control and deletion.
- Existing participant management supports adding, disabling/enabling, role changes, password reset links and removal.
- Existing attendance and certificate management remains included.

## Run locally

### Backend

1. Copy `backend/.env.example` to `backend/.env`.
2. Put your own MongoDB URI, JWT secret, admin credentials and OpenRouter API key into `backend/.env`.
3. For Judge0, use your own/self-hosted Judge0 endpoint for production. The public endpoint can have rate limits/availability restrictions.
4. Run:

```powershell
cd backend
npm install
npm start
```

The API runs on `http://localhost:5000` by default.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:5173` and talks to `http://localhost:5000/api` unless `VITE_API_URL` is set.

## Important AI behavior

The database setting is `Hackathon.settings.aiEnabled` and now means **participant AI access**. Administrators are exempt from this restriction and can always use the AI assistant.

Do not put private organizer credentials, passwords, JWT secrets or payment secrets into AI context. The AI should receive only the data necessary for the request.


## First-time setup / compiler test

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `MONGODB_URI` to your current MongoDB Atlas connection string. If you changed the Atlas database-user password, update the password in this URI. URL-encode special characters in the password (for example `@` becomes `%40`).
3. Set a long `JWT_SECRET`.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
5. Install dependencies: `npm install --prefix backend` and `npm install --prefix frontend`.
6. Run `npm run seed --prefix backend` once. This creates/updates the demo event and a published `BC-01 · Sum of Two Numbers` problem with public and hidden tests.
7. Start the project with `npm start` from the project root, or start backend/frontend separately.

### Coding workflow

- Admin → **Coding Lab** (or **Problem Studio**) → create/publish a problem.
- Participant → **Problems** → open the problem → write code → Run → Submit solution.
- Submitted coding solutions are stored in `CodeSubmission` and are visible to authorized admin/judge users.
- Participant **Playground** runs are intentionally not stored in MongoDB.
- Admin → **Coding Lab** contains the backend-enforced compiler enable/disable switch.
- Admin → **Roles & Access** controls who can view coding submissions.

If `/admin/problems` is opened, it now routes to the working Coding Lab management screen so there is only one authoritative coding-problem editor.
