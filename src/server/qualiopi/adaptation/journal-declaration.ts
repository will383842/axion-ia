/**
 * DATER une déclaration de besoin d'adaptation (ind. 10) — l'écrivain du journal.
 *
 * ## Pourquoi le journal, et pas une colonne ni `trainees.updated_at`
 *
 * Trois chemins déclarent un besoin : le positionnement du portail, « mon
 * compte » du portail, et la fiche stagiaire en console. Seul le premier laissait
 * une date fiable (`Questionnaire.reponduAt`). Les deux autres écrivent
 * `Trainee.situationHandicap` — une colonne sans date — et `updated_at`, qui
 * bouge à chaque retouche de la fiche, daterait des déclarations qui n'ont jamais
 * eu lieu. Le journal d'activité est déjà la source de la date de la RÉPONSE
 * (`qualiopi.enrollment.adaptations`) : la date de la DÉCLARATION s'y range à
 * côté, sans migration, et se compare à la première par le même lecteur
 * (`journal-consignation.ts`).
 *
 * 🔴 DONNÉE DE SANTÉ (RGPD art. 9) — `changes` ne porte que l'ORIGINE du geste.
 * Ni le détail, ni même le fait qu'un détail a été fourni.
 *
 * L'instant est FOURNI par l'appelant : l'alerte du geste porte la même date dans
 * son message, et les deux doivent désigner le même moment.
 *
 * Fail-soft : la déclaration du bénéficiaire est déjà enregistrée quand on arrive
 * ici. Perdre la date ne doit pas la faire échouer — mais on ne se tait pas.
 */

import { prisma } from "@/lib/prisma";
import {
  ACTION_JOURNAL_DECLARATION_BESOIN,
  type OrigineDeclarationBesoin,
} from "./reponse-organisme";

export async function journaliserDeclarationBesoin(input: {
  readonly traineeId: string;
  readonly origine: OrigineDeclarationBesoin;
  readonly declareLe: Date;
  /** Compte console à l'origine du geste ; absent pour le portail. */
  readonly adminUserId?: string;
}): Promise<boolean> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return false;
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: input.adminUserId ?? null,
        action: ACTION_JOURNAL_DECLARATION_BESOIN,
        targetType: "Trainee",
        targetId: input.traineeId,
        changes: { origine: input.origine },
        createdAt: input.declareLe,
      },
    });
    return true;
  } catch (err) {
    console.error(
      `[journal-declaration] date de la déclaration NON journalisée (stagiaire ${input.traineeId}, ${input.origine}) :`,
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}
