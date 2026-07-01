// Helpers partagés de détection d'erreurs de soumission de formulaires.
//
// Deploy-skew : quand une page a été chargée AVANT un déploiement, ses Server
// Actions référencent des IDs qui n'existent plus sur le serveur redéployé →
// Next lève `UnrecognizedActionError: Server Action "..." was not found on the
// server` (POST 404). Ce n'est PAS un bug du formulaire : il faut recharger la
// page pour re-synchroniser les IDs d'actions. On détecte ce cas pour afficher
// un message actionnable (« rechargez la page ») plutôt qu'un générique.

const STALE_ACTION_RE =
  /(unrecognized ?action|server action.*(?:was not|not be) found|failed to find server action|was not found on the server)/i;

/**
 * `true` si l'erreur provient d'un décalage de déploiement (Server Action
 * introuvable côté serveur) → la bonne remédiation est un rechargement de page.
 */
export function isStaleServerActionError(err: unknown): boolean {
  if (!err) return false;
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.name, err.message);
    const digest = (err as { digest?: unknown }).digest;
    if (typeof digest === "string") parts.push(digest);
  } else {
    parts.push(String(err));
  }
  return STALE_ACTION_RE.test(parts.join(" "));
}
