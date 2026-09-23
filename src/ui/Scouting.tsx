import { useState } from "react";
import type { AttrKey, Player, Position, Scout } from "@/engine";
import {
  DISCOVERY_LEVEL,
  KNOWLEDGE_FULL,
  REQUEST_COST,
  estimateFor,
  ovrRange20,
  to20ovr,
  formOf,
  knowledgeOf,
  money,
  overallFor,
  rating1,
  squadOf
} from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";
import { posChip } from "@/ui/format";

const tierLabel = (t: string, level: number): string =>
  t === "extensive"
    ? "Extensive"
    : t === "detailed"
      ? "Detailed"
      : t === "brief"
        ? "Brief"
        : "No report";

export const starTint = (s: number): string =>
  s >= 4 ? "#2ED573" : s >= 3 ? "#7BE495" : s >= 2.5 ? "#FFB020" : "#FF6B6B";

export function Stars({ value, range }: { value: number | null; range?: [number, number] | null }) {
  if (value === null) return <span className="text-[10px] text-muted-foreground">unscouted</span>;
  const lo = range ? range[0] : value;
  const hi = range ? range[1] : value;
  const text = lo === hi ? `${value.toFixed(1)}★` : `${lo.toFixed(1)}–${hi.toFixed(1)}★`;
  return (
    <span className="rounded px-1 py-0.5 text-[10px] font-bold tnum" style={{ background: `${starTint(value)}22`, color: starTint(value) }}>
      {text}
    </span>
  );
}

function KnowledgeBar({ level }: { level: number }) {
  const tint = level >= KNOWLEDGE_FULL ? "#2ED573" : level >= 50 ? "#FFB020" : "#8B98A5";
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1 w-12 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full" style={{ width: `${level}%`, background: tint }} />
      </span>
      <span className="w-16 text-right text-[10px] font-bold tnum" style={{ color: tint }}>
        {tierLabel(level >= KNOWLEDGE_FULL ? "extensive" : level >= 50 ? "detailed" : level >= DISCOVERY_LEVEL ? "brief" : "none", level)}
      </span>
    </span>
  );
}

const ScoutStars = ({ n, label }: { n: number; label: string }) => (
  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
    {label}
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="h-1.5 w-3 rounded-sm"
          style={{
            background: n >= i * 20 ? starTint(Math.min(5, (n / 100) * 5)) : "var(--secondary)"
          }}
        />
      ))}
    </span>
  </span>
);

export function ScoutingView({ onOpenPlayer }: { onOpenPlayer: (id: string) => void }) {
  const game = useGame((s) => s.game)!;
  const scoutPlayer = useGame((s) => s.scoutPlayer);
  const addFocus = useGame((s) => s.addFocus);
  const cancelRequest = useGame((s) => s.cancelRequest);
  const hireScout = useGame((s) => s.hireScout);
  const dismissScout = useGame((s) => s.dismissScout);
  const toggleShortlist = useGame((s) => s.toggleShortlist);
  const topUpScouting = useGame((s) => s.topUpScouting);

  const st = game.scouting;
  const squad = squadOf(game.players, game.userClubId);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [pos, setPos] = useState<Position | "any">("any");
  const [maxAge, setMaxAge] = useState(23);
  const [minPot, setMinPot] = useState(3);
  const [showFocusForm, setShowFocusForm] = useState(false);

  const playerOf = (id: string) => game.players.find((p) => p.id === id);
  const nameOf = (p: Player) => `${p.name} (${p.pos}, ${p.age})`;
  const shortlisted = new Set(st.shortlist);

  const run = (fn: () => string | null, ok: string) => {
    const err = fn();
    setMsg(err ? { text: err, bad: true } : { text: ok, bad: false });
  };

  const Row = ({ p, right }: { p: Player; right: React.ReactNode }) => {
    const est = estimateFor(game, p);
    const club = game.clubs.find((c) => c.id === p.clubId);
    const f = formOf(p);
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
        <button className="min-w-0 flex-1 text-left" data-testid={`scout-row-${p.id}`} onClick={() => onOpenPlayer(p.id)}>
          <span className="flex items-center gap-1.5">
            <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${posChip[p.pos]}`}>{p.pos}</span>
            <span className="truncate text-sm font-semibold">{p.name}</span>
            <Stars value={est.stars} range={est.starsRange} />
            {f !== null && <span className="text-[10px] text-muted-foreground tnum">{rating1(f)} form</span>}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground tnum">
            {club ? club.name : "Free agent"} · age {p.age}
            {est.exactOvr !== null
              ? ` · OVR ${to20ovr(est.exactOvr)} / POT ${to20ovr(est.exactPot ?? est.exactOvr)}`
              : est.ovrRange
                ? ` · OVR ~${ovrRange20(est.ovrRange[0], est.ovrRange[1])}`
                : est.tier === "none"
                  ? " · no report"
                  : " · early read"}
            {est.valueRange ? ` · ${money(est.valueRange[0])}–${money(est.valueRange[1])}` : ""}
          </span>
        </button>
        {right}
      </div>
    );
  };

  const reportPlayers = st.reports.map(playerOf).filter((p): p is Player => !!p && p.clubId !== game.userClubId);

  return (
    <div className="space-y-5" data-testid="scouting-view">
      {msg && (
        <p className={`text-[11px] font-semibold ${msg.bad ? "text-[var(--danger)]" : "text-primary"}`} data-testid="scout-msg">
          {msg.text}
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-3" data-testid="scout-budget">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Scouting budget</div>
            <div className="text-lg font-extrabold tnum">{money(st.budget)}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-11"
            data-testid="scout-topup"
            onClick={() => run(() => topUpScouting(250_000), "£250k moved into scouting.")}
          >
            Top up £250k
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Reports cost {money(REQUEST_COST.player)}/round each; focuses {money(REQUEST_COST.focus)}/round.
          Jobs pause when the budget runs dry; it refreshes each pre-season.
        </p>
      </div>

      <section className="space-y-2" data-testid="scout-requests">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Assignments</h2>
          <Button size="sm" variant="outline" className="h-11" data-testid="scout-new-focus" onClick={() => setShowFocusForm((v) => !v)}>
            {showFocusForm ? "Close" : "New focus"}
          </Button>
        </div>

        {showFocusForm && (
          <div className="space-y-2 rounded-xl border border-border bg-card p-3" data-testid="scout-focus-form">
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Position
                <select
                  data-testid="focus-pos"
                  value={pos}
                  onChange={(e) => setPos(e.target.value as Position | "any")}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-2 text-sm font-semibold"
                >
                  <option value="any">Any</option>
                  <option value="GK">GK</option>
                  <option value="DF">DF</option>
                  <option value="MF">MF</option>
                  <option value="FW">FW</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Max age
                <input
                  data-testid="focus-age"
                  type="number"
                  value={maxAge}
                  min={16}
                  max={40}
                  onChange={(e) => setMaxAge(Number(e.target.value) || 23)}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-2 text-sm font-bold tnum"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Min potential
                <select
                  data-testid="focus-pot"
                  value={minPot}
                  onChange={(e) => setMinPot(Number(e.target.value))}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-2 text-sm font-semibold"
                >
                  {[1.5, 2, 2.5, 3, 3.5, 4, 4.5].map((v) => (
                    <option key={v} value={v}>
                      {v}★
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button
              className="h-11 w-full"
              data-testid="focus-start"
              onClick={() =>
                run(
                  () => addFocus({ pos, maxAge, minPotStars: minPot }),
                  "Focus started — reports will come in each round."
                )
              }
            >
              Start focus (uses a free scout)
            </Button>
          </div>
        )}

        {st.requests.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
            No assignments running. Start a focus or scout a specific player from the Market tab.
          </p>
        )}
        {st.requests.map((r) => {
          const scout = st.scouts.find((s) => s.id === r.scoutId);
          if (r.kind === "player") {
            const p = playerOf(r.playerId);
            if (!p) return null;
            const level = knowledgeOf(game, p.id);
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3" data-testid={`request-${r.id}`}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {scout?.name ?? "Scout"} · full report · {level}%
                  </div>
                  <span className="mt-1 block h-1 w-28 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${level}%` }} />
                  </span>
                </div>
                <Button size="sm" variant="outline" className="h-11 shrink-0" onClick={() => cancelRequest(r.id)}>
                  Cancel
                </Button>
              </div>
            );
          }
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3" data-testid={`request-${r.id}`}>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  Focus: {r.pos === "any" ? "any position" : r.pos} · ≤{r.maxAge}y · {r.minPotStars}★+
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {scout?.name ?? "Scout"} · a new name each round, top leads polished
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-11 shrink-0" onClick={() => cancelRequest(r.id)}>
                Cancel
              </Button>
            </div>
          );
        })}
      </section>

      <section className="space-y-2" data-testid="scout-inbox">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Report inbox {reportPlayers.length > 0 && `· ${reportPlayers.length}`}
        </h2>
        {reportPlayers.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
            Nothing new. Reports land here when a focus finds someone or a full report completes.
          </p>
        )}
        {reportPlayers.slice(0, 8).map((p) => (
          <Row
            key={p.id}
            p={p}
            right={
              <span className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11"
                  data-testid={`inbox-scout-${p.id}`}
                  onClick={() => run(() => scoutPlayer(p.id), `${p.name}: report queued.`)}
                >
                  Scout
                </Button>
                <Button
                  size="sm"
                  variant={shortlisted.has(p.id) ? "secondary" : "outline"}
                  className="h-11"
                  data-testid={`inbox-star-${p.id}`}
                  onClick={() => toggleShortlist(p.id)}
                >
                  ★
                </Button>
              </span>
            }
          />
        ))}
      </section>

      <section className="space-y-2" data-testid="scout-shortlist">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Shortlist {st.shortlist.length > 0 && `· ${st.shortlist.length}`}
        </h2>
        {st.shortlist.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
            Star players anywhere (inbox, market, player sheet) to keep an eye on them — shortlisted
            players get a slow trickle of fresh reports.
          </p>
        )}
        {st.shortlist.slice(0, 8).map((id) => {
          const p = playerOf(id);
          if (!p) return null;
          return (
            <Row
              key={id}
              p={p}
              right={
                <span className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="outline" className="h-11" onClick={() => run(() => scoutPlayer(id), `${p.name}: report queued.`)}>
                    Scout
                  </Button>
                  <Button size="sm" variant="secondary" className="h-11" onClick={() => toggleShortlist(id)}>
                    ★
                  </Button>
                </span>
              }
            />
          );
        })}
      </section>

      <section className="space-y-2" data-testid="scout-staff">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Scouts</h2>
        {st.scouts.map((s: Scout) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3" data-testid={`scout-${s.id}`}>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{s.name}</div>
              <div className="flex flex-wrap gap-3 pt-0.5">
                <ScoutStars n={s.judging} label="Judging" />
                <ScoutStars n={Math.round((s.speed - 0.7) * 333)} label="Pace" />
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-11 shrink-0" data-testid={`dismiss-${s.id}`} onClick={() => dismissScout(s.id)}>
              Dismiss
            </Button>
          </div>
        ))}
        {st.pool.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-card p-3" data-testid={`candidate-${s.id}`}>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">
                {s.name} <span className="text-[10px] font-semibold text-muted-foreground">· fee {money(s.fee)}</span>
              </div>
              <div className="flex flex-wrap gap-3 pt-0.5">
                <ScoutStars n={s.judging} label="Judging" />
                <ScoutStars n={Math.round((s.speed - 0.7) * 333)} label="Pace" />
              </div>
            </div>
            <Button size="sm" className="h-11 shrink-0" data-testid={`hire-${s.id}`} onClick={() => run(() => hireScout(s.id), `${s.name} joins the scouting team.`)}>
              Hire
            </Button>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">How scouting works</h2>
        <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
          <li>
            <span className="font-bold text-foreground">Brief</span> (25+): star ratings with a wide range —
            enough to shortlist.
          </li>
          <li>
            <span className="font-bold text-foreground">Detailed</span> (50+): attribute and value ranges,
            potential stars.
          </li>
          <li>
            <span className="font-bold text-foreground">Extensive</span> (75+): exact ability, potential,
            wages and traits.
          </li>
          <li>Better scouts (Judging) give tighter, less biased reports. Knowledge fades when nobody watches.</li>
        </ul>
      </section>
    </div>
  );
}
