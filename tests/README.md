# Tests

```bash
npm test                  # build a fixture, run every suite
npm test -- settings      # only suites whose filename matches
npm test -- --keep        # leave the fixture on disk for inspection
```

## How it works

Each suite is a standalone script that drives the **real** repositories against
its own copy of a fixture database and prints one `PASS` or `FAIL` line per
check. `tests/run.cjs` builds the fixture, runs each suite in its own process,
adds up the checks and exits non-zero if any of them fail.

There is no test framework. The suites are plain scripts because what they
mostly assert is what SQLite does — constraints firing, migrations applying,
transactions rolling back — and a framework would sit between the assertion and
the database without earning its place.

### The fixture

`tests/fixture.cjs` creates the database by running the application's own
bring-up (`initDatabase()` followed by `seed-demo.cjs`) against a scratch
directory, via the `ELHANA_DATA_DIR` override. That is deliberate: a
hand-maintained test schema is a second source of truth that drifts from the
real one, and the drift hides exactly the migration bugs worth catching. Here
the suites run against the same `createTables`, the same legacy bring-up and the
same versioned migrations as a real shop's database.

It also means **no real data is needed and none is committed** — on a clean
checkout, or on CI, the fixture builds itself.

`tests/helpers/legacyShape.cjs` winds a copy back to the pre-migration shape by
stripping foreign keys and resetting `user_version`, so the migration suite has
something to migrate.

### Why Electron

`better-sqlite3` is a native module compiled against Electron's Node ABI, so
anything that opens the database has to run under Electron's Node. The runner
itself is plain Node and spawns each suite with `ELECTRON_RUN_AS_NODE=1`. No
window is ever created, so this works headless and on CI.

## Writing a suite

Add a file to `tests/suites/`. It receives two environment variables:

| Variable | Meaning |
| --- | --- |
| `ELHANA_TEST_FIXTURE` | Path to the seeded fixture database. **Copy it, never open it directly** — suites that mutate a shared file cannot run independently. |
| `ELHANA_TEST_WORKDIR` | A scratch directory of your own, already created. |

Print `PASS <label>` or `FAIL <label> — <detail>` for each check and exit
non-zero if anything failed; the runner counts the lines. The detail on a
failure matters more than the label: it is what someone reads at 2am.
