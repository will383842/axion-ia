# Plan — Navigation & Visibilité Blog/Contenus à l'échelle (100+ articles/jour)

**Date** : 2026-06-21 · **Branche** : `feat/console-ameliorations` · **Objectif** : outil + navigation + visibilité maximale (dont **visibilité par ville**), scalable à des dizaines de milliers de contenus.

---

## 0. Le problème central (à garder en tête)

À **100+ articles/jour** (~36 500/an), le facteur limitant **n'est pas la production** — c'est le **budget de crawl Google**. État actuel mesuré (audits GSC) :

- **47 pages indexées / ~2 901 « détectées non indexées »** · **2 558 jamais crawlées** · crawl observé **1–2 pages/jour**.
- Ratio publication:crawl visé = **100:1** → sans discipline, 3 000 articles/mois entrent au sitemap mais **~30–60 seulement** sont crawlés → le reste = invisibilité + signal « ferme de contenu » (pénalité HCU).

**Donc la règle d'or : l'indexation se MÉRITE. On ne pousse au sitemap que le contenu prouvé.** Tout le plan en découle.

---

## 1. Doctrine (5 principes non négociables)

1. **Indexation méritée (pyramide de tiers).** Un article naît `tier_2_noindex_follow` (crawlable, transmet le jus, **pas indexé**). Il passe `tier_1_indexable` (→ sitemap + ping) seulement s'il **prouve sa valeur** (score très élevé à la publication **OU** CTR ≥ 3 % via le lifecycle). → le sitemap reste concentré sur le contenu qui performe = budget de crawl focalisé.
2. **Hub-and-spoke / clusters thématiques.** Maillage fort hub → articles → hub. C'est le signal SEO n°1 et ce qui fait remonter un cluster entier.
3. **Ville = ancrage + maillage, JAMAIS un arbre de pages combinatoire.** Multiplier `blog × ville × type` = bombe doorway (la cause exacte de la crise actuelle). La visibilité ville se gagne par l'**enrichissement des pages villes existantes** + des **hubs-ville mérités**.
4. **Découverte active.** IndexNow + GSC API sur chaque promotion tier-1 ; ne pas attendre le crawl passif.
5. **Qualité gated + déterministe.** Les gates existants (soft-404, plagiat, dedup topic, doctrine, benefit) restent la barrière d'entrée ; indexabilité jamais recalculée depuis un compteur qui peut être vide (fail-open au build stub).

---

## 2. Ce qui est DÉJÀ construit (socle solide — ~80 %)

| Brique | État | Fichier clé |
|---|---|---|
| Système de tiers (1/2/3) + robots meta + filtre sitemap | ✅ | `schema.prisma` (enum), `blog/[slug]/page.tsx:100`, `blog/loader.ts` |
| Lifecycle CTR (promote >3 %@14j/100imp · demote <1 %@30j) | ✅ (noop tant que trafic faible) | `lifecycle/tier-decisions.ts`, `content-tier-lifecycle-worker.ts` |
| Gates qualité (plagiat, intent, dedup outline+topic, doctrine, benefit, soft-404) | ✅ | `content-gen-worker.ts:780`, `quality/*` |
| Drip 8h–22h CET + cap journalier ramped 30→500 | ✅ | `content-publish-worker.ts:79` |
| Sitemap blog DB-aware, **tier-1 only**, cap 5000 | ✅ | `sitemap.ts:584` (`buildBlogSitemap`) |
| Pages **catégorie** DB-driven (5 types d'activité) | ✅ | `blog/categorie/[slug]/page.tsx`, `category-loader.ts` |
| Hubs secteur/service/taille (tier-1 only en JSON-LD) | ⚠️ FS-only | `blog/secteur|service|taille/[slug]/page.tsx` |
| Article détail DB-first + related (tier-1) | ✅ | `blog/[slug]/page.tsx`, `related-articles.ts` |
| City Domination (2150 villes, gate unicité ≥0.6, ~1816 indexables) | ✅ | `content/villes/index.ts`, `implantations/[region]/[ville]` |
| Infra indexing (IndexNow / Google Indexing enqueue) | ✅ infra, ⚠️ activation | `indexing/enqueue.ts` |

---

## 3. Les GAPS à corriger (ce qui manque/casse)

| # | Gap | Gravité | Impact |
|---|---|---|---|
| G1 | **`/fr/blog` index = statique FS** (`BLOG_POSTS`), ignore les articles DB | 🔴 | Les contenus générés **invisibles** dans le hub principal |
| G2 | **Hubs secteur/service/taille = FS-only** | 🟠 | Les articles générés n'y remontent pas |
| G3 | **Ville ↔ blog totalement découplés** (pas de maillage, pas de hub-ville) | 🔴 | **Zéro visibilité ville** au sens navigation (ta demande) |
| G4 | **Soft-404 = HTTP 200** sur URL inexistante | 🔴 P0 | Tue le budget de crawl ; bloque tout scaling |
| G5 | **Tout publié = tier-1 + `promotedAt`** (décision 2026-06-17) | 🔴 | À 100/j → **famine de crawl** + risque HCU. Contredit la doctrine §1 |
| G6 | Sitemap blog **cap 5000 fixe**, pas de pagination | 🟠 | Casse au-delà de 5000 tier-1 |
| G7 | Bug `/fr/fr/blog/feed.xml` (double locale) | 🟡 | Lien RSS cassé |
| G8 | IndexNow/GSC API **non activés** | 🟠 | Découverte passive uniquement |

---

## 4. Architecture cible (navigation)

```
NIVEAU 0 — HUB MAÎTRE
  /fr/blog        [DB-driven] À la une (meilleurs tier-1) + récents + navigation par
                  thème + ENTRÉE VILLES (carte/liste des villes actives)

NIVEAU 1 — HUBS THÉMATIQUES (clusters, DB-driven, tier-1 en sitemap/JSON-LD)
  Type d'activité  /fr/blog/categorie/{formations-ia|audits|coaching-1-to-1|implementations|sites-web}
  Secteur          /fr/blog/secteur/{slug}            (16)
  Service          /fr/blog/service/{slug}            (3)
  Taille           /fr/blog/taille/{slug}             (4)

NIVEAU 1bis — DIMENSION VILLE  ← cœur de la visibilité locale
  (a) Page ville EXISTANTE     /implantations/{region}/{ville}
        → bloc « Derniers contenus IA à {Ville} » (maillage ville↔articles)
  (b) Hub-ville-blog MÉRITÉ    /fr/blog/ville/{ville}
        → créé UNIQUEMENT si la ville a ≥ N (=5) articles tier-1 distincts
        → listé au sitemap seulement à ce moment (anti-doorway)

NIVEAU 2 — ARTICLES (spokes)
  /fr/blog/{slug}  robots selon tier · maille vers : hub catégorie + secteur +
                   ville ancrée + 3-4 articles liés
```

**Pourquoi c'est maximal en visibilité ET sûr :** maillage interne dense (le levier SEO n°1), réutilisation des taxonomies existantes (zéro page jetable), et la ville gagne en visibilité par enrichissement + clusters mérités — pas par une explosion de pages thin.

---

## 5. Stratégie « visibilité maximale par ville » (détail)

Trois couches, du moins au plus fort, **toutes anti-doorway** :

1. **Niveau article (déjà acquis).** Le slug porte déjà ville+sujet (`cours-ia-grenoble-entreprise`) → SEO local direct « formation IA Grenoble ». L'orchestrateur ancre via `anchorVilleSlug`. ✅ rien à faire.
2. **Niveau page-ville (à construire — G3).** Chaque `/implantations/{ville}` affiche un bloc **« Contenus IA à {Ville} »** listant les articles tier-1 ancrés sur cette ville (requête `anchorVilleSlug = ville, tier_1`). Lien bidirectionnel article ↔ ville. → la page ville gagne en fraîcheur + profondeur (meilleur ranking local), l'article gagne un lien interne depuis un hub pertinent.
3. **Niveau hub-ville-blog (mérité).** Quand une ville accumule **≥ 5 articles tier-1 distincts**, on ouvre `/fr/blog/ville/{ville}` (cluster réel) et on l'ajoute au sitemap. En-dessous du seuil : pas de page (évite 2000 hubs-ville thin). Le seuil est **dérivé d'un compteur DB déterministe**, fail-open au build stub.

> Garde-fou : on **NE crée PAS** `/blog/{ville}/{type}` ni `/audit/par-ville/{ville}` en masse — c'est exactement ce qui a généré les ~5000 pages orphelines déjà retirées du sitemap.

---

## 6. Le pivot critique : repasser en « indexation méritée » (G5)

C'est **LA décision** qui conditionne tout le scaling. Aujourd'hui `content-publish-worker` force `tier_1 + promotedAt` sur **tout** → à 100/j, le sitemap explose et le crawl meurt.

**Cible :**
- Publier en **`tier_2_noindex_follow` par défaut** (l'article est en ligne, crawlable, maillé, transmet le jus — mais hors sitemap/hors index).
- **Promotion auto tier-1** si `qualityScore ≥ 80` (contenu premium prouvé d'emblée) — seuil configurable `factoryAutoPromoteTier1MinScore`.
- Sinon, **promotion gagnée** par le lifecycle CTR (>3 % @14j) déjà codé.
- Effet : seuls les ~20–30 % d'articles premium/performants entrent au sitemap → **crawl budget concentré**, indexation effective, zéro signal « ferme ».

> C'est un **arbitrage produit** : visibilité immédiate de tout (risqué, famine) **vs** visibilité durable du contenu qui mérite (recommandé). Décision Will requise.

---

## 7. Découverte active + hygiène crawl (G4, G8)

- **G4 / P0 — Soft-404 → vrai 404.** Tant que `/fr/url-bidon` renvoie 200, chaque URL morte gaspille un slot de crawl. À régler AVANT de scaler (bug next-intl v4.11/Next 16.2 ; route 404 dédiée hors middleware ou correctif `notFound()`).
- **G8 — IndexNow** ping à chaque promotion tier-1 (Bing/Yandex/Seznam/…), quota 10k/j. **GSC Indexing API** pour tier-1 prioritaires.
- **Sitemap discipliné** : index → sous-sitemaps tier-1 paginés (G6 : `blog-1.xml`, `blog-2.xml`, 1000–5000/ chunk), `lastmod` réel (déjà fait), pas de tier-2/3.

---

## 8. Feuille de route phasée (sur `feat/console-ameliorations`)

> Ordre = risque croissant ; chaque phase déployable seule, Web Vitals préservés (budget LCP≤1800/INP≤100/CLS=0/JS≤75KB ; `lhci` + `size-limit` gate).

**PHASE 0 — Quick wins faible risque (jour 1)**
- G7 : fix `/fr/fr/blog/feed.xml` (href locale-relatif).
- G4 : corriger le soft-404 → vrai 404 (P0 crawl). *(à valider en prod : `/fr/xxx` → 404)*

**PHASE 1 — Hub maître + hubs thématiques DB-driven (G1, G2)**
- `/fr/blog` : injecter la liste DB (tier-1, paginée 20/p, ISR 3600) sous le showcase éditorial ; lier les **vraies catégories**.
- secteur/service/taille : passer en hybride DB+FS (comme catégorie).
- Sitemap : vérifier inclusion + pagination (G6).

**PHASE 2 — Maillage ville (G3, cœur visibilité locale)**
- Bloc « Contenus IA à {Ville} » sur `/implantations/{ville}` (requête `anchorVilleSlug, tier_1`).
- Lien article → page ville ancrée.
- Hub-ville-blog mérité `/fr/blog/ville/{ville}` (seuil ≥5 tier-1), `dynamicParams=false` sur slugs éligibles, sitemap conditionnel.

**PHASE 3 — Indexation méritée (G5, décision Will)**
- `content-publish-worker` : défaut `tier_2`, auto-promote `tier_1` si score ≥ 80 ; retirer le `promotedAt` systématique.
- Activer le lifecycle CTR (déjà codé) une fois le trafic GSC branché.

**PHASE 4 — Découverte active (G8)**
- Activer IndexNow on-promote ; câbler GSC Indexing API ; monitoring couverture.

---

## 9. KPIs / garde-fous

- **Taux d'indexation** = indexées / tier-1 sitemap (cible > 70 % à 60 j). *Pas* indexées/publiées.
- **Ratio crawl** : pages crawlées/jour vs nouvelles tier-1/jour (cible ≥ 1:1 grâce IndexNow + sitemap discipliné).
- **0 doorway** : aucune page ville×type générée en masse ; hubs-ville uniquement mérités.
- **Web Vitals** : `lhci` vert sur les 15 pages stratégiques à chaque PR.
- **Déterminisme** : indexabilité jamais dérivée d'un compteur vide (fail-open stub.invalid).

---

## 10. Décisions requises de Will avant codage

1. **Indexation méritée (§6)** : OK pour défaut tier-2 + auto-promote score ≥ 80 ? (recommandé pour scaler sans pénalité) — ou garder « tout tier-1 » (risqué) ?
2. **Seuil hub-ville** : ≥ 5 articles tier-1 distincts par ville pour ouvrir `/fr/blog/ville/{ville}` ? (ajustable)
3. **Périmètre Phase 1** : showcase éditorial conservé en haut + liste DB dessous (recommandé) ou 100 % DB ?
4. **Priorité** : on attaque dans l'ordre P0→P4, ou tu veux remonter une phase ?
