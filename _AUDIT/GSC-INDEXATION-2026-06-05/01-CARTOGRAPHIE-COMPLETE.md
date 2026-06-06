# 01 — CARTOGRAPHIE COMPLÈTE end-to-end (2026-06-05)

> Cartographie « 100 % plateforme » : pour chaque type de page → nb d'URLs, source sitemap, indexabilité voulue vs observée GSC, signaux (robots / canonical / hreflang / status / JSON-LD), verdict.
> Légende statut GSC : **JC** = jamais crawlée (`Détectée non indexée`, last-crawl 1970-01-01) · **NI** = noindex by-design · **IDX** = (partiellement) indexée · **RDR** = redirigée.

---

## A. Séries temporelles reconstruites (Phase 0)

### Coverage (`Coverage/Graphique.csv`)

| Date | Non indexées | Index | Impr. | Événement corrélé |
|---|---:|---:|---:|---|
| 05-15 | 456 | 20 | 5 | Premier crawl burst (accueil + clés) |
| 05-16 | 336 | 33 | 4 | ADR 0026 build externalisé + EN désactivé |
| 05-17 | 336 | 33 | 11 | **Pic enrichissements** (BC 6, FAQ 5, HTTPS 7) |
| 05-18 | 336 | 33 | 9 | HTTPS pic 9 ; drip villes / sitemap complet en cours d'expo |
| **05-19** | **2953** | **38** | 9 | 🔴 **BASCULE — sitemap villes/images (~2157 URLs) découvert** |
| 05-22 | 2953 | 38 | 4 | Index plafonne ; enrichissements s'effondrent (BC 1, FAQ 1) |
| 05-23 | 2892 | 42 | 4 | drip déployé (28/05) commence à poser des noindex |
| 05-26 | 2901 | 47 | 4 | BC 0, FAQ 0, HTTPS 0 |
| 05-29 | 2901 | 47 | 10 | État stable bas |

### Enrichissements (preuve « symptôme, pas cause »)

| Date | Breadcrumbs valides | FAQ valides | HTTPS connues |
|---|---:|---:|---:|
| 05-13 | 5 | 6 | 5 |
| 05-17/18 | **6 (pic)** | 5 | **9 (pic)** |
| 05-21 | 2 | 2 | 6 |
| 05-25 | 0 | 0 | 0 |
| 05-29→06-03 | 1 | 0 | 1 |

→ Les 3 courbes **pic 05-17/18** (burst initial) puis **collapse 05-20→25**, exactement quand l'index plafonne. **Aucune n'est un problème indépendant** : elles suivent mécaniquement l'(dé)indexation des pages parentes.

### Ventilation des 2 901 non-indexées (`Coverage/Problèmes critiques.csv`)

| Raison | Pages | Catégorie |
|---|---:|---|
| **Détectée, actuellement non indexée** | **2 558** | 🔴 cause racine (crawl-budget) |
| Exclue par `noindex` | 252 | mixte by-design + phantoms |
| Bloquée robots.txt | 40 | EN + woff2 + /api/og stale |
| Page avec redirection | 38 | by-design (301) |
| Autre page canonique correcte | 4 | by-design (querystrings self-canonical) |
| Erreur serveur 5xx | 3 | 1 réel live (`/opengraph-image`) + 2 résolus |
| Interdiction 403 | 3 | EN/www (CF challenge, stale) |
| Double sans canonique | 3 | marginal |

---

## B. Cartographie par type de page

> Sources sitemap : `app/sitemap.ts` (convention `generateSitemaps()`) + `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS, lignes 42-54). Filtres EN via `filterEnIfDisabled` (`sitemap.ts:362-375`) ; drip via `isVilleIndexable` (`content/villes/index.ts:255`).

| Type de page | Nb URLs (FR) | Sous-sitemap | Indexabilité **voulue** | Statut GSC **observé** | robots/canonical/hreflang | JSON-LD | Verdict |
|---|---:|---|---|---|---|---|---|
| **Accueil `/fr`** | 1 | `pages` | index | IDX | self-canonical, hreflang fr+x-default (pas en ✅) | Organization/WebSite | ✅ OK |
| **Pages statiques stratégiques** (`/fr/contact`, `/fr/tarifs`, `/fr/blog`, `/fr/audit-ia`, `/fr/methodologie`, `/fr/ressources`, `/fr/solutions-ia`, `/fr/formations-ia`, `/fr/a-propos`, `/fr/roi`, `/fr/guide-ia`…) | ~50 | `pages` (`sitemap.ts:385`) | index | **JC** (live 200 ✅) | self-canonical OK | WebPage | 🔴 **Saines mais jamais crawlées = famine crawl** |
| **Hubs services** (`/fr/audit`, `/fr/interventions/*`, `/fr/implementation`, `/fr/un-a-un`, `/fr/sites-web-augmentes`) | ~120 | `implementation`, pages | index | partiel JC | self-canonical | Service/FAQ | 🟠 crawl partiel |
| **Implantations — hubs régions** | 13 (+5 DROM noindex) | `implantations` (`sitemap.ts:406`, `getIndexableRegions`) | index (12 régions) | partiel | self-canonical | Place/Breadcrumb | ✅ filtre `noindex:false` |
| **Implantations — villes** | ~1 055 indexables / 2 157 (drip j+8) | `villes-<region>` (`sitemap.ts:427`) + `services-villes-*` | index si cohorte drip ∧ unique | **JC massif (786/999 échantillon)** | meta robots index/noindex selon `isVilleIndexable` | WebPage/Service/Place/Breadcrumb/ItemList/ImageObject | 🔴 cœur de la dette ; thin/templaté |
| **Villes hors cohorte / non-unique** | ~1 102 | hors sitemap | **noindex** (drip + gate doorway `UNIQUE_VILLE_SLUGS`) | NI (252 vus, reste JC) | meta noindex | — | ✅ by-design anti-doorway |
| **Galerie — hub + images** | 1 + ~150 | `sitemaps/images-fr.xml` (CUSTOM) | index | **JC (58 vus)** + 0 image indexée | index, max-image-preview:large ; **fuite hreflang en** 🟠 | ImageObject (hub + détail) | 🔴 jamais crawlée (budget) ; **leak EN** |
| **Blog** (posts tier-1 + taxos) | ~400 (2 locales, EN filtré) | `blog` (`sitemap.ts:387`, `getIndexableBlogPosts`) | index tier-1 only | JC (7 vus) | self-canonical, lastmod réel ✅ | Article/Breadcrumb | 🟠 sain, non crawlé |
| **FAQ** | ~200 | `faq` (`sitemap.ts:390`) | index (cat ≥3 Q) | JC (13 vus), 0 valide GSC | QAPage/FAQPage | FAQPage | 🟠 sain ; rich result FAQ déprécié (07/05) → proxy d'index only |
| **Glossaire** | ~122 | `glossaire` (`sitemap.ts:400`) | index | JC (22 vus) + 7 noindex | self-canonical | DefinedTerm | 🟠 sain, non crawlé |
| **Cas-concrets** | ~100 | `cas-concrets` | index | JC (6 vus) | self-canonical | Article | 🟠 sain |
| **Comparaisons** | ~50 | `comparaisons` | index | JC (1 vu) | self-canonical | — | 🟠 sain |
| **Centre-aide** | ~150 | `help` | index | JC (7 vus) | self-canonical | HowTo | 🟠 sain |
| **Stack-IA** | ~22 | `stack-ia-tools` | index | JC (3 vus) | self-canonical | SoftwareApplication | 🟠 sain |
| **Presse** | ~5-10 | `presse` (lastmod réel) | index | JC (1 vu) | self-canonical | NewsArticle | ✅ lastmod honnête |
| **Knowledge / ressources** | 0 au build (stub) → ISR | `knowledge-*` (`knowledge-sitemap.ts`, early-exit stub) | index | JC + 1 noindex stub | self-canonical | Article | 🟠 vide au build, repeuplé ISR 1h |
| **Pages privées** (`/fr/mes-donnees`, `/fr/reserver`, `/fr/recherche`) | ~5 | **hors sitemap** | **noindex** | NI | meta noindex (+robots Disallow reserver/mes-donnees) | — | ✅ by-design |
| **Légal** (mentions, CGV, confidentialité, accessibilité…) | ~8 | `pages` | index | JC | self-canonical | — | ✅ sain |
| **`/en/*`** (toutes) | 0 dans `<loc>` | **filtré** (`filterEnIfDisabled`) ; **MAIS** hreflang en émis par `images-fr.xml` 🟠 | **jamais index** (Invariant #1) | 40 robots + 38 RDR + 3 403 | 301→FR (proxy) **+** Disallow /en/ (robots) = ⚠️ contradiction | — | 🟠 mécanisme à unifier (301 seul) |
| **Phantoms legacy** (`/fr/ia-<ville>` ~67, `/audit/*`, `-1`/`-2`) | ~70 | hors sitemap | n/a | NI/404 | — | — | 🟡 résidus pré-refactor, bénins |
| **OG images** (`/opengraph-image`, `/api/og`) | 2 routes | n/a (Allow /api/og) | servies | `/api/og` 200 ✅ ; **`/opengraph-image` 502 live** 🔴 | Allow robots OK | — | 🔴 og-image cassé |

---

## C. Confrontation des volumes (Phase 1)

- **« ~17 629 routes SSG »** = nombre théorique de pages **pré-rendables** (toutes villes × verticales × locales), cité dans `AGENTS.md` / `robots.ts:129`. Ce n'est **pas** le nb d'URLs **émises au sitemap**.
- **URLs réellement émises au sitemap (2026-06-05, FR, EN filtré)** ≈ **~3 500–6 800** selon l'état DB runtime :
  - Statiques + éditorial (pages/blog/faq/help/cas/comparaisons/guides/glossaire/presse/implementation/implantations/stack) : **~600-700**
  - Villes texte (`villes-<region>` + `services-villes-*`) : **~2 000-3 000** (cohorte drip j+8 ≈ 1055 villes × services)
  - Images : `images-fr.xml` ~150 + `sitemap-images-services` ~73 + villes T1/T2/T3-T4 ~1 000 = **~1 200**
  - News : ≤ 500 (fenêtre 48h)
  - Knowledge : 0 au build, repeuplé ISR
- **GSC connaît ~2 948 URLs** (47 + 2901). L'écart avec le sitemap émis s'explique : (a) Google n'a **pas encore découvert/retenu** tout le sitemap ; (b) GSC inclut des **variantes hors-sitemap** (www., http, /en, legacy, querystrings) découvertes via liens/historique ; (c) le sitemap inclut des URLs que Google n'a pas encore inscrites.

→ **Conclusion Phase 1** : le sitemap émis (~3,5-6,8 k) reste **très au-dessus** de ce qu'un domaine de 24 jours sans backlink peut faire indexer (~47). C'est l'inadéquation **taille sitemap ↔ autorité/âge** qui est la cause racine, indépendamment du chiffre exact.

---

## D. Maillage interne & profondeur de clic (Phase 3 — extrait)

| Page stratégique | Header desktop | Header mobile | Footer | Accueil body | Profondeur | Crawlée ? |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `/fr/tarifs` | ✅ (nav) | ✅ | ✅ | ✅ | **1** | ❌ JC |
| `/fr/audit` | ✅ | ✅ | ✅ | ✅ | 1 | partiel |
| `/fr/contact` | ✅ (CTA ≥1400px) | ✅ | ✅ | ✅ | 1-2 | ❌ JC |
| `/fr/blog` | ❌ | ✅ | ✅ | ✅ | 1-2 | ❌ JC |
| `/fr/methodologie` | ❌ | ❌ | ✅ | ❌ | 2 | ❌ JC |
| `/fr/galerie` | ❌ | ❌ | ✅ (Footer.tsx:41) | ❌ | 2 | ❌ JC |
| `/fr/glossaire` `/comparaisons` `/presse` | ❌ | partiel | ✅ | ❌ | 2 | ❌ JC |

> **Fait marquant** : `/fr/tarifs` est à **1 clic** (header) et reste **non crawlée**. ⇒ Le maillage n'est pas le goulot principal ; **le crawl-budget l'est**. Le maillage devient décisif **après** réduction du sitemap (pour orienter le crawl restant). `/galerie` et les hubs footer-only sont **doublement pénalisés** (budget + profondeur 2).

---

## E. Rendu / SSG-ISR (Phase 5)

- Pages éditoriales et villes : **SSG/ISR**, HTML complet au 1er byte (live `text/html`, 200). Pas de client-only bloquant. ✅
- Pages **DB-dependent au build sous `stub.invalid`** (galerie, `knowledge-*`, `/ressources`) : rendues **vides au build**, repeuplées par **ISR ≤1h** (`images-fr.xml` revalidate 3600 ; galerie `revalidate=60`/`3600`). En prod le `DATABASE_URL` réel est injecté → contenu présent. **Risque résiduel** : si une page DB-dependent est crawlée par Google **dans la fenêtre froide** post-deploy avant 1er ISR, elle peut être vue vide une fois. Faible (ISR on-demand au 1er hit), mais à surveiller pour la galerie (cf. `02-ANOMALIES` #9).
- `generateStaticParams` villes limité (pop≥100k) → le reste en ISR on-demand (TTFB ~300ms mesuré 05-28, sous budget LCP). ✅
