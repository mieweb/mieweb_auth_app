import assert from "assert";

if (Meteor.isServer) {
  const { getHealthcheckStatus } = require("../server/healthcheck.js");

  describe("Healthcheck status", function () {
    it("returns healthy when MongoDB is reachable and writable", async function () {
      const seen = [];
      const adminDb = {
        command: async (cmd) => {
          seen.push(cmd);
          if (cmd.ping === 1) return { ok: 1 };
          if (cmd.hello === 1) return { ok: 1, isWritablePrimary: true };
          throw new Error("Unexpected command");
        },
      };

      const result = await getHealthcheckStatus({
        getAdminDb: () => adminDb,
        now: () => "2026-06-29T00:00:00.000Z",
      });

      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.statusCode, 200);
      assert.deepStrictEqual(seen, [{ ping: 1 }, { hello: 1 }]);
      assert.deepStrictEqual(result.body, {
        status: "ok",
        timestamp: "2026-06-29T00:00:00.000Z",
        checks: {
          mongodb: { connected: true, writable: true },
        },
      });
    });

    it("returns unhealthy when MongoDB is connected but not writable", async function () {
      const adminDb = {
        command: async (cmd) => {
          if (cmd.ping === 1) return { ok: 1 };
          if (cmd.hello === 1) return { ok: 1, isWritablePrimary: false };
          throw new Error("Unexpected command");
        },
      };

      const result = await getHealthcheckStatus({
        getAdminDb: () => adminDb,
        now: () => "2026-06-29T00:00:00.000Z",
      });

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.statusCode, 503);
      assert.deepStrictEqual(result.body, {
        status: "unhealthy",
        timestamp: "2026-06-29T00:00:00.000Z",
        checks: {
          mongodb: { connected: true, writable: false },
        },
        error: "MongoDB is not writable on this node",
      });
    });

    it("returns unhealthy when MongoDB command interface is unavailable", async function () {
      const result = await getHealthcheckStatus({
        getAdminDb: () => null,
        now: () => "2026-06-29T00:00:00.000Z",
      });

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.statusCode, 503);
      assert.deepStrictEqual(result.body, {
        status: "unhealthy",
        timestamp: "2026-06-29T00:00:00.000Z",
        checks: {
          mongodb: { connected: false, writable: false },
        },
        error: "MongoDB admin command interface unavailable",
      });
    });
  });
}
