# Vérification finale — chantier knowledge / RAG / villes (2026-11-11)

Audit en **lecture seule** sur `origin/main` à `0139fc1f` (fusion #1933), plus les trois
branches villes en cours de fusion : #1921 `feat/v3-villes-lot-3` (`05583e01`),
#1922 `feat/v3-villes-lot-1` (`bae29a74`), #1923 `feat/v3-villes-lot-2` (`aa037f49`).
Les trois partent de `0139fc1f` et touchent des fichiers `villes/copy/*.ts` **disjoints**
(415 + 487 + 493 fichiers, intersection vide) : leur effet cumulé a été simulé en
superposant les trois versions sur la copie de `main` (« cumul » ci-dessous).

Aucune ligne de code n'a été modifiée. Seul ce rapport est ajouté.

| §   | Sujet                    | Verdict        |
| --- | ------------------------ | -------------- |
| 1   | Prix                     | **A CORRIGER** |
| 2   | Fausse présence (villes) | **RESERVE**    |
| 3   | Grenoble                 | **A CORRIGER** |
| 4   | Interrupteurs            | **OK**         |
| 5   | Redirections cas concrets| **OK**         |
| 6   | Pack RAG                 | **OK**         |
| 7   | Tests gardes             | **OK**         |
| 8   | Bundle                   | **RESERVE**    |

## 1. Prix — `src/app/[locale]/**` et `src/content/**`

Commande (hors `__tests__`, `.spec.`, `.test.`) :

```bash
grep -rnoP '\d[\d\s  ]*€|EUR\b|\{\{price:' 'src/app/[locale]' src/content
# → 9 420 occurrences
```

| Classe | Occurrences | Détail |
| --- | ---: | --- |
| Console admin (hors périmètre) | 132 | `(admin)/**` |
| Interrupteur éteint : jetons `{{price:}}` de `villes/copy/*.ts` | 8 827 | 1 966 fichiers ; résolus au chargement (`villes/index.ts:163`, `resolve-with-copy.ts:137`) par `resolvePriceTokens` qui masque par défaut → « sur devis ». Aucun jeton `journee-ia` dans les copies villes |
| Interrupteur éteint : autres | ≈ 20 | `PRIX_PUBLICS_AFFICHES = false` (`src/content/pricing.ts:501`), seul `journee-ia` dans `IDS_PRIX_TOUJOURS_AFFICHES` ; AggregateOffer ville (`[ville]/page.tsx:955`), `estimatedCost` HowTo (`seo.ts:2068`), `implantations/page.tsx:137`, `implantations/[region]/page.tsx:114`, `transversal.ts:439` |
| Journée IA 1 490 € HT | — | `journee-ia/**`, `offre.ts`, `offers-catalog.ts`, jetons `{{price:journee-ia\|flat}}` (`transversal.ts:1508,1644,1902,1991`) |
| Gabarit non rendu | ≈ 112 | `content/keywords/*` (87, lus seulement par `server/content-gen/keyword-selector.ts`), `knowledge/sector-entries/*` (20, tests seulement), `formations/modules/*` (back-office Qualiopi), commission `pricing.ts:1004-1005`, `booking-catalog.ts` (`priceFr` lu nulle part) |
| Statistique / donnée tierce, pas un prix d'offre | ≈ 104 | revenus médians INSEE dans `villes/copy` (46), `comparaisons.ts` (41), `glossary-extension.ts` (10), `stack-ia-details.ts`, `case-studies.ts`, `automatisations.ts:333,394` |
| Mention légale / CGV (brouillon #1861) | 5 | `legal.ts:203,207,611,615` (seuil 5 000 € HT, indemnité légale 40 €), `formations/conditions-tarifaires.ts:35` |
| Commentaires et faux positifs | ≈ 220 | « EUR » dans FORMATEUR, EUR-Lex… ; `priceCurrency:"EUR"` à prix 0 |
| **A CORRIGER / à arbitrer** | voir ci-dessous | |

**A CORRIGER :**

- `src/app/[locale]/faq/par-thematique/[categorie]/page.tsx:104-108` — les réponses passent
  à `FaqBlock` **sans** `resolvePriceTokensDeep` (contrairement à `faq/page.tsx:95`), et
  `listFaqsByCategory` (`src/lib/knowledge/readers.ts`) ne résout pas non plus. Effet : jetons
  bruts `{{price:intervention-dirigeants|flat}}` affichés en clair (réponses de
  `transversal.ts:1834,4514,4585,4704,4775,4824,4872`), et `{{price:journee-ia|flat}}` au lieu
  de « 1 490 € HT » (`transversal.ts:1644,1902,1991`). Pas de montant divulgué, mais texte cassé.
- `src/app/[locale]/tarifs/page.tsx:296` (FR) et `:326` (EN) — « Pour les formats > 5 000 € HT… » :
  ordre de grandeur de prix d'Axion-IA, exempté par le spec comme « seuil de qualification ».
  À arbitrer par Williams.
- `src/app/[locale]/demande-devis/page.tsx:30,37,54,55` — même « > 5 000 € HT » ; page exclue du spec.

**À confirmer (pas d'office)** : commission apporteur « 500 € » visible car
`COMMISSIONS_PUBLIQUES_AFFICHEES = true` (`src/content/recrutement/commission-publique.ts:24`,
décision de Williams du 11/11) — commission, pas prix d'offre ; flyer PDF décrit dans
`src/content/imprimes.ts:44-58` (« 650 € 0 € ») : non vérifié s'il est servi.

**Spec `src/app/__tests__/prix-pages-publiques.spec.ts`** (7 tests, verts) : balaie
`app/[locale]/**`, `components/**` et 19 fichiers de contenu, règles R1 (pas de formateur
brut), R2 (pas de prix interpolé), R3 (pas de montant ≥ 10 € en dur, avec exemptions),
R4 (pas de promesse de « tarifs publics »). **Non couverts** : `villes/copy/*.ts` (couvert
par `prix-publics-masques.spec.ts`), `/demande-devis`, `/apporteur-affaires/**`,
`/devenir-commercial-ia`, `/memo-isere`, `legal.ts` (CGV, mentions légales),
`glossaire` / `comparaisons` / `stack-ia` (exemptés en bloc), et surtout les **jetons non
résolus** de `/faq/par-thematique/[categorie]` (le spec cherche des « € », pas des `{{price:`).

Brouillons exclus : #1860 (devis, acompte 30 %, admin + PDF Qualiopi) et #1861 (CGV,
garantie Journée IA : `legal.ts`, `conditions-tarifaires.ts`…).

Verdict : **A CORRIGER** (jetons bruts sur `/faq/par-thematique/*`) ; aucun autre montant
d'offre que la Journée IA n'est affiché, sous réserve de l'arbitrage « > 5 000 € HT ».

## 2. Fausse présence — `src/content/villes/copy/*.ts` (2 160 fichiers)

Motif imposé :
`(se déplac|déplacements?|interventions?|consultants?|équipe|experts?|Williams|[Nn]ous|accès|couverture|missions?)[^."?]{0,80}depuis [A-ZÉ]`

```bash
P='…motif ci-dessus…'
git grep -cP "$P" <ref> -- 'src/content/villes/copy/*.ts'   # lignes
git grep -lP "$P" <ref> -- 'src/content/villes/copy/*.ts'   # fichiers
git grep -cP 'basé à|basée à|basés à' <ref> -- …            # « basé à »
git grep -ci 'from Paris' <ref> -- …                        # « from Paris »
```

| Référence             | « …depuis X » lignes | fichiers | « basé à » | « from Paris » |
| --------------------- | -------------------: | -------: | ---------: | -------------: |
| `origin/main`         | 1 658 | 1 105 | 15 | 41 |
| #1922 lot 1 seul      | 1 219 |   805 | 15 | 37 |
| #1923 lot 2 seul      | 1 082 |   735 | 14 | 38 |
| #1921 lot 3 seul      | 1 116 |   724 | 14 | 31 |
| **cumul des 3 lots**  | **101** | **54** | 14 | 24 |

Les trois PR font donc tomber le motif de **1 658 à 101 lignes** (−94 %).

**Classement des 101 résidus (cumul) :**

- **88 — accès client légitime** : « Vos équipes pilotent l'outil en autonomie depuis
  <ville> » (44 fichiers × 2 lignes FR/EN-miroir, ex. `arcueil.ts:87`, `auch.ts:83`).
  C'est le client qui pilote depuis chez lui : pas une présence d'Axion-IA.
- **7 — géographie neutre** (desserte de la ville, sans sujet Axion-IA) :
  `loos.ts:21/23`, `faches-thumesnil.ts:52`, `senas.ts:52`, `sin-le-noble.ts:52`,
  `villepinte.ts:13/15` (« accès direct depuis Roissy-CDG »).
- **6 — A CORRIGER** (Axion-IA se présente comme venant d'une ville ou y ayant une base) :
  - `drancy.ts:236` (version #1922) — « Notre équipe se déplace sur site à Drancy … L'accès depuis Paris se fait en 15 minutes » ;
  - `veigne.ts:52` (version #1921) — « Couverture Tours Métropole et accès depuis Tours (20 min) ou Paris » ;
  - `peymeinade.ts:52` (version #1921) — « Couverture bassin Grasse-Cannes et accès depuis Nice (45 min) ou Cannes » ;
  - `wattrelos.ts:229` (main, non touché) — « Déplacement sur site possible, accès via A22 ou TER depuis Lille » ;
  - hors motif mais même défaut : `malakoff.ts:248` (main **et** les 3 lots) — « … depuis **notre base à Malakoff** » ;
  - `villepinte.ts:13/15` : en plus, deux jetons `{{price:audit-flash}}` / `{{price:intervention-4h}}` (cf. §1).

**« basé à » (14 résidus, cumul)** : 13 légitimes (questions client « une PME basée à… »,
organismes tiers basés dans la ville : Père Noël à Libourne, BIP à Villeneuve-sur-Lot,
écuries à Lorient, « cabinet traditionnel basé à Lyon ou Paris ») ;
**1 à vérifier** : `paris.ts:1009` « Plusieurs cas concrets dans nos références sont basés à
Paris » — les cas concrets sont éteints (`CAS_CONCRETS_AFFICHES = false`), la phrase les
présuppose.

**« from Paris » (24 résidus, cumul)** : toutes en version anglaise (« 15 minutes from Paris
by RER B »…) = desserte géographique. La locale EN est redirigée en 301 vers FR
(`src/proxy.ts`, AGENTS.md) : **non servi** aujourd'hui. À surveiller si EN est rallumée :
`reims.ts:361` (« we work there for day visits without overnight ») et `gagny.ts:146`
(« reachable in person ») suggèrent un déplacement depuis ailleurs.

**Hors `copy/`, même famille de défaut — RESERVE** : chaque page ville émet un JSON-LD
`LocalBusiness` avec `address.addressLocality = <ville>` :
`src/app/[locale]/implantations/[region]/[ville]/page.tsx:409-414` et
`src/lib/seo/ville-service-jsonld.ts:190-195`. Le commentaire (l. 176) le justifie comme
« zone de service (SAB) », mais un `PostalAddress` par ville se lit comme une adresse locale
pour un moteur. Préférer `areaServed` seul.

Verdict : **RESERVE** — après fusion des trois lots, 6 phrases à reprendre.

## 3. Grenoble — `src/**`

`grep -rli grenoble src` → **232 fichiers**. Hors `villes/copy/grenoble.ts`, l'essentiel est
légitime : console admin, Qualiopi, modèles d'e-mail et identité légale (siège RCS,
`src/lib/identite-legale-ssot.ts`, `src/lib/vcard/index.ts:88-99`,
`src/features/apporteurs-reseau/contrat-v2.ts:41`), données de la page ville Grenoble
(`economic-data/grenoble.ts`, `data/auvergne-rhone-alpes.ts`), gardes qui **interdisent** le
mot (`src/lib/contenu/interdits-publication.ts:189`, `src/lib/knowledge/pack-journee-ia.ts:111`).

**Communication publique qui nomme Grenoble comme siège ou ancrage — A CORRIGER :**

- `src/app/[locale]/equipe/[slug]/page.tsx:74` — méta description : « agence IA opérationnelle **basée à Grenoble** » ;
- `src/app/[locale]/carrieres/page.tsx:463-464` (+ ancrage l. 270, l. 475 `isHq`) — « Notre siège et nos bureaux sont à Grenoble » ;
- `src/content/careers/employer-brand.ts:72,74` — même phrase (FR/EN) ;
- `src/content/guide-ia-page.ts:417,631` — « Éditeur : Axion-IA · Grenoble » ;
- `src/app/[locale]/avis/page.tsx:103` — FAQ « Nos clients … Grenoble, Lyon, Paris… » ;
- `src/app/[locale]/recherche/page.tsx:86-87` — exemple de saisie « Ex : Grenoble, … ».

**RESERVE (citation géographique, pas d'ancrage)** : `src/content/regions.ts:140-148`
(villes de la région), `src/components/sections/LocalGeoFaqSection.tsx:155,159`
(« industrie Lyon-Grenoble »), `src/components/careers/OffersEmbedPromo.tsx:29,35`,
`src/lib/seo/page-images.ts:1563-1570` (corridor Mémo de l'Isère ; la page dit ne plus
citer Grenoble, `memo-isere/page.tsx:11`), clés SEO `src/content/keywords/*`
(cibles internes, non rendues), `og-blog-manifest.ts` (slugs d'articles).

Les carrières sont un cas limite (recrutement présentiel) : décision à prendre par Williams,
la règle « jamais Grenoble en communication » ne prévoit que les mentions légales.

Verdict : **A CORRIGER** (6 emplacements).

## 4. Interrupteurs

| Interrupteur | Déclaration | Lecture | Défaut | `.env*.example` |
| --- | --- | --- | --- | --- |
| `CHATBOT_KB_UNIFIED` | `src/env.ts:167` `z.enum(["true","false"]).optional()`, l. 767 | `src/server/chatbot/retrieval/knowledge-entry-search.ts:33-35` : `env.CHATBOT_KB_UNIFIED === "true"` | **éteint** (seul `"true"` exact allume) | `.env.example:430` commenté `# CHATBOT_KB_UNIFIED=false` ; absent des 3 autres |
| `CONTENT_FIDELITY_CHECK` | **absent de `src/env.ts`** (lecture brute de `process.env`) | `src/server/content-gen/fact-check/fidelite-branchement.ts:19-26` : `"true"` → actif, `"dry-run"` → essai à blanc, sinon éteint | **éteint** | absent des 4 fichiers d'exemple |

Comportement du chatbot éteint (code lu) :

- `knowledge-entry-search.ts:166` : `if (!estKbUnifieeActive(...)) return hybrid(tenantId, query, opts);`
  → même fonction, mêmes arguments, même résultat qu'avant #1908 ;
- `orchestrator.ts:134` : `const retrieve = deps.retrieve ?? rechercheChatbot;` ;
- `orchestrator.ts:473-480` : l'écriture du cache sémantique n'est **sautée que si allumé** ;
  éteint, `cacheWrite` est appelé comme avant.
- Côté génération : `content-gen-worker.ts:938-939` : `if (modeFidelite !== "eteint")` —
  éteint, aucun appel, aucune lecture de fiches.

Verdict : **OK**. Réserve mineure : déclarer `CONTENT_FIDELITY_CHECK` dans `src/env.ts`
(`z.enum(["true","dry-run","false"]).optional()`) et le documenter commenté dans
`.env.example`, comme `CHATBOT_KB_UNIFIED`.

## 5. Redirections `/fr/cas-concrets`

- `src/content/preuves-sociales.ts:53` : `export const CAS_CONCRETS_AFFICHES = false;`
- `next.config.ts:5` importe la constante ; `next.config.ts:288-297` :
  `...(CAS_CONCRETS_AFFICHES ? [] : [ /fr/cas-concrets → /fr/methodologie 301,
  /fr/cas-concrets/:path+ → /fr/methodologie 301, /en/case-studies/:path* → /fr/methodologie 301 ])`.
- Filets : `notFound()` dans `cas-concrets/[slug]/page.tsx:70` et `secteur/[slug]/page.tsx:60` ;
  liens masqués (Footer l. 70, not-found l. 38, error l. 61, ProductPageTemplate l. 177,
  chatbot `chercher-ressource.ts:60`).
- Garde : `src/content/__tests__/cas-concrets-eteints.spec.ts` (17 tests verts, dont
  « les URLs indexées redirigent en 301 vers /fr/methodologie »).
- Vérification en prod non faite : le proxy sortant de la session renvoie 403 sur
  `axion-ia.com`.

Verdict : **OK** (conditionnée dans `next.config.ts`, pas dans `src/proxy.ts`).

## 6. Pack RAG `docs/knowledge/pack-journee-ia-2026-11-10/`

- `Base_RAG.jsonl` : 734 lignes — 623 `search_query`, **63 `faq_knowledge`**, 20
  `page_intent`, 18 `source`, 10 `editorial_decision`.
- Dry-run réel (`pnpm exec tsx scripts/import-knowledge-pack-journee-ia.ts`, sans base) :
  `aImporterEnBrouillon: 62`, 1 rejet (`GEO-033`, faux témoignage), 2 contradictions
  écartées (D02 remise 990 €, D03 garantie), `parStatut: { draft: 62, published: 0 }`.
- Statut forcé : `src/lib/knowledge/pack-journee-ia.ts:30-33` (type) et `206-209` :
  `status: "draft"`, `pipelineStage: "draft"`, `publishedAt: null`. Le champ `status`
  du JSONL est une nature éditoriale (« Fait de l'offre », « Exemple à vérifier »…),
  pas un statut de publication.
- Script : dry-run par défaut (l. 49-52 : sans `--commit`, `return` avant toute base) ;
  `--commit` passe par `evaluerGardeCommit` (`pack-journee-ia.ts:409-431`) qui refuse si
  `NODE_ENV=production` ou base non locale sans `--confirmer-prod` → `process.exit(2)`.
  N'écrit que `create` après `findUnique` (l. 376-386) : aucune mise à jour, aucune suppression.
- Aucune trace d'exécution : `grep -rln 'pack-journee-ia\|Base_RAG' prisma .github package.json`
  → rien ; aucune migration ni seed ne référence le pack.

Verdict : **OK**.

## 7. Tests gardes

Specs du chantier présents sur `main` :

| Spec | Tests |
| --- | ---: |
| `src/app/__tests__/prix-pages-publiques.spec.ts` | 7 |
| `src/content/__tests__/offre-source-unique.spec.ts` | 10 |
| `src/content/__tests__/cas-concrets-eteints.spec.ts` | 17 |
| `tests/unit/ci/poids-du-bundle-garde-vraiment.spec.ts` | 5 |
| `tests/unit/content/villes-sans-fausse-presence.spec.ts` | 11 |
| `tests/unit/content/villes-consultants-viennent-de.spec.ts` | 4 |
| `tests/unit/content/villes-sans-prix-990.spec.ts` | 3 |
| `src/lib/knowledge/pack-journee-ia.test.ts` | 45 |
| `src/server/chatbot/retrieval/knowledge-entry-search.test.ts` | 17 |

Ajoutés par les PR en cours : `villes-sans-fausse-presence-lot-1.spec.ts` (#1922),
`villes-tranche-2-sans-fausse-presence.spec.ts` (#1923), `villes-lot3-sans-fausse-presence.spec.ts` (#1921).

CI : tous sont couverts par `vitest.config.ts:38-40` (`src/**/*.{test,spec}.{ts,tsx}`,
`tests/unit/**/*.{test,spec}.{ts,tsx}`), exécutés par `pnpm test:coverage --shard=N/3`
(`.github/workflows/ci.yml:394`, « Gate A · couverture (morceau N/3) ») puis fusionnés par
« Gate A · couverture » (l. 463). Seulement hors brouillon (CI-LOT1).

Exécution ciblée (9 fichiers, rien de `src/server/qualiopi`) :

```
pnpm exec vitest run <les 9 fichiers ci-dessus>
Test Files  9 passed (9)
     Tests  119 passed (119)
```

Verdict : **OK**. Limite : `villes-sans-fausse-presence.spec.ts` ne voit pas
`malakoff.ts:248` (« notre base à ») ni `wattrelos.ts:229` (§2).

## 8. Bundle

- Cliquet : `package.json:253,261` — « Shell partagé … CLIQUET 139 KB gz, CIBLE 100 KB »,
  `limit: "139 KB"` ; ADR `docs/adr/0075-cliquet-shell-partage-releve-a-139-kb.md`
  (relevé de 138 à 139 KB par #1920, accord de Williams du 11/11).
- Dernière mesure connue : **137,9 à 138,1 kB** sur `main` (ADR 0075, l. 12) → marge
  ≈ 0,9 kB ; dette ≈ 38 KB sur la cible.
- Pas de mesure plus récente : les derniers runs `ci.yml` sur PR (43047638627,
  43051072079…) sont en brouillon ou annulés ; « Gate B · per-PR » y rend « Refus en
  brouillon » et les tranches Gate B (qui portent « Poids du bundle ») sont `skipped`.
- Rappel AGENTS.md : le First Load JS **par route** (≤ 75 KB) n'est mesuré par aucune gate.

Verdict : **RESERVE** (marge < 1 kB, aucune mesure postérieure à #1920 disponible).

## A corriger en PR de suivi

1. `src/app/[locale]/faq/par-thematique/[categorie]/page.tsx:104-108` — résoudre les jetons (`resolvePriceTokensDeep(faqs, loc)`, comme `faq/page.tsx:95`) ; ajouter au spec prix une règle « aucun `{{price:` non résolu dans le HTML rendu ».
2. Arbitrage Williams : « > 5 000 € HT » dans `src/app/[locale]/tarifs/page.tsx:296,326` et `src/app/[locale]/demande-devis/page.tsx:30,37,54,55`.
3. Villes, fausse présence après les 3 lots : `src/content/villes/copy/malakoff.ts:248` (« notre base à Malakoff »), `wattrelos.ts:229`, `drancy.ts:236` (version #1922), `veigne.ts:52` et `peymeinade.ts:52` (versions #1921) ; à vérifier `paris.ts:1009`.
4. Villes, jetons de prix en phrase : `src/content/villes/copy/villepinte.ts:13,15` (rendus « sur devis », phrase à revoir).
5. JSON-LD : remplacer `address.addressLocality = ville` par `areaServed` seul dans `src/app/[locale]/implantations/[region]/[ville]/page.tsx:409-414` et `src/lib/seo/ville-service-jsonld.ts:190-195`.
6. Grenoble : `src/app/[locale]/equipe/[slug]/page.tsx:74`, `src/app/[locale]/carrieres/page.tsx:270,463-464`, `src/content/careers/employer-brand.ts:72,74`, `src/content/guide-ia-page.ts:417,631`, `src/app/[locale]/avis/page.tsx:103`, `src/app/[locale]/recherche/page.tsx:86-87`.
7. Garde villes : étendre `tests/unit/content/villes-sans-fausse-presence.spec.ts` à « notre base à », « déplacement … depuis », « couverture … accès depuis ».
8. `CONTENT_FIDELITY_CHECK` : déclarer dans `src/env.ts` et documenter commenté dans `.env.example`.

## Rappel sécurité

Des clés **INSEE, France Travail et Mistral** sont exposées dans le dépôt **public CRM Pro** :
elles sont à **changer par Williams** (révocation puis régénération), indépendamment de ce
chantier.
