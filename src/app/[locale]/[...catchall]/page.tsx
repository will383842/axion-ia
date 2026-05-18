import { notFound } from "next/navigation";

/**
 * Catch-all `[locale]/[...catchall]/page.tsx` — déclenche un 404 HTTP propre
 * pour toutes les routes non-matchées sous un locale (`/fr/tarifs`,
 * `/en/bidon`, etc.).
 *
 * Pourquoi : sans ce catch-all, Next 16 + next-intl middleware servent la
 * page `[locale]/not-found.tsx` avec un **status 200 OK**. Conséquence :
 * Google Search Console qualifie ces URLs en « soft 404 » (page d'erreur
 * servie avec HTTP 200 → impossible de désindexer / corriger). Audit
 * 2026-05-15 — bug détecté par l'agent CLS.
 *
 * Ce catch-all a une priorité de routage plus faible que les pages
 * statiques (`a-propos`, `audit`, `blog`…) et dynamiques explicites
 * (`actualites/[slug]`, `blog/[slug]`, `implantations/[region]/[ville]`,
 * etc.) — donc il n'intercepte que les URLs effectivement non couvertes.
 *
 * `notFound()` propage `NEXT_NOT_FOUND` qui est convertie en 404 + render
 * de `[locale]/not-found.tsx`, exactement le comportement Search Console
 * attendu.
 *
 * Audit indexation 2026-05-18 P0-7 — `dynamic = "force-dynamic"` requis.
 * Sans cela, Next 16 marque le rendering comme static (la fonction n'a pas
 * de params dependents) et le cache forever (live observé `x-nextjs-cache:
 * HIT` + `Cache-Control: s-maxage=31536000` 1 AN). Conséquence : status 200
 * servi indéfiniment pour toute URL inexistante → soft 404 site-wide. Le
 * mode `force-dynamic` force l'exécution per-request → `notFound()` lance
 * `NEXT_NOT_FOUND` à chaque hit → status 404 réel propagé.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CatchAllNotFound(): never {
  notFound();
}
