import { Meteor } from "meteor/meteor";
import { sendJson } from "./adminAuth";

const getDefaultAdminDb = () => Meteor.users.rawCollection()?.db?.admin?.();

export const getHealthcheckStatus = async ({
  getAdminDb = getDefaultAdminDb,
  now = () => new Date().toISOString(),
} = {}) => {
  const timestamp = now();

  try {
    const adminDb = getAdminDb();
    if (!adminDb || typeof adminDb.command !== "function") {
      throw new Error("MongoDB admin command interface unavailable");
    }

    const ping = await adminDb.command({ ping: 1 });
    if (ping?.ok !== 1) {
      throw new Error("MongoDB ping failed");
    }

    const hello = await adminDb.command({ hello: 1 });
    const writable = Boolean(hello?.isWritablePrimary ?? hello?.ismaster);

    if (!writable) {
      return {
        ok: false,
        statusCode: 503,
        body: {
          status: "unhealthy",
          timestamp,
          checks: {
            mongodb: { connected: true, writable: false },
          },
          error: "MongoDB is not writable on this node",
        },
      };
    }

    return {
      ok: true,
      statusCode: 200,
      body: {
        status: "ok",
        timestamp,
        checks: {
          mongodb: { connected: true, writable: true },
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 503,
      body: {
        status: "unhealthy",
        timestamp,
        checks: {
          mongodb: { connected: false, writable: false },
        },
        error: error?.message || "MongoDB healthcheck failed",
      },
    };
  }
};

export const healthcheckHandler = async (_req, res) => {
  const { statusCode, body } = await getHealthcheckStatus();
  sendJson(res, statusCode, body);
};
