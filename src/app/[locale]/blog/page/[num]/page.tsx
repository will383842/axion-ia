import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogListingView, buildBlogListingMetadata } from "../../_views/BlogListingView";

// Pagination du hub /blog par CHEMIN — `/blog/page/2`, `/blog/page/3`, …
//
// Audit indexation GSC 2026-07-31 (P1 « BYPASS /fr/blog ») — remplace la
// pagination `?page=N` qui rendait le hub dynamique (non cacheable CDN, cf.
// commentaire de `../../page.tsx`). Route ISR : rendue à la demande puis
// cacheable à l'edge comme toute page du site.
//
// 🔴 RECTIFIÉ le 2026-08-16 — GEO-061 (audit GEO/AEO du 2026-08-14, lot 19).
//
// Le commentaire précédent affirmait que sans `generateStaticParams`,
// « `dynamicParams` rend chaque page à la première requête, l'ISR fait le
// reste ». **C'est faux, et mesuré en production le 2026-08-16 :**
//
//   /fr/blog        → `x-nextjs-prerender: 1`, `x-nextjs-cache: HIT`,
//                     `Cache-Control: s-maxage=3600`
//   /fr/blog/page/2 → AUCUN de ces en-têtes,
//                     `Cache-Control: private, no-store`, `cf-cache-status: BYPASS`
//
// Un segment dynamique qui n'entre dans aucun manifeste de pré-rendu n'est pas
// servi en ISR : il est servi **entièrement dynamiquement**. Chaque passage de
// visiteur ou de crawler traverse donc l'origine et déclenche un rendu complet,
// et Cloudflare ne peut rien mettre en cache.
export const revalidate = 3600;

/**
 * Plancher de pages pré-rendues. Au-delà, `dynamicParams` (défaut `true`) prend
 * le relais — mais ces pages-là resteront dynamiques, d'où un plancher plutôt
 * qu'une liste exhaustive : les premières pages concentrent l'essentiel du
 * crawl et des visites.
 *
 * ⚠️ Volontairement SANS lecture de base : le build tourne avec les URLs stub
 * (contrat ADR 0026), et `generateStaticParams` doit rendre le même résultat en
 * build et en production.
 */
const PAGES_PRERENDUES = [2, 3, 4, 5] as const;

export function generateStaticParams(): Array<{ num: string }> {
  return PAGES_PRERENDUES.map((n) => ({ num: String(n) }));
}

interface Props {
  params: Promise<{ locale: string; num: string }>;
}

/**
 * `num` doit être un entier ≥ 2 en écriture canonique (pas de `01`, pas de
 * `+2`) : tout le reste est un 404 franc — une URL de chemin malformée ne doit
 * pas créer d'alias indexable. `1` est l'unique exception : 308 vers `/blog`
 * (la page 1 canonique), pour absorber les liens externes éventuels.
 */
function parseCanonicalPageNum(raw: string): number | "one" | null {
  if (raw === "1") return "one";
  if (!/^[2-9]\d*$/.test(raw)) return null;
  return parseInt(raw, 10);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, num } = await params;
  const page = parseCanonicalPageNum(num);
  if (page === null || page === "one") return {};
  return buildBlogListingMetadata(locale, page);
}

export default async function BlogListingPaged({ params }: Props) {
  const { locale, num } = await params;
  const page = parseCanonicalPageNum(num);
  if (page === "one") permanentRedirect(`/${locale}/blog`);
  if (page === null) notFound();
  // Hors bornes (page > totalPages) → notFound() DANS la vue (elle seule
  // connaît le compte d'articles DB du moment).
  return <BlogListingView locale={locale} currentPageRequested={page} />;
}
