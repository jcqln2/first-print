/**
 * Figures copied from the DefiLlama investor page for Optimum.
 * Window: last 6 full UTC days, 21–26 Oct 2026, 43,114 Ethereum mainnet slots.
 * https://investors.defillama.com/optimum
 *
 * These are Optimum's published comparisons of mump2p against Ethereum
 * standard gossip. This app does not remeasure them.
 */
export const PUBLISHED = {
  source: "https://investors.defillama.com/optimum",
  sourceLabel: "DefiLlama investor page",
  windowLabel: "21–26 Oct 2026 UTC",
  slots: 43_114,
  /** Time for the block to reach 95% of observers, from slot start. */
  arrivalOptimumMs: 1_963,
  arrivalGossipMs: 2_242,
  /** Headline arrival lead. Same 280 ms as the 95% coverage point. */
  arrivalLeadMs: 280,
  arrivalLeadCiMs: 5.2,
  /** Spread after the first observation. */
  spreadOptimumMs: 132,
  spreadGossipMs: 419,
  spreadFactor: 3.18,
  slotsAcceleratedPct: 87.2,
  coverage: [
    { id: "p50", share: 0.5, leadMs: 70, label: "50% of observers" },
    { id: "p75", share: 0.75, leadMs: 124, label: "75% of observers" },
    { id: "p80", share: 0.8, leadMs: 135, label: "80% of observers" },
    { id: "p95", share: 0.95, leadMs: 280, label: "95% of observers" },
  ],
} as const;

export type SeatId = "mix" | "p50" | "p75" | "p80" | "p95";

/**
 * Lead in milliseconds at quantile q of the observer curve.
 * Published knots are 50/75/80/95. Below 50% the line runs from 0 ms to 70 ms.
 * Above 95% the lead stays at 280 ms. Both stretches are fill-ins, and both
 * keep the session inside the published headline rather than past it.
 */
export function leadAtQuantile(q: number): number {
  const x = Math.min(1, Math.max(0, q));
  const knots = [
    { q: 0, ms: 0 },
    ...PUBLISHED.coverage.map((point) => ({ q: point.share, ms: point.leadMs })),
    { q: 1, ms: PUBLISHED.arrivalLeadMs },
  ];
  for (let i = 1; i < knots.length; i++) {
    const left = knots[i - 1];
    const right = knots[i];
    if (x <= right.q) {
      const span = right.q - left.q;
      const t = span === 0 ? 0 : (x - left.q) / span;
      return left.ms + t * (right.ms - left.ms);
    }
  }
  return PUBLISHED.arrivalLeadMs;
}

export function seatLeadMs(seat: Exclude<SeatId, "mix">): number {
  const point = PUBLISHED.coverage.find((item) => item.id === seat);
  return point ? point.leadMs : PUBLISHED.arrivalLeadMs;
}
