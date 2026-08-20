/**
 * Révoquer une signature d'émargement — priver une preuve de sa valeur, sans la
 * détruire.
 *
 * ## Le défaut que ce module ferme
 *
 * 🔴 `D3-3-04` (audit E2E 2026-08-20). **Aucune surface ne révoquait une
 * signature d'émargement.** Une signature apposée sur le mauvais nom — le
 * stagiaire d'à côté qui signe sur la ligne de son voisin, la tablette passée
 * dans le désordre — était **définitive, et scellée**.
 *
 * Le schéma prévoyait pourtant tout : `revokedAt`, `revokedById`,
 * `revokedMotif`. Les huit lecteurs du registre filtrent déjà `revokedAt: null`.
 * **Personne n'écrivait ces colonnes.** C'est la troisième forme récurrente de
 * cet audit : l'outil est écrit, le câblage manque.
 *
 * ## Ce qu'une révocation N'EST PAS
 *
 * ⚠️ Ce n'est pas une suppression. La ligne reste au registre, avec son
 * empreinte, son chaînage `prevHash`/`selfHash` et son horodatage. Effacer
 * romprait la chaîne de hachage — et une chaîne rompue ne prouve plus rien,
 * pas même les signatures valides qui la suivent.
 *
 * 🔑 **Les hachages ne sont donc PAS recalculés.** `selfHash` scelle ce qui a
 * été signé ce jour-là ; la révocation dit que cette signature ne fait plus foi,
 * elle ne réécrit pas l'histoire. Un auditeur qui relit la chaîne la trouve
 * intacte, et voit la révocation par-dessus, motivée et datée.
 *
 * ## Ce qu'une révocation DOIT entraîner
 *
 * 🔴 Le point qui distingue un vrai correctif d'un demi : si l'inscription n'a
 * plus **aucune** signature vivante, `emargementSigneAt` doit retomber. Sans
 * cela, `conformite-service.ts` continuerait de compter cette inscription comme
 * « émargement réellement signé » à l'indicateur `off.12`, et le certificat de
 * réalisation resterait émettable sur une preuve qu'on vient de retirer.
 *
 * Révoquer sans cet effet aurait produit exactement le défaut d'origine sous un
 * autre nom : une colonne écrite que rien ne lit.
 */

import { prisma } from "@/lib/prisma";

/** Longueur minimale d'un motif. Un mot ne dit pas ce qui s'est passé. */
export const MOTIF_MIN = 10;

export type ResultatRevocation =
  | { ok: true; enrollmentId: string | null; emargementRetombe: boolean }
  | {
      ok: false;
      raison: "introuvable" | "deja_revoquee" | "motif_insuffisant" | "maillon_interne";
      message: string;
    };

const MESSAGES = {
  introuvable: "Cette signature est introuvable.",
  deja_revoquee: "Cette signature a déjà été révoquée.",
  motif_insuffisant: `Le motif doit être écrit, et faire au moins ${MOTIF_MIN} caractères : c'est lui que l'auditeur lira pour comprendre pourquoi la preuve a été retirée.`,
  maillon_interne:
    "Cette signature n'est pas la dernière apposée pour cette inscription : la révoquer romprait le chaînage et ferait apparaître la feuille comme FALSIFIÉE au contrôle. Révoquez d'abord les signatures postérieures, puis re-signez dans l'ordre.",
} as const;

/**
 * Prive d'effet une signature d'émargement.
 *
 * @param signatureId la ligne du registre.
 * @param motif POURQUOI — obligatoire, et écrit en toutes lettres.
 * @param revokedById l'admin qui pose l'acte, tel qu'il sera lu au registre.
 */
export async function revoquerSignature(
  signatureId: string,
  motif: string,
  revokedById: string,
  now: Date = new Date(),
): Promise<ResultatRevocation> {
  const motifPropre = motif.trim();
  // 🔑 Le motif est vérifié AVANT toute lecture : une révocation sans raison
  // écrite ne vaut pas mieux que la signature erronée qu'elle retire. Le dépôt
  // tient déjà cette règle sur l'annulation de pièce (`annuleeMotif`, contrainte
  // CHECK) — ici la garde est applicative, faute de contrainte en base.
  if (motifPropre.length < MOTIF_MIN) {
    return { ok: false, raison: "motif_insuffisant", message: MESSAGES.motif_insuffisant };
  }

  const signature = await prisma.emargementSignature.findUnique({
    where: { id: signatureId },
    // `selfHash` sert à chercher un successeur : c'est lui que le maillon suivant
    // scelle dans son `prevHash`.
    select: { id: true, revokedAt: true, enrollmentId: true, selfHash: true },
  });
  if (signature === null) {
    return { ok: false, raison: "introuvable", message: MESSAGES.introuvable };
  }
  // ⚠️ Idempotence explicite plutôt que silencieuse : re-révoquer écraserait le
  // motif et la date d'origine — c'est-à-dire la trace de qui a décidé, et
  // quand. On refuse, et on le dit.
  if (signature.revokedAt !== null) {
    return { ok: false, raison: "deja_revoquee", message: MESSAGES.deja_revoquee };
  }

  // 🔴 LE MAILLON DOIT ÊTRE LE DERNIER — sinon la révocation FABRIQUE une preuve
  // de falsification. (Défaut de mon propre correctif, trouvé le 2026-08-20 par
  // le cahier `D3-1`.)
  //
  // Chaque signature scelle dans `prevHash` l'empreinte de la précédente. Toutes
  // les lectures de la chaîne — `signature-service.ts` pour trouver le maillon
  // précédent, `dossier-session.ts` pour la vérifier — filtrent `revokedAt: null`,
  // comme les deux index uniques partiels de PostgreSQL.
  //
  // Révoquer un maillon INTERMÉDIAIRE laisse donc le suivant pointer vers une
  // empreinte devenue invisible : `verifierChaine` conclut à une
  // `rupture_chainage`, et le dossier remis au certificateur déclare la feuille
  // FALSIFIÉE. Sur une feuille intacte.
  //
  // 🔑 Cette garde existait DÉJÀ, au mot près, dans le domaine jumeau
  // (`documents/signature/document-signature-service.ts`, refus
  // `revocation_maillon_interne_interdite`). Je ne l'avais pas répliquée : j'ai
  // traité un cas sans regarder la classe — exactement le travers que cet audit
  // poursuit.
  const successeur = await prisma.emargementSignature.count({
    where: {
      enrollmentId: signature.enrollmentId,
      revokedAt: null,
      prevHash: signature.selfHash,
    },
  });
  if (successeur > 0) {
    return { ok: false, raison: "maillon_interne", message: MESSAGES.maillon_interne };
  }

  const enrollmentId = signature.enrollmentId;
  let emargementRetombe = false;

  await prisma.$transaction(async (tx) => {
    await tx.emargementSignature.update({
      where: { id: signatureId },
      // Ni `selfHash` ni `prevHash` ne sont touchés : voir l'en-tête.
      data: { revokedAt: now, revokedById, revokedMotif: motifPropre },
    });

    if (enrollmentId === null) return;

    // 🔴 Plus AUCUNE signature vivante ⇒ l'inscription n'a plus d'émargement.
    // Compté DANS la transaction : hors d'elle, une signature posée entre-temps
    // ferait retomber `emargementSigneAt` alors qu'une preuve existe.
    const restantes = await tx.emargementSignature.count({
      where: { enrollmentId, revokedAt: null },
    });
    if (restantes === 0) {
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { emargementSigneAt: null },
      });
      emargementRetombe = true;
    }
  });

  return { ok: true, enrollmentId, emargementRetombe };
}
