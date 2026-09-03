// Premier contact d'un apporteur d'affaires — Server Action du formulaire
// COURT de la landing Facebook (`/facebook`, 2026-09-03).
//
// Calquée sur `submitCommercialApplicationAction` (le dossier complet), avec
// la même doctrine :
//   - rate-limit Redis par IP (large) puis par ADRESSE (serré)
//   - honeypot (`website`) — pas de captcha, anti-spam invisible uniquement
//   - Zod parse (schéma partagé `lib/commercial-application/lead-apporteur.ts`)
//   - encryptPii sur nom/email/téléphone, hashIp SHA-256 RGPD
//   - Submission.create AVANT toute notification (`unifiedType: "recrutement"`,
//     `subType: "candidature-commerciale"` → même file console que le dossier ;
//     `etape: "premier-contact"` la distingue)
//   - PUIS les notifications, toutes best-effort : Telegram+WhatsApp, e-mail
//     candidat, récap interne, relances J+2/J+7, API Conversions Meta.
//
// ── Ce qui diffère du dossier complet, et pourquoi ──────────────────────────
//   - AUCUN score : un premier contact n'a rien à noter. La console l'affiche
//     « à qualifier », c'est l'appel qui qualifie.
//   - Source posée AUTOMATIQUEMENT (`sourceConnaissance: "facebook"`) : le
//     visiteur ne se voit pas poser la question, la page le sait.
//   - PAS de synchro CRM à cette étape : le CRM refuse en 422 toute version de
//     consentement qu'il ne connaît pas, et celle du formulaire court lui est
//     inconnue. Le dossier complet, lui, part au CRM comme avant. ⛔ Reste
//     Will : déclarer `LEAD_APPORTEUR_CONSENT_VERSION` côté CRM si l'on veut
//     aussi y voir les premiers contacts.
//   - Envoi serveur de l'événement `Lead` à Meta, SEULEMENT si le visiteur a
//     accepté la bannière (cf. `server/meta/conversions-api.ts`).

"use server";

import { headers, cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { destinataireCandidatures } from "@/lib/destinataires-internes";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { SubmissionType } from "../../../prisma/generated/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { encryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { notify } from "@/server/notifications";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { parseUtmFromUrl, readUtmCookie, UTM_COOKIE_NAME, type UtmParams } from "@/lib/utm";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/site-url";
import { env } from "@/env";
import {
  CANDIDATURE_COMMERCIALE_SUBTYPE,
  STATUT_OPTIONS,
  optionLabel,
} from "@/lib/commercial-application/model";
import {
  DOSSIER_COMPLET_PATH,
  LEAD_APPORTEUR_CONSENT_VERSION,
  LEAD_APPORTEUR_ETAPE,
  LEAD_APPORTEUR_SOURCE,
  TUNNEL_FACEBOOK_PATH,
  extraireFbclid,
  leadApporteurSchema,
} from "@/lib/commercial-application/lead-apporteur";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import { envoyerLeadMeta } from "@/server/meta/conversions-api";
import { planifierRelancesLeadApporteur } from "./relances-lead-apporteur";

export type LeadApporteurState = { ok: true; submissionId: string } | { ok: false; error: string };

function safeHashIp(ip: string | null | undefined): string | null {
  try {
    return hashIp(ip);
  } catch (err) {
    console.error("[lead-apporteur] hashIp a échoué (IP_HASH_SALT ?):", err);
    return null;
  }
}

/**
 * Fusion des UTM : le cookie posé par le proxy à l'arrivée (30 j) prime, la
 * requête postée par le navigateur complète. Le cookie est ce que le LIEN
 * prouve ; la requête n'est qu'un repli si l'arrivée s'est faite sans passer
 * par le proxy (aperçu, cache) — et elle est assainie par le même parseur.
 */
function fusionnerUtm(cookie: UtmParams, query: string | undefined): UtmParams {
  const depuisQuery = query ? parseUtmFromUrl(query) : {};
  return { ...depuisQuery, ...cookie };
}

export async function submitLeadApporteurAction(
  _prev: LeadApporteurState,
  formData: FormData,
): Promise<LeadApporteurState> {
  const ip = await getClientIp();

  // 1. Anti-martèlement par IP — large, consommé AVANT le parsing (une faute de
  // frappe corrigée trois fois ne doit pas verrouiller la personne).
  const rl = await checkRateLimit(`lead-apporteur:${ip}`, { limit: 20, windowSec: 600 });
  if (!rl.allowed) {
    return {
      ok: false,
      error:
        "Trop d'essais depuis cette connexion. Patiente quelques minutes — ou écris-nous à contact@axion-ia.com.",
    };
  }

  // 2. Honeypot — succès silencieux pour le robot.
  const leurre = formData.get("website");
  if (leurre) {
    signalerHoneypot("lead-apporteur-facebook", leurre);
    return { ok: true, submissionId: "" };
  }

  // 3. Parse.
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Champs invalides." };
  }
  const parsed = leadApporteurSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides — vérifie tes réponses." };
  }
  const d = parsed.data;
  const locale = parseLocale(formData.get("locale") ?? "fr");

  // 3 bis. Second compteur, par ADRESSE (clé = hash, jamais l'adresse).
  const emailKey = hashEmailForLookup(d.email);
  if (emailKey) {
    const rlEmail = await checkRateLimit(`lead-apporteur:email:${emailKey}`, {
      limit: 3,
      windowSec: 86_400,
    });
    if (!rlEmail.allowed) {
      return {
        ok: false,
        error:
          "On a déjà bien reçu ta demande avec cet email — inutile de la renvoyer, on t'appelle.",
      };
    }
  }

  // 4. Attribution : cookie UTM du proxy + requête d'arrivée + fbclid.
  const c = await cookies();
  const utm = fusionnerUtm(readUtmCookie(c.get(UTM_COOKIE_NAME)?.value), d.contexte?.query);
  const fbclid = extraireFbclid(d.contexte?.query);
  const funnel: { utm?: UtmParams; fbclid?: true; referrer?: string } = {};
  if (Object.keys(utm).length > 0) funnel.utm = utm;
  if (fbclid) funnel.fbclid = true;
  const referrer = d.contexte?.referrer?.trim();
  if (referrer) funnel.referrer = referrer.slice(0, 300);

  const userAgent = (await headers()).get("user-agent") ?? null;

  // 5. Persist — AVANT toute notification.
  try {
    const submission = await prisma.submission.create({
      data: {
        type: SubmissionType.contact,
        locale,
        companyName: "—",
        contactName: encryptPii(d.prenom),
        contactEmail: encryptPii(d.email),
        contactPhone: encryptPii(d.telephone) ?? null,
        details: {
          // Clé du filtre de la vue console Contacts → Commercial. NE PAS renommer.
          unifiedType: "recrutement",
          subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
          // Distingue le premier contact du dossier complet dans la même file.
          etape: LEAD_APPORTEUR_ETAPE,
          ville: d.ville,
          message:
            "Premier contact depuis la landing Facebook — à rappeler. Le dossier complet arrive par le lien de l'e-mail.",
          source: TUNNEL_FACEBOOK_PATH,
          consentVersion: LEAD_APPORTEUR_CONSENT_VERSION,
          ...(Object.keys(funnel).length > 0 ? { funnel: funnel as unknown as object } : {}),
          // Même bloc que le dossier complet, réduit à ce qui a été demandé :
          // la vue console `CandidatureCommercialeDetail` tolère l'absence
          // des sections (expériences vides, pas de pitch, pas de score).
          candidature: {
            version: 2,
            etape: LEAD_APPORTEUR_ETAPE,
            ville: d.ville,
            experiences: [],
            ...(d.statut ? { statut: d.statut } : {}),
            sourceConnaissance: LEAD_APPORTEUR_SOURCE,
          },
        } as object,
        ipAddress: ip,
        ipHash: safeHashIp(ip),
        userAgent,
      },
    });

    // Registre de preuve du consentement — best-effort.
    await recordConsentEvent({
      email: d.email,
      formRef: CONSENT_FORM_REFS.leadApporteur,
      consentVersion: LEAD_APPORTEUR_CONSENT_VERSION,
      action: "optin",
      occurredAt: submission.submittedAt,
      ip,
      userAgent,
    });

    const dossierUrl = `${SITE_URL}/${locale}${DOSSIER_COMPLET_PATH}`;
    const creneauUrl = env.NEXT_PUBLIC_CALENDLY_APPORTEUR_URL;

    // 6. Telegram + WhatsApp — best-effort.
    try {
      await notify({
        category: "COMMERCIAL_APPLICATION_RECEIVED",
        payload: {
          submissionId: submission.id,
          contactName: d.prenom,
          contactEmail: d.email,
          contactPhone: d.telephone,
          ville: d.ville,
          zone: "—",
          b2bYears: "à qualifier (premier contact Facebook)",
          availability: d.statut ? optionLabel(STATUT_OPTIONS, d.statut) : "—",
          usesAi: false,
          locale,
        },
        dedupKey: submission.id,
      });
    } catch (notifErr) {
      console.error("[lead-apporteur] notify best-effort a échoué:", notifErr);
      Sentry.captureException(notifErr, {
        tags: { action: "submitLeadApporteurAction", step: "notify" },
      });
    }

    // 7. E-mail au candidat — best-effort.
    try {
      await enqueueEmail("lead-apporteur-recu", d.email, locale, {
        contactName: d.prenom,
        submissionId: submission.id,
        dossierUrl,
        ...(creneauUrl ? { creneauUrl } : {}),
      });
    } catch (mailErr) {
      console.error("[lead-apporteur] email candidat a échoué:", mailErr);
      Sentry.captureException(mailErr, {
        tags: { action: "submitLeadApporteurAction", step: "email-candidat" },
      });
    }

    // 8. Récap interne — même gabarit que le dossier complet, lignes réduites.
    try {
      await enqueueEmail("candidature-commercial-recap", destinataireCandidatures(), "fr", {
        prenom: d.prenom,
        nom: "",
        ville: d.ville,
        rows: [
          { label: "Étape", value: "Premier contact — landing Facebook (dossier complet à venir)" },
          { label: "Prénom", value: d.prenom },
          { label: "Email", value: d.email },
          { label: "Téléphone", value: d.telephone },
          { label: "Ville", value: d.ville },
          ...(d.statut
            ? [{ label: "Statut actuel", value: optionLabel(STATUT_OPTIONS, d.statut) }]
            : []),
          ...(funnel.utm
            ? [
                {
                  label: "Campagne",
                  value: [funnel.utm.utm_campaign, funnel.utm.utm_content]
                    .filter(Boolean)
                    .join(" · "),
                },
              ]
            : []),
        ],
        experiences: [],
        pitch: "",
        submissionId: submission.id,
        consoleUrl: `${SITE_URL}${adminPath("fr", "contacts/commercial")}/${submission.id}`,
      });
    } catch (recapErr) {
      console.error("[lead-apporteur] récap interne a échoué:", recapErr);
      Sentry.captureException(recapErr, {
        tags: { action: "submitLeadApporteurAction", step: "email-recap" },
      });
    }

    // 9. Relances J+2 / J+7 « ton dossier t'attend » — best-effort.
    try {
      await planifierRelancesLeadApporteur({
        email: d.email,
        prenom: d.prenom,
        dossierUrl,
        creneauUrl,
        submissionId: submission.id,
      });
    } catch (relErr) {
      console.error("[lead-apporteur] relances non planifiées:", relErr);
      Sentry.captureException(relErr, {
        tags: { action: "submitLeadApporteurAction", step: "relances" },
      });
    }

    // 10. API Conversions Meta — best-effort, et SEULEMENT avec consentement.
    await envoyerLeadMeta(
      {
        submissionId: submission.id,
        email: d.email,
        telephone: d.telephone,
        prenom: d.prenom,
        ville: d.ville,
        ip,
        userAgent,
        fbp: d.contexte?.fbp ?? null,
        fbclid,
        sourceUrl: `${SITE_URL}/${locale}${TUNNEL_FACEBOOK_PATH}`,
        at: submission.submittedAt,
      },
      { consentPub: d.contexte?.consentPub },
    );

    return { ok: true, submissionId: submission.id };
  } catch (err) {
    console.error("[lead-apporteur] échec persistance Submission:", err);
    Sentry.captureException(err, {
      tags: { action: "submitLeadApporteurAction", step: "persist", locale },
    });
    return {
      ok: false,
      error: "Une erreur est survenue. Réessaie ou écris-nous à contact@axion-ia.com.",
    };
  }
}
