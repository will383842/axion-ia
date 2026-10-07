// Texte principal RÉÉCRIT À LA MAIN par Will dans la console (réseau d'apporteurs).
//
// Module pur (aucune dépendance React/serveur) : partagé par les gabarits (rendu),
// les Server Actions (validation) et l'interface (borne de la zone de texte).
//
// Sécurité : le texte est TOUJOURS rendu comme du texte par React (échappé), jamais en
// HTML brut ; aucun lien n'est fabriqué à partir de lui. Il n'est écrit dans aucun log.

/** Longueur maximale du texte réécrit (caractères). */
export const TEXTE_LIBRE_MAX = 4000;

export type ValidationTexteLibre =
  { ok: true; texte: string | undefined } | { ok: false; message: string };

/**
 * Valide le texte réécrit reçu d'une Server Action.
 * - absent (undefined / null) : pas de réécriture, le texte par défaut sera utilisé ;
 * - présent : normalisé (fins de ligne, caractères de contrôle retirés), non vide, borné.
 */
export function validerTexteLibre(brut: unknown): ValidationTexteLibre {
  if (brut === undefined || brut === null) return { ok: true, texte: undefined };
  if (typeof brut !== "string") return { ok: false, message: "Le texte de l'e-mail est invalide." };
  const texte = brut
    .replace(/\r\n?/g, "\n")

    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (texte === "") return { ok: false, message: "Le texte de l'e-mail ne peut pas être vide." };
  if (texte.length > TEXTE_LIBRE_MAX) {
    return {
      ok: false,
      message: `Le texte de l'e-mail est trop long (${TEXTE_LIBRE_MAX} caractères au plus).`,
    };
  }
  return { ok: true, texte };
}

/** Paragraphes (séparés par une ligne vide) d'un texte réécrit ; `null` si rien à rendre. */
export function paragraphesLibres(brut: unknown): string[] | null {
  if (typeof brut !== "string") return null;
  const ps = brut
    .slice(0, TEXTE_LIBRE_MAX)
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return ps.length > 0 ? ps : null;
}
