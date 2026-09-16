# BiteCode Control — Final Phase

This phase adds the operational layer needed for a live hackathon:

- Event lifecycle controls from Setup → Registration → Live → Submission → Judging → Results → Closed.
- Safe per-event feature controls for AI, compiler, teams, submissions, judging, announcements and certificates.
- Live operations metrics and a recent audit-backed activity feed.
- CSV exports for participants, teams, code submissions, evaluations and certificates.
- Notification unread count and notifications for judge assignment, team submissions and completed evaluations.
- Configurable judging rubric stored on the hackathon; judges load the active rubric rather than using a hard-coded UI-only rubric.
- Event-specific payment validation for team creation/invitations.
- Challenge submission access respects the administrator's submission switch.
- Public leaderboard is scoped to the selected hackathon instead of mixing evaluations from other events.
- Admin health reports the configured OpenRouter AI provider correctly.

## Important configuration

Copy `backend/.env.example` to `backend/.env` and configure MongoDB, JWT and any optional compiler/AI services. Never commit `.env`.

## Run

```bash
npm run install:all
npm start
```

Frontend: http://localhost:5173
Backend health: http://localhost:5000/api/health

## Final-phase operational flow

1. Create/activate an event.
2. Configure its dates, team size, problems and judging rubric.
3. Use Operations Center to move the event through its lifecycle.
4. Enable/disable participant-facing services independently.
5. Monitor metrics and live activity.
6. Export records for reporting after the event.
