/**
 * Étape « écritures » de l'envoi d'un devis — MODULE NON BRANCHÉ (lot B2, PR 1).
 *
 * Reprend À L'IDENTIQUE le comportement de la fin de `sendDevisAction` (§ 6 « Écritures ») :
 *   1. `updateMany` gardé par `statut brouillon` + `updatedAt` : un enregistrement du brouillon
 *      survenu entre la lecture et l'écriture fait tomber le compte à 0 ; on lève alors ;
 *   2. client `prospect | perdu` → `devis_envoye` (jamais de rétrogradation d'un client avancé) ;
 *   3. clôture de la version remplacée (`cloreVersionRemplacee`) ;
 *   4. événement « devis émis » (`emettreDevisEmis`), dans la MÊME transaction.
 *
 * Tout passe par le `tx` reçu : si l'appelant annule sa transaction, rien n'est écrit.
 *
 * ⚠️ Volontairement écrit À CÔTÉ de `src/server/actions/qualiopi/devis.ts` (modifié en parallèle
 * par d'autres lots) : aujourd'hui il y a DEUX copies de cette étape. `sendDevisAction` sera
 * branchée sur cette fonction dans la PR suivante, qui supprimera le doublon ; la clé du verrou
 * `devis.envoi:` (aujourd'hui répétée dans `sendDevisAction`, la remise en main propre et
 * `lien-a-l-envoi.ts`) sera alors extraite en UNE seule fonction.
 *
 * Cliquet : cette fonction figure, par fichier ET par nom, dans `fonctionsSurTxDeLAppelant` de
 * `scripts/gates/cliquet-ecrivains.ts` ; tout appel doit recevoir le `tx` de sa transaction.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { emettreDevisEmis } from "@/server/partners-sync/producteurs/devis";
import { cloreVersionRemplacee } from "./version-remplacee";

export interface EntreeMarquerDevisEnvoye {
  devisId: string;
  clientId: string;
  numero: string;
  /** Version du brouillon telle qu'elle a été lue : l'écriture exige qu'elle n'ait pas bougé. */
  updatedAt: Date;
  /** Clé R2 stable du PDF (jamais l'URL signée). */
  pdfCle: string;
  documentGenereId: string;
  replacesDevisId: string | null;
  replacesDevis: { statut: string; documentGenereId: string | null } | null;
}

export async function marquerDevisEnvoye(
  tx: Prisma.TransactionClient,
  e: EntreeMarquerDevisEnvoye,
): Promise<void> {
  const marque = await tx.devis.updateMany({
    where: { id: e.devisId, statut: "brouillon", updatedAt: e.updatedAt },
    data: {
      statut: "envoye",
      sentAt: new Date(),
      fichierPdfUrl: e.pdfCle,
      // Rattachement à la pièce numérotée : c'est lui qui permet à la signature de désigner CE devis.
      documentGenereId: e.documentGenereId,
    },
  });
  if (marque.count !== 1) {
    throw new Error(`devis non passé à « envoye » (${marque.count} ligne modifiée)`);
  }
  await tx.client.updateMany({
    where: { id: e.clientId, statut: { in: ["prospect", "perdu"] } },
    data: { statut: "devis_envoye" },
  });
  await cloreVersionRemplacee(tx, {
    replacesDevisId: e.replacesDevisId,
    documentGenereIdRemplace: e.replacesDevis?.documentGenereId,
    numero: e.numero,
    statutRemplace: e.replacesDevis?.statut,
  });
  await emettreDevisEmis(tx, e.devisId);
}
