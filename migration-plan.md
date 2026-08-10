# Device Identity Migration Plan

Goal: move device trust from the Cordova `device.uuid` (which survives iCloud/Android
backup restores) to a **non-migrating installation identity**, without forcing every
existing user through re-approval.

A restored replacement phone must become a **pending device**; an actively used phone
must migrate **silently**.

## Background — why

- Trust is currently keyed by `device.uuid` captured in
  [client/mobile/capture-device-info.js](client/mobile/capture-device-info.js), which can
  survive a backup restore onto a different physical phone.
- Login only checks the account-level `profile.registrationStatus`
  ([client/mobile/src/ui/Login.jsx](client/mobile/src/ui/Login.jsx)), not whether _this_
  device is approved.
- The startup token-refresh call `deviceDetails.storeFCMToken`
  ([client/mobile/push-notifications.js](client/mobile/push-notifications.js#L137)) has
  **no matching server method** — rotated FCM tokens are never reconciled.
- `users.mapFCMTokenToUser` in [server/main.js](server/main.js) queries `fcmToken` at the
  document root, but tokens live under `devices[]` — dead code for the current schema.

## Migration proofs (decision table)

A device may be silently grandfathered ("v2 approved") only by proving possession of
something that stays on the original physical phone:

| Proof presented                                                                         | Result                   |
| --------------------------------------------------------------------------------------- | ------------------------ |
| Biometric secret (Keychain `ThisDeviceOnly`) matches stored `devices[].biometricSecret` | Silent migration         |
| Device receives a challenge pushed to the **old FCM token stored in Mongo**             | Silent migration         |
| Only UUID / localStorage / resume token / PIN                                           | Pending — needs approval |
| Nothing                                                                                 | Pending — needs approval |

---

## Phase 0 — Fix existing gaps (prerequisite, no behavior change)

- [x] Remove the dead `Meteor.call("deviceDetails.storeFCMToken", ...)` in
      [client/mobile/push-notifications.js](client/mobile/push-notifications.js#L137)
      (it silently fails today) — it will be replaced in Phase 2.
- [x] Delete the broken `users.mapFCMTokenToUser` method in
      [server/main.js](server/main.js) (queries root-level `fcmToken`, never matches the
      nested schema). Confirm no client callers with a workspace-wide grep first.
- [ ] Verify the biometric Keychain item is actually non-migrating on iOS:
      check what accessibility class `cordova-plugin-fingerprint-aio`'s
      `registerBiometricSecret({ disableBackup: true })` uses. Document the finding in
      this file. If it is NOT `...ThisDeviceOnly`, the FCM-challenge proof becomes the
      primary silent-migration path.
- [x] Add a `devices.updateFCMToken` Meteor method (server) that: - requires `this.userId` - takes `{ deviceUUID, fcmToken }` with `check(...)` - updates only the matching device **owned by the caller** - never changes `deviceRegistrationStatus` - rate-limit it via `DDPRateLimiter` like the methods in
      [server/deviceManagement.js](server/deviceManagement.js)
- [x] Call `devices.updateFCMToken` from the push `registration` handler in
      [client/mobile/push-notifications.js](client/mobile/push-notifications.js), only
      when a user is logged in (`Meteor.userId()`); otherwise store in Session and flush
      after login.
- [x] Add a test in [tests/deviceManagement.js](tests/deviceManagement.js): token update
      succeeds for own device, fails for another user's device, fails logged out, and
      does not modify `deviceRegistrationStatus`.

## Phase 1 — Server: v2 installation identity (additive only)

- [ ] Extend the device schema in
      [utils/api/deviceDetails.js](utils/api/deviceDetails.js) with new optional fields:
      `installationId`, `publicKey`, `identityVersion` (1 = legacy, 2 = migrated),
      `migratedAt`, `migrationProof` (`"biometric" | "fcm-challenge" | "manual-approval"`).
- [ ] Create `MigrationChallenges` collection (`utils/api/migrationChallenges.js`):
      `{ userId, deviceUUID, challenge, createdAt, expiresAt (5 min), usedAt }` with a
      TTL index on `expiresAt`.
- [ ] Add method `devices.beginIdentityMigration({ deviceUUID, installationId, publicKey })`: - requires `this.userId` - device must exist, belong to caller, and be `approved` - device must not already have `identityVersion: 2` - creates a challenge record and returns `{ challengeId }` (NOT the challenge value)
- [ ] Add method `devices.proveMigrationByBiometric({ challengeId, biometricSecret, signedChallenge })`: - timing-safe compare of `biometricSecret` against the stored device secret
      (reuse the pattern in [server/deviceManagement.js](server/deviceManagement.js#L80)) - verify `signedChallenge` against the submitted `publicKey` - on success: set `identityVersion: 2`, `migrationProof: "biometric"`, bind
      `installationId`/`publicKey`, mark challenge used
- [ ] Add method `devices.requestMigrationPushChallenge({ challengeId })`: - sends the challenge value via `sendNotification` (see
      [server/firebase.js](server/firebase.js)) as a **data-only** push to the FCM
      token **already stored in Mongo** for that device — never to a token supplied by
      the caller
- [ ] Add method `devices.proveMigrationByPush({ challengeId, challengeValue, signedChallenge })`: - challenge value must match, be unexpired and unused - verify signature; on success set `identityVersion: 2`,
      `migrationProof: "fcm-challenge"`, bind identity, mark used
- [ ] Only after successful migration may `devices.updateFCMToken` replace the stored
      token for that device (update the Phase 0 method to enforce this once Phase 3
      client code ships).
- [ ] Signature scheme: ECDSA P-256, SHA-256 over the raw challenge bytes; verify with
      Node `crypto.verify`. Public key transported as base64 SPKI DER.
- [ ] Tests in [tests/deviceManagement.js](tests/deviceManagement.js): expired challenge
      rejected, reused challenge rejected, wrong signature rejected, cross-user attempt
      rejected, successful biometric path, successful push path.

## Phase 2 — Client: generate identity + silent migration

- [ ] Add a Cordova-compatible keypair module `client/mobile/installation-identity.js`: - generate an ECDSA P-256 keypair via WebCrypto (`crypto.subtle`), marked
      non-extractable where possible - persist via a secure-storage plugin with iOS `ThisDeviceOnly` accessibility;
      fall back to documenting the storage guarantee actually achieved - expose `getOrCreateIdentity()` → `{ installationId, publicKeyB64, sign(bytes) }`
- [ ] On app start after login (hook into the dashboard-load path used by
      `devices.checkRegistrationByUUID` /
      [client/mobile/src/ui/hooks/useDeviceRegistration.js](client/mobile/src/ui/hooks/useDeviceRegistration.js)):
      if this device is approved and has no v2 identity, run the migration flow
      automatically — no UI unless it fails.
- [ ] Migration flow order: 1. `devices.beginIdentityMigration` 2. try biometric proof (reuse `loadBiometricSecret` pattern from
      [client/mobile/src/ui/Login.jsx](client/mobile/src/ui/Login.jsx)) 3. if biometric unavailable → `devices.requestMigrationPushChallenge`, listen for
      the data push in
      [client/mobile/push-notifications.js](client/mobile/push-notifications.js)
      (`notificationType: "migration_challenge"`), then `devices.proveMigrationByPush` 4. if both fail → do nothing yet (Phase 4 adds the fallback UI)
- [ ] Retry at most once per app launch; never block the UI on migration.
- [ ] Add a `migration_challenge` branch to the notification handler that does NOT
      surface a banner/modal (data-only handling).

## Phase 3 — Observation rollout

- [ ] Add counters the admin can read (extend
      [server/adminApi.js](server/adminApi.js) diagnostics): totals of devices at
      `identityVersion` 1 vs 2, and counts per `migrationProof`.
- [ ] Add a `migrationEvents` capped log (userId, deviceUUID, outcome, error) for
      debugging failed silent migrations.
- [ ] Ship the release. Wait until v2 coverage is high (target: >90% of devices active
      in the last 30 days) before Phase 5. Check weekly via the admin diagnostics tab.
- [ ] Fix the top recurring failure causes seen in `migrationEvents`.

## Phase 4 — Fallback UX for unproven devices

- [ ] Add an in-app notice for approved-but-unmigrated devices after N failed silent
      attempts: "We couldn't verify this installation" with actions: - request approval from another approved device (reuse the secondary-approval
      push flow in [server/firebase.js](server/firebase.js)
      `sendSecondaryDeviceApprovalRequest`) - contact admin (existing admin approval flow in [server/main.js](server/main.js))
- [ ] Approval via either path sets `identityVersion: 2`,
      `migrationProof: "manual-approval"` and binds the new installation identity.
- [ ] Add "Mark as lost" to
      [client/mobile/src/ui/DeviceManagementPage.jsx](client/mobile/src/ui/DeviceManagementPage.jsx):
      revokes the device (existing revocation path in
      [server/deviceManagement.js](server/deviceManagement.js)), clears its resume
      tokens, and removes its FCM token.

## Phase 5 — Enforcement

- [ ] `devices.updateFCMToken`: require `identityVersion: 2` + a signed challenge.
- [ ] `notifications.handleResponse` ([server/main.js](server/main.js)): require the
      responding device to be v2 and verify a signature over
      `notificationId + action`.
- [ ] Login: after `checkRegistrationStatus`, also verify the **current device** is
      approved and v2 (new method `devices.checkDeviceApproval({ deviceUUID })`) — fixes
      the account-level-only check in
      [client/mobile/src/ui/Login.jsx](client/mobile/src/ui/Login.jsx).
- [ ] Device management methods (rename, revoke, set-primary in
      [server/deviceManagement.js](server/deviceManagement.js)): require v2 identity of
      the acting device.
- [ ] Announce a migration deadline in-app for remaining v1 devices.
- [ ] After the deadline: v1 devices are treated as `pending` (blocked from approvals)
      and must use the Phase 4 fallback.

## Phase 6 — Cleanup

- [ ] Remove v1 acceptance paths and the `identityVersion` branches that tolerate
      missing identities.
- [ ] Remove `device.uuid` from any security decision (keep it as display metadata
      only).
- [ ] Delete migration counters/log once stable.
- [ ] Update [docs/](docs/) with the final device-trust model.

---

## Invariants (check on every PR in this plan)

- FCM tokens are **data**, not identity — rotating a token never changes approval.
- The server never sends a migration challenge to a client-supplied token — only to the
  token already stored in Mongo.
- No new publication or method may expose `biometricSecret`, `fcmToken`, `publicKey`
  challenges, or private keys to clients (see the projection pattern in
  [utils/api/deviceDetails.js](utils/api/deviceDetails.js)).
- Silent migration must never downgrade an approved device; failure leaves state
  unchanged.
- A backup-restored phone (new keychain, new FCM token) must end up `pending`.
