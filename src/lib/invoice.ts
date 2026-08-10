import { jsPDF } from "jspdf";

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientAddress: string | null;
  serviceDate: string;
  amount: number;
  notes?: string | null;
  lines: { label: string; qty: number }[];
  photos: string[]; // data URLs
}

const fmtDate = (iso: string) =>
  new Date(iso.length > 10 ? iso : iso + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function buildInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  doc.setFillColor(17, 17, 17);
  doc.rect(0, 0, W, 76, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("RunSheet", M, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Filter cleaning & kitchen exhaust services", M, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TAX INVOICE", W - M, 46, { align: "right" });

  y = 110;
  doc.setTextColor(17, 17, 17);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Bill to", M, y);
  doc.text("Invoice details", W / 2 + 20, y);
  doc.setFont("helvetica", "normal");
  y += 16;
  doc.text(data.clientName, M, y);
  doc.text(`Invoice #: ${data.invoiceNumber}`, W / 2 + 20, y);
  y += 14;
  const addrLines = doc.splitTextToSize(data.clientAddress ?? "—", W / 2 - 80);
  doc.text(addrLines, M, y);
  doc.text(`Issued: ${fmtDate(data.date)}`, W / 2 + 20, y);
  doc.text(`Service date: ${fmtDate(data.serviceDate)}`, W / 2 + 20, y + 14);

  y = Math.max(y + addrLines.length * 12, y + 34) + 24;

  // Line items
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y, W - M * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Description", M + 8, y + 15);
  doc.text("Qty", W - M - 120, y + 15);
  doc.text("Amount", W - M - 8, y + 15, { align: "right" });
  y += 22;
  doc.setFont("helvetica", "normal");

  const items = data.lines.length
    ? data.lines
    : [{ label: "Filter exchange & clean", qty: 1 }];
  items.forEach((l, i) => {
    doc.text(l.label, M + 8, y + 15);
    doc.text(String(l.qty), W - M - 120, y + 15);
    if (i === 0) doc.text(data.amount.toFixed(2), W - M - 8, y + 15, { align: "right" });
    doc.setDrawColor(225, 225, 225);
    doc.line(M, y + 22, W - M, y + 22);
    y += 22;
  });

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", W - M - 120, y);
  doc.text(`$${data.amount.toFixed(2)}`, W - M - 8, y, { align: "right" });
  y += 26;

  if (data.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const notes = doc.splitTextToSize(`Notes: ${data.notes}`, W - M * 2);
    doc.text(notes, M, y);
    y += notes.length * 12 + 10;
  }

  // Photos
  if (data.photos.length) {
    doc.addPage();
    let py = M;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Service photos", M, py);
    py += 16;
    const cols = 2;
    const gap = 16;
    const cw = (W - M * 2 - gap) / cols;
    const ch = cw * 0.75;
    data.photos.forEach((p, i) => {
      const col = i % cols;
      if (col === 0 && py + ch > doc.internal.pageSize.getHeight() - M) {
        doc.addPage();
        py = M;
      }
      try {
        doc.addImage(p, "JPEG", M + col * (cw + gap), py, cw, ch, undefined, "FAST");
      } catch {
        /* skip unreadable image */
      }
      if (col === cols - 1) py += ch + gap;
    });
  }

  return doc;
}
