// Réécriture des liens internes dans les corps d'articles persistés.
//
// 🔴 POURQUOI CE FICHIER EXISTE — GEO-079 + GEO-081
// (audit GEO/AEO end-to-end du 2026-08-14, lot 13)
//
// Mesuré en production le 2026-08-16 : les liens internes injectés dans les
// corps d'articles sont écrits **sans préfixe de langue**. Chacun provoque donc
// une redirection à chaque clic et à chaque passage de crawler :
//
//   /audit                      → 301 → /fr/audit
//   /un-a-un                    → 301 → /fr/un-a-un
//   /blog/<slug>                → 301 → /fr/blog/<slug>
//
// Et pour deux d'entre eux, la redirection en enchaîne une seconde (GEO-081) :
//
//   /reserver        → 301 → /fr/reserver        → 308 → /fr/appel
//   /implementations → 301 → /fr/implementations → 308 → /fr/implementation
//
// Un lien qui redirige n'est pas neutre : il coûte un aller-retour à chaque
// visiteur, dilue le signal transmis à la page cible, et consomme du budget de
// crawl sur **tout le corpus** — 22 des 23 articles échantillonnés en portaient
// au moins un.
//
// ## Pourquoi au RENDU et pas à l'écriture
//
// Corriger à l'injection ne réparerait que les articles à venir. La réécriture
// au rendu couvre **tout le stock déjà publié**, sans reprise de base, en un
// seul point de code. Les deux ont été faits : la consigne qui fabriquait le
// défaut est corrigée à la source, et ce module rattrape l'existant.
//
// ## Coût
//
// Ce module s'exécute dans un Server Component. Il ne part **pas** au
// navigateur : aucun octet de JavaScript client, donc aucun effet sur le TBT ni
// sur l'INP — les deux budgets que le contrat de performance protège. Le coût
// est du temps CPU serveur, sur des pages rendues en ISR (une fois par heure,
// pas à chaque requête).

/** Langues préfixables. Aligné sur `routing.locales`. */
const LOCALES = ["fr", "en"] as const;

/**
 * Chemins internes qui, une fois préfixés, redirigeraient **encore** (GEO-081).
 * On les résout directement vers leur destination finale.
 *
 * 🔑 Cette table est courte **par construction**, pas par paresse : les routes
 * injectées dans les corps sont énumérées dans les gabarits du générateur, et
 * ce sont exactement celles-là. On ne réimplémente donc pas les 70 règles de
 * `next.config.ts` — ce serait coûteux au rendu et fragile (motifs dynamiques).
 *
 * ⚠️ Les règles de redirection elles-mêmes restent en place et ne doivent PAS
 * être retirées : des liens entrants externes en dépendent. Cette table les
 * double pour les liens que NOUS émettons, elle ne les remplace pas.
 */
export const ALIAS_LIENS_INTERNES: Readonly<Record<string, string>> = {
  "/implementations": "/implementation",
  "/interventions/essentielle": "/formations",
  "/reserver": "/appel",
};

/**
 * Préfixes à ne jamais toucher : ce ne sont pas des pages localisées.
 * Une erreur ici casserait des ressources, pas seulement un lien.
 */
const PREFIXES_EXCLUS = [
  "/api/",
  "/_next/",
  "/sitemap",
  "/robots",
  "/favicon",
  "/icon",
  "/apple-",
  "/manifest",
  "/images/",
  "/image-bank/",
  "/uploads/",
  "/fonts/",
  "/documents/",
  "/.well-known/",
] as const;

/** `true` si le chemin désigne une ressource plutôt qu'une page. */
function estRessource(chemin: string): boolean {
  if (PREFIXES_EXCLUS.some((p) => chemin.startsWith(p))) return true;
  // Extension de fichier sur le dernier segment (`/x/plaquette.pdf`).
  const dernier = chemin.split("/").pop() ?? "";
  return /\.[a-z0-9]{2,5}$/i.test(dernier);
}

/** `true` si le chemin porte déjà un préfixe de langue. */
function dejaPrefixe(chemin: string): boolean {
  return LOCALES.some((l) => chemin === `/${l}` || chemin.startsWith(`/${l}/`));
}

/**
 * Résout un href interne vers sa forme finale : préfixé et sans redirection.
 *
 * Retourne `null` quand le href ne doit pas être touché — cas volontairement
 * nombreux, parce qu'une réécriture de trop casse un lien qui marchait.
 */
export function resoudreLienInterne(href: string, locale: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  if (dejaPrefixe(href)) return null;

  // Séparer chemin / query / ancre : `/audit?x=1#y` doit rester intact au-delà
  // du chemin. Découper dans le mauvais ordre produirait `/fr/audit?x=1#y` avec
  // l'ancre avalée par la query.
  const posAncre = href.indexOf("#");
  const sansAncre = posAncre >= 0 ? href.slice(0, posAncre) : href;
  const ancre = posAncre >= 0 ? href.slice(posAncre) : "";
  const posQuery = sansAncre.indexOf("?");
  const chemin = posQuery >= 0 ? sansAncre.slice(0, posQuery) : sansAncre;
  const query = posQuery >= 0 ? sansAncre.slice(posQuery) : "";

  if (chemin === "/" || estRessource(chemin)) return null;

  // Alias appliqué sur le chemin nu, jamais sur la chaîne complète : sinon
  // `/reserver?utm=x` échapperait à la table.
  const cible = ALIAS_LIENS_INTERNES[chemin] ?? chemin;
  return `/${locale}${cible}${query}${ancre}`;
}

/**
 * Réécrit tous les `href` internes d'un fragment HTML.
 *
 * ⚠️ Ne touche QUE l'attribut `href`. Les `src`, les URL en texte brut et les
 * liens externes sont laissés tels quels : élargir la portée reviendrait à
 * réécrire des adresses qu'on ne contrôle pas.
 */
export function prefixerLiensInternes(html: string, locale: string): string {
  if (!html) return html;
  return html.replace(/href="([^"]*)"/g, (entier, href: string) => {
    const resolu = resoudreLienInterne(href, locale);
    return resolu === null ? entier : `href="${resolu}"`;
  });
}
