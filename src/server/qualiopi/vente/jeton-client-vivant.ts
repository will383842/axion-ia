/**
 * Filtre des jetons de signature « vivants » du client pour une pièce : partie client, non
 * révoqué, non expiré. Un lien révoqué ou expiré est un lien mort : le compter masquait
 * l'avertissement « le client ne peut pas signer en ligne ».
 */
export function filtreJetonClientVivant(documentGenereId: string, maintenant: Date) {
  return {
    documentGenereId,
    partie: "client" as const,
    revokedAt: null,
    expiresAt: { gt: maintenant },
  };
}
