import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  totals?: string[];
}

export interface PdfOptions {
  title: string;
  subtitle?: string;
  companyName: string;
  companyPhone?: string;
  companyAddress?: string;
  branchName?: string;
  logoUrl?: string;
  dateRange?: string;
  sections: PdfSection[];
  filename?: string;
}

const BRAND_COLOR: [number, number, number] = [30, 30, 30];
const ACCENT_COLOR: [number, number, number] = [194, 120, 3];
const LIGHT_GRAY: [number, number, number] = [248, 248, 248];
const MID_GRAY: [number, number, number] = [120, 120, 120];

export function generatePdf(opts: PdfOptions): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  /* ── watermark (behind content) ── */
  const addWatermark = () => {
    const pages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(52);
      doc.setFont("helvetica", "bold");
      doc.text("ARA TECH", pageW / 2, pageH / 2, { align: "center", angle: 45 });
      doc.restoreGraphicsState();
    }
  };

  /* ── header band ── */
  const drawHeader = () => {
    doc.setFillColor(...BRAND_COLOR);
    doc.rect(0, 0, pageW, 38, "F");

    /* accent stripe */
    doc.setFillColor(...ACCENT_COLOR);
    doc.rect(0, 36, pageW, 2.5, "F");

    /* logo (if base64) */
    let textStartX = margin + 2;
    if (opts.logoUrl && opts.logoUrl.startsWith("data:image")) {
      try {
        const fmt = opts.logoUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(opts.logoUrl, fmt, margin, 5, 22, 22);
        textStartX = margin + 26;
      } catch {
        /* skip logo on error */
      }
    }

    /* company name */
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(opts.companyName, textStartX, 14);

    /* company sub-info */
    const infoLines: string[] = [];
    if (opts.companyPhone) infoLines.push(opts.companyPhone);
    if (opts.companyAddress) infoLines.push(opts.companyAddress);
    if (opts.branchName) infoLines.push(`Branch: ${opts.branchName}`);
    if (infoLines.length) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 200, 200);
      doc.text(infoLines.join("  ·  "), textStartX, 21);
    }

    /* document title (right-aligned) */
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(opts.title, pageW - margin, 14, { align: "right" });
    if (opts.subtitle) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(190, 190, 190);
      doc.text(opts.subtitle, pageW - margin, 21, { align: "right" });
    }
    if (opts.dateRange) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(190, 190, 190);
      doc.text(opts.dateRange, pageW - margin, 28, { align: "right" });
    }
  };

  /* ── footer on every page ── */
  const addFooters = () => {
    const pages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFillColor(...BRAND_COLOR);
      doc.rect(0, pageH - 10, pageW, 10, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 160, 160);
      doc.text("Powered by Ara Tech", margin, pageH - 3.5);
      doc.text(
        `Page ${i} of ${pages}  ·  Generated ${new Date().toLocaleString("en-NG")}`,
        pageW - margin,
        pageH - 3.5,
        { align: "right" }
      );
    }
  };

  drawHeader();

  let y = 46;

  opts.sections.forEach((section, si) => {
    /* section heading */
    if (si > 0) y += 4;

    /* check page break */
    if (y > pageH - 40) {
      doc.addPage();
      drawHeader();
      y = 46;
    }

    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, "F");
    doc.setTextColor(...BRAND_COLOR);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(section.title.toUpperCase(), margin + 3, y + 4.8);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [section.headers],
      body: section.rows.map(r => r.map(String)),
      foot: section.totals ? [section.totals] : [],
      showFoot: section.totals ? "lastPage" : "never",
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: [40, 40, 40],
        lineColor: [230, 230, 230],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: BRAND_COLOR,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      footStyles: {
        fillColor: ACCENT_COLOR,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) drawHeader();
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  });

  addWatermark();
  addFooters();

  doc.save(opts.filename ?? `${opts.title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`);
}

export function fmtCurrency(n: number) {
  return `N${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
