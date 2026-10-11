/**
 * Gabarits qui portent un CODE À USAGE UNIQUE en clair (S6b) : la copie conservée de
 * l'envoi le masque, comme les liens personnels — lire « Emails › Envoyés » ne doit jamais
 * permettre de signer à la place du destinataire. Module pur.
 */
export const GABARITS_A_CODE_UNIQUE: ReadonlySet<string> = new Set(["formateur-code-signature"]);

const CODE_A_MASQUER = /\b\d{6}\b/g;

/**
 * Masque toute suite de six chiffres. Appliqué à TOUT texte qui sort d'un envoi à code :
 * copie conservée, message d'erreur journalisé, raison d'échec remontée à Sentry.
 */
export function sansCode(texte: string): string {
  return texte.replace(CODE_A_MASQUER, "[code masqué]");
}
