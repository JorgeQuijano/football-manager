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

// --- scouting ----------------------------------------------------------------------

/** A member of the scouting staff (or a candidate in the pool). */
export interface Scout {
  id: string;
  name: string;
  /** accuracy 0-100 — how tight and unbiased his reports are */
  judging: number;
  /** 0.8-1.2 — how fast he works through a report */
  speed: number;
  /** one-off hiring fee (£) */
  fee: number;
}

/** An active scouting job: a single player, or a recruitment focus (a filter). */
export type ScoutRequest =
  | { id: string; kind: "player"; playerId: string; scoutId: string }
  | {
      id: string;
      kind: "focus";
      scoutId: string;
      pos: Position | "any";
      maxAge: number;
      /** minimum potential in stars relative to your squad (0.5-5) */
      minPotStars: number;
    };

/** How much your club knows about a player (0-100) and when it was last refreshed. */
export interface ScoutKnowledge {
  level: number;
  seen: number; // season of the last report
  /** the scout who filed the last report (drives estimate accuracy) */
  by?: string;
}

export interface ScoutingState {
  scouts: Scout[]; // hired staff (max 3)
  pool: Scout[]; // candidates available to hire
  requests: ScoutRequest[];
  /** playerId → knowledge */
  knowledge: Record<string, ScoutKnowledge>;
  /** newly surfaced players (report inbox), newest first */
  reports: string[];
  shortlist: string[];
  /** money left for this season's scouting (refreshed each pre-season) */
  budget: number;
}

/** One line of a player's recent-match log (user club only). */
export interface PlayerMatch {
  se: number; // season
  r: number; // round
  opp: string; // opponent short name
  h: boolean; // home
  rt: number; // match rating
  m: number; // minutes
  g: number; // goals
  a: number; // assists
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
  /** set while he is on loan (either direction) — engine/loans.ts */
  loan?: Loan;
  /** the manager has made him available (raises interest, upsets him) */
  transferListed?: boolean;
  /** a cut of any future sale is owed to this club */
  sellOnTo?: { clubId: string; pct: number };
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
  /** season minutes played (reset each pre-season) */
  mins: number;
  /** season cards */
  yellows: number;
  reds: number;
  /** season rating accumulator (4.0-10.0 per match) */
  ratingSum: number;
  ratingCount: number;
  /** last up to 6 match ratings, newest first — the form guide */
  form: number[];
  /** rounds since his last appearance (3+ = his streak has gone cold) */
  formMiss?: number;
  /** recent matches for the user's players, newest first (capped) */
  history: PlayerMatch[];
  /** morale 0-100 (60 = neutral); drives match edge, training gain and contract talks */
  morale?: number;
  /** minutes of the last up-to-8 league rounds, newest first — the playing-time window */
  recentMin?: number[];
  /** consecutive rounds spent miserable (transfer-request countdown) */
  unhappyRounds?: number;
  /** he has asked to leave */
  transferRequest?: boolean;
  /** absolute round (season*1000+round) of the last individual chat */
  lastTalk?: number;
  /** what was said last */
  talkKind?: "praise" | "warn" | "reassure" | "challenge";
  /** fired up by a challenge: a small match edge until this round */
  pumped?: { until: number; amount: number };
  /** promised minutes in this round (v0.28) */
  pledge?: { round: number; minutes: number };
  /** career league totals per club (folded in each pre-season) — club record books */
  totals?: Record<string, ClubTotals>;
  /** league titles won (honours) */
  titles?: number;
  /** match fitness 0-100 (85 = match-fit) — rises with minutes, falls away when out */
  sharpness?: number;
  /** accumulated wear from being overplayed 0-100 — costs him late in games */
  jaded?: number;
  /** international caps won (honours) */
  caps?: number;
  /** secondary positions he can cover — engine/individual.ts (retraining) */
  altPos?: Position[];
  /** a position he is learning */
  retrain?: { pos: Position; progress: number };
  /** a move (trait) he is learning */
  moveProgress?: { trait: TraitId; progress: number };
  /** this season's personal target */
  target?: PlayerTarget;
}

export type InboxKind = "match" | "transfer" | "press" | "discipline" | "board" | "club";

/** One line in the club inbox — engine/inbox.ts. */
export interface InboxItem {
  id: string;
  season: number;
  round: number;
  kind: InboxKind;
  title: string;
  body?: string;
  read: boolean;
  playerId?: string;
  screen?: string;
}

/** An individual target the manager has set for a player this season. */
export interface PlayerTarget {
  kind: "goals" | "apps" | "rating";
  value: number;
  season: number;
  ambitious?: boolean;
}

/** A player's deal: weekly wage and the last season it covers. */
export interface Contract {
  wage: number; // £/week
  until: number; // expires at the end of this season
  /** one-off signing bonus (£), paid on completion */
  signingBonus?: number;
  /** £ paid per appearance / per goal */
  perApp?: number;
  perGoal?: number;
  /** a fee at which any club may buy him out */
  releaseClause?: number;
  /** extra seasons the club may trigger (one-shot) */
  extensionYears?: number;
}

/** A loan: either one of yours out, or someone else's in (engine/loans.ts). */
export interface Loan {
  fromClubId: string; // the owner
  toClubId: string; // the borrower
  wageShare: number; // 0-1 — how much of the wage the borrower pays
  fee: number; // loan fee paid by the borrower
  optionFee?: number; // the borrower may make it permanent for this
  obligation?: boolean; // …or must, at the end of the season
  until: number; // the season the loan ends
}

/** How a transfer fee is paid (engine/transfers.ts). */
export interface DealTerms {
  fee: number;
  /** seasons the fee is spread over (1 = all cash now) */
  instalments?: number;
  /** £X once he has played N games */
  addon?: { apps: number; amount: number };
  /** % of a future fee owed to the seller */
  sellOn?: number;
  /** loan deal instead of a permanent one */
  loan?: { wageShare: number; fee: number; optionFee?: number; obligation?: boolean };
}

/** Money owed to another club, paid at the rollovers. */
export interface Debt {
  id: string;
  clubId: string; // who we owe
  amount: number;
  dueSeason: number;
  reason: string;
  playerId?: string;
  /** transfer add-on: paid once the player has this many appearances */
  addonApps?: number;
}

/** The board's line in the market for this season. */
export interface BoardPolicy {
  label: string;
  /** hard: don't sanction signings older than this */
  maxAge?: number;
  /** hard: no single deal above this fee */
  maxFee?: number;
  /** soft: the board would rather you shopped under this age */
  preferAge?: number;
  /** soft: keep a new contract at or under this wage */
  maxWage?: number;
}

/** A free transfer agreed for the end of the season (engine/market.ts). */
export interface PreContract {
  id: string;
  playerId: string;
  clubId: string; // who he is joining
  wage: number;
  years: number;
  season: number;
}

/** Club money for the current season; see engine/transfers.ts. */
export interface Finances {
  transfer: number; // available transfer budget
  wageBudget: number; // weekly wage ceiling
  /** the club's own money: commercial income in, facility spending out (engine/commercial.ts) */
  balance: number;
}

/** The campus: each 1..5 (training/academy neutral at level 2, medical at level 2 too). */
export interface Facilities {
  stadium: number;
  training: number;
  youth: number;
  medical: number;
}

/** A main-shirt sponsorship, in weekly money until the end of `until`. */
export interface SponsorDeal {
  name: string;
  weekly: number;
  seasons: number;
  until: number;
  bonus: number;
}

/** One offer on the shirt, waiting for an answer. */
export interface SponsorOffer extends SponsorDeal {
  id: string;
  tagline: string;
}

/** Work in progress on a facility (user club only). */
export interface Build {
  kind: "stadium" | "training" | "youth" | "medical";
  to: number;
  weeksLeft: number;
  cost: number;
}

/** An offer for one of the user's players, waiting for accept / reject. */
export interface TransferOffer {
  id: string;
  playerId: string;
  fromClubId: string; // bidding club
  fee: number;
  day: string; // context label, e.g. "R9 · winter window"
  /** a loan offer rather than a permanent one */
  kind?: "permanent" | "loan";
  loan?: { wageShare: number; fee: number; optionFee?: number };
  /** the bidding club has triggered a release clause — refusing is not an option */
  clause?: boolean;
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
  round: number; // 1..18 (negative rounds are pre-season friendlies)
  /** a pre-season friendly: sharpness and form, never the table (v0.27) */
  friendly?: boolean;
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
  | "penalty"
  | "offside"
  | "var"
  | "info";

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
  /** why he went: a second booking or a straight red — different bans (engine/discipline.ts) */
  redKind?: "straight" | "second";
  injuredWeeks: number; // if > 0, newly injured
  conditionLoss: number;
}

/** One shot from a finished match — the raw material for the data hub. */
export interface MatchShot {
  m: number;
  /** true when the home side took it */
  home: boolean;
  /** shot position in the attacking frame (y 0 = the goal being attacked) */
  x: number;
  y: number;
  /** target x of the strike */
  t?: number;
  xg: number;
  out: StrokeOut;
  setPiece?: SetPiece | null;
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
  /** every shot of the match, with its xG (data hub) */
  shots?: MatchShot[];
  /** knockout ties only: decided after extra time */
  aet?: boolean;
  /** knockout ties only: penalty shootout score */
  pens?: { home: number; away: number };
}

// --- live match (pauseable, resumable, renderable) ---------------------------------

export type StrokeOut = "turnover" | "out" | "foul" | "goal" | "save" | "block" | "miss" | "offside";

/** Set-piece tags: staging + commentary hints for the 2D view. */
export type SetPiece = "corner" | "freekick" | "penalty" | "goalkick" | "throw";

// --- on-pitch realism (v0.19): weather, officials, pitch ---------------------------

export type WeatherId = "dry" | "wet" | "rain" | "wind" | "frost";
export type PitchId = "good" | "worn" | "heavy";

/** A weather state and how it bends the match. All factors are 1.0 = neutral. */
export interface WeatherDef {
  id: WeatherId;
  label: string;
  short: string;
  tint: string;
  blurb: string;
  /** finishing multiplier */
  conversion: number;
  /** blocks / interceptions / slips multiplier */
  turnover: number;
  /** corner & second-phase multiplier */
  corner: number;
  /** fouls multiplier */
  fouls: number;
  /** bookings multiplier */
  cards: number;
}

export interface PitchDef {
  id: PitchId;
  label: string;
  blurb: string;
  turnover: number;
  conversion: number;
}

export interface RefDef {
  id: string;
  name: string;
  /** "lenient" | "balanced" | "strict" */
  label: string;
  /** bookings multiplier */
  strictness: number;
  /** penalty-award multiplier */
  pen: number;
}

/** Everything the officials and the elements bring to one round's matches. */
export interface MatchConditions {
  weather: WeatherId;
  ref: string;
  pitch: PitchId;
}

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
  /** VAR outcome tied to this stroke (goals only): the on-field call stood, was overturned, or was restored */
  vr?: "stands" | "overturned" | "restored";
  /** shots only: the chance's expected goals (the model's own probability) */
  xg?: number;
}

// --- match-day levers (v0.23): opposition instructions, player instructions, talks, shouts ----

/** What you tell your players to do about one opponent (engine/talks.ts). */
export interface OppInstruction {
  mark?: "tight" | "loose";
  press?: "often" | "never";
  tackle?: "hard" | "easy";
  show?: "inside" | "outside";
}

/** What you tell one of your own players to do (engine/talks.ts). */
export interface PlayerInstruction {
  shooting?: "often" | "rarely";
  passing?: "direct" | "safe";
  freedom?: "roam" | "hold";
}

export type TalkStage = "pre" | "ht" | "ft";
export type TalkKind = "praise" | "encourage" | "demand" | "warn" | "relax" | "none";
export type ShoutKind = "encourage" | "demand" | "tighten" | "calm";

/** How one opponent instruction bends his game. */
export interface OiEffect {
  involve: number;
  quality: number;
  fouls: number;
}

/** How one player instruction bends his game. */
export interface PiEffect {
  shot: number;
  shotQuality: number;
  assist: number;
  turnover: number;
  defense: number;
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
  /** instructions set on the OPPONENT's players, keyed by their ids */
  oi: Record<string, OppInstruction>;
  /** instructions for this side's own players, keyed by their ids */
  pi: Record<string, PlayerInstruction>;
  /** attacking edge from talks & shouts (0 = neutral, ±0.05 typical) */
  fire: number;
  /** defensive edge from talks & shouts */
  shape: number;
  /** shouts used this match — they lose their effect */
  shouts: number;
  /** "calm down" — fewer fouls from here on */
  calm: boolean;
  talks: Partial<Record<TalkStage, TalkKind>>;
}

export interface MatchState {
  round: number;
  homeId: string;
  awayId: string;
  minute: number; // last simulated minute (0 = not started)
  total: number; // 90 + stoppage
  /** in-match stamina per player on the pitch (0-100) — drifts down as legs go */
  stamina: Record<string, number>;
  /** stamina lost per minute, per player on the pitch (engine/match.ts) */
  staminaRate: Record<string, number>;
  /** weather, referee and pitch for this match (engine/conditions.ts) */
  /** a big match: leaders rise, nerves show (v0.28) */
  big?: boolean;

  cond: MatchConditions;
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
  /** every shot of the match, with its xG (data hub) */
  shots?: MatchShot[];
  /** per player: which side (0 home / 1 away) and natural position — for post-match ratings */
  pin: Record<string, { s: 0 | 1; pos: Position }>;
}

/** A manager action applied mid-match; replayed deterministically when re-simulating. */
export interface LiveChange {
  minute: number;
  kind: "sub" | "mentality" | "role" | "oi" | "pi" | "talk" | "shout";
  side: "home" | "away";
  outId?: string;
  inId?: string;
  mentality?: Mentality;
  slot?: number;
  role?: RoleId;
  /** oi/pi: the player the instruction is about */
  targetId?: string;
  oi?: OppInstruction;
  pi?: PlayerInstruction;
  /** talk: which stage of the match the words were said */
  stage?: TalkStage;
  talk?: TalkKind;
  shout?: ShoutKind;
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

// --- history, records & awards (engine/history.ts) -----------------------------------

/** League totals for one player at one club. */
export interface ClubTotals {
  apps: number;
  goals: number;
  assists: number;
}

/** A single match result worth remembering. */
export interface WinRecord {
  homeId: string;
  awayId: string;
  hs: number;
  as: number;
  season: number;
  round: number;
}

/** A Player-of-the-Round entry. */
export interface RoundAward {
  season: number;
  round: number;
  playerId: string;
  name: string;
  clubId: string;
  pos: Position;
  rating: number;
}

/** A record-book entry (all-time leaders). */
export interface RecordEntry {
  value: number;
  playerId: string;
  name: string;
  clubId: string;
  season: number;
}

/** One finished season, as it will always be remembered. */
export interface SeasonRecord {
  season: number;
  champion: { clubId: string; name: string; points: number; gf: number; ga: number };
  runnerUp: { clubId: string; name: string; points: number };
  user: { pos: number; pts: number; w: number; d: number; l: number; prize: number };
  topScorer: { playerId: string; name: string; clubId: string; goals: number } | null;
  playerOfSeason: { playerId: string; name: string; clubId: string; rating: number; apps: number } | null;
  teamOfSeason: { playerId: string; name: string; pos: Position; clubId: string }[];
  biggestWin: WinRecord | null;
}

export interface HistoryState {
  seasons: SeasonRecord[];
  /** league titles won by the user's club */
  titles: number;
  allTime: {
    topScorer: RecordEntry | null;
    mostApps: RecordEntry | null;
    bestSeasonGoals: RecordEntry | null;
    bestSeasonRating: RecordEntry | null;
    biggestWin: WinRecord | null;
  };
}

/** The current season's live award state (reset at every rollover). */
export interface AwardState {
  rounds: RoundAward[];
  bestWin: WinRecord | null;
}

// --- media & press (engine/media.ts) -------------------------------------------------

export type HeadlineKind = "report" | "rumour" | "fan" | "press" | "promise";

/** One line in the news feed. */
export interface Headline {
  season: number;
  round: number;
  kind: HeadlineKind;
  tone: "good" | "bad" | "neutral";
  text: string;
}

/** One selectable answer at a press conference. */
export interface PressAnswer {
  label: string;
  reply: string;
  fans: number;
  respect: number;
  morale: number;
  /** a player who feels this answer most (×3 morale) */
  target?: "star" | "worst" | "unhappy";
  /** the answer promises a win this round — the press will check */
  promiseWin?: boolean;
}

export interface PressQuestion {
  id: string;
  hint: string;
  text: string;
  answers: PressAnswer[];
}

export interface PressLogEntry {
  q: string;
  a: string;
  effects: string;
}

/** A press conference waiting to be faced. */
export interface PendingPress {
  season: number;
  round: number;
  questions: PressQuestion[];
  idx: number;
  log: PressLogEntry[];
}

export interface MediaState {
  /** fan confidence 0-100 (50 = neutral) */
  fans: number;
  /** how the press treat you 0-100 */
  respect: number;
  headlines: Headline[];
  press: PendingPress | null;
  promises: { round: number; text: string }[];
  pressCount: number;
  skipped: number;
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
  /** the campus, per club (engine/commercial.ts) */
  facilities: Record<string, Facilities>;
  /** work under way on your facilities */
  builds?: Build[];
  /** your main-shirt deal */
  sponsor?: SponsorDeal;
  /** offers on the shirt waiting for an answer */
  sponsorOffers?: SponsorOffer[];
  /** incoming offers for the user's players, pending a decision */
  offers: TransferOffer[];
  /** a fee already agreed with a club, awaiting personal terms (single-deal workflow) */
  pending?: { playerId: string; fee: number; fromClubId: string; terms?: DealTerms };
  /** human-readable transfer feed, newest first (capped) */
  transferLog: string[];
  /** money owed to other clubs, settled at the season rollovers */
  debts?: Debt[];
  /** the board's line in the market this season */
  policy?: BoardPolicy;
  /** free transfers agreed for the end of the season */
  preContracts?: PreContract[];
  /** the club inbox, newest first (engine/inbox.ts) */
  inbox?: InboxItem[];
  inboxSeq?: number;
  /** pre-season or in the league proper (v0.27) */
  phase?: "pre" | "league";
  /** the last team meeting (v0.28) */
  meeting?: { season: number; round: number; theme: string };
  /** the armband — engine/individual.ts */
  captain?: string;
  vice?: string;
  /** disciplinary decisions this season (newest first, capped) */
  discipline?: { season: number; round: number; playerId: string; kind: "fine" | "warn" | "none" }[];
  /** every signing completed this season — the board judges the window on this */
  windowLog?: { season: number; playerId: string; age: number; wage: number; fee: number }[];
  /** the user club's set-piece plan (routines, takers, familiarity) — engine/setpieces.ts */
  setpieces: SetPiecePlan;
  /** the user club's training plan (engine/training.ts) */
  training: TrainingPlan;
  /** scouting department: staff, requests, knowledge, reports, shortlist (engine/scouting.ts) */
  scouting: ScoutingState;
  /** all-time history, records and titles (engine/history.ts) */
  history: HistoryState;
  /** this season's live awards: player of the round feed + biggest win */
  awards: AwardState;
  /** media & press: fan confidence, headlines, the pending press conference (engine/media.ts) */
  media?: MediaState;
  /** the user club's recent league results, newest first (atmosphere / last-5 strip) */
  recentResults?: { season: number; round: number; oppId: string; h: boolean; gf: number; ga: number }[];
  /** training/development news lines (trait learning, academy intake…), newest first */
  devNews: string[];
}
