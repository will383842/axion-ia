// Réseau d'apporteurs — ALERTE INTERNE « payée à 100 %, prestation non réalisée » (lot L3a, B3).
//
// Rien n'est facturé ni versé tant que la prestation n'est pas marquée réalisée (contrat 2.3,
// art. 4.2). Si Axion oublie de la marquer, la commission reste bloquée en silence. Cette alerte
// prévient Williams, UNE fois par commission, quand la facture est payée à 100 % depuis plus de
// ALERTE_REALISATION_JOURS (interne, non contractuel) sans que la prestation soit marquée réalisée.
//
// Aucun e-mail à l'apporteur, aucune relance : le délai porte sur la diligence d'Axion.
// Ne crée, ne modifie et ne supprime aucune commission.
// Aucun `server-only` : le passage quotidien (worker) l'appelle.

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";

import { dateFr } from "./autofacture-donnees";
import { dejaEnvoye } from "./commissions";
import { encaissementsDes } from "./hors-grille";
import { litigeDisponible } from "./litige";
import { MARQUABLES, realisationDisponible } from "./realisation";
import { ajouterJours, ALERTE_REALISATION_JOURS } from "./regles";

/** Clé « une fois » de l'alerte d'une commission. */
export function jobIdRealisationEnAttente(commissionId: string): string {
  return `apporteur-realisation-en-attente-${commissionId}`;
}

/** Rend le nombre d'alertes posées. */
export async function alerterRealisationsEnAttente(maintenant: Date = new Date()): Promise<number> {
  // Colonne absente (worker avant la migration) : on ne sait rien, on n'alerte pas.
  if (!(await realisationDisponible())) return 0;
  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      statut: { in: [...MARQUABLES] },
      prestationRealiseeAt: null,
      // Une ligne suspendue (contestation écrite du client, art. 4.2 bis) attend l'issue.
      ...((await litigeDisponible()) ? { litigeDepuis: null } : {}),
    },
    select: { id: true, apporteurId: true, factureId: true, creeAt: true },
    orderBy: { creeAt: "asc" },
  });
  if (lignes.length === 0) return 0;
  const encaisse = await encaissementsDes(lignes);
  let n = 0;
  for (const l of lignes) {
    const payeLe = encaisse.get(l.factureId) ?? l.creeAt;
    if (ajouterJours(payeLe, ALERTE_REALISATION_JOURS).getTime() > maintenant.getTime()) continue;
    const jobId = jobIdRealisationEnAttente(l.id);
    if (await dejaEnvoye(jobId)) continue;
    const r = await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_realisation_en_attente",
        titre: "Payée à 100 %, prestation non marquée réalisée",
        message: `Une commission d'apporteur reste bloquée : la facture du client est payée à 100 % depuis le ${dateFr(payeLe)} (plus de ${ALERTE_REALISATION_JOURS} jours) et la prestation n'est pas marquée réalisée. Rien n'est facturé ni versé à l'apporteur tant qu'elle ne l'est pas (art. 4.2). Marquez-la réalisée dans la console (Commissions apporteurs) si elle l'est, ou notez pourquoi elle ne l'est pas.`,
        cibleType: "ApporteurReseau",
        cibleId: l.apporteurId,
        createdAt: maintenant.toLocaleDateString("fr-FR"),
      },
      { jobId, entityType: "ApporteurReseau", entityId: l.apporteurId },
    );
    if (r.enqueued === true) n += 1;
  }
  return n;
}
