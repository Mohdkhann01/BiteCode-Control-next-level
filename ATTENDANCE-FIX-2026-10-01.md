# Attendance Fix — 2026-10-01

Fixed the admin Attendance page returning `Invalid _id.`.

### What changed
- Empty/invalid `hackathonId` query values are rejected safely instead of being passed to `findById()`.
- When no event ID is supplied, the API uses the current active hackathon.
- Attendance reporting now uses safe manual population for participant/scanner references, so an old malformed attendance reference cannot crash the entire report.
- CSV attendance export uses the same safe reference handling.
- Department, Group/Section, Year and participant search/filter behavior is preserved.
- Existing attendance scanner, delete action, UI and other platform features are preserved.
