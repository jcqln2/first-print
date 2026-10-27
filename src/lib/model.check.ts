import assert from "node:assert/strict";
import { fillFraction, runSession } from "./model";
import { leadAtQuantile, seatLeadMs } from "./published";

assert.equal(seatLeadMs("p50"), 70);
assert.equal(seatLeadMs("p95"), 280);
assert.equal(leadAtQuantile(0.5), 70);
assert.equal(leadAtQuantile(0.95), 280);
assert.equal(leadAtQuantile(1), 280);
assert.ok(leadAtQuantile(0.25) > 0 && leadAtQuantile(0.25) < 70);

assert.equal(fillFraction(0, 200), 0);
assert.ok(Math.abs(fillFraction(200, 200) - (1 - Math.exp(-1))) < 1e-12);

const wide = runSession({
  assetId: "ETH-PERP",
  quoteUsd: 2_000_000,
  halfSpreadBps: 500,
  tauMs: 200,
  slots: 400,
  seed: 7,
  seat: "p95",
});
assert.equal(wide.avoidedUsd, 0);

const tight = runSession({
  assetId: "ETH-PERP",
  quoteUsd: 2_000_000,
  halfSpreadBps: 3.5,
  tauMs: 200,
  slots: 600,
  seed: 20261027,
  seat: "p95",
});
const mix = runSession({
  assetId: "ETH-PERP",
  quoteUsd: 2_000_000,
  halfSpreadBps: 3.5,
  tauMs: 200,
  slots: 600,
  seed: 20261027,
  seat: "mix",
});

assert.ok(tight.avoidedUsd > mix.avoidedUsd);
assert.ok(tight.crossing.length > 0);
assert.ok(tight.prints.every((print) => print.leadMs === 280));
assert.ok(mix.prints.some((print) => print.leadMs !== mix.prints[0].leadMs));

const again = runSession({
  assetId: "ETH-PERP",
  quoteUsd: 2_000_000,
  halfSpreadBps: 3.5,
  tauMs: 200,
  slots: 600,
  seed: 20261027,
  seat: "mix",
});
assert.equal(again.avoidedUsd, mix.avoidedUsd);

console.log(
  JSON.stringify({
    mixUsd: Math.round(mix.avoidedUsd),
    p95Usd: Math.round(tight.avoidedUsd),
    crosses: tight.crossing.length,
    perMillionPerHour: Math.round(tight.perMillionPerHour),
  }),
);
