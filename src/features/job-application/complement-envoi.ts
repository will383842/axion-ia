// COMPLÉTER SA CANDIDATURE EN LIGNE — l'enregistrement (page publique, sans login).
//
// 🔴 2026-09-28 — CE N'EST PLUS UNE SERVER ACTION. Un monteur a eu deux fois une
// erreur 500 : il avait ouvert la page juste avant une mise en ligne et l'a
// envoyée juste après. Une Server Action est identifiée par un numéro propre à
// CHAQUE build (« Failed to find Server Action … older or newer deployment ») :
// toute page restée ouverte pendant un déploiement ne peut plus envoyer. Et un
// candidat ouvre le lien depuis l'e-mail puis met plusieurs minutes à chiffrer
// ses prix, sur un site qui se déploie plusieurs fois par jour.
// Le formulaire poste donc sur une route FIXE, `/api/candidature/complement`,
// qui appelle cette fonction : la même adresse d'un build à l'autre.
//
// Le jeton signé est la seule autorisation : il est RE-vérifié ici, à l'envoi,
// et non seulement à l'affichage — un formulaire se rejoue hors de la page.

import "server-only";

import * as Sentry from "@sentry/nextjs";
import { revalidateTag } from "next/cache";
import { EXPIRATION_IMMEDIATE } from "@/server/cache/expiration-immediate";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { notify } from "@/server/notifications";
import { isVideoFreelanceOffer } from "@/lib/careers/video-editor-offer";
import {
  collectAnswers,
  labeledAnswers,
  missingRequired,
  prixInvalides,
} from "@/lib/careers/screening-answers";
import { consignerEvenement } from "@/features/admin-job-applications/journal";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";
import type { Prisma } from "../../../prisma/generated/client";

import { chargerDossierComplement, fusionnerReponses } from "./complement";

export type EtatComplement = { ok: true } | { ok: false; error: string } | null;

export async function completerCandidature(formData: FormData): Promise<EtatComplement> {
  const jeton = formData.get("jeton");
  const dossier = await chargerDossierComplement(typeof jeton === "string" ? jeton : null);
  if (!dossier.ok) {
    return { ok: false, error: "Ce lien n'est plus valide. Écris-nous à contact@axion-ia.com." };
  }

  const essais = await checkRateLimit(`candidature-complement:${dossier.applicationId}`, {
    limit: 10,
    windowSec: 3600,
  });
  if (!essais.allowed) {
    return { ok: false, error: "Trop d'essais. Réessaie dans une heure." };
  }

  const nouvelles = collectAnswers(formData);
  // Une réponse obligatoire déjà donnée au dépôt compte : on valide la FUSION.
  const fusion = fusionnerReponses(dossier.questions, dossier.reponses, nouvelles);
  const manquante = missingRequired(dossier.questions, fusion)[0];
  if (manquante) {
    return {
      ok: false,
      error: `Réponse obligatoire manquante : ${manquante.labelFr ?? manquante.labelEn ?? manquante.id}`,
    };
  }
  const prixFaux = prixInvalides(dossier.questions, fusion)[0];
  if (prixFaux) {
    return {
      ok: false,
      error: `Indique un seul montant en euros, sans fourchette : ${prixFaux.labelFr ?? prixFaux.labelEn ?? prixFaux.id}`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.jobApplication.update({
        where: { id: dossier.applicationId },
        // `needsAttention` : une réponse du candidat est un fait nouveau à lire.
        data: { answers: fusion as Prisma.InputJsonValue, needsAttention: true },
      });
      await consignerEvenement(
        {
          applicationId: dossier.applicationId,
          type: "piece_recue",
          authorId: null,
          authorName: "Le candidat (lien en ligne)",
          summary: "Réponses complétées en ligne",
          body: labeledAnswers(dossier.questions, fusion, 400)
            .map((r) => `${r.label} : ${r.value}`)
            .join("\n"),
          meta: { source: "lien-complement", offerId: dossier.offerId },
        },
        tx,
      );
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "completerCandidature" } });
    return {
      ok: false,
      error: "L'enregistrement a échoué. Réessaie, ou écris-nous à contact@axion-ia.com.",
    };
  }
  // `updateTag` est réservé aux Server Actions ; ceci est appelé depuis une
  // route. Expiration IMMÉDIATE, cf. `server/cache/expiration-immediate`.
  try {
    revalidateTag(INBOX_COUNTS_TAG, EXPIRATION_IMMEDIATE);
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "completerCandidature", step: "badge" } });
  }

  // Telegram — même salon que la candidature d'origine. Best-effort : les
  // réponses sont déjà dans la fiche, une notification perdue ne perd rien.
  try {
    const c = await prisma.jobApplication.findUnique({
      where: { id: dossier.applicationId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        city: true,
        locale: true,
      },
    });
    if (c) {
      const phone = lire(c.phone);
      await notify({
        category: isVideoFreelanceOffer(dossier.offreSlug)
          ? "VIDEO_EDITOR_APPLICATION_RECEIVED"
          : "JOB_APPLICATION_RECEIVED",
        payload: {
          applicationId: dossier.applicationId,
          contactName: `${lire(c.firstName)} ${lire(c.lastName)}`.trim(),
          contactEmail: lire(c.email),
          ...(phone ? { contactPhone: phone } : {}),
          offerTitle: `Tarifs complétés · ${dossier.offreTitre}`,
          offerCategory: dossier.offreCategorie,
          ...(c.city ? { city: c.city } : {}),
          answers: labeledAnswers(dossier.questions, fusion),
          hasCv: false,
          locale: c.locale === "en" ? "en" : "fr",
        },
        dedupKey: `${dossier.applicationId}:complement:${Date.now()}`,
      });
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "completerCandidature", step: "notify" } });
  }

  return { ok: true };
}

function lire(chiffre: string | null): string {
  if (!chiffre) return "";
  try {
    const v = decryptPii(chiffre);
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}
