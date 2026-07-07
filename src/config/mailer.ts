import nodemailer, { Transporter } from "nodemailer";
import { env } from "./env";
import { logger } from "./logger";

let transporter: Transporter;

export function getMailer(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }
  return transporter;
}

/**
 * Helper generik untuk kirim email
 */
async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const mailer = getMailer();
  try {
    await mailer.sendMail({
      from: `"Wedding Organizer" <${env.smtpUser}>`,
      ...options,
    });
    logger.info(`[MAIL] Email sent to ${options.to}: ${options.subject}`);
  } catch (err) {
    // Log error tapi jangan crash aplikasi — email gagal tidak boleh hentikan flow utama
    logger.error(err, `[MAIL] Failed to send email to ${options.to}`);
  }
}

// ── Email templates ───────────────────────────────────────────────

export async function sendPaymentReminderEmail(data: {
  to: string;
  clientName: string;
  orderNumber: string;
  weddingDate: string;
  amount: string;
}): Promise<void> {
  await sendMail({
    to: data.to,
    subject: `Reminder Pelunasan Pembayaran — Order ${data.orderNumber}`,
    html: `
      <p>Halo <strong>${data.clientName}</strong>,</p>
      <p>Kami mengingatkan bahwa pembayaran pelunasan untuk order <strong>${data.orderNumber}</strong>
      (Acara: ${data.weddingDate}) belum kami terima.</p>
      <p>Nominal pelunasan: <strong>Rp ${data.amount}</strong></p>
      <p>Silakan login ke dashboard dan upload bukti transfer sesegera mungkin.</p>
      <p>Terima kasih.</p>
    `,
  });
}

export async function sendPaymentVerifiedEmail(data: {
  to: string;
  clientName: string;
  orderNumber: string;
  termType: "DP" | "Pelunasan";
}): Promise<void> {
  await sendMail({
    to: data.to,
    subject: `Pembayaran ${data.termType} Dikonfirmasi — Order ${data.orderNumber}`,
    html: `
      <p>Halo <strong>${data.clientName}</strong>,</p>
      <p>Pembayaran <strong>${data.termType}</strong> untuk order <strong>${data.orderNumber}</strong>
      telah kami verifikasi dan dikonfirmasi.</p>
      <p>Silakan cek dashboard Anda untuk melihat update terbaru.</p>
    `,
  });
}

export async function sendWelcomeEmail(data: {
  to: string;
  name: string;
}): Promise<void> {
  await sendMail({
    to: data.to,
    subject: "Selamat datang di Wedding Organizer Platform",
    html: `
      <p>Halo <strong>${data.name}</strong>,</p>
      <p>Akun Anda telah berhasil terdaftar. Silakan login dan mulai rencanakan hari spesial Anda!</p>
      <p>Kunjungi dashboard Anda di <a href="${env.frontendUrl}/dashboard">${env.frontendUrl}/dashboard</a></p>
    `,
  });
}
