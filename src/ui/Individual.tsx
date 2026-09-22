import { useState } from "react";
import type { Player } from "@/engine";
import {
  altPositions,
  canRetrain,
  injuryLine,
  jadedBand,
  jadedOf,
  disciplinaryCases,
  moveOptions,
  moveReqFor,
  overallFor,
  retrainOptions,
  sharpBand,
  sharpnessOf,
  targetLine,
  targetOptions,
  targetSoFar,
  TRAITS
} from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";

const card = "space-y-2 rounded-lg border border-border bg-card p-3";
const head = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

/** Sharpness / wear / caps — the three body numbers that aren't condition. */
export function BodyCard({ player }: { player: Player }) {
  const sharp = sharpnessOf(player);
  const jaded = jadedOf(player);
  const inj = injuryLine(player);
  return (
    <div className={card} data-testid="player-body">
      <div className="flex items-center justify-between">
        <span className={head}>Body</span>
        <span className="text-[10px] font-semibold text-muted-foreground tnum">
          {sharpBand(sharp)} · {jadedBand(jaded)}
          {player.caps ? ` · ${player.caps} cap${player.caps > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-bold text-muted-foreground">Sharp</span>
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${sharp}%`, background: sharp >= 85 ? "#2ED573" : sharp >= 70 ? "#9ACD32" : "#FFB020" }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-[10px] font-bold tnum">{sharp}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-bold text-muted-foreground">Wear</span>
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${jaded}%`, background: jaded <= 35 ? "#2ED573" : jaded <= 60 ? "#FFB020" : "#FF6B6B" }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-[10px] font-bold tnum">{jaded}</span>
        </div>
      </div>
      {inj && (
        <p className="text-[11px] font-semibold text-[#FFB020]" data-testid="player-injury">
          {inj}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Sharp rises with minutes and falls when he sits out — a rusty player {""}
        loses up to 7%. Wear builds when a tired or older player keeps starting, and costs up to 5%
        (plus injury risk) until he rests.
      </p>
    </div>
  );
}

/** The manager's personal target for him this season. */
export function TargetCard({ player }: { player: Player }) {
  const setTarget = useGame((s) => s.setTarget);
  const clearTarget = useGame((s) => s.clearTarget);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const line = targetLine(player);
  const so = targetSoFar(player);
  const options = targetOptions(player);

  return (
    <div className={card} data-testid="player-target">
      <div className="flex items-center justify-between">
        <span className={head}>Season target</span>
        {line && (
          <span className="text-[10px] font-bold text-primary tnum" data-testid="target-line">
            {line}
          </span>
        )}
      </div>
      {so && player.target && (
        <div className="space-y-1">
          <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.round(so.pct * 100)}%`, background: so.pct >= 1 ? "#2ED573" : "#FFB020" }}
            />
          </span>
          <p className="text-[10px] text-muted-foreground">
            {player.target.ambitious ? "Ambitious" : "Achievable"} — meeting it lifts him; missing it costs
            you {player.target.ambitious ? "eight" : "four"} morale points.
          </p>
        </div>
      )}
      {!player.target && !open && (
        <Button
          size="sm"
          variant="outline"
          className="h-11 w-full"
          data-testid="target-open"
          onClick={() => setOpen(true)}
        >
          Set him a target for the season
        </Button>
      )}
      {!player.target && open && (
        <div className="space-y-1.5">
          {options.map((o) => (
            <button
              key={`${o.kind}-${o.value}`}
              data-testid={`target-opt-${o.kind}-${o.value}`}
              onClick={() => {
                const err = setTarget(player.id, o.kind, o.value);
                setNote(err);
                if (!err) setOpen(false);
              }}
              className="flex h-11 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-left text-xs font-semibold"
            >
              <span className="truncate">{o.label}</span>
              {o.ambitious && <span className="shrink-0 text-[10px] font-bold text-[#FFB020]">big ask</span>}
            </button>
          ))}
        </div>
      )}
      {player.target && (
        <Button
          size="sm"
          variant="ghost"
          className="h-11 w-full text-[11px]"
          data-testid="target-clear"
          onClick={() => clearTarget(player.id)}
        >
          Drop the target
        </Button>
      )}
      {note && <p className="text-[11px] font-semibold text-[#FF6B6B]">{note}</p>}
    </div>
  );
}

/** Retraining a position, and learning a move (PPM). */
export function LearnerCard({ player }: { player: Player }) {
  const startRetrain = useGame((s) => s.startRetrain);
  const cancelRetrain = useGame((s) => s.cancelRetrain);
  const startMove = useGame((s) => s.startMove);
  const cancelMove = useGame((s) => s.cancelMove);
  const [note, setNote] = useState<string | null>(null);
  const alts = altPositions(player);
  const retrain = player.retrain;
  const move = player.moveProgress;
  const moveOpts = moveOptions(player);

  return (
    <div className={card} data-testid="player-learn">
      <span className={head}>Development plan</span>
      {alts.length > 0 && (
        <p className="text-[11px] font-semibold text-primary" data-testid="alt-positions">
          Can also cover: {alts.join(", ")}
        </p>
      )}

      {retrain ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span>Learning {retrain.pos}</span>
            <span className="tnum">{Math.round(retrain.progress)}%</span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${retrain.progress}%` }} />
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-11 w-full text-[11px]"
            data-testid="retrain-cancel"
            onClick={() => cancelRetrain(player.id)}
          >
            Stop the retraining
          </Button>
        </div>
      ) : (
        canRetrain(player) &&
        retrainOptions(player).length > 0 && (
          <div className="flex gap-1.5">
            {retrainOptions(player).map((pos) => (
              <button
                key={pos}
                data-testid={`retrain-${pos}`}
                onClick={() => {
                  const err = startRetrain(player.id, pos);
                  setNote(err);
                }}
                className="h-11 flex-1 rounded-lg border border-border bg-card text-xs font-bold text-muted-foreground"
              >
                Learn {pos}
              </button>
            ))}
          </div>
        )
      )}

      {move ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span>Learning: {TRAITS[move.trait].label}</span>
            <span className="tnum">{Math.round(move.progress)}%</span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${move.progress}%` }} />
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-11 w-full text-[11px]"
            data-testid="move-cancel"
            onClick={() => cancelMove(player.id)}
          >
            Abandon it
          </Button>
        </div>
      ) : (
        moveOpts.length > 0 &&
        player.traits.length < 2 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-muted-foreground">Learn a move</div>
            <select
              data-testid="move-select"
              defaultValue=""
              className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold"
              onChange={(e) => {
                if (!e.target.value) return;
                const err = startMove(player.id, e.target.value as (typeof moveOpts)[number]);
                setNote(err);
                e.target.value = "";
              }}
            >
              <option value="">Pick a move…</option>
              {moveOpts.map((t) => (
                <option key={t} value={t}>
                  {TRAITS[t].label} ({moveReqFor(t).attr} {moveReqFor(t).min}+)
                </option>
              ))}
            </select>
          </div>
        )
      )}
      {!retrain && !canRetrain(player) && !move && (moveOpts.length === 0 || player.traits.length >= 2) && (
        <p className="text-[10px] text-muted-foreground" data-testid="learn-none">
          Nothing left to work on — he has his two moves and there is no position left to teach him.
        </p>
      )}
      {note && <p className="text-[11px] font-semibold text-[#FF6B6B]">{note}</p>}
    </div>
  );
}

/** Make him captain, his deputy, or take it away. */
export function ArmbandCard({ player }: { player: Player }) {
  const game = useGame((s) => s.game)!;
  const setArmband = useGame((s) => s.setArmband);
  const [note, setNote] = useState<string | null>(null);
  const isCaptain = game.captain === player.id;
  const isVice = game.vice === player.id;
  return (
    <div className={card} data-testid="player-armband">
      <div className="flex items-center justify-between">
        <span className={head}>Armband</span>
        <span className="text-[10px] font-semibold text-muted-foreground tnum">
          {isCaptain ? "Captain" : isVice ? "Vice-captain" : `OVR ${overallFor(player)} · age ${player.age}`}
        </span>
      </div>
      <div className="flex gap-1.5">
        <button
          data-testid="armband-captain"
          onClick={() => setNote(setArmband(player.id, isCaptain ? "none" : "captain"))}
          className={`h-11 flex-1 rounded-lg text-xs font-bold ${
            isCaptain ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
          }`}
        >
          {isCaptain ? "Strip the armband" : "Make captain"}
        </button>
        <button
          data-testid="armband-vice"
          onClick={() => setNote(setArmband(player.id, isVice ? "none" : "vice"))}
          className={`h-11 flex-1 rounded-lg text-xs font-bold ${
            isVice ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
          }`}
        >
          {isVice ? "No longer vice" : "Vice-captain"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        The captain leads the dressing room (he carries more weight in every talk) and wears the armband on
        the pitch.
      </p>
      {note && <p className="text-[11px] font-semibold text-primary">{note}</p>}
    </div>
  );
}

/** This round's offenders, waiting for your decision. */
export function DisciplineCard() {
  const game = useGame((s) => s.game)!;
  const fine = useGame((s) => s.finePlayer);
  const [note, setNote] = useState<string | null>(null);
  const cases = disciplinaryCases(game);
  const done = new Set((game.discipline ?? []).filter((d) => d.round === game.round && d.season === game.season).map((d) => d.playerId));
  const open = cases.filter((c) => !done.has(c.playerId));
  if (!open.length) return null;

  return (
    <section className="space-y-2" data-testid="discipline-card">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Discipline</h2>
      {open.map((c) => (
        <div key={c.playerId} className="space-y-2 rounded-xl border border-[#FFB020]/40 bg-card p-3" data-testid={`discipline-${c.playerId}`}>
          <div className="text-sm font-bold">
            {c.name} <span className="font-semibold text-[#FFB020]">— {c.reason}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              data-testid={`disc-fine-${c.playerId}`}
              onClick={() => setNote(fine(c.playerId, "fine"))}
              className="h-11 flex-1 rounded-lg bg-primary px-2 text-[11px] font-bold text-primary-foreground"
            >
              Fine 2 weeks
            </button>
            <button
              data-testid={`disc-warn-${c.playerId}`}
              onClick={() => setNote(fine(c.playerId, "warn"))}
              className="h-11 flex-1 rounded-lg border border-border bg-card px-2 text-[11px] font-bold"
            >
              Warn him
            </button>
            <button
              data-testid={`disc-none-${c.playerId}`}
              onClick={() => setNote(fine(c.playerId, "none"))}
              className="h-11 flex-1 rounded-lg border border-border bg-card px-2 text-[11px] font-bold text-muted-foreground"
            >
              Let it go
            </button>
          </div>
        </div>
      ))}
      {note && <p className="text-[11px] font-semibold text-primary" data-testid="disc-note">{note}</p>}
    </section>
  );
}

/** The armband holders, on the Squad screen. */
export function CaptainCard() {
  const game = useGame((s) => s.game)!;
  const setArmband = useGame((s) => s.setArmband);
  const cap = game.players.find((p) => p.id === game.captain);
  const vice = game.players.find((p) => p.id === game.vice);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3" data-testid="captain-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">The armband</span>
        {cap && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
            C · {cap.name.split(" ").slice(-1)[0]}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        <select
          data-testid="captain-select"
          value={cap?.id ?? ""}
          onChange={(e) => e.target.value && setArmband(e.target.value, "captain")}
          className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold"
        >
          <option value="">Captain — nobody yet</option>
          {game.players
            .filter((p) => p.clubId === game.userClubId)
            .sort((a, b) => b.age - a.age)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.pos} · age {p.age} · OVR {overallFor(p)}
              </option>
            ))}
        </select>
        <select
          data-testid="vice-select"
          value={vice?.id ?? ""}
          onChange={(e) => e.target.value && setArmband(e.target.value, "vice")}
          className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold"
        >
          <option value="">Vice-captain — nobody yet</option>
          {game.players
            .filter((p) => p.clubId === game.userClubId && p.id !== game.captain)
            .sort((a, b) => b.age - a.age)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.pos} · age {p.age}
              </option>
            ))}
        </select>
      </div>
      {!cap && (
        <p className="text-[10px] text-muted-foreground">
          Nobody is leading the room. The captain carries extra weight with the squad and in every team talk.
        </p>
      )}
    </div>
  );
}
