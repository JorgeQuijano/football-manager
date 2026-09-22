import type {
  MatchSideState,
  MatchState,
  OiEffect,
  OppInstruction,
  PiEffect,
  Player,
  PlayerInstruction,
  ShoutKind,
  TalkKind,
  TalkStage
} from "./types";

/**
 * Match-day levers: what you tell your team and what you tell them about theirs.
 *
 * Three layers, all folded into the same weights the rest of the engine uses:
 *  - opposition instructions (what your players do about one of theirs)
 *  - player instructions (what one of yours does differently)
 *  - talks & shouts (short-term fire and shape, plus a lasting dressing-room effect)
 *
 * Everything here is pure arithmetic — no rng, no state — so the live match can
 * replay a change and land on exactly the same numbers.
 */

// --- opposition instructions -------------------------------------------------------

const OI: Record<string, OiEffect> = {
  "mark:tight": { involve: 0.76, quality: 0.95, fouls: 1.1 },
  "mark:loose": { involve: 1.1, quality: 1.02, fouls: 0.94 },
  "press:often": { involve: 0.84, quality: 0.96, fouls: 1.14 },
  "press:never": { involve: 1.12, quality: 1.02, fouls: 0.88 },
  "tackle:hard": { involve: 0.9, quality: 0.97, fouls: 1.28 },
  "tackle:easy": { involve: 1.06, quality: 1.0, fouls: 0.78 },
  "show:inside": { involve: 1.0, quality: 0.95, fouls: 1.0 },
  "show:outside": { involve: 1.0, quality: 1.03, fouls: 1.0 }
};

export const OI_NONE: OiEffect = { involve: 1, quality: 1, fouls: 1 };

/** Fold one opponent's instructions into multipliers on his game. */
export function oiEffect(oi: OppInstruction | undefined): OiEffect {
  if (!oi) return OI_NONE;
  let involve = 1;
  let quality = 1;
  let fouls = 1;
  const apply = (key: string) => {
    const e = OI[key];
    if (!e) return;
    involve *= e.involve;
    quality *= e.quality;
    fouls *= e.fouls;
  };
  if (oi.mark) apply(`mark:${oi.mark}`);
  if (oi.press) apply(`press:${oi.press}`);
  if (oi.tackle) apply(`tackle:${oi.tackle}`);
  if (oi.show) apply(`show:${oi.show}`);
  return { involve, quality, fouls };
}

/** Human-readable summary of an instruction set ("Tight · Press often"). */
export function oiLabel(oi: OppInstruction | undefined): string {
  if (!oi) return "";
  const bits: string[] = [];
  if (oi.mark) bits.push(oi.mark === "tight" ? "Tight mark" : "Loose mark");
  if (oi.press) bits.push(oi.press === "often" ? "Press often" : "Stand off");
  if (oi.tackle) bits.push(oi.tackle === "hard" ? "Get stuck in" : "Stay on feet");
  if (oi.show) bits.push(oi.show === "inside" ? "Show inside" : "Show outside");
  return bits.join(" · ");
}

/** The instructions `side` has set on `id`. */
export const oiOn = (side: MatchSideState, id: string): OppInstruction | undefined => side.oi?.[id];

// --- player instructions -----------------------------------------------------------

const PI: Record<string, PiEffect> = {
  "shooting:often": { shot: 1.35, shotQuality: 0.95, assist: 1, turnover: 1.02, defense: 1 },
  "shooting:rarely": { shot: 0.7, shotQuality: 1.04, assist: 1.05, turnover: 1, defense: 1 },
  "passing:direct": { shot: 1, shotQuality: 1, assist: 1.2, turnover: 1.12, defense: 1 },
  "passing:safe": { shot: 1, shotQuality: 1, assist: 0.85, turnover: 0.85, defense: 1.02 },
  "freedom:roam": { shot: 1.06, shotQuality: 1, assist: 1.06, turnover: 1.05, defense: 0.94 },
  "freedom:hold": { shot: 0.9, shotQuality: 1.02, assist: 0.95, turnover: 0.96, defense: 1.08 }
};

export const PI_NONE: PiEffect = { shot: 1, shotQuality: 1, assist: 1, turnover: 1, defense: 1 };

/** Fold one player's instructions into multipliers on his game. */
export function piEffect(pi: PlayerInstruction | undefined): PiEffect {
  if (!pi) return PI_NONE;
  const out: PiEffect = { ...PI_NONE };
  const apply = (key: string) => {
    const e = PI[key];
    if (!e) return;
    out.shot *= e.shot;
    out.shotQuality *= e.shotQuality;
    out.assist *= e.assist;
    out.turnover *= e.turnover;
    out.defense *= e.defense;
  };
  if (pi.shooting) apply(`shooting:${pi.shooting}`);
  if (pi.passing) apply(`passing:${pi.passing}`);
  if (pi.freedom) apply(`freedom:${pi.freedom}`);
  return out;
}

export function piLabel(pi: PlayerInstruction | undefined): string {
  if (!pi) return "";
  const bits: string[] = [];
  if (pi.shooting) bits.push(pi.shooting === "often" ? "Shoot on sight" : "Be selective");
  if (pi.passing) bits.push(pi.passing === "direct" ? "Play direct" : "Keep it simple");
  if (pi.freedom) bits.push(pi.freedom === "roam" ? "Roam" : "Hold position");
  return bits.join(" · ");
}

export const piOf = (side: MatchSideState, id: string): PlayerInstruction | undefined => side.pi?.[id];

// --- talks -------------------------------------------------------------------------

export interface TalkDef {
  kind: TalkKind;
  label: string;
  blurb: string;
  /** immediate match effect on the side's attacking edge */
  fire: number;
  /** …and on its defensive shape */
  shape: number;
  /** how it lands on a player, before mood: + pushes, − soothes */
  tone: "push" | "soothe" | "neutral";
}

/** Pre-match words: the classic three. */
export const PRE_TALKS: TalkDef[] = [
  {
    kind: "demand",
    label: "I expect nothing less than a win.",
    blurb: "Fires up the confident ones. Can rattle the nervy ones.",
    fire: 0.045,
    shape: 0.01,
    tone: "push"
  },
  {
    kind: "encourage",
    label: "Go and express yourselves.",
    blurb: "Loosens the shoulders — a small lift, no risk.",
    fire: 0.02,
    shape: 0.005,
    tone: "soothe"
  },
  {
    kind: "relax",
    label: "No pressure from me today.",
    blurb: "Takes the weight off a struggling squad.",
    fire: 0.01,
    shape: 0,
    tone: "soothe"
  },
  { kind: "none", label: "Say nothing.", blurb: "Sometimes the best team talk is no team talk.", fire: 0, shape: 0, tone: "neutral" }
];

/** Half-time words, depending on how it is going. */
export function htTalks(gf: number, ga: number): TalkDef[] {
  if (gf > ga) {
    return [
      {
        kind: "praise",
        label: "Brilliant — same again.",
        blurb: "Confidence is high; keep it rolling.",
        fire: 0.025,
        shape: 0.01,
        tone: "soothe"
      },
      {
        kind: "warn",
        label: "Don't you dare switch off.",
        blurb: "Guards against complacency, rattles the relaxed.",
        fire: 0.02,
        shape: 0.015,
        tone: "push"
      },
      { kind: "none", label: "Say nothing.", blurb: "Let them own it.", fire: 0, shape: 0, tone: "neutral" }
    ];
  }
  if (gf === ga) {
    return [
      { kind: "encourage", label: "Keep going — the goal is coming.", blurb: "Steady, patient.", fire: 0.025, shape: 0, tone: "soothe" },
      { kind: "demand", label: "We need more from you.", blurb: "Pushes the confident, stings the fragile.", fire: 0.04, shape: 0, tone: "push" },
      { kind: "none", label: "Say nothing.", blurb: "Let them own it.", fire: 0, shape: 0, tone: "neutral" }
    ];
  }
  return [
    { kind: "demand", label: "This is not good enough.", blurb: "Pushes the confident, stings the fragile.", fire: 0.05, shape: 0.005, tone: "push" },
    { kind: "encourage", label: "Heads up — we're still in this.", blurb: "Keeps the fragile ones from sinking.", fire: 0.03, shape: 0.005, tone: "soothe" },
    { kind: "warn", label: "Lose this and it will hurt.", blurb: "Fear. Works on some, freezes others.", fire: 0.035, shape: -0.005, tone: "push" },
    { kind: "none", label: "Say nothing.", blurb: "Let them own it.", fire: 0, shape: 0, tone: "neutral" }
  ];
}

/** Full-time words. */
export const FT_TALKS: TalkDef[] = [
  { kind: "praise", label: "That was excellent.", blurb: "Ends the day on a high.", fire: 0, shape: 0, tone: "soothe" },
  { kind: "warn", label: "Not good enough — remember this feeling.", blurb: "Stings now, sharpens later.", fire: 0, shape: 0, tone: "push" },
  { kind: "none", label: "Say nothing.", blurb: "Leave them to it.", fire: 0, shape: 0, tone: "neutral" }
];

/** The default (AI) pre-match talk — keeps both sides on the same footing. */
export const AI_TALK: TalkKind = "encourage";

/**
 * Rebuild the talk that was given at `stage` from its kind — used when the live
 * match replays a change, so the same words always have the same effect.
 */
export function talkDefFor(kind: TalkKind, gf: number, ga: number, stage: TalkStage): TalkDef {
  const list = stage === "pre" ? PRE_TALKS : stage === "ft" ? FT_TALKS : htTalks(gf, ga);
  return list.find((d) => d.kind === kind) ?? list[list.length - 1];
}

/** How a knockout tie finished, once the 90 (or 120) minutes are up. */
export interface KnockoutOutcome {
  aet: boolean;
  pens?: { home: number; away: number };
}

/**
 * How one player takes a talk: confident players respond to a push, struggling
 * ones need an arm around them — and leaders carry it further, either way.
 */
export function talkMoraleDelta(p: Player, def: TalkDef, leader = false): number {
  const mood = p.morale ?? 60;
  const moodFactor = Math.max(-0.55, Math.min(0.55, (mood - 60) / 60));
  let delta: number;
  if (def.tone === "push") delta = 2.2 * (1 + moodFactor * 1.4);
  else if (def.tone === "soothe") delta = 2.0 * (1 - moodFactor * 1.1);
  else delta = 0;
  if (p.age <= 21) delta *= 0.85; // kids take it quieter
  if (leader) delta *= 1.25;
  return Math.round(delta * 10) / 10;
}

export interface TalkEffect {
  playerId: string;
  name: string;
  delta: number;
}

/**
 * The dressing-room half of a team talk: every one of your players hears it and
 * moves a little, for good. Returns a fresh player list (never mutates).
 */
export function applyTeamTalk(
  save: { players: Player[]; userClubId: string },
  stage: TalkStage,
  kind: TalkKind,
  gf: number,
  ga: number,
  leaders: Set<string>
): { players: Player[]; effects: TalkEffect[] } {
  const def = talkDefFor(kind, gf, ga, stage);
  const effects: TalkEffect[] = [];
  const players = save.players.map((p) => {
    if (p.clubId !== save.userClubId) return p;
    const delta = talkMoraleDelta(p, def, leaders.has(p.id));
    if (delta === 0) return p;
    effects.push({ playerId: p.id, name: p.name, delta });
    return { ...p, morale: Math.max(5, Math.min(100, (p.morale ?? 60) + delta)) };
  });
  effects.sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name));
  return { players, effects };
}

// --- shouts ------------------------------------------------------------------------

export interface ShoutDef {
  kind: ShoutKind;
  label: string;
  blurb: string;
  fire: number;
  shape: number;
  /** how the dressing room takes it right now */
  morale: number;
}

export const SHOUTS: ShoutDef[] = [
  { kind: "encourage", label: "Encourage", blurb: "A lift without the edge.", fire: 0.028, shape: 0.006, morale: 0.4 },
  { kind: "demand", label: "Demand more", blurb: "Pushes hard — stings the fragile.", fire: 0.04, shape: 0, morale: -0.6 },
  { kind: "tighten", label: "Tighten up", blurb: "Solid over expansive.", fire: -0.012, shape: 0.035, morale: 0 },
  { kind: "calm", label: "Calm down", blurb: "Stops the cards piling up.", fire: -0.004, shape: 0.012, morale: 0.2 }
];

/** Shouts lose their bite once the players have heard it all before. */
export function shoutScale(used: number): number {
  if (used <= 1) return 1;
  if (used === 2) return 0.6;
  if (used === 3) return 0.3;
  return -0.15; // one too many
}

export const shoutBy = (kind: ShoutKind): ShoutDef => SHOUTS.find((s) => s.kind === kind) ?? SHOUTS[0];

// --- what the assistant tells you ---------------------------------------------------

export interface Advice {
  kind: "tired" | "booked" | "threat" | "quiet" | "keeper" | "ref" | "ball" | "talk" | "shape";
  text: string;
  playerId?: string;
  /** a one-tap action the panel can offer */
  action?: "sub" | "oi";
}

export interface AdviceCtx {
  /** possession share of this side, 0-1 */
  poss: number;
  shots: number;
  shotsAgainst: number;
  savesByTheirKeeper: number;
  cards: number;
  minute: number;
}

const nameOf = (players: Map<string, Player>, id: string) => players.get(id)?.name ?? id;

/**
 * Live niggles worth surfacing: who is running on empty, who is on a booking,
 * who is on fire on the other side, and whether the game state says something.
 */
export function assistantAdvice(
  s: MatchState,
  sideKey: "home" | "away",
  players: Map<string, Player>,
  ctx: AdviceCtx
): Advice[] {
  const out: Advice[] = [];
  const side = s[sideKey];
  const opp = sideKey === "home" ? s.away : s.home;

  for (const id of side.slots) {
    if (!id) continue;
    const st = s.stamina[id] ?? 100;
    const p = players.get(id);
    if (!p) continue;
    if (st < 45) {
      out.push({
        kind: "tired",
        playerId: id,
        action: "sub",
        text: `${p.name} is running on empty (${Math.round(st)}% legs) — get him off.`
      });
    }
    if ((s.yellows[id] ?? 0) > 0) {
      out.push({
        kind: "booked",
        playerId: id,
        text: `${p.name} is on a booking — he has to be careful now.`
      });
    }
  }

  // the biggest threat on the other side
  const threat = opp.slots
    .filter((x): x is string => !!x)
    .map((id) => ({ id, p: players.get(id) }))
    .filter((x): x is { id: string; p: Player } => !!x.p)
    .sort((a, b) => b.p.attrs.shooting + b.p.attrs.pace - (a.p.attrs.shooting + a.p.attrs.pace))[0];
  const already = threat && opp.oi?.[threat.id];
  if (threat && !already && ctx.minute >= 15) {
    out.push({
      kind: "threat",
      playerId: threat.id,
      action: "oi",
      text: `${threat.p.name} looks their danger man — consider an instruction on him.`
    });
  }

  if (ctx.minute >= 40) {
    if (ctx.poss > 0.62 && ctx.shots <= 4) {
      out.push({ kind: "ball", text: "You have the ball but no bite — get more bodies forward." });
    } else if (ctx.poss < 0.38 && ctx.shotsAgainst >= 8) {
      out.push({ kind: "shape", text: "You are being outplayed — tighten up or change the shape." });
    }
    if (ctx.savesByTheirKeeper >= 4) {
      out.push({ kind: "keeper", text: `Their keeper has made ${ctx.savesByTheirKeeper} saves — keep testing him.` });
    }
    if (ctx.cards >= 3) {
      out.push({ kind: "ref", text: `${ctx.cards} bookings already — someone needs to calm this down.` });
    }
  }
  return out;
}

/** The half-time report: what the numbers and the legs are saying. */
export function halfTimeReport(
  s: MatchState,
  sideKey: "home" | "away",
  players: Map<string, Player>,
  ctx: AdviceCtx
): Advice[] {
  const out: Advice[] = assistantAdvice(s, sideKey, players, ctx);
  const gf = s[sideKey].goals;
  const ga = (sideKey === "home" ? s.away : s.home).goals;
  if (gf < ga) {
    out.unshift({ kind: "talk", text: "You are behind — the players need to hear something at half time." });
  } else if (gf > ga) {
    out.unshift({ kind: "talk", text: "You are ahead — watch for complacency in the second half." });
  }
  return out;
}

// --- the AI's own instructions ------------------------------------------------------

/**
 * A simple AI plan: it puts an instruction on your most dangerous player and
 * presses the ones who are happy to be pressed. Deterministic from the squad.
 */
export function aiOppInstructions(opponentXI: Player[]): Record<string, OppInstruction> {
  const out: Record<string, OppInstruction> = {};
  const ranked = [...opponentXI].sort(
    (a, b) => b.attrs.shooting + b.attrs.pace + b.attrs.passing - (a.attrs.shooting + a.attrs.pace + a.attrs.passing)
  );
  const star = ranked[0];
  if (star) out[star.id] = { mark: "tight", show: "outside" };
  const playmaker = [...opponentXI].sort((a, b) => b.attrs.passing - a.attrs.passing)[0];
  if (playmaker && playmaker.id !== star?.id) out[playmaker.id] = { press: "often" };
  return out;
}
