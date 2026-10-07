/**
 * FICHIERS PARTAGÉS — l'INTERRUPTEUR (Candidatures unifiées, lot L4, ADR 0065).
 *
 * 🔴 ÉTEINT PAR DÉFAUT. Le compartiment R2 dédié n'existe pas encore : Will le
 * crée à la main. Tant qu'une seule des variables ci-dessous manque, la
 * bibliothèque n'existe pas — aucune action ne touche R2, aucune ligne n'est
 * écrite, la console affiche « pas encore activée ». Rien ne bascule tout seul.
 *
 * Variables (toutes facultatives dans `src/env.ts`) :
 *   - `R2_ACCOUNT_ID`                  — le compte Cloudflare (déjà posé) ;
 *   - `R2_PARTAGES_BUCKET_NAME`        — le compartiment DÉDIÉ (ex. `axion-ia-partages`) ;
 *   - `R2_PARTAGES_ACCESS_KEY_ID` + `R2_PARTAGES_SECRET_ACCESS_KEY` — un jeton
 *     limité à ce compartiment (recommandé) ; à défaut, les clés R2 générales ;
 *   - `PARTAGES_SECRET`                — 32 caractères au moins (liens privés, L5).
 *
 * ⛔ Le compartiment des sauvegardes est REFUSÉ, même configuré par erreur :
 * une bibliothèque de rushs ne se mêle jamais aux sauvegardes chiffrées.
 *
 * Pure (lit l'objet d'environnement qu'on lui passe) : testée sans rien poser.
 */

export interface ConfigPartages {
  readonly accountId: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly secret: string;
}

/** Les compartiments qu'une bibliothèque ne doit JAMAIS viser. */
export const COMPARTIMENTS_INTERDITS: ReadonlyArray<string> = [
  "axion-ia-backups",
  "axion-ia-backups-immutable",
];

type Env = Readonly<Record<string, string | undefined>>;

function valeur(env: Env, cle: string): string | null {
  const v = env[cle]?.trim();
  return v ? v : null;
}

/** Pourquoi la bibliothèque est éteinte — `null` si elle est allumée. */
export function raisonExtinction(env: Env = process.env): string | null {
  const accountId = valeur(env, "R2_ACCOUNT_ID");
  const bucket = valeur(env, "R2_PARTAGES_BUCKET_NAME");
  const cle = valeur(env, "R2_PARTAGES_ACCESS_KEY_ID") ?? valeur(env, "R2_ACCESS_KEY_ID");
  const secretCle =
    valeur(env, "R2_PARTAGES_SECRET_ACCESS_KEY") ?? valeur(env, "R2_SECRET_ACCESS_KEY");
  const secret = valeur(env, "PARTAGES_SECRET");
  if (!bucket) return "le compartiment de la bibliothèque n'est pas encore réglé";
  if (!accountId || !cle || !secretCle) return "les accès au stockage en ligne manquent";
  if (!secret || secret.length < 32) return "la clé des liens privés n'est pas encore réglée";
  const sauvegardes = [...COMPARTIMENTS_INTERDITS, valeur(env, "R2_BUCKET_NAME"), valeur(env, "R2_BUCKET_IMMUTABLE")];
  if (sauvegardes.includes(bucket)) {
    return "le compartiment indiqué est celui des sauvegardes : il en faut un dédié";
  }
  return null;
}

/** La configuration, ou `null` tant que la bibliothèque est éteinte. */
export function configPartages(env: Env = process.env): ConfigPartages | null {
  if (raisonExtinction(env) !== null) return null;
  return {
    accountId: valeur(env, "R2_ACCOUNT_ID")!,
    bucket: valeur(env, "R2_PARTAGES_BUCKET_NAME")!,
    accessKeyId: (valeur(env, "R2_PARTAGES_ACCESS_KEY_ID") ?? valeur(env, "R2_ACCESS_KEY_ID"))!,
    secretAccessKey: (valeur(env, "R2_PARTAGES_SECRET_ACCESS_KEY") ??
      valeur(env, "R2_SECRET_ACCESS_KEY"))!,
    secret: valeur(env, "PARTAGES_SECRET")!,
  };
}

/** La bibliothèque est-elle allumée ? */
export function partagesActifs(env: Env = process.env): boolean {
  return configPartages(env) !== null;
}
