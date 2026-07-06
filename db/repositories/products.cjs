const { generateId } = require("../helpers/ids.cjs");
const images = require("../helpers/images.cjs");
const DEFAULT_PRODUCT_UNIT = "piece";
const BARCODE_INTERNAL_PREFIX = "20";

function computeEAN13CheckDigit(twelveDigits) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function generateEAN13Candidate() {
  let body = BARCODE_INTERNAL_PREFIX;
  for (let i = 0; i < 10; i++) {
    body += Math.floor(Math.random() * 10).toString();
  }
  const checkDigit = computeEAN13CheckDigit(body);
  return body + checkDigit.toString();
}
function mapProduct(row) {
  const { fullUrl, thumbUrl } = images.resolveProductImageUrls(row.image_url);
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    stock: row.stock,
    barcode: row.barcode,
    imageUrl: thumbUrl,
    imageFullUrl: fullUrl,
    imagePath: row.image_url,
    category: row.category,
    unit: row.unit,
    pricePerKg: row.price_per_kg,
  };
}
function createProductsDB(getDb) {
  const productsDB = {
    getAll() {
      return getDb()
        .prepare("SELECT * FROM products ORDER BY name")
        .all()
        .map(mapProduct);
    },
    getById(id) {
      const row = getDb().prepare("SELECT * FROM products WHERE id=?").get(id);
      return row ? mapProduct(row) : null;
    },
    getByBarcode(barcode) {
      const row = getDb()
        .prepare("SELECT * FROM products WHERE barcode=?")
        .get(barcode);
      return row ? mapProduct(row) : null;
    },
    generateUniqueBarcode() {
      const db = getDb();
      const exists = (code) =>
        !!db.prepare("SELECT 1 FROM products WHERE barcode=?").get(code);
      const MAX_ATTEMPTS = 30;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const candidate = generateEAN13Candidate();
        if (!exists(candidate)) return candidate;
      }
      throw new Error("تعذر توليد باركود فريد بعد عدة محاولات، حاول مرة أخرى");
    },
    create(data) {
      const id = generateId("prod");
      const imgPath = images.saveImage(data.imageUrl, "product");
      const barcode =
        data.barcode && data.barcode.trim()
          ? data.barcode.trim()
          : this.generateUniqueBarcode();
      getDb()
        .prepare(
          "INSERT INTO products (id, name, price, stock, barcode, image_url, category, unit, price_per_kg) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          data.name,
          data.price ?? 0,
          data.stock ?? 0,
          barcode,
          imgPath,
          data.category ?? null,
          data.unit ?? DEFAULT_PRODUCT_UNIT,
          data.pricePerKg ?? null,
        );
      return this.getById(id);
    },
    update(id, data) {
      const old = this.getById(id);
      let imgPath = data.imageUrl ?? null;
      if (data.imageUrl?.startsWith("data:")) {
        if (old?.imagePath) images.deleteImage(old.imagePath);
        imgPath = images.saveImage(data.imageUrl, "product");
      }
      getDb()
        .prepare(
          "UPDATE products SET name=?, price=?, stock=?, barcode=?, image_url=?, category=?, unit=?, price_per_kg=? WHERE id=?",
        )
        .run(
          data.name,
          data.price,
          data.stock,
          data.barcode ?? null,
          imgPath,
          data.category ?? null,
          data.unit,
          data.pricePerKg ?? null,
          id,
        );
      return this.getById(id);
    },
    deductStock(id, amount) {
      const db = getDb();
      const result = db
        .prepare(
          "UPDATE products SET stock = stock - ? WHERE id=? AND stock >= ?",
        )
        .run(amount, id, amount);
      if (result.changes === 0) {
        const product = db
          .prepare("SELECT name, stock FROM products WHERE id=?")
          .get(id);
        const name = product?.name ?? "المنتج";
        const available = product?.stock ?? 0;
        throw new Error(
          `الكمية المطلوبة غير متوفرة لـ "${name}" — المتاح: ${available}`,
        );
      }
    },
    addStock(id, amount) {
      getDb()
        .prepare("UPDATE products SET stock = stock + ? WHERE id=?")
        .run(amount, id);
    },
    delete(id) {
      const p = this.getById(id);
      if (p?.imagePath) images.deleteImage(p.imagePath);
      getDb().prepare("DELETE FROM products WHERE id=?").run(id);
      return { success: true };
    },
    getForSales() {
      return getDb()
        .prepare(
          `SELECT p.id, p.name, p.price,
             p.stock - COALESCE(h.held, 0) as stock,
             p.barcode, p.image_url, p.category, p.unit, p.price_per_kg
           FROM products p
           LEFT JOIN (
             SELECT oi.product_id, SUM(oi.quantity) as held
             FROM online_order_items oi
             JOIN online_orders oo ON oi.order_id = oo.id
             WHERE oo.status IN ('new','preparing','ready')
             GROUP BY oi.product_id
           ) h ON h.product_id = p.id
           ORDER BY p.name`,
        )
        .all()
        .map((row) => {
          const { thumbUrl } = images.resolveProductImageUrls(row.image_url);
          return {
            id: row.id,
            name: row.name,
            price: row.price,
            stock: row.stock,
            barcode: row.barcode,
            imageUrl: thumbUrl,
            category: row.category,
            unit: row.unit,
            pricePerKg: row.price_per_kg,
          };
        });
    },
  };
  return productsDB;
}
module.exports = { createProductsDB };
