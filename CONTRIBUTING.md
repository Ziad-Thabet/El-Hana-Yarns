# Contributing to El-Hana Yarns

This is a client-commissioned production system, currently maintained solo
by [@Ziad-Thabet](https://github.com/Ziad-Thabet). It's public for
portfolio/reference purposes — see `LICENSE` before reusing anything.

Issues and PRs are still welcome for genuine bugs or improvements. Please
read this file first so a contribution can actually be merged.

## Before you start

- Open an issue describing the bug or proposed change before writing code,
  unless it's a trivial typo fix.
- Check `CHANGELOG.md` under "Unreleased" — some areas are actively being
  rewritten and touching them mid-migration will conflict.

## Project structure

```
src/
  features/<domain>/         # sales, purchases, reports, expenses,
                              # online-orders, customers-debts, drivers,
                              # employees, categories, auth, alerts
    components/
    hooks.ts
    types.ts
  lib/
    i18n/                    # ar.data.ts, en.ts, index.ts, LanguageContext.tsx
    constants/                # getter-based label objects (locale-safe)
    config/
    hooks/
    theme/
  components/
    layout/ ui/ products/
db/
  migrations.cjs             # versioned schema migrations
  repositories/              # one file per domain, raw SQL via better-sqlite3
  helpers/                   # transaction.cjs, dateFilter, ids, images, numbers
shared/                      # cjs + mjs dual-format shared enums/rules
workers/                     # utility-process jobs (Excel building)
tests/                       # suites, fixture builder, runner
electron-main.cjs            # the handle() gate every IPC call passes through
preload.js
ipc-channels.cjs             # every channel, its permission and its capability
audit-descriptors.cjs        # what each channel records in the activity log
```

Respect the existing domain boundaries (`eslint-plugin-boundaries` enforces
this). A `features/<domain>` module should not directly import internals
from another feature — go through shared `lib/` utilities or hooks instead.

## Coding standards

- **Avoid `any`.** `strict` is currently off in `tsconfig.app.json` — that is
  a debt to pay down, not a licence. Write new code as though it were on, and
  do not add `any` without a comment saying why.
- **All Arabic UI strings must route through `src/lib/i18n/ar.data.ts`.**
  Never hardcode Arabic text inline in a component — this breaks the
  bilingual switching system. English strings go through `en.ts`, and both
  files must gain the same keys in the same change.
- **Tailwind: use logical classes** (`ms-*`, `me-*`, `ps-*`, `pe-*`) instead
  of physical (`ml-*`, `mr-*`, `pl-*`, `pr-*`) so layout mirrors correctly
  in RTL. This is an active migration — if you touch a component that still
  uses physical classes, convert it as part of your change.
- **IPC channels** must be registered in `ipc-channels.cjs` with both a
  permission level and a capability, and handled through the `handle()`
  wrapper in `electron-main.cjs`. Never call `ipcMain.handle` directly: that
  wrapper is where the session is resolved, the capability is checked and the
  activity log is written, so a channel that bypasses it is both unauthorised
  and unaudited.
- **All SQL lives in `db/repositories/`.** Schema changes go through a new
  version in `db/migrations.cjs` — never an ad-hoc `ALTER` at startup.
- **Operating rules belong in `shared/settingsSchema.cjs`,** not as literals in
  a component or a query. If you find yourself typing a threshold, a timeout or
  a retention count, it is a setting.
- **Friday is always a shop day off** — never included in shift/salary
  calculations. If you touch scheduling or payroll logic, this is a hard
  business rule, not a bug.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(sales): add partial refund support to invoice detail dialog
fix(db): correct debt invoice number uniqueness check
refactor(reports): split DashboardReportView into grouped sections
docs: update README prerequisites for better-sqlite3 build tools
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `style`.
Scope = the feature domain or area touched (`sales`, `db`, `i18n`, `reports`, etc.).

## Branching

- `main` is protected — no direct pushes.
- Branch from `main`: `feat/<short-description>`, `fix/<short-description>`.
- Rebase on `main` before opening a PR; keep history linear where practical.

## Tests

`npm test` builds a fixture database from scratch and runs every suite in
`tests/suites/` — 452 checks in about fifteen seconds. See
[`tests/README.md`](tests/README.md) for how the fixture is built and how to
add a suite.

Anything touching money, stock, permissions or the schema needs a suite entry.
The bar is not coverage; it is that the check would have caught the bug you are
fixing.

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npm run lint` passes with no new warnings
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run build` succeeds
- [ ] No hardcoded Arabic/English strings added outside `lib/i18n/`
- [ ] New IPC channels registered in `ipc-channels.cjs` and routed through
      `handle()`
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] No `.db`, `.env`, or `userdata/` files included (check `git status`
      against `.gitignore` before pushing)

## Local setup

See `README.md` for install steps and prerequisites. There are no default
credentials: a database with no users opens a registration screen, and the
first account created becomes the owner.
