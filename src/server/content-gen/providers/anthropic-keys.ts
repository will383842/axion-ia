/**
 * Rotation de clés Anthropic (module pur, NON BRANCHÉ en production).
 *
 * - Clés lues dans ANTHROPIC_API_KEY, ANTHROPIC_API_KEY_2, ANTHROPIC_API_KEY_3.
 * - Ordre par usage : ANTHROPIC_KEY_ORDER_CONTENT_GEN (ex. « 2,1 ») ; défaut « 1,2,3 ».
 * - Clés vides et doublons (même valeur) ignorés.
 * - On change de clé UNIQUEMENT sur un refus de facturation (crédit épuisé),
 *   jamais sur 429, 5xx, délai dépassé ou toute autre erreur.
 * - Aucune clé n'est jamais écrite dans un journal : seulement son index.
 */
import { ProviderError } from "./IProvider";

export type UsageCles = "content_gen";

export interface EnvCles {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_API_KEY_2?: string;
  ANTHROPIC_API_KEY_3?: string;
  ANTHROPIC_KEY_ORDER_CONTENT_GEN?: string;
}

export interface CleRetenue {
  /** 1, 2 ou 3 : seul identifiant autorisé dans les journaux. */
  readonly index: 1 | 2 | 3;
  readonly cle: string;
}

/** Durée de vie d'une marque « épuisée » : 24 h. */
export const DUREE_EPUISEMENT_MS = 24 * 60 * 60 * 1000;
export const MAX_ESSAIS = 3;

const NOMS: Record<1 | 2 | 3, keyof EnvCles> = {
  1: "ANTHROPIC_API_KEY",
  2: "ANTHROPIC_API_KEY_2",
  3: "ANTHROPIC_API_KEY_3",
};

const VARIABLE_ORDRE: Record<UsageCles, keyof EnvCles> = {
  content_gen: "ANTHROPIC_KEY_ORDER_CONTENT_GEN",
};

/** Même motif que `mapAnthropicError` (anthropic.ts). */
const MOTIF_FACTURATION = /credit balance is too low|billing|insufficient[_-]quota/i;

function lireOrdre(brut: string | undefined): (1 | 2 | 3)[] {
  const defaut: (1 | 2 | 3)[] = [1, 2, 3];
  if (!brut) return defaut;
  const vus = new Set<1 | 2 | 3>();
  for (const morceau of brut.split(",")) {
    const n = Number(morceau.trim());
    if (n === 1 || n === 2 || n === 3) vus.add(n);
  }
  return vus.size ? [...vus] : defaut;
}

/** Clés utilisables pour l'usage, dans l'ordre voulu (vides et doublons écartés). */
export function listerCles(env: EnvCles, usage: UsageCles): CleRetenue[] {
  const vues = new Set<string>();
  const retenues: CleRetenue[] = [];
  for (const index of lireOrdre(env[VARIABLE_ORDRE[usage]])) {
    const cle = env[NOMS[index]]?.trim();
    if (!cle || vues.has(cle)) continue;
    vues.add(cle);
    retenues.push({ index, cle });
  }
  return retenues;
}

/* --- État d'épuisement (en mémoire, horloge injectable) ------------------- */

export interface EtatCles {
  readonly now: () => number;
  /** clé -> instant d'expiration de la marque. */
  readonly epuisees: Map<string, number>;
}

export function creerEtatCles(now: () => number = Date.now): EtatCles {
  return { now, epuisees: new Map() };
}

export function marquerEpuisee(etat: EtatCles, cle: string): void {
  etat.epuisees.set(cle, etat.now() + DUREE_EPUISEMENT_MS);
}

function estEpuisee(etat: EtatCles, cle: string): boolean {
  const fin = etat.epuisees.get(cle);
  if (fin === undefined) return false;
  if (etat.now() >= fin) {
    etat.epuisees.delete(cle);
    return false;
  }
  return true;
}

/** Première clé non épuisée selon l'ordre ; `null` si aucune. */
export function choisirCle(
  env: EnvCles,
  usage: UsageCles,
  etat: EtatCles,
  exclure: ReadonlySet<string> = new Set(),
): CleRetenue | null {
  return listerCles(env, usage).find((c) => !exclure.has(c.cle) && !estEpuisee(etat, c.cle)) ?? null;
}

/** Vrai si des clés existent et qu'elles sont toutes marquées épuisées. */
export function toutesEpuisees(env: EnvCles, usage: UsageCles, etat: EtatCles): boolean {
  const cles = listerCles(env, usage);
  return cles.length > 0 && cles.every((c) => estEpuisee(etat, c.cle));
}

/* --- Appel avec rotation -------------------------------------------------- */

/** Refus de FACTURATION uniquement : jamais 429, 5xx, délai, réseau. */
export function estRefusFacturation(e: unknown): boolean {
  if (e instanceof ProviderError) return e.code === "quota_exhausted";
  if (!(e instanceof Error)) return false;
  const statut = (e as { status?: unknown }).status;
  if (typeof statut === "number" && (statut === 429 || statut >= 500)) return false;
  return statut === 402 || MOTIF_FACTURATION.test(e.message);
}

export interface OptionsRotation {
  env: EnvCles;
  usage: UsageCles;
  etat: EtatCles;
  /** Journal sans secret ; par défaut console.warn. Ne reçoit jamais une clé. */
  journal?: (message: string) => void;
}

function quotaEpuise(provider = "toutes les clés Anthropic sont épuisées"): ProviderError {
  return new ProviderError(`Anthropic quota épuisé : ${provider}`, "quota_exhausted", "anthropic", false);
}

/**
 * Appelle `appel(cle)` ; sur refus de facturation marque la clé épuisée (24 h) et
 * rejoue avec la suivante. Au plus 3 essais, jamais deux fois la même clé.
 * Toute autre erreur est relancée telle quelle.
 */
export async function appelerAvecRotationCles<T>(
  appel: (cle: string) => Promise<T>,
  options: OptionsRotation,
): Promise<T> {
  const { env, usage, etat } = options;
  const journal = options.journal ?? ((m: string) => console.warn(m));
  if (listerCles(env, usage).length === 0) {
    throw new ProviderError("Anthropic : aucune clé configurée", "auth_failed", "anthropic", false);
  }
  const essayees = new Set<string>();
  while (essayees.size < MAX_ESSAIS) {
    const choix = choisirCle(env, usage, etat, essayees);
    if (!choix) break;
    essayees.add(choix.cle);
    try {
      return await appel(choix.cle);
    } catch (e) {
      if (!estRefusFacturation(e)) throw e;
      marquerEpuisee(etat, choix.cle);
      journal(`[anthropic] clé ${choix.index} (…${choix.cle.slice(-4)}) refusée (facturation) : marquée épuisée 24 h`);
    }
  }
  throw quotaEpuise();
}
