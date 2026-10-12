/**
 * Pastilles du groupe « Formateurs freelance » (lot F) : trois compteurs « reste à faire »,
 * qui descendent à zéro.
 *
 *   · dossiers à vérifier : l'onglet « À vérifier » de la page « Dossiers et contrats » —
 *     même module de calcul que la page, jamais un second chiffre ;
 *   · missions à traiter : les missions dont c'est à l'équipe d'agir (page « Missions »,
 *     filtre « Vous », 30 prochains jours) ;
 *   · honoraires : relevés « À valider » des indépendants.
 *
 * 🔴 Chaque compteur n'est lu que si SA page est ouverte (interrupteur allumé) : groupe
 * éteint = aucune requête. Fail-soft : un compteur en échec vaut 0.
 */

import { prisma } from "@/lib/prisma";
import { lireDossiersEtContrats } from "@/server/qualiopi/formateurs-independants/dossiers-et-contrats-lecture";
import { compterParOnglet } from "@/server/qualiopi/formateurs-independants/etape-parcours-independant";
import { lireMissionsConsole } from "@/server/qualiopi/formateurs-independants/missions-console";

export interface FormateursNavCounts {
  dossiers: number;
  missions: number;
  honoraires: number;
}

export const FORMATEURS_NAV_VIDES: FormateursNavCounts = {
  dossiers: 0,
  missions: 0,
  honoraires: 0,
};

const TRENTE_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

export async function compterFormateursNav(
  ouvert: { dossiers: boolean; missions: boolean; honoraires: boolean },
  maintenant: Date = new Date(),
): Promise<FormateursNavCounts> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return FORMATEURS_NAV_VIDES;
  const [dossiers, missions, honoraires] = await Promise.all([
    ouvert.dossiers
      ? lireDossiersEtContrats()
          .then((l) => compterParOnglet(l.map((x) => x.etape)).a_verifier)
          .catch(() => 0)
      : 0,
    ouvert.missions
      ? lireMissionsConsole(maintenant)
          .then(
            (l) =>
              l.filter(
                (m) =>
                  m.quiAgit === "vous" &&
                  m.dateDebut.getTime() <= maintenant.getTime() + TRENTE_JOURS_MS,
              ).length,
          )
          .catch(() => 0)
      : 0,
    ouvert.honoraires
      ? prisma.trainerStatement
          .count({ where: { statut: "a_valider", trainer: { statut: "sous_traitant" } } })
          .catch(() => 0)
      : 0,
  ]);
  return { dossiers, missions, honoraires };
}
