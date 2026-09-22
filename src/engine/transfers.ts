import type { Contract, DealTerms, Finances, Player, SaveGame, TransferOffer } from "./types";
import { hashSeed, mulberry32, pick, randInt, type Rng } from "./rng";
import { fixLineup, overallFor, squadOf } from "./ratings";
import { peakFor, pushNews } from "./training";
import { addDebt, noteSigning, paySellOn, poachTick, policyCheck } from "./market";
import { pushInbox } from "./inbox";
import { loanOutTick, sendOnLoan } from "./loans";
import { builtinFormation, resolveFormation } from "./formations";

/**
 * Transfers, contracts & wages.
 *
 * The economy is deliberately simple but internally consistent:
 *   value  = ((overall − 40)^2.8 × £150) × ageFactor   (peaks 22–27, decays after)
 *   wage   = ((overall − 40)^1.7 × £12) per week
 *   budget = 25% of squad value + £1m base, refreshed every season
 *
 * Deals are two-step like FM: agree a fee with the club, then agree personal
 * terms with the player. Every decision (AI churn, incoming bids, counters) is
 * seeded from (save.seed, round/season, player) so the world is deterministic:
 * the same save always produces the same transfer history.
 *
 * Transfer windows map onto our 18-round season:
 *   summer — rounds 1–3     winter — rounds 9–10
 */

export const TF = {
  valueBase: 150,
  valuePow: 2.8,
  valuePivot: 40,
  wagePow: 1.7,
  wageMult: 120,
  minFee: 10_000,
  minWage: 300,
  budgetBase: 1_000_000,
  budgetValueShare: 0.25,
  wageBudgetMult: 1.25,
  renewalProb: 0.85,
  freeAgentsPerSeason: 5,
  summer: [1, 3] as [number, number],
  winter: [9, 10] as [number, number],
  logCap: 40,
  /** spread a fee over N seasons and the seller wants more of it */
  instalmentDiscount: 0.08,
  /** what an appearance add-on is worth to the seller (per £ of it) */
  addonValue: 0.55,
  /** what a sell-on clause is worth to the seller (per % of value) */
  sellOnValue: 0.5,
  /** the agent takes a slice of the signing bonus and the first quarter */
  agentFeeShare: 0.05,
  maxInstalments: 3,
  maxSellOn: 30
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);

/** £1.24m / £850k / £12k — display + log formatting. */
export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  const trim = (v: number, d: number) => {
    const s = v.toFixed(d);
    return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  };
  if (a >= 10_000_000) return `${sign}£${Math.round(a / 1_000_000)}m`;
  if (a >= 1_000_000) return `${sign}£${trim(a / 1_000_000, 2)}m`;
  if (a >= 1_000) return `${sign}£${trim(a / 1_000, 1)}k`;
  return `${sign}£${Math.round(a)}`;
}

const ageFactor = (age: number) =>
  age <= 21 ? 1.05 : age <= 27 ? 1 : Math.max(0.1, 1 - (age - 27) * 0.14);

/** What a club would expect to pay for this player (£), rounded to £10k. */
export function marketValue(p: Player): number {
  const ovr = overallFor(p);
  const v = Math.pow(Math.max(0, ovr - TF.valuePivot), TF.valuePow) * TF.valueBase * ageFactor(p.age);
  return Math.max(TF.minFee, roundTo(v, 10_000));
}

/** What this player wants per week (£), rounded to £100. */
export function wageDemand(p: Player): number {
  const ovr = overallFor(p);
  const w = Math.pow(Math.max(1, ovr - TF.valuePivot), TF.wagePow) * TF.wageMult;
  return Math.max(TF.minWage, roundTo(w, 100));
}

/** A fresh contract for a player at generation time (deterministic per id). */
export function contractFor(p: Player, season: number): Contract {
  const h = hashSeed(p.id, "contract");
  // roughly one player in twelve is in the last year of his deal — the Bosman market
  if (h % 12 === 0) return { wage: wageDemand(p), until: season };
  return { wage: wageDemand(p), until: season + 2 + (h % 3) };
}

export function wageBill(save: SaveGame, clubId: string): number {
  let sum = 0;
  for (const p of save.players) {
    const wage = p.contract?.wage ?? 0;
    if (p.clubId === clubId) {
      // a loanee in: we only pay our agreed share
      sum += p.loan && p.loan.fromClubId !== clubId ? wage * p.loan.wageShare : wage;
    } else if (p.loan && p.loan.fromClubId === clubId) {
      // a player we've loaned out: we cover whatever the borrowers don't
      sum += wage * (1 - p.loan.wageShare);
    }
  }
  return sum;
}

export function squadValue(save: SaveGame, clubId: string): number {
  let sum = 0;
  for (const p of save.players) if (p.clubId === clubId) sum += marketValue(p);
  return sum;
}

export function wageHeadroom(save: SaveGame, clubId: string): number {
  const f = save.finances?.[clubId];
  return (f?.wageBudget ?? 0) - wageBill(save, clubId);
}

/** Season budgets for every club, from squad value / current wage bill. */
export function freshFinances(save: Pick<SaveGame, "clubs" | "players">): Record<string, Finances> {
  const out: Record<string, Finances> = {};
  const stub = save as SaveGame;
  for (const c of save.clubs) {
    const value = squadValue(stub, c.id);
    const bill = wageBill(stub, c.id);
    out[c.id] = {
      transfer: Math.max(500_000, roundTo(value * TF.budgetValueShare + TF.budgetBase, 100_000)),
      wageBudget: Math.max(5_000, roundTo(bill * TF.wageBudgetMult, 1_000))
    };
  }
  return out;
}

/** Is a window open right now, and what should the UI say? */
export function transferWindow(save: Pick<SaveGame, "round" | "clubs">): {
  open: boolean;
  label: string;
  kind: "summer" | "winter" | "closed";
} {
  const r = save.round;
  const rounds = (save.clubs.length - 1) * 2;
  if (r >= TF.summer[0] && r <= TF.summer[1])
    return { open: true, kind: "summer", label: `Summer window · closes after round ${TF.summer[1]}` };
  if (r >= TF.winter[0] && r <= TF.winter[1])
    return { open: true, kind: "winter", label: `Winter window · rounds ${TF.winter[0]}–${TF.winter[1]}` };
  const next =
    r < TF.summer[0] || r > TF.winter[1]
      ? r > TF.winter[1]
        ? `opens pre-season (round ${TF.summer[0]} of a new season)`
        : `opens round ${TF.summer[0]}`
      : `opens round ${TF.winter[0]}`;
  return { open: false, kind: "closed", label: `Window closed · ${next}` };
}

export interface BidResponse {
  kind: "accepted" | "counter" | "rejected";
  fee?: number;
  wage?: number;
  message: string;
  /** a counter-offer's wage-share demand (loans) */
  share?: number;
}

const resp = (kind: BidResponse["kind"], message: string, extra?: { fee?: number; wage?: number; share?: number }): BidResponse => ({
  kind,
  message,
  ...(extra ?? {})
});

const rngFor = (save: SaveGame, tag: string, ...parts: (string | number)[]): Rng =>
  mulberry32(hashSeed(save.seed, tag, save.season, ...parts));

const logLine = (save: SaveGame, line: string) => {
  save.transferLog.unshift(line);
  if (save.transferLog.length > TF.logCap) save.transferLog.length = TF.logCap;
};

const userFix = (save: SaveGame) => {
  const def = resolveFormation(save.lineup.formation, save.customFormations) ?? builtinFormation("4-3-3");
  save.lineup = fixLineup(squadOf(save.players, save.userClubId), save.lineup, def);
};

/** How reluctant is the seller? Rank 1-2 in their squad = they'd rather keep him. */
function sellerAppetite(save: SaveGame, p: Player): number {
  const mates = squadOf(save.players, p.clubId).slice().sort((a, b) => overallFor(b) - overallFor(a));
  const rank = mates.findIndex((m) => m.id === p.id);
  if (rank <= 1) return 1.35;
  if (rank <= 5) return 1.1;
  if (rank >= 11) return 0.85;
  return 1;
}

/** What the player's agent makes of a set of terms (before the mood dice). */
export function termsDemand(p: Player, t: ContractTerms, base: number): number {
  const years = Math.max(1, Math.min(5, t.years ?? 3));
  const ageLoad = p.age >= 30 ? 0.02 : -0.012; // older legs want paying for the security
  const length = 1 + ageLoad * (years - 2);
  const bonusRelief = t.signingBonus ? Math.min(0.06, t.signingBonus / (base * 52 * 6)) : 0;
  const goalRelief = t.perGoal ? Math.min(0.06, (t.perGoal / 4000) * 0.012) : 0;
  const appRelief = t.perApp ? Math.min(0.05, (t.perApp / 1500) * 0.008) : 0;
  const clauseRelief = t.releaseClause && t.releaseClause <= marketValue(p) * 1.6 ? 0.05 : 0;
  const relief = Math.min(0.18, bonusRelief + goalRelief + appRelief + clauseRelief);
  const optionLoad = t.extensionYears ? 0.02 : 0; // a club option costs him a little
  return base * length * (1 - relief) * (1 + optionLoad);
}

/** What a structured deal is worth to the selling club. */
export function dealValue(p: Player, terms: DealTerms): number {
  const inst = Math.max(1, Math.min(TF.maxInstalments, terms.instalments ?? 1));
  const cash = terms.fee * (1 - TF.instalmentDiscount * (inst - 1));
  const addon = terms.addon ? terms.addon.amount * TF.addonValue * (p.age <= 24 ? 1.35 : 1) : 0;
  const sellOn = terms.sellOn ? (terms.sellOn / 100) * marketValue(p) * TF.sellOnValue : 0;
  return cash + addon + sellOn;
}

export interface ContractTerms {
  wage: number;
  years?: number;
  signingBonus?: number;
  perApp?: number;
  perGoal?: number;
  releaseClause?: number;
  extensionYears?: number;
}

const normTerms = (t: number | DealTerms | undefined): DealTerms =>
  typeof t === "number" ? { fee: t } : t ?? { fee: 0 };

/** What a deal costs today, and what it costs in total. */
export function dealCost(terms: DealTerms): { now: number; total: number } {
  const inst = Math.max(1, Math.min(TF.maxInstalments, terms.instalments ?? 1));
  const now = Math.round(terms.fee / inst);
  return { now, total: terms.fee + (terms.addon?.amount ?? 0) };
}

/** Step 1: bid for another club's player — cash, instalments, add-ons, sell-on. */
export function bidForPlayer(
  input: SaveGame,
  playerId: string,
  offer: number | DealTerms
): { save: SaveGame; resp: BidResponse } {
  const terms = normTerms(offer);
  const p = input.players.find((x) => x.id === playerId);
  const fail = (m: string) => ({ save: input, resp: resp("rejected", m) });
  if (!p || p.clubId === "" || p.clubId === input.userClubId) return fail("He isn't available.");
  if (p.loan) return fail("He is out on loan — you'd have to wait for him to come back.");
  const win = transferWindow(input);
  if (!win.open) return fail(`The transfer window is closed — ${win.label}.`);
  const fin = input.finances[input.userClubId];
  const maxFee = Math.max(0, fin?.transfer ?? 0);
  const { now, total } = dealCost(terms);
  if (now > maxFee) {
    return fail(`That needs ${money(now)} up front — more than your transfer budget (${money(maxFee)}).`);
  }
  if (terms.fee <= 0) return fail("Enter a realistic fee.");
  const check = policyCheck(input.policy, p, { fee: total });
  if (!check.ok) return fail(check.reason!);

  const value = marketValue(p);
  const rng = rngFor(input, "bid", playerId, terms.fee, terms.instalments ?? 1, terms.addon?.amount ?? 0, terms.sellOn ?? 0);
  const ask = value * sellerAppetite(input, p) * (0.92 + rng() * 0.16);
  const offered = dealValue(p, terms);

  if (offered >= ask * 1.02) {
    const save = structuredClone(input);
    save.pending = { playerId, fee: terms.fee, fromClubId: p.clubId, terms };
    const seller = save.clubs.find((c) => c.id === p.clubId)!;
    const structure = (terms.instalments ?? 1) > 1 ? ` over ${terms.instalments} seasons` : "";
    return {
      save,
      resp: resp("accepted", `${seller.short} accept ${money(terms.fee)}${structure}. Agree personal terms to finish the deal.`)
    };
  }
  if (offered >= ask * 0.82) {
    const counter = roundTo(ask * 1.05, 10_000);
    return {
      save: input,
      resp: resp("counter", `They want more — around ${money(counter)} in cash, or sweeten it with add-ons.`, { fee: counter })
    };
  }
  return fail("They laughed it off — that offer is miles off.");
}

/** Step 3 (after the fee): agree personal terms. Completes the transfer. */
export function agentFeeFor(wage: number, signingBonus = 0): number {
  return Math.round((signingBonus + wage * 13) * TF.agentFeeShare);
}

export function offerTerms(
  input: SaveGame,
  playerId: string,
  offer: number | ContractTerms
): { save: SaveGame; resp: BidResponse } {
  const t: ContractTerms = typeof offer === "number" ? { wage: offer } : offer;
  const pd = input.pending;
  if (!pd || pd.playerId !== playerId) {
    return { save: input, resp: resp("rejected", "No fee has been agreed for this player yet.") };
  }
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId === "" ) return { save: input, resp: resp("rejected", "He isn't available.") };
  const demand = termsDemand(p, t, wageDemand(p));
  const rng = rngFor(input, "terms", playerId, t.wage, t.years ?? 3, t.signingBonus ?? 0);
  const want = demand * (0.98 + rng() * 0.08);
  const headroom = wageHeadroom(input, input.userClubId);
  if (t.wage > headroom) {
    return {
      save: input,
      resp: resp("rejected", `Wage budget won't stretch — ${money(Math.max(0, headroom))}/wk of headroom left.`)
    };
  }
  if (t.wage >= want * 1.02) {
    const save = structuredClone(input);
    const pp = save.players.find((x) => x.id === playerId)!;
    const sellerId = pp.clubId;
    const seller = save.clubs.find((c) => c.id === sellerId)!;
    const terms = pd.terms ?? { fee: pd.fee };
    const inst = Math.max(1, Math.min(TF.maxInstalments, terms.instalments ?? 1));
    const signingBonus = Math.max(0, Math.round(t.signingBonus ?? 0));
    const agentFee = agentFeeFor(t.wage, signingBonus);
    const firstInstalment = Math.round(terms.fee / inst);
    const cashNow = firstInstalment + signingBonus + agentFee;
    if (cashNow > save.finances[save.userClubId].transfer) {
      return { save: input, resp: resp("rejected", `That needs ${money(cashNow)} today (fee share, bonus and agent fee).`) };
    }
    pp.clubId = save.userClubId;
    pp.loan = undefined;
    pp.transferListed = undefined;
    pp.contract = {
      wage: roundTo(t.wage, 100),
      until: save.season + Math.max(1, Math.min(5, t.years ?? 3)),
      ...(signingBonus ? { signingBonus } : {}),
      ...(t.perApp ? { perApp: t.perApp } : {}),
      ...(t.perGoal ? { perGoal: t.perGoal } : {}),
      ...(t.releaseClause ? { releaseClause: t.releaseClause } : {}),
      ...(t.extensionYears ? { extensionYears: t.extensionYears } : {})
    };
    if (terms.sellOn) pp.sellOnTo = { clubId: sellerId, pct: Math.min(TF.maxSellOn, terms.sellOn) };
    save.finances[save.userClubId].transfer -= cashNow;
    if (save.finances[sellerId]) save.finances[sellerId].transfer += terms.fee;
    for (let i = 1; i < inst; i++) {
      addDebt(save, sellerId, firstInstalment, save.season + i, `Instalment ${i + 1}/${inst} for ${pp.name}`, pp.id);
    }
    if (terms.addon) {
      addDebt(save, sellerId, terms.addon.amount, save.season + 1, `Add-on: ${terms.addon.apps} appearances for ${pp.name}`, pp.id)
        .addonApps = terms.addon.apps;
    }
    const structure = inst > 1 ? `, ${money(firstInstalment)} now and the rest over ${inst - 1} season${inst > 2 ? "s" : ""}` : "";
    noteSigning(save, pp, terms.fee);
    logLine(
      save,
      `R${save.round}: You sign ${pp.name} from ${seller.short} for ${money(terms.fee)}${structure} (${money(pp.contract.wage)}/wk to season ${pp.contract.until}${signingBonus ? `, ${money(signingBonus)} signing bonus` : ""}).`
    );
    save.pending = undefined;
    save.offers = save.offers.filter((o) => o.playerId !== playerId); // rivals drop out
    userFix(save);
    return { save, resp: resp("accepted", `${pp.name} signs! ${money(pp.contract.wage)}/wk until the end of season ${pp.contract.until}.`) };
  }
  if (t.wage >= want * 0.88) {
    return { save: input, resp: resp("counter", `He wants ${money(roundTo(want, 100))}/wk on those terms.`, { wage: roundTo(want, 100) }) };
  }
  return { save: input, resp: resp("rejected", "He was insulted by that — offer something serious.") };
}

/** Renew one of your own players (allowed any time, not just windows). */
export function renewContract(
  input: SaveGame,
  playerId: string,
  offer: number | ContractTerms
): { save: SaveGame; resp: BidResponse } {
  const t: ContractTerms = typeof offer === "number" ? { wage: offer } : offer;
  const wage = t.wage;
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) return { save: input, resp: resp("rejected", "He's not your player.") };
  const demand = termsDemand(p, t, wageDemand(p)) * 0.95; // renewal discount
  const morale = p.morale ?? 60;
  // an unhappy player won't sit down at all unless you make it worth his while
  if (morale < 30 && wage < wageDemand(p) * 1.3) {
    return {
      save: input,
      resp: resp(
        "rejected",
        `${p.name} won't discuss terms — he's too unhappy with how things are going. Fix his mood (minutes, praise), or offer silly money.`
      )
    };
  }
  const goodFaith = morale >= 75 ? 0.92 : morale < 40 ? 1.08 : 1; // happy players sign cheaper
  const rng = rngFor(input, "renew", playerId, wage);
  const want = demand * (0.97 + rng() * 0.06) * goodFaith;
  const extra = wage - (p.contract?.wage ?? 0);
  const headroom = wageHeadroom(input, input.userClubId);
  if (extra > headroom + 1) {
    return {
      save: input,
      resp: resp("rejected", `Wage budget won't stretch — ${money(Math.max(0, headroom))}/wk of headroom left.`)
    };
  }
  if (wage >= want * 1.02) {
    const save = structuredClone(input);
    const pp = save.players.find((x) => x.id === playerId)!;
    const years = Math.max(1, Math.min(5, t.years ?? 3));
    pp.contract = {
      wage: roundTo(wage, 100),
      until: save.season + years,
      ...(t.signingBonus ? { signingBonus: t.signingBonus } : {}),
      ...(t.perApp ? { perApp: t.perApp } : {}),
      ...(t.perGoal ? { perGoal: t.perGoal } : {}),
      ...(t.releaseClause ? { releaseClause: t.releaseClause } : {}),
      ...(t.extensionYears ? { extensionYears: t.extensionYears } : {})
    };
    if (t.signingBonus) {
      save.finances[save.userClubId].transfer = Math.max(0, save.finances[save.userClubId].transfer - t.signingBonus);
    }
    logLine(
      save,
      `R${save.round}: ${pp.name} signs a new deal (${money(pp.contract.wage)}/wk to season ${pp.contract.until}${t.releaseClause ? `, ${money(t.releaseClause)} release clause` : ""}).`
    );
    return { save, resp: resp("accepted", `${pp.name} commits until the end of season ${pp.contract.until}.`) };
  }
  if (wage >= want * 0.86) {
    return { save: input, resp: resp("counter", `His agent wants ${money(roundTo(want, 100))}/wk.`, { wage: roundTo(want, 100) }) };
  }
  return { save: input, resp: resp("rejected", "Not close — his agent won't even discuss it.") };
}

/** Sign a free agent (window must be open; fee is zero). */
export function signFreeAgent(
  input: SaveGame,
  playerId: string,
  offer: number | ContractTerms
): { save: SaveGame; resp: BidResponse } {
  const t: ContractTerms = typeof offer === "number" ? { wage: offer } : offer;
  const wage = t.wage;
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== "") return { save: input, resp: resp("rejected", "He's not a free agent.") };
  const win = transferWindow(input);
  if (!win.open) return { save: input, resp: resp("rejected", `The transfer window is closed — ${win.label}.`) };
  const check = policyCheck(input.policy, p, { wage });
  if (!check.ok) return { save: input, resp: resp("rejected", check.reason!) };
  const demand = termsDemand(p, t, wageDemand(p)) * 1.05; // free agents hold out a little
  const rng = rngFor(input, "free", playerId, wage);
  const want = demand * (0.98 + rng() * 0.1);
  const headroom = wageHeadroom(input, input.userClubId);
  if (wage > headroom) {
    return {
      save: input,
      resp: resp("rejected", `Wage budget won't stretch — ${money(Math.max(0, headroom))}/wk of headroom left.`)
    };
  }
  if (wage >= want * 1.02) {
    const save = structuredClone(input);
    const pp = save.players.find((x) => x.id === playerId)!;
    pp.clubId = save.userClubId;
    const years = Math.max(1, Math.min(5, t.years ?? 2));
    pp.contract = {
      wage: roundTo(wage, 100),
      until: save.season + years,
      ...(t.signingBonus ? { signingBonus: t.signingBonus } : {}),
      ...(t.perApp ? { perApp: t.perApp } : {}),
      ...(t.perGoal ? { perGoal: t.perGoal } : {}),
      ...(t.releaseClause ? { releaseClause: t.releaseClause } : {}),
      ...(t.extensionYears ? { extensionYears: t.extensionYears } : {})
    };
    if (t.signingBonus) {
      save.finances[save.userClubId].transfer = Math.max(0, save.finances[save.userClubId].transfer - t.signingBonus);
    }
    noteSigning(save, pp, 0);
    logLine(save, `R${save.round}: You sign free agent ${pp.name} (${money(pp.contract.wage)}/wk to season ${pp.contract.until}).`);
    userFix(save);
    return { save, resp: resp("accepted", `${pp.name} joins on a free transfer!`) };
  }
  if (wage >= want * 0.88) {
    return { save: input, resp: resp("counter", `He wants ${money(roundTo(want, 100))}/wk.`, { wage: roundTo(want, 100) }) };
  }
  return { save: input, resp: resp("rejected", "Way short — he'll wait for a better offer.") };
}

/** Accept an incoming offer for one of your players. */
export function acceptOffer(input: SaveGame, offerId: string): { save: SaveGame; resp: BidResponse } {
  const o = input.offers.find((x) => x.id === offerId);
  if (!o) return { save: input, resp: resp("rejected", "That offer is gone.") };
  const p = input.players.find((x) => x.id === o.playerId);
  if (!p || p.clubId !== input.userClubId) return { save: input, resp: resp("rejected", "He's no longer your player.") };
  if (p.loan) return { save: input, resp: resp("rejected", "He is on loan — you can't sell him until it ends.") };

  // a loan offer: he goes out for the season
  if (o.kind === "loan" && o.loan) {
    const save = sendOnLoan(input, o.playerId, o.fromClubId, o.loan);
    save.offers = save.offers.filter((x) => x.id !== o.id);
    userFix(save);
    const club = save.clubs.find((c) => c.id === o.fromClubId)!;
    return { save, resp: resp("accepted", `${p.name} joins ${club.short} on loan for the season.`) };
  }

  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === o.playerId)!;
  const buyer = save.clubs.find((c) => c.id === o.fromClubId)!;
  const rng = rngFor(input, "sold", o.playerId);
  pp.clubId = o.fromClubId;
  pp.loan = undefined;
  pp.transferListed = undefined;
  pp.contract = { wage: wageDemand(pp), until: save.season + 2 + Math.floor(rng() * 3) };
  save.finances[save.userClubId].transfer += o.fee;
  if (save.finances[o.fromClubId]) save.finances[o.fromClubId].transfer = Math.max(0, save.finances[o.fromClubId].transfer - o.fee);
  logLine(
    save,
    `R${save.round}: ${buyer.short} sign ${pp.name} from you for ${money(o.fee)}${o.clause ? " (release clause)" : ""}.`
  );
  // a clause we promised a previous club pays out of this sale
  if (pp.sellOnTo) {
    paySellOn(save, pp, o.fee);
    pp.sellOnTo = undefined;
  }
  save.offers = save.offers.filter((x) => x.playerId !== o.playerId);
  if (save.pending?.playerId === o.playerId) save.pending = undefined;
  userFix(save);
  return { save, resp: resp("accepted", `${pp.name} joins ${buyer.short} for ${money(o.fee)}.`) };
}



export function rejectOffer(input: SaveGame, offerId: string): SaveGame {
  const save = structuredClone(input);
  save.offers = save.offers.filter((x) => x.id !== offerId);
  return save;
}

export const freeAgents = (save: SaveGame): Player[] =>
  save.players.filter((p) => p.clubId === "").sort((a, b) => overallFor(b) - overallFor(a));

/** Move a player between two clubs (book-keeping used by AI churn). */
function aiMove(save: SaveGame, p: Player, toClubId: string, fee: number, wage: number, until: number) {
  const from = save.clubs.find((c) => c.id === p.clubId)!;
  const to = save.clubs.find((c) => c.id === toClubId)!;
  p.clubId = toClubId;
  p.contract = { wage, until };
  save.finances[from.id].transfer += fee;
  save.finances[toClubId].transfer = Math.max(0, save.finances[toClubId].transfer - fee);
  logLine(save, `R${save.round}: ${to.short} sign ${p.name} from ${from.short} for ${money(fee)}.`);
}

/**
 * Called once per round while a window is open: AI–AI deals and incoming
 * offers for the user's players. Deterministic per (seed, season, round).
 */
export function windowTick(input: SaveGame): SaveGame {
  const win = transferWindow(input);
  if (!win.open) return input;
  const save = structuredClone(input);
  const rng = rngFor(save, "window", save.round);

  // --- AI–AI churn: one or two deals a round ---
  const deals = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < deals; i++) {
    const buyers = save.clubs
      .filter((c) => c.id !== save.userClubId && save.finances[c.id].transfer >= 750_000)
      .sort((a, b) => b.strength - a.strength);
    if (!buyers.length) break;
    const buyer = pick(rng, buyers.slice(0, 5));
    const buyerSquad = squadOf(save.players, buyer.id);
    const avg = buyerSquad.length ? buyerSquad.reduce((s, p) => s + overallFor(p), 0) / buyerSquad.length : 50;
    const candidates = save.players.filter(
      (p) =>
        p.clubId !== "" &&
        p.clubId !== buyer.id &&
        p.clubId !== save.userClubId &&
        overallFor(p) > avg + 2 &&
        marketValue(p) <= save.finances[buyer.id].transfer * 0.8
    );
    if (!candidates.length) continue;
    const target = candidates[Math.floor(rng() * candidates.length)];
    const fee = roundTo(marketValue(target) * (0.95 + rng() * 0.2), 10_000);
    aiMove(save, target, buyer.id, fee, wageDemand(target), save.season + 2 + Math.floor(rng() * 3));
  }

  // --- release clauses: a rival can buy a player out at the agreed fee ---
  const claused = squadOf(save.players, save.userClubId).filter(
    (p) => !p.loan && p.contract.releaseClause && p.contract.releaseClause > 0
  );
  for (const p of claused) {
    if (save.offers.some((o) => o.playerId === p.id)) continue;
    if (rng() > 0.3) continue;
    const clause = p.contract.releaseClause!;
    const suitors = save.clubs.filter(
      (c) => c.id !== save.userClubId && (save.finances[c.id]?.transfer ?? 0) >= clause
    );
    if (!suitors.length) continue;
    const club = pick(rng, suitors);
    save.offers.push({
      id: `of-${save.season}-${save.round}-c${save.offers.length}`,
      playerId: p.id,
      fromClubId: club.id,
      fee: clause,
      clause: true,
      day: `R${save.round} · release clause`
    });
    pushNews(save, `${club.short} have triggered ${p.name}'s ${money(clause)} release clause.`);
  }

  // --- incoming offers for the user's players (a transfer request draws bids) ---
  const userP = squadOf(save.players, save.userClubId).filter((p) => !p.loan && marketValue(p) >= 400_000);
  const wantsOut = userP.filter((p) => p.transferRequest);
  const listed = userP.filter((p) => p.transferListed);
  const offerChance = wantsOut.length || listed.length ? 0.75 : 0.45;
  if (userP.length && save.offers.length < 3 && rng() < offerChance) {
    const pool = wantsOut.length ? wantsOut : listed.length ? listed : userP;
    const sorted = pool.slice().sort((a, b) => overallFor(b) - overallFor(a));
    const target = sorted[Math.floor(rng() * Math.min(4, sorted.length))];
    if (!save.offers.some((o) => o.playerId === target.id)) {
      const bidders = save.clubs
        .filter((c) => c.id !== save.userClubId && c.strength >= (save.clubs.find((u) => u.id === save.userClubId)?.strength ?? 0) - 2)
        .sort((a, b) => b.strength - a.strength);
      if (bidders.length) {
        const bidder = pick(rng, bidders.slice(0, 4));
        // an unsettled player goes cheaper
        const fee = roundTo(marketValue(target) * (target.transferRequest ? 0.7 + rng() * 0.35 : 0.8 + rng() * 0.5), 10_000);
        const offer: TransferOffer = {
          id: `of-${save.season}-${save.round}-${save.offers.length}`,
          playerId: target.id,
          fromClubId: bidder.id,
          fee,
          day: `R${save.round} · ${win.kind} window`
        };
        save.offers.push(offer);
        pushInbox(save, {
          kind: "transfer",
          title: `${bidder.short} bid ${money(offer.fee)} for ${target.name}`,
          body: "Accept or reject it in the Transfer centre.",
          playerId: target.id,
          screen: "transfers"
        });
      }
    }
  }
  // kids and squad men attract loan interest; winter is when contracts get poached
  loanOutTick(save);
  poachTick(save);
  return save;
}

/**
 * End-of-season contract rollover (called from nextSeason): expired deals leave
 * the club; AI clubs re-sign most of theirs, the rest hit the free agent pool.
 */
export function rollContracts(save: SaveGame): SaveGame {
  const retired: Player[] = [];
  for (const p of save.players) {
    // 38 and over: hang up the boots (keeps the world from filling with decrepit veterans)
    if (p.age >= 38 && p.clubId !== "") {
      const club = save.clubs.find((c) => c.id === p.clubId);
      retired.push(p);
      if (club?.id === save.userClubId) pushNews(save, `${p.name} (${p.age}) retires from football.`);
      continue;
    }
    if (p.clubId === "" || p.contract.until >= save.season) continue;
    const club = save.clubs.find((c) => c.id === p.clubId);
    if (!club) continue;
    if (club.id === save.userClubId) {
      logLine(save, `Pre-season: ${p.name}'s contract expired — he leaves as a free agent.`);
      p.clubId = "";
      continue;
    }
    const rng = mulberry32(hashSeed(save.seed, "renew-ai", p.id, save.season));
    if (rng() < TF.renewalProb) {
      p.contract = { wage: roundTo(wageDemand(p) * 1.02, 100), until: save.season + 2 + Math.floor(rng() * 3) };
    } else {
      logLine(save, `Pre-season: ${club.short} release ${p.name} — he's a free agent.`);
      p.clubId = "";
    }
  }
  // free agents drift out of the game; a small intake replaces them
  const frees = save.players.filter((p) => p.clubId === "");
  if (frees.length > 24) {
    const oldest = frees.sort((a, b) => b.age - a.age).slice(0, frees.length - 24);
    const gone = new Set(oldest.map((p) => p.id));
    save.players = save.players.filter((p) => !gone.has(p.id));
  }
  if (retired.length) {
    const gone = new Set(retired.map((p) => p.id));
    save.players = save.players.filter((p) => !gone.has(p.id));
  }
  userFix(save); // any of your departures must leave a legal XI behind
  return save;
}

/** A new free agent, generated deterministically for a season. */
export function makeFreeAgent(season: number, idx: number): Player {
  const rng = mulberry32(hashSeed("free", season, idx));
  const pos = pick(rng, ["DF", "MF", "FW", "MF", "FW"] as const);
  const base = randInt(rng, 48, 70);
  const j = (v: number) => Math.max(30, Math.min(90, v + randInt(rng, -5, 5)));
  const attrs =
    pos === "DF"
      ? { defending: j(base + 10), physical: j(base + 6), pace: j(base), passing: j(base - 2), shooting: j(base - 16), reflexes: j(base - 30), handling: j(base - 30) }
      : pos === "MF"
        ? { passing: j(base + 10), pace: j(base), defending: j(base - 2), shooting: j(base - 2), physical: j(base - 4), reflexes: j(base - 30), handling: j(base - 30) }
        : { shooting: j(base + 12), pace: j(base + 6), passing: j(base - 4), defending: j(base - 18), physical: j(base - 2), reflexes: j(base - 30), handling: j(base - 30) };
  const name = `${pick(rng, ["Jack", "Liam", "Owen", "Noah", "Theo", "Luca", "Finn", "Issac", "Milo", "Dean"])} ${pick(rng, ["Mora", "Hayes", "Doyle", "Frost", "Nolan", "Rowan", "Tate", "Vance", "Keane", "Olsen"])}`;
  const id = `pfree-${season}-${idx}`;
  const age = randInt(rng, 26, 34);
  const p: Player = {
    id,
    clubId: "",
    name,
    age,
    pos,
    attrs,
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 0,
    morale: 60,
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
  };
  p.contract = { wage: wageDemand(p), until: 0 };
  p.peak = peakFor(p);
  return p;
}
