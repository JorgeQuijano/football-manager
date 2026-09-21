# Component Library Candidates — football-manager

Evaluated 2026-09-21 for: React + Vite + Tailwind v4 + TS strict, mobile-first, ≤250 KB gz budget, custom CSS-variable themes (Tunnel / Matchday / Floodlight / Sketchbook / Teletext), data-heavy but widget-light UI (tables, bottom sheets, selects, tabs, progress bars).

## The five

### 1. shadcn/ui — copy-paste components on headless primitives
- Model: CLI copies component source into the repo (`components/ui/*`); you own it; no versioned UI package.
- Primitives: since 2026-07-03 defaults to **Base UI** (`@base-ui/react` — stable since Dec 2025, v1.8, built by ex-Radix engineers at MUI). Radix still fully supported via `-b radix`.
- Styling: Tailwind v4 + CSS variables + `data-slot` — same token/theme pattern as our theme-preview page; our 5 themes wire in directly.
- Bundle: only components you copy (~10–20 KB gz for a small set). Zero runtime CSS.
- Works with Vite (no Next.js needed).
- Trade-off: copied code = manual updates (by design); narrower catalog than full libs (fine — we need ~6 components).

### 2. Base UI — headless primitives, used directly
- `@base-ui/react`: 35+ unstyled, accessible components (dialog, select, tabs, popover, progress, …), TS-first.
- Small per-component cost; maximum control; small dependency surface.
- Trade-off: fully DIY — we'd wrap ~6 widgets by hand. Choose only if we want zero copy layer.

### 3. daisyUI 5 — Tailwind plugin, zero JS
- Semantic classes (`btn`, `card`, `table`, `badge`) plus a first-class theme system: custom themes = plain CSS variables under `@plugin "daisyui/theme"`, switched via `data-theme` — exactly our theme architecture; the ◐ cycle from the preview works as-is.
- Zero dependencies, ~20 KB typical, works wherever Tailwind v4 does.
- Trade-off: no JS behaviors — complex widgets (focus traps, keyboard nav) need a headless partner or native `<dialog>`.

### 4. React Aria Components (Adobe)
- 50+ style-free components; gold-standard accessibility + adaptive touch/mouse/keyboard interactions; TS-strict; v1.20 (Sep 2026).
- Small per-component cost; complete styling freedom.
- Trade-offs: more API to learn; heavier composition (many contexts) — considered harder to mix with other libraries.

### 5. HeroUI v3 — styled kit on Tailwind v4 + React Aria
- Ground-up rewrite (Mar 2026): 75+ web components, Tailwind v4 native, React Aria behaviors, CSS-var/OKLCH theming with `data-theme` switching, no provider required, selective CSS imports.
- Fastest route to polished screens; monthly releases.
- Trade-offs: adopt their visual system; v3 is young (~6 months) with breaking changes in minor versions; dependency churn.

## Skipped and why
- MUI / Ant Design / PrimeReact — heavy (100–300 KB gz), not Tailwind-native, enterprise aesthetic.
- Mantine / Chakra — excellent, but own styling systems (CSS modules / PandaCSS); wrong fit beside Tailwind v4.
- Headless UI — Tailwind-native but a tiny set (basic menus/dialogs only); Base UI supersedes it for our needs.
- Tamagui / Gluestack — React-Native-first.

Later if needed (not now): charts via Recharts or Tremor.

## Recommendation
**shadcn/ui (Base UI variant)** with a minimal set: button, dialog/sheet, select, tabs, progress. Matches the stack, the budget, our CSS-var theming, and keeps code ownership for a long-lived project.
Fallbacks: HeroUI v3 (fully styled, less assembly) · daisyUI (CSS-class speed, themes first-class).
