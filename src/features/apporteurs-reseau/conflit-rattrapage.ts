/**
 * Réseau d'apporteurs — RÈGLE DE CONFLIT du rattrapage d'une réservation échue (validation par
 * rendez-vous OU par commande signée, après le terme).
 *
 * Rattraper valide une entreprise que la réservation avait laissée libre : si une AUTRE déclaration
 * de la même entreprise l'occupe aujourd'hui, on ne tranche pas seul. Williams est alerté (niveau
 * critique) et décide. Conflit :
 *   · une autre présentation `reservee` dont la réservation n'est pas échue ;
 *   · une autre `confirmee` dont la protection court encore ;
 *   · une autre `terminee` dans les 30 jours qui suivent la fin de sa réservation (E1).
 *
 * ⚠️ Tourne aussi dans le WORKER : aucun `server-only`.
 */

import type { prisma } from "@/lib/prisma";

import { alerteInterne } from "./alerte-interne";
import { lireEtablissements, memePerimetre } from "./etablissement-presentation";
import { presentationOccupe } from "./presentations";
import { versReservationProvisoire } from "./regle-attribution";
import { lireIdsEnGrace } from "./reservation-presentation";

export const MESSAGE_CONFLIT_RATTRAPAGE =
  "La réservation de cette entreprise était terminée, mais une autre déclaration l'occupe aujourd'hui (réservée, validée avec protection en cours, ou dans les 30 jours qui suivent la fin de sa réservation). Rien n'est validé : Williams est alerté et tranche.";

type Db = Pick<
  typeof prisma,
  "presentationEntreprise" | "presentationReservation" | "presentationEtablissement"
>;

/** Une AUTRE déclaration (même d'un autre apporteur ou du même) occupe-t-elle l'entreprise de `p` ? */
export async function rattrapageEnConflit(
  db: Db,
  p: { id: string; siren: string },
  maintenant: Date,
): Promise<boolean> {
  const rivales = await db.presentationEntreprise.findMany({
    where: {
      siren: p.siren,
      id: { not: p.id },
      OR: [
        { statut: { in: ["reservee", "confirmee"] } },
        { statut: "terminee", id: { in: await lireIdsEnGrace(maintenant, db) } },
      ],
    },
    select: { id: true, statut: true, recueAt: true, protegeeJusquAt: true },
  });
  if (rivales.length === 0) return false;
  const [etabs, lignes] = await Promise.all([
    lireEtablissements([p.id, ...rivales.map((a) => a.id)], db),
    db.presentationReservation.findMany({
      where: { presentationId: { in: rivales.map((a) => a.id) } },
      select: {
        presentationId: true,
        reserveeJusquAt: true,
        echueAt: true,
        rendezVousPrisAt: true,
        valideeAt: true,
      },
    }),
  ]);
  const parLigne = new Map(lignes.map((l) => [l.presentationId, l]));
  return rivales.some((a) => {
    if (!memePerimetre(etabs.get(p.id)!, etabs.get(a.id)!)) return false;
    // « Réservée non échue » : occupe, terme dépassé ou non (l'échéance n'a pas encore tourné).
    if (a.statut === "reservee") return !parLigne.get(a.id)?.echueAt;
    return presentationOccupe(
      { statut: a.statut, protegeeJusquAt: a.protegeeJusquAt },
      maintenant,
      versReservationProvisoire(a.recueAt, parLigne.get(a.id) ?? null),
    );
  });
}

/** Alerte INTERNE critique, une seule fois par présentation (le jobId est stable). */
export async function alerterConflitRattrapage(
  presentationId: string,
  maintenant: Date,
): Promise<void> {
  await alerteInterne({
    jobId: `apporteur-rattrapage-conflit-${presentationId}`,
    code: "apporteur_rattrapage_conflit",
    titre: "Validation tardive refusée : une autre déclaration occupe l'entreprise",
    message:
      "Un rendez-vous pris, ou une commande signée, avant la fin de la réservation permettrait de valider cette entreprise, mais une autre déclaration l'occupe aujourd'hui : rien n'est validé. À vous de trancher (console › Apporteurs › Entreprises présentées).",
    cibleType: "PresentationEntreprise",
    cibleId: presentationId,
    niveau: "critique",
    maintenant,
  });
}
