import type { Club, Fixture, TableRow } from "./types";
import { hashSeed, mulberry32 } from "./rng";

/**
 * Double round-robin (circle method): every club plays every other twice,
 * once at home, once away. 20 clubs -> 38 rounds, 380 fixtures.
 */
export function buildFixtures(clubs: Club[], season: number, seed: number): Fixture[] {
  const rng = mulberry32(hashSeed(seed, "fixtures", season));
  const arr = clubs.map((c) => c.id);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const n = arr.length;
  const rot = [...arr];
  const firstHalf: Array<Array<[string, string]>> = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i];
      const b = rot[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    firstHalf.push(pairs);
    rot.splice(1, 0, rot.pop()!);
  }

  const fixtures: Fixture[] = [];
  firstHalf.forEach((pairs, idx) => {
    for (const [h, a] of pairs) {
      fixtures.push({ round: idx + 1, homeId: h, awayId: a, played: false });
    }
  });
  firstHalf.forEach((pairs, idx) => {
    for (const [h, a] of pairs) {
      fixtures.push({ round: idx + 1 + (n - 1), homeId: a, awayId: h, played: false });
    }
  });
  return fixtures;
}

export function computeTable(fixtures: Fixture[], clubs: Club[]): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const c of clubs) {
    rows.set(c.id, {
      clubId: c.id,
      p: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
      position: 0
    });
  }
  for (const f of fixtures) {
    if (f.friendly || f.round < 1) continue; // pre-season never counts
    if (!f.played || f.homeGoals == null || f.awayGoals == null) continue;
    const h = rows.get(f.homeId)!;
    const a = rows.get(f.awayId)!;
    h.p++;
    a.p++;
    h.gf += f.homeGoals;
    h.ga += f.awayGoals;
    a.gf += f.awayGoals;
    a.ga += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      h.w++;
      a.l++;
      h.pts += 3;
    } else if (f.homeGoals < f.awayGoals) {
      a.w++;
      h.l++;
      a.pts += 3;
    } else {
      h.d++;
      a.d++;
      h.pts++;
      a.pts++;
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, gd: r.gf - r.ga }));
  list.sort(
    (x, y) =>
      y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.clubId.localeCompare(y.clubId)
  );
  list.forEach((r, i) => {
    r.position = i + 1;
  });
  return list;
}

export function userFixtureForRound(
  fixtures: Fixture[],
  round: number,
  clubId: string
): Fixture | undefined {
  return fixtures.find(
    (f) => f.round === round && (f.homeId === clubId || f.awayId === clubId)
  );
}

export function formGuide(
  fixtures: Fixture[],
  clubId: string,
  last = 5
): Array<"W" | "D" | "L"> {
  const played = fixtures
    .filter(
      (f) =>
        f.played &&
        !f.friendly && // pre-season results never count towards league form
        f.homeGoals != null &&
        f.awayGoals != null &&
        (f.homeId === clubId || f.awayId === clubId)
    )
    .sort((a, b) => a.round - b.round)
    .slice(-last);
  return played.map((f) => {
    const isHome = f.homeId === clubId;
    const mine = isHome ? f.homeGoals! : f.awayGoals!;
    const theirs = isHome ? f.awayGoals! : f.homeGoals!;
    return mine > theirs ? "W" : mine < theirs ? "L" : "D";
  });
}
