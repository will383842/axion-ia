/**
 * VIDÉOS DU STUDIO SUR LE SITE — l'INTERRUPTEUR (lot W1, plan PLAN-W1-W4 §2).
 *
 * 🔴 ÉTEINT PAR DÉFAUT. Tant que `VIDEOS_SITE_ENABLED` n'est pas exactement
 * `"true"`, la réception répond 503 et rien n'est lu ni écrit ; aucune page,
 * aucun plan du site, aucun encart n'existe.
 *
 * Convention de `src/server/qualiopi/config/flag.ts` : lecture en
 * `process.env` brut, HORS schéma `env.ts` (la validation Zod du build GH
 * Actions n'est pas touchée), défaut sûr `false`.
 *
 * ⛔ Lu AU RUNTIME uniquement (Coolify, scope RUN, conteneur app). Jamais un
 * build-arg ni une variable de dépôt GitHub Actions : un drapeau lu par une
 * route statique serait figé au build (incident P3-01).
 */

type Env = Readonly<Record<string, string | undefined>>;

/** `true` uniquement si `VIDEOS_SITE_ENABLED === "true"`. */
export function videosSiteActives(): boolean {
  return process.env.VIDEOS_SITE_ENABLED === "true";
}

const LONGUEUR_MIN_SECRET = 32;

function secretValide(v: string | undefined): string | null {
  const s = v?.trim();
  return s && s.length >= LONGUEUR_MIN_SECRET ? s : null;
}

export interface SecretsStudio {
  readonly courant: string;
  readonly precedent: string | null;
}

/** Secret courant (+ précédent, pendant une rotation) ; `null` si le courant manque. */
export function secretsStudio(env: Env = process.env): SecretsStudio | null {
  const courant = secretValide(env.VIDEOS_STUDIO_HMAC_SECRET);
  if (!courant) return null;
  return { courant, precedent: secretValide(env.VIDEOS_STUDIO_HMAC_SECRET_PRECEDENT) };
}

/** Pourquoi la réception est éteinte — `null` si elle est allumée. */
export function raisonExtinction(env: Env = process.env): string | null {
  if (env.VIDEOS_SITE_ENABLED !== "true") {
    return "l'interrupteur des vidéos du site est éteint";
  }
  if (!secretsStudio(env)) {
    return `le secret partagé avec le studio manque ou fait moins de ${LONGUEUR_MIN_SECRET} caractères`;
  }
  return null;
}
