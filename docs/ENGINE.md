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
  roles.ts       11 roles: attribute weight vectors + shot/finish biases, per-position role groups
  formations.ts  builtinFormation(), resolveFormation(), validateFormation(), scratchSlots()
  ratings.ts     Scores (overall/attack/defense), team strengths, suitability, auto/fix/remap/validate lineup
  league.ts      Fixtures (double round-robin), league table, form guide
  generate.ts    newGame(): clubs, squads, attributes, fixtures, initial lineup
  match.ts       Minute-tick match simulation → MatchResult (events, ratings, updates, scorers)
  advance.ts     playRound(), nextSeason() — orchestration and application of consequences
  index.ts       Barrel export
```

Dependency direction: `rng`/`types` are leaves; `tuning`, `roles`, `formations`, `league` depend only on them; `ratings` adds roles+tuning; `match` sits on ratings+roles+tuning+rng; `advance`/`generate` orchestrate.

## 3. Data model (`types.ts`)

- `Player` — `pos` (GK/DF/MF/FW), 7 attributes (`pace, shooting, passing, defending, physical, reflexes, handling`), `condition` 0–100, `injuredWeeks`, `suspension`, `apps`, `goals`.
- `Club` — `strength` (generation-time offset), `formation` (AI preference; always a built-in).
- `Fixture` — `round`, `homeId`, `awayId`, `played`, goals once played.
- `FormationSlot` — `{ pos, x, y }`; **x 0=left→100=right, y 0=opponent goal→100=own goal**.
- `FormationDef` — `{ id, name, slots[11] }`; `id` is a built-in `FormationId` or a custom `cf-…`.
- `Lineup` — `formation: string` (resolved via `resolveFormation`), `starters[11]`, `bench[7]`, `mentality`, `roles[11]` (one `RoleId` per **slot**, not per player).
- `PlayerUpdate` — what a match wants applied to a player: `minutes, goals, yellow, red, injuredWeeks, conditionLoss`. Players with 0 minutes get no update.
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
- **Roles** (11): each is two weight vectors + two scalars:

  | Role | Short | Group | Attack leans on | Defence leans on | shot | finish |
  |---|---|---|---|---|---|---|
  | Shot Stopper | GK | GK | — | reflexes .7, handling .3 | 0 | 1 |
  | Sweeper Keeper | SK | GK | — | reflexes .55, handling .25, passing .2 | 0 | 1 |
  | Stopper | STOP | DF | pace/passing/physical | defending .5, physical .3, pace .2 | 0.5 | 0.95 |
  | Ball-Playing Defender | BPD | DF | passing .55, pace, physical | defending .4, passing .25 | 0.7 | 0.95 |
  | Wing-Back | WB | DF | pace .45, passing .35 | pace .35, defending .3 | 0.9 | 0.95 |
  | Box-to-Box | B2B | MF | passing/pace/shooting/defending | physical .35, defending .3 | 1.0 | 1.0 |
  | Playmaker | AP | MF | passing .55, shooting .2 | passing .3, defending .25 | 0.85 | 1.0 |
  | Ball-Winner | BWM | MF | physical, defending, passing | defending .45, physical .35 | 0.55 | 0.95 |
  | Poacher | POA | FW | shooting .55, pace .35 | weak (def .45/phys .4) | 1.25 | 1.12 |
  | Target Man | TM | FW | physical .45, shooting .35 | physical .55, defending .3 | 0.95 | 1.0 |
  | Pressing Forward | PF | FW | pace .4, shooting .35, physical .25 | physical .4, pace .3, defending .3 | 1.05 | 0.95 |

  Defaults per position: keeper / stopper / b2b / presser. `shot` scales shooter-selection weight, `finish` scales conversion — both consumed by `match.ts`.
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

## 8. Match simulation (`match.ts`)

Inputs: clubs, both XIs + benches (available players, slot order), mentalities, `RoleId[]` per side, rng. Output: `MatchResult`. The engine plays 90 minutes + 1–5 stoppage.

Per minute, per side:

1. **Chance rate**: `pH = clamp(0.135 × 2 × att / (att + defOpp), 0.02, 0.45)`; home attack ×1.08. `att`/`def` are the strength functions (condition- and mentality-adjusted).
2. **Chance resolution**: shooter picked by weight `posFactor (FW 4 / MF 2.4 / DF 0.7) × (0.5 + shooting/100) × role.shot`. `finish = (0.7·shooting + 0.3·pace) × role.finish`. `pGoal = clamp(0.115 × (1 + (finish−60)/120) × (1 + (60−gkSkill)/160), 0.04, 0.3)` where `gkSkill = defenseScore(GK, role)`. Non-goals split: 42% saves, rest misses. Scorer gets +1.0 rating; keeper +0.15 per save.
3. **Fouls/cards**: ~3.6 yellows/match budget; 4.5% of fouls escalate to straight red, second yellows send off. Offenders weighted DF 2 / MF 1.5 / FW 1. −0.15 (−0.5 red) rating.
4. **Injuries**: 0.32/match; the victim is drawn with weight `1 + max(0, 80 − condition)/50` (tired players break more often); 1–4 weeks; auto-subbed if subs remain.
5. **Subs** (minutes 62/72/80, 50% each): worst `attack+defence` player off, best bench option (`overall × fit for the slot`) on. **Subs inherit the role of the player they replace** — roles live on slots, not players. Max 5 subs.
6. **Bookkeeping**: entry/exit minutes tracked; `conditionLoss = max(3, round(16 × minutes/90) + 0..3)`; end-of-match rating adjustments (win +0.2, GK/DF clean sheet +0.4, loss −0.2); ratings are rounded to 1 decimal and exist only for players with minutes > 0. Every player who appeared (starters, subs, red-carded, injured) gets a `PlayerUpdate`.

Commentary: >3 text variants per event type; events carry `minute`, `type`, optional `clubId`/`playerId`, and rendered text — the UI is a dumb renderer.

## 9. Conditioning

- Cost: a 90' starter loses ~16–19 condition (minutes-scaled, plus jitter); subs ~half.
- Recovery (weekly): `weeklyRecovery(p) = max(8, round(9 + (35 − min(age,35)) × 0.5 + (physical − 60) × 0.15))`. A 19-year-old ~20; a 34-year-old low-physical ~8 — **less than one match costs**, so veterans only stay sharp with rotation. That asymmetry is the intended gameplay.
- Floor 5, ceiling 100 between rounds; `nextSeason` resets to 100.
- `tiredThreshold` (65) drives the Tactics "tired" prompt, "Freshest XI" auto-pick, and rest suggestions.

## 10. Season orchestration (`advance.ts`)

- `playRound(save)`: clones the save; for each unplayed fixture in the current round resolves both sides — **user side** via `fixLineup` on the stored lineup (repairs persisted), **AI sides** via `autoLineup` on the club's preferred formation (custom shapes are the user's privilege); simulates; applies updates (apps++, goals, red → next-match ban, injuries, condition with floor 5); marks fixtures played; then, between rounds, decrements bans/injuries for players who sat out and applies `weeklyRecovery` to everyone. Sets `lastResults` / `lastUserMatch`, increments `round`. Returns `{ save, userMatch }`.
- `nextSeason(save)`: season+1, round 1, fresh fixtures; age +1 (cap 40), condition 100, bans/injuries cleared, apps/goals reset; lineup re-picked on the current formation (built-in or custom), mentality preserved.

## 11. Save format & migration (`src/state/save.ts`)

- `SaveGame.saveVersion = 1`, full JSON round-trip. Persisted to IndexedDB (`fm-save-v1`); export/import via JSON file.
- `normalizeSave()` runs on **every** load and import:
  - backfills `customFormations` for pre-custom saves;
  - drops invalid custom formations (`validateFormation`);
  - backfills / repairs `lineup.roles` (invalid for slot → default);
  - if the stored formation no longer resolves (deleted custom), rebuilds the lineup on 4-3-3.
- **Rule: any schema change extends `normalizeSave`.** Old saves must keep loading; bump `saveVersion` only for changes that cannot be repaired.

## 12. Balance tuning guide (`tuning.ts`)

| Knob | Raise it → | Notes |
|---|---|---|
| `baseChancePerMinute` (0.135) | more goals (chances/min) | main goal-volume dial |
| `conversionBase` (0.115) | more goals (finishing) | |
| `saveShare` (0.42) | more keeper heroics | share of non-goal outcomes |
| `homeAdvantage` (1.08) | stronger home bias | |
| `mentality` (att/def ±15%) | sharper trade-offs | |
| `yellowPerMatch` (3.6) / `redChancePerFoul` (0.045) | more cards/suspensions | |
| `injuryPerMatch` (0.32) / `injuryWeeks` (1–4) | more availability chaos | |
| `conditionLossStarter` (16) | harsher fatigue | pairs with `weeklyRecovery` coefficients |
| `tiredThreshold` (65) | earlier rotation prompts | UI-facing |
| `subMinute` (62) / `maxSubs` (5) | more/less bench impact | |

Workflow: edit → `npm test` (calibration test guards avg goals 1.6–4.2 and home-win share 0.25–0.65; current ≈ 2.7) → `npm run sim -- --seed 42 --match` to eyeball a season.

## 13. Testing & tooling

- `src/engine/engine.test.ts` — rng determinism; generation invariants (squad shape, attr bounds, 90 fixtures / 18 rounds / home-away balance); season table consistency; **determinism golden** (seed 7 twice); calibration across 40 seasons (30 s timeout — keep it); availability handling; season rollover; match bookkeeping (everyone who appeared is rated); roles (defaults valid per slot, weight orderings); lineup ops (auto roles, remap keeps players); conditioning (recovery scaling); formations (built-ins valid, custom validation, custom fill/remap).
- `src/state/save.test.ts` — `normalizeSave` migration cases (roles, customs, vanished formation).
- CLI: `npm run sim -- --seed 42 [--match] [--seasons 3]` — headless season(s) with optional commentary dump.

Invariants any change must keep green:
1. Determinism (no `Math.random`, no time/date/OS entropy in engine).
2. Purity (no mutation of inputs; matches return updates).
3. Exactly 1 GK per playable lineup; roles valid for their slot.
4. `FORMATIONS` / `FORMATION_COORDS` index alignment (test-enforced).
5. Strength math single-sourced from `ratings.ts`.
6. Old saves keep loading via `normalizeSave`.

## 14. Extension recipes

- **New role**: add the id to `RoleId` (`types.ts`), a `RoleDef` in `roles.ts`, list it in `ROLE_GROUPS`. Sim, picker, and chips pick it up automatically; optionally assert weight orderings in tests.
- **New built-in formation**: append to `FORMATIONS` *and* `FORMATION_COORDS` with identical lengths/order (`FORMATION_IDS` derives itself); the alignment test will catch mistakes.
- **New match event**: extend `MatchEventType`, emit from `match.ts` with text variants, render in `MatchScreen`. Keep events self-describing (text pre-rendered).
- **New attribute**: touches generation skews, all `overallFor`/role vectors, and the player sheet — treat as a schema change and extend `normalizeSave`.
- **Changed behavior in lineups**: keep it going through `autoLineup` / `fixLineup` / `remapLineup` so the builder, Tactics, and simulation stay consistent — do not special-case custom formations anywhere.

## 15. Performance notes

- Hot path is the minute loop (≈90–95 iterations × 2 chances × fixtures). Avoid per-call allocations: `roles.ts` iterates a fixed `KEYS` array instead of `Object.keys`; strength functions are single loops.
- A full season simulates in ~0.1–0.2 s (40-season calibration ≈ 6 s in Node). The browser plays a round synchronously on tap.
- The engine is tree-shakeable and UI-free; keep it that way.
