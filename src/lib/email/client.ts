// Nodemailer wrapper (Sprint 15 / M8).
//
// Architecture transport — état relevé DANS Coolify le 2026-08-16 :
//   dev   : Nodemailer → SMTP localhost:2525 → Mailhog UI 8025
//   prod  : Nodemailer → SMTP **ZeptoMail** (`smtp.zeptomail.eu:587`, STARTTLS,
//           utilisateur littéral `emailapikey` + jeton « Send Mail »), via
//           `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`.
//
// 🔴 CES VARIABLES VIVENT SUR L'APP COOLIFY `axion-ia-worker`, pas sur l'app
// web. Le worker BullMQ est une SECONDE application Coolify, avec son propre
// environnement, et c'est lui seul qui appelle `sendEmail()` — le conteneur web
// ne fait qu'enfiler. Le 2026-08-16, la bascule vers ZeptoMail a été faite sur
// l'app web, vérifiée, redéployée et déclarée terminée : elle n'avait AUCUN
// effet, le worker envoyait toujours par Zoho. Preuve à chercher dans les logs
// DU WORKER : `[email-worker] relais SMTP joignable et authentifié ✓`.
//
// ⚠️ Cet en-tête a menti deux fois, et c'est instructif :
//   - jusqu'au 2026-08-16 : « localhost:2525 → PowerMTA → IP dédiée Hetzner ».
//     PowerMTA n'a jamais été déployé.
//   - le 2026-08-16 au matin : « smtppro.zoho.eu:465 », écrit d'après la page
//     de configuration du panneau Zoho — alors que la valeur RÉELLEMENT en
//     service était `smtp.zoho.eu`. Documenter d'après le fournisseur plutôt
//     que d'après la production produit une fiction crédible.
//
// Zoho Mail reste en service comme BOÎTE humaine (contact@axion-ia.com, plan
// payant Mail Lite, IMAP `imappro.zoho.eu:993`). ZeptoMail est envoi-seul : il
// s'ajoute à Zoho, il ne le remplace pas.
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

/**
 * 🔴 Audit du 2026-08-16 — LE REPLI SILENCIEUX.
 *
 * `getTransport()` basculait de comportement sur la seule PRÉSENCE de
 * `SMTP_USER` / `SMTP_PASS` : présents → Zoho authentifié et chiffré ; absents →
 * `localhost:2525` avec `ignoreTLS: true`. Ces deux variables n'étaient
 * déclarées NI dans `src/env.ts` (donc hors validation Zod) NI dans
 * `.env.example`. Un secret perdu lors d'une reconfiguration Coolify, ou
 * simplement mal orthographié, ne faisait donc pas échouer le démarrage : il
 * faisait retomber la PRODUCTION sur un relais local inexistant, en clair.
 *
 * On refuse désormais ce repli en production. Le choix de lever ICI plutôt que
 * d'exiger les variables dans `env.ts` est délibéré : une exigence au niveau de
 * l'env ferait échouer le BOOT du conteneur si jamais les variables portaient
 * un autre nom côté Coolify — on transformerait un défaut d'e-mail en panne de
 * site. Lever ici fait échouer les ENVOIS, bruyamment, avec un message explicite
 * consigné dans `email_logs` — et le reste de l'application continue de tourner.
 */
function assertTransportUtilisable(hasAuth: boolean, host: string, port: number): void {
  if (hasAuth) return;
  if (process.env.NODE_ENV !== "production") return;
  throw new Error(
    `[email] configuration SMTP incomplète en production : SMTP_USER et/ou SMTP_PASS absents, ` +
      `le transport retomberait sur ${host}:${port} SANS authentification ni chiffrement. ` +
      `Envoi refusé plutôt que dégradé en silence — poser les deux variables dans Coolify (scope RUN).`,
  );
}

function getTransport(): Transporter {
  if (_transport) return _transport;
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 2525);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const hasAuth = Boolean(user && pass);

  assertTransportUtilisable(hasAuth, host, port);

  _transport = nodemailer.createTransport({
    host,
    port,
    // Deux modes selon la présence d'identifiants :
    //  - SMTP authentifié (Zoho, SES, Brevo…) : TLS + auth. Port 465 = SMTPS
    //    implicite ; 587/25 = STARTTLS (requireTLS). NÉCESSAIRE pour un relais
    //    externe (sinon connexion rejetée / non chiffrée).
    //  - Relais local sans auth (Mailhog sur localhost) : ni TLS ni auth —
    //    comportement legacy conservé quand SMTP_USER/PASS absents.
    secure: port === 465,
    ...(hasAuth
      ? { auth: { user: user as string, pass: pass as string }, requireTLS: port !== 465 }
      : { ignoreTLS: true }),

    // 🔴 Audit du 2026-08-16 (F-01) — CONNEXIONS MISES EN POOL.
    //
    // Sans `pool`, nodemailer ouvre une connexion SMTP NEUVE, s'authentifie et
    // la referme À CHAQUE MESSAGE. Croisé avec la `concurrency: 8` d'alors, un
    // lot dense se présentait comme huit ouvertures et huit authentifications
    // simultanées, répétées — le profil qu'un relais lit comme une attaque, et
    // que Zoho sanctionne en abaissant une borne déjà dynamique.
    //
    // 2 connexions, alignées sur la `concurrency: 2` du worker : au-delà, un
    // consommateur attendrait une connexion libre sans rien gagner.
    pool: true,
    maxConnections: 2,
    // Recyclage après 100 messages. Les relais coupent d'eux-mêmes une session
    // trop longue ; reprendre la main dessus évite de découvrir la coupure sous
    // la forme d'un envoi perdu.
    maxMessages: 100,

    // Soupape de sûreté SOUS le limiteur BullMQ (40/h) : 2 messages par
    // seconde. Elle ne mord jamais en fonctionnement normal — elle existe pour
    // le jour où un appelant contournera `enqueueEmail()` et enverra en direct.
    // Ce chemin existe déjà : `content-weekly-report-worker.ts` appelle
    // `sendEmail()` sans passer par la file (contournement connu du 13/08).
    rateDelta: 1000,
    rateLimit: 2,
  });
  return _transport;
}

/**
 * Vérifie que le relais SMTP est joignable ET que l'authentification passe.
 *
 * Personne ne le faisait : aucun `verify()` nulle part dans le dépôt. La
 * première preuve qu'un identifiant Zoho avait expiré était donc un e-mail non
 * reçu par un stagiaire — constat a posteriori, sans horodatage exploitable.
 *
 * Appelé une fois au démarrage du worker. NE LÈVE PAS : un relais injoignable
 * ne doit pas empêcher les quarante autres workers de démarrer. Retourne le
 * verdict, à charge de l'appelant de crier.
 */
export async function verifyTransport(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getTransport().verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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
