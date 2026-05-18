# 05 — VILLES / DÉPARTEMENTS / RÉGIONS — Inventaire complet

> Score : **42/100** — Status global : **🟠 SPRINT CORRECTIF** (gold-standard dataset structurel impeccable + 1 page éditoriale vivante sur 2 157 communes ; pas de couverture département dédié ; verticale `un-a-un` cadrée mais pas encore copy-écrite ; mécanique anti-doorway HCU saine mais l'effort éditorial reste à 0,05 % du potentiel).

Référence : `_AUDIT/PROMPT-CONTENT-GEN-DEEP-AUDIT-END-TO-END-2026.md §7` — `src/content/villes/index.ts` HEAD `9c1adaa`.

---

## 0. Vue d'ensemble Will-readable (5 lignes)

1. **2 157 communes ≥ 5 000 hab** chargées en SSG (13 régions métropole, 96 départements représentés sur 96 français y compris 2A+2B + Paris 75), héritage script `scripts/import-insee-villes.ts` — dataset structurel complet et propre.
2. **1 ville Tier-1 indexable** (Paris) avec copy gold standard ~1 500-2 500 mots × 4 verticales (audit / interventions / implementation / un-a-un) ; **0 ville Tier-2** (copy minimaliste) ; **2 156 villes Tier-3** stubs structurels sortant en `<meta robots noindex follow>` via `getIndexableVilles()`.
3. **Pages région opérationnelles** : `/[locale]/implantations/[region]/page.tsx` + `/[locale]/implantations/[region]/[ville]/page.tsx` ; pour la Corse on a `noindex: true` au niveau région (publicationPhase 2). DROM/COM exclus depuis décision Will 2026-05-08.
4. **Aucune page département dédiée** (`/implantations/[region]/[departement]/`) — la hiérarchie est ville ⇄ région uniquement. Manque le niveau intermédiaire pour ranking « audit IA Hauts-de-Seine », « formation IA Seine-et-Marne », « cabinet IA Bouches-du-Rhône » — gap pSEO confirmé.
5. **Roadmap théorique** : Tier-1 50 villes × 4 verticales × 2 locales = **400 pages gold** ; Tier-2 300 × 4 × 2 = **2 400 pages medium** ; long-tail Tier-3 ~1 800 × 4 × 2 ≈ **14 400 pages thin** sous gate noindex (anti-doorway HCU) → URLs SSG existent déjà, l'enjeu est exclusivement la production copy + reflux en Tier-1/2.

---

## 1. État Tier-1 / Tier-2 / Tier-3 (chiffres exacts)

Source : `src/content/villes/index.ts` lignes 42-44 (`COPY_BY_SLUG = { paris: PARIS_COPY }`) + lignes 90-92 (`getIndexableVilles()` filtre `!!v.copy`).

| Tier      | Définition                                                                                                                                      |     Count | % du total |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------: | ---------: |
| Tier-1    | Copy éditorial **gold** (`VilleCopy` complet : pitch + servicesContext + directAnswer + 4 verticales long-form + heroSchema + FAQ géolocalisée) |     **1** |    0,046 % |
| Tier-2    | Copy minimaliste (`pitchFr` + `pitchEn` + `directAnswerFr/En` + 1 verticale ou FAQ partielle)                                                   |     **0** |        0 % |
| Tier-3    | Stub structurel `VilleData` seul (sans `copy`) → `<meta name="robots" content="noindex,follow">`                                                | **2 156** |   99,954 % |
| **TOTAL** | Toutes communes ≥ 5 000 hab France métropolitaine                                                                                               | **2 157** |      100 % |

Reproductibilité :

```bash
# Total
node -e "const v=require('./src/content/villes/index'); console.log(v.VILLES.length, v.getIndexableVilles().length);"
# attendu : 2157, 1

# Confirmation source script
grep -c 'COPY_BY_SLUG\[' src/content/villes/index.ts  # 1 lookup
ls src/content/villes/copy/*.ts | wc -l               # 2 (paris.ts + types.ts)
```

**Insight clé** : le **mécanisme** anti-doorway HCU est gold standard (1 seule règle `!!v.copy`, 0 over-engineering), mais le **carburant éditorial** manque cruellement. À ce stade, la plateforme publie 1 page indexable sur 2 157 URLs SSG générées.

---

## 2. Top 50 villes Tier-1 cible (rang INSEE pop décroissante)

Statut actuel : **49/50 villes en stub Tier-3 noindex**. Seule Paris (rang #1) a une copy éditoriale.

Tableau de cible publication. Source : grep `population:` sur les 13 fichiers `src/content/villes/data/*.ts`, tri desc, top 50.

| Rang | Ville                | Pop INSEE | Région                     | Dépt |  audit  | interventions | implementation | un-a-un |          Articles blog (mentionedCities)          |            Cas concrets nearby             |
| ---: | -------------------- | --------: | -------------------------- | ---: | :-----: | :-----------: | :------------: | :-----: | :-----------------------------------------------: | :----------------------------------------: |
|    1 | Paris                | 2 103 778 | ile-de-france              |   75 | 🟢 GOLD |    🟢 GOLD    |    🟢 GOLD     | 🟢 GOLD | ⚠️ à vérifier (`/lib/geo.ts:getRelatedBlogPosts`) | ⚠️ à vérifier (Haversine `getNearbyCases`) |
|    2 | Marseille            |   886 040 | provence-alpes-cote-d-azur |   13 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|    3 | Lyon                 |   519 127 | auvergne-rhone-alpes       |   69 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|    4 | Toulouse             |   514 819 | occitanie                  |   31 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|    5 | Nice                 |   357 737 | provence-alpes-cote-d-azur |   06 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|    6 | Nantes               |   327 734 | pays-de-la-loire           |   44 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|    7 | Montpellier          |   310 240 | occitanie                  |   34 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|    8 | Strasbourg           |   293 771 | grand-est                  |   67 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|    9 | Bordeaux             |   267 991 | nouvelle-aquitaine         |   33 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   10 | Lille                |   238 246 | hauts-de-france            |   59 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   11 | Rennes               |   230 890 | bretagne                   |   35 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   12 | Toulon               |   179 116 | provence-alpes-cote-d-azur |   83 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   13 | Reims                |   177 674 | grand-est                  |   51 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   14 | Saint-Étienne        |   173 136 | auvergne-rhone-alpes       |   42 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   15 | Le Havre             |   166 687 | normandie                  |   76 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   16 | Villeurbanne         |   163 684 | auvergne-rhone-alpes       |   69 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   17 | Dijon                |   161 830 | bourgogne-franche-comte    |   21 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   18 | Angers               |   159 022 | pays-de-la-loire           |   49 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   19 | Grenoble             |   156 140 | auvergne-rhone-alpes       |   38 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   20 | Nîmes                |   151 839 | occitanie                  |   30 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   21 | Aix-en-Provence      |   149 695 | provence-alpes-cote-d-azur |   13 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   22 | Saint-Denis          |   149 077 | ile-de-france              |   93 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   23 | Clermont-Ferrand     |   146 351 | auvergne-rhone-alpes       |   63 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   24 | Le Mans              |   146 249 | pays-de-la-loire           |   72 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   25 | Brest                |   142 346 | bretagne                   |   29 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   26 | Tours                |   139 259 | centre-val-de-loire        |   37 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   27 | Amiens               |   136 449 | hauts-de-france            |   80 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   28 | Annecy               |   132 117 | auvergne-rhone-alpes       |   74 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   29 | Limoges              |   129 937 | nouvelle-aquitaine         |   87 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   30 | Metz                 |   122 572 | grand-est                  |   57 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   31 | Perpignan            |   121 616 | occitanie                  |   66 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   32 | Boulogne-Billancourt |   119 019 | ile-de-france              |   92 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   33 | Besançon             |   118 489 | bourgogne-franche-comte    |   25 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   34 | Rouen                |   117 662 | normandie                  |   76 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   35 | Orléans              |   116 357 | centre-val-de-loire        |   45 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   36 | Montreuil            |   111 934 | ile-de-france              |   93 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   37 | Caen                 |   109 400 | normandie                  |   14 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   38 | Argenteuil           |   106 130 | ile-de-france              |   95 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   39 | Mulhouse             |   104 978 | grand-est                  |   68 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   40 | Nancy                |   103 671 | grand-est                  |   54 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   41 | Tourcoing            |    98 772 | hauts-de-france            |   59 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   42 | Roubaix              |    98 286 | hauts-de-france            |   59 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   43 | Nanterre             |    97 783 | ile-de-france              |   92 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   44 | Vitry-sur-Seine      |    93 963 | ile-de-france              |   94 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   45 | Asnières-sur-Seine   |    93 941 | ile-de-france              |   92 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   46 | Créteil              |    93 397 | ile-de-france              |   94 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   47 | Avignon              |    92 188 | provence-alpes-cote-d-azur |   84 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   48 | Colombes             |    91 053 | ile-de-france              |   92 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   49 | Poitiers             |    89 916 | nouvelle-aquitaine         |   86 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |
|   50 | Aubervilliers        |    88 365 | ile-de-france              |   93 | ❌ stub |    ❌ stub    |    ❌ stub     | ❌ stub |                         —                         |                     —                      |

**Légende** : 🟢 GOLD = copy ≥ 1 500 mots par verticale, FAQ géolocalisée, hero schema satellite, JSON-LD LocalBusiness+Place+FAQPage. ❌ stub = aucun copy → `noindex,follow` automatique (route SSG existe mais sortie crawl).

**Note méthode** : `mentionedCities` (articles blog) et `getNearbyCases` (Haversine sur `case-studies.ts`) sont les deux signaux de **maillage croisé** documentés respectivement dans `src/lib/geo.ts` (fonctions `getRelatedBlogPosts`, `getNearbyCases`). À couvrir dans le §06-CROISEMENTS (signal présent mais non quantifié ville-par-ville sans run de script — placeholder « à vérifier » pour Paris uniquement, qui est la seule ville où ces signaux sont réellement consommés dans `[ville]/page.tsx`).

---

## 3. Couverture par département (96 codes représentés)

Source : `grep -h "departement:" src/content/villes/data/*.ts | sort | uniq -c` (script Node ci-dessus).

Lecture : « Total villes » = communes ≥ 5 000 hab dans le département (chargées dans `VILLES`). Tier-1 = avec copy. Couverture = Tier-1+Tier-2 / Total villes.

| Code dépt | Nom                     | Région                     |  Total villes | Tier-1 | Tier-2 |    Tier-3 | Couverture % |
| :-------: | ----------------------- | -------------------------- | ------------: | -----: | -----: | --------: | -----------: |
|    01     | Ain                     | auvergne-rhone-alpes       |            26 |      0 |      0 |        26 |        0,0 % |
|    02     | Aisne                   | hauts-de-france            |            10 |      0 |      0 |        10 |        0,0 % |
|    2A     | Corse-du-Sud            | corse                      |             2 |      0 |      0 |         2 |        0,0 % |
|    2B     | Haute-Corse             | corse                      |             7 |      0 |      0 |         7 |        0,0 % |
|    03     | Allier                  | auvergne-rhone-alpes       |             9 |      0 |      0 |         9 |        0,0 % |
|    04     | Alpes-de-Haute-Provence | provence-alpes-cote-d-azur |             6 |      0 |      0 |         6 |        0,0 % |
|    05     | Hautes-Alpes            | provence-alpes-cote-d-azur |             3 |      0 |      0 |         3 |        0,0 % |
|    06     | Alpes-Maritimes         | provence-alpes-cote-d-azur |            31 |      0 |      0 |        31 |        0,0 % |
|    07     | Ardèche                 | auvergne-rhone-alpes       |             8 |      0 |      0 |         8 |        0,0 % |
|    08     | Ardennes                | grand-est                  |             6 |      0 |      0 |         6 |        0,0 % |
|    09     | Ariège                  | occitanie                  |             4 |      0 |      0 |         4 |        0,0 % |
|    10     | Aube                    | grand-est                  |             8 |      0 |      0 |         8 |        0,0 % |
|    11     | Aude                    | occitanie                  |            10 |      0 |      0 |        10 |        0,0 % |
|    12     | Aveyron                 | occitanie                  |             7 |      0 |      0 |         7 |        0,0 % |
|    13     | Bouches-du-Rhône        | provence-alpes-cote-d-azur |            68 |      0 |      0 |        68 |        0,0 % |
|    14     | Calvados                | normandie                  |            25 |      0 |      0 |        25 |        0,0 % |
|    15     | Cantal                  | auvergne-rhone-alpes       |             3 |      0 |      0 |         3 |        0,0 % |
|    16     | Charente                | nouvelle-aquitaine         |             9 |      0 |      0 |         9 |        0,0 % |
|    17     | Charente-Maritime       | nouvelle-aquitaine         |            20 |      0 |      0 |        20 |        0,0 % |
|    18     | Cher                    | centre-val-de-loire        |             7 |      0 |      0 |         7 |        0,0 % |
|    19     | Corrèze                 | nouvelle-aquitaine         |             5 |      0 |      0 |         5 |        0,0 % |
|    21     | Côte-d'Or               | bourgogne-franche-comte    |            14 |      0 |      0 |        14 |        0,0 % |
|    22     | Côtes-d'Armor           | bretagne                   |            18 |      0 |      0 |        18 |        0,0 % |
|    23     | Creuse                  | nouvelle-aquitaine         |             1 |      0 |      0 |         1 |        0,0 % |
|    24     | Dordogne                | nouvelle-aquitaine         |             9 |      0 |      0 |         9 |        0,0 % |
|    25     | Doubs                   | bourgogne-franche-comte    |            13 |      0 |      0 |        13 |        0,0 % |
|    26     | Drôme                   | auvergne-rhone-alpes       |            19 |      0 |      0 |        19 |        0,0 % |
|    27     | Eure                    | normandie                  |            15 |      0 |      0 |        15 |        0,0 % |
|    28     | Eure-et-Loir            | centre-val-de-loire        |            12 |      0 |      0 |        12 |        0,0 % |
|    29     | Finistère               | bretagne                   |            37 |      0 |      0 |        37 |        0,0 % |
|    30     | Gard                    | occitanie                  |            28 |      0 |      0 |        28 |        0,0 % |
|    31     | Haute-Garonne           | occitanie                  |            49 |      0 |      0 |        49 |        0,0 % |
|    32     | Gers                    | occitanie                  |             4 |      0 |      0 |         4 |        0,0 % |
|    33     | Gironde                 | nouvelle-aquitaine         |            58 |      0 |      0 |        58 |        0,0 % |
|    34     | Hérault                 | occitanie                  |            48 |      0 |      0 |        48 |        0,0 % |
|    35     | Ille-et-Vilaine         | bretagne                   |            43 |      0 |      0 |        43 |        0,0 % |
|    36     | Indre                   | centre-val-de-loire        |             5 |      0 |      0 |         5 |        0,0 % |
|    37     | Indre-et-Loire          | centre-val-de-loire        |            19 |      0 |      0 |        19 |        0,0 % |
|    38     | Isère                   | auvergne-rhone-alpes       |            52 |      0 |      0 |        52 |        0,0 % |
|    39     | Jura                    | bourgogne-franche-comte    |             5 |      0 |      0 |         5 |        0,0 % |
|    40     | Landes                  | nouvelle-aquitaine         |            17 |      0 |      0 |        17 |        0,0 % |
|    41     | Loir-et-Cher            | centre-val-de-loire        |             6 |      0 |      0 |         6 |        0,0 % |
|    42     | Loire                   | auvergne-rhone-alpes       |            29 |      0 |      0 |        29 |        0,0 % |
|    43     | Haute-Loire             | auvergne-rhone-alpes       |             6 |      0 |      0 |         6 |        0,0 % |
|    44     | Loire-Atlantique        | pays-de-la-loire           |            65 |      0 |      0 |        65 |        0,0 % |
|    45     | Loiret                  | centre-val-de-loire        |            24 |      0 |      0 |        24 |        0,0 % |
|    46     | Lot                     | occitanie                  |             2 |      0 |      0 |         2 |        0,0 % |
|    47     | Lot-et-Garonne          | nouvelle-aquitaine         |            10 |      0 |      0 |        10 |        0,0 % |
|    48     | Lozère                  | occitanie                  |             1 |      0 |      0 |         1 |        0,0 % |
|    49     | Maine-et-Loire          | pays-de-la-loire           |            37 |      0 |      0 |        37 |        0,0 % |
|    50     | Manche                  | normandie                  |            11 |      0 |      0 |        11 |        0,0 % |
|    51     | Marne                   | grand-est                  |            11 |      0 |      0 |        11 |        0,0 % |
|    52     | Haute-Marne             | grand-est                  |             3 |      0 |      0 |         3 |        0,0 % |
|    53     | Mayenne                 | pays-de-la-loire           |             8 |      0 |      0 |         8 |        0,0 % |
|    54     | Meurthe-et-Moselle      | grand-est                  |            32 |      0 |      0 |        32 |        0,0 % |
|    55     | Meuse                   | grand-est                  |             3 |      0 |      0 |         3 |        0,0 % |
|    56     | Morbihan                | bretagne                   |            36 |      0 |      0 |        36 |        0,0 % |
|    57     | Moselle                 | grand-est                  |            38 |      0 |      0 |        38 |        0,0 % |
|    58     | Nièvre                  | bourgogne-franche-comte    |             3 |      0 |      0 |         3 |        0,0 % |
|    59     | Nord                    | hauts-de-france            |           108 |      0 |      0 |       108 |        0,0 % |
|    60     | Oise                    | hauts-de-france            |            21 |      0 |      0 |        21 |        0,0 % |
|    61     | Orne                    | normandie                  |             5 |      0 |      0 |         5 |        0,0 % |
|    62     | Pas-de-Calais           | hauts-de-france            |            74 |      0 |      0 |        74 |        0,0 % |
|    63     | Puy-de-Dôme             | auvergne-rhone-alpes       |            19 |      0 |      0 |        19 |        0,0 % |
|    64     | Pyrénées-Atlantiques    | nouvelle-aquitaine         |            25 |      0 |      0 |        25 |        0,0 % |
|    65     | Hautes-Pyrénées         | occitanie                  |             7 |      0 |      0 |         7 |        0,0 % |
|    66     | Pyrénées-Orientales     | occitanie                  |            22 |      0 |      0 |        22 |        0,0 % |
|    67     | Bas-Rhin                | grand-est                  |            35 |      0 |      0 |        35 |        0,0 % |
|    68     | Haut-Rhin               | grand-est                  |            25 |      0 |      0 |        25 |        0,0 % |
|    69     | Rhône                   | auvergne-rhone-alpes       |            58 |      0 |      0 |        58 |        0,0 % |
|    70     | Haute-Saône             | bourgogne-franche-comte    |             5 |      0 |      0 |         5 |        0,0 % |
|    71     | Saône-et-Loire          | bourgogne-franche-comte    |            17 |      0 |      0 |        17 |        0,0 % |
|    72     | Sarthe                  | pays-de-la-loire           |            11 |      0 |      0 |        11 |        0,0 % |
|    73     | Savoie                  | auvergne-rhone-alpes       |            15 |      0 |      0 |        15 |        0,0 % |
|    74     | Haute-Savoie            | auvergne-rhone-alpes       |            40 |      0 |      0 |        40 |        0,0 % |
|    75     | Paris                   | ile-de-france              |             1 |  **1** |      0 |         0 |  **100,0 %** |
|    76     | Seine-Maritime          | normandie                  |            41 |      0 |      0 |        41 |        0,0 % |
|    77     | Seine-et-Marne          | ile-de-france              |            65 |      0 |      0 |        65 |        0,0 % |
|    78     | Yvelines                | ile-de-france              |            72 |      0 |      0 |        72 |        0,0 % |
|    79     | Deux-Sèvres             | nouvelle-aquitaine         |            12 |      0 |      0 |        12 |        0,0 % |
|    80     | Somme                   | hauts-de-france            |             9 |      0 |      0 |         9 |        0,0 % |
|    81     | Tarn                    | occitanie                  |            12 |      0 |      0 |        12 |        0,0 % |
|    82     | Tarn-et-Garonne         | occitanie                  |             7 |      0 |      0 |         7 |        0,0 % |
|    83     | Var                     | provence-alpes-cote-d-azur |            50 |      0 |      0 |        50 |        0,0 % |
|    84     | Vaucluse                | provence-alpes-cote-d-azur |            27 |      0 |      0 |        27 |        0,0 % |
|    85     | Vendée                  | pays-de-la-loire           |            27 |      0 |      0 |        27 |        0,0 % |
|    86     | Vienne                  | nouvelle-aquitaine         |            14 |      0 |      0 |        14 |        0,0 % |
|    87     | Haute-Vienne            | nouvelle-aquitaine         |            11 |      0 |      0 |        11 |        0,0 % |
|    88     | Vosges                  | grand-est                  |             9 |      0 |      0 |         9 |        0,0 % |
|    89     | Yonne                   | bourgogne-franche-comte    |             6 |      0 |      0 |         6 |        0,0 % |
|    90     | Territoire de Belfort   | bourgogne-franche-comte    |             3 |      0 |      0 |         3 |        0,0 % |
|    91     | Essonne                 | ile-de-france              |            66 |      0 |      0 |        66 |        0,0 % |
|    92     | Hauts-de-Seine          | ile-de-france              |            35 |      0 |      0 |        35 |        0,0 % |
|    93     | Seine-Saint-Denis       | ile-de-france              |            39 |      0 |      0 |        39 |        0,0 % |
|    94     | Val-de-Marne            | ile-de-france              |            42 |      0 |      0 |        42 |        0,0 % |
|    95     | Val-d'Oise              | ile-de-france              |            57 |      0 |      0 |        57 |        0,0 % |
|           | **TOTAL**               |                            |     **2 157** |  **1** |      0 | **2 156** |  **0,046 %** |
|           | — DOM (971-976)         | drom                       | 0 (exclus V1) |      — |      — |         — |            — |

**Notes** :

- 96 codes département représentés (94 métropolitains + 2A + 2B Corse). Aucun département vide.
- Top 3 départements par densité communale = 59 Nord (108), 62 Pas-de-Calais (74), 78 Yvelines (72) — gros gisements pSEO à fort potentiel B2B.
- DOM-COM exclus depuis décision Will 2026-05-08 (cf. `regions.ts:285-291`). Pas de gap, c'est volontaire.

---

## 4. Couverture par région (13 métropole)

Source : agrégation script Node + `src/content/regions.ts`.

| Région                     | Total villes ≥ 5K | Tier-1 | Tier-2 |    Tier-3 | Page `/implantations/[region]` existe |      Pop INSEE |   PIB Md€ |            `noindex` régional             |
| -------------------------- | ----------------: | -----: | -----: | --------: | :-----------------------------------: | -------------: | --------: | :---------------------------------------: |
| Île-de-France              |               377 |      1 |      0 |       376 |           ✅ SSG + ISR 24 h           |     12 317 279 |       838 |               🟢 indexable                |
| Auvergne-Rhône-Alpes       |               284 |      0 |      0 |       284 |           ✅ SSG + ISR 24 h           |      8 197 000 |       274 |               🟢 indexable                |
| Hauts-de-France            |               222 |      0 |      0 |       222 |           ✅ SSG + ISR 24 h           |      5 963 000 |       167 |               🟢 indexable                |
| Occitanie                  |               201 |      0 |      0 |       201 |           ✅ SSG + ISR 24 h           |      6 049 000 |       178 |               🟢 indexable                |
| Nouvelle-Aquitaine         |               191 |      0 |      0 |       191 |           ✅ SSG + ISR 24 h           |      6 042 000 |       178 |               🟢 indexable                |
| Provence-Alpes-Côte d'Azur |               185 |      0 |      0 |       185 |           ✅ SSG + ISR 24 h           |      5 089 000 |       173 |               🟢 indexable                |
| Grand Est                  |               170 |      0 |      0 |       170 |           ✅ SSG + ISR 24 h           |      5 546 000 |       165 |               🟢 indexable                |
| Pays de la Loire           |               148 |      0 |      0 |       148 |           ✅ SSG + ISR 24 h           |      3 870 000 |       122 |               🟢 indexable                |
| Bretagne                   |               134 |      0 |      0 |       134 |           ✅ SSG + ISR 24 h           |      3 393 000 |       102 |               🟢 indexable                |
| Normandie                  |                97 |      0 |      0 |        97 |           ✅ SSG + ISR 24 h           |      3 303 000 |        95 |               🟢 indexable                |
| Centre-Val de Loire        |                73 |      0 |      0 |        73 |           ✅ SSG + ISR 24 h           |      2 566 000 |        76 |               🟢 indexable                |
| Bourgogne-Franche-Comté    |                66 |      0 |      0 |        66 |           ✅ SSG + ISR 24 h           |      2 796 000 |        81 |               🟢 indexable                |
| Corse                      |                 9 |      0 |      0 |         9 |           ✅ SSG + ISR 24 h           |        348 000 |        10 | 🟠 **noindex actif** (publicationPhase 2) |
| **TOTAL**                  |         **2 157** |  **1** |      0 | **2 156** |           **13/13 routes**            | **65 480 558** | **2 459** |          12 indexable + 1 gated           |

**Insights** :

- **12 / 13 régions indexables** (Corse gated via `noindex: true` jusqu'à phase 3 — voir `getIndexableRegions()`).
- **ItemList JSON-LD** émis par la page hub `/implantations` énumère les 12 régions indexables (signal AEO/GEO).
- **Pages région opérationnelles** : `LocalBusiness` + `Place` + `ItemList` JSON-LD (3 schemas) + BreadcrumbList auto. Densité éditoriale = pitch région 30-50 mots FR/EN + grouping villes par département (collapsible `<details>`). C'est bon mais minimal.
- Couverture pondérée par PIB : Île-de-France représente **34 %** du PIB national → effort copy P0 unique sur la région-pivot.

---

## 5. Pages département dédiées ? (gap probable)

**Verdict : ❌ INEXISTANTES.**

Vérifications :

```bash
ls "src/app/[locale]/implantations/[region]/"  # → [ville]/ + page.tsx, pas de [departement]/
```

Output :

```
[ville]/
page.tsx
```

**Constat** : pas de route `src/app/[locale]/implantations/[region]/[departement]/page.tsx` ni équivalent type `src/app/[locale]/departements/[code]/`. La hiérarchie effective est :

```
/implantations                              ← hub 12 régions + 6 top par PIB
└─ /implantations/[region]                  ← 13 pages SSG (12 indexable)
   └─ /implantations/[region]/[ville]       ← 2 157 pages SSG (1 indexable)
```

**Gap pSEO** :

- Pas de page ranking pour requêtes type :
  - `audit IA Hauts-de-Seine`
  - `formation IA Seine-et-Marne`
  - `cabinet IA Bouches-du-Rhône`
  - `intégrateur IA Loire-Atlantique`
- La data structurelle est pourtant dispo : `VilleData.departement` + `VilleData.departementLabel` + `REGIONS.departements[]` permettrait de générer 96 pages département en regroupement (ItemList AdministrativeArea + LocalBusiness areaServed) sans nouveau dataset.
- **Effort estimé** : ~1 page template + 1 helper `getVillesByDepartement(code)` + `generateStaticParams` 96 entrées + 1 entrée sitemap-pseo-departements.xml + 96 entrées hreflang FR/EN → 4-6 h dev, 0 € externe (data déjà là).
- ROI : zone B2B « département » = très utilisée par DAF/DG en prospection (organigrammes administratifs FR raisonnent département). Estimation gain ~10-15 % du trafic ville à moyen terme une fois Tier-1 villes en place.

**Page région a partiellement le rôle** : `RegionPage` (`[region]/page.tsx:248-340`) groupe les villes par dépt en `<details>` collapsible (« Département 92 — 35 communes »). Mais c'est un **section** dans la page région, pas une URL crawlable autonome — pas de title/H1/JSON-LD département, donc pas de signal SEO différencié.

---

## 6. Pages région dédiées (existant)

**Verdict : ✅ OPÉRATIONNELLES, contenu structurel correct mais éditorial minimal.**

Audit `src/app/[locale]/implantations/[region]/page.tsx` (460 lignes) :

| Critère                                                               |   Statut   | Notes                                                                                                                                                                        |
| --------------------------------------------------------------------- | :--------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero + breadcrumbs + JSON-LD Place + LocalBusiness + ItemList         |     ✅     | 3 schemas émis (cf. lignes 85-119)                                                                                                                                           |
| Liste villes par région affichée                                      |     ✅     | `getVillesByRegion(region.slug)` → grouping par département collapsible                                                                                                      |
| Mesh interne vers villes pilotes                                      |     ✅     | Section « Pages villes » filtre `villes.filter(v => !!v.copy)` (V1 = 0 ou 1 par région : Paris en IDF seul)                                                                  |
| Mesh vers Tier-3 (stubs)                                              |     ✅     | Liens crawlés mais cible noindex (la link equity reflue vers /implantations + /audit)                                                                                        |
| Top 12 villes par population                                          |     ✅     | `topVilles` slice 12 — bon signal AEO « principales villes de [région] »                                                                                                     |
| JSON-LD `AdministrativeArea`                                          | ⚠️ Partiel | `buildPlaceJsonLd` émet `Place` + `containedInPlace: France`. Pas explicite `AdministrativeArea` schema.org subtype                                                          |
| Maillage canonique vers `/audit`, `/interventions`, `/implementation` |     ✅     | Section dédiée (lignes 341-420)                                                                                                                                              |
| Verticale `un-a-un` linkée depuis page région                         |     ❌     | Absente du bloc « Nos 3 services » alors que la 4e verticale est livrée sur `[ville]/page.tsx`                                                                               |
| `revalidate = 86400` (ISR 24 h)                                       |     ✅     | Ligne 36, cohérent doctrine pSEO                                                                                                                                             |
| Hreflang FR↔EN                                                        |     ✅     | `alternates: { fr: ..., en: ... }`                                                                                                                                           |
| Contenu différencié anti-doorway HCU                                  |     🟠     | Pitch région 30-50 mots + grouping villes — c'est correct mais loin de la copie ville Paris (~10K mots). Risque pénalité si Google audite la région comme « page de liens ». |
| Compteur communes éligibles affiché                                   |     ✅     | « 377 communes éligibles en Île-de-France » (ligne 239)                                                                                                                      |

**Gap n°1** : la verticale `un-a-un` n'est référencée nulle part dans la grille « Nos 3 services » de la page région (toujours « 3 services », pas 4). Désynchro avec le hub principal qui parle de 4 verticales depuis Sprint S+2 (commit `4d9efbf` 2026-05-18). À synchroniser.

**Gap n°2** : la page région **utilise déjà** `revalidate = 86400` (ISR 24 h) → toute publication d'un nouveau `VilleCopy` est visible sous 24 h sans rebuild complet, c'est gold standard.

---

## 7. Mécanisme liens indirects ville ⇄ département ⇄ région

Audit traversal interne :

| Lien                                   | Mécanisme                                                                                                                                | Statut |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| `Ville → Region`                       | `VilleData.region` (FK slug, ex `"ile-de-france"`) + `getRegion()` lookup O(1)                                                           |   ✅   |
| `Region → Villes`                      | `getVillesByRegion(slug)` filtre `O(n)` sur `VILLES` (acceptable < 3 K)                                                                  |   ✅   |
| `Ville → Dépt`                         | `VilleData.departement` (code num/2A/2B) + `VilleData.departementLabel` (humain)                                                         |   ✅   |
| `Region → Dépts`                       | `Region.departements: ReadonlyArray<string>` (liste codes incluse dans bloc région)                                                      |   ✅   |
| `Dépt → Villes`                        | ❌ **Pas de helper `getVillesByDepartement(code)`**                                                                                      |   ❌   |
| `Dépt → Region`                        | ❌ **Pas de helper `getRegionByDepartement(code)`** (mais déductible par `REGIONS.find(r => r.departements.includes(code))`)             |   ❌   |
| Breadcrumb ville                       | `[Implantations] > [Region.nameFr] > [Ville.nameFr]` — 3 segments                                                                        |   ✅   |
| Breadcrumb région                      | `[Implantations] > [Region.nameFr]` — 2 segments                                                                                         |   ✅   |
| Breadcrumb département                 | ❌ Inexistant (pages dépt absentes)                                                                                                      |   ❌   |
| Sitemap `pseo-villes`                  | Émis par `src/app/sitemap.ts` (référencé) — chaque ville Tier-1 + Tier-3 (Tier-3 inclus mais avec noindex meta → Google skip indexation) |   ✅   |
| Sitemap `pseo-regions`                 | Émis (12 régions indexable + 1 Corse `noindex` exclue)                                                                                   |   ✅   |
| Sitemap `pseo-departements`            | ❌ N'existe pas (puisque pages dépt absentes)                                                                                            |   ❌   |
| `getNearbyVilles(slug, n)` (Haversine) | ✅ Implémenté dans `src/lib/geo.ts` — utilisé par `[ville]/page.tsx` pour bloc « villes proches »                                        |   ✅   |
| `getRelatedBlogPosts(citySlug)`        | ✅ Implémenté — utilisé sur page Paris                                                                                                   |   ✅   |
| `getNearbyCases(citySlug, n)`          | ✅ Implémenté — utilisé sur page Paris                                                                                                   |   ✅   |

**Bilan** : 3 axes de maillage ville↔ville↔region OK. Manque uniquement l'axe **département** — cohérent avec l'absence de page dédiée.

---

## 8. Roadmap couverture chiffrée

### 8.1 Cibles publication

| Phase                          |                              Villes |                                        Verticales |            Locales |                            Pages indexable cible | Hypothèse copy/page                                                                      | Effort copy estimé                                                                                                                    |
| ------------------------------ | ----------------------------------: | ------------------------------------------------: | -----------------: | -----------------------------------------------: | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier-1 gold**                |                                  50 | 4 (audit, interventions, implementation, un-a-un) | 2 (FR + EN miroir) |                       **400 pages** (50 × 4 × 2) | 1 500-2 500 mots, FAQ géolocalisée, hero schema, JSON-LD complet                         | ~4-6 h/page-locale humain ou ~30-45 min/page LLM + relecture humaine = **400-600 h humain pur** OU **~80-120 h LLM + 50 h relecture** |
| **Tier-2 medium**              |            250 (top 51-300 par pop) |                                                 4 |                  2 |                    **2 000 pages** (250 × 4 × 2) | 600-1 000 mots, FAQ 3-4 Q, pas de hero schema obligatoire                                | ~1-2 h/page-locale humain OU ~10-15 min/page LLM + relecture spot = **250-500 h humain** OU **40-80 h LLM + 30 h relecture**          |
| **Tier-3 long-tail**           |                   ~1 857 (le reste) |                                                 4 |                  2 | ~14 856 routes SSG **noindex,follow** (gate HCU) | Pas de copy — stub Paris-template (pitch région + data INSEE 1-2 phrases)                | Déjà fait (auto par `[ville]/page.tsx` fallback) → 0 h. Si décision de générer copy auto LLM = **~30-50 h LLM**                       |
| **Pages département** (gap §5) |                                  96 |                                                 — |        2 (FR + EN) |                                    **192 pages** | 400-600 mots intro département + grouping villes + LocalBusiness areaServed dept         | ~30 min/page LLM = **~50 h LLM + 10 h relecture** + **4-6 h dev page template**                                                       |
| **Pages région enrichies**     | 12 indexables + 1 Corse (à phase 3) |                                                 — |                  2 |   **24-26 pages** existantes mais enrichissables | Pitch région étendu 400-800 mots, top secteurs NAF locaux, top 3 cas concrets, FAQ 4-6 Q | ~2-3 h/région-locale humain = **~50-75 h humain**                                                                                     |

### 8.2 Cumul plateforme cible

- **État actuel (HEAD `9c1adaa`)** : 1 page ville indexable + 12 pages région indexable = **13 pages indexable** sur **2 170 routes SSG** (= 0,6 %).
- **Cible Tier-1 + dépts + régions enrichies** : 400 + 192 + 26 = **618 pages indexable haute qualité**.
- **Cible Tier-1+2 + dépts + régions** : 400 + 2 000 + 192 + 26 = **2 618 pages indexable**.
- **Cible exhaustive (avec Tier-3 generées LLM)** : ~15 000-17 000 pages indexable (mais risque HCU 2024 majeur, recommandé seulement si gating qualité strict).

### 8.3 Phasage proposé (6 mois)

| Phase  | Mois  | Livrable                                                                                                    | Effort estimé                      |
| ------ | :---: | ----------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **P1** |  M+1  | Top 5 villes Tier-1 (Marseille, Lyon, Toulouse, Bordeaux, Lille) × 4 verticales × 2 locales = 40 pages gold | ~80 h LLM + ~30 h relecture humain |
| **P2** |  M+1  | 96 pages département dédiées (template + copy auto)                                                         | ~60-80 h dev + LLM + relecture     |
| **P3** | M+2-3 | Top 50 villes Tier-1 complet = 400 pages gold                                                               | ~250-350 h LLM + relecture         |
| **P4** | M+3-4 | 12 régions enrichies (pitch étendu + secteurs NAF + cas + FAQ)                                              | ~60-80 h                           |
| **P5** | M+5-6 | Top 300 villes Tier-2 medium = 2 400 pages                                                                  | ~250-500 h LLM + relecture spot    |

### 8.4 Budget brut estimé (hors infra)

- Si humain pur copywriter SEO senior FR-EN bilingue (~600 €/jour) : **~120 K€** pour P1+P2+P3 (Tier-1 50 villes + dépts).
- Si LLM Claude Sonnet 4.6 ou GPT-5 pipelined (~0,02 €/page-locale au cap 2000 tokens output) + 1 relecteur senior 600 €/jour : **~25-35 K€** total P1+P2+P3 (~50 j relecture humain + ~250 € API).
- **ROI estimé** : ranking #1-#3 sur 50 villes × 4 verticales = ~200 mots-clés head, vol mensuel ~3 000-15 000 recherches/mot selon ville → trafic SEO target ~50 K-150 K visites/mois après 6-9 mois (vs ~2 K actuel sur Paris seul).

---

## 9. STOP & ASK Will (effort + ROI)

### 9.1 Décisions stratégiques à trancher

|   #    | Décision                                                                       | Options                                                                                                                                                             | Effort                                 | Impact ROI                                                                                        |
| :----: | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **D1** | **Investir copy humain Top 50 Tier-1 (400 pages) ?**                           | A. Tout humain ~120 K€ / B. LLM + relecture ~30 K€ / C. Hybride premium humain Top 10 + LLM Top 11-50 ~50 K€                                                        | 3-6 mois                               | Décisif. Sans Top 50 Tier-1, la plateforme reste à 1 page indexable sur 2 157.                    |
| **D2** | **Créer pages département dédiées V2 ?**                                       | A. Oui — 192 pages (96 × 2 locales) ~60 h dev+content / B. Non — rester sur grouping `<details>` page région                                                        | ~60-80 h                               | +10-15 % trafic potentiel (requêtes B2B départementales). ROI modéré mais peu cher.               |
| **D3** | **Activer la verticale `un-a-un` dans la grille « 3 services » page région ?** | A. Oui — propagation immédiate / B. Reporter après stabilisation Sprint S+2                                                                                         | ~30 min/région × 13 = 6 h dev          | Cohérence brand (la 4e verticale est silencieuse sur les hubs régionaux). Quick win.              |
| **D4** | **Activer Corse (`noindex: true` → `false`) ?**                                | A. Maintenir noindex (phase 2) / B. Activer (mais sans copy → 9 pages stub indexable) / C. Activer **après** avoir produit copy Ajaccio + Bastia                    | ~30 min config OU 8-12 h copy 2 villes | Marché petit (348 K hab, 10 Md€ PIB) — ROI faible mais signal complétude France métropolitaine.   |
| **D5** | **Choix outil de génération copy LLM**                                         | A. Skill maison `axionia-content-generator` (déjà packagé) / B. Claude API direct via worker BullMQ / C. Pipeline hybride humain → LLM → relecture                  | Variable                               | D1 dépend de cette décision. Si A : leverage immediate du skill `axionia-content-generator v1.7`. |
| **D6** | **Politique long-tail Tier-3 (~1 800 villes)**                                 | A. Maintenir stub noindex (statu quo) / B. Générer copy auto LLM bas-coût + audit doorway HCU avant indexation / C. Supprimer du SSG (économiser ~5 min build time) | —                                      | A = safe HCU. B = risque pénalité Google. C = perte option future. **Recommandé : A**.            |

### 9.2 Quick wins immédiats (< 1 jour dev)

1. **Helper `getVillesByDepartement(code)`** dans `src/content/villes/index.ts` (3-4 lignes) — prérequis page dépt mais aussi utile pour stats admin.
2. **Helper `getRegionByDepartement(code)`** dans `src/content/regions.ts` (3-4 lignes) — résout breadcrumb dépt + sécurise consistance région↔dépt.
3. **Sync verticale `un-a-un` dans `[region]/page.tsx`** grille « Nos services » (1 entrée à ajouter, ~30 min).
4. **Ajout `AdministrativeArea` explicite** dans `buildPlaceJsonLd` côté région (au lieu du `Place` générique) — meilleur signal Knowledge Graph.
5. **Compteur Tier-1/Tier-2/Tier-3 affiché dans admin `/admin/pseo-stats`** (Sprint 20) pour Will-tracking copy production progress.

### 9.3 Anti-patterns à éviter

- ❌ **NE PAS** générer copy LLM auto sur Tier-3 sans gate doorway HCU. Google a explicitement pénalisé en 2024 les sites avec « pages locales générées identiques mass-produites ».
- ❌ **NE PAS** retirer le filtre `getIndexableVilles()` sans plan B HCU — c'est le bouclier anti-doorway de la plateforme.
- ❌ **NE PAS** publier de copy minimaliste Tier-2 sans inclure au moins `pitchFr/En` + `directAnswerFr/En` + 1 verticale long-form + FAQ 3-4 Q — sinon perte différenciation cross-villes.

---

## 10. Annexes

### 10.1 Commandes reproductibles

```bash
# Total villes
node -e "console.log(require('./src/content/villes/index').VILLES.length)"

# Villes indexable
node -e "console.log(require('./src/content/villes/index').getIndexableVilles().length)"

# Villes par région
grep -c "population:" src/content/villes/data/*.ts

# Villes par département (Node)
node -e "const fs=require('fs');const dir='src/content/villes/data';const files=fs.readdirSync(dir).filter(f=>f.endsWith('.ts')&&f!=='types.ts');const tot={};for(const f of files){const c=fs.readFileSync(dir+'/'+f,'utf8');const m=c.match(/departement:\\s*\"([^\"]+)\"/g)||[];for(const x of m){const k=x.match(/\"([^\"]+)\"/)[1];tot[k]=(tot[k]||0)+1;}}console.log(JSON.stringify(tot,null,2));"

# Routes SSG implantations
ls "src/app/[locale]/implantations/" -R

# Helpers villes exportés
grep -E "^export (function|const)" src/content/villes/index.ts

# Régions noindex
grep -A 1 "noindex: true" src/content/regions.ts
```

### 10.2 Fichiers audit-référencés

- `src/content/villes/index.ts` (93 lignes) — barrel + helpers
- `src/content/villes/data/types.ts` (28 lignes) — schéma `VilleData`
- `src/content/villes/copy/types.ts` (183 lignes) — schéma `VilleCopy` + 4 verticales
- `src/content/villes/copy/paris.ts` (gold standard ~10K mots cumulés)
- `src/content/villes/data/*.ts` (13 fichiers, 26 003 lignes total — auto-générés)
- `src/content/regions.ts` (316 lignes) — 13 régions métropole
- `src/app/[locale]/implantations/page.tsx` (288 lignes) — hub
- `src/app/[locale]/implantations/[region]/page.tsx` (460 lignes) — page région
- `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (>500 lignes) — page ville
- `src/components/sections/VilleServicePageTemplate.tsx` — template ville × service
- `src/lib/geo.ts` — Haversine + nearby villes/cases/blog
- `src/server/actions/content-gen/city-coverage.ts` — rollup coverage
- `src/lib/service-coverage.ts` — helpers couverture
- ADR 0006 — pSEO villes (architecture data/copy + anti-doorway HCU)

### 10.3 Métriques score

| Critère (poids)                     |   Score    | Détail                                                                                          |
| ----------------------------------- | :--------: | ----------------------------------------------------------------------------------------------- |
| Dataset structurel complet (15)     | **15/15**  | 2 157 villes ≥ 5 K, 96 dépts, 13 régions, INSEE clean                                           |
| Mécanisme anti-doorway HCU (10)     | **10/10**  | `getIndexableVilles()` + filtre `!!v.copy` impeccable                                           |
| Pages région opérationnelles (10)   |  **8/10**  | LocalBusiness+Place+ItemList JSON-LD ; manque AdministrativeArea + verticale un-a-un            |
| Pages ville Tier-1 (25)             |  **2/25**  | 1/50 livrée (Paris seul)                                                                        |
| Pages département dédiées (10)      |  **0/10**  | Absentes                                                                                        |
| Couverture verticales 4×Tier-1 (10) |  **1/10**  | 4 verticales OK sur Paris ; verticale un-a-un absente page région                               |
| Helpers traversal complets (5)      |  **3/5**   | Manque `getVillesByDepartement`, `getRegionByDepartement`                                       |
| Hreflang FR/EN (5)                  |  **5/5**   | Cohérent partout                                                                                |
| ISR + sitemaps (5)                  |  **4/5**   | Sitemap villes/régions OK, sitemap dépts absent                                                 |
| Roadmap publication structurée (5)  |  **0/5**   | Aucun phasage documenté actuellement                                                            |
| **TOTAL**                           | **48/100** | Ajustement final terrain : **42/100** (poids amplifié sur volet copy = colonne vertébrale pSEO) |

---

**Verdict opérationnel** : la plateforme a une **plomberie pSEO villes/régions/dépts de qualité industrielle** (dataset + mécanisme anti-doorway + JSON-LD + ISR) **mais 0,05 % du volume éditorial cible**. C'est l'inverse exact du syndrome typique « beaucoup de pages thin » : ici on a une infrastructure surdimensionnée pour 1 seul contenu. Prochaine étape critique = **D1 + D2 + D3** dans la section STOP & ASK ci-dessus.
