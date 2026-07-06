const path = require("path");
const fs = require("fs");
const DATA_DIR = path.join(__dirname, "userdata");
const PRODUCTS_DIR = path.join(DATA_DIR, "images", "products");
const THUMBS_DIR = path.join(DATA_DIR, "images", "thumbs");
const THUMB_MAX_SIZE = 300;
const THUMB_QUALITY = 80;
async function main() {
  console.log("🖼  Thumbnail Generator — Phase 4.2");
  console.log("━".repeat(45));
  if (!fs.existsSync(THUMBS_DIR)) {
    fs.mkdirSync(THUMBS_DIR, { recursive: true });
    console.log(`✅ Created: ${THUMBS_DIR}`);
  }
  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.log("⚠️  No products images folder found — nothing to do.");
    return;
  }
  const files = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  if (files.length === 0) {
    console.log("⚠️  No product images found — nothing to do.");
    return;
  }
  console.log(`📦 Found ${files.length} product image(s)\n`);
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("❌ sharp not installed. Run: npm install sharp --save");
    process.exit(1);
  }
  let done = 0,
    skipped = 0,
    failed = 0;
  for (const filename of files) {
    const srcPath = path.join(PRODUCTS_DIR, filename);
    const thumbName = `thumb_${filename.replace(/\.(png|webp|gif)$/i, ".jpg")}`;
    const thumbPath = path.join(THUMBS_DIR, thumbName);
    if (fs.existsSync(thumbPath)) {
      skipped++;
      continue;
    }
    try {
      await sharp(srcPath)
        .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: THUMB_QUALITY })
        .toFile(thumbPath);
      console.log(`  ✅ ${filename} → ${thumbName}`);
      done++;
    } catch (err) {
      console.warn(`  ❌ ${filename}: ${err.message}`);
      failed++;
    }
  }
  console.log("\n" + "━".repeat(45));
  console.log(`✅ Generated : ${done}`);
  console.log(`⏭  Skipped   : ${skipped} (already exist)`);
  if (failed > 0) console.log(`❌ Failed    : ${failed}`);
  console.log("━".repeat(45));
  console.log("Done! 🎉");
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
