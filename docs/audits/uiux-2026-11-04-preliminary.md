# TaskRing UI/UX audit — 2026-11-04 (JST)

Status: preliminary source audit; NOT browser-verified, NOT an implementation sign-off.

## Confirmed source facts

- `assets/css/main.css` imports `mobile-execution.css?v=20261104.1` before `app-design.css?v=20261104.2`; the latter can override earlier rules where cascade conditions permit. A browser computed-style inspection is required to establish any actual regression.
- `index.html` references `main.css?v=20261104.2` and declares `data-build="20261104.2"`.
- `playwright.config.js` configures Chromium and WebKit with a localhost server, service workers blocked in tests, Asia/Tokyo timezone, and reduced motion. Production PWA update behavior therefore requires separate coverage.
- `package.json` provides `test`, `test:browser`, `check:syntax`, and `build` scripts.
- `game-play-policy.js` reads owner-scoped policy rows and keeps play tier and story focus as separate attributes; UI work must preserve these semantics.

## Risks requiring verification

1. **P1 / cascade risk:** later app-design selectors may override mobile-specific layout. Compare computed styles at 320–1920px before changing CSS.
2. **P1 / PWA test coverage:** service workers are blocked by Playwright's default config. Add a separate update lifecycle test rather than inferring PWA safety from existing browser suites.
3. **P1 / state retention:** internal tabs, task completion, and editor rerenders need live checks of window scroll, horizontal tab scroll, focus, and draft preservation.
4. **P2 / maintenance:** multiple layered CSS files with dated version suffixes increase the need for selector-level dead-rule and override analysis; do not delete on naming evidence alone.

## Required next gates before merging

- Verify latest main SHA, CI, CSS runtime loading and service worker cache/version.
- Run actual Chromium and WebKit responsive and interaction matrix with before/after screenshots.
- Fix only reproducible defects; add regression tests and run Node + browser suites.
- Confirm no production Gist/Supabase writes and no changes to IDs, tombstones, sync conflict handling, tier scoring or editor draft semantics.
- Open PR, inspect CI, merge only after successful checks, and verify GitHub Pages production build.

No UI behavior, storage, or production configuration was modified in this audit-only commit.
