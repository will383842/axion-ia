// Nodemailer wrapper (Sprint 15 / M8).
//
// Architecture transport (CLAUDE.md v6 §11) :
//   dev   : Nodemailer → SMTP localhost:2525 → Mailhog UI 8025
//   prod  : Nodemailer → SMTP localhost:2525 → PowerMTA → IP dediee Hetzner
//
// Pas de Resend / SendGrid / Mailgun / Brevo (interdits par doctrine).
//
// Pattern d'usage :
//   await sendEmail({
//     to: "user@example.com",
//     subject: "Confirmation",
//     html: "<p>Hello</p>",
//     text: "Hello",
//   });
//
// En production, prefer enqueue via BullMQ (Sprint 15 step 4) plutot que
// d'appeler sendEmail directement depuis un Server Action — l'envoi sync
// peut depasser le timeout de la requete et bloquer l'UX.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Sprint 15 fix Fork 3 W7-3 : protection injection CRLF dans From header.
// SMTP_FROM_NAME peut etre alimente via env compromise → strip caracteres
// dangereux (CR, LF, double-quote, less/greater-than).
function sanitizeFromName(raw: string): string {
  return (
    raw
      .replace(/[\r\n"<>]/g, "")
      .trim()
      .slice(0, 80) || "Axion-IA"
  );
}

const FROM_ADDRESS = process.env.SMTP_FROM_ADDRESS ?? "noreply@axion-ia.com";
const FROM_NAME = sanitizeFromName(process.env.SMTP_FROM_NAME ?? "Axion-IA");
const FROM_MARKETING = process.env.SMTP_FROM_MARKETING ?? "news@axion-ia.com";

let _transport: Transporter | null = null;

function getTransport(): Transporter {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 2525),
    // Mailhog/PowerMTA local : pas de TLS ni d'auth.
    secure: false,
    ignoreTLS: true,
  });
  return _transport;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Newsletter expediteur (`news@`) au lieu de transactionnel (`noreply@`). */
  marketing?: boolean;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
  const t = getTransport();
  const info = await t.sendMail({
    from: `"${FROM_NAME}" <${params.marketing ? FROM_MARKETING : FROM_ADDRESS}>`,
    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
    subject: params.subject,
    html: params.html,
    text: params.text ?? stripHtml(params.html),
    replyTo: params.replyTo,
  });
  return { messageId: info.messageId };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
