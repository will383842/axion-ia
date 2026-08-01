/**
 * Qualiopi — Alerte « job IA en échec » (audit UX console du 2026-08-01).
 *
 * 🔴 Défaut P0 : l'alerte remonte sur /qualiopi/a-traiter, la TOUTE PREMIÈRE
 * page que Will (non technicien) ouvre. La version d'origine (dans
 * `qualiopi-formation-engine-worker.ts`) titrait « Job IA en échec (dead
 * letter queue) » (jargon BullMQ pur) et interpolait l'UUID brut de la
 * formation + `err.message` (trace JS/BullMQ) dans le champ affiché à
 * l'écran — rien de tout ça n'est actionnable pour un non-technicien.
 *
 * Extrait dans son propre module (plutôt que laissé dans le worker) pour
 * deux raisons :
 *  1. `qualiopi-formation-engine-worker.ts` importe toute la chaîne IA
 *     (provider Anthropic, cost-tracker, prompts...) qui tire elle-même du
 *     code incompatible avec l'environnement de test Vitest (résolution de
 *     module next-auth/next/server) — importer ce fichier depuis un test
 *     fait planter la collecte AVANT même d'exécuter un test.
 *  2. Ces deux fonctions n'ont besoin que de Prisma : les isoler les rend
 *     testables sans mocker toute la chaîne du worker.
 */

import { prisma } from "@/lib/prisma";

/**
 * Résout un nom de formation lisible pour l'alerte « job IA en échec ».
 * Fail-soft : si la formation n'existe plus ou que la lecture échoue, retombe
 * sur un libellé générique plutôt que d'exposer l'UUID à l'écran — le détail
 * technique de l'échec est déjà loggé côté serveur par l'appelant
 * (`console.error` dans le worker, avant l'appel à cette fonction).
 */
export async function resoudreNomFormationPourAlerte(formationId: string): Promise<string> {
  try {
    const formation = await prisma.formation.findUnique({
      where: { id: formationId },
      select: { titre: true },
    });
    return formation?.titre ? `« ${formation.titre} »` : "une formation";
  } catch (e) {
    console.error(
      "[qualiopi:engine] résolution titre formation (alerte job_ia_echoue) fail-soft:",
      e instanceof Error ? e.message : String(e),
    );
    return "une formation";
  }
}

/**
 * Construit le titre/message de l'alerte « job IA en échec » — ne prend
 * délibérément PAS `err` en paramètre : le contrat est qu'aucune trace
 * technique (BullMQ, JS) ne peut se retrouver dans le message affiché sur
 * /qualiopi/a-traiter.
 */
export function construireAlerteJobIaEchoue(
  nomFormation: string,
  attemptsMade: number,
): { titre: string; message: string } {
  return {
    titre: "Génération IA d'une formation en échec",
    message:
      `La génération du contenu de ${nomFormation} a échoué après ${attemptsMade} ` +
      `tentative(s) — contactez le support si ça persiste.`,
  };
}
