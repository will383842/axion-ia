/**
 * Un besoin d'aménagement déclaré SANS situation de handicap — où il s'enregistre.
 *
 * ## Le défaut que ce module ferme (dette D2/D4, relectures #1095, #1099, #1101)
 *
 * L'écran « mon compte » du portail proposait : « Si vous avez une situation
 * nécessitant des aménagements particuliers (handicap, trouble d'apprentissage,
 * etc.) ». Le seul enregistrement possible était pourtant
 * `Trainee.situationHandicap = true`. Une pause plus longue, une place près de
 * la porte ou un support agrandi faisaient donc qualifier la personne « en
 * situation de handicap » — inexactitude et minimisation (RGPD art. 5) — et
 * alimentaient le décompte handicap (indicateurs 20 et 26, tuile de pilotage,
 * colonne de la liste des stagiaires).
 *
 * Depuis #1101, un « oui » au positionnement ne coche plus la case : le besoin
 * vit dans les RÉPONSES du questionnaire, et `besoinAdaptationDeclare`
 * (`reponse-organisme.ts`) le lit là. C'était le dernier chemin qui cochait à
 * tort.
 *
 * ## Où le besoin est rangé, et pourquoi PAS une colonne
 *
 * 🔑 Là où les lecteurs le cherchent DÉJÀ : `Questionnaire.reponses`
 * (`besoinAdaptation: true`) du positionnement RÉPONDU de chaque inscription en
 * cours. C'est la seconde branche de `besoinAdaptationDeclare` et de
 * `whereBesoinAdaptationDeclare` — donc l'indicateur 10, la règle d'alerte
 * balayée, l'écran de session, le dossier d'audit et l'espace formateur le
 * voient sans qu'une seule de leurs lignes change, et sans migration.
 *
 * ⚠️ Ce module n'écrit NI `reponduAt` NI `envoyeAt`. Marquer « répondu » un
 * positionnement qui ne l'est pas fabriquerait une preuve Qualiopi (ind. 4 et 8)
 * à partir d'un geste qui n'est pas le questionnaire.
 *
 * ⚠️ Il n'écrit pas non plus sur une saisie par l'organisme (`saisie_admin`) :
 * `lirePositionnement` y lit `besoinAdaptation` comme `null` — « la question n'a
 * pas été posée ». Le booléen y serait posé en base, invisible à la relecture,
 * et le filtre SQL désignerait une ligne que la confirmation écarte.
 *
 * ⛔ CE QUE CE MODULE NE COUVRE PAS, et il faut le savoir : une inscription dont
 * le positionnement n'a PAS encore été répondu n'a aucun porteur. Le besoin
 * n'est alors pas perdu — détail chiffré sur la fiche, journal daté, alerte
 * `besoin_adaptation_declare` ouverte sur la personne, Telegram — mais il ne
 * compte pas encore au dénominateur de l'indicateur 10. L'appelant apprend le
 * nombre d'inscriptions marquées et le remonte quand il vaut zéro : ce trou se
 * voit, il ne se tait pas.
 *
 * 🔴 DONNÉE DE SANTÉ (RGPD art. 9) — ce module n'écrit qu'un BOOLÉEN et une
 * date. Jamais le détail, ni en clair ni chiffré : il est sur la fiche
 * stagiaire, `handicapDetailsChiffre`, lecture réservée au super-administrateur
 * et journalisée.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";
import {
  estSaisieOrganisme,
  lirePositionnement,
} from "@/server/qualiopi/positionnement/lecture-positionnement";

/**
 * Provenance du booléen, écrite à côté de lui : il ne vient PAS de la réponse au
 * questionnaire mais d'une déclaration faite depuis « mon compte ». Aucun
 * lecteur ne l'exige — `lirePositionnement` ignore les clés qu'il ne connaît
 * pas — mais sans elle, rien ne distinguerait plus les deux gestes en base.
 */
export const CLE_DECLARE_HORS_QUESTIONNAIRE = "besoinAdaptationDeclareHorsQuestionnaireLe";

/**
 * Porte le besoin déclaré sur les positionnements répondus des inscriptions en
 * cours. Rend le NOMBRE d'inscriptions effectivement marquées.
 *
 * ⚠️ Ne lève pas pour une écriture ratée sur une inscription : les autres
 * doivent être servies. L'appelant lit le compte.
 */
export async function inscrireBesoinSurPositionnements(input: {
  readonly traineeId: string;
  readonly declareLe: Date;
}): Promise<number> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return 0;

  const inscriptions = await prisma.enrollment.findMany({
    where: {
      traineeId: input.traineeId,
      ...inscriptionsActives(),
      // Une déclaration postérieure à la fin d'une session ne la concerne pas —
      // même borne que `derniereDeclarationPourInscription`, qui refuse de
      // rouvrir un dossier clos.
      session: {
        statut: { notIn: STATUTS_SESSION_SANS_PREUVE },
        dateFin: { gte: input.declareLe },
      },
    },
    select: {
      id: true,
      questionnaires: {
        where: { type: "positionnement", reponduAt: { not: null } },
        select: { id: true, reponses: true },
      },
    },
  });

  let marquees = 0;
  for (const inscription of inscriptions) {
    let marquee = false;
    for (const q of inscription.questionnaires) {
      if (estSaisieOrganisme(q.reponses)) continue;
      if (lirePositionnement(q.reponses).besoinAdaptation === true) {
        // Déjà déclaré dans le questionnaire : rien à écrire, mais l'inscription
        // porte bien le besoin — la compter, sinon l'appelant croirait le trou
        // ouvert alors qu'il ne l'est pas.
        marquee = true;
        continue;
      }
      const reponses =
        typeof q.reponses === "object" && q.reponses !== null && !Array.isArray(q.reponses)
          ? (q.reponses as Record<string, unknown>)
          : {};
      try {
        await prisma.questionnaire.update({
          where: { id: q.id },
          data: {
            reponses: {
              ...reponses,
              besoinAdaptation: true,
              [CLE_DECLARE_HORS_QUESTIONNAIRE]: input.declareLe.toISOString(),
            },
          },
        });
        marquee = true;
      } catch (err) {
        console.error(
          `[besoin-sans-handicap] positionnement ${q.id} NON marqué :`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
    if (marquee) marquees += 1;
  }
  return marquees;
}
