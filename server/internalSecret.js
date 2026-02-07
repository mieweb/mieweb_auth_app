import { Random } from 'meteor/random';

/**
 * A randomly generated secret used by server-to-server calls (e.g. device
 * approval notifications) to bypass API key authentication on the
 * /send-notification endpoint. Generated once per process start.
 */
export const INTERNAL_SERVER_SECRET = Random.secret(40);
