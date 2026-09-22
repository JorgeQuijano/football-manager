export type Position = "GK" | "DF" | "MF" | "FW";
export type Mentality = "def" | "bal" | "att";
export type FormationId = "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "5-3-2";
export type RoleId =
  | "keeper"
  | "sweeper"
  | "stopper"
  | "bpd"
  | "ncb"
  | "fb"
  | "wb"
  | "ifb"
  | "lib"
  | "b2b"
  | "cm"
  | "dlp"
  | "anc"
  | "bwm"
  | "mez"
  | "playmaker"
  | "ss"
  | "w"
  | "iw"
  | "poacher"
  | "af"
  | "cf"
  | "dlf"
  | "target"
  | "presser"
  | "inside"
  // added in 0.10.0 (from the FM24 behaviour guide)
  | "hb"
  | "reg"
  | "car"
  | "f9"
  | "treq"
  | "dw";

export interface PlayerAttrs {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  reflexes: number;
  handling: number;
}

export type AttrKey = keyof PlayerAttrs;

/** Training units (team focus) and session intensity. */
export type TrainingUnit =
  | "balanced"
  | "attacking"
  | "defending"
  | "passing"
  | "physical"
  | "setpieces"
  | "recovery";
export type Intensity = "light" | "normal" | "heavy";
export interface TrainingPlan {
  unit: TrainingUnit;
  intensity: Intensity;
}

/** FM-style behavioural traits — see engine/traits.ts */
export type TraitId =
  | "shoots_on_sight"
  | "killer_balls"
  | "presses_hard"
  | "marks_tightly"
  | "dives_in"
  | "stays_back"
  | "arrives_in_box"
  | "runs_with_ball"
  | "dead_ball"
  | "leader";

export interface Player {
  id: string;
  clubId: string; // "" = free agent
  name: string;
  age: number;
  pos: Position;
  attrs: PlayerAttrs;
  /** FM-style behavioural traits (0-2 per player); see engine/traits.ts */
  traits: TraitId[];
  /** contract state; see engine/transfers.ts */
  contract: Contract;
  /** potential ceiling for overall ability (v0.12) — room to grow = peak − overall */
  peak: number;
  /** fractional development accumulator per attribute (v0.12) */
  dev: Partial<Record<AttrKey, number>>;
  /** integer attribute gains/losses this season (display; reset each pre-season) */
  devSeason: Partial<Record<AttrKey, number>>;
  /** individual training focus attribute (null = none) */
  focus: AttrKey | null;
  condition: number; // 0-100
  injuredWeeks: number; // 0 = fit
  suspension: number; // matches left to sit out; 0 = available
  apps: number;
  goals: number;
  assists: number;
}

/** A player's deal: weekly wage and the last season it covers. */
export interface Contract {
  wage: number; // £/week
  until: number; // expires at the end of this season
}

/** Club money for the current season; see engine/transfers.ts. */
export interface Finances {
  transfer: number; // available transfer budget
  wageBudget: number; // weekly wage ceiling
}

/** An offer for one of the user's players, waiting for accept / reject. */
export interface TransferOffer {
  id: string;
  playerId: string;
  fromClubId: string; // bidding club
  fee: number;
  day: string; // context label, e.g. "R9 · winter window"
}

export interface Club {
  id: string;
  name: string;
  short: string; // 3-letter code
  color: string; // chip color
  strength: number; // generation-time offset
  formation: FormationId; // preferred formation (AI)
}

export interface Fixture {
  round: number; // 1..18
  homeId: string;
  awayId: string;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
}

export type MatchEventType =
  | "kickoff"
  | "goal"
  | "save"
  | "miss"
  | "block"
  | "yellow"
  | "red"
  | "injury"
  | "sub"
  | "half"
  | "full"
  | "corner"
  | "freekick"
  | "penalty";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  clubId?: string;
  playerId?: string;
  text: string;
}

export interface PlayerUpdate {
  playerId: string;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: boolean;
  injuredWeeks: number; // if > 0, newly injured
  conditionLoss: number;
}

export interface MatchResult {
  fixtureKey: string; // `${round}:${homeId}:${awayId}`
  round: number;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  ratings: Record<string, number>;
  updates: PlayerUpdate[];
  scorers: { playerId: string; name: string; clubId: string; minute: number }[];
}

// --- live match (pauseable, resumable, renderable) ---------------------------------

export type StrokeOut = "turnover" | "out" | "foul" | "goal" | "save" | "block" | "miss";

/** Set-piece tags: staging + commentary hints for the 2D view. */
export type SetPiece = "corner" | "freekick" | "penalty" | "goalkick" | "throw";

/** Attacking corner routines (set-piece creator). */
export type CornerRoutine = "near_post" | "far_post" | "short" | "edge";
/** Attacking free-kick routines. */
export type FreeKickRoutine = "direct" | "crossed" | "short";

/** The club's set-piece plan: routines, nominated takers and routine familiarity. */
export interface SetPiecePlan {
  corner: CornerRoutine;
  freekick: FreeKickRoutine;
  /** explicit taker ids per discipline (null = auto, best available) */
  takers: { corner: string | null; freekick: string | null; penalty: string | null };
  /** `corner:near_post` → familiarity 0-100 (grows with match practice + set-piece training) */
  familiarity: Partial<Record<string, number>>;
}

/** One possession phase rendered on the 2D pitch: a pass chain + how it ended. */
export interface Stroke {
  m: number; // minute
  h: 0 | 1; // 1 = home in possession
  p: number[]; // pass chain as formation slot indices (0..10)
  o: StrokeOut;
  t?: number; // target x of the final ball (shot / out), 0..100 in the attacking frame
  b?: number; // other-side slot involved: keeper (save), blocker (block), interceptor (turnover)
  r?: number; // index into `events` this stroke produced
  sp?: SetPiece; // set-piece tag (staging + commentary)
  spr?: string; // set-piece routine used (e.g. "near_post", "crossed") — staging detail
  tg?: [number, number]; // staged target point in the attacking side's frame (corners / penalties)
}

export interface MatchSideState {
  clubId: string;
  name: string;
  short: string;
  slots: (string | null)[]; // player id per formation slot (null = sent off / empty)
  poss: Position[]; // designed position of each SLOT (from the formation, not the occupant)
  roles: RoleId[]; // role per slot
  coords: [number, number][]; // formation x/y per slot (x: 0-100 L→R, y: 0-100 opp goal→own goal)
  bench: string[]; // player ids still available to come on
  mentality: Mentality;
  plan: SetPiecePlan; // set-piece routines, takers and familiarity
  goals: number;
  subs: number; // substitutions used (max T.maxSubs)
  windows: number; // in-match substitution windows used (max T.subWindowsMax)
}

export interface MatchState {
  round: number;
  homeId: string;
  awayId: string;
  minute: number; // last simulated minute (0 = not started)
  total: number; // 90 + stoppage
  rngState: number;
  userSide?: "home" | "away";
  home: MatchSideState;
  away: MatchSideState;
  events: MatchEvent[];
  timeline: Stroke[];
  ratings: Record<string, number>;
  updates: Record<string, PlayerUpdate>;
  yellows: Record<string, number>;
  entryMinute: Record<string, number>;
  exitMinute: Record<string, number>;
  played: string[];
  scorers: { playerId: string; name: string; clubId: string; minute: number }[];
  /** per player: which side (0 home / 1 away) and natural position — for post-match ratings */
  pin: Record<string, { s: 0 | 1; pos: Position }>;
}

/** A manager action applied mid-match; replayed deterministically when re-simulating. */
export interface LiveChange {
  minute: number;
  kind: "sub" | "mentality" | "role";
  side: "home" | "away";
  outId?: string;
  inId?: string;
  mentality?: Mentality;
  slot?: number;
  role?: RoleId;
}

export interface LiveMatch {
  base: MatchState; // start-of-current-half snapshot (timeline included up to its minute)
  state: MatchState; // current state simulated to the end of the current half
  half: 1 | 2;
  changes: LiveChange[]; // changes made in the current half (replayed on rebuild)
  playhead: number; // playback minute for the UI (persisted so reloads resume)
}

export interface FormationSlot {
  pos: Position;
  x: number; // 0 = left touchline, 100 = right
  y: number; // 0 = opponent goal, 100 = own goal
  role?: RoleId; // optional preferred role (custom formations — must belong to `pos`)
}

export interface FormationDef {
  id: string; // built-in FormationId or custom "cf-…" id
  name: string;
  slots: FormationSlot[]; // 11 slots
}

export interface Lineup {
  formation: string; // built-in FormationId or custom formation id
  starters: (string | null)[]; // 11 slots
  bench: (string | null)[]; // 7 slots
  mentality: Mentality;
  roles: RoleId[]; // one per starter slot
}

export interface TableRow {
  clubId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  position: number;
}

export interface SaveGame {
  saveVersion: 1;
  seed: number;
  season: number;
  round: number; // next round to play (1..18); 19 => season over
  userClubId: string;
  clubs: Club[];
  players: Player[];
  fixtures: Fixture[];
  lineup: Lineup;
  customFormations: FormationDef[];
  lastResults: MatchResult[];
  lastUserMatch?: MatchResult;
  live?: LiveMatch;
  /** per-club money for the current season (engine/transfers.ts) */
  finances: Record<string, Finances>;
  /** incoming offers for the user's players, pending a decision */
  offers: TransferOffer[];
  /** a fee already agreed with a club, awaiting personal terms (single-deal workflow) */
  pending?: { playerId: string; fee: number; fromClubId: string };
  /** human-readable transfer feed, newest first (capped) */
  transferLog: string[];
  /** the user club's set-piece plan (routines, takers, familiarity) — engine/setpieces.ts */
  setpieces: SetPiecePlan;
  /** the user club's training plan (engine/training.ts) */
  training: TrainingPlan;
  /** training/development news lines (trait learning, academy intake…), newest first */
  devNews: string[];
}
