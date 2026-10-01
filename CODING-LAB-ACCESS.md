# Coding Lab access and storage

## Registered coding problem
When a participant clicks **Submit solution** for a published coding problem, the backend stores a `CodeSubmission` record in MongoDB containing the user, optional team, problem, language, source code, score, test results, status and timestamps.

Admins with `coding.view` can view submissions. Roles with `coding.manage` can enable/disable the compiler and create/edit/delete coding problems.

The built-in system roles can be edited from **Admin -> Roles & Access** to grant or remove these permissions.

## Playground / random compiler
The **Playground** uses `POST /api/compiler/playground/run`. It executes code but deliberately does **not** create a MongoDB `CodeSubmission` record. It is intended for temporary experimentation.

Execution is sent to the configured Judge0 service, so the platform itself does not persist playground source code or results. The external execution provider may have its own retention policy; do not treat the playground as a zero-retention guarantee for the external provider.
