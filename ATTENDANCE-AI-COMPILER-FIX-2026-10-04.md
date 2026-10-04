# Attendance + AI + Compiler Fix — 2026-10-04

## Attendance
- Admin attendance now exposes real Department, Group and Year choices from participant records.
- Export requires an exact Department + Group + Year combination.
- Each export is therefore isolated to one department/section/year combination.
- Export is participant-level with Entry/Exit/Workshop/Mentor/Presentation status columns.
- Mixed "all departments" attendance export is intentionally blocked.

## AI
- Existing Full AI and Guidance AI backend mode enforcement is retained.
- Participant mode is read from the active event settings; admins always receive Full AI.
- Guidance mode does not allow complete copy-paste-ready challenge solutions.
- Missing legacy AI settings are initialized to AI ON + Full mode at backend startup.

## Compiler
- Existing compiler backend enforcement is retained for Run, Submit, Problems and Languages.
- Missing legacy compilerEnabled settings are initialized to ON at backend startup.
- Admin compiler controls continue to be the authority; explicitly disabled events remain disabled.
- The compiler returns COMPILER_DISABLED only when the active event setting is actually false (or no active event exists).
