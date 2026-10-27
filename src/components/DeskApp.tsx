"use client";

import { useEffect, useMemo, useState } from "react";
import { bps, ms, pct, px, usd, usdExact } from "@/lib/format";
import {
  ASSETS,
  cumulative,
  runSession,
  SESSIONS,
  type AssetId,
  type Print,
  type SessionId,
} from "@/lib/model";
import { PUBLISHED, type SeatId } from "@/lib/published";

const SEATS: { id: SeatId; label: string; detail: string }[] = [
  { id: "mix", label: "Published mix", detail: "A seat drawn across the coverage curve" },
  { id: "p50", label: "50% · 70 ms", detail: "Median observer" },
  { id: "p75", label: "75% · 124 ms", detail: "Three quarters of observers" },
  { id: "p80", label: "80% · 135 ms", detail: "Published 80% point" },
  { id: "p95", label: "95% · 280 ms", detail: "The headline arrival lead" },
];

export function DeskApp() {
  const [assetId, setAssetId] = useState<AssetId>("ETH-PERP");
  const [quoteUsd, setQuoteUsd] = useState(ASSETS["ETH-PERP"].quoteUsd);
  const [halfSpreadBps, setHalfSpreadBps] = useState(ASSETS["ETH-PERP"].halfSpreadBps);
  const [tauMs, setTauMs] = useState(1200);
  const [sessionId, setSessionId] = useState<SessionId>("2h");
  const [seat, setSeat] = useState<SeatId>("mix");
  const [seed, setSeed] = useState(20261027);
  const [selected, setSelected] = useState(0);
  const [walking, setWalking] = useState(false);

  const slots = SESSIONS.find((item) => item.id === sessionId)?.slots ?? 600;
  const asset = ASSETS[assetId];

  const session = useMemo(
    () =>
      runSession({
        assetId,
        quoteUsd,
        halfSpreadBps,
        tauMs,
        slots,
        seed,
        seat,
      }),
    [assetId, quoteUsd, halfSpreadBps, tauMs, slots, seed, seat],
  );

  const series = useMemo(() => cumulative(session.prints), [session]);
  const shown = [...session.crossing]
    .sort((a, b) => b.avoidedUsd - a.avoidedUsd)
    .slice(0, 12);
  const active =
    session.crossing.find((print) => print.index === selected) ??
    session.crossing[0] ??
    null;

  useEffect(() => {
    const top = [...session.crossing].sort((a, b) => b.avoidedUsd - a.avoidedUsd)[0];
    setSelected(top?.index ?? 0);
    setWalking(false);
  }, [session]);

  useEffect(() => {
    if (!walking || session.crossing.length === 0) return;
    const timer = window.setInterval(() => {
      setSelected((current) => {
        const ids = session.crossing.map((print) => print.index);
        const at = ids.indexOf(current);
        return ids[(at + 1) % ids.length];
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [walking, session]);

  function chooseAsset(next: AssetId) {
    const book = ASSETS[next];
    setAssetId(next);
    setQuoteUsd(book.quoteUsd);
    setHalfSpreadBps(book.halfSpreadBps);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="text-center">
        <div className="inline-flex items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-[0_8px_30px_rgba(22,32,48,0.08)]">
          <Mark />
          <span className="text-[15px] font-semibold tracking-tight">optimum</span>
          <span className="h-4 w-px bg-line" />
          <span className="font-mono text-[11px] tracking-[0.16em] text-muted">SIGNAL</span>
        </div>
        <h1 className="mx-auto mt-8 max-w-xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          The quote comes off when the block arrives.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
          For a desk that quotes off the Ethereum head. Optimum Signal gets the block
          there first, so the old price is already gone.
        </p>
        <p className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-xs text-muted shadow-sm">
          A seeded book, so you can see one session
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Fact
          label="Arrival lead, 95% of observers"
          value={ms(PUBLISHED.arrivalLeadMs)}
          note={`±${PUBLISHED.arrivalLeadCiMs} ms · from slot start, Optimum ${ms(PUBLISHED.arrivalOptimumMs)} vs gossip ${ms(PUBLISHED.arrivalGossipMs)}`}
        />
        <Fact
          label="Propagation after first seen"
          value={`${PUBLISHED.spreadFactor.toFixed(2)}×`}
          note={`mump2p ${ms(PUBLISHED.spreadOptimumMs)} · gossip ${ms(PUBLISHED.spreadGossipMs)}`}
        />
        <Fact
          label="Slots accelerated"
          value={`${PUBLISHED.slotsAcceleratedPct}%`}
          note={`${PUBLISHED.slots.toLocaleString("en-US")} mainnet slots · ${PUBLISHED.windowLabel}`}
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="h-fit space-y-6 rounded-3xl border border-line bg-white p-5 shadow-[0_12px_40px_rgba(22,32,48,0.06)]">
          <fieldset>
            <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Book
            </legend>
            <div className="mt-3 grid gap-2">
              {(Object.keys(ASSETS) as AssetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => chooseAsset(id)}
                  className={`rounded-2xl border px-3 py-2.5 text-left shadow-sm ${
                    assetId === id
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink/20"
                  }`}
                >
                  <span className="block text-sm font-medium">{ASSETS[id].label}</span>
                  <span className={`mt-0.5 block text-xs ${assetId === id ? "text-white/70" : "text-muted"}`}>
                    {ASSETS[id].mark}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <Slider
            label="Size per side"
            value={usd(quoteUsd)}
            min={250_000}
            max={20_000_000}
            step={250_000}
            current={quoteUsd}
            onChange={setQuoteUsd}
          />
          <Slider
            label="Half spread"
            value={`${halfSpreadBps.toFixed(1)} bp`}
            min={0.2}
            max={12}
            step={0.1}
            current={halfSpreadBps}
            onChange={setHalfSpreadBps}
          />
          <Slider
            label="Lift time on a stale quote"
            value={ms(tauMs)}
            min={200}
            max={3000}
            step={50}
            current={tauMs}
            onChange={setTauMs}
          />

          <fieldset>
            <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Where this desk sits
            </legend>
            <div className="mt-3 grid gap-1.5">
              {SEATS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSeat(item.id)}
                  className={`rounded-full border px-3 py-1.5 text-left text-sm ${
                    seat === item.id
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink/20"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Session
            </legend>
            <div className="mt-3 flex gap-2">
              {SESSIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSessionId(item.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm shadow-sm ${
                    sessionId === item.id
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white hover:border-ink/20"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSeed((value) => value + 1)}
              className="mt-3 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
            >
              New seed
            </button>
          </fieldset>
        </aside>

        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Pickoff the quote no longer wears"
              value={usdExact(session.avoidedUsd)}
              note={`${usdExact(session.perMillionPerHour)} per $1M of size, per hour, if the session repeated`}
            />
            <Metric
              label="Prints through the spread"
              value={session.crossing.length.toLocaleString("en-US")}
              note={`of ${session.prints.length.toLocaleString("en-US")} slots · median lead ${ms(session.medianLeadOnCrossesMs)}`}
            />
            <Metric
              label="Share from leads of 200 ms or more"
              value={pct(session.tailShare)}
              note="The slow coverage tail is where the size gets lifted"
            />
          </section>

          <Chart series={series} hours={session.hours} />

          <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_12px_40px_rgba(22,32,48,0.06)]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="text-sm font-medium">Prints that crossed the half spread</h2>
              <button
                type="button"
                onClick={() => setWalking((value) => !value)}
                disabled={session.crossing.length === 0}
                className="rounded-full bg-ink px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                {walking ? "Pause" : "Walk the tape"}
              </button>
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted">
                This spread contains every move in the session. Tighten it, or sit the
                desk further along the coverage curve, and the lead starts to change fills.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-2 font-normal">Slot</th>
                      <th className="px-3 py-2 font-normal">Move</th>
                      <th className="px-3 py-2 font-normal">Lead</th>
                      <th className="px-3 py-2 font-normal">Stale side</th>
                      <th className="px-3 py-2 font-normal">Lifted</th>
                      <th className="px-4 py-2 text-right font-normal">Kept</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((print) => (
                      <tr
                        key={print.index}
                        onClick={() => {
                          setWalking(false);
                          setSelected(print.index);
                        }}
                        className={`cursor-pointer border-t border-line ${
                          active?.index === print.index ? "bg-panel-2" : "hover:bg-panel-2/60"
                        }`}
                      >
                        <td className="px-4 py-2 font-mono text-xs text-muted">
                          {print.slot.toLocaleString("en-US")}
                        </td>
                        <td className="px-3 py-2 font-mono">{bps(print.jumpBps)}</td>
                        <td className="px-3 py-2 font-mono">{ms(print.leadMs)}</td>
                        <td className="px-3 py-2 capitalize">{print.side}</td>
                        <td className="px-3 py-2 font-mono">{pct(print.fillFraction)}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {usdExact(print.avoidedUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {session.crossing.length > shown.length && (
              <p className="border-t border-line px-4 py-2 font-mono text-[11px] text-muted">
                Largest {shown.length} prints by dollars kept. The walk follows the session in time.
                Totals use all {session.crossing.length} crossing prints.
              </p>
            )}
          </section>

          {active && (
            <PrintDetail
              print={active}
              digits={asset.digits}
              halfSpreadBps={halfSpreadBps}
              quoteUsd={quoteUsd}
            />
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 border-t border-line pt-6 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium">What the desk is buying</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A block moves fair value. Until the desk&apos;s node has that block, the resting
            bid or offer is an option the market can lift. mump2p&apos;s decode rule finishes
            the message from any sufficient set of shards, which is why the published mesh
            reaches observers earlier. First Print prices one use of that: cancel the side
            that just went through, on the decode, instead of when gossip completes.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium">How a print is priced</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Quiet slots move with a small standard deviation. A minority of slots draw a
            larger jump. The old quote is through when the jump exceeds the half spread.
            The lifted share is 1 − e^(−lead / lift time). At a lift time of 1.2 seconds, a 280 ms lead lifts about a fifth of the size and a 70 ms lead lifts about 6%. Gossip wears that fill for the
            whole lead. The mump2p quote is already off, so its pickoff on that window is
            zero. Leads below the published 50% point are drawn on a line from 0 ms to
            70 ms, and leads past 95% stay at 280 ms. The 87.2% acceleration rate is shown
            above and is not applied a second time.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Jump sizes are a scenario for this pilot, not a fit to a named venue. Lead
            times are the{" "}
            <a
              className="text-ink underline decoration-line underline-offset-4"
              href={PUBLISHED.source}
            >
              {PUBLISHED.sourceLabel}
            </a>{" "}
            for {PUBLISHED.windowLabel}. Reaction time after decode is shared by both feeds
            and does not change the difference.
          </p>
        </div>
      </section>
    </main>
  );
}

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#16181d" />
      <path
        d="M8.5 16c0-2.4 1.7-4 3.6-4 1.6 0 2.6.9 3.9 2.5C17.3 12.9 18.3 12 19.9 12c1.9 0 3.6 1.6 3.6 4s-1.7 4-3.6 4c-1.6 0-2.6-.9-3.9-2.5C14.7 19.1 13.7 20 12.1 20c-1.9 0-3.6-1.6-3.6-4z"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-3xl border border-line bg-white px-4 py-4 shadow-[0_12px_40px_rgba(22,32,48,0.06)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl text-ink">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{note}</p>
    </article>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-3xl border border-line bg-white px-4 py-4 shadow-[0_12px_40px_rgba(22,32,48,0.06)]">
      <p className="text-xs leading-snug text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl text-ink">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{note}</p>
    </article>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
        <span className="text-ink">{value}</span>
      </span>
      <input
        className="mt-2 w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Chart({ series, hours }: { series: number[]; hours: number }) {
  const width = 640;
  const height = 140;
  const pad = 8;
  const max = Math.max(1, ...series);
  const last = series[series.length - 1] ?? 0;
  const points = series
    .map((value, index) => {
      const x = pad + (index / Math.max(1, series.length - 1)) * (width - pad * 2);
      const y = height - pad - (value / max) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <section className="rounded-3xl border border-line bg-white px-4 py-4 shadow-[0_12px_40px_rgba(22,32,48,0.06)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Avoided pickoff, cumulative</h2>
        <p className="font-mono text-xs text-muted">
          {usdExact(last)} · {hours.toFixed(1)} h
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-36 w-full" role="img" aria-label="Cumulative avoided pickoff">
        <polyline fill="none" stroke="#16181d" strokeWidth="2" points={points} />
      </svg>
    </section>
  );
}

function PrintDetail({
  print,
  digits,
  halfSpreadBps,
  quoteUsd,
}: {
  print: Print;
  digits: number;
  halfSpreadBps: number;
  quoteUsd: number;
}) {
  const half = print.mid * (halfSpreadBps / 10_000);
  const bid = print.mid - half;
  const offer = print.mid + half;
  const newHalf = print.newMid * (halfSpreadBps / 10_000);
  const stalePx = print.side === "offer" ? offer : bid;

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <article className="rounded-3xl border border-line bg-white p-5 shadow-[0_12px_40px_rgba(22,32,48,0.06)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Standard gossip
        </p>
        <h3 className="mt-1 text-lg font-medium">Still showing the old {print.side}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The message is still completing. For {ms(print.leadMs)} the {print.side} at{" "}
          {px(stalePx, digits)} is through the new fair {px(print.newMid, digits)} by{" "}
          {bps(print.edgeBps)}. Takers lift {pct(print.fillFraction)} of the{" "}
          {usd(quoteUsd)} size.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted">Bid</dt>
            <dd>{px(bid, digits)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted">Offer</dt>
            <dd>{px(offer, digits)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted">Pickoff</dt>
            <dd className="text-danger">{usdExact(print.avoidedUsd)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted">Move</dt>
            <dd>{bps(print.jumpBps)}</dd>
          </div>
        </dl>
      </article>

      <article className="rounded-3xl bg-ink p-5 text-white shadow-[0_12px_40px_rgba(22,32,48,0.12)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
          Optimum Signal
        </p>
        <h3 className="mt-1 text-lg font-medium">Decoded. That side is off.</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          Enough shards have arrived to decode, {ms(print.leadMs)} before gossip finishes
          the same block. The {print.side} is pulled for that window. When the quote
          returns it is around the new mid {px(print.newMid, digits)}, half a spread
          ({px(newHalf, digits)}) off that mid, so it is no longer through.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-white/50">New bid</dt>
            <dd>{px(print.newMid - newHalf, digits)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-white/50">New offer</dt>
            <dd>{px(print.newMid + newHalf, digits)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-white/50">Pickoff</dt>
            <dd>$0</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-white/50">Kept</dt>
            <dd>{usdExact(print.avoidedUsd)}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}
