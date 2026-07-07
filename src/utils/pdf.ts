import puppeteer from "puppeteer";

/**
 * Generate PDF dari HTML string
 * @returns Buffer PDF yang bisa disimpan ke Supabase Storage atau dikirim sebagai response
 */
export async function generatePdfFromHtml(
  htmlContent: string,
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "load" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Template HTML invoice — terima data order, return HTML string
 */
export function buildInvoiceHtml(data: {
  invoiceNumber: string;
  orderNumber: string;
  clientName: string;
  weddingDate: string;
  items: { label: string; amount: number }[];
  total: number;
  termType: "DOWN_PAYMENT" | "FINAL_PAYMENT";
  issuedAt: string;
}): string {
  const termLabel =
    data.termType === "DOWN_PAYMENT" ? "DP (50%)" : "Pelunasan (50%)";
  const rows = data.items
    .map(
      (item) =>
        `<tr><td>${item.label}</td><td>Rp ${item.amount.toLocaleString("id-ID")}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #2d2a2e; margin: 0; padding: 0; }
    .header { background: #8b3a52; color: white; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
    .body { padding: 32px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 24px; }
    .meta div { font-size: 13px; line-height: 1.8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f6ecef; text-align: left; padding: 10px 12px; font-size: 13px; }
    td { padding: 10px 12px; border-bottom: 1px solid #e8e8e8; font-size: 13px; }
    .total-row td { font-weight: bold; background: #f6ecef; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b6b6b; border-top: 1px solid #e8e8e8; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE</h1>
    <p>${data.invoiceNumber} — ${termLabel}</p>
  </div>
  <div class="body">
    <div class="meta">
      <div>
        <strong>Kepada:</strong><br/>
        ${data.clientName}<br/>
        Nomor Order: ${data.orderNumber}<br/>
        Tanggal Acara: ${data.weddingDate}
      </div>
      <div style="text-align:right">
        <strong>Tanggal Invoice:</strong><br/>
        ${data.issuedAt}
      </div>
    </div>
    <table>
      <thead><tr><th>Deskripsi</th><th>Jumlah</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row"><td>Total ${termLabel}</td><td>Rp ${data.total.toLocaleString("id-ID")}</td></tr>
      </tbody>
    </table>
    <div class="footer">
      Invoice ini diterbitkan secara otomatis oleh sistem Wedding Organizer Platform.
      Harap simpan sebagai bukti pembayaran resmi.
    </div>
  </div>
</body>
</html>`;
}
