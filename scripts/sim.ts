/**
 * Headless season simulation — the M0 spike tool.
 *
 *   npm run sim -- --seed 42 [--match] [--seasons 3]
 *   npm run sim -- --stats 60          (engine calibration report over N matches)
 */
import { newGame } from "../src/engine/generate";
import { playRound, nextSeason, seasonRounds, matchInputs } from "../src/engine/advance";
import { computeTable } from "../src/engine/league";
import { startMatch, advanceTo, finalizeMatch } from "../src/engine/match";
import { matchReport, mergeReports, type MatchReport } from "../src/engine/analysis";

const args = process.argv.slice(2);
const arg = (name: string, fallback: number): number => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(args[i + 1]);
  return Number.isFinite(v) && args[i + 1] !== undefined && !args[i + 1].startsWith("--") ? v : fallback;
};

const seed = arg("--seed", 42);
const seasons = arg("--seasons", 1);
const showMatch = args.includes("--match");

/** Engine calibration report: sample N fixtures and aggregate the match analysis. */
const statsMode = (n: number) => {
  const save = newGame(seed);
  const ids = save.clubs.map((c) => c.id);
  const players = new Map(save.players.map((p) => [p.id, p] as const));
  let agg: MatchReport | null = null;
  let games = 0;
  for (let k = 0; k < n; k++) {
    const i = k % ids.length;
    const j = (i + 1 + Math.floor(k / ids.length)) % ids.length;
    if (i === j) continue;
    const round = 1 + (k % 18);
    const inp = matchInputs(save, round, ids[i], ids[j]);
    let st = startMatch(inp);
    st = advanceTo(st, 200, players);
    finalizeMatch(st);
    const rep = matchReport(st);
    agg = agg ? mergeReports(agg, rep) : rep;
    games++;
  }
  if (!agg || !games) return;
  const pct = (x: number, d: number) => `${((x / Math.max(1, d)) * 100).toFixed(1)}%`;
  const per = (x: number) => (x / games).toFixed(2);
  const h = agg.home;
  const a = agg.away;
  console.log(`Seed ${seed} — ${games} matches\n`);
  console.log(`goals/match          ${per(h.goals + a.goals)}  (home ${per(h.goals)} / away ${per(a.goals)})`);
  console.log(`shots/match          ${per(h.shots + a.shots)}  (xg ${per(h.xg + a.xg)})`);
  console.log(`passes/possession    ${agg.passesPerPossession.toFixed(2)}`);
  const attempts = agg.passLength.short + agg.passLength.medium + agg.passLength.long;
  console.log(`passes/match         ${per(h.attempts + a.attempts)}  (completion ${pct(h.passes + a.passes, h.attempts + a.attempts)})`);
  console.log(`pass length          short ${pct(agg.passLength.short, attempts)} / med ${pct(agg.passLength.medium, attempts)} / long ${pct(agg.passLength.long, attempts)}`);
  const dirs = agg.direction.fwd + agg.direction.lat + agg.direction.back;
  console.log(`direction            fwd ${pct(agg.direction.fwd, dirs)} / lat ${pct(agg.direction.lat, dirs)} / back ${pct(agg.direction.back, dirs)}`);
  console.log(`possession           home ${(agg.possessionHome * 100).toFixed(1)}%`);
  console.log(`turnovers won high   ${per(h.wonHigh + a.wonHigh)}/match (of ${per(h.turnoversWon + a.turnoversWon)} won)`);
  const ends = agg.ends.out + agg.ends.turnover + agg.ends.chance + agg.ends.foul + agg.ends.offside + agg.ends.held;
  console.log(`chain ends           out ${pct(agg.ends.out, ends)} / turnover ${pct(agg.ends.turnover, ends)} / chance ${pct(agg.ends.chance, ends)} / foul ${pct(agg.ends.foul, ends)} / offside ${pct(agg.ends.offside, ends)} / held ${pct(agg.ends.held, ends)}`);
};

if (args.includes("--stats")) {
  statsMode(arg("--stats", 60));
} else {
let save = newGame(seed);
const userClub = save.clubs.find((c) => c.id === save.userClubId)!;
console.log(`Seed ${seed} — managing ${userClub.name} (${userClub.short})`);
console.log("");

for (let s = 0; s < seasons; s++) {
  const rounds = seasonRounds(save);
  while (save.round <= rounds) {
    const { save: next, userMatch } = playRound(save);
    if (showMatch && userMatch && save.round === 1 && s === 0) {
      const home = save.clubs.find((c) => c.id === userMatch.homeId)!;
      const away = save.clubs.find((c) => c.id === userMatch.awayId)!;
      console.log(`Match day — ${home.name} vs ${away.name}`);
      for (const e of userMatch.events) {
        console.log(`  ${String(e.minute).padStart(2, " ")}'  ${e.text}`);
      }
      console.log("");
    }
    save = next;
  }
  const table = computeTable(save.fixtures, save.clubs);
  console.log(`Season ${save.season} final table:`);
  for (const row of table) {
    const club = save.clubs.find((c) => c.id === row.clubId)!;
    const marker = row.clubId === save.userClubId ? " <" : "";
    console.log(
      `  ${String(row.position).padStart(2, " ")}. ${club.name.padEnd(20, " ")} ` +
        `P${row.p} W${row.w} D${row.d} L${row.l} GF${row.gf} GA${row.ga} GD${row.gd >= 0 ? "+" : ""}${row.gd}  ${row.pts} pts${marker}`
    );
  }
  if (s < seasons - 1) {
    save = nextSeason(save);
    console.log(`\n--- Season ${save.season} ---\n`);
  }
}
}
