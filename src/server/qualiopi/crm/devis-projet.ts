/**
 * Le LIEN entre un devis et le projet d'où il a été ouvert (chantier visio,
 * PR 7 ; table `projet_devis`, PR 2).
 *
 * Le lien sert à savoir à quel projet appartient un devis : « Devis liés » de
 * la page du projet, et l'aide au devis (« Ce que le client a dit ») à côté du
 * formulaire. Il n'écrit RIEN d'autre : pas de `PreRemplissage` (décision de
 * Will du 29/09, option A — le devis s'ouvre vide).
 *
 * ⚠️ Toujours appelé DANS la transaction qui crée le devis : si le numéro
 * entre en collision (P2002) et que `withNumberRetry` rejoue, la transaction
 * annulée n'a laissé AUCUN lien orphelin (garde
 * `src/server/actions/qualiopi/__tests__/une-collision-de-numero-ne-laisse-aucune-trace-orpheline.spec.ts`).
 * Les clés composées « du même client » (SQL brut) refusent en base un projet
 * ou un devis d'une autre fiche.
 *
 * Module sans `use server` : il n'exporte que des fonctions qui reçoivent
 * leur client Prisma (transaction), jamais une action appelable du navigateur.
 */

import type { Prisma } from "../../../../prisma/generated/client";

type Tx = Prisma.TransactionClient;

/** Règle unique du dossier client (le circuit visio la lit aussi, sans ce domaine). */
export { projetOuvrableDuClient } from "@/features/dossier-client/projet-ouvrable";

/** Lie un devis tout juste créé à son projet (même transaction). */
export async function lierDevisAuProjet(
  tx: Pick<Tx, "projetDevis">,
  a: {
    readonly devisId: string;
    readonly projetId: string;
    readonly clientId: string;
    readonly lieParId: string | null;
  },
): Promise<void> {
  await tx.projetDevis.create({
    data: { devisId: a.devisId, projetId: a.projetId, clientId: a.clientId, lieParId: a.lieParId },
  });
}

/**
 * Une RÉVISION reste dans le projet de la version qu'elle remplace (même
 * transaction que sa création). Sans lien d'origine : rien.
 */
export async function recopierLienProjet(
  tx: Pick<Tx, "projetDevis">,
  a: {
    readonly ancienDevisId: string;
    readonly nouveauDevisId: string;
    readonly lieParId: string | null;
  },
): Promise<void> {
  const lien = await tx.projetDevis.findUnique({
    where: { devisId: a.ancienDevisId },
    select: { projetId: true, clientId: true },
  });
  if (lien === null) return;
  await tx.projetDevis.create({
    data: {
      devisId: a.nouveauDevisId,
      projetId: lien.projetId,
      clientId: lien.clientId,
      lieParId: a.lieParId,
    },
  });
}
