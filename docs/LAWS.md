# The laws of the game in Touchline

What the match engine actually rules on, and what it does not. Written to be
audited: every "modelled" line has a test that constructs the situation and
asserts the verdict (`src/engine/engine.test.ts` → *the laws of the game*, v0.42).

## Modelled

| Law | How it is applied | Where |
|---|---|---|
| **Offside** | Judged from **positions**: the line is the **second-last defender**, and it never retreats past the halfway line. A pass must be **forward** for offside to apply at all; a receiver level with the line is onside (and flagged as a *tight* call). The **keeper is exempt**, and there is **no offside from a throw-in, corner or goal kick**. A tight call can be missed by the assistant (`linesmanMiss`, 35%) — and VAR re-derives the same ruling at the goal, so a flagged-offside goal only survives when the flag was actually missed. | `laws.ts` → `offsideLine`, `checkOffside`, `flagGoesUp` |
| **Ball out of play → restart** | Decided by *who touched it last* and *which line*: an attacker's touch over the goal line is a **goal kick**, a defender's is a **corner**, and the touchline always gives the **throw to the other side** (taken by one of their own players, not a random man in the chain). | `laws.ts` → `restartAfterOut` |
| **Back-pass rule** | A **deliberate team-mate pass** to the keeper can be picked up (`backPassHandle`, ~9% of back-passes); when he does it is an **indirect free kick** and a `foul` event names him. A ball from an opponent is never an offence. | `laws.ts` → `backPassTarget`, `keeperPicksItUp` |
| **Handball** | A share of defensive blocks strike an arm (`handballRate`, ~2%): inside the area it is a **penalty** (resolved by the normal penalty path), and the commentary says handball. | `laws.ts` → `handballVerdict` |
| **Fouls, free kicks, penalties** | Fouls per match with a zone share; free kicks resolved by routine (direct/crossed/short) with familiarity and a wall; penalties by taker vs keeper. | `match.ts`, `setpieces.ts` |
| **Cards and bans** | Yellows, second yellow, straight red; 5th yellow = a match ban, plus the discipline book (v0.29). | `discipline.ts` |
| **Substitutions** | Five per side across three in-match windows, half-time free, no returns. | `match.ts` |
| **VAR** | Goals only: reviewed, overturned (offside in the build-up, foul in the build-up), or standing. | `match.ts` |
| **Match time** | Two halves plus stoppage, driven minute by minute with stamina and injury time. | `match.ts` |

## Approximated (modelled, but not exactly)

- **Offside and deflections** — the move's *decisive pass* defines the moment. A
  deflection that starts a new phase of play is not modelled, so a goal from a
  defender's deflection can be judged against the wrong pass.
- **Advantage** — fouls lead to restarts. The referee does not explicitly "play
  on" and come back for the card.
- **Keeper's six seconds** — not modelled (a keeper may hold as long as the
  minute structure allows).
- **Keeper handling outside the area** — the engine never places a keeper
  outside his box with the ball in hand.
- **Time-wasting, dropped balls, kick-off geometry** — folded into the minute
  model rather than simulated.
- **Positions** — every side carries per-slot coordinates (`side.coords`) that
  law checks read, but players do not *run* to keep the offside line: the line is
  whatever the current slots say, refreshed as the phase moves.

## Not modelled

- Assistant referees going the other way (no "the flag stayed down" for a
  *correct* onside goal).
- Second-phase offside after a deliberate save or a rebound off the woodwork.
- The full substitution and technical-area regulations beyond the five/three rule.
- Penalty shoot-out procedure beyond the kicks themselves.
