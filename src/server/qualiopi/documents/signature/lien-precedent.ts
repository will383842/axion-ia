/**
 * V2-P-6 — RENDRE le lien de signature précédent quand le lien neuf n'arrive jamais.
 *
 * Une relance du contrat-cadre (F18, F45) émet un lien neuf au moment de l'envoi, et
 * l'émission révoque le précédent (`creerTokenDocument`, un seul jeton vivant par pièce et
 * partie). Si l'e-mail qui porte le lien neuf ne part pas — file injoignable à l'enfilage,
 * ou relance retenue au départ —, le formateur n'a plus aucun lien valable : celui qu'il a
 * reçu est révoqué, le neuf ne lui parviendra pas. Ce module défait l'échange :
 *   · `supprimer` (le passage, l'e-mail n'a jamais été enfilé) : la ligne du lien neuf
 *     disparaît, comme s'il n'avait pas été émis ;
 *   · `revoquer` (le départ, l'e-mail a existé) : le lien neuf est révoqué, avec son motif.
 * Dans les deux cas, le lien remplacé PAR CE lien neuf (même instant de révocation que sa
 * création, posé dans la même transaction), et lui seul, redevient vivant, s'il n'a pas
 * expiré ni été révoqué par l'administrateur. Jetons créés avant le correctif : rien n'est
 * rendu. Sans lien précédent rendable, RIEN ne bouge : le lien neuf reste le seul vivant
 * (mieux qu'aucun).
 *
 * Module neutre (ni `server-only`, ni Next) : il est sur le trajet du worker d'e-mails.
 * Lève si la base ne répond pas (l'appelant décide).
 */

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Le motif posé par `creerTokenDocument` sur le lien qu'un lien neuf remplace. Copie
 * LOCALE (le module des jetons n'a rien à faire sur le trajet du worker) ; l'égalité est
 * vérifiée par `lien-precedent.spec.ts`.
 */
export const MOTIF_REMPLACE = "Remplacé par un nouveau lien";

export const MOTIF_RELANCE_NON_PARTIE = "Relance non partie : le lien précédent reste valable";

/** Le jeton d'un lien `…/portail/signer/<jeton>`, ou `null`. Jamais journalisé. */
export function jetonDuLienSignature(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const morceaux = u.pathname.split("/").filter(Boolean);
    const i = morceaux.lastIndexOf("signer");
    if (i < 1 || morceaux[i - 1] !== "portail" || i !== morceaux.length - 2) return null;
    const jeton = decodeURIComponent(morceaux[i + 1] ?? "");
    return jeton === "" ? null : jeton;
  } catch {
    return null;
  }
}

/** Même empreinte que `token-document.ts` (SHA-256 hexadécimal du jeton). */
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

/** La ligne du lien porté par une URL de signature, ou `null`. */
export async function ligneDuLien(url: unknown): Promise<{
  id: string;
  documentGenereId: string;
  partie: string;
  createdAt: Date;
  revokedAt: Date | null;
} | null> {
  const jeton = jetonDuLienSignature(url);
  if (jeton === null) return null;
  return prisma.documentSignatureToken.findUnique({
    where: { tokenHash: empreinteJeton(jeton) },
    select: { id: true, documentGenereId: true, partie: true, createdAt: true, revokedAt: true },
  });
}

/**
 * Défait l'émission du lien porté par `url` et rend vivant celui qu'IL a remplacé : le jeton
 * dont `revokedAt` est égal à `createdAt` du neuf (même instant, même transaction dans
 * `creerTokenDocument`), et lui seul — exactement un candidat, sinon rien n'est rendu.
 * Rend `true` si le lien précédent a été rendu.
 */
export async function rendreLienPrecedent(
  url: unknown,
  mode: "supprimer" | "revoquer",
  maintenant: Date = new Date(),
): Promise<boolean> {
  const neuf = await ligneDuLien(url);
  if (neuf === null || neuf.revokedAt !== null) return false;
  const conditions = {
    documentGenereId: neuf.documentGenereId,
    partie: neuf.partie as never,
    id: { not: neuf.id },
    revokedMotif: MOTIF_REMPLACE,
    revokedById: null,
    // EXACTEMENT l'instant de création du neuf : posé dans la même transaction que la
    // révocation par creerTokenDocument. Un lien révoqué autrement, ou remplacé par un
    // autre lien, ne correspond pas (audit S1).
    revokedAt: neuf.createdAt,
    expiresAt: { gt: maintenant },
  };
  const candidats = await prisma.documentSignatureToken.findMany({
    where: conditions,
    select: { id: true },
    take: 2,
  });
  // Aucun lien remplacé par CE lien neuf, ou ambiguïté : rien n'est rendu.
  if (candidats.length !== 1) return false;
  const precedent = candidats[0]!;
  // Une partie déjà signataire n'a plus besoin d'aucun lien.
  const signee = await prisma.documentSignature.count({
    where: {
      documentGenereId: neuf.documentGenereId,
      partie: neuf.partie as never,
      revokedAt: null,
    },
  });
  if (signee > 0) return false;
  await prisma.$transaction(async (tx) => {
    // L'ordre compte : un seul jeton VIVANT par (pièce, partie) — index unique partiel.
    // Le neuf n'est retiré que s'il est encore vivant (une signature ou une révocation par
    // l'administrateur entre-temps l'emportent).
    const retire =
      mode === "supprimer"
        ? await tx.documentSignatureToken.deleteMany({
            where: { id: neuf.id, revokedAt: null, usedAt: null },
          })
        : await tx.documentSignatureToken.updateMany({
            where: { id: neuf.id, revokedAt: null },
            data: { revokedAt: maintenant, revokedMotif: MOTIF_RELANCE_NON_PARTIE },
          });
    if (retire.count !== 1) throw new LienDejaUtilise();
    const rendu = await tx.documentSignatureToken.updateMany({
      where: { ...conditions, id: precedent.id },
      data: { revokedAt: null, revokedMotif: null },
    });
    if (rendu.count !== 1) throw new LienDejaUtilise();
  });
  return true;
}

class LienDejaUtilise extends Error {
  constructor() {
    super("[lien-precedent] le lien neuf a changé entre-temps : rien n'est rendu");
    this.name = "LienDejaUtilise";
  }
}
