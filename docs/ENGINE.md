# Touchline — Engine Reference

**Repo-only documentation.** This file is for developers. Nothing here is surfaced in the game UI — the app intentionally ships with zero user-facing docs.

> This is the map, not the territory: when code and doc disagree, the code is right — fix the doc in the same PR.

---

## 1. Purpose & principles

`src/engine/` is a dependency-free, DOM-free, deterministic TypeScript library. It knows nothing about React, storage, or the network.

- **Deterministic.** Same seed + same decisions → byte-identical seasons. All randomness flows through `mulberry32` streams derived by `hashSeed`. `Math.random()` is forbidden in engine code.
- **Pure.** `playRound()` / `nextSeason()` deep-clone their input and return a new save. `simulateMatch()` reads players but never mutates them — it returns `PlayerUpdate`s, and the caller applies them.
- **One source of balance.** Every tunable number lives in `tuning.ts`. Don't scatter constants.
- **One source of strength math.** `attackStrength()` / `defenseStrength()` in `ratings.ts` are used by both the simulation and the UI (strength strip), so what the player sees is exactly what gets simulated.

## 2. Module map

```
src/engine/
  types.ts       Data model: Player, Club, Fixture, Lineup, FormationDef, MatchResult, SaveGame, …
  rng.ts         mulberry32 PRNG, FNV-1a hashSeed(), randInt/pick/pickWeighted
  tuning.ts      All balance constants (T), built-in FORMATIONS + FORMATION_COORDS, weeklyRecovery()
  roles.ts       26 roles: weight vectors + shot/finish/assist biases + lane, role groups
  motion.ts      Per-role movement instructions (ROLE_MOTION) + motionFor(player, role, slot)
  formations.ts  builtinFormation(), resolveFormation(), validateFormation(), scratchSlots(), roleTemplate(), SLOT_ZONES/clampToZone()
  ratings.ts     Scores (overall/attack/defense), team strengths, suitability, auto/fix/remap/validate lineup
  league.ts      Fixtures (double round-robin), league table, form guide
  generate.ts    newGame(): clubs, squads, attributes, fixtures, initial lineup
  match.ts       Minute-tick match simulation → MatchResult; state-based (startMatch/advanceTo/finalizeMatch) + the possession timeline
  live.ts        Live match: startLive, addLiveChange, resumeSecondHalf, skip helpers, matchStats
  advance.ts     prepareRound(), completeRound(), playRound(), nextSeason() — orchestration
  index.ts       Barrel export
```

Dependency direction: `rng`/`types` are leaves; `tuning`, `roles`, `formations`, `league` depend only on them; `ratings` adds roles+tuning; `match` sits on ratings+roles+tuning+rng; `advance`/`generate` orchestrate.

## 3. Data model (`types.ts`)

- `Player` — `pos` (GK/DF/MF/FW), 7 attributes (`pace, shooting, passing, defending, physical, reflexes, handling`), `condition` 0–100, `injuredWeeks`, `suspension`, `apps`, `goals`, `assists`.
- `Club` — `strength` (generation-time offset), `formation` (AI preference; always a built-in).
- `Fixture` — `round`, `homeId`, `awayId`, `played`, goals once played.
- `FormationSlot` — `{ pos, x, y, role? }`; **x 0=left→100=right, y 0=opponent goal→100=own goal**; optional `role` = builder-chosen default role (must belong to `pos`).
- `FormationDef` — `{ id, name, slots[11] }`; `id` is a built-in `FormationId` or a custom `cf-…`.
- `Lineup` — `formation: string` (resolved via `resolveFormation`), `starters[11]`, `bench[7]`, `mentality`, `roles[11]` (one `RoleId` per **slot**, not per player).
- `PlayerUpdate` — what a match wants applied to a player: `minutes, goals, assists, yellow, red, injuredWeeks, conditionLoss`. Players with 0 minutes get no update.
- `MatchResult` — `fixtureKey, events[], ratings (only players with minutes>0), updates[], scorers[]`.
- `SaveGame` — `saveVersion: 1`, seed/season/round, clubs/players/fixtures, `lineup`, `customFormations[]`, last results.

## 4. Randomness & determinism (`rng.ts`)

- `mulberry32(seed)` — 32-bit state PRNG returning floats in [0,1).
- `hashSeed(...parts)` — FNV-1a over stringified parts, used to derive **independent** streams:
  - world generation: `hashSeed(seed, "world")`
  - fixtures: `hashSeed(seed, "fixtures", season)`
  - each match: `hashSeed(seed, "match", season, round, homeId, awayId)`
- Because each fixture owns its own stream, running round 5 depends on nothing but the save — reloads and replays can't fork reality. The golden test plays seed 7 twice and compares every result.
- Helpers: `randInt` (inclusive), `pick`, `pickWeighted` (weights clamped at ≥0).

## 5. World generation (`generate.ts`)

- 10 fictional clubs (`CLUB_DEFS`, ids `c1`…`c10`) with per-club `strengthOffsets` (top club +8 … bottom −6).
- Squads: template `GK:3 DF:7 MF:7 FW:5` → 22 players/club, 220 total.
- Attributes: `base = randInt(42..82) + round(strength × 0.8)`, then position skews (e.g. DF +12 defending, FW +12 shooting) with ±6 jitter, clamped to 28..96.
- Fixtures: double round-robin via the circle method on a shuffled rotation → 10 clubs ⇒ 18 rounds / 90 fixtures; the back half mirrors home/away.
- Initial lineup: best-XI on 4-3-3; `customFormations: []`.

## 6. Ratings, roles & lineup ops (`ratings.ts`, `roles.ts`)

- `overallFor(p)` — per-position weighted attributes (GK: reflexes .55 / handling .3 / physical .15; DF: defending .45 / pace .2 / physical .2 / passing .15; MF: passing .4 / pace .2 / defending .2 / shooting .2; FW: shooting .55 / pace .3 / passing .15).
- `attackScore(p, role?)` / `defenseScore(p, role?)` — with a `RoleId`, `dot(attrs, role weights)`; without one, the legacy position-based formulas (kept for role-less callers).
- **Roles** (26, FM-style): each is an attack vector + a defence vector + `shot`/`finish`/`assist` biases + a `lane` (wide/central; off-lane picks are flagged in the UI, templates never use them):

  | Role | Short | Group | Lane | Attack leans on | Defence leans on | shot | finish | assist |
  |---|---|---|---|---|---|---|---|---|
  | Shot Stopper | GK | GK | any | — | reflexes .7, handling .3 | 0 | 1 | 1 |
  | Sweeper Keeper | SK | GK | any | — | reflexes .55, handling .25, passing .2 | 0 | 1 | 1 |
  | Stopper | STOP | DF | mid | pace .4, passing .35, physical .25 | defending .5, physical .3, pace .2 | 0.5 | 0.95 | 0.7 |
  | Ball-Playing Defender | BPD | DF | mid | passing .55, pace .25, physical .2 | defending .4, passing .25, physical .2, pace .15 | 0.7 | 0.95 | 1.1 |
  | No-Nonsense Centre-Back | NCB | DF | mid | physical .45, pace .3, defending .25 | defending .6, physical .32, pace .08 | 0.3 | 0.9 | 0.5 |
  | Full-Back | FB | DF | wide | pace .4, passing .35, physical .25 | pace .35, defending .35, physical .2, passing .1 | 0.75 | 0.95 | 1 |
  | Wing-Back | WB | DF | wide | pace .45, passing .35, physical .1, shooting .1 | pace .35, defending .3, physical .2, passing .15 | 0.9 | 0.95 | 1.15 |
  | Inverted Full-Back | IFB | DF | mid | passing .5, defending .2, physical .15, pace .15 | defending .45, physical .25, passing .15, pace .15 | 0.4 | 0.9 | 0.9 |
  | Libero | LIB | DF | mid | passing .45, pace .2, physical .2, shooting .15 | defending .35, passing .3, physical .2, pace .15 | 0.8 | 0.9 | 1.15 |
  | Box-to-Box | B2B | MF | mid | passing .3, pace .25, shooting .25, defending .2 | physical .35, defending .3, pace .2, passing .15 | 1 | 1 | 0.95 |
  | Central Midfielder | CM | MF | mid | passing .3, shooting .2, pace .2, defending .15, physical .15 | defending .3, physical .25, passing .25, pace .2 | 0.9 | 1 | 1 |
  | Deep-Lying Playmaker | DLP | MF | mid | passing .55, pace .15, shooting .15, physical .15 | defending .3, physical .25, passing .3, pace .15 | 0.7 | 0.95 | 1.4 |
  | Anchor | ANC | MF | mid | passing .3, physical .3, defending .25, pace .15 | defending .5, physical .35, passing .15 | 0.35 | 0.9 | 0.8 |
  | Ball-Winning Midfielder | BWM | MF | mid | physical .3, defending .25, passing .25, pace .2 | defending .45, physical .35, pace .15, passing .05 | 0.55 | 0.95 | 0.7 |
  | Mezzala | MEZ | MF | mid | pace .3, shooting .25, passing .25, physical .2 | defending .25, physical .3, pace .25, passing .2 | 1.05 | 1 | 1.1 |
  | Advanced Playmaker | AP | MF | mid | passing .55, shooting .2, pace .15, defending .1 | passing .3, defending .25, physical .25, pace .2 | 0.85 | 1 | 1.45 |
  | Shadow Striker | SS | MF | mid | shooting .35, pace .3, passing .2, physical .15 | defending .3, physical .3, passing .2, pace .2 | 1.1 | 1.05 | 0.95 |
  | Winger | W | MF | wide | pace .4, passing .4, shooting .1, physical .1 | pace .4, defending .3, physical .2, passing .1 | 1 | 0.95 | 1.35 |
  | Inverted Winger | IW | MF | wide | pace .35, shooting .35, passing .2, defending .1 | pace .3, defending .3, physical .25, passing .15 | 1.2 | 1.08 | 1.05 |
  | Poacher | POA | FW | mid | shooting .55, pace .35, passing .1 | defending .45, physical .4, pace .15 | 1.25 | 1.12 | 0.6 |
  | Advanced Forward | AF | FW | mid | shooting .45, pace .4, physical .15 | defending .4, physical .4, pace .2 | 1.15 | 1.05 | 0.85 |
  | Complete Forward | CF | FW | mid | shooting .35, pace .25, physical .2, passing .2 | defending .4, physical .4, pace .2 | 1.1 | 1.15 | 0.95 |
  | Deep-Lying Forward | DLF | FW | mid | passing .4, shooting .3, physical .3 | defending .35, physical .45, pace .2 | 0.9 | 1 | 1.25 |
  | Target Man | TM | FW | mid | physical .45, shooting .35, passing .2 | physical .55, defending .3, pace .15 | 0.95 | 1 | 0.8 |
  | Pressing Forward | PF | FW | mid | pace .4, shooting .35, physical .25 | physical .4, pace .3, defending .3 | 1.05 | 0.95 | 0.8 |
  | Inside Forward | IF | FW | wide | pace .35, shooting .4, passing .15, physical .1 | defending .35, physical .4, pace .25 | 1.2 | 1.05 | 0.95 |

  - `shot` scales shooter-selection weight, `finish` scales conversion, `assist` multiplies passing in assist selection — all consumed by `match.ts`.
  - Each role also has a **finishing weight vector** (`FIN` in `roles.ts`): Poachers finish with shooting (.8) + pace (.2); Target Men with physical (.5) + shooting (.45); Wing-Backs with pace. `roleFinish()` is the dot product the sim uses; the `finish` scalar then biases conversion.
- **Team strength**: `attackStrength(players, roles, mentality)` = mean over outfield of `attackScore(role) × conditionFactor` `× mentality.att`; `defenseStrength` = XI mean `× mentality.def`. `conditionFactor = 0.72 + 0.28 × condition/100` (a 40%-condition player performs ~11% worse).
- `suitability(p, slot)` — 1.0 same position, 0.92 adjacent, 0.85 two apart, 0.5 GK↔outfield.
- `slotScoreFor(p, slot, role?, condWeight=0.25)` — position-mixed attack/defence blend × suitability × condition blend. Powers picker ordering, "Top pick", and rest suggestions.
- `autoLineup(players, def, opts)` — greedy best-by-score fill; `mentality` mixes 45% toward attack/defence score for outfield; `freshest` multiplies by `0.55 + 0.45 × cond`; bench = next best 7 with a GK guaranteed; roles defaulted per slot.
- `validateLineup` — 11 starters, no dupes, all available, exactly 1 GK.
- `fixLineup` — keeps valid picks, refills gaps, normalizes roles to slot-legal (used at kick-off; repairs are persisted).
- `remapLineup(players, lineup, from, to)` — formation change keeps players by slot position (order-preserving), carries roles when still legal for the target slot, sends overflow to empty bench slots, then fixes. Used by every formation switch, including custom ones.

## 7. Formations (`formations.ts`)

- Built-ins: `4-4-2 | 4-3-3 | 4-2-3-1 | 3-5-2 | 5-3-2`. `FORMATIONS` (positions) and `FORMATION_COORDS` (x/y) are **index-aligned arrays** — a test enforces equal lengths and on-pitch bounds.
- Custom formations: `FormationDef`s stored in `save.customFormations` (id `cf-…`). `validateFormation` requires exactly 11 slots, exactly 1 GK, coords within 3..97. `scratchSlots()` returns a neutral 4-4-2 clone as the builder starting shape.
- `resolveFormation(id, customs)` checks customs first, then built-ins. **Rule: new code takes a resolved `FormationDef`; never index `FORMATIONS[id]` directly** — that's how custom shapes flow through simulation for free.
- `roleTemplate(def)` gives every formation its default role line-up: hand-written per built-in (wide slots get wide-lane roles, holding bands get holders, attacking bands get creators) and geometry-derived for custom shapes (`defaultRoleForSlot`). Used by auto-pick, kick-off repair and formation remaps; a test enforces group validity and lane fit.
- **Zones** (`SLOT_ZONES`): each position family is confined to a band — GK x 38–62 / y 82–94, DF y 48–90, MF y 26–72, FW y 8–48 (outfield x 6–94). `clampToZone(pos, x, y)` is what the builder uses, so a defender can never be dragged into midfield. Built-ins are test-enforced to sit inside their zones; legacy out-of-zone customs still load and clamp on their next edit.
- `FormationSlot.role?` — optional per-slot preferred role the builder can set (custom formations only). `roleTemplate()` honours it for customs and formation remaps stamp it onto the lineup; an invalid role is silently ignored, so old saves and hand-edited files degrade gracefully.

## 8. Match simulation (`match.ts`)

Inputs: clubs, both XIs + benches (available players, slot order), mentalities, `RoleId[]` per side, rng. Output: `MatchResult`. The engine plays 90 minutes + 1–5 stoppage.

Per minute, per side:

1. **Chance rate**: `pH = clamp(0.135 × 2 × att / (att + defOpp), 0.02, 0.45)`; home attack ×1.08. `att`/`def` are the strength functions (condition- and mentality-adjusted).
2. **Chance resolution**: shooter picked by weight `posFactor (FW 4 / MF 2.4 / DF 0.7) × (0.5 + shooting/100) × role.shot`. `finish = roleFinish(attrs, role) × role.finish` — role-weighted, so physical counts for a Target Man and pace for a Wing-Back. `pGoal = clamp(0.115 × (1 + (finish−60)/120) × (1 + (60−gkSkill)/160), 0.04, 0.3)` where `gkSkill = defenseScore(GK, role)`. Goals: scorer +1.0 rating; **82% of goals get an assist** — a non-GK teammate weighted by passing × role assist bias (+0.4 rating), named in the commentary. Non-goals split: 42% saves (keeper +0.15 per save); then ~20% × a defence scaling of 0.6–1.4 resolve as **blocks** — credited to a defender weighted by defence score (+0.15); the rest are misses.
3. **Fouls/cards**: ~3.6 yellows/match budget; 4.5% of fouls escalate to straight red, second yellows send off. Offenders weighted DF 2 / MF 1.5 / FW 1, scaled by sloppy defending (`1 + max(0, 70 − defending)/80`) and physique (`1 + (physical − 65)/250`). −0.15 (−0.5 red) rating.
4. **Injuries**: 0.32/match; the victim is drawn with weight `1 + max(0, 80 − condition)/50` (tired players break more often); 1–4 weeks; auto-subbed if subs remain.
5. **Subs** (minutes 62/72/80, 50% each): worst `attack+defence` player off, best bench option (`overall × fit for the slot`) on. **Subs inherit the role of the player they replace** — roles live on slots, not players. Max 5 subs.
6. **Bookkeeping**: entry/exit minutes tracked; `conditionLoss = max(3, round(16 × minutes/90) + 0..3)`; end-of-match rating adjustments (win +0.2, GK/DF clean sheet +0.4, loss −0.2); ratings are rounded to 1 decimal and exist only for players with minutes > 0. Every player who appeared (starters, subs, red-carded, injured) gets a `PlayerUpdate`.

Commentary: >3 text variants per event type; events carry `minute`, `type`, optional `clubId`/`playerId`, and rendered text — the UI is a dumb renderer.

**Live match (halves, changes, timeline).** The engine is state-based so the user's fixture can pause. `startMatch(inputs)` builds a plain-data `MatchState` (per slot: player id, designed position, role, coordinates; plus bench, mentality, goals, subs, windows, rng state — fully serializable); `advanceTo(state, minute, players)` simulates forward (pure); `finalizeMatch(state)` produces the `MatchResult`. `simulateMatch` = start + advance + finalize, so AI matches and live matches share every formula — a test asserts that **splitting at 45' reproduces the one-shot result exactly**.

The timeline: each minute emits possession phases as `Stroke`s — `{ m, h (home?), p (pass chain as slot indices), o (turnover | out | foul | goal | save | block | miss), t (end x), b (other-side slot: keeper/blocker/interceptor), r (event index), sp (set-piece tag), tg (staged point) }`. Chances resolve exactly as above; the pass chain is walk-built from a deep initiator to the chosen shooter (forward passes favoured). Minutes without a chance still get a chain ending in a turnover or out of play; cards add a `foul` stroke. The 2D view renders strokes directly, and possession/shots/corners stats derive from them.

Manager changes replay deterministically: `LiveMatch` keeps `base` (the snapshot at the start of the current half) + a journal of `LiveChange`s (sub / mentality / role, each stamped with its application minute). Any change re-simulates from `base` with the journal replayed — the tail changes, everything before the change stays byte-identical. `playhead` (playback minute) is persisted with the match, so reloads resume where you were; `normalizeSave` drops the live match if the round moved on.

**Substitution rules (Premier League): max 5 subs; 3 in-match windows; half-time substitutions are free** (`state.minute === 45`); a player who leaves the pitch cannot return. Enforced by `substitutionError` in `match.ts`; the UI shows its messages verbatim.

**Set pieces.** Fouls (`foulPerMatch` 20/match) split into carded fouls (`cardShareOfFouls` 0.18 → ≈ 3.6 cards/match) and restarts; the rest can produce a **direct free kick** when the foul is in the attacking third (`fkZoneShare` 0.18, then `fkShotShareOfAttFouls` 0.45 → ≈ 1.8 attempts/match; conversion `fkGoalBase` 0.07 scaled by the taker's shooting vs keeper skill) or a **penalty** (`penShareOfAttFouls` 0.07 → ≈ 0.23/match; conversion `penaltyGoalBase` 0.78 ± (shooting − keeper skill)/300, clamped 0.62–0.92 — scored by the best shooter, saved by the defending keeper's reflexes/handling). **Corners** arise from blocked shots (`cornerFromBlock` 0.5), parried saves (`cornerFromSave` 0.45) and balls out in the final third (`cornerFromOut` 0.4) → ≈ 10.7/match; the delivery is taken by the best passer (weighted by role assist bias), attacked by the best header (physical + shooting + role finishing), converts at `cornerGoalBase` 0.026 ≈ 0.4 goals/match, and can be recycled into another corner (`secondCornerShare` 0.3, depth-capped). A scored corner credits the header and the taker (assist). **Goal kicks** follow missed shots (`goalkick` stroke to the keeper); balls out are tagged `throw`. Takers are automatic — best shooter for free kicks and penalties, best crosser for corners. All set-piece strokes carry `sp` (kind) and `tg` (staged point in the attacking side's frame).

**Set-piece staging (2D view).** When a set-piece stroke starts, every slot switches from its movement target to a staged one (`STAGE_SPOTS` in `MatchScreen.tsx`): corners load the box (the side's slots ranked by role `push` → box positions; defenders ranked by `drop` → markers; taker walks to the flag at `tg`; keepers on their lines), penalties put the taker on the spot with everyone else outside the box on the arc, free kicks build a wall between the ball and goal. Players jog to position at 1.5× their normal speed cap during the staging phase (held 2.8–4.0 s at 1×) and the shape stays while the delivery plays out; outside the stroke, normal phase movement resumes.

**Movement model (`motion.ts`).** The 2D view is rendered from engine-owned movement instructions, not from a shared animation: `ROLE_MOTION` gives each of the 26 roles its press / support / push / drop / width / roam / recovery / break values, and `motionFor(player, role, slot)` folds in the actual player — **pace sets top speed** (8.5 + pace×0.095 u/s; keepers capped at 6.5 + pace×0.035), pace + physical set acceleration, physical sets stamina (roaming and push scale with it), slot geometry scales the width bias (wide slots keep it, central slots damp it) and a per-player hash gives every dot its own drift phase so no two move in lockstep. Behaviour is selected by **phase**: in possession roles push up, offer for the ball and hold or leave their width; out of possession they drop into shape and the most eager roles (BWM, Pressing Forward) close down; the 2.5 s after a turnover is a transition — the winner breaks and the loser recovers at sprint pace (both phases +20% speed). Measured on the live build: players run at 5.5–16 u/s, all four phases occur, and on-screen speed correlates with pace at r ≈ 0.8.

## 9. Conditioning

- Cost: a 90' starter loses ~16–19 condition (minutes-scaled, plus jitter); subs ~half.
- Recovery (weekly): `weeklyRecovery(p) = max(8, round(9 + (35 − min(age,35)) × 0.5 + (physical − 60) × 0.15))`. A 19-year-old ~20; a 34-year-old low-physical ~8 — **less than one match costs**, so veterans only stay sharp with rotation. That asymmetry is the intended gameplay.
- Floor 5, ceiling 100 between rounds; `nextSeason` resets to 100.
- `tiredThreshold` (65) drives the Tactics "tired" prompt, "Freshest XI" auto-pick, and rest suggestions.

## 10. Season orchestration (`advance.ts`)

- `prepareRound(save)`: clones the save; resolves and simulates every **non-user** fixture of the round (user side via `fixLineup`, AI sides via `autoLineup`); applies updates (apps++, goals, red → next-match ban, injuries, condition with floor 5); marks fixtures played; leaves the user's fixture unplayed; sets `lastResults`.
- `completeRound(save, userResult?)`: applies the user result (fixture marked played, `lastUserMatch`, appended to `lastResults`), then between-rounds recovery/bans for everyone who sat out, and `round++`. The store pairs `prepareRound` with the live match (`startLive` → playback → `completeRound`) on Done.
- `playRound(save)`: prepare + one-shot user match + complete — kept for tests, tooling and the instant path. Returns `{ save, userMatch }`.
- `nextSeason(save)`: season+1, round 1, fresh fixtures; age +1 (cap 40), condition 100, bans/injuries cleared, apps/goals reset; lineup re-picked on the current formation (built-in or custom), mentality preserved.

## 11. Save format & migration (`src/state/save.ts`)

- `SaveGame.saveVersion = 1`, full JSON round-trip. Persisted to IndexedDB (`fm-save-v1`); export/import via JSON file.
- `normalizeSave()` runs on **every** load and import:
  - backfills `customFormations` for pre-custom saves;
  - drops invalid custom formations (`validateFormation`);
  - backfills / repairs `lineup.roles` (invalid for slot → default);
  - if the stored formation no longer resolves (deleted custom), rebuilds the lineup on 4-3-3;
  - validates `save.live`: dropped unless the user's fixture for `save.round` is still unplayed and the state is well-formed; the playhead is clamped into `[0, total]`.
- **Rule: any schema change extends `normalizeSave`.** Old saves must keep loading; bump `saveVersion` only for changes that cannot be repaired.

## 12. Balance tuning guide (`tuning.ts`)

| Knob | Raise it → | Notes |
|---|---|---|
| `baseChancePerMinute` (0.108) | more goals (chances/min) | main goal-volume dial; set pieces add ≈ 0.5 goals on top |
| `conversionBase` (0.115) | more goals (finishing) | |
| `saveShare` (0.42) | more keeper heroics | share of non-goal outcomes |
| `homeAdvantage` (1.08) | stronger home bias | |
| `mentality` (att/def ±15%) | sharper trade-offs | |
| `foulPerMatch` (20) / `cardShareOfFouls` (0.18) | more fouls & cards | 20 × 0.18 ≈ 3.6 cards/match |
| `redChancePerFoul` (0.045) | more reds/suspensions | |
| `fkZoneShare` (0.18) / `fkShotShareOfAttFouls` (0.45) | more direct free kicks | ≈ 1.8 attempts/match |
| `penShareOfAttFouls` (0.07) | more penalties | ≈ 0.23/match |
| `cornerFromBlock` / `cornerFromSave` / `cornerFromOut` (0.5 / 0.45 / 0.4) | more corners | ≈ 10.7/match delivered |
| `cornerGoalBase` (0.026) / `secondCornerShare` (0.3) | set-piece goals / recycled corners | ≈ 0.4 corner goals/match |
| `penaltyGoalBase` (0.78) / `fkGoalBase` (0.07) | penalty / direct-FK conversion | |
| `injuryPerMatch` (0.32) / `injuryWeeks` (1–4) | more availability chaos | |
| `blockShare` (0.2) | more blocked shots / defender credit | scales 0.6–1.4 with the defence's mean score |
| `assistChance` (0.82) | fewer solo goals | assister weighted by passing |
| `conditionLossStarter` (16) | harsher fatigue | pairs with `weeklyRecovery` coefficients |
| `tiredThreshold` (65) | earlier rotation prompts | UI-facing |
| `subMinute` (62) / `maxSubs` (5) | more/less bench impact | |
| `subWindowsMax` (3) | more/fewer in-match sub windows | PL = 3 windows + free half-time |
| `chainPasses` (2–5) | longer/shorter possession chains | 2D timeline density; no effect on results |

Workflow: edit → `npm test` (calibration test guards avg goals 1.6–4.2 and home-win share 0.25–0.65; current ≈ 2.8 with set pieces folded in) → `npm run sim -- --seed 42 --match` to eyeball a season.

## 13. Testing & tooling

- `src/engine/engine.test.ts` — rng determinism; generation invariants (squad shape, attr bounds, 90 fixtures / 18 rounds / home-away balance); season table consistency; **determinism golden** (seed 7 twice); calibration across 40 seasons (30 s timeout — keep it); availability handling; season rollover; match bookkeeping (everyone who appeared is rated); roles (26 profiles unique, defaults valid per slot, finishing-weight orderings, assist/shot bias sanity); lineup ops (auto roles, remap keeps players); conditioning (recovery scaling); formations (built-ins valid, custom validation, custom fill/remap, templates lane-aware, geometry defaults, zones enforced, slot roles wired); **live match** (half split ≡ one-shot byte-for-byte, timeline invariants, PL sub rules: 5 subs / 3 windows / free half-time window / no returns; second-half changes carry over); **set pieces** (season rates for corners / direct free kicks / penalties / cards; staged strokes carry `sp` + `tg`; `matchStats` corner counting).
- `src/state/save.test.ts` — `normalizeSave` migration cases (roles, customs, vanished formation, stale live match).
- CLI: `npm run sim -- --seed 42 [--match] [--seasons 3]` — headless season(s) with optional commentary dump.

Invariants any change must keep green:
1. Determinism (no `Math.random`, no time/date/OS entropy in engine).
2. Purity (no mutation of inputs; matches return updates).
3. Exactly 1 GK per playable lineup; roles valid for their slot.
4. `FORMATIONS` / `FORMATION_COORDS` index alignment (test-enforced).
5. Strength math single-sourced from `ratings.ts`.
6. Old saves keep loading via `normalizeSave`.

## 14. Extension recipes

- **New role**: add the id to `RoleId` (`types.ts`), a `RoleDef` (weights, biases, lane, description) in `roles.ts`, a `FIN` vector, and list it in `ROLE_GROUPS`. Sim, picker, and chips pick it up automatically; the profile-uniqueness test guards against copy-paste roles.
- **New built-in formation**: append to `FORMATIONS` *and* `FORMATION_COORDS` with identical lengths/order (`FORMATION_IDS` derives itself); the alignment test will catch mistakes.
- **New match event**: extend `MatchEventType`, emit from `match.ts` with text variants, add a corresponding `Stroke` for the 2D view, render in `MatchScreen`. Keep events self-describing (text pre-rendered).
- **New attribute**: touches generation skews, all `overallFor`/role vectors, and the player sheet — treat as a schema change and extend `normalizeSave`.
- **Changed behavior in lineups**: keep it going through `autoLineup` / `fixLineup` / `remapLineup` so the builder, Tactics, and simulation stay consistent — do not special-case custom formations anywhere.

## 15. Performance notes

- Hot path is the minute loop (≈90–95 iterations × 2 chances × fixtures). Avoid per-call allocations: `roles.ts` iterates a fixed `KEYS` array instead of `Object.keys`; strength functions are single loops.
- A full season simulates in ~0.1–0.2 s (40-season calibration ≈ 6 s in Node). The browser plays a round synchronously on tap.
- The engine is tree-shakeable and UI-free; keep it that way.
