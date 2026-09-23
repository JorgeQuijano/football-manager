import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const CYCLE: Mode[] = ["system", "light", "dark"];

const LABEL: Record<Mode, string> = { system: "System", light: "Light", dark: "Dark" };
const nextMode = (m: Mode): Mode => CYCLE[(CYCLE.indexOf(m) + 1) % CYCLE.length];

/** What the pre-paint script in index.html is holding (defined there, always by now). */
function readMode(): Mode {
  const t = (window as unknown as { THEME?: { get: () => string } }).THEME;
  let m = "system";
  try {
    m = t ? t.get() : localStorage.getItem("touchline-theme") || "system";
  } catch {
    m = "system";
  }
  return m === "light" || m === "dark" ? m : "system";
}

function applyMode(mode: Mode) {
  const t = (window as unknown as { THEME?: { set: (m: string) => void } }).THEME;
  if (t) t.set(mode);
  else {
    try {
      localStorage.setItem("touchline-theme", mode);
    } catch {
      /* private mode */
    }
    const dark =
      mode === "dark" ||
      (mode === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    const el = document.documentElement;
    el.setAttribute("data-theme", dark ? "dark" : "light");
    el.setAttribute("data-theme-mode", mode);
    el.classList.toggle("dark", dark);
  }
}

/**
 * One icon button: System → Light → Dark (v0.40).
 *
 * The three icons are all in the DOM and CSS shows the one matching the CHOICE
 * — because System and Light look identical on a light phone, the fading chip
 * underneath is what tells you the tap did something.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>(readMode);
  const [chip, setChip] = useState<Mode | null>(null);

  // keep in step with the OS while the mode is "system"
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = () => {
      if (readMode() === "system") setMode("system");
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!chip) return;
    const t = setTimeout(() => setChip(null), 1400);
    return () => clearTimeout(t);
  }, [chip]);

  const label = `Theme: ${LABEL[mode]} — switch to ${LABEL[nextMode(mode)]}`;

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        id="theme-toggle"
        data-testid="theme-toggle"
        aria-label={label}
        title={label}
        onClick={() => {
          const next = nextMode(mode);
          applyMode(next);
          setMode(next);
          setChip(next);
        }}
        className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground"
      >
        {/* monitor */}
        <svg className="ti ti-system" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        {/* sun */}
        <svg className="ti ti-light" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.5" />
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="4.2" y1="4.2" x2="6" y2="6" />
          <line x1="18" y1="18" x2="19.8" y2="19.8" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
          <line x1="4.2" y1="19.8" x2="6" y2="18" />
          <line x1="18" y1="6" x2="19.8" y2="4.2" />
        </svg>
        {/* moon */}
        <svg className="ti ti-dark" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </button>
      <span
        id="theme-chip"
        role="status"
        aria-live="polite"
        data-testid="theme-chip"
        className={`absolute -bottom-1 left-1/2 z-50 -translate-x-1/2 translate-y-full whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-foreground shadow-sm ${
          chip ? "show" : ""
        }`}
      >
        {chip ? LABEL[chip] : ""}
      </span>
    </span>
  );
}
