import { leadAtQuantile, seatLeadMs, type SeatId } from "./published";

export type AssetId = "ETH-PERP" | "BTC-PERP" | "stETH";

export interface AssetBook {
  id: AssetId;
  label: string;
  /** What the desk is quoting against. */
  mark: string;
  ref: number;
  digits: number;
  /** Typical quiet-block move, standard deviation in basis points. */
  quietBps: number;
  /** Larger block move, standard deviation in basis points. */
  jumpBps: number;
  /** Share of slots drawn from the larger move. */
  informativeP: number;
  quoteUsd: number;
  halfSpreadBps: number;
}

export const ASSETS: Record<AssetId, AssetBook> = {
  "ETH-PERP": {
    id: "ETH-PERP",
    label: "ETH-PERP",
    mark: "Perp quoted off the ETH head",
    ref: 3420,
    digits: 2,
    quietBps: 1.15,
    jumpBps: 8.5,
    informativeP: 0.08,
    quoteUsd: 2_000_000,
    halfSpreadBps: 3.5,
  },
  "BTC-PERP": {
    id: "BTC-PERP",
    label: "BTC-PERP",
    mark: "Perp quoted off the BTC head",
    ref: 67250,
    digits: 1,
    quietBps: 0.95,
    jumpBps: 7,
    informativeP: 0.07,
    quoteUsd: 5_000_000,
    halfSpreadBps: 2.5,
  },
  stETH: {
    id: "stETH",
    label: "stETH / ETH",
    mark: "Basis quoted off the staking head",
    ref: 1,
    digits: 5,
    quietBps: 0.12,
    jumpBps: 1.6,
    informativeP: 0.05,
    quoteUsd: 8_000_000,
    halfSpreadBps: 0.6,
  },
};

export const SESSIONS = [
  { id: "30m", label: "30 min", slots: 150 },
  { id: "2h", label: "2 hours", slots: 600 },
  { id: "6h", label: "6 hours", slots: 1_800 },
] as const;

export type SessionId = (typeof SESSIONS)[number]["id"];

/** Ethereum slots are 12 seconds. */
export const SLOT_SECONDS = 12;

export interface DeskInput {
  assetId: AssetId;
  quoteUsd: number;
  halfSpreadBps: number;
  /** Time constant of taker flow hitting a stale quote. */
  tauMs: number;
  slots: number;
  seed: number;
  seat: SeatId;
}

export interface Print {
  index: number;
  slot: number;
  mid: number;
  jumpBps: number;
  informative: boolean;
  leadMs: number;
  side: "bid" | "offer";
  /** How far the new fair sits through the stale quote. Zero when the quote still contains it. */
  edgeBps: number;
  /** Share of the displayed size lifted while the gossip quote is still up. */
  fillFraction: number;
  filledUsd: number;
  /** Dollars the gossip quote loses and the mump2p quote does not. */
  avoidedUsd: number;
  newMid: number;
}

export interface Session {
  prints: Print[];
  crossing: Print[];
  avoidedUsd: number;
  filledUsd: number;
  hours: number;
  /** Avoided dollars per $1M of displayed size, per hour. */
  perMillionPerHour: number;
  medianLeadOnCrossesMs: number;
  tailShare: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Share of a stale quote lifted after it has been through the market for `leadMs`. */
export function fillFraction(leadMs: number, tauMs: number): number {
  if (leadMs <= 0 || tauMs <= 0) return 0;
  return 1 - Math.exp(-leadMs / tauMs);
}

export function leadForSlot(seat: SeatId, rng: () => number): number {
  if (seat === "mix") return leadAtQuantile(rng());
  return seatLeadMs(seat);
}

/**
 * One seeded session of a two-sided quote.
 *
 * The block moves the fair. If that move is larger than the half spread, the
 * old bid or offer is through. Takers lift `1 - e^(-lead / tau)` of the size
 * while standard gossip is still showing the old price. The mump2p gateway
 * has already decoded the block, so that quote is off for the whole lead.
 * Cancel latency after decode is the same on both feeds and drops out of the difference.
 */
export function runSession(input: DeskInput): Session {
  const asset = ASSETS[input.assetId];
  const rng = mulberry32(input.seed);
  const prints: Print[] = [];
  let mid = asset.ref;
  let avoidedUsd = 0;
  let filledUsd = 0;
  const slotBase = 13_480_000;

  for (let index = 0; index < input.slots; index++) {
    const informative = rng() < asset.informativeP;
    const scale = informative ? asset.jumpBps : asset.quietBps;
    const jumpBps = gaussian(rng) * scale;
    const leadMs = leadForSlot(input.seat, rng);
    const edgeBps = Math.max(0, Math.abs(jumpBps) - input.halfSpreadBps);
    const fraction = edgeBps > 0 ? fillFraction(leadMs, input.tauMs) : 0;
    const filled = input.quoteUsd * fraction;
    const avoided = filled * (edgeBps / 10_000);
    const newMid = mid * (1 + jumpBps / 10_000);

    const print: Print = {
      index,
      slot: slotBase + index,
      mid,
      jumpBps,
      informative,
      leadMs,
      side: jumpBps >= 0 ? "offer" : "bid",
      edgeBps,
      fillFraction: fraction,
      filledUsd: filled,
      avoidedUsd: avoided,
      newMid,
    };
    prints.push(print);
    avoidedUsd += avoided;
    filledUsd += filled;
    mid = newMid;
  }

  const crossing = prints.filter((print) => print.edgeBps > 0);
  const hours = (input.slots * SLOT_SECONDS) / 3600;
  const leads = crossing.map((print) => print.leadMs).sort((a, b) => a - b);
  const medianLeadOnCrossesMs = leads.length === 0 ? 0 : leads[Math.floor(leads.length / 2)];
  const tailUsd = crossing
    .filter((print) => print.leadMs >= 200)
    .reduce((sum, print) => sum + print.avoidedUsd, 0);

  return {
    prints,
    crossing,
    avoidedUsd,
    filledUsd,
    hours,
    perMillionPerHour:
      input.quoteUsd > 0 && hours > 0
        ? avoidedUsd / (input.quoteUsd / 1_000_000) / hours
        : 0,
    medianLeadOnCrossesMs,
    tailShare: avoidedUsd > 0 ? tailUsd / avoidedUsd : 0,
  };
}

export function cumulative(prints: Print[]): number[] {
  const series: number[] = [];
  let total = 0;
  for (const print of prints) {
    total += print.avoidedUsd;
    series.push(total);
  }
  return series;
}
