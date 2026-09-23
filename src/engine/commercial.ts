import type {
  Club, Build, Facilities, Player, SaveGame, SponsorOffer } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { pushInbox } from "./inbox";
import { pushNews } from "./training";
import { squadValue, wageBill } from "./transfers";

/** Facilities run 1..5; the stadium seats follow the level. */
export const FACILITY_MAX = 5;
export const FACILITY_KINDS = ["stadium", "training", "youth", "medical"] as const;
export type FacilityKind = (typeof FACILITY_KINDS)[number];

const CAPACITY = [0, 8_000, 12_000, 16_000, 20_000, 24_000];
/** The old level-to-seats table: a fallback for saves made before grounds had sizes. */
export function capacityOf(f: Pick<Facilities, "stadium">): number {
  return CAPACITY[Math.max(1, Math.min(FACILITY_MAX, f.stadium))];
}

/** What a stadium level is worth in seats once the ground is big enough to extend. */
export const SEATS_PER_LEVEL = 2_500;

/** Every club in the world, yours or abroad. */
function clubAnywhere(save: SaveGame, clubId: string): Club | undefined {
  return (
    save.clubs?.find((c) => c.id === clubId) ??
    (save.world ?? []).flatMap((w) => w.clubs).find((c) => c.id === clubId)
  );
}

/**
 * The real size of a ground (v0.39): the club's own capacity, plus the
 * extensions the stadium facility has built on top of it. Levels 1–3 are the
 * ground as it stands; 4 and 5 add 2,500 and 5,000 seats, so a club with a
 * 9,000-seat ground that builds out ends up with 14,000 — the upgrade is felt in
 * the crowd (and in the gate receipts).
 */
export function groundCapacity(save: SaveGame, clubId: string): number {
  const club = clubAnywhere(save, clubId);
  const fac = facilitiesOf(save, clubId);
  const base = club?.capacity ?? capacityOf(fac);
  const built = save.facilities?.[clubId] ? Math.max(0, fac.stadium - 3) * SEATS_PER_LEVEL : 0;
  return Math.max(1_000, Math.round((base + built) / 100) * 100);
}

/** One-off cost of the next upgrade, and how long the builders need. */
export const FACILITY_COST: Record<FacilityKind, number> = {
  stadium: 3_000_000,
  training: 1_500_000,
  youth: 1_000_000,
  medical: 800_000
};
export const FACILITY_WEEKS: Record<FacilityKind, number> = {
  stadium: 10,
  training: 5,
  youth: 5,
  medical: 4
};

/**
 * The number each facility multiplies into its system. Level 2 is the neutral
 * point (the world's average campus), level 5 is a real edge; medical is a
 * multiplier on weeks out, so lower is better.
 */
export function facilityModifier(kind: FacilityKind, level: number): number {
  const l = Math.max(1, Math.min(FACILITY_MAX, level));
  if (kind === "training") return 0.88 + 0.06 * l; // .94 → 1.18
  if (kind === "youth") return 0.85 + 0.07 * l; // .92 → 1.20
  if (kind === "medical") return 1.2 - 0.07 * l; // 1.13 → .85
  return 1;
}

/** Plain-English effect, for the club screen. */
export function facilityEffectLine(kind: FacilityKind, level: number): string {
  const m = facilityModifier(kind, level);
  if (kind === "training") return `${m >= 1 ? "+" : ""}${Math.round((m - 1) * 100)}% development rate`;
  if (kind === "youth") return `${m >= 1 ? "+" : ""}${Math.round((m - 1) * 100)}% academy quality`;
  if (kind === "medical") return `${Math.round((1 - m) * 100)}% shorter injuries`;
  return `${capacityOf({ stadium: level }).toLocaleString()} seats`;
}

/** Weekly running cost of the whole campus. */
export function upkeepWeekly(f: Facilities): number {
  return FACILITY_KINDS.reduce((sum, k) => sum + (f[k] ?? 1) * 4_000, 0);
}

/** What the shirt is worth to a sponsor each week, for a club of this stature. */
export function sponsorWeekly(save: SaveGame, clubId: string): number {
  const value = squadValue(save, clubId);
  const last = save.history?.seasons[save.history.seasons.length - 1];
  const merit = last && last.champion.clubId === clubId ? 60_000 : 0;
  return Math.round(Math.max(60_000, value * 0.0022 + merit + 40_000) / 1_000) * 1_000;
}

const SPONSOR_NAMES = [
  "Kestrel Bank",
  "Novaline",
  "Harborlight Insurance",
  "Vertex Motors",
  "Northwind Energy",
  "Cobalt Telecom",
  "Bastion Breweries",
  "Lyra Software",
  "Ironworks Steel",
  "Summit Air"
];

const SPONSOR_TAGLINES = [
  "Front-of-shirt, two seasons, straight down the middle.",
  "A bigger weekly fee, but they want a three-season commitment.",
  "Modest money, one season only — get back on the market quickly."
];

/** Three offers whose value tracks the club's stature; the spreads differ. */
export function makeSponsorOffers(save: SaveGame): SponsorOffer[] {
  const base = sponsorWeekly(save, save.userClubId);
  const rng = mulberry32(hashSeed(`sponsor-${save.season}-${save.userClubId}`));
  const picks = new Set<number>();
  while (picks.size < 3) picks.add(Math.floor(rng() * SPONSOR_NAMES.length));
  const names = [...picks].map((i) => SPONSOR_NAMES[i]);
  const shapes: Array<{ mult: number; seasons: number }> = [
    { mult: 1, seasons: 2 },
    { mult: 1.35, seasons: 3 },
    { mult: 0.8, seasons: 1 }
  ];
  return shapes.map((s, i) => ({
    id: `so-${save.season}-${i}`,
    name: names[i],
    weekly: Math.round((base * s.mult) / 1_000) * 1_000,
    seasons: s.seasons,
    until: save.season + s.seasons,
    bonus: Math.round((base * s.mult * 6) / 100_000) * 100_000,
    tagline: SPONSOR_TAGLINES[i]
  }));
}

/** Merchandise: a percentage of the mood of the crowd. */
export function merchWeekly(save: SaveGame): number {
  const fans = save.media?.fans ?? 50;
  return Math.round(Math.max(0, Math.min(140_000, (fans - 35) * 2_800)) / 1_000) * 1_000;
}

/** Gate: only home matchdays pay, capacity × ticket price × how full it is. */
export function gateReceipts(save: SaveGame): number {
  const cap = groundCapacity(save, save.userClubId);
  const fans = save.media?.fans ?? 50;
  const fill = Math.max(0.55, Math.min(1, 0.62 + (fans - 50) * 0.006));
  return Math.round((cap * 30 * fill) / 10_000) * 10_000;
}

/** The medical centre's verdict on how long he's out (weeks, never below 1). */
export function medicalWeeks(save: SaveGame, clubId: string, weeks: number): number {
  if (weeks <= 0) return 0;
  const m = facilityModifier("medical", facilitiesOf(save, clubId).medical);
  return Math.max(1, Math.round(weeks * m));
}

export function facilitiesOf(save: SaveGame, clubId: string): Facilities {
  return (
    save.facilities?.[clubId] ?? { stadium: 2, training: 2, youth: 2, medical: 2 }
  );
}

/** Is this the round the club plays at home? (only home games pay at the gate) */
function homeThisRound(save: SaveGame): boolean {
  const fx = save.fixtures.find(
    (f) => f.round === save.round && (f.homeId === save.userClubId || f.awayId === save.userClubId)
  );
  return !!fx && fx.homeId === save.userClubId;
}

/**
 * One week of club business: commercial income in, upkeep out, the board quietly
 * covering any shortfall. Mutates the save and returns the lines worth reporting.
 */
export function runCommercialRound(save: SaveGame): string[] {
  const fin = save.finances?.[save.userClubId];
  if (!fin) return [];
  const lines: string[] = [];
  const sponsor = save.sponsor?.until && save.sponsor.until > save.season ? save.sponsor.weekly : 0;
  const merch = merchWeekly(save);
  const gate = homeThisRound(save) ? gateReceipts(save) : 0;
  const upkeep = upkeepWeekly(facilitiesOf(save, save.userClubId));
  fin.balance = (fin.balance ?? 0) + sponsor + merch + gate - upkeep;
  if (fin.balance < 0) {
    // the board covers the overspend rather than let the lights go out
    const covered = -fin.balance;
    fin.balance = 0;
    if (covered > 50_000) {
      pushNews(
        save,
        `The board covered ${(covered / 1_000_000).toFixed(1)}m of running costs — don't make a habit of it.`
      );
      pushInbox(save, {
        kind: "board",
        title: "Board covered a shortfall",
        body: `Facility upkeep and commercial income were ${(covered / 1_000_000).toFixed(1)}m apart this week. Financial control is being watched.`,
        screen: "club"
      });
      lines.push("board top-up");
    }
  }
  return lines;
}

/** Put commercial money into the transfer kitty (the board lets you move it). */
export function bankToTransfer(save: SaveGame, amount: number): { ok: boolean; message: string } {
  const fin = save.finances?.[save.userClubId];
  if (!fin) return { ok: false, message: "No club finances." };
  const bal = fin.balance ?? 0;
  const move = Math.max(0, Math.min(amount, bal));
  if (move < 500_000) {
    return { ok: false, message: "You need at least £500k in the bank to move money across." };
  }
  fin.balance = bal - move;
  fin.transfer += move;
  pushNews(save, `£${(move / 1_000_000).toFixed(1)}m moved from the club account into the transfer kitty.`);
  return { ok: true, message: `£${(move / 1_000_000).toFixed(1)}m added to the transfer budget.` };
}

/** Commission the next level of a facility. One build at a time. */
export function startBuild(save: SaveGame, kind: FacilityKind): { ok: boolean; message: string } {
  const fin = save.finances?.[save.userClubId];
  if (!fin) return { ok: false, message: "No club finances." };
  const fac = facilitiesOf(save, save.userClubId);
  const level = fac[kind] ?? 1;
  if (level >= FACILITY_MAX) return { ok: false, message: "That's as good as it gets." };
  if ((save.builds ?? []).some((b) => b.kind === kind)) {
    return { ok: false, message: "Work is already under way there." };
  }
  const cost = FACILITY_COST[kind];
  if ((fin.balance ?? 0) < cost) {
    return {
      ok: false,
      message: `That costs £${(cost / 1_000_000).toFixed(1)}m — the club has £${((fin.balance ?? 0) / 1_000_000).toFixed(1)}m.`
    };
  }
  fin.balance = (fin.balance ?? 0) - cost;
  save.builds = [
    ...(save.builds ?? []),
    { kind, to: level + 1, weeksLeft: FACILITY_WEEKS[kind], cost }
  ];
  pushNews(save, `Work starts on the ${LABEL[kind].toLowerCase()} — level ${level + 1} in ${FACILITY_WEEKS[kind]} weeks.`);
  return { ok: true, message: `Builders in. Level ${level + 1} in ${FACILITY_WEEKS[kind]} weeks.` };
}

const LABEL: Record<FacilityKind, string> = {
  stadium: "Stadium",
  training: "Training ground",
  youth: "Academy",
  medical: "Medical centre"
};
export function facilityLabel(kind: FacilityKind): string {
  return LABEL[kind];
}

/** A week passes on site. Returns anything that finished. */
export function tickBuilds(save: SaveGame): string[] {
  const done: string[] = [];
  const left: Build[] = [];
  for (const b of save.builds ?? []) {
    const weeksLeft = b.weeksLeft - 1;
    if (weeksLeft > 0) {
      left.push({ ...b, weeksLeft });
      continue;
    }
    const fac = { ...facilitiesOf(save, save.userClubId) };
    fac[b.kind] = Math.min(FACILITY_MAX, b.to);
    save.facilities = { ...(save.facilities ?? {}), [save.userClubId]: fac };
    const line = `${LABEL[b.kind]} upgraded to level ${b.to}.`;
    done.push(line);
    pushNews(save, line);
    pushInbox(save, {
      kind: "club",
      title: `${LABEL[b.kind]} — level ${b.to} ready`,
      body: facilityEffectLine(b.kind, b.to),
      screen: "club"
    });
  }
  save.builds = left;
  return done;
}

/** The numbers behind the club screen. */
export function commercialSummary(save: SaveGame): {
  sponsor: number;
  sponsorName: string | null;
  sponsorUntil: number | null;
  merch: number;
  gate: number;
  upkeep: number;
  net: number;
  balance: number;
  transfer: number;
} {
  const fin = save.finances?.[save.userClubId];
  const sponsor = save.sponsor && save.sponsor.until > save.season ? save.sponsor.weekly : 0;
  const merch = merchWeekly(save);
  const gate = gateReceipts(save);
  const upkeep = upkeepWeekly(facilitiesOf(save, save.userClubId));
  return {
    sponsor,
    sponsorName: save.sponsor?.name ?? null,
    sponsorUntil: save.sponsor?.until ?? null,
    merch,
    gate,
    upkeep,
    net: sponsor + merch - upkeep,
    balance: Math.round(fin?.balance ?? 0),
    transfer: Math.round(fin?.transfer ?? 0)
  };
}

/** Season rollover: the shirt market opens again. */
export function rollSponsor(save: SaveGame): void {
  const deal = save.sponsor;
  if (deal && deal.until > save.season) {
    pushNews(save, `Shirt deal with ${deal.name} runs to season ${deal.until}.`);
    return;
  }
  save.sponsor = undefined;
  save.sponsorOffers = makeSponsorOffers(save);
  pushNews(save, `The shirt is on the market: ${save.sponsorOffers.length} sponsors have been in touch.`);
  pushInbox(save, {
    kind: "club",
    title: "Shirt sponsorship: offers on the table",
    body: `${save.sponsorOffers.map((o) => `${o.name} (£${Math.round(o.weekly / 1000)}k/wk)`).join(" · ")}. Choose on the Club screen.`,
    screen: "club"
  });
}

/** Sign one of the offers. */
export function signSponsor(save: SaveGame, offerId: string): { ok: boolean; message: string } {
  const offer = (save.sponsorOffers ?? []).find((o) => o.id === offerId);
  if (!offer) return { ok: false, message: "That offer is no longer on the table." };
  save.sponsor = {
    name: offer.name,
    weekly: offer.weekly,
    seasons: offer.seasons,
    until: offer.until,
    bonus: offer.bonus
  };
  save.sponsorOffers = [];
  const fin = save.finances?.[save.userClubId];
  if (fin) fin.balance = (fin.balance ?? 0) + offer.bonus;
  pushNews(
    save,
    `${offer.name} are the new shirt sponsors: £${Math.round(offer.weekly / 1000)}k a week to season ${offer.until}, plus a £${(offer.bonus / 1_000_000).toFixed(1)}m signing payment.`
  );
  pushInbox(save, {
    kind: "club",
    title: `Shirt deal signed with ${offer.name}`,
    body: `£${Math.round(offer.weekly / 1000)}k/week until season ${offer.until}.`,
    screen: "club"
  });
  return { ok: true, message: `${offer.name} are on the shirt.` };
}

/** Salary the club's wage bill for the record books (league money covers this). */
export function weeklyWageLine(save: SaveGame): number {
  return wageBill(save as SaveGame & { players: Player[] }, save.userClubId);
}
