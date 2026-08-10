import { MongoInternals } from "meteor/mongo";
import { sendJson } from "./adminAuth";

// Use the application's own database handle, not `admin`. The `ping`,
// `hello`, and `isMaster` commands used below are exempt from MongoDB
// access control, so they run on any database with no extra privileges.
// This keeps the healthcheck working with the standard MeteorJS grant
// (read-write on the app DB, read-only on `local` for oplog tailing).
const getDefaultDb = () =>
  MongoInternals.defaultRemoteCollectionDriver().mongo.db;

export const getHealthcheckStatus = async ({
  getDb = getDefaultDb,
  now = () => new Date().toISOString(),
} = {}) => {
  const timestamp = now();

  try {
    const db = getDb();
    if (!db || typeof db.command !== "function") {
      throw new Error("MongoDB command interface unavailable");
    }

    const ping = await db.command({ ping: 1 });
    if (ping?.ok !== 1) {
      throw new Error("MongoDB ping failed");
    }

    // `hello` is only available on MongoDB 4.4+. Fall back to the legacy
    // `isMaster` command on older servers so a reachable node is not
    // misreported as disconnected.
    let hello;
    try {
      hello = await db.command({ hello: 1 });
    } catch {
      hello = await db.command({ isMaster: 1 });
    }
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

export const healthcheckHandler = async (req, res) => {
  const { statusCode, body } = await getHealthcheckStatus();

  // A HEAD response must not include a message body (RFC 9110 §9.3.2);
  // probes only need the status line.
  if (req?.method === "HEAD") {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end();
    return;
  }

  sendJson(res, statusCode, body);
};
