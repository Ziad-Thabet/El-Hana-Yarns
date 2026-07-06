import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Printer, X } from "lucide-react";
import { Money, CartItemModel } from "@/lib/domain";
import type { CartItem } from "@/lib/types";
import { strings } from "@/lib/i18n/ar";
import { getLanguage } from "@/lib/i18n/store";
interface InvoicePrintProps {
  open: boolean;
  onClose: () => void;
  invoiceNumber: string;
  date: string;
  time: string;
  cashier: string;
  items: CartItem[];
  total: number;
  paidAmount?: number;
  remainingAmount?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}
export function InvoicePrint({
  open,
  onClose,
  invoiceNumber,
  date,
  time,
  cashier,
  items,
  total,
  paidAmount,
  remainingAmount,
  customerName,
  customerPhone,
  notes,
}: InvoicePrintProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const lang = getLanguage();
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";
  const buildHTML = () => {
    const itemRows = items
      .map((item) => {
        const model = CartItemModel.from(item);
        const getMeasureUnit = (u?: string) => {
          if (!u) return strings.common.kg;
          if (u === "kgm" || u === "kg") return strings.common.kg;
          if (u === "m" || u === "meter" || u === "متر")
            return strings.common.meter;
          return u;
        };
        const amt = item.measureAmount ?? item.weightGrams ?? 0;
        const measure = item.isWeighted
          ? `${amt} ${getMeasureUnit(item.measureUnit ?? "")}`
          : `${item.quantity} ${strings.common.piece}`;
        const unitPrice = item.isWeighted
          ? `${(item.pricePerKg ?? item.price).toFixed(2)} ${strings.invoice.pricePerUnit}`
          : `${item.price.toFixed(2)} ${strings.common.currencyShort}`;
        return `
        <tr>
          <td class="name">${item.name}</td>
          <td>${measure}</td>
          <td>${unitPrice}</td>
          <td>${model.lineTotal.toFixed(2)} ${strings.common.currencyShort}</td>
        </tr>`;
      })
      .join("");
    return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${strings.invoice.title} ${invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Cairo', Arial, sans-serif;
      font-size: 13px;
      color: #16112A;
      background: #fff;
      direction: ${dir};
      padding: 12px;
      width: 80mm;
      margin: 0 auto;
    }
    .header {
      text-align:center;
      padding-bottom:10px;
      margin-bottom:10px;
      border-bottom: 2px solid #2a2060;
    }
    .logo { font-size:28px; margin-bottom:4px; }
    .shop-name { font-size:20px; font-weight:900; color:#2a2060; letter-spacing:0.5px; }
    .tagline { font-size:11px; color:#6B5F88; margin-top:2px; }
    .owner { font-size:11px; color:#4A4062; margin-top:3px; }
    .inv-num {
      text-align:center; font-weight:800; font-size:13px;
      color:#2a2060; margin-bottom:8px;
      padding:4px 8px; background:#f0edf8; border-radius:6px;
    }
    .meta {
      display:flex; justify-content:space-between;
      font-size:11px; color:#4A4062;
      border-bottom:1px dashed #c8c0e0;
      padding-bottom:8px; margin-bottom:8px;
    }
    .customer {
      background:#f0edf8; border-inline-start:3px solid #7C6AF5;
      border-radius:4px; padding:6px 8px;
      margin-bottom:8px; font-size:11px; color:#2a2060;
    }
    .customer b { font-size:12px; display:block; margin-bottom:2px; color:#2a2060; }
    table { width:100%; border-collapse:collapse; margin-bottom:8px; }
    thead tr { background:linear-gradient(135deg,#2a2060,#7C6AF5); color:#fff; }
    thead th { padding:6px 4px; font-size:11px; font-weight:700; text-align:center; }
    th:first-child { text-align:start; width:40%; }
    tbody tr { border-bottom:1px solid #e8e0f0; }
    tbody tr:nth-child(even) { background:#faf8fd; }
    tbody td { padding:6px 4px; font-size:11px; text-align:center; vertical-align:middle; color:#16112A; }
    td.name { text-align:start; font-weight:600; color:#2a2060; }
    .total-box {
      border-top:2px solid #2a2060;
      padding-top:8px; margin-bottom:8px;
    }
    .total-row { display:flex; justify-content:space-between; font-size:12px; padding:2px 0; color:#4A4062; }
    .total-row.big {
      font-size:17px; font-weight:900; color:#2a2060;
      border-top:1px dashed #a09ab8; margin-top:5px; padding-top:6px;
    }
    .notes {
      font-size:11px; color:#4A4062;
      background:#f0edf8; border-radius:4px;
      padding:5px 8px; margin-bottom:8px;
    }
    .footer {
      text-align:center; font-size:11px;
      color:#6B5F88; border-top:1px dashed #c8c0e0; padding-top:8px;
    }
    .footer .ty { font-size:14px; font-weight:800; color:#2a2060; margin-bottom:3px; }
    @media print {
      body { padding:0; }
      @page { margin:4mm; size:80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🧶</div>
    <div class="shop-name">${strings.invoice.shopName}</div>
    <div class="tagline">${strings.invoice.shopTagline}</div>
  </div>
  <div class="inv-num">${strings.invoice.invoiceNumber} ${invoiceNumber}</div>
  <div class="meta">
    <div><div>📅 ${date}</div><div>🕐 ${time}</div></div>
    <div>${strings.invoice.cashier} ${cashier}</div>
  </div>
  ${
    customerName
      ? `
  <div class="customer">
    <b>👤 ${strings.invoice.customerInfo}</b>
    <div>${customerName}</div>
    ${customerPhone ? `<div>📞 ${customerPhone}</div>` : ""}
  </div>`
      : ""
  }
  <table>
    <thead>
      <tr>
        <th style="text-align:start">${strings.invoice.item}</th>
        <th>${strings.invoice.quantity}</th>
        <th>${strings.invoice.price}</th>
        <th>${strings.invoice.total}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
   <div class="total-box">
    <div class="total-row"><span>${strings.invoice.itemCount}</span><span>${items.length} ${strings.common.item}</span></div>
    <div class="total-row big"><span>${strings.invoice.grandTotal}</span><span>${total.toFixed(2)} ${strings.common.egyptianPound}</span></div>
    ${
      paidAmount !== undefined
        ? `<div class="total-row"><span>${strings.invoice.paid}</span><span>${paidAmount.toFixed(2)} ${strings.common.egyptianPound}</span></div>`
        : ""
    }
    ${
      remainingAmount && remainingAmount > 0
        ? `<div class="total-row" style="color:#c0392b;font-weight:700;"><span>${strings.invoice.remaining}</span><span>${remainingAmount.toFixed(2)} ${strings.common.egyptianPound}</span></div>`
        : ""
    }
  </div>
  ${notes ? `<div class="notes"><strong>${strings.invoice.notes}</strong> ${notes}</div>` : ""}
  <div class="footer">
    <div class="ty">${strings.invoice.thankYou}</div>
    <div>${strings.invoice.shopName} — ${strings.invoice.shopTagline}</div>
  </div>
</body>
</html>`;
  };
  const handlePrint = () => {
    const html = buildHTML();
    if (window.api?.print) {
      window.api.print(html);
      return;
    }
    const win = window.open(
      "",
      "_blank",
      "width=420,height=750,menubar=no,toolbar=no",
    );
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 800);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <span className="font-semibold text-gray-700">
            {strings.invoice.preview}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-gray-900 hover:bg-gray-700 text-white gap-2"
            >
              <Printer className="w-4 h-4" />
              {strings.common.printPdf}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div
          className="overflow-y-auto max-h-[75vh] bg-white"
          style={{ colorScheme: "light" }}
        >
          <div
            ref={printRef}
            dir={dir}
            className="mx-auto bg-white p-4 invoice-preview"
            style={{
              fontFamily: "Arial, sans-serif",
              width: "100%",
              maxWidth: 300,
              fontSize: 13,
              color: "#1a1a1a",
              backgroundColor: "#ffffff",
            }}
          >
            <div className="text-center border-b-2 border-gray-900 pb-3 mb-3">
              <div className="text-3xl mb-1">🧶</div>
              <div className="text-xl font-black" style={{ color: "#1a1a1a" }}>
                {strings.invoice.shopName}
              </div>
              <div className="text-xs" style={{ color: "#777" }}>
                {strings.invoice.shopTagline}
              </div>
            </div>
            <div
              className="text-center font-bold text-sm mb-2"
              style={{ color: "#1a1a1a" }}
            >
              {strings.invoice.invoiceNumber} {invoiceNumber}
            </div>
            <div
              className="flex justify-between text-xs border-b border-dashed pb-2 mb-2"
              style={{ color: "#666", borderColor: "#ddd" }}
            >
              <div>
                <div>📅 {date}</div>
                <div>🕐 {time}</div>
              </div>
              <div>
                {strings.invoice.cashier} {cashier}
              </div>
            </div>
            {customerName && (
              <div
                className="rounded p-2 mb-2 text-xs"
                style={{ backgroundColor: "#f5f5f5", color: "#333" }}
              >
                <div className="font-bold mb-1" style={{ color: "#1a1a1a" }}>
                  👤 {strings.invoice.customerInfo}
                </div>
                <div>{customerName}</div>
                {customerPhone && <div>📞 {customerPhone}</div>}
              </div>
            )}
            <table
              className="w-full mb-2"
              style={{ borderCollapse: "collapse", fontSize: 11 }}
            >
              <thead>
                <tr style={{ background: "#1a1a1a", color: "#fff" }}>
                  <th
                    style={{
                      padding: "4px 3px",
                      textAlign: "start",
                      width: "38%",
                    }}
                  >
                    {strings.invoice.item}
                  </th>
                  <th style={{ padding: "4px 3px", textAlign: "center" }}>
                    {strings.invoice.quantity}
                  </th>
                  <th style={{ padding: "4px 3px", textAlign: "center" }}>
                    {strings.invoice.price}
                  </th>
                  <th style={{ padding: "4px 3px", textAlign: "center" }}>
                    {strings.invoice.total}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const model = CartItemModel.from(item);
                  const measure = item.isWeighted
                    ? `${item.measureAmount ?? item.weightGrams ?? 0} ${item.measureUnit ?? strings.common.kg}`
                    : `${item.quantity} ${strings.common.piece}`;
                  const unitPrice = item.isWeighted
                    ? `${item.pricePerKg ?? item.price} ${strings.common.currencyShort}`
                    : `${item.price} ${strings.common.currencyShort}`;
                  return (
                    <tr
                      key={item.id}
                      style={{
                        background: i % 2 === 0 ? "#fff" : "#fafafa",
                        borderBottom: "1px dotted #ddd",
                      }}
                    >
                      <td
                        style={{
                          padding: "4px 3px",
                          fontWeight: 600,
                          textAlign: "start",
                        }}
                      >
                        {item.name}
                      </td>
                      <td
                        style={{
                          padding: "4px 3px",
                          textAlign: "center",
                          color: "#333",
                        }}
                      >
                        {measure}
                      </td>
                      <td
                        style={{
                          padding: "4px 3px",
                          textAlign: "center",
                          color: "#333",
                        }}
                      >
                        {unitPrice}
                      </td>
                      <td
                        style={{
                          padding: "4px 3px",
                          textAlign: "center",
                          color: "#1a1a1a",
                          fontWeight: 600,
                        }}
                      >
                        {model.lineTotal.toFixed(2)}{" "}
                        {strings.common.currencyShort}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div
              style={{
                borderTop: "2px solid #1a1a1a",
                paddingTop: 7,
                marginBottom: 8,
              }}
            >
              <div
                className="flex justify-between text-xs"
                style={{ color: "#666" }}
              >
                <span>{strings.invoice.itemCount}</span>
                <span>
                  {items.length} {strings.common.item}
                </span>
              </div>
              <div
                className="flex justify-between font-black mt-1"
                style={{
                  borderTop: "1px dashed #999",
                  paddingTop: 5,
                  fontSize: 15,
                }}
              >
                <span>{strings.invoice.grandTotal}</span>
                <span>{Money.from(total).toString()}</span>
              </div>
              {paidAmount !== undefined && (
                <div
                  className="flex justify-between text-xs mt-1"
                  style={{ color: "#666" }}
                >
                  <span>{strings.invoice.paid}</span>
                  <span>{Money.from(paidAmount).toString()}</span>
                </div>
              )}
              {remainingAmount !== undefined && remainingAmount > 0 && (
                <div
                  className="flex justify-between text-xs font-bold mt-1"
                  style={{ color: "#c0392b" }}
                >
                  <span>{strings.invoice.remaining}</span>
                  <span>{Money.from(remainingAmount).toString()}</span>
                </div>
              )}
            </div>
            {notes && (
              <div
                className="text-xs rounded p-2 mb-2"
                style={{ color: "#666", backgroundColor: "#f5f5f5" }}
              >
                <strong>{strings.invoice.notes}</strong> {notes}
              </div>
            )}
            <div
              className="text-center border-t border-dashed pt-2 text-xs"
              style={{ color: "#999", borderColor: "#ddd" }}
            >
              <div
                className="font-bold text-sm mb-1"
                style={{ color: "#1a1a1a" }}
              >
                {strings.invoice.thankYou}
              </div>
              <div>
                {strings.invoice.shopName} — {strings.invoice.shopTagline}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
