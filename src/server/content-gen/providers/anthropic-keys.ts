/**
 * Rotation de clés Anthropic (module pur ; branché dans `anthropic.ts`, seulement quand
 * PLUSIEURS clés sont configurées — avec une seule clé le comportement est inchangé).
 *
 * - Clés lues dans ANTHROPIC_API_KEY, ANTHROPIC_API_KEY_2, ANTHROPIC_API_KEY_3.
 * - Ordre par usage : ANTHROPIC_KEY_ORDER_CONTENT_GEN (ex. « 2,1 ») ; défaut « 1,2,3 ».
 *   Les clés non listées passent après, en secours. Un ordre invalide revient au défaut
 *   (et le dit dans le journal). Clés vides et doublons (même valeur) ignorés.
 * - Tableau de réaction (TOUJOURS avant le premier octet de flux) :
 *     400 « credit balance too low » ou 402 -> clé marquée ÉPUISÉE (6 h), clé suivante ;
 *     401 ou 403                            -> clé marquée INVALIDE (1 h), clé suivante ;
 *     429, 5xx, délai                       -> aucune rotation (nouvel essai : `withRetry`) ;
 *     erreur EN COURS de flux               -> aucune rotation, aucun rejeu (déjà facturé).
 * - ÉTAT PARTAGÉ DANS REDIS (app et worker) : `anthropic:cle:{index}:epuisee` /
 *   `anthropic:cle:{index}:invalide`, SET avec durée de vie. Redis en panne : repli sur la
 *   mémoire locale du processus (+ avertissement au journal) ; on ne s'arrête jamais.
 * - Aucune clé n'est jamais écrite dans un journal, une alerte ou Redis (seulement
 *   l'index 1, 2, 3) et les erreurs relancées sont débarrassées de toute clé
 *   (sk-ant-… et clés de l'environnement).
 *
 * Contrat de l'appel injecté : il relance l'erreur du fournisseur. Pour qu'un 429 ne soit
 * jamais pris pour un crédit épuisé, l'erreur doit porter le statut HTTP d'origine
 * (`status`, `statut`, ou `cause.status`), car `mapAnthropicError` transforme un 429
 * « credit balance is too low » en `quota_exhausted` et perd ce statut. Une erreur reçue en
 * cours de flux porte `enFlux: true`.
 *
 * Erreur finale (aucune clé utilisable) : elle porte `toutesEpuisees: true`
 * (+ `motifIndisponibilite`). Quota-guard et le blog ne comptent que celles-là.
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

/** Durée de vie d'une marque « épuisée » (crédit) : 6 h. */
export const DUREE_EPUISEMENT_MS = 6 * 60 * 60 * 1000;
/** Durée de vie d'une marque « invalide » (401/403) : 1 h. */
export const DUREE_INVALIDITE_MS = 60 * 60 * 1000;
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
 * rate-limit et d'authentification) : on exige une formule explicite (ou le statut 402).
 */
const MOTIF_FACTURATION = /credit balance is too low|insufficient[_-]quota/i;

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

/* --- État des clés (Redis partagé + repli mémoire, horloge injectable) ---- */

export type MotifIndisponibilite = "epuisee" | "invalide";

/** Partie de l'API ioredis utilisée (permet un faux Redis dans les tests). */
export interface RedisCles {
  set(cle: string, valeur: string, mode: "EX", secondes: number): Promise<unknown>;
  mget(...cles: string[]): Promise<unknown>;
}

export interface EtatCles {
  /** Motif de la marque posée sur la clé n°`index` (Redis, sinon mémoire) ; `null` si libre. */
  motif(index: 1 | 2 | 3): Promise<MotifIndisponibilite | null>;
  /** Pose la marque (Redis avec durée de vie ; mémoire si Redis est en panne). */
  marquer(index: 1 | 2 | 3, motif: MotifIndisponibilite): Promise<void>;
}

const DUREES_MS: Record<MotifIndisponibilite, number> = {
  epuisee: DUREE_EPUISEMENT_MS,
  invalide: DUREE_INVALIDITE_MS,
};

/** Clé Redis : l'index seul, jamais la clé API. */
export function cleRedisEtat(index: 1 | 2 | 3, motif: MotifIndisponibilite): string {
  return `anthropic:cle:${index}:${motif}`;
}

/** Délai maximal d'une commande Redis : une panne ne doit pas retarder la génération. */
const DELAI_REDIS_MS = 1_000;
/** Un avertissement « Redis en panne » au plus toutes les 60 s et par processus. */
const INTERVALLE_AVERTISSEMENT_MS = 60_000;

function avecDelai<T>(promesse: Promise<T>): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejet) => {
    minuteur = setTimeout(() => rejet(new Error("délai Redis dépassé")), DELAI_REDIS_MS);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}

export interface OptionsEtat {
  now?: () => number;
  /** Absent : mémoire seule. */
  redis?: RedisCles;
  journal?: Journal;
}

export function creerEtatCles(options: OptionsEtat = {}): EtatCles {
  const now = options.now ?? Date.now;
  const { redis } = options;
  const journal: Journal = options.journal ?? ((m: string) => console.warn(m));
  /** `${index}:${motif}` -> instant d'expiration (repli quand Redis ne répond pas). */
  const memoire = new Map<string, number>();
  let dernierAvertissement = 0;

  const avertir = (operation: string): void => {
    const t = now();
    if (dernierAvertissement !== 0 && t - dernierAvertissement < INTERVALLE_AVERTISSEMENT_MS) {
      return;
    }
    dernierAvertissement = t;
    // Message générique : jamais le texte de l'erreur Redis (URL, mot de passe possibles).
    journal(
      `[anthropic] Redis indisponible (${operation}) : état des clés gardé en mémoire locale`,
    );
  };

  const enMemoire = (index: number, motif: MotifIndisponibilite): boolean => {
    const id = `${index}:${motif}`;
    const fin = memoire.get(id);
    if (fin === undefined) return false;
    if (now() >= fin) {
      memoire.delete(id);
      return false;
    }
    return true;
  };

  return {
    async motif(index) {
      // La mémoire ne contient que des marques posées pendant une panne Redis.
      if (enMemoire(index, "epuisee")) return "epuisee";
      if (enMemoire(index, "invalide")) return "invalide";
      if (!redis) return null;
      try {
        const reponse = await avecDelai(
          redis.mget(cleRedisEtat(index, "epuisee"), cleRedisEtat(index, "invalide")),
        );
        if (!Array.isArray(reponse)) return null;
        if (reponse[0] !== null && reponse[0] !== undefined) return "epuisee";
        if (reponse[1] !== null && reponse[1] !== undefined) return "invalide";
        return null;
      } catch {
        avertir("lecture");
        return null;
      }
    },
    async marquer(index, motif) {
      if (redis) {
        try {
          await avecDelai(
            redis.set(cleRedisEtat(index, motif), "1", "EX", DUREES_MS[motif] / 1000),
          );
          return;
        } catch {
          avertir("écriture");
        }
      }
      memoire.set(`${index}:${motif}`, now() + DUREES_MS[motif]);
    },
  };
}

/** Première clé disponible selon l'ordre ; `null` si aucune. */
export async function choisirCle(
  env: EnvCles,
  usage: UsageCles,
  etat: EtatCles,
  exclure: ReadonlySet<string> = new Set(),
): Promise<CleRetenue | null> {
  for (const c of listerCles(env, usage)) {
    if (exclure.has(c.cle)) continue;
    if ((await etat.motif(c.index)) === null) return c;
  }
  return null;
}

/** Vrai si des clés existent et qu'aucune n'est utilisable (épuisées ou invalides). */
export async function toutesIndisponibles(
  env: EnvCles,
  usage: UsageCles,
  etat: EtatCles,
): Promise<boolean> {
  const cles = listerCles(env, usage);
  if (cles.length === 0) return false;
  return (await choisirCle(env, usage, etat)) === null;
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

/**
 * Refus d'AUTHENTIFICATION d'Anthropic (clé révoquée, mauvaise organisation) : statut 401
 * ou 403 reçu AVANT tout flux. Le statut est exigé : « fournisseur désactivé » ou « clé
 * absente » sont aussi `auth_failed` mais ne disent rien de la clé.
 */
export function estRefusAuthentification(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if ((e as { enFlux?: unknown }).enFlux === true) return false;
  if (e instanceof ProviderError && e.provider !== "anthropic") return false;
  const statut = statutHttp(e);
  return statut === 401 || statut === 403;
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

export interface EvenementCle {
  readonly index: 1 | 2 | 3;
  readonly motif: MotifIndisponibilite;
}

export interface OptionsRotation {
  env: EnvCles;
  usage: UsageCles;
  etat: EtatCles;
  /** Journal sans secret ; par défaut console.warn. Ne reçoit jamais une clé. */
  journal?: Journal;
  /**
   * Appelé après chaque marque posée (alerte). JAMAIS attendu (feu et oubli) et ses erreurs
   * sont avalées : une alerte en panne ou muette ne retarde ni ne casse la génération.
   * Ne reçoit que l'index.
   */
  surMarque?: (evenement: EvenementCle) => Promise<unknown> | void;
}

/**
 * Alerte « feu et oubli » : jamais attendue (une alerte qui ne répond pas ne doit pas
 * retarder la clé suivante), erreurs avalées (synchrones ou rejetées).
 */
function declencherAlerte(surMarque: OptionsRotation["surMarque"], evenement: EvenementCle): void {
  try {
    void Promise.resolve(surMarque?.(evenement)).catch(() => undefined);
  } catch {
    // Une alerte en panne ne casse jamais la génération.
  }
}

/** Erreur finale : aucune clé utilisable. `toutesEpuisees: true` est le drapeau lu en aval. */
export interface ErreurToutesIndisponibles {
  toutesEpuisees: true;
  motifIndisponibilite: "credit" | "authentification" | "mixte";
}

function aucuneCleUtilisable(
  motifs: ReadonlyArray<MotifIndisponibilite>,
  cause?: unknown,
): ProviderError {
  const credit = motifs.includes("epuisee");
  const auth = motifs.includes("invalide");
  const motifIndisponibilite: ErreurToutesIndisponibles["motifIndisponibilite"] =
    credit && auth ? "mixte" : auth ? "authentification" : "credit";
  // Tout invalide : on reste sur `auth_failed` (avec le statut d'origine pour le blog).
  // Dès qu'une clé est épuisée par le crédit : `quota_exhausted` (c'est l'argent qui manque).
  const err =
    auth && !credit
      ? new ProviderError(
          "Anthropic : toutes les clés Anthropic sont refusées (authentification)",
          "auth_failed",
          "anthropic",
          false,
        )
      : new ProviderError(
          "Anthropic quota épuisé : toutes les clés Anthropic sont épuisées ou refusées",
          "quota_exhausted",
          "anthropic",
          false,
        );
  Object.assign(err, { toutesEpuisees: true, motifIndisponibilite });
  if (cause !== undefined) {
    (err as { cause?: unknown }).cause = cause;
    const statut = statutHttp(cause);
    if (statut !== undefined && err.code === "auth_failed")
      (err as { status?: number }).status = statut;
  }
  return err;
}

/**
 * Appelle `appel(cle)` ; sur refus de facturation (400/402) marque la clé épuisée (6 h),
 * sur refus d'authentification (401/403) la marque invalide (1 h), puis rejoue avec la
 * suivante. Au plus 3 essais, jamais deux fois la même clé.
 * Toute autre erreur est relancée telle quelle (débarrassée de toute clé).
 * Quand plus aucune clé n'est utilisable : erreur finale `toutesEpuisees: true`, avec la
 * dernière erreur d'origine en `cause`.
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
  /** Motifs des clés rencontrées indisponibles (déjà marquées avant l'appel, ou à l'instant). */
  const motifs: MotifIndisponibilite[] = [];
  let derniere: unknown;
  while (essayees.size < MAX_ESSAIS) {
    const choix = await choisirCle(env, usage, etat, essayees);
    if (!choix) break;
    essayees.add(choix.cle);
    try {
      return await appel(choix.cle);
    } catch (e) {
      assainir(e, env);
      const motif: MotifIndisponibilite | null = estRefusFacturation(e)
        ? "epuisee"
        : estRefusAuthentification(e)
          ? "invalide"
          : null;
      if (motif === null) throw e;
      derniere = e;
      motifs.push(motif);
      await etat.marquer(choix.index, motif);
      journal(
        motif === "epuisee"
          ? `[anthropic] clé ${choix.index} refusée (facturation) : marquée épuisée 6 h`
          : `[anthropic] clé ${choix.index} refusée (authentification) : marquée invalide 1 h`,
      );
      declencherAlerte(options.surMarque, { index: choix.index, motif });
    }
  }
  // Motif de CHAQUE clé configurée, y compris celles marquées avant cet appel (autre
  // processus) ; repli sur ce qu'on a vu si l'état ne répond plus.
  const motifsFinaux: MotifIndisponibilite[] = [];
  for (const c of listerCles(env, usage)) {
    const m = await etat.motif(c.index);
    if (m !== null) motifsFinaux.push(m);
  }
  throw aucuneCleUtilisable(motifsFinaux.length > 0 ? motifsFinaux : motifs, derniere);
}
