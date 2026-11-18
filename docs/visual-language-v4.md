# TaskRing Visual Language v4 · Operations Atelier

2026-11-18 | Scope: visual identity, icon vocabulary, component presentation, responsive refinements.

## Product direction

A usable personal command center, not a decorative game interface. The style is **dark navy operations HUD + champagne-gold action emphasis + light high-density execution surfaces**. Personality comes from small interface details: measured icon placement, thin semantic rails, modest gradients, compact numeric cards, clear hierarchy, and contextual microcopy. No remote font, illustration, emoji icon dependency or additional vendor UI library.

## Source of truth and cascade

- `assets/js/app.js`: `TASK_UI_ICON_PATHS` and `taskUiIcon()` provide the **single inline SVG family**, 24×24 viewBox, rounded line artwork, currentColor. Static `data-task-ui-icon` placeholders are hydrated on boot. Dynamically rendered modules use `taskUiIcon()` directly.
- `assets/css/visual-system-v4.css`: **last visual layer** after `main.css` and `task-workbench.css`. Only targeted component styling and visual tokens; it never introduces status, scheduling, persistence or network logic.
- `assets/css/tokens.css` and legacy component CSS remain intact for compatibility. Avoid adding a second icon renderer or applying sweeping `!important` overrides.
- `index.html` version and `service-worker.js` cache key are updated together. Offline shell includes the new stylesheet.

## Semantic module identity

| Area | Glyph | Accent concept |
| --- | --- | --- |
| Overview | layout-dashboard | warm gold / command |
| Daily | clipboard-check | sky blue / execution |
| Weekly | calendar-days | slate-indigo / planning |
| Life | sprout | sage green / habitual action |
| Game | gamepad-2 | subdued violet / operation |
| Learning | book-open | teal blue / focused study |
| Time | timer | amber / measurement |
| Library | folder-open | slate blue / archive |
| Config Studio | sliders-horizontal | navy / controlled editing |

Accent color is an aid to scanning, **not a separate completion or priority system**. Green denotes completion, red denotes overdue/alert, amber denotes deadline/primary action. Required/optional and T1/T2/T3 still depend on business data and text labels.

## Icon rules

1. Page or module identity: one dominant outline glyph, approx. 20–23px, aligned to the title.
2. Section identity: 16px outline glyph in a restrained 27–29px local surface; number badge on the opposite side.
3. Action controls: 14–18px SVG before a visible label; do not remove accessible names or replace a word with an unexplained icon.
4. Inline metadata: up to a few 12px symbols for *exceptional* states (deadline, optional, overdue), not for every word.
5. Status controls and checkbox affordances retain original accessible text and click targets. Icon-only actions require an explicit `aria-label`.
6. SVG markup is owned by `taskUiIcon()`; no emoji in production UI as an icon substitute.

## Component and accessibility rules

- Cards: neutral 1px outline, reserved 2px semantic edge, subtle shadow, minimal transform, genuine hierarchy.
- Heading: English overline only when helpful to orient the module; Chinese title is primary.
- Numerics: tabular aligned figures, two-part fraction formatting, no fake precision.
- Mobile: keep existing five-item dock and scroll preservation. Do not increase scrolling just to make decorative headlines.
- Touch targets: aim 44px; keep all checkboxes actionable, including game T3 optional tasks.
- Focus: explicit high-contrast 2px outline. Never convey error/completion exclusively via color.
- `prefers-reduced-motion: reduce` removes nonessential transitions.
- `forced-colors: active` supplies visible high-contrast state outlines.

## Visual coverage

The new design layer touches: global header and dock, command dashboard and task cards, daily and weekly content, life cards and action controls, game boards and tier navigation, learning tracks and history, time ledger, reference library, More, control center, and Config Studio. It does not replace module-specific scheduling, task IDs, Gist, Supabase or original JSON interfaces.

## Regression checklist

- `node --check` for every changed JavaScript file.
- Existing Node integrity and behavior tests.
- Playwright Chromium + WebKit for 320/390/768/1440 widths.
- Navigation, source jump, task completion/undo, editor data preservation, local/remote status, PWA update.
- Verify SVGs are present at runtime and text labels remain visible.
- Before merging, inspect new responsive screenshots together with previous `visual-capture.spec.js` evidence.

## Explicit non-goals

No new storage schema; no AI-generated task data; no recalculation of game ranks or completion rates; no new animation blocking interaction; no external images/font services.
