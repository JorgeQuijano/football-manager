# The match engine, as pictures

*Read this with `docs/engine-map.html` open in a browser (click any box for the formula it hides). Everything here is drawn straight from the code — file and line references included.*

Two rules to hold in your head:

- **Blue = the simulation.** It decides results. Deterministic: same seed, same season, byte for byte.
- **Green = the view.** It decides what you *see* — movement, intents, facing. It never writes back.

```mermaid
flowchart LR
  subgraph SIM["SIMULATION — decides results (blue)"]
    A["seed + season + round"] --> B["minuteStep × 90"]
    B --> C["chances · fouls · set pieces<br/>cards · injuries · subs"]
    C --> D["timeline strokes + match state"]
    D --> E["finalizeMatch<br/>goals, ratings, cards, form"]
  end
  subgraph VIEW["VIEW — decides what you watch (green)"]
    F["timeline stroke"] --> G["phases: player → point → outcome"]
    G --> H["motion layer: velocity,<br/>gait, facing, jockeying"]
    H --> I["canvas at 60 fps"]
  end
  E --> F
  J["live levers: talk · shout · sub · OI · PI"] -.->|"edges & instructions"| C
```

## 1 · The minute loop

Every minute re-rolls the match from scratch. There is no memory of "momentum" — only state (score, stamina, cards, instructions).

```mermaid
flowchart TD
  M["minute m"] --> L["legs: stamina −rate<br/>per player on the pitch"]
  L --> S["team strength:<br/>attackStrength vs defenseStrength<br/>× mentality × OI × home"]
  S --> H{"home chance?<br/>p = base×2×att/(att+def)<br/>clamp 2–45%"}
  S --> A{"away chance?<br/>same, mirrored"}
  H -->|yes| RH["resolveChance(home)"]
  A -->|yes| RA["resolveChance(away)"]
  H -->|no| P{"neither side?"}
  A -->|no| P
  P -->|yes| PO["possessionPhase:<br/>a passing move, no shot"]
  RH --> F["foul roll (20/match) →<br/>who fouled is a weighted pick"]
  RA --> F
  PO --> F
  F --> I["injury roll (0.32/match)"]
  I --> SUB["AI subs at 55′ / 72′ / 80′<br/>most-knackered first"]
  SUB --> HT{"minute 45?"}
  HT -->|yes| BREAK["half time: +stamina"]
  HT -->|no| NEXT["minute m+1"]
  BREAK --> NEXT
```

## 2 · Inside a chance — where individuals actually decide

This is the only place in the sim where a *named player* makes a *choice*: who shoots, who assists, and what happens.

```mermaid
flowchart TD
  C0["resolveChance(atk, def)"] --> S1["1 · WHO SHOOTS<br/>weighted pick among outfielders"]
  S1 --> S2["2 · THE MOVE<br/>buildChain: 3–6 passes,<br/>forward-biased, ends at the shooter"]
  S2 --> S3["3 · CONVERSION<br/>pGoal = base × finish × keeper × weather<br/>clamp 4–30%"]
  S3 -->|"roll: goal"| D1{"4 · THE DRAMA<br/>onside?"}
  S3 -->|"roll: no goal"| N1{"outcome shape"}
  D1 -->|"truly offside"| O1["flag? → offside<br/>VAR: stands / not given"]
  D1 -->|"onside"| O2["wrong flag? → offside<br/>VAR may restore the goal"]
  D1 -->|"clean"| GOAL["GOAL<br/>+ assist (82%)"]
  N1 -->|"42% of them"| SAVE["save → corner 45%<br/>rebound chance"]
  N1 -->|"20% × defence"| BLOCK["block → corner 50%"]
  N1 --> WIDE["wide / over → goal kick"]
  WIDE --> OUT["corner 40% from a deep move"]
```

**What each pick multiplies** (the shot weight, `match.ts:532`):

```text
weight(shooter) =
    position         FW 4.0   ·  MF 2.4  ·  DF 0.7
  × (0.5 + shooting/100)
  × role.shot        a Poacher shoots; an Anchor doesn't
  × trait            shoots_on_sight ×1.25
  × attEdge          morale · form · sharpness · wear · challenge bonus
  × instruction      your "shoot more" PI
```

## 3 · Set pieces and penalties — their own decision nodes

```mermaid
flowchart TD
  FK["foul"] --> Z{"where?"}
  Z -->|"attacking third (18%)"| AT{"penalty? (7% of those)"}
  Z -->|"elsewhere"| RESTART["free kick / play on"]
  AT -->|yes| PEN["resolvePenalty"]
  AT -->|no| DFK{"direct shot? (45%)"}
  DFK -->|yes| FKS["resolveFreeKick<br/>goal 7% base ± keeper, wall"]
  DFK -->|no| CROSS["crossed into the box"]
  PEN --> PK["taker: finishing & nerve<br/>vs keeper · 78% base<br/>VAR may overturn (25%)"]
  C1["corner (from block/save/out)"] --> C2["taker: nominated, or passing<br/>× assist role × dead_ball"]
  C2 --> C3["target by routine:<br/>near post → physical<br/>far post → shooting"]
  C3 --> C4["goal 2.6% base × familiarity<br/>(set-piece training pays here)"]
```

## 4 · The bias stack — what every weight is made of

Nothing is a coin flip on its own. Each pick multiplies a stack; remove any layer and the number changes.

```mermaid
flowchart LR
  W["any weighted pick"] --> A1["ABILITY<br/>the attribute it needs"]
  W --> A2["ROLE<br/>ROLE_DEFS weights"]
  W --> A3["TRAIT<br/>10 flavours, 1.25–1.4×"]
  W --> A4["THE DAY<br/>morale · form · condition<br/>sharpness · wear"]
  W --> A5["INSTRUCTIONS<br/>mentality · OI · PI"]
  W --> A6["CONTEXT<br/>home 1.08 · weather · ref"]
  W --> A7["OPPONENT<br/>their defence, their OI"]
```

## 5 · Where your live levers land

```mermaid
flowchart LR
  TALK["team talk / shout"] -->|moraleEdge| EDGE["attEdge / defEdge"]
  SUB["substitution"] -->|fresh legs| STA["stamina pool"]
  OI["opposition instruction"] -->|oiPressure| TEAM["team strength"]
  PI["player instruction"] -->|instrFor shot/finish/defense| PICK["weighted picks"]
  MENT["mentality"] -->|att/def multipliers| TEAM
  SET["set-piece plan"] -->|familiarity| CORNER["corner & free-kick outcomes"]
  TACT["formation / roles"] -->|attackStrength, defenseStrength| TEAM
```

## 6 · The formula card

| # | What | Formula | Where |
|---|---|---|---|
| 1 | Chance per minute, per side | `clamp(0.108 × 2 × att/(att+def), 0.02, 0.45)` | `match.ts:1340` |
| 2 | Team attack | `attackStrength(XI, roles, mentality) × homeAdvantage × oiPressure` | `match.ts:1337` |
| 3 | Shot weight | see §2 — position × shooting × role × trait × edge × PI | `match.ts:544` |
| 4 | Conversion | `0.115 × (1+(finish−60)/120) × (1+(60−keeper)/160) × weather` → clamp 4–30% | `match.ts:562` |
| 5 | Per-player edge | `moraleEdge × staminaFactor × sharpness × wear × form × challenge` | `match.ts:72` |
| 6 | Fouls per match | `20/90` per minute × `conditionEffects.fouls` | `match.ts:1361` |
| 7 | Card share of fouls | `0.18 × weather × fouling tactics` → ≈ 3.6 cards/match | `match.ts:1364` |
| 8 | Stamina drain | `staminaDrainPerMinute(player)` — pace and physical set the rate | `match.ts:1318` |
| 9 | Corner → goal | `0.026 × familiarityFactor(routine)` | `match.ts:1130` |
| 10 | Penalty | `0.78 ± finishing vs keeper`, VAR review 12% → overturn 25% | `match.ts:864` |

## 7 · The view layer (green) — decisions with no consequences

```mermaid
flowchart LR
  R["role motion profile<br/>press · support · push · drop · width · roam"] --> I["14 intents<br/>hold · support · run_behind · press_ball · cover …"]
  M2["mentality + phase"] --> I
  B["ball position + velocity"] --> I
  I --> MOT["motion layer (v0.31)<br/>velocity · accel · turn rate · gait"]
  MOT --> DRAW["oriented bodies, feet in stride,<br/>jockey stand-off, no overlaps"]
```

## 8 · Code map

| File | What lives there |
|---|---|
| `src/engine/match.ts` | the whole sim: minute loop, chances, fouls, set pieces, shootouts |
| `src/engine/tuning.ts` | every constant in one table (`T`) |
| `src/engine/ratings.ts` | attack/defence strength, role scoring (`ROLE_DEFS`) |
| `src/engine/live.ts` | the manager's in-match levers, journaled as changes |
| `src/engine/intents.ts` | the 14 off-ball intents (view only) |
| `src/ui/motion.ts` | body physics for the picture (view only) |
| `src/ui/screens/MatchScreen.tsx` | the 60 fps loop: strokes → phases → canvas |

---

*Prefer to click instead of read? Open **`docs/engine-map.html`** — same content as an interactive map, no build step, works offline.*
