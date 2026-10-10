# BiteCode homepage redesign notes

The public homepage has been redesigned using the uploaded reference video as inspiration:
- cinematic full-screen hero with dark overlays and bold typography
- orange accent CTAs and premium editorial layout
- event status/registration panel
- scrolling ticker, feature cards, tracks, prizes, timeline, and final CTA
- responsive mobile navigation and reduced-motion support
- keeps existing React Router routes and current-hackathon API data

## University campus image
The uploaded project did not contain an identifiable university/campus photo. To use your actual university image, put the image at:

`frontend/public/university-campus.jpg`

The homepage tries that local image first. If it is missing or fails to load, it falls back to a generic campus photo. Replace the fallback/secondary student image URLs in `frontend/src/main.jsx` if you want all imagery to be locally hosted.

## Validation
The edited `frontend/src/main.jsx` passed a JSX/TypeScript transpile syntax check. A full Vite build was not verified in this environment because installing npm dependencies timed out. Run `npm ci` and `npm run build` in `frontend` on your machine before deployment.
