/**
 * Réseau d'apporteurs — ANNONCES liées à l'attribution (2026-10-08, vérification finale de a1,
 * point 3 ; contrat 2.3, art. 3.2 et 3.4).
 *
 *   · `annoncerAttribution` : écrit à l'apporteur quand son attribution devient définitive
 *     (confirmation de la Société — console — ou confirmation réputée acquise — passage
 *     quotidien) et quand sa protection est prolongée de trois mois. UNE fois par événement
 *     (clé « une fois » : présentation + variante).
 *   · `alerterDeclarationsSansReponse` : signale à Williams, en INTERNE, une déclaration restée
 *     sans réponse depuis `RAPPEL_SANS_REPONSE_JOURS` jours. Rappel de gestion, pas un délai du
 *     contrat. Réutilise le gabarit d'alerte interne existant (`qualiopi-alerte-interne`).
 *
 * Aucune de ces fonctions ne LÈVE vers son appelant : une confirmation actée ne se défait pas parce
 * qu'un e-mail n'a pas pu partir (l'échec est signalé).
 *
 * ⚠️ Tourne aussi dans le WORKER (passage quotidien) : aucun `server-only`.
 */

import { adminPath } from "@/lib/admin-path";
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import { enqueueEmail } from "@/server/queue/queues";

import { dejaEnvoye } from "./commissions";
import { envoyer } from "./envois";
import { RAPPEL_SANS_REPONSE_JOURS, ajouterJours } from "./regles";
import { signalerErreurReseau } from "./signaler";

export type VarianteAnnonce = "confirmee" | "prolongee";

export function jobIdAnnonceAttribution(presentationId: string, variante: VarianteAnnonce): string {
  return `apporteur-attribution-${variante}-${presentationId}`;
}

/** « 8 avril 2027 », heure de Paris. */
function dateEnClair(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/**
 * Écrit à l'apporteur. Rend vrai si l'e-mail part (ou attend validation) maintenant ; faux s'il
 * était déjà parti, si la présentation n'est pas dans l'état attendu, ou en cas d'échec.
 */
export async function annoncerAttribution(
  presentationId: string,
  variante: VarianteAnnonce,
): Promise<boolean> {
  try {
    const jobId = jobIdAnnonceAttribution(presentationId, variante);
    if (await dejaEnvoye(jobId)) return false;
    const p = await prisma.presentationEntreprise.findUnique({
      where: { id: presentationId },
      select: {
        id: true,
        statut: true,
        denomination: true,
        protegeeJusquAt: true,
        motifProlongation: true,
        apporteur: { select: { prenom: true, nom: true, email: true } },
      },
    });
    if (!p || p.statut !== "confirmee" || !p.protegeeJusquAt) return false;
    const email = decryptPii(p.apporteur.email) ?? "";
    if (!email) return false;
    const r = await envoyer({
      gabarit: "apporteur-attribution-confirmee",
      destinataire: email,
      payload: {
        contactName: [decryptPii(p.apporteur.prenom), decryptPii(p.apporteur.nom)]
          .filter(Boolean)
          .join(" "),
        entreprise: p.denomination,
        finProtection: dateEnClair(p.protegeeJusquAt),
        variante,
        ...(variante === "prolongee" && p.motifProlongation ? { motif: p.motifProlongation } : {}),
      },
      entityType: "PresentationEntreprise",
      entityId: p.id,
      jobId,
    });
    return r === "envoye" || r === "en-validation";
  } catch (err) {
    signalerErreurReseau(`annonce d'attribution (${variante})`, err);
    return false;
  }
}

/**
 * Les déclarations sans réponse de Williams (« Bien reçu » ou refus) depuis
 * `RAPPEL_SANS_REPONSE_JOURS` jours : une alerte INTERNE chacune, une seule fois.
 */
export async function alerterDeclarationsSansReponse(maintenant: Date): Promise<number> {
  const seuil = ajouterJours(maintenant, -RAPPEL_SANS_REPONSE_JOURS);
  const lignes = await prisma.presentationEntreprise.findMany({
    where: { statut: "reservee", contactEnvoyeAt: null, recueAt: { lte: seuil } },
    select: { id: true, denomination: true, recueAt: true },
    take: 100,
  });
  const lien = `${SITE_URL.replace(/\/+$/, "")}${adminPath("fr", "apporteurs/entreprises")}`;
  let n = 0;
  for (const p of lignes) {
    try {
      const jobId = `apporteur-declaration-sans-reponse-${p.id}`;
      if (await dejaEnvoye(jobId)) continue;
      const r = await enqueueEmail(
        "qualiopi-alerte-interne",
        destinataireAlertesInternes(),
        "fr",
        {
          niveau: "important",
          code: "apporteur_declaration_sans_reponse",
          titre: `Déclaration sans réponse : ${p.denomination}`,
          message: `${p.denomination} a été déclarée le ${dateEnClair(p.recueAt)} et n'a pas encore reçu de réponse (« Bien reçu » ou refus). Le contrat (art. 3.2) prévoit la prise de contact avec la personne déclarée dans les 30 jours de la déclaration ; à défaut, l'attribution est réputée confirmée trente jours plus tard. À traiter : ${lien}`,
          cibleType: "PresentationEntreprise",
          cibleId: p.id,
          cibleLibelle: `Entreprise présentée : ${p.denomination}`,
          createdAt: p.recueAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }),
        },
        { jobId, entityType: "PresentationEntreprise", entityId: p.id },
      );
      if (r.enqueued === true) n += 1;
    } catch (err) {
      signalerErreurReseau("alerte déclaration sans réponse", err);
    }
  }
  return n;
}
