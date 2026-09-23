## v0.40 — Light mode

The app shipped dark-only for thirty-nine versions. The theme is now System / Light / Dark via a single cycling icon button, resolved pre-paint from `localStorage` (`touchline-theme`) with the OS followed live only in System mode. `:root` holds the light palette; `[data-theme="dark"]` overrides it (the dark palette is unchanged). Amber/red/green accents that were hard-coded hex classes across 21 files became semantic tokens (`--warn`, `--danger`, `--positive`, `--*-soft`, `--*-line`).
