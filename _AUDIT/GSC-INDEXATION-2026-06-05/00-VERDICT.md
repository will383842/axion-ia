# 00 — VERDICT — Audit d'indexation Google end-to-end (axion-ia.com, 2026-06-05)

> Audit forensique **code (`axionia/src/`) + données GSC réelles (exports 2026-06-05) + re-vérification live (curl 2026-06-05 06:2x UTC)**.
> Aucune modification de code. Aucun push. Aucun run LLM facturable.
> Méthode : 8 phases (ingestion preuves → inventaire URLs → cohérence signaux → crawl budget → ramp-up → flux → images → rendu → live).
> Source de vérité = `axionia/src/` (worktrees `.claude/worktrees/*` et copies `axionia-*` ignorés).

---

## TL;DR (90 secondes)

1. **La thèse de cadrage est CONFIRMÉE à ~90 %.** Il y a **un problème racine unique** — **famine de crawl-budget sur un domaine neuf (24 j) sans autorité, noyé sous un sitemap de ~6 000–17 000 URLs majoritairement templatées** — qui **produit** les symptômes secondaires (FAQ / Breadcrumbs / HTTPS / images en chute = simple conséquence de la dé-indexation des pages parentes). **Plus une poignée de bugs techniques discrets.**

2. **Preuve temporelle de la cause racine** (`Coverage/Graphique.csv`) : le **2026-05-19**, « Non indexées » saute de **336 → 2 953 (+2 617)** = le jour où le **sitemap complet villes/images (~2 157 URLs)** a été découvert par Google. À partir de ce jour, « Dans l'index » **plafonne** (38 → 47) et **les 3 enrichissements s'effondrent en chœur** : Breadcrumbs valides 6→0/1, FAQ valides 6→0, HTTPS connues 9→0/1, tous **pic le 2026-05-17/18 puis collapse dès le 2026-05-20/21**. Un seul phénomène, trois symptômes.

3. **Confirmation indépendante (échantillon validation 999 URLs « Détectée non indexée », `Coverage-Validation/Tableau.csv`)** : **100 % jamais crawlées** (last-crawl `1970-01-01`). Répartition : **786 `/fr/implantations` (villes), 58 `/fr/galerie` (images), 22 glossaire, 22 audit, 20 interventions, 19 implementation, 14 un-a-un, 13 faq, 7 blog…** — et surtout des **pages stratégiques racine jamais crawlées** : `/fr/contact`, `/fr/blog`, `/fr/tarifs`, `/fr/audit-ia`, `/fr/methodologie`, `/fr/ressources`, `/fr/solutions-ia`, `/fr/formations-ia`.

4. **Re-vérification live (2026-06-05) : ces pages stratégiques sont TOUTES en `200 OK` et saines** (`/fr/contact`, `/fr/tarifs`, `/fr/blog`, `/fr/galerie` → 200). Le problème **n'est pas** un bug de rendu ni de robots : **c'est que Google ne les crawle pas**, faute de budget, parce que le sitemap dilue le crawl sur des milliers de pages villes thin. **Même des pages à 1 clic de l'accueil (`/fr/tarifs` est dans le header) restent non crawlées** → preuve que le levier dominant est **réduire la taille du sitemap**, pas (seulement) le maillage.

5. **Le débit de publication (100+/jour annoncé) écrase le débit de crawl (~1–2 pages indexées/jour observé).** Ratio ≈ **100:1**. Tant que `publié/jour > crawlé/jour`, la dette « Détectée non indexée » **croît sans borne** et le flux entrant **cannibalise** le crawl du noyau premium. C'est déjà ce qui se passe.

6. **Bugs techniques discrets confirmés (peu d'URLs, mais réels)** :
   - 🔴 **`/opengraph-image` = 502 Bad Gateway LIVE (confirmé 2026-06-05)** — pas transitoire, pas stale : casse l'OG image par défaut de l'accueil (previews sociales / Discover). Le fix « inline brand » est **dans le code mais ne suffit pas en prod** (le route `/api/og` edge, lui, répond 200 → l'edge runtime marche ; le bug est spécifique à `opengraph-image.tsx`).
   - 🟠 **Signaux EN contradictoires (viole l'Invariant #1)** : `/en/*` est **à la fois** 301→FR (`proxy.ts:36`) **et** `Disallow: /en/` (`robots.ts:95`, confirmé live). Le `Disallow` **empêche Google de voir le 301** → les EN restent en index « bloqué robots » au lieu d'être proprement remplacés par FR.
   - 🟠 **Fuite `hreflang="en"` dans `sitemaps/images-fr.xml`** (`route.ts:122-124, 138-141`) : ce Route Handler custom **ne passe pas** par `filterEnIfDisabled` et émet des alternates `/en/gallery/*` → c'est par là que Google a découvert les `/en/gallery*` (visibles dans le drilldown robots).
   - 🟡 Phantoms legacy (noindex/404) : `/fr/ia-<ville>` (~67), `/audit/*` (astérisque littéral), suffixes `-1`/`-2` — résidus pré-refactor 2026-05-26, sans source dans le code actuel. Bénins.
   - ✅ Les 2 autres 5xx GSC (`/fr/audit/demande?objet=…`, `/implementation/documents`) **résolus** : live 200 (transitoires).

7. **Ce qui a déjà été corrigé depuis l'audit 2026-05-28** (vérifié dans le code) : le **drip est déployé** (`villes/index.ts:207` `INDEXATION_START=2026-05-28`, `VILLES_PER_DAY=50`) et **les sitemaps images villes T1/T2/T3-T4 filtrent désormais `isVilleIndexable`** (P0-1 + P0-2 de l'audit précédent **appliqués**). Le sitemap est **propre côté EN (`<loc>`)** et **sans querystrings**. → L'amélioration timide (2953→2901 non-indexées, 38→47 indexées) est cohérente avec « drip posé mais autorité encore nulle + flux qui re-remplit la dette ».

---

## Réfutation / confirmation de la thèse de départ

| Élément de la thèse | Verdict | Preuve |
|---|---|---|
| Problème racine = crawl-budget + thin + sitemap surdimensionné | ✅ **CONFIRMÉ** | Saut 336→2953 le 05-19 corrélé au sitemap villes ; 100 % de l'échantillon jamais crawlé ; pages saines en 200 |
| FAQ/Breadcrumbs/HTTPS/images = symptômes, pas causes | ✅ **CONFIRMÉ** | Les 3 courbes pic 05-17/18 puis collapse 05-20+, synchrones avec le plafonnement de l'index |
| Images 0 indexées car pages galerie non crawlées | ✅ **CONFIRMÉ** | 58 `/fr/galerie` jamais crawlées ; pages en sitemap (`images-fr.xml`) + 200 live, mais budget = 0 |
| « Quelques bugs techniques discrets » en parallèle | ✅ **CONFIRMÉ + AGGRAVÉ** | `/opengraph-image` 502 **persistant live** (pas transitoire comme supposé au 05-28) |
| Querystrings dans le sitemap | ❌ **RÉFUTÉ** | Aucun `?` émis par les exporters ; les URLs `?objet=`/`?ville=` sont découvertes via formulaires/liens, self-canonical (by-design) |
| EN « à la fois sitemap + robots + 403 + 301 » | 🟡 **PARTIEL** | EN **hors des `<loc>`** des sitemaps ✅, mais **fuite hreflang en** (images-fr.xml) + **robots Disallow + 301 simultanés** = contradiction réelle à résoudre |

**Nuance clé vs audit 2026-05-28** : le 28/05 concluait « l'indexation MONTE, pas de dé-indexation ». Les données 06-05 montrent que **l'index a plafonné (47) et les enrichissements se sont effondrés à ~0** : la dé-indexation des pages porteuses d'enrichissements **a bien eu lieu**, conséquence directe de la dilution du crawl. La cause racine identifiée le 28/05 (sur-exposition) était juste ; sa **gravité** était sous-estimée et le **flux permanent 100+/jour** n'était pas modélisé.

---

## Top 5 actions à impact maximal (détail dans `03-PLAN-P0-P1-P2.md` + `03b-STRATEGIE-RAMP-UP.md`)

1. **P0 — Réduire radicalement le sitemap exposé** : passer d'un sitemap « tout » (~6 k–17 k URLs) à un **sitemap de cohortes piloté par l'indexation réelle**. Concrètement : **geler l'élargissement du drip** (le débloquer sur seuil d'indexation, pas sur calendrier) et ne laisser dans le sitemap que le **Tier 0 (~120 URLs premium)** + ce qui est déjà indexé. **Impact : c'est LE levier qui débloque le crawl du noyau.**
2. **P0 — Fixer `/opengraph-image` (502 live)** : aligner `opengraph-image.tsx` sur l'implémentation qui marche (`api/og/route.tsx`) ou passer en `runtime="nodejs"`. **Impact : restaure previews sociales/Discover de l'accueil.**
3. **P0 — Cohérence EN = 301 unique** : retirer `Disallow: /en/` (`robots.ts:95`) **et** la fuite `hreflang="en"` de `sitemaps/images-fr.xml` ; ne garder QUE le 301 1-hop. Togglable `EN_LOCALE_ENABLED`. **Impact : Google voit le 301, purge proprement les EN, consolide vers FR (Invariant #1 respecté).**
4. **P1 — Forcer le crawl du Tier 0** : maillage accueil/header/footer ≤2 clics + `lastmod` honnêtes + **IndexNow** + **GSC URL Inspection « Demander l'indexation »** (~10-20/jour) sur les ~120 URLs Tier 0. **Impact : convertit le crawl rare en indexation ciblée.**
5. **P1 — Gate qualité automatique en entrée de sitemap (régime permanent)** : une page n'entre dans le sitemap (`index`) que si elle passe un seuil objectif (contenu unique, faible duplication, maillage entrant) **ET** que le débit de crawl soutenable le permet. Remplace le drip calendaire. **Impact : empêche le flux 100+/jour de re-noyer Google.**

---

## Projection d'indexation (hypothèses explicites)

| Horizon | Sans rien faire | Avec P0 (sitemap cohorte + EN + og-image) | + P1 (maillage + IndexNow + URL Inspection) | + backlinks PR (5-10 liens) |
|---|---:|---:|---:|---:|
| **État 2026-06-05** | 47 | 47 | 47 | 47 |
| **4 semaines** | 50-70 | 90-140 | **120-200** | 150-250 |
| **8 semaines** | 60-90 | 150-280 | **250-450** | 400-700 |
| **3-6 mois** | stagne | 400-800 | 700-1200 | **1500-2500** (≈ villes uniques + cœur) |

> Le débit de crawl observé (~1-2 pages indexées/jour) est le facteur limitant n°1. Il **augmente** avec l'autorité (backlinks) et la **fraîcheur de qualité** ; il **n'augmente pas** en poussant plus d'URLs. D'où : **montrer moins pour indexer plus vite**, puis élargir au rythme prouvé.

---

## Garde-fous respectés

- ✅ Audit pur lecture — **aucun fichier modifié**, **aucun push**, **aucun run LLM**.
- ✅ Invariant EN : aucune reco n'expose/canonicalise/« répare » l'indexation EN ; toute neutralisation reste **togglable `EN_LOCALE_ENABLED`** ; **rien n'est supprimé définitivement** (routing/messages/pré-rendu EN intacts).
- ✅ Contrats build : `stub.invalid`, `SKIP_ENV_VALIDATION`, `BULLMQ_DISABLED` non touchés ; toutes les actions P0/P1 sont sitemap/robots/redirect/edge-only → **0 impact Web Vitals** (à valider par `pnpm lhci`).
- ✅ Chiffres sourcés : ligne CSV GSC OU `fichier:ligne` OU commande curl live datée.

→ Détail : [`01-CARTOGRAPHIE-COMPLETE.md`](./01-CARTOGRAPHIE-COMPLETE.md) · [`02-ANOMALIES.md`](./02-ANOMALIES.md) · [`03-PLAN-P0-P1-P2.md`](./03-PLAN-P0-P1-P2.md) · [`03b-STRATEGIE-RAMP-UP.md`](./03b-STRATEGIE-RAMP-UP.md) · [`04-CHECKS-LIVE.md`](./04-CHECKS-LIVE.md)
