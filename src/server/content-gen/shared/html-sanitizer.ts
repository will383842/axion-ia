/**
 * Content Generator — HTML sanitizer pour output LLM (Pass B fix P0-5).
 *
 * Wrapper isomorphic-dompurify avec whitelist stricte alignée doctrine
 * éditoriale Axion-IA (§ 4.1bis master prompt + § 0.5 audit log).
 *
 * **Pourquoi** : tout HTML retourné par un LLM (OpenAI/Anthropic/Perplexity)
 * peut contenir `<script>`, `<iframe>`, event handlers `onerror=`,
 * `javascript:` URIs ou autres payloads d'injection. Insérer ce HTML brut
 * dans `Article.bodyHtml` → puis rendu via `dangerouslySetInnerHTML` côté
 * client = **XSS persistant** déclenché à chaque visite de la page article
 * publique (vol cookies admin si CSP nonce contournable).
 *
 * **Doctrine d'usage** : appeler `sanitizeContentGenHtml()` sur TOUT output
 * `bodyHtml` retourné par un generator AVANT d'insérer en DB (Article ou
 * ArticleTranslation) et AVANT toute conservation dans une queue BullMQ.
 *
 * **Tests** : `src/server/content-gen/shared/html-sanitizer.test.ts` couvre
 * les vecteurs OWASP top-10 XSS (script, iframe, onerror, javascript:,
 * data:text/html, SVG onload).
 */

import DOMPurify from "isomorphic-dompurify";

import { computeTrustTier, extractDomain, relAttrForExternalLink } from "../links/trust-tier";

/** Tags HTML autorisés dans les contenus content-gen (éditorial long-form). */
const ALLOWED_TAGS = [
  // Texte structuré
  "h2",
  "h3",
  "h4",
  "p",
  "blockquote",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "code",
  "pre",
  "br",
  "hr",
  // Listes
  "ul",
  "ol",
  "li",
  // Tableaux (rares mais utiles en comparatifs)
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  // Liens internes/externes (sanitize attrs href)
  "a",
  // Images (héro + inline)
  "img",
  "figure",
  "figcaption",
  // Sections sémantiques AEO
  "section",
  "article",
  "aside",
  "details",
  "summary",
];

const ALLOWED_ATTR = [
  "href",
  "title",
  "alt",
  "src",
  "loading",
  "width",
  "height",
  "id",
  "class",
  "data-aeo",
  "data-section",
  "rel",
  "target",
];

/**
 * Sanitize un HTML LLM output selon la whitelist content-gen.
 * - Strippe `<script>`, `<iframe>`, `<object>`, `<embed>`, etc.
 * - Strippe tous les event handlers (`on*=`).
 * - Strippe `javascript:` et `data:text/html` URIs.
 * - Force `rel="noopener noreferrer"` sur tout `<a target="_blank">`.
 * - Conserve les classes éditoriales (`.faq-answer`, `[data-aeo]`) pour
 *   la conformité Speakable JSON-LD.
 *
 * @param html — HTML brut retourné par un generator content-gen.
 * @returns HTML sanitisé prêt pour insert DB / render `dangerouslySetInnerHTML`.
 */
export function sanitizeContentGenHtml(html: string): string {
  if (typeof html !== "string") return "";
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Forbidden tags/attrs explicite (défense en profondeur — DOMPurify gère
    // déjà ces cas mais on documente l'intent).
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style", "svg"],
    FORBID_ATTR: ["style", "srcdoc"],
    // URI safe : seuls http/https/mailto/tel autorisés (pas de javascript:).
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[/#?])/i,
    // Conserve les attributs data-* whitelistés.
    ADD_ATTR: ["data-aeo", "data-section"],
    // Pas de retour d'éléments DOM, on veut une string.
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });

  // E1 2026-06-15 — Trust tier policy (V-14) : le `rel` des liens externes est
  // dérivé de `computeTrustTier(domain)`. Les sources d'autorité (official/high
  // : .gouv.fr, europa.eu, ISO, presse de référence…) sortent en dofollow
  // (`rel="noopener noreferrer"`), tout le reste (standard/low/inconnu) reste en
  // nofollow (`rel="nofollow noopener noreferrer"`) pour éviter la fuite de
  // PageRank. Les liens internes (relatifs `/…` ou axion-ia.com) restent
  // dofollow et ne sont pas touchés.
  const withExternalRel = ensureExternalLinkRel(sanitized);

  // Post-traitement : force rel="noopener noreferrer" sur tous les
  // `<a target="_blank">` restants (sécurité reverse-tabnabbing) — couvre les
  // liens INTERNES ouverts en nouvel onglet (les externes ont déjà leur rel).
  return withExternalRel.replace(
    /<a\b([^>]*?)target=["']_blank["']([^>]*?)>/gi,
    (match, before: string, after: string) => {
      const all = (before + after).toLowerCase();
      if (all.includes("rel=")) return match;
      return `<a${before}target="_blank"${after} rel="noopener noreferrer">`;
    },
  );
}

/** Host canonique du site (les liens vers ce host restent dofollow). */
const SITE_HOST = "axion-ia.com";

/**
 * Pose le bon `rel` sur chaque lien EXTERNE (URL absolue http(s) dont le host
 * n'est pas axion-ia.com), dérivé du trust tier du domaine (doctrine V-14) :
 *   - official / high → dofollow (`rel="noopener noreferrer"`)
 *   - standard / low / domaine inconnu → nofollow (`rel="nofollow noopener
 *     noreferrer"`), défaut conservateur anti-fuite PageRank
 * Fusionne avec un `rel` existant sans dupliquer les tokens, et conserve
 * toujours `noopener` + `noreferrer` (sécurité reverse-tabnabbing). Les liens
 * internes/relatifs sont laissés intacts (dofollow voulu pour le maillage).
 */
function ensureExternalLinkRel(html: string): string {
  const isExternalHref = (href: string): boolean => {
    if (!/^https?:\/\//i.test(href)) return false; // relatif / ancre / mailto → interne
    try {
      const host = new URL(href).hostname.toLowerCase();
      return host !== SITE_HOST && !host.endsWith(`.${SITE_HOST}`);
    } catch {
      return false;
    }
  };
  return html.replace(/<a\b([^>]*)>/gi, (match, attrs: string) => {
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    if (!hrefMatch) return match;
    const href = hrefMatch[1] ?? "";
    if (!isExternalHref(href)) return match;
    // `computeTrustTier` attend un DOMAINE (hostname), pas une URL complète.
    // Défaut SÛR : domaine non extractible → nofollow (tier "standard").
    const domain = extractDomain(href);
    const tier = domain ? computeTrustTier(domain) : "standard";
    const policyRel = relAttrForExternalLink(tier); // valeur complète du rel
    const relMatch = attrs.match(/rel=["']([^"']*)["']/i);
    // Fusionne le rel existant (LLM) avec la policy, sans dupliquer les tokens,
    // et garantit noopener + noreferrer même si la policy/le LLM les omet.
    const tokens = new Set(
      [...(relMatch?.[1] ?? "").split(/\s+/), ...policyRel.split(/\s+/)].filter(Boolean),
    );
    tokens.add("noopener");
    tokens.add("noreferrer");
    const relValue = [...tokens].join(" ");
    const newAttrs = relMatch
      ? attrs.replace(/rel=["'][^"']*["']/i, `rel="${relValue}"`)
      : `${attrs} rel="${relValue}"`;
    return `<a${newAttrs}>`;
  });
}
