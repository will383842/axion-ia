/**
 * Pièces dont une signature attend — SSOT partagé par la pastille et la page.
 *
 * ## Pourquoi ce module existe (revue visuelle 2026-08-03)
 *
 * 🔴 CONSTAT EN PRODUCTION. La pastille rouge de « À traiter » affichait **2**
 * pendant que la page disait « Rien à traiter — tout est à jour ». Les deux
 * chiffres sortaient pourtant du module qui promet, en tête de fichier, d'être
 * la source unique : « un badge qui ment une fois n'est plus jamais regardé ».
 *
 * L'écart venait d'un filtre appliqué d'un seul côté. La page retire les
 * pièces REMPLACÉES — une convention non signée alors qu'une autre, du même
 * type et sur la même session, l'est intégralement. Ce filtre a été ajouté à
 * la PAGE le 2026-08-01 ; le COMPTEUR est resté sur la requête brute.
 *
 * Cas réel : sur la session INVEST SUN, la convention `-009` est signée des
 * deux côtés, mais `-003` (la première, remplacée) et `-011` (une copie née
 * d'un clic sur « Convention » pour la télécharger) restaient `en_attente`.
 * Deux pièces — d'où le « 2 » permanent sur une console où il n'y avait
 * réellement rien à faire.
 *
 * Le filtre vit désormais ICI, et les deux appelants passent par lui. Poser le
 * même `where` à deux endroits est précisément ce qui a produit la panne : le
 * jour où l'un évolue, l'autre ment.
 *
 * ⚠️ Une pièce SANS session (lettre de mission, devis) n'est JAMAIS masquée :
 * rien ne permettrait d'affirmer qu'elle est remplacée.
 */

import { prisma } from "@/lib/prisma";
import type { DocumentType, DocumentStatutSignature } from "../../../../../prisma/generated/client";

/**
 * Le `where` des pièces en attente de signature — écrit une seule fois.
 *
 * Une FONCTION et pas une constante : Prisma attend un tableau mutable pour
 * `in`, et un objet figé (`as const`) est refusé à la compilation.
 */
/**
 * ⚠️ EXPORTÉE le 2026-08-19 (audit E2E, constat `D3-4-06`).
 *
 * Elle était privée, et c'est ce qui a permis la divergence : le moteur
 * d'alertes (`alertes/evaluateur.ts`, `regleSignatureEnAttente`) avait recopié
 * le filtre `statutSignature` **sans** `annuleeAt: null`. Résultat, chaque nuit,
 * une pièce annulée ressortait en alerte CRITIQUE et déclenchait un e-mail —
 * sur un document que l'organisme venait de déclarer sans valeur.
 *
 * 🔑 Le correctif n'est pas de recopier le filtre au bon endroit : c'est de
 * n'avoir qu'UN endroit. Tout nouveau consommateur doit appeler cette fonction,
 * jamais réécrire son prédicat.
 */
export function enAttente(): {
  statutSignature: { in: DocumentStatutSignature[] };
  annuleeAt: null;
} {
  // 🔴 `annuleeAt: null` — une pièce ANNULÉE ne réclame plus de signature.
  // Sans ce filtre, annuler une pièce erronée la laissait dans « À traiter »
  // et dans la pastille, à réclamer indéfiniment la signature d'un document
  // qu'on vient précisément de déclarer sans valeur.
  return { statutSignature: { in: ["partielle", "en_attente"] }, annuleeAt: null };
}

/**
 * Retire les pièces remplacées par une version intégralement signée du même
 * type sur la même session.
 *
 * Sur échec de lecture on n'ose PAS masquer : mieux vaut une ligne en trop
 * qu'une signature réellement due qui disparaît de l'écran.
 */
export async function retirerPiecesRemplacees<
  T extends { sessionId: string | null; type: DocumentType },
>(pieces: T[]): Promise<T[]> {
  const sessionIds = [
    ...new Set(pieces.map((p) => p.sessionId).filter((v): v is string => v !== null)),
  ];
  if (sessionIds.length === 0) return pieces;

  try {
    const signees = await prisma.documentGenere.findMany({
      where: {
        sessionId: { in: sessionIds },
        statutSignature: "signee",
        type: { in: [...new Set(pieces.map((p) => p.type))] },
      },
      select: { sessionId: true, type: true },
    });
    const couvert = new Set(signees.map((s) => `${s.sessionId}::${s.type}`));
    return pieces.filter((p) => p.sessionId === null || !couvert.has(`${p.sessionId}::${p.type}`));
  } catch {
    return pieces;
  }
}

/**
 * Liste détaillée pour la page « À traiter » (30 lignes au plus).
 *
 * `partielle` d'abord (quelqu'un a DÉJÀ signé — souvent le client : c'est le
 * contreseing de l'organisme qui bloque, donc TOI), puis `en_attente` (le lien
 * est émis, personne n'a signé — c'est le client qu'on relance).
 *
 * Stub-safe → [].
 */
export async function listerPiecesEnAttente() {
  let brutes;
  try {
    brutes = await prisma.documentGenere.findMany({
      where: enAttente(),
      orderBy: [{ statutSignature: "desc" }, { updatedAt: "asc" }],
      take: 30,
      select: {
        id: true,
        type: true,
        numero: true,
        statutSignature: true,
        updatedAt: true,
        sessionId: true,
        trainerId: true,
        session: { select: { titreSession: true, numero: true } },
        // Parties DÉJÀ signataires (signatures non révoquées) : c'est ce qui
        // permet à `partieARelancer` de viser la PROCHAINE partie du circuit.
        signatures: { where: { revokedAt: null }, select: { partie: true } },
      },
    });
  } catch {
    return [];
  }
  return retirerPiecesRemplacees(brutes);
}

/**
 * Le MÊME ensemble, compté.
 *
 * 🔴 Ne pas remplacer par un `prisma.count` : c'est exactement ce qui mentait.
 * Le filtre « pièce remplacée » ne s'exprime pas dans un `where` (il compare
 * deux lignes entre elles), il faut donc lire puis filtrer. Le volume est
 * borné par nature — ce sont les pièces qu'un humain doit traiter.
 *
 * Pas de `take` ici, contrairement à la liste : la pastille doit dire le
 * total, pas « 30 au plus ». Stub-safe → 0.
 */
export async function compterPiecesEnAttente(): Promise<number> {
  let brutes;
  try {
    brutes = await prisma.documentGenere.findMany({
      where: enAttente(),
      select: { sessionId: true, type: true },
    });
  } catch {
    return 0;
  }
  return (await retirerPiecesRemplacees(brutes)).length;
}
