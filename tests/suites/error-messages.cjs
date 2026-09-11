/* Every machine-readable error a repository throws has to be sayable in both
   languages before it reaches a shop's screen.

   The repositories throw short codes on purpose — they are stable, greppable
   and language-independent. The danger is that a code travels intact to a
   dialog, where "password_too_short" in the middle of an Arabic screen reads
   as a crash rather than an instruction. This suite is the thing standing
   between a new code and that outcome. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** Source files whose thrown errors can reach the renderer. */
function sourceFiles() {
  const files = [
    path.join(P, "electron-main.cjs"),
    path.join(P, "session-manager.cjs"),
    path.join(P, "rate-limiter.cjs"),
  ].filter((f) => fs.existsSync(f));
  const repoDir = path.join(P, "db", "repositories");
  for (const f of fs.readdirSync(repoDir)) {
    if (f.endsWith(".cjs")) files.push(path.join(repoDir, f));
  }
  return files;
}

const CODE = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;

const thrown = new Map(); // code -> the file that throws it
for (const file of sourceFiles()) {
  const source = fs.readFileSync(file, "utf8");
  for (const m of source.matchAll(/throw new Error\(\s*"([^"]+)"\s*\)/g)) {
    if (CODE.test(m[1])) thrown.set(m[1], path.basename(file));
  }
}

console.log("=== codes thrown by the main process ===");
check("found codes to check", thrown.size > 0, `${thrown.size} codes`);

/** The `codes: { ... }` block inside the errors section of a dictionary. */
function translatedCodes(file) {
  const source = fs.readFileSync(path.join(P, "src", "lib", "i18n", file), "utf8");
  const header = source.indexOf("codes: {", source.indexOf("\n  errors: {"));
  if (header === -1) return new Set();
  // Start after the opening line, or "codes" itself is read as an entry.
  const start = source.indexOf("\n", header);
  const end = source.indexOf("\n    },", start);
  const block = source.slice(start, end === -1 ? undefined : end);
  return new Set([...block.matchAll(/^\s*([a-z][a-z0-9_]*)\s*:/gm)].map((m) => m[1]));
}

const ar = translatedCodes("ar.data.ts");
const en = translatedCodes("en.ts");
check("the Arabic dictionary has an errors section", ar.size > 0, `${ar.size} codes`);
check("the English dictionary has one too", en.size > 0, `${en.size} codes`);

const missingAr = [...thrown.keys()].filter((c) => !ar.has(c));
const missingEn = [...thrown.keys()].filter((c) => !en.has(c));
check(
  "every thrown code has an Arabic message",
  missingAr.length === 0,
  missingAr.map((c) => `${c} (${thrown.get(c)})`).join(", "),
);
check(
  "every thrown code has an English message",
  missingEn.length === 0,
  missingEn.map((c) => `${c} (${thrown.get(c)})`).join(", "),
);

// A translation left behind after its code is gone is dead weight, and worse,
// it suggests a failure mode that no longer exists.
const stray = [...ar].filter((c) => !thrown.has(c));
check("no message without a code that throws it", stray.length === 0, stray.join(", "));
check("both dictionaries carry the same codes", ar.size === en.size, `${ar.size} vs ${en.size}`);

console.log("\n=== nothing shows a raw error any more ===");
// The translator is the single display path. A component reaching into
// err.message directly is how the codes escaped in the first place.
const offenders = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      const source = fs.readFileSync(full, "utf8");
      if (/\(err(or)? as Error\)\.message/.test(source)) {
        offenders.push(path.relative(P, full).replace(/\\/g, "/"));
      }
    }
  }
};
walk(path.join(P, "src"));
check(
  "no component displays err.message directly",
  offenders.length === 0,
  offenders.join(", "),
);

console.log("\n=== the shift is called one thing ===");
// Two words for one concept reads as two different operations.
const arabic = fs.readFileSync(path.join(P, "src", "lib", "i18n", "ar.data.ts"), "utf8");
check(
  "the Arabic dictionary says شيفت, never وردية",
  !arabic.includes("وردية") && !arabic.includes("الورديات"),
);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
