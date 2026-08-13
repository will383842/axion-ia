// Simulateur de gains v2 — envoi du rapport par e-mail.
//
// Le rapport complet est déjà visible à l'écran, sans rien demander. Cette
// action ne garde donc AUCUNE valeur en otage : elle sert à envoyer le rapport
// au dirigeant qui veut le retrouver, l'imprimer ou le transmettre. La capture
// du contact est la contrepartie d'un service rendu, pas un péage.
//
// Conséquence directe sur le traitement des erreurs : le message ne doit
// jamais donner l'impression d'un échec quand le lead est bien enregistré. On
// reprend la doctrine de `unified-contact` — persistance = seul échec dur,
// notification et e-mail en meilleur effort.
//
// ── Anti-abus, dans l'ordre ───────────────────────────────────────────────
//   1. Rate-limit Redis (dur)
//   2. Honeypot (dur, succès silencieux pour ne rien apprendre au robot)
//   3. Turnstile (souple : on trace, on ne bloque pas — un dirigeant derrière
//      un réseau d'entreprise filtrant ne doit jamais être perdu)

"use server";

import { headers, cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { SubmissionType } from "../../../prisma/generated/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { encryptPii, decryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { notify } from "@/server/notifications";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { REFERRER_CITY_COOKIE_NAME } from "@/lib/pseo-referrer";
import { roiCallbackSchema, roiReportRequestSchema } from "@/lib/schemas/roi-report-schema";
import { decodeAnswers, REPORT_QUERY_PARAM, ROI_QUERY_PARAM } from "@/lib/roi/encode";
import type { RoiSubmissionDetails } from "@/lib/roi/submission-details";
import { diagnose } from "@/lib/roi/diagnose";
import { clientSectorLabel } from "@/content/sectors";
import { HEADCOUNT_BANDS } from "@/content/roi/model/types";
import { hashEmailForLookup } from "@/lib/security/email-hash";

export type RoiReportState =
  // `submissionId` est rendu au client pour qu'il puisse, dans un SECOND temps,
  // rattacher un numéro de téléphone au lead déjà créé (cf.
  // `attachRoiCallbackAction`). Sans lui, il faudrait redemander l'e-mail.
  { ok: true; submissionId: string } | { ok: false; error: string };

const CONSENT_VERSION = "v1-2026-08-12";

/** Le hash d'IP est secondaire : un défaut de configuration ne doit pas coûter un lead. */
function safeHashIp(ip: string | null | undefined): string | null {
  try {
    return hashIp(ip);
  } catch (err) {
    console.error("[roi-report] hashIp a échoué (IP_HASH_SALT ?):", err);
    return null;
  }
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
}

export async function submitRoiReportAction(
  _prev: RoiReportState,
  formData: FormData,
): Promise<RoiReportState> {
  const ip = await getClientIp();

  const rl = await checkRateLimit(`roi-report:${ip}`, { limit: 5, windowSec: 600 });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  // Honeypot : succès silencieux. Un robot qui reçoit une erreur adapte son
  // remplissage ; un robot qui croit avoir réussi n'apprend rien.
  if (formData.get("website")) {
    return { ok: true, submissionId: "" };
  }

  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  const turnstilePassed = await verifyTurnstile(turnstileToken, ip).catch(() => false);

  const parsed = roiReportRequestSchema.safeParse({
    nom: formData.get("nom"),
    email: formData.get("email"),
    companyName: formData.get("companyName") || undefined,
    diagnostic: formData.get("diagnostic"),
    locale: formData.get("locale") || "fr",
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: "Vérifiez votre nom et votre adresse e-mail." };
  }
  const data = parsed.data;
  const locale = parseLocale(data.locale);

  // Le diagnostic est recalculé ICI, à partir des réponses encodées — jamais
  // repris tel quel depuis le client. Un formulaire trafiqué ne peut donc pas
  // faire écrire de faux chiffres dans un e-mail signé de notre nom.
  const answers = decodeAnswers(data.diagnostic);
  if (!answers) {
    return { ok: false, error: "Ce rapport n'est plus lisible. Refaites le questionnaire." };
  }
  const report = diagnose(answers);

  const reportUrl = `${siteUrl()}/${locale}/roi?${ROI_QUERY_PARAM}=${data.diagnostic}&${REPORT_QUERY_PARAM}=1`;

  const c = await cookies();
  const utm = readUtmCookie(c.get(UTM_COOKIE_NAME)?.value);
  const refCity = c.get(REFERRER_CITY_COOKIE_NAME)?.value;
  const funnel: { utm?: typeof utm; referrerCity?: string } = {};
  if (Object.keys(utm).length > 0) funnel.utm = utm;
  if (refCity && refCity.length > 0 && refCity.length <= 120) funnel.referrerCity = refCity;

  const userAgent = (await headers()).get("user-agent") ?? null;

  const headcountLabel =
    HEADCOUNT_BANDS.find((b) => b.id === answers.headcount)?.labelFr ?? answers.headcount;
  const sectorLabel =
    answers.sector === "generique" ? "Autre secteur" : clientSectorLabel(answers.sector);

  // Typé par `RoiSubmissionDetails` : ce JSON est lu par l'export CSV de la
  // console, et Prisma ne contraint pas `details`. Sans ce type, renommer une
  // clé ici viderait une colonne de l'export en silence.
  const details: RoiSubmissionDetails = {
    unifiedType: "simulateur_roi",
    consentVersion: CONSENT_VERSION,
    // Le diagnostic encodé permet de rejouer EXACTEMENT le rapport vu par le
    // prospect — indispensable pour préparer un appel sans lui redemander ce
    // qu'il vient de saisir.
    diagnostic: data.diagnostic,
    reportUrl,
    maturity: answers.maturity,
    // Les agrégats sont dupliqués ici pour rester filtrables en console sans
    // avoir à re-décoder le diagnostic.
    savedHoursPerYear: report.totalSavedHoursPerYear,
    savedEurPerYear: report.totalSavedEurPerYear,
    fteRecovered: report.fteRecovered,
    topTaskIds: report.topTasks.map((t) => t.task.id),
    ...(turnstilePassed ? {} : { turnstilePassed: false as const }),
    ...(Object.keys(funnel).length > 0 ? { funnel: funnel as unknown as object } : {}),
  };

  try {
    const submission = await prisma.submission.create({
      data: {
        type: SubmissionType.contact,
        locale,
        companyName: data.companyName ?? "—",
        contactName: encryptPii(data.nom),
        contactEmail: encryptPii(data.email),
        contactEmailHash: hashEmailForLookup(data.email),
        contactPhone: null,
        sector: answers.sector,
        employeesCount: headcountLabel,
        details: details as object,
        ipAddress: ip,
        ipHash: safeHashIp(ip),
        userAgent,
      },
    });

    // ── Meilleur effort : le lead est déjà en base ──────────────────────
    try {
      await notify({
        category: "CONTACT_FORM_SUBMITTED",
        payload: {
          submissionId: submission.id,
          contactName: data.nom,
          contactEmail: data.email,
          ...(data.companyName ? { companyName: data.companyName } : {}),
          companySize: headcountLabel,
          formType: "simulateur_roi",
          // Le montant estimé est le premier critère de priorisation d'un
          // rappel : il doit être visible dans la notification, pas dans un
          // second clic.
          budget: `${report.totalSavedEurPerYear} € / an estimés · ${sectorLabel}`,
          locale,
        },
        dedupKey: submission.id,
      } as Parameters<typeof notify>[0]);
    } catch (notifErr) {
      console.error("[roi-report] notify best-effort a échoué:", notifErr);
      Sentry.captureException(notifErr, {
        tags: { action: "submitRoiReportAction", step: "notify" },
      });
    }

    try {
      await enqueueEmail("roi-report", data.email, locale, {
        contactName: data.nom,
        reportUrl,
        sectorLabel,
        headcount: report.headcount,
        savedHoursPerYear: report.totalSavedHoursPerYear,
        savedEurPerYear: report.totalSavedEurPerYear,
        savedEurLow: report.totalSavedEurLow,
        savedEurHigh: report.totalSavedEurHigh,
        fteRecovered: report.fteRecovered,
        topTasks: report.topTasks.map((t) => ({
          label: t.task.labelFr,
          hours: Math.round(t.savedHoursPerYear),
          eur: Math.round(t.savedEurPerYear),
          weeks: t.weeksToValue,
        })),
      });
    } catch (mailErr) {
      console.error("[roi-report] enqueueEmail best-effort a échoué:", mailErr);
      Sentry.captureException(mailErr, {
        tags: { action: "submitRoiReportAction", step: "email" },
      });
    }

    return { ok: true, submissionId: submission.id };
  } catch (err) {
    console.error("[roi-report] échec persistance Submission:", err);
    Sentry.captureException(err, {
      tags: { action: "submitRoiReportAction", step: "persist", locale },
    });
    return {
      ok: false,
      error: "Nous n'avons pas pu enregistrer votre demande. Réessayez dans un instant.",
    };
  }
}

// ---------------------------------------------------------------------------
// Deuxième temps : le rappel téléphonique
// ---------------------------------------------------------------------------

export type RoiCallbackState = { ok: true } | { ok: false; error: string };

/**
 * Rattache un numéro de téléphone à un lead DÉJÀ créé par
 * `submitRoiReportAction`.
 *
 * ── Pourquoi une seconde action plutôt qu'un champ de plus ────────────────
 * Le téléphone est le champ le plus coûteux d'un formulaire : c'est celui qui
 * fait penser « ils vont me harceler ». Le demander à l'entrée aurait fait
 * perdre des rapports envoyés — donc des e-mails, donc des leads. Le demander
 * une fois le rapport parti, à quelqu'un qui vient de recevoir quelque chose,
 * en échange d'un service explicite, coûte zéro conversion : celui qui refuse
 * reste un lead complet.
 *
 * ── Sécurité ──────────────────────────────────────────────────────────────
 * L'identifiant vient du client. Trois protections, sans quoi n'importe qui
 * pourrait écraser le numéro d'un lead existant :
 *   1. l'identifiant est un UUID v4 — non énumérable en pratique ;
 *   2. rate-limit par IP ;
 *   3. surtout : l'écriture n'a lieu QUE si `contactPhone` est encore vide.
 *      Le numéro ne peut donc être posé qu'une fois, jamais remplacé.
 */
export async function attachRoiCallbackAction(
  _prev: RoiCallbackState,
  formData: FormData,
): Promise<RoiCallbackState> {
  const ip = await getClientIp();

  const rl = await checkRateLimit(`roi-callback:${ip}`, { limit: 5, windowSec: 600 });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const parsed = roiCallbackSchema.safeParse({
    submissionId: formData.get("submissionId"),
    telephone: formData.get("telephone"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ce numéro semble incorrect." };
  }
  const { submissionId, telephone } = parsed.data;

  try {
    const existing = await prisma.submission.findUnique({
      where: { id: submissionId },
      // `contactEmail`/`contactName` : nécessaires pour confirmer le rappel à
      // la personne. Ils sont chiffrés au repos, d'où le déchiffrement plus bas.
      select: {
        id: true,
        contactPhone: true,
        companyName: true,
        contactEmail: true,
        contactName: true,
        // La locale n'est pas dans le formulaire de rappel : on reprend celle
        // de la soumission d'origine, pour ne pas répondre en français à
        // quelqu'un qui a fait tout le parcours en anglais.
        locale: true,
      },
    });
    if (!existing) {
      return { ok: false, error: "Demande introuvable. Renvoyez-vous le rapport, puis réessayez." };
    }
    // Écriture unique : un numéro déjà posé n'est jamais remplacé.
    if (existing.contactPhone) return { ok: true };

    await prisma.submission.update({
      where: { id: submissionId },
      data: { contactPhone: encryptPii(telephone) },
    });

    // Confirmation à la personne (2026-08-13). C'est le geste le plus engageant
    // du tunnel — laisser son numéro APRÈS avoir reçu son rapport, sans y être
    // contraint — et il ne recevait aucune confirmation. Le numéro est rappelé
    // dans l'e-mail pour qu'une faute de frappe se voie tout de suite.
    try {
      const clair = decryptPii(existing.contactEmail);
      if (clair && clair.includes("@")) {
        const prenom = decryptPii(existing.contactName)?.split(" ")[0] ?? "";
        await enqueueEmail("rappel-confirme", clair, existing.locale, {
          prenom: prenom || "et merci",
          telephone,
        });
      }
    } catch (err) {
      console.error("[roi-callback] confirmation impossible :", err);
    }

    // Meilleur effort : un lead qui accepte d'être rappelé est le plus chaud du
    // tunnel, la notification doit partir — mais son échec ne doit pas faire
    // croire au visiteur que son numéro n'a pas été pris.
    try {
      await notify({
        category: "CONTACT_FORM_SUBMITTED",
        payload: {
          submissionId: existing.id,
          contactName: "—",
          contactEmail: "—",
          contactPhone: telephone,
          ...(existing.companyName && existing.companyName !== "—"
            ? { companyName: existing.companyName }
            : {}),
          formType: "simulateur_roi_rappel",
          locale: "fr",
        },
        dedupKey: `${existing.id}:phone`,
      } as Parameters<typeof notify>[0]);
    } catch (notifErr) {
      console.error("[roi-report] notify rappel best-effort a échoué:", notifErr);
      Sentry.captureException(notifErr, {
        tags: { action: "attachRoiCallbackAction", step: "notify" },
      });
    }

    return { ok: true };
  } catch (err) {
    console.error("[roi-report] échec rattachement téléphone:", err);
    Sentry.captureException(err, {
      tags: { action: "attachRoiCallbackAction", step: "persist" },
    });
    return { ok: false, error: "Nous n'avons pas pu enregistrer votre numéro. Réessayez." };
  }
}
