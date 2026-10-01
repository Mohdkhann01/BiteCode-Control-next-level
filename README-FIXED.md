# BiteCode Control — Fixed Runnable Build

This version keeps the existing platform structure and fixes the coding-lab and admin-page issues reported during testing.

## Important fixes

- Fixed the **Problem not found / Loading problem** flow in the participant Code Lab.
- Participant **Problems** now uses the same published-problem source as the Online Compiler, avoiding the old event-loading race.
- Online Compiler **does not require an active hackathon** for browsing, Playground, Run, or compiler access.
- A coding submission uses the problem's linked hackathon when available, but the compiler itself is independent.
- Admin-created coding problems automatically attach to the current active event when no event is supplied.
- First startup automatically creates a small demo event + `BC-01 · Sum of Two Numbers` if there are no published coding problems. Set `AUTO_SEED=false` to disable this behavior.
- Fixed the Admin **Judging** page using the admin assignment endpoint, supports assigning one judge to multiple teams, prevents duplicate judge/team pairs, and supports unassigning an assignment.
- Default role permissions are refreshed on startup, so older databases do not keep stale/missing permissions.
- Added a frontend error boundary so a UI exception shows a useful error screen instead of a completely blank page.
- Certificate Studio now auto-selects the first active participant, supports true edit/update of an issued certificate template, and has a working browser Print / Save PDF path.
- API data-load failures are logged in the browser console instead of being silently swallowed.
- Admin AI remains available; the AI switch controls **participant AI access**.
- Admin compiler switch controls **participant compiler access**.
- Playground runs are not stored in MongoDB.
- Problem submissions are stored in MongoDB as `CodeSubmission`.

## Start on Windows

From the project root:

```powershell
npm run setup
npm start
```

Or separately:

```powershell
cd backend
npm install
npm start
```

and in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## MongoDB

Create `backend/.env` from `backend/.env.example`.

If you changed your MongoDB Atlas database-user password, update the password inside `MONGODB_URI`. If the password contains special URL characters, URL-encode them (for example `@` becomes `%40`).

If startup reports `querySrv ECONNREFUSED _mongodb._tcp...`, that is a DNS/network problem before authentication. On Windows run `ipconfig /flushdns`, then optionally set `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8` in `backend/.env` and restart. Also copy the current Atlas connection string again because the cluster hostname must be current.

Do not put the real `.env` file, MongoDB password, JWT secret, or API keys into the project zip.

## Coding Lab test

After login:

1. Open **Admin → Coding Lab**.
2. Confirm the compiler says **ON**.
3. Confirm `BC-01 · Sum of Two Numbers` is **Published**.
4. Open the participant account.
5. Open **Problems → BC-01 → Open Code Lab**.
6. Select Java.
7. Use:

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a + b);
    }
}
```

Input:

```text
10 25
```

Expected output:

```text
35
```

## Judge0

The compiler uses Judge0. The default public endpoint may be rate-limited or unavailable at times. For a real event, configure your own/self-hosted Judge0 endpoint in `backend/.env`.

## AI

The AI uses OpenRouter through the backend. The browser never receives the OpenRouter API key. The backend also does not place environment secrets into AI context.

## Data rules

- **Registered coding problem submission:** stored in MongoDB with participant, team, problem, language, source code, score and test results.
- **Compiler Playground run:** executed temporarily and not stored as a `CodeSubmission`.
- Hidden test expected outputs are never returned to participants.

## Certificate Studio

The certificate is generated as editable HTML/CSS rather than an uploaded image. The organizer can change the title, subtitle, presentation line, body, organizer, location, established year, track/course, signature, colors and logo URL. The participant name and certificate ID are inserted automatically. Use **Print / Save PDF** and choose a landscape A4 PDF printer.

Existing issued certificates can be opened from the register and updated without creating a duplicate certificate.
