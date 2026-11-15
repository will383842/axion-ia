/**
 * Rotation de clés Anthropic (module pur, NON BRANCHÉ en production).
 *
 * - Clés lues dans ANTHROPIC_API_KEY, ANTHROPIC_API_KEY_2, ANTHROPIC_API_KEY_3.
 * - Ordre par usage : ANTHROPIC_KEY_ORDER_CONTENT_GEN (ex. « 2,1 ») ; défaut « 1,2,3 ».
 *   Les clés non listées passent après, en secours. Un ordre invalide revient au défaut
 *   (et le dit dans le journal). Clés vides et doublons (même valeur) ignorés.
 * - On change de clé UNIQUEMENT sur un refus de FACTURATION reçu avant tout flux :
 *   jamais sur 429, 5xx, délai, 401/403, ni sur une erreur reçue EN COURS de flux
 *   (la réponse a déjà été facturée en partie : rejouer risquerait une double facturation).
 * - Aucune clé n'est jamais écrite dans un journal (seulement l'index 1, 2, 3) et les
 *   erreurs relancées sont débarrassées de toute clé (sk-ant-… et clés de l'environnement).
 * - ÉTAT EN MÉMOIRE, PAR PROCESSUS : l'app et le worker ne partagent pas les marques
 *   « épuisée » ; un partage (Redis) viendra plus tard, hors périmètre de ce module.
 *
 * Contrat de l'appel injecté : il relance l'erreur du fournisseur. Pour qu'un 429 ne soit
 * jamais pris pour un crédit épuisé, l'erreur doit porter le statut HTTP d'origine
 * (`status`, `statut`, ou `cause.status`), car `mapAnthropicError` transforme un 429
 * « credit balance is too low » en `quota_exhausted` et perd ce statut. Une erreur reçue en
 * cours de flux porte `enFlux: true`.
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

/**
 * Crédit épuisé. Le mot « billing » seul ne suffit pas (il apparaît dans des messages de
 * rate-limit et d'authentification) : on exige une formule explicite.
 */
const MOTIF_FACTURATION =
  /credit balance is too low|insufficient[_-]quota|billing[_\s-]error|payment[_\s-]required/i;

const MOTIF_CLE_ANTHROPIC = /sk-ant-[A-Za-z0-9_-]+/g;
const MASQUE = "[clé masquée]";

type Journal = (message: string) => void;

function lireOrdre(brut: string | undefined, journal?: Journal): (1 | 2 | 3)[] {
  const defaut: (1 | 2 | 3)[] = [1, 2, 3];
  if (!brut || !brut.trim()) return defaut;
  const vus = new Set<1 | 2 | 3>();
  let invalide = false;
  for (const morceau of brut.split(",")) {
    const n = Number(morceau.trim());
    if (n === 1 || n === 2 || n === 3) vus.add(n);
    else invalide = true;
  }
  if (!vus.size) {
    journal?.("[anthropic] ordre des clés inutilisable : retour à l'ordre 1,2,3");
    return defaut;
  }
  if (invalide) journal?.("[anthropic] ordre des clés : entrées invalides ignorées");
  // Les clés non listées passent à la suite, en secours.
  for (const n of defaut) vus.add(n);
  return [...vus];
}

/** Clés utilisables pour l'usage, dans l'ordre voulu (vides et doublons écartés). */
export function listerCles(env: EnvCles, usage: UsageCles, journal?: Journal): CleRetenue[] {
  const vues = new Set<string>();
  const retenues: CleRetenue[] = [];
  for (const index of lireOrdre(env[VARIABLE_ORDRE[usage]], journal)) {
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
  return (
    listerCles(env, usage).find((c) => !exclure.has(c.cle) && !estEpuisee(etat, c.cle)) ?? null
  );
}

/** Vrai si des clés existent et qu'elles sont toutes marquées épuisées. */
export function toutesEpuisees(env: EnvCles, usage: UsageCles, etat: EtatCles): boolean {
  const cles = listerCles(env, usage);
  return cles.length > 0 && cles.every((c) => estEpuisee(etat, c.cle));
}

/* --- Classification et masquage -------------------------------------------- */

/** Statut HTTP d'origine : sur l'erreur (`status`, `statut`) ou sur sa cause. */
function statutHttp(e: unknown): number | undefined {
  const lire = (o: unknown): number | undefined => {
    if (typeof o !== "object" || o === null) return undefined;
    const r = o as { status?: unknown; statut?: unknown };
    if (typeof r.status === "number") return r.status;
    if (typeof r.statut === "number") return r.statut;
    return undefined;
  };
  return lire(e) ?? lire((e as { cause?: unknown } | null)?.cause);
}

/** Refus de FACTURATION d'Anthropic uniquement : jamais 429, 5xx, 401/403, délai, ni en cours de flux. */
export function estRefusFacturation(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if ((e as { enFlux?: unknown }).enFlux === true) return false;
  const statut = statutHttp(e);
  if (statut === 429 || statut === 401 || statut === 403 || (statut !== undefined && statut >= 500))
    return false;
  if (e instanceof ProviderError) return e.provider === "anthropic" && e.code === "quota_exhausted";
  return statut === 402 || MOTIF_FACTURATION.test(e.message);
}

function masquer(texte: string, env: EnvCles): string {
  let sortie = texte.replace(MOTIF_CLE_ANTHROPIC, MASQUE);
  for (const nom of Object.values(NOMS)) {
    const cle = env[nom]?.trim();
    if (cle) sortie = sortie.split(cle).join(MASQUE);
  }
  return sortie;
}

/** Retire les clés du message et de la pile de l'erreur (sur place : l'identité est conservée). */
function assainir<E>(e: E, env: EnvCles): E {
  if (e instanceof Error) {
    e.message = masquer(e.message, env);
    if (typeof e.stack === "string") e.stack = masquer(e.stack, env);
    if (e.cause instanceof Error) assainir(e.cause, env);
  }
  return e;
}

/* --- Appel avec rotation -------------------------------------------------- */

export interface OptionsRotation {
  env: EnvCles;
  usage: UsageCles;
  etat: EtatCles;
  /** Journal sans secret ; par défaut console.warn. Ne reçoit jamais une clé. */
  journal?: Journal;
}

function quotaEpuise(cause?: unknown): ProviderError {
  const err = new ProviderError(
    "Anthropic quota épuisé : toutes les clés Anthropic sont épuisées",
    "quota_exhausted",
    "anthropic",
    false,
  );
  if (cause !== undefined) (err as { cause?: unknown }).cause = cause;
  return err;
}

/**
 * Appelle `appel(cle)` ; sur refus de facturation marque la clé épuisée (24 h) et
 * rejoue avec la suivante. Au plus 3 essais, jamais deux fois la même clé.
 * Toute autre erreur est relancée telle quelle (débarrassée de toute clé).
 * Quand tout est épuisé : `quota_exhausted`, avec la dernière erreur d'origine en `cause`.
 */
export async function appelerAvecRotationCles<T>(
  appel: (cle: string) => Promise<T>,
  options: OptionsRotation,
): Promise<T> {
  const { env, usage, etat } = options;
  const journal: Journal = options.journal ?? ((m: string) => console.warn(m));
  if (listerCles(env, usage, journal).length === 0) {
    throw new ProviderError("Anthropic : aucune clé configurée", "auth_failed", "anthropic", false);
  }
  const essayees = new Set<string>();
  let derniere: unknown;
  while (essayees.size < MAX_ESSAIS) {
    const choix = choisirCle(env, usage, etat, essayees);
    if (!choix) break;
    essayees.add(choix.cle);
    try {
      return await appel(choix.cle);
    } catch (e) {
      assainir(e, env);
      if (!estRefusFacturation(e)) throw e;
      derniere = e;
      marquerEpuisee(etat, choix.cle);
      journal(`[anthropic] clé ${choix.index} refusée (facturation) : marquée épuisée 24 h`);
    }
  }
  throw quotaEpuise(derniere);
}
