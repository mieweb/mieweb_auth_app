import { Meteor } from "meteor/meteor";
import { verifySignature } from "./identityMigration.js";

// Phase 5 enforcement (migration-plan.md): when IDENTITY_ENFORCEMENT=true,
// trust-sensitive operations require the acting device to hold a v2
// installation identity and to sign the operation with it. Flag off = zero
// behavior change (rollout is gated on >90% v2 coverage, see admin
// diagnostics).

export const isIdentityEnforced = () =>
  process.env.IDENTITY_ENFORCEMENT === "true";

// Reject proofs signed too long ago so captured signatures can't be replayed
// indefinitely.
const PROOF_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Require a v2 device plus a fresh signature over `message` when enforcement
 * is on. `proof` is `{ signedAt: Number (ms epoch), signature: String }`,
 * signed as `${message}|${signedAt}` by the installation key.
 */
export const requireDeviceProof = (device, message, proof) => {
  if (!isIdentityEnforced()) return;

  if (!device || device.identityVersion !== 2 || !device.publicKey) {
    throw new Meteor.Error(
      "identity-required",
      "This device's installation identity has not been verified. Verify it from another device or contact your administrator.",
    );
  }

  const signedAt = Number(proof?.signedAt);
  if (
    !proof?.signature ||
    !Number.isFinite(signedAt) ||
    Math.abs(Date.now() - signedAt) > PROOF_MAX_AGE_MS
  ) {
    throw new Meteor.Error(
      "identity-proof-invalid",
      "Missing or expired device signature. Please update the app and try again.",
    );
  }

  if (
    !verifySignature(
      device.publicKey,
      `${message}|${signedAt}`,
      proof.signature,
    )
  ) {
    throw new Meteor.Error(
      "identity-proof-invalid",
      "Device signature verification failed.",
    );
  }
};
