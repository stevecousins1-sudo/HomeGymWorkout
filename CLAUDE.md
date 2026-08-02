# HomeGymWorkout

Mobile-first PWA for logging gym sessions. React 19 + Vite + CSS Modules on the
front end, Express + Postgres API in `api/`. Deployed on Render via
`render.yaml` (static site + Node API + Postgres).

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

Pushing a feature branch alone deploys nothing.

Before deploying, run `npm run build` and drive the affected screen if the
change is user-visible. `npm run lint` currently reports 38 pre-existing errors
— compare against that baseline rather than expecting zero.

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
`JSON.stringify`'d, so prefer JSONB columns.

## Architecture notes

- **Durability.** Every mutation goes through `src/lib/outbox.js`: written to
  localStorage first, then sent, with backoff and retry. 4xx is dropped as
  permanent, everything else retries. Do not add direct `historyApi`/
  `settingsApi` writes for user actions — enqueue them.
- **In-progress workouts** are snapshotted to localStorage (`src/lib/draft.js`)
  because iOS evicts backgrounded PWAs without warning.
- **Timers** must count off a wall-clock deadline, never by decrementing on an
  interval — background tabs are throttled and the count stalls.
- **e1RM** (`src/lib/strength.js`) is the canonical strength metric for records,
  charts and progression. Prefer it over raw weight or volume.
- **Movement lists shown to the user must merge custom movements**:
  `[...MOVEMENTS, ...customMovements]` from `useApp()`. Filtering the built-in
  `MOVEMENTS` array alone hides movements the user created. Still outstanding in
  `data/planBuilder.js`, `data/workoutBuilder.js` and `lib/workoutPadder.js`,
  which take no context and would need the list threaded through.
