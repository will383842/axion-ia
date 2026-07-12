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
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 2525);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const hasAuth = Boolean(user && pass);

  _transport = nodemailer.createTransport({
    host,
    port,
    // Deux modes selon la présence d'identifiants :
    //  - SMTP authentifié (Zoho, SES, Brevo…) : TLS + auth. Port 465 = SMTPS
    //    implicite ; 587/25 = STARTTLS (requireTLS). NÉCESSAIRE pour un relais
    //    externe (sinon connexion rejetée / non chiffrée).
    //  - Relais local sans auth (PowerMTA/Mailhog sur localhost) : ni TLS ni
    //    auth — comportement legacy conservé quand SMTP_USER/PASS absents.
    secure: port === 465,
    ...(hasAuth
      ? { auth: { user: user as string, pass: pass as string }, requireTLS: port !== 465 }
      : { ignoreTLS: true }),
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
  /**
   * P0 RGPD-3 fix audit final 2026-05-09 — token unsubscribe RFC 8058.
   * Si fourni, on ajoute les headers `List-Unsubscribe` + `List-Unsubscribe-Post`
   * exigés par Gmail/Yahoo Sender Requirements 2024 + Apple Mail / Outlook.
   * Sans ces headers : le bouton natif "Désabonner" du client mail n'apparaît
   * pas → risque classement spam + non-conformité Gmail bulk sender.
   */
  unsubscribeToken?: string;
  /**
   * Pièces jointes (facturation unifiée 2026-07 — envoi manuel devis/facture
   * avec le PDF joint). Passées telles quelles à nodemailer (`attachments`).
   * Le contenu est un Buffer (PDF téléchargé depuis R2) ou une string.
   */
  attachments?: ReadonlyArray<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
  const t = getTransport();

  // RFC 8058 — List-Unsubscribe (mandatory bulk senders 2024+).
  // Format : `<https://...>` (URL one-click) + optionnel `<mailto:...>`.
  const headers: Record<string, string> = {};
  if (params.unsubscribeToken) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
    const url = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(params.unsubscribeToken)}`;
    headers["List-Unsubscribe"] = `<${url}>, <mailto:unsubscribe@axion-ia.com>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const info = await t.sendMail({
    from: `"${FROM_NAME}" <${params.marketing ? FROM_MARKETING : FROM_ADDRESS}>`,
    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
    subject: params.subject,
    html: params.html,
    text: params.text ?? stripHtml(params.html),
    replyTo: params.replyTo,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    // Pièces jointes (envoi manuel devis/facture) — copie mutable pour nodemailer.
    ...(params.attachments && params.attachments.length > 0
      ? {
          attachments: params.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            ...(a.contentType ? { contentType: a.contentType } : {}),
          })),
        }
      : {}),
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
