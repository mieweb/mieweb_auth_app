import { Random } from "meteor/random";

/**
 * Shared secret used by server-to-server calls (e.g. device approval
 * notifications) to bypass API key authentication on /send-notification.
 *
 * In multi-instance deployments all processes must share the same secret
 * so that internal HTTP calls succeed regardless of which instance handles
 * the request.  Set the INTERNAL_SERVER_SECRET env var in production;
 * a random per-process value is generated as fallback for local development.
 */
if (!process.env.INTERNAL_SERVER_SECRET) {
  console.warn(
    "[internalSecret] INTERNAL_SERVER_SECRET env var is not set \u2013 generating a random per-process secret. " +
      "This is fine for single-instance / local dev but will break internal calls in a multi-instance deployment.",
  );
}

export const INTERNAL_SERVER_SECRET =
  process.env.INTERNAL_SERVER_SECRET || Random.secret(40);
