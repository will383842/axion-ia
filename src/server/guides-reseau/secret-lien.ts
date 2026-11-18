/**
 * Secret du lien `/guide-reseau?j=…` — LU À LA DEMANDE (lot S2).
 *
 * Jamais au démarrage, jamais au chargement du module : le build tourne sans ce secret
 * (`SKIP_ENV_VALIDATION=true`, `DATABASE_URL=…stub.invalid…`) et ne doit ni planter ni le lire.
 * Appelé par la page et par la route, à chaque requête, APRÈS l'interrupteur.
 *
 * Contrôle à la lecture : le secret du lien et celui des appels Studio→site existent, font au
 * moins 32 caractères et sont DISTINCTS (`verifierSecretsDistincts`). Sinon : `null` — la page
 * et la route répondent comme si le lien était inutilisable, sans dire pourquoi. Le message de
 * l'erreur (qui ne contient aucune valeur) part au journal, jamais à l'internaute.
 */
import { secretsGuidesReseau } from "./config";
import { verifierSecretsDistincts } from "./lien-page-guide";

export function lireSecretLien(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const lien = env.GUIDES_RESEAU_LIEN_SECRET?.trim();
  const appels = secretsGuidesReseau(env)?.courant;
  try {
    verifierSecretsDistincts(lien, appels);
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "guides_reseau_page_secret_invalide",
        erreur: e instanceof Error ? e.message : "erreur",
      }),
    );
    return null;
  }
  return lien as string;
}
