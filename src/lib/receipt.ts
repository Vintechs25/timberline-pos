import type { SaleRecord } from "@/lib/types";
import jsPDF from "jspdf";

interface ReceiptOptions {
  businessName?: string;
  branchName?: string;
  address?: string;
  phone?: string;
}

const formatKsh = (n: number) => `KSh ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export function buildReceiptHTML(sale: SaleRecord, opts: ReceiptOptions = {}) {
  const {
    businessName = "TimberYard POS",
    branchName = "Main Branch",
    address = "",
    phone = "",
  } = opts;
  const date = new Date(sale.date).toLocaleString();
  const itemsHtml = sale.items
    .map(
      (i) => `
      <tr>
        <td style="padding:2px 0">
          <div>${escape(i.name)}</div>
          <div style="font-size:10px;color:#666">${escape(i.description)}</div>
        </td>
        <td style="text-align:right;white-space:nowrap;padding:2px 0 2px 6px">${i.quantity}</td>
        <td style="text-align:right;white-space:nowrap;padding:2px 0 2px 6px">${formatKsh(i.total)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${sale.id.slice(-6)}</title>
<style>
  @media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; } .noprint { display: none; } }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #111; background: #fff; padding: 8px; }
  .receipt { width: 76mm; margin: 0 auto; font-size: 12px; line-height: 1.35; }
  .center { text-align: center; }
  .row { display:flex; justify-content:space-between; gap:8px; }
  hr { border: none; border-top: 1px dashed #999; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  .total { font-size: 14px; font-weight: 700; }
  .toolbar { max-width: 76mm; margin: 12px auto 0; display:flex; gap:6px; }
  .btn { flex:1; padding:8px 10px; font: 600 12px system-ui; border:1px solid #ddd; background:#f7f7f7; cursor:pointer; border-radius:6px; }
</style></head>
<body>
  <div class="receipt">
    <div class="center">
      <div style="font-size:14px;font-weight:700">${escape(businessName)}</div>
      <div>${escape(branchName)}</div>
      ${address ? `<div>${escape(address)}</div>` : ""}
      ${phone ? `<div>${escape(phone)}</div>` : ""}
    </div>
    <hr/>
    <div class="row"><span>Receipt #</span><span>${sale.id.slice(-6).toUpperCase()}</span></div>
    <div class="row"><span>Date</span><span>${escape(date)}</span></div>
    <div class="row"><span>Customer</span><span>${escape(sale.customerName)}</span></div>
    <div class="row"><span>Payment</span><span style="text-transform:uppercase">${sale.payment}</span></div>
    <hr/>
    <table>
      <thead>
        <tr style="border-bottom:1px solid #333">
          <th style="text-align:left;padding-bottom:3px">Item</th>
          <th style="text-align:right;padding-bottom:3px">Qty</th>
          <th style="text-align:right;padding-bottom:3px">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <hr/>
    <div class="row"><span>Subtotal</span><span>${formatKsh(sale.subtotal)}</span></div>
    ${sale.discount ? `<div class="row"><span>Discount</span><span>- ${formatKsh(sale.discount)}</span></div>` : ""}
    <div class="row total"><span>TOTAL</span><span>${formatKsh(sale.total)}</span></div>
    <hr/>
    <div class="center" style="font-size:11px">${sale.status === "credit" ? "ON CREDIT — please settle within terms." : "Thank you for your business."}</div>
  </div>
  <div class="toolbar noprint">
    <button class="btn" onclick="window.print()">Print</button>
    <button class="btn" onclick="window.close()">Close</button>
  </div>
</body></html>`;
}

function escape(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function printReceipt(sale: SaleRecord, opts?: ReceiptOptions) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  w.document.open();
  w.document.write(buildReceiptHTML(sale, opts));
  w.document.close();
  // Auto-trigger print after content loads
  w.onload = () => setTimeout(() => w.print(), 200);
}

export function downloadReceiptPDF(sale: SaleRecord, opts: ReceiptOptions = {}) {
  // 80mm width thermal-style PDF
  const widthMm = 80;
  const lineH = 4.2;
  const doc = new jsPDF({ unit: "mm", format: [widthMm, 200] });
  let y = 6;
  const margin = 4;
  const innerW = widthMm - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(opts.businessName ?? "TimberYard POS", widthMm / 2, y, { align: "center" });
  y += lineH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(opts.branchName ?? "Main Branch", widthMm / 2, y, { align: "center" });
  y += lineH;
  if (opts.address) {
    doc.text(opts.address, widthMm / 2, y, { align: "center", maxWidth: innerW });
    y += lineH;
  }
  if (opts.phone) {
    doc.text(opts.phone, widthMm / 2, y, { align: "center" });
    y += lineH;
  }
  y += 1;
  doc.line(margin, y, widthMm - margin, y);
  y += lineH;

  doc.setFontSize(8);
  const meta = [
    ["Receipt #", sale.id.slice(-6).toUpperCase()],
    ["Date", new Date(sale.date).toLocaleString()],
    ["Customer", sale.customerName],
    ["Payment", sale.payment.toUpperCase()],
  ];
  meta.forEach(([k, v]) => {
    doc.text(k, margin, y);
    doc.text(v, widthMm - margin, y, { align: "right" });
    y += lineH;
  });
  doc.line(margin, y, widthMm - margin, y);
  y += lineH;

  doc.setFont("helvetica", "bold");
  doc.text("Item", margin, y);
  doc.text("Qty", widthMm - margin - 18, y, { align: "right" });
  doc.text("Total", widthMm - margin, y, { align: "right" });
  y += lineH;
  doc.setFont("helvetica", "normal");

  sale.items.forEach((i) => {
    const nameLines = doc.splitTextToSize(i.name, innerW - 30);
    doc.text(nameLines, margin, y);
    doc.text(String(i.quantity), widthMm - margin - 18, y, { align: "right" });
    doc.text(formatKsh(i.total), widthMm - margin, y, { align: "right" });
    y += lineH * nameLines.length;
    if (i.description) {
      doc.setFontSize(7);
      doc.setTextColor(110);
      doc.text(i.description, margin, y, { maxWidth: innerW - 30 });
      doc.setTextColor(0);
      doc.setFontSize(8);
      y += lineH;
    }
  });

  doc.line(margin, y, widthMm - margin, y);
  y += lineH;
  doc.text("Subtotal", margin, y);
  doc.text(formatKsh(sale.subtotal), widthMm - margin, y, { align: "right" });
  y += lineH;
  if (sale.discount) {
    doc.text("Discount", margin, y);
    doc.text(`- ${formatKsh(sale.discount)}`, widthMm - margin, y, { align: "right" });
    y += lineH;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL", margin, y);
  doc.text(formatKsh(sale.total), widthMm - margin, y, { align: "right" });
  y += lineH + 1;
  doc.line(margin, y, widthMm - margin, y);
  y += lineH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    sale.status === "credit" ? "ON CREDIT — please settle." : "Thank you for your business.",
    widthMm / 2,
    y,
    { align: "center" },
  );

  doc.save(`receipt-${sale.id.slice(-6)}.pdf`);
}
