import type { Fixture, SaveGame } from "./types";
import { INTENSITIES, UNITS } from "./training";
import { TF, transferWindow } from "./transfers";

/**
 * The season calendar: dates for the fixture list, the training week and the
 * transfer windows. Pure arithmetic — no `Date`, no timezone, no stored state:
 * the same save always renders the same calendar.
 *
 * One round = one week. Season 1 kicks off on Saturday 8 August 2026 and every
 * season after it starts a year later; round R's match day is the Saturday of
 * `seasonStart + (R - 1) weeks`, and the training week runs Mon–Fri ahead of it.
 */

export interface CivilDate {
  y: number;
  m: number; // 0-11
  d: number; // 1-31
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const SEASON_FIRST_YEAR = 2026;
export const SEASON_START_MONTH = 7; // August
export const SEASON_START_DAY = 8; // a Saturday

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y: number, m: number): number =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];

/** days since 1970-01-01 (proleptic Gregorian) — Hinnant's days_from_civil. */
export function serial(date: CivilDate): number {
  const y = date.y - (date.m <= 1 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (date.m + (date.m > 1 ? -2 : 10)) + 2) / 5) + date.d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** inverse of `serial` — civil_from_days. */
export function fromSerial(n: number): CivilDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 2 : -10);
  return { y: y + (m <= 1 ? 1 : 0), m, d };
}

export const addDays = (date: CivilDate, n: number): CivilDate => fromSerial(serial(date) + n);
export const diffDays = (a: CivilDate, b: CivilDate): number => serial(a) - serial(b);
/** 0 = Sunday … 6 = Saturday (serial 0, 1970-01-01, was a Thursday) */
export const dayOfWeek = (date: CivilDate): number => (((serial(date) % 7) + 11) % 7);
export const sameDay = (a: CivilDate, b: CivilDate): boolean =>
  a.y === b.y && a.m === b.m && a.d === b.d;

/** "Sat 19 Sep" */
export const fmtShort = (d: CivilDate): string => `${DOW_SHORT[dayOfWeek(d)]} ${d.d} ${MONTHS_SHORT[d.m]}`;
/** "Saturday 19 September 2026" */
export const fmtLong = (d: CivilDate): string =>
  `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek(d)]} ${d.d} ${MONTH_NAMES[d.m]} ${d.y}`;

/** The Saturday that opens a season. */
export const seasonStart = (season: number): CivilDate => ({
  y: SEASON_FIRST_YEAR + (season - 1),
  m: SEASON_START_MONTH,
  d: SEASON_START_DAY
});

/** Match day for a round of the current season. */
export const roundDate = (season: number, round: number): CivilDate =>
  addDays(seasonStart(season), (round - 1) * 7);

export interface CalMatch {
  round: number;
  oppId: string;
  home: boolean;
  played: boolean;
  gf?: number;
  ga?: number;
  result?: "W" | "D" | "L";
}

export interface CalDay {
  /** a pre-season friendly day (v0.27) */
  friendly?: boolean;
  date: CivilDate;
  dow: number;
  /** the user's match, on match day only */
  match?: CalMatch;
  /** a training session this day (Mon–Fri of a match week) */
  training?: { unit: string; intensity: string; label: string };
  /** things worth marking: windows, the opener, the final day */
  events: string[];
  /** inside the week of the round currently being played */
  currentWeek: boolean;
}

export const seasonRoundsOf = (save: Pick<SaveGame, "clubs">): number => (save.clubs.length - 1) * 2;

/** Monday → Saturday training slots; Sunday is rest. */
const TRAIN_DOW = [1, 2, 3, 4, 5];

const matchFor = (save: SaveGame, round: number): CalMatch | null => {
  const fx = save.fixtures.find(
    (f) => f.round === round && (f.homeId === save.userClubId || f.awayId === save.userClubId)
  );
  if (!fx) return null;
  const home = fx.homeId === save.userClubId;
  const gf = home ? fx.homeGoals : fx.awayGoals;
  const ga = home ? fx.awayGoals : fx.homeGoals;
  const result =
    fx.played && gf !== undefined && ga !== undefined ? (gf > ga ? "W" : gf === ga ? "D" : "L") : undefined;
  return {
    round,
    oppId: home ? fx.awayId : fx.homeId,
    home,
    played: fx.played,
    gf: fx.played ? gf : undefined,
    ga: fx.played ? ga : undefined,
    result
  };
};

/** Everything happening on one date. Returns null outside the season span. */
/** Pre-season friendlies sit on the three Saturdays before the opener (v0.27). */
export const PRE_DAYS = 21;
export const PRE_FRIENDLY_WEEKS = 3;

export const friendlyDate = (season: number, i: number): CivilDate =>
  addDays(seasonStart(season), -(PRE_FRIENDLY_WEEKS - i) * 7);

export function preFriendlyFor(save: SaveGame, date: CivilDate) {
  for (const f of save.fixtures) {
    if (!f.friendly) continue;
    if (sameDay(friendlyDate(save.season, f.round + PRE_FRIENDLY_WEEKS), date)) return f;
  }
  return undefined;
}

/** Shared shape for a calendar entry's match slot. */
function matchFromFixture(save: SaveGame, f: Fixture, round = f.round): NonNullable<CalDay["match"]> {
  const user = save.userClubId;
  const home = f.homeId === user;
  return {
    round,
    oppId: home ? f.awayId : f.homeId,
    home,
    played: f.played,
    gf: home ? f.homeGoals : f.awayGoals,
    ga: home ? f.awayGoals : f.homeGoals,
    ...(f.played
      ? { result: ((home ? f.homeGoals : f.awayGoals) ?? 0) > ((home ? f.awayGoals : f.homeGoals) ?? 0) ? "W" : ((home ? f.homeGoals : f.awayGoals) ?? 0) === ((home ? f.awayGoals : f.homeGoals) ?? 0) ? "D" : "L" }
      : {})
  } as NonNullable<CalDay["match"]>;
}

export function dayFor(save: SaveGame, date: CivilDate): CalDay | null {
  const rounds = seasonRoundsOf(save);
  const start = seasonStart(save.season);
  const firstMonday = addDays(start, -5 - PRE_DAYS); // pre-season opens three weeks early
  const lastSunday = addDays(start, (rounds - 1) * 7 + 1);
  if (diffDays(date, firstMonday) < 0 || diffDays(date, lastSunday) > 0) return null;

  const dow = dayOfWeek(date);
  const weekSaturday = dow === 0 ? addDays(date, -1) : addDays(date, 6 - dow);
  const currentSaturday = addDays(seasonStart(save.season), (Math.min(save.round, rounds) - 1) * 7);
  const day: CalDay = {
    date,
    dow,
    events: [],
    currentWeek: sameDay(weekSaturday, currentSaturday)
  };

  // a pre-season Saturday: a friendly, not a league round
  const pre = preFriendlyFor(save, date);
  if (pre) {
    day.match = matchFromFixture(save, pre);
    day.friendly = true;
    // only ring the friendly week while it is the one being played
    day.currentWeek = pre.round === save.round;
    return day;
  }

  // which round does this week belong to? (the Saturday of the Mon..Sun week)
  const offset = diffDays(weekSaturday, start);
  if (offset < 0 || offset % 7 !== 0) return day;
  const round = offset / 7 + 1;
  if (round < 1 || round > rounds) return day;

  if (dow === 6) {
    const match = matchFor(save, round);
    if (match) day.match = match;
  } else if (TRAIN_DOW.includes(dow)) {
    const plan = save.training;
    const unit = UNITS[plan.unit];
    day.training = {
      unit: plan.unit,
      intensity: plan.intensity,
      label: `${unit?.label ?? plan.unit} · ${INTENSITIES[plan.intensity]?.label ?? plan.intensity}`
    };
  }

  if (round === 1 && dow === 6) day.events.push("Season opener");
  if (round === rounds && dow === 6) day.events.push("Final day");
  const win = transferWindow({ round, clubs: save.clubs });
  if (win.open && dow === 6) {
    if (round === TF.summer[1]) day.events.push("Summer window closes");
    else if (round === TF.summer[0]) day.events.push("Summer window opens");
    else if (round === TF.winter[0]) day.events.push("Winter window opens");
    else if (round === TF.winter[1]) day.events.push("Winter window closes");
  }
  return day;
}

/** Is `date` in the Mon–Sun week containing `saturday`? */
function sameWeek(date: CivilDate, saturday: CivilDate, dow: number): boolean {
  const weekSat = dow === 0 ? addDays(date, -1) : addDays(date, 6 - dow);
  return sameDay(weekSat, saturday);
}

export interface CalMonth {
  y: number;
  m: number;
  label: string;
  /** 6 rows of 7 — nulls are padding outside the month or outside the season */
  weeks: (CalDay | null)[][];
  days: CalDay[];
  first: CivilDate;
  last: CivilDate;
}

/** A month grid for the season the save is in. */
export function calendarMonth(save: SaveGame, y: number, m: number): CalMonth {
  const first: CivilDate = { y, m, d: 1 };
  const last: CivilDate = { y, m, d: daysInMonth(y, m) };
  const days: CalDay[] = [];
  const lead = dayOfWeek(first); // 0 = Sunday
  const cells: (CalDay | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const day = dayFor(save, { y, m, d });
    if (day) days.push(day);
    cells.push(day); // a day outside the season keeps its slot, so the grid stays aligned
  }
  const weeks: (CalDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7);
    while (row.length < 7) row.push(null);
    weeks.push(row);
  }
  while (weeks.length < 6) weeks.push([null, null, null, null, null, null, null]);
  return { y, m, label: `${MONTH_NAMES[m]} ${y}`, weeks, days, first, last };
}

/** The months the season touches, in order (for prev/next paging). */
export function seasonMonths(save: SaveGame): { y: number; m: number }[] {
  const start = addDays(seasonStart(save.season), -5 - PRE_DAYS);
  const end = addDays(seasonStart(save.season), (seasonRoundsOf(save) - 1) * 7 + 1);
  const out: { y: number; m: number }[] = [];
  let cur: CivilDate = { y: start.y, m: start.m, d: 1 };
  while (diffDays(cur, end) <= 0) {
    out.push({ y: cur.y, m: cur.m });
    cur = cur.m === 11 ? { y: cur.y + 1, m: 0, d: 1 } : { y: cur.y, m: cur.m + 1, d: 1 };
  }
  return out;
}

export interface UpcomingEntry {
  round: number;
  date: CivilDate;
  oppId: string;
  home: boolean;
  /** the week's training focus */
  training: string;
}

/** The next `n` fixtures from the current round on. */
export function upcoming(save: SaveGame, n = 5): UpcomingEntry[] {
  const rounds = seasonRoundsOf(save);
  const out: UpcomingEntry[] = [];
  for (let r = save.round; r <= rounds && out.length < n; r++) {
    const m = matchFor(save, r);
    if (!m || m.played) continue;
    const unit = UNITS[save.training.unit];
    out.push({
      round: r,
      date: roundDate(save.season, r),
      oppId: m.oppId,
      home: m.home,
      training: `${unit?.label ?? save.training.unit} · ${INTENSITIES[save.training.intensity]?.label ?? save.training.intensity}`
    });
  }
  return out;
}
