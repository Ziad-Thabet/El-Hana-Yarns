# Contributing to El-Hana Yarns

This is a client-commissioned production system, currently maintained solo
by [@Ziad-Thabet](https://github.com/Ziad-Thabet). It's public for
portfolio/reference purposes — see `LICENSE` before reusing anything.

Issues and PRs are still welcome for genuine bugs or improvements. Please
read this file first so a contribution can actually be merged.

## Before you start

- Open an issue describing the bug or proposed change before writing code,
  unless it's a trivial typo fix.
- Check `CHANGELOG.md` under "Unreleased" — some areas (i18n/RTL pass) are
  actively being rewritten and touching them mid-migration will conflict.

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
    i18n/                    # ar.ts, en.ts, index.ts, LanguageContext.tsx
    constants/                # getter-based label objects (locale-safe)
    config/
    hooks/
    theme/
  components/
    layout/ ui/ products/
db/
  repositories/              # one file per domain, raw SQL via better-sqlite3
  helpers/                   # transaction.cjs, dateFilter, ids, images, numbers
shared/                      # cjs + mjs dual-format shared enums/rules
electron-main.cjs
preload.js
ipc-channels.cjs             # single source of truth for IPC permissions
```

Respect the existing domain boundaries (`eslint-plugin-boundaries` enforces
this). A `features/<domain>` module should not directly import internals
from another feature — go through shared `lib/` utilities or hooks instead.

## Coding standards

- **TypeScript strict mode.** No `any` unless there's a documented reason.
- **All Arabic UI strings must route through `src/lib/i18n/ar.ts`.**
  Never hardcode Arabic text inline in a component — this breaks the
  bilingual switching system. English strings go through `en.ts`.
- **Tailwind: use logical classes** (`ms-*`, `me-*`, `ps-*`, `pe-*`) instead
  of physical (`ml-*`, `mr-*`, `pl-*`, `pr-*`) so layout mirrors correctly
  in RTL. This is an active migration — if you touch a component that still
  uses physical classes, convert it as part of your change.
- **IPC channels** must be registered in `ipc-channels.cjs` with an explicit
  role permission — don't add ad-hoc `ipcMain.handle` calls elsewhere.
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

## Pull request checklist

- [ ] `npm run lint` passes with no new warnings
- [ ] `npm run build` succeeds
- [ ] No hardcoded Arabic/English strings added outside `lib/i18n/`
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] No `.db`, `.env`, or `userdata/` files included (check `git status`
      against `.gitignore` before pushing)

## Local setup

See `README.md` for install steps, prerequisites (VS Build Tools for
`better-sqlite3`), and default dev credentials.
