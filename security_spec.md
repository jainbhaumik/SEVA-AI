# SEVA AI Security Specification & Payload-First TDD

## 1. Data Invariants
1. A user profile at `/users/{userId}` cannot exist with a self-assigned `role` other than `"citizen"` at creation time (unless bootstrapped admin).
2. A complaint at `/complaints/{complaintId}` cannot be created with `citizenId != request.auth.uid`, an invalid `category`, invalid `severity`, non-`submitted` initial `status`, or client-forged timestamps (`createdAt != request.time`).
3. A public tracking snapshot at `/public_tracks/{trackToken}` contains zero PII (`email`, `phone`, `citizenId`) and matches its allowed schema and field bounds.
4. An SOS alert at `/sos_alerts/{alertId}` cannot be created for another `citizenId` or with a pre-acknowledged `status`.
5. Citizens can only read/list their own private `/complaints`, `/sos_alerts`, `/notifications`, `/dpdp_requests`, and `/users/{userId}` documents; community feeds (`/public_tracks`, `/public_profiles`, `/awards`) are strictly non-PII.
6. Terminal complaint statuses (`resolved`, `rejected`) and SOS terminal statuses (`resolved`, `cancelled`) cannot be modified by citizens.

## 2. Dirty Dozen Adversarial Payloads
1. **Self-Role Escalation**: `POST /users/{uid}` with `{ role: "admin", ... }` -> `PERMISSION_DENIED`
2. **Shadow Field Injection**: `POST /complaints/{id}` with extra field `{ isVerified: true }` -> `PERMISSION_DENIED`
3. **Identity Spoofing**: `POST /complaints/{id}` with `{ citizenId: "victim_uid" }` -> `PERMISSION_DENIED`
4. **Timestamp Forgery**: `POST /complaints/{id}` with `{ createdAt: "2020-01-01T00:00:00Z" }` -> `PERMISSION_DENIED`
5. **Status Shortcutting**: `POST /complaints/{id}` with `{ status: "resolved" }` -> `PERMISSION_DENIED`
6. **ID Poisoning**: `POST /complaints/{2000-char-id}` -> `PERMISSION_DENIED`
7. **PII Leak Read**: Citizen A `GET /users/{citizenB}` -> `PERMISSION_DENIED`
8. **Blanket List Scraping**: Citizen A `LIST /complaints` without `citizenId == auth.uid` -> `PERMISSION_DENIED`
9. **SOS Impersonation**: Citizen A `POST /sos_alerts/{id}` with `{ citizenId: "citizenB" }` -> `PERMISSION_DENIED`
10. **Unauthenticated Write**: Unauthenticated `POST /public_tracks/{token}` -> `PERMISSION_DENIED`
11. **Value Poisoning**: Citizen updates `complaints/{id}` changing `status` or `points` -> `PERMISSION_DENIED`
12. **Email Spoofing**: Unverified email token claiming admin email -> `PERMISSION_DENIED`
