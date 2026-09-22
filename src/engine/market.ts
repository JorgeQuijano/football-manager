import type {
  BoardPolicy,
  Debt,
  Player,
  PreContract,
  SaveGame,
  TransferOffer
} from "./types";
import { hashSeed, mulberry32, pick } from "./rng";
import { overallFor, squadOf } from "./ratings";
import { marketValue, money, transferWindow, wageBill, wageDemand, wageHeadroom } from "./transfers";
import { pushNews } from "./training";
import { pushInbox } from "./inbox";

/**
 * The business side of the market: what the board will sanction, what a player
 * is worth in wages, who might be interested, and the money owed to other clubs.
 *
 * Everything is derived or seeded — the same save always produces the same
 * market, and the same answer from the same agent.
 */

// --- the board's policy -----------------------------------------------------------------

interface PolicyDef extends BoardPolicy {
  id: string;
}

const POLICIES: { id: string; label: string }[] = [
  { id: "youth", label: "Youth first — build around the academy" },
  { id: "value", label: "Shop smart — value in the market" },
  { id: "wages", label: "Keep the wage bill in order" },
  { id: "pragmatic", label: "Strengthen the squad by any means" }
];

/** The board's line for a season — deterministic from the save and year. */
export function policyFor(save: Pick<SaveGame, "seed" | "clubs" | "players">, season: number): BoardPolicy {
  const rng = mulberry32(hashSeed(save.seed, "policy", season));
  const sample = save.players.slice(0, 80);
  const basis = sample.reduce((a, p) => a + marketValue(p), 0) / Math.max(1, sample.length);
  const avgWage = sample.reduce((a, p) => a + (p.contract?.wage ?? 0), 0) / Math.max(1, sample.length);
  const def = pick(rng, POLICIES);
  switch (def.id) {
    case "youth":
      // a hard ceiling (the board's identity), plus a soft target the report judges
      return { label: def.label, maxAge: 26, preferAge: 21, maxFee: roundK(basis * 3) };
    case "value":
      return { label: def.label, maxFee: roundK(basis * 2.5) };
    case "wages":
      return { label: def.label, maxWage: Math.round((avgWage * 1.8) / 500) * 500 };
    default:
      return { label: def.label, maxAge: 32, preferAge: 27 };
  }
}

const roundK = (v: number) => Math.round(v / 100_000) * 100_000;

export interface PolicyCheck {
  ok: boolean;
  reason?: string;
}

/** Would the board sanction this signing? Age caps are hard; money targets are judged at the rollover. */
export function policyCheck(
  policy: BoardPolicy | undefined,
  p: Player,
  terms: { fee?: number; wage?: number },
  kind: "sign" | "renew" = "sign"
): PolicyCheck {
  void terms;
  if (!policy) return { ok: true };
  if (kind === "renew") return { ok: true };
  if (policy.maxAge !== undefined && p.age > policy.maxAge) {
    return { ok: false, reason: `The board won't sanction a deal for a ${p.age}-year-old — "${policy.label}".` };
  }
  return { ok: true };
}

/** The board's season-end verdict: a bonus for following the policy, a cut for ignoring it. */
export function policyPayoff(save: SaveGame): void {
  const policy = save.policy;
  const fin = save.finances?.[save.userClubId];
  if (!policy || !fin) return;
  const signings = (save.windowLog ?? []).filter((w) => w.season === save.season - 1);
  if (!signings.length) {
    pushNews(save, `The board note a quiet window — "${policy.label}" still stands.`);
    return;
  }
  const spend = signings.reduce((a, w) => a + w.fee, 0);
  const youngest = signings.reduce((a, w) => Math.min(a, w.age), 99);
  const oldest = signings.reduce((a, w) => Math.max(a, w.age), 0);
  const costly = policy.maxFee !== undefined && signings.some((w) => w.fee > policy.maxFee!);
  const tooOld = policy.preferAge !== undefined && oldest > policy.preferAge + 3;
  const overWage = policy.maxWage !== undefined && signings.some((w) => w.wage > policy.maxWage!);
  const young = policy.preferAge !== undefined ? youngest <= policy.preferAge : true;
  if (!costly && !tooOld && !overWage) {
    const bonus = young ? 900_000 : 600_000;
    fin.transfer += bonus;
    pushInbox(save, { kind: "board", title: `Board pleased: +${money(bonus)}`, body: policy.label, screen: "transfers" });
    pushNews(save, `The board are pleased with the window — ${money(bonus)} added to the budget ("${policy.label}").`);
  } else {
    const cut = 500_000;
    fin.transfer = Math.max(0, fin.transfer - cut);
    pushInbox(save, { kind: "board", title: `Board unhappy: −${money(cut)}`, body: `${policy.label} was not followed.`, screen: "transfers" });
    pushNews(
      save,
      `The board are unconvinced: ${money(spend)} spent${tooOld ? " and the squad got older" : overWage ? " and the wage bill leapt" : ""} — "${policy.label}" was not followed.`
    );
  }
}

// --- budgets ----------------------------------------------------------------------------

/** Move £/week between the transfer budget and the wage ceiling (52 weeks to the year). */
export function reallocate(
  input: SaveGame,
  direction: "toWage" | "toTransfer",
  weekly: number
): { save: SaveGame; resp: { ok: boolean; message: string } } {
  const fin = input.finances[input.userClubId];
  if (!fin) return { save: input, resp: { ok: false, message: "No finances for your club." } };
  const w = Math.max(0, Math.round(weekly));
  if (w === 0) return { save: input, resp: { ok: false, message: "Pick an amount first." } };
  const cash = w * 52;
  if (direction === "toWage" && fin.transfer < cash) {
    return { save: input, resp: { ok: false, message: `You'd need ${money(cash)} of transfer budget for that.` } };
  }
  if (direction === "toTransfer" && fin.wageBudget < w + wageBill(input, input.userClubId)) {
    const spare = Math.max(0, Math.floor(fin.wageBudget - wageBill(input, input.userClubId)));
    return { save: input, resp: { ok: false, message: `Only ${money(spare)}/wk of wage headroom to give up.` } };
  }
  const save = structuredClone(input);
  const f = save.finances[save.userClubId];
  if (direction === "toWage") {
    f.transfer -= cash;
    f.wageBudget += w;
  } else {
    f.transfer += cash;
    f.wageBudget -= w;
  }
  return {
    save,
    resp: {
      ok: true,
      message:
        direction === "toWage"
          ? `Moved ${money(cash)} into the wage budget (+${money(w)}/wk).`
          : `Moved ${money(w)}/wk into the transfer budget (+${money(cash)}).`
    }
  };
}

// --- debts ------------------------------------------------------------------------------

const debtId = (save: SaveGame, i: number) => `db-${save.season}-${save.round}-${i}`;

/** Register money owed to another club (instalments, add-ons). */
export function addDebt(
  save: SaveGame,
  clubId: string,
  amount: number,
  dueSeason: number,
  reason: string,
  playerId?: string
): Debt {
  save.debts = save.debts ?? [];
  const d: Debt = {
    id: debtId(save, save.debts.length),
    clubId,
    amount: Math.round(amount),
    dueSeason,
    reason,
    ...(playerId ? { playerId } : {})
  };
  save.debts.push(d);
  return d;
}

/** Pay everything due this season (called at the rollover). */
export function settleDebts(save: SaveGame): void {
  const debts = save.debts ?? [];
  if (!debts.length) return;
  const fin = save.finances[save.userClubId];
  let paid = 0;
  const keep: Debt[] = [];
  for (const d of debts) {
    if (d.addonApps) {
      keep.push(d); // add-ons are paid when the appearances land, not by date
      continue;
    }
    if (d.dueSeason <= save.season) {
      if (fin) fin.transfer = Math.max(0, fin.transfer - d.amount);
      paid += d.amount;
    } else {
      keep.push(d);
    }
  }
  if (paid > 0) pushNews(save, `Instalments and add-ons: ${money(paid)} paid to other clubs.`);
  save.debts = keep;
}

/** Transfer add-ons: pay out once the player has made the agreed appearances. */
export function payTransferAddons(save: SaveGame): void {
  const fin = save.finances[save.userClubId];
  const debts = save.debts ?? [];
  if (!fin || !debts.length) return;
  const keep: Debt[] = [];
  let paid = 0;
  for (const d of debts) {
    const p = d.playerId ? save.players.find((x) => x.id === d.playerId) : undefined;
    const due = d.addonApps !== undefined && (!p || p.clubId !== save.userClubId || (p.apps ?? 0) >= d.addonApps);
    if (d.addonApps !== undefined && due) {
      fin.transfer = Math.max(0, fin.transfer - d.amount);
      paid += d.amount;
      const club = save.clubs.find((c) => c.id === d.clubId);
      pushNews(save, `Add-on paid: ${money(d.amount)} to ${club?.short ?? "his old club"} — ${p?.name ?? "the player"} hit ${d.addonApps} appearances.`);
    } else {
      keep.push(d);
    }
  }
  if (paid > 0) save.debts = keep;
}

/** Appearance add-ons that have come due (checked at the rollover). */
export function payAddons(save: SaveGame): void {
  const fin = save.finances[save.userClubId];
  if (!fin) return;
  let total = 0;
  for (const p of save.players) {
    if (p.clubId !== save.userClubId) continue;
    const c = p.contract;
    const apps = p.apps ?? 0;
    const goals = p.goals ?? 0;
    if (c.perApp) total += c.perApp * apps;
    if (c.perGoal) total += c.perGoal * goals;
  }
  if (total > 0) {
    fin.transfer = Math.max(0, fin.transfer - total);
    pushNews(save, `Contract bonuses paid out this season: ${money(total)}.`);
  }
}

/** A sell-on cut owed to a previous club, paid when you sell the player. */
export function paySellOn(save: SaveGame, p: Player, fee: number): number {
  const cut = p.sellOnTo ? Math.round((fee * p.sellOnTo.pct) / 100) : 0;
  if (cut > 0 && save.finances[save.userClubId]) {
    save.finances[save.userClubId].transfer = Math.max(0, save.finances[save.userClubId].transfer - cut);
    const club = save.clubs.find((c) => c.id === p.sellOnTo!.clubId);
    pushNews(save, `Sell-on clause: ${money(cut)} of the ${p.name} fee goes to ${club?.short ?? "his old club"}.`);
  }
  return cut;
}

/** Log a completed signing so the board can judge the window. */
export function noteSigning(save: SaveGame, p: Player, fee: number): void {
  save.windowLog = save.windowLog ?? [];
  save.windowLog.push({ season: save.season, playerId: p.id, age: p.age, wage: p.contract.wage, fee });
  if (save.windowLog.length > 60) save.windowLog.splice(0, save.windowLog.length - 60);
}

/** Take up the club option in a contract (one-shot). */
export function triggerExtension(input: SaveGame, playerId: string): { save: SaveGame; resp: { ok: boolean; message: string } } {
  const p = input.players.find((x) => x.id === playerId);
  const years = p?.contract.extensionYears ?? 0;
  if (!p || p.clubId !== input.userClubId || years <= 0) {
    return { save: input, resp: { ok: false, message: "There's no option to trigger." } };
  }
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  pp.contract = { ...pp.contract, until: pp.contract.until + years, extensionYears: undefined };
  save.transferLog.unshift(
    `R${save.round}: you trigger the extension in ${pp.name}'s deal (+${years} season${years > 1 ? "s" : ""}).`
  );
  if (save.transferLog.length > 40) save.transferLog.length = 40;
  pushNews(save, `${pp.name}'s contract is extended to the end of season ${pp.contract.until}.`);
  return { save, resp: { ok: true, message: `${pp.name} stays until season ${pp.contract.until}.` } };
}

// --- listing & interest -----------------------------------------------------------------

const listLog = (save: SaveGame, line: string) => {
  save.transferLog.unshift(line);
  if (save.transferLog.length > 40) save.transferLog.length = 40;
};

/** Put a player on the market (or take him off it). */
export function setListed(input: SaveGame, playerId: string, listed: boolean): SaveGame {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) return input;
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  pp.transferListed = listed;
  if (listed) {
    pp.morale = Math.max(5, (pp.morale ?? 60) - 4);
    listLog(save, `R${save.round}: ${pp.name} is available for transfer.`);
    pushNews(save, `${pp.name} has been told he can find a new club.`);
  } else {
    listLog(save, `R${save.round}: ${pp.name} is off the market.`);
  }
  return save;
}

export interface AgentInterest {
  level: "none" | "some" | "strong";
  clubs: number;
  bestClubId?: string;
  line: string;
}

/** What would his agent find out there? Deterministic from the save. */
export function askAgent(save: SaveGame, playerId: string): AgentInterest {
  const p = save.players.find((x) => x.id === playerId);
  if (!p) return { level: "none", clubs: 0, line: "That player doesn't exist." };
  const value = marketValue(p);
  const wage = p.contract?.wage ?? wageDemand(p);
  const candidates = save.clubs
    .filter((c) => c.id !== (p.clubId || undefined) && c.id !== save.userClubId)
    .map((c) => ({ c, fin: save.finances[c.id] }))
    .filter(({ fin }) => fin && fin.transfer >= value * 0.6)
    .filter(({ c }) => {
      const squad = squadOf(save.players, c.id);
      const avg = squad.length ? squad.reduce((s, x) => s + overallFor(x), 0) / squad.length : 50;
      return overallFor(p) > avg - 3;
    })
    .map(({ c, fin }) => ({ id: c.id, score: overallFor(p) - (fin.transfer / Math.max(1, value)) * 2 }));
  candidates.sort((a, b) => b.score - a.score);
  const clubs = candidates.length;
  const level: AgentInterest["level"] = clubs === 0 ? "none" : clubs <= 2 ? "some" : "strong";
  const best = candidates[0]?.id;
  const bestClub = best ? save.clubs.find((c) => c.id === best) : undefined;
  const priceHint = value * (p.transferListed ? 0.9 : 1.05);
  const line =
    clubs === 0
      ? `${p.name}'s agent has found nothing — nobody is shopping at ${money(wage)}/wk.`
      : `${clubs} club${clubs === 1 ? "" : "s"} would be interested, led by ${bestClub?.short}. Expect around ${money(Math.round(priceHint / 10_000) * 10_000)}.`;
  return { level, clubs, bestClubId: best, line };
}

/** Interest table for the whole squad (used by the transfer screen). */
export function listedPlayers(save: SaveGame): Player[] {
  return squadOf(save.players, save.userClubId).filter((p) => p.transferListed);
}

// --- pre-contracts (Bosman) ---------------------------------------------------------------

/** The winter window is when you can talk to players in their final year. */
export const canPreContract = (save: Pick<SaveGame, "round" | "clubs">): boolean => transferWindow(save).kind === "winter";

export function preContractTargets(save: SaveGame): Player[] {
  return save.players
    .filter(
      (p) =>
        p.clubId !== "" &&
        p.clubId !== save.userClubId &&
        p.contract.until <= save.season &&
        !isPreContracted(save, p.id)
    )
    .sort((a, b) => overallFor(b) - overallFor(a));
}

export const isPreContracted = (save: SaveGame, playerId: string): boolean =>
  (save.preContracts ?? []).some((pc) => pc.playerId === playerId);

/** Agree terms with a player whose deal expires — he joins for free at the rollover. */
export function offerPreContract(
  input: SaveGame,
  playerId: string,
  wage: number,
  years: number
): { save: SaveGame; resp: { ok: boolean; message: string } } {
  if (!canPreContract(input)) {
    return { save: input, resp: { ok: false, message: "You can only talk to players in their final year during the winter window." } };
  }
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId === "" || p.clubId === input.userClubId) {
    return { save: input, resp: { ok: false, message: "He isn't a target." } };
  }
  if (p.contract.until > input.season) {
    return { save: input, resp: { ok: false, message: "His contract doesn't run out this season." } };
  }
  if (isPreContracted(input, playerId)) {
    return { save: input, resp: { ok: false, message: "He has already agreed terms elsewhere." } };
  }
  const check = policyCheck(input.policy, p, { wage });
  if (!check.ok) return { save: input, resp: { ok: false, message: check.reason! } };
  const headroom = wageHeadroom(input, input.userClubId);
  if (wage > headroom + (p.contract.wage ?? 0)) {
    return { save: input, resp: { ok: false, message: `No wage headroom for ${money(wage)}/wk.` } };
  }
  const rng = mulberry32(hashSeed(input.seed, "pre", playerId, wage, years));
  const want = wageDemand(p) * 1.08 * (0.97 + rng() * 0.08); // a free transfer costs a little more in wages
  if (wage < want * 0.95) {
    return { save: input, resp: { ok: false, message: `He wants around ${money(Math.round(want / 100) * 100)}/wk to sign on a free.` } };
  }
  const save = structuredClone(input);
  save.preContracts = save.preContracts ?? [];
  const pc: PreContract = {
    id: `pc-${save.season}-${save.preContracts.length}`,
    playerId,
    clubId: save.userClubId,
    wage: Math.round(wage / 100) * 100,
    years,
    season: save.season
  };
  save.preContracts.push(pc);
  noteSigning(save, p, 0);
  listLog(save, `R${save.round}: ${p.name} agrees to join you on a free transfer at the end of the season.`);
  pushNews(save, `${p.name} will join on a free transfer when his contract expires.`);
  return { save, resp: { ok: true, message: `${p.name} signs a pre-contract — he arrives in pre-season.` } };
}

/** Cancel an agreement you no longer want. */
export function cancelPreContract(input: SaveGame, playerId: string): SaveGame {
  const save = structuredClone(input);
  save.preContracts = (save.preContracts ?? []).filter((pc) => pc.playerId !== playerId);
  return save;
}

/**
 * Pre-season: agreed free transfers arrive, and AI clubs poach your expiring
 * players if you let their deals run down.
 */
export function applyPreContracts(save: SaveGame): void {
  const pcs = save.preContracts ?? [];
  for (const pc of pcs) {
    const p = save.players.find((x) => x.id === pc.playerId);
    if (!p) continue;
    const from = save.clubs.find((c) => c.id === p.clubId);
    p.clubId = pc.clubId;
    p.contract = { wage: pc.wage, until: save.season + pc.years };
    p.morale = Math.max(5, (p.morale ?? 60) + 2);
    if (pc.clubId === save.userClubId) {
      pushNews(save, `${p.name} arrives from ${from?.short ?? "his old club"} on a free transfer.`);
    } else if (from?.id === save.userClubId) {
      pushNews(save, `${p.name} leaves on a free transfer to ${save.clubs.find((c) => c.id === pc.clubId)?.short}.`);
    }
  }
  save.preContracts = [];
}

/**
 * During the winter window AI clubs circle your players who are into their
 * final year — a warning shot to get them signed up.
 */
export function poachTick(save: SaveGame): void {
  if (!canPreContract(save)) return;
  const expiring = squadOf(save.players, save.userClubId).filter((p) => p.contract.until <= save.season);
  if (!expiring.length) return;
  const rng = mulberry32(hashSeed(save.seed, "poach", save.season, save.round));
  for (const p of expiring) {
    if (isPreContracted(save, p.id)) continue;
    if (rng() > 0.35) continue;
    const suitors = save.clubs
      .filter((c) => c.id !== save.userClubId)
      .filter((c) => {
        const squad = squadOf(save.players, c.id);
        const avg = squad.length ? squad.reduce((s, x) => s + overallFor(x), 0) / squad.length : 50;
        return overallFor(p) >= avg - 4;
      });
    if (!suitors.length) continue;
    const club = pick(rng, suitors);
    const wage = Math.round((wageDemand(p) * (1.02 + rng() * 0.12)) / 100) * 100;
    save.preContracts = save.preContracts ?? [];
    save.preContracts.push({
      id: `pc-ai-${save.season}-${save.round}-${p.id}`,
      playerId: p.id,
      clubId: club.id,
      wage,
      years: 3,
      season: save.season
    });
    pushNews(save, `${club.short} are talking to ${p.name} — his deal expires in the summer. Renew or lose him for free.`);
  }
}

/** Offers on the table for the user's players — loan offers included. */
export const offersFor = (save: SaveGame, playerId: string): TransferOffer[] =>
  (save.offers ?? []).filter((o) => o.playerId === playerId);
