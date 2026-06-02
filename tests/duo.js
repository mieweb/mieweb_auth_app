import assert from "assert";
import crypto from "crypto";

/**
 * Duo Auth API compatibility-layer unit tests.
 *
 * The signature tests cross-check our canonicalization against the documented
 * vectors from duo_client's own `canon_params` docstring, and verify full
 * request signatures by independently constructing the HMAC the way a real
 * Duo client library would (rather than reusing our own canonicalize()).
 */
if (Meteor.isServer) {
  const {
    duoQuote,
    canonParams,
    signCanonical,
    verifySignature,
  } = require("../server/duo/signature.js");
  const {
    ok,
    fail,
    httpStatusForCode,
    okPaged,
    DUO_ERRORS,
  } = require("../server/duo/response.js");
  const { parseBasicAuth, isDateFresh } = require("../server/duo/auth.js");
  const {
    buildDuoPhone,
    buildDuoUser,
    buildDuoUserFromInvite,
  } = require("../server/duo/adminModel.js");

  describe("Duo signature canonicalization", function () {
    it("quotes values with ~ left unescaped (duo style)", function () {
      assert.strictEqual(duoQuote("First Last"), "First%20Last");
      assert.strictEqual(duoQuote("a~b"), "a~b");
      assert.strictEqual(duoQuote("a(b)!c*'"), "a%28b%29%21c%2A%27");
    });

    it("matches duo_client canon_params simple vector", function () {
      const out = canonParams({
        realname: ["First Last"],
        username: ["root"],
      });
      assert.strictEqual(out, "realname=First%20Last&username=root");
    });

    it("matches duo_client canon_params special-char vector", function () {
      const out = canonParams({
        username: ["Test User"],
        phone: ["+1 (555) 123-4567"],
        extra: ["Make+Sure&You+know%20what+is+going#on"],
      });
      assert.strictEqual(
        out,
        "extra=Make%2BSure%26You%2Bknow%2520what%2Bis%2Bgoing%23on" +
          "&phone=%2B1%20%28555%29%20123-4567&username=Test%20User",
      );
    });
  });

  describe("Duo signature verification", function () {
    const skey = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const date = "Tue, 21 Aug 2012 17:29:18 -0000";
    const host = "api-xxxxxxxx.duosecurity.com";

    it("accepts a correctly-signed sig_version 2 (GET) request", function () {
      const path = "/auth/v2/preauth";
      const query = { username: ["root"] };
      // Build canonical the duo_client v2 way, independently.
      const canonical = [date, "GET", host, path, "username=root"].join("\n");
      const sig = crypto
        .createHmac("sha1", skey)
        .update(canonical, "utf8")
        .digest("hex");

      const okSig = verifySignature({
        skey,
        providedSig: sig,
        method: "GET",
        host,
        path,
        date,
        queryParams: query,
        body: "",
        headers: { host, date },
      });
      assert.strictEqual(okSig, true);

      const badSig = verifySignature({
        skey,
        providedSig: sig.replace(/.$/, "0"),
        method: "GET",
        host,
        path,
        date,
        queryParams: query,
        body: "",
        headers: { host, date },
      });
      assert.strictEqual(badSig, false);
    });

    it("accepts a correctly-signed sig_version 5 (POST JSON) request", function () {
      const path = "/auth/v2/auth";
      const body = JSON.stringify({
        username: "root",
        factor: "push",
        device: "auto",
      });
      const sha512 = (s) =>
        crypto.createHash("sha512").update(s, "utf8").digest("hex");
      // v5 canonical: date, METHOD, host, path, canon_params(""),
      // sha512(body), sha512(canon x-duo headers="").
      const canonical = [
        date,
        "POST",
        host,
        path,
        "",
        sha512(body),
        sha512(""),
      ].join("\n");
      const sig = crypto
        .createHmac("sha512", skey)
        .update(canonical, "utf8")
        .digest("hex");

      const good = verifySignature({
        skey,
        providedSig: sig,
        method: "POST",
        host,
        path,
        date,
        queryParams: {},
        body,
        headers: { host, date, "content-type": "application/json" },
      });
      assert.strictEqual(good, true);

      // Tampered body must fail.
      const tampered = verifySignature({
        skey,
        providedSig: sig,
        method: "POST",
        host,
        path,
        date,
        queryParams: {},
        body: body.replace("root", "evil"),
        headers: { host, date, "content-type": "application/json" },
      });
      assert.strictEqual(tampered, false);
    });

    it("rejects when host differs (case preserved comparison)", function () {
      const path = "/auth/v2/check";
      const canonical = [date, "GET", host, path, ""].join("\n");
      const sig = signCanonical(skey, canonical, 2);
      const result = verifySignature({
        skey,
        providedSig: sig,
        method: "GET",
        host: "evil.example.com",
        path,
        date,
        queryParams: {},
        body: "",
        headers: { host: "evil.example.com", date },
      });
      assert.strictEqual(result, false);
    });
  });

  describe("Duo auth header parsing", function () {
    it("parses Basic ikey:sig", function () {
      const raw = Buffer.from("DIABC:abcdef123", "utf8").toString("base64");
      const parsed = parseBasicAuth(`Basic ${raw}`);
      assert.strictEqual(parsed.ikey, "DIABC");
      assert.strictEqual(parsed.sig, "abcdef123");
    });

    it("returns null for missing/garbled headers", function () {
      assert.strictEqual(parseBasicAuth(undefined), null);
      assert.strictEqual(parseBasicAuth("Bearer xyz"), null);
    });

    it("enforces Date freshness within 5 minutes", function () {
      const now = Date.now();
      assert.strictEqual(isDateFresh(new Date(now).toUTCString(), now), true);
      assert.strictEqual(
        isDateFresh(new Date(now - 10 * 60 * 1000).toUTCString(), now),
        false,
      );
      assert.strictEqual(isDateFresh("not a date", now), false);
    });
  });

  describe("Duo response envelopes", function () {
    it("builds OK envelopes", function () {
      assert.deepStrictEqual(ok({ time: 1 }), {
        stat: "OK",
        response: { time: 1 },
      });
    });

    it("builds FAIL envelopes with optional detail", function () {
      const body = fail(DUO_ERRORS.UNAUTHORIZED, "no creds");
      assert.strictEqual(body.stat, "FAIL");
      assert.strictEqual(body.code, 40101);
      assert.strictEqual(body.message_detail, "no creds");
    });

    it("derives HTTP status from the first 3 digits of the code", function () {
      assert.strictEqual(httpStatusForCode(40101), 401);
      assert.strictEqual(httpStatusForCode(40002), 400);
      assert.strictEqual(httpStatusForCode(50000), 500);
    });
  });

  describe("Duo Admin API pagination (okPaged)", function () {
    const items = Array.from({ length: 250 }, (_, i) => ({ n: i }));

    it("defaults to offset 0 / limit 100 with next_offset only", function () {
      const env = okPaged(items);
      assert.strictEqual(env.stat, "OK");
      assert.strictEqual(env.response.length, 100);
      assert.strictEqual(env.response[0].n, 0);
      assert.strictEqual(env.metadata.total_objects, 250);
      assert.strictEqual(env.metadata.next_offset, 100);
      assert.ok(!("prev_offset" in env.metadata));
    });

    it("returns a middle page with both prev_offset and next_offset", function () {
      const env = okPaged(items, { offset: 100, limit: 100 });
      assert.strictEqual(env.response.length, 100);
      assert.strictEqual(env.response[0].n, 100);
      assert.strictEqual(env.metadata.prev_offset, 0);
      assert.strictEqual(env.metadata.next_offset, 200);
    });

    it("omits next_offset on the final page", function () {
      const env = okPaged(items, { offset: 200, limit: 100 });
      assert.strictEqual(env.response.length, 50);
      assert.strictEqual(env.metadata.prev_offset, 100);
      assert.ok(!("next_offset" in env.metadata));
      assert.strictEqual(env.metadata.total_objects, 250);
    });

    it("handles empty result sets", function () {
      const env = okPaged([]);
      assert.deepStrictEqual(env.response, []);
      assert.deepStrictEqual(env.metadata, { total_objects: 0 });
    });
  });

  describe("Duo Admin API object mapping", function () {
    it("maps an approved Android device to a Duo phone object", function () {
      const phone = buildDuoPhone(
        {
          appId: "app-123",
          deviceUUID: "uuid-xyz",
          deviceModel: "Pixel 8",
          devicePlatform: "Android 14",
          deviceRegistrationStatus: "approved",
          lastUpdated: new Date("2024-01-02T03:04:05Z"),
        },
        [{ user_id: "u1" }],
      );
      assert.strictEqual(phone.phone_id, "app-123");
      assert.strictEqual(phone.platform, "Google Android");
      assert.strictEqual(phone.activated, true);
      assert.deepStrictEqual(phone.capabilities, ["push"]);
      assert.strictEqual(phone.model, "Pixel 8");
      assert.strictEqual(phone.users[0].user_id, "u1");
    });

    it("falls back to deviceUUID for phone_id and maps iOS / unapproved", function () {
      const phone = buildDuoPhone({
        deviceUUID: "uuid-only",
        devicePlatform: "iOS 17",
        deviceRegistrationStatus: "pending",
      });
      assert.strictEqual(phone.phone_id, "uuid-only");
      assert.strictEqual(phone.platform, "Apple iOS");
      assert.strictEqual(phone.activated, false);
    });

    it("builds a Duo user from a Meteor user + device doc", function () {
      const user = buildDuoUser(
        {
          _id: "user1",
          username: "alice",
          emails: [{ address: "alice@example.com" }],
          profile: {
            firstName: "Alice",
            lastName: "Smith",
            registrationStatus: "approved",
          },
          createdAt: new Date("2023-05-06T00:00:00Z"),
        },
        {
          userId: "user1",
          devices: [
            { appId: "a1", deviceRegistrationStatus: "approved" },
            { appId: "a2", deviceRegistrationStatus: "pending" },
          ],
        },
      );
      assert.strictEqual(user.user_id, "user1");
      assert.strictEqual(user.username, "alice");
      assert.strictEqual(user.realname, "Alice Smith");
      assert.strictEqual(user.email, "alice@example.com");
      assert.strictEqual(user.status, "active");
      assert.strictEqual(user.is_enrolled, true);
      assert.strictEqual(user.phones.length, 2);
    });

    it("marks users with no approved devices as disabled / unenrolled", function () {
      const user = buildDuoUser(
        { _id: "u2", username: "bob", profile: {} },
        {
          userId: "u2",
          devices: [{ appId: "x", deviceRegistrationStatus: "pending" }],
        },
      );
      assert.strictEqual(user.status, "disabled");
      assert.strictEqual(user.is_enrolled, false);
    });

    it("builds a pre-enrollment Duo user from an invite", function () {
      const user = buildDuoUserFromInvite({
        _id: "invite1",
        username: "carol",
        email: "carol@example.com",
        firstName: "Carol",
        lastName: "Jones",
        createdAt: new Date("2024-06-07T00:00:00Z"),
      });
      assert.strictEqual(user.user_id, "invite1");
      assert.strictEqual(user.username, "carol");
      assert.strictEqual(user.realname, "Carol Jones");
      assert.strictEqual(user.status, "disabled");
      assert.strictEqual(user.is_enrolled, false);
      assert.deepStrictEqual(user.phones, []);
    });
  });
}
