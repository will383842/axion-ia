/**
 * Rendu des articles générés : un seul bloc « Sources », chapô de repli,
 * comptage de mots sur le texte. Fonctions pures, côté serveur uniquement
 * (aucun octet de JS navigateur).
 *
 * Contexte (audit B, 2026-11-26) : le pipeline pose en fin de corps une
 * `<section id="sources-axion"><h2>Sources</h2>…` (adresses brutes) ET la page
 * affiche le bloc « Sources & méthodologie » (`ArticleSources`, alimenté par les
 * citations en base). Résultat : deux H2 « Sources », dont un dans le sommaire.
 */

const SECTION_SOURCES_RE = /<section\b[^>]*\bid=["']sources-axion["'][^>]*>[\s\S]*?<\/section>/gi;
const ANCRE_RE = /(<a\b[^>]*>)([\s\S]*?)(<\/a>)/gi;
const HREF_RE = /\bhref=["']([^"']+)["']/i;
const ADRESSE_BRUTE_RE = /^(?:https?:\/\/|www\.)\S+$/i;

/** Nom de domaine lisible (sans « www. ») ou null si l'adresse est illisible. */
export function nomDeDomaine(url: string): string | null {
  try {
    const hote = new URL(url.trim()).hostname.replace(/^www\./i, "");
    return hote.length > 0 ? hote : null;
  } catch {
    return null;
  }
}

/**
 * Garantit un seul bloc « Sources » à l'écran.
 *
 * - `aDesCitationsEnBase` : le bloc « Sources & méthodologie » les affiche déjà →
 *   on retire la section du corps (donc aussi son H2 du sommaire, à condition
 *   d'appeler ce helper AVANT `buildToc`).
 * - sinon on garde la section, mais le texte d'un lien qui est une adresse brute
 *   devient le nom de domaine (le `href` ne change pas).
 */
export function unSeulBlocSources(html: string, aDesCitationsEnBase: boolean): string {
  if (!html) return html;
  if (aDesCitationsEnBase) {
    return html.replace(SECTION_SOURCES_RE, "").trimEnd();
  }
  return html.replace(SECTION_SOURCES_RE, (section) =>
    section.replace(ANCRE_RE, (tout, ouvrante: string, texte: string, fermante: string) => {
      const texteNu = texte.replace(/<[^>]*>/g, "").trim();
      if (!ADRESSE_BRUTE_RE.test(texteNu)) return tout;
      const href = HREF_RE.exec(ouvrante)?.[1];
      const domaine = nomDeDomaine(href ?? texteNu) ?? nomDeDomaine(texteNu);
      return domaine ? `${ouvrante}${domaine}${fermante}` : tout;
    }),
  );
}

/**
 * Chapô : l'`excerpt` s'il est rempli, sinon la meta-description (jamais la
 * réponse directe, déjà affichée dans « Réponse rapide »). Chaîne vide si rien.
 */
export function chapoDeRepli(
  excerpt: string | null | undefined,
  metaDescription: string | null | undefined,
): string {
  const e = (excerpt ?? "").trim();
  if (e) return e;
  return (metaDescription ?? "").trim();
}

/** Nombre de mots du TEXTE d'un corps HTML (balises et entités ignorées). */
export function compterMotsTexte(html: string): number {
  const texte = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, "x")
    .trim();
  return texte ? texte.split(/\s+/).length : 0;
}
