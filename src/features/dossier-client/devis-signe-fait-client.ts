/**
 * « Un prospect passe en client lorsqu'un devis est signé » (décision de Will, 2026-11-04).
 *
 * Appelé par chacun des trois écrivains de `statut: "accepte"` sur un devis (signature intégrale
 * d'une pièce, webhook DocuSeal, acceptation depuis la console), APRÈS le COMMIT de leur
 * transaction d'acceptation, HORS transaction, avec le client Prisma ordinaire.
 *
 * Pourquoi pas dans la transaction (défaut B1 d'audit) : canal Axion Partners ouvert, la
 * transaction PostgreSQL est interactive ; une requête en erreur l'INVALIDE entièrement, et un
 * `try/catch` qui avale l'erreur n'y change rien : le COMMIT devient un ROLLBACK silencieux. Le
 * devis signé resterait `envoye`, l'événement `devis.signe` serait perdu et le webhook répondrait
 * 200 sans réessai. Ici, une erreur de montée ne peut donc plus toucher l'acceptation.
 *
 *   · la règle de montée est celle de la case « facture hors console » (`statutApresFactureHorsConsole`,
 *     jamais recopiée) : prospect et devis envoyé deviennent client actif ; un client actif,
 *     inactif ou perdu ne bouge JAMAIS tout seul ;
 *   · la montée est GARDÉE (`updateMany` sur le statut lu) et son écriture va ENSEMBLE avec sa trace
 *     `client.devient_client` (même forme que la PR #1695, `origine` en plus) dans une petite
 *     transaction : deux chemins concurrents ou un rejeu n'écrivent ni deux fois ni deux traces ;
 *   · le devis est relu : seul un devis RÉELLEMENT `accepte` fait monter sa fiche ;
 *   · devis restés sur une fiche ABSORBÉE par fusion (les pièces émises ne bougent pas) : la fiche
 *     vivante est l'absorbante ; on la fait monter aussi (fusions non défaites, chaîne bornée) ;
 *   · fiche absente : on passe, la signature n'échoue pas pour autant ;
 *   · aucune suppression, aucun e-mail, aucune émission Axion Partners (le statut commercial n'est
 *     pas un champ transmis).
 *
 * Panne : une erreur est capturée (Sentry) par devis et AVALÉE.
 * Limite reconnue : la montée n'est PAS atomique avec l'acceptation. Si elle échoue, ou si le
 * processus s'arrête entre le COMMIT et la montée, un rejeu du webhook sur un devis déjà accepté
 * ne la refait pas ; seul Sentry le dit. « Éditer » la fiche ou la case « facture hors console »
 * rattrapent à la main.
 */

import * as Sentry from "@sentry/nextjs";

import type { PrismaClient } from "../../../prisma/generated/client";
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
async function fichesAFaireMonter(db: PrismaClient, clientId: string): Promise<string[]> {
  const vues = new Set<string>([clientId]);
  let front = [clientId];
  for (let tour = 0; tour < TOURS_FUSION_MAX && front.length > 0; tour += 1) {
    const fusions = await db.clientFusion.findMany({
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
  db: PrismaClient,
  devisIds: readonly string[],
  options: OptionsDevisSigne,
): Promise<number> {
  let montees = 0;
  for (const devisId of new Set(devisIds)) {
    try {
      const devis = await db.devis.findUnique({
        where: { id: devisId },
        select: { clientId: true, numero: true, statut: true },
      });
      if (devis === null || devis.statut !== "accepte") continue;
      for (const ficheId of await fichesAFaireMonter(db, devis.clientId)) {
        const fiche = await db.client.findUnique({
          where: { id: ficheId },
          select: { statut: true },
        });
        if (fiche === null) continue;
        const apres = statutApresFactureHorsConsole(fiche.statut);
        if (apres === null) continue;
        // Gardé sur le statut lu : le perdant d'une course (ou un rejeu) ne trace rien.
        // L'écriture et sa trace vivent et meurent ensemble.
        const ecrit = await db.$transaction(async (t) => {
          const maj = await t.client.updateMany({
            where: { id: ficheId, statut: fiche.statut },
            data: { statut: apres },
          });
          if (maj.count === 0) return false;
          await t.activityLog.create({
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
          return true;
        });
        if (!ecrit) continue;
        montees += 1;
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "devis_signe_fait_client" } });
    }
  }
  return montees;
}
