/**
 * Builds the end-of-day workbook.
 *
 * Runs in a utilityProcess, not the main process. Main is single threaded and
 * owns window compositing and input dispatch, so a multi-second workbook build
 * there freezes the whole application — the same class of stall the base64
 * receipt loading used to cause. It is not in the renderer either, because the
 * data would have to be marshalled across IPC only to be turned into a file.
 *
 * Receives one message: { data, filePath }. Replies with { ok, filePath } or
 * { ok: false, error }.
 */

const ExcelJS = require("exceljs");

const BRAND = "FF2A2060";
const HEADER_BG = "FFEFEDF7";
const MONEY = '#,##0.00';
const QTY = '#,##0.###';

function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: BRAND } };
  row.alignment = { vertical: "middle" };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.border = { bottom: { style: "thin", color: { argb: BRAND } } };
  });
}

/**
 * Adds a sheet with a frozen, filtered header row and sized columns.
 * `columns` is [{ header, key, width, style }].
 */
function addSheet(workbook, title, columns, rows) {
  const sheet = workbook.addWorksheet(title, {
    views: [{ state: "frozen", ySplit: 1, rightToLeft: true }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape" },
  });
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 16,
    style: c.style,
  }));
  for (const row of rows) sheet.addRow(row);
  styleHeaderRow(sheet.getRow(1));
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }
  return sheet;
}

/** Bold totals row with a rule above it, so the eye lands on the number. */
function addTotalsRow(sheet, values) {
  const row = sheet.addRow(values);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.border = { top: { style: "double", color: { argb: BRAND } } };
  });
  return row;
}

function buildSummarySheet(workbook, data) {
  const sheet = workbook.addWorksheet("الملخص", {
    views: [{ rightToLeft: true, showGridLines: false }],
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });
  sheet.columns = [{ width: 34 }, { width: 22 }, { width: 22 }];

  const { shop, from, to, isSingleDay, generatedAt } = data.meta;
  const title = sheet.addRow([shop.name || "تقرير نهاية اليوم"]);
  title.font = { bold: true, size: 18, color: { argb: BRAND } };
  if (shop.tagline) sheet.addRow([shop.tagline]).font = { color: { argb: "FF6B5F88" } };
  if (shop.address) sheet.addRow([shop.address]).font = { size: 10 };
  if (shop.phone) sheet.addRow([shop.phone]).font = { size: 10 };
  sheet.addRow([]);
  const period = sheet.addRow([
    isSingleDay ? `تقرير يوم ${from}` : `تقرير من ${from} إلى ${to}`,
  ]);
  period.font = { bold: true, size: 13 };
  sheet.addRow([`تم الإنشاء: ${new Date(generatedAt).toLocaleString()}`]).font = {
    size: 9,
    color: { argb: "FF888888" },
  };
  sheet.addRow([]);

  const s = data.summary;
  const section = (label) => {
    const row = sheet.addRow([label]);
    row.font = { bold: true, size: 12, color: { argb: BRAND } };
    row.eachCell((c) => {
      c.border = { bottom: { style: "thin", color: { argb: BRAND } } };
    });
  };
  const line = (label, value, isMoney = true) => {
    const row = sheet.addRow([label, value]);
    if (isMoney) row.getCell(2).numFmt = MONEY;
    return row;
  };

  section("المبيعات");
  line("إجمالي المبيعات", s.grossSales);
  line("المرتجعات", -s.returnedTotal);
  const net = line("صافي المبيعات", s.netSales);
  net.font = { bold: true };
  line("عدد الفواتير", s.invoiceCount, false);
  line("عدد الأصناف المباعة", s.itemsSold, false);
  line("متوسط الفاتورة", s.averageBasket);
  sheet.addRow([]);

  section("المُحصّل");
  for (const m of s.collectedByMethod) line(m.method, m.amount);
  const collected = line("إجمالي المُحصّل", s.collectedTotal);
  collected.font = { bold: true };
  sheet.addRow([]);

  section("الديون");
  line("ديون جديدة", s.debtCreated);
  line("تحصيل ديون", s.debtCollected);
  line("إجمالي المتبقي", s.debtOutstanding);
  sheet.addRow([]);

  section("المصروفات والمشتريات");
  line("مصروفات", s.expensesTotal);
  line("مدفوع للموردين", s.purchasesPaid);
  sheet.addRow([]);

  section("الموقف النقدي");
  const cash = line("المُحصّل ناقص المصروفات والمشتريات", s.netCashPosition);
  cash.font = { bold: true, size: 12 };
  sheet.addRow([]);

  section("المخزون");
  line("أصناف نفدت", s.outOfStockCount, false);
  line("أصناف قاربت على النفاد", s.lowStockCount, false);

  return sheet;
}

function buildWorkbook(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.meta.shop.name || "El-Hana Yarns";
  workbook.created = new Date(data.meta.generatedAt);

  buildSummarySheet(workbook, data);

  const sales = addSheet(
    workbook,
    "المبيعات",
    [
      { header: "التاريخ", key: "date", width: 12 },
      { header: "الوقت", key: "time", width: 10 },
      { header: "رقم الفاتورة", key: "invoiceNumber", width: 20 },
      { header: "الكاشير", key: "cashier", width: 16 },
      { header: "المصدر", key: "source", width: 10 },
      { header: "عدد الأصناف", key: "lineCount", width: 12 },
      { header: "الإجمالي", key: "total", width: 14, style: { numFmt: MONEY } },
      { header: "المدفوع", key: "paid", width: 14, style: { numFmt: MONEY } },
      { header: "المتبقي", key: "remaining", width: 14, style: { numFmt: MONEY } },
      { header: "طريقة الدفع", key: "methods", width: 18 },
      { header: "العميل", key: "customer", width: 20 },
      { header: "حالة المرتجع", key: "returnStatus", width: 14 },
    ],
    data.invoices,
  );
  if (data.invoices.length) {
    addTotalsRow(sales, {
      cashier: "الإجمالي",
      total: data.summary.grossSales,
      paid: data.invoices.reduce((s, i) => s + i.paid, 0),
      remaining: data.invoices.reduce((s, i) => s + i.remaining, 0),
    });
  }

  const lines = addSheet(
    workbook,
    "أصناف المبيعات",
    [
      { header: "التاريخ", key: "date", width: 12 },
      { header: "رقم الفاتورة", key: "invoiceNumber", width: 20 },
      { header: "الصنف", key: "name", width: 30 },
      { header: "التصنيف", key: "category", width: 16 },
      { header: "الوحدة", key: "unit", width: 10 },
      { header: "الكمية", key: "quantity", width: 12, style: { numFmt: QTY } },
      { header: "سعر الوحدة", key: "unitPrice", width: 14, style: { numFmt: MONEY } },
      { header: "الإجمالي", key: "lineTotal", width: 14, style: { numFmt: MONEY } },
    ],
    data.lines,
  );
  if (data.lines.length) {
    addTotalsRow(lines, {
      name: "الإجمالي",
      quantity: data.summary.itemsSold,
      lineTotal: data.lines.reduce((s, l) => s + l.lineTotal, 0),
    });
  }

  addSheet(
    workbook,
    "حركة المخزون",
    [
      { header: "الصنف", key: "name", width: 30 },
      { header: "التصنيف", key: "category", width: 16 },
      { header: "الوحدة", key: "unit", width: 10 },
      { header: "رصيد أول المدة", key: "openingStock", width: 15, style: { numFmt: QTY } },
      { header: "وارد", key: "received", width: 12, style: { numFmt: QTY } },
      { header: "مباع", key: "sold", width: 12, style: { numFmt: QTY } },
      { header: "مرتجع", key: "returned", width: 12, style: { numFmt: QTY } },
      { header: "رصيد آخر المدة", key: "closingStock", width: 15, style: { numFmt: QTY } },
    ],
    data.inventory,
  );

  const alerts = addSheet(
    workbook,
    "تنبيهات المخزون",
    [
      { header: "الصنف", key: "name", width: 30 },
      { header: "التصنيف", key: "category", width: 16 },
      { header: "الوحدة", key: "unit", width: 10 },
      { header: "الرصيد", key: "stock", width: 12, style: { numFmt: QTY } },
      { header: "المباع في المدة", key: "soldInPeriod", width: 15, style: { numFmt: QTY } },
      { header: "يكفي (أيام)", key: "daysOfCover", width: 14 },
      { header: "الحالة", key: "status", width: 12 },
    ],
    data.alerts,
  );
  // Out-of-stock rows in red: the sheet exists to be acted on.
  alerts.eachRow((row, index) => {
    if (index === 1) return;
    if (row.getCell("status").value === "out") {
      row.font = { color: { argb: "FFC0392B" }, bold: true };
    }
  });

  addSheet(
    workbook,
    "المرتجعات",
    [
      { header: "رقم المرتجع", key: "returnNumber", width: 20 },
      { header: "الفاتورة الأصلية", key: "invoiceNumber", width: 20 },
      { header: "التاريخ", key: "date", width: 12 },
      { header: "الوقت", key: "time", width: 10 },
      { header: "القيمة", key: "total", width: 14, style: { numFmt: MONEY } },
      { header: "مسترد نقداً", key: "refundedCash", width: 14, style: { numFmt: MONEY } },
      { header: "خصم من المديونية", key: "debtReduced", width: 16, style: { numFmt: MONEY } },
      { header: "السبب", key: "reason", width: 28 },
      { header: "بواسطة", key: "createdBy", width: 16 },
    ],
    data.returns,
  );

  addSheet(
    workbook,
    "الطلبات الأونلاين",
    [
      { header: "رقم الطلب", key: "orderNumber", width: 18 },
      { header: "التاريخ", key: "date", width: 12 },
      { header: "الحالة", key: "status", width: 14 },
      { header: "العميل", key: "customer", width: 22 },
      { header: "المندوب", key: "driver", width: 16 },
      { header: "طريقة الدفع", key: "paymentMethod", width: 14 },
      { header: "حالة الدفع", key: "paymentStatus", width: 14 },
      { header: "قيمة المنتجات", key: "productsTotal", width: 15, style: { numFmt: MONEY } },
      { header: "التوصيل", key: "deliveryFee", width: 12, style: { numFmt: MONEY } },
      { header: "الإجمالي", key: "grandTotal", width: 14, style: { numFmt: MONEY } },
      { header: "المتبقي", key: "remaining", width: 14, style: { numFmt: MONEY } },
    ],
    data.onlineOrders,
  );

  addSheet(
    workbook,
    "الديون",
    [
      { header: "العميل", key: "customer", width: 24 },
      { header: "رقم الفاتورة", key: "invoiceNumber", width: 20 },
      { header: "تاريخ الدين", key: "createdDate", width: 13 },
      { header: "الإجمالي", key: "total", width: 14, style: { numFmt: MONEY } },
      { header: "المدفوع", key: "paid", width: 14, style: { numFmt: MONEY } },
      { header: "المتبقي", key: "remaining", width: 14, style: { numFmt: MONEY } },
      { header: "العمر (يوم)", key: "ageDays", width: 12 },
      { header: "الفئة", key: "bucket", width: 12 },
    ],
    data.debts.aging,
  );

  const expenses = addSheet(
    workbook,
    "المصروفات",
    [
      { header: "التاريخ", key: "date", width: 12 },
      { header: "التصنيف", key: "category", width: 20 },
      { header: "المبلغ", key: "amount", width: 14, style: { numFmt: MONEY } },
      { header: "البيان", key: "description", width: 34 },
      { header: "بواسطة", key: "createdBy", width: 16 },
    ],
    data.expenses,
  );
  if (data.expenses.length) {
    addTotalsRow(expenses, { category: "الإجمالي", amount: data.summary.expensesTotal });
  }

  addSheet(
    workbook,
    "المشتريات",
    [
      { header: "رقم الفاتورة", key: "invoiceNumber", width: 20 },
      { header: "المورد", key: "supplier", width: 24 },
      { header: "التاريخ", key: "date", width: 12 },
      { header: "الإجمالي", key: "total", width: 14, style: { numFmt: MONEY } },
      { header: "المدفوع", key: "paid", width: 14, style: { numFmt: MONEY } },
      { header: "المتبقي", key: "outstanding", width: 14, style: { numFmt: MONEY } },
      { header: "الحالة", key: "status", width: 12 },
    ],
    data.purchases,
  );

  addSheet(
    workbook,
    "الورديات",
    [
      { header: "التاريخ", key: "date", width: 12 },
      { header: "الموظف", key: "user", width: 20 },
      { header: "من", key: "startedAt", width: 22 },
      { header: "إلى", key: "endedAt", width: 22 },
      { header: "الحالة", key: "status", width: 10 },
      { header: "نقدي", key: "cash", width: 14, style: { numFmt: MONEY } },
      { header: "فودافون", key: "vodafone", width: 14, style: { numFmt: MONEY } },
      { header: "إنستاباي", key: "instapay", width: 14, style: { numFmt: MONEY } },
      { header: "عدد الفواتير", key: "invoices", width: 12 },
    ],
    data.shifts,
  );

  return workbook;
}

async function writeWorkbook(data, filePath) {
  const workbook = buildWorkbook(data);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

// utilityProcess delivers messages on process.parentPort.
if (process.parentPort) {
  process.parentPort.on("message", async (event) => {
    const { data, filePath } = event.data ?? {};
    try {
      await writeWorkbook(data, filePath);
      process.parentPort.postMessage({ ok: true, filePath });
    } catch (error) {
      process.parentPort.postMessage({ ok: false, error: error.message });
    }
  });
}

module.exports = { buildWorkbook, writeWorkbook };
