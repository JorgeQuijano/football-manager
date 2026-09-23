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

- Initial JS ≤ 260 KB gz (goal 150–180). Raised from 250 in v0.42: the law layer (`laws.ts`, offside/back-pass/handball/restarts) is real engine content at ~1.2 KB gz, not glue.
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
10. Perf budgets met (JS ≤ 260 KB gz; Lighthouse mobile ≥ 90; sim timing budgets).
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
- 2026-09-21 — **Attribute-deep match events**: role-weighted finishing (`roleFinish` — Target Men finish with physique, Poachers with shooting/pace, Wing-Backs with pace), assists (82% of goals credited to a passing-weighted teammate, +0.4 rating, named in commentary, tracked per player), blocks (~20% of non-goal outcomes, defence-scaled, credited to the best-placed defender), attribute-driven fouls (sloppy defending and physique raise a player's foul odds). `assists` added to player records and shown in Squad + player sheet; save migration backfills it. `docs/ENGINE.md` updated.
- 2026-09-21 — **FM-style roles v3**: roster expanded 11 → 26 roles (GK 2, DF 7, MF 10, FW 7) — Full-Back, Inverted Full-Back, Libero, No-Nonsense CB, Central Midfielder, Anchor, Deep-Lying Playmaker, Mezzala, Shadow Striker, Winger, Inverted Winger, Advanced Forward, Complete Forward, Deep-Lying Forward, Inside Forward. Every role carries its own attribute weights + shot/finish/**assist** bias + a **lane** (wide/central); assists are now role-weighted in the sim. Formation synergy: each built-in formation ships a hand-tuned role template (auto-picks arrive shaped, e.g. 5-3-2 with wing-backs), custom shapes get geometry-based defaults; the picker flags off-lane roles and suggests the best role for the player already in the slot.
- 2026-09-21 — **Zone-constrained builder + slot roles**: formation slots are confined to field zones — goalkeepers stay in their box (y 82–94), defenders behind the halfway line (y 48–90), midfielders in the middle third (y 26–72), forwards up top (y 8–48) — enforced while dragging (live zone overlay shows the band) and when changing a slot's position (it snaps into the new zone). Custom slots can carry a preferred default role from their own position group (forward slots only ever offer forward roles), picked per slot in the builder and honoured by auto-pick + formation switches. Legacy out-of-zone customs still load.
- 2026-09-21 — **Live 2D match + half-time + PL substitution rules**: the match is now a pauseable live simulation — a top-down 2D pitch renders every possession (pass chains, shots, saves, blocks, turnovers, fouls) with players moving in their shape and mentality affecting how high the lines push; playback at 1x/2x/4x with play/pause, skip-to-HT / skip-to-FT and a synced commentary feed + live possession/shots stats. **Half time now stops the match** so you can make changes: substitutions, mentality and per-slot roles, all applied by re-simulating from the half's base state (everything before your change stays identical). Substitutions follow **Premier League rules: 5 subs, 3 in-match windows, half-time free, no returns** — the engine validates and explains. The live match (state + timeline + playhead) is persisted, so a reload mid-match resumes where you were. Engine stays deterministic: splitting at half time reproduces the one-shot result byte-for-byte (test-enforced).
- 2026-09-21 — **PWA update hardening (0.7.1)**: installed clients now apply new deploys automatically — the service worker is re-checked on boot, every 15 minutes and whenever the app regains focus, and a new version reloads the page in place (verified end-to-end: a stale client picked up a new deploy ~3 s after focus, no manual action). Settings shows the running version, and `window.__fmVersion` exposes it for bug reports. Clients older than 0.7.1 need one manual reload/reopen round (PWA caching) before they reach this behaviour.
- 2026-09-22 — **Match view movement (0.7.2)**: players now move like a football team in the 2D view. Both blocks slide with the ball (defenders drop as it nears their goal, push up as it advances), the closest 3–4 players converge into a contest on the carrier (pressing pack when defending), attackers run beyond their base as play progresses, receivers burst to meet passes, and everything moves at capped sprint pace so runs read as runs. Ball flights now home in on players' live positions instead of frozen points, and a white ring marks whoever is on the ball. Measured: 21/22 players in motion, top movers covering 13 pitch-units per 2.5 s.
- 2026-09-22 — **Role & attribute-driven movement (0.7.3)**: movement is now engine-owned and individual — `motion.ts` defines per-role instructions (press / support / push / drop / width / roam / recovery / break) for all 26 roles, folded with each player's attributes: pace sets on-screen top speed and acceleration, physical sets stamina-driven roaming, slot geometry decides how strictly width is held. Behaviour follows the game phase: **in possession** roles push up, offer for the ball and hold or leave their width; **out of possession** they drop into shape and the most eager roles (BWM, Pressing Forward) close down; the **2.5 s after a turnover** is a transition — the team that won the ball breaks, the team that lost it recovers at sprint pace. Every dot drifts on its own phase, so nothing moves in lockstep. Verified: speeds 5.5–16 pitch-units/s across the XI, all four phases occur in play, pace↔screen-speed correlation r = 0.81.
- 2026-09-22 — **Set plays + playback speed (0.8.0)**: the match now plays out the full set-piece vocabulary. **Corners** (from blocks, parried saves and balls out in the final third ≈ 10.7/match) — the best crosser swings it in, the best header attacks it, clearances and recycled second corners included; **direct free kicks** from fouls in range (≈ 1.8/match) with a wall, saves and the occasional top-corner finish; **penalties** (≈ 0.23/match) taken by your best finisher, saved or blazed over; **goal kicks** after misses and throw-ins tagged on every ball out. Fouls vs cards are now separate dials (20 fouls → ≈ 3.6 cards), and set-piece goals fold into the calibration (2.8 goals/match). The 2D view **stages every set piece**: players jog to position (corners load the box, penalties put the taker on the spot with everyone on the arc, free kicks build a wall) before the delivery plays out. Plus an explicit **Speed control (1x / 2x / 4x / 8x)** in the match controls — a visible segmented picker instead of a cycling button — and your choice is remembered between matches.
- 2026-09-22 — **Player decisions (0.9.0)**: players now decide for themselves. On top of the role profiles, every player picks an **intent** every few seconds — hold shape, offer a pass, come short, stay wide, run in behind, overlap; hold the line, press the ball, cover, drop deep; break, spread, recover, delay — weighted by their role, their attributes, the team's **mentality**, the game phase and the situation (ball position, distance to the ball, the lane they're in). Each player runs a private seeded RNG stream and re-decides on his own clock, so the two blocks never move in lockstep: measured 7–12 distinct intents per player within 40 s of play, zero phase mismatches. **Mentality now visibly changes movement**: attacking ≈ 2.7× more press-the-ball intents and more forward runs; defensive means more cover/dropping and a deeper block. Keepers stay on their line. The decision layer lives in the engine (`intents.ts`) and is unit-tested: determinism per stream, phase gating, role and mentality orderings, keeper restrictions, target sanity.
- 2026-09-22 — **Roles, behaviours & traits (0.10.0)**: role vocabulary expanded to **32** with six roles straight from the FM24 behaviour guide — **Half Back** (drops between the centre-backs), **Regista** (runs the game from deep), **Carrilero** (shuttles to cover the flank), **Trequartista** (roams free, doesn't track back), **Defensive Winger** (hounds the full-back) and **False Nine** (drops in, attacks the space) — each with its own weights, movement profile and a one-line behaviour description shown in the picker. Every player now has **traits** (0–2): *Shoots on Sight*, *Tries Killer Balls*, *Presses Relentlessly*, *Marks Tightly*, *Dives Into Tackles*, *Stays Back*, *Arrives in the Box*, *Drives With the Ball*, *Dead-Ball Specialist*, *Leader* — generated from their attributes (a 90-shooting striker is far likelier to shoot on sight than a 45-shooting one) and wired into the engine: they bend shooter/assist/foul/set-piece weighting in the sim, intent choice in the decision layer, and roaming/push/recovery in movement. Traits show as chips in the picker and with blurbs in the player detail. Corners now defend with **man-marking** — each marker picks up the attacker of the same rank, goal-side (measured: 11 of 16 box players within 2–5 units of an opponent). Calibration holds at 2.84 goals/match with 10.6 corners, 0.26 pens, 1.77 free kicks, 3.67 cards; 59 engine tests green.
- 2026-09-22 - **Transfers, contracts & wages (0.11.0)**: the squad-building loop is in. Every player now has a **contract** (weekly wage + expiry season) and every club a **transfer budget** and **wage budget**; a 92-rated star values at about 5-9m on 99k/wk, and budgets refresh every pre-season from squad value and the wage bill. **Transfer windows** follow the 18-round season: summer = rounds 1-3, winter = rounds 9-10, shut otherwise. The **Transfer centre** screen (new tab) shows budgets, wage headroom and window state, lists clubs you can scout, players with values and wages, free agents and a transfer log; tap a player to **bid a fee** with quick +/-% buttons. Bidding is a real two-step negotiation: the selling club accepts, counters or laughs you off depending on the fee vs his value and how important he is to them (their top-2 players cost about 1.35x), then the player wants the right wage - meet his terms or you lose him. You can **sell** too: rival clubs bid for your best players during windows (offers appear for accept/reject), **renew** expiring contracts any time (the screen flags who is running out - if you don't, they walk at season end), and **sign free agents** for wages only. The rest of the league plays the same market: AI clubs buy from each other during windows, re-sign about 85% of expiring players and release the rest into a free-agent pool (with a small yearly intake). All of it is seeded and deterministic - the same save and the same bid always produce the same answer - and 10 new engine tests cover values, wages, budgets, windows, the bid ladder, the signing maths and the season rollover (69 tests green).
- 2026-09-22 - **Training & player development (0.12.0)**: players now grow and decline between rounds. Every player has a **potential ceiling** (POT) and a **room to grow**; teenagers who play regularly develop fastest (a 17-21 starter on a focused plan gains 2-4 attribute points a season), 24-26 is the plateau, 30+ starts to slide - mostly pace and stamina, keepers lose reflexes and handling. A new **Training** tab holds the levers: **team focus** (Balanced, Attacking, Defending, Passing, Physical, Set pieces, Recovery - each with its own per-position attribute weights and a one-line description) and **intensity** (Light / Normal / Heavy - heavy grows faster but recovers slower and risks the odd training knock). Every player can also carry an **individual focus** attribute (set from his player sheet) for a strong extra nudge, and the Training screen shows this season's movers with +/- attribute chips, the squad's most room to grow, and development news. Training also shapes **traits**: young regulars can pick up the trait that matches the unit they train (attacking -> Shoots on Sight, passing -> Tries Killer Balls, defending -> Marks Tightly, physical -> Presses Relentlessly, set pieces -> Dead-Ball Specialist) at season end, and every club's academy now produces **1-2 graduates a year** (16-18 year olds on cheap deals with high ceilings) so the world renews itself - players retire at 38. AI clubs train the same rules with their own focus per season. All of it is seeded (same save = same careers) and 10 new engine tests cover the age curves, minutes/condition/intensity scaling, focus steering, ceilings, determinism, trait learning and the academy intake (80 tests green).
- 2026-09-22 - **Squad planner (0.13.0)**: the Squad screen now has a **Planner** tab next to the roster. It shows your **experience matrix** (Breakthrough / Emerging / Peak / Experienced / Veteran - age brackets tilted by room to grow, with counts and bars), squad stats (size, average age, wage bill) and a **depth chart per line** (GK/DF/MF/FW), each with the formation's slots and roles for that line and your players ranked 1st-choice down, tagged with their career stage and contract state. Depth is graded **GAP / THIN / OK / DEEP** against sensible minimums per line, and any line that is short gets a one-tap **'scout a FW in the market'** button that jumps to the Transfer centre. A **This season / Next season** toggle projects the post-rollover squad: ages tick up, players who are **out of contract or retiring are struck through** and excluded from the depth count, and you can see the wages that would walk free. Combined with contracts and training this is the rebuild view: who's aging, who's leaving, which line needs a signing and which kids are coming through.
- 2026-09-22 - **Set-piece creator (0.14.0)**: you now author your set pieces. The Tactics screen has a **Set pieces** card (with your current routines and familiarity at a glance) opening a full creator: **attacking corners** — Near post (flick-on, the big men attack the first ball, fewer second phases), Far post (the balanced default), Short corner (keeps the move alive, low direct threat) or Edge of the box (pulled back for a finisher) — and **attacking free kicks** — Shot, Cross it in (a headed delivery, the taker gets the assist) or Work it short. Each routine has its own real effect in the engine (goal chance and second-phase rates, who the delivery targets). You also **nominate takers** for corners, free kicks and penalties (Dead-Ball Specialists starred); a nominated taker only takes it when he's on the pitch, otherwise the best available steps up. **Familiarity** grows every match (+50% faster when you train Set pieces) and is remembered per routine — a new routine starts rusty (25%) and switching back to a grooved one still works. The 2D match **stages your routine**: near-post clusters, far-post loads, two players over a short corner, box-loading for crossed free kicks — and the defence man-marks accordingly. Deterministic throughout; 10 new engine tests (routines, familiarity, takers, fallbacks, stroke tags, normalisation): 97 tests green.
- 2026-09-22 - **Player stats & form (0.15.0)**: every match now leaves a record. The player sheet has a **This season** block (apps, minutes, goals, assists, cards, average rating), a **form guide** (your last six match ratings as colour-coded chips) and a **Recent matches** log (opponent, home/away, minutes, goals, assists, rating — kept for your players, surviving pre-season). The engine's per-match 4.0-10.0 ratings are now persisted instead of thrown away, so you can see who is hot and who is hiding. The **squad roster** shows a form chip on every player and gains a **sort select** — position, form, average rating, goals, assists or minutes — and the tactics picker carries the same form chip, so team selection can weigh form as well as ability. Season stats reset each pre-season while the match log persists. AI players accumulate stats and form too (no log), so scout targets show their season averages. 8 new tests (match folding, the six-game form window and bands, log scope/cap, rollover reset, every sort mode, determinism, save backfill): 105 tests green.
- 2026-09-22 - **Scouting & fog of war (0.16.0)**: rival players are no longer an open book. The club only knows what its scouts have filed — knowledge runs from **no report → brief (star ratings) → detailed (attribute/value ranges) → extensive (exact**)**, and estimate width depends on the reporting scout's Judging (a poor scout is biased as well as vague: bad intel can oversell a player). The scouting department: 2 hired scouts + a hiring pool of 4, a per-season scouting budget (15% of the transfer budget, top-up in one tap), **player jobs** (£20k/round, full report in a few rounds) and **recruitment focuses** (£10k/round, one new name a round + polished leads), a 12-deep **report inbox**, a **shortlist** (fresh eyes each round while knowledge fades -2/round when nobody watches), and a **Market | Scouting** split in the transfer centre. The player sheet is fogged for rivals (stars, `?` OVR, range attributes with an uncertainty band, hidden traits, wages as ranges) while your own squad stays exact; fee and wage offer prefills come from the reports, never the true value — you can genuinely bid blind, overpay for a dud or steal a gem. 13 new tests (knowledge tiers, job progress/completion, budget pause, decay floor, focus discovery + polish, decay/shortlist, hiring, top-up, star scale, determinism, save backfill): 120 tests green.
- 2026-09-22 - **History, records & rewards (0.17.0)**: the save now remembers every season. At each pre-season the finished season is written into the record books: **champion & runner-up**, **your finish** (position, points, W-D-L, prize money), the league **top scorer**, the **Player of the Season** (best average rating, min 8 apps) and a full **Team of the Season** (4-3-3 of the year's best). Your **record card** counts league titles, seasons and career W-D-L, and there are all-time **Records** — most career goals, most appearances, most goals in a season, best season rating and the biggest win ever — which update only when beaten and survive retirements. Every player accumulates **career totals per club** (folded in each pre-season), so players carry a career and honours: the player sheet gains a **Career** block (apps/goals/assists overall, for your club, the club trail, and "2× league champion" for title winners). In-season, each round crowns a **Player of the Round** (best rating, 45+ minutes) — shown in the fixtures list and as a feed on the new tabs — and the League screen gains **Scorers** (this season's top 15) and **History** tabs next to Table/Fixtures. **Rewards**: league position pays **prize money** (8m for the champions down to 700k for 10th) straight into next season's transfer budget, with a news line to mark it. 12 new tests (career folding, the season record, prize payment, champion titles, record updates, Player of the Round, biggest win, per-club totals, a four-season run through retirements, determinism, save repair): 132 tests green.
- 2026-09-22 - **Morale & squad dynamics (0.18.0)**: the dressing room is alive. Every player has a **mood** (Delighted → Happy → Content → Unsettled → Unhappy → Miserable) that moves with football reality: **playing time** against what his squad status expects (star/rotation/fringe/youth — stars who sit out sulk, kids are patient), **results** (winning runs lift everyone, losing runs drag), **wages** (underpaid players resent it), **contracts** (expiring deals unsettle), **injuries**, **suspensions** and **form** — and the whole squad drifts toward the mood of its **leaders**, so a sulking leadership poisons the room and a happy one lifts it. The new **Dynamics tab** (Squad screen) shows the **dressing room atmosphere** with the last-five results, the **leaders**, **social groups** (Young guns / The core / Old guard, each with its mood and key man) and a **happiness list** worst-first — every player with the reason he feels that way and **Praise / Warn** buttons (dynamics chats, one per player every four matches: praise lands with in-form players, criticism with strugglers, and both can backfire). Mood **reaches the pitch** (±6% on finishing, creativity, defending and goalkeeping), **training** (±8% development), **contract talks** (a player below 30 won't even discuss terms unless you offer silly money — happy players sign ~8% cheaper) and the **transfer market**: three rounds below 25 morale and a player **hands in a transfer request** (news line, more bidders, cheaper fee), withdrawn once he's back above 50. Roster rows show a mood dot; the player sheet has a Mood block with every factor spelled out. 13 new tests (neutral-at-60 calibration safety, every driver, the leader pull both ways, requests in and out, all chat reactions, the renewal refusal, the on-pitch effect over 60 matches, determinism, save backfill): 145 tests green.
- 2026-09-22 - **On-pitch realism (0.19.0)**: the match now has weather, a referee, a pitch, offside and VAR. **Weather** (dry / wet / heavy rain / windy / frosty) is drawn per round — the same for the whole division — and bends the football: rain and wind cut conversion, rain brings blocks, corners and bookings, frost puts the ball on a trampoline; the **pitch** wears through the season (good → worn → heavy) and a soaking downgrades it. Each round has a **named referee** with a personality (strict bookers up to 1.45×, lenient ones let it flow) who also colours the penalty count. **Offside** is real: the assistant's flag goes up on true offsides but misses 35% of them and occasionally (8%) flags a good goal — and a disallowed goal never reaches the scoreline. **VAR** reviews the controversies (60% of calls, correcting 75% of errors): a missed offside is overturned, a wrong flag restored, penalties get a second look and are sometimes cancelled. The Home next-match card and the League fixtures show the round's conditions ("Heavy rain · Ref: M. Doyle (a strict one) · Worn pitch"), the match screen carries them plus per-side **offsides** and a **VAR count**, and the full-time panel recaps them — with commentary lines for the weather, the flag, the added time and every review. All neutral by default (dry, balanced ref, good pitch) so nothing else moved. 9 new tests (condition determinism and wear, neutral safety, rain vs dry aggregates, strict vs lenient bookings, the flag/VAR scan, disallowed goals, announcements, half-time byte-identity): 154 tests green.
- 2026-09-22 - **Media & press (0.20.0)**: the club now has a public. Every round opens with a **press conference** — two questions, three ways to answer each, drawn from what is actually happening at the club (a crisis after three defeats in four, a flying start, the next opponent as a big test or a must-win, your top scorer's form, a transfer request, an injury, a restless dressing room, or just the supporters). Answers move three things: **fan confidence**, **how the press treat you**, and **squad morale** — with a targeted answer landing hardest on the player concerned (praise your star and he soars while the squad barely notices; call your fringe man not good enough and he takes it to heart). Answer boldly and you can **promise a win** — the press will remember, and the round's result decides whether it is "a promise kept" or a back-page backlash of fan anger and sliding morale. You can always **send the assistant** (−3 press respect) if you would rather not face them. The **news feed** follows it all: match reports with scorers, terrace reaction after a rout, supporter unrest when the mood sours, transfer rumours naming real players, and a headline when a conference makes the back pages — plus an amber "**You owe them**" band listing every live promise. Fan confidence is not cosmetic: it leaks into the **dressing room** (a roaring crowd lifts your players, a toxic one drags) and into the **gate receipts** at the rollover (±2m on the transfer budget, up or down). The Home screen gains the **press card** and the **In the news** panel with Fans/Press meters and the latest headlines; the full paper lives behind "All headlines". 13 new tests (the opening conference, situation-aware questions, answer effects and finishing, targeted morale, promises kept and broken, fan swings and reports, the capped feed, scheduling determinism, skipping, rumours, the morale/gate links, season determinism, save backfill): 167 tests green.
- 2026-09-22 - **Calendar / Diary (0.21.0)**: the game has dates now. One round = one week and **season 1 kicks off Saturday 8 August 2026** (each later season starts a year on), so the whole schedule is derived arithmetic — no stored state, no timezone, old saves included. The League screen gains a **Diary** tab: a month grid (‹ › paging through the season, Sunday-first) where every match day shows the **opponent's short code** tinted by result (green win / grey draw / red loss), weekdays carry a training dot, transfer windows and the season's bookends get an amber marker, and the week you are currently playing is ringed. Below the grid: **Matches this month** (date, round, opponent, score) and **Dates to note** (season opener, final day, summer window opens after round 1 and closes after round 3, the winter window at rounds 9–10). Tapping any day opens a detail sheet — the fixture with home/away and full-time score, the day's training focus with a shortcut to the Training screen, the events, or "a rest day" — and the Home next-match card now shows the date too ("Next · Round 1 of 18 · Sat 8 Aug"). 9 new tests (civil date arithmetic with no `Date` — serial round trips, leap years, known weekdays — the week-by-week layout, match/training/rest classification, past results vs open fixtures, window/bookend markers, month-grid weekday alignment across every month, "this week" tracking the round, the upcoming list, determinism): 176 tests green.
- 2026-09-22 - **Match legs (0.22.0)**: players tire during the match now, and the sub panel finally tells you who's who. Every player on the pitch has **live stamina** that starts from his condition and drains minute by minute — faster if he's low on **physical** or the wrong side of 30, with a little back at half time — and it costs him: up to 16% of his finishing, defending and goalkeeping when empty (nothing at all when fresh, so the calibration is untouched). **Subs arrive fresh**, and the AI now hooks its most knackered player rather than its worst. The **Changes sheet** was rebuilt around it: dot meters for **Subs x/5** and **Windows y/3**, a legend spelling out **Legs** (stamina left in this match) versus **Cond** (freshness going into it), a **leg bar** on every player's row with home/away of the clock (a green/amber/red tint, the number in the same colour), an **ON 45'** tag on anyone who came on, a square for a booking, and a new **Already used** section listing every player who came on and every one who went off with their minute — so nobody has to guess whether a man can still play. The pitch draws a **legs gauge** too: a ring around each dot that drains clockwise from green to red as his legs go. 10 new tests (start value, drain curves, fitness/age, the break, subs arriving fresh, exhausted sides performing worse over 40 matches, the tint bands, the roster through multiple subs, `staminaAt` rewinding to the clock, and stamina surviving the half-time split): 186 tests green.
- 2026-09-22 - **Match-day levers (0.23.0)**: the 90 minutes are yours now — everything FM lets you say and change, all of it deterministic. **Opposition instructions** on any of their players: tight/loose marking, press often or stand off, get stuck in or stay on your feet, and show him inside or outside — each bends his involvement, his chance quality and your foul risk, and the more of their XI you single out the more their *team* supply chokes (marking their two best was measured at six goals fewer across 120 matches, at the price of ~75% more bookings). **Player instructions** for your own XI: shoot on sight or be selective, play direct or keep it simple, roam or hold position. **Team talks** before kick-off, at half time (the options follow the score) and after the whistle: they set a match-long **Fire** and **Shape** edge *and* move the dressing room for good — push a struggling player and he flinches, praise a confident one and he grows, leaders carry it further. **Touchline shouts** — encourage, demand more, tighten up, calm down — lift the side instantly but fade fast (the third is weak, the fourth backfires: the players stop listening). The **assistant** now speaks up with amber nudges: tired legs, who is on a booking, their danger man ("consider an instruction on him"), a keeper making saves, a referee losing control — and his **half-time report** tells you when the players need words. The Changes sheet is rebuilt into four tabs — **Subs · Mine · Theirs · Talk** — with the Fire/Shape meters and native dropdowns throughout. Also in: **extra time and penalty shootouts** (five takers, sudden death, kick-by-kick commentary, `MatchResult.pens`), ready for the cup. 14 new tests (both instruction tables, marking their danger man over 80 matches, tackling hard filling the book, talk receptivity by mood and age, the dressing-room move, shouts fading then grating, all four levers replaying byte-identically, refused talks and instructions, the assistant's nudges, the AI's own instructions, extra time + penalties, determinism): 200 tests green.
- 2026-09-22 - **The market, granular — section C (0.24.0)**: the transfer market now has everything a real one does. **Loans** in both directions: borrow a young squad man for the season (agree a loan fee and how much of his wage you carry, add an **option to buy** or an **obligation**, 3 in / 4 out) or send yours out — they play elsewhere, you pay the rest of their wage, and everyone comes home in pre-season; nobody loans you one of their best. **Contract depth**: 1-5 year deals where length actually moves the price (security is cheap for a kid and dear for a 30-year-old), plus a signing-on bonus, £-per-appearance and £-per-goal bonuses, a **release clause** (a rival can buy him out at that exact fee) and a **club option** you can trigger later — with a live readout of what his agent is thinking. **Deal structure**: pay a fee up front, over two or three **instalments** (real debts that come out of later budgets), with an **add-on after N appearances** and a **sell-on percentage** — a lower fee with the right extras beats a bigger cash bid. **Offer players to clubs** (it upsets them a little and brings bids), **ask his agent** who is interested and at what price, and pay agents and bonuses when a deal completes. **The board** sets a policy every season — an age ceiling it will genuinely veto, and money targets it judges at the season end (+£900k or a £500k slap). **Money moves**: trade transfer budget for weekly wage room at £1/wk = £52. And the **Bosman market**: roughly one player in twelve is in his final year, winter is when you can agree a free transfer for the summer, and rival clubs will do the same to your expiring stars. 19 new tests (structured deals, instalment debts, add-ons, sell-ons, contract levers, extensions, clauses, loans with shares and limits, options and obligations, the board's veto and verdict, reallocation, listing, agent interest, pre-contracts, poaching, determinism): 219 tests green.
- 2026-09-22 - **Individual players, section F (0.25.0)**: the game now separates the three numbers that were one. **Match sharpness** (match fitness, 85 on a fresh save) rises with minutes and drains when a player sits out — a rusty starter is up to 7% worse, and the squad flags him as **rusty** under 70. **Wear** builds when a tired, older or over-played starter keeps going and clears with rest: it costs up to 5%, makes knocks last longer and shows as **heavy legs** past 60. **Injuries** now read properly — Knock, Muscle strain, Hamstring, Ankle ligaments, Broken foot — with prone players (age, build, wear, rust) picking up more of them. **International weeks** (rounds 5 and 12, marked INT in the Diary) take your best players away and hand out caps; they come back with tired legs and the odd knock. **Individual targets**: set a player a goals/appearances/average-rating target for the season (an ambitious one lifts him immediately, missing it costs you more) and follow the live progress bar. **Retraining**: teach a player a second position (DF/MF/FW neighbours, never keepers) over a run of games, and he shows as able to cover it in the plan. **Moves (PPMs)**: pick a specific trait to work on, unlock it with the attribute bar it needs, and speed it up by matching the training unit. **Discipline**: a sending-off or a pile of bookings lands on your desk — fine two weeks' wages (cash into the budget, minus morale, the press approve), warn him, or let it go. And **the armband**: name a captain and vice-captain — the captain carries real extra weight in the dressing room and in every team talk, and wears an amber C on the pitch. 12 new tests (sharpness, a cold side over 80 matches, wear, injuries, call-ups, targets, retraining, moves, discipline, the armband, old saves, determinism): 231 tests green.
- 2026-09-22 - **Quality of life, section H (0.26.0)**: the housekeeping pass. **An inbox** with badges: every news line, the match report, incoming bids, press conferences, red-card prompts and board verdicts land in one feed (categorised Matches/Transfers/Press/Discipline/Board/Club, unread count on the Home bell, tap to jump to the right screen, mark-all-read, capped at 60). **Global player search**: the Transfer centre gains a Search tab — filter every player in the world by name, position, age, minimum rating, club, listed and final-year, with fog respected (unknown players read "no report", the rating filter uses your scouts' read). **Compare**: pick two players and see attributes, apps, goals, assists, minutes, cards and wages side by side. **A data hub** (League, Data tab): a shot map of your last match with dots sized by expected goals (green scored, amber saved, blue blocked, red off target), a cumulative xG timeline for both sides, a goals-for/against bar chart per round and a shots/xG summary — every shot now carries the model's own xG. **Save slots and autosave**: three manual slots plus an autosave that writes itself whenever the season or round moves on, with Save/Load/Delete in Settings (the live save is untouched, so nothing else changes). **Help and comfort**: an in-app manual from Settings ("How to play" — the basics, the three body numbers, match day, squad, market, the world) and a reduce-motion toggle that turns the match animation into stepped updates for anyone who wants it. 8 new tests (inbox, badges, filters, cap, backfill, xG bounds, xG vs goals, round trip, determinism): 239 tests green.
- 2026-09-22 - **Pre-season and form (0.27.0)**: two answers to "something's missing". **Pre-season is real now**: every save opens three weeks early with **three friendlies** on the calendar (Sat 18 Jul, 25 Jul, 1 Aug), against three different clubs, home and away. Friendlies build **match sharpness and form** (players get ratings, legs and the odd knock) but never touch the table, the season stats, the awards or the record books — and the **transfer window is open** through it, which is when you do your business. The Diary pages back to July and tags friendly Saturdays **FR**; the Home screen has a **Pre-season card** with a **Skip the rest of pre-season** button, and the next-match line reads "Pre-season · friendly 2 of 3". When the third friendly ends, the league begins automatically. **Form bites on the pitch**: the last six ratings now feed a **direct ±4% match modifier** (a hot player finishes and defends better, a cold one is a drag — on top of the morale effect it already had), and three weeks without football kills the streak. The Home screen carries an **In form** card showing the three hottest regulars and anyone running cold. 9 new tests (pre-season shape and dates, friendlies not counting, the league starting on time, the diary marks, hot vs cold over 80 matches, the factor's neutral band, freshness, the rollover rebuilding it, determinism): 248 tests green.
