import { useMemo } from "react";
import { computeTable, type MatchShot } from "@/engine";
import { useGame } from "@/state/store";

const W = 300;
const H = 190;
const PAD = 10;

/** Half-pitch: y 0 (top) is the goal being attacked. */
const px = (x: number) => PAD + (x / 100) * (W - PAD * 2);
const py = (y: number) => PAD + (y / 100) * (H - PAD * 2);

const shotColor = (out: MatchShot["out"]): string =>
  out === "goal" ? "#2ED573" : out === "save" ? "#FFB020" : out === "block" ? "#7EC8FF" : "#FF6B6B";

const outLabel = (out: MatchShot["out"]): string =>
  out === "goal" ? "goal" : out === "save" ? "saved" : out === "block" ? "blocked" : "off target";

export function DataHub() {
  const game = useGame((s) => s.game)!;
  const last = game.lastUserMatch;
  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const table = computeTable(game.fixtures, game.clubs);
  const row = table.find((r) => r.clubId === club.id);

  const shots = last?.shots ?? [];
  const home = last ? last.homeId === game.userClubId : true;
  const mineShots = shots.filter((s) => s.home === home);
  const theirsShots = shots.filter((s) => s.home !== home);
  const xg = (list: MatchShot[]) => Math.round(list.reduce((a, s) => a + s.xg, 0) * 100) / 100;

  // cumulative xG by minute for the timeline
  const timeline = useMemo(() => {
    if (!last) return { mine: "", theirs: "", maxMinute: 90 };
    const maxMinute = Math.max(90, ...shots.map((s) => s.m));
    const build = (isHome: boolean) => {
      let acc = 0;
      const pts: string[] = [`0,${H - PAD}`];
      for (const s of shots.filter((x) => x.home === isHome).sort((a, b) => a.m - b.m)) {
        acc += s.xg;
        pts.push(`${(s.m / maxMinute) * (W - PAD * 2) + PAD},${H - PAD - Math.min(1, acc / 3) * (H - PAD * 2)}`);
      }
      pts.push(`${W - PAD},${H - PAD - Math.min(1, acc / 3) * (H - PAD * 2)}`);
      return pts.join(" ");
    };
    return { mine: build(home), theirs: build(!home), maxMinute };
  }, [last, shots, home]);

  // season shape: goals for/against per round played
  const played = game.fixtures
    .filter((f) => f.played && (f.homeId === club.id || f.awayId === club.id))
    .sort((a, b) => a.round - b.round);

  return (
    <div className="space-y-4" data-testid="data-view">
      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Last match</h2>
        {!last ? (
          <p className="mt-2 text-[11px] text-muted-foreground">No match played yet — the shot map lands here after your first game.</p>
        ) : (
          <>
            <div className="mt-1 flex items-center justify-between text-sm font-bold">
              <span>
                {game.clubs.find((c) => c.id === last.homeId)?.short} {last.homeGoals}–{last.awayGoals}{" "}
                {game.clubs.find((c) => c.id === last.awayId)?.short}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground tnum">
                xG {xg(mineShots).toFixed(2)} – {xg(theirsShots).toFixed(2)}
              </span>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full rounded-lg bg-[#0B1116]" data-testid="shot-map" role="img" aria-label="Shot map">
              <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" stroke="#1E2A33" strokeWidth="1.5" />
              <line x1={PAD} y1={PAD + (H - PAD * 2) / 2} x2={W - PAD} y2={PAD + (H - PAD * 2) / 2} stroke="#1E2A33" strokeWidth="1" />
              <circle cx={W / 2} cy={PAD + (H - PAD * 2) / 2} r="14" fill="none" stroke="#1E2A33" strokeWidth="1" />
              {/* the goal being attacked */}
              <rect x={W / 2 - 26} y={PAD - 6} width="52" height="6" fill="#2ED573" opacity="0.5" />
              <rect x={W / 2 - 44} y={PAD} width="88" height="26" fill="none" stroke="#1E2A33" strokeWidth="1" />
              {shots.map((s, i) => {
                const cx = s.home === home ? px(100 - s.x) : px(s.x);
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={py(s.y)}
                    r={3 + s.xg * 9}
                    fill={shotColor(s.out)}
                    opacity={s.home === home ? 0.9 : 0.55}
                    stroke={s.home === home ? "#0B1116" : "#FF6B6B"}
                    strokeWidth={s.home === home ? 1 : 1.5}
                  />
                );
              })}
            </svg>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Dot size = expected goals (a big dot is a big chance). Solid dots are yours ({club.short}), outlined
              are theirs. Green scored, amber saved, blue blocked, red off target.
            </p>

            <div className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">xG timeline</div>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full rounded-lg bg-[#0B1116]" data-testid="xg-timeline" role="img" aria-label="Expected goals timeline">
                {[0.5, 1, 1.5, 2, 2.5, 3].map((v) => (
                  <line
                    key={v}
                    x1={PAD}
                    y1={H - PAD - (v / 3) * (H - PAD * 2)}
                    x2={W - PAD}
                    y2={H - PAD - (v / 3) * (H - PAD * 2)}
                    stroke="#1E2A33"
                    strokeWidth="1"
                  />
                ))}
                <polyline points={timeline.theirs} fill="none" stroke="#FF6B6B" strokeWidth="2" strokeDasharray="4 3" />
                <polyline points={timeline.mine} fill="none" stroke="#2ED573" strokeWidth="2.5" />
              </svg>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Cumulative expected goals: you in green, them in red. Gridlines every half an xG.
              </p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Your season</h2>
        <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground tnum">
          <span>
            {row ? `${row.w}W ${row.d}D ${row.l}L · ${row.pts} pts` : "—"}
          </span>
          <span>▲{row?.gf ?? 0} ▼{row?.ga ?? 0}</span>
        </div>
        <div className="mt-2 flex items-end gap-1" data-testid="season-bars">
          {played.map((f) => {
            const isHome = f.homeId === club.id;
            const gf = (isHome ? f.homeGoals : f.awayGoals) ?? 0;
            const ga = (isHome ? f.awayGoals : f.homeGoals) ?? 0;
            const tint = gf > ga ? "#2ED573" : gf === ga ? "#8B98A5" : "#FF6B6B";
            return (
              <div key={f.round} className="flex min-w-0 flex-1 flex-col items-center gap-0.5" title={`R${f.round}: ${gf}–${ga}`}>
                <div className="flex h-14 w-full items-end justify-center gap-[2px]">
                  <span className="w-1/2 rounded-t" style={{ height: `${Math.min(100, gf * 22)}%`, background: tint }} />
                  <span className="w-1/2 rounded-t bg-muted" style={{ height: `${Math.min(100, ga * 22)}%` }} />
                </div>
                <span className="text-[8px] font-bold text-muted-foreground tnum">{f.round}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Goals for (coloured by result) and against (grey) each round.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Shots taken</h2>
        <div className="mt-1 grid grid-cols-2 gap-3 text-sm font-bold tnum">
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">{club.short}</div>
            <div>{mineShots.length} shots</div>
            <div className="text-[11px] font-semibold text-muted-foreground tnum">
              {mineShots.filter((s) => s.out === "goal").length} goals · {xg(mineShots).toFixed(2)} xG
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">Opponents</div>
            <div>{theirsShots.length} shots</div>
            <div className="text-[11px] font-semibold text-muted-foreground tnum">
              {theirsShots.filter((s) => s.out === "goal").length} goals · {xg(theirsShots).toFixed(2)} xG
            </div>
          </div>
        </div>
        {last && (
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {shots
              .slice()
              .sort((a, b) => b.xg - a.xg)
              .slice(0, 4)
              .map((s, i) => (
                <li key={i} className="tnum">
                  {s.m}&#39; — {s.home === home ? club.short : "them"} {outLabel(s.out)} ({s.xg.toFixed(2)} xG)
                  {s.setPiece ? ` · ${s.setPiece}` : ""}
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
