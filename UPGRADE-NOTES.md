# BiteCode Control upgrade notes

## Included in this update
- Added Tailwind CSS v4 to the Vite frontend toolchain while retaining existing styles to avoid a destructive visual rewrite.
- Added dedicated role workspace routes for Finance (`/finance`), Mentor (`/mentor`), and Volunteer (`/volunteer`).
- Added an authenticated Cloudinary image upload endpoint: `POST /api/media/images` (multipart form field: `image`).
- Anti-cheat page screenshots are uploaded as image files to Cloudinary; MongoDB stores the resulting Cloudinary URL instead of a large base64 image.
- Anti-cheat evidence is only attempted for tab-hidden, window-blur, and fullscreen-exit events. Routine camera movement, copy/paste attempts, context-menu attempts, and tab-visible events do not trigger screenshot uploads.
- Camera-frame scene changes are rate-limited and labeled for manual review; they are not proof of cheating.
- Admin anti-cheat rows show a screenshot thumbnail when evidence exists.
- Removed the uploaded frontend `.env` file from this distributable. Configure environment variables locally/at the hosting provider.

## Cloudinary configuration
Set these **on the backend host** (Render for production), or in `backend/.env` for local development:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Never put `CLOUDINARY_API_SECRET` in a `VITE_` variable or frontend code. The upload endpoint returns `503` until these variables are configured.

Cloudinary is media storage, not a replacement for MongoDB. MongoDB continues to store records and media URLs.

## Install and build
Because this environment could not reach npm's package registry to refresh lockfiles, run `npm install` once in each folder after extracting the ZIP so the lockfiles are updated for the added dependencies:

```powershell
cd backend
npm install
node --check src/server.js
cd ..\frontend
npm install
npm run build
```

Then configure the production backend environment variables and deploy the backend/frontend using your existing hosting setup.

## Browser anti-cheat limitations
A regular website cannot silently capture the entire desktop, and it cannot reliably detect a photo being taken with a separate phone. This implementation can record browser visibility/focus/fullscreen events and can capture the page's rendered content where browser APIs permit it. Webcam monitoring requires browser permission and device support. Review evidence in context; a camera-frame change is not conclusive proof of misconduct.
