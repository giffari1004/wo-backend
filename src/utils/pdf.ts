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
 *
 * 🔴 FIX: sebelumnya cuma menerima satu field `total` yang dipakai untuk DUA
 * hal sekaligus secara implisit — baris breakdown `items` menampilkan nilai
 * skala 100% (paket + semua upgrade vendor), tapi `total` yang dirender di
 * baris "Total" cuma nominal termin ini (mis. 50% untuk DP). Hasilnya invoice
 * terlihat salah hitung: jumlah item tidak match dengan total yang ditampilkan.
 *
 * Sekarang dipisah eksplisit jadi dua angka:
 * - `contractTotal` → total nilai kontrak penuh (jumlah seluruh `items`)
 * - `amountDue`     → nominal yang ditagihkan pada invoice/termin ini
 *
 * Keduanya dirender sebagai dua baris terpisah di tabel, supaya jelas bagi
 * client: ini nilai kontrak keseluruhan, dan ini yang harus dibayar sekarang.
 */
export function buildInvoiceHtml(data: {
  invoiceNumber: string;
  orderNumber: string;
  clientName: string;
  weddingDate: string;
  items: { label: string; amount: number }[];
  contractTotal: number;
  amountDue: number;
  termType: "DOWN_PAYMENT" | "FINAL_PAYMENT";
  issuedAt: string;
}): string {
  // Persentase dihitung dinamis dari rasio amountDue/contractTotal, bukan
  // hardcode "50%" — supaya label tetap akurat kalau suatu saat skema
  // termin berubah (mis. DP 30% / pelunasan 70%), tanpa perlu ubah template.
  const percentage =
    data.contractTotal > 0
      ? Math.round((data.amountDue / data.contractTotal) * 100)
      : 0;

  const termLabel =
    data.termType === "DOWN_PAYMENT"
      ? `Uang Muka / DP (${percentage}%)`
      : `Pelunasan (${percentage}%)`;

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
    .subtotal-row td { font-weight: 600; border-top: 2px solid #d8b9c3; background: #fbf6f8; }
    .total-row td { font-weight: bold; background: #f6ecef; font-size: 14px; }
    .total-row .label { color: #8b3a52; }
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
        <tr class="subtotal-row"><td>Total Nilai Kontrak</td><td>Rp ${data.contractTotal.toLocaleString("id-ID")}</td></tr>
        <tr class="total-row"><td class="label">Tagihan ${termLabel}</td><td>Rp ${data.amountDue.toLocaleString("id-ID")}</td></tr>
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
