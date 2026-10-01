/**
 * Indicateur 22 ⭐ — QUI est concerné, et où l'auditrice le vérifie.
 *
 * L'indicateur porte sur l'entretien et le développement des compétences des
 * personnels chargés de mettre en œuvre les prestations, c'est-à-dire les
 * intervenants INTERNES : salariés et dirigeant-formateur. Les indépendants
 * relèvent de la vigilance de l'indicateur 27, pas de celui-ci.
 *
 * Deux constats de l'audit initial (2026-10-01) :
 *
 *   1. « Où vérifier » menait à la LISTE des formateurs, alors que la preuve
 *      vit dans la section « Développement des compétences » de CHAQUE fiche.
 *      Avec un seul intervenant concerné, l'auditrice devait chercher la fiche
 *      que l'outil connaissait déjà. Le lien va désormais droit à la section.
 *   2. Le libellé officiel dit « des salariés ». Un organisme sans salarié se
 *      lit alors comme hors sujet, ou en défaut. Le libellé officiel RESTE
 *      affiché tel quel ; un repère dit à côté comment il se lit ici.
 */

import { prisma } from "@/lib/prisma";
import type { RegistreIndicateur } from "./registres-par-indicateur";
import { registresDeIndicateur } from "./registres-par-indicateur";

/** Ancre de la section « Développement des compétences » d'une fiche formateur. */
export const ANCRE_DEVELOPPEMENT_COMPETENCES = "developpement-competences";

export interface PopulationIndicateur22 {
  /** Intervenants internes actifs qui animent (salariés et dirigeant). */
  readonly intervenantsInternes: ReadonlyArray<{ readonly id: string; readonly nom: string }>;
  /** Salariés actifs de l'organisme, qu'ils animent ou non. */
  readonly nbSalariesActifs: number;
}

/** Lecture fail-soft : `null` si la base ne répond pas (rien n'est alors affirmé). */
export async function lirePopulationIndicateur22(): Promise<PopulationIndicateur22 | null> {
  try {
    const [internes, nbSalariesActifs] = await Promise.all([
      prisma.trainer.findMany({
        where: { actif: true, estFormateur: true, statut: { in: ["salarie", "dirigeant"] } },
        select: { id: true, nom: true, prenom: true },
        orderBy: { nom: "asc" },
        take: 50,
      }),
      prisma.trainer.count({ where: { actif: true, statut: "salarie" } }),
    ]);
    return {
      intervenantsInternes: internes.map((t) => ({
        id: t.id,
        nom: `${t.prenom ?? ""} ${t.nom}`.trim(),
      })),
      nbSalariesActifs,
    };
  } catch {
    return null;
  }
}

/**
 * « Où vérifier » de l'indicateur 22 : la fiche de l'intervenant concerné, à sa
 * section, quand il n'y en a qu'un ; sinon le renvoi statique (la liste).
 */
export function ouVerifierIndicateur22(
  population: PopulationIndicateur22 | null,
): readonly RegistreIndicateur[] {
  const statique = registresDeIndicateur(22);
  if (population === null || population.intervenantsInternes.length !== 1) return statique;
  const seul = population.intervenantsInternes[0];
  if (seul === undefined) return statique;
  return [
    {
      chemin: `/qualiopi/formateurs/${seul.id}#${ANCRE_DEVELOPPEMENT_COMPETENCES}`,
      libelle: `Actions de développement des compétences, datées — fiche de ${seul.nom}`,
    },
  ];
}

/** Repère de lecture de l'intitulé, seulement pour un organisme SANS salarié. */
export function repereIntituleIndicateur22(
  population: PopulationIndicateur22 | null,
): string | null {
  if (population === null || population.nbSalariesActifs > 0) return null;
  return "Lecture pour cet organisme, qui n'emploie pas de salarié : entretien et développement des compétences des intervenants (salariés, dirigeant-formateur).";
}
