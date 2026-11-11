// run: node src/api/units.test.mjs
import assert from "node:assert/strict";
const u = await import("./units.js");
const Y = 10n ** 24n;
assert.equal(u.toYocto("1"), Y);
assert.equal(u.toYocto("1.5"), Y + Y / 2n);
assert.equal(u.toYocto("0.000000000000000000000001"), 1n);
assert.equal(u.toYocto(".5"), null);
assert.equal(u.toYocto("1.2.3"), null);
assert.equal(u.toYocto("-1"), null);
assert.equal(u.toYocto("1.0000000000000000000000001"), null); // 25 decimals
assert.ok(u.isAccountId("alice.testnet"));
assert.ok(u.isAccountId("a1b2".repeat(16))); // 64-char implicit
assert.ok(!u.isAccountId("Alice.testnet"));
assert.ok(!u.isAccountId("alice..testnet"));
assert.ok(!u.isAccountId("a"));
assert.ok(!u.isAccountId("x".repeat(65)));
console.log("units ok");
