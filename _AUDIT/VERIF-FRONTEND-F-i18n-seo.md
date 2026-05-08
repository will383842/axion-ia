# Annexe F — i18n + SEO + AEO

**Source agent** : AGT-I18N-SEO

## Synthèse

| Métrique                                 | Valeur                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm i18n:check`                        | ✅ 38 clés FR ≡ EN                                                           |
| Hreflang coverage                        | 100 % (layout + sitemap)                                                     |
| `x-default` target                       | FR (canonical) — conforme                                                    |
| Pathnames typés                          | 30 routes (FR canonical / EN mirrors)                                        |
| JSON-LD types présents                   | 7 (Organization, WebSite, Service, FAQPage, Article, Review, BreadcrumbList) |
| Pages avec AEO answer block (40-80 mots) | 20+                                                                          |
| Sitemap entries                          | 58+ statiques + slugs dynamiques case-studies + blog                         |
| OG images dynamiques                     | ❌ 0 (`@vercel/og` présent mais non utilisé)                                 |
| RSS feeds                                | ❌ 0 (blog/cas/faq)                                                          |
| llms.txt                                 | ⚠️ basique (TODO `llms-full.txt`)                                            |
| IndexNow                                 | ⚠️ stub (202 Accepted, pas de ping réel)                                     |

## Couverture par axe

| #   | Axe                                       | Statut                                                                      |
| --- | ----------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `pnpm i18n:check` 0 erreur                | ✅                                                                          |
| 2   | Strings hardcodées hors messages/         | ⚠️ ternaires `isFr ? "fr" : "en"` dans pages — design pattern OK            |
| 3   | Hreflang sur chaque page                  | ✅ via `buildProductMetadata`                                               |
| 4   | Pathnames traduits cohérents              | ✅ 30 routes typées                                                         |
| 5   | `<html lang={locale}>`                    | ✅ `layout.tsx:105`                                                         |
| 6   | Parité messages FR/EN                     | ✅ 38/38                                                                    |
| 7   | Sitemap multilingue + hreflang alternates | ✅                                                                          |
| 8   | robots.txt                                | ✅ Disallow `/api`, `/_next`, `/design`, `/components`, `/sections`         |
| 9   | llms.txt + llms-full.txt                  | ⚠️ basique seul                                                             |
| 10  | IndexNow ping post-build                  | ⚠️ stub                                                                     |
| 11  | Semantic HTML un seul `<h1>`              | ⚠️ **conflit avec finding A11Y-001** : 11 pages listing sans `<h1>` du tout |
| 12  | OG images 1200×630 dynamiques             | ❌                                                                          |
| 13  | Twitter `summary_large_image`             | ✅ déclaré, mais sans image                                                 |
| 14  | Blocs AEO 40-80 mots pages produit        | ✅                                                                          |
| 15  | JSON-LD validés (7 types)                 | ✅                                                                          |
| 16  | RSS feeds blog + cas + FAQ                | ❌                                                                          |
| 17  | Hreflang `x-default` correct              | ✅ pointe vers FR                                                           |

## Findings P0

**Aucun.**

## Findings P1 (2)

**SEO-001 · OG images dynamiques manquantes** :

- `@vercel/og@0.11.1` dans dependencies mais aucune route `/api/og`.
- Twitter card declared as `summary_large_image` mais sans image → preview text-only sur LinkedIn/Twitter/Facebook.
- **Action** : créer `src/app/api/og/route.tsx` avec template Manrope + Webflow Blue + accent module + titre + description.
- **Effort** : 2-4 h.

**SEO-002 · RSS feeds absents (blog + cas concrets + FAQ)** :

- Aucune route `feed.xml` / `rss.xml` détectée.
- Impact AEO : Bing Copilot, Perplexity peuvent utiliser les feeds RSS comme signal frais.
- **Action** : créer 3 endpoints `src/app/[locale]/blog/feed.xml/route.ts`, `src/app/[locale]/cas-concrets/feed.xml/route.ts`, `src/app/[locale]/faq/feed.xml/route.ts`.
- **Effort** : 4-6 h.

## Findings P2 (3)

| ID      | Titre                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEO-003 | IndexNow stub — implémenter ping réel post-build vers Bing/Yandex                                                                                        |
| SEO-004 | `llms-full.txt` non implémenté — version courte présente, full TODO                                                                                      |
| SEO-005 | Strings ternaires `isFr ? "fr" : "en"` dans `/reserver` `/contact` `/cas-concrets/[slug]` — design pattern accepté mais à industrialiser via messages/\* |

## À tester runtime Sprint 21+

1. **Google Rich Results Test** sur 30 URLs (Service, FAQPage, Article, BreadcrumbList, Review).
2. **AEO Citability Test** : 10 questions cibles sur Perplexity/ChatGPT/Claude/Google AIO/Bing Copilot.
3. **Twitter Card Validator** post-implémentation OG images.
4. **Bing Webmaster IndexNow** soumission clé après ping réel (Sprint 16).
5. **Screaming Frog hreflang audit** complet.
6. **Schema.org Validator** sur 10 pages produit.
