# SHARK SET — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Global Gate**: Any path not explicitly matched in `firestore.rules` is strictly denied (`allow read, write: if false;`).
2. **Verified Identity**: Write operations require an authenticated user (`request.auth != null && request.auth.token.email_verified == true`) and strict `ownerId == request.auth.uid` matching.
3. **Strict Key & Size Boundaries**: Every entity enforces `hasAll` and `hasOnly` key allowlists and string `.size()` limits to prevent shadow fields and resource exhaustion.
4. **Query Enforcer on Lists**: Every `allow list` rule validates `resource.data.ownerId == request.auth.uid` (or public non-PII leaderboard constraints) without delegating security to client filters.

## 2. The "Dirty Dozen" Payloads
1. Unauthenticated write to `/bookings/bk-1` -> `PERMISSION_DENIED`
2. Unverified email write (`email_verified: false`) to `/bookings/bk-1` -> `PERMISSION_DENIED`
3. Spoofed `ownerId` (`ownerId != request.auth.uid`) on `/bookings/bk-1` -> `PERMISSION_DENIED`
4. Shadow field injection (`isAdmin: true`) on `/athletes_public/ath-1` -> `PERMISSION_DENIED`
5. Oversized ID poisoning (200-char ID) on `/notifications/{id}` -> `PERMISSION_DENIED`
6. Oversized string payload (`title.size() > 160`) on `/notifications/n-1` -> `PERMISSION_DENIED`
7. Invalid enum value (`level: 'hacker'`) on `/athletes_public/ath-1` -> `PERMISSION_DENIED`
8. Mutating immutable `ownerId` during `update` on `/bookings/bk-1` -> `PERMISSION_DENIED`
9. Updating a terminal cancelled booking (`existing().status == 'cancelled'`) -> `PERMISSION_DENIED`
10. Cross-user read of private `/bookings/{bookingId}` where `resource.data.ownerId != request.auth.uid` -> `PERMISSION_DENIED`
11. Cross-user read of `/notifications/{notificationId}` where `resource.data.ownerId != request.auth.uid` -> `PERMISSION_DENIED`
12. Deleting an arena document not owned by the requester -> `PERMISSION_DENIED`
