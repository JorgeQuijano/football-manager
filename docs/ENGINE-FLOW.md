# The match engine, as pictures

*Read this with `docs/engine-map.html` open in a browser (click any box for the formula it hides). Everything here is drawn straight from the code — file and line references included.*

Two rules to hold in your head:

- **Blue = the simulation.** It decides results. Deterministic: same seed, same season, byte for byte.
- **Green = the view.** It decides what you *see* — movement, intents, facing. It never writes back.

```mermaid
flowchart LR
  subgraph SIM["SIMULATION — decides results (blue)"]
    A["seed + season + round"] --> B["minuteStep × 90"]
    B --> C["moves & shots · fouls · set pieces<br/>cards · injuries · subs"]
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

Every minute plays one possession move for the side that keeps the ball. There is no memory of "momentum" — only state (score, stamina, cards, instructions, and the ball: its side, its spot and whether it is live — `ballSpot`, v0.48).

```mermaid
flowchart TD
  M["minute m"] --> L["legs: stamina −rate<br/>per player on the pitch"]
  L --> S["team strength:<br/>attackStrength × mentality × OI<br/>× home × style × counter window"]
  S --> P{"who keeps the ball?<br/>v0.48: the ball has a side and a spot<br/>a restart is firm — theirs to play<br/>a live ball is contested: keep ≈ 78% ± strength"}
  P -->|home| MOVH["possessionPhase(home):<br/>one move, played"]
  P -->|away| MOVA["possessionPhase(away):<br/>one move, played"]
  MOVH --> SHOT{"a pass into the shooting range?<br/>→ resolveShot"}
  MOVA --> SHOT
  SHOT --> F["foul roll (20/match) →<br/>who fouled is a weighted pick"]
  F --> I["injury roll (0.32/match)"]
  I --> SUB["AI subs at 62′ / 72′ / 80′<br/>most-knackered first"]
  SUB --> HT{"minute 45?"}
  HT -->|yes| BREAK["half time: +stamina"]
  HT -->|no| NEXT["minute m+1"]
  BREAK --> NEXT
```

## 2 · Inside a move — where individuals actually decide

This is the only place in the sim where *named players* make *choices*: who receives, who carries the ball into the box, who takes the shot the move produces, and what happens.

```mermaid
flowchart TD
  C0["possessionPhase(atk)"] --> P0["playMove: the chain is played<br/>target drawn by lenPref × fwd × switch<br/>× open × gk × end × OI"]
  P0 --> ARR{"a completed pass into<br/>the shooting range? (y ≤ 30)"}
  ARR -->|no| N0["turnover (where he stands, ty)<br/>held — a stalled move in range keeps it (v0.48)<br/>or out of play — the clearance"]
  ARR -->|yes| OS{"offside at the reception?<br/>live-block line → flag?"}
  OS -->|flagged| OF["free kick; the move dies"]
  OS -->|play on| X{"a cross?<br/>wide ball + an aerial target"}
  X -->|"yes (6–20%)"| CROSSH["the header man attacks it<br/>duel vs their best header<br/>aerial = height + physical"]
  X -->|no| S4
  CROSSH --> S4["CONVERSION<br/>pGoal = 0.24 × distF × finish × keeper × weather<br/>clamp 4–30%"]
  S4 -->|"roll: goal"| D1{"the flag stayed down —<br/>was he really onside?"}
  D1 -->|"truly offside (tight miss)"| O1["VAR: overturned / stands"]
  D1 -->|"wrong flag"| O2["chalked off; VAR may restore"]
  D1 -->|"clean"| GOAL["GOAL<br/>+ assist (82%)"]
  S4 -->|"roll: no goal"| N1{"outcome shape"}
  N1 -->|"42% of them"| SAVE["save → corner 45%<br/>rebound chance"]
  N1 -->|"20% × defence"| BLOCK["block → corner 50%"]
  N1 --> WIDE["wide / over → goal kick"]
  WIDE --> OUT["corner 40% from a deep move"]
```

**What each pick multiplies** (the receiver weight, `possession.ts:230`):

```text
weight(receiver) =
    lenPref          a length preference peaked at 7 + 29·directness
  × fwd              forward bias scaled by risk
  × switch           a bonus for switching the play (× width)
  × open             1 − 0.5 × pressure on the receiver
  × gk               keeper discount (0.05)
  × end              the end boost — men in the shooting range on the final ball
  × oiInvolve        the opponent's marking on that man (compounded on the final ball)
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
  OI["opposition instruction"] -->|involve weights in the move| PICK["who receives, who shoots"]
  OI -->|oiPressure| TEAM["possession share"]
  PI["player instruction"] -->|instrFor shot/finish/defense| PICK
  MENT["mentality"] -->|att/def multipliers| TEAM
  SET["set-piece plan"] -->|familiarity| CORNER["corner & free-kick outcomes"]
  TACT["formation / roles"] -->|attackStrength, defenseStrength| TEAM
```

## 6 · The formula card

| # | What | Formula | Where |
|---|---|---|---|
| 1 | Who has the ball (v0.48) | the side that had it — a restart is firm; a live ball keeps it with `keep = clamp(keepBase + 2(1−keepBase)(p_side−½), 0.5, 0.95)` | `match.ts:1687` |
| 1b | Possession share (the prior retention bends to) | `pPossHome = clamp(0.5 + 0.35·(attH−attA)/(attH+attA) + 0.12·(retH−retA), 0.22, 0.78)` | `match.ts:1672` |
| 2 | Team attack (the possession prior) | `attackStrength(XI, roles, mentality) × homeAdvantage × oiPressure × style.att × transitionEdge` | `match.ts:1586` |
| 3 | Receiver weight (the move) | see §2 — lenPref × fwd × switch × open × gk × end × oiInvolve | `possession.ts:230` |
| 4 | Conversion | `0.24 × distF × (1+(finish−60)/120) × (1+(60−keeper)/160) × weather` → clamp 4–30%; `distF = clamp(1.25 − distGoal/42, 0.4, 1.15)` | `match.ts:773` |
| 5 | Per-player edge | `moraleEdge × staminaFactor × sharpness × wear × form × challenge` | `match.ts:94` |
| 6 | Fouls per match | `20/90` per minute × `conditionEffects.fouls` | `match.ts:1610` |
| 7 | Card share of fouls | `0.18 × weather × fouling tactics` → ≈ 3.6 cards/match | `match.ts:1027` |
| 8 | Stamina drain | `staminaDrainPerMinute(player)` — pace and physical set the rate | `match.ts:60` |
| 9 | Corner → goal | `0.026 × familiarityFactor(routine)` | `match.ts:1397` |
| 10 | Penalty | `0.78 ± shooting vs keeper`, VAR review 12% → overturn 25% | `match.ts:1092` |

## 7 · The view layer (green) — decisions with no consequences

```mermaid
flowchart LR
  R["role motion profile<br/>press · support · push · drop · width · roam"] --> I["14 intents<br/>hold · support · run_behind · press_ball · cover …"]
  M2["mentality + phase"] --> I
  B["ball position + velocity"] --> I
  I --> MOT["motion layer (v0.31)<br/>velocity · accel · turn rate · gait"]
  MOT --> DRAW["oriented bodies, feet in stride,<br/>jockey stand-off, no overlaps"]
```

## 9 · The week (between matches)

```mermaid
flowchart LR
  M["Mon"] --> T["Tue"] --> W["Wed"] --> TH["Thu"] --> F["Fri"] --> S["Sat · match day"]
  S -->|"round completes"| M
  P["weekPlan: one activity per day<br/>set once, carried over"] -.-> M
  M -.->|daily tick, all clubs| A["condition · freshness · sharpness<br/>knock risk · development factor"]
  S -->|only day that| E["runs the match engine"]
```

*Four training days = the baseline week (1.0× growth). Heavy weeks buy development and pay in freshness; light weeks do the opposite.*

## 8 · Code map

| File | What lives there |
|---|---|
| `src/engine/match.ts` | the whole sim: minute loop, moves & shots, fouls, set pieces, shootouts |
| `src/engine/possession.ts` | the played move: targets, dice, the chain (v0.46) |
| `src/engine/positions.ts` | `shapeFor` — the attack/defend geometry sim and view share (v0.46) |
| `src/engine/tuning.ts` | every constant in one table (`T`) |
| `src/engine/ratings.ts` | attack/defence strength, role scoring (`ROLE_DEFS`) |
| `src/engine/live.ts` | the manager's in-match levers, journaled as changes |
| `src/engine/intents.ts` | the 14 off-ball intents (view only) |
| `src/ui/motion.ts` | body physics for the picture (view only) |
| `src/ui/screens/MatchScreen.tsx` | the 60 fps loop: strokes → phases → canvas |

---

*Prefer to click instead of read? Open **`docs/engine-map.html`** — same content as an interactive map, no build step, works offline.*
