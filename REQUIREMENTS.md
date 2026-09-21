# Football Manager Clone — MVP Requirements

**Status:** MVP built — 2026-09-21 (engine + UI + PWA in this repo)
**Stack decision:** TypeScript (locked, 2026-09-21)
**Working title:** TBD — do not ship under "Football Manager" (trademark)

---

## 0. Summary

A single-player football management game that runs entirely in the browser: mobile-first, installable PWA, no backend, no accounts, no network needed after first load.

**Core loop:** advance → prepare (lineup/tactics) → play match day → results/table → repeat, until season end.

**MVP goal:** prove the loop is fun on a phone in short sessions, with a real season arc, on real devices. If validated → invest in squad-building depth (transfers etc.).

**Validation cohort:** Jorge + 3–5 friends, each playing 3+ sessions before deciding next investment.

---

## 1. Scope

### 1.1 P0 — must ship (MVP)

**G1. New game**
- One league, 10 fictional clubs. Club-select screen: name, color chip, city; pick + confirm. No account, no forms, no tutorial gate.
- Seed captured at new-game time; shown in Settings (bug reports + reproducibility).

**G2. Squad**
- 22 players per club. Fields: name, age (17–35), position (GK/DF/MF/FW), attributes, condition (0–100%).
- Attributes (0–99): Pace, Shooting, Passing, Defending, Physical; GKs additionally Reflexes, Handling.
- Derived OVR per position (weighted formula lives in engine; shown in list + detail).
- Squad screen: sortable list (position / OVR / age / condition), tap → player detail sheet (attributes, age, condition, minutes played, goals).

**G3. Tactics / lineup**
- Formation presets: 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2 — chosen via a single native `<select>` (no chip walls).
- XI assignment: tap slot → picker sorted by suitability (natural position first) → tap player. Tap-tap swap, no drag in P0.
- Bench: 7 slots, auto-filled by default, replaceable the same way.
- "Auto pick" button: best XI for the chosen formation.
- Mentality: Defensive / Balanced / Attacking (single segmented control).
- Validation before advancing into a match: 11 selected, exactly 1 GK, no injured/suspended players.

**G4. Match day**
- Calendar: 1 round per week; 18 rounds (double round-robin, 10 clubs).
- Your match: live screen — minute clock (1 tick = 1 match minute), score, commentary feed, event log.
- Controls: Watch (~500ms per simulated minute) and Skip-to-end.
- Engine events: goal, shot saved, shot off target, yellow/red card, injury, auto-substitution (max 5 subs; engine substitutes for injury/fatigue).
- Other fixtures simulate instantly; results visible after advancing.
- Post-match: scoreline, scorers, table snippet (your position movement), next fixture.

**G5. League & season**
- Table: P W D L GF GA GD Pts; sorted Pts → GD → GF.
- Fixtures/results browsable by round.
- Season end: final table + champion banner. "Next season" continues the save: same clubs, players age +1, condition reset, fresh fixtures. No attribute development yet (P1).

**G6. Persistence**
- Autosave after every state change (debounced ~500ms) to IndexedDB (single slot).
- Resume after tab kill/reopen exactly where you left off. Exception: killed during a live match → that match restarts from kickoff (match state is not snapshotted mid-tick).
- Export / import save as a JSON file.

**G7. Settings / help**
- Theme: system / light / dark, single cycle button, system default, **no flash on load** (required, standing).
- Help sheet: rules in 30 seconds (points, season length, how lineup/tactics work).
- Reset / new game. Seed display + copy.

**G8. PWA**
- Manifest + service worker; installable (Android + iOS); offline play after first load; standalone full-screen display.

### 1.2 Explicitly NOT in MVP (do not build)

Transfers, transfer market, finances/wages, contracts, morale, team talks, player instructions, set-piece setup, training, youth academy, scouting, staff, cups, promotion/relegation, multiple leagues, attribute development, 2D pitch view, replays, highlights, achievements, leaderboards, online/multiplayer, accounts, backend, analytics, ads, monetization, i18n, editor, sound/music.

### 1.3 P1 — first slices after validation (indicative order)

1. Transfers: free agents + a simple market; fees/wages-lite; minimal AI club business.
2. Player development: growth/decline by age + minutes; form; morale.
3. In-match control: user substitutions + half-time adjustment.
4. 2D dots view driven by engine events; match speed presets.
5. Cups; richer season structure.

---

## 2. UX & screens

Mobile-first gate (mandatory, standing): design 320 → 1280+; primary target 375–414. No horizontal scroll anywhere; tap targets ≥44px; no hover-only interactions; touch-first forms. Desktop is an enhancement, never the only place it works.

- Navigation: bottom tab bar (Home / Squad / Tactics / League). Match and Season-end are full-screen flows with explicit back/continue.
- One primary CTA per screen. Matchday iteration ≤ 3 taps (Continue → optionally adjust → Watch/Skip).
- Safe-area insets respected (iOS notch, bottom bar).
- Theme selector required (single icon cycle, system default, no flash).
- No spinners — everything is local and instant. Tabular numbers (`font-variant-numeric: tabular-nums`) in tables/scores.
- Accessibility basics: labels on controls, ~AA contrast, visible focus, `prefers-reduced-motion` respected.

### Screens (7)

| # | Screen | Purpose | Key elements |
|---|--------|---------|--------------|
| 1 | Home | dashboard | club header (name, color, league position, pts), next fixture card, **Continue** CTA, last result, mini-table (top 5 + you) |
| 2 | Squad | manage players | sortable/filterable list, player detail sheet |
| 3 | Tactics | set up team | pitch diagram (11 slots), bench strip (7), formation select, mentality, auto-pick, validation hints |
| 4 | League | standings | Table tab / Fixtures tab |
| 5 | Match | live match | score header, clock, commentary feed (latest visible), event list, Watch / Skip |
| 6 | Season end | season closure | final table, champion banner, continue (next season) |
| 7 | Settings / Help | config | theme cycle, seed, export/import, reset, help sheet |

### Wireframe sketches (mobile, 375px)

```
HOME                        TACTICS                    MATCH
┌─────────────────┐         ┌─────────────────┐        ┌─────────────────┐
│ ⬤ Northport FC  │         │ Formation [4-3-3▾]│       │ Northport 2-1   │
│ 3rd · 21pts     │         │ ┌───────────────┐ │       │ Ironvale        │
├─────────────────┤         │ │    pitch      │ │       │       67'       │
│ Next: vs        │         │ │  ○ ○ ○        │ │       ├─────────────────┤
│ Ironvale (H)    │         │ │  ○ ○ ○ ○      │ │       │ 67' GOAL! J.Mora│
│ Round 12        │         │ │  ○ ○ ○        │ │       │ 64' Yellow: ... │
│ [  CONTINUE  ]  │         │ └───────────────┘ │       │ 61' Save by GK  │
├─────────────────┤         │ Bench: ○ ○ ○ ○ ...│       │ ...             │
│ Last: 2-1 W     │         ├─────────────────┤        ├─────────────────┤
│ Table           │         │ [Auto pick]      │        │ [Skip] [1x ▾]   │
│ 1. ...  24      │         │ Mentality ▮▮▮    │        └─────────────────┘
└─────────────────┘         └─────────────────┘
```

---

## 3. Technical requirements

### Stack (locked)

- TypeScript strict everywhere + ESLint.
- React + Vite (SPA). Tailwind CSS v4.
- State: zustand (single small store). Engine state stays plain serializable objects.
- Persistence: idb-keyval (one key). No ORM, no Dexie.
- PWA: vite-plugin-pwa (workbox precache of app shell).
- Tests: Vitest.
- Component library: TBD — 5 candidates evaluated (see `component-libraries.md`).
- No backend, no network calls, no external fonts (system stack), no analytics.

### Repo layout

```
football-manager/
  src/
    engine/           # pure TS, no DOM — the game world
      rng.ts          # mulberry32 seeded PRNG
      types.ts        # Player, Club, Fixture, MatchEvent, SaveGame
      generate.ts     # world + player generation
      league.ts       # fixtures (circle method), table logic
      match.ts        # minute-tick match sim + commentary
      advance.ts      # advance-week orchestration
      tuning.ts       # ALL balance constants (calibration knobs)
    data/league.json  # committed generated world (fictional)
    state/store.ts    # zustand store + save/load glue
    ui/               # screens + components
    main.tsx
  scripts/sim.ts      # headless CLI (M0 spike tool)
  tests/              # vitest
```

### Engine rules

- Pure functions only; all randomness via an injected `Rng` instance.
- Deterministic: same seed + same decisions = identical outputs (numbers bit-for-bit).
- No DOM/React imports inside `src/engine/` (enforced by a test that greps imports).
- Must run in Node (CLI + tests) and browser — single source of truth.
- Every balance number lives in `tuning.ts`.

### Match simulation spec

- Minute ticks 1–90 (+1–5 stoppage).
- Per minute: possession/attack chance roll from team strength (ATK vs DEF), home advantage modifier, mentality modifier, condition modifier.
- Chance resolution: shooter weighted by position/role + Shooting; outcome = goal / saved / off target vs GK ability.
- Discipline: fouls → yellow (small %), second yellow = red, straight red rare. Red card = 1-match ban.
- Injuries: small per-match probability; missed matches 1–4 weeks.
- Condition: drops during match (more for low Physical), recovers weekly (full by next match unless aged… keep simple: +40/day).
- Auto-subs: injury replacement + fatigue subs, max 5.
- Player ratings 4.0–10.0 (start 6.0, adjust by events).
- Commentary: templated strings with ≥5 variants per event type (cheap depth).

### Calibration targets (verified over ≥1000 headless seasons)

- Avg goals/match: 2.4–3.0
- Home W/D/L: ≈ 44 / 26 / 30 (±4)
- Cards: ≈ 3–5 per match
- Injuries: ≈ 0.3 per match
- Champion points (18 rounds): ≈ 38–50

### League generation

- Double round-robin, circle method; rounds map to consecutive weeks.

### Persistence

- Save = full-state JSON snapshot: `{ saveVersion, seed, season, clubId, clubs, players, fixtures, results, settings }`.
- `saveVersion` + migration stub; import validates schema and rejects gracefully.

### Performance budgets

- Initial JS ≤ 250 KB gz (goal 150–180).
- First load < 2s on mid-range Android over 4G. Lighthouse mobile ≥ 90.
- Full 18-round league sim < 100 ms; one match sim < 10 ms.
- Main thread only (no Web Worker) — revisit only if profiling shows jank.

### Browsers / deploy

- iOS Safari ≥ 16.4, Android Chrome (last 2), desktop evergreen.
- Deploy: GitHub Pages via GitHub Actions (main → build → deploy; set Vite `base` + PWA scope/start_url for the subpath). Alternative: Vercel — trivial swap.

### Testing & QA gates

- Vitest: RNG determinism; generation invariants (10×22, attribute ranges); fixture validity (every pair twice, one home one away); table math (ΣGF = ΣGA; 3/1/0 points); full-season completes; save serialize→parse identical; **golden seed test** (seed + scripted decisions → hashed result snapshot).
- Mobile QA (per mobile-first-mvp): widths 320/375/390/414/768/1280+; no-overflow assertions; CDP touch pass on critical path (tap-to-swap, Continue, Watch/Skip); real-device pass on iPhone + Android before declaring done.
- Manual flows: cold start → club pick → full season → season end; kill & resume; export/import; offline (airplane mode); install (standalone).

---

## 4. Milestones (spike → validate → full run)

**M0 — Engine spike (CLI only).** Prove the sim: `npm run sim -- --seed 12345 [--match]` prints a season (table + your match commentary). Determinism + calibration tests green. *Gate: numbers in calibration range; full season < 100 ms.*

**M1 — Vertical slice.** Pick club → auto lineup → play one match (live view) → table updates. Deployed to a URL for phone testing. Mobile gate on the slice. *Gate: loop feels right on a phone; fix before M2.*

**M2 — Full MVP.** All P0: tactics editing, full season, saves, PWA, settings/theme, help; QA gates pass; deployed + installed on test devices.

**M3 — Validation.** Jorge + friends, 3+ sessions each, friction log → decide P1 (transfers first, most likely).

Rough effort shape (not a promise): M0 = 2–4 evenings · M1 ≈ 1 week · M2 = 1–2 weeks · M3 ongoing.

---

## 5. Acceptance criteria (MVP is "done" when…)

1. Fresh visitor → first kickoff in ≤ 60 s and ≤ 5 taps on a phone.
2. Full season playable end-to-end at 375px; zero horizontal scroll on every screen; all tap targets ≥ 44px.
3. Kill browser mid-season → reopen → exact state restored.
4. Same seed → identical season outcome across runs (CI golden test).
5. Table invariants hold after every round (ΣGF = ΣGA; total points per match ∈ {2,3}).
6. Offline: after first load/install, airplane mode → full game playable.
7. Installable PWA on Android and iOS; standalone display; icon correct.
8. Theme cycle works, persists, no flash on load.
9. Export/import round-trips the save exactly.
10. Perf budgets met (JS ≤ 250 KB gz; Lighthouse mobile ≥ 90; sim timing budgets).
11. Season end reached; champion = table top; "Next season" works (age +1, fresh fixtures).
12. Commentary consistent with score/events for all goals.
13. No console errors during a full-season playthrough.
14. CDP touch test passes on critical path; real-device pass recorded.

---

## 6. Risks & open questions

- **Balance risk:** match-engine tuning is the rabbit hole. Mitigation: all knobs in `tuning.ts` + calibration tests; timebox M0.
- **Fun risk:** commentary flavor carries perceived depth — budget variants (≥5 per event type).
- **Scope-creep guardrail:** nothing enters P0 without cutting something else.
- **Tradeoff noted:** no backend → no online/multiplayer ever without a server; accepted for MVP.
- **Legal:** fully fictional data. No real club/player/league marks. Avoid "Football Manager" in naming/branding.
- **Open:** product name; GH Pages vs Vercel (default GH Pages); 10-club league OK?; transfers confirmed as first P1.

## 7. Reference notes (prior art)

- `openfootmanager/openfootmanager` — OSS manager game: Rust engine + Tauri + React/TS (desktop-first; heavier).
- `lfrmonteiro99/football_fantasy` — tick-based engine design notes (Laravel SSE backend; useful engine structure reference: causal event chains, fatigue, set pieces, commentary builder).
- `NicholasHutfilz/boardroomfc` — Next.js + Supabase, AI-driven sim (backend-heavy).
- Takeaway: existing OSS attempts lean backend-heavy; our MVP deliberately local-only, static-deployable.

---

## 8. Changelog

- 2026-09-21 — MVP built & deployed (deterministic engine, mobile-first screens, PWA, GitHub Pages).
- 2026-09-21 — **Tactics v2**: slot roles (11 roles, attribute-weighted attack/defense/shot/finish), real fitness loop (age/physical-based recovery, condition bars on chips, injury risk scales with fatigue), true per-formation pitch geometry with out-of-position flags, picker with role choice + Top pick/Δ-vs-incumbent/fit sorting, auto-pick menu (Best XI / Freshest XI), one-tap "Rest them" suggestions, team-strength strip vs next opponent.
- 2026-09-21 — **Custom formations**: full-screen builder — drag slots to move them, tap one to change its position; validated live (11 slots, exactly 1 GK, on-pitch bounds) and saved per save file with a name. Custom shapes resolve through lineup fill, auto-pick, formation remap (players stay), and the match engine; edit + delete (two-tap confirm) from the Tactics formation picker.
