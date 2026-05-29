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
    DUO_ERRORS,
  } = require("../server/duo/response.js");
  const { parseBasicAuth, isDateFresh } = require("../server/duo/auth.js");

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
}
