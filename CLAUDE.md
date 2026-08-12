# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mobile-first PWA for logging gym sessions. React 19 + Vite + CSS Modules on the
front end, Express + Postgres API in `api/`. Deployed on Render via
`render.yaml` (static site + Node API + Postgres).

## Commands

```
npm run dev        # Vite dev server
npm run build      # production build — run before deploying
npm run lint       # see baseline below
npm run preview    # serve the built output

cd api && npm run dev     # API with --watch
```

`npm run lint` reports **38 pre-existing errors**. Compare against that
baseline rather than expecting zero; most are `react-hooks` v7 rules firing on
existing patterns, plus `api/` being CommonJS linted as ESM browser code.

**There is no test framework** — no test script, no test files, no test
dependencies. Changes are verified by driving the real app. Chromium is
preinstalled in Claude Code web sessions at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `npm i playwright` in a
scratch directory and script against it. Pure modules (`lib/strength.js`,
`lib/progression.js`, the generators) can be tested directly in Node, but only
after bundling — the app relies on Vite's extensionless import resolution, so
`node file.mjs` fails on `import ... from './movements'`. Bundle first with
`npx esbuild test.mjs --bundle --format=esm --platform=node --outfile=out.mjs`.

### Running the API locally

`api/db.js` passes `connectionString: process.env.DATABASE_URL` to `pg`. Leave
`DATABASE_URL` unset and `pg` falls back to the standard `PGHOST`/`PGPORT`/
`PGUSER`/`PGDATABASE` variables with SSL off, which is the easy way onto a
local Postgres:

```
PGHOST=/tmp PGPORT=5432 PGUSER=postgres PGDATABASE=hgwtest \
  JWT_SECRET=dev PORT=3999 node server.js
```

Then run the front end with `VITE_API_URL=http://localhost:3999`.

## Deploying

**Always deploy when work is complete — no need to ask.**

Render deploys from the repository's default branch, currently
`claude/create-new-app-URTzX` (there is no `main`/`master`), and `render.yaml`
pins no `branch:` key. So shipping means:

```
git push -u origin <feature-branch>          # keep the branch history
git checkout claude/create-new-app-URTzX
git merge --ff-only <feature-branch>
git push -u origin claude/create-new-app-URTzX   # this is what triggers Render
```

Pushing a feature branch alone deploys nothing. Note that egress to
`*.onrender.com` is blocked from Claude Code sessions, so the deploy cannot be
confirmed from here — say so rather than implying it was verified.

The static site and the API deploy from the same blueprint and should ship
together. If the front end ships without the API, calls using newer settings
fields return 500; the outbox retries them rather than dropping them, but the
UI misbehaves until the API catches up.

### Schema changes

There is no migration tool. `initDb()` in `api/db.js` runs
`CREATE TABLE IF NOT EXISTS` plus idempotent `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` on every API boot. Add new columns there. `server.js` exits non-zero if
`initDb()` throws, so a bad migration is a service that will not start.

New `user_settings` fields must also be added to the PATCH allowlist in
`api/routes/settings.js`, or writes are silently ignored. Non-scalar values are
`JSON.stringify`'d, so prefer JSONB columns — a JSONB column round-trips
`true`/`false`/`null` cleanly, which a BOOLEAN column does not.

## Architecture

State lives in one `AppContext` (`src/context/AppContext.jsx`); there is no
store library. Everything a user owns — history, active plan, custom movements,
templates, unit and rest preferences — hangs off `useApp()`.

- **Durability.** Every mutation goes through `src/lib/outbox.js`: written to
  localStorage first, then sent, with backoff and retry. 4xx is dropped as
  permanent, everything else retries; settings patches coalesce. Do not add
  direct `historyApi`/`settingsApi` writes for user actions — enqueue them, and
  reconcile optimistic rows via `onOpSynced`.
- **In-progress workouts** are snapshotted to localStorage (`src/lib/draft.js`)
  because iOS evicts backgrounded PWAs without warning.
- **Timers** must count off a wall-clock deadline, never by decrementing on an
  interval — background tabs are throttled and the count stalls. See
  `useWorkoutTimer` and `RestTimer`.
- **e1RM** (`src/lib/strength.js`) is the canonical strength metric for records,
  charts and progression. Prefer it over raw weight or volume.

### Custom movements

The most repeated source of bugs here. A user-defined movement must reach every
list and every generator:

- **User-facing pickers** merge as `[...customMovements, ...MOVEMENTS]` so the
  user's own movements sort above a 168-entry library.
- **Anywhere a name-keyed `Map` is built** (e.g. `movMap` in `WorkoutOverlay`)
  merge the other way, `[...MOVEMENTS, ...customMovements]`, so on a name clash
  the user's definition wins the `Map` insertion.
- **The generators take the list as an argument**, defaulting to empty:
  `buildWorkoutFromMovement(primary, customMovements)`,
  `buildCustomPlan({ ..., customMovements })`,
  `padToMinDuration(strings, { targetMinutes, customMovements })`.

`equipment` strings are load-bearing, not free text: `'Barbell'` drives the
plate calculator, `'Machine'` drives the no-machines substitution, and both
feed plan scoring. New movements are always defined through the shared
`components/MovementForm`, used by the Movements screen, the workout builder
and the in-workout add sheet — it supplies the fixed vocabularies from
`data/movements.js` and rejects duplicate names.

## iOS / PWA constraints

The primary target is an iPhone home-screen web app, which is more restrictive
than mobile Safari:

- **Orientation cannot be locked.** The manifest's `orientation` member is
  ignored and `screen.orientation.lock()` is unimplemented on iOS.
  `components/RotateGuard` covers the screen in landscape instead. Do not reach
  for the `transform: rotate(90deg)` trick — it leaves `vh`/`vw` resolved
  against the pre-rotation viewport and this app depends on fixed positioning.
- **Bottom sheets are height-capped** (`max-height` in `vh`/`dvh`). Any tall
  content inside one needs its own scroll area with the submit control pinned
  outside it, or the button lands off-screen. Prefer `dvh` so iOS measures the
  visible viewport, and use `env(safe-area-inset-bottom)` on anything at the
  bottom edge.
- **Verify layout at real handset heights** (375×667 is the tight case), not at
  a convenient desktop viewport — a form can fit at 900px tall and overflow on
  every real phone.
- The service worker caches aggressively, so a deployed change may need the app
  closed from the iOS app switcher before it appears.
