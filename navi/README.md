# Navi on the Spend Pulse landing page

The Navi button on the Spend Pulse landing page opens a Navi chat built on the
**Navi Prototype Template** — `coupa/Navi-Prototype-Template`, branch
`Navi-Template`, taken at commit `83e161c`.

| File | What it is |
|---|---|
| `spend-pulse.yaml` | The conversation: entry chips, typed-prompt intents, and every reply. **The file to edit.** Format: the template's `schema.md`. |
| `build.sh` | Validates `spend-pulse.yaml` (every `next` / `auto_next` resolves, no unreachable nodes) and writes it as JSON into `index.html`'s `<script id="navi-script-data">`. |
| `navi-engine.js` | The template's engine, unchanged except that icon paths point at `assets/navi/`. |
| `navi-template.css` | The template's `navi-styles.css`, scoped under `.navi-tpl` so it cannot reach this app's own `.navi-panel` / `.navi-card`, without the template's screenshot-page rail (`.sp-*`), `body` reset and fonts. |
| `../assets/navi/` | The template's Navi and supplier-card icons. |

## Editing the conversation

1. Edit `spend-pulse.yaml`. Keep chips to what the landing page shows — the
   rail's signals, with the same suppliers, amounts and dates as their cards.
   No em dashes in anything a reader sees.
2. From the repo root, run `sh navi/build.sh` (needs Ruby, which macOS has).
3. Reload the page.

## How it fits the app

- The landing page's own Navi button opens the panel; the template's launcher
  stays in the markup for the engine to bind to, hidden.
- The panel docks under this app's top bar and menu (`--navi-header-offset`,
  set from `naviTop()`), above drawers and modals and under the app's own
  signal-launched Navi flows, tooltips and toasts.
- It closes when you leave the landing page, and when a signal starts its own
  Navi flow (Create Sourcing Event and the rest), so only one Navi is open.
- The signal-launched flows still use this app's own chat (`NAVI_FLOWS` in
  `app.js`); only the landing page's Navi button uses the template.

## Overrides kept in `styles.css`, not in the template copy

- Hide the template's launcher; place the panel at z-index 65.
- `#navi-tpl .navi-artifact-bar-col{justify-content:flex-end}` — the template's
  full-page bar chart hangs its bars from the top edge (its own Spend Pulse
  example does too). Worth fixing in the template itself.

## Updating from the template

Re-copy `navi-engine.js` (repointing `"assets/` to `"assets/navi/`) and
regenerate `navi-template.css` with the same scoping. Copy any new icons into
`assets/navi/`.
