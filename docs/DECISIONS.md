## v0.40 — Light mode

The app shipped dark-only for thirty-nine versions. The theme is now System / Light / Dark via a single cycling icon button, resolved pre-paint from `localStorage` (`touchline-theme`) with the OS followed live only in System mode. `:root` holds the light palette; `[data-theme="dark"]` overrides it (the dark palette is unchanged). Amber/red/green accents that were hard-coded hex classes across 21 files became semantic tokens (`--warn`, `--danger`, `--positive`, `--*-soft`, `--*-line`).

## v0.41 — The ball follows the players

Match visuals were animated on their own track (the ball went to each slot's *formation coordinate*, at a fixed speed), which is why passes finished where nobody stood. The ball is now anchored to the motion bodies: live targets, distance-based durations, a `"feet"` phase that glues it to the carrier, and damped wander for whoever has it. Measured rest-gap to the nearest player: 0–1.1 units (was tens). The sim, timeline and goldens are untouched.
