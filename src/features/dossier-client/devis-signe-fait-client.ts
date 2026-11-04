/**
 * « Un prospect passe en client lorsqu'un devis est signé » (décision de Will, 2026-11-04).
 *
 * Appelé DANS la transaction de chacun des trois écrivains de `statut: "accepte"` sur un devis
 * (signature intégrale d'une pièce, webhook DocuSeal, acceptation depuis la console), APRÈS
 * `emettreDevisSigne`, qu'il ne touche pas. Il reçoit le `tx` de l'appelant.
 *
 *   · la règle de montée est celle de la case « facture hors console » (`statutApresFactureHorsConsole`,
 *     jamais recopiée) : prospect et devis envoyé deviennent client actif ; un client actif,
 *     inactif ou perdu ne bouge JAMAIS tout seul ;
 *   · la montée est GARDÉE (`updateMany` sur le statut lu) : deux chemins concurrents ou un rejeu
 *     n'écrivent ni deux fois ni deux traces — la trace `client.devient_client` (même forme que la
 *     PR #1695, `origine` en plus) n'est écrite que si la ligne a réellement changé ;
 *   · le devis est relu dans `tx` : seul un devis RÉELLEMENT `accepte` fait monter sa fiche ;
 *   · devis restés sur une fiche ABSORBÉE par fusion (les pièces émises ne bougent pas) : la fiche
 *     vivante est l'absorbante ; on la fait monter aussi (fusions non défaites, chaîne bornée) ;
 *   · fiche absente : on passe, la signature n'échoue pas pour autant ;
 *   · aucune suppression, aucun e-mail, aucune émission Axion Partners (le statut commercial n'est
 *     pas un champ transmis).
 *
 * Panne : une erreur est capturée (Sentry) et AVALÉE, pour que l'acceptation du devis ne tombe pas
 * pour un statut de fiche. Limite connue : dans une transaction PostgreSQL, une requête en erreur
 * invalide la transaction entière ; les requêtes d'ici sont des lectures/écritures par clé, et la
 * logique (fiche absente, statut sans montée) ne lève jamais.
 */

import * as Sentry from "@sentry/nextjs";

import type { Prisma } from "../../../prisma/generated/client";
import { statutApresFactureHorsConsole } from "./facture-hors-console";

export type OrigineDevisSigne = "signature_complete" | "docuseal" | "console";

export interface OptionsDevisSigne {
  readonly origine: OrigineDevisSigne;
  /** L'administrateur qui agit (console) ; `null` pour une signature ou un webhook. */
  readonly adminUserId?: string | null;
}

/** Profondeur maximale d'une chaîne de fusions (comme `fichesCouvertes`). */
const TOURS_FUSION_MAX = 5;

/** La fiche du devis, puis ses absorbantes vivantes (fusions non défaites), sans doublon. */
async function fichesAFaireMonter(
  tx: Prisma.TransactionClient,
  clientId: string,
): Promise<string[]> {
  const vues = new Set<string>([clientId]);
  let front = [clientId];
  for (let tour = 0; tour < TOURS_FUSION_MAX && front.length > 0; tour += 1) {
    const fusions = await tx.clientFusion.findMany({
      where: { absorbeId: { in: front }, defaiteLe: null },
      select: { absorbantId: true },
    });
    front = fusions.map((f) => f.absorbantId).filter((id) => !vues.has(id));
    for (const id of front) vues.add(id);
  }
  return [...vues];
}

/** Rend le nombre de fiches montées en client. Ne lève jamais. */
export async function faireMonterLesFichesDesDevisSignes(
  tx: Prisma.TransactionClient,
  devisIds: readonly string[],
  options: OptionsDevisSigne,
): Promise<number> {
  let montees = 0;
  for (const devisId of new Set(devisIds)) {
    try {
      const devis = await tx.devis.findUnique({
        where: { id: devisId },
        select: { clientId: true, numero: true, statut: true },
      });
      if (devis === null || devis.statut !== "accepte") continue;
      for (const ficheId of await fichesAFaireMonter(tx, devis.clientId)) {
        const fiche = await tx.client.findUnique({
          where: { id: ficheId },
          select: { statut: true },
        });
        if (fiche === null) continue;
        const apres = statutApresFactureHorsConsole(fiche.statut);
        if (apres === null) continue;
        // Gardé sur le statut lu : le perdant d'une course (ou un rejeu) ne trace rien.
        const ecrit = await tx.client.updateMany({
          where: { id: ficheId, statut: fiche.statut },
          data: { statut: apres },
        });
        if (ecrit.count === 0) continue;
        await tx.activityLog.create({
          data: {
            adminUserId: options.adminUserId ?? null,
            action: "client.devient_client",
            targetType: "Client",
            targetId: ficheId,
            changes: {
              origine: `devis_signe:${options.origine}`,
              statutAvant: fiche.statut,
              statutApres: apres,
              numeroDevis: devis.numero,
            },
          },
        });
        montees += 1;
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "devis_signe_fait_client" } });
    }
  }
  return montees;
}
