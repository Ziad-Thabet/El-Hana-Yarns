/* Colour is mostly taste. Contrast is not.

   This reads the theme tokens out of index.css and recomputes, on every run,
   whether each one can actually be read on the surface it sits on. Two could
   not when this was written: the light theme's accent measured 2.14:1 as text
   — it was doing duty as both a surface and a label — and the dark theme's
   destructive measured 3.50:1, under AA for the small red numbers that theme
   uses for money owed and drawers found short.

   A palette drifts the moment someone nudges a lightness to make one screen
   look better. This is what notices. */
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

// ── colour maths ───────────────────────────────────────────────────────────
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const luminance = ([r, g, b]) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ── the tokens, read from the stylesheet itself ────────────────────────────
const css = fs.readFileSync(path.join(P, "src", "index.css"), "utf8");

function tokensFor(marker) {
  // Found by a declaration unique to the block rather than by its selector
  // text, which carries whatever whitespace and line endings the formatter
  // and the checkout felt like using.
  const start = css.indexOf(marker);
  if (start === -1) return {};
  const open = css.lastIndexOf("{", start);
  const end = css.indexOf("\n  }", open);
  const block = css.slice(open, end);
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const value = m[2].trim();
    // Only plain `h s% l%` triples; anything with a slash is a tint and is
    // measured against its own backdrop, not as a text colour.
    if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(value)) {
      out[m[1]] = hslToRgb(...value.split(/\s+/).map(parseFloat));
    }
  }
  return out;
}

const THEMES = {
  light: tokensFor("--background: 60 14% 97%"),
  dark: tokensFor("--background: 216 28% 7%"),
};

console.log("=== the tokens parse ===");
for (const [name, tokens] of Object.entries(THEMES)) {
  check(`${name} theme defines its colours`, Object.keys(tokens).length > 10,
    `${Object.keys(tokens).length} tokens`);
}

// ── what has to be readable, and on what ───────────────────────────────────
const AA = 4.5;
// Foreground token, the surfaces it appears on, and why it matters.
const READABLE_ON_SURFACES = [
  ["foreground", "body text"],
  ["muted-foreground", "secondary text"],
  ["primary", "links and primary figures"],
  ["destructive", "money owed, drawers short"],
  ["success", "money taken, balanced drawers"],
  ["warning", "partial payments, pending orders"],
  ["info", "online orders, informational figures"],
  ["accent-strong", "accented labels"],
];
const SURFACES = ["card", "background"];

for (const [themeName, tokens] of Object.entries(THEMES)) {
  console.log(`\n=== ${themeName}: every meaning is legible where it is used ===`);
  for (const [token, purpose] of READABLE_ON_SURFACES) {
    if (!tokens[token]) {
      check(`${token} exists`, false, "token missing");
      continue;
    }
    let worst = Infinity;
    let worstSurface = "";
    for (const surface of SURFACES) {
      if (!tokens[surface]) continue;
      const r = contrast(tokens[token], tokens[surface]);
      if (r < worst) {
        worst = r;
        worstSurface = surface;
      }
    }
    check(
      `${token} on the ${worstSurface} — ${purpose}`,
      worst >= AA,
      `${worst.toFixed(2)}:1`,
    );
  }

  console.log(`\n=== ${themeName}: text on a solid colour ===`);
  for (const [bg, fg] of [
    ["primary", "primary-foreground"],
    ["destructive", "destructive-foreground"],
    ["success", "success-foreground"],
    ["warning", "warning-foreground"],
    ["info", "info-foreground"],
    ["accent", "accent-foreground"],
  ]) {
    if (!tokens[bg] || !tokens[fg]) continue;
    const r = contrast(tokens[fg], tokens[bg]);
    check(`${fg} on ${bg}`, r >= AA, `${r.toFixed(2)}:1`);
  }
}

console.log("\n=== nothing paints outside the system ===");
// A literal palette colour cannot change between themes, which is how one
// meaning came to be spelled in ten hues across twenty-five files.
const LITERAL = /\b(text|bg|border|ring)-(red|green|emerald|sky|amber|orange|rose|violet|blue|teal|purple|indigo|yellow|pink|cyan)-\d{2,3}/;
const offenders = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".tsx")) {
      // The destructive toast paints its own solid surface; those literals are
      // the surface itself rather than a meaning borrowed from a palette.
      if (full.endsWith(path.join("ui", "toast.tsx"))) continue;
      const source = fs.readFileSync(full, "utf8");
      if (LITERAL.test(source)) {
        offenders.push(path.relative(P, full).replace(/\\/g, "/"));
      }
    }
  }
};
walk(path.join(P, "src"));
check(
  "no component reaches for a literal palette colour",
  offenders.length === 0,
  offenders.join(", "),
);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
