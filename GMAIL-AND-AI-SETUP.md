# Gmail + AI setup

## Gmail feedback confirmation

The backend sends feedback confirmation email asynchronously after a feedback record is saved. A Gmail outage will not fail or slow the feedback submission.

Set these variables in Render (or local `backend/.env`):

```env
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
GMAIL_FROM=BiteCode Control <yourgmail@gmail.com>
GMAIL_HOST=smtp.gmail.com
GMAIL_PORT=465
GMAIL_SECURE=true
```

Use a Google App Password, not the normal Gmail account password. Never commit the real values to GitHub.

## AI controls

Admin controls are stored per active hackathon:

- AI ON/OFF: controls participant access.
- Full AI: current assistant behavior, including complete code when requested.
- Guidance AI: gives concepts, hints, algorithms, pseudocode and debugging guidance, but does not provide a complete copy-paste-ready contest solution.
- Admin accounts always use Full AI.

The backend enforces the selected mode; changing the browser UI or calling `/api/ai/chat` directly cannot bypass Guidance mode.

Recommended AI environment variables:

```env
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/free
AI_TIMEOUT_MS=25000
AI_MAX_CONTEXT_CHARS=90000
```
