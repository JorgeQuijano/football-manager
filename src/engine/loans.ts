import type { Loan, Player, SaveGame, TransferOffer } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { overallFor, squadOf } from "./ratings";
import { marketValue, money, transferWindow, wageDemand, wageHeadroom } from "./transfers";
import { pushNews } from "./training";
import { noteSigning, policyCheck } from "./market";

/**
 * Loans, both ways: borrowing a player for the season (a fee, a slice of his
 * wages, maybe an option to buy) and sending your own out to play — which is
 * how the kids get games.
 *
 * A loaned player keeps his parent contract: `player.loan` records who owns him,
 * who he is playing for, and what happens when the loan ends.
 */

export const LOAN = {
  maxIn: 3,
  maxOut: 4,
  /** the borrower must be covering at least this much of the wage */
  minShare: 0.4,
  /** a loan fee is usually a slice of his value */
  feeShare: 0.12,
  /** the wage of a borrowed player is priced off his value */
  optionMarkup: 1.25
};

const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);
const logLine = (save: SaveGame, line: string) => {
  save.transferLog.unshift(line);
  if (save.transferLog.length > 40) save.transferLog.length = 40;
};

export const loaneesIn = (save: SaveGame): Player[] =>
  save.players.filter((p) => p.clubId === save.userClubId && p.loan && p.loan.toClubId === save.userClubId);

export const loaneesOut = (save: SaveGame): Player[] =>
  save.players.filter((p) => p.loan && p.loan.fromClubId === save.userClubId);

export const loanCount = (save: SaveGame, dir: "in" | "out"): number =>
  (dir === "in" ? loaneesIn(save) : loaneesOut(save)).length;

/** A rough view of what a club would want to lend him out for. */
export function loanAsk(p: Player, buyerStrength: number, sellerStrength: number): { fee: number; share: number } {
  const value = marketValue(p);
  const small = overallFor(p) < 62 || p.age <= 21; // kids and squad fillers are easy to borrow
  const reluctance = p.age <= 21 ? 0.7 : small ? 0.85 : 1.15;
  const gap = Math.max(0, sellerStrength - buyerStrength);
  return {
    fee: roundTo(value * LOAN.feeShare * reluctance * (1 + gap * 0.04), 10_000),
    share: Math.min(1, Math.max(LOAN.minShare, 0.5 + gap * 0.05 + (small ? 0 : 0.15)))
  };
}

export interface LoanResponse {
  kind: "accepted" | "counter" | "rejected";
  message: string;
  fee?: number;
  share?: number;
}

/**
 * Try to borrow a player for the rest of the season. The club's answer depends on
 * the wage share you offer, the loan fee, and whether they want an option in it.
 */
export function bidForLoan(
  input: SaveGame,
  playerId: string,
  offer: { wageShare: number; fee: number; optionFee?: number; obligation?: boolean }
): { save: SaveGame; resp: LoanResponse } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId === "" || p.clubId === input.userClubId) {
    return { save: input, resp: { kind: "rejected", message: "He isn't available." } };
  }
  if (p.loan) return { save: input, resp: { kind: "rejected", message: "He is already out on loan." } };
  const win = transferWindow(input);
  if (!win.open) return { save: input, resp: { kind: "rejected", message: `The transfer window is closed — ${win.label}.` } };
  if (loanCount(input, "in") >= LOAN.maxIn) {
    return { save: input, resp: { kind: "rejected", message: `You are already at the limit of ${LOAN.maxIn} loanees.` } };
  }
  const fin = input.finances[input.userClubId];
  if (!fin || offer.fee > fin.transfer) {
    return { save: input, resp: { kind: "rejected", message: `That loan fee is beyond your budget (${money(fin?.transfer ?? 0)}).` } };
  }
  const share = Math.max(0, Math.min(1, offer.wageShare));
  const myWage = Math.round(p.contract.wage * share);
  const headroom = wageHeadroom(input, input.userClubId);
  if (myWage > headroom) {
    return {
      save: input,
      resp: { kind: "rejected", message: `Your ${Math.round(share * 100)}% share is ${money(myWage)}/wk — only ${money(Math.max(0, headroom))} of headroom.` }
    };
  }
  const check = policyCheck(input.policy, p, { wage: myWage });
  if (!check.ok) return { save: input, resp: { kind: "rejected", message: check.reason! } };

  const seller = input.clubs.find((c) => c.id === p.clubId)!;
  // nobody loans out their best players
  const ownerSquad = squadOf(input.players, p.clubId).sort((a, b) => overallFor(b) - overallFor(a));
  if (p.age > 21 && ownerSquad.slice(0, 4).some((x) => x.id === p.id)) {
    return { save: input, resp: { kind: "rejected", message: `${seller.short} won't let one of their best go out on loan.` } };
  }
  const mine = input.clubs.find((c) => c.id === input.userClubId)!;
  const ask = loanAsk(p, mine.strength, seller.strength);
  const rng = mulberry32(hashSeed(input.seed, "loan", playerId, offer.fee, Math.round(share * 100)));
  // an option to buy only annoys the parent club if it undercuts his likely value;
  // an obligation is a guaranteed sale, which they like
  const value = marketValue(p);
  const future = value * (p.age <= 21 ? 1.6 : p.age <= 24 ? 1.35 : 1.1);
  const optionDrag = offer.optionFee ? Math.max(0, (future - offer.optionFee) / future) * 0.6 : 0;
  const score =
    (offer.fee / Math.max(1, ask.fee)) * 0.6 +
    (share / Math.max(0.01, ask.share)) * 0.4 -
    optionDrag +
    (offer.obligation ? 0.15 : 0);
  const roll = 0.85 + rng() * 0.3;

  if (share < LOAN.minShare) {
    return {
      save: input,
      resp: { kind: "rejected", message: `${seller.short} want you to cover at least ${Math.round(LOAN.minShare * 100)}% of his wages.` }
    };
  }
  if (score >= 1.0 * roll) {
    return { save: completeLoan(input, p, offer, ask), resp: { kind: "accepted", message: `${p.name} joins on loan for the rest of the season.` } };
  }
  if (score >= 0.82 * roll) {
    const counterFee = roundTo(ask.fee * 1.15, 10_000);
    const counterShare = Math.min(1, ask.share + 0.05);
    return {
      save: input,
      resp: {
        kind: "counter",
        message: `${seller.short} want ${money(counterFee)} and ${Math.round(counterShare * 100)}% of his wages.`,
        fee: counterFee,
        share: counterShare
      }
    };
  }
  return { save: input, resp: { kind: "rejected", message: `${seller.short} would rather keep him around.` } };
}

/** Perform a loan (the player agrees: a good player may turn down a small club). */
function completeLoan(
  input: SaveGame,
  p: Player,
  offer: { wageShare: number; fee: number; optionFee?: number; obligation?: boolean },
  ask: { fee: number; share: number }
): SaveGame {
  void ask;
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === p.id)!;
  const from = pp.clubId;
  const loan: Loan = {
    fromClubId: from,
    toClubId: save.userClubId,
    wageShare: Math.max(0, Math.min(1, offer.wageShare)),
    fee: offer.fee,
    until: save.season,
    ...(offer.optionFee ? { optionFee: offer.optionFee } : {}),
    ...(offer.obligation ? { obligation: true } : {})
  };
  pp.loan = loan;
  pp.clubId = save.userClubId;
  noteSigning(save, pp, offer.fee);
  const fin = save.finances[save.userClubId];
  if (fin) fin.transfer -= offer.fee;
  const owner = save.clubs.find((c) => c.id === from);
  if (save.finances[from]) save.finances[from].transfer += offer.fee;
  logLine(
    save,
    `R${save.round}: you take ${pp.name} on loan from ${owner?.short} (${money(offer.fee)} fee, ${Math.round(loan.wageShare * 100)}% of wages${loan.optionFee ? `, ${money(loan.optionFee)} option` : ""}${loan.obligation ? ", obligation to buy" : ""}).`
  );
  return save;
}

/** Take up the pre-agreed option on a loanee — he becomes yours. */
export function exerciseLoanOption(input: SaveGame, playerId: string): { save: SaveGame; resp: { ok: boolean; message: string } } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId || !p.loan?.optionFee) {
    return { save: input, resp: { ok: false, message: "There's no option on that loan." } };
  }
  const win = transferWindow(input);
  if (!win.open) return { save: input, resp: { ok: false, message: "The window is shut — the option stands until it opens again." } };
  const fin = input.finances[input.userClubId];
  if (!fin || fin.transfer < p.loan.optionFee) {
    return { save: input, resp: { ok: false, message: `That costs ${money(p.loan.optionFee)} — you don't have it.` } };
  }
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  const owner = pp.loan!.fromClubId;
  const fee = pp.loan!.optionFee!;
  save.finances[save.userClubId].transfer -= fee;
  if (save.finances[owner]) save.finances[owner].transfer += fee;
  pp.loan = undefined;
  pp.contract = { wage: roundTo(wageDemand(pp), 100), until: save.season + 3 };
  logLine(save, `R${save.round}: you take up the option on ${pp.name} — ${money(fee)} makes the move permanent.`);
  pushNews(save, `${pp.name}'s loan has been made permanent for ${money(fee)}.`);
  return { save, resp: { ok: true, message: `${pp.name} signs permanently for ${money(fee)}.` } };
}

/** Send one of yours out on loan (used when an AI club's loan offer is accepted). */
export function sendOnLoan(
  input: SaveGame,
  playerId: string,
  toClubId: string,
  terms: { wageShare: number; fee: number; optionFee?: number }
): SaveGame {
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  pp.loan = {
    fromClubId: save.userClubId,
    toClubId,
    wageShare: Math.max(0, Math.min(1, terms.wageShare)),
    fee: terms.fee,
    until: save.season,
    ...(terms.optionFee ? { optionFee: terms.optionFee } : {})
  };
  pp.clubId = toClubId;
  const club = save.clubs.find((c) => c.id === toClubId);
  if (save.finances[save.userClubId]) save.finances[save.userClubId].transfer += terms.fee;
  if (save.finances[toClubId]) save.finances[toClubId].transfer = Math.max(0, save.finances[toClubId].transfer - terms.fee);
  logLine(
    save,
    `R${save.round}: ${pp.name} joins ${club?.short} on loan (${money(terms.fee)} fee, they pay ${Math.round(terms.wageShare * 100)}% of his wages).`
  );
  return save;
}

/**
 * Loans resolve at the rollover: everybody goes home, obligations are made
 * permanent, options lapse.
 */
export function loanRollover(save: SaveGame): void {
  const home = save.players.filter((p) => p.loan);
  if (!home.length) return;
  for (const p of home) {
    const loan = p.loan!;
    // an obligation to buy completes now
    if (loan.obligation && loan.optionFee) {
      const buyer = save.clubs.find((c) => c.id === loan.toClubId);
      const seller = save.clubs.find((c) => c.id === loan.fromClubId);
      p.clubId = loan.toClubId;
      p.contract = { wage: roundTo(wageDemand(p), 100), until: save.season + 3 };
      if (save.finances[loan.toClubId]) save.finances[loan.toClubId].transfer = Math.max(0, save.finances[loan.toClubId].transfer - loan.optionFee);
      if (save.finances[loan.fromClubId]) save.finances[loan.fromClubId].transfer += loan.optionFee;
      p.loan = undefined;
      if (loan.toClubId === save.userClubId) {
        pushNews(save, `The obligation on ${p.name} is triggered — he's yours for ${money(loan.optionFee)}.`);
      } else if (loan.fromClubId === save.userClubId && buyer && seller) {
        pushNews(save, `${buyer.short} complete the permanent signing of ${p.name} for ${money(loan.optionFee)}.`);
      }
      continue;
    }
    const hadOption = !!loan.optionFee;
    p.clubId = loan.fromClubId;
    p.loan = undefined;
    if (loan.toClubId === save.userClubId) {
      pushNews(save, `${p.name}'s loan has ended — he returns to ${save.clubs.find((c) => c.id === loan.fromClubId)?.short}.`);
    } else if (loan.fromClubId === save.userClubId) {
      pushNews(save, `${p.name} is back from his loan at ${save.clubs.find((c) => c.id === loan.toClubId)?.short}.`);
    }
    void hadOption;
  }
}

/** The rest of the window: AI clubs looking to borrow your youngsters. */
export function loanOutTick(save: SaveGame): void {
  const win = transferWindow(save);
  if (!win.open) return;
  if (loanCount(save, "out") >= LOAN.maxOut) return;
  if (save.offers.some((o) => o.kind === "loan")) return;
  const squad = squadOf(save.players, save.userClubId).filter(
    (p) => !p.loan && (p.age <= 23 || p.transferListed || overallFor(p) < 60) && marketValue(p) < 900_000
  );
  if (!squad.length) return;
  const rng = mulberry32(hashSeed(save.seed, "loanout", save.season, save.round));
  if (rng() > 0.4) return;
  const target = squad[Math.floor(rng() * squad.length)];
  const suitors = save.clubs.filter((c) => c.id !== save.userClubId && c.strength <= (save.clubs.find((c) => c.id === save.userClubId)?.strength ?? 50));
  if (!suitors.length) return;
  const club = suitors[Math.floor(rng() * suitors.length)];
  const week = roundTo(wageDemand(target) * (0.6 + rng() * 0.4), 10_000);
  const offer: TransferOffer = {
    id: `of-${save.season}-${save.round}-l${save.offers.length}`,
    playerId: target.id,
    fromClubId: club.id,
    fee: 0,
    kind: "loan",
    loan: { wageShare: Math.min(1, 0.5 + rng() * 0.5), fee: week },
    day: `R${save.round} · ${win.kind} window`
  };
  save.offers.push(offer);
  pushNews(save, `${club.short} want to take ${target.name} on loan for the season.`);
}
