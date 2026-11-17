import type { Prisma } from "../../../../prisma/generated/client";

/**
 * Filtre Prisma POSITIF : « ce devis n'est PAS en attente de contresignature ».
 *
 * Un devis déjà signé par le client (signature non révoquée, pièce non annulée)
 * n'attend plus que la contresignature de l'organisme : il ne doit ni expirer ni
 * être relancé. Trois cas expirables :
 *   1. aucune pièce générée (`documentGenereId` nul) ;
 *   2. pièce annulée (`annuleeAt` posé), même si le client l'avait signée ;
 *   3. pièce sans signature client non révoquée.
 *
 * Forme positive (OR) et non `NOT` : la traduction SQL d'un NOT sur une relation
 * optionnelle peut écarter à tort les lignes sans pièce.
 *
 * Posé DANS chaque requête (updateMany d'expiration, findMany de relance J+3),
 * jamais via une liste d'identifiants calculée avant.
 */
export const pasSigneParLeClient = {
  OR: [
    { documentGenereId: null },
    { documentGenere: { annuleeAt: { not: null } } },
    { documentGenere: { signatures: { none: { partie: "client", revokedAt: null } } } },
  ],
} satisfies Prisma.DevisWhereInput;
