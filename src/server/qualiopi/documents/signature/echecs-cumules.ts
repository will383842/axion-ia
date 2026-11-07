/**
 * Échecs de saisie de code CUMULÉS par (pièce, partie) — signature renforcée du devis (audit sécurité).
 *
 * Pourquoi : le plafond de 5 essais est PAR CODE. Un attaquant qui détient le lien (mais pas la boîte
 * e-mail) pouvait, au 5e échec, redemander un code et repartir à zéro : le blocage de 15 minutes ne
 * valait que pour le code épuisé. Ce compteur, lui, appartient à la PIÈCE : émettre un nouveau code ne le
 * touche pas. Il ne retombe qu'à la signature réussie ou 24 h après le premier échec de la fenêtre.
 *
 * Au `max`-ième échec de la fenêtre, la pièce est bloquée (`bloqueJusquA`) : aucun code accepté ni émis.
 * Une fois le blocage écoulé, le compteur reste au-dessus du plafond : le prochain échec re-bloque aussitôt
 * (un essai par blocage, au lieu de dix).
 *
 * Atomicité : l'incrément est un `updateMany` conditionnel (jamais lire-puis-écrire). Aucune horloge cachée.
 */
import { prisma } from "@/lib/prisma";
import type { PartieSignataire } from "./document-signature-hash";

export interface PlafondCumule {
  readonly max: number;
  readonly fenetreMs: number;
}

/** Instant jusqu'auquel la pièce est bloquée par le compteur cumulé, ou `null`. */
export async function blocageCumule(
  documentGenereId: string,
  partie: PartieSignataire,
  maintenant: Date,
): Promise<Date | null> {
  const ligne = await prisma.documentSignatureEchecs.findUnique({
    where: { documentGenereId_partie: { documentGenereId, partie } },
    select: { bloqueJusquA: true },
  });
  return ligne?.bloqueJusquA != null && ligne.bloqueJusquA.getTime() > maintenant.getTime()
    ? ligne.bloqueJusquA
    : null;
}

/**
 * Enregistre UN échec. Rend `true` quand la pièce est (désormais) bloquée.
 */
export async function enregistrerEchecCumule(input: {
  readonly documentGenereId: string;
  readonly partie: PartieSignataire;
  readonly maintenant: Date;
  readonly plafond: PlafondCumule;
  readonly blocageMs: number;
}): Promise<boolean> {
  const { documentGenereId, partie, maintenant, plafond } = input;
  const debutValide = new Date(maintenant.getTime() - plafond.fenetreMs);
  const cle = { documentGenereId, partie };

  // 1. Fenêtre courante : incrément atomique.
  let n = (
    await prisma.documentSignatureEchecs.updateMany({
      where: { ...cle, fenetreDebutAt: { gt: debutValide } },
      data: { echecs: { increment: 1 } },
    })
  ).count;
  // 2. Fenêtre échue : on repart à 1 (et le blocage échu est effacé).
  if (n === 0) {
    n = (
      await prisma.documentSignatureEchecs.updateMany({
        where: { ...cle, fenetreDebutAt: { lte: debutValide } },
        data: { echecs: 1, fenetreDebutAt: maintenant, bloqueJusquA: null },
      })
    ).count;
  }
  // 3. Aucune ligne : première défaillance. Deux créations simultanées : l'une échoue sur l'unicité
  //    (P2002) et retombe sur l'incrément.
  if (n === 0) {
    try {
      await prisma.documentSignatureEchecs.create({
        data: { ...cle, echecs: 1, fenetreDebutAt: maintenant },
      });
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code !== "P2002") throw err;
      await prisma.documentSignatureEchecs.updateMany({
        where: cle,
        data: { echecs: { increment: 1 } },
      });
    }
  }

  // Blocage conditionné sur le compteur EN BASE, pas sur une lecture antérieure.
  const bloque = await prisma.documentSignatureEchecs.updateMany({
    where: { ...cle, echecs: { gte: plafond.max } },
    data: { bloqueJusquA: new Date(maintenant.getTime() + input.blocageMs) },
  });
  return bloque.count > 0;
}

/** Signature réussie : le compteur de la pièce repart de zéro. Ne lève pas si rien n'est à effacer. */
export async function reinitialiserEchecsSignature(
  documentGenereId: string,
  partie: PartieSignataire,
): Promise<void> {
  await prisma.documentSignatureEchecs.deleteMany({ where: { documentGenereId, partie } });
}
