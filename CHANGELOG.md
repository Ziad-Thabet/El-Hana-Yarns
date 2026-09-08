# Changelog

All notable changes to El-Hana Yarns are documented in this file.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Because this project predates its Git history (development happened before
version control was introduced), pre-repo work is grouped by development
phase rather than semantic version tags. From this point forward, entries
are added per pull request / release.

## [Unreleased]

Nothing yet.

## [1.1.0] — 2026-09-08

A correctness and hardening pass over the whole system, delivered as fifteen
reviewed pull requests. The theme running through it: rules that were literals
became data, checks that were conventions became constraints, and figures that
were calculated in several places are now calculated once.

### Added

- **End-of-day workbook** (#19) — an eleven-sheet Excel export of any day or
  date range, covering takings by method, invoices, sold lines, stock movement,
  alerts, returns, online orders, debts, expenses, purchases and shifts. Built
  in a utility process so a busy day never blocks the interface, and scoped
  strictly to the requested dates, so re-exporting a past day reproduces it
  exactly.
- **Register closing against a counted drawer** (#22) — ending a shift now
  begins with a blind cash count: the drawer is counted, the expected total is
  revealed afterwards, and the over/short difference is recorded with an
  explanation once it passes a configurable threshold. Counted, expected,
  variance, note and closer are all stored on the shift.
- **Settings** (#14, #15) — thresholds, timeouts, retention counts, receipt
  width and shop identity are stored in the database with defaults declared in
  one registry, and are editable by the owner instead of compiled in.
- **Activity log** (#16, #20) — an append-only record of every sensitive action
  with the actor, the outcome and a redacted payload, enforced append-only by
  database triggers. Its detail view reads as a labelled Arabic list rather
  than raw JSON.
- **Capability-based permissions** (#17) — channels are gated by named
  capabilities held by roles, stored as rows. An empty roles table still admits
  the owner, so a partial migration cannot lock a shop out.
- **Data-driven payment methods** (#18) — methods are rows rather than an enum,
  and shift totals are derived per method from what was actually collected.
- **Returns and voids** (#10) — line-level returns with restock or write-off,
  refunded across the original payment methods pro rata, or written off an
  outstanding debt when the invoice was never paid.
- **Automatic backups** (#10) — periodic `VACUUM INTO` snapshots with
  retention, an integrity check before every restore, and a safety copy taken
  at restore time.
- **Test suite in the repository** (#23) — 452 checks across 19 suites, run by
  `npm test` and on every pull request, against a fixture the runner builds
  from scratch through the application's own bring-up.

### Changed

- **Foreign keys across fourteen tables** (#10) — deletion rules are now
  enforced by the database: history protects the rows it references, and
  children cascade with their parents.
- **List performance** (#12) — `salesDB.getAll()` went from 3,733 ms and 21 MB
  to 57 ms and 0.4 MB at 400 invoices by bulk-loading related rows and no
  longer inlining receipt images as base64 across the IPC bridge.
- **One shift-closing path** (#13) — the same financial totals were previously
  written by three separate code paths; every close now funnels through one.
- **Stock arithmetic** (#10) — weighted and per-piece products share one unit
  calculation instead of four disagreeing copies.
- **Sales totals are net of returns** (#21) — a returned invoice no longer
  counts in full toward the list total, and its row says whether it was
  returned in full or in part.

### Fixed

- **IPC authorisation** (#9, #11) — every call is authorised against the
  caller's own session, resolved in the main process; a session id planted in a
  payload is ignored.
- **Privilege escalation in capability naming** (#17) — capabilities derived
  from a channel's feature alone put reads and writes behind one name; they are
  now derived from the channel's own permission level.
- **Invoice number collisions** (#10) — invoice numbers derived from a
  millisecond timestamp collided under a unique constraint and sorted as text
  past 999 per day; they are now sequential per day and compared numerically.
- **Inactive users could still log in** (#17).
- **Deleting a purchase invoice** did not reverse the stock it had added (#10).
- **Audit pagination** could skip or repeat rows when several were recorded in
  the same millisecond (#16).
- **The demo seeder** could not run against a fresh database: two invoices
  shared a number and the accounts its rows reference were never created (#23).
- **Packaging** — the packed application was missing modules the main process
  loads at startup, and the window icon was below the minimum size the builder
  accepts (#9).

## Development History (pre-repository)

### Financial Accuracy Overhaul

- Added explicit `source` and `shift_id` columns to `payment_records` for
  accurate shift-attributed cash totals
- Fixed 9 bugs across 31 files, including a runtime crash in the online
  orders dispatch flow and a fully disconnected shift summary display
- Fixed missing cache invalidations for debt settlements
- Rewrote `seed-demo.cjs` to match the corrected data model

### Code Quality Audit (Modules 1–8)

- Fixed weighted-item data loss when converting POS sales to online orders
- Fixed debt invoice number uniqueness violation
- Removed dead IPC infrastructure
- Tracked all findings in a master open-items table (resolved / pending / deferred)

### i18n Audit

- Full audit of 35+ component files
- Enforced that all Arabic strings route through the centralized `ar.ts`
  file, applied via strict SEARCH/REPLACE patches only

### Financial Reporting Audit

- Fixed double-counted debt repayments in `trueNetProfit`
- Corrected mislabeled dashboard summary cards
- Redesigned `DashboardReportView.tsx` into four grouped report sections
- Resolved phantom `payment_records` rows on fully-on-debt invoices

### Phase 7 — Online Orders & Delivery Management

- Customer addresses/phones management
- Invoice-generation-at-dispatch logic
- Online order creation directly from the POS interface
- Item editing on pre-dispatch orders
- Fixed a stale-reference bug in the selected-order dialog
- Added atomic stock-overselling guard (`WHERE stock >= ?`) with Arabic
  error messaging
- Corrected online orders report revenue calculations
- Added trust-level indicator card to `CheckoutDialog`
- Fixed driver settlement total calculations
- Added EAN-13 barcode generation (GS1 in-store prefix `20`, uniqueness
  verification, auto-generation on product save)

### Phase 4 — File Splitting & Architecture

- Split 7 monolithic components (ReportsSection, EmployeeManagement,
  SalesInvoices, SalesInterface, PurchaseInvoices, CustomerDebts,
  ExpensesSection) into domain-organized files under
  `src/features/<domain>/components/`
- Introduced `eslint-plugin-boundaries` to enforce import-direction rules
  between feature domains
- Introduced `ipc-channels.cjs` as the single source of truth for IPC
  channel permissions
- Fixed a critical bug in `mapSaleInvoice()` that silently discarded debt
  query results, preventing partially-paid invoices from ever showing
  `paidAmount` / `remainingAmount`

### Phase 3 — Renderer Reorganization

- Migrated all feature domains into `src/features/<domain>/`
- Introduced `src/lib/types.ts` and `src/lib/hooks/index.ts` as re-export
  barrels

### Foundation

- Migrated from an early `sql.js` implementation to `better-sqlite3`
  (resolving compile issues on Windows/Electron)
- Added WAL mode, bcrypt authentication, in-memory session management
- Added IPC role-based access enforcement
- Added dark/light theme system
