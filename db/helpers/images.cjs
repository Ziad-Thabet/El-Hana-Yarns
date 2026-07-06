const path = require("path");
const fs = require("fs");
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.warn("[Image] sharp not available — thumbnails disabled");
  sharp = null;
}
let IMG_PRODUCTS, IMG_RECEIPTS, IMG_THUMBS, IMG_LADING;
const THUMB_SIZE = 300;
const THUMB_JPEG_QUALITY = 80;
function getThumbFilename(filename) {
  return `thumb_${filename.replace(/\.(png|jpeg|webp|gif)$/i, ".jpg")}`;
}
function initImagePaths(dataDir) {
  IMG_PRODUCTS = path.join(dataDir, "images", "products");
  IMG_RECEIPTS = path.join(dataDir, "images", "receipts");
  IMG_THUMBS = path.join(dataDir, "images", "thumbs");
  IMG_LADING = path.join(dataDir, "images", "lading");
  [IMG_PRODUCTS, IMG_RECEIPTS, IMG_THUMBS, IMG_LADING].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}
function saveImage(base64Data, type = "product") {
  if (!base64Data) return null;
  if (!base64Data.startsWith("data:")) return base64Data;
  const dir =
    type === "product"
      ? IMG_PRODUCTS
      : type === "lading"
        ? IMG_LADING
        : IMG_RECEIPTS;
  const ext = base64Data.match(/data:image\/(\w+);/)?.[1] ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const filepath = path.join(dir, filename);
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  fs.writeFileSync(filepath, Buffer.from(base64, "base64"));
  if (type === "product") {
    generateThumbnail(filepath, filename).catch(() => {});
  }
  return filepath;
}
async function generateThumbnail(srcPath, filename) {
  if (!sharp || !srcPath) return null;
  try {
    const thumbName = getThumbFilename(filename);
    const thumbPath = path.join(IMG_THUMBS, thumbName);
    await sharp(srcPath)
      .resize(THUMB_SIZE, THUMB_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMB_JPEG_QUALITY })
      .toFile(thumbPath);
    return thumbPath;
  } catch (err) {
    console.warn("[Thumbnail] Failed to generate:", err.message);
    return null;
  }
}
function filePathToImgUrl(filepath) {
  if (!filepath) return null;
  try {
    const normalized = filepath.replace(/\\/g, "/");
    const match = normalized.match(
      /images\/(products|receipts|thumbs|lading)\/(.+)$/,
    );
    if (!match) return null;
    const [, category, filename] = match;
    return `app-img://${category}/${encodeURIComponent(filename)}`;
  } catch {
    return null;
  }
}
function resolveProductImageUrls(imageUrlRaw) {
  if (!imageUrlRaw) return { fullUrl: null, thumbUrl: null };
  const fullUrl = filePathToImgUrl(imageUrlRaw);
  const origFilename = path.basename(imageUrlRaw);
  const thumbFilename = getThumbFilename(origFilename);
  const thumbPath = path.join(IMG_THUMBS, thumbFilename);
  const thumbUrl = fs.existsSync(thumbPath)
    ? filePathToImgUrl(thumbPath)
    : fullUrl;
  return { fullUrl, thumbUrl };
}
function readImageAsBase64(filepath) {
  if (!filepath) return null;
  try {
    const buffer = fs.readFileSync(filepath);
    const ext = path.extname(filepath).slice(1) || "jpg";
    return `data:image/${ext};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
function deleteImage(filepath) {
  if (!filepath) return;
  try {
    fs.unlinkSync(filepath);
    const filename = path.basename(filepath);
    const thumbFilenameForDelete = getThumbFilename(filename);
    const thumbPath = path.join(IMG_THUMBS, thumbFilenameForDelete);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  } catch {
    /* ignore */
  }
}
module.exports = {
  initImagePaths,
  saveImage,
  generateThumbnail,
  filePathToImgUrl,
  resolveProductImageUrls,
  readImageAsBase64,
  deleteImage,
};
