/**
 * Headless season simulation — the M0 spike tool.
 *
 *   npm run sim -- --seed 42 [--match] [--seasons 3]
 */
import { newGame } from "../src/engine/generate";
import { playRound, nextSeason, seasonRounds } from "../src/engine/advance";
import { computeTable } from "../src/engine/league";

const args = process.argv.slice(2);
const arg = (name: string, fallback: number): number => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

const seed = arg("--seed", 42);
const seasons = arg("--seasons", 1);
const showMatch = args.includes("--match");

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
