import type { Metadata } from "next";
import { BlogListingView, buildBlogListingMetadata } from "./_views/BlogListingView";

// ISR Next 16 — pré-rendue au build, revalidée toutes les heures pour que les
// articles DB publiés par la factory apparaissent automatiquement sans rebuild.
// 2026-06-21 (P1) : l'index est DB-FIRST (loadBlogIndexForView fusionne DB
// tier-1+2 + FS). Au build stub.invalid → FS-only, l'ISR repeuple sous 1h.
//
// Audit indexation GSC 2026-07-31 (P1 « BYPASS /fr/blog ») — cette route ne lit
// PLUS `searchParams` : `await searchParams` forçait un rendu DYNAMIQUE à chaque
// requête malgré `revalidate` (Next émettait `Cache-Control: private, no-store`
// → `cf-cache-status: BYPASS` mesuré en prod, origin tapé à froid par tous les
// crawls du hub). La pagination vit désormais dans le CHEMIN :
// `/blog/page/[num]` (cf. `./page/[num]/page.tsx`) ; les anciennes URLs
// `?page=N` sont 301 par `next.config.ts`. Cette page EST la page 1.
export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildBlogListingMetadata(locale, 1);
}

export default async function BlogListing({ params }: Props) {
  const { locale } = await params;
  return <BlogListingView locale={locale} currentPageRequested={1} />;
}
