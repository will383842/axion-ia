import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogListingView, buildBlogListingMetadata } from "../../_views/BlogListingView";

// Pagination du hub /blog par CHEMIN — `/blog/page/2`, `/blog/page/3`, …
//
// Audit indexation GSC 2026-07-31 (P1 « BYPASS /fr/blog ») — remplace la
// pagination `?page=N` qui rendait le hub dynamique (non cacheable CDN, cf.
// commentaire de `../../page.tsx`). Route ISR : rendue à la demande puis
// cacheable à l'edge comme toute page du site. Pas de `generateStaticParams` :
// le nombre de pages dépend de la DB (0 au build stub) — `dynamicParams`
// (défaut true) rend chaque page à la première requête, l'ISR fait le reste.
export const revalidate = 3600;

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
