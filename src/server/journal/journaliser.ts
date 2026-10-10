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
 * ⚠️ **La tolérance ne vaut que HORS transaction interactive.** Dans un
 * `prisma.$transaction(async (tx) => …)`, une requête refusée par Postgres
 * annule la transaction entière : avaler l'erreur ne sauve pas l'acte, la
 * requête suivante échoue (« current transaction is aborted »). En transaction,
 * appeler `journaliser` avec `exiger: true`, ou avec des données déjà validées.
 * Les refus que ce module sait détecter (`targetId` qui n'est pas un UUID) sont
 * levés AVANT toute requête : ils ne touchent jamais la transaction.
 *
 * Les `changes:` passent TOUJOURS par `filtrerChangesJournal`.
 *
 * ⚠️ Ce module n'importe ni `next/headers` ni le client global : le worker
 * (`tsx`, hors de Next) doit pouvoir l'utiliser. Le contexte de requête (IP
 * hachée, user-agent) est fourni par l'appelant via `options.contexte` —
 * `_guards` qualiopi le lit dans les en-têtes, un acte du worker n'en a pas.
 */

import { masquerDonneesSensibles, natureDeLaCle } from "@/lib/security/masquage-donnees-sensibles";

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

/**
 * Formes d'un mot de clé : le mot lui-même et, au pluriel (`s`, `x`, `es`),
 * son singulier. `emails`, `telephones`, `ibans` ou `ndas` se lisent comme leur
 * singulier ; un mot de trois lettres (`nos`, `fax`) reste tel quel.
 */
function formesDuMot(mot: string): string[] {
  if (mot.length <= 3 || !/[sx]$/.test(mot)) return [mot];
  const formes = [mot, mot.slice(0, -1)];
  if (mot.endsWith("es")) formes.push(mot.slice(0, -2));
  return formes;
}

function motsDeLaCle(cle: string): Set<string> {
  return new Set(
    cle
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length > 0)
      .flatMap(formesDuMot),
  );
}

/** Nature de la clé, pluriels compris (`emails` → personnel, `emailHashes` → empreinte). */
function natureJournal(cle: string): ReturnType<typeof natureDeLaCle> {
  return natureDeLaCle([...motsDeLaCle(cle)].join("_"));
}

/** Clé de même nature que le masquage existant reconnaît au singulier. */
const CLE_SINGULIERE = { bancaire: "iban", personnel: "email" } as const;

const MOTS_NUMERO = ["numero", "num", "no", "number"];
const MOTS_PIECE = ["piece"];

/**
 * Vrai si la clé désigne un numéro de pièce d'identité ou un numéro de
 * déclaration d'activité, pluriels compris. La clé est découpée en MOTS :
 * `pieceId`, `pieces` ou `agenda` restent lisibles.
 */
export function estCleIdentifiante(cle: string): boolean {
  const mots = motsDeLaCle(cle);
  const a = (liste: ReadonlyArray<string>) => liste.some((m) => mots.has(m));
  if (a(["passeport", "passport", "cni"])) return true;
  if (a(MOTS_PIECE) && a([...MOTS_NUMERO, "identite"])) return true;
  if (mots.has("identite") && a(MOTS_NUMERO)) return true;
  if (mots.has("nda")) return true;
  if (mots.has("declaration") && (mots.has("activite") || a(MOTS_NUMERO))) return true;
  return false;
}

/** Une adresse e-mail, où qu'elle soit dans le texte. */
const EMAIL_RE = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi;
/** Forme d'un IBAN (avec ou sans espaces), majuscules — même règle que le masquage existant. */
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/;
/** Un numéro de téléphone : la valeur ENTIÈRE, de 9 à 15 chiffres. */
const TELEPHONE_RE = /^\+?[\d\s.\-()]{9,}$/;

function aFormeDeTelephone(texte: string): boolean {
  const chiffres = texte.replace(/\D/g, "").length;
  return TELEPHONE_RE.test(texte.trim()) && chiffres >= 9 && chiffres <= 15;
}

/**
 * Valeur rangée sous une clé d'EMPREINTE : elle reste telle quelle si c'est
 * bien une empreinte, et elle est masquée si elle a la forme d'un IBAN, d'un
 * e-mail ou d'un téléphone — le nom de la clé ne garantit pas son contenu.
 */
function texteSousEmpreinte(texte: string): unknown {
  if (IBAN_RE.test(texte)) return masquerDonneesSensibles({ iban: texte }).iban;
  if (new RegExp(EMAIL_RE.source, "i").test(texte) || aFormeDeTelephone(texte)) {
    return { masque: true };
  }
  return texte;
}

function remplacer(
  valeur: unknown,
  profondeur: number,
  vus: WeakSet<object>,
  empreinte: boolean,
): unknown {
  if (typeof valeur === "string") {
    return empreinte ? texteSousEmpreinte(valeur) : valeur.replace(EMAIL_RE, "[e-mail masqué]");
  }
  if (valeur === null || typeof valeur !== "object" || valeur instanceof Date) return valeur;
  if (vus.has(valeur)) return "[circulaire]";
  if (profondeur >= PROFONDEUR_MAX) return "[profondeur]";
  vus.add(valeur);
  try {
    if (Array.isArray(valeur)) {
      return valeur.map((v) => remplacer(v, profondeur + 1, vus, empreinte));
    }
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      // Un booléen ou un null ne dit rien de la personne (`numeroPieceVerifie: true`).
      const neutre = v === null || v === undefined || typeof v === "boolean";
      if (!neutre && estCleIdentifiante(cle)) {
        sortie[cle] = { ...MODIFIE };
        continue;
      }
      const nature = empreinte ? "empreinte" : natureJournal(cle);
      if (nature === "bancaire" || nature === "personnel") {
        if (natureDeLaCle(cle) === null) {
          // Pluriel (`emails`, `ibans`) : le masquage existant ne lit que le
          // singulier — on lui présente la valeur sous une clé de même nature.
          const cleSinguliere = CLE_SINGULIERE[nature];
          sortie[cle] = masquerDonneesSensibles({ [cleSinguliere]: v })[cleSinguliere];
          continue;
        }
      }
      sortie[cle] = remplacer(v, profondeur + 1, vus, nature === "empreinte");
    }
    return sortie;
  } finally {
    vus.delete(valeur);
  }
}

/**
 * Filtre des `changes:` du journal, à toute profondeur (objets et tableaux) :
 *
 * - numéro de pièce d'identité, numéro de déclaration (d'activité) →
 *   `{ modifie: true }` ;
 * - IBAN, BIC, RIB, e-mail, téléphone, adresse → masquage existant
 *   (`masquerDonneesSensibles`, réutilisé et non recopié), clés au pluriel
 *   comprises ;
 * - sous une clé d'empreinte (`emailHash`, `ibanMasque`…), une valeur qui a la
 *   forme d'un IBAN, d'un e-mail ou d'un téléphone est masquée quand même ;
 * - ailleurs, une adresse e-mail dans un texte libre est remplacée (l'IBAN dans
 *   un texte l'est déjà par le masquage existant).
 *
 * Ne modifie jamais l'objet reçu.
 */
export function filtrerChangesJournal(changes: unknown): unknown {
  return masquerDonneesSensibles(remplacer(changes ?? null, 0, new WeakSet(), false));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Les données d'une entrée de journal, SANS l'écrire.
 *
 * Lève si `targetId` n'est pas un UUID (colonne `@db.Uuid`) : le refus a lieu
 * ici, avant toute requête, plutôt que dans Postgres — où il annulerait la
 * transaction de l'appelant.
 */
export function donneesJournal(
  entree: EntreeJournal,
  contexte?: ContexteJournal | null,
): DonneesJournal {
  if (entree.targetId != null && !UUID_RE.test(entree.targetId)) {
    throw new TypeError("Journal : `targetId` doit être un UUID.");
  }
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
