// Candidature commerciale — Server Action (tunnel sans CV, Mémorial de
// l'Isère 2026-08-12).
//
// Calquée sur `submitUnifiedContactAction` (le modèle mature) :
//   - rate-limit Redis 3/10min/IP
//   - honeypot (champ `website`) — PAS de captcha (règle absolue du brief :
//     anti-spam invisible uniquement)
//   - Zod parse (schéma partagé `lib/commercial-application/model.ts`)
//   - encryptPii sur nom/email/téléphone, hashIp SHA-256 RGPD
//   - Submission.create (type DB `contact`, `details.unifiedType="recrutement"`
//     → la vue console Contacts → Commercial la reçoit sans migration)
//   - PUIS SEULEMENT les notifications, toutes best-effort : Telegram+WhatsApp
//     (COMMERCIAL_APPLICATION_RECEIVED), email candidat, récap interne.
//     Une notification en échec ne perd JAMAIS la candidature (déjà en base).

"use server";

import { headers, cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { SubmissionType } from "../../../prisma/generated/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { encryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { notify } from "@/server/notifications";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { REFERRER_CITY_COOKIE_NAME } from "@/lib/pseo-referrer";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/site-url";
import {
  B2B_ANNEES_OPTIONS,
  COMMERCIAL_APPLICATION_CONSENT_VERSION,
  DEPLACEMENT_OPTIONS,
  IA_OUTILS_OPTIONS,
  INFORMATIQUE_USAGES_OPTIONS,
  SOURCE_OPTIONS,
  STATUT_OPTIONS,
  TYPES_CLIENTS_OPTIONS,
  commercialApplicationSchema,
  formatMoisAnnee,
  optionLabel,
  zoneResume,
  type CommercialApplicationInput,
} from "@/lib/commercial-application/model";

export type CommercialApplicationState =
  { ok: true; submissionId: string } | { ok: false; error: string };

// `hashIp` throw si IP_HASH_SALT absent — la capture du lead prime (même
// doctrine que unified-contact, décision Will 2026-07-01).
function safeHashIp(ip: string | null | undefined): string | null {
  try {
    return hashIp(ip);
  } catch (err) {
    console.error("[commercial-application] hashIp a échoué (IP_HASH_SALT ?):", err);
    return null;
  }
}

/** Destinataire du récap interne — même chaîne de repli que les alertes internes. */
function internalRecipient(): string {
  return (
    process.env["COMMERCIAL_APPLICATIONS_EMAIL"] ??
    process.env["QUALIOPI_ALERTE_EMAIL"] ??
    process.env["WEEKLY_REPORT_EMAIL"] ??
    "williamsjullin@gmail.com"
  );
}

const oui = (v: boolean) => (v ? "Oui" : "Non");

/** « mars 2019 → aujourd'hui » pour une expérience. */
function periodeOf(e: CommercialApplicationInput["experiences"][number]): string {
  const fin = e.posteActuel ? "aujourd'hui" : formatMoisAnnee(e.fin);
  return `${formatMoisAnnee(e.debut)} → ${fin}`;
}

/** Lignes lisibles du récap interne (la mise en forme vit ICI, pas dans le template). */
function buildRecapRows(d: CommercialApplicationInput): Array<{ label: string; value: string }> {
  const iaOutils = (d.iaOutils ?? [])
    .map((id) =>
      id === "autre" && d.iaOutilAutre
        ? `Autre (${d.iaOutilAutre})`
        : optionLabel(IA_OUTILS_OPTIONS, id),
    )
    .join(", ");
  const infoUsages = (d.informatiqueUsages ?? [])
    .map((id) =>
      id === "autre" && d.informatiqueAutre
        ? `Autre (${d.informatiqueAutre})`
        : optionLabel(INFORMATIQUE_USAGES_OPTIONS, id),
    )
    .join(", ");
  return [
    { label: "Nom complet", value: `${d.prenom} ${d.nom}` },
    { label: "Email", value: d.email },
    { label: "Téléphone", value: d.telephone },
    ...(d.dateNaissance ? [{ label: "Date de naissance", value: d.dateNaissance }] : []),
    ...(d.nationalite ? [{ label: "Nationalité", value: d.nationalite }] : []),
    { label: "Ville", value: `${d.ville} (${d.codePostal})` },
    {
      label: "A déjà vendu en B2B",
      value: d.b2bDejaVendu
        ? `Oui — ${optionLabel(B2B_ANNEES_OPTIONS, d.b2bAnnees)}`
        : "Non (prérequis non rempli — remonté tel quel)",
    },
    {
      label: "Utilise l'IA au quotidien",
      value: d.iaUtilise ? `Oui — ${iaOutils || "outils non précisés"}` : "Non",
    },
    ...(d.iaUtilise && d.iaUsage ? [{ label: "Usage de l'IA", value: d.iaUsage }] : []),
    {
      label: "Informatique au travail",
      value: d.informatiqueUtilise ? `Oui — ${infoUsages || "usages non précisés"}` : "Non",
    },
    { label: "Zone souhaitée", value: zoneResume(d) },
    ...(d.deplacement
      ? [
          {
            label: "Déplacement chez les clients",
            value: optionLabel(DEPLACEMENT_OPTIONS, d.deplacement),
          },
        ]
      : []),
    { label: "Disponibilité", value: formatMoisAnnee(d.disponibilite) },
    { label: "Permis + véhicule", value: oui(d.permisVehicule) },
    ...(d.statut ? [{ label: "Statut actuel", value: optionLabel(STATUT_OPTIONS, d.statut) }] : []),
    ...(d.linkedin ? [{ label: "LinkedIn", value: d.linkedin }] : []),
    ...(d.sourceConnaissance
      ? [{ label: "A connu l'offre via", value: optionLabel(SOURCE_OPTIONS, d.sourceConnaissance) }]
      : []),
  ];
}

export async function submitCommercialApplicationAction(
  _prev: CommercialApplicationState,
  formData: FormData,
): Promise<CommercialApplicationState> {
  const ip = await getClientIp();

  // 1. Rate-limit
  const rl = await checkRateLimit(`commercial-application:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  // 2. Honeypot — bot silent success
  if (formData.get("website")) {
    return { ok: true, submissionId: "" };
  }

  // 3. Parse (le wizard envoie l'ensemble des réponses en un JSON)
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Champs invalides." };
  }
  const parsed = commercialApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides — vérifie tes réponses." };
  }
  const d = parsed.data;
  const locale = parseLocale(formData.get("locale") ?? "fr");

  // 4. UTM funnel + referrerCity (même capture que unified-contact)
  const c = await cookies();
  const utm = readUtmCookie(c.get(UTM_COOKIE_NAME)?.value);
  const refCity = c.get(REFERRER_CITY_COOKIE_NAME)?.value;
  const funnel: { utm?: typeof utm; referrerCity?: string } = {};
  if (Object.keys(utm).length > 0) funnel.utm = utm;
  if (refCity && refCity.length > 0 && refCity.length <= 120) funnel.referrerCity = refCity;

  const userAgent = (await headers()).get("user-agent") ?? null;

  // Expériences en ordre ANTI-CHRONOLOGIQUE partout en aval (récap + console) :
  // poste actuel d'abord, puis début décroissant.
  const experiences = [...d.experiences].sort((a, b) => {
    if (a.posteActuel !== b.posteActuel) return a.posteActuel ? -1 : 1;
    return b.debut.localeCompare(a.debut);
  });

  // 5. Persist Submission — AVANT toute notification (règle du brief).
  try {
    const submission = await prisma.submission.create({
      data: {
        type: SubmissionType.contact,
        locale,
        companyName: "—",
        contactName: encryptPii(`${d.prenom} ${d.nom}`),
        contactEmail: encryptPii(d.email),
        contactPhone: encryptPii(d.telephone) ?? null,
        details: {
          // `unifiedType: "recrutement"` = clé du filtre de la vue console
          // Contacts → Commercial (forcedTypes). NE PAS renommer.
          unifiedType: "recrutement",
          subType: "candidature-commerciale",
          ville: `${d.ville} (${d.codePostal})`,
          // La carte « Message » générique du détail console affiche ce champ :
          // on y met le pitch (la réponse la plus parlante).
          message: d.pitch,
          source: "/devenir-commercial-ia/candidature",
          consentVersion: COMMERCIAL_APPLICATION_CONSENT_VERSION,
          ...(Object.keys(funnel).length > 0 ? { funnel: funnel as unknown as object } : {}),
          // Bloc structuré rendu par la vue détail console (accordéons, chips).
          // PII minimisée : nom/email/téléphone vivent UNIQUEMENT dans les
          // colonnes chiffrées ci-dessus, pas ici.
          candidature: {
            version: 1,
            ...(d.dateNaissance ? { dateNaissance: d.dateNaissance } : {}),
            ...(d.nationalite ? { nationalite: d.nationalite } : {}),
            ville: d.ville,
            codePostal: d.codePostal,
            b2b: { dejaVendu: d.b2bDejaVendu, ...(d.b2bAnnees ? { annees: d.b2bAnnees } : {}) },
            experiences,
            ia: {
              utilise: d.iaUtilise,
              ...(d.iaOutils?.length ? { outils: d.iaOutils } : {}),
              ...(d.iaOutilAutre ? { outilAutre: d.iaOutilAutre } : {}),
              ...(d.iaUsage ? { usage: d.iaUsage } : {}),
            },
            informatique: {
              utilise: d.informatiqueUtilise,
              ...(d.informatiqueUsages?.length ? { usages: d.informatiqueUsages } : {}),
              ...(d.informatiqueAutre ? { usageAutre: d.informatiqueAutre } : {}),
            },
            zone: { mobile: d.zoneMobile, ...(d.zones?.length ? { zones: d.zones } : {}) },
            ...(d.deplacement ? { deplacement: d.deplacement } : {}),
            pitch: d.pitch,
            ...(d.messageLibre ? { messageLibre: d.messageLibre } : {}),
            disponibilite: d.disponibilite,
            permisVehicule: d.permisVehicule,
            ...(d.statut ? { statut: d.statut } : {}),
            ...(d.linkedin ? { linkedin: d.linkedin } : {}),
            ...(d.sourceConnaissance ? { sourceConnaissance: d.sourceConnaissance } : {}),
          },
        } as object,
        ipAddress: ip,
        ipHash: safeHashIp(ip),
        userAgent,
      },
    });

    // 6. Telegram + WhatsApp — best-effort, la candidature est déjà en base.
    try {
      await notify({
        category: "COMMERCIAL_APPLICATION_RECEIVED",
        payload: {
          submissionId: submission.id,
          contactName: `${d.prenom} ${d.nom}`,
          contactEmail: d.email,
          contactPhone: d.telephone,
          ville: d.ville,
          zone: zoneResume(d),
          b2bYears: d.b2bDejaVendu
            ? optionLabel(B2B_ANNEES_OPTIONS, d.b2bAnnees)
            : "aucune (prérequis non rempli)",
          availability: formatMoisAnnee(d.disponibilite),
          usesAi: d.iaUtilise,
          locale,
        },
        dedupKey: submission.id,
      });
    } catch (notifErr) {
      console.error("[commercial-application] notify best-effort a échoué:", notifErr);
      Sentry.captureException(notifErr, {
        tags: { action: "submitCommercialApplicationAction", step: "notify" },
      });
    }

    // 7. Email candidat (accusé chaleureux) — best-effort.
    try {
      await enqueueEmail("candidature-commercial-confirmee", d.email, locale, {
        contactName: d.prenom,
        submissionId: submission.id,
      });
    } catch (mailErr) {
      console.error("[commercial-application] email candidat a échoué:", mailErr);
      Sentry.captureException(mailErr, {
        tags: { action: "submitCommercialApplicationAction", step: "email-candidat" },
      });
    }

    // 8. Récap interne complet — best-effort.
    try {
      await enqueueEmail("candidature-commercial-recap", internalRecipient(), "fr", {
        prenom: d.prenom,
        nom: d.nom,
        ville: d.ville,
        rows: buildRecapRows(d),
        experiences: experiences.map((e) => ({
          titre: `${e.poste} — ${e.entreprise}`,
          lieu: e.ville,
          periode: periodeOf(e),
          periodeSort: e.posteActuel ? `9999-${e.debut}` : e.debut,
          ...(e.typesClients?.length
            ? {
                clients: e.typesClients
                  .map((t) => optionLabel(TYPES_CLIENTS_OPTIONS, t))
                  .join(", "),
              }
            : {}),
        })),
        pitch: d.pitch,
        ...(d.messageLibre ? { messageLibre: d.messageLibre } : {}),
        submissionId: submission.id,
        consoleUrl: `${SITE_URL}${adminPath("fr", "contacts/commercial")}/${submission.id}`,
      });
    } catch (recapErr) {
      console.error("[commercial-application] récap interne a échoué:", recapErr);
      Sentry.captureException(recapErr, {
        tags: { action: "submitCommercialApplicationAction", step: "email-recap" },
      });
    }

    return { ok: true, submissionId: submission.id };
  } catch (err) {
    // Seul un échec d'écriture DB (capture du lead) arrive ici = vraie erreur.
    console.error("[commercial-application] échec persistance Submission:", err);
    Sentry.captureException(err, {
      tags: { action: "submitCommercialApplicationAction", step: "persist", locale },
    });
    return {
      ok: false,
      error: "Une erreur est survenue. Réessaie ou écris-nous à contact@axion-ia.com.",
    };
  }
}
