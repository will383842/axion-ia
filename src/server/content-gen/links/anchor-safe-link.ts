/**
 * Injection de lien « anchor-safe » (audit maillage 2026-07-03).
 *
 * Les injecteurs `linkPhraseInBody` (inject-deep-links.ts) et `injectInternalLinks`
 * (internal-link-catalog.ts) utilisaient un garde-fou regex
 * `(?<!href=…)\bphrase\b(?![^<]*>)` qui évite de lier À L'INTÉRIEUR d'une balise,
 * mais PAS à l'intérieur du texte d'un `<a>…</a>` déjà présent. Résultat : une
 * phrase déjà liée était re-liée → ancres imbriquées `<a><a>…</a></a>` (HTML
 * invalide, constaté sur 6 articles prod).
 *
 * Ce helper segmente le HTML : toute ancre complète `<a>…</a>` et toute balise
 * `<…>` sont OPAQUES (jamais modifiées) ; la phrase n'est liée que dans le texte
 * libre, à sa PREMIÈRE occurrence hors ancre. Retourne le HTML modifié, ou
 * `null` si la phrase n'apparaît nulle part hors ancre/balise.
 */
export function linkPhraseOutsideAnchors(
  bodyHtml: string,
  phrase: string,
  href: string,
): string | null {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phraseRe = new RegExp(`\\b${esc}\\b`, "i");
  // Ancres complètes (non gourmand) + toute autre balise = segments opaques.
  const opaque = /<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>/gi;

  let out = "";
  let lastIndex = 0;
  let done = false;
  let m: RegExpExecArray | null;
  while ((m = opaque.exec(bodyHtml)) !== null) {
    const gap = bodyHtml.slice(lastIndex, m.index);
    if (!done) {
      const replaced = gap.replace(phraseRe, `<a href="${href}">$&</a>`);
      if (replaced !== gap) done = true;
      out += replaced;
    } else {
      out += gap;
    }
    out += m[0]; // balise / ancre inchangée
    lastIndex = opaque.lastIndex;
  }
  const tail = bodyHtml.slice(lastIndex);
  if (!done) {
    const replaced = tail.replace(phraseRe, `<a href="${href}">$&</a>`);
    if (replaced !== tail) done = true;
    out += replaced;
  } else {
    out += tail;
  }
  return done ? out : null;
}
