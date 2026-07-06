# El-Hana Yarns — Upgrade Guide

This guide is a phased action plan based on the Security & Performance Audit, updated for the **better-sqlite3 native rebuild failure on Electron v42.1.0** (V8 / Node-ABI and C++ API mismatches with prebuilt binaries). It contains checklists, terminal command steps, and architectural decisions only—no application source code.

---

## How to Use This Guide

- Work through phases in order unless a step is marked as optional or parallel-safe.
- Check off each task when complete; record locked dependency versions after Phase 1.
- Do not distribute to clients until Phase 2 (packaged .exe on a clean machine) passes fully.
- Do not publish to GitHub until Phase 6 (git hygiene and demo data) is complete.
- Keep a troubleshooting log: command used, exit code, and last ten lines of any failure.

---

## Known Issue Summary

| Symptom | Likely cause |
|--------|----------------|
| better-sqlite3 rebuild fails on Electron 42.x | Native addon ABI does not match Electron’s embedded Node/V8 |
| C++ errors referencing deprecated V8 APIs | Electron major version ahead of addon prebuild support |
| Rebuild succeeds but app crashes on DB open | Wrong .node binary loaded or module path inside asar |
| Dev works with sql.js; production needs native SQLite | Runtime driver not aligned with packaging and rebuild pipeline |

**Direction:** Pin Electron to **v32.x or v33.x**, rebuild better-sqlite3, validate packaged .exe, then apply security and performance phases.

---

## Phase 1: Environment & Database Fix

**Goal:** Reliable native SQLite under a stable Electron LTS; successful install and electron-rebuild; clear migration path from sql.js.

### 1.1 Pre-flight inventory

- [ ] Document current versions: Electron, better-sqlite3, @electron/rebuild (or electron-rebuild), Node version bundled with chosen Electron, npm version.
- [ ] On Windows: confirm Visual Studio Build Tools with “Desktop development with C++” workload installed.
- [ ] Confirm target architecture is x64 for shop PCs and build machine.
- [ ] Back up production or dev database file and entire images folder under userdata.
- [ ] Close all Electron instances and terminal processes using this project directory.

### 1.2 Downgrade Electron to stable LTS (v32 or v33)

- [ ] Select target line: Electron **32.0.x** or **33.0.x** (avoid 42.x until better-sqlite3 officially supports it).
- [ ] Pin exact version in package.json (no caret range during stabilization).
- [ ] Use a single rebuild tool: prefer **@electron/rebuild** and remove duplicate legacy rebuild packages if redundant.
- [ ] Update internal docs with the locked Electron version and date of decision.

**Terminal — from project root:**

- `npm uninstall electron`
- `npm install electron@33.0.0 --save-dev` *(or `electron@32.0.0` if 33 fails on your machine)*
- Verify installed version: `npx electron --version`

### 1.3 Clear cache and reinstall dependencies

- [ ] Delete the `node_modules` folder completely.
- [ ] Agree with team whether to regenerate package-lock.json or keep it and only refresh modules.
- [ ] Ensure no antivirus is locking files inside node_modules during install.

**Terminal:**

- `npm cache clean --force`
- `npm install`

### 1.4 Install better-sqlite3 and run electron-rebuild

- [ ] Add better-sqlite3 as a production dependency with a fixed version number.
- [ ] Align @electron/rebuild version with Electron major (check compatibility notes in release docs).
- [ ] Configure postinstall script to rebuild only better-sqlite3 (remove unused rebuild targets for abandoned drivers).

**Terminal:**

- `npm install better-sqlite3 --save`
- `npx @electron/rebuild -f -w better-sqlite3`

**If rebuild fails:**

- [ ] Capture full terminal output to troubleshooting log.
- [ ] Confirm Python and MSVC toolchain visible to npm (Windows: npm config list for msvs settings).
- [ ] Try alternate Electron LTS (32 vs 33) before changing better-sqlite3 major.
- [ ] Do not proceed to Phase 2 until exit code is zero.

### 1.5 Verify database module in development

- [ ] Start dev workflow: build or serve frontend, then launch Electron against it.
- [ ] Confirm no “NODE_MODULE_VERSION” or “compiled against a different Node.js version” errors.
- [ ] Perform read, insert, update on a test table.
- [ ] Confirm database file path uses dev userdata folder (git-ignored), not repo root.

### 1.6 Migrate from sql.js to better-sqlite3 (architectural)

- [ ] Export existing sql.js database to a backup file with timestamp.
- [ ] Plan schema parity: same tables and columns in native SQLite file.
- [ ] Run one-time import or fresh schema plus seed (see Phase 6 for Git-safe seed).
- [ ] Switch main process database module to native driver only after verification.
- [ ] Remove sql.js from production dependency list when migration validated.
- [ ] Enable WAL journal mode and foreign keys at connection initialization (document in database service checklist).

### Phase 1 completion checklist

- [ ] Electron reports v32 or v33 when running the app.
- [ ] `@electron/rebuild` for better-sqlite3 completes without errors.
- [ ] Dev app performs CRUD on native SQLite.
- [ ] sql.js removal plan scheduled; backup retained.

---

## Phase 2: Production Packaging & Executable (.exe) Validation

**Goal:** electron-builder output runs on client Windows PCs with native modules, writable database, and correct image paths.

### 2.1 electron-builder configuration audit

- [ ] **files** array includes: main process entry, preload script, database service module, Vite `dist` output, package.json.
- [ ] **main** field in package.json points to correct main process filename.
- [ ] **asar** enabled for app bundle; **asarUnpack** lists: preload, better-sqlite3 native `.node` binaries, any required WASM only if still temporarily needed.
- [ ] **directories.output** matches your release folder convention (e.g. dist_electron).
- [ ] **appId** and **productName** consistent with Windows shortcuts and userData folder naming.
- [ ] Win target defined: portable and/or nsis installer per distribution plan.

### 2.2 Native module bundling rules

- [ ] Confirm unpacked folder contains better-sqlite3 build Release binaries after build.
- [ ] Test that main process resolves native module from unpacked path, not from inside read-only asar.
- [ ] Re-run electron-rebuild after every Electron version change before packaging.

### 2.3 SQLite database in production (must not break)

- [ ] **Never** use repo-root `el-hana-yarns.db` as the live writable database in production.
- [ ] Writable database path: `app.getPath('userData')` plus chosen filename.
- [ ] **Do not** ship client’s real database inside the installer as the active DB.
- [ ] Choose first-run strategy:
  - **Option A:** Create empty schema on first launch if no DB exists.
  - **Option B:** Copy a **demo seed** file once from resources to userData (see Phase 6).
- [ ] App updates must not overwrite existing userData database without explicit migration version logic.
- [ ] Document support path to userData for backups (folder name on Windows).

### 2.4 Image and static asset paths after build

- [ ] Product and receipt images stored under userData subfolders (e.g. images/products, images/receipts).
- [ ] Main process builds absolute paths from userData, never from development repo relative paths in production.
- [ ] Vite **base** remains relative (`./`) so `loadFile` to dist/index.html works.
- [ ] HashRouter routes work under file protocol in packaged app.
- [ ] Test image upload, display, and persistence across app restart in **packaged** build only.

### 2.5 Build pipeline execution

**Terminal — from project root:**

- `npm run build`
- `npm run electron:build`

- [ ] Both commands exit successfully.
- [ ] Inspect output artifact size and unpacked native folders.
- [ ] Run packaged .exe from output directory on build machine first, then on clean VM.

### 2.6 Client-machine manual testing checklist (.exe)

Perform on a **clean Windows machine** without Node.js, npm, or repository clone.

#### Launch and stability

- [ ] Application starts from .exe without command-line steps.
- [ ] No immediate dialog about missing modules or database.
- [ ] Window title and icon correct.
- [ ] Single-instance behavior: second launch focuses existing window (if designed).

#### Authentication

- [ ] Login with admin account.
- [ ] Login with staff account.
- [ ] Logout and login again.
- [ ] Restart app; session restore behaves as designed.

#### Sales flow

- [ ] Products visible on sales screen.
- [ ] Barcode or search adds item to cart.
- [ ] Weighted or non-piece unit flow works.
- [ ] Checkout completes; invoice recorded.
- [ ] Stock decreases for tracked products.

#### Inventory and purchases

- [ ] Add or edit product with image.
- [ ] Image still visible after full app restart.
- [ ] Purchase invoice save and payment recording.
- [ ] Category management (admin).

#### Customers and debts

- [ ] Create or select customer debt scenario.
- [ ] Partial payment updates remaining balance.
- [ ] Electronic payment receipt rules enforced in UI.

#### Reports

- [ ] Generate each report type used in shop operations.
- [ ] Date-bounded sales report returns sensible results.

#### Data and paths

- [ ] Locate userData folder on disk; confirm DB and images present.
- [ ] Copy userData folder as backup; restore test on another folder if policy allows.

#### Performance smoke

- [ ] Scroll product grid with realistic catalog size.
- [ ] Open long invoice history without multi-second freeze.

### Phase 2 completion checklist

- [ ] Packaged .exe passes all sections in 2.6 on clean Windows.
- [ ] Native SQLite and images work only from userData.
- [ ] Build reproducible from documented npm scripts.

---

## Phase 3: Security Hardening Steps

**Goal:** Trust boundary at IPC, secure credentials, hardened runtime, protected data locations. Apply after Phase 2 baseline works.

### 3.1 IPC channel white-listing design

- [ ] Create master list: channel name, operation type (read/write), allowed roles.
- [ ] Map each preload exposed API method to exactly one allowlisted channel.
- [ ] Remove duplicate legacy channel names (old checkout/report aliases).
- [ ] Remove preload methods that invoke channels with no main handler.
- [ ] Main process rejects non-allowlisted channels before business logic.
- [ ] Validate payload shape in main (types, max lengths, required fields) per channel.
- [ ] Standardize error responses: no stack traces or internal paths sent to renderer.

### 3.2 Session and role enforcement

- [ ] Pass session identifier from renderer on every mutating IPC call.
- [ ] Main validates session row still exists in database.
- [ ] Enforce admin-only: user management, destructive deletes, sensitive configuration.
- [ ] Staff restricted from admin channels even if UI is hidden.
- [ ] Clear server-side session context on logout.

### 3.3 Password hashing via bcryptjs

- [ ] Install bcryptjs for **main process only** (not exposed to renderer).
- [ ] Hash on user creation and password change.
- [ ] Verify on login with constant-time compare provided by library.
- [ ] Migrate existing plaintext passwords: force reset or batch re-hash on next login.
- [ ] Remove default weak passwords before any client deployment.
- [ ] Document password policy (minimum length, who can reset).

### 3.4 Production build hardening

- [ ] Production loads built static files, not localhost dev server.
- [ ] DevTools disabled in packaged builds (optional hidden dev flag only in internal builds).
- [ ] Block webContents navigation to external URLs.
- [ ] Deny window.open and new BrowserWindow from renderer without audit.
- [ ] Keep contextIsolation true, nodeIntegration false, sandbox true.
- [ ] Add Content Security Policy via session when compatible with fonts and styles.

### 3.5 Database file location security (app.getPath)

- [ ] Production: database file only under userData.
- [ ] Development: separate git-ignored directory (e.g. userdata in project).
- [ ] No live customer DB in repository working tree.
- [ ] Backup procedure documented: copy DB file plus images subtree together.
- [ ] Optional: document OS full-disk encryption or SQLCipher for high-risk deployments.

### Phase 3 completion checklist

- [ ] IPC allowlist documented and enforced.
- [ ] bcryptjs live; no plaintext passwords in DB.
- [ ] Packaged app hardened; DevTools not available to end users.
- [ ] userData-only writable database verified.

---

## Phase 4: Performance & Image Optimization Steps

**Goal:** Scale catalog and invoice history without UI freezes; reduce IPC payload size.

### 4.1 Custom image protocol strategy (replace Base64 over IPC)

- [ ] Database stores file path or stable image key only.
- [ ] Main process registers safe custom protocol or approved file serving for images.
- [ ] Resolve requests only inside products and receipts directory roots.
- [ ] Reject path traversal and absolute paths outside roots.
- [ ] List endpoints return URL or path reference, not Base64 strings.
- [ ] Full resolution loaded only for edit dialog, print, or detail view.

### 4.2 Thumbnail workflow using sharp

- [ ] Add sharp to main process dependencies for image pipeline.
- [ ] On save: write compressed original; generate thumbnail with fixed max width/height.
- [ ] Enforce maximum upload size and allowed MIME types at validation layer.
- [ ] Naming convention links thumbnail to original for deletion on replace.
- [ ] Grids and sales picker bind to thumbnail resource only.
- [ ] One-time batch job to create thumbnails for existing image library.
- [ ] Log thumbnail failures without blocking app startup.

### 4.3 Database query and engine optimization

- [ ] WAL mode enabled on native SQLite connection.
- [ ] Wrap multi-step financial operations in transactions.
- [ ] Remove full-database memory export on every single write (legacy sql.js pattern).
- [ ] Store dates in ISO sortable format for reports and BETWEEN filters.
- [ ] Refactor invoice list loaders to avoid per-row child queries (batch or join).
- [ ] Add pagination or date filters for sales and purchase history screens.
- [ ] Provide lightweight product catalog API without image payloads for sales tab.

### 4.4 Database indexing creation

- [ ] Index products.barcode if barcode lookup is frequent.
- [ ] Index products.category if filtered by category in UI.
- [ ] Index sale_invoices.date and purchase_invoices.date for reports.
- [ ] Index sale_invoice_items.invoice_id and purchase_invoice_items.invoice_id.
- [ ] Index customer_debts.customer_id.
- [ ] Index payment_records composite (ref_id, ref_type).
- [ ] After indexes: re-test report generation and stats on large copied dataset.

### Phase 4 completion checklist

- [ ] Bulk product API sends no Base64.
- [ ] Thumbnails display in packaged .exe.
- [ ] Transactions and WAL verified under load.
- [ ] Indexes applied; measurable list/report improvement noted.

---

## Phase 5: Frontend & State Management Steps

**Goal:** Cached shared data, fewer duplicate IPC calls, smooth scrolling for large lists.

### 5.1 React Query integration

- [ ] Configure QueryClient: staleTime, retry count, refetchOnWindowFocus off if too aggressive for desktop.
- [ ] Define query keys: products, categories, customers, debts, sales, purchases, session.
- [ ] Create shared hooks per domain replacing repeated useEffect fetch patterns.
- [ ] useMutation for create/update/delete with invalidateQueries on success.
- [ ] Centralize error mapping from API wrapper to toast messages.
- [ ] Session restoration: query auth getSession when localStorage session id exists.

### 5.2 Component virtualization

- [ ] Identify thresholds: when product count or debt rows justify virtualization.
- [ ] Install virtualization library compatible with React 18.
- [ ] Apply to sales product grid, product management list, debt tables, invoice tables.
- [ ] Provide fixed-height scroll parent for virtualizer.
- [ ] Test RTL layout and Arabic text in virtual rows.
- [ ] Verify barcode input focus and keyboard flow after virtualization.
- [ ] Memoize row components to isolate cart state updates from catalog re-renders.

### 5.3 State scope architecture

| Scope | Data |
|-------|------|
| React Query (shared) | Session, catalogs, customers, debts summaries, report cache |
| Local component | Sales cart, payment splits, dialog forms, search filters |
| Avoid | Root-level product prop drilling; duplicate tab fetches; Base64 in list state |

### 5.4 Tab and navigation loading

- [ ] Decide unmount vs keep-mounted tabs.
- [ ] If mounted, disable queries when tab inactive via enabled flag.
- [ ] Prioritize sales tab data freshness for cashier workflow.

### Phase 5 completion checklist

- [ ] Hooks and mutations cover all main screens.
- [ ] Virtualization on heaviest lists.
- [ ] Full UX regression on packaged .exe after frontend changes.

---

## Phase 6: Git, GitHub Distribution & Professional README

**Goal:** Safe public or team repository; no client data leaks; reproducible onboarding for developers; clear build instructions.

### 6.1 Secure git history and .gitignore

- [ ] Audit repository for committed database files; remove from history if ever committed (use git filter plan or BFG if secrets/data were pushed).
- [ ] Audit for committed image folders with real receipts or customer data.
- [ ] Expand .gitignore to include at minimum:
  - All SQLite database files and journal/WAL/SHM sidecars
  - Project userdata and dev data directories
  - node_modules, dist, dist_electron, release output folders
  - OS junk (.DS_Store, Thumbs.db)
  - Environment files with secrets (.env, .env.local)
  - Log files
- [ ] Never force-add database or images with git add -f for convenience.
- [ ] Add optional .gitkeep in empty seed directories to preserve folder structure without data.

**Terminal — verify nothing sensitive is staged before each commit:**

- `git status`
- `git check-ignore -v path/to/test.db` *(confirm ignore rules work)*

### 6.2 Prevent future leaks (process)

- [ ] Pre-commit habit: review `git status` for db and image paths.
- [ ] Use a sample **allowed** seed path documented in README vs **forbidden** production paths.
- [ ] Team rule: production backups never copied into repo directory.
- [ ] If GitHub already exposed real data: rotate passwords, treat DB as compromised, notify stakeholders per policy.

### 6.3 Demo / seed database for GitHub

- [ ] Create separate small SQLite file with **fake** Arabic/English product names, dummy barcodes, zero real phone numbers.
- [ ] Include 5–15 sample products, 2–3 categories, demo users (admin/staff) with **known demo passwords** documented only for development.
- [ ] Place seed file in a clearly named folder e.g. `seed/` or `assets/seed/` with README note “not for production”.
- [ ] Optional: bundle seed copy logic on first install for open-source testers (copy to userData if no DB exists).
- [ ] Never symlink production userData into repository.
- [ ] Add seed images: royalty-free placeholders, small file size, no real receipts.

### 6.4 GitHub repository setup checklist

- [ ] Create GitHub repo public or private per business decision.
- [ ] Default branch named main; protect main with PR reviews if team size warrants.
- [ ] Add LICENSE file (MIT or proprietary—legal choice).
- [ ] Add SECURITY.md or section describing how to report vulnerabilities privately.
- [ ] Disable GitHub Actions until workflows are defined (optional).
- [ ] Add repository topics: electron, react, sqlite, pos, arabic-rtl, etc.
- [ ] First push contains no real client database or images.

**Terminal — initial push workflow:**

- `git init` *(if not already)*
- `git add .`
- `git status` *(manual review: no .db, no userdata)*
- `git commit -m "Initial open-source baseline with seed data only"`
- `git remote add origin <your-repo-url>`
- `git push -u origin main`

### 6.5 Professional README.md — structural outline

Create **README.md** at repository root with the sections below. Use checklists while writing each part.

#### Section A — Project overview

- [ ] Application name and one-paragraph purpose (yarn shop POS / inventory / debts).
- [ ] Target users (cashier, admin).
- [ ] Platform: Windows desktop (.exe).
- [ ] Screenshot or GIF placeholders (sales screen, product management) with alt text.
- [ ] Status badges: version, license, build status optional.

#### Section B — Features

- [ ] Bullet list: sales & barcode, cart & checkout, products & categories, purchase invoices, sales history, customer debts, reports, role-based access.
- [ ] Note RTL Arabic UI support.
- [ ] Clarify offline-first local database (no cloud required).

#### Section C — Tech stack

- [ ] Electron (document locked version e.g. 33.x).
- [ ] React, TypeScript, Vite, Tailwind CSS.
- [ ] better-sqlite3 (native SQLite).
- [ ] Supporting libraries: React Query, Zod, Radix/shadcn UI, bcryptjs (main), sharp (main) when Phase 4 done.

#### Section D — Prerequisites for developers

- [ ] Windows 10/11 x64.
- [ ] Node.js LTS version range recommended.
- [ ] npm version note.
- [ ] Visual Studio Build Tools for native module compile.
- [ ] Git.

#### Section E — Step-by-step local installation (developers)

- [ ] Clone repository command.
- [ ] cd into project directory.
- [ ] npm install.
- [ ] electron-rebuild step documented with exact npx command.
- [ ] Copy seed database to dev userdata instructions OR first-run auto seed.
- [ ] Run dev: separate terminal for Vite and Electron or combined script as per package.json.
- [ ] Default demo login credentials clearly labeled **development only**.
- [ ] Troubleshooting subsection: rebuild failures, Electron version mismatch, missing dist.

#### Section F — Building production .exe

- [ ] npm run build explanation (frontend).
- [ ] npm run electron:build explanation (packager).
- [ ] Output folder location and artifact name.
- [ ] Note asarUnpack requirement for native modules.
- [ ] Client install: copy portable exe or run installer; userData created on first run.
- [ ] Warning not to commit userData or production DB into git.

#### Section G — Project structure (high level)

- [ ] Brief folder map: electron main, preload, database service, src components, seed assets—no need for exhaustive tree.

#### Section H — Security and data notice

- [ ] Default passwords must be changed before production use.
- [ ] Backup userData folder regularly.
- [ ] Link to UPGRADE_GUIDE.md for maintainers.

#### Section I — Contributing and license

- [ ] How to open issues.
- [ ] Branch naming convention optional.
- [ ] License terms summary.

### 6.6 README quality checklist before publish

- [ ] No real customer names, phones, or receipt images in README or repo.
- [ ] All commands in README tested on clean clone.
- [ ] Electron version in README matches package.json.
- [ ] English and/or Arabic intro consistent with product audience.
- [ ] UPGRADE_GUIDE.md linked for phased security and performance work.

### Phase 6 completion checklist

- [ ] .gitignore blocks DB, userdata, build outputs, secrets.
- [ ] git history free of production leaks (or remediation completed).
- [ ] Seed/demo database and images safe for public GitHub.
- [ ] README.md complete with sections A through I.
- [ ] GitHub repository pushed and clone-to-run verified by second machine or teammate.

---

## Cross-Phase Master Sign-Off

| Phase | Sign-off criterion |
|-------|-------------------|
| 1 | Electron 32/33; better-sqlite3 rebuild green; dev CRUD works |
| 2 | Client .exe passes full manual test matrix on clean Windows |
| 3 | IPC, bcrypt, hardened build, userData DB only |
| 4 | Image protocol, thumbnails, indexes, no list Base64 |
| 5 | React Query + virtualization; responsive large lists |
| 6 | Safe GitHub repo, seed data only, professional README |

---

## Suggested Timeline

| Phase | Focus | Indicative effort |
|-------|--------|-------------------|
| 1 | Environment & native SQLite | 2–5 days |
| 2 | Packaging & client validation | 3–7 days |
| 3 | Security | 1–2 weeks |
| 4 | Performance & images | 2–3 weeks |
| 5 | Frontend | 1–2 weeks |
| 6 | Git, GitHub, README | 2–4 days |

Phases 4–5 may overlap after Phase 2 sign-off. Phase 6 should complete before public GitHub announcement.

---

## Electron Upgrade Policy (Maintainers)

- [ ] Do not bump Electron major without checking better-sqlite3 compatibility matrix.
- [ ] After any Electron change: clean install, rebuild native modules, full Phase 2 client retest.
- [ ] Document last known good pair: Electron x.y.z + better-sqlite3 x.y.z.

---

## Document Maintenance

- [ ] Update checklists when tasks complete or scope changes.
- [ ] Keep version pin table at top of README in sync with this guide.
- [ ] Re-audit git ignore and seed data yearly or before each public release.

---

*El-Hana Yarns — Upgrade Guide (six-phase edition: native modules, production, security, performance, frontend, GitHub)*
