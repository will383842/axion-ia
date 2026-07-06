// Génération du slug d'un avis client (page indexable `/avis/[slug]`).
// Slug lisible + stable : prénom-initiale-entreprise/secteur-ville + suffixe court
// pour garantir l'unicité. La partie base est déterministe (testable) ; le suffixe
// est fourni par l'appelant (l'action retente en cas de collision unique).
//
// Fichier PUR — importable client ET serveur.

/** Normalise un token en segment de slug ASCII (accents retirés, kebab-case). */
export function slugifyToken(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface ReviewSlugParts {
  firstName: string;
  lastInitial: string;
  company?: string | null;
  sector?: string | null;
  city?: string | null;
}

/** Base déterministe du slug (sans suffixe d'unicité). */
export function buildReviewSlugBase(parts: ReviewSlugParts): string {
  const tokens = [parts.firstName, parts.lastInitial, parts.company || parts.sector, parts.city]
    .filter((v): v is string => Boolean(v))
    .map(slugifyToken)
    .filter(Boolean);
  const base = tokens.join("-").slice(0, 150);
  return base || "avis";
}

/** Slug final = base + suffixe court d'unicité (max 200 car., aligné VarChar(200)). */
export function buildReviewSlug(base: string, suffix: string): string {
  const clean = suffix.replace(/[^a-z0-9]/gi, "").toLowerCase() || "0";
  return `${base}-${clean}`.slice(0, 200);
}
