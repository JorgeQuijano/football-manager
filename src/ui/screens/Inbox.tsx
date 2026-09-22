import { useState } from "react";
import { INBOX_KINDS, inboxFor, inboxUnread, type InboxKind } from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";

const kindTint: Record<InboxKind, string> = {
  match: "#2ED573",
  transfer: "#7EC8FF",
  press: "#C9A6FF",
  discipline: "#FFB020",
  board: "#FF9F6B",
  club: "#8B98A5"
};

export function Inbox() {
  const game = useGame((s) => s.game)!;
  const setScreen = useGame((s) => s.setScreen);
  const openItem = useGame((s) => s.openInboxItem);
  const markAll = useGame((s) => s.markInboxAllRead);
  const [kind, setKind] = useState<InboxKind | "all">("all");
  const items = inboxFor(game, kind === "all" ? undefined : kind);
  const unread = inboxUnread(game);

  return (
    <div className="space-y-3" data-testid="inbox-screen">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold">Inbox</h1>
          <p className="text-[11px] font-semibold text-muted-foreground" data-testid="inbox-count">
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex gap-1.5">
          {unread > 0 && (
            <Button size="sm" variant="outline" className="h-11" data-testid="inbox-read-all" onClick={markAll}>
              Mark all read
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-11" data-testid="inbox-back" onClick={() => setScreen("home")}>
            Back
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 pb-1">
        {([{ id: "all" as const, label: "All" }, ...INBOX_KINDS] as Array<{ id: InboxKind | "all"; label: string }>).map((k) => (
          <button
            key={k.id}
            data-testid={`inbox-filter-${k.id}`}
            onClick={() => setKind(k.id)}
            className={`h-11 shrink-0 rounded-lg px-3 text-[11px] font-bold ${
              kind === k.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground" data-testid="inbox-empty">
          Nothing here yet. Results, bids, press conferences and board notes all land in this feed.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <button
              key={i.id}
              data-testid={`inbox-item-${i.id}`}
              onClick={() => {
                const target = openItem(i.id);
                if (target) setScreen(target as never);
              }}
              className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left ${
                i.read ? "border-border bg-card opacity-80" : "border-primary/40 bg-card"
              }`}
            >
              <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: kindTint[i.kind] }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold">{i.title}</span>
                  <span className="shrink-0 text-[10px] font-semibold text-muted-foreground tnum">
                    S{i.season} R{i.round}
                  </span>
                </span>
                {i.body && <span className="mt-0.5 block text-[11px] text-muted-foreground">{i.body}</span>}
                <span className="mt-1 block text-[9px] font-bold uppercase tracking-wide" style={{ color: kindTint[i.kind] }}>
                  {INBOX_KINDS.find((k) => k.id === i.kind)?.label ?? i.kind}
                  {!i.read ? " · new" : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
