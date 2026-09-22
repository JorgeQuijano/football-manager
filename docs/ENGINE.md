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
  roles.ts       32 roles: weight vectors + shot/finish/assist biases + lane + behaviour text, role groups
  traits.ts      player traits (10): generation + the weight modifiers they apply to sim/decisions/movement
  motion.ts      Per-role movement instructions (ROLE_MOTION) + motionFor(player, role, slot)
  formations.ts  builtinFormation(), resolveFormation(), validateFormation(), scratchSlots(), roleTemplate(), SLOT_ZONES/clampToZone()
  ratings.ts     Scores (overall/attack/defense), team strengths, suitability, auto/fix/remap/validate lineup
  league.ts      Fixtures (double round-robin), league table, form guide
  generate.ts    newGame(): clubs, squads, attributes, fixtures, initial lineup
  match.ts       Minute-tick match simulation → MatchResult; state-based (startMatch/advanceTo/finalizeMatch) + the possession timeline
  live.ts        Live match: startLive, addLiveChange, resumeSecondHalf, skip helpers, matchStats
  advance.ts     prepareRound(), completeRound(), playRound(), nextSeason() — orchestration
  transfers.ts   Contracts, wages, market values, transfer windows, bids/terms negotiation, AI churn, contract rollover
  training.ts    Per-round development (age/minutes/focus/intensity), potential peaks, trait learning, academy intake
  planner.ts     Squad planner: career stages, contract states, per-line depth levels, next-season projection
  setpieces.ts   Set-piece routines, nominated takers, familiarity growth, per-club plans (AI + user)
  stats.ts       Per-match records: season accumulators, form guide (last 6 ratings), recent-match log, squad sorting
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
- **Roles** (32, FM-style — six added in 0.10.0 from the FM24 role-behaviour guide: Half Back, Regista, Carrilero, Trequartista, Defensive Winger, False Nine): each is an attack vector + a defence vector + `shot`/`finish`/`assist` biases + a `lane` (wide/central; off-lane picks are flagged in the UI, templates never use them) + a one-line **behaviour description** shown in the pickers:

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
  | Half Back | HB | MF | mid | passing .35, physical .3, defending .2, pace .15 | defending .5, physical .3, passing .2 | 0.3 | 0.9 | 0.8 |
  | Regista | REG | MF | mid | passing .6, shooting .2, pace .1, physical .1 | defending .25, passing .35, physical .2, pace .2 | 0.75 | 0.95 | 1.5 |
  | Carrilero | CAR | MF | mid | passing .3, pace .25, physical .2, defending .15 | defending .38, physical .28, pace .22, passing .12 | 0.7 | 0.95 | 0.9 |
  | Trequartista | TREQ | MF | mid | passing .45, shooting .3, pace .15, physical .1 | defending .2, passing .3, physical .25, pace .25 | 1 | 1.08 | 1.4 |
  | Defensive Winger | DW | MF | wide | pace .4, passing .35, physical .15, defending .1 | pace .3, defending .35, physical .25, passing .1 | 0.8 | 0.9 | 1 |
  | False Nine | F9 | FW | mid | passing .45, shooting .3, pace .15, physical .1 | defending .3, physical .35, pace .2, passing .15 | 1 | 1.05 | 1.2 |

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

**Set-piece staging (2D view).** When a set-piece stroke starts, every slot switches from its movement target to a staged one (`STAGE_SPOTS` in `MatchScreen.tsx`): corners load the box (the side's slots ranked by role `push` → box positions; defenders ranked by `drop` → **man-marking**: each marker takes the attacker of the same rank, 2.5 units goal-side; taker walks to the flag at `tg`; keepers on their lines), penalties put the taker on the spot with everyone else outside the box on the arc, free kicks build a wall between the ball and goal. Players jog to position at 1.5× their normal speed cap during the staging phase (held 2.8–4.0 s at 1×) and the shape stays while the delivery plays out; outside the stroke, normal phase movement resumes. Measured live at a corner: 11 of 16 box players had an opponent within 2–5 units (marking pairs).

**Movement model (`motion.ts`).** The 2D view is rendered from engine-owned movement instructions, not from a shared animation: `ROLE_MOTION` gives each of the 32 roles its press / support / push / drop / width / roam / recovery / break values, and `motionFor(player, role, slot)` folds in the actual player — **pace sets top speed** (8.5 + pace×0.095 u/s; keepers capped at 6.5 + pace×0.035), pace + physical set acceleration, physical sets stamina (roaming and push scale with it), slot geometry scales the width bias (wide slots keep it, central slots damp it) and a per-player hash gives every dot its own drift phase so no two move in lockstep. Traits nudge this too: *Drives With the Ball* roams more, *Stays Back* pushes less, *Leader* recovers harder. Behaviour is selected by **phase**: in possession roles push up, offer for the ball and hold or leave their width; out of possession they drop into shape and the most eager roles (BWM, Pressing Forward) close down; the 2.5 s after a turnover is a transition — the winner breaks and the loser recovers at sprint pace (both phases +20% speed). Measured on the live build: players run at 5.5–16 u/s, all four phases occur, and on-screen speed correlates with pace at r ≈ 0.8.

**Player decisions (`intents.ts`).** On top of the profiles every player *chooses* what to do: `decideIntent(profile, ctx, rng)` picks one of **14 intents** every ~0.7–4.2 s from weights combining the role (a BWM presses, a Poacher runs), the attributes (folded into the profile: pace → runs/break, physical → push/stamina), the **team mentality** (attacking → more runs and pressing, defensive → more cover and dropping, plus a ±4–5 unit block shift in the base target), the phase and the situation (ball position, distance to the ball, lane width). Intents — *in possession*: hold / support / come short / stay wide / run in behind / overlap; *out of possession*: hold the line / press the ball / cover / drop deep; *winning transition*: break / spread; *losing transition*: recover / delay / press. Each pick carries a target (own attacking frame), a blend weight (mix 0.35–0.85 against the phase/base target) and a duration; keepers are restricted to hold / hold-line / come-short and never break or recover like an outfielder. Every player runs a **private seeded RNG stream** (`hashSeed(matchKey, side, slot)`) and re-decides on his own clock — squads produce uneven, organic shapes. Measured live: all 22 players cycle **7–12 distinct intents within 40 s** of play, zero phase mismatches, gk violations 0; switching mentality mid-match takes press-the-ball intents from 15 → 41 per sample window (attacking). The view maps intent targets from the side's own frame to screen (`screenFromOwn`) and blends them inside `targetFor`.

**Player traits (`traits.ts`).** Ten FM-style habits, 0–2 per player, generated deterministically from the player id (`traitsFor` — so old saves backfill identically in `normalizeSave`). Each trait bends existing formulas rather than adding new ones: *Shoots on Sight* (shooter weight ×1.25), *Tries Killer Balls* (assist weight ×1.3), *Dives Into Tackles* (foul weight ×1.4, red odds ×1.5), *Dead-Ball Specialist* (set-piece taker weight ×1.4, minor conversion boost), *Presses Relentlessly* / *Marks Tightly* / *Stays Back* / *Arrives in the Box* / *Drives With the Ball* (intent weights), plus movement nudges (roam / push / recovery). Generation is attribute-weighted: a 90-shooting striker gets *Shoots on Sight* far more often than a 45-shooting one. Traits are shown as chips in the player picker and with a one-line blurb in the player detail sheet.

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

- `src/engine/engine.test.ts` — rng determinism; generation invariants (squad shape, attr bounds, 90 fixtures / 18 rounds / home-away balance); season table consistency; **determinism golden** (seed 7 twice); calibration across 40 seasons (30 s timeout — keep it); availability handling; season rollover; match bookkeeping (everyone who appeared is rated); roles (32 profiles unique, defaults valid per slot, finishing-weight orderings, assist/shot bias sanity); lineup ops (auto roles, remap keeps players); conditioning (recovery scaling); formations (built-ins valid, custom validation, custom fill/remap, templates lane-aware, geometry defaults, zones enforced, slot roles wired); **live match** (half split ≡ one-shot byte-for-byte, timeline invariants, PL sub rules: 5 subs / 3 windows / free half-time window / no returns; second-half changes carry over); **set pieces** (season rates for corners / direct free kicks / penalties / cards; staged strokes carry `sp` + `tg`; `matchStats` corner counting); **decisions** (`decideIntent` deterministic per stream; phase gating; forwards run more than CBs; mentality shifts runs/press/drop; high-press roles press more; keepers restricted; target sanity); **traits** (generation count/validity/determinism; attribute-weighted pools; trait weight effects on intents; legacy safety).
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

## 16. Transfers, contracts & finance (`transfers.ts`)

The squad-building loop: every player carries a `Contract { wage, until }` (`until` = last covered season), every club has `Finances { transfer, wageBudget }`.

**Money formulas** (pure, deterministic):
- `marketValue(p)` = `150 x (ovr - 40)^2.8 x ageFactor`, rounded to 10k, floor 10k. `ageFactor`: 21 or younger -> 1.05, 22-27 -> 1.0, then -0.14/season down to a 0.1 floor (34-year-olds are cheap).
- `wageDemand(p)` = `120 x (ovr - 40)^1.7`, rounded to 100/wk, floor 300. A 92-OVR star is about 99k/wk, 5-9m value.
- `freshFinances(save)`: per club `transfer = 25% x squadValue + 1m` (floor 500k), `wageBudget = 1.25 x current bill`. Refreshed **every season start** (in `nextSeason`); within a season it only moves with deals (fees in/out, wages on/off the bill).
- `wageHeadroom = wageBudget - wageBill` - every personal-terms offer must fit inside it, otherwise the offer is rejected with the remaining headroom.

**Transfer windows** (`transferWindow(save)`): summer = rounds **1-3**, winter = rounds **9-10** of the 18-round season; closed otherwise (bids blocked, browse list disabled in the UI). Renewals are allowed any time.

**Negotiation** - two steps, both seeded (`hashSeed(seed, tag, season, ...)`), so re-issuing the same bid on the same state gives the same answer:
1. `bidForPlayer(save, playerId, fee)` - the seller's **ask** = `marketValue x appetite x (0.92-1.08)`. `appetite` by rank in their squad: top-2 -> 1.35 (won't sell cheaply), 3-6 -> 1.1, 7-11 -> 1.0, 12+ -> 0.85. `fee >= ask x 1.05` -> **accepted** (sets `save.pending`); `>= ask x 0.85` -> **counter** at the ask; else rejected. Fee must fit your transfer budget.
2. `offerTerms(save, playerId, wage)` - the player's `want = wageDemand x (0.98-1.06)`. `>= want x 1.02` -> **signs** (moves club, fee charged, log line, `userFix` re-validates your XI); `>= want x 0.88` -> counter; else insulted. `renewContract` / `signFreeAgent` reuse the same shape (own players get a softer requirement; free agents cost no fee).

**World evolution** - `windowTick(save)` runs inside `completeRound` while a window is open, seeded by `(seed, "window", season, round)`:
- 1-2 **AI-to-AI deals** a round: a strong club with budget buys an above-average player from a weaker one at 0.95-1.15x value.
- **Incoming offers** for your players (max 3 pending, about 45%/round): a club your strength or better bids 0.8-1.3x value on one of your top-4 assets worth 400k+. Accept -> `acceptOffer` moves him, credits your budget, drops rival interest in the same player; reject -> `rejectOffer`.

**Contract rollover** - `rollContracts(save)` inside `nextSeason`: players whose `until` has passed leave. AI clubs re-sign about 85% (new deal `season + 2...4`), the rest hit the free-agent pool; **your** expiring players always leave unless you renewed during the season (the Transfers screen lists them year-round). A small deterministic free-agent intake (`makeFreeAgent`, 5/season, ids `pfree-<season>-<n>`) keeps the pool stocked; the pool is capped at 24 names (oldest drift out). After departures the XI is re-validated via `userFix`.

**Tuning**: `TF` in `transfers.ts` - `valueBase/Pow/Pivot`, `wagePow/Mult`, `minFee/minWage`, `budgetBase/budgetValueShare/wageBudgetHeadroom`, `renewalProb`, `freeAgentsPerSeason`, `summerRounds`, `winterRounds`, `logCap`.

**Tests** (`describe("transfers")`, 10): value/wage monotonicity + age curve, budget/headroom integrity, window calendar, bid ladder (rejected/counter/accepted + determinism), budget and closed-window guards, full signing (fee charged, contract `season+3`, seller credited, log), accepting an incoming offer, renew/free-agent signing, `windowTick` determinism, rollover (expiry, AI renewal-or-release, budget refresh, free-agent intake).

## 17. Training & player development (`training.ts`)

Every player grows or declines a little **every round** (`developRound`, called from `completeRound` after the recovery loop; minutes come from the round's `MatchResult.updates`).

**Model**
- `Player.peak` — the overall ceiling, deterministic from the player id (room by age at first sight: 16-18y -> +20-32, 19-21 -> +13-21, 22-23 -> +8-14, 24-26 -> +4-8, 27-29 -> +1-3, 30+ -> 0-1; capped at 96). `ensureDev` backfills it.
- `Player.dev` — fractional accumulator per attribute: growth/decline is fractional each round; attributes only tick when the accumulator crosses +/-1 (so all existing integer displays and formulas stay clean). `Player.devSeason` records the integer gains/losses for the season (display; reset by `resetSeasonDev` at rollover).
- `Player.focus` — individual focus attribute (user club only; +0.6 weight on that attribute before normalising).
- `SaveGame.training` — the user club's plan: `{ unit, intensity }`. `SaveGame.devNews` — the last 12 development news lines (academy, traits, retirements, training knocks).

**Formula** (per player per round, seeded `hashSeed(seed, "dev", id, season, round)`)
- Growth appetite by age (`ageGrowth`): <=18 -> 1.6, <=21 -> 1.35, <=23 -> 1.1, <=26 -> 0.8, <=29 -> 0.45, <=31 -> 0.1, <=33 -> -0.5, <=35 -> -1.1, 36+ -> -1.5.
- `gain = BASE (0.16) x ageGrowth x minutesFactor x conditionFactor x intensityGrowth x taper(room/4)`; distributed across the unit's per-position weights (normalised, plus the individual focus).
- `loss = BASE x |ageGrowth| x DECLINE_SCALE (1.0)`, distributed by `DECLINE_WEIGHTS` (pace-heavy: FW 0.5 pace / 0.3 physical; keepers lose reflexes/handling).
- Minutes: >=30 -> 1.0, 1-29 -> 0.6, unused -> 0.35. Condition: >=70 -> 1.0, 40-69 -> 0.75, <40 -> 0.5.
- Intensity: light x0.7 growth but x1.15 condition recovery; normal x1.0/x1.0; heavy x1.35 growth, x0.8 recovery and a 3%/round chance of a 1-match training knock (`devNews`).
- Attributes clamp to [20, 99]; growth stops once overall >= peak (decline never does).

**Units** (`UNITS`): `balanced`, `attacking`, `defending`, `passing`, `physical`, `setpieces`, `recovery` - each with a one-line blurb and per-position (GK/DF/MF/FW) weight tables. **AI clubs** train a deterministic unit per season (`aiPlan`, seeded by club+season) at normal intensity; **free agents** train `recovery`/light.

**Season end** (`nextSeason`): `learnTraits` first (reads last season's `apps`), then `resetSeasonDev`, ageing, `rollContracts` (38+ retire; expired deals leave), the free-agent intake, then `youthIntake`.
- `learnTraits`: players aged <=23 with >=12 apps and <2 traits can learn the trait linked to their club's unit (`TRAIN_TRAITS`: attacking -> shoots_on_sight, passing -> killer_balls, defending -> marks_tightly/dives_in, physical -> presses_hard/arrives_in_box, setpieces -> dead_ball, recovery -> leader) when they clear the attribute bar, at 16%/season. News lines only for the user's club.
- `youthIntake`: each club gets 1-2 academy kids (16-18y, ids `py-<clubId>-<season>-<n>`, cheap 3-season deals, high peak). The user club gets exactly one (news line); AI clubs stay at <=26 by releasing their lowest-peak fringe players to free agency. Idempotent per season.

**Tests** (`describe("training")`, 10): age curves (kids grow, vets decline), minutes/condition/intensity scaling, unit steering, individual focus, ceiling behaviour, determinism, a round across the world, trait learning, academy intake + AI trimming + determinism, AI plan variety.

## 18. Squad planner (`planner.ts`)

FM23-style depth planning, derived entirely from existing save data (no schema additions).

- **Career stages** (`careerStage`, the Experience Matrix): veteran (34+), experienced (30-33), breakthrough (<=20), emerging (<=23 or room-to-grow >= 6), else peak. `CAREER_STAGES` carries labels/blurbs/tints; `STAGE_ORDER` fixes display order.
- **Contract states** (`contractState`): `retiring` (37+, gone at rollover - the retirement rule), `expiring` (until <= current season - leaves at season end unless renewed), `lastyear` (until == season + 1), else `secure`.
- **Depth levels** (`depthLevel`, `DEPTH_MIN` = GK 2 / DF 5 / MF 5 / FW 3): fewer than the minimum is a `gap`, under 1.4x is `thin`, up to 2x is `ok`, beyond that `deep`.
- **`squadPlan(save, "now" | "next")`** returns per-line groups (GK/DF/MF/FW in that order) with the formation's slots + roles for that line, the line's players ranked by their best `slotScoreFor` across those slots (ties: overall, then id), plus stage/status/leaving flags. `view: "next"` projects the post-rollover squad: ages +1, expiring/retiring players flagged `leaving` and excluded from `kept`/depth, and `wageBillKept` reports the wages that walk free. The summary carries the stage counts, `total`/`kept`, `avgAge` and both wage figures.
- UI: `src/ui/Planner.tsx` (`PlannerView`) mounted as the second tab of the Squad screen (`squad-tab-squad` / `squad-tab-planner`); view toggle `planner-toggle-now|next`, stats `plan-stat-players` / `plan-stat-wage`, `plan-expiring-note`, stage rows `stage-<stage>`, per-line badges `depth-<POS>`, player rows `plan-row-<id>` (two-line layout: name+age+OVR/POT, then stage/status chips - verified no truncation at 320px, 44px+ rows), and a scouting CTA `scout-<POS>` on gap/thin lines that jumps to the Transfer centre.
- Tests (`describe("planner")`, 7): stage boundaries, contract states, depth mapping, formation-driven groups + ranking order, gap detection after gutting a line, next-season projection (leavers, +1 age, wages), summary integrity + determinism.

## 19. Set-piece creator (`setpieces.ts`)

FM24-style authorship over the set-piece engine: routines, nominated takers and routine familiarity.

**Plan** — `SaveGame.setpieces: SetPiecePlan` = `{ corner, freekick, takers: { corner, freekick, penalty }, familiarity }`. `defaultSetPieces()` = far-post corners + direct free kicks at 60% familiarity, no nominated takers. `cleanSetPieces(plan, playerIds)` validates everything (unknown routine -> default, stale taker ids -> null, familiarity clamped 0-100) and seeds a 25% entry for the active routines; `normalizeSave` runs it on every load. `aiSetPieces(save, clubId)` gives each AI club a deterministic routine per season (hash of seed+club+season, 60% familiar); `planForClub(save, clubId)` picks the user's plan or the AI's.

**Routines and their match effects** (`CORNER_ROUTINES` / `FK_ROUTINES`; wired in `resolveCorner` / `resolveFreeKick`):
- `near_post` — goal x1.3, second phases x0.75, delivery targets the best physical header.
- `far_post` — the balanced default (x1.0 / x1.0).
- `short` — goal x0.35, second phases x1.9 (the move keeps going).
- `edge` — goal x0.6, second phases x1.4, targets the best shooter.
- FK `direct` — the classic shot (x1.0 of `fkGoalBase`).
- FK `crossed` — a headed delivery: uses the corner formula (x1.1) with the best physical attacker; the taker gets the assist.
- FK `short` — x0.2, almost never a direct threat.
Every routine scales by `familiarityFactor(fam)` = 0.9 + 0.1 x fam/100 (never trained -> 0.9, fully grooved -> 1.0). `growFamiliarity(save)` runs each round from `completeRound`: +4 for the active routines, +7 when the training unit is `setpieces`, capped at 100; switching routines leaves the old routine's value intact and starts the new one at 25.

**Takers** — `plan.takers.<kind>` holds a player id (null = auto). `prefTaker(list, id)` in `match.ts` uses the nominated player whenever he is on the pitch, otherwise falls back to the existing weighted pick (best shooter for penalties/direct FKs, best crosser for corners/crossed FKs).

**Strokes** carry `spr` (the routine used) alongside `sp`/`tg`, so the 2D view stages routine-aware shapes: `stageSpots(kind, routine, left)` in `MatchScreen.tsx` (authored with the flag on the left, mirrored for right-side corners) — near-post cluster / far-post cluster / two short options at the flag / edge-of-the-box pull-back, plus crossed-FK box loading and short-FK players over the ball. Defenders still man-mark the staged attackers by rank, so the defensive response follows the routine too.

**UI** — `src/ui/screens/SetPieces.tsx` (screen `setpieces`, opened from the Set-pieces card on Tactics, `setpieces-link`): routine radio rows with blurbs and familiarity bars (`sp-corner-*`, `sp-fk-*`), three taker selects (`sp-taker-*`, options sorted by Dead-Ball Specialist then ability, star-marked), and a familiarity explainer.

**Tests** (`describe("set piece creator")`, 10): metadata/defaults, familiarity growth + per-routine memory, nominated taker used when playing, fallback when benched, corner routine goal-rate and second-phase ordering, FK crossed > short, `spr` tags in strokes, plan determinism, AI routine variety, plan normalisation.

## 20. Player stats, form & match log (`stats.ts`)

Every match result now leaves a record. `applyResult` (advance.ts) folds each `PlayerUpdate` + the match rating into the player via `recordMatch(p, u, ctx)`:

- **Season accumulators** (reset every pre-season in `nextSeason`, like apps/goals/assists): `mins`, `yellows`, `reds`, `ratingSum`, `ratingCount`.
- **Form**: `p.form` keeps the last **6** match ratings, newest first. `formOf(p)` = their average (null when he has not played); `formBandFor(f)` → brilliant (>=7.5) / good (>=6.7) / average (>=5.9) / poor, each with a tint in `FORM_BANDS`. `ratingAvg(p)` = season average.
- **Match log**: `p.history` (last 10) with `{ se, r, opp, h, rt, m, g, a }` — stored for the **user's club only** (AI players still get minutes/cards/ratings/form, no log line), so saves stay small.
- Ratings come from `MatchResult.ratings` (the engine's 4.0-10.0 per-player marks); players who did not play get no form entry.

**Sorting** (`sortSquad(players, mode, overall)`): position / form / average rating / goals / assists / minutes — missing form or ratings always sink to the bottom, ties break on overall. `SORT_MODES` drives the Squad UI's sort select.

**Determinism**: stats are pure accumulations of the deterministic sim — identical saves produce identical stats (test-enforced).

**UI**: player sheet "This season" grid (apps, minutes, goals, assists, cards, rating) + form chips + recent-match log (`player-stats`); squad roster rows carry a `★rating` chip tinted by band and a sort select (`squad-sort`); the tactics picker shows the same chip (`pick-<id>`) so selection decisions can weigh form.

**Tests** (`describe("player stats & form")`, 7 + a normalizeSave backfill case): folding a match, six-rating form window + bands, log scope/cap, AI stats without logs, rollover reset (log survives), all sort modes, determinism, save backfill.

## 21. Scouting & fog of war (`scouting.ts`)

Before v0.16 every rival player was an open book (exact OVR/POT/wage/value everywhere). Now the club only knows what its scouts have filed.

**State** (`SaveGame.scouting`): `scouts` (hired, max 3), `pool` (candidates to hire), `requests` (active jobs), `knowledge` (playerId → `{ level, seen, by }`), `reports` (inbox, newest first, cap 12), `shortlist`, `budget` (per season).

**Knowledge levels** — `knowledgeOf(save, id)`: 0-24 none (name/club/age/pos only), 25-49 **brief** (star ratings ±1.0, value ±45%), 50-74 **detailed** (attribute + OVR/POT ranges, wages ±25%), 75+ **extensive** (exact everything incl. traits). Your own players are always 100. Constants: `DISCOVERY_LEVEL = 25`, `KNOWLEDGE_FULL = 75`.

**Estimates** — `estimateFor(save, player)` returns the fogged view: `stars`/`starsRange` (relative to your best XI: `starsFor(value, squadAvgOvr(save))`, 2.5★ = your average, halves), `ovrRange`/`potRange`, `attrs` (per-attribute `[lo, hi]`), `valueRange`, `wageRange`, `exactOvr`/`exactPot` (extensive only), `traits` (extensive only), `tier`, `scoutName`. Range width scales with knowledge and with the reporting scout's `judging` (`errF = 1.35 - 0.7 × judging/100`); a poor scout also adds a deterministic per-player bias (`hashSeed(playerId, scoutId)`), so bad intel is *wrong*, not just vague. Stars are computed from the biased estimate, so a rubbish scout can oversell a player.

**Jobs** — `scoutPlayer(save, id)` queues one player (needs a free scout; cost `REQUEST_COST.player` = £20k/round); `addFocus(save, {pos, maxAge, minPotStars})` runs a filter-based search (£10k/round): each round it surfaces one new matching player at `DISCOVERY_LEVEL` (into `reports`) and polishes its 3 best leads (+5 × speed). `focusCandidates` allows a poor scout a wider net (threshold slack scales with `1 - judging/100`). A player job completes at ≥75: the report lands in the inbox and the scout is freed.

**Passive effects** in `scoutingTick(save)` (called from `completeRound` before `windowTick`): knowledge above 25 decays **-2/round** unless the player is under an active job, shortlisted, or your own; shortlisted players gain **+1/round** up to 100. Jobs pause (no progress) when the budget can't pay; the budget never goes negative.

**Money & staff** — `scoutingBudgetFor(transfer)` = 15% of the transfer budget (min £300k), refreshed in `nextSeason`; `topUpScouting(save, amount)` moves transfer money in; `hireScout` pays a fee from the scouting budget; `dismissScout` cancels his jobs. Scout generation (`makeScout`) is seeded: judging 45-90, speed 0.8-1.2, names from fixed pools — 2 hired + 4 in the pool at game start.

**UI** — the Transfers screen gained a **Market | Scouting** tab split (`transfers-tab-*`). Market rows show stars/knowledge%/ranges instead of exact numbers, plus a per-row scout button (`scout-btn-<id>`); the deal sheet shows the valuation *range* and warns under 50% known (`fog-warning`); fee and wage prefills come from `fogFee`/`fogWage` (never the true value — blind at tier none). `src/ui/Scouting.tsx` renders the department: budget + top-up, assignments (player jobs with progress bars, focuses with cancel), the report inbox (Scout / ★), the shortlist, the scout market (hire/dismiss), and a how-it-works legend. The player sheet is fogged for rivals (stars, `?` OVR, range attrs with an uncertainty band, hidden traits) with a Scout button (`sheet-scout-btn`); `Squad`/`Planner`/picker stay exact because they only show your own.

**Determinism**: all discovery/polish/progress rolls are seeded from `(seed, tags, season, round)`; two identical saves produce identical knowledge (test-enforced). AI clubs still use true values.

**Tests** (`describe("scouting")`, 12 + a normalizeSave backfill/drop case): staff/pool/budget at start, own-vs-rival knowledge, single-player job progress to extensive, no-own/two-scouts-busy/already-scouting guards, poor-vs-elite width and knowledge tightening, focus matching + polish, budget pause, decay floor, shortlist trickle, hire/dismiss (cap + job cancellation), top-up, star scale, bids still work at 0 knowledge, determinism, save backfill.

## 22. History, records & rewards (`history.ts`)

A save now remembers every season it has played through.

**State**: `SaveGame.history` (`seasons[]`, `titles`, `allTime` record book) and `SaveGame.awards` (the *current* season's live awards: `rounds[]` Player-of-the-Round feed, `bestWin`). Per player: `Player.totals` (career league totals **per club** — `{apps, goals, assists}`) and `Player.titles` (honours). `emptyHistory()`/`emptyAwards()` seed both at `newGame`; `normalizeSave` backfills/repairs them.

**Per round** — `roundAwards(save)` runs from `completeRound` once the round's results are final: the **Player of the Round** is the best rating in the league with `minutes ≥ POTR_MIN_MINUTES` (45) — one entry per round, capped 18, unshifted (newest first) — and the **biggest win** tracker updates the season's (`awards.bestWin`) and all-time (`history.allTime.biggestWin`) records on margin. Deterministic: first best wins ties.

**Per season** — `recordSeason(save)` runs at the very top of `nextSeason`, *before* retirements delete players and before the season counters reset:
1. Folds each contributor's season counters into `totals[clubId]` (players with 0 apps/goals/assists are skipped, so saves stay small).
2. Builds the `SeasonRecord`: champion (from `computeTable`), runner-up, your finish (pos/pts/W-D-L/prize), top scorer, **Player of the Season** (best average rating, `apps ≥ AWARD_MIN_APPS` = 8), **Team of the Season** (`TOTS_SHAPE` 4-3-3, best available rated player per slot, no duplicates) and the season's biggest win.
3. Titles: `history.titles` +1 when *you* win; every player at the champion club gets `titles +1` (honours).
4. All-time records: most career goals, most appearances, most goals in a season, best season rating (+ biggest win). Stored entries survive retirements — only a strictly better value replaces them.
5. Resets `save.awards` for the new campaign.

**Rewards** — `payPrize(save)` runs right after `freshFinances` in `nextSeason`: it adds the recorded prize money to the new transfer budget and pushes a news line ("Season 1: Ironvale United champions. You finished 5th — £2.2m prize money."). `PRIZE_MONEY` runs 8m → 700k by position via `prizeFor(position)` (clamped). Helpers: `careerTotals(p)` (sum across clubs) and `totalsFor(p, clubId)` (club record book / player sheet).

**UI** — the League screen gained **Scorers** (this season's top 15: goals/assists/apps/avg, `scorers-tab`) and **History** (`history-tab`) tabs next to Table/Fixtures, and every played round in the Fixtures tab shows its Player of the Round (`potr-<round>`). The History tab shows your record card (`hist-titles`: titles, seasons, career W-D-L, prize money), the season list — each expandable (`hist-season-<n>` / `hist-detail-<n>`) to runner-up, biggest win and the full Team of the Season — the all-time **Records** card (`hist-records`) and this season's Player-of-the-Round feed (`hist-awards`). The player sheet gained a **Career** block (`player-career`): career apps/goals/assists, the same numbers for your club, the club trail when he has moved, and honours (`career-honours`). The Training screen's news card carries the season/prize lines. `topScorers(save, limit)` backs the Scorers tab and is empty pre-season (stats reset).

**Tests** (`describe("history, records & awards")`, 11 + a normalizeSave repair case): one-time folding of career totals + season reset, the full SeasonRecord (vs `computeTable`), prize payment + news, champion titles and user-only title counting, all-time record updates across seasons, Player of the Round (recomputed from `lastResults`), season/all-time biggest win, per-club vs career totals, four-season run with retirements, prize/ordinal rules, mid-season state (no history yet) and determinism.

## 23. Morale & squad dynamics (`morale.ts`)

Every player carries a mood (`Player.morale`, 0-100, **60 = neutral**) that moves with football reality and feeds back into the match engine, training, contract talks and the transfer market.

**Drivers** — `moraleFactors(save, p)` is the single source of truth: it returns one entry per live factor (label + per-round delta) and `moraleTick` just sums them:

- **Playing time** (the big one) — squad status comes from `squadStatus` (rank by overall within the club: `star` ≤3, `rotation` ≤11, `fringe` ≤17, `youth`; kids ≤20 are capped at `rotation`). Expectation `STATUS_WANT` = star 0.7 / rotation 0.45 / fringe 0.22 / youth 0.1 start-share; actual share from `minutesShare(p.recentMin)` (last 8 rounds' minutes, ≥55 min = a start, ≥15 = a cameo). Under by >0.18 → −4/round, under by >0.05 → −1.6, over by >0.25 → +2. Fewer than 3 rounds of data reads "Settling into the season" (+0.5) so nobody is judged before he has played.
- **Wages** — `wage / wageDemand(p)`: <0.7 → −3, <0.85 → −1.6, >1.4 → +1.
- **Contract** — expiring this season → −2. **Injury** (≥3 weeks) → −1.5. **Suspension** → −1.5. **Form** — `formOf` ≥7.3 → +1.5, ≤5.9 → −1.5. **Transfer request** → −1.
- **Results** — the club's result each round: win +1.8, draw 0, loss −1.8, applied to everyone who was at the club that round.
- **The dressing room** — after the individual pass, everyone else is pulled toward the average mood of the club's **leaders** (`leaders(save, clubId)` = top 3 by overall + 9 for the `leader` trait + 4 for 30+): `(leadAvg − morale) × 0.06`, clamped ±2 per round. A sulking leadership poisons the squad; a happy one lifts it.

**Transfer requests** — three consecutive rounds below 25 (`MORALE_REQUEST`) and a *user-club* player hands in a transfer request (+5 morale, news line); a request is withdrawn once he is back above 50 (`MORALE_RECONCILE`) — also news. Unsettled players are **bid for more often** ((`windowTick` ups the per-round offer chance to 0.75 and bids 0.7–1.05× value instead of 0.8–1.3×)), so the market punishes neglect.

**Consequences** — the mood must matter, so it lands in five places:
1. **Match edge** — `moraleEdge(p)` = 1 + (morale − 60) × 0.0015 (±6% at the extremes, exactly 1.0 at neutral so the calibration is untouched). Applied in `match.ts` to the shooter pick, the assist pick, the open-play finishing term, the interception/block/defence weights and **all four GK-skill sites** (open play, penalty, free kick, corner) plus the FK/corner taker picks.
2. **Training** — `developRound` scales growth by `1 + (morale − 60) × 0.002` (inline in training.ts to avoid an import cycle).
3. **Contract talks** — `renewContract` refuses outright (`MORALE_TALKS` = 30) unless the offer is ≥ 1.3× the demand ("offer silly money"), demands ±8% by mood (`goodFaith`), so happy players are cheaper to keep.
4. **The market** — see transfer requests above.
5. **The dressing room view** — the Squad screen's **Dynamics** tab.

**Interaction** — `talkToPlayer(save, id, kind)` (praise/warn) with a `TALK_COOLDOWN` of 4 rounds (stored as `lastTalk` = season × 1000 + round). Praise: +7 in form (≥6.8), +1 when struggling (≤5.8), +4 otherwise; warn: +6 when struggling (he agrees), −8 in form (resentment), −4 otherwise; a `leader` gets +2 on praise and shrugs off 40% of a bollocking.

**Rollover** — `nextSeason` pulls every mood halfway back to neutral, clears `recentMin` and `unhappyRounds` (a clean slate), and keeps standing transfer requests.

**UI** — `src/ui/Dynamics.tsx`, mounted as the third tab on the Squad screen (`squad-tab-dynamics`, Roster/Planner/Dynamics in a 3-col row): atmosphere card (`atmo-card`, `atmo-label`, distribution chips, the club's last-5 W/D/L strip from `SaveGame.recentResults`, and a transfer-request line), the leaders card (`leaders-card`), social groups (`group-young|core|vets` — ≤21 / 22–29 / 30+, each with average mood, its key man and a tinted bar), and the happiness list (`happiness-list`, worst first) with squad status, the top reason and Praise/Warn buttons (`talk-praise-<id>`, `talk-warn-<id>`, disabled during cooldown). Roster rows carry a mood dot (`mood-<id>`); the player sheet has a **Mood** block (`player-morale`) with the mood chip, the full factor list, the transfer-request line and its own Praise/Warn buttons.

**Tests** (`describe("morale & squad dynamics")`, 12 + a normalizeSave backfill case): neutral-at-60 edges, mood bands, star-vs-fringe playing time, winning/losing runs, every factor label plus its numeric effect, the leader pull (both directions), transfer requests in and out, every chat reaction (in form / out of form / leader / cooldown / not your player), the unhappy-player renewal refusal (and the overpay escape hatch), the on-pitch effect over 60 seeded matches, the dressing-room view builders, and determinism.

## 24. On-pitch realism: weather, officials, offside & VAR (`conditions.ts`)

Every round now comes with weather, a named referee and a pitch — the same for the whole division — and the match engine polices the laws of the game.

**Conditions** — `conditionsFor(save, round)` (seeded by `(seed, "conditions", season, round)`): weather weighted dry 38% / wet 26% / rain 14% / wind 14% / frost 8%; one of eight `REFS` (strictness 0.65–1.45 on bookings, pen tendency 0.85–1.25); pitch `good ≤6 → worn ≤12 → heavy`, downgraded a step by rain. `conditionEffects(c)` folds them into multipliers (**all exactly 1.0 for dry + a balanced ref + a good pitch**, so the neutral calibration is untouched):

- `conversion` — finishing (rain 0.9, wind 0.9, frost 0.94, wet 0.96; heavy pitch ×0.97)
- `turnover` — blocks & interceptions (rain 1.3, wet 1.12, frost 1.18; worn ×1.08, heavy ×1.18)
- `corner` — corner/second-phase frequency (rain 1.16, wind 0.92)
- `fouls` / `cards` (+ referee strictness) / `pen` (+ referee tendency)

They land in `match.ts` at: the open-play `pGoal`, the block share + both `cornerFrom*` rolls, `foulPerMatch`, the card roll, the penalty roll, plus the corner/FK/penalty conversion terms and the second-phase corner share. `MatchInputs.conditions` is optional (defaults to `DEFAULT_CONDITIONS`) and lives on `MatchState.cond`, so the live match carries the round's conditions through the half-time split (byte-identical test still holds).

**Offside** — on every open-play goal a true-offside roll (`T.offsideRate` 0.15) runs against the assistant's flag: the flag misses 35% of true offsides (`T.linesmanMiss`) and goes up wrongly on 8% of onside goals (`T.linesmanWrong`). A disallowed goal never reaches the scoreline or the scorers list; instead an `offside` stroke is added (restart: free kick to the defending side) plus commentary from `OFFSIDE_TEXT`.

**VAR** — controversial calls get reviewed 60% of the time (`T.varReview`) and reviewed errors are corrected 75% of the time (`T.varCatch`): a missed offside becomes `vr: "overturned"`, a wrong flag becomes `vr: "restored"` (the goal stands after all), a confirmed call becomes `vr: "stands"`. Penalties get their own review (`T.varPenCheck` 0.12, `T.varPenOverturn` 0.25 → the spot-kick is cancelled). Every review emits a `var` MatchEvent whose `clubId` is the side the decision favoured, so `matchStats` counts `varHome`/`varAway` straight from the commentary, alongside `offsideHome`/`offsideAway` counted from the strokes.

**Kickoff & stoppage** — `startMatch` unshifts an info event ("Heavy rain at Northport FC — … Referee: M. Doyle (a strict one).") and, when the match runs past 90, adds a minute-90 info event with the added time (the total is already `90 + 1..5`, so the added minutes are real minutes of play).

**UI** — the Home next-match card (`home-conditions`) and the League fixtures' current-round header (`round-conditions-<n>`) show `conditionLine(c)` ("Wet · Ref: T. Marsh (lenient) · Good pitch"), tinted by weather; the match screen shows the same line plus per-side `Off` counts in the live stats strip (`match-conditions`) and again in the full-time panel (`ft-conditions`) with the `VAR ×n` count.

**Tests** (`describe("on-pitch realism")`, 9): condition determinism + season pitch wear + rain downgrades, exactly-neutral defaults, rain vs dry aggregates (fewer goals, more blocks and corners), strict vs lenient referee bookings, the flag/VAR scan (offside events, overturns, restores, penalty reviews, stats == commentary), disallowed goals never counting, the kickoff/added-time announcements, conditions surviving the half-time split byte-for-byte, and determinism.

## 25. Media & press: conferences, headlines, fan confidence (`media.ts`)

The club now has a public: a press conference before every round, a rolling news feed, and two mood meters that actually do something.

**State** (`SaveGame.media`, 0.20): `fans` (fan confidence 0-100, starts 55), `respect` (how the press treat you, 55), `headlines` (newest first, capped at `HEADLINES_CAP` 20), `press` (the pending conference), `promises` (win-promises awaiting judgement), `pressCount` / `skipped`.

**The press conference** — `makePress(save)` books one per round (at `newGame`, at the end of every `completeRound`, and at the rollover), drawing **two questions** from `questionPool(save)` with a seeded no-repeat pick (`hashSeed(seed, "press", season, round)`). The pool is built from what is actually happening: a **crisis** question after 3 defeats in 4, a **flying** one after 3 wins in 4, a plain **form** question otherwise; an **opponent** question keyed to the next fixture (big test vs must-win); a **talentspot** question when your top scorer has 3+; **unrest** when a player has handed in a transfer request; **injury** when a starter is out 2+ weeks; **dressing** when someone is below 38 mood; plus a supporter-message fallback. Every question offers **three answers** with `fans` / `respect` / `morale` deltas (a targeted answer hits the `star`, `worst` or `unhappy` player at ×3 morale), a flavour `reply` and sometimes `promiseWin`.

`answerPress(save, i)` applies the deltas, logs the answer, and clears the conference after the last question (writing a "back pages" headline). `skipPress(save)` sends the assistant instead: −3 respect, −1 fans, one news line.

**Promises are checked** — `promiseWin` stores `{ round }`; when that round's result lands, a win pays fans +6, respect +2 and squad morale +4 ("A promise kept"), anything else costs fans −8, respect −3 and morale −5 ("Back-page backlash"). FM's best trick, kept.

**Headlines** — written by `mediaTick(save, lastResults)` at the end of each round: a **report** line for your match (`Northport FC 1-0 IRV — Oscar Rivas 44'`), a **fan** line after a 3-goal swing, another when fan confidence crosses 80 or drops under 25, a **press** line when a conference ends, a **promise** line when one is judged, and a seeded **rumour** (30%) naming a real player — the transfer-requested one if there is one, otherwise your top scorer.

**Fan confidence has teeth** — results move it (±4 for a win/loss, ±2 more for a 3-goal margin), the presser moves it, promises move it, and it comes back around in three places: the dressing room (`fanMoraleFactor` adds ±0.6 morale to *your* players only, via `moraleFactors`), the **gate receipts** (`mediaGate` at the rollover adds `(fans − 50) × 40k`, clamped to ±2m, to the transfer budget with a news line), and of course the news feed itself.

**UI** — `src/ui/Press.tsx`: the **MediaCard** on Home (`media-card`) shows the pending conference with a `press-open` button, the Fans/Press meters (`fansTone`/`respectTone` labels: Delirious → Turned; Trusted → Under fire) and the latest three headlines; `PressSheet` asks the questions (`press-q`, `press-answer-0|1|2`, `press-effects` for the reaction, `press-next`, `press-skip`); `NewsSheet` (`news-open`) is the full paper — meters, an amber "You owe them" band for live promises, and every headline with a `kind` chip (Report/Rumour/Terrace/Press/Promise) and its season/round.

**Tests** (`describe("media & press")`, 13): the opening conference, pool questions keyed to situation (unrest/crisis) and three answers each, answering applying effects + finishing + the back-pages headline, the targeted player taking the morale hit hardest, promises kept and broken, results moving fans and writing reports, the capped newest-first feed, per-round scheduling determinism, skipping, rumours naming real players, the morale factor + gate receipts, season determinism, and the normalizeSave backfill/repair.

## 26. Calendar: the season's dates (`calendar.ts`)

The save finally has dates. One round = one week: **season 1 kicks off Saturday 8 August 2026** and every season after starts a year later, so round R's match day is `seasonStart + (R − 1) weeks` and the training week runs Mon–Fri ahead of it. Nothing is stored — the whole calendar is derived arithmetic from `(season, round)`, so old saves get it for free.

**Dates without `Date`** — pure civil-date helpers (Hinnant's `days_from_civil`/`civil_from_days`): `serial`, `fromSerial`, `addDays`, `diffDays`, `dayOfWeek` (0 = Sunday), `daysInMonth` (leap-aware), `sameDay`, `fmtShort` ("Sat 19 Sep") and `fmtLong`. No timezone, no locale, no mutable state: the same save always renders the same calendar.

**One day** — `dayFor(save, date)` classifies a date inside the season span (the Monday before round 1 → the Sunday after the last round; outside it returns `null`):

- **match day** (Saturday) — `{ round, oppId, home, played, gf, ga, result }` from the fixture list
- **training day** (Mon–Fri) — the week's unit and intensity, labelled (`"Attacking · Hard"`)
- **rest day** (Sunday) — nothing
- **events** — `Season opener`, `Final day`, `Summer window opens/closes` (after rounds 1/3), `Winter window opens/closes` (rounds 9/10), on match day only
- **currentWeek** — true inside the week of `save.round` (falls back to the final round once the season is done)

**A month** — `calendarMonth(save, y, m)` returns a 6×7 grid with every day in its weekday column (out-of-season days keep their slot as `null`, so the grid never slides), plus the flat `days` list. `seasonMonths(save)` gives the paged month list (August → December for an 18-round season), and `upcoming(save, n)` lists the next `n` unplayed fixtures with their dates and the week's training focus.

**UI** — `src/ui/Calendar.tsx`: `CalendarView` is the **Diary** tab on the League screen (Table · Fixtures · **Diary** · Scorers · History). Month header with ‹ › paging (44px buttons), a Sunday-first 7-column grid where each 44px cell shows the day, the opponent's short code on match days (tinted green/red by result, bold when played), a dot on training days, an amber corner dot on event days, and a ring on the current week; below it a **Matches this month** list (date, round, opponent, score) and a **Dates to note** list. Tapping any day opens `DaySheet` (`day-sheet`): the long date, the fixture with home/away and full-time score, the training block with an **Open training** shortcut, the day's events, or "a rest day". The Home next-match card now carries the date too (`Next · Round 7 of 18 · Sat 19 Sep`).

**Tests** (`describe("calendar")`, 9): the civil arithmetic (serial round trip over 400 days, leap years, known weekdays, 8 Aug 2026 = Saturday), the week-by-week season layout and month paging, match/training/rest classification, results in the past vs open fixtures ahead, window and bookend markers (on match day only), the month grid's weekday alignment checked across every month of the season, "this week" following the round, `upcoming()` order and shift after a round, and determinism (identical grids, save untouched).

## 27. Match legs: in-match stamina and the bench view (`match.ts`, `live.ts`)

Players tire *during* the match now, and the match-day panel says plainly who is on, who is left and who has already been used.

**Stamina** — `MatchState.stamina` (0-100 per player on the pitch) plus `staminaRate` (their personal drain per minute, `staminaDrainPerMinute(p)`): a player starts at `staminaStart(p) = clamp(condition, 40, 100)`, drains every minute by `0.42 × fit × age` where `fit = 1.14 − physical × 0.0028` (clamped at 0.7) and `age` adds 1.4% a year from 29, and gets `T.staminaHalf` (7) back at the break. A fresh starter finishes a 90-minute match somewhere in the 60s; a 34-year-old with physical 18 is in the 40s.

**What it costs** — `staminaFactor(st) = 1 − 0.16 × (1 − st/100)`, so empty legs cost 16% and fresh legs cost nothing (exactly 1.0 at 100 — the neutral calibration is untouched). It is folded into `edge(s, p) = moraleEdge(p) × staminaFactor(...)` at the same twelve places morale was: shooter/assist weighting, finishing, both keepers, the defensive mean and blockers, penalties, and both set-piece flavours.

**The bench view** — `matchRoster(state, side)` returns who is on (slot order), who is still on the bench, `cameOn` (id + minute) and `wentOff` (id + minute; includes injuries and red cards), so the panel can separate *available* from *already used* — nobody who has gone off can return, which the old UI never said. `staminaAt(state, id, minute)` rewinds the end-of-half state to the playback minute so the numbers on screen match the clock (an off player's legs are frozen where he left them), and `staminaTint` bands them Fresh / Okay / Tiring / Running on empty.

**The AI subs itself properly** — `trySub` now weighs tiredness into the choice (`score − (100 − stamina) × 1.1`), so the opposition hooks its gassed players instead of its worst.

**UI** — the **Changes** sheet (`ch-sheet`): a dots meter for `Subs x/5` and `Windows y/3` (`Dots`), a one-line legend ("Legs = stamina left in this match · Cond = freshness going into it"), the on-pitch list with a **leg bar** per player (tinted by band, `%` in the same colour, `ON 45'` tag for men who came on, an amber square for a booking), the bench list with `Cond %`, and an **Already used** section (`ch-used`) listing everyone who came on and everyone who went off with their minute ("off 63'", "sent off 71'"). On the pitch itself, `matchPitch.drawFrame` draws a **legs gauge** — a ring arc around a player's dot, draining clockwise with his stamina, green → amber → red.

**Tests** (`describe("match legs (stamina) & the bench")`, 10): start value from condition, drain over the match with the mean in a sane band, fitter/younger draining slower (plus the on-pitch spread), the half-time recovery, a sub arriving fresh while the man he replaced keeps his number, exhausted sides performing worse over 40 seeds, `staminaFactor` neutrality and monotonicity, the tint bands, the roster through two substitutions (and the other side untouched), `staminaAt` rewinding and freezing, and the half-time split reproducing stamina exactly.

## 28. Match-day levers: instructions, talks, shouts, the assistant (`talks.ts`)

Everything the manager can say and change during the 90 minutes, all of it folding into the same weights the rest of the engine uses — and all of it journaled, so a replayed half lands on identical numbers.

**Opposition instructions** (`MatchSideState.oi`, keyed by the *opponent's* player ids) — four levers with a real trade:

- **Marking** tight/loose — tight cuts his involvement to 0.76 and hurries him (quality 0.95) at the cost of fouls (×1.1); loose invites him (1.1) but cleans up your tackling
- **Pressing** often/never — often 0.84 involvement, 0.96 quality, 1.14 fouls; never 1.12 / 1.02 / 0.88
- **Tackling** hard/easy — 0.9 / 0.97 / 1.28 against 1.06 / 1.0 / 0.78
- **Show** inside/outside — which of his weapons you live with (0.95 quality forcing him inside, 1.03 cutting in on the outside)

`oiPressure(side)` also chokes that side's **supply**: the geometric mean of the involvements, scaled by how much of their XI you singled out, multiplies their attack strength (0.86–1.05) — so pressing two men costs them chances *as a team*, and the effect compounds the more of them you mark. Aggression then shows up where it should: the foul *side* weighting uses a damped version (×0.35), while the **card** roll uses the full scale — marking their two best was measured at −6 goals for them and +75% bookings for you over 120 matches.

**Player instructions** (`MatchSideState.pi`, your own ids) — shooting often/rarely (1.35 shots but 0.95 quality), passing direct/safe (1.2 assists, 1.12 turnover risk against 0.85/0.85), freedom roam/hold (attack vs shape, 0.94–1.08 defence).

**Team talks** (`PRE_TALKS`, `htTalks(gf, ga)`, `FT_TALKS`) — four pre-match ways to send them out, three or four at half time depending on the score, three at full time. Each carries `fire`/`shape` (a match-scoped edge: "I expect nothing less than a win" is +4.5% attack) and a **tone**: `push` lands harder the happier a player is (`2.2 × (1 + mood)`, so a struggler flinches) and `soothe` does the opposite; leaders carry it 1.25×, kids take it 0.85×. The dressing-room half is permanent — `applyTeamTalk` moves every player's morale and returns the effects for the UI. One talk per stage, replayable from the state (`talkDefFor`), and the AI always gives a quiet "encourage" so both sides start level.

**Touchline shouts** — encourage / demand more / tighten up / calm down, each with `fire`/`shape`/`morale`, and `shoutScale(n)`: full effect, then 0.6, then 0.3, then **−0.15** — one too many and the players *stop listening*. "Calm down" also sets `side.calm`, which takes 15% off your foul rate.

**The assistant** — `assistantAdvice(state, side, players, ctx)` watches legs (<45%), bookings, the opponent's danger man (with a nudge to set an instruction), a keeper making saves, a foul-ridden referee and possession without bite; `halfTimeReport` adds the talk prompt ("You are behind — the players need to hear something"). The UI shows these as amber nudges in the match panel with a badge on the Subs tab.

**Knockouts** — `MatchInputs.knockout` plays **extra time** and then a **penalty shootout** (`resolveKnockout`, `shootout`): five takers by shooting+physical, scored against the keeper's reflexes/handling (`p = 0.74 + (skill − gloves)/320`, clamped 0.45–0.93), with kick-by-kick events, sudden death, and `MatchResult.pens` / `.aet` for the UI ("After extra time · 4–3 on penalties"). Dormant until a cup exists — the engine and UI are ready for it.

**UI** — `src/ui/MatchLevers.tsx` + the Changes sheet: a four-way segmented control (**Subs · Mine · Theirs · Talk**), the assistant's nudges under it, per-player instruction rows that expand into native selects, their XI with the same treatment (marking / pressing / tackling / show), and a Talk panel with the Fire/Shape meters, the stage's talk options and the shout grid (with a warning once they've heard it all). The **half-time overlay** carries the assistant's report plus the half-time talks inline; the **full-time panel** carries the last word.

**Tests** (`describe("match-day levers")`, 14): both instruction tables and their labels, marking their danger man over 80 matches (his goals down, their shots down), tackling hard filling the book, talk receptivity by mood/age/leaders, the dressing-room move, shouts fading then grating, all four lever kinds replaying byte-identically, a second talk refused, an instruction for a benched player refused, the assistant's nudges and the half-time report, the AI's own instructions, extra time + penalties (and league matches never reaching them), and determinism with levers in play.

## 29. The market, granular: loans, contracts, deals & the board (`market.ts`, `loans.ts`)

**Loans** (`engine/loans.ts`) — borrow a player for the rest of the season or send one away. `bidForLoan` scores an offer on the loan fee and the wage share you carry (`loanAsk(p, buyerStrength, sellerStrength)` is what they want: kids are easy, a gap in club strength makes them push for more), then subtracts for an **option to buy** that undercuts his likely future value and adds for an **obligation** (a guaranteed sale). Nobody loans out one of their best — the engine rejects a top-four player over 21. Limits: **3 in / 4 out**. `loaneesIn`/`loaneesOut` power the UI, `wageBill` counts only your share of the wage (in) and the remainder (out), `exerciseLoanOption` makes a loanee permanent at the agreed fee, and `loanRollover` sends everyone home at the season end — obligations complete automatically.

**Contract depth** — a deal is now `wage · years · signingBonus · perApp · perGoal · releaseClause · extensionYears`. `termsDemand(p, terms, base)` is what his agent thinks: **length** cuts the wage for under-30s and adds for veterans (−1.2%/yr of security for a kid, +2%/yr once he's 30), a **signing bonus**, **appearance/goal bonuses** and a **low release clause** each buy the wage down (capped at −18%), and a **club option** costs you a touch (he wants it to be his choice). `triggerExtension` pays the option off. A **release clause** in someone else's contract is live: `windowTick` has rivals trigger it at that exact fee, and the offer arrives marked as a clause you cannot refuse.

**Deal structure** — `DealTerms` = `fee · instalments · addon {apps, amount} · sellOn %`, and `dealValue(p, terms)` is what the seller thinks it is worth: instalments are discounted (8% a season — sellers want cash), an appearance add-on counts for ~55% of its face value (75% if he's young and likely to make the games), a sell-on adds up to half of its value. So a **lower fee plus the right extras wins deals**. `offerTerms` charges the first instalment plus the signing bonus plus an **agent fee** (`agentFeeFor(wage, bonus)` — 5% of 13 weeks), books the rest as `save.debts`, and stamps `sellOnTo` on the player so his old club takes their cut of your next sale (`paySellOn`). `settleDebts` clears instalments from each season's budget, `payTransferAddons` fires once he has made the appearances, `payAddons` settles contract bonuses from the season's apps/goals — all at the rollover, all reported.

**Offering, agents and the board** — `setListed` puts a player on the market (his morale drops, and `windowTick` is far more likely to bring you a bid), `askAgent` returns a deterministic gauge (how many clubs fit, led by whom, at what price), and `preContractTargets`/`offerPreContract` are the **Bosman** route: in the winter window you can agree terms with anyone in his final year, he joins for nothing at the rollover (`applyPreContracts`), the AI poaches yours the same way (`poachTick` — a warning lands in the news), and roughly one player in twelve generates in the last year of his deal. The **board policy** (`policyFor`) is a hard **age ceiling** (signings and loans only — you may always re-sign your own) plus soft money targets the board judges at the season end (`policyPayoff`: +£900k for following the plan, −£500k for ignoring it, tracked in `save.windowLog`). `reallocate` moves money between the transfer budget and the weekly wage ceiling at £1/wk = £52.

**UI** — `src/ui/Market.tsx`: the **MarketBar** (policy, budgets, the reallocate lever, instalment/add-on debts), the **LoansCard** (everyone in and out, with the option price), **DealStructure** (instalments / add-on after N apps / sell-on, with a "you pay £X now" readout), **ContractDepth** (years, signing bonus, release clause, per-app/per-goal, club option, and the agent's likely number), **MarketActions** (ask his agent, offer to clubs, pre-contract) and **LoanTargets** (fringe 17-23s worth borrowing, fog-respecting). The deal sheet handles loan and pre-contract modes alongside buys, renewals and free agents.

**Tests** (`describe("the market, granular")`, 19): structured deal valuation and cost, a structured fee beating cash, instalment debts created and paid across two rollovers, an appearance add-on paid when the games land, contract-depth lever by lever, an extension option triggered once, a release clause taken by a rival, loans in with share/limits/wage-bill accounting, options exercised and obligations landed, no double loans or selling a loanee, loans out and returning, the board's veto and its season-end verdict, reallocation both ways with clamps, listing and agent interest, winter-only pre-contracts, rivals poaching expiring players, and determinism across the whole market.

## 30. Individual players: bodies, targets, retraining, moves, discipline and the armband (`physical.ts`, `individual.ts`)

Everything that is about one player rather than the team.

**Match sharpness** (`physical.ts`) — `Player.sharpness` (0-100, `SHARP_START` 85) is *match fitness*, deliberately a different number from `condition` (freshness going into a game) and from in-match legs (stamina). It rises +6 for a full game and +3 for a cameo, falls −3 a round when he sits out (−4 while injured), and `sharpnessFactor(p)` is **exactly 1 at 85 or above**, sliding to 0.93 as rust sets in — so a cold player loses up to 7% of everything he does. It folds into the same `edge()` in `match.ts` as morale and stamina.

**Wear and tear** (`Player.jaded`, 0-100) — accumulates ~6 a full game, scaled ×1.6 when he starts tired, ×1.4 past 30 and ×1.15 on heavy training; −12 a round of rest (−8 while injured). `jadedFactor` is exactly 1 up to 35 and reaches 0.95 at 100. `pronenessOf(p)` (age × build × wear × rust) raises his injury risk, and a heavily-jaded player's knocks last a week longer. `injuryKindFor(weeks)` turns any lay-off into a Knock / Muscle strain / Hamstring / Ankle ligaments / Broken foot, so the news reads like football rather than a number.

**International weeks** — rounds 5 and 12 (`INTL_ROUNDS`). `internationalTick` calls up each club's best player (plus a 21-or-under cap for the user's club), giving him `+1 cap`, −8 condition, +5 sharpness, +3 morale and a 2%×proneness chance of coming back with a knock. The Diary marks those match days **INT**.

**Individual targets** — `targetOptions(p)` offers three levels each of goals (position and ability weighted), appearances and average rating, the top one flagged *ambitious*. `setTarget` records it on the player (ambitious ones lift morale +3 straight away), `targetSoFar`/`targetLine` read the live progress, and `settleTargets` (first thing in `nextSeason`) pays it off: met +8 morale, missed −4 (−8 if it was the big ask).

**Retraining and moves** — `Player.altPos` (max 2) is a second position: `retrainOptions` offers DF/MF/FW neighbours (never keepers), `startRetrain` sets `Player.retrain`, and `retrainTick` grinds 3 + minutes/12 per round scaled by age (a 21-year-old learns 1.5× faster than a squad man, a 31-year-old 0.7×) until he is comfortable there. `Player.moveProgress` is a **deliberate trait**: `moveOptions` lists the traits he lacks where he clears the attribute bar and the position group, and `moveTick` grinds it out, 1.4× faster when the week's training unit matches (attacking teaches Shoots on Sight / Arrives in Box / Runs With Ball, defending the three defensive moves, passing Killer Balls, set pieces Dead-Ball Specialists, physical Presses and Leader).

**Discipline** — `disciplinaryCases(save)` reads the last match: a red card is a decision, four bookings means a word. `applyDiscipline` fines him (two weeks' wages straight into the transfer budget, −6 morale, +1 press respect), warns him (−2), or lets it go (+1 morale, −1 respect); every call is logged in `save.discipline` so the card clears once you have dealt with him.

**The armband** — `save.captain`/`save.vice`, set with `setArmband` (+4 morale for the man who takes it, −5 for the one who loses it). `leaders()` scores the captain +14 and the vice +6 on top of ability, the Leader trait and age, so the armband genuinely changes whose voice carries in the dressing room and in every team talk. `armbandIn(save, playerIds)` returns whoever is wearing it on the pitch — the captain, else the vice — and `matchPitch.drawFrame` paints a small amber **C** badge on his shoulder.

**UI** — `src/ui/Individual.tsx`: the player sheet carries **Body** (Sharp and Wear bars, band labels, injury line, caps), **Season target** (options to progress bar to drop), **Development plan** (learn a position / learn a move with progress bars, or an honest "nothing left to work on") and **Armband** cards; the Squad screen carries the **armband card** (captain and vice pickers) and the **discipline card** for this round's offenders, and the roster flags **rusty** (sharpness under 70) and **heavy legs** (wear over 60).

**Tests** (`describe("individual players…")`, 12): sharpness rising and falling with the exact factor floor, a cold side measurably worse over 80 matches, wear building faster for tired and older players and clearing with rest, injury labels and proneness, international call-ups (caps, tired legs, nobody away in a normal week), targets set and judged (met, and missed at both ambition levels), retraining to a second position and the two-position cap, learning a move with the unit bonus and the attribute gate, the discipline decision with its budget and mood consequences, the armband lifting its holder's standing in the room and passing to the vice when he is off the pitch, and old saves backfilled.

## 31. Quality of life: the inbox, player search, the data hub, save slots and help (`inbox.ts`, `Search.tsx`, `DataHub.tsx`)

**The inbox** (`engine/inbox.ts`) — one feed for everything the club tells you. `pushNews` now writes an inbox entry as well as a news line, so every existing message (academy graduates, injuries, targets, board notes) is covered for free; the match report, incoming bids, the press-conference booking, red-card discipline prompts and the board's window verdict each push their own item with a category (`match` · `transfer` · `press` · `discipline` · `board` · `club`) and a `screen` to jump to. `SaveGame.inbox` is capped at `INBOX_CAP` (60), `inboxUnread` drives the badge on the Home bell, `openInboxItem` marks and returns the target screen, `markAllInboxRead` clears the lot, and `normalizeSave` rebuilds the feed (dropping junk entries) on old saves.

**Player search and compare** (`ui/Search.tsx`, the third tab in the Transfer centre) — filter every player in the world by name, position, age band, minimum rating, club, transfer-listed and final-year. Everything about a rival still goes through `estimateFor`, so the rating filter works from your scouts' read and unknown players read "no report" rather than leaking the truth. Up to two players go into the compare tray: attributes side by side (only the rows your knowledge covers), then apps/goals/assists/minutes/cards and wage.

**The data hub** (`ui/DataHub.tsx`, the Data tab on the League screen) — every shot of your last match is now kept: `Stroke.xg` carries the chance's expected goals (the model's own pre-shot probability, 4 shot paths: open play, penalty, direct free kick, corner header) and `finalizeMatch` folds them into `MatchResult.shots` with the shooter's position in the attacking frame. The tab draws a **shot map** (dot size = xG, colour = goal/saved/blocked/off target, solid = yours), the **xG timeline** (cumulative, both sides), a **season bar chart** of goals for and against per round, and a shots/xG summary. All of it is derived, so it costs the save a few hundred bytes per match and nothing at all in the sim.

**Save slots and autosave** (`state/save.ts`) — the live save still lives in `fm-save-v1` (nothing about the existing flow changes); slots are extra copies under `fm-slot-<n>` with a small index (`fm-slots`) holding club, season, round and timestamp. Slot 0 is an **autosave** written whenever the season or round moves on (piggy-backed on the debounced persist); slots 1-3 are manual, with Save / Load / Delete in Settings. Loading a slot replaces the live save and persists it.

**Help and comfort** (`ui/screens/Help.tsx`) — an in-app manual: the basics, the three body numbers (cond / legs / sharp + wear), match day, squad and individuals, the market, and the world (fog, press, history). The same screen carries the **reduce-motion** toggle (`localStorage fm-motion`), which `MatchScreen` reads on every frame: with it on, players step straight to their shape instead of sliding, so the match still plays out without the motion.

**Tests** (`describe("quality of life…")`, 8): the inbox collecting news and match reports with unique ids, the unread count following open/read-all, the cap and kind filters, old saves backfilled, shots with xG in sane bounds and goals matching the scoreline, xG tracking the score over a run of matches, a JSON round trip keeping the new data, and determinism with the whole lot in play.

## 32. Pre-season and form: friendly weeks and the hot hand (`preseason.ts`, `stats.formFactor`)

**Pre-season** (`engine/preseason.ts`) — a season no longer starts cold. `makeFriendlies(save, season)` builds **three friendlies on the three Saturdays before the opener** (18 and 25 July, 1 August for season 1) against three deterministic clubs, alternating home and away. They live in `save.fixtures` with **negative rounds** (`PRE_ROUNDS = [-3, -2, -1]`, `friendly: true`), so the whole existing live-match machinery works untouched: `userFixture` finds them, `startLive`/`completeRound` handle them, and `save.round` simply runs −3 → −2 → −1 → 1. A new save opens at round −3 with `phase: "pre"`.

- `completeRound` routes any negative round to **`completeFriendly`**: it applies the result's condition loss, knocks and **ratings (into the form guide)** — and nothing else. No apps, no goals, no cards, no table, no awards, no press, no fan swing. It does run the development, scouting and transfer ticks, and the window is **open** (`transferWindow` treats pre-season as summer: "pre-season business").
- When the last friendly is done, `phase` flips to `"league"`, `round` becomes 1 and the news carries the opener. `preseasonState(save)` reports progress for the UI, `isFriendlyRound(r)` is the guard, `nextSeason` rebuilds a fresh pre-season for the new campaign.
- `league.computeTable` skips `friendly` fixtures and `formGuide` skips them too, so pre-season never leaks into the table, the W/D/L strip or the record books.
- The calendar grew by three weeks (`PRE_DAYS = 21`): `seasonMonths` starts in **July**, `friendlyDate(season, i)` gives the dates, `dayFor` marks those Saturdays with `friendly: true` and the fixture as the day's match (the ring only shows while that week is the one being played). The Diary shows an **FR** tag.
- UI: the Home screen gets a **Pre-season card** (which friendly, what they're for, and a **Skip the rest of pre-season** button wired to the store's `skipPreseason`, which plays the remaining friendlies through `playRound`). The next-match line reads "Pre-season · friendly 2 of 3 · Sat 25 Jul" instead of a round number.

**Form on the pitch** (`stats.formFactor`) — form already existed as a display (last six ratings, ★ chips, sortable) and fed morale; now it **bites directly**: `formFactor(p)` is `1 + (avg − 6.5) × 0.012` clamped to **0.96–1.04**, exactly 1 until he has two ratings behind him, and it multiplies into the same `bodyEdge` as sharpness and wear, so a man in form finishes and defends better and a man out of form is a drag. `formFreshnessTick` (called every league round with the set of players who appeared) counts rounds without football in `Player.formMiss` and **wipes the streak after three** — the hot hand has to keep playing to stay hot.
The Home screen now carries an **In form** card: the three hottest regulars and any cold ones (below 6.4), with "hot players play above their level, cold ones below it".

**Tests** (`describe("pre-season & form…")`, 9): a new save opening in pre-season with three friendlies on the right Saturdays, a friendly building legs and form while leaving the table and season stats untouched (and the window open), the first league round starting after the third friendly, the diary's friendly Saturdays and July paging, a hot side beating a cold one over 80 matches, `formFactor` neutral/clamped, three weeks out killing a streak, the rollover building a fresh pre-season, and determinism through both phases.

## 33. Motivation: individual talks, team meetings and the big stage (`motivation.ts`, `MatchState.big`)

Three layers, one idea: **the dressing room is a lever, and it has a right moment.**

**Individual talks (v0.28)** — the v0.18 praise/warn pair grows into four conversations plus a promise:

| Kind | Lands when | Effect |
|---|---|---|
| **Praise** | form ≥ 6.4 | +7 (leaders +9) |
| **Warn** | form < 6.4, or morale already low | +6 on the struggling; −4 on a man in form |
| **Reassure** | poor form but morale still standing (≥ 50) | +5; reads as empty words to a broken man (+1) |
| **Challenge** | morale ≥ 65 **and** form ≥ 6.2 | +4 and a **±1.5% match edge for two rounds** (`Player.pumped`); −5 on anyone not ready to hear it |

One conversation per player every `TALK_COOLDOWN` (4) rounds; leaders take praise further (+2) and shrug off criticism more easily. `talkAdvice(save, p)` picks the conversation the player needs — the Squad screen's **Needs a word** card lists the three best candidates with the reason and a one-tap button.

**Promises (`pledgeMinutes`)** — "give me minutes". The player gets +3 now and a `Player.pledge` due next round. Play him (`settlePledges` at round completion, 30+ minutes) → +6 and the debt is paid; leave him out → **−8 morale and an unhappy round**. Injury or suspension blocks the promise, and a player who'll have his minutes is asked to accept a **bench role** instead.

**Team meetings (`teamMeeting`)** — one every two rounds (`meetingAvailable`), six themes, each with a context fit:

| Theme | Strong fit when | Risky when |
|---|---|---|
| Hold the standards | squad morale ≥ 62 | morale < 50 |
| Stick together | morale < 50 or two straight defeats | morale ≥ 70 ("no crisis here") |
| Aim higher | you sit top four | you sit 7th or lower |
| Nobody is above the badge | unrest, transfer requests | no unrest at all |
| Give the fans something | fans < 50 | fans ≥ 70 |
| Rest and recover | average condition < 70 | condition ≥ 85 |

A strong fit moves every squad member **+5** (leaders +6), even **+2**, risky **−4**; `recover` also hands out **+6 condition**, `fans` lifts fan confidence **+3** when it lands, and `badge` knocks a round off every unsettled player's patience. The result screen lists who took it best — and the board noticed.

**Big matches (`bigMatchFor`)** — a fixture is big when the stakes are real, checked against the live table (both sides must have played at least three rounds):

- **Title six-pointer** — both sides top four, within three points
- **Against the leaders** — the leaders at your place/away with you within four
- **The decider** — the final round, within three points of the top

`bigMatchFor` returns a label + one-line stakes read; the Home next-match card wears it, and it's **symmetric** — the opposition feel the pressure too. In the engine, `MatchState.big` multiplies each player's contribution: **−1.5%** for the young (under 22) or the anxious (morale < 45), **+2%** for leaders and the confident (morale ≥ 75), neutral otherwise (`bigMatchEdge`). Friendlies never count.

All three are deterministic: talks and meetings are seeded off `season × round × id` and everything the manager does lands in the save, so the same seed replays identically. The pre-match talks and shouts of v0.23 keep their own multipliers — motivation is what you do between matches.

## 34. Discipline: walking the tightrope (`discipline.ts`)

Cards now have consequences beyond the sending-off.

**Accumulation bans** — a season's yellows (`Player.yellows`, reset each pre-season) are counted in blocks of **five**: the 5th booking is a **one-match ban**, the 10th another, and so on (`banForCrossing`). The engine checks the crossing after every match — for every club, not just yours, so AI sides lose players too.

**The warning before it** — the 4th booking (and the 9th) puts a note in the inbox: *one booking from a ban*. The player sheet says the same thing under **Cards** (`yellowBanLine`), and the squad list tags him **· 1 yellow from a ban**. `onTheEdge(players, clubId)` lists everyone walking the rope, sorted by how deep they already are.

**Different reds, different bans** — the match engine now tags *why* a player went (`PlayerUpdate.redKind`):

- **second yellow** — one match (he was already going off)
- **straight red** — **two matches** ("reckless lunge"), announced with its own news line

**Serving** — the existing rule does the rest: a suspended player can't be picked — each match he doesn't play burns one week off the ban (`Player.suspension`). Only **your** players generate inbox items; the rest of the division collects its bans quietly.

**Reading it in the app** — squad list: `· suspended` / `· 1 yellow from a ban`; player sheet: the Cards stat, the ban line and the remaining matches out.

## 35. Commercial & facilities: the club's own money (`commercial.ts`)

Until now the club only had a transfer budget and a wage ceiling — both handed down by the board. **v0.30.0 gives the club an account of its own**, and something to spend it on.

**The account (`Finances.balance`).** Money in: the **shirt sponsor** (weekly), **commercial & merchandise** (a slice of how the crowd feels: `(fans − 35) × £2.8k/wk`, capped), and the **gate** — home matchdays only, `capacity × £30 × how full the ground is` (attendance tracks fan confidence, floor 55%). Money out: **facility upkeep** (`level × £4k/wk` across the four facilities). League and broadcast money is assumed to cover the wage bill — the account is the investment pot, so a mid club is cash-generative (+£8–16m/season) but never silly. **The board quietly covers any shortfall** over £50k with a warning in the inbox: the balance never goes negative. `bankToTransfer` moves £500k+ chunks of it into the transfer kitty, which is how the two economies touch.

**Sponsorship.** A new club starts with the shirt on the market: `makeSponsorOffers` produces **three offers** whose value tracks stature (`squadValue × 0.0022 + £40k`, +£60k while you're champions) — a two-season front-of-shirt, a richer **three-season** deal, and a cheap **one-season** deal for flexibility. Signing pays a signing bonus into the account immediately; when a deal expires (season rollover) the market reopens. `rollSponsor` handles both.

**Facilities (1–5, four of them).** Each one multiplies a system that is already in the engine — none of them are cosmetic:

| Facility | Effect | Where it lands |
|---|---|---|
| Training ground | `0.88 + 0.06 × level` on weekly gains (level 2 = neutral, level 5 = +18%) | `developPlayer(…, facilityMult)` |
| Academy | `0.85 + 0.07 × level` on a youth player's **ceiling** | `makeYouth` |
| Medical centre | `1.20 − 0.07 × level` on weeks out (level 5 ≈ −15%) | `medicalWeeks` at every injury site |
| Stadium | 8k/12k/16k/20k/24k seats by level | `gateReceipts` |

**Building.** `startBuild` charges `FACILITY_COST` (stadium £3.0m / training £1.5m / academy £1.0m / medical £0.8m) from the account and sets a `Build` with `FACILITY_WEEKS` to run (10/5/5/4). One site at a time; `tickBuilds` runs with each league round and raises the level when the last week falls, with a news + inbox line. Refusals are explicit: maxed, already building, or not enough in the account.

**Reading it in the app.** A new **Club** tab (the seventh nav item) shows the account breakdown, the shirt (current deal or the three offers with a sign button), and the four facilities with level pips, their effect line, and an upgrade button priced at the next level. Wages and the gate are shown in k-per-week so the weekly rhythm is legible on a phone.

**Determinism.** Sponsor offers are seeded off `season + clubId`; build ticks and account movements are pure functions of the save, so the same seed replays identically. New saves seed a campus per club (`makeFacilities`): bigger clubs have better everything, with a seeded spread at the smaller ones.

## 36. Match feel: how the twenty-two travel (`src/ui/motion.ts`)

The simulation was never the problem — the *picture* was. Players were drawn as plain circles that glided to a computed shape position with an exponential lerp at one speed band, with a slow ±2-unit sway. Nothing accelerated, nothing turned, nobody faced anywhere, and off the ball the whole block moved as one.

**The motion layer (v0.31.0) is presentation only.** It never writes back into the timeline, so results, ratings and determinism are untouched (the golden test still passes byte-for-byte).

**Bodies with physics.** Every player is a point with velocity, an acceleration budget and a **turn rate** (`stepPlayer`). He picks a gait from a real band structure — walk 1.7, jog 3.6, run 6.4, sprint 8.8 units/s — eases in and out instead of snapping, and **cannot change direction faster than his turn rate**, so at speed he takes corners wide (13 rad/s standing, ~6 at a full sprint, and 14 more when he is close to the ball and pivoting on it). A sharp change of direction *costs him speed*, the way a real player chops his feet. An arrival curve brings him down over the last couple of units and plants his feet instead of letting him buzz around the target.

**Anticipation.** The layer tracks ball velocity and sends the presser to where the ball **is going** (`ball + v·lead`, lead 0.28–0.6 s by match speed) rather than where it has been. The man in possession is steered onto the ball itself.

**Football behaviour, per player.** The nearest defender **always hunts the ball** (within 26 units), the second man covers (18), and everyone else reads the game with effort scaled by how close the action is — nobody sprints from forty yards. A defender within 4.5 units of the carrier **jockeys**: he holds a 0.95–1.65-unit gap and faces his man rather than climbing into his shirt. The carrier is held to a dribbling pace (~72% of his gait).

**Facing and body language (drawn in `matchPitch.ts`).** Each token now has a heading: feet in stride (the footfall phase advances by *distance travelled*, so the gait always matches the speed), a forward lean proportional to effort, and a nose showing which way the shoulders point. Players face the ball when it is near or when they are standing still, and face their direction of travel otherwise. The armband stays upright; the legs gauge and selection ring are unchanged.

**Crowding.** `separate()` relaxes overlapping bodies (three passes, min 1.05 units) so nobody stands inside anybody.

**Urgency is per player, not per team** — the old team-wide `hurry` multiplier is gone. Tired legs matter: a player on 10% legs runs at 86% of his top speed and visibly lags late on.

**Measured on a live match (320px viewport, 1× speed, 3 s of play):** five distinct gait bands (stand 4% · walk 14% · jog 24% · run 36% · sprint 23%), 254 distinct headings across 22 bodies, minimum body separation 1.4 units, the nearest defender closing to **1.6 units** of the ball, and a steady **60 fps** (worst frame 18.7 ms).

**Tests:** eight pure-function tests in `src/ui/motion.test.ts` pin the physics — easing in, the speed caps, arc turns, arrival, the jockey stand-off, separation, ball-facing, and the gait bands.

## 37. Manager onboarding: choosing a club with the fog on (`onboarding.ts`, `screens/NewGame.tsx`, `screens/Welcome.tsx`)

A new career no longer starts with ten bare club names. You **generate the league first**, then choose from real data — with the fog of a candidate's eye-view.

**Public record (exact).** `CLUB_LORE` gives every club a city, a founding year, a ground, a title count and a one-line identity (*"Sleeping giant with a big ground and a budget that never quite matches it."*). The **stadium capacity** comes from the v0.30 facilities, so the number on the brief is the number you inherit.

**Between the lines (fogged).** Money, squad quality and the campus are **words, not numbers** (`bandFor` ranks a club against the division in five bands):

| Read | Words |
|---|---|
| Wealth | Very wealthy · Wealthy · Comfortable · Careful with money · Shoestring |
| Squad | Title favourites · Top-four calibre · Solid mid-table · A battle ahead · Survival scrappers |
| Training / Academy / Medical | Elite · Strong · Good · Modest · Limited |

**The board will want** follows the squad band (`expectationFor` — *"Win the league."* down to *"Be competitive. Anything else is a bonus."*) and a **job difficulty** label (Easy / Fair / Hard / Brutal) reads the same way. `clubBrief(save, clubId)` returns all of it, deterministically, for any club.

**The first day (`screens/Welcome.tsx`).** Taking the job replaces the guesses with facts: a two-page briefing — the board's written expectation, squad size, your best player and the first league fixture, then **the accounts** (transfer budget, wage ceiling, club account), a line on what the shirt is worth (`sponsorHint`, ranked not numeric), and `wagePressure` — whether you are near the ceiling before you start. "Let's go" sets `save.onboarded` and drops you on the Home screen, which now carries the board's expectation under the club header, so the brief stays in view all season. The screen never blocks: "Skip the briefing" is one tap away.

**Save shape.** `SaveGame.preview` (a generated world, held in the store while you shop), `SaveGame.onboarded` (backfilled `true` for old saves so returning players are not lectured). `prepareWorld(seed?)` lets the selection screen — and QA — build the league deterministically before the choice is made.
