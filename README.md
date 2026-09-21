# Touchline (football-manager)

A mobile-first football management game that runs entirely in the browser. Working title: **Touchline**.

**Play:** https://jorgequijano.github.io/football-manager/

MVP scope: one league, 10 fictional clubs, an 18-round season, live match commentary, tactics, saves. See `REQUIREMENTS.md`.

## Stack

- TypeScript (strict) · React 19 · Vite · Tailwind CSS v4
- shadcn/ui components (Base UI primitives) — Tunnel theme
- zustand (state) · idb-keyval (saves) · vite-plugin-pwa (offline play)
- Vitest (engine tests)

## Scripts

```sh
npm run dev                            # dev server
npm test                               # engine test suite
npm run sim -- --seed 42 --match       # headless season simulation (CLI)
npm run build                          # typecheck + production build
npm run preview                        # serve the production build
```

## How it works

- Deterministic engine: same seed + same decisions = same season (seeded RNG, no hidden state).
- Everything runs locally — no backend. The save lives in IndexedDB and can be exported as JSON (Settings → Export).
- The game is a PWA: offline after first load, installable to the home screen.
- Engine internals are documented for contributors in `docs/ENGINE.md` — deliberately not surfaced anywhere in the game UI.

## Repo layout

- `src/engine/` — pure TS game world (world generation, fixtures, match sim, ratings, tuning knobs)
- `src/state/` — zustand store + save/load/export
- `src/ui/` — screens and sheets
- `scripts/sim.ts` — headless season CLI
- `docs/ENGINE.md` — engine reference (data model, simulation, roles, conditioning, tuning, invariants) — **repo-only, not user-facing**
- `REQUIREMENTS.md` — MVP scope · `component-libraries.md` — UI research · `theme-preview.html` — Tunnel palette preview
