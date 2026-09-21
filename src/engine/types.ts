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
  | "inside";

export interface PlayerAttrs {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  reflexes: number;
  handling: number;
}

export interface Player {
  id: string;
  clubId: string;
  name: string;
  age: number;
  pos: Position;
  attrs: PlayerAttrs;
  condition: number; // 0-100
  injuredWeeks: number; // 0 = fit
  suspension: number; // matches left to sit out; 0 = available
  apps: number;
  goals: number;
  assists: number;
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
  | "full";

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
}
