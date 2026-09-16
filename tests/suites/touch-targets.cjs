/* The shop runs on a touchscreen till, and the interface has to admit it.

   Two things break on a device with no mouse, and neither shows up as an
   error anywhere:

     - a control smaller than a fingertip, which turns a quantity adjustment
       into a game of chance;
     - a control revealed on hover, which on a touchscreen means a control
       that is simply never visible. Printing a receipt and deleting an
       expense were both behind that.

   These checks read the source rather than the screen, which is a real limit:
   they catch a target declared too small, not one made too small by its
   container. That is still most of them. */
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

function filesUnder(dir, ext = ".tsx") {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(ext)) out.push(full);
    }
  };
  walk(dir);
  return out;
}
const rel = (f) => path.relative(P, f).replace(/\\/g, "/");

console.log("=== nothing is revealed only on hover ===");
// The utility that replaced it keeps the quiet look where a pointer exists
// and shows the control everywhere else.
const hoverOnly = [];
for (const file of filesUnder(path.join(P, "src"))) {
  const source = fs.readFileSync(file, "utf8");
  if (/opacity-0[^"'`]*group-hover:opacity-100|group-hover:opacity-100[^"'`]*opacity-0/.test(source)) {
    hoverOnly.push(rel(file));
  }
}
check(
  "no control is hidden until hover",
  hoverOnly.length === 0,
  hoverOnly.join(", "),
);

console.log("\n=== the till's own controls are big enough to hit ===");
// The sales feature is what a cashier uses all day. 40px is the floor here;
// the button primitive's default and icon sizes are 44.
const TILL = path.join(P, "src", "features", "sales", "components");
const small = [];
for (const file of filesUnder(TILL)) {
  const source = fs.readFileSync(file, "utf8");
  for (const m of source.matchAll(/className="([^"]*)"/g)) {
    const classes = m[1];
    // Only class lists that look like a control, not a decorative icon.
    if (!/\b(h-[0-9]+)\b/.test(classes)) continue;
    const height = Number(/\bh-([0-9]+)\b/.exec(classes)[1]);
    const isIconGlyph = /\bw-[0-9]+\b/.test(classes) && height <= 6;
    if (isIconGlyph) continue;
    if (height < 10) {
      const line = source.slice(0, m.index).split("\n").length;
      small.push(`${rel(file)}:${line} (h-${height})`);
    }
  }
}
check(
  "no control on the sales screen is under 40px tall",
  small.length === 0,
  small.join(", "),
);

console.log("\n=== the primitives set a floor everything inherits ===");
const button = fs.readFileSync(path.join(P, "src/components/ui/button.tsx"), "utf8");
const sizes = Object.fromEntries(
  [...button.matchAll(/(default|sm|lg|icon):\s*"([^"]*)"/g)].map((m) => [
    m[1],
    Number(/\bh-([0-9]+)\b/.exec(m[2])?.[1] ?? 0),
  ]),
);
check("the default button is 44px", sizes.default >= 11, `h-${sizes.default}`);
check("an icon button is 44px", sizes.icon >= 11, `h-${sizes.icon}`);
check("even the compact size is 40px", sizes.sm >= 10, `h-${sizes.sm}`);

const input = fs.readFileSync(path.join(P, "src/components/ui/input.tsx"), "utf8");
check("inputs are 44px", /\bh-11\b/.test(input));
const select = fs.readFileSync(path.join(P, "src/components/ui/select.tsx"), "utf8");
check("so are selects", /flex h-11 w-full/.test(select));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
