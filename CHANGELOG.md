# Changelog

All notable changes to El-Hana Yarns are documented in this file.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Because this project predates its Git history (development happened before
version control was introduced), pre-repo work is grouped by development
phase rather than semantic version tags. From this point forward, entries
are added per pull request / release.

## [Unreleased]

### In Progress
- Full i18n and RTL/LTR bilingual switching (VS Code-style professional
  mirroring of Arabic ⇄ English), including:
  - Converting physical Tailwind classes to logical equivalents (`ms-*`/`me-*`
    instead of `ml-*`/`mr-*`, etc.)
  - Making all `lib/constants/*` label objects getter-based to prevent
    stale-locale caching
  - Patching hardcoded locale calls across the codebase
  - Remaining module passes: Expenses (RTL), Products, Categories, Pages,
    Auth, Alerts

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
- Added a `withTransaction()` helper (`db/helpers/transaction.cjs`) for
  atomic multi-statement database operations
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
