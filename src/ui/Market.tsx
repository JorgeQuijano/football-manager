import { useState } from "react";
import type { Player } from "@/engine";
import {
  estimateFor,
  ovrRange20,
  to20ovr,
  LOAN,
  canPreContract,
  isPreContracted,
  loaneesIn,
  loaneesOut,
  marketValue,
  money,
  overallFor,
  preContractTargets,
  squadOf,
  termsDemand,
  wageDemand,
  wageBill,
  wageHeadroom
} from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";
import { posChip, shortName } from "@/ui/format";

const rowCls = "flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3";
const microBtn = "h-11 min-w-11 px-2 text-[11px] font-bold";

/** Board policy, budgets, debts — and the lever that moves money between them. */
export function MarketBar() {
  const game = useGame((s) => s.game)!;
  const reallocate = useGame((s) => s.reallocate);
  const [weekly, setWeekly] = useState(4_000);
  const [note, setNote] = useState<string | null>(null);
  const fin = game.finances[game.userClubId];
  const bill = wageBill(game, game.userClubId);
  const headroom = wageHeadroom(game, game.userClubId);
  const debts = (game.debts ?? []).filter((d) => d.clubId !== game.userClubId);
  const policy = game.policy;
  const owed = debts.reduce((a, d) => a + d.amount, 0);

  const move = (dir: "toWage" | "toTransfer") => {
    const msg = reallocate(dir, weekly);
    setNote(msg);
  };

  return (
    <section className="space-y-2" data-testid="market-bar">
      <div className={rowCls}>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Board policy</div>
          <div className="text-sm font-bold" data-testid="board-policy">
            {policy?.label ?? "No policy set."}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">
          S{game.season}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-3" data-testid="budget-card">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Transfer budget</div>
            <div className="text-lg font-extrabold tnum" data-testid="transfer-budget">
              {money(fin.transfer)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Wages / week</div>
            <div className="text-lg font-extrabold tnum" data-testid="wage-metric">
              {money(bill)}
              <span className="text-xs font-semibold text-muted-foreground"> / {money(fin.wageBudget)}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
          <span className={headroom >= 0 ? "text-muted-foreground" : "text-[var(--danger)]"}>
            Wage headroom {money(headroom)}/wk
          </span>
          {owed > 0 && (
            <span className="text-[var(--warn)]" data-testid="debts">
              {money(owed)} owed in instalments
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Move money between the budgets
          </div>
          <div className="flex items-center gap-2">
            <input
              data-testid="reallocate-input"
              type="number"
              inputMode="numeric"
              step={1_000}
              value={weekly}
              onChange={(e) => setWeekly(Math.max(0, Number(e.target.value) || 0))}
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
            />
            <Button
              size="sm"
              variant="outline"
              className={microBtn}
              data-testid="reallocate-to-wage"
              onClick={() => move("toWage")}
            >
              → wages
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={microBtn}
              data-testid="reallocate-to-transfer"
              onClick={() => move("toTransfer")}
            >
              → transfer
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            £1/wk of wage room costs {money(52)} of transfer budget. {note ?? ""}
          </p>
        </div>
      </div>

      {debts.length > 0 && (
        <details className="rounded-xl border border-border bg-card p-3" data-testid="debt-list">
          <summary className="cursor-pointer text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            Instalments & add-ons
          </summary>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {debts.map((d) => (
              <li key={d.id}>
                {money(d.amount)} to {game.clubs.find((c) => c.id === d.clubId)?.short ?? d.clubId} ·{" "}
                {d.addonApps ? `${d.addonApps} apps` : `due S${d.dueSeason}`} · {d.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Everyone out on loan and everyone borrowed in. */
export function LoansCard() {
  const game = useGame((s) => s.game)!;
  const loanOption = useGame((s) => s.loanOption);
  const [note, setNote] = useState<string | null>(null);
  const inn = loaneesIn(game);
  const out = loaneesOut(game);
  if (!inn.length && !out.length) return null;

  const take = (p: Player) => {
    const err = loanOption(p.id);
    setNote(err ?? `${p.name} is yours permanently.`);
  };

  return (
    <section className="space-y-2" data-testid="loans-card">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
        Loans {inn.length}/{LOAN.maxIn} in · {out.length}/{LOAN.maxOut} out
      </h2>
      {inn.map((p) => (
        <div key={p.id} className={rowCls} data-testid={`loan-in-${p.id}`}>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">
              {shortName(p.name)} <span className="text-muted-foreground">← {game.clubs.find((c) => c.id === p.loan!.fromClubId)?.short}</span>
            </div>
            <div className="text-[11px] text-muted-foreground tnum">
              OVR {to20ovr(overallFor(p))} · you pay {Math.round(p.loan!.wageShare * 100)}% of {money(p.contract.wage)}/wk
              {p.loan!.optionFee ? ` · option ${money(p.loan!.optionFee)}` : ""}
            </div>
          </div>
          {p.loan!.optionFee ? (
            <Button
              size="sm"
              className="h-11 shrink-0"
              data-testid={`loan-option-${p.id}`}
              onClick={() => take(p)}
            >
              Sign {money(p.loan!.optionFee)}
            </Button>
          ) : (
            <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">on loan</span>
          )}
        </div>
      ))}
      {out.map((p) => (
        <div key={p.id} className={rowCls} data-testid={`loan-out-${p.id}`}>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">
              {shortName(p.name)} <span className="text-muted-foreground">→ {game.clubs.find((c) => c.id === p.loan!.toClubId)?.short}</span>
            </div>
            <div className="text-[11px] text-muted-foreground tnum">
              OVR {to20ovr(overallFor(p))} · they pay {Math.round(p.loan!.wageShare * 100)}% · back in pre-season
            </div>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">out on loan</span>
        </div>
      ))}
      {note && <p className="text-[11px] font-semibold text-primary">{note}</p>}
    </section>
  );
}

/** Fee structure: instalments, add-ons, sell-on. */
export function DealStructure({
  player,
  fee,
  structure,
  setStructure
}: {
  player: Player;
  fee: number;
  structure: { instalments: number; addonApps: number; addonAmount: number; sellOn: number };
  setStructure: (s: { instalments: number; addonApps: number; addonAmount: number; sellOn: number }) => void;
}) {
  const { instalments, addonApps, addonAmount, sellOn } = structure;
  const now = Math.round(fee / Math.max(1, instalments));
  const total = fee + (addonApps > 0 ? addonAmount : 0);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-2" data-testid="deal-structure">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">How you pay</div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            data-testid={`instalments-${n}`}
            onClick={() => setStructure({ ...structure, instalments: n })}
            className={`h-11 flex-1 rounded-lg text-xs font-bold ${
              instalments === n ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {n === 1 ? "Up front" : `${n} instalments`}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Add-on after … apps</span>
          <input
            data-testid="addon-apps"
            type="number"
            inputMode="numeric"
            value={addonApps}
            onChange={(e) => setStructure({ ...structure, addonApps: Math.max(0, Number(e.target.value) || 0) })}
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">…for</span>
          <input
            data-testid="addon-amount"
            type="number"
            inputMode="numeric"
            step={50_000}
            value={addonAmount}
            onChange={(e) => setStructure({ ...structure, addonAmount: Math.max(0, Number(e.target.value) || 0) })}
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
          />
        </label>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 10, 15, 20, 25].map((pct) => (
          <button
            key={pct}
            data-testid={`sellon-${pct}`}
            onClick={() => setStructure({ ...structure, sellOn: pct })}
            className={`h-11 flex-1 rounded-lg text-[11px] font-bold ${
              sellOn === pct ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {pct === 0 ? "No" : `${pct}%`}
          </button>
        ))}
      </div>
      <p className="text-[10px] font-semibold text-muted-foreground tnum" data-testid="deal-cost">
        You pay {money(now)} now{instalments > 1 ? ` · ${money(total)} all in` : addonApps > 0 ? ` · ${money(total)} all in` : ""} —
        sellers discount a fee spread over seasons; add-ons and a sell-on make up the difference.
      </p>
      {sellOn > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {player.name}'s old club get {sellOn}% of your next sale.
        </p>
      )}
    </div>
  );
}

/** Contract depth: length, bonuses, clause, option. */
export function ContractDepth({
  player,
  contract,
  setContract
}: {
  player: Player;
  contract: { years: number; signingBonus: number; perApp: number; perGoal: number; releaseClause: number; extensionYears: number };
  setContract: (c: { years: number; signingBonus: number; perApp: number; perGoal: number; releaseClause: number; extensionYears: number }) => void;
}) {
  const base = wageDemand(player);
  const demand = termsDemand(player, { wage: base, ...contract }, base);
  const value = marketValue(player);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-2" data-testid="contract-depth">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <span>The deal</span>
        <span className="text-primary tnum" data-testid="terms-hint">
          his agent is thinking {money(Math.round(demand / 100) * 100)}/wk
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            data-testid={`years-${n}`}
            onClick={() => setContract({ ...contract, years: n })}
            className={`h-11 flex-1 rounded-lg text-xs font-bold ${
              contract.years === n ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {n}y
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Signing-on bonus</span>
          <input
            data-testid="signing-bonus"
            type="number"
            inputMode="numeric"
            step={50_000}
            value={contract.signingBonus}
            onChange={(e) => setContract({ ...contract, signingBonus: Math.max(0, Number(e.target.value) || 0) })}
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Release clause</span>
          <input
            data-testid="release-clause"
            type="number"
            inputMode="numeric"
            step={500_000}
            value={contract.releaseClause}
            onChange={(e) => setContract({ ...contract, releaseClause: Math.max(0, Number(e.target.value) || 0) })}
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">£ per appearance</span>
          <input
            data-testid="per-app"
            type="number"
            inputMode="numeric"
            step={500}
            value={contract.perApp}
            onChange={(e) => setContract({ ...contract, perApp: Math.max(0, Number(e.target.value) || 0) })}
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">£ per goal</span>
          <input
            data-testid="per-goal"
            type="number"
            inputMode="numeric"
            step={500}
            value={contract.perGoal}
            onChange={(e) => setContract({ ...contract, perGoal: Math.max(0, Number(e.target.value) || 0) })}
            className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
          />
        </label>
      </div>
      <button
        data-testid="extension-option"
        onClick={() => setContract({ ...contract, extensionYears: contract.extensionYears ? 0 : 1 })}
        className={`h-11 w-full rounded-lg text-xs font-bold ${
          contract.extensionYears ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
        }`}
      >
        {contract.extensionYears ? "Club option: +1 season (on)" : "Add a club option for +1 season"}
      </button>
      <p className="text-[10px] text-muted-foreground">
        Bonuses and a low clause ({money(value)}) cut his wage; a long deal suits a kid and costs you with a
        veteran. Extras are paid from the budgets at season's end.
      </p>
    </div>
  );
}

/** List him, ask his agent, or tie him down to a pre-contract. */
export function MarketActions({ player }: { player: Player }) {
  const game = useGame((s) => s.game)!;
  const setListed = useGame((s) => s.setListed);
  const askAgent = useGame((s) => s.askAgent);
  const preContract = useGame((s) => s.preContract);
  const [note, setNote] = useState<string | null>(null);
  const [wage, setWage] = useState(() => Math.round((wageDemand(player) * 1.1) / 100) * 100);
  const mine = player.clubId === game.userClubId;
  const winter = canPreContract(game);
  const expiring = player.contract.until <= game.season;
  const pre = isPreContracted(game, player.id);

  return (
    <div className="space-y-2" data-testid={`market-actions-${player.id}`}>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-11 flex-1"
          data-testid="ask-agent"
          onClick={() => setNote(askAgent(player.id).line)}
        >
          Ask his agent
        </Button>
        {mine ? (
          <Button
            size="sm"
            variant="outline"
            className="h-11 flex-1"
            data-testid="toggle-listed"
            onClick={() => setListed(player.id, !player.transferListed)}
          >
            {player.transferListed ? "Take off the list" : "Offer to clubs"}
          </Button>
        ) : null}
      </div>

      {!mine && expiring && (
        <div className="space-y-2 rounded-lg border border-[var(--warn-line)] bg-card p-2">
          <div className="text-[11px] font-bold text-[var(--warn)]">
            {pre ? "He's agreed to join you at the end of the season." : "Out of contract in the summer — you can talk to him now."}
          </div>
          {!pre && (
            <div className="flex items-center gap-2">
              <input
                data-testid="pre-wage"
                type="number"
                inputMode="numeric"
                step={1_000}
                value={wage}
                onChange={(e) => setWage(Math.max(0, Number(e.target.value) || 0))}
                className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
              />
              <Button
                size="sm"
                className={microBtn}
                data-testid="pre-contract-btn"
                disabled={!winter}
                onClick={() => setNote(preContract(player.id, wage, 3))}
              >
                {winter ? "Pre-contract" : "Winter only"}
              </Button>
            </div>
          )}
        </div>
      )}
      {note && <p className="text-[11px] font-semibold text-primary">{note}</p>}
    </div>
  );
}

/** Rival players whose deals run out this summer. */
export function PreContractTargets({ onPick }: { onPick: (p: Player) => void }) {
  const game = useGame((s) => s.game)!;
  const targets = preContractTargets(game).slice(0, 6);
  if (!canPreContract(game) || !targets.length) return null;
  return (
    <section className="space-y-2" data-testid="pre-contract-targets">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
        Free transfers this summer
      </h2>
      {targets.map((p) => (
        <button
          key={p.id}
          data-testid={`pre-target-${p.id}`}
          onClick={() => onPick(p)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}>{p.pos}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{shortName(p.name)}</span>
              <span className="block text-[11px] text-muted-foreground tnum">
                age {p.age} · {game.clubs.find((c) => c.id === p.clubId)?.short ?? "—"} ·{" "}
                {money(p.contract.wage)}/wk
              </span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-extrabold text-primary">Free</span>
        </button>
      ))}
    </section>
  );
}

/** Loan-in search: the youngest squad men at other clubs. */
export function LoanTargets({ clubId, onLoan }: { clubId: string; onLoan: (p: Player) => void }) {
  const game = useGame((s) => s.game)!;
  const squad = squadOf(game.players, clubId).sort((a, b) => overallFor(b) - overallFor(a));
  const starters = new Set(squad.slice(0, 11).map((p) => p.id));
  const kids = squad
    .filter((p) => p.age <= 23 && !p.loan && !starters.has(p.id))
    .sort((a, b) => overallFor(b) - overallFor(a))
    .slice(0, 4);
  if (!kids.length) return null;
  return (
    <div className="space-y-1.5" data-testid="loan-targets">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Available on loan
      </div>
      {kids.map((p) => {
        const est = estimateFor(game, p);
        return (
          <button
            key={p.id}
            data-testid={`loan-target-${p.id}`}
            onClick={() => onLoan(p)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}>{p.pos}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{shortName(p.name)}</span>
                <span className="block text-[11px] text-muted-foreground tnum">
                  age {p.age} ·{" "}
                  {est.exactOvr !== null
                    ? `OVR ${to20ovr(est.exactOvr)}`
                    : est.ovrRange
                      ? `OVR ~${ovrRange20(est.ovrRange[0], est.ovrRange[1])}`
                      : "no report"}{" "}
                  · {money(p.contract.wage)}/wk
                </span>
              </span>
            </span>
            <span className="shrink-0 text-xs font-extrabold text-primary">Borrow</span>
          </button>
        );
      })}
    </div>
  );
}
