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

## 6. Indexation : DÉCISION WILL = tout reste en tier-1

**Décision arrêtée (2026-06-21) : on garde `tier_1_indexable` systématique au publish** (`content-publish-worker.ts:398,436` — pas de changement). Tout contenu publié est donc indexé immédiatement.

**Conséquence : le filtre d'indexation se déplace EN AMONT (avant publication).** Comme on n'utilise plus le tier-2 pour temporiser l'index, la protection du budget de crawl repose ENTIÈREMENT sur 4 leviers — qui deviennent donc **non négociables** :

1. **Gates qualité stricts = le vrai filtre.** Ce qui est publié EST indexé → le seuil de publication EST le seuil d'index. Garder soft-404 (≥350 mots), dedup topic/outline, plagiat, doctrine actifs. ⚠️ Le seuil auto-publish a été baissé à 65 — à surveiller : à tier-1-for-all, publier = indexer, donc 65 doit rester un plancher crédible (sinon HCU).
2. **IndexNow + GSC API = compensation crawl (devient P1, pas P4).** Sans throttle par tier, on DOIT pousser activement chaque publication à Bing/Yandex/Google (quota 10k/j). C'est ce qui remplace la temporisation.
3. **Sitemap discipliné + paginé** (cf. §7, cap 5000 actuel = bloquant).
4. **Maillage interne dense** (hubs → nouveaux articles ≤ 2 clics) = amorce le crawl.

**Nuance santé d'index (à arbitrer) :** aujourd'hui `promotedAt` est posé au publish → il **bloque la démotion auto**. À l'échelle (dizaines de milliers), les articles à CTR<1 % restent indexés à vie → gonflement + risque HCU long terme. **Recommandation :** laisser le lifecycle **démoter les sous-performants chroniques** (CTR<1 % @30j/100imp → tier-2 noindex, page reste en ligne) tout en gardant la **naissance en tier-1** voulue par Will. = « tout indexé d'emblée, mais on élague ce qui ne performe jamais ». Réversible, sain, ne contredit pas la décision.

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

**PHASE 2 — Maillage ville (G3, cœur visibilité locale) — déjà 60 % câblé**
- ✅ EXISTE : `getBlogArticlesByVille(villeSlug, limit)` (`get-articles-by-ville.ts`, filtre `tier_1 + mentionedCities`), données `anchorVilleSlug`+`mentionedCities[]` persistées au publish.
- ⚠️ À FAIRE : câbler le helper dans `/implantations/{ville}` (la page a des **placeholders `articlesCount:0`** non branchés) → bloc « Contenus IA à {Ville} ».
- À FAIRE : lien article → page ville ancrée (maillage retour).
- À FAIRE : hub-ville-blog mérité `/fr/blog/ville/{ville}` (seuil ≥5 tier-1 distincts, compteur DB déterministe fail-open), `dynamicParams=false` sur slugs éligibles, sitemap conditionnel.

**PHASE 3 — Sitemap scalable + découverte active (remplace l'ancien pivot tier)**
- 🔴 **Paginer le sitemap blog** : remplacer le `take: 5000` dur (`sitemap.ts:613`) par des chunks tier-1 (`blog-1.xml`, `blog-2.xml`, 5000/chunk) déclarés dans `sitemap-index.xml`. Bloquant au-delà de 5000 articles (~50 j).
- **Activer IndexNow on-publish** (clé déjà prévue) + câbler **GSC Indexing API** pour tier-1 + monitoring couverture (`gsc-hcu-monitor` existe).

**PHASE 4 — Santé d'index à l'échelle (option recommandée §6)**
- Laisser le lifecycle **démoter les sous-performants chroniques** (CTR<1 %@30j) sans toucher la naissance tier-1 → évite le gonflement d'index sur le long terme. *(Décision Will : activer ou non.)*

---

## 9. KPIs / garde-fous

- **Taux d'indexation** = indexées / tier-1 sitemap (cible > 70 % à 60 j). *Pas* indexées/publiées.
- **Ratio crawl** : pages crawlées/jour vs nouvelles tier-1/jour (cible ≥ 1:1 grâce IndexNow + sitemap discipliné).
- **0 doorway** : aucune page ville×type générée en masse ; hubs-ville uniquement mérités.
- **Web Vitals** : `lhci` vert sur les 15 pages stratégiques à chaque PR.
- **Déterminisme** : indexabilité jamais dérivée d'un compteur vide (fail-open stub.invalid).

---

## 10. Décisions requises de Will avant codage

1. ~~Indexation méritée~~ → **TRANCHÉ : on garde tout tier-1** (§6). Reste à confirmer l'**option santé d'index** (§6/P4) : laisser démoter les sous-performants chroniques (CTR<1 %@30j) ? *(recommandé pour la santé long terme, n'enlève pas la naissance tier-1)*.
2. **Seuil hub-ville** : ≥ 5 articles tier-1 distincts par ville pour ouvrir `/fr/blog/ville/{ville}` ? (ajustable)
3. **Périmètre index `/fr/blog`** : showcase éditorial en haut + liste DB dessous (recommandé) ou 100 % DB ?
4. **Priorité/ordre** : P0→P4 dans l'ordre, ou remonter une phase ?

---

## 11. Vérification de bout en bout (raccordement complet)

Chaîne opérationnelle tracée et vérifiée dans le code (✅ = fonctionnel, ⚠️ = à brancher, 🔴 = bloquant scale) :

| # | Maillon | État vérifié | Action plan |
|---|---|---|---|
| 1 | Orchestrateur : diversité de types + drip + cap/tick | ✅ `content-orchestrator-worker` + `type-sequence.ts` | — |
| 2 | Génération + gates (soft-404/plagiat/dedup/doctrine/citations) | ✅ (citations corrigées ce jour) | maintenir seuils |
| 3 | Score ≥ seuil → publish | ✅ seuil 65 (DB config) | P0 : revérifier 65 crédible (tier-1=index) |
| 4 | Publish → Article tier-1 + `anchorVilleSlug` + `mentionedCities[]` + `promotedAt` | ✅ `content-publish-worker:398,436,744` | P4 : option démote sous-perf |
| 5 | Découverte active IndexNow/GSC on-publish | ⚠️ infra présente, activation à confirmer | **P3** |
| 6 | Sitemap blog (tier-1 only) | ⚠️ OK mais **cap dur 5000** `sitemap.ts:613` | 🔴 **P3 pagination** |
| 7 | Hub maître `/fr/blog` | 🔴 **statique FS**, ignore la DB | **P1 DB-driven** |
| 8 | Hubs type d'activité `/categorie/*` | ✅ DB-driven | P1 : lier depuis le hub |
| 9 | Hubs secteur/service/taille | ⚠️ FS-only | **P1 hybride DB** |
| 10 | Dimension ville — helper `getBlogArticlesByVille` (tier-1) | ✅ existe | — |
| 11 | Page ville `/implantations/{ville}` affiche les articles | ⚠️ **placeholders `articlesCount:0`** non câblés | **P2 câbler** |
| 12 | Hub-ville `/fr/blog/ville/{ville}` (mérité) | ❌ n'existe pas | **P2 créer** |
| 13 | Article `/blog/{slug}` robots/tier + related tier-1 | ✅ `blog/[slug]/page.tsx`, `related-articles.ts` | P2 : ajouter lien ville |
| 14 | Soft-404 (URL morte → vrai 404) | 🔴 renvoie 200 (bug next-intl) | **P0** |
| 15 | EN désactivé (301→FR) | ✅ `proxy.ts` gère `/en/*` | les nouveaux hubs héritent du 301, **rien à coder EN** |
| 16 | Build stub (`stub.invalid`) → fail-open | ✅ pattern en place | respecter sur nouveaux compteurs (hub-ville) |
| 17 | Web Vitals (LCP/INP/CLS/JS) sur pages modifiées | gate `lhci`+`size-limit` | requêtes DB en ISR + pagination, valider à chaque PR |

**Verdict :** le pipeline production→publication→ville est **déjà raccordé jusqu'à l'Article (maillons 1-4, 10, 13)**. Les trous sont uniquement côté **surfaçage/navigation** (7, 9, 11, 12), **scale crawl** (5, 6, 14) — tous adressés par P0→P3. Aucune dépendance manquante, aucune donnée à reconstruire (ville déjà persistée). Le plan est **complet et exécutable en l'état**.
