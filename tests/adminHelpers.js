import assert from "assert";
import {
  cooldownDeadline,
  countBy,
  formatCountdown,
  formatRelativeTime,
  matchesQuery,
  paginate,
} from "../utils/adminHelpers";

describe("Admin dashboard helpers", function () {
  it("formats countdowns as mm:ss, rounding partial seconds up", function () {
    assert.strictEqual(formatCountdown(30000), "00:30");
    assert.strictEqual(formatCountdown(29001), "00:30");
    assert.strictEqual(formatCountdown(29000), "00:29");
    assert.strictEqual(formatCountdown(61000), "01:01");
    assert.strictEqual(formatCountdown(0), "00:00");
    assert.strictEqual(formatCountdown(-500), "00:00");
  });

  it("derives a local cooldown deadline from the server's remaining time", function () {
    assert.strictEqual(cooldownDeadline(1000, 29000), 30000);
    assert.strictEqual(cooldownDeadline(1000, 0), 0);
    assert.strictEqual(cooldownDeadline(1000, undefined), 0);
  });

  it("matches a query case-insensitively against any field", function () {
    assert.ok(matchesQuery("", "anything"));
    assert.ok(matchesQuery("  ANN ", "ann", "ann@mie.com"));
    assert.ok(matchesQuery("mie.com", "ann", "ann@mie.com"));
    assert.ok(!matchesQuery("bob", "ann", undefined, null));
  });

  it("counts items by key", function () {
    const users = [{ s: "pending" }, { s: "approved" }, { s: "pending" }];
    assert.deepStrictEqual(
      countBy(users, (u) => u.s),
      { pending: 2, approved: 1 },
    );
  });

  it("paginates and clamps out-of-range pages", function () {
    const items = Array.from({ length: 30 }, (_, i) => i);
    assert.deepStrictEqual(paginate(items, 2, 25), {
      page: 2,
      totalPages: 2,
      items: [25, 26, 27, 28, 29],
    });
    // e.g. the last item on page 2 was deleted while viewing it
    assert.strictEqual(paginate(items.slice(0, 25), 2, 25).page, 1);
    assert.deepStrictEqual(paginate([], 3, 25), {
      page: 1,
      totalPages: 1,
      items: [],
    });
  });

  it("formats relative times", function () {
    const now = Date.UTC(2026, 10, 6, 12, 0, 0);
    assert.strictEqual(formatRelativeTime(null, now), "Never");
    assert.strictEqual(formatRelativeTime(now - 30 * 1000, now), "just now");
    assert.strictEqual(formatRelativeTime(now - 5 * 60 * 1000, now), "5m ago");
    assert.strictEqual(
      formatRelativeTime(now - 3 * 60 * 60 * 1000, now),
      "3h ago",
    );
    assert.strictEqual(
      formatRelativeTime(now - 2 * 24 * 60 * 60 * 1000, now),
      "2d ago",
    );
    assert.strictEqual(formatRelativeTime("not a date", now), "—");
  });
});
