/**
 * Gabarits qui portent un CODE À USAGE UNIQUE en clair (S6b) : la copie conservée de
 * l'envoi le masque, comme les liens personnels — lire « Emails › Envoyés » ne doit jamais
 * permettre de signer à la place du destinataire. Module pur.
 */
export const GABARITS_A_CODE_UNIQUE: ReadonlySet<string> = new Set(["formateur-code-signature"]);
