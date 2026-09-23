import type { Club, Facilities, SaveGame } from "./types";
import { facilitiesOf, groundCapacity, sponsorWeekly } from "./commercial";
import { squadValue, wageBill } from "./transfers";
import { overallFor, squadOf } from "./ratings";

/**
 * Manager onboarding (v0.32.0): what a manager knows about a club *before* he
 * takes the job. Public facts are exact; money and squad quality are fogged into
 * bands — the way a real candidate reads a club from the outside.
 */

export interface ClubLore {
  city: string;
  founded: number;
  stadium: string;
  honours: number;
  /** the club's public identity, one line */
  identity: string;
}

/** Public history for the ten clubs. Fiction, but consistent fiction. */
export const CLUB_LORE: Record<string, ClubLore> = {
  c1: { city: "Northport", founded: 1898, stadium: "The Dockside", honours: 7, identity: "The city's heavyweight — expect trophies, expect the board at your door." },
  c2: { city: "Ironvale", founded: 1904, stadium: "Forge Park", honours: 4, identity: "Steel-town money and a restless crowd that remembers the glory years." },
  c3: { city: "Ashford", founded: 1911, stadium: "Watling Road", honours: 2, identity: "Solid, unfashionable, hard to beat at home — a manager's club." },
  c4: { city: "Westgate", founded: 1922, stadium: "The Rovers Bowl", honours: 1, identity: "Sleeping giant with a big ground and a budget that never quite matches it." },
  c5: { city: "Kingsbury", founded: 1930, stadium: "Crown Lane", honours: 0, identity: "Never won it. Loud, loyal, and convinced this is the year." },
  c6: { city: "Brackenfield", founded: 1936, stadium: "The Heath", honours: 3, identity: "New money and a modern club that expects to be taken seriously." },
  c7: { city: "Stonebridge", founded: 1944, stadium: "Bridge End", honours: 2, identity: "Well run, well coached, and quietly in the conversation every spring." },
  c8: { city: "Marlowe", founded: 1951, stadium: "Grange Park", honours: 0, identity: "A yo-yo club with a fine academy and no money — a coach's project." },
  c9: { city: "Redmoor", founded: 1963, stadium: "The Quarry", honours: 0, identity: "Small ground, tight budget, a squad that runs through walls." },
  c10: { city: "Fairhaven", founded: 1970, stadium: "Seaview", honours: 0, identity: "The league's newest club. Everything to build, nothing to lose." },
  c11: { city: "Harborough", founded: 1921, stadium: "The Weir", honours: 2, identity: "Old money, older stand, and a scouting network nobody else can match." },
  c12: { city: "Ellesmere", founded: 1928, stadium: "Lakeside", honours: 1, identity: "The prettiest ground in the league and a squad that plays to match it." },
  c13: { city: "Cranford", founded: 1933, stadium: "Albion Fields", honours: 3, identity: "Three titles in the fifties and a board still dining out on them." },
  c14: { city: "Thornbury", founded: 1939, stadium: "The Warren", honours: 0, identity: "A hard town, a hard pitch, and a squad built on graft." },
  c15: { city: "Selby", founded: 1947, stadium: "Park Lane", honours: 1, identity: "Comfortable, mid-table, and happy about it — until the new owner speaks." },
  c16: { city: "Glenmoor", founded: 1954, stadium: "The Bowl", honours: 0, identity: "A big bowl, a small budget, and one of the loudest home ends in the league." },
  c17: { city: "Oxbourne", founded: 1959, stadium: "Riverside", honours: 2, identity: "Well coached, well liked, and always one sale away from a rebuild." },
  c18: { city: "Radcliffe", founded: 1964, stadium: "Wanderers Way", honours: 0, identity: "Two promotions in four years and no intention of stopping." },
  c19: { city: "Wexford", founded: 1968, stadium: "The Harbour", honours: 0, identity: "Salt air, a tight ground, and a manager who has never been relegated." },
  c20: { city: "Larkspur", founded: 1974, stadium: "Meadow End", honours: 0, identity: "The league's youngest club and its most stubborn — nobody enjoys visiting." }
};

export type Band = "elite" | "strong" | "good" | "modest" | "limited";

const BAND_LABEL: Record<Band, string> = {
  elite: "Elite",
  strong: "Strong",
  good: "Good",
  modest: "Modest",
  limited: "Limited"
};

export const bandLabel = (b: Band): string => BAND_LABEL[b];

/** Where a value sits in the division, as five bands from the top. */
export function bandFor(value: number, values: number[]): Band {
  const sorted = [...values].sort((a, b) => b - a);
  const idx = sorted.findIndex((v) => value >= v);
  const rank = idx === -1 ? sorted.length : idx;
  const pct = rank / Math.max(1, sorted.length);
  if (pct < 0.2) return "elite";
  if (pct < 0.4) return "strong";
  if (pct < 0.6) return "good";
  if (pct < 0.8) return "modest";
  return "limited";
}

/** Wealth: the board's money, read from budgets and squad value. */
export function wealthWord(b: Band): string {
  switch (b) {
    case "elite":
      return "Very wealthy";
    case "strong":
      return "Wealthy";
    case "good":
      return "Comfortable";
    case "modest":
      return "Careful with money";
    default:
      return "Shoestring";
  }
}

/** Squad quality, in the language scouts use. */
export function squadWord(b: Band): string {
  switch (b) {
    case "elite":
      return "Title favourites";
    case "strong":
      return "Top-four calibre";
    case "good":
      return "Solid mid-table";
    case "modest":
      return "A battle ahead";
    default:
      return "Survival scrappers";
  }
}

/** A candidate's read on the club's likely expectations. */
export function expectationFor(b: Band): string {
  switch (b) {
    case "elite":
      return "Win the league.";
    case "strong":
      return "Finish in the top three and make a run at it.";
    case "good":
      return "Top half, with a cup-scalp or two.";
    case "modest":
      return "Steady season — no drama, develop the kids.";
    default:
      return "Be competitive. Anything else is a bonus.";
  }
}

export function difficultyFor(b: Band): "Easy" | "Fair" | "Hard" | "Brutal" {
  if (b === "elite") return "Easy";
  if (b === "strong") return "Fair";
  if (b === "good") return "Fair";
  if (b === "modest") return "Hard";
  return "Brutal";
}

export interface ClubBrief {
  id: string;
  name: string;
  short: string;
  color: string;
  lore: ClubLore;
  /** public: the ground and how many it holds */
  stadium: string;
  capacity: number;
  /** public: honours */
  titles: number;
  /** fogged: the money, squad and campus, as words not numbers */
  wealth: string;
  squad: string;
  facilities: { label: string; band: Band }[];
  expectation: string;
  difficulty: "Easy" | "Fair" | "Hard" | "Brutal";
  /** the honest sales pitch */
  pitch: string;
}

/** A club's lore, with the manager's own edits winning (v0.37). */
export function loreFor(club: Club | undefined, clubId: string): ClubLore {
  const base = CLUB_LORE[clubId] ?? { city: "—", founded: 1900, stadium: "The Ground", honours: 0, identity: "" };
  if (!club) return base;
  return {
    city: club.city?.trim() || base.city,
    founded: club.founded ?? base.founded,
    stadium: club.ground?.trim() || base.stadium,
    honours: base.honours,
    identity: base.identity
  };
}

/** Everything the selection screen shows for one club. Exact public facts, fogged money. */
export function clubBrief(save: SaveGame, clubId: string): ClubBrief {
  const club = save.clubs.find((c) => c.id === clubId);
  const lore = loreFor(club, clubId);
  const values = save.clubs.map((c) => squadValue(save, c.id));
  const budgets = save.clubs.map((c) => save.finances?.[c.id]?.transfer ?? 0);
  const squadBand = bandFor(squadValue(save, clubId), values);
  const wealthVal = (save.finances?.[clubId]?.transfer ?? 0) * 0.6 + (save.finances?.[clubId]?.balance ?? 0) * 0.4;
  const wealth = wealthWord(bandFor(wealthVal, budgets.map((b) => b * 0.6 + 4_000_000 * 0.4)));
  const fac = facilitiesOf(save, clubId);
  const facBands: Array<{ label: string; band: Band }> = [
    { label: "Training ground", band: bandFor(fac.training, save.clubs.map((c) => facilitiesOf(save, c.id).training)) },
    { label: "Academy", band: bandFor(fac.youth, save.clubs.map((c) => facilitiesOf(save, c.id).youth)) },
    { label: "Medical centre", band: bandFor(fac.medical, save.clubs.map((c) => facilitiesOf(save, c.id).medical)) }
  ];
  return {
    id: clubId,
    name: club?.name ?? "—",
    short: club?.short ?? "—",
    color: club?.color ?? "#2ED573",
    lore,
    stadium: lore.stadium,
    capacity: groundCapacity(save, clubId),
    titles: lore.honours,
    wealth,
    squad: squadWord(squadBand),
    facilities: facBands,
    expectation: expectationFor(squadBand),
    difficulty: difficultyFor(squadBand),
    pitch: lore.identity
  };
}

export interface JobBrief {
  club: string;
  expectation: string;
  transfer: number;
  wageBudget: number;
  balance: number;
  kittyNote: string;
  bestPlayer: { name: string; pos: string; age: number };
  squadSize: number;
  firstFixture: string | null;
  actions: Array<{ label: string; screen: string }>;
}

/** The briefing the manager gets the moment he takes the job. Exact numbers, at last. */
export function jobBrief(save: SaveGame): JobBrief {
  const brief = clubBrief(save, save.userClubId);
  const fin = save.finances?.[save.userClubId];
  const squad = squadOf(save.players, save.userClubId);
  const best = [...squad].sort((a, b) => overallFor(b) - overallFor(a))[0];
  const first = save.fixtures.find(
    (f) =>
      !f.played &&
      f.friendly !== true &&
      (f.homeId === save.userClubId || f.awayId === save.userClubId)
  );
  const opp = first ? save.clubs.find((c) => c.id === (first.homeId === save.userClubId ? first.awayId : first.homeId)) : undefined;
  return {
    club: brief.name,
    expectation: brief.expectation,
    transfer: fin?.transfer ?? 0,
    wageBudget: fin?.wageBudget ?? 0,
    balance: fin?.balance ?? 0,
    kittyNote: `The board has made ${brief.wealth.toLowerCase() === "very wealthy" ? "serious money" : "some money"} available — spend it like it's yours, because it is.`,
    bestPlayer: best ? { name: best.name, pos: best.pos, age: best.age } : { name: "—", pos: "—", age: 0 },
    squadSize: squad.length,
    firstFixture: first && opp ? `${first.homeId === save.userClubId ? "Home" : "Away"} v ${opp.name}` : null,
    actions: [
      { label: "Set your captain", screen: "squad" },
      { label: "Pick a training focus", screen: "training" },
      { label: "Look at the squad", screen: "squad" }
    ]
  };
}

/** The club's own read of what the shirt is worth — ranked in the division, not a number. */
export function sponsorHint(save: SaveGame, clubId: string): string {
  const mine = sponsorWeekly(save, clubId);
  const band = bandFor(mine, save.clubs.map((c) => sponsorWeekly(save, c.id)));
  switch (band) {
    case "elite":
    case "strong":
      return "Sponsors will queue up for this shirt — the commercial side is a strength.";
    case "good":
      return "A shirt deal worth having.";
    case "modest":
      return "Modest commercial footprint — the crowd carries the balance.";
    default:
      return "Small commercial footprint — grow the crowd and the money follows.";
  }
}

/** A manager's first-day note on the wage bill, without the raw number. */
export function wagePressure(save: SaveGame, clubId: string): string {
  const bill = wageBill(save, clubId);
  const budget = save.finances?.[clubId]?.wageBudget ?? 0;
  const slack = budget - bill;
  if (slack > budget * 0.25) return "Plenty of room under the wage ceiling.";
  if (slack > 0) return "The wage bill is close to the ceiling.";
  return "Already over the wage ceiling — trim or renegotiate.";
}
