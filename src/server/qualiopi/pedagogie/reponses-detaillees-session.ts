/**
 * Lot L08 (O4) — les réponses détaillées des questionnaires d'une session, prêtes
 * pour la console. Lecture seule, fail-soft : une panne rend une table vide et la
 * fiche session reste affichée.
 *
 * Le contenu qui fait foi est celui FIGÉ à l'envoi (`questionnaire_versions`),
 * relu après vérification de sa forme ; à défaut la version du code, puis la v1.
 */

import { prisma } from "@/lib/prisma";
import { normaliserObjectifsPedagogiques } from "@/server/qualiopi/formations/objectifs";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import { estActifPour } from "@/server/qualiopi/socle/interrupteurs";
import { lirePedagogie } from "./interrupteur";
import {
  contenuDeLaVersion,
  lireContenuStocke,
  type TypeQuestionnaire,
} from "./questionnaire-contenu";
import { detaillerReponses, type ReponseDetaillee } from "./reponses-detaillees";

const TYPES: TypeQuestionnaire[] = ["positionnement", "satisfaction_chaud", "satisfaction_froid"];

export async function lireReponsesDetailleesSession(
  sessionId: string,
): Promise<Map<string, ReponseDetaillee[]>> {
  const sortie = new Map<string, ReponseDetaillee[]>();
  try {
    const etat = await lirePedagogie();
    if (etat === "eteint") return sortie;
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: {
        estTestInterne: true,
        formationSnapshot: true,
        formation: { select: { titre: true, objectifsPedagogiques: true } },
      },
    });
    if (session === null || !estActifPour(etat, { estTestInterne: session.estTestInterne })) {
      return sortie;
    }
    const objectifs = normaliserObjectifsPedagogiques(
      readFormationForDocs(session.formationSnapshot, session.formation).objectifsPedagogiques,
    );
    const lignes = await prisma.questionnaire.findMany({
      where: { enrollment: { sessionId }, reponduAt: { not: null }, type: { in: TYPES } },
      select: {
        id: true,
        type: true,
        reponses: true,
        noteGlobale: true,
        version: { select: { version: true, contenu: true } },
      },
    });
    for (const l of lignes) {
      const type = l.type as TypeQuestionnaire;
      const contenu =
        lireContenuStocke(l.version?.contenu) ??
        (l.version != null ? contenuDeLaVersion(type, l.version.version) : null);
      sortie.set(
        l.id,
        detaillerReponses({
          type,
          contenu,
          reponses: l.reponses,
          noteGlobale: l.noteGlobale,
          objectifs,
        }),
      );
    }
  } catch (e) {
    console.error(
      "[questionnaires] réponses détaillées illisibles :",
      e instanceof Error ? e.name : "erreur",
    );
    sortie.clear();
  }
  return sortie;
}
