# BiteCode Control — Integral University Blue Cinematic UI

This update changes frontend presentation only:
- Replaces the public homepage layout and removes the oversized event-intelligence/registration-fee panel.
- Uses the user-supplied Integral University logo and the existing campus images.
- Adds a CSS-animated, layered humanoid robot assembly visual in blue/cyan.
- Adds AI/robotics, campus, labs, tracks, prizes and timeline sections.
- Adds blue/cyan styling overrides for the existing login and logged-in workspace UI.
- Keeps existing React routes, API calls, authentication, payments, compiler, judging and business logic unchanged.

## Install and run

From `frontend/`:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The build could not be verified in the packaging environment because `npm install` timed out while accessing the npm registry. Please run the build locally before deploying.
