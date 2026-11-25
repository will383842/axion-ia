/**
 * Content Generator — fabrication UNIQUE du texte envoyé à Voyage (chemin Voyage).
 *
 * La publication (persist-article-embedding.ts) et le rattrapage nocturne
 * (embeddings-backfill-worker.ts) appellent cette fonction, et elle seule : un même
 * article donne le même texte, donc le même vecteur, quel que soit le chemin qui l'a calculé.
 *
 * Entrée : le texte BRUT de l'article. Jamais de HTML : si `bodyText` est vide, on retire
 * les balises de `bodyHtml`.
 */

const MAX_MOTS_CORPS = 500;
const MAX_CARACTERES = 32_000;

/** Retire les balises HTML et normalise les espaces. */
export function htmlVersTexte(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildVoyageEmbeddingText(input: {
  readonly title: string;
  readonly metaDescription?: string | null;
  readonly bodyText?: string | null;
  readonly bodyHtml?: string | null;
}): string {
  const parts: string[] = [input.title.trim()];
  const meta = input.metaDescription?.trim();
  if (meta) parts.push(meta);
  const brut = input.bodyText?.trim() ? input.bodyText : htmlVersTexte(input.bodyHtml ?? "");
  const corps = brut.split(/\s+/).filter(Boolean).slice(0, MAX_MOTS_CORPS).join(" ");
  if (corps) parts.push(corps);
  return parts.join("\n\n").slice(0, MAX_CARACTERES);
}
