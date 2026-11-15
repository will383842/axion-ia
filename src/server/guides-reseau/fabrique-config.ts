/**
 * GUIDES FABRIQUÉS PAR LE SITE (G3/G4, 2026-11-15) — interrupteur et configuration.
 *
 * 🔴 ÉTEINT PAR DÉFAUT : vrai seulement si `GUIDES_RESEAU_FABRIQUE_ENABLED` vaut exactement `"true"`.
 * Lu à l'exécution (`process.env` brut, hors `env.ts`) : jamais au build, jamais un build-arg.
 * Module sans effet de bord à l'import (rien ne touche prisma, R2, polices ni secrets).
 */
type Env = Readonly<Record<string, string | undefined>>;

export function fabriqueActive(env: Env = process.env): boolean {
  return env.GUIDES_RESEAU_FABRIQUE_ENABLED === "true";
}

const LONGUEUR_MIN_SECRET = 32;

function valeur(env: Env, cle: string): string | null {
  const v = env[cle]?.trim();
  return v ? v : null;
}

/** Secret de la route de dépôt : `GUIDES_RESEAU_HMAC_SECRET`, SANS AUCUN REPLI (comme les oppositions). */
export function secretsFabrique(
  env: Env = process.env,
): { courant: string; precedent: string | null } | null {
  const courant = valeur(env, "GUIDES_RESEAU_HMAC_SECRET");
  if (!courant || courant.length < LONGUEUR_MIN_SECRET) return null;
  const prec = valeur(env, "GUIDES_RESEAU_HMAC_SECRET_PRECEDENT");
  return { courant, precedent: prec && prec.length >= LONGUEUR_MIN_SECRET ? prec : null };
}

/** Secret DISTINCT des liens de lecture d'un fichier rangé sur le volume (≥ 32 caractères). */
export function secretFichierGuide(env: Env = process.env): string | null {
  const s = valeur(env, "GUIDES_RESEAU_FICHIER_SECRET");
  const hmac = valeur(env, "GUIDES_RESEAU_HMAC_SECRET");
  if (!s || s.length < LONGUEUR_MIN_SECRET || s === hmac) return null;
  return s;
}

export type ModeStockage = "r2" | "volume";

/** Choix EXPLICITE : toute autre valeur (y compris absente) = pas de stockage. */
export function modeStockage(env: Env = process.env): ModeStockage | null {
  const m = env.GUIDES_RESEAU_STOCKAGE;
  return m === "r2" || m === "volume" ? m : null;
}

export const VOLUME_PAR_DEFAUT = "/var/data/guides-reseau";

export function racineVolume(env: Env = process.env): string {
  return valeur(env, "GUIDES_RESEAU_VOLUME") ?? VOLUME_PAR_DEFAUT;
}

/** Compartiments qu'un guide ne doit JAMAIS viser : les sauvegardes. */
const COMPARTIMENTS_SAUVEGARDE = ["axion-ia-backups", "axion-ia-backups-immutable"];

export interface CibleGuidesR2 {
  readonly accountId: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/** La cible R2 dédiée, ou `null` (non configurée ou compartiment de sauvegardes). */
export function cibleGuidesR2(env: Env = process.env): CibleGuidesR2 | null {
  const accountId = valeur(env, "R2_ACCOUNT_ID");
  const bucket = valeur(env, "R2_GUIDES_BUCKET_NAME");
  const accessKeyId = valeur(env, "R2_GUIDES_ACCESS_KEY_ID");
  const secretAccessKey = valeur(env, "R2_GUIDES_SECRET_ACCESS_KEY");
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  const interdits = [
    ...COMPARTIMENTS_SAUVEGARDE,
    valeur(env, "R2_BUCKET_NAME"),
    valeur(env, "R2_BUCKET_IMMUTABLE"),
  ];
  if (interdits.includes(bucket) || /backup|sauvegarde/i.test(bucket)) return null;
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

/** Clé d'objet DÉRIVÉE du code et de la version (jamais du corps de la requête). */
export function cleObjet(code: string, version: number): string {
  return `guides-reseau/${code}/v${version}.pdf`;
}
