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
import { recomputeTauxPresence } from "@/server/qualiopi/presence/presence-service";

/** Longueur minimale d'un motif. Un mot ne dit pas ce qui s'est passé. */
export const MOTIF_MIN = 10;

export type ResultatRevocation =
  | {
      ok: true;
      enrollmentId: string | null;
      emargementRetombe: boolean;
      /** La durée réalisée du créneau a été remise à 0 — cf. le bloc « la présence ». */
      presenceRetombee: boolean;
    }
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
    // `creneauId` : la signature sait quel créneau elle couvrait — c'est lui dont
    // il faut défaire l'effet, cf. le bloc « la présence » plus bas.
    select: {
      id: true,
      revokedAt: true,
      enrollmentId: true,
      creneauId: true,
      selfHash: true,
    },
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
  let presenceRetombee = false;

  await prisma.$transaction(async (tx) => {
    await tx.emargementSignature.update({
      where: { id: signatureId },
      // Ni `selfHash` ni `prevHash` ne sont touchés : voir l'en-tête.
      data: { revokedAt: now, revokedById, revokedMotif: motifPropre },
    });

    // 🔴 2026-08-24 — LA RÉVOCATION RETIRAIT LA PREUVE ET GARDAIT SON EFFET.
    //
    // `signerCreneau` écrit, dans SA transaction :
    // `presenceCreneau.update({ dureeRealiseeMinutes: dureePrevueMinutes,
    // present: true })` (signature-service.ts:484). Défaire la signature sans
    // défaire cela laissait la chaîne entière intacte derrière une preuve
    // retirée :
    //
    //   `dureeRealiseeMinutes` → `recomputeTauxPresence` → `tauxPresencePct`
    //   → `classifierPresence` (attestation-service.ts:209) → RÉSULTAT de
    //   l'attestation, et heures du certificat de réalisation.
    //
    // Une inscription dont TOUTES les signatures étaient révoquées gardait donc
    // un taux au-dessus du seuil, une attestation « totale », et un certificat
    // déclarant des heures que plus rien ne prouvait. Le geste est offert à
    // l'auditrice elle-même (`mode-auditeur/emargement/page.tsx:154`) : elle
    // révoquait, et le document continuait de lui affirmer le contraire.
    //
    // 🔑 C'est le MÊME raisonnement que celui appliqué à l'inscription vingt
    // lignes plus bas — « plus aucune signature vivante ⇒ retomber » — oublié un
    // niveau plus bas. Le même travers que l'en-tête de ce fichier confesse déjà
    // pour la garde du maillon interne : traiter un cas sans regarder la classe.
    if (signature.creneauId !== null) {
      const restantesSurCreneau = await tx.emargementSignature.count({
        where: { creneauId: signature.creneauId, revokedAt: null },
      });
      if (restantesSurCreneau === 0) {
        const creneau = await tx.presenceCreneau.findUnique({
          where: { id: signature.creneauId },
          select: { importId: true },
        });
        // ⚠️ EXCEPTION SYMÉTRIQUE DE CELLE DE LA SIGNATURE. Un créneau issu d'un
        // relevé de connexion tient sa vérité de l'import (D.6313-3-1), et
        // `signerCreneau` refuse déjà d'y toucher (`if (ctx.importId === null)`).
        // La révocation refuse de même : écraser cette durée détruirait une
        // mesure que rien ne peut reconstituer.
        if (creneau !== null && creneau.importId === null) {
          // On ne remet PAS `present: false` ici : `recomputeTauxPresence` le
          // re-dérive de la durée (seuil 50 % du prévu, presence-service.ts:144).
          // Écrire les deux ferait diverger deux sources pour un même fait.
          await tx.presenceCreneau.update({
            where: { id: signature.creneauId },
            data: { dureeRealiseeMinutes: 0 },
          });
          presenceRetombee = true;
        }
      }
    }

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

  // 🔑 POST-COMMIT, comme `signerCreneau` le fait pour l'effet inverse. Sans ce
  // recalcul, `dureeRealiseeMinutes` retombe mais `tauxPresencePct` — que lit
  // `classifierPresence` — garde sa valeur d'avant : la moitié du correctif
  // laisserait l'attestation fausse.
  //
  // Best-effort et tracé, jamais fatal : la révocation EST déjà persistée et
  // c'est elle qui compte. Un taux est recalculable ; une révocation annulée par
  // une exception de recalcul ne le serait pas.
  if (presenceRetombee && enrollmentId !== null) {
    try {
      await recomputeTauxPresence(enrollmentId);
    } catch (err) {
      console.error(
        `[revocation-emargement] taux de présence NON recalculé pour ${enrollmentId} — ` +
          "la durée réalisée est bien retombée à 0, mais `tauxPresencePct` garde sa " +
          "valeur d'avant et l'attestation en dépend :",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { ok: true, enrollmentId, emargementRetombe, presenceRetombee };
}
