// Rattachement automatique d'un échange apporteur à son dossier (2026-09-19).
//
// ── Le défaut que ce module ferme ─────────────────────────────────────────
// Mesuré en production le 19/09 (mesure R5) : 37 rendez-vous, 37 rattachés à
// RIEN. Le lien `calendly_events.linked_submission_id` n'était posé qu'à la
// main, en recopiant un UUID dans la fiche — geste que personne ne fait. Un
// candidat apporteur qui réservait l'échange de 15 minutes restait donc
// invisible depuis son dossier.
//
// ── La règle ──────────────────────────────────────────────────────────────
// Juste après l'enrichissement Calendly (le moment où l'adresse de l'invité
// devient connue), SI :
//   · le type d'événement est un échange apporteur (`estAppelApporteur`) ;
//   · la ligne n'est rattachée à RIEN — ni demande (`linked_submission_id`), ni
//     candidature emploi (`linked_job_application_id`) ;
// ALORS on cherche, par l'empreinte de l'adresse, la demande NON SUPPRIMÉE la
// plus récente qui est un dossier apporteur, et on la rattache.
//
// 🔴 ON N'ÉCRASE JAMAIS UN RATTACHEMENT. Un lien posé à la main — ou vers une
// candidature emploi — est une décision humaine ; le déplacer en silence ferait
// disparaître une ligne de l'historique d'un dossier sans que personne ne l'ait
// demandé. La condition « les deux colonnes sont vides » est posée DANS la
// requête d'écriture (`updateMany … where … null`), pas seulement lue avant :
// une saisie manuelle arrivée entre la lecture et l'écriture gagne toujours.
//
// Aucune dépendance Next (ni `server-only`, ni `next/*`) : l'enrichissement
// tourne aussi dans le worker (sondage `refresh.ts`).

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { estApporteur, FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { estAppelApporteur } from "./appel-apporteur";

export interface LigneARattacher {
  id: string;
  eventTypeName: string | null | undefined;
  inviteeEmail: string | null | undefined;
  linkedSubmissionId: string | null | undefined;
  linkedJobApplicationId: string | null | undefined;
}

export type IssueRattachement =
  | { rattache: true; submissionId: string }
  | {
      rattache: false;
      motif:
        | "pas_un_echange_apporteur"
        | "deja_rattache"
        | "sans_adresse"
        | "aucun_dossier_apporteur"
        | "rattache_entre_temps";
    };

/**
 * Rattache un échange apporteur au dossier apporteur le plus récent de la même
 * personne. Idempotent ; n'écrit que sur une ligne qui n'est rattachée à rien.
 *
 * Peut lever (base injoignable, clé d'empreinte absente en production) :
 * l'appelant l'enveloppe, un rattachement raté ne doit jamais faire échouer
 * l'enrichissement.
 */
export async function rattacherEchangeApporteur(
  ligne: LigneARattacher,
): Promise<IssueRattachement> {
  if (!estAppelApporteur(ligne.eventTypeName)) {
    return { rattache: false, motif: "pas_un_echange_apporteur" };
  }
  if (ligne.linkedSubmissionId || ligne.linkedJobApplicationId) {
    return { rattache: false, motif: "deja_rattache" };
  }
  const empreinte = hashEmailForLookup(ligne.inviteeEmail);
  if (!empreinte) return { rattache: false, motif: "sans_adresse" };

  const dossier = await prisma.submission.findFirst({
    where: { contactEmailHash: empreinte, deletedAt: null, ...FILTRE_APPORTEUR_PRISMA },
    orderBy: { submittedAt: "desc" },
    select: { id: true, details: true },
  });
  // Double contrôle EN MÉMOIRE : la clause JSON fait le tri en base, le
  // prédicat pur fait foi. Si les deux divergeaient un jour, on préfère ne rien
  // rattacher plutôt que rattacher un client à un échange apporteur.
  if (!dossier || !estApporteur(dossier.details)) {
    return { rattache: false, motif: "aucun_dossier_apporteur" };
  }

  const { count } = await prisma.calendlyEvent.updateMany({
    where: { id: ligne.id, linkedSubmissionId: null, linkedJobApplicationId: null },
    data: { linkedSubmissionId: dossier.id },
  });
  if (count === 0) return { rattache: false, motif: "rattache_entre_temps" };
  return { rattache: true, submissionId: dossier.id };
}
