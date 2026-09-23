import type { Club, WorldLeague, Facilities, FormationId, Lineup, Player, Position, SaveGame } from "./types";
import { hashSeed, mulberry32, pick, randInt, type Rng } from "./rng";
import { traitsFor } from "./traits";
import { FORMATIONS, T } from "./tuning";
import { autoLineup } from "./ratings";
import { builtinFormation } from "./formations";
import { buildFixtures } from "./league";
import { makeFriendlies } from "./preseason";
import { DEFAULT_PLAN } from "./week";
import { makeCup } from "./cup";
import { heightFor } from "./aerial";
import { contractFor, freshFinances } from "./transfers";
import { peakFor } from "./training";
import { FACILITY_MAX, makeSponsorOffers } from "./commercial";
import { defaultSetPieces } from "./setpieces";
import { initScouting } from "./scouting";
import { emptyAwards, emptyHistory } from "./history";
import { emptyMedia, makePress } from "./media";
import { policyFor } from "./market";
import { NATIONS, clubIdFor, nationById, type NationDef } from "./nations";

export { CLUB_DEFS } from "./nations";

const EN = NATIONS[0];
const FIRST = EN.first;
const LAST = EN.last;

function makePlayer(
  rng: Rng,
  clubId: string,
  idx: number,
  pos: Position,
  strength: number,
  pools: { first: string[]; last: string[] } = { first: FIRST, last: LAST }
): Player {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi);
  const base = r(T.attrRange[0], T.attrRange[1]) + Math.round(strength * 0.8);
  const j = (v: number) => Math.max(28, Math.min(96, v + r(-6, 6)));
  /**
   * Attributes that do not belong to his position live in a low band — 42 to 58
   * (7–10 on the 1–20 scale, "poor", never mid-table) — and are additionally
   * capped below the attributes that define the role, so the shape is structural
   * rather than luck: a keeper's shooting can never reach his reflexes, a
   * defender's can never reach his defending, a forward's defending can never
   * reach his shooting. 42 is the generator's floor: a 1 on the 1–20 scale stays
   * reserved for filler, never a real player's real attribute.
   */
  const off = (lo: number, hi: number, cap?: number) => {
    const v = Math.max(42, Math.min(hi, lo + r(0, 6)));
    return Math.max(28, cap === undefined ? v : Math.min(v, cap));
  };

  let attrs: Player["attrs"];
  switch (pos) {
    case "GK": {
      const keep = j(base + 12);
      const hand = j(base + 10);
      attrs = {
        reflexes: keep,
        handling: hand,
        physical: j(base),
        pace: off(44, 58, Math.min(keep, hand) - 8),
        passing: j(base - 8),
        shooting: off(42, 50, Math.min(keep, hand) - 14),
        defending: j(base - 10)
      };
      break;
    }
    case "DF": {
      const def = j(base + 12);
      attrs = {
        defending: def,
        physical: j(base + 8),
        pace: j(base + 2),
        passing: j(base - 2),
        shooting: off(42, 56, def - 8),
        reflexes: off(42, 52, def - 10),
        handling: off(42, 50, def - 12)
      };
      break;
    }
    case "MF": {
      const pass = j(base + 10);
      attrs = {
        passing: pass,
        pace: j(base + 2),
        defending: j(base),
        shooting: j(base - 2),
        physical: j(base - 4),
        reflexes: off(42, 52, pass - 6),
        handling: off(42, 50, pass - 8)
      };
      break;
    }
    case "FW": {
      const shot = j(base + 12);
      attrs = {
        shooting: shot,
        pace: j(base + 8),
        passing: j(base - 4),
        defending: off(42, 52, shot - 10),
        physical: j(base - 2),
        reflexes: off(42, 50, shot - 12),
        handling: off(42, 48, shot - 14)
      };
      break;
    }
  }

  let name = `${pick(rng, pools.first)} ${pick(rng, pools.last)}`;
  if (name.split(" ")[0] === name.split(" ")[1]) {
    name = `${pick(rng, pools.first)} ${pick(rng, pools.last)}`;
  }

  const id = `p${clubId}-${idx}`;
  const age = randInt(rng, T.ageRange[0], T.ageRange[1]);

  const player: Player = {
    id,
    clubId,
    name,
    age,
    // height comes from his own id, so no rng draw is spent and old saves match
    height: heightFor(id, pos),
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

/** The leagues outside yours: real clubs, real squads, light results (v0.38). */
/**
 * Seats per ground (v0.39).
 *
 * Capacity used to fall out of the stadium facility level — five values, so
 * almost every club ended up on 12,000 seats. It is now the club's own: seeded
 * off its id (never an RNG draw, so existing worlds and streams do not move),
 * scaled by what the club has actually won and how strong the squad is, drawn
 * from a long-tailed distribution so a division contains 5,000-seat grounds,
 * a crowd of mid-sized ones, and one or two cathedrals.
 */
const CROWD_SCALE: Record<string, number> = { eng: 1.0, esp: 0.95, ger: 1.14, ita: 0.92 };
const CROWD_BOUNDS: Record<string, [number, number]> = {
  eng: [5_000, 74_000],
  esp: [6_000, 81_000],
  ger: [8_000, 81_000],
  ita: [7_000, 76_000]
};

/** One standard normal from two uniforms (the id hash is our only randomness). */
function gauss(a: number, b: number): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, a))) * Math.cos(2 * Math.PI * b);
}

/**
 * Seats for one ground. Anchored on what the club has won and how good the squad
 * is (a minnow ≈ 8,500 seats, a nine-title giant ≈ 70,000), multiplied by a
 * log-normal draw so the spread has a real tail — a division ends up with small
 * grounds, a crowd of mid-sized ones and one or two cathedrals, and no two clubs
 * share a number. Quantised to a quarter-thousand so it reads like a real
 * capacity rather than a random float.
 */
export function capacityFor(nationId: string, clubId: string, honours: number, strength: number): number {
  const rng = mulberry32(hashSeed(clubId, "capacity"));
  const [lo, hi] = CROWD_BOUNDS[nationId] ?? [5_000, 74_000];
  const prestige = honours * 2.6 + strength * 1.1;
  const anchor = (8_500 + Math.max(0, prestige) * 1_650) * (CROWD_SCALE[nationId] ?? 1);
  const draw = Math.exp(0.38 * gauss(rng(), rng()));
  const jitter = 0.95 + rng() * 0.1;
  const raw = anchor * draw * jitter;
  const q = raw < 20_000 ? 250 : 500;
  return Math.max(lo, Math.min(hi, Math.round(raw / q) * q));
}

/** No two clubs in a league share a capacity: nudge the collisions apart. */
export function dedupeCapacities(clubs: Club[]): void {
  const seen = new Map<number, number>();
  for (const club of clubs) {
    if (club.capacity === undefined) continue;
    const hits = seen.get(club.capacity) ?? 0;
    seen.set(club.capacity, hits + 1);
    if (hits === 0) continue;
    let bumped = club.capacity + hits * 250;
    const seenBumped = new Set(seen.keys());
    while (seenBumped.has(bumped)) bumped += 250;
    club.capacity = bumped;
    seen.set(bumped, 1);
  }
}

export function makeWorldLeagues(
  seed: number,
  exclude: string,
  season: number
): { leagues: WorldLeague[]; clubs: Club[]; players: Player[] } {
  const worldRng = mulberry32(hashSeed(seed, "outside"));
  const clubs: Club[] = [];
  const players: Player[] = [];
  const leagues: WorldLeague[] = [];
  for (const other of NATIONS) {
    if (other.id === exclude) continue;
    const wc: Club[] = other.clubs.map((def, i) => ({
      id: clubIdFor(other.id, i),
      name: def.name,
      short: def.short,
      color: def.color,
      strength: T.strengthOffsets[i] ?? 0,
      formation: pick(worldRng, Object.keys(FORMATIONS)) as FormationId,
      city: def.city,
      ground: def.ground,
      founded: def.founded,
      honours: def.honours,
      capacity: capacityFor(other.id, clubIdFor(other.id, i), def.honours, T.strengthOffsets[i] ?? 0)
    }));
    const wp: Player[] = [];
    for (const club of wc) {
      let n = 0;
      (Object.keys(T.squad) as Position[]).forEach((pos) => {
        for (let k = 0; k < T.squad[pos]; k++) {
          wp.push(makePlayer(worldRng, club.id, n++, pos, club.strength, { first: other.first, last: other.last }));
        }
      });
    }
    dedupeCapacities(wc);
    clubs.push(...wc);
    players.push(...wp);
    leagues.push({
      id: other.id,
      country: other.country,
      name: other.league,
      clubs: wc,
      players: wp,
      fixtures: buildFixtures(wc, season, seed)
    });
  }
  return { leagues, clubs, players };
}

export function newGame(seed: number, userClubId?: string, nationId?: string): SaveGame {
  const rng = mulberry32(hashSeed(seed, "world"));
  const nation = nationById(nationId ?? "eng");

  const makeClubs = (n: NationDef): Club[] =>
    n.clubs.map((def, i) => ({
      id: clubIdFor(n.id, i),
      name: def.name,
      short: def.short,
      color: def.color,
      strength: T.strengthOffsets[i] ?? 0,
      formation: pick(rng, Object.keys(FORMATIONS)) as FormationId,
      // the public details are part of the club: editable, and real for every nation
      city: def.city,
      ground: def.ground,
      founded: def.founded,
      honours: def.honours,
      capacity: capacityFor(n.id, clubIdFor(n.id, i), def.honours, T.strengthOffsets[i] ?? 0)
    }));

  const makeSquad = (clubs: Club[], pools: { first: string[]; last: string[] }): Player[] => {
    const out: Player[] = [];
    for (const club of clubs) {
      let n = 0;
      (Object.keys(T.squad) as Position[]).forEach((pos) => {
        for (let k = 0; k < T.squad[pos]; k++) {
          out.push(makePlayer(rng, club.id, n++, pos, club.strength, pools));
        }
      });
    }
    return out;
  };

  const clubs = makeClubs(nation);
  dedupeCapacities(clubs);
  const players = makeSquad(clubs, { first: nation.first, last: nation.last });

  const chosen = userClubId && clubs.some((c) => c.id === userClubId) ? userClubId : clubs[0].id;
  const fixtures = buildFixtures(clubs, 1, seed);
  // pre-season opens three weeks early with three friendlies (v0.27)
  const friendlies = makeFriendlies({ seed, clubs, userClubId: chosen }, 1);
  fixtures.push(...friendlies);
  const lineup: Lineup = autoLineup(
    players.filter((p) => p.clubId === chosen),
    builtinFormation("4-3-3")
  );

  // the rest of Europe (v0.38): built from its own stream, so your league is
  // byte-for-byte what it was before the continent existed
  const outside = makeWorldLeagues(seed, nation.id, 1);
  const world = outside.leagues;
  const finances = freshFinances({ clubs: [...clubs, ...outside.clubs], players: [...players, ...outside.players] });
  // a brand-new club has no shirt deal: the market is open from day one


  const save: SaveGame = {
    saveVersion: 1,
    seed,
    season: 1,
    round: -3,
    phase: "pre",
    userClubId: chosen,
    nation: nation.id,
    country: nation.country,
    leagueName: nation.league,
    clubs,
    facilities: makeFacilities(clubs),
    day: 0,
    weekPlan: [...DEFAULT_PLAN],
    players,
    world,
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

  // the Challenge Cup: drawn on day one (v0.36)
  save.cup = makeCup(save);

  return save;
}
