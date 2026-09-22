import { useState } from "react";
import type { Player } from "@/engine";
import {
  freeAgents,
  marketValue,
  money,
  overallFor,
  squadOf,
  transferWindow,
  wageBill,
  wageDemand,
  wageHeadroom
} from "@/engine";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useGame } from "@/state/store";
import { posChip, shortName } from "@/ui/format";

type DealKind = "buy" | "renew" | "free";
type Deal = {
  kind: DealKind;
  player: Player;
  step: "fee" | "terms" | "done";
  fee: number;
  wage: number;
  msg: string;
  tone: "ok" | "warn" | "err";
  counterFee?: number;
  counterWage?: number;
};

const cLabel = (until: number, season: number) =>
  until <= season ? "Expires this season" : `Until end of S${until}`;

const moneyK = (n: number) => money(n);

export function Transfers() {
  const game = useGame((s) => s.game)!;
  const bidFor = useGame((s) => s.bidFor);
  const signTerms = useGame((s) => s.signTerms);
  const renew = useGame((s) => s.renew);
  const signFree = useGame((s) => s.signFree);
  const acceptIncoming = useGame((s) => s.acceptIncoming);
  const rejectIncoming = useGame((s) => s.rejectIncoming);
  const cancelDeal = useGame((s) => s.cancelDeal);

  const squad = squadOf(game.players, game.userClubId);
  const win = transferWindow(game);
  const fin = game.finances[game.userClubId];
  const bill = wageBill(game, game.userClubId);
  const headroom = wageHeadroom(game, game.userClubId);
  const others = game.clubs.filter((c) => c.id !== game.userClubId);
  const [browseId, setBrowseId] = useState(others[0]?.id ?? "");
  const [deal, setDeal] = useState<Deal | null>(null);

  const meetTerms = () => {
    if (!deal || deal.counterWage === undefined) return;
    const w = deal.counterWage;
    const resp =
      deal.kind === "buy" ? signTerms(deal.player.id, w) : deal.kind === "renew" ? renew(deal.player.id, w) : signFree(deal.player.id, w);
    if (!resp) return;
    setDeal({
      ...deal,
      wage: w,
      step: resp.kind === "accepted" ? "done" : "terms",
      counterWage: undefined,
      msg: resp.message,
      tone: resp.kind === "accepted" ? "ok" : "err"
    });
  };

  const expiring = squad
    .filter((p) => p.contract.until <= game.season)
    .sort((a, b) => overallFor(b) - overallFor(a));
  const frees = freeAgents(game);
  const browse = squadOf(game.players, browseId).sort((a, b) => overallFor(b) - overallFor(a));

  const openBuy = (p: Player) => {
    const v = marketValue(p);
    setDeal({
      kind: "buy",
      player: p,
      step: "fee",
      fee: v,
      wage: Math.max(p.contract.wage, wageDemand(p)),
      msg: `${p.name} is valued around ${money(v)}. Offer what you think he's worth.`,
      tone: "ok"
    });
  };

  const openRenew = (p: Player) =>
    setDeal({
      kind: "renew",
      player: p,
      step: "terms",
      fee: 0,
      wage: p.contract.wage,
      msg: `Currently on ${money(p.contract.wage)}/wk. ${cLabel(p.contract.until, game.season)}.`,
      tone: "ok"
    });

  const openFree = (p: Player) =>
    setDeal({
      kind: "free",
      player: p,
      step: "terms",
      fee: 0,
      wage: wageDemand(p),
      msg: `Free agent — his camp wants around ${money(wageDemand(p))}/wk.`,
      tone: "ok"
    });

  const doBid = (fee: number) => {
    if (!deal) return;
    const resp = bidFor(deal.player.id, fee);
    if (!resp) return;
    if (resp.kind === "accepted") {
      setDeal({
        ...deal,
        step: "terms",
        fee,
        wage: Math.max(wageDemand(deal.player), deal.player.contract.wage),
        counterFee: undefined,
        msg: resp.message,
        tone: "ok"
      });
    } else if (resp.kind === "counter") {
      setDeal({ ...deal, counterFee: resp.fee, msg: resp.message, tone: "warn" });
    } else {
      setDeal({ ...deal, msg: resp.message, tone: "err" });
    }
  };

  const doTerms = () => {
    if (!deal) return;
    const resp = signTerms(deal.player.id, deal.wage);
    if (!resp) return;
    if (resp.kind === "accepted") {
      setDeal({ ...deal, step: "done", msg: resp.message, tone: "ok" });
    } else if (resp.kind === "counter") {
      setDeal({ ...deal, counterWage: resp.wage, msg: resp.message, tone: "warn" });
    } else {
      setDeal({ ...deal, msg: resp.message, tone: "err" });
    }
  };

  const doRenew = () => {
    if (!deal) return;
    const resp = renew(deal.player.id, deal.wage);
    if (!resp) return;
    if (resp.kind === "accepted") {
      setDeal({ ...deal, step: "done", msg: resp.message, tone: "ok" });
    } else if (resp.kind === "counter") {
      setDeal({ ...deal, counterWage: resp.wage, msg: resp.message, tone: "warn" });
    } else {
      setDeal({ ...deal, msg: resp.message, tone: "err" });
    }
  };

  const doFree = () => {
    if (!deal) return;
    const resp = signFree(deal.player.id, deal.wage);
    if (!resp) return;
    if (resp.kind === "accepted") {
      setDeal({ ...deal, step: "done", msg: resp.message, tone: "ok" });
    } else if (resp.kind === "counter") {
      setDeal({ ...deal, counterWage: resp.wage, msg: resp.message, tone: "warn" });
    } else {
      setDeal({ ...deal, msg: resp.message, tone: "err" });
    }
  };

  const toneClass =
    deal?.tone === "err" ? "text-[#FF6B6B]" : deal?.tone === "warn" ? "text-[#FFB020]" : "text-primary";

  return (
    <div className="space-y-5" data-testid="transfers-screen">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">Transfer centre</h1>
        <span
          data-testid="window-status"
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            win.open ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {win.open ? (win.kind === "summer" ? "Summer window open" : "Winter window open") : "Window closed"}
        </span>
      </header>

      <div className="rounded-xl border border-border bg-card p-3" data-testid="budget-card">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Transfer budget</div>
            <div className="text-lg font-extrabold tnum" data-testid="transfer-budget">
              {moneyK(fin.transfer)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Wages / week</div>
            <div className="text-lg font-extrabold tnum" data-testid="wage-metric">
              {money(bill)}
              <span className="text-xs font-semibold text-muted-foreground">
                {" "}
                / {money(fin.wageBudget)}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
          <span className={headroom >= 0 ? "text-muted-foreground" : "text-[#FF6B6B]"}>
            Wage headroom {money(headroom)}/wk
          </span>
          <span className="text-muted-foreground">{win.label}</span>
        </div>
      </div>

      {game.pending && !deal && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-card p-3 text-sm">
          <span data-testid="pending-note">
            Fee agreed with{" "}
            {game.clubs.find((c) => c.id === game.players.find((p) => p.id === game.pending!.playerId)?.clubId)?.short ??
              "a club"}{" "}
            for {money(game.pending.fee)} — personal terms pending.
          </span>
          <Button size="sm" variant="outline" data-testid="clear-pending" onClick={cancelDeal}>
            Cancel
          </Button>
        </div>
      )}

      {game.offers.length > 0 && (
        <section className="space-y-2" data-testid="offers-list">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            Offers for your players
          </h2>
          {game.offers.map((o) => {
            const p = game.players.find((x) => x.id === o.playerId);
            const from = game.clubs.find((c) => c.id === o.fromClubId);
            if (!p || !from) return null;
            return (
              <div
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                data-testid={`offer-${o.id}`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">
                    {p.name} <span className="text-muted-foreground">→ {from.short}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.pos} · OVR {overallFor(p)} · bid {money(o.fee)} · valued {money(marketValue(p))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    className="h-11"
                    data-testid={`offer-accept-${o.id}`}
                    onClick={() => acceptIncoming(o.id)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11"
                    data-testid={`offer-reject-${o.id}`}
                    onClick={() => rejectIncoming(o.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {expiring.length > 0 && (
        <section className="space-y-2" data-testid="expiring-list">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            Contracts expiring
          </h2>
          {expiring.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#FFB020]/40 bg-card p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.pos} · OVR {overallFor(p)} · {money(p.contract.wage)}/wk · {cLabel(p.contract.until, game.season)}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-11 shrink-0"
                data-testid={`renew-${p.id}`}
                onClick={() => openRenew(p)}
              >
                Renew
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Scout a club
        </h2>
        <select
          data-testid="browse-club"
          value={browseId}
          onChange={(e) => setBrowseId(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold"
        >
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {!win.open && (
          <p className="text-[11px] font-semibold text-muted-foreground">
            The window is shut — offers can be made when it reopens.
          </p>
        )}
        <div className="space-y-1.5">
          {browse.map((p) => (
            <button
              key={p.id}
              data-testid={`target-${p.id}`}
              onClick={() => openBuy(p)}
              disabled={!win.open}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}>
                  {p.pos}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{shortName(p.name)}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    age {p.age} · OVR {overallFor(p)} · {money(p.contract.wage)}/wk
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold tnum">{money(marketValue(p))}</span>
            </button>
          ))}
        </div>
      </section>

      {frees.length > 0 && (
        <section className="space-y-2" data-testid="free-agents">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
            Free agents
          </h2>
          {frees.map((p) => (
            <button
              key={p.id}
              data-testid={`free-agent-${p.id}`}
              onClick={() => openFree(p)}
              disabled={!win.open}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}>
                  {p.pos}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{shortName(p.name)}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    age {p.age} · OVR {overallFor(p)} · wants {money(wageDemand(p))}/wk
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-primary">Sign</span>
            </button>
          ))}
        </section>
      )}

      {game.transferLog.length > 0 && (
        <section data-testid="transfer-log">
          <details className="rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              Transfer log
            </summary>
            <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              {game.transferLog.slice(0, 25).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <Sheet open={!!deal} onOpenChange={(o) => !o && setDeal(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          {deal && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {deal.kind === "buy" ? "Sign " : deal.kind === "renew" ? "New deal — " : "Free agent — "}
                  {deal.player.name}
                </SheetTitle>
                <SheetDescription>
                  {deal.player.pos} · age {deal.player.age} · OVR {overallFor(deal.player)} ·{" "}
                  {deal.player.clubId === ""
                    ? "free agent"
                    : (game.clubs.find((c) => c.id === deal.player.clubId)?.name ?? "")}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-8" data-testid="deal-sheet">
                {deal.step === "fee" && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Transfer fee</span>
                        <span className="tnum">
                          Value {money(marketValue(deal.player))} · Budget {money(fin.transfer)}
                        </span>
                      </div>
                      <input
                        data-testid="deal-fee-input"
                        type="number"
                        inputMode="numeric"
                        step={100000}
                        value={deal.fee}
                        onChange={(e) => setDeal({ ...deal, fee: Number(e.target.value) || 0 })}
                        className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
                      />
                      <div className="flex gap-2">
                        {[-10, -5, 5, 10].map((pct) => (
                          <Button
                            key={pct}
                            size="sm"
                            variant="outline"
                            className="h-11 flex-1 text-[11px]"
                            onClick={() =>
                              setDeal({
                                ...deal,
                                fee: Math.max(0, Math.round(deal.fee * (1 + pct / 100) / 10_000) * 10_000)
                              })
                            }
                          >
                            {pct > 0 ? `+${pct}%` : `${pct}%`}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {deal.counterFee !== undefined && (
                      <Button
                        variant="secondary"
                        className="h-11 w-full"
                        data-testid="deal-counter-accept"
                        onClick={() => doBid(deal.counterFee!)}
                      >
                        Accept their counter — {money(deal.counterFee)}
                      </Button>
                    )}
                    <Button
                      className="h-11 w-full"
                      data-testid="deal-bid"
                      disabled={!win.open}
                      onClick={() => doBid(deal.fee)}
                    >
                      {win.open ? `Bid ${money(deal.fee)}` : "Window closed"}
                    </Button>
                  </>
                )}

                {deal.step !== "done" && deal.step !== "fee" && (
                  <>
                    {deal.kind === "buy" && (
                      <div className="rounded-lg bg-muted/40 p-2 text-center text-xs font-bold tnum">
                        Fee agreed: {money(deal.fee)}
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Wages offered / week</span>
                        <span className="tnum">Headroom {money(headroom)}/wk</span>
                      </div>
                      <input
                        data-testid="deal-wage-input"
                        type="number"
                        inputMode="numeric"
                        step={1000}
                        value={deal.wage}
                        onChange={(e) => setDeal({ ...deal, wage: Number(e.target.value) || 0 })}
                        className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-bold tnum"
                      />
                      <div className="flex gap-2">
                        {[-10, -5, 5, 10].map((pct) => (
                          <Button
                            key={pct}
                            size="sm"
                            variant="outline"
                            className="h-11 flex-1 text-[11px]"
                            onClick={() =>
                              setDeal({
                                ...deal,
                                wage: Math.max(0, Math.round(deal.wage * (1 + pct / 100) / 500) * 500)
                              })
                            }
                          >
                            {pct > 0 ? `+${pct}%` : `${pct}%`}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {deal.counterWage !== undefined && (
                      <Button
                        variant="secondary"
                        className="h-11 w-full"
                        data-testid="deal-counter-accept"
                        onClick={meetTerms}
                      >
                        Meet his terms — {money(deal.counterWage)}/wk
                      </Button>
                    )}
                    <Button
                      className="h-11 w-full"
                      data-testid="deal-submit"
                      onClick={deal.kind === "buy" ? doTerms : deal.kind === "renew" ? doRenew : doFree}
                    >
                      {deal.kind === "renew"
                        ? `Offer ${money(deal.wage)}/wk`
                        : deal.kind === "free"
                          ? `Offer ${money(deal.wage)}/wk`
                          : `Offer terms — ${money(deal.wage)}/wk`}
                    </Button>
                  </>
                )}

                <p className={`text-xs font-semibold ${toneClass}`} data-testid="deal-msg">
                  {deal.msg}
                </p>

                {deal.step === "done" ? (
                  <Button className="h-11 w-full" data-testid="deal-done" onClick={() => setDeal(null)}>
                    Done
                  </Button>
                ) : (
                  <Button variant="ghost" className="h-11 w-full" onClick={() => setDeal(null)}>
                    Close
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
