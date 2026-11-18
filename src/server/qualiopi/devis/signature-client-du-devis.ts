/**
 * Le client a-t-il signé ce devis ? (signature non révoquée, pièce non annulée).
 *
 * Lecture PARTAGÉE par les gardes serveur (refus, acceptation à la main, renvoi par e-mail) :
 * à poser dans le `select` / `include` du devis, puis à passer à `signatureClientDuDevis`.
 * Même définition que `pasSigneParLeClient` (son contraire, côté filtre Prisma).
 */
export const SELECT_SIGNATURES_PIECE = {
  documentGenere: {
    select: {
      annuleeAt: true,
      signatures: { where: { revokedAt: null }, select: { partie: true } },
    },
  },
} as const;

export interface LectureSignaturesPiece {
  documentGenere?: {
    annuleeAt: Date | null;
    signatures: ReadonlyArray<{ partie: string }>;
  } | null;
}

export function signatureClientDuDevis(devis: LectureSignaturesPiece | null | undefined): {
  clientASigne: boolean;
  organismeASigne: boolean;
} {
  const piece = devis?.documentGenere;
  if (!piece || piece.annuleeAt !== null) return { clientASigne: false, organismeASigne: false };
  return {
    clientASigne: piece.signatures.some((s) => s.partie === "client"),
    organismeASigne: piece.signatures.some((s) => s.partie === "axionia"),
  };
}
