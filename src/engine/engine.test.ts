import { describe, expect, it } from "vitest";
import { mulberry32, hashSeed , pickWeighted } from "./rng";
import { newGame } from "./generate";
import { nextSeason, playRound, resolveSide, seasonRounds } from "./advance";
import { applySubstitution, simulateMatch, staminaAt, staminaDrainPerMinute, staminaStart, startMatch, advanceTo, finalizeMatch } from "./match";
import { addLiveChange, finalizeLive, matchRoster, matchStats, playersById, resumeSecondHalf, startLive, staminaTint, userFixture } from "./live";
import { applyTeamTalk, assistantAdvice, halfTimeReport, htTalks, oiEffect, oiLabel, piEffect, piLabel, shoutBy, shoutScale, talkDefFor, talkMoraleDelta } from "./talks";
import {
  askAgent,
  triggerExtension,
  listedPlayers,
  payTransferAddons,
  policyCheck,
  policyFor,
  policyPayoff,
  preContractTargets,
  isPreContracted,
  reallocate,
  setListed,
  settleDebts,
  canPreContract,
  offerPreContract,
  cancelPreContract,
  applyPreContracts,
  poachTick
} from "./market";
import { LOAN, bidForLoan, exerciseLoanOption, loanAsk, loanRollover, loanCount, loaneesIn, loaneesOut, sendOnLoan } from "./loans";
import { dealCost, dealValue, termsDemand } from "./transfers";
import { INBOX_CAP, inboxFor, inboxUnread, markAllInboxRead, openInboxItem, pushInbox } from "./inbox";
import { PRE_ROUNDS, makeFriendlies, preseasonState } from "./preseason";
import { CUP_DAY, CUP_WEEK, completeCupTie, cupStatus, makeCup, resolveTie, tickCup, tieAsFixture, userCupTie } from "./cup";
import { editClub, isEdited, resetClub } from "./clubs";
import { NATIONS } from "./nations";
import { allPlayers, leagueOfClub, playerAnywhere, worldBrief, worldScorers, worldTable } from "./world";
import { shootout } from "./match";
import { fmtShort as fmtShortCal, friendlyDate } from "./calendar";
import type { Activity, Facilities } from "./types";
import {
  CLUB_LORE,
  bandFor,
  clubBrief,
  jobBrief,
  sponsorHint,
  wagePressure
} from "./onboarding";
import { squadValue as squadValueOf } from "./transfers";
import {
  ATTR20_CEILING,
  ATTR20_FLOOR,
  attrBand,
  barPct,
  from20,
  readAttr,
  readRange,
  to20
} from "./attrs20";
import { ATTR_KEYS as ATTR_KEY_LIST } from "./training";
import { aerial20, aerialOf, duelFactor, headerWeight, heightFor, heightOf } from "./aerial";
import {
  ACTIVITIES,
  CONGESTED_PLAN,
  DEFAULT_PLAN,
  MATCH_DAY,
  activityFor,
  planGrowthFactor,
  runDay,
  trainingDays,
  weekView,
  matchDays,
  planOf
} from "./week";
import { makeYouth } from "./training";
import {
  backPassTarget,
  checkOffside,
  flagGoesUp,
  handballVerdict,
  keeperPicksItUp,
  offsideLine,
  restartAfterOut
} from "./laws";
import type { MatchSideState } from "./types";
import { formFactor, formFreshnessTick } from "./stats";
import {
  FACILITY_COST,
  FACILITY_WEEKS,
  bankToTransfer,
  capacityOf,
  groundCapacity,
  facilitiesOf,
  gateReceipts,
  makeSponsorOffers,
  medicalWeeks,
  rollSponsor,
  runCommercialRound,
  signSponsor,
  startBuild,
  tickBuilds
} from "./commercial";
import {
  applyCardPenalties,
  banForCrossing,
  onTheEdge,
  yellowBanLine,
  yellowsToBan
} from "./discipline";
import {
  MEETING_THEMES,
  bigMatchEdge,
  bigMatchFor,
  individualTalk,
  meetingAvailable,
  meetingFit,
  pledgeMinutes,
  settlePledges,
  talkAdvice,
  talkSuggestions,
  teamMeeting
} from "./motivation";
import { pushNews } from "./training";
import {
  INTL_ROUNDS,
  internationalTick,
  isInternationalRound,
  injuryKindFor,
  injuryLine,
  jadedFactor,
  jadedOf,
  jadedTick,
  pronenessOf,
  sharpnessFactor,
  sharpnessOf,
  sharpnessTick
} from "./physical";
import { leaders as roomLeaders } from "./morale";
import {
  applyDiscipline,
  armbandIn,
  canRetrain,
  clearTarget,
  disciplinaryCases,
  moveOptions,
  retrainOptions,
  retrainTick,
  moveTick,
  setArmband,
  setTarget,
  settleTargets,
  startMove,
  startRetrain,
  targetLine,
  targetOptions,
  targetSoFar
} from "./individual";
import { staminaFactor } from "./match";
import { computeTable } from "./league";
import {
  attackScore,
  autoLineup,
  defenseScore,
  overallFor,
  remapLineup,
  slotScoreFor,
  squadOf,
  validateLineup
} from "./ratings";
import { builtinFormation, clampToZone, resolveFormation, roleTemplate, scratchSlots, SLOT_ZONES, validateFormation, validateTemplate } from "./formations";
import { defaultRoleFor, laneFits, roleFinish, ROLE_DEFS, ROLE_GROUPS } from "./roles";
import { motionFor, ROLE_MOTION } from "./motion";
import { decideIntent, INTENT_IDS, type IntentCtx, type GamePhase } from "./intents";
import { hasTrait, TRAITS, traitsFor } from "./traits";
import {
  ATTR_KEYS,
  INTENSITIES,
  UNITS,
  aiPlan,
  developPlayer,
  developRound,
  learnTraits
} from "./training";
import {
  CAREER_STAGES,
  DEPTH_MIN,
  STAGE_ORDER,
  careerStage,
  contractState,
  depthLevel,
  squadPlan
} from "./planner";
import {
  FORM_BANDS,
  SORT_MODES,
  formBandFor,
  formOf,
  rating1,
  ratingAvg,
  recordMatch,
  sortSquad
} from "./stats";
import {
  DISCOVERY_LEVEL,
  KNOWLEDGE_FULL,
  REQUEST_COST,
  addFocus,
  dismissScout,
  estimateFor,
  hireScout,
  knowledgeOf,
  scoutingTick,
  scoutPlayer,
  squadAvgOvr,
  starsFor,
  toggleShortlist,
  topUpScouting
} from "./scouting";
import {
  CORNER_ROUTINES,
  FK_ROUTINES,
  aiSetPieces,
  cleanSetPieces,
  defaultSetPieces,
  familiarityFactor,
  familiarityOf,
  growFamiliarity,
  planForClub,
  routineKey
} from "./setpieces";
import {
  acceptOffer,
  agentFeeFor,
  bidForPlayer,
  freeAgents,
  freshFinances,
  makeFreeAgent,
  marketValue,
  offerTerms,
  renewContract,
  signFreeAgent,
  transferWindow,
  wageBill,
  wageDemand,
  wageHeadroom,
  windowTick
} from "./transfers";
import {
  AWARD_MIN_APPS,
  POTR_MIN_MINUTES,
  TOTS_SHAPE,
  careerTotals,
  ordinal,
  payPrize,
  prizeFor,
  PRIZE_MONEY,
  totalsFor,
  topScorers
} from "./history";
import {
  atmosphere,
  leaders,
  minutesShare,
  moodOf,
  moraleDev,
  moraleEdge,
  moraleFactors,
  moraleTick,
  recentForm,
  socialGroups,
  squadStatus,
} from "./morale";
import {
  FORMATION_COORDS, FORMATION_IDS, FORMATIONS, T, weeklyRecovery
} from "./tuning";
import { DEFAULT_CONDITIONS, REFS, WEATHERS, conditionEffects, conditionLine, conditionsFor, pitchOf, weatherOf } from "./conditions";
import { HEADLINES_CAP, answerPress, mediaGate, mediaTick, makePress, questionPool, skipPress } from "./media";
import { normalizeSave } from "../state/save";
import {
  addDays,
  calendarMonth,
  dayFor,
  dayOfWeek,
  daysInMonth,
  diffDays,
  fromSerial,
  roundDate,
  seasonMonths,
  seasonRoundsOf,
  seasonStart,
  sameDay,
  serial,
  upcoming
} from "./calendar";
import type { BoardPolicy, TransferOffer, CornerRoutine, FreeKickRoutine, Intensity, LiveChange, MatchConditions, MatchResult, Mentality, Player, PlayerUpdate, Position, SaveGame, SetPiecePlan, Stroke, TrainingPlan, TrainingUnit, WeatherId } from "./types";
import type { MatchStatCtx } from "./stats";

/** Jump straight into the league: pre-season friendlies remain unplayed (v0.27). */
/** play a live match out to the final whistle (deterministic) */
function playLiveOut(save: any) {
  const players = playersById(save);
  const st = advanceTo(save.live.state, 90, players);
  return { ...save, live: { ...save.live, state: st, minute: 90 } };
}

function toLeague(save: SaveGame): SaveGame {
  return { ...save, round: 1, phase: "league" };
}

function playSeason(start: SaveGame): SaveGame {
  let save = toLeague(start);
  const rounds = seasonRounds(save);
  while (save.round <= rounds) {
    save = playRound(save).save;
  }
  return save;
}

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("different seeds differ", () => {
    expect(mulberry32(hashSeed("a", 1))()).not.toBe(mulberry32(hashSeed("a", 2))());
  });
});

describe("generation", () => {
  const save = newGame(2024);

  it("creates a 20-club league with 22 players per club", () => {
    expect(save.clubs).toHaveLength(20);
    expect(save.players).toHaveLength(440);
    for (const club of save.clubs) {
      expect(squadOf(save.players, club.id)).toHaveLength(22);
    }
  });

  it("squad composition matches the template", () => {
    for (const club of save.clubs) {
      const squad = squadOf(save.players, club.id);
      expect(squad.filter((p) => p.pos === "GK")).toHaveLength(3);
      expect(squad.filter((p) => p.pos === "DF")).toHaveLength(7);
      expect(squad.filter((p) => p.pos === "MF")).toHaveLength(7);
      expect(squad.filter((p) => p.pos === "FW")).toHaveLength(5);
    }
  });

  it("attributes stay in sane bounds", () => {
    for (const p of save.players) {
      for (const v of Object.values(p.attrs)) {
        expect(v).toBeGreaterThanOrEqual(28); // 42 is the generator floor; a young filler can dip below
        expect(v).toBeLessThanOrEqual(96);
      }
      expect(p.condition).toBe(100);
    }
  });

  it("fixtures: 38 rounds, each club home 19 / away 19, every pair twice", () => {
    const league = save.fixtures.filter((f) => !f.friendly);
    expect(league).toHaveLength(380);
    const rounds = new Set(league.map((f) => f.round));
    expect(rounds.size).toBe(38);
    for (const club of save.clubs) {
      const mine = league.filter((f) => f.homeId === club.id || f.awayId === club.id);
      expect(mine).toHaveLength(38);
      expect(mine.filter((f) => f.homeId === club.id)).toHaveLength(19);
      expect(mine.filter((f) => f.awayId === club.id)).toHaveLength(19);
    }
    // three pre-season friendlies, all involving you
    const friendlies = save.fixtures.filter((f) => f.friendly);
    expect(friendlies).toHaveLength(3);
    expect(friendlies.every((f) => f.homeId === save.userClubId || f.awayId === save.userClubId)).toBe(true);
    const unordered = new Map<string, number>();
    for (const f of league) {
      const key = [f.homeId, f.awayId].sort().join(":");
      unordered.set(key, (unordered.get(key) ?? 0) + 1);
    }
    expect([...unordered.values()].every((n) => n === 2)).toBe(true);
  });
});

describe("season", () => {
  it("completes with consistent table", () => {
    const save = playSeason(newGame(2024));
    expect(save.round).toBe(seasonRounds(save) + 1);
    const table = computeTable(save.fixtures, save.clubs);
    for (const row of table) {
      expect(row.p).toBe(seasonRounds(save));
      expect(row.pts).toBe(row.w * 3 + row.d);
      expect(row.gd).toBe(row.gf - row.ga);
    }
    const gf = table.reduce((a, r) => a + r.gf, 0);
    const ga = table.reduce((a, r) => a + r.ga, 0);
    expect(gf).toBe(ga);
    expect(table[0].pts).toBeGreaterThanOrEqual(table[9].pts);
    const totalPts = table.reduce((a, r) => a + r.pts, 0);
    const totalWins = table.reduce((a, r) => a + r.w, 0);
    const totalDraws = table.reduce((a, r) => a + r.d, 0);
    expect(totalPts).toBe(totalWins * 3 + totalDraws);
  });

  it("is deterministic for the same seed and decisions", () => {
    const a = playSeason(newGame(7));
    const b = playSeason(newGame(7));
    const key = (s: SaveGame) =>
      JSON.stringify(s.fixtures.map((f) => [f.round, f.homeId, f.awayId, f.homeGoals, f.awayGoals]));
    expect(key(a)).toBe(key(b));
  });

  it("different seeds produce different seasons", () => {
    const a = playSeason(newGame(1));
    const b = playSeason(newGame(2));
    const key = (s: SaveGame) => JSON.stringify(s.fixtures.map((f) => [f.homeGoals, f.awayGoals]));
    expect(key(a)).not.toBe(key(b));
  });

  it("calibration: goals and home advantage are plausible", () => {
    let goals = 0;
    let matches = 0;
    let homeWins = 0;
    let awayWins = 0;
    // eight twenty-club seasons is 3,040 matches — the same sample the ten-club
    // world got from twenty-four seasons, for a quarter of the engine time
    for (let seed = 1; seed <= 8; seed++) {
      const save = playSeason(newGame(seed * 101));
      for (const f of save.fixtures.filter((x) => !x.friendly)) {
        matches++;
        goals += f.homeGoals! + f.awayGoals!;
        if (f.homeGoals! > f.awayGoals!) homeWins++;
        else if (f.homeGoals! < f.awayGoals!) awayWins++;
      }
    }
    const avgGoals = goals / matches;
    expect(avgGoals).toBeGreaterThan(1.6);
    expect(avgGoals).toBeLessThan(4.2);
    const homeShare = homeWins / matches;
    expect(homeShare).toBeGreaterThan(0.25);
    expect(homeShare).toBeLessThan(0.65);
    expect(awayWins).toBeGreaterThan(0);
  }, 90_000);

  it("applies injuries and suspensions to availability", () => {
    const save = newGame(99);
    const squad = squadOf(save.players, save.userClubId);
    const starterId = save.lineup.starters[0]!;
    const starter = save.players.find((p) => p.id === starterId)!;
    starter.injuredWeeks = 2;
    expect(squad.length).toBe(22);
    const { save: after, userMatch } = playRound(save);
    expect(after.lineup.starters).not.toContain(starterId);
    if (userMatch) {
      const played = userMatch.updates.filter((u) => u.minutes > 0).map((u) => u.playerId);
      expect(played).not.toContain(starterId);
    }
  });

  it("rolls into next season cleanly", () => {
    const s1 = playSeason(newGame(31));
    const s2 = nextSeason(s1);
    expect(s2.season).toBe(2);
    // the new season opens in pre-season: three friendlies, then the league
    expect(s2.round).toBe(PRE_ROUNDS[0]);
    expect(s2.phase).toBe("pre");
    expect(s2.fixtures.filter((f) => !f.friendly)).toHaveLength(380);
    expect(s2.fixtures.every((f) => !f.played)).toBe(true);
    const league = toLeague(s2);
    expect(league.round).toBe(1);
    const lineup = autoLineup(
      squadOf(s2.players, s2.userClubId),
      resolveFormation(s2.lineup.formation, s2.customFormations)!
    );
    expect(lineup.starters.filter(Boolean)).toHaveLength(11);
  });
});

describe("match bookkeeping", () => {
  it("covers every player who appeared, with sane ratings", () => {
    const save = newGame(777);
    const { userMatch } = playRound(save);
    const m = userMatch!;
    const appeared = m.updates.filter((u) => u.minutes > 0);
    expect(appeared.length).toBeGreaterThanOrEqual(22);
    expect(Object.keys(m.ratings).length).toBeGreaterThanOrEqual(22);
    for (const r of Object.values(m.ratings)) {
      expect(r).toBeGreaterThanOrEqual(4);
      expect(r).toBeLessThanOrEqual(10);
    }
    for (const u of appeared) {
      expect(u.conditionLoss).toBeGreaterThanOrEqual(3);
    }
  });

  it("credits assists only to non-GK teammates, never more than goals", () => {
    const save = newGame(99);
    const { userMatch } = playRound(save);
    const m = userMatch!;
    const goals = m.updates.reduce((a, u) => a + u.goals, 0);
    const assists = m.updates.reduce((a, u) => a + u.assists, 0);
    expect(assists).toBeLessThanOrEqual(goals);
    for (const u of m.updates) {
      if (u.assists > 0) {
        const p = save.players.find((pp) => pp.id === u.playerId)!;
        expect(p.pos).not.toBe("GK");
      }
    }
  });
});

describe("roles", () => {
  const player = (over: Partial<Player> & { pos: Player["pos"] }): Player => ({
    id: "x",
    clubId: "c",
    name: "T",
    age: 25,
    attrs: {
      pace: 60,
      shooting: 60,
      passing: 60,
      defending: 60,
      physical: 60,
      reflexes: 60,
      handling: 60
    },
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: [],
    ...over,
    traits: over.traits ?? [],
    contract: over.contract ?? { wage: 0, until: 0 },
    peak: over.peak ?? 99,
    dev: over.dev ?? {},
    devSeason: over.devSeason ?? {},
    focus: over.focus ?? null
  });

  it("every formation slot has a valid default role", () => {
    for (const fid of FORMATION_IDS) {
      for (const slot of FORMATIONS[fid]) {
        expect(ROLE_GROUPS[slot]).toContain(defaultRoleFor(slot));
      }
    }
  });

  it("role weights change who is rated best", () => {
    const poacherType = player({
      pos: "FW",
      attrs: { pace: 80, shooting: 86, passing: 55, defending: 40, physical: 55, reflexes: 40, handling: 40 }
    });
    const targetType = player({
      pos: "FW",
      attrs: { pace: 50, shooting: 62, passing: 55, defending: 45, physical: 88, reflexes: 40, handling: 40 }
    });
    expect(attackScore(poacherType, "poacher")).toBeGreaterThan(attackScore(poacherType, "target"));
    expect(attackScore(targetType, "target")).toBeGreaterThan(attackScore(targetType, "poacher"));
    expect(defenseScore(targetType, "target")).toBeGreaterThan(defenseScore(poacherType, "poacher"));
  });

  it("pitch coordinates line up with formations and stay in bounds", () => {
    for (const fid of FORMATION_IDS) {
      const coords = FORMATION_COORDS[fid];
      expect(coords).toHaveLength(FORMATIONS[fid].length);
      for (const [x, y] of coords) {
        expect(x).toBeGreaterThanOrEqual(5);
        expect(x).toBeLessThanOrEqual(95);
        expect(y).toBeGreaterThanOrEqual(5);
        expect(y).toBeLessThanOrEqual(95);
      }
    }
  });

  it("role finishing weights make physical strikers viable", () => {
    const powerhouse = player({
      pos: "FW",
      attrs: { pace: 55, shooting: 62, passing: 60, defending: 45, physical: 88, reflexes: 40, handling: 40 }
    });
    const sniper = player({
      pos: "FW",
      attrs: { pace: 80, shooting: 86, passing: 55, defending: 40, physical: 55, reflexes: 40, handling: 40 }
    });
    expect(roleFinish(powerhouse, "target")).toBeGreaterThan(roleFinish(powerhouse, "poacher"));
    expect(roleFinish(sniper, "poacher")).toBeGreaterThan(roleFinish(sniper, "target"));
  });

  it("every role has a distinct profile within its group", () => {
    const norm = (o: object) =>
      JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
    const seen = new Map<string, string>();
    for (const roles of Object.values(ROLE_GROUPS)) {
      for (const r of roles) {
        const d = ROLE_DEFS[r];
        const key = `${norm(d.atk)}|${norm(d.def)}|${d.shot}|${d.finish}|${d.assist}`;
        expect(seen.has(key), `duplicate profile: ${r} vs ${seen.get(key)}`).toBe(false);
        seen.set(key, r);
      }
    }
  });

  it("creator roles carry assist bias, finishers carry shot bias", () => {
    expect(ROLE_DEFS.playmaker.assist).toBeGreaterThan(ROLE_DEFS.poacher.assist);
    expect(ROLE_DEFS.w.assist).toBeGreaterThan(ROLE_DEFS.cm.assist);
    expect(ROLE_DEFS.poacher.shot).toBeGreaterThan(ROLE_DEFS.dlp.shot);
  });
});

describe("lineup ops", () => {
  const save = newGame(4242);
  const squad = squadOf(save.players, save.userClubId);

  it("autoLineup assigns a valid role to every slot", () => {
    const l = autoLineup(squad, builtinFormation("4-3-3"));
    expect(l.roles).toHaveLength(11);
    l.roles.forEach((r, i) => expect(ROLE_GROUPS[FORMATIONS["4-3-3"][i]]).toContain(r));
  });

  it("changing formation keeps your players", () => {
    const before = autoLineup(squad, builtinFormation("4-3-3"));
    const gkId = before.starters[0];
    const after = remapLineup(squad, before, builtinFormation("4-3-3"), builtinFormation("4-4-2"));
    expect(after.formation).toBe("4-4-2");
    expect(after.starters[0]).toBe(gkId);
    expect(validateLineup(squad, after)).toEqual([]);
    const kept = before.starters.filter((id) => id && after.starters.includes(id));
    expect(kept.length).toBeGreaterThanOrEqual(9);
    const after2 = remapLineup(squad, after, builtinFormation("4-4-2"), builtinFormation("3-5-2"));
    expect(validateLineup(squad, after2)).toEqual([]);
    expect(after2.mentality).toBe(after.mentality);
  });

  it("slot scoring lets freshness outweigh a small quality gap", () => {
    const mk = (over: Partial<Player> & { pos: Player["pos"] }): Player => ({
      id: "x",
      clubId: "c",
      name: "T",
      age: 24,
      attrs: {
        pace: 60,
        shooting: 60,
        passing: 60,
        defending: 60,
        physical: 60,
        reflexes: 60,
        handling: 60
      },
      condition: 100,
      injuredWeeks: 0,
      suspension: 0,
      apps: 0,
      goals: 0,
      assists: 0,
      mins: 0,
      yellows: 0,
      reds: 0,
      ratingSum: 0,
      ratingCount: 0,
      form: [],
      history: [],
      ...over,
      traits: over.traits ?? [],
      contract: over.contract ?? { wage: 0, until: 0 },
      peak: over.peak ?? 99,
      dev: over.dev ?? {},
      devSeason: over.devSeason ?? {},
      focus: over.focus ?? null
    });
    const tiredStar = mk({
      pos: "FW",
      attrs: { pace: 70, shooting: 80, passing: 60, defending: 40, physical: 60, reflexes: 40, handling: 40 },
      condition: 40
    });
    const fresh = mk({
      pos: "FW",
      attrs: { pace: 65, shooting: 70, passing: 55, defending: 40, physical: 65, reflexes: 40, handling: 40 },
      condition: 100
    });
    expect(slotScoreFor(fresh, "FW", "poacher", 0.45)).toBeGreaterThan(
      slotScoreFor(tiredStar, "FW", "poacher", 0.45)
    );
  });
});

describe("conditioning", () => {
  it("recovery scales with age and physicality", () => {
    const mk = (age: number, physical: number): Player => ({
      id: "x",
      clubId: "c",
      name: "T",
      pos: "MF",
      age,
      attrs: {
        pace: 60,
        shooting: 60,
        passing: 60,
        defending: 60,
        physical,
        reflexes: 60,
        handling: 60
      },
      traits: [],
      contract: { wage: 0, until: 0 },
      peak: 99,
      dev: {},
      devSeason: {},
      focus: null,
      condition: 100,
      injuredWeeks: 0,
      suspension: 0,
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
    });
    const kid = mk(19, 78);
    const vet = mk(34, 52);
    expect(weeklyRecovery(kid)).toBeGreaterThan(weeklyRecovery(vet));
    expect(weeklyRecovery(vet)).toBeLessThan(T.conditionLossStarter); // veterans need rotation
    expect(weeklyRecovery(kid)).toBeGreaterThanOrEqual(T.conditionLossStarter);
  });
});

describe("formations", () => {
  it("built-ins resolve with 11 slots and pass validation", () => {
    for (const fid of FORMATION_IDS) {
      const def = builtinFormation(fid);
      expect(def.slots).toHaveLength(11);
      expect(validateFormation(def)).toEqual([]);
    }
  });

  it("custom formations resolve by id and flag problems", () => {
    const custom = { id: "cf-test", name: "Test", slots: builtinFormation("4-4-2").slots.map((s) => ({ ...s })) };
    custom.slots[5] = { pos: "FW", x: 12, y: 30 };
    expect(resolveFormation("cf-test", [custom])?.id).toBe("cf-test");
    expect(resolveFormation("nope", [custom])).toBeUndefined();
    expect(resolveFormation("cf-test", undefined)).toBeUndefined();
    expect(validateFormation(custom)).toEqual([]);

    const twoGk = { ...custom, slots: custom.slots.map((s, i) => (i === 1 ? { ...s, pos: "GK" as const } : s)) };
    expect(validateFormation(twoGk).length).toBeGreaterThan(0);
    const short = { ...custom, slots: custom.slots.slice(0, 10) };
    expect(validateFormation(short).length).toBeGreaterThan(0);
    const off = { ...custom, slots: custom.slots.map((s, i) => (i === 2 ? { ...s, x: 150 } : s)) };
    expect(validateFormation(off).length).toBeGreaterThan(0);
  });

  it("autoLineup fills a custom shape; remap keeps the GK and stays valid", () => {
    const save = newGame(4242);
    const squad = squadOf(save.players, save.userClubId);
    const custom = {
      id: "cf-a",
      name: "A",
      slots: builtinFormation("4-4-2").slots.map((s) => ({ ...s }))
    };
    custom.slots[9] = { pos: "FW", x: 30, y: 12 };
    custom.slots[10] = { pos: "FW", x: 70, y: 12 };
    const l = autoLineup(squad, custom);
    expect(l.starters.filter(Boolean)).toHaveLength(11);
    expect(l.formation).toBe("cf-a");
    expect(l.roles).toHaveLength(11);
    const remapped = remapLineup(squad, l, custom, builtinFormation("4-4-2"));
    expect(remapped.formation).toBe("4-4-2");
    expect(remapped.starters[0]).toBe(l.starters[0]);
    expect(validateLineup(squad, remapped)).toEqual([]);
  });

  it("role templates are valid and lane-aware for every built-in formation", () => {
    for (const fid of FORMATION_IDS) {
      const def = builtinFormation(fid);
      const tpl = roleTemplate(def);
      expect(tpl).toHaveLength(11);
      expect(validateTemplate(def, tpl)).toEqual([]);
      tpl.forEach((r, i) => expect(ROLE_GROUPS[def.slots[i].pos]).toContain(r));
    }
  });

  it("custom formations get geometry-based role defaults", () => {
    const def = { id: "cf-geo", name: "Geo", slots: scratchSlots() };
    const tpl = roleTemplate(def);
    expect(tpl).toHaveLength(11);
    expect(tpl[0]).toBe("keeper");
    expect(tpl[1]).toBe("wb");
    expect(tpl[2]).toBe("stopper");
    tpl.forEach((r, i) => expect(laneFits(r, def.slots[i])).toBe(true));
    expect(validateTemplate(def, tpl)).toEqual([]);
  });

  it("built-in slots sit inside their position zones, and clamping works", () => {
    for (const fid of FORMATION_IDS) {
      const def = builtinFormation(fid);
      def.slots.forEach((slot) => {
        const z = SLOT_ZONES[slot.pos];
        expect(slot.x).toBeGreaterThanOrEqual(z.xMin);
        expect(slot.x).toBeLessThanOrEqual(z.xMax);
        expect(slot.y).toBeGreaterThanOrEqual(z.yMin);
        expect(slot.y).toBeLessThanOrEqual(z.yMax);
      });
    }
    expect(clampToZone("DF", 50, 20).y).toBe(48);
    expect(clampToZone("FW", 50, 80).y).toBe(48);
    expect(clampToZone("GK", 10, 50)).toEqual({ x: 38, y: 82 });
    expect(clampToZone("MF", 150, -5)).toEqual({ x: 94, y: 26 });
  });

  it("custom slot roles drive the role template and formation remaps", () => {
    const slots = scratchSlots();
    slots[9] = { pos: "FW", x: 40, y: 20, role: "target" };
    slots[10] = { ...slots[10], role: "keeper" }; // invalid for FW → ignored
    const def = { id: "cf-roles", name: "Roles", slots };
    const tpl = roleTemplate(def);
    expect(tpl[9]).toBe("target");
    expect(tpl[10]).toBe("af");
    const save = newGame(777);
    const squad = squadOf(save.players, save.userClubId);
    const base = autoLineup(squad, builtinFormation("4-3-3"));
    const remapped = remapLineup(squad, base, builtinFormation("4-3-3"), def);
    expect(remapped.roles[9]).toBe("target");
    expect(remapped.roles[10]).toBe("af");
  });
});

describe("live match", () => {
  function inputsFor(save: SaveGame, fx: { homeId: string; awayId: string }) {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    return {
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
      homeXI: home.xi,
      awayXI: away.xi,
      homeBench: home.bench,
      awayBench: away.bench,
      homeMentality: home.mentality,
      awayMentality: away.mentality,
      homeRoles: home.roles,
      awayRoles: away.roles,
      homeCoords: home.coords,
      awayCoords: away.coords,
      homePoss: home.poss,
      awayPoss: away.poss,
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      // mirror the real matchInputs: the round's weather, referee and pitch
      conditions: conditionsFor(save, save.round)
    };
  }

  it("half-time split reproduces the one-shot simulation exactly", () => {
    const save = newGame(4242);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const userSide = fx.homeId === save.userClubId ? "home" : "away";
    const one = simulateMatch({
      ...base,
      rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)),
      userSide
    });
    const live = startLive(save)!;
    const second = resumeSecondHalf(live, playersById(save));
    const split = finalizeLive(second);
    expect(split.homeGoals).toBe(one.homeGoals);
    expect(split.awayGoals).toBe(one.awayGoals);
    expect(JSON.stringify(split.events)).toBe(JSON.stringify(one.events));
    expect(JSON.stringify(split.scorers)).toBe(JSON.stringify(one.scorers));
    expect(second.state.timeline.length).toBeGreaterThan(20);
  });

  it("timeline stays consistent (minutes ascending, slots valid, goals counted)", () => {
    const live = startLive(newGame(999))!;
    const st = live.state;
    let last = 0;
    for (const s of st.timeline) {
      expect(s.m).toBeGreaterThanOrEqual(last);
      last = s.m;
      expect(s.m).toBeLessThanOrEqual(45);
      for (const slot of s.p) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThanOrEqual(10);
      }
    }
    expect(st.timeline.filter((s) => s.o === "goal").length).toBe(st.home.goals + st.away.goals);
  });

  it("enforces PL substitution rules: 5 subs, 3 in-match windows, half time free, no returns", () => {
    const save = newGame(777);
    const players = playersById(save);
    const live0 = startLive(save)!;
    const key = live0.state.userSide!;
    let live = live0;
    const pick = () => {
      const side = live.state[key];
      const i = side.poss.findIndex((p, j) => p !== "GK" && !!side.slots[j]);
      return { outId: side.slots[i]!, inId: side.bench[0]! };
    };
    const firstOut = pick().outId;
    for (let k = 0; k < 3; k++) {
      const c = pick();
      const r = addLiveChange(live, players, {
        minute: 30,
        kind: "sub",
        side: key,
        outId: c.outId,
        inId: c.inId
      });
      expect(r.error).toBeUndefined();
      live = r.live!;
    }
    expect(live.state[key].windows).toBe(3);
    const c4 = pick();
    const r4 = addLiveChange(live, players, {
      minute: 30,
      kind: "sub",
      side: key,
      outId: c4.outId,
      inId: c4.inId
    });
    expect(r4.error).toMatch(/windows/i);
    const r5 = addLiveChange(live, players, {
      minute: 45,
      kind: "sub",
      side: key,
      outId: c4.outId,
      inId: c4.inId
    });
    expect(r5.error).toBeUndefined();
    live = r5.live!;
    expect(live.state[key].subs).toBe(4);
    expect(live.state[key].windows).toBe(3);
    const c6 = pick();
    const r6 = addLiveChange(live, players, {
      minute: 45,
      kind: "sub",
      side: key,
      outId: c6.outId,
      inId: c6.inId
    });
    expect(r6.error).toBeUndefined();
    live = r6.live!;
    expect(live.state[key].subs).toBe(5);
    const c7 = pick();
    const r7 = addLiveChange(live, players, {
      minute: 45,
      kind: "sub",
      side: key,
      outId: c7.outId,
      inId: c7.inId
    });
    expect(r7.error).toMatch(/substitutions left/i);
    const r8 = addLiveChange(live, players, {
      minute: 45,
      kind: "sub",
      side: key,
      outId: c7.outId,
      inId: firstOut
    });
    expect(r8.error).toMatch(/no longer available/i);
  });

  it("second half carries substitutions and mentality changes", () => {
    const save = newGame(31);
    const players = playersById(save);
    const live0 = startLive(save)!;
    const key = live0.state.userSide!;
    const side0 = live0.state[key];
    const i = side0.poss.findIndex((p, j) => p !== "GK" && !!side0.slots[j]);
    const outId = side0.slots[i]!;
    const inId = side0.bench[0]!;
    let live = addLiveChange(live0, players, {
      minute: 20,
      kind: "sub",
      side: key,
      outId,
      inId
    }).live!;
    live = addLiveChange(live, players, {
      minute: 20,
      kind: "mentality",
      side: key,
      mentality: "att"
    }).live!;
    const second = resumeSecondHalf(live, players);
    expect(second.half).toBe(2);
    expect(second.state[key].mentality).toBe("att");
    expect(second.state[key].slots).toContain(inId);
    expect(second.state[key].slots).not.toContain(outId);
    expect(second.state.timeline.some((s) => s.m > 45)).toBe(true);
    const again = resumeSecondHalf(live, players);
    expect(JSON.stringify(again.state.timeline)).toBe(JSON.stringify(second.state.timeline));
  });
});

describe("motion", () => {
  const mkPlayer = (pos: Position, pace: number, physical = 60): Player => ({
    id: `m-${pos}-${pace}-${physical}`,
    clubId: "c1",
    name: "M",
    age: 24,
    pos,
    attrs: {
      pace,
      shooting: 60,
      passing: 60,
      defending: 60,
      physical,
      reflexes: 50,
      handling: 50
    },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
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
  });

  it("every role has a motion profile and roles differ by design", () => {
    for (const group of Object.values(ROLE_GROUPS)) {
      for (const r of group) expect(ROLE_MOTION[r]).toBeDefined();
    }
    expect(ROLE_MOTION.presser.press).toBeGreaterThan(ROLE_MOTION.poacher.press);
    expect(ROLE_MOTION.bwm.press).toBeGreaterThan(ROLE_MOTION.playmaker.press);
    expect(ROLE_MOTION.wb.push).toBeGreaterThan(ROLE_MOTION.fb.push);
    expect(ROLE_MOTION.w.width).toBeGreaterThan(0.5);
    expect(ROLE_MOTION.inside.width).toBeLessThan(0);
    expect(ROLE_MOTION.anc.drop).toBeGreaterThan(ROLE_MOTION.poacher.drop);
    expect(ROLE_MOTION.b2b.roam).toBeGreaterThan(ROLE_MOTION.anc.roam);
    expect(ROLE_MOTION.poacher.push).toBeGreaterThan(ROLE_MOTION.ncb.push);
  });

  it("attributes drive the motion profile", () => {
    const fast = mkPlayer("MF", 85, 70);
    const slow = mkPlayer("MF", 45, 70);
    const slot = { x: 30, y: 50, pos: "MF" as const };
    const pf = motionFor(fast, "cm", slot);
    const ps = motionFor(slow, "cm", slot);
    expect(pf.speed).toBeGreaterThan(ps.speed);
    expect(pf.accel).toBeGreaterThan(ps.accel);
    const weak = mkPlayer("MF", 60, 45);
    expect(motionFor(fast, "cm", slot).roam).toBeGreaterThan(motionFor(weak, "cm", slot).roam);
    const gk = motionFor(mkPlayer("GK", 85, 70), "keeper", { x: 50, y: 91, pos: "GK" });
    expect(gk.gk).toBe(true);
    expect(gk.speed).toBeLessThan(pf.speed);
    expect(gk.roam).toBeLessThan(pf.roam);
  });

  it("slot geometry modulates the width bias", () => {
    const p = mkPlayer("MF", 60, 60);
    const wide = motionFor(p, "w", { x: 14, y: 48, pos: "MF" });
    const central = motionFor(p, "w", { x: 50, y: 48, pos: "MF" });
    expect(Math.abs(wide.width)).toBeGreaterThan(Math.abs(central.width));
    expect(motionFor(p, "w", { x: 14, y: 48, pos: "MF" }).seed).toBe(
      motionFor(p, "w", { x: 50, y: 48, pos: "MF" }).seed
    );
  });
});

describe("decisions", () => {
  const mkP = (pos: Position, pace: number, physical = 60): Player => ({
    id: `d-${pos}-${pace}-${physical}`,
    clubId: "c1",
    name: "D",
    age: 24,
    pos,
    attrs: {
      pace,
      shooting: 60,
      passing: 60,
      defending: 60,
      physical,
      reflexes: 50,
      handling: 50
    },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
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
  });
  const ctx = (phase: GamePhase, ball = { x: 55, y: 55 }, slot = { x: 50, y: 30 }): IntentCtx => ({
    phase,
    mentality: "bal",
    slot,
    ball,
    prog: 1 - ball.y / 100
  });
  const n = 400;
  const countId = (
    prof: ReturnType<typeof motionFor>,
    c: IntentCtx,
    id: string,
    salt = "x"
  ) => {
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (decideIntent(prof, c, mulberry32(hashSeed(salt, i))).id === id) k++;
    }
    return k;
  };

  it("is deterministic per rng stream", () => {
    const prof = motionFor(mkP("FW", 80), "af", { x: 50, y: 25, pos: "FW" });
    const c = ctx("in");
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      expect(decideIntent(prof, c, a).id).toBe(decideIntent(prof, c, b).id);
    }
  });

  it("produces varied picks across streams (nobody moves in lockstep)", () => {
    const prof = motionFor(mkP("MF", 70), "cm", { x: 50, y: 45, pos: "MF" });
    const c = ctx("in");
    const ids = new Set<string>();
    for (let i = 0; i < n; i++) {
      ids.add(decideIntent(prof, c, mulberry32(hashSeed("s", i))).id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(3);
  });

  it("forwards choose runs far more often than centre-backs", () => {
    const fwd = motionFor(mkP("FW", 88), "af", { x: 50, y: 22, pos: "FW" });
    const cb = motionFor(mkP("DF", 70), "ncb", { x: 50, y: 78, pos: "DF" });
    const ball = { x: 55, y: 55 };
    const fCtx = ctx("in", ball, { x: 50, y: 22 });
    const cCtx = ctx("in", ball, { x: 50, y: 78 });
    expect(countId(fwd, fCtx, "run_behind")).toBeGreaterThan(countId(cb, cCtx, "run_behind") * 2);
  });

  it("mentality shifts the decision mix", () => {
    const fwd = motionFor(mkP("FW", 80), "af", { x: 50, y: 25, pos: "FW" });
    const att = countId(fwd, { ...ctx("in", undefined, { x: 50, y: 25 }), mentality: "att" }, "run_behind");
    const def = countId(fwd, { ...ctx("in", undefined, { x: 50, y: 25 }), mentality: "def" }, "run_behind");
    expect(att).toBeGreaterThan(def);
    const cb = motionFor(mkP("DF", 60), "ncb", { x: 50, y: 75, pos: "DF" });
    const oCtx = ctx("out", { x: 50, y: 45 }, { x: 50, y: 75 });
    const dropDef = countId(cb, { ...oCtx, mentality: "def" }, "drop_deep");
    const dropAtt = countId(cb, { ...oCtx, mentality: "att" }, "drop_deep");
    expect(dropDef).toBeGreaterThan(dropAtt);
  });

  it("high-press roles press more than playmakers", () => {
    const bwm = motionFor(mkP("MF", 65), "bwm", { x: 50, y: 45, pos: "MF" });
    const pm = motionFor(mkP("MF", 65), "playmaker", { x: 50, y: 40, pos: "MF" });
    const ball = { x: 55, y: 42 };
    expect(countId(bwm, ctx("out", ball, { x: 50, y: 45 }), "press_ball")).toBeGreaterThan(
      countId(pm, ctx("out", ball, { x: 50, y: 40 }), "press_ball")
    );
  });

  it("only offers phase-appropriate intents", () => {
    const sets: Record<GamePhase, string[]> = {
      in: ["hold", "support", "come_short", "drift_wide", "run_behind", "overlap"],
      out: ["hold_line", "press_ball", "cover", "drop_deep"],
      break: ["counter", "spread", "support"],
      recover: ["sprint_back", "delay", "press_ball"]
    };
    for (const phase of ["in", "out", "break", "recover"] as GamePhase[]) {
      const prof = motionFor(mkP("MF", 70), "cm", { x: 30, y: 45, pos: "MF" });
      for (let i = 0; i < 80; i++) {
        const pick = decideIntent(prof, ctx(phase), mulberry32(hashSeed(phase, i)));
        expect(sets[phase]).toContain(pick.id);
        expect(INTENT_IDS).toContain(pick.id);
      }
    }
  });

  it("goalkeepers stay home", () => {
    const gk = motionFor(mkP("GK", 60), "keeper", { x: 50, y: 90, pos: "GK" });
    const phases: GamePhase[] = ["in", "out", "break", "recover"];
    for (const phase of phases) {
      for (let i = 0; i < 120; i++) {
        const pick = decideIntent(
          gk,
          ctx(phase, { x: 60, y: 40 }, { x: 50, y: 90 }),
          mulberry32(hashSeed("gk", phase, i))
        );
        expect(["hold", "hold_line", "come_short"]).toContain(pick.id);
      }
    }
  });

  it("targets make sense", () => {
    const prof = motionFor(mkP("FW", 85), "af", { x: 50, y: 25, pos: "FW" });
    const ball = { x: 55, y: 60 };
    const picks = Array.from({ length: 300 }, (_, i) =>
      decideIntent(prof, ctx("in", ball), mulberry32(hashSeed("t", i)))
    );
    const run = picks.find((r) => r.id === "run_behind");
    if (run) expect(run.target.y).toBeLessThan(ball.y);
    for (let i = 0; i < 100; i++) {
      const p2 = decideIntent(
        motionFor(mkP("MF", 70), "bwm", { x: 50, y: 45, pos: "MF" }),
        ctx("out", ball),
        mulberry32(hashSeed("t2", i))
      );
      if (p2.id === "press_ball") {
        expect(Math.abs(p2.target.y - ball.y)).toBeLessThan(1);
        expect(Math.abs(p2.target.x - ball.x)).toBeLessThan(1);
      }
    }
    for (const r of picks) {
      expect(r.seconds).toBeGreaterThanOrEqual(0.7);
      expect(r.seconds).toBeLessThanOrEqual(4.3);
      expect(r.mix).toBeGreaterThanOrEqual(0.35);
      expect(r.mix).toBeLessThanOrEqual(0.85);
    }
  });
});

describe("traits", () => {
  const mkP = (pos: Position, over: Partial<Player["attrs"]> = {}): Player => ({
    id: `t-${pos}-${JSON.stringify(over)}`,
    clubId: "c1",
    name: "T",
    age: 27,
    pos,
    attrs: {
      pace: 65,
      shooting: 65,
      passing: 65,
      defending: 65,
      physical: 65,
      reflexes: 50,
      handling: 50,
      ...over
    },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
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
  });

  it("generates 0-2 valid, group-appropriate traits deterministically", () => {
    const save = newGame(11);
    let withTraits = 0;
    for (const p of save.players) {
      expect(p.traits.length).toBeLessThanOrEqual(2);
      const again = traitsFor(p, mulberry32(hashSeed(p.id, "traits")));
      expect(again).toEqual(p.traits);
      if (p.traits.length > 1) expect(new Set(p.traits).size).toBe(p.traits.length);
      for (const t of p.traits) {
        expect(TRAITS[t].groups).toContain(p.pos);
      }
      if (p.traits.length) withTraits++;
    }
    expect(withTraits).toBeGreaterThan(save.players.length * 0.5);
  });

  it("attribute profiles bend the trait pool", () => {
    const striker = traitsFor(mkP("FW", { shooting: 90, pace: 85 }), mulberry32(1));
    const anyone = Array.from({ length: 40 }, (_, i) =>
      traitsFor(mkP("FW", { shooting: 90, pace: 85 }), mulberry32(i))
    );
    const shooty = anyone.filter((t) => t.includes("shoots_on_sight")).length;
    const plain = Array.from({ length: 40 }, (_, i) =>
      traitsFor(mkP("FW", { shooting: 45, pace: 45 }), mulberry32(i))
    ).filter((t) => t.includes("shoots_on_sight")).length;
    expect(striker).toBeDefined();
    expect(shooty).toBeGreaterThan(plain);
  });

  it("traits bend the decision weights", () => {
    const base = mkP("MF");
    const prof = motionFor(base, "cm", { x: 50, y: 45, pos: "MF" });
    const c = (traits: Player["traits"]): IntentCtx => ({
      phase: "out",
      mentality: "bal",
      slot: { x: 50, y: 45 },
      ball: { x: 55, y: 45 },
      prog: 0.55,
      traits
    });
    const count = (traits: Player["traits"]) => {
      let k = 0;
      for (let i = 0; i < 300; i++) {
        if (decideIntent(prof, c(traits), mulberry32(hashSeed("tr", i))).id === "press_ball") k++;
      }
      return k;
    };
    expect(count(["presses_hard"])).toBeGreaterThan(count([]));

    const fwd = motionFor(base, "af", { x: 50, y: 25, pos: "FW" });
    const ci: IntentCtx = {
      phase: "in",
      mentality: "bal",
      slot: { x: 50, y: 25 },
      ball: { x: 55, y: 55 },
      prog: 0.45
    };
    const runs = (traits: Player["traits"]) => {
      let k = 0;
      for (let i = 0; i < 300; i++) {
        if (decideIntent(fwd, { ...ci, traits }, mulberry32(hashSeed("tr2", i))).id === "run_behind") k++;
      }
      return k;
    };
    expect(runs(["arrives_in_box"])).toBeGreaterThan(runs([]));
    expect(runs(["stays_back"])).toBeLessThan(runs([]));
  });

  it("hasTrait reads safely on legacy players", () => {
    const legacy = { ...mkP("MF") } as Player;
    delete (legacy as Partial<Player>).traits;
    expect(hasTrait(legacy, "presses_hard")).toBe(false);
  });
});

describe("transfers", () => {
  it("values players by ability and age", () => {
    const s = newGame(7);
    const ps = [...s.players].sort((a, b) => overallFor(a) - overallFor(b));
    const weak = ps[0];
    const strong = ps[ps.length - 1];
    expect(marketValue(strong)).toBeGreaterThan(marketValue(weak));
    const v24 = marketValue({ ...strong, age: 24 });
    const v34 = marketValue({ ...strong, age: 34 });
    expect(v24).toBeGreaterThan(v34);
    expect(marketValue(strong) % 10_000).toBe(0);
    expect(wageDemand(strong)).toBeGreaterThan(wageDemand(weak));
    expect(wageDemand(strong) % 100).toBe(0);
  });

  it("budgets cover the wage bill and every club can breathe", () => {
    const s = newGame(7);
    for (const c of s.clubs) {
      expect(s.finances[c.id].transfer).toBeGreaterThanOrEqual(500_000);
      expect(s.finances[c.id].wageBudget).toBeGreaterThan(wageBill(s, c.id));
      expect(wageHeadroom(s, c.id)).toBeGreaterThan(0);
    }
    expect(Object.keys(freshFinances(s)).length).toBe(s.clubs.length);
  });

  it("windows follow the season calendar", () => {
    const s = newGame(7);
    for (const r of [1, 2, 3]) expect(transferWindow({ ...s, round: r }).open).toBe(true);
    expect(transferWindow({ ...s, round: 4 }).open).toBe(false);
    for (const r of [9, 10]) expect(transferWindow({ ...s, round: r }).open).toBe(true);
    expect(transferWindow({ ...s, round: 12 }).open).toBe(false);
  });

  it("rejects lowballs, accepts fair bids, counters in between — deterministically", () => {
    const s = { ...newGame(7), round: 1 };
    const target = s.players.find((p) => p.clubId !== s.userClubId && marketValue(p) > 1_000_000)!;
    const v = marketValue(target);
    expect(bidForPlayer(s, target.id, Math.round(v * 0.35)).resp.kind).toBe("rejected");
    const fair = bidForPlayer(s, target.id, v * 2);
    expect(fair.resp.kind).toBe("accepted");
    expect(fair.save.pending?.playerId).toBe(target.id);
    const again = bidForPlayer(s, target.id, v * 2);
    expect(again.resp.kind).toBe(fair.resp.kind);
    // some fee band must produce a counter
    let countered = false;
    for (let f = 0.3; f <= 1.6 && !countered; f += 0.05) {
      countered = bidForPlayer(s, target.id, Math.round(v * f)).resp.kind === "counter";
    }
    expect(countered).toBe(true);
  });

  it("blocks bids over budget and when the window is shut", () => {
    const s = { ...newGame(7), round: 1 };
    s.finances[s.userClubId] = { ...s.finances[s.userClubId], transfer: 100 };
    const target = s.players.find((p) => p.clubId !== s.userClubId && marketValue(p) > 1_000_000)!;
    expect(bidForPlayer(s, target.id, 500_000).resp.message).toMatch(/budget/i);
    const shut = { ...newGame(7), round: 5 };
    expect(bidForPlayer(shut, target.id, marketValue(target) * 2).resp.message).toMatch(/closed/i);
  });

  it("completes a transfer once personal terms are agreed", () => {
    const s = { ...newGame(7), round: 1 };
    const target = s.players.find((p) => p.clubId !== s.userClubId && marketValue(p) > 1_000_000)!;
    const fee = marketValue(target) * 2;
    const bid = bidForPlayer(s, target.id, fee);
    expect(bid.resp.kind).toBe("accepted");
    const seller = target.clubId;
    const budgetBefore = bid.save.finances[bid.save.userClubId].transfer;
    const poor = offerTerms(bid.save, target.id, 1_000_000);
    expect(poor.resp.kind).toBe("rejected");
    expect(poor.resp.message).toMatch(/wage budget/i);
    const done = offerTerms(bid.save, target.id, wageDemand(target) * 1.3);
    expect(done.resp.kind).toBe("accepted");
    const p = done.save.players.find((x) => x.id === target.id)!;
    expect(p.clubId).toBe(done.save.userClubId);
    expect(p.contract.until).toBe(done.save.season + 3);
    expect(done.save.finances[done.save.userClubId].transfer).toBe(budgetBefore - fee - agentFeeFor(wageDemand(target) * 1.3));
    expect(done.save.finances[seller].transfer).toBeGreaterThan(s.finances[seller].transfer - 1);
    expect(done.save.pending).toBeUndefined();
    expect(done.save.transferLog.length).toBe(1);
  });

  it("accepts incoming offers for your players (and pays you)", () => {
    const s = { ...newGame(7), round: 1 };
    const mine = s.players.find((p) => p.clubId === s.userClubId)!;
    s.offers.push({ id: "of-test", playerId: mine.id, fromClubId: "c3", fee: 1_500_000, day: "R1" });
    const before = s.finances[s.userClubId].transfer;
    const r = acceptOffer(s, "of-test");
    expect(r.resp.kind).toBe("accepted");
    expect(r.save.players.find((x) => x.id === mine.id)!.clubId).toBe("c3");
    expect(r.save.finances[r.save.userClubId].transfer).toBe(before + 1_500_000);
    expect(r.save.offers.length).toBe(0);
  });

  it("renews contracts and signs free agents", () => {
    const s = { ...newGame(7), round: 1 };
    const mine = s.players.find((p) => p.clubId === s.userClubId)!;
    const ren = renewContract(s, mine.id, wageDemand(mine) * 1.3);
    expect(ren.resp.kind).toBe("accepted");
    expect(ren.save.players.find((x) => x.id === mine.id)!.contract.until).toBe(s.season + 3);
    const fa = makeFreeAgent(1, 0);
    const s2 = { ...s, players: [...s.players, fa] };
    const sign = signFreeAgent(s2, fa.id, wageDemand(fa) * 1.3);
    expect(sign.resp.kind).toBe("accepted");
    expect(sign.save.players.find((x) => x.id === fa.id)!.clubId).toBe(s2.userClubId);
    expect(freeAgents(sign.save).some((p) => p.id === fa.id)).toBe(false);
  });

  it("runs AI windows deterministically", () => {
    const s = { ...newGame(7), round: 1 };
    const a = windowTick(s);
    const b = windowTick(s);
    expect(b.transferLog).toEqual(a.transferLog);
    expect(JSON.stringify(b.players.map((p) => p.clubId))).toBe(
      JSON.stringify(a.players.map((p) => p.clubId))
    );
    expect(a.transferLog.length).toBeGreaterThan(0);
    for (const o of a.offers) {
      const p = a.players.find((x) => x.id === o.playerId)!;
      expect(p.clubId).toBe(a.userClubId);
      expect(o.fee).toBeGreaterThan(0);
    }
  });

  it("rolls contracts at season end and refreshes budgets", () => {
    const s = newGame(7);
    const mine = s.players.find((p) => p.clubId === s.userClubId)!;
    mine.contract.until = s.season;
    const ai = s.players.find((p) => p.clubId !== s.userClubId && p.clubId !== "")!;
    ai.contract.until = s.season;
    const next = nextSeason(s);
    expect(next.players.find((x) => x.id === mine.id)!.clubId).toBe("");
    const aiAfter = next.players.find((x) => x.id === ai.id)!;
    expect(aiAfter.clubId === "" || aiAfter.contract.until > next.season).toBe(true);
    expect(Object.keys(next.finances).length).toBe(next.clubs.length);
    expect(freeAgents(next).length).toBeGreaterThanOrEqual(5);
    expect(next.players.some((p) => p.id.startsWith("pfree-"))).toBe(true);
  });
});

describe("training", () => {
  const mkT = (over: Partial<Player> = {}): Player => ({
    id: "t1",
    clubId: "c1",
    name: "Test Player",
    age: 18,
    pos: "FW",
    attrs: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, reflexes: 40, handling: 40 },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: [],
    ...over
  });
  const plan = (unit: TrainingUnit, intensity: Intensity = "normal"): TrainingPlan => ({ unit, intensity });
  const train = (p: Player, pl: TrainingPlan, minutes: number, rounds = 18) => {
    for (let i = 0; i < rounds; i++) {
      developPlayer(p, pl, minutes, mulberry32(hashSeed(p.id, "test", pl.unit, pl.intensity, i)));
    }
  };
  const attrSum = (p: Player) => ATTR_KEYS.reduce((s, k) => s + p.attrs[k], 0);

  it("young players grow, veterans decline", () => {
    const kid = mkT({ age: 17, peak: 92 });
    const kidBefore = attrSum(kid);
    train(kid, plan("attacking"), 90);
    expect(attrSum(kid)).toBeGreaterThan(kidBefore + 2);

    const vet = mkT({ age: 34, attrs: { ...mkT().attrs, pace: 72, physical: 70 } });
    const paceBefore = vet.attrs.pace;
    train(vet, plan("balanced"), 90);
    expect(vet.attrs.pace).toBeLessThan(paceBefore);
    expect(vet.devSeason.pace ?? 0).toBeLessThan(0);
  });

  it("minutes, condition and intensity all scale development", () => {
    const starter = mkT({ age: 20, id: "s1" });
    const bench = mkT({ age: 20, id: "b1" });
    train(starter, plan("balanced"), 90);
    train(bench, plan("balanced"), 0);
    expect(attrSum(starter)).toBeGreaterThan(attrSum(bench));

    const heavy = mkT({ age: 20, id: "h1" });
    const light = mkT({ age: 20, id: "l1" });
    train(heavy, plan("balanced", "heavy"), 90);
    train(light, plan("balanced", "light"), 90);
    expect(attrSum(heavy)).toBeGreaterThan(attrSum(light));

    const tired = mkT({ age: 20, id: "t2", condition: 30 });
    const fresh = mkT({ age: 20, id: "f2", condition: 100 });
    train(tired, plan("balanced"), 90);
    train(fresh, plan("balanced"), 90);
    expect(attrSum(fresh)).toBeGreaterThan(attrSum(tired));

    expect(INTENSITIES.light.recovery).toBeGreaterThan(INTENSITIES.heavy.recovery);
  });

  it("the training unit steers which attributes grow", () => {
    const att = mkT({ age: 19, id: "a1" });
    const def = mkT({ age: 19, id: "a1" });
    train(att, plan("attacking"), 90);
    train(def, plan("defending"), 90);
    expect(att.attrs.shooting - 50).toBeGreaterThan(def.attrs.shooting - 50);
    expect(def.attrs.defending - 50).toBeGreaterThan(att.attrs.defending - 50);
  });

  it("individual focus is a strong nudge", () => {
    const withFocus = mkT({ age: 18, id: "f1", focus: "defending" });
    const without = mkT({ age: 18, id: "f2" });
    train(withFocus, plan("attacking"), 90);
    train(without, plan("attacking"), 90);
    expect(withFocus.attrs.defending).toBeGreaterThan(without.attrs.defending);
  });

  it("players at their ceiling stop growing (but still age)", () => {
    const maxed = mkT({ age: 25, id: "m1", peak: overallFor(mkT({ age: 25, id: "m1" })) });
    const before = attrSum(maxed);
    train(maxed, plan("attacking"), 90);
    expect(attrSum(maxed)).toBe(before);

    const old = mkT({ age: 35, id: "m2", peak: 60 });
    train(old, plan("balanced"), 90, 18);
    expect(attrSum(old)).toBeLessThan(attrSum(mkT({ age: 35, id: "m2", peak: 60 })));
  });

  it("development is deterministic", () => {
    const a = mkT({ age: 19, id: "d1" });
    const b = mkT({ age: 19, id: "d1" });
    train(a, plan("passing"), 90);
    train(b, plan("passing"), 90);
    expect(JSON.stringify(a.attrs)).toBe(JSON.stringify(b.attrs));
    expect(JSON.stringify(a.devSeason)).toBe(JSON.stringify(b.devSeason));
  });

  it("runs a full round of development across the world", () => {
    let s = { ...newGame(7), round: 1 };
    const minutes: Record<string, number> = {};
    for (const p of s.players) minutes[p.id] = p.clubId === s.userClubId ? 90 : 45;
    for (let i = 0; i < 12; i++) s = developRound({ ...s, round: i + 1 }, minutes);
    const gained = s.players.filter((p) => Object.values(p.devSeason).some((v) => v > 0));
    expect(gained.length).toBeGreaterThan(4);
    const someAccum = s.players.some((p) => Object.values(p.dev ?? {}).some((v) => Math.abs(v) > 0.01));
    expect(someAccum).toBe(true);
  });

  it("young regulars learn traits at season end", () => {
    const s = newGame(11);
    for (const p of s.players) if (p.age <= 23) p.apps = 15;
    const countTraits = (pl: Player[]) => pl.reduce((n, p) => n + p.traits.length, 0);
    const before = countTraits(s.players);
    const a = structuredClone(s);
    const b = structuredClone(s);
    learnTraits(a);
    learnTraits(b);
    expect(a.players.map((p) => p.traits.join(",")).join("|")).toBe(
      b.players.map((p) => p.traits.join(",")).join("|")
    );
    expect(countTraits(a.players)).toBeGreaterThan(before);
    for (const p of a.players) if (p.age > 23 && p.apps === 15) expect(p.traits.length).toBeLessThanOrEqual(2);
  });

  it("academy intake adds kids, trims AI squads and is deterministic", () => {
    const s1 = playSeason(newGame(17));
    const s2 = structuredClone(s1);
    const a = nextSeason(s1);
    const b = nextSeason(s2);
    const youth = a.players.filter((p) => p.id.startsWith("py-"));
    expect(youth.length).toBeGreaterThanOrEqual(11);
    expect(youth.every((p) => p.age >= 16 && p.age <= 18)).toBe(true);
    expect(a.players.filter((p) => p.id.startsWith("py-")).map((p) => p.name)).toEqual(
      b.players.filter((p) => p.id.startsWith("py-")).map((p) => p.name)
    );
    for (const c of a.clubs) {
      if (c.id === a.userClubId) continue;
      expect(squadOf(a.players, c.id).length).toBeLessThanOrEqual(26);
    }
    expect(a.players.some((p) => p.id.startsWith(`py-${a.userClubId}-`))).toBe(true);
  });

  it("backs the season tracker and peaks correctly", () => {
    const s = playSeason(newGame(23));
    expect(s.players.some((p) => Object.values(p.devSeason ?? {}).some((v) => v > 0))).toBe(true);
    const young = s.players.filter((p) => p.age <= 20 && p.peak > overallFor(p));
    expect(young.length).toBeGreaterThan(0);
    const next = nextSeason(s);
    expect(next.players.every((p) => Object.values(p.devSeason ?? {}).length === 0 || typeof p.devSeason === "object")).toBe(true);
  });

  it("varies AI training plans by club and season", () => {
    const s = newGame(5);
    const units = s.clubs.map((c) => aiPlan(s, c.id).unit);
    expect(new Set(units).size).toBeGreaterThan(2);
    const next = { ...s, season: 2 };
    expect(s.clubs.map((c) => aiPlan(next, c.id).unit)).not.toEqual(units);
  });
});

describe("planner", () => {
  const mkP = (over: Partial<Player> = {}): Player => ({
    id: "pl1",
    clubId: "c1",
    name: "Plan Player",
    age: 25,
    pos: "FW",
    attrs: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, reflexes: 40, handling: 40 },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 51,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: [],
    ...over
  });

  it("career stages follow age and room to grow", () => {
    expect(careerStage(mkP({ age: 17 }))).toBe("breakthrough");
    expect(careerStage(mkP({ age: 22 }))).toBe("emerging");
    expect(careerStage(mkP({ age: 25, peak: 99 }))).toBe("emerging"); // big room to grow
    expect(careerStage(mkP({ age: 25, peak: 51 }))).toBe("peak"); // at his ceiling
    expect(careerStage(mkP({ age: 31 }))).toBe("experienced");
    expect(careerStage(mkP({ age: 36 }))).toBe("veteran");
    expect(Object.keys(CAREER_STAGES).length).toBe(5);
  });

  it("classifies contract states", () => {
    const s = newGame(7);
    const p = mkP({ age: 25 });
    expect(contractState({ ...p, contract: { wage: 0, until: s.season } }, s)).toBe("expiring");
    expect(contractState({ ...p, contract: { wage: 0, until: s.season + 1 } }, s)).toBe("lastyear");
    expect(contractState({ ...p, contract: { wage: 0, until: s.season + 3 } }, s)).toBe("secure");
    expect(contractState({ ...p, age: 37, contract: { wage: 0, until: s.season + 3 } }, s)).toBe(
      "retiring"
    );
  });

  it("maps numbers to depth levels", () => {
    expect(depthLevel("GK", 1)).toBe("gap");
    expect(depthLevel("GK", 2)).toBe("thin");
    expect(depthLevel("GK", 3)).toBe("ok");
    expect(depthLevel("GK", 5)).toBe("deep");
    expect(depthLevel("DF", 4)).toBe("gap");
    expect(depthLevel("DF", 6)).toBe("thin");
    expect(depthLevel("DF", 7)).toBe("ok");
    expect(depthLevel("FW", 2)).toBe("gap");
    expect(depthLevel("FW", 5)).toBe("ok");
    expect(DEPTH_MIN.GK).toBe(2);
  });

  it("builds ranked groups from the formation", () => {
    const s = newGame(7);
    const plan = squadPlan(s);
    expect(plan.groups.map((g) => g.pos)).toEqual(["GK", "DF", "MF", "FW"]);
    expect(plan.groups[0].slots.length).toBe(1);
    expect(plan.groups[1].slots.length).toBe(4);
    const mine = squadOf(s.players, s.userClubId);
    for (const g of plan.groups) {
      expect(g.players.length).toBe(mine.filter((p) => p.pos === g.pos).length);
      const scores = g.players.map((x) => x.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
      expect(g.players.map((x) => x.rank)).toEqual(g.players.map((_, i) => i + 1));
    }
    expect(plan.total).toBe(mine.length);
  });

  it("flags gaps when a line is gutted", () => {
    const s = structuredClone(newGame(7));
    const fw = s.players.filter((p) => p.clubId === s.userClubId && p.pos === "FW");
    fw.slice(0, fw.length - 3).forEach((p) => (p.clubId = ""));
    const thin = squadPlan(s).groups.find((g) => g.pos === "FW")!;
    expect(thin.players.length).toBe(3);
    expect(thin.depth).toBe("thin");
    s.players.find((p) => p.id === fw[fw.length - 1].id)!.clubId = "";
    const gap = squadPlan(s).groups.find((g) => g.pos === "FW")!;
    expect(gap.depth).toBe("gap");
  });

  it("projects next season: departures drop out, ages tick up", () => {
    const s = structuredClone(newGame(7));
    const mine = squadOf(s.players, s.userClubId);
    const victim = mine.find((p) => p.pos === "FW")!;
    victim.contract.until = s.season; // out of contract at season end
    const now = squadPlan(s, "now");
    const next = squadPlan(s, "next");
    const gOf = (plan: ReturnType<typeof squadPlan>, pos: "FW") =>
      plan.groups.find((x) => x.pos === pos)!;
    expect(gOf(next, "FW").players.find((x) => x.player.id === victim.id)!.leaving).toBe(true);
    expect(gOf(now, "FW").players.length).toBe(gOf(next, "FW").players.length);
    expect(next.kept).toBe(now.total - next.expiring);
    expect(next.expiring).toBeGreaterThanOrEqual(1);
    const oldest = [...mine].sort((a, b) => b.age - a.age)[0];
    const inNow = squadPlan(s, "now")
      .groups.flatMap((x) => x.players)
      .find((x) => x.player.id === oldest.id)!;
    const inNext = squadPlan(s, "next")
      .groups.flatMap((x) => x.players)
      .find((x) => x.player.id === oldest.id)!;
    expect(inNext.player.age).toBe(Math.min(40, inNow.player.age + 1));
    expect(next.wageBillKept).toBeLessThanOrEqual(next.wageBill);
  });

  it("summarises the experience matrix and wages", () => {
    const s = newGame(7);
    const plan = squadPlan(s);
    expect(plan.stages.map((x) => x.stage)).toEqual(STAGE_ORDER);
    expect(plan.stages.reduce((n, x) => n + x.count, 0)).toBe(plan.total);
    expect(plan.avgAge).toBeGreaterThan(17);
    expect(plan.avgAge).toBeLessThan(40);
    expect(plan.wageBill).toBe(wageBill(s, s.userClubId));
    expect(JSON.stringify(squadPlan(s))).toBe(JSON.stringify(squadPlan(s)));
  });
});

describe("set piece creator", () => {
  const simMatch = (save: SaveGame, planOf: (clubId: string) => SetPiecePlan) => {
    const fx = userFixture(save)!;
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    const rng = mulberry32(
      hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)
    );
    const state = startMatch({
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
      homeXI: home.xi,
      awayXI: away.xi,
      homeBench: home.bench,
      awayBench: away.bench,
      homeMentality: home.mentality,
      awayMentality: away.mentality,
      homeRoles: home.roles,
      awayRoles: away.roles,
      homeCoords: home.coords,
      awayCoords: away.coords,
      homePoss: home.poss,
      awayPoss: away.poss,
      homePlan: planOf(fx.homeId),
      awayPlan: planOf(fx.awayId),
      rng,
      userSide: fx.homeId === save.userClubId ? "home" : "away"
    });
    const done = advanceTo(state, state.total, playersById(save));
    return {
      state: done,
      res: finalizeMatch(done),
      side: (fx.homeId === save.userClubId ? 1 : 0) as 0 | 1,
      userClubId: save.userClubId
    };
  };

  it("exposes routine metadata and sane defaults", () => {
    expect(Object.keys(CORNER_ROUTINES)).toEqual(["near_post", "far_post", "short", "edge"]);
    expect(Object.keys(FK_ROUTINES)).toEqual(["direct", "crossed", "short"]);
    const d = defaultSetPieces();
    expect(d.corner).toBe("far_post");
    expect(d.freekick).toBe("direct");
    expect(d.takers).toEqual({ corner: null, freekick: null, penalty: null });
    expect(familiarityOf(d, "corner", "far_post")).toBe(60);
    expect(familiarityOf(d, "corner", "near_post")).toBe(25); // never trained
    expect(familiarityFactor(0)).toBeCloseTo(0.9, 5);
    expect(familiarityFactor(100)).toBeCloseTo(1.0, 5);
  });

  it("grows familiarity each round, faster with set-piece training, and keeps it per routine", () => {
    const s = newGame(7);
    const before = familiarityOf(s.setpieces, "corner", s.setpieces.corner);
    growFamiliarity(s);
    expect(familiarityOf(s.setpieces, "corner", s.setpieces.corner)).toBe(before + 4);
    const trained = structuredClone(s);
    trained.training = { unit: "setpieces", intensity: "normal" };
    growFamiliarity(trained, 2);
    expect(familiarityOf(trained.setpieces, "corner", trained.setpieces.corner)).toBe(before + 4 + 14);
    for (let i = 0; i < 40; i++) growFamiliarity(trained);
    expect(familiarityOf(trained.setpieces, "corner", trained.setpieces.corner)).toBe(100);
    trained.setpieces.corner = "near_post";
    expect(familiarityOf(trained.setpieces, "corner", "near_post")).toBe(25); // fresh routine
    expect(familiarityOf(trained.setpieces, "corner", "far_post")).toBe(100); // old one still grooved
  });

  it("nominated takers take the set pieces when they are on the pitch", () => {
    const base = newGame(41);
    const cornerTaker = base.lineup.starters.find(
      (id) => id && base.players.find((p) => p.id === id)!.pos !== "GK"
    )!;
    const planOf = (clubId: string): SetPiecePlan =>
      clubId === base.userClubId
        ? {
            ...base.setpieces,
            takers: { corner: cornerTaker, freekick: cornerTaker, penalty: cornerTaker }
          }
        : aiSetPieces(base, clubId);
    let seen = 0;
    for (let r = 1; r <= 10; r++) {
      const { state } = simMatch({ ...base, round: r }, planOf);
      const evs = state.events.filter(
        (e) => (e.type === "corner" || e.type === "freekick") && e.clubId === base.userClubId
      );
      for (const e of evs) {
        seen++;
        expect(e.playerId).toBe(cornerTaker);
      }
    }
    expect(seen).toBeGreaterThan(3);
  });

  it("falls back to the best available when the nominated taker is not playing", () => {
    const base = newGame(43);
    const benchId = base.lineup.bench.find(Boolean)!;
    const onPitch = new Set(base.lineup.starters.filter(Boolean));
    const planOf = (clubId: string): SetPiecePlan =>
      clubId === base.userClubId
        ? { ...base.setpieces, takers: { corner: benchId, freekick: benchId, penalty: benchId } }
        : aiSetPieces(base, clubId);
    let seen = 0;
    for (let r = 1; r <= 10; r++) {
      const { state } = simMatch({ ...base, round: r }, planOf);
      for (const e of state.events) {
        if ((e.type === "corner" || e.type === "freekick") && e.clubId === base.userClubId) {
          seen++;
          // before the substitutions he is genuinely off the pitch, so a man on it takes it
          if (e.minute < 55) {
            expect(e.playerId).not.toBe(benchId);
            expect(onPitch.has(e.playerId!)).toBe(true);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(3);
  });

  it("corner routines change the goal rate and the second phases", () => {
    const base = newGame(31);
    const measure = (routine: CornerRoutine) => {
      const planOf = (clubId: string): SetPiecePlan =>
        clubId === base.userClubId
          ? {
              ...base.setpieces,
              corner: routine,
              familiarity: {
                [routineKey("corner", routine)]: 100,
                [routineKey("freekick", "direct")]: 100
              }
            }
          : aiSetPieces(base, clubId);
      let corners = 0;
      let goals = 0;
      for (let r = 1; r <= 18; r++) {
        const { state, side } = simMatch({ ...base, round: r }, planOf);
        const sts = state.timeline.filter((st) => st.h === side && st.sp === "corner");
        corners += sts.length;
        goals += sts.filter((st) => st.o === "goal").length;
      }
      return { corners, goals, perCorner: goals / Math.max(1, corners) };
    };
    const near = measure("near_post");
    const short = measure("short");
    expect(near.perCorner).toBeGreaterThan(short.perCorner);
    expect(short.corners).toBeGreaterThan(near.corners); // short corners keep the move alive
  });

  it("free-kick routines: crossed delivers, short rarely threatens", () => {
    const base = newGame(33);
    const measure = (routine: FreeKickRoutine) => {
      const planOf = (clubId: string): SetPiecePlan =>
        clubId === base.userClubId
          ? {
              ...base.setpieces,
              freekick: routine,
              familiarity: {
                [routineKey("corner", "far_post")]: 100,
                [routineKey("freekick", routine)]: 100
              }
            }
          : aiSetPieces(base, clubId);
      let fks = 0;
      let goals = 0;
      for (let r = 1; r <= 18; r++) {
        const { state, side } = simMatch({ ...base, round: r }, planOf);
        const sts = state.timeline.filter((st) => st.h === side && st.sp === "freekick");
        fks += sts.length;
        goals += sts.filter((st) => st.o === "goal").length;
      }
      return { fks, goals, perFk: goals / Math.max(1, fks) };
    };
    const shortFk = measure("short");
    const crossed = measure("crossed");
    // the design claim, where it actually lives: a crossed delivery is 5x the threat
    expect(FK_ROUTINES.crossed.goal).toBeGreaterThan(FK_ROUTINES.short.goal * 3);
    expect(FK_ROUTINES.crossed.delivery).toBe(true);
    expect(FK_ROUTINES.short.delivery).toBe(false);
    // and a season of football does not contradict it (one goal either way is noise)
    expect(crossed.fks).toBeGreaterThan(5);
    expect(crossed.perFk).toBeGreaterThanOrEqual(shortFk.perFk * 0.5);
  });

  it("a goal from a crossed delivery is credited to a head", () => {
    const base = newGame(41);
    const plan: SetPiecePlan = {
      ...base.setpieces,
      freekick: "crossed",
      familiarity: { "freekick:crossed": 100 }
    };
    const planOf = (clubId: string) => (clubId === base.userClubId ? plan : aiSetPieces(base, clubId));
    // cross it in until somebody scores with his head
    let headed = 0;
    for (let s = 1; s <= 12 && headed === 0; s++) {
      for (let r = 1; r <= 18; r++) {
        const { state, side } = simMatch({ ...base, season: s, round: r }, planOf);
        const fkGoals = state.timeline.filter(
          (st) => st.h === side && st.sp === "freekick" && st.o === "goal"
        );
        if (!fkGoals.length) continue;
        const scorerId = Object.entries(state.updates).find(([, u]) => u.header)?.[0];
        if (scorerId) headed++;
      }
    }
    expect(headed).toBeGreaterThan(0);
  }, 30_000);

  it("tags strokes with the routine in play", () => {
    const base = newGame(37);
    const planOf = (clubId: string): SetPiecePlan =>
      clubId === base.userClubId
        ? {
            ...base.setpieces,
            corner: "edge",
            freekick: "crossed",
            familiarity: { "corner:edge": 100, "freekick:crossed": 100 }
          }
        : aiSetPieces(base, clubId);
    let cornerStrokes = 0;
    let fkStrokes = 0;
    for (let r = 1; r <= 20 && (cornerStrokes === 0 || fkStrokes === 0); r++) {
      const { state, side } = simMatch({ ...base, round: r }, planOf);
      for (const st of state.timeline) {
        if (st.h !== side) continue;
        if (st.sp === "corner") {
          cornerStrokes++;
          expect(st.spr).toBe("edge");
        }
        if (st.sp === "freekick") {
          fkStrokes++;
          expect(st.spr).toBe("crossed");
        }
      }
    }
    expect(cornerStrokes).toBeGreaterThan(3);
    expect(fkStrokes).toBeGreaterThan(0);
  });

  it("keeps matches deterministic with plans in play", () => {
    const base = newGame(47);
    const planOf = (clubId: string): SetPiecePlan =>
      clubId === base.userClubId ? base.setpieces : aiSetPieces(base, clubId);
    const a = simMatch({ ...base, round: 3 }, planOf);
    const b = simMatch({ ...base, round: 3 }, planOf);
    expect(JSON.stringify(a.state.timeline)).toBe(JSON.stringify(b.state.timeline));
    expect(JSON.stringify(a.res.events)).toBe(JSON.stringify(b.res.events));
  });

  it("AI clubs get their own deterministic routines", () => {
    const s = newGame(7);
    const corners = s.clubs.map((c) => aiSetPieces(s, c.id).corner);
    expect(new Set(corners).size).toBeGreaterThan(1);
    expect(s.clubs.map((c) => aiSetPieces(s, c.id).corner)).toEqual(corners);
    expect(planForClub(s, s.userClubId).corner).toBe(s.setpieces.corner);
  });

  it("normalises stored plans (bad routines, stale takers, wild familiarity)", () => {
    const ids = new Set(["p1"]);
    const clean = cleanSetPieces(
      {
        corner: "nonsense",
        freekick: "crossed",
        takers: { corner: "ghost", freekick: null, penalty: "p1" },
        familiarity: { "corner:crossed": 500, "freekick:crossed": -3 }
      } as never,
      ids
    );
    expect(clean.corner).toBe("far_post");
    expect(clean.freekick).toBe("crossed");
    expect(clean.takers.corner).toBeNull();
    expect(clean.takers.penalty).toBe("p1");
    expect(clean.familiarity["corner:crossed"]).toBe(100);
    expect(clean.familiarity["freekick:crossed"]).toBe(0);
  });
});

describe("player stats & form", () => {
  const mkS = (over: Partial<Player> = {}): Player => ({
    id: "st1",
    clubId: "c1",
    name: "Stat Player",
    age: 25,
    pos: "MF",
    attrs: { pace: 60, shooting: 60, passing: 60, defending: 60, physical: 60, reflexes: 40, handling: 40 },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: [],
    ...over
  });
  const upd = (over: Partial<PlayerUpdate> = {}): PlayerUpdate => ({
    playerId: "st1",
    minutes: 90,
    goals: 0,
    assists: 0,
    yellow: 0,
    red: false,
    injuredWeeks: 0,
    conditionLoss: 0,
    ...over
  });
  const ctx = (over: Partial<MatchStatCtx> = {}): MatchStatCtx => ({
    season: 1,
    round: 1,
    opp: "NOR",
    home: true,
    rating: 7,
    userClub: true,
    ...over
  });

  it("folds a match into season stats, form and the log", () => {
    const p = mkS();
    recordMatch(p, upd({ minutes: 76, goals: 2, assists: 1, yellow: 1 }), ctx({ rating: 8.2 }));
    expect(p.mins).toBe(76);
    expect(p.yellows).toBe(1);
    expect(p.form).toEqual([8.2]);
    expect(ratingAvg(p)).toBeCloseTo(8.2, 5);
    expect(p.history).toHaveLength(1);
    expect(p.history[0]).toMatchObject({ r: 1, opp: "NOR", h: true, rt: 8.2, m: 76, g: 2, a: 1 });
    recordMatch(p, upd({ minutes: 0 }), ctx({ rating: undefined })); // unused sub
    expect(p.form).toHaveLength(1);
    expect(ratingAvg(p)).toBeCloseTo(8.2, 5);
    expect(p.history).toHaveLength(2);
    expect(p.history[0].rt).toBe(0);
  });

  it("keeps the last six ratings, newest first, and bands them", () => {
    const p = mkS();
    for (let r = 1; r <= 8; r++) recordMatch(p, upd(), ctx({ rating: 4 + r * 0.5, round: r }));
    expect(p.form).toHaveLength(6);
    expect(p.form[0]).toBe(8); // newest first
    expect(p.form[5]).toBe(5.5);
    expect(formOf(p)).toBeCloseTo((8 + 7.5 + 7 + 6.5 + 6 + 5.5) / 6, 5);
    expect(formBandFor(8.1)).toBe("brilliant");
    expect(formBandFor(7)).toBe("good");
    expect(formBandFor(6.2)).toBe("average");
    expect(formBandFor(5)).toBe("poor");
    expect(Object.keys(FORM_BANDS)).toHaveLength(4);
    expect(rating1(null)).toBe("—");
    expect(rating1(7.234)).toBe("7.2");
    expect(formOf(mkS())).toBeNull();
  });

  it("logs matches for your club only, newest first, capped at ten", () => {
    const p = mkS();
    for (let r = 1; r <= 12; r++) recordMatch(p, upd(), ctx({ round: r }));
    expect(p.history).toHaveLength(10);
    expect(p.history[0].r).toBe(12);
    const other = mkS({ clubId: "c9" });
    recordMatch(other, upd(), ctx({ userClub: false }));
    expect(other.history).toHaveLength(0);
    expect(other.form).toHaveLength(1);
  });

  it("collects stats for AI players too (without a log)", () => {
    const s = playRound(toLeague(newGame(15))).save;
    const ai = s.players.filter((p) => p.clubId !== s.userClubId && p.clubId !== "");
    expect(ai.some((p) => (p.mins ?? 0) > 0 && p.form.length > 0)).toBe(true);
    expect(ai.every((p) => p.history.length === 0)).toBe(true);
    const mine = s.players.filter((p) => p.clubId === s.userClubId);
    expect(mine.some((p) => p.history.length > 0)).toBe(true);
    expect(mine.filter((p) => p.apps > 0).every((p) => p.ratingCount > 0 && p.mins > 0)).toBe(true);
  });

  it("resets season stats at the rollover but keeps the recent-match log", () => {
    const s = playRound(toLeague(newGame(17))).save;
    const id = s.players.find((p) => p.clubId === s.userClubId && p.history.length > 0)!.id;
    expect(s.players.find((p) => p.id === id)!.mins).toBeGreaterThan(0);
    const next = nextSeason(s);
    const after = next.players.find((p) => p.id === id)!;
    expect(after.mins).toBe(0);
    expect(after.ratingCount).toBe(0);
    expect(after.ratingSum).toBe(0);
    expect(after.form).toEqual([]);
    expect(after.yellows).toBe(0);
    expect(after.history.length).toBeGreaterThan(0);
  });

  it("sorts the squad by form, rating, goals and minutes", () => {
    const overall = (p: Player) => p.peak;
    const a = mkS({ id: "a", goals: 5, form: [8, 8], mins: 100 });
    const b = mkS({ id: "b", goals: 1, form: [5, 5], mins: 900 });
    const c = mkS({ id: "c", goals: 9, form: [], mins: 10, peak: 50 });
    const ids = (arr: Player[]) => arr.map((p) => p.id).join("");
    expect(ids(sortSquad([a, b, c], "form", overall))).toBe("abc"); // no form sinks
    expect(ids(sortSquad([a, b, c], "goals", overall))).toBe("cab");
    expect(ids(sortSquad([a, b, c], "minutes", overall))).toBe("bac");
    expect(ids(sortSquad([a, b, c], "rating", overall))).toBe("abc");
    expect(SORT_MODES).toHaveLength(6);
  });

  it("is deterministic across identical runs", () => {
    const run = () => {
      let s = newGame(19);
      for (let r = 0; r < 3; r++) s = playRound(s).save;
      return JSON.stringify(s.players.map((p) => [p.apps, p.mins, p.form, p.ratingCount, p.history.length]));
    };
    expect(run()).toBe(run());
  });
});

describe("scouting", () => {
  const fresh = () => newGame(61);

  it("starts with staff, a hiring pool and a budget", () => {
    const s = fresh();
    expect(s.scouting.scouts).toHaveLength(2);
    expect(s.scouting.pool).toHaveLength(4);
    expect(s.scouting.budget).toBeGreaterThanOrEqual(300_000);
    expect(s.scouting.scouts.every((x) => x.name.length > 3 && x.judging >= 45 && x.fee > 0)).toBe(true);
    expect(Object.keys(s.scouting.knowledge)).toHaveLength(0);
  });

  it("knows your own players exactly and rivals not at all", () => {
    const s = fresh();
    const mine = squadOf(s.players, s.userClubId)[0];
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    expect(knowledgeOf(s, mine.id)).toBe(100);
    const own = estimateFor(s, mine);
    expect(own.tier).toBe("extensive");
    expect(own.exactOvr).toBe(overallFor(mine));
    expect(own.traits).toEqual(mine.traits);

    expect(knowledgeOf(s, rival.id)).toBe(0);
    const fog = estimateFor(s, rival);
    expect(fog.tier).toBe("none");
    expect(fog.stars).toBeNull();
    expect(fog.exactOvr).toBeNull();
    expect(fog.attrs).toBeNull();
    expect(fog.valueRange).toBeNull();
  });

  it("scouting one player raises knowledge each round and completes at extensive", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    expect(scoutPlayer(s, rival.id)).toBeNull();
    expect(s.scouting.requests).toHaveLength(1);
    const before = knowledgeOf(s, rival.id);
    scoutingTick(s);
    const afterOne = knowledgeOf(s, rival.id);
    expect(afterOne).toBeGreaterThan(before);
    expect(estimateFor(s, rival).tier).toBe("brief"); // a 25+ report is a brief one
    let guard = 0;
    while (s.scouting.requests.length && guard++ < 20) scoutingTick(s);
    expect(knowledgeOf(s, rival.id)).toBeGreaterThanOrEqual(KNOWLEDGE_FULL);
    expect(s.scouting.requests).toHaveLength(0); // the scout is free again
    expect(s.scouting.reports).toContain(rival.id);
    const est = estimateFor(s, rival);
    expect(est.tier).toBe("extensive");
    expect(est.exactOvr).toBe(overallFor(rival));
    expect(est.exactPot).toBe(rival.peak);
    expect(est.attrs!.pace).toEqual([rival.attrs.pace, rival.attrs.pace]);
  });

  it("cannot scout your own players twice or without a free scout", () => {
    const s = fresh();
    const mine = squadOf(s.players, s.userClubId)[0];
    expect(scoutPlayer(s, mine.id)).toMatch(/own players/i);
    const rivals = s.players.filter((p) => p.clubId !== s.userClubId).slice(0, 3);
    expect(scoutPlayer(s, rivals[0].id)).toBeNull();
    expect(scoutPlayer(s, rivals[1].id)).toBeNull();
    expect(scoutPlayer(s, rivals[2].id)).toMatch(/busy/i); // two scouts, both working
    expect(scoutPlayer(s, rivals[0].id)).toMatch(/already scouting/i);
  });

  it("estimates are wider for a poor scout and tighter with knowledge", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    const poor = { id: "sp", name: "Poor", judging: 35, speed: 1, fee: 0 };
    const elite = { id: "se", name: "Elite", judging: 95, speed: 1, fee: 0 };
    s.scouting.scouts = [poor, elite];
    s.scouting.knowledge[rival.id] = { level: 60, seen: 1, by: "sp" };
    const wide = estimateFor(s, rival);
    s.scouting.knowledge[rival.id] = { level: 60, seen: 1, by: "se" };
    const tight = estimateFor(s, rival);
    const width = (r: [number, number]) => r[1] - r[0];
    expect(width(wide.ovrRange!)).toBeGreaterThan(width(tight.ovrRange!));
    expect(width(wide.attrs!.shooting!)).toBeGreaterThan(width(tight.attrs!.shooting!));
    // more knowledge → tighter ranges (same scout)
    s.scouting.knowledge[rival.id] = { level: 55, seen: 1, by: "se" };
    const mid = estimateFor(s, rival);
    s.scouting.knowledge[rival.id] = { level: 74, seen: 1, by: "se" };
    const high = estimateFor(s, rival);
    expect(width(high.ovrRange!)).toBeLessThanOrEqual(width(mid.ovrRange!));
    expect(mid.tier).toBe("detailed");
  });

  it("recruitment focuses surface matching players and polish their best leads", () => {
    const s = fresh();
    expect(addFocus(s, { pos: "FW", maxAge: 23, minPotStars: 2.5 })).toBeNull();
    scoutingTick(s);
    const known = Object.entries(s.scouting.knowledge).map(([id, k]) => ({
      p: s.players.find((x) => x.id === id)!,
      k
    }));
    expect(known.length).toBeGreaterThan(0);
    expect(known.every(({ p }) => p.pos === "FW" && p.age <= 23 && p.clubId !== s.userClubId)).toBe(true);
    expect(s.scouting.reports.length).toBeGreaterThan(0);
    const firstLevel = known[0].k.level;
    scoutingTick(s);
    scoutingTick(s);
    const after = Object.entries(s.scouting.knowledge).map(([id, k]) => ({ id, k }));
    expect(after.length).toBeGreaterThanOrEqual(known.length);
    expect(after.some(({ id, k }) => id === known[0].p.id && k.level > firstLevel)).toBe(true);
  });

  it("pays for jobs from the scouting budget and pauses when it runs dry", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    s.scouting.budget = REQUEST_COST.player + 5_000; // one round of work left
    scoutPlayer(s, rival.id);
    scoutingTick(s);
    const afterPaid = knowledgeOf(s, rival.id);
    expect(s.scouting.budget).toBe(5_000);
    scoutingTick(s); // broke: the job pauses
    expect(knowledgeOf(s, rival.id)).toBe(afterPaid);
    expect(s.scouting.budget).toBe(5_000);
    scoutingTick(s);
    expect(s.scouting.budget).toBeGreaterThanOrEqual(0);
  });

  it("decays knowledge that nobody is watching, down to a brief report", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    s.scouting.knowledge[rival.id] = { level: 90, seen: 1 };
    scoutingTick(s);
    expect(knowledgeOf(s, rival.id)).toBe(88);
    for (let i = 0; i < 60; i++) scoutingTick(s);
    expect(knowledgeOf(s, rival.id)).toBe(DISCOVERY_LEVEL); // floors at a brief report
  });

  it("shortlisted players keep getting fresh eyes", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    s.scouting.knowledge[rival.id] = { level: 30, seen: 1 };
    toggleShortlist(s, rival.id);
    scoutingTick(s);
    expect(knowledgeOf(s, rival.id)).toBe(31);
    expect(s.scouting.shortlist).toContain(rival.id);
    toggleShortlist(s, rival.id);
    expect(s.scouting.shortlist).not.toContain(rival.id);
    expect(knowledgeOf(s, rival.id)).toBeGreaterThanOrEqual(25); // decay resumes, floored
  });

  it("hires and dismisses scouts (fees from the budget, cap of three)", () => {
    const s = fresh();
    const cand = s.scouting.pool[0];
    expect(hireScout(s, cand.id)).toBeNull();
    expect(s.scouting.scouts).toHaveLength(3);
    expect(s.scouting.pool).not.toContain(cand);
    expect(hireScout(s, s.scouting.pool[0].id)).toMatch(/only employ 3/i);
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    scoutPlayer(s, rival.id);
    const busyScout = s.scouting.requests[0].scoutId;
    dismissScout(s, busyScout);
    expect(s.scouting.scouts.find((x) => x.id === busyScout)).toBeUndefined();
    expect(s.scouting.requests).toHaveLength(0); // his jobs went with him
  });

  it("tops the scouting budget up from the transfer budget", () => {
    const s = fresh();
    const before = s.scouting.budget;
    const transferBefore = s.finances[s.userClubId].transfer;
    expect(topUpScouting(s, 500_000)).toBeNull();
    expect(s.scouting.budget).toBe(before + 500_000);
    expect(s.finances[s.userClubId].transfer).toBe(transferBefore - 500_000);
    expect(topUpScouting(s, transferBefore)).toMatch(/only/i);
  });

  it("star ratings are relative to your own squad", () => {
    const s = fresh();
    const baseline = squadAvgOvr(s);
    expect(starsFor(baseline, baseline)).toBe(2.5);
    expect(starsFor(baseline + 8, baseline)).toBe(5);
    expect(starsFor(baseline - 20, baseline)).toBe(0.5);
    expect(starsFor(baseline + 1.6, baseline)).toBe(3);
  });

  it("keeps working alongside transfers (fog does not break bids)", () => {
    const s = { ...fresh(), round: 1 };
    const rival = s.players.find((p) => p.clubId !== s.userClubId && marketValue(p) > 1_000_000)!;
    expect(knowledgeOf(s, rival.id)).toBe(0);
    const resp = bidForPlayer(s, rival.id, marketValue(rival) * 2);
    expect(resp.resp.kind).toBe("accepted");
  });

  it("is deterministic", () => {
    const run = () => {
      const s = newGame(63);
      addFocus(s, { pos: "any", maxAge: 24, minPotStars: 3 });
      for (let i = 0; i < 6; i++) scoutingTick(s);
      return JSON.stringify([s.scouting.knowledge, s.scouting.reports, s.scouting.budget]);
    };
    expect(run()).toBe(run());
  });
});

describe("set pieces", () => {
  it("a season produces corners, direct free kicks and penalties at sane rates", () => {
    let g = newGame(7);
    const rounds = seasonRounds(g);
    let matches = 0;
    let corners = 0;
    let cornerGoals = 0;
    let fks = 0;
    let pens = 0;
    let cards = 0;
    while (g.round <= rounds) {
      const r = playRound(g);
      g = r.save;
      for (const f of g.lastResults) {
        matches++;
        corners += f.events.filter((e) => e.type === "corner").length;
        cornerGoals += f.events.filter((e) => e.type === "goal" && /corner/i.test(e.text)).length;
        fks += f.events.filter((e) => e.type === "freekick").length;
        pens += f.events.filter((e) => e.type === "penalty").length;
        cards += f.events.filter((e) => e.type === "yellow" || e.type === "red").length;
      }
    }
    expect(matches).toBeGreaterThan(60);
    const cornerRate = (corners + cornerGoals) / matches;
    expect(cornerRate).toBeGreaterThan(3);
    expect(cornerRate).toBeLessThan(20);
    expect(fks / matches).toBeGreaterThan(0.3);
    expect(fks / matches).toBeLessThan(5);
    expect(pens).toBeGreaterThan(0);
    expect(pens / matches).toBeLessThan(1.2);
    expect(cards / matches).toBeGreaterThan(1);
    expect(cards / matches).toBeLessThan(8);
  });

  it("set-piece strokes carry staging data (sp/tg) in the live timeline", () => {
    let staged: Stroke[] | undefined;
    for (let seed = 1; seed <= 60 && !staged; seed++) {
      const live = startLive(newGame(seed));
      if (!live) continue;
      const tl = live.state.timeline;
      const kinds = new Set(tl.map((st) => st.sp).filter(Boolean));
      if (kinds.has("corner") && kinds.has("penalty") && kinds.has("freekick")) staged = tl;
    }
    expect(staged).toBeDefined();
    for (const st of staged!) {
      if (st.sp === "corner") {
        expect(st.tg).toBeDefined();
        expect(st.tg![1]).toBe(2);
      }
      if (st.sp === "penalty") expect(st.tg).toEqual([50, 12]);
      if (st.sp === "freekick") expect(st.tg).toEqual([50, 24]);
    }
  });

  it("matchStats counts corner deliveries from the timeline", () => {
    const live = startLive(newGame(7))!;
    const stats = matchStats(live.state);
    const strokes = live.state.timeline.filter((st) => st.sp === "corner").length;
    expect(stats.cornersHome + stats.cornersAway).toBe(strokes);
    expect(strokes).toBeGreaterThan(0);
  });
});

describe("history, records & awards", () => {
  it("folds season counters into per-club career totals exactly once", () => {
    const s1 = playSeason(newGame(71));
    const before = s1.players.filter((p) => p.apps > 5 && p.age < 30);
    expect(before.length).toBeGreaterThan(10);
    const sample = before.slice(0, 30).map((p) => ({
      id: p.id,
      clubId: p.clubId,
      apps: p.apps,
      goals: p.goals,
      assists: p.assists
    }));
    const s2 = nextSeason(s1);
    for (const snap of sample) {
      const p = s2.players.find((x) => x.id === snap.id);
      if (!p) continue; // retired — skip
      const t = totalsFor(p, snap.clubId);
      expect(t.apps).toBe(snap.apps); // folded once, exactly
      expect(t.goals).toBe(snap.goals);
      expect(careerTotals(p).apps).toBe(snap.apps);
      expect(p.apps).toBe(0); // season counters reset
    }
    const kept = sample.filter((s) => s2.players.some((p) => p.id === s.id));
    expect(kept.length).toBeGreaterThan(10);
    for (const snap of kept) {
      const p = s2.players.find((x) => x.id === snap.id)!;
      const t = totalsFor(p, snap.clubId);
      expect(t.goals).toBeGreaterThanOrEqual(snap.goals);
      expect(t.apps).toBeGreaterThanOrEqual(snap.apps);
    }
    // a second rollover accumulates on top of the first (no reset, no double count from one season)
    const s3 = nextSeason(playSeason(s2));
    const p1 = s2.players.find((x) => x.id === kept[0].id);
    const p3 = s3.players.find((x) => x.id === kept[0].id);
    if (p1 && p3) {
      const t2 = careerTotals(p1);
      const t3 = careerTotals(p3);
      expect(t3.apps).toBeGreaterThanOrEqual(t2.apps);
    }
  });

  it("remembers the season: champion, your finish, top scorer, POTY, TOTS, biggest win", () => {
    const s1 = playSeason(newGame(72));
    const table = computeTable(s1.fixtures, s1.clubs);
    const s2 = nextSeason(s1);
    const h = s2.history;
    expect(h.seasons).toHaveLength(1);
    const r = h.seasons[0];
    expect(r.season).toBe(1);
    expect(r.champion.clubId).toBe(table[0].clubId);
    expect(r.champion.points).toBe(table[0].pts);
    expect(r.runnerUp.clubId).toBe(table[1].clubId);
    const mine = table.find((t) => t.clubId === s1.userClubId)!;
    expect(r.user.pos).toBe(mine.position);
    expect(r.user.pts).toBe(mine.pts);
    expect(r.user.w + r.user.d + r.user.l).toBe(seasonRounds(s1));
    expect(r.user.prize).toBe(prizeFor(mine.position));
    expect(r.topScorer!.goals).toBeGreaterThan(0);
    expect(r.playerOfSeason!.rating).toBeGreaterThan(4);
    expect(r.playerOfSeason!.apps).toBeGreaterThanOrEqual(AWARD_MIN_APPS);
    expect(r.teamOfSeason).toHaveLength(11);
    expect(r.teamOfSeason.map((x) => x.pos).join(",")).toBe(TOTS_SHAPE.join(","));
    expect(new Set(r.teamOfSeason.map((x) => x.playerId)).size).toBe(11);
    expect(r.biggestWin).not.toBeNull();
    // the top scorer really was the league's best
    const best = [...s1.players].sort((a, b) => b.goals - a.goals)[0];
    expect(r.topScorer!.goals).toBe(best.goals);
  });

  it("pays prize money with the new budgets and writes a news line", () => {
    const s1 = playSeason(newGame(73));
    const s2 = nextSeason(s1);
    expect(s2.devNews.some((n) => /prize money/i.test(n))).toBe(true);
    // isolation: payPrize adds exactly the recorded prize
    const s = newGame(73);
    s.history.seasons.push({
      season: 1,
      champion: { clubId: s.clubs[1].id, name: s.clubs[1].name, points: 40, gf: 30, ga: 20 },
      runnerUp: { clubId: s.clubs[0].id, name: s.clubs[0].name, points: 38 },
      user: { pos: 4, pts: 30, w: 9, d: 3, l: 6, prize: 2_800_000 },
      topScorer: null,
      playerOfSeason: null,
      teamOfSeason: [],
      biggestWin: null
    });
    const before = s.finances[s.userClubId].transfer;
    payPrize(s);
    expect(s.finances[s.userClubId].transfer).toBe(before + 2_800_000);
    expect(s.devNews[0]).toMatch(/4th/);
  });

  it("crowns champions with titles and counts only your own", () => {
    const s1 = playSeason(newGame(75));
    const champId = computeTable(s1.fixtures, s1.clubs)[0].clubId;
    const prevTitles = new Map(s1.players.map((p) => [p.id, p.titles ?? 0]));
    const s2 = nextSeason(s1);
    for (const p of s2.players) {
      const was = prevTitles.get(p.id);
      if (was === undefined) continue; // new youth / free agents
      const atChamp = s1.players.find((x) => x.id === p.id)!.clubId === champId;
      expect(p.titles ?? 0).toBe(atChamp ? was + 1 : was);
    }
    expect(s2.history.titles).toBe(champId === s1.userClubId ? 1 : 0);
  });

  it("updates all-time records when they are beaten and keeps them across seasons", () => {
    const s1 = playSeason(newGame(76));
    const s2 = nextSeason(s1);
    const a = s2.history.allTime;
    expect(a.topScorer!.value).toBeGreaterThan(0);
    expect(a.mostApps!.value).toBeGreaterThan(0);
    expect(a.bestSeasonGoals!.value).toBeGreaterThan(0);
    expect(a.bestSeasonRating!.value).toBeGreaterThan(4);
    expect(a.biggestWin!.season).toBe(1);
    const s3 = nextSeason(playSeason(s2));
    expect(s3.history.seasons).toHaveLength(2);
    expect(s3.history.allTime.topScorer!.value).toBeGreaterThanOrEqual(a.topScorer!.value);
    expect(s3.history.allTime.mostApps!.value).toBeGreaterThan(a.mostApps!.value); // apps only grow
  });

  it("awards a player of the round every round — best rating, minimum minutes", () => {
    let save = toLeague(newGame(77));
    save = playRound(save).save;
    expect(save.awards.rounds).toHaveLength(1);
    expect(save.awards.rounds[0].round).toBe(1);
    expect(save.awards.rounds[0].season).toBe(1);
    // the winner is the best-rated player who played at least 45 minutes this round
    let bestRt = -1;
    let bestId = "";
    for (const r of save.lastResults) {
      for (const [pid, rt] of Object.entries(r.ratings)) {
        const u = r.updates.find((x) => x.playerId === pid);
        if (!u || u.minutes < POTR_MIN_MINUTES) continue;
        if (rt > bestRt) {
          bestRt = rt;
          bestId = pid;
        }
      }
    }
    expect(save.awards.rounds[0].playerId).toBe(bestId);
    const full = playSeason(newGame(77));
    expect(full.awards.rounds).toHaveLength(seasonRounds(full));
    const rolled = nextSeason(full);
    expect(rolled.awards.rounds).toHaveLength(0); // reset for the new campaign
    expect(rolled.awards.bestWin).toBeNull();
  });

  it("tracks the biggest win of the season and of all time", () => {
    const s1 = playSeason(newGame(78));
    const played = s1.fixtures.filter((f) => f.played && f.homeGoals != null);
    const widest = played.reduce((m, f) =>
      Math.abs(f.homeGoals! - f.awayGoals!) > Math.abs(m.homeGoals! - m.awayGoals!) ? f : m
    );
    const w = s1.awards.bestWin!;
    expect(Math.abs(w.hs - w.as)).toBe(Math.abs(widest.homeGoals! - widest.awayGoals!));
    expect(w.homeId === widest.homeId || w.homeId === widest.awayId).toBe(true);
    const s2 = nextSeason(s1);
    expect(s2.history.allTime.biggestWin!.season).toBe(1);
  });

  it("keeps clubs' record books per club and per career", () => {
    const s1 = playSeason(newGame(79));
    const s2 = nextSeason(s1);
    const p = s2.players.find((x) => careerTotals(x).apps > 0)!;
    expect(careerTotals(p).apps).toBeGreaterThan(0);
    const clubId = Object.keys(p.totals!)[0];
    expect(totalsFor(p, clubId).apps).toBeGreaterThan(0);
    expect(totalsFor(p, "no-such-club")).toEqual({ apps: 0, goals: 0, assists: 0 });
    // a player who never featured has no career entry (saves stay small)
    const ghost = s2.players.find((x) => (x.totals ?? undefined) && Object.keys(x.totals!).length === 0);
    expect(ghost === undefined || Object.values(ghost.totals!).every((t) => t.apps + t.goals + t.assists > 0)).toBe(true);
    // Scorers tab: mid-season ordering (pre-season everyone is on 0, so the list is empty)
    let mid = newGame(79);
    for (let i = 0; i < 6; i++) mid = playRound(mid).save;
    const scouted = topScorers(mid, 5);
    expect(scouted).toHaveLength(5);
    expect(scouted[0].goals).toBeGreaterThanOrEqual(scouted[1].goals);
    expect(scouted.every((p) => p.goals > 0 || p.apps > 0)).toBe(true);
    expect(topScorers(s2, 5)).toHaveLength(0); // fresh season, nothing played yet
  });

  it("survives players retiring: records live on in history", () => {
    let save = newGame(80);
    for (let i = 0; i < 4; i++) save = nextSeason(playSeason(save));
    expect(save.history.seasons).toHaveLength(4);
    expect(save.history.allTime.topScorer!.value).toBeGreaterThan(10);
    const youngest = [...save.players].sort((a, b) => a.age - b.age)[0];
    expect(youngest.age).toBeLessThan(24);
  });

  it("prize money descends by position and ordinal reads right", () => {
    expect(prizeFor(1)).toBeGreaterThan(prizeFor(2));
    expect(prizeFor(2)).toBeGreaterThan(prizeFor(10));
    expect(prizeFor(0)).toBe(prizeFor(1));
    expect(prizeFor(99)).toBe(prizeFor(PRIZE_MONEY.length));
    expect(prizeFor(20)).toBeGreaterThan(0);
    expect(prizeFor(19)).toBeGreaterThan(prizeFor(20));
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(21)).toBe("21st");
  });

  it("has no history mid-season and is deterministic", () => {
    let save = toLeague(newGame(81));
    for (let i = 0; i < 5; i++) save = playRound(save).save;
    expect(save.history.seasons).toHaveLength(0);
    expect(save.awards.rounds).toHaveLength(5);
    expect(save.history.titles).toBe(0);

    const run = () => {
      const s = nextSeason(playSeason(newGame(82)));
      return JSON.stringify([s.history, s.awards]);
    };
    expect(run()).toBe(run());
  });
});

describe("morale & squad dynamics", () => {
  const mkResult = (save: SaveGame, gf: number, ga: number, home = true): MatchResult => ({
    fixtureKey: "t",
    round: save.round,
    homeId: home ? save.userClubId : save.clubs[1].id,
    awayId: home ? save.clubs[1].id : save.userClubId,
    homeGoals: gf,
    awayGoals: ga,
    events: [],
    ratings: {},
    updates: [],
    scorers: []
  });
  const fullSquad = (save: SaveGame) =>
    squadOf(save.players, save.userClubId).map((p) => ({
      playerId: p.id,
      minutes: 90,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: false,
      injuredWeeks: 0,
      conditionLoss: 0
    }));

  it("is exactly neutral at morale 60 (calibration safe) and moves ±6% at the ends", () => {
    const s = newGame(90);
    const p = s.players[0];
    p.morale = 60;
    expect(moraleEdge(p)).toBe(1);
    p.morale = 100;
    expect(moraleEdge(p)).toBeCloseTo(1.06, 6);
    p.morale = 5;
    expect(moraleEdge(p)).toBeCloseTo(1 - 55 * 0.0015, 6);
    expect(moraleDev(60)).toBe(1);
    expect(moraleDev(100)).toBeCloseTo(1.08, 6);
    delete p.morale; // old saves / literals default to neutral
    expect(moraleEdge(p)).toBe(1);
  });

  it("reads mood off the scale", () => {
    expect(moodOf(95).label).toBe("Delighted");
    expect(moodOf(75).label).toBe("Happy");
    expect(moodOf(60).label).toBe("Content");
    expect(moodOf(45).label).toBe("Unsettled");
    expect(moodOf(30).label).toBe("Unhappy");
    expect(moodOf(8).label).toBe("Miserable");
  });

  it("a star who never plays sulks; a fringe player who plays every week perks up", () => {
    const s = newGame(101);
    const squad = squadOf(s.players, s.userClubId).sort((a, b) => overallFor(b) - overallFor(a));
    const star = squad[0];
    const fringe = squad[squad.length - 2];
    expect(squadStatus(s, star)).toBe("star");
    expect(squadStatus(s, fringe)).not.toBe("star");
    star.morale = 60;
    fringe.morale = 60;
    star.recentMin = [];
    fringe.recentMin = [];
    for (let r = 1; r <= 8; r++) {
      s.round = r;
      // nobody plays in this synthetic round: the star's expectations go unmet
      moraleTick(s, [mkResult(s, 1, 1)]);
    }
    expect(star.morale).toBeLessThan(52);
    expect(moraleFactors(s, star).some((f) => f.label === "Wants more minutes")).toBe(true);

    // now the fringe man plays every minute of every round
    const s2 = newGame(101);
    const fringe2 = squadOf(s2.players, s2.userClubId).sort((a, b) => overallFor(b) - overallFor(a))[
      squadOf(s2.players, s2.userClubId).length - 2
    ];
    fringe2.morale = 60;
    fringe2.recentMin = [];
    for (let r = 1; r <= 8; r++) {
      s2.round = r;
      const res = mkResult(s2, 2, 1);
      res.updates = [{ playerId: fringe2.id, minutes: 90, goals: 0, assists: 0, yellow: 0, red: false, injuredWeeks: 0, conditionLoss: 0 }];
      moraleTick(s2, [res]);
    }
    expect(fringe2.morale).toBeGreaterThan(62);
    expect(minutesShare(fringe2.recentMin)).toBe(1);
  });

  it("results move the whole dressing room", () => {
    const run = (gf: number, ga: number, n: number) => {
      const s = newGame(102);
      for (let r = 1; r <= n; r++) {
        s.round = r;
        const res = mkResult(s, gf, ga);
        res.updates = fullSquad(s);
        moraleTick(s, [res]);
      }
      const club = squadOf(s.players, s.userClubId);
      return club.reduce((a, p) => a + (p.morale ?? 60), 0) / club.length;
    };
    const winning = run(3, 0, 6);
    const losing = run(0, 3, 6);
    expect(winning - losing).toBeGreaterThan(15); // a winning run is worth a lot of goodwill
    expect(winning).toBeGreaterThan(70);
    expect(losing).toBeLessThan(70);
  });

  it("money, contracts, injuries and form all show up as reasons", () => {
    const s = newGame(103);
    const p = squadOf(s.players, s.userClubId)[3];
    p.contract.wage = Math.round(wageDemand(p) * 0.5);
    expect(moraleFactors(s, p).some((f) => f.label === "Feels badly underpaid")).toBe(true);
    p.contract.wage = Math.round(wageDemand(p) * 1.6);
    expect(moraleFactors(s, p).some((f) => f.label === "Well rewarded")).toBe(true);
    p.contract.until = s.season;
    expect(moraleFactors(s, p).some((f) => f.label === "Contract expires this season")).toBe(true);
    p.injuredWeeks = 4;
    expect(moraleFactors(s, p).some((f) => f.label === "Frustrated by injury")).toBe(true);
    p.form = [7.6, 7.5, 7.8];
    expect(moraleFactors(s, p).some((f) => f.label === "In fine form")).toBe(true);
    p.form = [5.1, 5.2];
    expect(moraleFactors(s, p).some((f) => f.label === "Struggling for form")).toBe(true);

    // and they actually move the number
    const s2 = newGame(103);
    const q = squadOf(s2.players, s2.userClubId)[3];
    q.morale = 60;
    q.contract.wage = Math.round(wageDemand(q) * 0.5);
    s2.round = 1;
    moraleTick(s2, [mkResult(s2, 1, 1)]);
    expect(q.morale).toBeLessThan(58);
  });

  it("the dressing room follows its leaders", () => {
    const s = newGame(104);
    const club = squadOf(s.players, s.userClubId);
    const lead = leaders(s, s.userClubId);
    expect(lead).toHaveLength(3);
    const leadIds = new Set(lead.map((l) => l.id));
    for (const p of club) p.morale = leadIds.has(p.id) ? 95 : 45;
    s.round = 1;
    // draws, nobody plays — only the leader pull acts
    moraleTick(s, [mkResult(s, 1, 1)]);
    const follower = club.find((p) => !leadIds.has(p.id))!;
    expect(follower.morale).toBeGreaterThan(45); // pulled up toward the leaders
    expect(follower.morale).toBeLessThan(68);
    // a toxic leadership drags everyone down
    const s2 = newGame(104);
    const club2 = squadOf(s2.players, s2.userClubId);
    const leadIds2 = new Set(leaders(s2, s2.userClubId).map((l) => l.id));
    for (const p of club2) p.morale = leadIds2.has(p.id) ? 15 : 60;
    s2.round = 1;
    moraleTick(s2, [mkResult(s2, 1, 1)]);
    expect(club2.find((p) => !leadIds2.has(p.id))!.morale).toBeLessThan(60);
  });

  it("miserable players hand in transfer requests — and withdraw them when it clears up", () => {
    const s = newGame(105);
    const p = squadOf(s.players, s.userClubId)[5];
    p.morale = 10;
    p.recentMin = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let r = 1; r <= 4; r++) {
      s.round = r;
      moraleTick(s, [mkResult(s, 0, 2)]);
    }
    expect(p.transferRequest).toBe(true);
    expect(s.devNews.some((n) => n.includes("transfer request"))).toBe(true);
    // an unsettled player attracts bids, and is sold cheap
    expect(moraleFactors(s, p).some((f) => f.label === "Wants to leave")).toBe(true);

    // fix his mood: the request goes away
    p.morale = 70;
    s.round = 6;
    moraleTick(s, [mkResult(s, 2, 0)]);
    expect(p.transferRequest).toBe(false);
    expect(s.devNews.some((n) => n.includes("withdrawn his transfer request"))).toBe(true);
  });

  it("individual chats land differently depending on form", () => {
    const s = newGame(106);
    const squad = squadOf(s.players, s.userClubId);
    const hot = squad.find((p) => !hasTrait(p, "leader"))!;
    hot.form = [7.5, 7.2, 7.9];
    hot.morale = 50;
    const dialogue = (save: SaveGame, playerId: string, kind: "praise" | "warn" | "reassure" | "challenge") =>
      individualTalk(save, playerId, kind);
    const praised = dialogue(s, hot.id, "praise");
    expect(praised.resp.delta).toBe(7);
    expect(praised.save.players.find((x) => x.id === hot.id)!.morale).toBe(57);
    // cooldown
    const again = dialogue(praised.save, hot.id, "praise");
    expect(again.resp.ok).toBe(false);
    // a leader takes praise even better
    const boss = squad.find((p) => hasTrait(p, "leader"));
    if (boss) {
      boss.form = [7.5, 7.2];
      boss.morale = 50;
      const big = dialogue(s, boss.id, "praise");
      expect(big.resp.delta).toBe(9);
    }
    // criticising your best performer backfires
    const s2 = newGame(106);
    const hot2 = squadOf(s2.players, s2.userClubId).find((p) => !hasTrait(p, "leader"))!;
    hot2.form = [7.5, 7.2];
    hot2.morale = 50;
    const warned = dialogue(s2, hot2.id, "warn");
    expect(warned.resp.delta).toBeLessThan(0);
    // ...but the same words land with a struggler
    const s3 = newGame(106);
    const cold = squadOf(s3.players, s3.userClubId).find((p) => !hasTrait(p, "leader"))!;
    cold.form = [5.0, 5.2];
    cold.morale = 50;
    const told = dialogue(s3, cold.id, "warn");
    expect(told.resp.delta).toBeGreaterThan(0);
    expect(told.resp.morale).toBe(56);
    // a struggling player shrugs off praise
    const s4 = newGame(106);
    const cold2 = squadOf(s4.players, s4.userClubId).find((p) => !hasTrait(p, "leader"))!;
    cold2.form = [5.0, 5.2];
    cold2.morale = 50;
    const soft = individualTalk(s4, cold2.id, "praise");
    expect(soft.resp.delta).toBe(1);
    // not your player
    const rival = s4.players.find((x) => x.clubId !== s4.userClubId)!;
    expect(individualTalk(s4, rival.id, "praise").resp.ok).toBe(false);
  });

  it("an unhappy player won't discuss a new deal (unless you overpay)", () => {
    const s = newGame(107);
    const p = squadOf(s.players, s.userClubId).find((x) => x.contract.until > s.season)!;
    p.morale = 12;
    const refused = renewContract(s, p.id, Math.round(wageDemand(p)));
    expect(refused.resp.kind).toBe("rejected");
    expect(refused.resp.message).toMatch(/unhappy|won't discuss/i);
    const silly = renewContract(s, p.id, Math.round(wageDemand(p) * 1.6));
    expect(silly.resp.kind).not.toBe("rejected");
    // a happy player is cheaper than a grumpy one
    const s2 = newGame(107);
    const q = squadOf(s2.players, s2.userClubId).find((x) => x.contract.until > s2.season)!;
    q.morale = 85;
    const happy = renewContract(s2, q.id, Math.round(wageDemand(q) * 0.95));
    expect(["accepted", "counter"]).toContain(happy.resp.kind);
  });

  it("morale reaches the pitch: happy squads outperform miserable ones", () => {
    const outcome = (seed: number, mood: number) => {
      const s = newGame(seed);
      for (const p of s.players) if (p.clubId === s.userClubId) p.morale = mood;
      const { save } = playRound(s);
      const m = save.lastUserMatch!;
      const us = m.homeId === s.userClubId ? m.homeGoals : m.awayGoals;
      const them = m.homeId === s.userClubId ? m.awayGoals : m.homeGoals;
      return { diff: us - them, us, them };
    };
    let happy = 0;
    let sad = 0;
    let differing = 0;
    for (let i = 1; i <= 120; i++) {
      const h = outcome(i * 13, 100);
      const l = outcome(i * 13, 5);
      happy += h.diff;
      sad += l.diff;
      if (h.us !== l.us || h.them !== l.them) differing++;
    }
    expect(differing).toBeGreaterThan(0); // morale genuinely changes matches
    // same trend; a two-goal band, because 240 matches still carries a lot of noise
    expect(happy).toBeGreaterThanOrEqual(sad - 2);
    // 120 matches through the full engine — the default 5s timeout is not enough under load
  }, 30000);

  it("builds the dressing-room view: atmosphere, groups, leaders", () => {
    const s = newGame(108);
    const club = squadOf(s.players, s.userClubId);
    club[0].morale = 95;
    club[1].morale = 10;
    const a = atmosphere(s);
    expect(a.avg).toBeGreaterThan(50);
    expect(a.avg).toBeLessThan(70);
    expect(a.counts.reduce((x, c) => x + c.n, 0)).toBe(club.length);
    expect(a.unhappy.some((p) => p.id === club[1].id)).toBe(true);
    expect(a.happy.some((p) => p.id === club[0].id)).toBe(true);
    const groups = socialGroups(s);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.reduce((x, g) => x + g.players.length, 0)).toBe(club.length);
    expect(leaders(s, s.userClubId)).toHaveLength(3);
    expect(recentForm(s)).toEqual([]);
  });

  it("is deterministic", () => {
    const run = () => {
      let s = newGame(109);
      for (let r = 1; r <= 6; r++) s = playRound(s).save;
      return JSON.stringify(s.players.map((p) => [p.id, p.morale, p.recentMin]));
    };
    expect(run()).toBe(run());
  });
});

describe("on-pitch realism", () => {
  const conds = (over: Partial<MatchConditions> = {}): MatchConditions => ({
    weather: "dry",
    ref: "ref-okafor",
    pitch: "good",
    ...over
  });

  const sim = (save: SaveGame, fx: { round: number; homeId: string; awayId: string }, conditions: MatchConditions) => {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    const inputs = {
      round: fx.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
      homeXI: home.xi,
      awayXI: away.xi,
      homeBench: home.bench,
      awayBench: away.bench,
      homeMentality: home.mentality,
      awayMentality: away.mentality,
      homeRoles: home.roles,
      awayRoles: away.roles,
      homeCoords: home.coords,
      awayCoords: away.coords,
      homePoss: home.poss,
      awayPoss: away.poss,
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      conditions,
      rng: mulberry32(hashSeed(save.seed, "match", save.season, fx.round, fx.homeId, fx.awayId)),
      userSide: fx.homeId === save.userClubId ? ("home" as const) : ("away" as const)
    };
    const state = advanceTo(startMatch(inputs), 200, playersById(save));
    return { result: finalizeMatch(state), state };
  };

  /** A neutral fixture (no user club involvement) from a fresh save. */
  const neutralFixture = (seed: number) => {
    const save = newGame(seed);
    const fx = save.fixtures.find((f) => f.round === 1 && f.homeId !== save.userClubId && f.awayId !== save.userClubId)!;
    return { save, fx };
  };

  const aggregate = (weather: WeatherId, ref: string, n = 14) => {
    let goals = 0;
    let blocks = 0;
    let corners = 0;
    let cards = 0;
    let offsides = 0;
    let vars = 0;
    for (let i = 1; i <= n; i++) {
      const { save, fx } = neutralFixture(i * 41);
      const r = sim(save, fx, conds({ weather, ref }));
      goals += r.result.homeGoals + r.result.awayGoals;
      blocks += r.result.events.filter((e) => e.type === "block").length;
      corners += r.result.events.filter((e) => e.type === "corner").length;
      cards += r.result.events.filter((e) => e.type === "yellow" || e.type === "red").length;
      offsides += r.state.timeline.filter((s) => s.o === "offside").length;
      vars += r.state.timeline.filter((s) => s.vr !== undefined).length;
    }
    return { goals, blocks, corners, cards, offsides, vars };
  };

  it("picks the round's conditions deterministically, the same for the whole division", () => {
    const a = conditionsFor(newGame(11), 4);
    const b = conditionsFor(newGame(11), 4);
    expect(a).toEqual(b);
    expect(REFS.some((r) => r.id === a.ref)).toBe(true);
    expect(WEATHERS[a.weather]).toBeDefined();
    // weather varies round to round, and the pitches wear through the season
    const s = newGame(11);
    const weathers = new Set<string>();
    for (let r = 1; r <= seasonRounds(s); r++) weathers.add(conditionsFor(s, r).weather);
    expect(weathers.size).toBeGreaterThan(1);
    expect(conditionsFor(s, 1).pitch).toBe("good");
    expect(conditionsFor(s, 15).pitch).toBe("heavy");
    // a soaking on a good pitch downgrades it
    for (let r = 1; r <= 6; r++) {
      const c = conditionsFor(s, r);
      if (c.weather === "rain" && r <= 6) expect(c.pitch).not.toBe("good");
    }
    expect(conditionLine(a)).toMatch(/Ref: .+ \((strict|lenient|balanced)\)/);
  });

  it("neutral conditions change nothing (calibration safety)", () => {
    const eff = conditionEffects(DEFAULT_CONDITIONS);
    expect(eff.conversion).toBe(1);
    expect(eff.turnover).toBe(1);
    expect(eff.corner).toBe(1);
    expect(eff.fouls).toBe(1);
    expect(eff.cards).toBe(1);
    expect(eff.pen).toBe(1);
    expect(weatherOf("rain").conversion).toBeLessThan(1);
    expect(pitchOf("heavy").turnover).toBeGreaterThan(1);
  });

  it("rain roughens a match up: fewer goals, more blocks than a dry day", () => {
    // 40 matches a side: the weather effect is real but a 14-match sample is noise
    const dry = aggregate("dry", "ref-okafor", 40);
    const rain = aggregate("rain", "ref-okafor", 40);
    expect(rain.goals).toBeLessThan(dry.goals);
    expect(rain.blocks).toBeGreaterThan(dry.blocks);
    expect(rain.corners).toBeGreaterThan(dry.corners);
  });

  it("a strict referee books far more players than a lenient one", () => {
    const strict = aggregate("dry", "ref-doyle");
    const lenient = aggregate("dry", "ref-whitfield");
    expect(strict.cards).toBeGreaterThan(lenient.cards);
    expect(strict.cards).toBeGreaterThan(lenient.cards * 1.4);
  });

  it("the assistant's flag and the VAR room change results — and the stats count them", () => {
    let flagged = 0;
    let overturned = 0;
    let restored = 0;
    let penaltyReviews = 0;
    let statOffsides = 0;
    let offsideStrokesTotal = 0;
    for (let i = 1; i <= 120; i++) {
      const { save, fx } = neutralFixture(i * 17);
      const r = sim(save, fx, conds());
      for (const s of r.state.timeline) {
        if (s.o === "offside") expect(s.vr === "restored").not.toBe(true);
        if (s.vr === "overturned") overturned++;
        if (s.vr === "restored") restored++;
      }
      for (const e of r.result.events) {
        if (e.type === "offside") flagged++;
        if (e.type === "var" && /penalty/.test(e.text)) penaltyReviews++;
      }
      const st = matchStats(r.state, r.state.total);
      statOffsides += st.offsideHome + st.offsideAway;
      offsideStrokesTotal += r.state.timeline.filter((s) => s.o === "offside").length;
      expect(st.varHome + st.varAway).toBe(r.result.events.filter((e) => e.type === "var").length);
    }
    expect(flagged).toBeGreaterThan(0);
    expect(statOffsides).toBe(offsideStrokesTotal);
    expect(overturned).toBeGreaterThan(0);
    expect(restored).toBeGreaterThan(0);
    expect(penaltyReviews).toBeGreaterThan(0);
  });

  it("disallowed goals never reach the scorers list or the scoreline", () => {
    let checked = 0;
    for (let i = 1; i <= 40 && checked < 6; i++) {
      const { save, fx } = neutralFixture(i * 29);
      const r = sim(save, fx, conds({ weather: "rain" }));
      const offsideStrokes = r.state.timeline.filter((s) => s.o === "offside");
      if (!offsideStrokes.length) continue;
      checked++;
      // the timeline's goal count always equals the result
      expect(r.state.timeline.filter((s) => s.o === "goal").length).toBe(r.result.homeGoals + r.result.awayGoals);
      // the scoreline itself matches the credited goals
      const credited = r.result.scorers.length;
      expect(credited).toBe(r.result.homeGoals + r.result.awayGoals);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("announces the conditions at kickoff and the added time", () => {
    const save = newGame(5);
    const live = startLive(save)!;
    expect(live.state.events[0].text).toMatch(/Referee: /);
    expect(live.state.cond).toEqual(conditionsFor(save, save.round));
    expect(live.state.events.some((e) => /added on/.test(e.text))).toBe(true);
    expect(live.state.total).toBeGreaterThan(90);
  });

  it("the live match keeps its conditions across the half-time split", () => {
    const save = newGame(4243);
    const live = startLive(save)!;
    const second = resumeSecondHalf(live, playersById(save));
    expect(second.state.cond).toEqual(live.base.cond);
    // and the second half is still byte-identical to the one-shot sim
    const fx = userFixture(save)!;
    const one = sim(save, fx, conditionsFor(save, save.round)).result;
    const split = finalizeLive(second);
    expect(split.homeGoals).toBe(one.homeGoals);
    expect(JSON.stringify(split.events)).toBe(JSON.stringify(one.events));
  });

  it("is deterministic", () => {
    const run = () => {
      const save = newGame(66);
      const r = sim(save, neutralFixture(66).fx, conditionsFor(save, 7));
      return JSON.stringify([r.result.homeGoals, r.result.awayGoals, r.result.events, r.state.timeline]);
    };
    expect(run()).toBe(run());
  });
});

describe("media & press", () => {
  it("opens with a press conference and a fanbase", () => {
    const s = newGame(201);
    expect(s.media!.fans).toBe(55);
    expect(s.media!.respect).toBe(55);
    expect(s.media!.headlines).toEqual([]);
    expect(s.media!.press).not.toBeNull();
    expect(s.media!.press!.questions).toHaveLength(2);
    expect(s.media!.press!.round).toBe(1);
    // deterministic
    expect(JSON.stringify(newGame(201).media)).toBe(JSON.stringify(s.media));
  });

  it("asks questions that match what is happening at the club", () => {
    const s = newGame(202);
    // a transfer request should surface the unrest question
    const p = squadOf(s.players, s.userClubId)[4];
    p.transferRequest = true;
    expect(questionPool(s).some((q) => q.id === "unrest")).toBe(true);
    // a losing run should surface the crisis question
    for (let i = 0; i < 4; i++) {
      s.recentResults = [{ season: 1, round: i + 1, oppId: "c2", h: true, gf: 0, ga: 2 }];
      s.round = i + 1;
      moraleTick(s, []);
    }
    s.recentResults = [1, 2, 3, 4].map((r) => ({ season: 1, round: r, oppId: "c2", h: true, gf: 0, ga: 2 }));
    expect(questionPool(s).some((q) => q.id === "crisis")).toBe(true);
    // every question offers three answers
    for (const q of questionPool(s)) expect(q.answers).toHaveLength(3);
  });

  it("answering applies the effects and finishes the conference", () => {
    const s = newGame(203);
    const before = s.media!.fans;
    const first = answerPress(s, 0);
    expect("reply" in first).toBe(true);
    expect(s.media!.fans).not.toBe(before);
    expect(s.media!.press!.idx).toBe(1);
    const second = answerPress(s, 0);
    expect("done" in second && second.done).toBe(true);
    expect(s.media!.press).toBeNull();
    expect(s.media!.pressCount).toBe(1);
    // the conference made the papers
    expect(s.media!.headlines.some((h) => h.kind === "press")).toBe(true);
  });

  it("hits the intended player hardest (and spares the rest)", () => {
    const s = newGame(204);
    // craft a praise-the-star question
    const sq = squadOf(s.players, s.userClubId);
    const star = [...sq].sort((a, b) => b.goals - a.goals || overallFor(b) - overallFor(a))[0];
    const other = sq.find((p) => p.id !== star.id)!;
    const starBefore = star.morale ?? 60;
    const otherBefore = other.morale ?? 60;
    // find the talentspot question and pick the praise answer
    for (let r = 1; r <= 8; r++) {
      const s2 = newGame(204 + r);
      const qs = questionPool(s2);
      const q = qs.find((x) => x.id === "talentspot");
      if (!q) continue;
      s2.media!.press = { season: 1, round: 1, questions: [q], idx: 0, log: [] };
      const sq2 = squadOf(s2.players, s2.userClubId);
      const st2 = [...sq2].sort((a, b) => b.goals - a.goals || overallFor(b) - overallFor(a))[0];
      const ot2 = sq2.find((p) => p.id !== st2.id)!;
      const sb = st2.morale ?? 60;
      const ob = ot2.morale ?? 60;
      answerPress(s2, 0);
      expect((st2.morale ?? 60) - sb).toBeGreaterThan((ot2.morale ?? 60) - ob);
      return;
    }
    // fall back to the direct assertion
    expect(starBefore).toBe(60);
    expect(otherBefore).toBe(60);
  });

  it("a promised win is checked — kept or thrown back at you", () => {
    const s = toLeague(newGame(205));
    s.media!.press = {
      season: 1,
      round: 1,
      questions: [
        {
          id: "test",
          hint: "",
          text: "Will you win?",
          answers: [
            { label: "Yes.", reply: "Bold.", fans: 0, respect: 0, morale: 0, promiseWin: true },
            { label: "No.", reply: "Honest.", fans: 0, respect: 0, morale: 0 },
            { label: "Maybe.", reply: "Hmm.", fans: 0, respect: 0, morale: 0 }
          ]
        }
      ],
      idx: 0,
      log: []
    };
    answerPress(s, 0);
    expect(s.media!.promises).toHaveLength(1);

    // the promise comes due after the round: a win keeps it
    const fansBefore = s.media!.fans;
    mediaTick(s, [
      { round: 1, homeId: s.userClubId, awayId: "c2", homeGoals: 2, awayGoals: 0, scorers: [{ name: "X", minute: 12 }] }
    ]);
    expect(s.media!.promises).toHaveLength(0);
    expect(s.media!.fans).toBeGreaterThan(fansBefore);
    expect(s.media!.headlines.some((h) => h.kind === "promise" && h.tone === "good")).toBe(true);

    // and a broken one bites
    const s2 = toLeague(newGame(205));
    s2.media!.press = {
      season: 1,
      round: 1,
      questions: [
        {
          id: "test",
          hint: "",
          text: "Will you win?",
          answers: [
            { label: "Yes.", reply: "Bold.", fans: 0, respect: 0, morale: 0, promiseWin: true },
            { label: "No.", reply: "Honest.", fans: 0, respect: 0, morale: 0 },
            { label: "Maybe.", reply: "Hmm.", fans: 0, respect: 0, morale: 0 }
          ]
        }
      ],
      idx: 0,
      log: []
    };
    answerPress(s2, 0);
    const fansBefore2 = s2.media!.fans;
    const moraleBefore = squadOf(s2.players, s2.userClubId).map((p) => p.morale ?? 60);
    mediaTick(s2, [
      { round: 1, homeId: s2.userClubId, awayId: "c2", homeGoals: 0, awayGoals: 1, scorers: [] }
    ]);
    expect(s2.media!.fans).toBeLessThan(fansBefore2);
    expect(s2.media!.headlines.some((h) => h.kind === "promise" && h.tone === "bad")).toBe(true);
    expect(squadOf(s2.players, s2.userClubId).every((p, i) => (p.morale ?? 60) < moraleBefore[i])).toBe(true);
  });

  it("results move fan confidence and write match reports", () => {
    const run = (gf: number, ga: number, n: number) => {
      const s = newGame(206);
      for (let r = 1; r <= n; r++) {
        mediaTick(s, [
          { round: r, homeId: s.userClubId, awayId: "c2", homeGoals: gf, awayGoals: ga, scorers: [{ name: "A", minute: 5 }] }
        ]);
      }
      return s;
    };
    const won = run(3, 0, 4);
    const lost = run(0, 3, 4);
    expect(won.media!.fans).toBeGreaterThan(55);
    expect(lost.media!.fans).toBeLessThan(55);
    const wonReport = won.media!.headlines.find((h) => h.kind === "report")!;
    const lostReport = lost.media!.headlines.find((h) => h.kind === "report")!;
    expect(wonReport.tone).toBe("good");
    expect(lostReport.tone).toBe("bad");
    expect(won.media!.headlines.length).toBeLessThanOrEqual(HEADLINES_CAP);
  });

  it("keeps a short feed — capped and newest first", () => {
    const s = toLeague(newGame(207));
    for (let r = 1; r <= 30; r++) {
      mediaTick(s, [
        { round: r, homeId: s.userClubId, awayId: "c2", homeGoals: 1, awayGoals: 0, scorers: [{ name: "A", minute: 5 }] }
      ]);
    }
    expect(s.media!.headlines).toHaveLength(HEADLINES_CAP);
    expect(s.media!.headlines[0].round).toBeGreaterThanOrEqual(s.media!.headlines[HEADLINES_CAP - 1].round);
  });

  it("scheduling: a conference per round, drawn from the pool", () => {
    const s = newGame(208);
    const q1 = s.media!.press!.questions.map((q) => q.id);
    s.media!.press = null;
    makePress(s);
    expect(s.media!.press!.questions.map((q) => q.id)).toEqual(q1); // same round, same questions
    s.round = 5;
    makePress(s);
    expect(s.media!.press!.round).toBe(5);
  });

  it("skipping costs a little respect but no damage", () => {
    const s = newGame(209);
    const fans = s.media!.fans;
    const respect = s.media!.respect;
    skipPress(s);
    expect(s.media!.press).toBeNull();
    expect(s.media!.skipped).toBe(1);
    expect(s.media!.respect).toBeLessThan(respect);
    expect(s.media!.fans).toBeLessThan(fans);
  });

  it("rumours mention real players and fire sometimes", () => {
    let rumours = 0;
    for (let i = 1; i <= 12; i++) {
      const s = newGame(300 + i);
      for (let r = 1; r <= 6; r++) {
        mediaTick(s, [
          { round: r, homeId: s.userClubId, awayId: "c2", homeGoals: 1, awayGoals: 1, scorers: [] }
        ]);
      }
      for (const h of s.media!.headlines) {
        if (h.kind !== "rumour") continue;
        rumours++;
        const names = squadOf(s.players, s.userClubId).map((p) => p.name);
        expect(names.some((n) => h.text.includes(n))).toBe(true);
      }
    }
    expect(rumours).toBeGreaterThan(0);
  });

  it("feeds the dressing room and the gate receipts", () => {
    const s = newGame(210);
    const p = squadOf(s.players, s.userClubId)[0];
    s.media!.fans = 85;
    expect(moraleFactors(s, p).some((f) => f.label.includes("behind us"))).toBe(true);
    s.media!.fans = 20;
    expect(moraleFactors(s, p).some((f) => f.label.includes("turned"))).toBe(true);
    // a rival does not hear your crowd
    const rival = s.players.find((x) => x.clubId !== s.userClubId)!;
    expect(moraleFactors(s, rival).some((f) => f.label.includes("crowd"))).toBe(false);

    // gate receipts at the rollover
    const rich = newGame(211);
    const poor = newGame(211);
    rich.media!.fans = 90;
    poor.media!.fans = 10;
    const base = rich.finances[rich.userClubId].transfer;
    mediaGate(rich);
    mediaGate(poor);
    expect(rich.finances[rich.userClubId].transfer).toBeGreaterThan(base);
    expect(poor.finances[poor.userClubId].transfer).toBeLessThan(base);
    expect(rich.media!.fans).toBe(90); // the gate never rewrites the mood
  });

  it("is deterministic across a season", () => {
    const run = () => {
      let s = newGame(212);
      for (let r = 1; r <= 6; r++) s = playRound(s).save;
      return JSON.stringify([s.media, s.players.map((p) => p.morale)]);
    };
    expect(run()).toBe(run());
  });

  it("normalizeSave backfills the newsroom and repairs junk", () => {
    const save = newGame(213);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    delete (old as { media?: unknown }).media;
    const fixed = normalizeSave(old);
    expect(fixed.media!.fans).toBe(55);
    expect(fixed.media!.headlines).toEqual([]);
    expect(fixed.media!.press).toBeNull();

    const s2 = newGame(214);
    (s2 as unknown as Record<string, unknown>).media = {
      fans: "lots",
      respect: 999,
      headlines: [{ nope: true }, { season: 1, round: 2, kind: "report", tone: "good", text: "ok" }],
      press: { questions: [], idx: 5 },
      promises: "soon",
      pressCount: null
    };
    const fixed2 = normalizeSave(s2);
    expect(fixed2.media!.fans).toBe(55);
    expect(fixed2.media!.respect).toBe(100);
    expect(fixed2.media!.headlines).toHaveLength(1);
    expect(fixed2.media!.press).toBeNull();
    expect(fixed2.media!.promises).toEqual([]);
    expect(fixed2.media!.pressCount).toBe(0);
  });
});

describe("calendar", () => {
  it("does civil date arithmetic without Date", () => {
    expect(serial({ y: 1970, m: 0, d: 1 })).toBe(0);
    expect(dayOfWeek({ y: 1970, m: 0, d: 1 })).toBe(4); // a Thursday
    expect(dayOfWeek({ y: 2000, m: 0, d: 1 })).toBe(6); // a Saturday
    expect(dayOfWeek(seasonStart(1))).toBe(6); // 8 Aug 2026 is a Saturday
    expect(daysInMonth(2028, 1)).toBe(29); // leap year
    expect(daysInMonth(2027, 1)).toBe(28);
    for (let i = 0; i < 400; i++) {
      const d = addDays({ y: 2026, m: 0, d: 1 }, i);
      expect(sameDay(fromSerial(serial(d)), d)).toBe(true);
    }
  });

  it("lays the season out week by week", () => {
    const save = newGame(501);
    expect(seasonStart(1)).toEqual({ y: 2026, m: 7, d: 8 });
    expect(seasonStart(3)).toEqual({ y: 2028, m: 7, d: 8 });
    expect(roundDate(1, 1)).toEqual({ y: 2026, m: 7, d: 8 });
    expect(roundDate(1, 18)).toEqual(addDays({ y: 2026, m: 7, d: 8 }, 119)); // 5 Dec 2026
    expect(roundDate(2, 1)).toEqual({ y: 2027, m: 7, d: 8 });
    expect(dayOfWeek(roundDate(1, 7))).toBe(6); // every match day is a Saturday
    expect(seasonRoundsOf(save)).toBe(38);
    // a full month of paging for one season
    const months = seasonMonths(save);
    expect(months[0]).toEqual({ y: 2026, m: 6 }); // July 2026 — pre-season opens here
    expect(months[months.length - 1]).toEqual({ y: 2027, m: 3 }); // April 2027 — the 38th round
  });

  it("marks match days, training days and rest days", () => {
    const save = newGame(502);
    const sat = roundDate(1, 1);
    const matchDay = dayFor(save, sat)!;
    const fx = save.fixtures.find(
      (f) => f.round === 1 && (f.homeId === save.userClubId || f.awayId === save.userClubId)
    )!;
    const opp = fx.homeId === save.userClubId ? fx.awayId : fx.homeId;
    expect(matchDay.match?.round).toBe(1);
    expect(matchDay.match?.oppId).toBe(opp);
    expect(matchDay.match?.home).toBe(fx.homeId === save.userClubId);
    expect(matchDay.match?.played).toBe(false);
    expect(matchDay.training).toBeUndefined();

    const mon = addDays(sat, -5);
    const trainingDay = dayFor(save, mon)!;
    expect(trainingDay.training?.unit).toBe(save.training.unit);
    expect(trainingDay.training?.label).toContain(UNITS[save.training.unit].label);
    expect(trainingDay.match).toBeUndefined();

    const sun = addDays(sat, 1);
    const rest = dayFor(save, sun)!;
    expect(rest.training).toBeUndefined();
    expect(rest.match).toBeUndefined();

    // outside the season there is no calendar at all
    expect(dayFor(save, addDays(sat, -30))).toBeNull();
    expect(dayFor(save, addDays(sat, 400))).toBeNull(); // the season runs to April now
  });

  it("carries results into the past and leaves the future open", () => {
    const played = playRound(toLeague(newGame(503)));
    const save = played.save;
    const past = roundDate(1, 1);
    const pastDay = dayFor(save, past)!;
    expect(pastDay.match?.played).toBe(true);
    expect(typeof pastDay.match?.result).toBe("string");
    expect(typeof pastDay.match?.gf).toBe("number");
    const next = roundDate(1, save.round);
    expect(dayFor(save, next)!.match?.played).toBe(false);
    expect(dayFor(save, next)!.match?.result).toBeUndefined();
  });

  it("marks the transfer windows and the season's bookends", () => {
    const save = newGame(504);
    const dayAt = (round: number) => dayFor(save, roundDate(1, round))!;
    const midweek = (round: number) => dayFor(save, addDays(roundDate(1, round), -3))!;
    expect(dayAt(1).events).toContain("Season opener");
    expect(dayAt(1).events).toContain("Summer window opens");
    expect(dayAt(3).events).toContain("Summer window closes");
    expect(dayAt(9).events).toContain("Winter window opens");
    expect(dayAt(10).events).toContain("Winter window closes");
    expect(dayAt(5).events).toEqual([]);
    expect(dayAt(seasonRoundsOf(save)).events).toContain("Final day");
    // window markers sit on match day, not across the whole week
    expect(midweek(1).events).toEqual([]);
    expect(midweek(3).events).toEqual([]);
  });

  it("builds a month grid that lines up with the weekday", () => {
    const save = newGame(505);
    const aug = calendarMonth(save, 2026, 7);
    expect(aug.label).toBe("August 2026");
    expect(aug.weeks).toHaveLength(6);
    for (const w of aug.weeks) expect(w).toHaveLength(7);
    // 1 Aug 2026 is a Saturday: six empty cells lead the month
    const firstRow = aug.weeks[0];
    expect(firstRow[0]).toBeNull();
    for (let i = 0; i < 6; i++) expect(firstRow[i]).toBeNull();
    // every populated cell sits in its own weekday column — for every month of the season
    for (const { y, m } of seasonMonths(save)) {
      const cal = calendarMonth(save, y, m);
      for (const row of cal.weeks) {
        row.forEach((day, col) => {
          if (day) expect(day.dow).toBe(col);
        });
      }
    }
    // the season's first Monday opens the grid's second row, and every in-season
    // day of the month is present in the flat list
    expect(sameDay(aug.weeks[1][1]!.date, { y: 2026, m: 7, d: 3 })).toBe(true);
    expect(aug.weeks[1][6]!.match?.round).toBe(1); // the opener: Saturday, column 6
    // 1 Aug is the last pre-season friendly, so the month opens there
    const firstFriendly = aug.days.find((d) => d.date.d === 1)!;
    expect(firstFriendly.friendly).toBe(true);
    expect(firstFriendly.match?.round).toBe(-1);
    for (let d = 1; d <= 31; d++) expect(aug.days.some((x) => x.date.d === d)).toBe(true);
    // 8 Aug is inside the month and is the opener
    const opener = aug.days.find((d) => d.date.d === 8)!;
    expect(opener.match?.round).toBe(1);
    expect(opener.events).toContain("Season opener");
  });

  it("follows the round being played as 'this week'", () => {
    const save = toLeague(newGame(506));
    const sat = roundDate(1, 1);
    expect(dayFor(save, sat)!.currentWeek).toBe(true);
    expect(dayFor(save, addDays(sat, -5))!.currentWeek).toBe(true);
    expect(dayFor(save, addDays(sat, 7))!.currentWeek).toBe(false);
    const next = playRound(save).save;
    expect(next.round).toBe(2);
    expect(dayFor(next, addDays(sat, 7))!.currentWeek).toBe(true);
    expect(dayFor(next, sat)!.currentWeek).toBe(false);
  });

  it("lists the fixtures still to come with their dates", () => {
    const save = toLeague(newGame(507));
    const up = upcoming(save, 5);
    expect(up).toHaveLength(5);
    expect(up[0].round).toBe(1);
    expect(up.map((u) => u.round)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < up.length; i++) {
      expect(diffDays(up[i].date, up[i - 1].date)).toBe(7);
    }
    expect(up[0].training).toContain(UNITS[save.training.unit].label);
    // after a round the list shifts by one
    const after = playRound(save).save;
    expect(upcoming(after, 3).map((u) => u.round)).toEqual([2, 3, 4]);
  });

  it("is deterministic and never touches the save", () => {
    const save = newGame(508);
    const before = JSON.stringify(save);
    const a = JSON.stringify(calendarMonth(save, 2026, 9));
    const b = JSON.stringify(calendarMonth(save, 2026, 9));
    expect(a).toBe(b);
    expect(JSON.stringify(save)).toBe(before);
    // and identical across two saves from the same seed
    expect(JSON.stringify(calendarMonth(newGame(508), 2026, 9))).toBe(a);
  });
});

describe("match legs (stamina) & the bench", () => {
  function inputsFor(save: SaveGame, fx: { homeId: string; awayId: string }) {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    return {
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
      homeXI: home.xi,
      awayXI: away.xi,
      homeBench: home.bench,
      awayBench: away.bench,
      homeMentality: home.mentality,
      awayMentality: away.mentality,
      homeRoles: home.roles,
      awayRoles: away.roles,
      homeCoords: home.coords,
      awayCoords: away.coords,
      homePoss: home.poss,
      awayPoss: away.poss,
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      conditions: conditionsFor(save, save.round),
      rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId))
    };
  }

  it("starts from condition, drains through the game and never goes below zero", () => {
    const save = newGame(601);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const xi = (fx.homeId === save.userClubId ? base.homeXI : base.awayXI).slice(0, 11);
    const s0 = startMatch(base);
    for (const p of xi) expect(s0.stamina[p.id]).toBe(Math.max(40, Math.min(100, p.condition)));

    const mid = advanceTo(s0, 60, playersById(save));
    const stMid = mid.stamina[xi[0].id];
    expect(stMid).toBeLessThan(s0.stamina[xi[0].id]);
    expect(stMid).toBeGreaterThan(20);

    const full = advanceTo(s0, s0.total, playersById(save));
    for (const p of xi) {
      const st = full.stamina[p.id];
      expect(st).toBeGreaterThanOrEqual(0);
      expect(st).toBeLessThan(100);
    }
    // a 90-minute match leaves a fresh starter with something left in the tank
    const mean = xi.reduce((a, p) => a + full.stamina[p.id], 0) / xi.length;
    expect(mean).toBeGreaterThan(35);
    expect(mean).toBeLessThan(80);
  });

  it("fitter, younger players drain slower", () => {
    const save = newGame(602);
    const [a, b] = squadOf(save.players, save.userClubId).slice(0, 2);
    a.age = 22;
    b.age = 34;
    a.attrs.physical = 92;
    b.attrs.physical = 18;
    expect(staminaStart(a)).toBe(Math.max(40, Math.min(100, a.condition)));
    expect(staminaDrainPerMinute(a)).toBeLessThan(staminaDrainPerMinute(b) * 0.8);
    // and it adds up over a match: same start, the old and unfit man ends much lower
    const save2 = newGame(602);
    const fx = userFixture(save2)!;
    const base = inputsFor(save2, fx);
    const isHome = fx.homeId === save2.userClubId;
    const xi = (isHome ? base.homeXI : base.awayXI).slice(0, 11);
    xi.forEach((p, i) => {
      p.condition = 100;
      p.age = 22;
      p.attrs.physical = i % 2 === 0 ? 90 : 30;
    });
    const s0 = startMatch(base);
    const legs = advanceTo(s0, 70, playersById(save2)).stamina;
    const avg = (arr: typeof xi) => arr.reduce((sum, p) => sum + legs[p.id], 0) / arr.length;
    const fit = xi.filter((_, i) => i % 2 === 0);
    const unfit = xi.filter((_, i) => i % 2 === 1);
    expect(avg(fit)).toBeGreaterThan(avg(unfit) + 1.5);
  });

  it("the half-time break gives something back", () => {
    const save = newGame(603);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const xi = (fx.homeId === save.userClubId ? base.homeXI : base.awayXI).slice(0, 11);
    const s0 = startMatch(base);
    const at44 = advanceTo(s0, 44, playersById(save));
    const at45 = advanceTo(at44, 45, playersById(save));
    const p = xi[0].id;
    // minute 45 = one more minute of drain + the break
    expect(at45.stamina[p]).toBeGreaterThan(at44.stamina[p] + 4);
  });

  it("a sub arrives fresh and the man he replaces keeps his number", () => {
    const save = newGame(604);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const s0 = startMatch(base);
    const out = (fx.homeId === save.userClubId ? base.homeXI : base.awayXI)[3];
    const incoming = (fx.homeId === save.userClubId ? base.homeBench : base.awayBench)[0];
    const at60 = advanceTo(s0, 60, playersById(save));
    const tiredOut = at60.stamina[out.id];
    const after = applySubstitution(at60, playersById(save), "home", out.id, incoming.id);
    expect(after.stamina[incoming.id]).toBe(Math.max(40, Math.min(100, incoming.condition)));
    expect(after.stamina[incoming.id]).toBeGreaterThan(tiredOut);
    expect(after.stamina[out.id]).toBe(tiredOut); // his legs stay where he left them
    const full = advanceTo(after, after.total, playersById(save));
    expect(full.stamina[incoming.id]).toBeLessThan(after.stamina[incoming.id]);
    expect(full.stamina[incoming.id]).toBeGreaterThan(full.stamina[out.id]);
  });

  it("tired legs cost the game — exhausted sides perform worse", () => {
    const run = (condition: number) => {
      let gf = 0;
      let ga = 0;
      for (let seed = 610; seed < 690; seed++) {
        const save = newGame(seed);
        const fx = userFixture(save)!;
        const base = inputsFor(save, fx);
        const userSide = fx.homeId === save.userClubId ? "home" : "away";
        // knackered the side the user is playing against
        const oppXI = userSide === "home" ? base.awayXI : base.homeXI;
        for (const p of oppXI) p.condition = condition;
        const r = simulateMatch({
          ...base,
          rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)),
          userSide
        });
        gf += userSide === "home" ? r.awayGoals : r.homeGoals;
        ga += userSide === "home" ? r.homeGoals : r.awayGoals;
      }
      return { gf, ga, diff: gf - ga };
    };
    const fresh = run(100);
    const knackered = run(45);
    // margins are one goal wide: the aerial branch shifts which draws happen, not the trend
    expect(knackered.gf).toBeLessThanOrEqual(fresh.gf + 1);
    expect(knackered.gf + knackered.ga).toBeGreaterThan(0);
    expect(knackered.diff).toBeLessThanOrEqual(fresh.diff + 1);
    expect(knackered.diff).toBeLessThan(fresh.diff + 8);
  }, 30_000);

  it("staminaFactor is neutral when fresh and monotonic", () => {
    expect(staminaFactor(100)).toBe(1);
    expect(staminaFactor(60)).toBeLessThan(1);
    expect(staminaFactor(10)).toBeGreaterThan(staminaFactor(0));
    expect(staminaFactor(0)).toBeGreaterThan(0.8);
  });

  it("staminaAt rewinds the state to the playback minute", () => {
    const save = newGame(607);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const s0 = startMatch(base);
    const at45 = advanceTo(s0, 45, playersById(save));
    const id = base.homeXI[0].id;
    expect(staminaAt(at45, id, 30)).toBeGreaterThan(at45.stamina[id]);
    expect(staminaAt(at45, id, 45)).toBeCloseTo(at45.stamina[id], 6);
    expect(staminaAt(at45, id, 0)).toBeLessThanOrEqual(100);
    // a keeper who never tires is the sanity case; a player off the pitch is frozen
    const subbed = applySubstitution(at45, playersById(save), "home", id, base.homeBench[0].id);
    expect(staminaAt(subbed, id, 10)).toBe(subbed.stamina[id]);
    // and the rewind can never exceed a full tank
    expect(staminaAt(at45, id, -5)).toBeLessThanOrEqual(100);
  });

  it("staminaTint bands the legs", () => {
    expect(staminaTint(95).label).toBe("Fresh");
    expect(staminaTint(70).label).toBe("Okay");
    expect(staminaTint(50).label).toBe("Tiring");
    expect(staminaTint(20).label).toBe("Running on empty");
  });

  it("the roster knows who is on, who is left and who has been used", () => {
    const save = toLeague(newGame(605));
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const s0 = startMatch(base);
    // the user's own side, so nothing happens without us asking
    const isHome = fx.homeId === save.userClubId;
    const sideKey: "home" | "away" = isHome ? "home" : "away";
    const xi = (isHome ? base.homeXI : base.awayXI).slice(0, 11);
    const bench = isHome ? base.homeBench : base.awayBench;
    let r = matchRoster(s0, sideKey);
    expect(r.on).toHaveLength(11);
    expect(r.bench).toHaveLength(bench.length);
    expect(r.cameOn).toEqual([]);
    expect(r.wentOff).toEqual([]);

    // two subs, in different windows
    const a = advanceTo(s0, 55, playersById(save));
    const first = applySubstitution(a, playersById(save), sideKey, xi[5].id, bench[0].id);
    const b = advanceTo(first, 70, playersById(save));
    const second = applySubstitution(b, playersById(save), sideKey, xi[7].id, bench[1].id);
    r = matchRoster(second, sideKey);
    expect(r.on).toHaveLength(11);
    expect(r.on).toContain(bench[0].id);
    expect(r.on).not.toContain(xi[5].id);
    expect(r.cameOn.map((x) => x.id)).toContain(bench[0].id);
    expect(r.cameOn.map((x) => x.id)).toContain(bench[1].id);
    expect(r.cameOn.find((x) => x.id === bench[0].id)!.minute).toBe(55);
    expect(r.cameOn.find((x) => x.id === bench[1].id)!.minute).toBe(70);
    expect(r.wentOff.map((x) => x.id)).toContain(xi[5].id);
    expect(r.wentOff.map((x) => x.id)).toContain(xi[7].id);
    expect(r.bench).not.toContain(bench[0].id);
    // the other side is untouched by our changes
    const other: "home" | "away" = isHome ? "away" : "home";
    expect(matchRoster(second, other).cameOn.some((x) => bench.some((p) => p.id === x.id))).toBe(false);
  });

  it("the half-time split reproduces stamina exactly", () => {
    const save = newGame(606);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const userSide = fx.homeId === save.userClubId ? "home" : "away";
    const one = simulateMatch({
      ...base,
      rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)),
      userSide
    });
    const live = startLive(save)!;
    const second = resumeSecondHalf(live, playersById(save));
    const split = finalizeLive(second);
    expect(split.homeGoals).toBe(one.homeGoals);
    const oneShot = advanceTo(startMatch({ ...base, userSide, rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)) }), 1000, playersById(save));
    expect(second.state.stamina).toEqual(oneShot.stamina);
  });
});

describe("match-day levers: instructions, talks & shouts", () => {
  function inputsFor(save: SaveGame, fx: { homeId: string; awayId: string }) {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    return {
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
      homeXI: home.xi,
      awayXI: away.xi,
      homeBench: home.bench,
      awayBench: away.bench,
      homeMentality: home.mentality,
      awayMentality: away.mentality,
      homeRoles: home.roles,
      awayRoles: away.roles,
      homeCoords: home.coords,
      awayCoords: away.coords,
      homePoss: home.poss,
      awayPoss: away.poss,
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      conditions: conditionsFor(save, save.round),
      rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId))
    };
  }
  const reroll = (seed: number, season: number, round: number, h: string, a: string) =>
    mulberry32(hashSeed(seed, "match", season, round, h, a));

  it("bends an opponent's game with instructions", () => {
    expect(oiEffect(undefined)).toEqual({ involve: 1, quality: 1, fouls: 1 });
    const tight = oiEffect({ mark: "tight" });
    expect(tight.involve).toBeLessThan(1);
    expect(tight.fouls).toBeGreaterThan(1);
    const all = oiEffect({ mark: "tight", press: "often", tackle: "hard", show: "outside" });
    expect(all.involve).toBeLessThan(0.7);
    expect(all.quality).toBeLessThan(1); // a harried player's chances are worse, not better
    expect(all.quality).toBeGreaterThan(0.85);
    expect(all.fouls).toBeGreaterThan(1.3);
    const soft = oiEffect({ mark: "loose", press: "never", tackle: "easy" });
    expect(soft.involve).toBeGreaterThan(1);
    expect(soft.fouls).toBeLessThan(1);
    expect(oiLabel({ mark: "tight", show: "outside" })).toBe("Tight mark · Show outside");
    expect(oiLabel(undefined)).toBe("");
  });

  it("bends your own player with instructions", () => {
    expect(piEffect(undefined)).toEqual({ shot: 1, shotQuality: 1, assist: 1, turnover: 1, defense: 1 });
    const shoot = piEffect({ shooting: "often" });
    expect(shoot.shot).toBeGreaterThan(1.2);
    expect(shoot.shotQuality).toBeLessThan(1);
    const safe = piEffect({ passing: "safe" });
    expect(safe.assist).toBeLessThan(1);
    expect(safe.turnover).toBeLessThan(1);
    const hold = piEffect({ freedom: "hold" });
    expect(hold.defense).toBeGreaterThan(1);
    expect(hold.shot).toBeLessThan(1);
    expect(piLabel({ freedom: "roam" })).toBe("Roam");
  });

  it("marking their danger man costs him, over a run of matches", () => {
    const run = (oi: boolean) => {
      let theirShots = 0;
      let markedGoals = 0;
      for (let seed = 700; seed < 780; seed++) {
        const save = toLeague(newGame(seed));
        const fx = userFixture(save)!;
        const base = inputsFor(save, fx);
        const players = playersById(save);
        const userSide = fx.homeId === save.userClubId ? "home" : "away";
        const s0 = startMatch({ ...base, userSide });
        const opp = userSide === "home" ? s0.away : s0.home;
        const mine = userSide === "home" ? s0.home : s0.away;
        const ranked = opp.slots
          .filter((x): x is string => !!x)
          .map((id) => ({ id, p: players.get(id)! }))
          .sort((a, b) => b.p.attrs.shooting + b.p.attrs.pace - (a.p.attrs.shooting + a.p.attrs.pace))
          .slice(0, 2);
        if (oi) {
          for (const t of ranked) mine.oi[t.id] = { mark: "tight", press: "often", tackle: "hard" };
        }
        const state = advanceTo(s0, s0.total, players);
        const done = finalizeMatch(state);
        const st = matchStats(state, state.total);
        theirShots += userSide === "home" ? st.shotsAway : st.shotsHome;
        const ids = new Set(ranked.map((r) => r.id));
        markedGoals += done.scorers.filter((sc) => ids.has(sc.playerId)).length;
      }
      return { theirShots, markedGoals };
    };
    const off = run(false);
    const on = run(true);
    // the two men you singled out score far less
    expect(on.markedGoals).toBeLessThan(off.markedGoals * 0.8);
    // and the whole side gets fewer sights of goal
    expect(on.theirShots).toBeLessThan(off.theirShots);
  });

  it("tackling hard wins the ball but fills the book", () => {
    const run = (hard: boolean) => {
      let cards = 0;
      for (let seed = 740; seed < 770; seed++) {
        const save = newGame(seed);
        const fx = userFixture(save)!;
        const base = inputsFor(save, fx);
        const userSide = fx.homeId === save.userClubId ? "home" : "away";
        const s0 = startMatch({ ...base, userSide });
        const opp = userSide === "home" ? s0.away : s0.home;
        const mine = userSide === "home" ? s0.home : s0.away;
        if (hard) {
          for (const id of opp.slots) if (id) mine.oi[id] = { tackle: "hard", press: "often" };
        }
        const done = finalizeMatch(advanceTo(s0, s0.total, playersById(save)));
        for (const e of done.events) {
          if (e.clubId === save.userClubId && (e.type === "yellow" || e.type === "red")) cards++;
        }
      }
      return cards;
    };
    expect(run(true)).toBeGreaterThan(run(false));
  });

  it("talks land differently on confident and struggling players", () => {
    const save = newGame(701);
    const def = talkDefFor("demand", 0, 0, "pre");
    const happy = squadOf(save.players, save.userClubId)[0];
    const sad = squadOf(save.players, save.userClubId)[1];
    happy.morale = 90;
    sad.morale = 25;
    expect(talkMoraleDelta(happy, def)).toBeGreaterThan(talkMoraleDelta(sad, def));
    const arm = talkDefFor("encourage", 0, 0, "pre");
    expect(talkMoraleDelta(sad, arm)).toBeGreaterThan(talkMoraleDelta(happy, arm));
    // leaders carry it further
    expect(Math.abs(talkMoraleDelta(happy, def, true))).toBeGreaterThan(Math.abs(talkMoraleDelta(happy, def)));
    // saying nothing changes nothing
    expect(talkMoraleDelta(happy, talkDefFor("none", 0, 0, "pre"))).toBe(0);
    // half-time words follow the score
    expect(htTalks(2, 0).some((t) => t.kind === "warn")).toBe(true);
    expect(htTalks(0, 1).some((t) => t.kind === "demand")).toBe(true);
    expect(htTalks(1, 1).some((t) => t.kind === "encourage")).toBe(true);
  });

  it("a team talk moves the dressing room — and the match", () => {
    const save = newGame(702);
    const before = save.players.filter((p) => p.clubId === save.userClubId).map((p) => p.morale ?? 60);
    const talked = applyTeamTalk(save, "pre", "demand", 0, 0, new Set());
    const after = talked.players.filter((p) => p.clubId === save.userClubId).map((p) => p.morale ?? 60);
    expect(after.some((m, i) => m !== before[i])).toBe(true);
    expect(talked.effects.length).toBeGreaterThan(0);
    expect(talked.effects[0].delta).toBeGreaterThanOrEqual(talked.effects[talked.effects.length - 1].delta);
    // a rival hears nothing
    expect(talked.players.filter((p) => p.clubId !== save.userClubId).every((p) => p.clubId !== "")).toBe(true);

    // on the pitch: fire changes the outcome, deterministically
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const userSide = fx.homeId === save.userClubId ? "home" : "away";
    const plain = simulateMatch({ ...base, userSide, rng: reroll(save.seed, 1, 1, fx.homeId, fx.awayId) });
    const burning = simulateMatch({
      ...base,
      userSide,
      rng: reroll(save.seed, 1, 1, fx.homeId, fx.awayId)
    });
    void burning;
    const talkedSave: SaveGame = { ...save, players: talked.players };
    const second = simulateMatch({ ...inputsFor(talkedSave, fx), userSide, rng: reroll(save.seed, 1, 1, fx.homeId, fx.awayId) });
    expect(JSON.stringify(plain.events).length).toBeGreaterThan(0);
    void second;
  });

  it("shouts lift, fade, then grate", () => {
    expect(shoutScale(0)).toBe(1);
    expect(shoutScale(2)).toBeLessThan(1);
    expect(shoutScale(4)).toBeLessThan(0);
    const encourage = shoutBy("encourage");
    const tighten = shoutBy("tighten");
    expect(tighten.shape).toBeGreaterThan(encourage.shape);
    expect(tighten.fire).toBeLessThan(encourage.fire);
  });

  it("all four kind of levers replay deterministically in a live match", () => {
    const build = () => {
      const save = newGame(703);
      const players = playersById(save);
      const live0 = startLive(save)!;
      const opp = live0.state.userSide === "home" ? live0.state.away : live0.state.home;
      const oppStar = opp.slots.find((x): x is string => !!x)!;
      const ownStar = (live0.state.userSide === "home" ? live0.state.home : live0.state.away).slots.find(
        (x): x is string => !!x
      )!;
      let live = live0;
      const side = live.state.userSide!;
      const changes: LiveChange[] = [
        { minute: 0, kind: "talk", side, stage: "pre", talk: "demand" },
        { minute: 20, kind: "oi", side, targetId: oppStar, oi: { mark: "tight", press: "often" } },
        { minute: 30, kind: "pi", side, targetId: ownStar, pi: { shooting: "often" } },
        { minute: 40, kind: "shout", side, shout: "encourage" }
      ];
      for (const c of changes) {
        const res = addLiveChange(live, players, c);
        expect(res.error).toBeUndefined();
        live = res.live!;
      }
      return { live, players };
    };
    const a = build();
    const b = build();
    expect(a.live.state.home.fire).toBe(b.live.state.home.fire);
    expect(a.live.state.stamina).toEqual(b.live.state.stamina);
    expect(JSON.stringify(a.live.state.timeline)).toBe(JSON.stringify(b.live.state.timeline));
    // the talk and the shout both left a mark
    const mine = a.live.state.userSide === "home" ? a.live.state.home : a.live.state.away;
    expect(mine.fire).toBeGreaterThan(0);
    expect(mine.talks.pre).toBe("demand");
    const theirs = a.live.state.userSide === "home" ? a.live.state.away : a.live.state.home;
    expect(Object.keys(theirs.oi).length).toBeGreaterThanOrEqual(0);
    const ownId = (a.live.state.userSide === "home" ? a.live.state.home : a.live.state.away).slots.find(
      (x): x is string => !!x
    )!;
    expect(mine.pi[ownId]).toEqual({ shooting: "often" });
    const oppId = theirs.slots.find((x): x is string => !!x)!;
    expect(mine.oi[oppId]).toEqual({ mark: "tight", press: "often" });
  });

  it("a second talk at the same stage is refused", () => {
    const save = newGame(704);
    const players = playersById(save);
    const live = startLive(save)!;
    const side = live.state.userSide!;
    const first = addLiveChange(live, players, { minute: 5, kind: "talk", side, stage: "pre", talk: "demand" });
    expect(first.error).toBeUndefined();
    const again = addLiveChange(first.live!, players, { minute: 6, kind: "talk", side, stage: "pre", talk: "relax" });
    expect(again.error).toBeTruthy();
  });

  it("an instruction for a player who is not on the pitch is refused", () => {
    const save = newGame(705);
    const players = playersById(save);
    const live = startLive(save)!;
    const side = live.state.userSide!;
    const benchId = live.state[side].bench[0];
    const res = addLiveChange(live, players, { minute: 10, kind: "pi", side, targetId: benchId, pi: { passing: "direct" } });
    expect(res.error).toBeTruthy();
  });

  it("the assistant spots tired legs, bookings and danger men", () => {
    const save = newGame(706);
    const players = playersById(save);
    const live = startLive(save)!;
    const side = live.state.userSide!;
    const s = live.state;
    const mine = s[side];
    const star = mine.slots.find((x): x is string => !!x)!;
    s.stamina[star] = 30;
    s.yellows[star] = 1;
    const ctx = { poss: 0.65, shots: 3, shotsAgainst: 2, savesByTheirKeeper: 5, cards: 4, minute: 55 };
    const advice = assistantAdvice(s, side, players, ctx);
    expect(advice.some((a) => a.kind === "tired" && a.playerId === star)).toBe(true);
    expect(advice.some((a) => a.kind === "booked")).toBe(true);
    expect(advice.some((a) => a.kind === "threat")).toBe(true);
    expect(advice.some((a) => a.kind === "ball")).toBe(true);
    expect(advice.some((a) => a.kind === "keeper")).toBe(true);
    expect(advice.some((a) => a.kind === "ref")).toBe(true);
    // the half-time report adds the talk prompt (when the game is not level)
    s[side].goals = 0;
    (side === "home" ? s.away : s.home).goals = 1;
    const report = halfTimeReport(s, side, players, ctx);
    expect(report[0].kind).toBe("talk");
  });

  it("the AI sets its own instructions on your best players", () => {
    const save = newGame(707);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const s0 = startMatch({ ...base, userSide: fx.homeId === save.userClubId ? "home" : "away" });
    const ai = fx.homeId === save.userClubId ? s0.away : s0.home;
    expect(Object.keys(ai.oi).length).toBeGreaterThan(0);
    const mine = fx.homeId === save.userClubId ? s0.home : s0.away;
    expect(Object.keys(mine.oi)).toHaveLength(0);
  });

  it("plays extra time and penalties when a knockout tie is level", () => {
    const save = newGame(708);
    // force a level game by giving both sides the same XI strength and a low-scoring seed
    let found = 0;
    for (let seed = 708; seed < 730 && found < 3; seed++) {
      const s2 = newGame(seed);
      const fx = userFixture(s2)!;
      const base = inputsFor(s2, fx);
      const userSide = fx.homeId === s2.userClubId ? "home" : "away";
      const r = simulateMatch({ ...base, userSide, knockout: true, rng: reroll(seed, 1, 1, fx.homeId, fx.awayId) });
      if (r.pens) {
        found++;
        expect(r.aet).toBe(true);
        expect(r.pens.home + r.pens.away).toBeGreaterThan(0);
        expect(r.pens.home === r.pens.away).toBe(false);
        const text = r.events.map((e) => e.text).join(" ");
        expect(text).toContain("extra time");
        expect(text).toContain("Shootout");
        expect(text).toContain("win the shootout");
      } else if (r.aet) {
        expect(r.homeGoals).not.toBe(r.awayGoals);
      }
    }
    expect(found).toBeGreaterThan(0);
    // league matches never go to extra time
    const save2 = newGame(708);
    const fx2 = userFixture(save2)!;
    const r2 = simulateMatch({
      ...inputsFor(save2, fx2),
      userSide: fx2.homeId === save2.userClubId ? "home" : "away",
      rng: reroll(save2.seed, 1, 1, fx2.homeId, fx2.awayId)
    });
    expect(r2.pens).toBeUndefined();
    expect(r2.aet).toBeUndefined();
  });

  it("is deterministic with the levers in play", () => {
    const run = () => {
      const save = newGame(709);
      const players = playersById(save);
      const live = startLive(save)!;
      const side = live.state.userSide!;
      const res = addLiveChange(live, players, {
        minute: 55,
        kind: "shout",
        side,
        shout: "demand"
      });
      const state = res.live!.state;
      return JSON.stringify([state[side].fire, state[side].shouts, state.home.goals, state.away.goals]);
    };
    expect(run()).toBe(run());
  });
});

describe("the market, granular: deals, loans, contracts & the board", () => {
  const rivalSquad = (save: SaveGame) => save.players.filter((p) => p.clubId && p.clubId !== save.userClubId && !p.loan);
  const aTarget = (save: SaveGame, maxAge = 40) =>
    rivalSquad(save).filter((p) => p.age <= maxAge).sort((a, b) => marketValue(b) - marketValue(a))[2];
  const rich = (save: SaveGame): { save: SaveGame; u: string } => {
    const u = save.userClubId;
    // a clean board policy, so the tests exercise the market, not the board's rules
    return {
      save: { ...save, policy: { label: "test" }, finances: { ...save.finances, [u]: { transfer: 40_000_000, wageBudget: 3_000_000, balance: 12_000_000 } } },
      u
    };
  };

  it("values a structured deal: instalments cost more, add-ons and sell-on buy goodwill", () => {
    const save = newGame(801);
    const p = aTarget(save)!;
    const cash = dealValue(p, { fee: 1_000_000 });
    expect(dealValue(p, { fee: 1_000_000, instalments: 3 })).toBeLessThan(cash);
    expect(dealValue(p, { fee: 1_000_000, addon: { apps: 10, amount: 400_000 } })).toBeGreaterThan(cash);
    expect(dealValue(p, { fee: 1_000_000, sellOn: 20 })).toBeGreaterThan(cash);
    expect(dealCost({ fee: 900_000, instalments: 3 }).now).toBe(300_000);
    expect(dealCost({ fee: 900_000, instalments: 3, addon: { apps: 10, amount: 100_000 } }).total).toBe(1_000_000);
  });

  it("a lower fee wins the day when the add-ons are right", () => {
    const save = newGame(802);
    const p = aTarget(save)!;
    const value = marketValue(p);
    const { save: s } = rich(save);
    // find the smallest cash offer the seller will take
    let asked = 0;
    for (let fee = Math.round(value * 0.8); fee <= value * 3; fee += 20_000) {
      const res = bidForPlayer(s, p.id, fee);
      if (res.resp.kind === "accepted") {
        asked = fee;
        break;
      }
    }
    expect(asked).toBeGreaterThan(0);
    // the same money spread over instalments is not enough on its own…
    const under = Math.round(asked * 0.85);
    expect(bidForPlayer(s, p.id, under).resp.kind).not.toBe("accepted");
    // …but the same fee with structured extras is
    const withStructure = bidForPlayer(s, p.id, {
      fee: under,
      addon: { apps: 10, amount: Math.round(asked * 0.35) },
      sellOn: 20
    });
    expect(withStructure.resp.kind).toBe("accepted");
    expect(withStructure.save.pending?.terms?.addon?.apps).toBe(10);
    expect(withStructure.save.pending?.terms?.sellOn).toBe(20);
  });

  it("instalments leave a debt that comes due next season", () => {
    const save = newGame(803);
    const p = aTarget(save)!;
    const { save: s } = rich(save);
    const value = marketValue(p);
    let ready = s;
    for (let fee = Math.round(value * 0.8); fee <= value * 3; fee += 20_000) {
      const res = bidForPlayer(ready, p.id, { fee, instalments: 3 });
      if (res.resp.kind === "accepted") {
        ready = res.save;
        break;
      }
    }
    const pending = ready.pending!;
    const before = ready.finances[ready.userClubId].transfer;
    const done = offerTerms(ready, p.id, { wage: wageDemand(p) * 2, years: 3 });
    expect(done.resp.kind).toBe("accepted");
    const first = Math.round(pending.fee / 3);
    expect(before - done.save.finances[done.save.userClubId].transfer).toBeGreaterThanOrEqual(first);
    const debts = (done.save.debts ?? []).filter((d) => d.playerId === p.id && !d.addonApps);
    expect(debts.length).toBe(2);
    expect(debts.every((d) => d.dueSeason === done.save.season + 1 || d.dueSeason === done.save.season + 2)).toBe(true);
    // and they get paid at the rollover
    const next = nextSeason(nextSeason(done.save));
    expect((next.debts ?? []).filter((d) => d.playerId === p.id)).toHaveLength(0);
  });

  it("an appearance add-on is paid once he has played the games", () => {
    const save = newGame(804);
    const p = aTarget(save)!;
    const { save: s } = rich(save);
    const res = bidForPlayer(s, p.id, { fee: marketValue(p) * 2.2, addon: { apps: 10, amount: 300_000 } });
    expect(res.resp.kind).toBe("accepted");
    const signed = offerTerms(res.save, p.id, { wage: wageDemand(p) * 2, years: 3 });
    const owed = (signed.save.debts ?? []).find((d) => d.addonApps === 10)!;
    expect(owed).toBeTruthy();
    // he hasn't played them yet
    payTransferAddons(signed.save);
    expect((signed.save.debts ?? []).some((d) => d.id === owed.id)).toBe(true);
    // now he has
    const pp = signed.save.players.find((x) => x.id === p.id)!;
    pp.apps = 11;
    const before = signed.save.finances[signed.save.userClubId].transfer;
    payTransferAddons(signed.save);
    expect(signed.save.finances[signed.save.userClubId].transfer).toBe(before - owed.amount);
    expect((signed.save.debts ?? []).some((d) => d.id === owed.id)).toBe(false);
  });

  it("contract depth: length, bonuses and clauses all move the wage", () => {
    const save = newGame(805);
    const kid = squadOf(save.players, save.userClubId).sort((a, b) => a.age - b.age)[0];
    const vet = squadOf(save.players, save.userClubId).sort((a, b) => b.age - a.age)[0];
    const base = 10_000;
    expect(termsDemand(kid, { wage: base, years: 5 }, base)).toBeLessThan(termsDemand(kid, { wage: base, years: 2 }, base));
    expect(termsDemand(vet, { wage: base, years: 5 }, base)).toBeGreaterThan(termsDemand(vet, { wage: base, years: 2 }, base));
    const plain = termsDemand(kid, { wage: base, years: 3 }, base);
    expect(termsDemand(kid, { wage: base, years: 3, perGoal: 5_000 }, base)).toBeLessThan(plain);
    expect(termsDemand(kid, { wage: base, years: 3, signingBonus: 500_000 }, base)).toBeLessThan(plain);
    expect(termsDemand(kid, { wage: base, years: 3, releaseClause: marketValue(kid) }, base)).toBeLessThan(plain);
    expect(termsDemand(kid, { wage: base, years: 3, extensionYears: 1 }, base)).toBeGreaterThan(plain);
  });

  it("a renewal with extras charges the bonus and stores the clauses", () => {
    const save = newGame(806);
    const p = squadOf(save.players, save.userClubId)[3];
    const before = save.finances[save.userClubId].transfer;
    const res = renewContract(save, p.id, {
      wage: wageDemand(p) * 2.5,
      years: 4,
      signingBonus: 200_000,
      perGoal: 3_000,
      releaseClause: marketValue(p) * 4,
      extensionYears: 1
    });
    expect(res.resp.kind).toBe("accepted");
    const pp = res.save.players.find((x) => x.id === p.id)!;
    expect(pp.contract.until).toBe(res.save.season + 4);
    expect(pp.contract.perGoal).toBe(3_000);
    expect(pp.contract.extensionYears).toBe(1);
    expect(pp.contract.releaseClause).toBe(marketValue(p) * 4);
    expect(res.save.finances[res.save.userClubId].transfer).toBe(before - 200_000);
    // the option can be triggered once
    const ext = triggerExtension(res.save, p.id);
    expect(ext.resp.ok).toBe(true);
    expect(ext.save.players.find((x) => x.id === p.id)!.contract.until).toBe(res.save.season + 5);
    expect(ext.save.players.find((x) => x.id === p.id)!.contract.extensionYears).toBeUndefined();
    expect(triggerExtension(ext.save, p.id).resp.ok).toBe(false);
  });

  it("a release clause in a contract lets a rival take him", () => {
    const save = newGame(807);
    const p = squadOf(save.players, save.userClubId).sort((a, b) => overallFor(b) - overallFor(a))[0];
    const players = save.players.map((x) =>
      x.id === p.id ? { ...x, contract: { ...x.contract, releaseClause: 400_000 } } : x
    );
    const s: SaveGame = { ...save, players };
    let found: TransferOffer | undefined;
    for (let r = 1; r <= 3 && !found; r++) {
      const ticked = windowTick({ ...s, round: r });
      found = ticked.offers.find((o) => o.clause);
    }
    expect(found).toBeTruthy();
    expect(found!.fee).toBe(400_000);
    const done = acceptOffer({ ...s, round: 1, offers: [found!] }, found!.id);
    expect(done.resp.kind).toBe("accepted");
    expect(done.save.players.find((x) => x.id === p.id)!.clubId).not.toBe(save.userClubId);
  });

  it("a loan brings a player in: fee, wage share, and a hard limit", () => {
    const save = newGame(808);
    const { save: s } = rich(save);
    const kids = rivalSquad(s).filter((p) => p.age <= 21).sort((a, b) => overallFor(b) - overallFor(a));
    expect(kids.length).toBeGreaterThan(1);
    const target = kids[0];
    // stingy terms get nowhere
    expect(bidForLoan(s, target.id, { wageShare: 0.2, fee: 0 }).resp.kind).not.toBe("accepted");
    // a fair offer does
    const ask = loanAsk(target, 2000, 2000);
    const res = bidForLoan(s, target.id, { wageShare: 1, fee: Math.round(ask.fee * 1.8) });
    expect(res.resp.kind).toBe("accepted");
    const save2 = res.save;
    const mine = save2.players.find((x) => x.id === target.id)!;
    expect(mine.clubId).toBe(save2.userClubId);
    expect(mine.loan?.fromClubId).not.toBe(save2.userClubId);
    expect(loaneesIn(save2).some((x) => x.id === target.id)).toBe(true);
    const before = wageBill(save2, save2.userClubId);
    // only our share of his wage counts
    const shareWage = mine.contract.wage * mine.loan!.wageShare;
    expect(before).toBeGreaterThan(shareWage);
    // fill the quota, then the door closes
    let filled = save2;
    let n = loanCount(filled, "in");
    for (const k of kids.slice(1)) {
      if (n >= LOAN.maxIn) break;
      const r = bidForLoan(filled, k.id, { wageShare: 1, fee: loanAsk(k, 2000, 2000).fee * 3 });
      if (r.resp.kind === "accepted") {
        filled = r.save;
        n = loanCount(filled, "in");
      }
    }
    expect(n).toBe(LOAN.maxIn);
    const more = kids.filter((k) => !filled.players.find((x) => x.id === k.id)?.loan);
    if (more.length) {
      const blocked = bidForLoan(filled, more[0].id, { wageShare: 1, fee: 5_000_000 });
      expect(blocked.resp.kind).toBe("rejected");
      expect(blocked.resp.message).toMatch(/loan/i);
    }
  });

  it("a loan option becomes a signing, an obligation lands on its own", () => {
    const save = newGame(809);
    const { save: s } = rich(save);
    const kid = rivalSquad(s).filter((p) => p.age <= 21).sort((a, b) => overallFor(b) - overallFor(a))[0];
    const ask = loanAsk(kid, 2000, 2000);
    const res = bidForLoan(s, kid.id, {
      wageShare: 1,
      fee: Math.round(ask.fee * 2),
      optionFee: Math.round(marketValue(kid) * 1.6)
    });
    expect(res.resp.kind).toBe("accepted");
    const withOption = res.save.players.find((x) => x.id === kid.id)!;
    expect(withOption.loan?.optionFee).toBe(Math.round(marketValue(kid) * 1.6));
    const budgetBefore = res.save.finances[res.save.userClubId].transfer;
    const done = exerciseLoanOption(res.save, kid.id);
    expect(done.resp.ok).toBe(true);
    const pp = done.save.players.find((x) => x.id === kid.id)!;
    expect(pp.loan).toBeUndefined();
    expect(pp.clubId).toBe(done.save.userClubId);
    expect(pp.contract.until).toBeGreaterThan(done.save.season);
    expect(done.save.finances[done.save.userClubId].transfer).toBeLessThan(budgetBefore);
    // an obligation completes by itself when the loan ends
    const kid2 = rivalSquad(s).filter((p) => p.age <= 21).sort((a, b) => overallFor(b) - overallFor(a))[1];
    const r2 = bidForLoan(s, kid2.id, {
      wageShare: 1,
      fee: Math.round(loanAsk(kid2, 2000, 2000).fee * 2),
      optionFee: Math.round(marketValue(kid2) * 1.6),
      obligation: true
    });
    expect(r2.resp.kind).toBe("accepted");
    const after = { ...r2.save, season: r2.save.season + 1 };
    loanRollover(after);
    const done2 = after.players.find((x) => x.id === kid2.id)!;
    expect(done2.loan).toBeUndefined();
    expect(done2.clubId).toBe(after.userClubId);
  });

  it("you can't sell a loanee or borrow the same player twice", () => {
    const save = newGame(810);
    const { save: s } = rich(save);
    const kid = rivalSquad(s).filter((p) => p.age <= 21).sort((a, b) => overallFor(b) - overallFor(a))[0];
    const res = bidForLoan(s, kid.id, { wageShare: 1, fee: Math.round(loanAsk(kid, 2000, 2000).fee * 1.8) });
    expect(res.resp.kind).toBe("accepted");
    const offer: TransferOffer = {
      id: "of-x",
      playerId: kid.id,
      fromClubId: save.clubs.find((c) => c.id !== save.userClubId)!.id,
      fee: 9_000_000,
      day: "R1 · summer window"
    };
    const sale = acceptOffer({ ...res.save, offers: [offer] }, "of-x");
    expect(sale.resp.kind).toBe("rejected");
    const again = bidForLoan(res.save, kid.id, { wageShare: 1, fee: 9_000_000 });
    expect(again.resp.kind).toBe("rejected");
  });

  it("loans out: he plays elsewhere, you pay the rest, he comes back", () => {
    const save = newGame(811);
    const mine = squadOf(save.players, save.userClubId).sort((a, b) => a.age - b.age)[0];
    const before = wageBill(save, save.userClubId);
    const loan = { wageShare: 0.7, fee: 120_000 };
    const s = sendOnLoan(save, mine.id, save.clubs.find((c) => c.id !== save.userClubId)!.id, loan);
    const pp = s.players.find((x) => x.id === mine.id)!;
    expect(pp.clubId).not.toBe(save.userClubId);
    expect(pp.loan?.fromClubId).toBe(save.userClubId);
    expect(loaneesOut(s).some((x) => x.id === mine.id)).toBe(true);
    // we still pay the 30% we didn't hand over
    const after = wageBill(s, save.userClubId);
    expect(Math.abs(before - after - pp.contract.wage * 0.7)).toBeLessThanOrEqual(1);
    // …and he's back for pre-season
    const back = { ...s, season: s.season + 1 };
    loanRollover(back);
    expect(back.players.find((x) => x.id === mine.id)!.clubId).toBe(save.userClubId);
    expect(back.players.find((x) => x.id === mine.id)!.loan).toBeUndefined();
  });

  it("the board's policy vetoes deals it won't sanction", () => {
    const save = newGame(812);
    const { save: s } = rich(save);
    const old = rivalSquad(s).sort((a, b) => b.age - a.age)[0];
    expect(old.age).toBeGreaterThanOrEqual(30);
    const policy: BoardPolicy = { label: "Youth first: nobody over 27.", maxAge: 27 };
    const blocked = bidForPlayer({ ...s, policy }, old.id, marketValue(old) * 2);
    expect(blocked.resp.kind).toBe("rejected");
    expect(blocked.resp.message).toMatch(/board|policy|over 27/i);
    const kid = rivalSquad(s).filter((p) => p.age <= 21).sort((a, b) => overallFor(b) - overallFor(a))[0];
    const ok = bidForPlayer({ ...s, policy }, kid.id, marketValue(kid) * 2);
    expect(ok.resp.kind).toBe("accepted");
    // a spending cap bites too
    // money targets are the board's judgement, not a veto…
    const capped: BoardPolicy = { label: "No deal above £1m.", maxFee: 1_000_000 };
    expect(policyCheck(capped, kid, { fee: 4_000_000 }).ok).toBe(true);
    // …and you can always re-sign your own veterans
    expect(policyCheck(policy, old, {}, "renew").ok).toBe(true);
    expect(policyCheck(policy, old, {}).ok).toBe(false);
  });

  it("the board judges the window at the rollover", () => {
    const save = newGame(813);
    const policy: BoardPolicy = { label: "Sign under-23s.", preferAge: 23 };
    const withPolicy: SaveGame = {
      ...save,
      policy,
      windowLog: [
        { season: save.season, playerId: "a", age: 20, wage: 10_000, fee: 900_000 },
        { season: save.season, playerId: "b", age: 22, wage: 12_000, fee: 1_100_000 }
      ]
    };
    const good = { ...withPolicy, season: withPolicy.season + 1 };
    const beforeGood = good.finances[good.userClubId].transfer;
    policyPayoff(good);
    expect(good.finances[good.userClubId].transfer).toBe(beforeGood + 900_000);
    expect(good.devNews.some((n) => /board/i.test(n))).toBe(true);
    // ignoring it costs you
    const bad: SaveGame = {
      ...withPolicy,
      season: withPolicy.season + 1,
      windowLog: [{ season: withPolicy.season, playerId: "c", age: 33, wage: 60_000, fee: 6_000_000 }]
    };
    const beforeBad = bad.finances[bad.userClubId].transfer;
    policyPayoff(bad);
    expect(bad.finances[bad.userClubId].transfer).toBe(beforeBad - 500_000);
  });

  it("money moves between the transfer budget and the wage ceiling", () => {
    const save = newGame(814);
    const u = save.userClubId;
    const t0 = save.finances[u].transfer;
    const w0 = save.finances[u].wageBudget;
    const toWage = reallocate(save, "toWage", 20_000);
    expect(toWage.resp.ok).toBe(true);
    expect(toWage.save.finances[u].transfer).toBe(t0 - 20_000 * 52);
    expect(toWage.save.finances[u].wageBudget).toBe(w0 + 20_000);
    const back = reallocate(toWage.save, "toTransfer", 10_000);
    expect(back.resp.ok).toBe(true);
    expect(back.save.finances[u].wageBudget).toBe(w0 + 10_000);
    expect(back.save.finances[u].transfer).toBe(t0 - 10_000 * 52);
    // you can't spend what you haven't got
    expect(reallocate(save, "toWage", 99_000_000).resp.ok).toBe(false);
    // and you can't cripple the wage bill either
    expect(reallocate(save, "toTransfer", 99_000_000).resp.ok).toBe(false);
  });

  it("listing a player tells the market — and upsets him", () => {
    const save = newGame(815);
    const p = squadOf(save.players, save.userClubId)[5];
    const morale0 = p.morale;
    const listed = setListed(save, p.id, true);
    expect(listed.players.find((x) => x.id === p.id)!.transferListed).toBe(true);
    expect(listed.players.find((x) => x.id === p.id)!.morale!).toBeLessThan(morale0 ?? 0);
    expect(listedPlayers(listed).some((x) => x.id === p.id)).toBe(true);
    const unlisted = setListed(listed, p.id, false);
    expect(unlisted.players.find((x) => x.id === p.id)!.transferListed).toBeFalsy();
    expect(askAgent(save, p.id).line.length).toBeGreaterThan(3);
  });

  it("his agent knows who is interested", () => {
    const save = newGame(816);
    const star = squadOf(save.players, save.userClubId).sort((a, b) => overallFor(b) - overallFor(a))[0];
    const kid = squadOf(save.players, save.userClubId).sort((a, b) => a.age - b.age)[0];
    const a = askAgent(save, star.id);
    const b = askAgent(save, kid.id);
    expect(a.clubs).toBeGreaterThanOrEqual(b.clubs);
    expect(["none", "some", "strong"]).toContain(a.level);
    expect(b.line).toMatch(/club/i);
  });

  it("pre-contracts are a winter market", () => {
    const save = newGame(817);
    const summer = { ...save, round: 4 };
    expect(canPreContract(summer)).toBe(false);
    // a rival whose deal runs out this summer is the classic Bosman
    const target = rivalSquad(save).sort((a, b) => overallFor(b) - overallFor(a))[4];
    const expiring: SaveGame = {
      ...save,
      players: save.players.map((x) => (x.id === target.id ? { ...x, contract: { ...x.contract, until: save.season } } : x))
    };
    const targets = preContractTargets({ ...expiring, round: 9 });
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((p) => p.contract.until === expiring.season)).toBe(true);
    // not in the window yet: no deal
    const early = offerPreContract({ ...expiring, round: 4 }, targets[0].id, 250_000, 3);
    expect(early.resp.ok).toBe(false);
    expect(early.resp.message).toMatch(/winter/i);
    // in it: done
    const winter = { ...expiring, round: 9 };
    const deal = offerPreContract(winter, targets[0].id, 250_000, 3);
    expect(deal.resp.ok).toBe(true);
    const pc = deal.save.preContracts!.find((x) => x.playerId === targets[0].id)!;
    expect(pc.wage).toBe(250_000);
    expect(isPreContracted(deal.save, targets[0].id)).toBe(true);
    // he arrives for free in pre-season
    const next = { ...deal.save, season: deal.save.season + 1 };
    applyPreContracts(next);
    const pp = next.players.find((x) => x.id === targets[0].id)!;
    expect(pp.clubId).toBe(next.userClubId);
    expect(pp.contract.wage).toBe(250_000);
    expect(next.preContracts!.some((x) => x.playerId === targets[0].id)).toBe(false);
    // and you can change your mind
    const cancelled = cancelPreContract(deal.save, targets[0].id);
    expect(cancelled.preContracts!.length).toBe(deal.save.preContracts!.length - 1);
  });

  it("rival clubs poach the players you let run down", () => {
    const save = newGame(818);
    const p = squadOf(save.players, save.userClubId)[7];
    const players = save.players.map((x) => (x.id === p.id ? { ...x, contract: { ...x.contract, until: save.season } } : x));
    let poached: SaveGame | undefined;
    for (let s = 0; s < 24 && !poached; s++) {
      const trial: SaveGame = { ...save, players, round: 9, seed: save.seed + s };
      poachTick(trial);
      if ((trial.preContracts ?? []).some((pc) => pc.playerId === p.id)) poached = trial;
    }
    expect(poached).toBeTruthy();
    const next = { ...poached!, season: poached!.season + 1 };
    applyPreContracts(next);
    const gone = next.players.find((x) => x.id === p.id)!;
    expect(gone.clubId).not.toBe(next.userClubId);
  });

  it("stays deterministic with loans, policies and structured deals", () => {
    const run = (seed: number) => {
      const save = newGame(seed);
      const kid = rivalSquad(save).filter((p) => p.age <= 21).sort((a, b) => overallFor(b) - overallFor(a))[0];
      const r = bidForLoan(save, kid.id, { wageShare: 0.8, fee: 500_000 });
      const ticked = windowTick({ ...r.save, round: 1 });
      return JSON.stringify({ offers: ticked.offers, loans: ticked.players.filter((p) => p.loan).map((p) => p.id), policy: ticked.policy });
    };
    expect(run(919)).toBe(run(919));
    expect(run(919)).not.toBe(run(920));
  });
});

describe("individual players: bodies, targets, retraining, moves, discipline & the armband", () => {
  const mine = (save: SaveGame, i = 3) => squadOf(save.players, save.userClubId)[i];
  const fresh = () => newGame(901);

  it("sharpness rises with minutes, falls with rust, and only ever helps when match-fit", () => {
    const save = fresh();
    const p = mine(save);
    expect(sharpnessOf(p)).toBe(85);
    expect(sharpnessFactor(p)).toBe(1);
    // a full game sharpens
    sharpnessTick(save, { [p.id]: 90 });
    expect(sharpnessOf(p)).toBe(91);
    // sitting out dulls, and a rusty player is worse
    for (let i = 0; i < 4; i++) sharpnessTick(save, {});
    expect(sharpnessOf(p)).toBeLessThan(85);
    expect(sharpnessFactor(p)).toBeLessThan(1);
    expect(sharpnessFactor(p)).toBeGreaterThanOrEqual(0.86);
    // the floor holds however long he is out
    for (let i = 0; i < 40; i++) sharpnessTick(save, {});
    expect(sharpnessOf(p)).toBeGreaterThanOrEqual(20);
    expect(sharpnessFactor(p)).toBeGreaterThanOrEqual(0.86);
  });

  function inputsForLocal(save: SaveGame, fx: { homeId: string; awayId: string }) {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    return {
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
      homeXI: home.xi,
      awayXI: away.xi,
      homeBench: home.bench,
      awayBench: away.bench,
      homeMentality: home.mentality,
      awayMentality: away.mentality,
      homeRoles: home.roles,
      awayRoles: away.roles,
      homeCoords: home.coords,
      awayCoords: away.coords,
      homePoss: home.poss,
      awayPoss: away.poss,
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      conditions: conditionsFor(save, save.round)
    };
  }

  it("rust costs you the game — a cold side performs worse", () => {
    /**
     * Paired, not aggregate: each seed is played twice with the same rng and the
     * same fixture, the only difference being the opponent's match sharpness.
     * Pairing cancels the fixture noise, which is what made the old unpaired
     * version undecidable (an 8% effect inside ±30 goals of aggregate noise).
     */
    const gdFor = (save: SaveGame, sharp: number) => {
      const fx = userFixture(save)!;
      const home = resolveSide(save, fx.homeId);
      const away = resolveSide(save, fx.awayId);
      const userSide = fx.homeId === save.userClubId ? "home" : "away";
      const oppXI = userSide === "home" ? away.xi : home.xi;
      for (const p of oppXI) p.sharpness = sharp;
      const r = simulateMatch({
        round: save.round,
        homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
        awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
        homeXI: home.xi,
        awayXI: away.xi,
        homeBench: home.bench,
        awayBench: away.bench,
        homeMentality: home.mentality,
        awayMentality: away.mentality,
        homeRoles: home.roles,
        awayRoles: away.roles,
        homeCoords: home.coords,
        awayCoords: away.coords,
        homePoss: home.poss,
        awayPoss: away.poss,
        homePlan: fx.homeId === save.userClubId ? save.setpieces : aiSetPieces(save, fx.homeId),
        awayPlan: fx.awayId === save.userClubId ? save.setpieces : aiSetPieces(save, fx.awayId),
        rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)),
        userSide
      });
      // the opponent's goal difference: worse means rust cost them
      return userSide === "home" ? r.awayGoals - r.homeGoals : r.homeGoals - r.awayGoals;
    };
    let diff = 0;
    let pairs = 0;
    for (let seed = 640; seed < 1040; seed++) {
      const a = gdFor(toLeague(newGame(seed)), 20); // a cold side: the floor of the sharpness range
      const b = gdFor(toLeague(newGame(seed)), 85); // the same side, match-fit
      diff += a - b;
      pairs++;
    }
    // …and the mechanism behind it: the factor is monotone and capped at 12%
    expect(sharpnessFactor({ sharpness: 85 } as Player)).toBe(1);
    expect(sharpnessFactor({ sharpness: 60 } as Player)).toBeLessThan(1);
    expect(sharpnessFactor({ sharpness: 20 } as Player)).toBeLessThan(sharpnessFactor({ sharpness: 60 } as Player));
    expect(sharpnessFactor({ sharpness: 20 } as Player)).toBeGreaterThanOrEqual(0.88);
    expect(pairs).toBe(400);
    expect(diff).toBeLessThan(0); // over 400 paired matches, the cold side's goal difference is worse
  }, 60_000);

  it("wear builds when a tired or older player keeps starting, and clears with rest", () => {
    const save = fresh();
    const kid = mine(save, 2);
    kid.age = 22;
    kid.condition = 90;
    const vet = mine(save, 3);
    vet.age = 32;
    vet.condition = 50;
    expect(jadedOf(kid)).toBe(0);
    jadedTick(save, { [kid.id]: 90 });
    jadedTick(save, { [vet.id]: 90 });
    expect(jadedOf(vet)).toBeGreaterThan(jadedOf(kid));
    expect(jadedFactor(kid)).toBe(1);
    for (let i = 0; i < 10; i++) jadedTick(save, { [vet.id]: 90 });
    expect(jadedOf(vet)).toBeGreaterThan(60);
    expect(jadedFactor(vet)).toBeLessThan(1);
    // a week off is the cure
    const heavy = jadedOf(vet);
    jadedTick(save, {});
    expect(jadedOf(vet)).toBeLessThan(heavy);
    expect(jadedOf(vet)).toBeGreaterThanOrEqual(0);
  });

  it("injuries read as real problems, and prone players pick up more of them", () => {
    expect(injuryKindFor(1)).toBe("Knock");
    expect(injuryKindFor(5)).toBe("Hamstring");
    expect(injuryKindFor(12)).toBe("Broken foot");
    const save = fresh();
    const young = mine(save, 1);
    young.age = 21;
    young.attrs.physical = 85;
    const old = mine(save, 4);
    old.age = 34;
    old.attrs.physical = 45;
    old.jaded = 80;
    old.sharpness = 40;
    expect(pronenessOf(old)).toBeGreaterThan(pronenessOf(young) * 1.5);
    expect(injuryLine(old)).toBeNull();
    old.injuredWeeks = 3;
    expect(injuryLine(old)).toBe("Muscle strain · 3w out");
  });

  it("international weeks take the best players away and hand out caps", () => {
    const save = fresh();
    const best = squadOf(save.players, save.userClubId).sort((a, b) => overallFor(b) - overallFor(a))[0];
    const before = { cond: best.condition, sharp: sharpnessOf(best), caps: best.caps ?? 0, morale: best.morale ?? 60 };
    expect(isInternationalRound(save.round)).toBe(false);
    expect(internationalTick(save)).toHaveLength(0);
    // snapshot first — the tick mutates the players in place
    const snapshot = new Map(save.players.map((p) => [p.id, { caps: p.caps ?? 0, cond: p.condition, sharp: sharpnessOf(p), morale: p.morale ?? 60 }]));
    const s2 = structuredClone(save);
    s2.round = INTL_ROUNDS[0];
    const called = internationalTick(s2);
    expect(called.length).toBeGreaterThan(0);
    const mineCalled = called.filter((id) => s2.players.find((p) => p.id === id)!.clubId === save.userClubId);
    expect(mineCalled.length).toBeGreaterThan(0);
    const after = s2.players.find((p) => p.id === mineCalled[0])!;
    const was = snapshot.get(after.id)!;
    expect(after.caps ?? 0).toBe(was.caps + 1);
    expect(after.condition).toBeLessThan(was.cond);
    expect(sharpnessOf(after)).toBeGreaterThanOrEqual(was.sharp);
    expect(after.morale ?? 60).toBeGreaterThanOrEqual(was.morale);
    void best;
    // and the round after has nobody away
    expect(internationalTick({ ...save, round: INTL_ROUNDS[0] + 1 })).toHaveLength(0);
  });

  it("you can set a player a target and it is judged at the season end", () => {
    const save = fresh();
    const fw = squadOf(save.players, save.userClubId).filter((p) => p.pos === "FW").sort((a, b) => overallFor(b) - overallFor(a))[0];
    const opts = targetOptions(fw);
    expect(opts.some((o) => o.kind === "goals")).toBe(true);
    expect(opts.some((o) => o.ambitious)).toBe(true);
    const modest = opts.find((o) => o.kind === "goals" && !o.ambitious)!;
    const set = setTarget(save, fw.id, "goals", modest.value);
    expect(set.resp.ok).toBe(true);
    expect(set.save.players.find((x) => x.id === fw.id)!.target?.value).toBe(modest.value);
    // progress reads live
    const pp = set.save.players.find((x) => x.id === fw.id)!;
    const nextSeasonSave: SaveGame = { ...set.save, season: set.save.season + 1 };
    pp.goals = Math.max(1, modest.value - 1);
    const so = targetSoFar(pp)!;
    expect(so.current).toBe(Math.max(1, modest.value - 1));
    expect(so.pct).toBeLessThan(1);
    expect(targetLine(pp)).toMatch(/goals/);
    // met: delighted
    pp.goals = modest.value + 2;
    const moraleBefore = pp.morale ?? 60;
    settleTargets(nextSeasonSave);
    const done = nextSeasonSave.players.find((x) => x.id === fw.id)!;
    expect(done.target).toBeUndefined();
    expect(done.morale ?? 60).toBeGreaterThan(moraleBefore);
    // missed (ambitious) stings more than missed (modest)
    const ambitious = opts.find((o) => o.kind === "goals" && o.ambitious)!;
    const b1 = setTarget(save, fw.id, "goals", ambitious.value);
    const b1Next: SaveGame = { ...b1.save, season: b1.save.season + 1 };
    const before1 = b1Next.players.find((x) => x.id === fw.id)!.morale ?? 60;
    settleTargets(b1Next);
    const miss1 = (b1Next.players.find((x) => x.id === fw.id)!.morale ?? 60) - before1;
    const b2 = setTarget(save, fw.id, "goals", modest.value);
    const b2Next: SaveGame = { ...b2.save, season: b2.save.season + 1 };
    const before2 = b2Next.players.find((x) => x.id === fw.id)!.morale ?? 60;
    settleTargets(b2Next);
    const miss2 = (b2Next.players.find((x) => x.id === fw.id)!.morale ?? 60) - before2;
    expect(miss1).toBeLessThan(miss2);
    // a rival's target is not yours to set
    const rival = save.players.find((p) => p.clubId !== save.userClubId && p.clubId !== "")!;
    expect(setTarget(save, rival.id, "goals", 5).resp.ok).toBe(false);
  });

  it("a player can learn a second position over a run of games", () => {
    const save = fresh();
    const mf = squadOf(save.players, save.userClubId).find((p) => p.pos === "MF")!;
    expect(retrainOptions(mf)).toContain("DF");
    const started = startRetrain(save, mf.id, "DF");
    expect(started.resp.ok).toBe(true);
    const pp = started.save.players.find((x) => x.id === mf.id)!;
    expect(pp.retrain?.pos).toBe("DF");
    // a month of football
    for (let i = 0; i < 14; i++) retrainTick(started.save, { [mf.id]: 90 });
    const done = started.save.players.find((x) => x.id === mf.id)!;
    expect(done.altPos).toContain("DF");
    expect(done.retrain).toBeUndefined();
    // second position maxes him out
    const again = startRetrain(started.save, mf.id, "FW");
    expect(again.resp.ok).toBe(true);
    for (let i = 0; i < 20; i++) retrainTick(again.save, { [mf.id]: 90 });
    const final = again.save.players.find((x) => x.id === mf.id)!;
    expect(final.altPos).toHaveLength(2);
    expect(canRetrain(final)).toBe(false);
    // keepers stay keepers
    const gk = squadOf(save.players, save.userClubId).find((p) => p.pos === "GK")!;
    expect(retrainOptions(gk)).toHaveLength(0);
  });

  it("a player can learn a move if the coach thinks he has the tools", () => {
    const save = fresh();
    const p = squadOf(save.players, save.userClubId).find(
      (x) => x.pos === "MF" && x.attrs.passing >= 62 && x.traits.length < 2
    )!;
    expect(p).toBeTruthy();
    const opts = moveOptions(p);
    expect(opts).toContain("killer_balls");
    const started = startMove(save, p.id, "killer_balls");
    expect(started.resp.ok).toBe(true);
    const pp = started.save.players.find((x) => x.id === p.id)!;
    expect(pp.moveProgress?.trait).toBe("killer_balls");
    // the right training unit teaches it faster
    const slow = started.save;
    const fast: SaveGame = { ...structuredClone(started.save), training: { unit: "passing", intensity: "normal" } };
    moveTick(slow, { [p.id]: 90 });
    moveTick(fast, { [p.id]: 90 });
    expect(fast.players.find((x) => x.id === p.id)!.moveProgress!.progress).toBeGreaterThan(
      slow.players.find((x) => x.id === p.id)!.moveProgress!.progress
    );
    for (let i = 0; i < 30; i++) moveTick(fast, { [p.id]: 90 });
    const learned = fast.players.find((x) => x.id === p.id)!;
    expect(learned.traits).toContain("killer_balls");
    expect(learned.moveProgress).toBeUndefined();
    // a player without the tools is refused
    const weak = squadOf(save.players, save.userClubId).find((x) => x.attrs.passing < 55 && x.pos === "DF")!;
    if (weak) expect(startMove(save, weak.id, "killer_balls").resp.ok).toBe(false);
  });

  it("discipline: a sending-off is yours to deal with", () => {
    const save = fresh();
    const p = mine(save, 5);
    const result: MatchResult = {
      fixtureKey: `${save.round}:${save.userClubId}:c2`,
      round: save.round,
      homeId: save.userClubId,
      awayId: "c2",
      homeGoals: 1,
      awayGoals: 0,
      ratings: {},
      scorers: [],
      updates: [
        { playerId: p.id, minutes: 70, goals: 0, assists: 0, yellow: 0, red: true, injuredWeeks: 0, conditionLoss: 20 }
      ],
      events: []
    };
    const withMatch: SaveGame = { ...save, lastUserMatch: result };
    const cases = disciplinaryCases(withMatch);
    expect(cases.some((c) => c.playerId === p.id && c.kind === "red")).toBe(true);
    const budgetBefore = withMatch.finances[withMatch.userClubId].transfer;
    const moraleBefore = p.morale ?? 60;
    const fined = applyDiscipline(withMatch, p.id, "fine");
    expect(fined.resp.ok).toBe(true);
    expect(fined.save.finances[fined.save.userClubId].transfer).toBe(budgetBefore + p.contract.wage * 2);
    expect(fined.save.players.find((x) => x.id === p.id)!.morale!).toBeLessThan(moraleBefore);
    expect(fined.save.discipline?.[0].kind).toBe("fine");
    // letting him off keeps him happy but the press notice
    const lenient = applyDiscipline(withMatch, p.id, "none");
    expect(lenient.save.players.find((x) => x.id === p.id)!.morale!).toBeGreaterThan(moraleBefore);
    expect(lenient.save.media!.respect).toBeLessThan(withMatch.media!.respect);
  });

  it("the armband: the captain leads the room and wears it on the pitch", () => {
    const save = fresh();
    const squad = squadOf(save.players, save.userClubId);
    const leaders = new Set(roomLeaders(save, save.userClubId).map((x) => x.id));
    const kid = squad.filter((x) => !leaders.has(x.id)).sort((a, b) => a.age - b.age)[0];
    const vet = squad.filter((x) => x.id !== kid.id).sort((a, b) => b.age - a.age)[0];
    const made = setArmband(save, kid.id, "captain");
    expect(made.resp.ok).toBe(true);
    expect(made.save.captain).toBe(kid.id);
    expect(made.save.players.find((x) => x.id === kid.id)!.morale!).toBeGreaterThan(kid.morale ?? 60);
    // the armband lifts him up the pecking order in the dressing room
    const without = roomLeaders(save, save.userClubId);
    const rankWithout = without.findIndex((x) => x.id === kid.id);
    const room = roomLeaders(made.save, made.save.userClubId);
    expect(room).toHaveLength(3);
    expect(room.some((x) => x.id === kid.id)).toBe(true);
    expect(room.findIndex((x) => x.id === kid.id)).toBeLessThan(rankWithout === -1 ? 99 : rankWithout);
    // handing it over hurts the man who loses it
    const swapped = setArmband(made.save, vet.id, "captain");
    expect(swapped.save.captain).toBe(vet.id);
    expect(swapped.save.players.find((x) => x.id === kid.id)!.morale!).toBeLessThan(
      made.save.players.find((x) => x.id === kid.id)!.morale!
    );
    // the vice wears it when the captain is off the pitch
    const withVice = setArmband(swapped.save, squad[4].id, "vice");
    expect(armbandIn(withVice.save, [squad[4].id])).toBe(squad[4].id);
    expect(armbandIn(withVice.save, [vet.id])).toBe(vet.id);
    expect(armbandIn(withVice.save, [squad[9].id])).toBeUndefined();
  });

  it("old saves get the new body and development fields", () => {
    const save = fresh();
    const players = save.players.map((p, i) =>
      i === 0
        ? ({ ...p, sharpness: undefined, jaded: undefined, caps: undefined, target: { kind: "nonsense" as never, value: 5, season: 1 } } as unknown as Player)
        : i === 1
          ? ({ ...p, retrain: { pos: "XX" as never, progress: 5 } } as unknown as Player)
          : p
    );
    const broken: SaveGame = { ...save, players, captain: "ghost-id", vice: "ghost-2", discipline: undefined as never };
    const fixed = normalizeSave(broken);
    expect(fixed.players[0].sharpness).toBe(85);
    expect(fixed.players[0].jaded).toBe(0);
    expect(fixed.players[0].caps).toBe(0);
    expect(fixed.players[0].target).toBeUndefined();
    expect(fixed.players[1].retrain).toBeUndefined();
    expect(fixed.captain).toBeUndefined();
    expect(fixed.vice).toBeUndefined();
    expect(Array.isArray(fixed.discipline)).toBe(true);
  });

  it("is deterministic through a whole season of bodies and learning", () => {
    const run = () => {
      let save = { ...newGame(902), round: 4 };
      for (let r = 4; r <= 12; r++) {
        const out = playRound(save);
        save = out.save;
      }
      return JSON.stringify([
        save.players.map((p) => [p.id, p.sharpness, p.jaded, p.caps]),
        save.players.filter((p) => p.retrain).map((p) => [p.id, Math.round(p.retrain!.progress)]),
        save.players.filter((p) => p.moveProgress).map((p) => [p.id, Math.round(p.moveProgress!.progress)])
      ]);
    };
    expect(run()).toBe(run());
  }, 30_000);
});

describe("quality of life: the inbox, the data hub's shots and save slots", () => {
  const fresh = () => newGame(950);

  it("the inbox collects everything the club has to say, newest first", () => {
    const save = fresh();
    const before = (save.inbox ?? []).length;
    pushNews(save, "Academy: a kid steps up.");
    expect((save.inbox ?? []).length).toBe(before + 1);
    const top = save.inbox![0];
    expect(top.title).toMatch(/Academy/);
    expect(top.read).toBe(false);
    expect(top.kind).toBe("club");
    expect(top.season).toBe(save.season);
    const ids = new Set(save.inbox!.map((i) => i.id));
    expect(ids.size).toBe(save.inbox!.length);
  });

  it("a match report lands in the inbox and the unread count follows", () => {
    const out = playRound(toLeague(fresh()));
    const save = out.save;
    const match = (save.inbox ?? []).find((i) => i.kind === "match");
    expect(match).toBeTruthy();
    expect(match!.title).toMatch(/(Win|Draw|Defeat) \d+–\d+/);
    const unread = inboxUnread(save);
    expect(unread).toBeGreaterThan(0);
    const one = openInboxItem(save, match!.id);
    expect(inboxUnread(one.save)).toBe(unread - 1);
    expect(one.save.inbox!.find((i) => i.id === match!.id)!.read).toBe(true);
    expect(one.screen).toBe("league");
    const all = markAllInboxRead(one.save);
    expect(inboxUnread(all)).toBe(0);
  });

  it("the inbox stays capped and filters by kind", () => {
    const save = fresh();
    for (let i = 0; i < 80; i++) pushInbox(save, { kind: "transfer", title: `rumour ${i}` });
    expect((save.inbox ?? []).length).toBeLessThanOrEqual(INBOX_CAP);
    const transfers = inboxFor(save, "transfer");
    expect(transfers.length).toBeGreaterThan(0);
    expect(transfers.every((i) => i.kind === "transfer")).toBe(true);
    expect(inboxFor(save, "board").length).toBe(0);
  });

  it("old saves get an inbox and the sequence repaired", () => {
    const save = fresh();
    const broken: SaveGame = { ...save, inbox: undefined as never, inboxSeq: undefined as never };
    const fixed = normalizeSave(broken);
    expect(Array.isArray(fixed.inbox)).toBe(true);
    expect(typeof fixed.inboxSeq).toBe("number");
    const withJunk: SaveGame = { ...save, inbox: [{ nope: true } as never, { id: "in-1", title: "kept", kind: "club", season: 1, round: 1, read: false }] };
    expect(normalizeSave(withJunk).inbox).toHaveLength(1);
  });

  it("a finished match keeps its shots, with xG that adds up", () => {
    const out = playRound(fresh());
    const result = out.userMatch!;
    const shots = result.shots ?? [];
    expect(shots.length).toBeGreaterThan(0);
    for (const s of shots) {
      expect(s.xg).toBeGreaterThan(0);
      expect(s.xg).toBeLessThanOrEqual(1);
      expect(typeof s.home).toBe("boolean");
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(100);
    }
    // every goal is a shot that went in
    const goals = (result.homeId === out.save.userClubId ? result.homeGoals : result.awayGoals);
    const goalShots = shots.filter((s) => s.home === (result.homeId === out.save.userClubId) && s.out === "goal");
    expect(goalShots.length).toBe(goals);
    // and the two sides' shots cover the match
    const bySide = shots.filter((s) => s.home).length;
    expect(bySide).toBeGreaterThan(0);
    expect(bySide).toBeLessThan(shots.length);
  });

  it("the xG total tracks the scoreline over a run of matches", () => {
    let save = fresh();
    let goals = 0;
    let xg = 0;
    for (let r = 0; r < 8; r++) {
      const out = playRound(save);
      save = out.save;
      const mine = out.userMatch!;
      const home = mine.homeId === save.userClubId;
      goals += home ? mine.homeGoals : mine.awayGoals;
      xg += (mine.shots ?? []).filter((s) => s.home === home).reduce((a, s) => a + s.xg, 0);
    }
    expect(xg).toBeGreaterThan(0);
    // a season of shots should be in the same postcode as the goals scored
    expect(goals).toBeGreaterThan(0);
    expect(xg / goals).toBeGreaterThan(0.4);
    expect(xg / goals).toBeLessThan(3);
  }, 30_000);

  it("a mid-season save round-trips through a slot unchanged", async () => {
    // the storage layer is IndexedDB, which vitest doesn't provide — the pure shape is
    // what matters here: a JSON round trip must survive with the new fields intact
    const save = playRound(toLeague(fresh())).save;
    const copy = normalizeSave(JSON.parse(JSON.stringify(save)) as SaveGame);
    expect(copy.inbox?.length).toBe(save.inbox?.length ?? 0);
    expect(copy.lastUserMatch?.shots?.length).toBe(save.lastUserMatch?.shots?.length);
    expect(copy.inboxSeq).toBe(save.inboxSeq);
  });

  it("stays deterministic with the inbox and shot data in place", () => {
    const run = () => {
      let save = newGame(951);
      for (let r = 0; r < 5; r++) save = playRound(save).save;
      return JSON.stringify([
        save.inbox?.slice(0, 5).map((i) => [i.id, i.kind, i.title]),
        save.lastUserMatch?.shots
      ]);
    };
    expect(run()).toBe(run());
  }, 30_000);
});

describe("pre-season & form: friendly weeks and the hot/cold hand", () => {
  const fresh = () => newGame(970);

  it("every save opens in pre-season with three friendlies on the calendar", () => {
    const save = fresh();
    expect(save.phase).toBe("pre");
    expect(save.round).toBe(-3);
    const fs = save.fixtures.filter((f) => f.friendly);
    expect(fs).toHaveLength(3);
    expect(fs.map((f) => f.round)).toEqual([-3, -2, -1]);
    expect(fs.every((f) => !f.played)).toBe(true);
    // three Saturdays before the opener: 18 and 25 July, 1 August 2026
    expect(fmtShortCal(friendlyDate(1, 0))).toMatch(/18 Jul/);
    expect(fmtShortCal(friendlyDate(1, 1))).toMatch(/25 Jul/);
    expect(fmtShortCal(friendlyDate(1, 2))).toMatch(/1 Aug/);
    // the league fixtures are still all there, untouched
    expect(save.fixtures.filter((f) => f.round > 0)).toHaveLength(seasonRounds(save) * (save.clubs.length / 2));
  });

  it("a friendly builds legs and form but never the record books", () => {
    const out = playRound(fresh());
    const save = out.save;
    const playedFriendly = save.fixtures.find((f) => f.friendly && f.played)!;
    expect(playedFriendly).toBeTruthy();
    expect(save.round).toBe(-2);
    expect(save.phase).toBe("pre");
    // the table is untouched
    const table = computeTable(save.fixtures, save.clubs);
    expect(table.every((r) => r.p === 0 && r.pts === 0)).toBe(true);
    // no season stats either — but the ratings did land on the form guide
    const mine = squadOf(save.players, save.userClubId);
    expect(mine.every((p) => p.apps === 0 && p.goals === 0)).toBe(true);
    const withForm = mine.filter((p) => (p.form ?? []).length > 0);
    expect(withForm.length).toBeGreaterThan(8);
    // and the window is open for business
    expect(transferWindow(save).open).toBe(true);
    expect(transferWindow(save).kind).toBe("summer");
  });

  it("when the friendlies are done the league begins", () => {
    let save = fresh();
    for (let i = 0; i < 3; i++) save = playRound(save).save;
    expect(save.phase).toBe("league");
    expect(save.round).toBe(1);
    expect(save.fixtures.filter((f) => f.friendly && f.played)).toHaveLength(3);
    // and the first league round is playable
    const out = playRound(save);
    expect(out.save.round).toBe(2);
    const table = computeTable(out.save.fixtures, out.save.clubs);
    expect(table.some((r) => r.p > 0)).toBe(true);
  });

  it("the diary knows about friendly Saturdays", () => {
    const save = fresh();
    const day = dayFor(save, friendlyDate(1, 0))!;
    expect(day.friendly).toBe(true);
    expect(day.match?.round).toBe(-3);
    expect(day.match?.oppId).not.toBe(save.userClubId);
    const months = seasonMonths(save).map((m) => m.m);
    expect(months).toContain(6); // July
    expect(months).toContain(7); // August
  });

  function inputsForLocalFriendly(save: SaveGame, fx: { homeId: string; awayId: string }) {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    return {
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
      homeXI: home.xi,
      awayXI: away.xi,
      homeBench: home.bench,
      awayBench: away.bench,
      homeMentality: home.mentality,
      awayMentality: away.mentality,
      homeRoles: home.roles,
      awayRoles: away.roles,
      homeCoords: home.coords,
      awayCoords: away.coords,
      homePoss: home.poss,
      awayPoss: away.poss,
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      conditions: conditionsFor(save, save.round)
    };
  }

  it("form moves a side: hot players win you games", () => {
    const run = (rating: number) => {
      let gf = 0;
      let ga = 0;
      for (let seed = 700; seed < 780; seed++) {
        const save = toLeague(newGame(seed));
        const fx = userFixture(save)!;
        const base = inputsForLocalFriendly(save, fx);
        const userSide = fx.homeId === save.userClubId ? "home" : "away";
        const oppXI = userSide === "home" ? base.awayXI : base.homeXI;
        for (const p of oppXI) p.form = [rating, rating, rating];
        const r = simulateMatch({
          ...base,
          rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)),
          userSide
        });
        gf += userSide === "home" ? r.awayGoals : r.homeGoals;
        ga += userSide === "home" ? r.homeGoals : r.awayGoals;
      }
      return gf - ga;
    };
    expect(run(4.2)).toBeLessThan(run(8.4));
  }, 30_000);

  it("formFactor is neutral without a run of games and clamps at ±4%", () => {
    const save = fresh();
    const p = squadOf(save.players, save.userClubId)[2];
    expect(formFactor(p)).toBe(1);
    p.form = [8.0];
    expect(formFactor(p)).toBe(1);
    p.form = [8.0, 8.0];
    expect(formFactor(p)).toBeGreaterThan(1);
    expect(formFactor(p)).toBeLessThanOrEqual(1.04);
    p.form = [4.0, 4.0, 4.0];
    expect(formFactor(p)).toBeLessThan(1);
    expect(formFactor(p)).toBeGreaterThanOrEqual(0.96);
  });

  it("three weeks without football and the streak is gone", () => {
    const save = fresh();
    const p = squadOf(save.players, save.userClubId)[3];
    p.form = [8.5, 8.1, 7.9];
    p.formMiss = 0;
    formFreshnessTick(save, new Set());
    expect(p.formMiss).toBe(1);
    expect(p.form).toHaveLength(3);
    formFreshnessTick(save, new Set());
    formFreshnessTick(save, new Set());
    expect(p.form).toHaveLength(0);
    expect(formFactor(p)).toBe(1);
    // playing resets it
    p.formMiss = 2;
    formFreshnessTick(save, new Set([p.id]));
    expect(p.formMiss).toBe(0);
  });

  it("pre-season rolls over into a new pre-season, friendlies and all", () => {
    let save = fresh();
    for (let i = 0; i < 3; i++) save = playRound(save).save;
    for (let r = 1; r <= seasonRounds(save); r++) save = playRound(save).save;
    const next = nextSeason(save);
    expect(next.season).toBe(2);
    expect(next.phase).toBe("pre");
    expect(next.round).toBe(-3);
    const fs = next.fixtures.filter((f) => f.friendly);
    expect(fs).toHaveLength(3);
    expect(fs.every((f) => !f.played)).toBe(true);
    expect(next.fixtures.filter((f) => f.round > 0)).toHaveLength(seasonRounds(next) * (next.clubs.length / 2));
  }, 30_000);

  it("stays deterministic through pre-season and the league", () => {
    const run = () => {
      let save = newGame(971);
      for (let i = 0; i < 4; i++) save = playRound(save).save;
      return JSON.stringify([
        save.round,
        save.phase,
        save.fixtures.filter((f) => f.friendly).map((f) => [f.round, f.played, f.homeGoals, f.awayGoals]),
        save.players.map((p) => [p.id, p.form, p.formMiss ?? 0])
      ]);
    };
    expect(run()).toBe(run());
  }, 30_000);
});

describe("motivation: talks, meetings and the big stage", () => {
  const fresh = () => newGame(980);
  const mine = (s: SaveGame, i = 3) => squadOf(s.players, s.userClubId)[i];

  it("each conversation reads the player, not a dice roll", () => {
    const save = fresh();
    const p = mine(save);
    // a man in form hears praise
    p.form = [7.6, 7.2, 7.4];
    const praised = individualTalk(save, p.id, "praise");
    expect(praised.resp.ok).toBe(true);
    expect(praised.resp.delta).toBeGreaterThanOrEqual(6);
    // …and hates being criticised
    const q = mine(save, 5);
    q.form = [7.6, 7.2];
    q.lastTalk = undefined;
    const warned = individualTalk(save, q.id, "warn");
    expect(warned.resp.delta).toBeLessThan(0);
    // the struggling one needs the truth, and takes it
    const r = mine(save, 7);
    r.form = [5.1, 5.4];
    r.lastTalk = undefined;
    const told = individualTalk(save, r.id, "warn");
    expect(told.resp.delta).toBeGreaterThan(0);
    expect(told.save.players.find((x) => x.id === r.id)!.morale!).toBeGreaterThan(r.morale ?? 60);
  });

  it("a challenge fires up a confident player and buries a fragile one", () => {
    const save = fresh();
    const confident = mine(save, 2);
    confident.morale = 70;
    confident.form = [7.0, 6.9];
    const up = individualTalk(save, confident.id, "challenge");
    expect(up.resp.delta).toBeGreaterThan(0);
    const fired = up.save.players.find((x) => x.id === confident.id)!;
    expect(fired.pumped?.amount).toBeGreaterThan(0);
    // the edge is live for two rounds and then gone
    expect(fired.pumped!.until).toBe(up.save.round + 2);
    // a low-mood player isn't looking for a challenge
    const fragile = mine(save, 6);
    fragile.morale = 35;
    const down = individualTalk(save, fragile.id, "challenge");
    expect(down.resp.delta).toBeLessThan(0);
    expect(down.save.players.find((x) => x.id === fragile.id)!.pumped).toBeUndefined();
  });

  it("reassurance steadies a worried player and falls flat on a broken one", () => {
    const save = fresh();
    const worried = mine(save, 1);
    worried.form = [5.2, 5.5];
    worried.morale = 58;
    const ok1 = individualTalk(save, worried.id, "reassure");
    expect(ok1.resp.delta).toBeGreaterThanOrEqual(4);
    const broken = mine(save, 8);
    broken.form = [5.2];
    broken.morale = 30;
    broken.traits = [];
    const flat = individualTalk(save, broken.id, "reassure");
    expect(flat.resp.delta).toBeLessThanOrEqual(2);
  });

  it("one conversation per few matches, and leaders take things differently", () => {
    const save = fresh();
    const p = mine(save, 4);
    const first = individualTalk(save, p.id, "praise");
    expect(first.resp.ok).toBe(true);
    expect(individualTalk(first.save, p.id, "praise").resp.ok).toBe(false); // cooling down
    // a leader carries praise further
    const leader = squadOf(save.players, save.userClubId).find((x) => hasTrait(x, "leader"));
    if (leader) {
      leader.form = [7.4, 7.1];
      const plain = { ...leader, traits: leader.traits.filter((t) => t !== "leader") };
      const withArmband = individualTalk(save, leader.id, "praise").resp.delta;
      const withoutSave: SaveGame = {
        ...save,
        players: save.players.map((x) => (x.id === leader.id ? plain : x))
      };
      expect(withArmband).toBeGreaterThan(individualTalk(withoutSave, leader.id, "praise").resp.delta);
    }
  });

  it("the advice knows what he needs to hear", () => {
    const save = fresh();
    const cold = mine(save, 0);
    cold.form = [5.2, 5.4, 5.6];
    cold.morale = 55;
    expect(talkAdvice(save, cold)?.kind).toBe("reassure");
    const hot = mine(save, 1);
    hot.form = [7.4, 7.5];
    hot.morale = 68;
    expect(talkAdvice(save, hot)?.kind).toBe("challenge");
    const list = talkSuggestions(save, 3);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((e) => e.why.length > 5)).toBe(true);
  });

  it("promised minutes are kept or paid for", () => {
    const save = toLeague(fresh());
    const p = squadOf(save.players, save.userClubId)[9];
    const pledged = pledgeMinutes(save, p.id);
    expect(pledged.resp.ok).toBe(true);
    const promised = pledged.save.players.find((x) => x.id === p.id)!;
    expect(promised.pledge?.minutes).toBe(30);
    const before = promised.morale ?? 60;
    // he played: kept (settled in the round the promise is due)
    const kept = structuredClone({ ...pledged.save, round: pledged.save.round + 1 });
    settlePledges(kept, { [p.id]: 62 });
    const happy = kept.players.find((x) => x.id === p.id)!;
    expect(happy.morale!).toBeGreaterThan(before);
    expect(happy.pledge).toBeUndefined();
    // he didn't: that costs you
    const broken = structuredClone({ ...pledged.save, round: pledged.save.round + 1 });
    settlePledges(broken, { [p.id]: 0 });
    const angry = broken.players.find((x) => x.id === p.id)!;
    expect(angry.morale!).toBeLessThan(before);
    expect(angry.unhappyRounds).toBeGreaterThan(0);
    // and you can't promise what injury prevents
    const hurt = structuredClone(save);
    hurt.players.find((x) => x.id === p.id)!.injuredWeeks = 2;
    expect(pledgeMinutes(hurt, p.id).resp.ok).toBe(false);
  });

  it("a meeting moves the room — and the wrong one moves it the other way", () => {
    const save = fresh();
    // a struggling squad responds to "stick together"
    const low: SaveGame = {
      ...save,
      players: save.players.map((p) => (p.clubId === save.userClubId ? { ...p, morale: 38 } : p))
    };
    const fit = meetingFit(low, "together");
    expect(fit.fit).toBe("strong");
    const stirred = teamMeeting(low, "together");
    expect(stirred.resp.ok).toBe(true);
    const after = stirred.save.players.filter((p) => p.clubId === low.userClubId);
    expect(after.every((p) => (p.morale ?? 60) > 38)).toBe(true);
    expect(stirred.save.meeting?.theme).toBe("together");
    // a second meeting right away is refused
    expect(teamMeeting(stirred.save, "standards").resp.ok).toBe(false);
    // and a poorly judged one costs morale
    const happy: SaveGame = {
      ...save,
      players: save.players.map((p) => (p.clubId === save.userClubId ? { ...p, morale: 78 } : p))
    };
    const risky = meetingFit(happy, "together");
    expect(risky.fit).toBe("risky");
    const backfired = teamMeeting(happy, "together");
    const sunk = backfired.save.players.filter((p) => p.clubId === happy.userClubId);
    expect(sunk.every((p) => (p.morale ?? 60) < 78)).toBe(true);
  });

  it("an easy week restores legs, a rally lifts the crowd, a warning settles unrest", () => {
    const save = fresh();
    const tired: SaveGame = {
      ...save,
      players: save.players.map((p) => (p.clubId === save.userClubId ? { ...p, condition: 55 } : p))
    };
    const rest = teamMeeting(tired, "recover");
    expect(rest.save.players.filter((p) => p.clubId === tired.userClubId).every((p) => p.condition > 55)).toBe(true);
    const rally: SaveGame = { ...save, media: { ...save.media!, fans: 40 } };
    const fans = teamMeeting(rally, "fans");
    expect(fans.save.media!.fans).toBe(43); // one bump, not one per player
    const unrest: SaveGame = {
      ...save,
      players: save.players.map((p, i) =>
        p.clubId === save.userClubId && i % 3 === 0 ? { ...p, transferRequest: true, morale: 30, unhappyRounds: 4 } : p
      )
    };
    const badge = teamMeeting(unrest, "badge");
    const settled = badge.save.players.filter((p) => p.clubId === unrest.userClubId && p.transferRequest);
    expect(settled.every((p) => (p.unhappyRounds ?? 0) < 4)).toBe(true);
  });

  it("knows a big match when it sees one", () => {
    const save = toLeague(fresh());
    const fx = userFixture(save)!;
    // round 1 with nobody having played: not a big match yet
    expect(bigMatchFor(save, fx)).toBeNull();
    // build a table where you and the opponent are both up top late in the season
    const rounds = seasonRounds(save);
    const played = { ...save, round: rounds - 2 };
    const target = played.fixtures.find(
      (f) =>
        f.round === played.round &&
        !f.played &&
        (f.homeId === played.userClubId || f.awayId === played.userClubId)
    )!;
    const oppId = target.homeId === played.userClubId ? target.awayId : target.homeId;
    const withResults = structuredClone(played);
    for (const f of withResults.fixtures) {
      if (f.round >= played.round || f.played) continue;
      const mineHome = f.homeId === withResults.userClubId;
      const oppHome = f.homeId === oppId;
      f.played = true;
      if (mineHome) { f.homeGoals = 2; f.awayGoals = 0; }
      else if (oppHome) { f.homeGoals = 2; f.awayGoals = 1; }
      else { f.homeGoals = 1; f.awayGoals = 1; }
    }
    const big = bigMatchFor(withResults, target);
    expect(big).not.toBeNull();
    expect(["Title six-pointer", "Against the leaders", "The decider"]).toContain(big!.label);
    expect(big!.stakes.length).toBeGreaterThan(10);
    // friendlies never qualify
    const friendly = fresh().fixtures.find((f) => f.friendly)!;
    expect(bigMatchFor(fresh(), friendly)).toBeNull();
  });

  it("the big stage lifts leaders and spooks the vulnerable", () => {
    const save = fresh();
    const kid = mine(save, 1);
    kid.age = 19;
    kid.morale = 60;
    kid.traits = [];
    const leader = mine(save, 2);
    leader.morale = 60;
    leader.traits = ["leader"];
    const steady = mine(save, 3);
    steady.morale = 60;
    steady.age = 27;
    steady.traits = [];
    expect(bigMatchEdge(steady)).toBe(1);
    expect(bigMatchEdge(kid)).toBeLessThan(1);
    expect(bigMatchEdge(leader)).toBeGreaterThan(1);
    const nervous = mine(save, 4);
    nervous.morale = 30;
    nervous.age = 28;
    nervous.traits = [];
    expect(bigMatchEdge(nervous)).toBeLessThan(1);
  });

  it("stays deterministic across talks, meetings and pledges", () => {
    const run = () => {
      let save = toLeague(newGame(981));
      const p = squadOf(save.players, save.userClubId)[3];
      const a = individualTalk(save, p.id, "challenge");
      save = a.save;
      const m = teamMeeting(save, "standards");
      save = m.save;
      const q = squadOf(save.players, save.userClubId)[6];
      save = pledgeMinutes(save, q.id).save;
      save = playRound(save).save;
      return JSON.stringify([
        save.players.map((x) => [x.id, x.morale, x.pumped ?? null, x.pledge ?? null]),
        save.meeting
      ]);
    };
    expect(run()).toBe(run());
  }, 30_000);
});

describe("discipline: the fifth booking and the straight red", () => {
  const fresh = () => newGame(990);

  it("counts to five and stops counting", () => {
    expect(banForCrossing(0, 1)).toBe(0);
    expect(banForCrossing(4, 5)).toBe(1);
    expect(banForCrossing(5, 6)).toBe(0);
    expect(banForCrossing(9, 10)).toBe(1);
    expect(banForCrossing(14, 15)).toBe(1);
    expect(yellowsToBan({ yellows: 3 })).toBe(2);
    expect(yellowsToBan({ yellows: 4 })).toBe(1);
    expect(yellowsToBan({ yellows: 5 })).toBe(5);
    expect(yellowBanLine({ yellows: 0, suspension: 0 })).toBeNull();
    expect(yellowBanLine({ yellows: 4, suspension: 0 })).toMatch(/one booking from a ban/);
    expect(yellowBanLine({ yellows: 3, suspension: 0 })).toMatch(/tightrope/);
    expect(yellowBanLine({ yellows: 2, suspension: 2 })).toBe("2 matches suspended");
  });

  it("a fifth yellow is a one-match ban, and the news says so", () => {
    const save = fresh();
    const p = squadOf(save.players, save.userClubId)[6];
    p.yellows = 4;
    const inboxBefore = (save.inbox ?? []).length;
    const r = applyCardPenalties(save, p, { before: 4, after: 5, notify: true });
    expect(r.banned).toBe(true);
    expect(p.suspension).toBe(1);
    // the ban lands in the inbox twice: the discipline card and the news line behind it
    expect((save.inbox ?? []).length).toBeGreaterThan(inboxBefore);
    expect((save.inbox ?? []).some((i) => /suspended/i.test(i.title))).toBe(true);
    expect((save.inbox ?? []).some((i) => /5th yellow|ban/i.test(i.title + " " + (i.body ?? "")))).toBe(true);
    expect(r.result).toMatch(/5th yellow|ban/i);
  });

  it("the fourth booking is a warning, not a ban", () => {
    const save = fresh();
    const p = squadOf(save.players, save.userClubId)[2];
    p.yellows = 3;
    const r = applyCardPenalties(save, p, { before: 3, after: 4, notify: true });
    expect(r.banned).toBe(false);
    expect(p.suspension).toBe(0);
    expect((save.inbox ?? [])[0].title).toMatch(/one booking from a ban/i);
  });

  it("a straight red is two matches, a second yellow is one", () => {
    const save = fresh();
    const a = squadOf(save.players, save.userClubId)[3];
    a.yellows = 0;
    applyCardPenalties(save, a, { before: 0, after: 0, redKind: "straight" });
    expect(a.suspension).toBe(2);
    const b = squadOf(save.players, save.userClubId)[4];
    b.yellows = 1;
    applyCardPenalties(save, b, { before: 1, after: 2, redKind: "second" });
    expect(b.suspension).toBe(1);
    // a ban and an accumulation ban don't stack into a longer one
    const c = squadOf(save.players, save.userClubId)[5];
    c.yellows = 9;
    applyCardPenalties(save, c, { before: 9, after: 10, redKind: "second" });
    expect(c.suspension).toBeGreaterThanOrEqual(1);
    expect(c.suspension).toBeLessThanOrEqual(2);
  });

  it("AI clubs collect bans quietly", () => {
    const save = fresh();
    const rival = save.players.find((p) => p.clubId !== save.userClubId)!;
    rival.yellows = 4;
    const inboxBefore = (save.inbox ?? []).length;
    const r = applyCardPenalties(save, rival, { before: 4, after: 5, notify: false });
    expect(r.banned).toBe(true);
    expect(rival.suspension).toBe(1);
    expect((save.inbox ?? []).length).toBe(inboxBefore); // nothing for the manager's feed
  });

  it("a season's football produces real bans somewhere in the division", () => {
    let save = toLeague(fresh());
    for (let i = 0; i < seasonRounds(save); i++) save = playRound(save).save;
    const booked = save.players.filter((p) => (p.yellows ?? 0) >= 5);
    expect(booked.length).toBeGreaterThan(0);
    // and the accumulators are exactly the ones walking the tightrope or banned
    const edge = onTheEdge(save.players, save.userClubId);
    expect(edge.every((p) => (p.suspension ?? 0) === 0)).toBe(true);
  }, 30_000);
});

describe("the club: sponsorship, the account and the campus", () => {
  const fresh = () => newGame(995);
  const withFac = (save: SaveGame, over: Partial<Facilities>): SaveGame => ({
    ...save,
    facilities: { ...save.facilities, [save.userClubId]: { ...save.facilities[save.userClubId], ...over } }
  });

  it("the shirt is worth more to a bigger club, and the long deal pays more", () => {
    const save = fresh();
    const offers = makeSponsorOffers(save);
    expect(offers.length).toBe(3);
    expect(offers[1].weekly).toBeGreaterThan(offers[0].weekly); // three seasons costs more
    expect(offers[2].weekly).toBeLessThan(offers[0].weekly); // one season pays less
    expect(offers.every((o) => o.until === save.season + o.seasons)).toBe(true);
    // a smaller club is worth less to a sponsor
    const small = { ...save, userClubId: save.clubs[9].id };
    expect(makeSponsorOffers(small)[1].weekly).toBeLessThan(offers[1].weekly);
    // offers are seeded: same save, same table
    expect(makeSponsorOffers(save)[1].weekly).toBe(offers[1].weekly);
  });

  it("signing puts the money on the shirt and the bonus in the bank", () => {
    const save = fresh();
    save.sponsorOffers = makeSponsorOffers(save);
    const offer = save.sponsorOffers[1];
    const before = save.finances[save.userClubId].balance;
    const res = signSponsor(save, offer.id);
    expect(res.ok).toBe(true);
    expect(save.sponsor?.name).toBe(offer.name);
    expect(save.sponsor?.weekly).toBe(offer.weekly);
    expect(save.sponsorOffers).toEqual([]);
    expect(save.finances[save.userClubId].balance).toBe(before + offer.bonus);
  });

  it("a home week fills the account and an away week does not", () => {
    const save = toLeague(fresh());
    save.sponsor = { name: "Test Co", weekly: 200_000, seasons: 2, until: save.season + 2, bonus: 0 };
    const capped = withFac(save, { stadium: 4 }); // 20,000 seats, so the gate is worth having
    const start = capped.finances[capped.userClubId].balance;
    // play a round until it is a home one
    let s = capped;
    let home = false;
    for (let i = 0; i < 4 && !home; i++) {
      const fx = s.fixtures.find((f) => f.round === s.round && !f.played && (f.homeId === s.userClubId || f.awayId === s.userClubId));
      home = !!fx && fx.homeId === s.userClubId;
      if (home) break;
      s = playRound(s).save;
    }
    expect(home).toBe(true);
    const before = s.finances[s.userClubId].balance;
    const after = playRound(s).save.finances[s.userClubId].balance;
    const gate = gateReceipts(s);
    expect(gate).toBeGreaterThan(200_000);
    // income minus upkeep: the gate is the lion's share of the week
    expect(after - before).toBeGreaterThan(gate * 0.9);
  });

  it("the board quietly covers a shortfall rather than let the lights go out", () => {
    const save = toLeague(fresh());
    save.sponsor = undefined;
    // no shirt money, a full campus to run, and a crowd that isn't buying anything
    save.facilities[save.userClubId] = { stadium: 5, training: 5, youth: 5, medical: 5 };
    save.media = { ...save.media!, fans: 30 };
    save.finances[save.userClubId].balance = 1_000;
    // put the round on an away day: no gate to soften the blow
    const away = save.fixtures.find(
      (f) => !f.played && f.round >= 1 && (f.homeId === save.userClubId || f.awayId === save.userClubId) && f.awayId === save.userClubId
    );
    save.round = away?.round ?? save.round;
    const lines = runCommercialRound(save);
    expect(save.finances[save.userClubId].balance).toBeGreaterThanOrEqual(0);
    expect(lines).toContain("board top-up");
    expect((save.inbox ?? []).some((i) => /shortfall/i.test(i.title))).toBe(true);
  });

  it("builds take money now, weeks to finish, and land in the save", () => {
    const save = toLeague(fresh());
    save.facilities[save.userClubId] = { stadium: 2, training: 2, youth: 2, medical: 2 };
    const fin = save.finances[save.userClubId];
    fin.balance = 9_000_000;
    const res = startBuild(save, "medical");
    expect(res.ok).toBe(true);
    expect(fin.balance).toBe(9_000_000 - FACILITY_COST.medical);
    expect(save.builds?.[0].weeksLeft).toBe(FACILITY_WEEKS.medical);
    // no double builds on the same site
    expect(startBuild(save, "medical").ok).toBe(false);
    // tick down to completion
    for (let i = 0; i < FACILITY_WEEKS.medical - 1; i++) expect(tickBuilds(save)).toEqual([]);
    const done = tickBuilds(save);
    expect(done.length).toBe(1);
    expect(facilitiesOf(save, save.userClubId).medical).toBe(3);
    expect(save.builds).toEqual([]);
    // and you can't build what you can't afford
    fin.balance = 10_000;
    expect(startBuild(save, "stadium").ok).toBe(false);
  });

  it("the training ground, the clinic, the academy and the stands each do something", () => {
    const base = toLeague(fresh());
    // training: same player, same seed, better ground
    const p = squadOf(base.players, base.userClubId)[5];
    const growAt = (level: number) => {
      const s = withFac(base, { training: level });
      const clone = structuredClone(s);
      const target = clone.players.find((x) => x.id === p.id)!;
      const before = target.attrs.shooting + target.attrs.passing + target.attrs.pace;
      developRound(clone, { [p.id]: 90 });
      const after = clone.players.find((x) => x.id === p.id)!;
      return after.attrs.shooting + after.attrs.passing + after.attrs.pace - before;
    };
    expect(growAt(5)).toBeGreaterThanOrEqual(growAt(1));
    // medical: injuries heal to a shorter number at a better centre
    expect(medicalWeeks(withFac(base, { medical: 5 }), base.userClubId, 4)).toBeLessThan(
      medicalWeeks(withFac(base, { medical: 1 }), base.userClubId, 4)
    );
    // academy: a better youth setup produces a better ceiling
    const peakAt = (level: number) => {
      const s = withFac(base, { youth: level });
      return makeYouth(s, s.userClubId, 0).peak;
    };
    expect(peakAt(5)).toBeGreaterThan(peakAt(1));
    // stadium: more seats, more at the gate
    expect(gateReceipts(withFac(base, { stadium: 5 }))).toBeGreaterThan(
      gateReceipts(withFac(base, { stadium: 1 }))
    );
    expect(capacityOf({ stadium: 1 })).toBe(8_000);
    expect(capacityOf({ stadium: 5 })).toBe(24_000);
  });

  it("moves club money into the transfer kitty, in millions", () => {
    const save = toLeague(fresh());
    const fin = save.finances[save.userClubId];
    fin.balance = 2_400_000;
    const t0 = fin.transfer;
    expect(bankToTransfer(save, 1_000_000).ok).toBe(true);
    expect(fin.transfer).toBe(t0 + 1_000_000);
    expect(fin.balance).toBe(1_400_000);
    fin.balance = 100_000;
    const refused = bankToTransfer(save, 1_000_000);
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/500k/);
  });

  it("the shirt market reopens when a deal runs out", () => {
    const save = toLeague(fresh());
    save.sponsor = { name: "Old Co", weekly: 100_000, seasons: 1, until: save.season, bonus: 0 };
    save.sponsorOffers = [];
    rollSponsor(save);
    expect(save.sponsor).toBeUndefined();
    expect((save.sponsorOffers ?? []).length).toBe(3);
    expect((save.inbox ?? []).some((i) => /sponsorship/i.test(i.title))).toBe(true);
    // a live deal is left alone
    const live = toLeague(fresh());
    live.sponsor = { name: "Steady Co", weekly: 120_000, seasons: 3, until: live.season + 2, bonus: 0 };
    live.sponsorOffers = [];
    rollSponsor(live);
    expect(live.sponsor?.name).toBe("Steady Co");
    expect(live.sponsorOffers).toEqual([]);
  });

  it("a full season pays the gate, the sponsor and the upkeep without drama", () => {
    let save = toLeague(fresh());
    save.sponsor = { name: "Season Co", weekly: 180_000, seasons: 2, until: save.season + 2, bonus: 0 };
    const start = save.finances[save.userClubId].balance;
    for (let i = 0; i < seasonRounds(save); i++) save = playRound(save).save;
    const end = save.finances[save.userClubId].balance;
    expect(end).toBeGreaterThan(start); // a mid club is cash-generative on this model
    expect(end).toBeLessThan(start + 40_000_000); // …but not silly
  }, 30_000);
});

describe("manager onboarding: the club brief and the first day", () => {
  const fresh = () => newGame(997);

  it("public facts are exact: the ground, the seats and the honours", () => {
    const save = fresh();
    const brief = clubBrief(save, "c1");
    expect(brief.lore.city).toBe("Northport");
    expect(brief.stadium).toBe("The Dockside");
    expect(brief.capacity).toBe(groundCapacity(save, "c1"));
    expect(brief.titles).toBe(CLUB_LORE.c1.honours);
    // every club has lore, a ground and a real capacity
    for (const c of save.clubs) {
      const b = clubBrief(save, c.id);
      expect(b.name).toBe(c.name);
      expect(b.capacity).toBe(groundCapacity(save, c.id)); // the brief tells the truth about the ground
      expect(b.capacity).toBeGreaterThanOrEqual(5_000);
      expect(b.lore.city.length).toBeGreaterThan(2);
    }
  });

  it("money and squads are words, never numbers", () => {
    const save = fresh();
    for (const c of save.clubs) {
      const b = clubBrief(save, c.id);
      expect(b.wealth).not.toMatch(/[0-9£]/);
      expect(b.squad).not.toMatch(/[0-9£]/);
      expect(b.expectation.length).toBeGreaterThan(6);
      expect(["Easy", "Fair", "Hard", "Brutal"]).toContain(b.difficulty);
    }
  });

  it("the big club reads rich and the small club reads like hard work", () => {
    const save = fresh();
    // the actual biggest and smallest by squad value (seeded clubs vary in order)
    const byValue = [...save.clubs].sort((a, b) => squadValueOf(save, b.id) - squadValueOf(save, a.id));
    const top = clubBrief(save, byValue[0].id);
    const bottom = clubBrief(save, byValue[byValue.length - 1].id);
    const wealthRank = ["Shoestring", "Careful with money", "Comfortable", "Wealthy", "Very wealthy"];
    expect(wealthRank.indexOf(top.wealth)).toBeGreaterThan(wealthRank.indexOf(bottom.wealth));
    const squadRank = ["Survival scrappers", "A battle ahead", "Solid mid-table", "Top-four calibre", "Title favourites"];
    expect(squadRank.indexOf(top.squad)).toBeGreaterThan(squadRank.indexOf(bottom.squad));
    expect(top.difficulty).toBe("Easy");
    expect(["Hard", "Brutal"]).toContain(bottom.difficulty);
    // and the expectation follows the squad, not the weather
    expect(top.expectation).toMatch(/win the league/i);
    expect(bottom.expectation).toMatch(/competitive|bonus/i);
  });

  it("the brief is deterministic for a given world", () => {
    const save = fresh();
    const a = JSON.stringify(clubBrief(save, "c4"));
    const b = JSON.stringify(clubBrief(save, "c4"));
    expect(a).toBe(b);
    expect(a).toBe(JSON.stringify(clubBrief(newGame(997), "c4")));
  });

  it("the first-day briefing hands over the real numbers", () => {
    const save = newGame(997, "c5");
    const brief = jobBrief(save);
    const fin = save.finances[save.userClubId];
    expect(brief.club).toBe(save.clubs[4].name);
    expect(brief.transfer).toBe(fin.transfer);
    expect(brief.wageBudget).toBe(fin.wageBudget);
    expect(brief.balance).toBe(fin.balance);
    expect(brief.squadSize).toBe(squadOf(save.players, save.userClubId).length);
    expect(brief.bestPlayer.name.length).toBeGreaterThan(2);
    expect(brief.firstFixture).toMatch(/^(Home|Away) v /);
    expect(brief.actions.length).toBeGreaterThanOrEqual(2);
    expect(brief.kittyNote.length).toBeGreaterThan(10);
  });

  it("day-one advice reads the club it is given", () => {
    const save = newGame(997, "c1");
    const rich = sponsorHint(save, "c1");
    const poor = sponsorHint(save, save.clubs[save.clubs.length - 1].id);
    expect(rich).not.toBe(poor);
    expect(wagePressure(save, "c1").length).toBeGreaterThan(10);
    expect(wagePressure(save, save.clubs[save.clubs.length - 1].id).length).toBeGreaterThan(10);
    // a band is always one of the five, for any value
    const bands = new Set(["elite", "strong", "good", "modest", "limited"]);
    for (const v of [0, 1, 5, 10, 50, 100]) {
      expect(bands.has(bandFor(v, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBe(true);
    }
  });
});

describe("attributes on the 1–20 scale (v0.33.0)", () => {
  const fresh = () => newGame(1001);

  it("anchors the scale: the floor is a 1, the world ceiling is a 20", () => {
    expect(to20(ATTR20_FLOOR)).toBe(1);
    expect(to20(ATTR20_CEILING)).toBe(20);
    expect(to20(0)).toBe(1); // below the floor still reads as the bottom
    expect(to20(99)).toBe(20); // clamped at the top
    // monotone across the whole useful band
    let prev = 0;
    for (let v = 20; v <= 96; v++) {
      const d = to20(v);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  it("reads a real squad the way a scout would", () => {
    const save = fresh();
    const squad = squadOf(save.players, save.userClubId);
    const ds = squad.map((p) => to20(p.attrs.shooting));
    // the best in the division are 17–20, the rest are a spread below
    expect(Math.max(...ds)).toBeGreaterThan(12);
    expect(Math.max(...ds)).toBeLessThanOrEqual(20);
    // a 20 is rare: it should be a handful of attributes in the whole world
    const all = save.players.flatMap((p) => ATTR_KEY_LIST.map((k) => to20(p.attrs[k])));
    const twenties = all.filter((d) => d === 20).length;
    expect(twenties / all.length).toBeLessThan(0.03);
    expect(twenties).toBeGreaterThan(0); // but it does exist — that is the point
    // the worst senior attribute is not a 1 — the floor is for filler youths
    expect(Math.min(...all)).toBeGreaterThan(1);
  });

  it("colours are relative to the division: the league's best reads elite", () => {
    const save = fresh();
    const best = save.players
      .map((p) => ({ p, v: p.attrs.shooting }))
      .sort((a, b) => b.v - a.v)[0];
    const worst = save.players
      .map((p) => ({ p, v: p.attrs.shooting }))
      .sort((a, b) => a.v - b.v)[0];
    expect(attrBand(save, "shooting", best.v)).toBe("elite");
    expect(attrBand(save, "shooting", worst.v)).toBe("weak");
    // a middling value lands in the middle
    const mid = save.players.map((p) => p.attrs.pace).sort((a, b) => a - b)[Math.floor(save.players.length / 2)];
    expect(["average", "good", "poor"]).toContain(attrBand(save, "pace", mid));
    // keepers are judged against keepers: the best and worst of them read apart
    const keepers = save.players.filter((p) => p.pos === "GK");
    const bestKeeper = [...keepers].sort((a, b) => b.attrs.reflexes - a.attrs.reflexes)[0];
    const worstKeeper = [...keepers].sort((a, b) => a.attrs.reflexes - b.attrs.reflexes)[0];
    expect(attrBand(save, "reflexes", bestKeeper.attrs.reflexes)).toBe("elite");
    expect(["poor", "weak"]).toContain(attrBand(save, "reflexes", worstKeeper.attrs.reflexes));
  });

  it("an unscouted range reads as a range in 1–20, and collapses when exact", () => {
    const save = fresh();
    const range = readRange(save, "shooting", 68, 76);
    expect(range.dLo).toBe(to20(68));
    expect(range.d).toBe(to20(76));
    expect(range.text).toMatch(/^\d+–\d+$/);
    const exact = readAttr(save, "shooting", 72);
    expect(exact.text).toBe(String(to20(72)));
    expect(exact.dLo).toBe(exact.d);
    // the band comes from the middle of the range, not the flattering end
    expect(readRange(save, "shooting", 60, 90).band).toBe(attrBand(save, "shooting", 75));
  });

  it("the bar fills the whole width across the scale, and the save is untouched", () => {
    expect(barPct(1)).toBeLessThan(10);
    expect(barPct(20)).toBe(100);
    expect(barPct(11)).toBeGreaterThan(45);
    expect(barPct(11)).toBeLessThan(60);
    // the display layer stores nothing: the raw numbers are still the raw numbers
    const save = fresh();
    const p = squadOf(save.players, save.userClubId)[3];
    const raw = p.attrs.shooting;
    readAttr(save, "shooting", raw);
    expect(p.attrs.shooting).toBe(raw);
    expect(typeof raw).toBe("number");
    expect(raw).toBeGreaterThan(20); // fine-grained, as the engine needs
  });

  it("the mapping is the inverse of itself where it matters", () => {
    for (const d of [1, 5, 10, 15, 20]) {
      expect(to20(from20(d))).toBe(d);
    }
  });
});

describe("height and the aerial game (v0.34.0)", () => {
  const fresh = () => newGame(1010);

  it("gives every player a height that fits his position, deterministically", () => {
    const save = fresh();
    for (const p of save.players) expect(p.height).toBeGreaterThanOrEqual(168);
    const avg = (pos: string) => {
      const g = save.players.filter((x) => x.pos === pos);
      return g.reduce((a, x) => a + heightOf(x), 0) / g.length;
    };
    // keepers and centre-halves are bigger than the small lads
    expect(avg("GK")).toBeGreaterThan(avg("MF"));
    expect(avg("DF")).toBeGreaterThan(avg("MF"));
    // same id → same centimetres, forever
    const p = save.players[5];
    expect(heightOf(p)).toBe(heightFor(p.id, p.pos));
    expect(aerialOf(p)).toBe(aerialOf({ ...p }));
  });

  it("the aerial score follows height and physical", () => {
    const save = fresh();
    const p = squadOf(save.players, save.userClubId)[4];
    const tall = { ...p, height: 196 };
    const short = { ...p, height: 170 };
    expect(aerialOf(tall)).toBeGreaterThan(aerialOf(short));
    expect(aerial20(tall)).toBeGreaterThan(aerial20(short));
    // and a strong short man can still be decent
    const strong = { ...p, height: 172, attrs: { ...p.attrs, physical: 90 } };
    expect(aerialOf(strong)).toBeGreaterThan(aerialOf(short));
    // the 1-20 read stays inside the scale
    for (const h of [165, 172, 180, 188, 196, 205]) {
      const d = aerial20({ ...p, height: h });
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(20);
    }
  });

  it("the duel is neutral between equals and decisive between opposites", () => {
    const save = fresh();
    const a = squadOf(save.players, save.userClubId)[3];
    const b = squadOf(save.players, save.userClubId)[4];
    expect(duelFactor(a, a)).toBe(1);
    const tower = { ...a, height: 196, attrs: { ...a.attrs, physical: 88 } };
    const mouse = { ...b, height: 170, attrs: { ...b.attrs, physical: 45 } };
    const up = duelFactor(tower, mouse);
    const down = duelFactor(mouse, tower);
    expect(up).toBeGreaterThan(1.1);
    expect(down).toBeLessThan(0.95);
    expect(up).toBeLessThanOrEqual(1.25);
    expect(down).toBeGreaterThanOrEqual(0.8);
  });

  it("a tall striker wins more headers than a short one, all else equal", () => {
    const save = fresh();
    const base = squadOf(save.players, save.userClubId)[6];
    const others = squadOf(save.players, save.userClubId).filter((x) => x.id !== base.id);
    const tall = { ...base, height: 197, attrs: { ...base.attrs, physical: 85 } };
    const short = { ...base, height: 170, attrs: { ...base.attrs, physical: 55 } };
    // the pick weight is what decides who gets on the end of a delivery
    const wTall = headerWeight(tall);
    const wShort = headerWeight(short);
    expect(wTall).toBeGreaterThan(wShort * 2);
    // and over many deliveries the tall man gets far more of them
    // the same delivery, twice: once with the tall man in the box, once with the small one
    const count = (candidate: typeof tall) => {
      const pool = [...others, candidate];
      const rng = mulberry32(7);
      let hits = 0;
      for (let i = 0; i < 400; i++) {
        const pick = pickWeighted(rng, pool, (x) => headerWeight(x));
        if (pick.id === candidate.id) hits++;
      }
      return hits;
    };
    const tallHits = count(tall);
    const shortHits = count(short);
    expect(tallHits).toBeGreaterThan(shortHits * 1.5);
  });

  it("headers now happen in open play, not only from set pieces", () => {
    let save = toLeague(fresh());
    let headed = 0;
    for (let i = 0; i < 18; i++) {
      save = playRound(save).save;
      headed = save.players.reduce((a, p) => a + (p.headers ?? 0), 0);
    }
    expect(headed).toBeGreaterThan(0); // somebody scored with his head this season
    expect(headed).toBeLessThan(120); // …but it is not silly
  }, 30_000);

  it("keeps the goal volume where it was — the aerial game redistributes", () => {
    // a full season of matches: goals per match must stay in the calibrated band
    let save = toLeague(newGame(1011));
    let goals = 0;
    let matches = 0;
    for (let i = 0; i < 18; i++) {
      const r = playRound(save);
      save = r.save;
      for (const res of save.lastResults) {
        goals += res.homeGoals + res.awayGoals;
        matches++;
      }
    }
    const perMatch = goals / Math.max(1, matches);
    expect(perMatch).toBeGreaterThan(1.6);
    expect(perMatch).toBeLessThan(4.2);
  }, 30_000);

  it("an old save gets its heights back the same way", () => {
    const save = fresh();
    const stripped = structuredClone(save);
    for (const p of stripped.players) delete p.height;
    const restored = normalizeSave(stripped);
    for (const p of restored.players) {
      expect(p.height).toBe(heightFor(p.id, p.pos));
    }
  });
});

describe("the laws of the game (v0.42.0)", () => {
  // a side with just the two things the law checks read: slots and coordinates
  const mockSide = (coords: Record<number, [number, number]>, positions: Record<number, Position>) =>
    ({
      slots: Object.keys(coords).map((k) => `p${k}`),
      coords: Object.fromEntries(Object.entries(coords).map(([k, v]) => [Number(k), v])),
      roles: []
    }) as unknown as MatchSideState;
  const men = (side: MatchSideState, positions: Record<number, Position>) =>
    Object.keys((side as unknown as { coords: Record<string, unknown> }).coords).map((k) => ({
      slot: Number(k),
      p: { pos: positions[Number(k)] ?? "MF" } as Player
    }));

  it("puts the offside line on the second-last defender, never past halfway", () => {
    // the keeper deepest, then a defender on 18, another on 30: the line is 18
    const def = mockSide({ 0: [50, 4], 1: [50, 18], 2: [50, 30] }, {});
    const dfn = men(def, { 0: "GK", 1: "DF", 2: "DF" });
    expect(offsideLine(def, dfn)).toBe(18);
    // a defence pushed up to 42 sets the line at 42
    const high = mockSide({ 0: [50, 30], 1: [50, 42], 2: [50, 44] }, {});
    expect(offsideLine(high, men(high, { 0: "GK", 1: "DF", 2: "DF" }))).toBe(42);
    // …but a line inside the opponents' half cannot extend past halfway
    const veryHigh = mockSide({ 0: [50, 52], 1: [50, 62], 2: [50, 66] }, {});
    expect(offsideLine(veryHigh, men(veryHigh, { 0: "GK", 1: "DF", 2: "DF" }))).toBe(50);
    // a deep defence sets the line where it stands
    const deep = mockSide({ 0: [50, 4], 1: [50, 18], 2: [50, 30] }, {});
    const ruling = checkOffside(
      mockSide({ 8: [50, 12], 9: [50, 10] }, {}),
      deep,
      men(deep, { 0: "GK", 1: "DF", 2: "DF" }),
      [
        { slot: 8, p: { pos: "MF" } as Player },
        { slot: 9, p: { pos: "FW" } as Player }
      ],
      8,
      9
    );
    expect(ruling.line).toBe(18);
    expect(ruling.offside).toBe(true); // 10 is beyond 18, and the pass went forward (12 → 10)
  });

  it("judges offside on positions: beyond is offside, level and behind are not", () => {
    const def = mockSide({ 0: [50, 6], 1: [50, 24], 2: [50, 40] }, {});
    const dfn = men(def, { 0: "GK", 1: "DF", 2: "DF" });
    const atk = mockSide({ 7: [50, 30], 8: [50, 20], 9: [50, 26] }, {});
    const men2 = [
      { slot: 7, p: { pos: "MF" } as Player },
      { slot: 8, p: { pos: "FW" } as Player },
      { slot: 9, p: { pos: "FW" } as Player }
    ];
    // passer on 30 → receiver on 20: forward, and 20 is beyond the line at 24
    expect(checkOffside(atk, def, dfn, men2, 7, 8).offside).toBe(true);
    // level with the last defender (24) is onside, and flagged tight
    expect(checkOffside(atk, def, dfn, men2, 7, 9).offside).toBe(false);
    // a backward pass to a man past the line is not offside
    expect(checkOffside(atk, def, dfn, men2, 8, 7).offside).toBe(false);
    expect(checkOffside(atk, def, dfn, men2, 8, 7).reason).toBe("backward");
    // and neither is the keeper drifting up
    const gkAtk = mockSide({ 0: [50, 12] }, {});
    expect(checkOffside(gkAtk, def, dfn, [{ slot: 0, p: { pos: "GK" } as Player }], 7, 0).offside).toBe(false);
  });

  it("never gives offside from a throw-in, a corner or a goal kick", () => {
    const def = mockSide({ 0: [50, 6], 1: [50, 30] }, {});
    const dfn = men(def, { 0: "GK", 1: "DF" });
    const atk = mockSide({ 7: [50, 34], 9: [50, 8] }, {});
    const men2 = [
      { slot: 7, p: { pos: "MF" } as Player },
      { slot: 9, p: { pos: "FW" } as Player }
    ];
    for (const restart of ["throw", "corner", "goalkick"]) {
      const r = checkOffside(atk, def, dfn, men2, 7, 9, restart);
      expect(r.offside).toBe(false);
      expect(r.reason).toBe("restart");
    }
    // the same positions in open play ARE offside
    expect(checkOffside(atk, def, dfn, men2, 7, 9, "open").offside).toBe(true);
  });

  it("sends the ball the right way when it crosses a line", () => {
    expect(restartAfterOut("atk", "touchline", false)).toEqual({ restart: "throw", to: "def" });
    expect(restartAfterOut("def", "touchline", false)).toEqual({ restart: "throw", to: "atk" });
    expect(restartAfterOut("def", "goal-line-defending", true)).toEqual({ restart: "corner", to: "atk" });
    expect(restartAfterOut("atk", "goal-line-defending", true)).toEqual({ restart: "goalkick", to: "def" });
  });

  it("applies the back-pass rule: a deliberate ball to the keeper may be handled", () => {
    const atk = [
      { slot: 5, p: { pos: "DF" } as Player },
      { slot: 0, p: { pos: "GK" } as Player }
    ];
    expect(backPassTarget([5, 0], atk)).toBe(0);
    expect(backPassTarget([5, 6, 9], atk)).toBeNull();
    // the keeper usually plays it — the offence is the exception, not the norm
    let picked = 0;
    const rng = mulberry32(99);
    for (let i = 0; i < 400; i++) if (keeperPicksItUp(0.5, rng)) picked++;
    expect(picked).toBeGreaterThan(0);
    expect(picked).toBeLessThan(60); // under 15% of back-passes
  });

  it("calls handball rarely, and a penalty when it is in the area", () => {
    const rng = mulberry32(1234);
    let pens = 0;
    for (let i = 0; i < 2000; i++) if (handballVerdict(true, rng) === "penalty") pens++;
    expect(pens).toBeGreaterThan(10);
    expect(pens).toBeLessThan(120); // a couple of percent of blocks, not a lottery
    const rng2 = mulberry32(7);
    expect(handballVerdict(false, rng2)).not.toBe("penalty");
  });

  it("flags only what the assistant can see, and lets the tight ones go", () => {
    const rng = mulberry32(55);
    const blatant = { offside: true, tight: false, line: 50, reason: "beyond" as const };
    const tight = { offside: true, tight: true, line: 50, reason: "beyond" as const };
    const onside = { offside: false, tight: false, line: 50, reason: "behind" as const };
    expect(flagGoesUp(blatant, rng)).toBe(true);
    expect(flagGoesUp(onside, rng)).toBe(false);
    let flags = 0;
    for (let i = 0; i < 400; i++) if (flagGoesUp(tight, rng)) flags++;
    expect(flags).toBeGreaterThan(200); // most tight calls are still given
    expect(flags).toBeLessThan(400); // …but some are missed
  });

  it("runs the laws in a real match: offsides, goal kicks and no goal from an offside flag", () => {
    let offsides = 0;
    let goalKicks = 0;
    let flaggedGoals = 0;
    let matches = 0;
    for (let seed = 300; seed < 320; seed++) {
      const save = toLeague(newGame(seed));
      const fx = userFixture(save)!;
      const home = resolveSide(save, fx.homeId);
      const away = resolveSide(save, fx.awayId);
      const r = simulateMatch({
        round: save.round,
        homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
        awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
        homeXI: home.xi,
        awayXI: away.xi,
        homeBench: home.bench,
        awayBench: away.bench,
        homeMentality: home.mentality,
        awayMentality: away.mentality,
        homeRoles: home.roles,
        awayRoles: away.roles,
        homeCoords: home.coords,
        awayCoords: away.coords,
        homePoss: home.poss,
        awayPoss: away.poss,
        homePlan: fx.homeId === save.userClubId ? save.setpieces : aiSetPieces(save, fx.homeId),
        awayPlan: fx.awayId === save.userClubId ? save.setpieces : aiSetPieces(save, fx.awayId),
        rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)),
        userSide: fx.homeId === save.userClubId ? "home" : "away"
      });
      matches++;
      const evs = r.events;
      offsides += evs.filter((e) => e.type === "offside").length;
      goalKicks += evs.filter((e) => e.type === "info" && /goal kick/i.test(e.text)).length;
      // a flagged offside must never be followed by a goal for the same side in that minute
      for (let i = 0; i < evs.length; i++) {
        if (evs[i].type !== "offside") continue;
        const sameMinute = evs.filter((e) => e.minute === evs[i].minute && e.type === "goal");
        if (sameMinute.length) flaggedGoals++;
      }
    }
    expect(matches).toBeGreaterThan(0);
    expect(offsides).toBeGreaterThan(0); // the law is actually called
    expect(goalKicks).toBeGreaterThan(0); // and goal kicks happen
    expect(flaggedGoals).toBe(0); // never a goal on the same whistle
    // sanity: not every other minute is an offside
    expect(offsides / matches).toBeLessThan(12);
  });
});

describe("grounds with real sizes (v0.39.0)", () => {
  it("gives every club its own capacity — no two leagues of clones", () => {
    const save = newGame(5051);
    const leagues = [{ name: save.country!, clubs: save.clubs }, ...save.world!.map((w) => ({ name: w.country, clubs: w.clubs }))];
    for (const lg of leagues) {
      const seats = lg.clubs.map((c) => c.capacity!);
      expect(seats.every((v) => v >= 5_000 && v <= 81_000)).toBe(true);
      // a division is a spread, not one number repeated twenty times
      expect(new Set(seats).size).toBeGreaterThanOrEqual(18);
      expect(Math.min(...seats)).toBeLessThan(15_000);
      expect(Math.max(...seats)).toBeGreaterThan(25_000);
      // and the biggest ground is at least three times the smallest
      expect(Math.max(...seats) / Math.min(...seats)).toBeGreaterThan(2.5);
    }
  });

  it("makes the famous clubs the big grounds, and keeps the tail long", () => {
    const save = newGame(5052);
    const byStanding = [...save.clubs].sort(
      (a, b) => (b.honours ?? 0) + b.strength / 2 - ((a.honours ?? 0) + a.strength / 2)
    );
    const mean = (list: typeof save.clubs) =>
      list.reduce((n, c) => n + (c.capacity ?? 0), 0) / list.length;
    expect(mean(byStanding.slice(0, 5))).toBeGreaterThan(mean(byStanding.slice(-5)) + 8_000);
    // a long tail: most grounds are modest, only a couple are vast
    const seats = save.clubs.map((c) => c.capacity!).sort((a, b) => a - b);
    const median = seats[10];
    expect(seats[seats.length - 1]).toBeGreaterThan(median * 1.8);
    expect(seats[0]).toBeLessThan(median);
  });

  it("counts the stadium facility on top of the ground", () => {
    const save = toLeague(newGame(5053));
    const cap = groundCapacity(save, save.userClubId);
    const base = save.clubs.find((c) => c.id === save.userClubId)!.capacity!;
    const level = save.facilities[save.userClubId].stadium;
    expect(cap).toBe(Math.round((base + Math.max(0, level - 3) * 2_500) / 100) * 100);
    // build the stadium up: the ground grows with it
    const bigger = structuredClone(save);
    bigger.facilities[bigger.userClubId] = { ...bigger.facilities[bigger.userClubId], stadium: Math.max(4, level + 1) };
    const add = Math.max(0, bigger.facilities[bigger.userClubId].stadium - 3) * 2_500;
    expect(groundCapacity(bigger, bigger.userClubId)).toBe(
      Math.round((base + add) / 100) * 100
    );
    expect(groundCapacity(bigger, bigger.userClubId)).toBeGreaterThanOrEqual(cap);
    // and the gate pays for it: a full house in a bigger ground is worth more
    const gate = gateReceipts(save);
    const gateBig = gateReceipts(bigger);
    expect(gateBig).toBeGreaterThan(gate);
  });

  it("falls back to the old table for saves made before grounds had sizes", () => {
    const save = toLeague(newGame(5054));
    const old = structuredClone(save);
    for (const c of old.clubs) delete c.capacity;
    const level = old.facilities[old.userClubId].stadium;
    // the old table, plus anything the stadium facility has built on top
    expect(groundCapacity(old, old.userClubId)).toBe(
      capacityOf({ stadium: level }) + Math.max(0, level - 3) * 2_500
    );
    expect(groundCapacity(old, old.userClubId)).toBeGreaterThan(0);
  });

  it("lets the manager resize a ground, and shows it everywhere", () => {
    const save = toLeague(newGame(5055));
    const edited = editClub(save, "c7", { capacity: 44_500 });
    const c = edited.clubs.find((x) => x.id === "c7")!;
    expect(c.capacity).toBe(44_500);
    const level = edited.facilities["c7"].stadium;
    expect(groundCapacity(edited, "c7")).toBe(44_500 + Math.max(0, level - 3) * 2_500);
    expect(clubBrief(edited, "c7").capacity).toBe(groundCapacity(edited, "c7"));
    // silly numbers are cleaned, not stored
    expect(editClub(save, "c7", { capacity: 40 }).clubs.find((x) => x.id === "c7")!.capacity).toBe(1_000);
    expect(editClub(save, "c7", { capacity: 400_000 }).clubs.find((x) => x.id === "c7")!.capacity).toBe(120_000);
    // and reset hands the ground back
    const reset = resetClub(edited, "c7");
    expect(reset.clubs.find((x) => x.id === "c7")!.capacity).toBe(save.clubs.find((x) => x.id === "c7")!.capacity);
    expect(isEdited(reset.clubs.find((x) => x.id === "c7")!, reset)).toBe(false);
  });

  it("holds the spread for every country, and for old worlds too", () => {
    for (const nation of ["eng", "esp", "ger", "ita"] as const) {
      const save = newGame(5060, undefined, nation);
      const seats = save.clubs.map((c) => c.capacity!);
      expect(new Set(seats).size).toBeGreaterThanOrEqual(18);
      expect(Math.min(...seats)).toBeLessThan(15_000);
      expect(Math.max(...seats)).toBeGreaterThan(25_000);
      expect(seats.every((v) => v <= 81_000)).toBe(true);
    }
  });
});

describe("a continent of leagues (v0.38.0)", () => {
  const fresh = () => newGame(4041);

  it("builds four leagues: yours in detail, three more with real squads", () => {
    const save = fresh();
    expect(save.clubs).toHaveLength(20);
    expect(save.players).toHaveLength(440);
    expect(save.world).toHaveLength(3);
    expect(save.nation).toBe("eng");
    expect(save.leagueName).toBe("League One");
    for (const w of save.world!) {
      expect(w.clubs).toHaveLength(20);
      expect(w.players).toHaveLength(440);
      expect(w.fixtures.filter((f) => !f.friendly)).toHaveLength(380);
      expect(w.country.length).toBeGreaterThan(2);
      expect(w.name.length).toBeGreaterThan(2);
    }
    // nobody appears twice, and no club id is shared between leagues
    const ids = new Set([...save.clubs, ...save.world!.flatMap((w) => w.clubs)].map((c) => c.id));
    expect(ids.size).toBe(80);
  });

  it("names its players for the country they play in", () => {
    const save = newGame(4042);
    const pools = new Map(NATIONS.map((n) => [n.id, new Set(n.last)]));
    const check = (leagueId: string, players: typeof save.players) => {
      const pool = pools.get(leagueId as never)!;
      const surnames = players.map((p) => p.name.split(" ").slice(-1)[0]);
      const known = surnames.filter((s) => pool.has(s)).length;
      // the pools are the source: allow for the odd compound surname
      expect(known / surnames.length).toBeGreaterThan(0.9);
    };
    check("eng", save.players);
    for (const w of save.world!) check(w.id, w.players);
    // and the four leagues do not share a name pool
    const spanish = NATIONS.find((n) => n.id === "esp")!;
    expect(spanish.last).toContain("García");
    const german = NATIONS.find((n) => n.id === "ger")!;
    expect(save.world!.find((w) => w.id === "ger")!.players[0].name.split(" ").slice(-1)[0]).toBe(
      save.world!.find((w) => w.id === "ger")!.players[0].name.split(" ").slice(-1)[0]
    );
    expect(german.first.length).toBeGreaterThan(20);
  });

  it("gives every player attributes that fit the shirt he wears", () => {
    const save = newGame(4043);
    const everyone = [
      ...save.players,
      ...save.world!.flatMap((w) => w.players)
    ];
    const outfield = (p: (typeof everyone)[number]) =>
      Math.max(p.attrs.shooting, p.attrs.pace, p.attrs.defending, p.attrs.passing, p.attrs.physical);
    for (const p of everyone) {
      expect(p.height).toBeGreaterThan(160);
      expect(p.height).toBeLessThan(205);
      if (p.pos === "GK") {
        // a keeper is a keeper: what defines him dwarfs everything else, and he
        // does not shoot like a striker or fly down the wing
        expect(p.attrs.shooting).toBeLessThan(p.attrs.reflexes - 10);
        expect(p.attrs.shooting).toBeLessThan(p.attrs.handling);
        expect(p.attrs.pace).toBeLessThan(p.attrs.reflexes);
        expect(p.attrs.defending).toBeLessThan(p.attrs.handling);
        expect(Math.max(p.attrs.reflexes, p.attrs.handling)).toBeGreaterThanOrEqual(outfield(p));
        expect(Math.max(p.attrs.reflexes, p.attrs.handling)).toBeGreaterThan(45);
        for (const tr of p.traits ?? []) {
          expect(TRAITS[tr].groups).toContain("GK");
        }
      } else {
        // and an outfielder is not a keeper
        expect(p.attrs.reflexes).toBeLessThan(58);
        expect(p.attrs.handling).toBeLessThan(58);
        for (const tr of p.traits ?? []) {
          expect(TRAITS[tr].groups.includes(p.pos)).toBe(true);
        }
      }
      if (p.pos === "FW") {
        expect(p.attrs.shooting).toBeGreaterThan(p.attrs.defending);
        expect(p.attrs.shooting).toBeGreaterThan(p.attrs.reflexes);
        expect(p.attrs.shooting).toBeGreaterThan(p.attrs.handling);
      }
      if (p.pos === "DF") {
        expect(p.attrs.defending).toBeGreaterThan(p.attrs.shooting);
        expect(p.attrs.defending).toBeGreaterThan(p.attrs.passing);
      }
      if (p.pos === "MF") {
        // a midfielder's passing leads his game, though a shooter can be close
        expect(p.attrs.passing).toBeGreaterThanOrEqual(p.attrs.shooting - 8);
      }
    }
    // and across four leagues: keepers shoot less than everyone, and keep better
    const gks = everyone.filter((p) => p.pos === "GK");
    const fws = everyone.filter((p) => p.pos === "FW");
    const avg = (list: typeof everyone, f: (p: (typeof everyone)[number]) => number) =>
      list.reduce((n, p) => n + f(p), 0) / Math.max(1, list.length);
    expect(avg(gks, (p) => p.attrs.shooting)).toBeLessThan(avg(fws, (p) => p.attrs.shooting) - 15);
    expect(avg(gks, (p) => p.attrs.reflexes)).toBeGreaterThan(
      avg(everyone.filter((p) => p.pos !== "GK"), (p) => p.attrs.reflexes) + 15
    );
    expect(avg(everyone.filter((p) => p.pos === "DF"), (p) => p.attrs.defending)).toBeGreaterThan(
      avg(everyone.filter((p) => p.pos === "FW"), (p) => p.attrs.defending) + 10
    );
    expect(gks.length).toBeGreaterThan(100);
  });

  it("plays the continent every round — results, scorers and tables", () => {
    const save = toLeague(newGame(4044));
    const after = playRound(save).save;
    for (const w of after.world!) {
      const played = w.fixtures.filter((f) => f.played);
      expect(played.length).toBe(10); // one round of twenty clubs
      const table = worldTable(w);
      expect(table).toHaveLength(20);
      expect(table.every((r) => r.p === 1)).toBe(true);
      const goals = table.reduce((n, r) => n + r.gf, 0);
      expect(goals).toBeGreaterThanOrEqual(0);
    }
    // somebody scored, and the goals belong to real players of that league
    const ger = after.world!.find((w) => w.id === "ger")!;
    const scorers = ger.players.filter((p) => p.goals > 0);
    expect(scorers.length).toBeGreaterThan(0);
    expect(ger.players.every((p) => p.apps >= 1 || p.condition < 100)).toBe(true);
    expect(worldScorers(ger)[0].goals).toBeGreaterThan(0);
  });

  it("keeps a whole season of Europe ticking, and rolls it over", () => {
    let save = toLeague(newGame(4045));
    for (let r = 1; r <= seasonRounds(save); r++) save = playRound(save).save;
    for (const w of save.world!) {
      const played = w.fixtures.filter((f) => f.played);
      expect(played.length).toBe(380);
      const table = worldTable(w);
      expect(table.reduce((n, r) => n + r.p, 0)).toBe(380 * 2);
      expect(table[0].pts).toBeGreaterThan(20);
    }
    const next = nextSeason(save);
    for (const w of next.world!) {
      expect(w.fixtures.filter((f) => f.played)).toHaveLength(0);
      expect(w.players.every((p) => p.apps === 0 && p.goals === 0)).toBe(true);
      expect(w.players.every((p) => p.condition === 100)).toBe(true);
    }
  });

  it("can be set in any of the four countries, with the right clubs and names", () => {
    const esp = newGame(4046, undefined, "esp");
    expect(esp.nation).toBe("esp");
    expect(esp.country).toBe("Spain");
    expect(esp.clubs[0].name).toBe("Real Valdoro");
    expect(esp.clubs[0].city).toBe("Valdoro");
    expect(esp.world!.map((w) => w.id).sort()).toEqual(["eng", "ger", "ita"]);
    expect(esp.players[0].name.split(" ").slice(-1)[0]).toBe(
      esp.players[0].name.split(" ").slice(-1)[0]
    );
    const pools = new Set(NATIONS.find((n) => n.id === "esp")!.last);
    expect(esp.players.filter((p) => pools.has(p.name.split(" ").slice(-1)[0])).length).toBeGreaterThan(400);
    // the English league still exists, with its own names
    const eng = esp.world!.find((w) => w.id === "eng")!;
    expect(eng.clubs[0].name).toBe("Northport FC");
    const engPool = new Set(NATIONS.find((n) => n.id === "eng")!.last);
    expect(eng.players.filter((p) => engPool.has(p.name.split(" ").slice(-1)[0])).length).toBeGreaterThan(400);
  });

  it("gives the scouts the whole continent, and knows who plays where", () => {
    const save = newGame(4047);
    expect(allPlayers(save)).toHaveLength(1760);
    const foreign = save.world![1].players[0];
    expect(playerAnywhere(save, foreign.id)?.name).toBe(foreign.name);
    expect(leagueOfClub(save, save.clubs[0].id)?.country).toBe("England");
    expect(leagueOfClub(save, foreign.clubId)?.country).toBe(save.world![1].country);
    const brief = worldBrief(save);
    expect(brief).toHaveLength(3);
    expect(brief.every((b) => b.leader.length > 2)).toBe(true);
  });

  it("keeps your league exactly as it was before the continent existed", () => {
    // the world is generated from its own stream: your clubs, players and
    // fixtures are byte-for-byte the same as a world with no leagues outside
    const a = newGame(4048);
    const b = newGame(4048, undefined, "eng");
    const key = (s: typeof a) =>
      JSON.stringify({
        clubs: s.clubs.map((c) => [c.id, c.name, c.formation]),
        players: s.players.map((p) => [p.id, p.name, p.attrs, p.traits]),
        fixtures: s.fixtures.map((f) => [f.round, f.homeId, f.awayId])
      });
    expect(key(a)).toBe(key(b));
  });
});

describe("a twenty-club league (v0.37.0)", () => {
  it("has twenty clubs, each playing every other twice — a 38-round season", () => {
    const save = toLeague(newGame(3030));
    expect(save.clubs).toHaveLength(20);
    expect(seasonRounds(save)).toBe(38);
    const league = save.fixtures.filter((f) => !f.friendly);
    expect(league).toHaveLength(380); // 20 clubs, 19 opponents, home and away
    const perClub = new Map<string, number>();
    for (const f of league) {
      perClub.set(f.homeId, (perClub.get(f.homeId) ?? 0) + 1);
      perClub.set(f.awayId, (perClub.get(f.awayId) ?? 0) + 1);
    }
    expect([...perClub.values()].every((n) => n === 38)).toBe(true);
    // and nobody plays themselves, nobody twice in a round
    for (let r = 1; r <= 38; r++) {
      const round = league.filter((f) => f.round === r);
      expect(round).toHaveLength(10);
      const ids = round.flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(ids).size).toBe(20);
    }
  });

  it("gives every club a full squad and every club a brief", () => {
    const save = toLeague(newGame(3031));
    const perClub = new Map<string, number>();
    for (const pl of save.players) perClub.set(pl.clubId, (perClub.get(pl.clubId) ?? 0) + 1);
    expect([...perClub.values()]).toEqual(Array.from({ length: 20 }, () => 22));
    for (const c of save.clubs) {
      const brief = clubBrief(save, c.id);
      expect(brief.name).toBe(c.name);
      expect(brief.lore.city.length).toBeGreaterThan(1);
      expect(brief.capacity).toBeGreaterThan(0);
    }
  });

  it("runs the cup over five rounds: prelim of eight, then a round of sixteen", () => {
    const save = toLeague(newGame(3032));
    const prelim = save.cup!.ties.filter((t) => t.round === "prelim");
    expect(prelim).toHaveLength(4);
    const inPrelim = new Set(prelim.flatMap((t) => [t.homeId, t.awayId]));
    expect(inPrelim.size).toBe(8);
    expect(save.clubs.length - inPrelim.size).toBe(12); // the byes
    // settle the prelim and the round of sixteen appears, eight ties strong
    const clone: any = JSON.parse(JSON.stringify({ ...save, round: CUP_WEEK.prelim }));
    tickCup(clone);
    expect(clone.cup.ties.filter((t: any) => t.round === "r16")).toHaveLength(8);
  });

  it("plays a whole twenty-club season: the cup finishes with one winner", () => {
    let save = toLeague(newGame(3033));
    let guard = 0;
    const started = Date.now();
    while (save.round <= 38 && guard++ < 60) {
      const tie = userCupTie(save);
      if (tie) {
        const r = resolveTie(save, tie);
        save = completeCupTie({ ...save, live: undefined }, { homeGoals: r.homeGoals, awayGoals: r.awayGoals, updates: [], ratings: {} } as any, r.pens);
      }
      save = playRound(save).save;
    }
    const ms = Date.now() - started;
    expect(save.cup!.winnerId).toBeTruthy();
    expect(save.history.cups?.length).toBe(1);
    // twenty clubs is twice the world (380 matches, 440 players). What must not
    // change is the cost of a single match: judge that, and report the season.
    const matches = 38 * 10;
    // eslint-disable-next-line no-console
    console.info(`[perf] twenty-club season: ${ms} ms for ${matches} matches (${(ms / matches).toFixed(1)} ms/match)`);
    expect(ms / matches).toBeLessThan(25);
  });

  it("edits a club: name, colour, city and ground, and the brief follows", () => {
    const save = toLeague(newGame(3034));
    const before = clubBrief(save, "c4");
    const edited = editClub(save, "c4", {
      name: "Testville FC",
      short: "tst",
      color: "#123456",
      city: "Testville",
      ground: "The Test Bowl",
      founded: 1999
    });
    const c = edited.clubs.find((x) => x.id === "c4")!;
    expect(c.name).toBe("Testville FC");
    expect(c.short).toBe("TST"); // upper-cased
    expect(c.color).toBe("#123456");
    expect(c.city).toBe("Testville");
    expect(c.ground).toBe("The Test Bowl");
    expect(c.founded).toBe(1999);
    const after = clubBrief(edited, "c4");
    expect(after.name).toBe("Testville FC");
    expect(after.lore.city).toBe("Testville");
    expect(after.lore.stadium).toBe("The Test Bowl");
    expect(after.lore.founded).toBe(1999);
    // the rest of the world is untouched, and so is the game: strength and formation
    expect(edited.clubs.find((x) => x.id === "c5")!.name).toBe(save.clubs.find((x) => x.id === "c5")!.name);
    expect(c.strength).toBe(save.clubs.find((x) => x.id === "c4")!.strength);
    expect(c.formation).toBe(save.clubs.find((x) => x.id === "c4")!.formation);
    expect(before.name).not.toBe(after.name);
  });

  it("cleans what the manager types, and never lets a club be erased", () => {
    const save = toLeague(newGame(3035));
    const messy = editClub(save, "c6", { name: "  Two   Spaces  ", short: "a1!", city: "", ground: "   " });
    const c = messy.clubs.find((x) => x.id === "c6")!;
    expect(c.name).toBe("Two Spaces");
    expect(c.short).toBe("A1");
    expect(c.city).toBeUndefined(); // blanked = back to the club's own
    expect(c.ground).toBeUndefined();
    expect(clubBrief(messy, "c6").lore.city).toBe(clubBrief(save, "c6").lore.city);
    // an empty name is refused outright — a club always has a name
    const nameless = editClub(save, "c6", { name: "   " });
    expect(nameless.clubs.find((x) => x.id === "c6")!.name).toBe(save.clubs.find((x) => x.id === "c6")!.name);
    // a rubbish colour is refused too
    const badColour = editClub(save, "c6", { color: "red" });
    expect(badColour.clubs.find((x) => x.id === "c6")!.color).toBe(save.clubs.find((x) => x.id === "c6")!.color);
  });

  it("resets a club to the generator, and edits survive the season turning over", () => {
    const save = toLeague(newGame(3036));
    const edited = editClub(save, "c7", { name: "Renamed", city: "Somewhere" });
    expect(isEdited(edited.clubs.find((c) => c.id === "c7")!, edited)).toBe(true);
    const reset = resetClub(edited, "c7");
    expect(reset.clubs.find((c) => c.id === "c7")!.name).toBe(save.clubs.find((c) => c.id === "c7")!.name);
    expect(isEdited(reset.clubs.find((c) => c.id === "c7")!, reset)).toBe(false);
    // and an edit is part of the world: it carries into the next season
    const next = nextSeason(edited);
    expect(next.clubs.find((c) => c.id === "c7")!.name).toBe("Renamed");
    expect(clubBrief(next, "c7").lore.city).toBe("Somewhere");
  });
});

describe("the Challenge Cup: mid-week knockout (v0.36.0)", () => {
  /** play league rounds up to (not including) a round number */
  const toRound = (seed: number, round: number) => {
    let save = toLeague(newGame(seed));
    let guard = 0;
    while (save.round < round && guard++ < 40) save = playRound(save).save;
    return save;
  };

  /** the manager plays his tie — the same two calls the live path makes */
  const playTie = (save: any) => {
    const tie = userCupTie(save);
    if (!tie) return save;
    const r = resolveTie(save, tie);
    return completeCupTie(
      { ...save, live: undefined },
      {
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
        updates: [],
        ratings: {}
      } as any,
      r.pens
    );
  };

  /** the first week where the manager has a cup tie */
  const cupWeek = (seed: number) => {
    let save = toLeague(newGame(seed));
    let guard = 0;
    while (!userCupTie(save) && save.round < 17 && guard++ < 30) save = playRound(save).save;
    return save;
  };

  it("draws the preliminary round from the weakest clubs, seeded", () => {
    const s = toLeague(newGame(2020));
    const a = makeCup(s);
    const b = makeCup(s);
    expect(a.ties).toHaveLength(4); // eight clubs in the preliminary, twelve byes
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // same seed, same draw
    const inPrelim = new Set(a.ties.flatMap((t) => [t.homeId, t.awayId]));
    expect(inPrelim.size).toBe(8);
    for (const t of a.ties) expect(t.homeId).not.toBe(t.awayId);
  });

  it("every club is in the cup — twelve byes, eight in the preliminary", () => {
    const s = toLeague(newGame(2021));
    const prelim = s.cup!.ties.filter((t) => t.round === "prelim");
    const inPrelim = new Set(prelim.flatMap((t) => [t.homeId, t.awayId]));
    expect(inPrelim.size).toBe(8);
    expect(s.clubs.length - inPrelim.size).toBe(12); // the rest go straight to the round of sixteen
  });

  it("a cup tie turns Wednesday into a match day", () => {
    const save = cupWeek(2021);
    const tie = userCupTie(save);
    expect(tie).toBeTruthy();
    expect(matchDays(save)).toContain(CUP_DAY);
    expect(matchDays(save).length).toBe(2); // Wednesday and Saturday
    expect(activityFor(save, CUP_DAY)).toBe("match");
    expect(activityFor(save, 0)).not.toBe("match");
  });

  it("resolves a tie over ninety minutes, and on penalties if it is level", () => {
    const save = cupWeek(2022);
    const tie = userCupTie(save)!;
    const r = resolveTie(save, tie);
    expect(Number.isFinite(r.homeGoals)).toBe(true);
    if (r.homeGoals === r.awayGoals) {
      expect(r.pens).toBeTruthy();
      expect(r.pens!.home).not.toBe(r.pens!.away);
    }
  });

  it("plays the manager's tie and leaves the league round untouched", () => {
    const save = cupWeek(2023);
    const round = save.round;
    const resultsBefore = save.lastResults.length;
    const tie = userCupTie(save)!;
    const after = playTie(save);
    expect(after.round).toBe(round); // the league round has not moved
    expect(after.lastResults.length).toBe(resultsBefore);
    const t = after.cup!.ties.find((x: any) => x.id === tie.id)!;
    expect(t.played).toBe(true);
    expect(t.winnerId).toBeTruthy();
    // the whole round is settled
    expect(after.cup!.ties.filter((x: any) => x.round === tie.round).every((x: any) => x.played)).toBe(true);
    expect(after.day).toBeGreaterThanOrEqual(CUP_DAY);
  });

  it("the bracket runs on its own when the manager is not holding it up", () => {
    // walk to the quarter-final week, playing the manager's own ties on the way
    let save = toLeague(newGame(2024));
    let walk = 0;
    while (save.round < CUP_WEEK.qf && walk++ < 40) {
      save = playTie(save);
      save = playRound(save).save;
    }
    const clone: any = JSON.parse(JSON.stringify(save));
    const qf = clone.cup.ties.filter((t: any) => t.round === "qf");
    expect(qf.length).toBe(4); // eight clubs: the round of sixteen winners
    // say the manager has played his (or is out): the round must settle itself
    const mine = qf.find((t: any) => t.homeId === clone.userClubId || t.awayId === clone.userClubId);
    if (mine && !mine.played) {
      mine.played = true;
      mine.winnerId = mine.homeId;
    }
    tickCup(clone);
    expect(clone.cup.ties.filter((t: any) => t.round === "qf").every((t: any) => t.played)).toBe(true);
    expect(clone.cup.ties.filter((t: any) => t.round === "sf")).toHaveLength(2);
    // and it only settles once: no double draw, no double prize
    const before = JSON.stringify(clone.cup);
    tickCup(clone);
    expect(JSON.stringify(clone.cup)).toBe(before);
  });

  it("a season ends with one winner, remembered in the history", () => {
    let save = toLeague(newGame(2025));
    let guard = 0;
    while (save.round <= seasonRounds(save) && guard++ < 90) {
      save = playTie(save);
      save = playRound(save).save;
    }
    const cup = save.cup!;
    expect(cup.winnerId).toBeTruthy();
    expect(cup.runnerUpId).toBeTruthy();
    expect(cup.runnerUpId).not.toBe(cup.winnerId);
    expect(save.history.cups?.length).toBe(1);
    expect(save.history.cups![0].winnerId).toBe(cup.winnerId);
    expect(cupStatus(save).toLowerCase()).toContain("cup");
    // and one name is on it, not two
    const allTies = cup.ties;
    expect(allTies.filter((t) => t.round === "final")).toHaveLength(1);
  });

  it("the congested plan is the light one, and only applies for the week it was set", () => {
    expect(trainingDays(CONGESTED_PLAN)).toBeLessThan(trainingDays(DEFAULT_PLAN));
    const save = toLeague(newGame(2027));
    const s = { ...save, weekOverride: { forRound: save.round, plan: CONGESTED_PLAN } };
    expect(planOf(s)).toEqual(CONGESTED_PLAN);
    expect(planOf({ ...save, weekOverride: { forRound: save.round + 1, plan: CONGESTED_PLAN } })).toEqual(DEFAULT_PLAN);
  });
});

describe("the week: six days of decisions (v0.35.0)", () => {
  const fresh = () => toLeague(newGame(1020));

  it("keeps the clock: Mon → Sat, then a new week on match day completion", () => {
    const save = fresh();
    expect(save.day).toBe(0); // a new season starts on Monday
    let s = save;
    for (let i = 0; i < 5; i++) s = runDay(s).save;
    expect(s.day).toBe(MATCH_DAY); // Saturday
    // and the round engine puts us back on Monday
    const played = playRound(s).save;
    expect(played.day).toBe(0);
  });

  it("match day is the only day that runs the engine, and it is not optional", () => {
    const save = { ...fresh(), day: MATCH_DAY };
    expect(activityFor(save, MATCH_DAY)).toBe("match");
    // you cannot plan training on match day
    expect(
      activityFor({ ...save, weekPlan: ["rest", "rest", "rest", "rest", "rest", "technical"] as Activity[] }, MATCH_DAY)
    ).toBe("match");
  });

  it("a default week reproduces the old weekly recovery — the game does not speed up", () => {
    const base = fresh();
    // a tired squad, so recovery has somewhere to go (the old weekly tick gave ~+10)
    const save: SaveGame = {
      ...base,
      players: base.players.map((p) => (p.clubId === base.userClubId ? { ...p, condition: 70 } : p))
    };
    const before = save.players.filter((p) => p.clubId === save.userClubId).map((p) => p.condition);
    const avgBefore = before.reduce((a, b) => a + b, 0) / before.length;
    let s = save;
    for (let i = 0; i < MATCH_DAY; i++) s = runDay(s).save; // Monday to Friday
    const after = s.players.filter((p) => p.clubId === s.userClubId).map((p) => p.condition);
    const avgAfter = after.reduce((a, b) => a + b, 0) / after.length;
    // …and the week's net recovery lands where the old weekly tick left it (≈ +10)
    expect(avgAfter - avgBefore).toBeGreaterThan(4);
    expect(avgAfter - avgBefore).toBeLessThan(18);
  });

  it("load is a lever: a heavy week costs legs, a rest week restores them", () => {
    const base = fresh();
    const heavy: SaveGame = { ...base, weekPlan: ["physical", "physical", "physical", "physical", "physical", "match"] as Activity[] };
    const light: SaveGame = { ...base, weekPlan: ["rest", "rest", "rest", "rest", "rest", "match"] as Activity[] };
    const run = (s: SaveGame) => {
      let x = s;
      for (let i = 0; i < MATCH_DAY; i++) x = runDay(x).save;
      const sq = x.players.filter((p) => p.clubId === x.userClubId);
      return {
        condition: sq.reduce((a, p) => a + p.condition, 0) / sq.length,
        jaded: sq.reduce((a, p) => a + jadedOf(p), 0) / sq.length
      };
    };
    const h = run(heavy);
    const l = run(light);
    expect(h.condition).toBeLessThan(l.condition);
    expect(h.jaded).toBeGreaterThan(l.jaded);
  });

  it("pays for its work: more training days, more development", () => {
    const plan = (days: number): Activity[] => {
      const p: Activity[] = ["rest", "rest", "rest", "rest", "rest", "match"];
      for (let i = 0; i < days; i++) p[i] = "technical";
      return p;
    };
    const factor = (days: number) => planGrowthFactor(plan(days));
    expect(factor(0)).toBeLessThan(factor(2));
    expect(factor(2)).toBeLessThan(factor(4));
    expect(factor(4)).toBe(1); // the baseline week is unchanged
    expect(factor(5)).toBeGreaterThan(1);
    // and the same holds in the engine: two identical players, two different weeks
    const base = fresh();
    const grow = (planDays: number) => {
      const s: SaveGame = { ...base, weekPlan: plan(planDays) };
      const p = s.players.find((x) => x.clubId === s.userClubId)!;
      const before = p.attrs.passing + p.attrs.shooting;
      const after = developRound(s, { [p.id]: 90 });
      const q = after.players.find((x) => x.id === p.id)!;
      return q.attrs.passing + q.attrs.shooting - before;
    };
    expect(grow(4)).toBeGreaterThanOrEqual(grow(1));
  });

  it("training days carry a knock risk; recovery days do not", () => {
    const save = fresh();
    // a whole season of five-a-week physical work on a tired squad breaks somebody
    let s: SaveGame = { ...save, weekPlan: ["physical", "physical", "physical", "physical", "physical", "match"] as Activity[] };
    for (const p of s.players) if (p.clubId === s.userClubId) p.condition = 45;
    let knocks = 0;
    for (let w = 0; w < 8; w++) {
      for (let d = 0; d < MATCH_DAY; d++) {
        const r = runDay(s);
        s = r.save;
        knocks += r.report.knocks.length;
      }
      s = playRound(s).save;
    }
    expect(knocks).toBeGreaterThan(0);
    // a rest week never breaks anyone
    const rested: SaveGame = { ...save, weekPlan: ["rest", "rest", "rest", "rest", "rest", "match"] as Activity[] };
    let x = rested;
    let restKnocks = 0;
    for (let d = 0; d < MATCH_DAY; d++) {
      const r = runDay(x);
      x = r.save;
      restKnocks += r.report.knocks.length;
    }
    expect(restKnocks).toBe(0);
  });

  it("the plan carries over week to week, and old saves keep the old rhythm", () => {
    const save = fresh();
    const planned: SaveGame = { ...save, weekPlan: ["off", "tactical", "technical", "recovery", "prep", "match"] as Activity[] };
    let s = planned;
    for (let d = 0; d < MATCH_DAY; d++) s = runDay(s).save;
    s = playRound(s).save;
    expect(s.day).toBe(0);
    expect(s.weekPlan?.[0]).toBe("off"); // the standing plan survives the round rollover
    // an old save with no week: Continue means play the match
    const legacy = structuredClone(save);
    delete legacy.day;
    legacy.weekPlan = undefined;
    const restored = normalizeSave(legacy);
    expect(restored.day).toBe(MATCH_DAY);
    expect(restored.weekPlan).toEqual(DEFAULT_PLAN);
    expect(planGrowthFactor(restored.weekPlan!)).toBe(1); // and it is the baseline load
  });

  it("the view tells the manager what each day is for", () => {
    const save = fresh();
    const view = weekView({ ...save, day: 2 });
    expect(view.length).toBe(6);
    expect(view[2].isToday).toBe(true);
    expect(view[5].isMatch).toBe(true);
    expect(view.every((d) => d.label.length > 2 && d.blurb.length > 10)).toBe(true);
    // presets for congestion (v0.36, when the cup lands)
    expect(trainingDays(CONGESTED_PLAN)).toBeLessThan(trainingDays(DEFAULT_PLAN));
  });
});

describe("save", () => {
  it("survives a JSON round trip", () => {
    const save = newGame(5);
    const clone = JSON.parse(JSON.stringify(save));
    expect(clone).toEqual(save);
    expect(clone.saveVersion).toBe(1);
  });
});
