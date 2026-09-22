import type { Club, Facilities, FormationId, Lineup, Player, Position, SaveGame } from "./types";
import { hashSeed, mulberry32, pick, randInt, type Rng } from "./rng";
import { traitsFor } from "./traits";
import { FORMATIONS, T } from "./tuning";
import { autoLineup } from "./ratings";
import { builtinFormation } from "./formations";
import { buildFixtures } from "./league";
import { makeFriendlies } from "./preseason";
import { contractFor, freshFinances } from "./transfers";
import { peakFor } from "./training";
import { FACILITY_MAX, makeSponsorOffers } from "./commercial";
import { defaultSetPieces } from "./setpieces";
import { initScouting } from "./scouting";
import { emptyAwards, emptyHistory } from "./history";
import { emptyMedia, makePress } from "./media";
import { policyFor } from "./market";

export const CLUB_DEFS: ReadonlyArray<{ name: string; short: string; color: string }> = [
  { name: "Northport FC", short: "NOR", color: "#2ED573" },
  { name: "Ironvale United", short: "IRV", color: "#4DABF7" },
  { name: "Ashford Town", short: "ASH", color: "#FFB020" },
  { name: "Westgate Rovers", short: "WGR", color: "#B197FC" },
  { name: "Kingsbury AFC", short: "KGB", color: "#FF8787" },
  { name: "Brackenfield City", short: "BRK", color: "#63E6BE" },
  { name: "Stonebridge FC", short: "STB", color: "#FFA94D" },
  { name: "Marlowe Wanderers", short: "MAR", color: "#74C0FC" },
  { name: "Redmoor Athletic", short: "RDM", color: "#F783AC" },
  { name: "Fairhaven FC", short: "FAI", color: "#C0EB75" }
];

const FIRST = [
  "Jack", "Liam", "Owen", "Noah", "Ethan", "Mason", "Leo", "Kai", "Ryan", "Cole",
  "Finn", "Jude", "Milo", "Arlo", "Ezra", "Nico", "Theo", "Luca", "Hugo", "Dean",
  "Reid", "Troy", "Vince", "Joel", "Sam", "Abe", "Rory", "Neil", "Curtis", "Brad",
  "Frank", "Hank", "Isaac", "Miles", "Nate", "Oscar", "Pete", "Quinn", "Rex", "Seth"
];

const LAST = [
  "Mora", "Okafor", "Silva", "Costa", "Baker", "Hayes", "Reed", "Cole", "Shaw",
  "Mills", "Frost", "Nash", "Doyle", "Boyd", "Chambers", "Ellis", "Fletcher",
  "Grant", "Hale", "Irving", "Jennings", "Keller", "Lawson", "Mercer", "Nolan",
  "Ortiz", "Pike", "Quill", "Rowan", "Sutton", "Tate", "Underwood", "Vance",
  "Walker", "Yates", "Zimmer", "Abbott", "Barrett", "Cannon", "Dalton", "Eaton",
  "Farrell", "Gibson", "Holmes", "Ingram", "Joyce", "Keane", "Lombardi", "Marin",
  "Novak", "Olsen", "Pardo", "Rivas", "Stanton", "Thorne", "Urbina", "Vega",
  "Walsh", "Whitlock"
];

function makePlayer(
  rng: Rng,
  clubId: string,
  idx: number,
  pos: Position,
  strength: number
): Player {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi);
  const base = r(T.attrRange[0], T.attrRange[1]) + Math.round(strength * 0.8);
  const j = (v: number) => Math.max(28, Math.min(96, v + r(-6, 6)));

  let attrs: Player["attrs"];
  switch (pos) {
    case "GK":
      attrs = {
        reflexes: j(base + 12), handling: j(base + 10), physical: j(base),
        pace: j(base - 18), passing: j(base - 8), shooting: j(base - 30),
        defending: j(base - 10)
      };
      break;
    case "DF":
      attrs = {
        defending: j(base + 12), physical: j(base + 8), pace: j(base + 2),
        passing: j(base - 2), shooting: j(base - 16), reflexes: j(base - 30),
        handling: j(base - 30)
      };
      break;
    case "MF":
      attrs = {
        passing: j(base + 10), pace: j(base + 2), defending: j(base),
        shooting: j(base - 2), physical: j(base - 4), reflexes: j(base - 30),
        handling: j(base - 30)
      };
      break;
    case "FW":
      attrs = {
        shooting: j(base + 12), pace: j(base + 8), passing: j(base - 4),
        defending: j(base - 18), physical: j(base - 2), reflexes: j(base - 30),
        handling: j(base - 30)
      };
      break;
  }

  let name = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
  if (name.split(" ")[0] === name.split(" ")[1]) name = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;

  const id = `p${clubId}-${idx}`;
  const age = randInt(rng, T.ageRange[0], T.ageRange[1]);

  const player: Player = {
    id,
    clubId,
    name,
    age,
    pos,
    attrs,
    // deterministic per player id so existing saves backfill identically
    traits: traitsFor({ id, pos, attrs, age } as Player, mulberry32(hashSeed(id, "traits"))),
    contract: { wage: 0, until: 0 },
    peak: 0,
    morale: 60,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    sharpness: 85,
    jaded: 0,
    caps: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: []
  };
  player.contract = contractFor(player, 1);
  player.peak = peakFor(player);
  return player;
}

/** A campus per club: bigger clubs have better everything, with a little spread. */
function makeFacilities(clubs: Club[]): Record<string, Facilities> {
  const out: Record<string, Facilities> = {};
  clubs.forEach((c, i) => {
    const rng = mulberry32(hashSeed(`fac-${c.id}-${i}`));
    const big = i < 3 ? 1 : 0;
    const lvl = (spread: number) =>
      Math.max(1, Math.min(FACILITY_MAX, 2 + big + (rng() < spread ? -1 : rng() < 0.3 ? 1 : 0)));
    out[c.id] = {
      stadium: Math.max(1, Math.min(FACILITY_MAX, 2 + (i < 2 ? 2 : i < 5 ? 1 : 0))),
      training: lvl(0.4),
      youth: lvl(0.4),
      medical: lvl(0.4)
    };
  });
  return out;
}

export function newGame(seed: number, userClubId?: string): SaveGame {
  const rng = mulberry32(hashSeed(seed, "world"));

  const clubs: Club[] = CLUB_DEFS.map((def, i) => ({
    id: `c${i + 1}`,
    name: def.name,
    short: def.short,
    color: def.color,
    strength: T.strengthOffsets[i] ?? 0,
    formation: pick(rng, Object.keys(FORMATIONS)) as FormationId
  }));

  const players: Player[] = [];
  for (const club of clubs) {
    let n = 0;
    (Object.keys(T.squad) as Position[]).forEach((pos) => {
      for (let k = 0; k < T.squad[pos]; k++) {
        players.push(makePlayer(rng, club.id, n++, pos, club.strength));
      }
    });
  }

  const chosen = userClubId && clubs.some((c) => c.id === userClubId)
    ? userClubId
    : clubs[0].id;
  const fixtures = buildFixtures(clubs, 1, seed);
  // pre-season opens three weeks early with three friendlies (v0.27)
  const friendlies = makeFriendlies({ seed, clubs, userClubId: chosen }, 1);
  fixtures.push(...friendlies);
  const lineup: Lineup = autoLineup(
    players.filter((p) => p.clubId === chosen),
    builtinFormation("4-3-3")
  );

  const finances = freshFinances({ clubs, players });
  // a brand-new club has no shirt deal: the market is open from day one


  const save: SaveGame = {
    saveVersion: 1,
    seed,
    season: 1,
    round: -3,
    phase: "pre",
    userClubId: chosen,
    clubs,
    facilities: makeFacilities(clubs),
    players,
    fixtures,
    lineup,
    customFormations: [],
    lastResults: [],
    finances,
    offers: [],
    transferLog: [],
    training: { unit: "balanced", intensity: "normal" },
    setpieces: defaultSetPieces(),
    scouting: initScouting(seed, finances[chosen]?.transfer ?? 1_000_000),
    history: emptyHistory(),
    awards: emptyAwards(),
    media: emptyMedia(),
    debts: [],
    preContracts: [],
    policy: policyFor({ seed, clubs, players }, 1),
    devNews: []
  };
  makePress(save); // the press want a word before the opener
  // …and it belongs to the league opener, not the friendly weeks
  if (save.media?.press) save.media.press.round = 1;
  // the shirt is on the market from day one
  save.sponsorOffers = makeSponsorOffers(save);
  return save;
}
