/**
 * Journal unique (lot FAC-8) — la seule porte d'écriture d'une entrée
 * `ActivityLog` du chantier formateurs.
 *
 * `journaliser(tx, entree, options?)` écrit DANS le client que l'appelant lui
 * passe : la transaction de l'acte qu'elle documente, ou `prisma` pour une
 * trace hors transaction. Ce module n'importe pas le client global — une
 * trace écrite à côté de la transaction survivrait à son annulation.
 *
 * - **Sans option** : tolérance historique de `logQualiopiActivity` — un échec
 *   (écriture ou lecture du contexte) est avalé, la fonction rend `false`. Un
 *   log raté n'invalide pas l'action métier.
 * - **`exiger: true`** : l'échec est LEVÉ. Pour l'activation d'un formateur et
 *   tout acte qui touche à l'argent : sans trace, pas d'acte.
 *
 * Les `changes:` passent TOUJOURS par `filtrerChangesJournal`.
 *
 * ⚠️ Ce module n'importe ni `next/headers` ni le client global : le worker
 * (`tsx`, hors de Next) doit pouvoir l'utiliser. Le contexte de requête (IP
 * hachée, user-agent) est fourni par l'appelant via `options.contexte` —
 * `_guards` qualiopi le lit dans les en-têtes, un acte du worker n'en a pas.
 */

import { masquerDonneesSensibles } from "@/lib/security/masquage-donnees-sensibles";

export interface EntreeJournal {
  /** Action canonique ex. "qualiopi.trainer.activation". */
  readonly action: string;
  /** Type de cible ex. "Trainer". Par défaut « qualiopi ». */
  readonly targetType?: string;
  /** ID de la cible. */
  readonly targetId?: string | null;
  /** Diff/payload sérialisable — filtré avant écriture. */
  readonly changes?: unknown;
  /** Auteur de l'acte ; `null` pour un acte du système. */
  readonly session: { readonly userId: string } | null;
}

/** Contexte de la requête à l'origine de l'acte, déjà prêt à stocker (IP hachée). */
export interface ContexteJournal {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface OptionsJournal {
  /** Lever si l'entrée n'a pas pu être écrite (activation, argent). */
  readonly exiger?: boolean;
  /** Lecture du contexte, appelée sous la même tolérance que l'écriture. */
  readonly contexte?: () => ContexteJournal | Promise<ContexteJournal>;
}

export interface DonneesJournal {
  adminUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: never;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Le strict nécessaire d'un client Prisma ou d'un client de transaction. */
export interface ClientJournal {
  readonly activityLog: { create(args: { data: DonneesJournal }): PromiseLike<unknown> };
}

/** Valeur qui remplace une donnée d'identification dans le journal. */
export const MODIFIE = Object.freeze({ modifie: true as const });

const PROFONDEUR_MAX = 12;

function motsDeLaCle(cle: string): Set<string> {
  return new Set(
    cle
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length > 0),
  );
}

const MOTS_NUMERO = ["numero", "num", "no", "number"];
const MOTS_PIECE = ["piece", "pieces"];

/**
 * Vrai si la clé désigne un numéro de pièce d'identité ou un numéro de
 * déclaration d'activité. La clé est découpée en MOTS : `pieceId`, `pieces`
 * ou `agenda` restent lisibles.
 */
export function estCleIdentifiante(cle: string): boolean {
  const mots = motsDeLaCle(cle);
  const a = (liste: ReadonlyArray<string>) => liste.some((m) => mots.has(m));
  if (a(["passeport", "passport", "cni"])) return true;
  if (a(MOTS_PIECE) && a([...MOTS_NUMERO, "identite"])) return true;
  if (mots.has("identite") && a(MOTS_NUMERO)) return true;
  if (mots.has("nda")) return true;
  if (mots.has("declaration") && mots.has("activite")) return true;
  return false;
}

function remplacer(valeur: unknown, profondeur: number, vus: WeakSet<object>): unknown {
  if (valeur === null || typeof valeur !== "object" || valeur instanceof Date) return valeur;
  if (vus.has(valeur)) return "[circulaire]";
  if (profondeur >= PROFONDEUR_MAX) return "[profondeur]";
  vus.add(valeur);
  try {
    if (Array.isArray(valeur)) return valeur.map((v) => remplacer(v, profondeur + 1, vus));
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      // Un booléen ou un null ne dit rien de la personne (`numeroPieceVerifie: true`).
      const neutre = v === null || v === undefined || typeof v === "boolean";
      sortie[cle] =
        !neutre && estCleIdentifiante(cle) ? { ...MODIFIE } : remplacer(v, profondeur + 1, vus);
    }
    return sortie;
  } finally {
    vus.delete(valeur);
  }
}

/**
 * Filtre des `changes:` du journal, à toute profondeur (objets et tableaux) :
 *
 * - numéro de pièce d'identité, numéro de déclaration d'activité →
 *   `{ modifie: true }` ;
 * - IBAN, BIC, RIB, e-mail, téléphone, adresse → masquage existant
 *   (`masquerDonneesSensibles`, réutilisé et non recopié).
 *
 * Ne modifie jamais l'objet reçu.
 */
export function filtrerChangesJournal(changes: unknown): unknown {
  return masquerDonneesSensibles(remplacer(changes ?? null, 0, new WeakSet()));
}

/** Les données d'une entrée de journal, SANS l'écrire. */
export function donneesJournal(
  entree: EntreeJournal,
  contexte?: ContexteJournal | null,
): DonneesJournal {
  return {
    adminUserId: entree.session?.userId ?? null,
    action: entree.action.slice(0, 120),
    targetType: (entree.targetType ?? "qualiopi").slice(0, 80),
    targetId: entree.targetId ?? null,
    changes: filtrerChangesJournal(entree.changes) as never,
    ipAddress: contexte?.ipAddress?.slice(0, 64) ?? null,
    userAgent: contexte?.userAgent?.slice(0, 2000) ?? null,
  };
}

/**
 * Écrit l'entrée dans `tx`. Rend `true` si elle est écrite ; sans `exiger`,
 * `false` en cas d'échec (toléré).
 */
export async function journaliser(
  tx: ClientJournal,
  entree: EntreeJournal,
  options?: OptionsJournal,
): Promise<boolean> {
  try {
    const contexte = options?.contexte ? await options.contexte() : null;
    await tx.activityLog.create({ data: donneesJournal(entree, contexte) });
    return true;
  } catch (err) {
    if (options?.exiger) throw err;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[qualiopi-activity-log] persist failed (best-effort):",
        err instanceof Error ? err.message : String(err),
      );
    }
    return false;
  }
}
