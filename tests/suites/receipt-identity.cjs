/* PR 2: shop identity and paper width come from settings, and blank fields
   must emit nothing. */
const path = require("path");
const P = path.join(__dirname, "..", "..");
const FIXTURE = process.env.ELHANA_TEST_FIXTURE;
const WORKDIR = process.env.ELHANA_TEST_WORKDIR || __dirname;
const fs = require("fs");
const Database = require(path.join(P, "node_modules", "better-sqlite3"));
const { runMigrations } = require(path.join(P, "db/migrations.cjs"));
const { createSettingsDB } = require(path.join(P, "db/repositories/settings.cjs"));
const {
  buildShopHeaderLines,
  buildShopFooterLine,
  receiptPageSize,
} = require(path.join(P, "shared/receiptIdentity.cjs"));

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("=== header lines ===");
const full = buildShopHeaderLines({
  name: "الهنا للخيوط",
  tagline: "خيوط تريكو",
  address: "١٢ شارع الجمهورية",
  phone: "01000000000",
});
check("all three lines render when set", full.length === 3, `${full.length}`);
check("order is tagline, address, phone",
  full[0].text === "خيوط تريكو" && full[1].text === "١٢ شارع الجمهورية" && full[2].text === "01000000000");
check("address carries a pin icon", full[1].icon === "📍");
check("phone carries a phone icon", full[2].icon === "📞");
check("tagline has no icon", full[0].icon === "");

// The whole point: an unset address must not leave a blank line on the paper.
check("empty address emits nothing",
  buildShopHeaderLines({ name: "X", tagline: "T", address: "", phone: "" }).length === 1);
check("whitespace-only fields emit nothing",
  buildShopHeaderLines({ name: "X", tagline: "  ", address: "   ", phone: "\t" }).length === 0);
check("missing fields emit nothing", buildShopHeaderLines({ name: "X" }).length === 0);
check("no arguments is safe", buildShopHeaderLines().length === 0);

console.log("\n=== footer line ===");
check("name and tagline are joined",
  buildShopFooterLine({ name: "الهنا", tagline: "خيوط" }) === "الهنا — خيوط");
check("no tagline leaves just the name",
  buildShopFooterLine({ name: "الهنا", tagline: "" }) === "الهنا");
check("no name falls back to the tagline",
  buildShopFooterLine({ name: "", tagline: "خيوط" }) === "خيوط");
check("nothing set yields an empty string", buildShopFooterLine({}) === "");

console.log("\n=== page size ===");
check("80mm -> 80000 microns", receiptPageSize(80).width === 80000, `${receiptPageSize(80).width}`);
check("58mm -> 58000 microns", receiptPageSize(58).width === 58000);
check("height is constant", receiptPageSize(58).height === receiptPageSize(80).height);
check("a string width still works", receiptPageSize("58").width === 58000);
// A bad width must not produce a zero-size page that prints nothing.
check("zero falls back to the default", receiptPageSize(0).width === 80000);
check("negative falls back to the default", receiptPageSize(-5).width === 80000);
check("junk falls back to the default", receiptPageSize("wide").width === 80000);
check("undefined falls back to the default", receiptPageSize(undefined).width === 80000);

console.log("\n=== the .mjs mirror agrees with the .cjs ===");
const cjsSrc = fs.readFileSync(path.join(P, "shared/receiptIdentity.cjs"), "utf8");
const mjsSrc = fs.readFileSync(path.join(P, "shared/receiptIdentity.mjs"), "utf8");
// Compare executable code only: the two files carry different commentary by
// design, but their logic must not drift apart.
const bodyOf = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\bexport\s+/g, "")
    .replace(/^module\.exports[\s\S]*$/m, "")
    .replace(/\s+/g, " ")
    .trim();
check(
  "both mirrors implement the same logic",
  bodyOf(cjsSrc) === bodyOf(mjsSrc),
  bodyOf(cjsSrc) === bodyOf(mjsSrc) ? "" : "the .cjs and .mjs have drifted apart",
);

console.log("\n=== settings feed the receipt ===");
const workDir = path.join(WORKDIR, "receipt");
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
const dbPath = path.join(workDir, "r.db");
fs.copyFileSync(FIXTURE, dbPath);
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
runMigrations(db);
const settingsDB = createSettingsDB(() => db);

check("shop.name defaults to the previous i18n value",
  settingsDB.get("shop.name") === "الهنا للخيوط", settingsDB.getString("shop.name"));
check("shop.address starts empty", settingsDB.get("shop.address") === "");
check("shop.phone starts empty", settingsDB.get("shop.phone") === "");
check("receipt.widthMm defaults to 80", settingsDB.get("receipt.widthMm") === 80);

// With defaults the receipt looks exactly as it did before this change.
const defaultShop = {
  name: settingsDB.getString("shop.name"),
  tagline: settingsDB.getString("shop.tagline"),
  address: settingsDB.getString("shop.address"),
  phone: settingsDB.getString("shop.phone"),
};
check("default header shows only the tagline (as before)",
  buildShopHeaderLines(defaultShop).length === 1);
check("default footer matches the old text",
  buildShopFooterLine(defaultShop) === "الهنا للخيوط — خيوط تريكو وكروشيه",
  buildShopFooterLine(defaultShop));

settingsDB.setMany({
  "shop.name": "محل جديد",
  "shop.address": "١٥ شارع النيل",
  "shop.phone": "01122223333",
  "receipt.widthMm": 58,
});
const configured = {
  name: settingsDB.getString("shop.name"),
  tagline: settingsDB.getString("shop.tagline"),
  address: settingsDB.getString("shop.address"),
  phone: settingsDB.getString("shop.phone"),
};
check("configured name reaches the footer",
  buildShopFooterLine(configured).startsWith("محل جديد"), buildShopFooterLine(configured));
check("address and phone now appear", buildShopHeaderLines(configured).length === 3);
check("configured width reaches the page size",
  receiptPageSize(settingsDB.getNumber("receipt.widthMm")).width === 58000);

// A width outside the allowed range is clamped, so print cannot be given junk.
settingsDB.set("receipt.widthMm", 5);
check("out-of-range width is clamped to the minimum",
  settingsDB.get("receipt.widthMm") === 40, `${settingsDB.get("receipt.widthMm")}`);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
