// CAPTURE DU CONTACT À L'ÉCRAN 1 DU DOSSIER — Server Action.
//
// ── Le problème qu'elle résout ────────────────────────────────────────────
// Le dossier apporteur fait neuf écrans. Il sauvegarde bien au fur et à mesure,
// mais DANS LE NAVIGATEUR DU VISITEUR. Quelqu'un qui remplit cinq écrans puis
// ferme l'onglet ne laisse RIEN : pas de ligne, pas de nom, pas de numéro. On
// ne peut ni le rappeler, ni même compter qu'il a existé.
//
// Le tunnel social avait résolu ça par un mini formulaire préalable. Les autres
// canaux — Le Bon Coin, Indeed, l'accès direct — n'en ont pas : ils tombent
// droit sur les neuf écrans, avec le même trafic froid.
//
// Cette action déplace la capture À L'INTÉRIEUR du dossier : dès que l'écran 1
// est validé, on a de quoi rappeler. La longueur du dossier cesse d'être un
// risque de perte totale, et devient un risque de perte partielle.
//
// ── Ce qu'elle NE fait PAS, et pourquoi ───────────────────────────────────
// Elle n'envoie PAS l'e-mail « C'est noté, on t'appelle ». La personne est en
// train de remplir : lui écrire « c'est noté » au milieu du formulaire lui dit
// qu'elle peut s'arrêter. L'e-mail de confirmation part à la SOUMISSION
// complète, comme aujourd'hui.
//
// Elle programme en revanche, DIFFÉRÉS :
//   · le KIT (+30 min) — `lead-apporteur-recu`, variante `dossier-commence` :
//     document de présentation + catalogue, parce que toute personne dont on a
//     l'adresse doit les recevoir (décision Will 2026-09-19) ;
//   · les rappels J+2 / J+7 — ce sont exactement eux qu'il faut à un dossier
//     abandonné.
// `submitCommercialApplicationAction` ANNULE les trois si le dossier arrive :
// celui qui le finit en trois minutes ne reçoit que la confirmation, qui porte
// déjà le kit.
//
// Elle n'envoie pas non plus l'événement Meta : il appartient au tunnel, dont
// le consentement publicitaire est recueilli par la bannière.
//
// ── L'idempotence, le point délicat ───────────────────────────────────────
// Quelqu'un qui vient du tunnel a DÉJÀ une ligne « premier contact ». Capturer
// à l'écran 1 en créerait une seconde, et la personne recevrait deux séries de
// rappels. La garde est double :
//   1. côté client, l'appel n'est fait qu'une fois par session de wizard ;
//   2. côté serveur, on cherche une ligne APPORTEUR existante, hors corbeille,
//      par EMPREINTE D'E-MAIL et on la renvoie telle quelle. C'est la garde qui
//      compte : un rechargement de page, un retour arrière ou un second
//      appareil contournent la première.

"use server";

import { ORIGINE_ECRAN_1_DOSSIER } from "@/lib/contact/accuse-attendu";
import { headers, cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { SubmissionType } from "../../../prisma/generated/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { encryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { notify } from "@/server/notifications";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { SITE_URL } from "@/lib/site-url";
import {
  CANDIDATURE_COMMERCIALE_SUBTYPE,
  COMMERCIAL_APPLICATION_CONSENT_VERSION,
} from "@/lib/commercial-application/model";
import {
  DOSSIER_COMPLET_PATH,
  LEAD_APPORTEUR_ETAPE,
  captureDossierSchema,
} from "@/lib/commercial-application/lead-apporteur";
import {
  planifierKitDossierCommence,
  planifierRelancesLeadApporteur,
} from "./relances-lead-apporteur";

export type CaptureState =
  { ok: true; submissionId: string; deja: boolean } | { ok: false; error: string };

function safeHashIp(ip: string | null | undefined): string | null {
  try {
    return hashIp(ip);
  } catch (err) {
    console.error("[capture-dossier] hashIp a échoué (IP_HASH_SALT ?):", err);
    return null;
  }
}

/**
 * Enregistre le contact dès l'écran 1 du dossier.
 *
 * 🔑 Ne LÈVE JAMAIS et ne bloque jamais la navigation : l'appelant continue vers
 * l'écran 2 sans attendre. Un échec de capture ne doit pas empêcher quelqu'un de
 * candidater — ce serait remplacer une perte partielle par une perte totale,
 * exactement l'inverse du but.
 */
export async function capturerContactDossierAction(
  payload: unknown,
  localeBrut?: unknown,
): Promise<CaptureState> {
  const locale = parseLocale(typeof localeBrut === "string" ? localeBrut : "fr");
  const ip = await getClientIp();

  // Anti-martèlement par IP — large : cette action part à chaque validation de
  // l'écran 1, y compris après un retour en arrière pour corriger une faute.
  const rl = await checkRateLimit(`capture-dossier:${ip}`, { limit: 30, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "trop-d-essais" };

  const parsed = captureDossierSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "champs-invalides" };
  const d = parsed.data;

  const emailKey = hashEmailForLookup(d.email);
  if (!emailKey) return { ok: false, error: "empreinte-indisponible" };

  try {
    // ── IDEMPOTENCE. La garde qui compte : elle survit au rechargement, au
    // retour arrière et au changement d'appareil, là où un drapeau côté client
    // ne survit à rien.
    //
    // 🔴 Elle ne reconnaît QUE une ligne apporteur vivante (2026-09-19).
    // Chercher « une ligne /contact à cette adresse » prenait pour déjà capturé
    // quiconque avait un jour écrit par /contact, ou dont une candidature
    // précédente était en corbeille : pas de ligne, pas de kit, pas de relance,
    // et personne à rappeler. Le filtre JSON vit dans un `AND` explicite, pour
    // qu'un second filtre sur `details` ajouté plus tard ne l'écrase pas.
    const existante = await prisma.submission.findFirst({
      where: {
        contactEmailHash: emailKey,
        type: SubmissionType.contact,
        deletedAt: null,
        AND: [{ details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE } }],
      },
      select: { id: true },
      orderBy: { submittedAt: "desc" },
    });
    if (existante) return { ok: true, submissionId: existante.id, deja: true };

    const c = await cookies();
    const utm = readUtmCookie(c.get(UTM_COOKIE_NAME)?.value);
    const userAgent = (await headers()).get("user-agent") ?? null;

    const submission = await prisma.submission.create({
      data: {
        type: SubmissionType.contact,
        locale,
        companyName: "—",
        contactName: encryptPii(d.prenom),
        contactEmail: encryptPii(d.email),
        // La clé de personne — sans elle, l'export art. 15 et l'effacement
        // art. 17 rateraient cette ligne en silence (cf. PR #982).
        contactEmailHash: emailKey,
        contactPhone: encryptPii(d.telephone) ?? null,
        details: {
          unifiedType: "recrutement",
          subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
          etape: LEAD_APPORTEUR_ETAPE,
          // 🔑 Ce marqueur distingue une capture FAITE EN COURS DE DOSSIER d'un
          // premier contact venu du mini formulaire. Sans lui, on ne saurait pas
          // dire combien de gens s'arrêtent dans le dossier — c'est-à-dire
          // précisément le chiffre pour lequel cette capture existe.
          origine: ORIGINE_ECRAN_1_DOSSIER,
          nom: d.nom,
          ...(Object.keys(utm).length > 0 ? { funnel: { utm } as unknown as object } : {}),
          ...(d.sourceConnaissance ? { sourceConnaissance: d.sourceConnaissance } : {}),
          message:
            "Contact enregistré à l'écran 1 du dossier. Le dossier complet n'est pas encore arrivé.",
        } as object,
        ipAddress: ip,
        ipHash: safeHashIp(ip),
        userAgent,
      },
    });

    // 🔴 La preuve porte le texte AFFICHÉ à l'écran 1 — celui du dossier :
    // « J'accepte que mes informations soient utilisées pour l'étude de ma
    // candidature » (`components/forms/commercial-application/steps.tsx`).
    // Jusqu'au 19/09, on consignait ici la version du formulaire court
    // Facebook (`LEAD_APPORTEUR_CONSENT_VERSION`), un AUTRE texte : la preuve
    // ne correspondait pas à ce que la personne avait lu, et une preuve de
    // consentement ne vaut que par ce texte-là.
    await recordConsentEvent({
      email: d.email,
      formRef: CONSENT_FORM_REFS.commercialApplication,
      consentVersion: COMMERCIAL_APPLICATION_CONSENT_VERSION,
      action: "optin",
      occurredAt: submission.submittedAt,
      ip,
      userAgent,
    });

    // Prévenir — best-effort. Un échec de notification ne perd pas le contact.
    try {
      await notify({
        category: "COMMERCIAL_APPLICATION_RECEIVED",
        payload: {
          submissionId: submission.id,
          contactName: `${d.prenom} ${d.nom}`.trim(),
          contactEmail: d.email,
          contactPhone: d.telephone,
          ville: "— à demander lors de l'appel",
          zone: "—",
          b2bYears: "à qualifier (dossier en cours)",
          availability: "—",
          usesAi: false,
          locale,
        },
        dedupKey: submission.id,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { action: "capturerContactDossierAction", step: "notify" },
      });
    }

    // Kit (+30 min) puis rappels J+2 / J+7 — tous annulés automatiquement si
    // le dossier arrive. Le kit fait que toute personne dont on a l'adresse
    // reçoit le document de présentation et le catalogue (décision Will
    // 2026-09-19), sans lui écrire pendant qu'elle remplit.
    const relance = {
      email: d.email,
      prenom: d.prenom,
      dossierUrl: `${SITE_URL}/${locale}${DOSSIER_COMPLET_PATH}`,
      submissionId: submission.id,
    };
    try {
      await planifierKitDossierCommence(relance);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { action: "capturerContactDossierAction", step: "kit" },
      });
    }
    try {
      await planifierRelancesLeadApporteur(relance);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { action: "capturerContactDossierAction", step: "relances" },
      });
    }

    return { ok: true, submissionId: submission.id, deja: false };
  } catch (err) {
    console.error("[capture-dossier] échec:", err);
    Sentry.captureException(err, {
      tags: { action: "capturerContactDossierAction", step: "persist" },
    });
    return { ok: false, error: "echec-ecriture" };
  }
}
