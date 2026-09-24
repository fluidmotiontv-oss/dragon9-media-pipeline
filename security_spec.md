# Security Specification - Dragon 9 Media Pipeline

## Data Invariants
1. Nodes can only be registered by authenticated users (admins/owners).
2. Jobs can only be created by the system or authenticated users.
3. Telemetry is append-only for active nodes.
4. Only the user `fluidmotiontv@gmail.com` (admin) has full control.

## The Dirty Dozen Payloads
1. **Unauthenticated Node Creation**: Attempting to register a node without a login.
2. **Identity Spoofing**: User A trying to update User B's node status.
3. **Invalid Status Injection**: Setting node status to "melting-down".
4. **Job Hijacking**: Attempting to change the `renderPath` of a job after it has started.
5. **Telemetry Flood**: Sending 1GB strings in telemetry CPU usage.
6. **Path Poisoning**: Using `../etc/passwd` as a node ID.
7. **Negative Progress**: Setting job progress to -50.
8. **Future Timestamping**: Setting `createdAt` to a year in the future.
9. **Admin Field Modification**: Attempting to set `isAdmin` in a user profile.
10. **Orphaned Job Creation**: Creating a job without a valid project name.
11. **PII Leakage**: Attempting to read all node details as a guest.
12. **System Lockout**: User attempting to delete the main telemetry stream.

## Test Runner (Draft Logic)
The `firestore.rules.test.ts` will verify that all these payloads return `PERMISSION_DENIED` unless authorized.
