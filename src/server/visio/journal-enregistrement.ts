/**
 * Le journal TECHNIQUE d'un enregistrement (`Enregistrement.evenements`) :
 * pauses, reprises, clôtures, corrections. JAMAIS de parole, jamais de nom.
 *
 * Texte JSON (tableau d'objets `{ le, type }`), borné à `MAX_EVENEMENTS`
 * entrées : un appareil qui bégaie ne doit pas faire grossir une ligne sans fin.
 */

export const MAX_EVENEMENTS = 2000;

/**
 * Les types que SEUL le serveur écrit. Plusieurs sont LUS comme des décisions
 * (`court_confirme`, `fenetres_verifiees`, `accord_confirme_par_will`…) : un
 * journal envoyé par l'extension (`POST sessions/[id]/fin`) qui en porterait
 * un lèverait une vérification de Will. Ils sont écartés à la réception.
 */
export const TYPES_RESERVES_AU_SERVEUR: ReadonlySet<string> = new Set([
  // décisions de Will et du circuit
  "court_confirme",
  "fenetres_verifiees",
  "accord_a_confirmer",
  "accord_retrouve",
  "accord_confirme_par_will",
  "precontrole",
  // cycle de vie écrit par les routes et la clôture
  "session_creee",
  "accord_obtenu",
  "accord_en_retard_accepte",
  "refus",
  "reprise_battement",
  "fin",
  "fin_sans_accord",
  "cloture_serveur",
  "cloture_serveur_corrigee",
  "cloture_accord_absent",
  "interrompu_sans_battement",
]);

/** Le journal reçu de l'extension, sans les types réservés au serveur. */
export function evenementsDeLExtension<T extends { readonly type: string }>(
  evenements: readonly T[],
): T[] {
  return evenements.filter((e) => !TYPES_RESERVES_AU_SERVEUR.has(e.type.trim().toLowerCase()));
}

export interface EvenementTechnique {
  readonly le: string;
  readonly type: string;
}

/** Relit un journal ; un texte illisible vaut un journal vide (jamais une erreur). */
export function lireJournal(texte: string | null | undefined): EvenementTechnique[] {
  if (!texte) return [];
  try {
    const brut: unknown = JSON.parse(texte);
    if (!Array.isArray(brut)) return [];
    return brut.filter(
      (e): e is EvenementTechnique =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as EvenementTechnique).le === "string" &&
        typeof (e as EvenementTechnique).type === "string",
    );
  } catch {
    return [];
  }
}

/** Ajoute des événements (type court, sans parole) et rend le texte à écrire. */
export function ajouterAuJournal(
  texte: string | null | undefined,
  ...evenements: ReadonlyArray<{ readonly le: Date | string; readonly type: string }>
): string {
  const journal = lireJournal(texte);
  for (const e of evenements) {
    journal.push({
      le: typeof e.le === "string" ? e.le : e.le.toISOString(),
      type: e.type.slice(0, 40),
    });
  }
  return JSON.stringify(journal.slice(-MAX_EVENEMENTS));
}
