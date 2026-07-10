import { prisma } from "../../config/database";
import { AppError } from "../../middlewares/error.middleware";
import { generatePdfFromHtml, buildInvoiceHtml } from "../../utils/pdf";
import { uploadFile, deleteFile } from "../../utils/storage";
import { env } from "../../config/env";
import { Invoice, UserRole, Prisma } from "@prisma/client";

// ============================================================================
// INVOICE SERVICE LAYER (PUPPETEER INTEGRATED — DECOUPLED DARI DB TRANSACTION)
// ============================================================================

const MAX_INVOICE_NUMBER_RETRIES = 3;

/**
 * 🔴 FIX: tahun sebelumnya hardcode "2026" — sekarang selalu ambil tahun berjalan,
 * jadi invoice yang dibuat tahun 2027, 2028, dst tetap dapat nomor yang benar
 * dan tetap lolos validasi regex di invoice.schema.ts.
 */
function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const randomSequence = Math.floor(100000 + Math.random() * 900000);
  return `INV-${year}-${randomSequence}`;
}

/**
 * 1. Otomatisasi Pembuatan Invoice Pasca Pembayaran Sukses
 *
 * 🔴 PERUBAHAN DESAIN PENTING: fungsi ini SENGAJA tidak lagi menerima
 * `tx: Prisma.TransactionClient` seperti versi sebelumnya. Render PDF via
 * Puppeteer + upload ke storage adalah operasi lambat & eksternal yang TIDAK
 * boleh menahan transaksi database utama (risiko timeout pada
 * payment.service.verifyPayment yang isolation level-nya sudah cukup berat).
 *
 * Dipanggil SETELAH transaksi payment.service selesai commit — lihat
 * integrasi di payment.service.ts. Idempotency tetap terjaga lewat
 * pengecekan `paymentId` di awal + penanganan race condition saat insert.
 */
export async function createInvoice(paymentId: string): Promise<Invoice> {
  // 1. Idempotency check di awal — cegah render PDF dua kali untuk payment yang sama.
  //    🔴 FIX: tambahkan `deletedAt: null` — versi sebelumnya bisa mengembalikan
  //    invoice yang sudah soft-deleted seolah masih valid.
  const existingInvoice = await prisma.invoice.findFirst({
    where: { paymentId, deletedAt: null },
  });
  if (existingInvoice) return existingInvoice;

  // 2. Ambil data payment + breakdown order, user, dan vendor terpilih
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId, deletedAt: null },
    include: {
      order: {
        include: {
          user: true,
          package: true,
          orderVendors: { include: { vendor: true, cateringMenu: true } },
        },
      },
    },
  });
  if (!payment) {
    throw new AppError("Data transaksi pembayaran tidak ditemukan", 404);
  }

  // 3. Susun item belanja untuk breakdown di PDF (skala nilai kontrak PENUH,
  //    bukan nominal termin ini)
  const items = [
    {
      label: `Paket Pernikahan: ${payment.order.package.name} (Harga Dasar)`,
      amount: Number(payment.order.packageBasePrice),
    },
  ];

  payment.order.orderVendors.forEach((ov) => {
    if (ov.isUpgrade && ov.category !== "CATERING") {
      items.push({
        label: `Upgrade Vendor ${ov.category}: ${ov.vendor.name}`,
        amount: Number(ov.priceAtBooking),
      });
    } else if (ov.category === "CATERING" && ov.cateringMenu) {
      items.push({
        label: `Katering (${ov.vendor.name}) - ${ov.cateringMenu.name}`,
        amount: Number(ov.priceAtBooking),
      });
    }
  });

  const contractTotal = items.reduce((sum, item) => sum + item.amount, 0);

  // 4. Generate nomor invoice + render PDF + upload, dengan retry kalau nomor
  //    bentrok (unique constraint) — 🔴 FIX: versi sebelumnya generate nomor
  //    sekali tanpa penanganan collision sama sekali.
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_INVOICE_NUMBER_RETRIES; attempt++) {
    const invoiceNumber = generateInvoiceNumber();
    const filePath = `orders/${payment.orderId}/invoices/${invoiceNumber}.pdf`;
    let publicUrl: string | undefined;

    try {
      // 🔴 FIX presentasi: pisahkan nilai total kontrak (contractTotal) dari
      // nominal tagihan termin ini (amountDue) secara eksplisit di layout PDF.
      // Sebelumnya `items` menampilkan skala 100% tapi field `total` cuma
      // menunjukkan 50% (nominal DP) — terlihat seperti invoice salah hitung.
      // Label termin ("Uang Muka / DP (xx%)" dst) dihitung otomatis di dalam
      // buildInvoiceHtml dari termType + rasio amountDue/contractTotal.
      const htmlContent = buildInvoiceHtml({
        invoiceNumber,
        orderNumber: payment.order.orderNumber,
        clientName: payment.order.user.name,
        weddingDate: payment.order.weddingDate
          ? payment.order.weddingDate.toLocaleDateString("id-ID")
          : "-",
        items,
        contractTotal, // nilai total kontrak (100%) — baris "Total Nilai Kontrak" di PDF
        termType: payment.termType,
        amountDue: Number(payment.amountDue), // nominal tagihan termin INI — baris "Tagihan ..." di PDF
        issuedAt: new Date().toLocaleDateString("id-ID"),
      });

      const pdfBuffer = await generatePdfFromHtml(htmlContent);
      publicUrl = await uploadFile(
        env.supabaseBucketPaymentProof,
        filePath,
        pdfBuffer,
        "application/pdf",
      );

      // 5. Simpan rekor faktur resmi ke database
      return await prisma.invoice.create({
        data: {
          invoiceNumber,
          orderId: payment.orderId,
          paymentId: payment.id,
          amount: payment.amountDue,
          pdfUrl: publicUrl,
        },
      });
    } catch (error) {
      // 🔴 FIX orphan file: kalau PDF sudah terlanjur ter-upload tapi
      // tx.invoice.create gagal (mis. collision nomor invoice), bersihkan
      // file yang menggantung sebelum retry/lempar error.
      if (publicUrl) {
        await deleteFile(env.supabaseBucketPaymentProof, filePath).catch(
          () => {},
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = String(error.meta?.target ?? "");

        // Kasus race condition: dua request bersamaan sama-sama lolos
        // idempotency check di awal, lalu sama-sama mencoba create invoice
        // untuk paymentId yang sama. Yang kalah tidak perlu retry generate
        // PDF baru — cukup ambil invoice yang berhasil dibuat oleh "pemenang".
        if (target.includes("paymentId")) {
          const raceWinner = await prisma.invoice.findFirst({
            where: { paymentId, deletedAt: null },
          });
          if (raceWinner) return raceWinner;
        }

        // Kasus collision di invoiceNumber (kemungkinan sangat kecil, tapi
        // sekarang ditangani) — coba lagi dengan nomor baru
        lastError = error;
        continue;
      }

      // Error lain (Puppeteer gagal render, storage down, dll) — tidak perlu
      // retry dengan nomor baru, langsung lempar
      throw error;
    }
  }

  throw new AppError(
    "Gagal membuat dokumen invoice setelah beberapa kali percobaan. Silakan coba lagi.",
    500,
    false,
  );
}

/**
 * 2. Mengambil Seluruh Koleksi Tagihan Milik Satu Order Tertentu
 */
export async function getInvoicesByOrder(
  orderId: string,
  userId: string,
  role: UserRole,
): Promise<Invoice[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId, deletedAt: null },
  });

  if (!order) throw new AppError("Draf pesanan tidak ditemukan", 404);
  if (role !== UserRole.ADMIN && order.userId !== userId) {
    throw new AppError(
      "Akses ditolak. Anda tidak memiliki hak kepemilikan data pesanan ini",
      403,
    );
  }

  return prisma.invoice.findMany({
    where: { orderId, deletedAt: null },
    orderBy: { issuedAt: "desc" },
  });
}

/**
 * 3. Mengambil Detail Rekor Dokumen Invoice Berdasarkan Nomor Faktur
 */
export async function getInvoiceDetail(
  invoiceNumber: string,
  userId: string,
  role: UserRole,
): Promise<Invoice> {
  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber, deletedAt: null },
    include: { order: true, payment: true },
  });

  if (!invoice) throw new AppError("Dokumen invoice tidak ditemukan", 404);
  if (role !== UserRole.ADMIN && invoice.order.userId !== userId) {
    throw new AppError(
      "Akses dilarang. Anda bukan pemilik dari faktur pembayaran ini",
      403,
    );
  }

  return invoice;
}
