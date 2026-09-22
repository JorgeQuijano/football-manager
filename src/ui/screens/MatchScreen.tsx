import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GamePhase,
  IntentPick,
  MatchState,
  Mentality,
  MotionProfile,
  RoleId,
  Rng,
  TraitId
} from "@/engine";
import {
  decideIntent,
  hashSeed,
  motionFor,
  mulberry32,
  T,
  finalizeLive,
  laneFits,
  matchStats,
  ROLE_DEFS,
  ROLE_GROUPS
} from "@/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useGame } from "@/state/store";
import { posChip } from "@/ui/format";
import { drawFrame, slotScreen, type Frame, type FramePlayer } from "@/ui/matchPitch";

const eventClass: Record<string, string> = {
  goal: "text-primary font-bold",
  red: "text-destructive font-semibold",
  yellow: "text-[#FFB020] font-semibold",
  injury: "text-[#FFB020]",
  sub: "text-muted-foreground",
  save: "text-muted-foreground",
  miss: "text-muted-foreground",
  block: "text-muted-foreground",
  corner: "text-muted-foreground",
  freekick: "text-muted-foreground",
  penalty: "text-[#FFB020] font-semibold",
  half: "font-bold",
  full: "font-bold",
  kickoff: "text-muted-foreground"
};

type Side = "home" | "away";

type StageKind = "corner" | "penalty" | "freekick";

/** Set-piece staging: where each side lines up while a corner / penalty / free kick is taken. */
type StageInfo = {
  kind: StageKind;
  side: Side;
  taker: number;
  tg: [number, number];
  att: number[];
  def: number[];
};

const SPEEDS = [1, 2, 4, 8] as const;

type Phase =
  | { k: "player"; opp: boolean; slot: number; dur: number }
  | { k: "point"; x: number; y: number; dur: number }
  | { k: "hold"; dur: number };

export function MatchScreen() {
  const game = useGame((s) => s.game)!;
  const setScreen = useGame((s) => s.setScreen);
  const live = game.live;
  useEffect(() => {
    if (!live) setScreen("home");
  }, [live, setScreen]);
  if (!live) return null;
  return <LiveMatchScreen />;
}

function LiveMatchScreen() {
  const game = useGame((s) => s.game)!;
  const live = useGame((s) => s.game!.live)!;
  const finishMatch = useGame((s) => s.finishMatch);
  const liveSub = useGame((s) => s.liveSub);
  const liveMentality = useGame((s) => s.liveMentality);
  const liveRole = useGame((s) => s.liveRole);
  const startSecondHalf = useGame((s) => s.startSecondHalf);
  const skipTo = useGame((s) => s.skipTo);
  const setPlayhead = useGame((s) => s.setPlayhead);

  const st = live.state;
  const homeClub = game.clubs.find((c) => c.id === st.homeId)!;
  const awayClub = game.clubs.find((c) => c.id === st.awayId)!;
  const userSide: Side = st.userSide ?? "home";
  const userClub = userSide === "home" ? homeClub : awayClub;

  const [ui, setUi] = useState({ minute: live.playhead, si: 0, gh: 0, ga: 0 });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(() => {
    const v = Number(typeof localStorage === "undefined" ? "" : localStorage.getItem("fm-speed"));
    return (SPEEDS as readonly number[]).includes(v) ? v : 2;
  });
  const [htReady, setHtReady] = useState(false);
  const [ftReady, setFtReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingOut, setPendingOut] = useState<string | null>(null);
  const [subErr, setSubErr] = useState<string | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const stateRef = useRef(st);
  stateRef.current = st;
  const colorsRef = useRef({ home: homeClub.color, away: awayClub.color });
  colorsRef.current = { home: homeClub.color, away: awayClub.color };

  // Engine-owned movement profiles: role instructions scaled by each player's
  // pace/physical and slot geometry (see engine/motion.ts).
  const profiles = useMemo(() => {
    const byId = new Map(game.players.map((p) => [p.id, p] as const));
    const map = new Map<string, MotionProfile>();
    const tmap = new Map<string, string[]>();
    for (const s of ["home", "away"] as const) {
      const sd = st[s];
      for (let i = 0; i < 11; i++) {
        const id = sd.slots[i];
        const p = id ? byId.get(id) : undefined;
        if (p) {
          map.set(
            s + ":" + i,
            motionFor(p, sd.roles[i], { x: sd.coords[i][0], y: sd.coords[i][1], pos: sd.poss[i] })
          );
          tmap.set(s + ":" + i, (p.traits ?? []) as string[]);
        }
      }
    }
    return { map, tmap };
  }, [game.players, st]);
  const profRef = useRef(profiles);
  profRef.current = profiles;

  const clock = useRef({
    si: 0,
    pi: 0,
    t: 0,
    ballX: 50,
    ballY: 50,
    originX: 50,
    originY: 50,
    time: 0,
    minute: 0,
    playing: true,
    speed: 2,
    poss: null as null | Side,
    transT: 0,
    transSide: null as null | Side,
    stage: null as null | StageInfo,
    intents: new Map<string, { pick: IntentPick; phase: GamePhase; until: number }>(),
    intentRngs: new Map<string, Rng>(),
    phases: null as null | Phase[],
    anim: new Map<string, { x: number; y: number }>(),
    flashT: 0,
    uiT: 0,
    persistT: 0,
    halfDone: false,
    fullDone: false
  });

  const cbRef = useRef({
    onUi: (_m: number, _si: number, _gh: number, _ga: number) => {},
    onHalf: () => {},
    onFull: () => {},
    persist: (_m: number) => {}
  });
  cbRef.current = {
    onUi: (m, si, gh, ga) => setUi({ minute: m, si, gh, ga }),
    onHalf: () => setHtReady(true),
    onFull: () => setFtReady(true),
    persist: (m) => setPlayhead(m)
  };

  const jumpTo = (minute: number) => {
    const c = clock.current;
    const s = stateRef.current;
    const idx = s.timeline.findIndex((x) => x.m > minute);
    c.si = idx < 0 ? s.timeline.length : idx;
    c.pi = 0;
    c.t = 0;
    c.phases = null;
    c.stage = null;
    c.originX = c.ballX;
    c.originY = c.ballY;
    c.minute = Math.max(0, Math.min(minute, s.total));
  };

  useEffect(() => {
    const C = clock.current;
    C.si = (() => {
      const s = stateRef.current;
      const idx = s.timeline.findIndex((x) => x.m > liveRef.current.playhead);
      return idx < 0 ? s.timeline.length : idx;
    })();
    C.minute = liveRef.current.playhead;
    let raf = 0;
    let last = performance.now();

    const mirrors = () => {
      const u = liveRef.current.state.userSide ?? "home";
      return { home: u === "away", away: u === "home" };
    };
    const sideOf = (side: Side) =>
      side === "home" ? stateRef.current.home : stateRef.current.away;
    const sideMirror = (side: Side) => (side === "home" ? mirrors().home : mirrors().away);
    const attacksUp = (side: Side) => !sideMirror(side);
    const clampPos = (v: number) => Math.max(3, Math.min(97, v));
    const DEFAULT_PROFILE: MotionProfile = {
      speed: 12,
      accel: 6,
      gk: false,
      roam: 6,
      press: 0.5,
      support: 0.6,
      push: 8,
      drop: 6,
      width: 0,
      recovery: 0.7,
      break: 0.5,
      seed: 0.5
    };

    /** Staged positions (attacking-side frame) for set plays: who stands where. */
    const STAGE_SPOTS: Record<
      StageKind,
      { att: [number, number][]; def: [number, number][]; restAtt: [number, number]; restDef: [number, number] }
    > = {
      corner: {
        att: [[44, 10], [56, 9], [38, 14], [62, 13], [50, 17]],
        def: [[46, 12], [54, 11], [40, 16], [60, 15], [50, 8]],
        restAtt: [50, 44],
        restDef: [50, 30]
      },
      penalty: {
        att: [[30, 26], [70, 26], [50, 30], [20, 30], [80, 30]],
        def: [[28, 24], [72, 24], [50, 28], [12, 28], [88, 28]],
        restAtt: [50, 40],
        restDef: [50, 34]
      },
      freekick: {
        att: [[40, 16], [60, 16], [50, 20], [30, 24], [70, 24]],
        def: [[46, 19], [50, 18], [54, 19], [38, 23], [62, 23]],
        restAtt: [50, 36],
        restDef: [50, 30]
      }
    };

    /** Rank a side's outfield slots by how far a role pushes / drops (for set-piece roles). */
    const rankSide = (s2: Side, field: "push" | "drop") => {
      const sd2 = sideOf(s2);
      const arr: { slot: number; v: number }[] = [];
      for (let i = 0; i < 11; i++) {
        if (sd2.poss[i] === "GK") continue;
        const prof = profRef.current.map.get(s2 + ":" + i) ?? DEFAULT_PROFILE;
        arr.push({ slot: i, v: field === "push" ? prof.push : prof.drop });
      }
      arr.sort((a, b) => b.v - a.v);
      return arr.map((x) => x.slot);
    };

    /** Where a slot should stand while a set piece is staging; null = normal movement. */
    const stageTarget = (side: Side, slot: number) => {
      const S = C.stage;
      if (!S) return null;
      const sd = sideOf(side);
      const m = sideMirror(S.side);
      const spots = STAGE_SPOTS[S.kind];
      const put = (x: number, y: number) => ({
        x: clampPos(m ? 100 - x : x),
        y: clampPos(m ? 100 - y : y)
      });
      if (side === S.side) {
        if (sd.poss[slot] === "GK") return put(50, 92);
        if (slot === S.taker) return put(S.tg[0], S.tg[1]);
        const r = S.att.indexOf(slot);
        if (r >= 0 && r < spots.att.length) return put(spots.att[r][0], spots.att[r][1]);
        const rr = spots.restAtt;
        return put(r % 2 === 0 ? rr[0] - 9 : rr[0] + 9, rr[1]);
      }
      if (sd.poss[slot] === "GK") return put(50, 4);
      const r2 = S.def.indexOf(slot);
      if (S.kind === "corner" && r2 >= 0 && r2 < spots.att.length) {
        // man-marking at corners: pick up the attacker in this rank, goal-side
        const mark = spots.att[r2];
        return put(mark[0] + (r2 % 2 === 0 ? 1.5 : -1.5), Math.max(3, mark[1] - 2.5));
      }
      if (r2 >= 0 && r2 < spots.def.length) return put(spots.def[r2][0], spots.def[r2][1]);
      const rr2 = spots.restDef;
      return put(r2 % 2 === 0 ? rr2[0] - 9 : rr2[0] + 9, rr2[1]);
    };

    // ---- player decisions (engine/intents.ts): each player picks their own
    // intent every few seconds from role/attribute/mentality/situation weights,
    // on their own seeded RNG stream — nobody moves in lockstep.
    const MATCH_KEY = (() => {
      const lv = liveRef.current;
      return `${lv.state.homeId}:${lv.state.awayId}`;
    })();
    const ownBall = (side: Side) => {
      const up = attacksUp(side);
      const m = sideMirror(side);
      return { x: m ? 100 - C.ballX : C.ballX, y: up ? C.ballY : 100 - C.ballY };
    };
    const screenFromOwn = (side: Side, pt: { x: number; y: number }) => {
      const up = attacksUp(side);
      const m = sideMirror(side);
      return { x: m ? 100 - pt.x : pt.x, y: up ? pt.y : 100 - pt.y };
    };
    const decideFor = (side: Side, slot: number, phase: GamePhase) => {
      const sd = sideOf(side);
      const key = side + ":" + slot;
      let rng = C.intentRngs.get(key);
      if (!rng) {
        rng = mulberry32(hashSeed(MATCH_KEY, side, slot));
        C.intentRngs.set(key, rng);
      }
      const prof = profRef.current.map.get(key) ?? DEFAULT_PROFILE;
      const ball = ownBall(side);
      const cd = sd.coords[slot];
      const pick = decideIntent(
        prof,
        {
          phase,
          mentality: sd.mentality,
          slot: { x: cd[0], y: cd[1] },
          ball,
          prog: 1 - ball.y / 100,
          traits: (profRef.current.tmap.get(key) ?? []) as TraitId[]
        },
        rng
      );
      C.intents.set(key, { pick, phase, until: C.time + pick.seconds });
    };

    /** in possession · out of possession · the 2.5 s after a turnover */
    const phaseOf = (side: Side): "in" | "out" | "break" | "recover" => {
      if (C.transT > 0 && C.transSide) return side === C.transSide ? "break" : "recover";
      return C.poss === side ? "in" : "out";
    };

    /**
     * Live position target for a slot. Engine-owned per-role instructions
     * (`motionFor`: press/support/push/drop/width/roam per role, scaled by pace
     * and physical) select behaviour by phase — in possession roles push up,
     * offer for the ball and hold or leave their width; out of possession they
     * drop into shape and the most eager roles press; during transition the
     * turnover winner breaks and the loser recovers at sprint pace.
     */
    const targetFor = (side: Side, slot: number) => {
      // set plays: hold the staged shape (corner box, penalty arc, free-kick wall)
      const staged = stageTarget(side, slot);
      if (staged) return staged;
      const sd = sideOf(side);
      const prof = profRef.current.map.get(side + ":" + slot) ?? DEFAULT_PROFILE;
      const base = slotScreen(sd, slot, sideMirror(side));
      const up = attacksUp(side);
      const dir = up ? -1 : 1;
      const bx = C.ballX;
      const by = C.ballY;
      const prog = (up ? 100 - by : by) / 100; // 0 = deep in own half → 1 = opponent box
      const phase = phaseOf(side);
      let x = base.x;
      let y = base.y + dir * (prog - 0.5) * (prof.gk ? 10 : 30);
      // role depth for the phase (positive = toward the opponent goal)
      let depth: number;
      if (phase === "break") depth = prof.push * 0.7 + prof.break * 9;
      else if (phase === "in") depth = prof.push * (0.5 + 0.5 * prog);
      else if (phase === "recover") depth = -prof.drop - prof.recovery * 9;
      else depth = -prof.drop * (0.5 + 0.5 * (1 - prog));
      // team mentality shifts the whole block: attacking sits higher, defensive deeper
      if (sd.mentality === "att") depth += 4;
      else if (sd.mentality === "def") depth -= 5;
      y += dir * depth * (prof.gk ? 0.25 : 1);
      // role width: hold the line or come inside
      const sideSign = base.x >= 50 ? 1 : -1;
      x += sideSign * prof.width * 11 * (phase === "in" || phase === "break" ? 1 : 0.5);
      // stay compact with the ball's side of the pitch
      x += (bx - x) * (prof.gk ? 0.05 : 0.18);
      // gather round the ball (in possession) / press it (out) / recover shape
      const d = Math.hypot(x - bx, y - by);
      let pull: number;
      if (phase === "in" || phase === "break") {
        pull = prof.support * 0.6 * Math.max(0, 1 - d / 40);
      } else if (phase === "out") {
        pull = prof.press * 0.85 * Math.pow(Math.max(0, 1 - d / 34), 1.35);
      } else {
        pull = prof.press * 0.45 * Math.pow(Math.max(0, 1 - d / 34), 1.5);
      }
      const ph = C.phases?.[C.pi];
      if (ph && ph.k === "player" && ph.slot === slot) {
        const onThisSide = ph.opp ? side !== C.poss : side === C.poss;
        if (onThisSide) pull = Math.max(pull, 0.45);
      }
      x += (bx - x) * pull;
      y += (by - y) * pull;
      // blend in this player's own decision for this moment (engine/intents.ts)
      const ent = C.intents.get(side + ":" + slot);
      if (ent) {
        const t = screenFromOwn(side, ent.pick.target);
        x += (t.x - x) * ent.pick.mix;
        y += (t.y - y) * ent.pick.mix;
      }
      // individual wandering — sized by the role's roaming and the player's
      // stamina, offset per player so no two move in lockstep
      const w1 = Math.sin(C.time * 0.35 + prof.seed * 6.283) * prof.roam * 0.35;
      const w2 = Math.cos(C.time * 0.27 + prof.seed * 4.712) * prof.roam * 0.25;
      const j = Math.sin(C.time * 1.4 + prof.seed * 9.42) * 0.3;
      return { x: clampPos(x + w1 + j), y: clampPos(y + w2 + j * 0.7) };
    };

    const enterStroke = () => {
      const st2 = stateRef.current;
      const s = st2.timeline[C.si];
      C.phases = [];
      C.pi = 0;
      C.t = 0;
      C.originX = C.ballX;
      C.originY = C.ballY;
      if (!s) return;
      const newPoss: Side = s.h ? "home" : "away";
      if (C.poss && C.poss !== newPoss) {
        C.transT = 2.5;
        C.transSide = newPoss;
      }
      C.poss = newPoss;
      if (s.sp === "corner" || s.sp === "penalty" || s.sp === "freekick") {
        const other: Side = C.poss === "home" ? "away" : "home";
        C.stage = {
          kind: s.sp,
          side: C.poss,
          taker: s.p[0] ?? 0,
          tg: s.tg ?? [50, 12],
          att: rankSide(C.poss, "push"),
          def: rankSide(other, "drop")
        };
      } else {
        C.stage = null;
      }
      const phases: Phase[] = [];
      const firstDur = s.sp === "penalty" ? 4.0 : s.sp === "corner" ? 3.0 : s.sp ? 2.8 : 0.16;
      if (s.p.length) phases.push({ k: "player", opp: false, slot: s.p[0], dur: firstDur });
      for (let i = 0; i + 1 < s.p.length; i++) {
        phases.push({ k: "player", opp: false, slot: s.p[i + 1], dur: 0.3 });
      }
      const up = attacksUp(C.poss);
      const mirror = sideMirror(C.poss);
      const mouthX = s.t !== undefined ? (mirror ? 100 - s.t : s.t) : 50;
      const goalY = up ? 1.5 : 98.5;
      switch (s.o) {
        case "turnover":
          phases.push(
            s.b !== undefined
              ? { k: "player", opp: true, slot: s.b, dur: 0.4 }
              : { k: "hold", dur: 0.4 }
          );
          break;
        case "out":
          phases.push({
            k: "point",
            x: s.t !== undefined ? (mirror ? 100 - s.t : s.t) : 4,
            y: up ? 25 : 75,
            dur: 0.35
          });
          break;
        case "foul":
          phases.push({ k: "hold", dur: 0.65 });
          break;
        case "goal":
          phases.push({ k: "point", x: mouthX, y: goalY, dur: 0.5 });
          break;
        case "save":
          phases.push(
            s.b !== undefined
              ? { k: "player", opp: true, slot: s.b, dur: 0.55 }
              : { k: "point", x: mouthX, y: goalY, dur: 0.55 }
          );
          break;
        case "block":
          phases.push(
            s.b !== undefined
              ? { k: "player", opp: true, slot: s.b, dur: 0.45 }
              : { k: "hold", dur: 0.45 }
          );
          break;
        case "miss":
          phases.push({ k: "point", x: mouthX, y: up ? -4 : 104, dur: 0.5 });
          break;
      }
      C.phases = phases;
    };

    const tick = (dt: number) => {
      const st2 = stateRef.current;
      const lv = liveRef.current;
      const tl = st2.timeline;
      if (C.flashT > 0) C.flashT = Math.max(0, C.flashT - dt);

      C.time += dt;
      if (C.transT > 0) C.transT = Math.max(0, C.transT - dt * C.speed);
      for (const side of ["home", "away"] as const) {
        const phase = phaseOf(side);
        const hurry =
          (phase === "break" || phase === "recover" ? 1.2 : 1) * (C.stage ? 1.5 : 1);
        for (let i = 0; i < 11; i++) {
          const ent = C.intents.get(side + ":" + i);
          if (!ent || ent.until <= C.time || ent.phase !== phase) decideFor(side, i, phase);
        }
        for (let i = 0; i < 11; i++) {
          const key = side + ":" + i;
          const prof = profRef.current.map.get(key) ?? DEFAULT_PROFILE;
          const tgt = targetFor(side, i);
          const cur = C.anim.get(key) ?? { x: tgt.x, y: tgt.y };
          const k = Math.min(1, dt * prof.accel);
          let nx = cur.x + (tgt.x - cur.x) * k;
          let ny = cur.y + (tgt.y - cur.y) * k;
          const cap = prof.speed * hurry * dt;
          const dx = nx - cur.x;
          const dy = ny - cur.y;
          const len = Math.hypot(dx, dy);
          if (len > cap && len > 0) {
            nx = cur.x + (dx / len) * cap;
            ny = cur.y + (dy / len) * cap;
          }
          cur.x = nx;
          cur.y = ny;
          C.anim.set(key, cur);
        }
      }

      if (C.playing && C.si < tl.length) {
        if (!C.phases) enterStroke();
        C.t += dt * C.speed;
        let guard = 0;
        while (
          C.phases &&
          C.pi < C.phases.length &&
          C.t >= C.phases[C.pi].dur &&
          guard++ < 40
        ) {
          const ph = C.phases[C.pi];
          C.t -= ph.dur;
          C.pi++;
          C.originX = C.ballX;
          C.originY = C.ballY;
          if (C.pi >= C.phases.length) {
            const done = tl[C.si];
            C.si++;
            C.pi = 0;
            C.t = 0;
            C.phases = null;
            C.stage = null;
            if (done) {
              C.minute = done.m;
              if (done.o === "goal") {
                C.flashT = 1.5;
                C.ballX = 50;
                C.ballY = 50;
                C.poss = null;
              }
            }
            if (C.si < tl.length) enterStroke();
            break;
          }
        }
        const ph = C.phases?.[C.pi];
        if (ph) {
          let to: { x: number; y: number } | null = null;
          if (ph.k === "player") {
            const other: Side = C.poss === "home" ? "away" : "home";
            to = targetFor(ph.opp ? other : (C.poss ?? "home"), ph.slot);
          } else if (ph.k === "point") {
            to = { x: ph.x, y: ph.y };
          }
          if (to) {
            const q = Math.min(1, ph.dur ? C.t / ph.dur : 0);
            const e = q * q * (3 - 2 * q);
            C.ballX = C.originX + (to.x - C.originX) * e;
            C.ballY = C.originY + (to.y - C.originY) * e;
          }
          const cur = tl[C.si];
          if (cur) C.minute = cur.m;
        }
      }

      if (C.si >= tl.length) {
        if (lv.half === 1 && !C.halfDone) {
          C.halfDone = true;
          C.playing = false;
          cbRef.current.onHalf();
        } else if (lv.half === 2 && !C.fullDone && st2.minute >= st2.total) {
          C.fullDone = true;
          C.playing = false;
          cbRef.current.onFull();
        }
      }

      C.uiT += dt;
      if (C.uiT > 0.25) {
        C.uiT = 0;
        let gh = 0;
        let ga = 0;
        for (let i = 0; i <= C.si && i < tl.length; i++) {
          const s = tl[i];
          if (s.o !== "goal") continue;
          const counted = i < C.si || C.pi >= Math.max(0, (C.phases?.length ?? 1) - 1);
          if (counted) {
            if (s.h) gh++;
            else ga++;
          }
        }
        if ((window as unknown as { __fmDebugOn?: boolean }).__fmDebugOn) {
          const pos: Record<string, { x: number; y: number }> = {};
          for (const [k, v] of C.anim) {
            pos[k] = { x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10 };
          }
          (window as unknown as { __fmPos?: unknown }).__fmPos = {
            minute: Math.round(C.minute * 10) / 10,
            ball: { x: Math.round(C.ballX * 10) / 10, y: Math.round(C.ballY * 10) / 10 },
            phase: { home: phaseOf("home"), away: phaseOf("away") },
            stage: C.stage ? C.stage.kind : null,
            intents: (() => {
              const m: Record<string, string> = {};
              for (const [k, v] of C.intents) m[k] = v.pick.id;
              return m;
            })(),
            pos
          };
        }
        cbRef.current.onUi(C.minute, C.si, gh, ga);
      }
      C.persistT += dt;
      if (C.persistT > 2.5) {
        C.persistT = 0;
        cbRef.current.persist(Math.round(C.minute));
      }
    };

    const buildFrame = (): Frame => {
      const players: FramePlayer[] = [];
      let ringKey: string | null = null;
      if (C.poss) {
        let best = 16;
        for (let i = 0; i < 11; i++) {
          const cur = C.anim.get(C.poss + ":" + i);
          if (!cur) continue;
          const d = Math.hypot(cur.x - C.ballX, cur.y - C.ballY);
          if (d < best) {
            best = d;
            ringKey = C.poss + ":" + i;
          }
        }
      }
      for (const side of ["home", "away"] as const) {
        for (let i = 0; i < 11; i++) {
          const key = side + ":" + i;
          const cur = C.anim.get(key);
          if (cur) players.push({ x: cur.x, y: cur.y, num: i + 1, side, ring: key === ringKey });
        }
      }
      return {
        players,
        ball: { x: C.ballX, y: C.ballY },
        flash: C.flashT > 0 ? "GOAL!" : null
      };
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tick(dt);
      const cv = canvasRef.current;
      if (cv) {
        const col = colorsRef.current;
        drawFrame(cv, buildFrame(), col.home, col.away);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [ui.si]);

  useEffect(() => {
    clock.current.speed = speed;
    try {
      localStorage.setItem("fm-speed", String(speed));
    } catch {
      /* private mode — speed just won't persist */
    }
  }, [speed]);

  const setPlayingBoth = (v: boolean) => {
    clock.current.playing = v;
    setPlaying(v);
  };
  const togglePlay = () => setPlayingBoth(!clock.current.playing);
  const setSpeedTo = (n: number) => {
    clock.current.speed = n;
    setSpeed(n);
  };

  const afterLiveChange = () => {
    const l = useGame.getState().game?.live;
    if (l) jumpTo(l.playhead);
  };

  const onSkipHT = () => {
    skipTo("ht");
    afterLiveChange();
  };
  const onSkipFT = () => {
    skipTo("ft");
    setHtReady(false);
    const l = useGame.getState().game?.live;
    jumpTo(l ? l.state.total : st.total);
    setPlayingBoth(false);
    setFtReady(true);
  };
  const onStartSecondHalf = () => {
    startSecondHalf();
    setHtReady(false);
    const l = useGame.getState().game?.live;
    if (l) jumpTo(l.playhead);
    setPlayingBoth(true);
  };

  const openChanges = () => {
    setPlayingBoth(false);
    setSubErr(null);
    setPendingOut(null);
    setExpandedSlot(null);
    setSheetOpen(true);
  };

  const applySub = (inId: string) => {
    if (!pendingOut) return;
    const err = liveSub(pendingOut, inId);
    setSubErr(err);
    if (!err) {
      setPendingOut(null);
      afterLiveChange();
    }
  };

  const stats = useMemo(() => matchStats(st, Math.max(0, ui.minute)), [st, ui.minute]);
  const halfStats = useMemo(() => matchStats(st, 45), [st]);
  const ft = useMemo(() => (ftReady ? finalizeLive(live) : null), [ftReady, live]);

  const shownEvents = useMemo(
    () => st.events.filter((e) => e.minute <= ui.minute),
    [st.events, ui.minute]
  );

  const userPlayers = useMemo(
    () => new Set(game.players.filter((p) => p.clubId === userClub.id).map((p) => p.id)),
    [game.players, userClub.id]
  );
  const performers = useMemo(() => {
    if (!ft) return [];
    return Object.entries(ft.ratings)
      .filter(([id]) => userPlayers.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [ft, userPlayers]);

  const side = st[userSide];
  const byId = (id: string | null | undefined) =>
    id ? game.players.find((p) => p.id === id) : undefined;
  const possPct = Math.round(stats.possHome * 100);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6 pt-4">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <TeamBadge name={homeClub.name} short={homeClub.short} color={homeClub.color} />
            <div className="text-center">
              <div className="text-3xl font-extrabold tracking-tight tnum" data-testid="match-score">
                {ui.gh}–{ui.ga}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground tnum" data-testid="match-minute">
                {ui.minute > 90 ? "90+" : Math.max(0, Math.floor(ui.minute))}'
                {htReady && st.minute === 45 ? " · HT" : ""}
              </div>
            </div>
            <TeamBadge name={awayClub.name} short={awayClub.short} color={awayClub.color} right />
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, (ui.minute / st.total) * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-muted-foreground tnum">
            <span>
              Poss {possPct}% · Sh {stats.shotsHome} · Crn {stats.cornersHome}
            </span>
            <span>
              Crn {stats.cornersAway} · Sh {stats.shotsAway} · Poss {100 - possPct}%
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="relative mt-3 overflow-hidden rounded-2xl border border-border">
        <canvas ref={canvasRef} data-testid="match-pitch" className="block h-[52vh] w-full" />
        {htReady && !ftReady && (
          <div className="absolute inset-0 grid place-items-center bg-background/75 p-4" data-testid="ht-panel">
            <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-4 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Half time
              </div>
              <div className="mt-1 text-2xl font-extrabold tnum">
                {st.home.short} {st.home.goals}–{st.away.goals} {st.away.short}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground tnum">
                Poss {Math.round(halfStats.possHome * 100)}% · Shots {halfStats.shotsHome}–
                {halfStats.shotsAway} · Corners {halfStats.cornersHome}–{halfStats.cornersAway}
              </div>
              <div className="mt-3 grid gap-2">
                <Button
                  data-testid="ht-changes"
                  variant="secondary"
                  className="h-11 w-full font-bold"
                  onClick={openChanges}
                >
                  Make changes (subs · roles · mentality)
                </Button>
                <Button
                  data-testid="ht-resume"
                  className="h-11 w-full font-bold"
                  onClick={onStartSecondHalf}
                >
                  Start second half
                </Button>
                <button
                  data-testid="ht-skipft"
                  className="text-[11px] font-semibold text-muted-foreground"
                  onClick={onSkipFT}
                >
                  Skip to full time
                </button>
              </div>
            </div>
          </div>
        )}
        {ftReady && (
          <div className="absolute inset-0 grid place-items-center bg-background/80 p-4" data-testid="ft-panel">
            <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-4 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Full time
              </div>
              <div className="mt-1 text-2xl font-extrabold tnum">
                {st.home.short} {st.home.goals}–{st.away.goals} {st.away.short}
              </div>
              {performers.length > 0 && (
                <ul className="mt-2 space-y-1 text-left">
                  {performers.map(([id, rating]) => {
                    const p = game.players.find((x) => x.id === id);
                    return (
                      <li key={id} className="flex items-center justify-between text-sm">
                        <span>{p?.name ?? id}</span>
                        <span className="font-bold text-primary tnum">{rating.toFixed(1)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                data-testid="match-done"
                className="mt-3 h-11 w-full text-base font-bold"
                onClick={finishMatch}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Button
          data-testid="pb-play"
          variant="secondary"
          className="h-10 font-bold"
          onClick={togglePlay}
          disabled={ftReady}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          data-testid="pb-changes"
          variant="secondary"
          className="h-10 font-bold"
          onClick={openChanges}
          disabled={ftReady}
        >
          Changes
        </Button>
      </div>

      <div className="mt-1.5 flex items-stretch gap-1.5">
        <div
          role="group"
          aria-label="Playback speed"
          className="flex flex-1 gap-1 rounded-xl border border-border p-0.5"
          data-testid="pb-speed"
        >
          {SPEEDS.map((n) => (
            <button
              key={n}
              data-testid={`pb-speed-${n}`}
              onClick={() => setSpeedTo(n)}
              aria-pressed={speed === n}
              className={`h-9 flex-1 rounded-lg text-[12px] font-bold tnum ${
                speed === n ? "bg-primary/15 text-primary" : "text-muted-foreground"
              }`}
            >
              {n}x
            </button>
          ))}
        </div>
        <Button
          data-testid="pb-ht"
          variant="secondary"
          className="h-10 px-2 text-[11px] font-bold"
          onClick={onSkipHT}
          disabled={live.half === 2 || htReady || ftReady}
        >
          → HT
        </Button>
        <Button
          data-testid="pb-ft"
          variant="secondary"
          className="h-10 px-2 text-[11px] font-bold"
          onClick={onSkipFT}
          disabled={ftReady}
        >
          → FT
        </Button>
      </div>

      <div
        ref={feedRef}
        data-testid="commentary"
        className="mt-3 max-h-[26vh] flex-1 space-y-1.5 overflow-y-auto rounded-2xl border border-border bg-card p-3"
      >
        {shownEvents.map((e, i) => (
          <div key={i} className={`flex gap-2 text-[13px] leading-snug ${eventClass[e.type] ?? ""}`}>
            <span className="w-8 shrink-0 text-right text-[11px] text-muted-foreground tnum">
              {e.minute > 90 ? "90+" : e.minute}'
            </span>
            <span>{e.text}</span>
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(o) => !o && setSheetOpen(false)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>
              Match changes — {userClub.short} {userSide === "home" ? "(home)" : "(away)"}
            </SheetTitle>
          </SheetHeader>
          <div className="max-h-[66vh] space-y-4 overflow-y-auto px-4 pb-6 pt-1" data-testid="ch-sheet">
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-semibold text-muted-foreground tnum">
              Subs {side.subs}/{T.maxSubs} · Windows {side.windows}/{T.subWindowsMax} (half time
              always free)
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Mentality
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["def", "bal", "att"] as Mentality[]).map((m) => (
                  <button
                    key={m}
                    data-testid={`ch-ment-${m}`}
                    onClick={() => {
                      liveMentality(m);
                      afterLiveChange();
                    }}
                    className={`rounded-lg border px-2 py-2.5 text-[11px] font-bold uppercase ${
                      side.mentality === m
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {m === "def" ? "Defensive" : m === "bal" ? "Balanced" : "Attacking"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Substitutions {pendingOut ? "· pick the player coming on" : "· pick who comes off"}
              </div>
              {subErr && (
                <p className="mb-1.5 rounded-lg border border-[#FFB020]/40 bg-[#FFB020]/10 px-2 py-1.5 text-[11px] text-[#FFB020]" data-testid="ch-err">
                  {subErr}
                </p>
              )}
              <div className="space-y-1">
                {pendingOut === null
                  ? side.slots.map((id, i) => {
                      if (!id) return null;
                      const p = byId(id);
                      if (!p) return null;
                      return (
                        <button
                          key={id}
                          data-testid={`ch-out-${i}`}
                          onClick={() => {
                            setSubErr(null);
                            setPendingOut(id);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg border border-border px-2 py-2 text-left text-[12px]"
                        >
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${posChip[side.poss[i]]}`}>
                            {side.poss[i]}
                          </span>
                          <span className="flex-1 truncate font-semibold">{p.name}</span>
                          <span className="tnum text-[10px] text-muted-foreground">
                            {ROLE_DEFS[side.roles[i]].short} · {p.condition}%
                          </span>
                        </button>
                      );
                    })
                  : side.bench.map((id) => {
                      const p = byId(id);
                      if (!p) return null;
                      return (
                        <button
                          key={id}
                          data-testid={`ch-in-${id}`}
                          onClick={() => applySub(id)}
                          className="flex w-full items-center gap-2 rounded-lg border border-primary/50 bg-primary/5 px-2 py-2 text-left text-[12px]"
                        >
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${posChip[p.pos]}`}>
                            {p.pos}
                          </span>
                          <span className="flex-1 truncate font-semibold">{p.name}</span>
                          <span className="tnum text-[10px] text-muted-foreground">{p.condition}%</span>
                        </button>
                      );
                    })}
              </div>
              {pendingOut && (
                <button
                  className="mt-1.5 text-[11px] font-semibold text-muted-foreground"
                  onClick={() => setPendingOut(null)}
                >
                  Cancel — {byId(pendingOut)?.name} stays on
                </button>
              )}
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Roles
              </div>
              <div className="space-y-1">
                {side.slots.map((id, i) => {
                  if (!id) return null;
                  const p = byId(id);
                  if (!p) return null;
                  const open = expandedSlot === i;
                  const slotLike = { pos: side.poss[i], x: side.coords[i][0], y: side.coords[i][1] };
                  const roles = open
                    ? [...ROLE_GROUPS[side.poss[i]]].sort(
                        (a, b) => Number(laneFits(b, slotLike)) - Number(laneFits(a, slotLike))
                      )
                    : [];
                  return (
                    <div key={id} className="rounded-lg border border-border">
                      <button
                        data-testid={`ch-role-${i}`}
                        onClick={() => setExpandedSlot(open ? null : i)}
                        className="flex w-full items-center gap-2 px-2 py-2 text-left text-[12px]"
                      >
                        <span className="flex-1 truncate font-semibold">
                          {p.name}
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            {side.poss[i]}
                          </span>
                        </span>
                        <span className="text-[10px] font-bold text-primary">
                          {ROLE_DEFS[side.roles[i]].short}
                        </span>
                      </button>
                      {open && (
                        <div className="flex gap-1.5 overflow-x-auto px-2 pb-2">
                          {roles.map((r: RoleId) => (
                            <button
                              key={r}
                              data-testid={`ch-rolechip-${r}`}
                              onClick={() => {
                                liveRole(i, r);
                                setExpandedSlot(null);
                                afterLiveChange();
                              }}
                              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                                side.roles[i] === r
                                  ? "border-primary bg-primary/15 text-primary"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {ROLE_DEFS[r].short}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TeamBadge({
  name,
  short,
  color,
  right
}: {
  name: string;
  short: string;
  color: string;
  right?: boolean;
}) {
  return (
    <div className={`flex w-[34%] items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold"
        style={{ backgroundColor: color, color: "#0B1B12" }}
      >
        {short}
      </span>
      <span className={`truncate text-xs font-semibold ${right ? "text-right" : ""}`}>{name}</span>
    </div>
  );
}
