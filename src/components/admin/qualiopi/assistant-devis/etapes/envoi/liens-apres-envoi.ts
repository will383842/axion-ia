/**
 * Liens proposés après l'envoi depuis l'assistant. Le préfixe admin est lu dans l'URL courante
 * (`/fr/<préfixe>/qualiopi/devis/new`) : aucune variable d'environnement côté navigateur.
 */
export function liensApresEnvoi(
  pathname: string | null,
  devisId: string,
): { hrefDevis: string; hrefEmails: string } | null {
  const m = /^(\/[a-z]{2}\/[^/]+)\/qualiopi\//.exec(pathname ?? "");
  if (m === null) return null;
  const base = `${m[1]}/qualiopi`;
  return { hrefDevis: `${base}/devis/${devisId}`, hrefEmails: `${base}/emails` };
}
