/**
 * Enregistrer un besoin d'AMÉNAGEMENT déclaré sans situation de handicap.
 *
 * ## Le défaut que ce module ferme (dette D2/D4)
 *
 * L'écran « mon compte » du portail disait : « Si vous avez une situation
 * nécessitant des aménagements particuliers (handicap, trouble d'apprentissage,
 * etc.) », et son unique action posait `Trainee.situationHandicap = true`. Une
 * pause plus longue, une place près de la porte ou un support agrandi faisaient
 * donc qualifier la personne « en situation de handicap » — inexactitude et
 * minimisation (RGPD art. 5) — et alimentaient le décompte handicap des
 * indicateurs 20 et 26.
 *
 * ## 🔴 Ce qu'un premier correctif avait fait, et pourquoi c'était pire
 *
 * Il écrivait `besoinAdaptation: true` dans `Questionnaire.reponses` du
 * positionnement, « là où les lecteurs cherchent déjà ». Mais il ne sautait que
 * les réponses déjà à `true` : une réponse **`false`** — la personne avait
 * explicitement répondu « Non » — était RÉÉCRITE en « Oui ». La pièce d'audit
 * (`positionnement-rempli.tsx`) affichait alors « Besoin d'adaptation déclaré :
 * Oui » sous « Réponse enregistrée le <date>, avant le début de la session », et
 * son bandeau passait de « Indicateurs 4 et 8 » à « 4, 8 et 10 » : une preuve
 * d'indicateur fabriquée à partir d'un geste qui n'est pas le questionnaire.
 *
 * 🔑 **La réponse d'un bénéficiaire ne se réécrit pas.** Ce module n'écrit QUE
 * `Enrollment.besoinAdaptationDeclareAt`, une colonne à lui, et ne touche jamais
 * `Questionnaire`.
 *
 * ## Ce qu'il écrit, et où il s'arrête
 *
 * La date de la déclaration sur les inscriptions ENCORE EN COURS de la personne
 * — actives, session ni annulée ni reportée, et pas encore terminée. Une
 * déclaration ne rouvre pas un dossier clos : c'est la même borne que
 * `derniereDeclarationPourInscription`.
 *
 * 🔴 DONNÉE DE SANTÉ (RGPD art. 9) : ce module n'écrit qu'une DATE. Le détail est
 * chiffré sur la fiche stagiaire, lecture réservée au super-administrateur et
 * journalisée.
 *
 * ⚠️ Atteint uniquement par la Server Action du portail, mais écrit sans
 * `server-only` : la colonne peut ne pas exister pendant l'heure qui suit une
 * fusion (le worker atterrit avant la migration de l'app), donc l'écriture est
 * conditionnée par `colonneDeclarationDisponible()`.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";
import { colonneDeclarationDisponible } from "./colonne-declaration";

export type ResultatDeclarationAmenagement =
  /** La date est posée sur `n` inscriptions (`n` peut être 0 : aucune en cours). */
  | { readonly etat: "ecrit"; readonly inscriptions: number }
  /** La colonne n'est pas encore migrée — l'heure qui suit une fusion. */
  | { readonly etat: "colonne_absente" };

/**
 * Pose la date de déclaration sur les inscriptions en cours de la personne.
 *
 * Idempotent par construction : une seconde déclaration réécrit la MÊME colonne
 * avec un instant plus récent — aucune ligne en double, et c'est la date la plus
 * récente qui rouvre le circuit de l'indicateur 10.
 */
export async function declarerBesoinAmenagementSurInscriptions(input: {
  readonly traineeId: string;
  readonly declareLe: Date;
}): Promise<ResultatDeclarationAmenagement> {
  if (!(await colonneDeclarationDisponible())) return { etat: "colonne_absente" };

  const { count } = await prisma.enrollment.updateMany({
    where: {
      traineeId: input.traineeId,
      ...inscriptionsActives(),
      session: {
        statut: { notIn: STATUTS_SESSION_SANS_PREUVE },
        dateFin: { gte: input.declareLe },
      },
    },
    data: { besoinAdaptationDeclareAt: input.declareLe },
  });
  return { etat: "ecrit", inscriptions: count };
}
