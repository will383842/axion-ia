// Unified contact — Server Action (2026-05-24).
//
// Remplace 6 server actions distinctes (submitContactAction,
// subscribeNewsletterAction, submitAuditAction, submitAuditRequestAction,
// submitImplementationAction, submitQuoteRequestAction) par une seule qui
// dispatche sur `type`.
//
// Pattern hérité de submitContactAction (le plus mature) :
//   - rate-limit Redis 3/10min/IP
//   - honeypot (champ `website`)
//   - Cloudflare Turnstile verify
//   - Zod parse (discriminé par type)
//   - encryptPii sur PII (nom/email/téléphone)
//   - hashIp SHA-256 RGPD
//   - UTM funnel + referrerCity capture
//   - Submission.create (table polymorphe, type = `unified-{...}`)
//   - Telegram tag dispatch
//   - Email transactionnel (audit-confirmed | implementation-confirmed | contact-confirmed)
//   - Sentry captureException
//
// Voir _AUDIT/FORMS-UNIFICATION-2026-05-24/02-DESIGN.md §7.

"use server";

import { headers, cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { syncFormSubmissionToCrm } from "@/server/crm-sync";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { SubmissionType } from "../../../prisma/generated/client";
import {
  unifiedContactSchema,
  type UnifiedContactType,
} from "@/lib/schemas/unified-contact-schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { encryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { notify, type NotificationCategory } from "@/server/notifications";
import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { REFERRER_CITY_COOKIE_NAME } from "@/lib/pseo-referrer";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import { ENTITE_MESSAGE } from "@/lib/contact/accuse-attendu";
import { normaliserTelephone } from "@/lib/telephone";
import { isR2Configured } from "@/lib/r2-storage";
import {
  finaliserPiecesJointes,
  lireAnnoncePiecesJointes,
  ouvrirEnvoisPiecesJointes,
  type EnvoisOuverts,
  type IssuePiece,
} from "@/server/contact/pieces-jointes";
import {
  CLE_ACCUSE_DIFFERE,
  envoyerAccuseDiffere,
  payloadAccuseContact,
} from "@/server/contact/accuse-contact";

export type UnifiedContactState =
  | {
      ok: true;
      submissionId: string;
      /**
       * Pièces jointes (2026-10-15) : les URL d'envoi DIRECT vers R2, délivrées
       * seulement après la limite de fréquence, le leurre, Turnstile et
       * l'écriture de la demande. Le navigateur envoie, puis appelle
       * `finaliserPiecesJointesAction`.
       */
      envoiPieces?: EnvoisOuverts;
      /** Pièces annoncées pour lesquelles aucune URL n'a été délivrée. */
      piecesNonRecues?: number;
    }
  | { ok: false; error: string };

const CONSENT_VERSION = "v1-2026-05-24";

// ---- Dispatch helpers -----------------------------------------------------

/**
 * Mapping vers l'enum Prisma `SubmissionType` (fermé : audit | implementation |
 * intervention | contact | quote_request). Le type métier unifié réel reste
 * accessible via `details.unifiedType`.
 */
function submissionTypeFor(type: UnifiedContactType): SubmissionType {
  switch (type) {
    case "audit":
      return SubmissionType.audit;
    case "implementation":
      return SubmissionType.implementation;
    case "formation":
    case "un_a_un":
      return SubmissionType.intervention;
    case "devis":
      return SubmissionType.quote_request;
    // Form v2 (2026-05-28) — les 5 demandes périphériques sont stockées comme
    // `contact` au niveau DB (enum fermé), distinction fine via
    // `details.unifiedType` (audit trail) + dispatch downstream.
    case "partenariat":
    case "presse":
    case "recrutement":
    case "speaker":
    case "investisseur":
    case "support_client":
    case "autre":
      return SubmissionType.contact;
  }
}

function notifCategoryFor(type: UnifiedContactType): NotificationCategory {
  switch (type) {
    case "audit":
      return "AUDIT_REQUEST_SUBMITTED";
    case "implementation":
      return "IMPLEMENTATION_REQUEST_SUBMITTED";
    case "formation":
    case "un_a_un":
      return "INTERVENTION_REQUEST_SUBMITTED";
    case "devis":
      return "QUOTE_REQUEST_RECEIVED";
    // Form v2 — catégories dédiées pour routage Telegram fin
    case "presse":
      return "PRESS_REQUEST_SUBMITTED";
    case "recrutement":
      return "RECRUITMENT_RECEIVED";
    case "speaker":
      return "SPEAKER_INVITATION_RECEIVED";
    case "investisseur":
      return "INVESTOR_INQUIRY_RECEIVED";
    case "support_client":
      return "CUSTOMER_SUPPORT_REQUEST";
    case "partenariat":
    case "autre":
      return "CONTACT_FORM_SUBMITTED";
  }
}

// 🔑 Chaque gabarit rendu ici doit figurer dans `GABARITS_ACCUSE_MESSAGE`
// (`lib/contact/accuse-attendu.ts`), la liste où la console cherche l'accusé :
// un test lit ce `switch` et le vérifie, sinon la console afficherait « aucun
// accusé » sur un message bel et bien accusé.
function emailTemplateFor(type: UnifiedContactType): EmailJobName {
  switch (type) {
    case "audit":
      return "audit-confirmed";
    case "implementation":
      return "implementation-confirmed";
    // `quote-request-received` était écrit et déclaré depuis le sprint Booking,
    // mais appelé NULLE PART : les demandes de devis retombaient sur l'accusé
    // générique. Branché le 2026-08-13.
    case "devis":
      return "quote-request-received";
    // Les autres types gardent l'accusé générique. Le routage interne fin se
    // fait côté Telegram (catégories distinctes).
    case "formation":
    case "un_a_un":
    case "partenariat":
    case "presse":
    case "recrutement":
    case "speaker":
    case "investisseur":
    case "support_client":
    case "autre":
      return "contact-confirmed";
  }
}

// `hashIp` throw si IP_HASH_SALT absent en prod (doctrine RGPD). Ce wrapper
// garantit qu'un souci de config env ne fasse JAMAIS échouer la capture d'un
// lead : en cas d'échec on logge et on stocke `null` (le hash IP est une
// donnée secondaire, la capture du contact prime). Décision Will 2026-07-01.
function safeHashIp(ip: string | null | undefined): string | null {
  try {
    return hashIp(ip);
  } catch (err) {
    console.error("[unified-contact] hashIp a échoué (IP_HASH_SALT ?):", err);
    return null;
  }
}

// ---- Server action --------------------------------------------------------

export async function submitUnifiedContactAction(
  _prev: UnifiedContactState,
  formData: FormData,
): Promise<UnifiedContactState> {
  const ip = await getClientIp();

  // 1. Rate-limit
  const rl = await checkRateLimit(`unified-contact:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  }

  // 2. Honeypot — bot silent success
  const leurre = formData.get("website");
  if (leurre) {
    await signalerHoneypot("contact", leurre);
    return { ok: true, submissionId: "" };
  }

  // 3. Cloudflare Turnstile — SOFT-FAIL (décision Will 2026-07-01 : zéro
  // friction client, ne JAMAIS perdre un lead). On vérifie le token pour le
  // monitoring mais on NE BLOQUE PLUS si le challenge échoue (réseau
  // restrictif / extension / DNS filtrant challenges.cloudflare.com). Les
  // couches DURES restent le honeypot (ci-dessus) + le rate-limit (3/10min/IP).
  // Le résultat est journalisé dans `details.turnstilePassed` pour audit.
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  const turnstilePassed = await verifyTurnstile(turnstileToken, ip).catch(() => false);

  // 4. Zod parse
  const parsed = unifiedContactSchema.safeParse({
    type: formData.get("type"),
    nom: formData.get("nom"),
    email: formData.get("email"),
    telephone: formData.get("telephone"),
    ville: formData.get("ville"),
    message: formData.get("message"),
    companyName: formData.get("companyName") || undefined,
    companySize: formData.get("companySize") || undefined,
    companySector: formData.get("companySector") || undefined,
    budgetIndicative: formData.get("budgetIndicative") || undefined,
    timingWeeks: formData.get("timingWeeks") || undefined,
    locale: formData.get("locale") || "fr",
    source: formData.get("source") || undefined,
    subType: formData.get("subType") || undefined,
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides." };
  }
  const data = parsed.data;

  // 4 bis. Pièces jointes (2026-10-15) — le formulaire n'envoie que leur
  // ANNONCE (nom, taille) : les fichiers partiront du navigateur vers R2, sur des
  // URL délivrées plus bas. 🔑 Aucune URL sans Turnstile validé (le leurre et la
  // limite de fréquence sont déjà passés), ni sans annonce conforme, ni sans
  // stockage : la demande est enregistrée QUAND MÊME, ses pièces « non reçues ».
  // Sans fichier, rien ne change.
  const annonce = lireAnnoncePiecesJointes(formData);
  const envoisPossibles = annonce.pieces.length > 0 && turnstilePassed && isR2Configured();
  const motifSansEnvoi =
    annonce.nombre === 0 || envoisPossibles
      ? null
      : annonce.refus
        ? "annonce"
        : !turnstilePassed
          ? "turnstile"
          : "stockage";

  // 🔑 UNE SEULE FORME RANGÉE, pour les TROIS destinations de ce champ :
  //    la base (chiffrée), le CRM et la notification Telegram. Depuis que le
  //    formulaire accepte `06 12 34 56 78`, normaliser ici est ce qui évite
  //    que la même personne porte deux numéros différents selon l'écran qui
  //    la regarde — et que Will compose un national depuis l'étranger.
  const telephone = data.telephone ? normaliserTelephone(data.telephone) : null;
  const locale = parseLocale(data.locale);

  // 5. UTM funnel + referrerCity
  const c = await cookies();
  const utm = readUtmCookie(c.get(UTM_COOKIE_NAME)?.value);
  const refCity = c.get(REFERRER_CITY_COOKIE_NAME)?.value;
  const funnel: { utm?: typeof utm; referrerCity?: string } = {};
  if (Object.keys(utm).length > 0) funnel.utm = utm;
  if (refCity && refCity.length > 0 && refCity.length <= 120) funnel.referrerCity = refCity;

  const userAgent = (await headers()).get("user-agent") ?? null;

  // 6. Persist Submission (table polymorphe)
  try {
    const submission = await prisma.submission.create({
      data: {
        type: submissionTypeFor(data.type),
        locale,
        companyName: data.companyName ?? "—",
        contactName: encryptPii(data.nom),
        contactEmail: encryptPii(data.email),
        contactEmailHash: hashEmailForLookup(data.email),
        contactPhone: telephone === null ? null : encryptPii(telephone),
        sector: data.companySector ?? null,
        employeesCount: data.companySize ?? null,
        details: {
          unifiedType: data.type,
          subType: data.subType,
          ville: data.ville,
          message: data.message,
          budgetIndicative: data.budgetIndicative,
          timingWeeks: data.timingWeeks,
          source: data.source,
          consentVersion: CONSENT_VERSION,
          // Turnstile soft-fail : trace si le captcha n'a pas validé (audit abus).
          ...(turnstilePassed ? {} : { turnstilePassed: false }),
          // Pièces jointes (2026-10-15) : combien annoncées ; si aucune URL n'a été
          // délivrée, pourquoi (la console dit « pièces non reçues ») ; et, quand
          // elles vont arriver, le gabarit de l'accusé qui les attendra.
          ...(annonce.nombre > 0 ? { piecesJointesAnnoncees: annonce.nombre } : {}),
          ...(motifSansEnvoi ? { piecesJointesNonRecues: motifSansEnvoi } : {}),
          ...(envoisPossibles ? { [CLE_ACCUSE_DIFFERE]: emailTemplateFor(data.type) } : {}),
          ...(Object.keys(funnel).length > 0 ? { funnel: funnel as unknown as object } : {}),
        } as object,
        ipAddress: ip,
        // hashIp défensif : ne doit JAMAIS faire échouer la capture du lead
        // (throw si IP_HASH_SALT absent). En cas d'échec → null + log.
        ipHash: safeHashIp(ip),
        userAgent,
      },
    });

    // 6bis. Synchro CRM (lot L2) — outbox locale, best-effort, JAMAIS bloquante.
    // Aucun try/catch ici : `syncFormSubmissionToCrm` ne lève pas, et ne fait
    // rien du tout tant que `CRM_SYNC_ENABLED` n'est pas à "true".
    await syncFormSubmissionToCrm({
      subjectRef: `site:submission:${submission.id}`,
      formType: data.type,
      occurredAt: submission.submittedAt,
      person: {
        email: data.email,
        fullName: data.nom,
        phone: telephone,
      },
      company: {
        name: data.companyName ?? null,
        city: data.ville ?? null,
        sizeCategory: data.companySize ?? null,
        sector: data.companySector ?? null,
      },
      consent: {
        version: CONSENT_VERSION,
        at: submission.submittedAt,
        textRef: "unified-contact-form",
      },
      payload: {
        ...(data.subType ? { subType: data.subType } : {}),
        ...(data.source ? { source: data.source } : {}),
        ...(Object.keys(funnel).length > 0 ? { funnel } : {}),
      },
    });

    // 6 bis. REGISTRE DE PREUVE (lot L4) — best-effort, jamais bloquant. La
    // version vivait jusqu'ici dans `details.consentVersion`, un JSON : lisible
    // à l'unité, inexploitable pour répondre « prouvez le consentement de cette
    // personne ». Elle est désormais AUSSI dans un registre indexé par personne.
    await recordConsentEvent({
      email: data.email,
      formRef: CONSENT_FORM_REFS.unifiedContact,
      consentVersion: CONSENT_VERSION,
      action: "optin",
      occurredAt: submission.submittedAt,
      ip,
      userAgent,
    });

    // 6 ter. Pièces jointes — les URL d'envoi, APRÈS la demande, jamais
    // bloquant : la demande est en base quoi qu'il arrive au stockage
    // (cf. `server/contact/pieces-jointes.ts`).
    let envoiPieces: EnvoisOuverts | null = null;
    if (envoisPossibles) {
      try {
        envoiPieces = await ouvrirEnvoisPiecesJointes(submission.id, annonce.pieces);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { action: "submitUnifiedContactAction", step: "pieces-jointes", type: data.type },
        });
      }
    }
    const piecesNonRecues = envoiPieces ? 0 : annonce.nombre;

    // 7. Telegram notification — via hub typé (cf. ADR 0027).
    // dedupKey = submission.id pour neutraliser un éventuel double-submit
    // qui passerait au niveau DB (improbable car idempotencyKey, mais
    // defense-in-depth).
    const category = notifCategoryFor(data.type);
    const notifPayload = {
      submissionId: submission.id,
      contactName: data.nom,
      contactEmail: data.email,
      ...(telephone ? { contactPhone: telephone } : {}),
      // Le contenu du message part dans la notif (demande Will 2026-08-12) —
      // tronqué : Telegram plafonne à 4096 c. et l'écran verrouillé n'en montre
      // que quelques lignes de toute façon.
      ...(data.message ? { message: data.message.slice(0, 500) } : {}),
      ...(data.ville ? { ville: data.ville } : {}),
      ...(data.companyName ? { companyName: data.companyName } : {}),
      ...(data.companySize ? { companySize: data.companySize } : {}),
      ...(data.budgetIndicative ? { budgetIndicative: data.budgetIndicative } : {}),
      ...(data.timingWeeks ? { timingWeeks: data.timingWeeks } : {}),
      ...(data.subType ? { subType: data.subType } : {}),
      ...(data.source ? { source: data.source } : {}),
      ...(category === "CONTACT_FORM_SUBMITTED" ? { formType: data.type } : {}),
      ...(category === "QUOTE_REQUEST_RECEIVED" && data.budgetIndicative
        ? { budget: data.budgetIndicative }
        : {}),
      locale,
      // Pièces jointes ANNONCÉES (2026-10-15) : le nombre seulement (règle du
      // 11/10/2026). L'alerte part tout de suite : elle n'attend pas les fichiers.
      ...(annonce.nombre > 0 ? { piecesJointes: annonce.nombre } : {}),
    };
    // 7 & 8 = BEST-EFFORT : la notif Telegram et l'email de confirmation NE
    // DOIVENT PAS faire échouer la soumission (le lead est déjà en base). Un
    // échec (Redis/BullMQ/Telegram down) est loggé mais l'utilisateur voit
    // « Succès ». Décision Will 2026-07-01 (robustesse / zéro perte de lead).
    try {
      await notify({
        category,
        payload: notifPayload,
        dedupKey: submission.id,
      } as Parameters<typeof notify>[0]);
    } catch (notifErr) {
      console.error("[unified-contact] notify best-effort a échoué:", notifErr);
      Sentry.captureException(notifErr, {
        tags: { action: "submitUnifiedContactAction", step: "notify", type: data.type },
      });
    }

    // Des fichiers vont arriver : l'accusé les attend (il dira combien sont
    // reçus) — cf. `server/contact/accuse-contact.ts`. Sinon, il part maintenant.
    try {
      if (!envoiPieces) {
        await enqueueEmail(
          emailTemplateFor(data.type),
          data.email,
          locale,
          payloadAccuseContact({
            nom: data.nom,
            submissionId: submission.id,
            companyName: data.companyName,
            type: data.type,
            subType: data.subType,
            size: data.companySize,
            industry: data.companySector,
          }),
          // 🔑 L'entité liée (2026-09-18) : la fiche du message dit alors EXACTEMENT
          // si l'accusé est parti — cf. `admin-submissions/accuse-reception.ts`.
          { entityType: ENTITE_MESSAGE, entityId: submission.id },
        );
      }
    } catch (mailErr) {
      console.error("[unified-contact] enqueueEmail best-effort a échoué:", mailErr);
      Sentry.captureException(mailErr, {
        tags: { action: "submitUnifiedContactAction", step: "email", type: data.type },
      });
    }

    return {
      ok: true,
      submissionId: submission.id,
      ...(envoiPieces ? { envoiPieces } : {}),
      ...(piecesNonRecues > 0 ? { piecesNonRecues } : {}),
    };
  } catch (err) {
    // Seul un échec de l'écriture DB (capture du lead) arrive ici = vraie erreur.
    // On logge le message RÉEL (visible dans les logs Coolify) pour diagnostic.
    console.error("[unified-contact] échec persistance Submission:", err);
    Sentry.captureException(err, {
      tags: { action: "submitUnifiedContactAction", step: "persist", type: data.type, locale },
    });
    return {
      ok: false,
      error: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",
    };
  }
}

// ---- Fin d'envoi des pièces jointes (2026-10-15) ----------------------------

export type FinPiecesJointesState = { ok: true; pieces: ReadonlyArray<IssuePiece> } | { ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JETON = /^[A-Za-z0-9_-]{43}$/;

/**
 * Le navigateur a fini d'envoyer (ou d'échouer à envoyer) ses fichiers : le
 * serveur les contrôle, les range, puis fait partir l'accusé de réception
 * différé. Rien ne se passe sans le JETON rendu avec les URL : un identifiant
 * de demande seul ne suffit pas. Ne lève jamais — au pire, « pièces non reçues ».
 */
export async function finaliserPiecesJointesAction(
  submissionId: string,
  jeton: string,
): Promise<FinPiecesJointesState> {
  if (typeof submissionId !== "string" || !UUID.test(submissionId)) return { ok: false };
  if (typeof jeton !== "string" || !JETON.test(jeton)) return { ok: false };
  const ip = await getClientIp();
  const rl = await checkRateLimit(`unified-contact-pieces:${ip}`, { limit: 10, windowSec: 600 });
  if (!rl.allowed) return { ok: false };
  try {
    const bilan = await finaliserPiecesJointes(submissionId, jeton);
    if (bilan.controlees) {
      try {
        await envoyerAccuseDiffere(submissionId);
      } catch (mailErr) {
        Sentry.captureException(mailErr, {
          tags: { action: "finaliserPiecesJointesAction", step: "email" },
        });
      }
    }
    return { ok: true, pieces: bilan.pieces };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "finaliserPiecesJointesAction", step: "pieces-jointes" },
    });
    return { ok: false };
  }
}
