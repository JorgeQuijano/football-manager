import { ClubsCard } from "@/ui/ClubEditor";
import { useState } from "react";
import { Building2, HardHat, Landmark, PiggyBank, Store } from "lucide-react";
import {
  FACILITY_KINDS,
  FACILITY_MAX,
  bankToTransfer,
  groundCapacity,
  commercialSummary,
  facilityEffectLine,
  facilityLabel,
  facilitiesOf,
  FACILITY_COST,
  type FacilityKind,
  money
} from "@/engine";
import { useGame } from "@/state/store";
import { Button } from "@/components/ui/button";

const k = (n: number) => `£${Math.round(n / 1000)}k`;

function Pips({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-[3px]" data-testid="pips" aria-label={`level ${level} of ${FACILITY_MAX}`}>
      {Array.from({ length: FACILITY_MAX }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-full ${i < level ? "bg-primary" : "bg-white/12"}`}
        />
      ))}
    </span>
  );
}

export function Club() {
  const game = useGame((s) => s.game);
  const signSponsor = useGame((s) => s.signSponsor);
  const startBuild = useGame((s) => s.startBuild);
  const bank = useGame((s) => s.bankToTransfer);
  const [note, setNote] = useState<string | null>(null);
  if (!game) return null;

  const summary = commercialSummary(game);
  const fac = facilitiesOf(game, game.userClubId);
  const builds = game.builds ?? [];
  const offers = game.sponsorOffers ?? [];
  const club = game.clubs.find((c) => c.id === game.userClubId);

  const doBuild = (kind: FacilityKind) => {
    const res = startBuild(kind);
    setNote(res?.message ?? null);
  };
  const doSign = (id: string) => {
    const res = signSponsor(id);
    setNote(res?.message ?? null);
  };
  const doBank = () => {
    const res = bank(1_000_000);
    setNote(res?.message ?? null);
  };

  return (
    <section className="space-y-3 pb-4" data-testid="club-screen">
      <header className="px-1">
        <h1 className="text-xl font-extrabold tracking-tight">Club</h1>
        <p className="text-xs text-muted-foreground">
          {club?.name} · {groundCapacity(game, game.userClubId).toLocaleString()} seats
        </p>
      </header>

      {/* money */}
      <section className="rounded-2xl border border-border bg-card p-3" data-testid="club-money">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          <Landmark size={14} /> The account
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-background/60 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Club balance</div>
            <div className="text-lg font-extrabold tnum" data-testid="club-balance">
              {money(summary.balance)}
            </div>
          </div>
          <div className="rounded-xl bg-background/60 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Transfer kitty</div>
            <div className="text-lg font-extrabold tnum">{money(summary.transfer)}</div>
          </div>
        </div>
        <dl className="mt-2 space-y-1 text-xs">
          {(
            [
              ["Shirt sponsor", summary.sponsor ? `+${k(summary.sponsor)}/wk` : "—", "sponsor"],
              ["Commercial & merch", `+${k(summary.merch)}/wk`, "merch"],
              ["Gate (home games)", `+${k(summary.gate)} per match`, "gate"],
              ["Facility upkeep", `−${k(summary.upkeep)}/wk`, "upkeep"]
            ] as Array<[string, string, string]>
          ).map(([label, value, id]) => (
            <div key={id} className="flex items-center justify-between gap-2" data-testid={`line-${id}`}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={`font-semibold tnum ${value.startsWith("−") ? "text-[#FF8A8A]" : "text-primary"}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[10px] text-muted-foreground">
          League and broadcast money covers the wage bill — the account is yours to invest.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-11 w-full"
          data-testid="bank-transfer"
          onClick={doBank}
          disabled={summary.balance < 500_000}
        >
          <PiggyBank size={15} /> Move £1.0m into the transfer kitty
        </Button>
      </section>

      {/* sponsor */}
      <section className="rounded-2xl border border-border bg-card p-3" data-testid="club-sponsor">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          <Store size={14} /> Shirt sponsorship
        </h2>
        {summary.sponsorName ? (
          <div className="mt-2 rounded-xl bg-background/60 p-2.5">
            <div className="font-bold" data-testid="sponsor-current">
              {summary.sponsorName}
            </div>
            <div className="text-xs text-muted-foreground">
              {k(summary.sponsor)}/wk · runs to season {summary.sponsorUntil}
            </div>
          </div>
        ) : offers.length ? (
          <ul className="mt-2 space-y-2">
            {offers.map((o) => (
              <li key={o.id} className="rounded-xl border border-border bg-background/60 p-2.5" data-testid={`offer-${o.id}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{o.name}</span>
                  <span className="font-extrabold tnum text-primary">{k(o.weekly)}/wk</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{o.tagline}</p>
                <p className="text-[10px] text-muted-foreground">
                  {o.seasons} season{o.seasons > 1 ? "s" : ""} · {money(o.bonus)} signing payment
                </p>
                <Button
                  size="sm"
                  className="mt-2 h-11 w-full"
                  data-testid={`sign-${o.id}`}
                  onClick={() => doSign(o.id)}
                >
                  Sign with {o.name}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="sponsor-none">
            No offers on the table — the market opens again next summer.
          </p>
        )}
      </section>

      {/* facilities */}
      <section className="rounded-2xl border border-border bg-card p-3" data-testid="club-facilities">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          <Building2 size={14} /> Facilities
        </h2>
        <ul className="mt-2 space-y-2">
          {FACILITY_KINDS.map((kind) => {
            const level = fac[kind];
            const building = builds.find((b) => b.kind === kind);
            const maxed = level >= FACILITY_MAX;
            const cost = FACILITY_COST[kind];
            const canAfford = summary.balance >= cost;
            return (
              <li key={kind} className="rounded-xl border border-border bg-background/60 p-2.5" data-testid={`fac-${kind}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{facilityLabel(kind)}</span>
                  <Pips level={level} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{facilityEffectLine(kind, level)}</p>
                {building ? (
                  <p className="mt-1 text-[11px] font-semibold text-[var(--warn)]" data-testid={`building-${kind}`}>
                    <HardHat size={12} className="mr-1 inline" />
                    Level {building.to} in {building.weeksLeft} week{building.weeksLeft > 1 ? "s" : ""}
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant={maxed ? "ghost" : "outline"}
                    className="mt-2 h-11 w-full"
                    data-testid={`build-${kind}`}
                    disabled={maxed || !canAfford}
                    onClick={() => doBuild(kind)}
                  >
                    {maxed
                      ? "Top level"
                      : canAfford
                        ? `Upgrade to ${level + 1} · ${money(cost)}`
                        : `Needs ${money(cost)}`}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Training drives development, the academy sets youth ceilings, the medical centre shortens injuries, the
          stadium fills the gate.
        </p>
      </section>

      <ClubsCard />

      {note && (
        <p className="px-1 text-xs font-semibold text-primary" data-testid="club-note">
          {note}
        </p>
      )}
    </section>
  );
}
