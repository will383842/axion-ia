# H1 — Contre-vérification adversariale des findings P0/P1 des squads A et B

- **Date d'exécution** : 2026-08-14 23:50 UTC → 2026-08-15 01:40 UTC
- **Périmètre** : les **35 findings P0 et P1** des 12 rapports A1→A6 et B1→B6
  (8 P0 + 27 P1). Les P2 ne sont traités que lorsqu'ils changent le verdict d'un
  P0/P1 voisin.
- **Méthode** : relecture ligne à ligne du code cité (aucun finding validé sur la
  seule foi du rapport), re-tests live `curl` GET/HEAD horodatés, recherche des
  décisions actées et des tests-verrous contradictoires, contrôle de la fenêtre
  post-déploiement (atterrissages du 2026-08-14 à 14:57, 18:26 et ~19:50 UTC).
- **Contexte des re-mesures H1** : toutes prises entre **01:26 et 01:33 UTC le
  2026-08-15**, soit **≥ 5 h 30 après le dernier atterrissage** — donc hors de
  toute fenêtre ISR/stub. Toutes les pages mesurées portent le même
  `x-axion-build-sha: f51d544b64c8ad50fc870d87b9941d6ce5419d7e`, ce qui permet de
  comparer des pages entre elles sans biais de build.

---

## Résumé exécutif

| Verdict | Nombre |
|---|---|
| **CONFIRMÉ** | **29** |
| **RÉFUTÉ** | **4** |
| **INCERTAIN** | **2** |

Le fond des deux squads tient : aucun des 8 P0 n'est un pur faux positif, et la
tuyauterie décrite est globalement exacte. Mais **11 findings sur 35 sortent avec
une portée ou une gravité corrigée**, dont trois corrections structurantes pour
la Phase 3.

**Les 4 réfutations les plus importantes**

1. **A4-P1-1 (root-cause réfutée)** — « le `lastmod` d'`images-fr.xml` est pollué
   par les compteurs de vues via `trackUsage()` ». **`trackUsage` n'a AUCUN
   appelant dans `src/`** (grep exhaustif : une seule occurrence, sa propre
   définition). Aucune vue n'est trackée nulle part. Le symptôme mesuré
   (288/288 `lastmod` ≤ 7 jours) est réel mais **inexpliqué** : le patch prescrit
   (basculer sur `publishedAt ?? createdAt`) masquerait la cause au lieu de la
   traiter. À rouvrir avec une requête DB avant tout patch.
2. **A3-P1-3 + A5-P1-2 (réfutés d'office, décision actée n°10)** — « flux Google
   News éteint / fraîcheur morte depuis le 20 juillet, escalader le diagnostic
   content-gen ». Le fait est exact, mais la cause est un **reste-Will déjà acté**
   (« recharger OpenAI puis désarmer le kill switch », mémoire 2026-08-04). La
   décision 10 interdit de le re-lister. Seul survit un sous-patch neuf : le mot
   « hebdomadaire » de `llms.txt` devient mensonger tant que le pipeline est gelé.
3. **A5-P0-2 (portée réfutée, P0 → P1)** — « 66 pages **tier-1** annoncent un
   alternate markdown qui 404 ». **60 des 66 sont les fiches glossaire, qui sont
   `noindex, follow` et absentes de tout sitemap** (re-mesuré live :
   `/fr/glossaire/llm` → `noindex, follow`). Seules **6 URLs** (centre-aide) sont
   réellement indexables. L'impact GEO annoncé est surestimé d'un facteur ~11.
4. **B2-P0 (portée réfutée, P0 → P1)** — « le canal machine des ~4 300 pages les
   plus nombreuses du site ». Les pages `*/par-ville/*` sont **volontairement
   retirées de tous les sitemaps depuis le 2026-06-20** (décision Will,
   `sitemap.ts:401-412` : « orphelines, 0 lien interne, diluaient le crawl-budget »)
   et les hubs villes déclarés sont **480**, pas ~2 150 (cap premium
   `RANKED_INDEXABLE`, décision Will 2026-07-03). Le mécanisme est confirmé ; le
   volume et la gravité ne le sont pas.

**La découverte la plus importante de cette contre-vérification n'est pas une
réfutation mais une aggravation** : le volet `vatID`/SIRET de **B1-P0 n'est pas
une fenêtre post-déploiement, il est PERMANENT et concerne tout le site**. Sur un
build identique, les pages ISR portent `vatID` et les pages 100 % statiques ne le
portent **jamais** — y compris les hubs villes indexables. Le patch n°1 de B1
(ajouter 2 URLs aux listes du job `warm`) ne peut pas corriger cela : il faudrait
lister des milliers de pages. **Seul le patch n°2 (build-args) fonctionne**, et B1
le classait en « alternative ».

Deux redondances à fusionner avant la Phase 3 : **A1-P1-3 ≡ B4-P1-3** (un seul
patch `COMMON_ALLOW`) et **B2-P0 ≡ B4-P1-1** (un seul lot `strategy="inline"`).
**A3-P0 et B6-P0 se recouvrent sur `/fr`** (même patch de lot).

---

## Findings — verdict par verdict

### SQUAD A

---

#### A1-P1-1 — `ai.txt` : `Allow: /` = opt-IN au training au sens Spawning

**VERDICT : CONFIRMÉ — requalifié P2 (impact GEO nul).**

- **Preuve code relue** : `src/app/ai.txt/route.ts:33-34` porte bien
  `User-Agent: *` / `Allow: /`, immédiatement suivi de `ai-training: disallow`
  (l.39). L'en-tête (l.28) revendique explicitement le format Spawning.
- **Vérification indépendante de la grammaire** (WebSearch 2026-08-15 01:1x UTC) :
  les sources concordantes décrivent ai.txt comme « une grammaire par **type de
  média et par usage** : allow text for indexing, deny images for generative
  training » — les directives `allow`/`disallow` y portent donc bien une
  **permission d'usage/TDM**, pas une permission de crawl. La lecture d'A1 est
  soutenue.
- **Correction de gravité** : aucun bot de citation ne lit `ai.txt` ; l'instrument
  opérant est `robots.txt`, dont A1 a elle-même vérifié qu'il est intact et
  verrouillé par 8 tests. Le finding ne coûte **aucune** visibilité : c'est de
  l'hygiène doctrinale et un signal juridique. **P2**, pas P1.
- **Ne contredit aucune décision actée** (la doctrine 2 est respectée dans
  robots.txt ; ce patch la propage, il ne la rouvre pas).

---

#### A1-P1-2 — `ai-policy.json` : `license: CC-BY-4.0` racine vs `training.allowed: false`

**VERDICT : CONFIRMÉ — requalifié P2 pour un audit GEO (risque juridique, pas de visibilité).**

- **Preuve code relue** : `src/app/.well-known/ai-policy.json/route.ts:12`
  (`license: "CC-BY-4.0"` au niveau racine, à côté de `publisher: "Axion-IA"`)
  contre `:18-21` (`training.allowed: false`). La contradiction est littérale : CC
  BY 4.0 concède l'adaptation et l'usage commercial contre simple attribution.
- **Correction de gravité** : zéro perte de citation, zéro perte d'indexation. Le
  gain est la protection du contenu et la cohérence du signal. En grille GEO/AEO,
  c'est un **P2** ; en grille juridique, c'est légitimement prioritaire.
- Le patch proposé (licence propriétaire à la racine + tableau `licenses` scopé)
  ne touche pas la CC BY 4.0 réelle de la banque d'images ni de l'export
  Observatoire — décisions produit intactes.

---

#### A1-P1-3 — robots.txt bloque `/api/observatoire/export-csv` annoncé dans llms.txt

**VERDICT : CONFIRMÉ. ⚠️ DOUBLON EXACT de B4-P1-3 — un seul patch.**

- **Preuve code relue** : `src/app/robots.ts:15-16` (`"/api/"` dans
  `COMMON_DISALLOW`) et `:105-112` (`COMMON_ALLOW` = `/`, `/api/og`,
  `/api/avis/photo`, `/api/markdown/`, `/_next/image`, `/_next/static` — **pas
  d'observatoire**). Aucun `Allow` ne couvre l'URL.
- **Preuve live H1 (2026-08-15 01:2x UTC)** : `GET /api/observatoire/export-csv`
  → **200**, `text/csv`, agrégats réels servis. La route marche, seul le droit de
  la lire manque.
- **Contrôle anti-régression de la décision 2** : `COMMON_ALLOW` n'est distribué
  qu'aux blocs autorisés (`robots.ts:170,180,184-188`) ; les blocs
  `AI_BOTS_TRAINING_DISALLOWED` / `AI_BOTS_DISALLOWED` reçoivent `disallow: "/"`
  **sans aucune liste d'allow** (`:189-192`). Ajouter l'observatoire ne rouvre
  donc rien pour GPTBot/ClaudeBot/Google-Extended. **La décision 2 est préservée.**
- **Arbitrage de forme entre les deux rapports** : A1 propose
  `"/api/observatoire/export-csv"` (+ json), B4 propose `"/api/observatoire/"`.
  Retenir la forme **étroite** d'A1 (B4 le concède elle-même) pour ne pas ouvrir
  d'éventuelles routes futures du préfixe.
- **P1 maintenu** (dataset propriétaire citable + Google Dataset Search).

---

#### A2-P1-1 — `/fr/demande-devis/confirmation` noindex ET dans `pages.xml`

**VERDICT : CONFIRMÉ — requalifié P2.**

- **Preuve code relue** :
  `src/app/[locale]/demande-devis/confirmation/page.tsx:36` →
  `return { ...base, robots: { index: false, follow: true } }`. Et
  `src/app/sitemap.ts:175-218` : `EXCLUDED_FROM_INDEX` contient bien `/confirmation`
  (l.185) mais **pas** `/demande-devis/confirmation`. Les deux sont des clés
  distinctes de `routing.pathnames`. Le finding est exact.
- **Correction de gravité** : **1 URL sur 85** dans `pages.xml`, aucune page ne
  perd de visibilité, aucun contenu n'est inaccessible. C'est un bucket GSC
  cosmétique. La classe de défaut a effectivement été traitée 4 fois auparavant —
  mais chacun de ces précédents était, lui aussi, du polish. **P2.**

---

#### A2-P1-2 — Glossaire : 60 termes noindex, `glossaire.xml` n'émet que le hub

**VERDICT : CONFIRMÉ factuellement — mais à reclasser « arbitrage éditorial en attente », pas « finding à patcher ».**

- **Preuve code relue** : `src/content/glossary-extension.ts:855`
  (`GLOSSARY_MIN_INDEX_WORDS = 80`), `:866-869` (`glossaryTermWordCount`),
  `:875-879` (`isGlossaryTermIndexable`), et le bloc doc `:827-849` qui **mesure
  lui-même** l'état (« AUCUN des 60 termes n'atteint ce seuil… min 45, moyenne
  60,3, max 75 »).
- **Preuve live H1 (2026-08-15 01:31 UTC)** : `/fr/glossaire/llm` →
  `<meta name="robots" content="noindex, follow">`. Confirmé.
- **Ce qui change le statut du finding** : le code documente explicitement
  (`:834-839`) **deux correctifs INTERDITS** (baisser le seuil, retirer le filtre)
  et **un arbitrage nommément en attente de Will** (`:841-849`, métrique FR-only vs
  cumulée). Ce n'est donc ni un bug, ni une régression, ni une découverte : c'est
  une dette de contenu déjà tracée à la source, dont le seul remède est **écrire
  ~60 × 60 mots** (effort L). À porter en `03-RESTE-WILL` comme opportunité de
  contenu, pas en `01-PLAN-PATCHES` comme correctif.
- **Conséquence en cascade sur d'autres findings** : ces 60 pages étant noindex et
  hors sitemap, elles **dévaluent** A5-P0-2 (leur canal markdown cassé) et
  B4-P2 (leur `ItemList` non inliné). Voir ces deux entrées.

---

#### A2-P1-3 — `faq.xml` : dernier sub-sitemap DB-aware sur la convention metadata

**VERDICT : INCERTAIN — mécanisme réel, impact actuel très probablement nul. Requalifié P2 (risque latent).**

- **Preuve code relue, mécanisme CONFIRMÉ** : `faq` est bien toujours dans
  `staticIds` (`sitemap.ts:382`) donc servi par la convention metadata avec
  `revalidate = 86400` (l.122), et `buildFaqSitemap` (`:974-1005`) lit la DB via
  `listFaqs()`. Le scénario « baké vide au build stub » est structurellement
  possible.
- **Contre-preuve qui vide le finding de son impact** : le builder n'ajoute au
  legacy que les Q/R **indexables** (`isFaqItemIndexable`,
  `src/lib/knowledge/readers.ts:221-223` : `!item.isAutoGenerated ||
  item.indexationTier === "tier_1_indexable"`). Or **B4 a mesuré live une fiche
  Track B en `noindex, follow` = tier-2** (rapport B4, mesure 17:55 UTC). Les 97
  URLs observées (88 legacy + hub + 8 catégories) sont **exactement** ce que
  produirait le builder avec la vraie DB si aucune Q/R auto-générée n'est
  tier-1. Les deux hypothèses (baké stub / DB sans tier-1) sont donc
  observationnellement indiscernables — mais dans les deux cas **la perte
  actuelle est de 0 URL**.
- **Ce qui reste valable** : le jour où une Q/R Track B sera promue tier-1, elle
  disparaîtra du sitemap jusqu'à 24 h après chaque deploy. Risque **latent**, à
  traiter en même temps qu'une éventuelle promotion, pas en urgence.
- **Requête de tranchage** (A3/D-DB, 5 s) :
  `SELECT count(*) FROM faqs WHERE status='published' AND slug IS NOT NULL AND "indexationTier"='tier_1_indexable';`

---

#### A3-P0 — La home `/fr` manque aux deux listes du job `warm`

**VERDICT : CONFIRMÉ — avec une correction de mécanisme et une complétion obligatoire du patch.**

- **Preuve code relue** : `.github/workflows/deploy-coolify.yml:747`
  (`PATHS` = 5 chemins, **sans `/fr`**), `:778` (`FILES` = les mêmes 5, **sans
  `/fr`**), `:808` (`STRATEGIC` contient bien `/fr`). Exact.
- **Preuve live** : l'A3-ADDENDUM est solide et je ne le rediscute pas
  (cf HIT / Age 1520 / AggregateRating absent à 18:53 ; cache-bust avec
  `x-nextjs-cache: HIT` **et** AggregateRating à 19:16:56). Le diagnostic « l'ISR
  est saine, c'est l'edge CF qui fige » est correct.
- **Re-mesure H1 (2026-08-15 01:26 UTC, ≥ 5 h 30 après l'atterrissage)** :
  `/fr` → 200, `cf-cache-status: HIT`, `Age: 3063` (mise en cache ~00:35 UTC),
  `x-nextjs-cache: HIT`, **`"ratingValue":4.9` / `"reviewCount":77` présents**.
  → État **guéri**. La fenêtre est bien **bornée** et non un défaut permanent :
  cohérent avec le finding, et cela en fixe la portée (≈ 1-2 h par atterrissage).

**⚠️ Sous-affirmation RÉFUTÉE (A3-ADDENDUM, dernier paragraphe).** L'addendum
écrit : « le step warm pousse `/fr` dans le cache CF **avant** la revalidation »
et recommande « l'ordre des steps doit être vérifié : purge CF **puis**
revalidate **puis** warm ». **L'ordre du job `warm` est déjà celui-là** :
`Revalidate DB-dependent index pages` (l.729) → `Purge CF des pages revalidées`
(l.768) → `Warm strategic pages` (l.801) → `Warm full indexable surface` (l.827).
La cause n'est donc pas l'ordre, c'est que **`/fr` n'est jamais revalidée du
tout**. La recommandation de réordonnancement est **sans objet** et doit être
retirée du plan (elle ferait perdre du temps en Phase 3).

**⚠️ Complétion obligatoire du patch (découverte H1).** Le job **`lhci`**
(`deploy-coolify.yml:555`, `needs: deploy`) tourne **en parallèle** du job `warm`
et exécute une **passe navigateur de chauffe explicite** (l.609-619) sur
`https://axion-ia.com/fr`, `/fr/formations`, `/fr/audit`, `/fr/contact` et
`/fr/implantations/ile-de-france/paris` (l.600-606). Rien ne garantit qu'elle
passe après le step `revalidate` du job `warm` : lhci peut donc **refiger la
version stub à l'edge** pendant que warm revalide. Les 2 lignes de patch sont
nécessaires mais **ne ferment pas cette course**. Deux options à porter en H4/S2 :
(a) `needs: [deploy, warm]` sur le job `lhci` ; (b) re-purger CF sur ces 5 URLs
après lhci. Sans cela, le correctif restera intermittent.

- **Autre observation utile au patch** : le step `Warm full indexable surface from
  sitemap` (l.827-866) **ne peut pas** guérir ces pages. Un GET sur un prerender
  fraîchement bâti (âge ISR = 0) ne déclenche aucune revalidation : Next le
  considère frais pendant `revalidate` secondes. Seul un `revalidatePath` explicite
  fonctionne. Cela **renforce** A3-P0 et A3-P1-1 (voir ci-dessous).

---

#### A3-P1-1 — `/fr/memo-isere` et `/fr/blog` absents des deux listes

**VERDICT : CONFIRMÉ — et renforcé.**

- **Preuve code relue** : `src/app/[locale]/blog/page.tsx:16` (`revalidate = 3600`)
  avec le commentaire `:9-15` qui documente le retrait volontaire de
  `searchParams` → la page est bien **bakée** ; `memo-isere/page.tsx:62`
  (`revalidate = 3600`) + `:244,265` (`getPublishedReviews`). Exact.
- **Renforcement H1** : les deux URLs **sont pourtant balayées** par le sweep
  sitemap du job warm (`/fr/blog` est dans `pages.xml`, `/fr/memo-isere` dans
  `sitemap-recrutement.xml`), et cela ne les guérit pas — pour la raison ci-dessus
  (un GET ne revalide pas un prerender frais). Le sweep n'est donc **pas** une
  parade, ce qui justifie pleinement l'ajout aux deux listes explicites.
- **Contrôle du « ne pas ajouter »** : A3 a raison d'exclure `/fr/avis`,
  `/fr/carrieres`, `/fr/presse` — j'ai confirmé côté B6 que `/fr/avis` est servi
  en `private, no-store` / `cf BYPASS` (donc dynamique, insensible au stub).
- **P1 maintenu.**

---

#### A3-P1-2 — `/fr/ressources` n'est déclaré dans aucun sitemap

**VERDICT : CONFIRMÉ — requalifié P2, et l'estimation d'effort du patch est fausse.**

- **Preuve code relue** : `grep "ressources"` dans `src/app/sitemap.ts` → **0
  occurrence** ✔. Et — élément qu'A3 n'a pas vu — `grep "ressources|resources"`
  dans `src/i18n/routing.ts` → **0 occurrence également**. La clé n'existe **pas**
  dans `routing.pathnames`.
- **Conséquence sur le patch** : le builder `pages` est piloté par les clés de
  `routing.pathnames` (`sitemap.ts:173` `type PathnameKey = keyof typeof
  routing.pathnames`, `:224 localizedHref(key: PathnameKey, …)`). On ne peut donc
  **pas** « ajouter `/ressources` au builder `pages` » en une ligne : il faut
  d'abord déclarer la clé dans `routing.ts`, ce qui touche le routage i18n (et
  impose de statuer sur le mapping EN, même désactivé). **Effort S → S/M, avec un
  fichier sensible en plus.**
- **Correction de gravité** : 1 URL de hub, maillée en interne, revalidée à chaque
  deploy par le job warm, et dont tout le contenu aval (507 fiches) est déjà
  couvert par `sitemap-knowledge.xml`. **P2.**

---

#### A3-P1-3 — Flux Google News éteint depuis ~25 jours

**VERDICT : RÉFUTÉ comme finding actionnable (décision actée n°10). Le fait, lui, est exact.**

- Le constat est juste (`sitemap-news.xml` vide, dernier `publishedAt` news au
  2026-07-20) et A3 conclut elle-même « **aucun patch côté sitemaps** » : le gating
  fait exactement son travail.
- Le finding se réduit donc à une **escalade** : « diagnostiquer pourquoi plus
  aucune actu n'est publiée (worker BullMQ, crédit API, kill switch OpenAI ?) ».
  Or c'est un **reste-Will déjà acté** : mémoire 2026-08-04, « ⏳ recharger OpenAI
  puis désarmer le kill switch » (fiche `revue-console-terminee-2026-08-04.md`) et
  « ⭐ Crédit Anthropic épuisé → content-gen 100 % OpenAI ». La **décision actée
  n°10** proscrit explicitement de le répéter.
- **Doublon** avec A5-P1-2 et une limite de B3 — trois rapports remontent le même
  fait.
- **Ce qui survit** : rien côté A3.

---

#### A4-P1-1 — `lastmod` d'`images-fr.xml` pollué par les compteurs de vues

**VERDICT : RÉFUTÉ sur la root-cause. Le symptôme est réel mais inexpliqué ; le patch prescrit est prématuré.**

- **Ce qui est confirmé** : `src/app/sitemaps/images-fr.xml/route.ts:149`
  (`lastmod = updatedAt ?? publishedAt ?? createdAt`) ✔ ;
  `prisma/schema.prisma:4194` — le modèle `ImageAsset` (l.4103-4216) porte bien
  `updatedAt DateTime @updatedAt` ✔ ; la distribution live mesurée par A4
  (288/288 ≤ 7 jours, 104 le jour même) ✔.
- **Ce qui est RÉFUTÉ** — la chaîne causale. A4 écrit :
  « `trackUsage()` fait `prisma.imageAsset.update(...)` à chaque view/download/embed »
  et « **même une visite de crawler (la route détail appelle le tracking)
  rafraîchit le `lastmod`** ».
  **`grep -rn "trackUsage" src/` retourne UNE SEULE ligne : sa propre définition**
  (`src/server/image-bank/services/image-bank.service.ts:353`). **Zéro appelant.**
  Contrôle croisé : `grep "imageUsageLog|ImageUsageLog"` → `create` uniquement
  dans `trackUsage` (l.369) ; les autres occurrences sont le purge RGPD, l'action
  « droit à l'effacement » et la console admin. **Aucune vue n'est trackée nulle
  part sur ce site.** La route détail galerie n'appelle rien.
- **Seul bump de compteur réellement vivant** :
  `src/app/[locale]/galerie/[slug]/telecharger/route.ts:147` →
  `data: { downloadCount: { increment: 1 } }`. C'est un **téléchargement explicite**
  par un humain. 104 images « modifiées aujourd'hui » ne peuvent pas s'expliquer
  par 104 téléchargements sur un site à ce niveau de trafic.
- **Conséquence** : la cause réelle du `lastmod` uniformément frais est **ailleurs**
  — re-traitement de masse de la banque d'images (régénération de variants,
  traductions, EXIF), import/renommage en lot (cf. chantier mémoire « Banque
  images renommage 222 »), ou édition admin groupée. Ce sont potentiellement des
  **mises à jour légitimes**, auquel cas le `lastmod` est **honnête** et le patch
  prescrit (option 1 : basculer sur `publishedAt ?? createdAt`) **supprimerait un
  vrai signal de fraîcheur**.
- **Action H1** : ne pas patcher. Rouvrir avec une requête DB ciblée
  (`SELECT date_trunc('day', updated_at), count(*) FROM image_assets GROUP BY 1
  ORDER BY 1 DESC LIMIT 15;` + comparaison `updated_at` vs `created_at` vs
  `published_at`) avant toute décision. Le *class of bug* (compteur analytics sur
  la même ligne que les métadonnées éditoriales) reste une remarque de conception
  valide — mais pas au niveau P1, et pas avec ce patch.

---

#### A4-P1-2 — `<image:license>` CC BY 4.0 déclarée sur des photos Unsplash

**VERDICT : CONFIRMÉ — P1 sur l'axe juridique, P2 sur l'axe GEO.**

- **Preuve code relue** : `src/app/sitemap-images-services.xml/route.ts:31`
  (`const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"`) et
  `:40-47` — la balise `<image:license>` est émise **inconditionnellement pour
  chaque image** du manifeste, sans aucune propriété par image. ✔
- **Provenance Unsplash confirmée** dans le SSOT : `src/lib/seo/page-images.ts:74`
  (« Photo héro sectorielle **Unsplash** locale ») et les autres lignes citées. ✔
- **Correction d'axe** : A4 le dit elle-même — « risque légal > risque ranking ».
  Le badge « Licensable » mensonger ne dégrade pas l'indexation ; il expose à une
  réclamation. En grille GEO/AEO pure c'est un **P2** ; en grille conformité c'est
  prioritaire. À porter dans les deux colonnes plutôt que de trancher.
- Aucun test ne verrouille cette route (A4 l'a vérifié) → patch sûr.

---

#### A5-P0-1 — `llms-full.txt` sert 26 tokens `{{price:…}}` bruts

**VERDICT : CONFIRMÉ — P0 justifié.**

- **Preuve code relue** : `src/app/llms-full.txt/route.ts:71-73` —
  `FAQ_GLOBAL.map((f) => \`### ${f.fr.question}\n\n${f.fr.answer}\n\n(EN) ${f.en.answer}\`)`
  : les réponses sont concaténées **brutes**, sans `resolvePriceTokens`. Le
  contraste est net avec `src/app/api/markdown/[type]/[slug]/route.ts:41` qui
  importe `collapsePriceProseDuplicates` et `resolvePriceTokens`. ✔
- **Preuve live H1 (2026-08-15 01:29 UTC)** :
  `curl -s https://axion-ia.com/llms-full.txt | grep -o '{{price:' | wc -l` →
  **26**. Valeur strictement identique à celle mesurée par A5 à 18:07 UTC la
  veille, sur un build différent → défaut stable, pas un artefact.
- **Contre-preuve cherchée, non trouvée** : aucun post-traitement en aval dans la
  route (le `body` est renvoyé tel quel), aucun test ne verrouille ce contenu.
- **Contrôle de la décision 4** : le patch ne doit **pas** transformer les `|flat`
  en `|from` — A5 l'a explicitement noté. Conforme.
- **P0 maintenu** : c'est le fichier d'ingestion phare, et le prix est l'information
  la plus demandée aux assistants.

---

#### A5-P0-2 — 66 pages annoncent un alternate markdown qui répond 404

**VERDICT : CONFIRMÉ dans les faits — PORTÉE RÉFUTÉE. Requalifié P0 → P1.**

- **Preuves code relues, exactes** :
  - `src/app/api/markdown/[type]/[slug]/route.ts:48-55` — `ALLOWED_TYPES` =
    `{blog, actualites, guides, cas-concrets, centre-aide, faq}` : **`glossaire`
    est bien absent**. ✔
  - `src/app/[locale]/glossaire/[slug]/page.tsx:192` — la page émet bien
    `<link rel="alternate" type="text/markdown" href={\`/api/markdown/glossaire/${slug}\`} />`. ✔
  - `route.ts:157-174` — la branche `centre-aide` lit **uniquement**
    `prisma.helpArticleTranslation`, alors que la branche `faq` (l.176-201) a été
    corrigée le 2026-08-10 pour lire la **même source que la page**. Divergence
    confirmée. ✔
- **Preuves live H1 (2026-08-15 01:2x-01:31 UTC)** :
  | URL | Statut |
  |---|---|
  | `/api/markdown/glossaire/llm` | **404** |
  | `/api/markdown/centre-aide/preparer-une-intervention` | **404** (`Not found: /centre-aide/…`) |
  | `/api/markdown/faq/geo-france` | 200, markdown complet, tokens prix **résolus** |
- **RÉFUTATION DE PORTÉE** — A5 écrit : « **66 URLs d'ingestion cassées, annoncées
  dans le `<head>` de pages tier-1** » et classe le finding en **impact fort**.
  Or :
  | Segment | Volume | Indexable ? | Dans un sitemap ? |
  |---|---|---|---|
  | Glossaire | **60** | **NON** — `noindex, follow` (mesuré live sur `/fr/glossaire/llm`) | **NON** — `glossaire.xml` = 1 URL (le hub) |
  | Centre-aide | **6** | OUI — `index, follow` (mesuré live) | OUI — `help.xml`, 12 URLs |
  → **91 % des URLs du finding sont des pages que le site a délibérément
  désindexées** (cf. A2-P1-2, doctrine anti-doorway `GLOSSARY_MIN_INDEX_WORDS`).
  L'impact GEO réel porte sur **6 pages**, pas 66, et sur zéro page « tier-1 »
  côté glossaire.
- **Requalification** : **P1**, effort M inchangé. La branche `centre-aide` (6
  pages indexables, même classe de bug que la FAQ corrigée le 08-10) reste le vrai
  correctif ; la branche `glossaire` n'a de sens qu'**après** l'arbitrage de
  contenu d'A2-P1-2 — l'implémenter avant reviendrait à ouvrir un canal
  d'ingestion vers 60 pages qu'on refuse d'indexer.

---

#### A5-P1-1 — Feed FAQ : 70 tokens prix bruts, 1 550 items, 1,1 Mo, zéro `pubDate`

**VERDICT : CONFIRMÉ.**

- **Preuve live H1 (2026-08-15 01:30 UTC)** :
  `curl -s https://axion-ia.com/fr/faq/feed.xml | grep -o '{{price:' | wc -l` →
  **70**. Identique à la mesure d'A5 la veille sur un autre build. ✔
- La chaîne causale est la même que celle d'A5-P0-1 et je l'ai vérifiée à la
  source (`listFaqs()` consommé brut vs `resolvePriceTokensDeep` appliqué sur les
  pages). Le volet « tokens » est le cœur du finding et justifie le P1.
- **Correction mineure de portée** : les volets « cap 200 items » et « `pubDate` »
  sont du polish (P2) et portent un petit risque agrégateur qu'A5 chiffre
  honnêtement (~10 %). Ne pas les emballer avec le volet tokens dans le même
  patch : le premier est sans risque, les seconds non.

---

#### A5-P1-2 — Fraîcheur morte sur les feeds blog et actualités (dernier item = 20 juillet)

**VERDICT : RÉFUTÉ comme finding actionnable (décision actée n°10) — doublon d'A3-P1-3.**

- Le fait est exact et A5 a la lucidité d'écrire elle-même : « les routes sont
  saines… le problème est un **état de données**, pas un bug de rendu » et
  « **Déjà acté comme reste-Will → non répété** ». Il n'y a donc pas de patch code.
- Ce qui reste listé comme finding P1 revient à re-remonter la panne content-gen
  déjà actée (kill switch OpenAI / crédit à recharger, mémoire 2026-08-04) →
  **réfuté d'office par la décision 10**, au même titre qu'A3-P1-3.
- **CE QUI SURVIT ET DOIT ÊTRE CONSERVÉ** (seul élément neuf des deux rapports) :
  tant que la production est gelée, le mot **« hebdomadaire »** publié dans
  `llms.txt` / `llms-full.txt` devient une **affirmation fausse servie aux moteurs
  IA**. Patch S, risque nul, à garder dans le plan — mais comme un finding
  d'exactitude éditoriale, pas comme une alerte de fraîcheur.

---

#### A6-P1-1 — Toute la chaîne IndexNow n'atteint que Yandex ; fallback Bing WMT non câblé

**VERDICT : CONFIRMÉ — avec une correction d'effort.**

- **Preuve code relue** : `grep "bing-wmt-client|bingWmt"` sur `src/` → les seules
  occurrences sont **à l'intérieur du fichier lui-même**
  (`src/server/content-gen/seo/bing-wmt-client.ts`), dans ses `console.error` et
  ses tags Sentry. **Zéro appelant externe.** ✔
- **CORRECTION D'EFFORT** — A6 écrit « câbler `bingWmtSubmitUrlBatch` (à ajouter…),
  **l'API et la clé env `BING_WMT_API_KEY` y sont déjà décrites** », ce qui laisse
  entendre un branchement. En réalité le fichier n'expose que
  `bingWmtGetCrawlStats` (l.58), `bingWmtGetUrlInfo` (l.98) et `bingWmtGetQuota`
  (l.134) : **la fonction de soumission n'existe pas**, elle n'est que décrite en
  commentaire. Il faut l'écrire, gérer le quota 500/j, l'auth et les erreurs.
  **Effort M honnête** — ne pas le vendre comme « brancher l'existant » en S2.
- **Cadrage vs décision 10** : la cause racine (403 `UserForbiddedToAccessSite`
  côté agrégateur Microsoft) est un reste-Will déjà acté (ticket Bing
  UCM000007450870). A6 scope **correctement** son finding sur le volet **code**
  (le fallback), qui est neuf. Pas de réfutation.
- **P1 maintenu** (Bing alimente ChatGPT Search, Copilot, DuckDuckGo, Ecosia).
- **Réserve** : l'affirmation « Bing est sourd » reste une **inférence** (A6 le
  reconnaît en Limites) — la réception effective n'est vérifiable que dans Bing
  Webmaster Tools, côté Will.

---

#### A6-P1-2 — Bouton admin « Ping IndexNow » structurellement mort

**VERDICT : CONFIRMÉ (certitude statique) — requalifié P2 pour un audit GEO.**

- **Preuve code relue, double verrou confirmé** :
  1. `src/app/[locale]/(admin)/[adminPrefix]/analytics/page.tsx:84-89` — le
     `fetch` vers `${SITE_URL}/api/indexnow` ne pose que
     `headers: { "content-type": "application/json" }`. ✔
  2. `src/app/api/indexnow/route.ts:62-66` — la route lit
     `req.headers.get("x-axion-indexnow-signature")` et renvoie **401** si
     `verifyHmac` échoue (et `verifyHmac` retourne `false` dès que la signature est
     nulle, l.34). ✔
  3. **`grep "x-axion-indexnow-signature"` sur tout le dépôt → aucune occurrence
     dans `src/`** : les seuls hits sont un rapport d'audit et la roadmap qui a
     prescrit le hardening. **Aucun code ne calcule jamais cette signature.** Le
     401 est donc mathématiquement garanti.
  4. Même signée, `route.ts:24` ne poste que vers l'endpoint unique
     `api.indexnow.org` — celui qui 403e. ✔
- **Correction de gravité** : c'est un **outil interne** de re-notification
  manuelle. Le pipeline réel de ping (post-deploy, cron quotidien, workers) passe
  par `src/lib/indexnow.ts` et **fonctionne** (907 puis 1 061 URLs acceptées, logs
  cités par A6). Aucun moteur ne voit la différence. **P2.**

---

#### A6-P1-3 — Communiqués de presse : aucune notification aux moteurs à la publication

**VERDICT : CONFIRMÉ — requalifié P2 (impact actuel quasi nul).**

- **Preuve code relue** : `grep "pingIndexNow|enqueueIndexing|revalidatePath"` sur
  `src/server/actions/press/releases.ts` → **uniquement**
  `import { revalidatePath }` (l.24) et `revalidatePath("/fr/presse")` (l.165).
  Zéro ping. ✔ Le contraste avec FAQ / avis / cas-concrets / centre-aide est réel.
- **Correction de gravité** : **un seul communiqué existe** (`sitemap-presse.xml`
  = 1 URL) et le cron `daily-indexnow-resubmit` (fenêtre J-7) le rattrape avec
  ≤ 26 h de latence. L'impact d'aujourd'hui est ≈ 0 ; l'impact est **futur**.
  Patch S, sûr, à garder — mais en **P2**.
- **Garde-fou du patch bien vu par A6** : utiliser `@/lib/indexnow` (comme la FAQ)
  et **pas** le helper du pipeline content-gen, sous peine de faire rougir
  l'isolation-check CI. À conserver tel quel dans le plan.

---

### SQUAD B

---

#### B1-P0 — Identité légale amputée : `#organization` sans `vatID`/SIRET + mentions légales « communiqué sur demande »

**VERDICT : CONFIRMÉ — mais le finding mélange DEUX défauts de natures opposées, et la priorité des patches est inversée. C'est la correction la plus importante de ce rapport.**

**Volet A — mentions légales « communiqué sur demande » : CONFIRMÉ, transitoire.**
- Mécanisme relu et exact : `mentions-legales/page.tsx:23` (`revalidate = 3600`)
  + `:59` (`resolveLegalIdentity()` lit un `SiteSetting` en DB → `null` sous stub →
  `legal-identity.ts:237-255` rend « communiqué sur demande »). La page est
  absente des deux listes du warm **et** du sitemap (donc hors sweep).
- **Re-mesure H1 (2026-08-15 01:27 UTC, ≥ 5 h 30 après l'atterrissage)** :
  `curl -s .../fr/mentions-legales | grep -c "communiqué sur demande"` → **0**.
  → Page **guérie**. Le volet A est bien une **fenêtre post-déploiement bornée**,
  exactement comme décrit. ✔

**Volet B — `vatID` + `identifier` SIRET : CONFIRMÉ, mais PERMANENT et SITE-WIDE, pas une fenêtre.**
- **Preuve code relue** : `src/lib/seo.ts:874-875` —
  `vatID = env.COMPANY_VAT_NUMBER`, `registrationNumber = env.COMPANY_REGISTRATION_NUMBER`,
  toutes deux `optional()` (`env.ts:250-251`, lues l.449-450) ; `grep` de ces deux
  noms sur `.github/workflows/` → **0 occurrence** : ce ne sont pas des build-args. ✔
- **Mesures H1 décisives (2026-08-15 01:26-01:33 UTC, toutes sur le MÊME build
  `x-axion-build-sha: f51d544b…`, toutes ≥ 5 h 30 après l'atterrissage — donc hors
  de toute fenêtre)** :

  | URL | `export const revalidate` | `Cache-Control` servi | `vatID` |
  |---|---|---|---|
  | `/fr` | 3600 | `s-maxage=3600, swr=…` | **présent** |
  | `/fr/tarifs` | 3600 (`page.tsx:51`) | `s-maxage=3600, swr=…` | **présent** |
  | `/fr/faq` | ISR | — | **présent** (×2) |
  | `/fr/mentions-legales` | 3600 | — | **présent** |
  | `/fr/conditions-generales` | **aucun** | **`s-maxage=31536000`** | **ABSENT** |
  | `/fr/a-propos` | **aucun** | — | **ABSENT** |
  | `/fr/contact` | **aucun** | — | **ABSENT** |
  | `/fr/implantations/auvergne-rhone-alpes/lyon` | **aucun** | — | **ABSENT** |

- **Lecture** : la ligne de fracture n'est **pas** « avant/après la fenêtre
  post-deploy », c'est **« page ISR » vs « page 100 % statique »**. Une page sans
  `revalidate` n'est jamais re-rendue au runtime : son nœud `#organization`
  restera **définitivement** sans `vatID` ni SIRET, sur ce build comme sur tous les
  suivants (puisque les env vars ne sont pas des build-args). B1 avait mesuré 4
  pages 3 h après un deploy et en a déduit une fenêtre ; la réalité est un défaut
  **permanent**.
- **Portée réelle** : le nœud `#organization` est émis par le **layout**, donc par
  **toutes** les pages du site. Le défaut touche donc **l'intégralité des pages
  statiquement générées** — y compris les **480 hubs villes indexables** (vérifié
  sur Lyon), les fiches services statiques, etc. Ce n'est plus « 4 pages », c'est
  la majorité du site.
- **RÉFUTATION DE LA PRIORISATION DES PATCHES.** B1 prescrit :
  « **1. (S)** Ajouter `/fr/mentions-legales` et `/fr/conditions-generales` aux
  DEUX listes du job `warm` » puis « **2. (M)** passer les identifiants en
  build-args ». **Le patch 1 ne résout que le volet A.** Sur le volet B il est
  structurellement impuissant : on ne peut pas énumérer des milliers de pages
  statiques dans un YAML. **Le patch 2 est le SEUL qui corrige l'identité légale
  du graphe**, et il doit passer en tête.
- **Recommandation H1 pour S2** : scinder en deux entrées de plan.
  - **B1-P0-A** (fenêtre mentions légales) — ajouter `/fr/mentions-legales` aux
    deux listes du warm. S, risque quasi nul. À fusionner dans le même lot que
    A3-P0 / A3-P1-1 / B6-P0 (une seule PR YAML).
  - **B1-P0-B** (identité absente site-wide) — `COMPANY_VAT_NUMBER` +
    `COMPANY_REGISTRATION_NUMBER` en `--build-arg` + `ARG/ENV` Dockerfile, **ou**
    figés en code comme l'adresse. M, chemin de deploy → do-not-touch strict sur
    `stub.invalid`, `SKIP_ENV_VALIDATION`, `BULLMQ_DISABLED`,
    `Dockerfile.coolify-pull`. **⚠️ La variante « figer en code » impose d'amender
    `scripts/check-anti-siren.sh` et la spec 3b — STOP & ASK Will**, comme B1 le
    signale à juste titre.

---

#### B1-P1-1 — Triangulation Wikidata jamais activée

**VERDICT : CONFIRMÉ sur le constat — RÉSERVE FORTE sur le remède.**

- **Preuve code relue** : `src/lib/seo/wikidata-sameas.ts:28-37` (lecture directe
  de `process.env.WIKIDATA_QNUMBER_AXIONIA`, fallback tableau vide) ; injection
  `seo.ts:906-911` (`sameAs: [...buildOrganizationSameAs(), LinkedIn, about.me,
  indiehackers]`). La preuve d'absence de B1 est méthodologiquement solide : elle
  s'appuie sur un rendu **runtime** (`vatID` présent = env réels chargés) dont le
  `sameAs` ne contient pas de Wikidata. ✔
- **Réserve H1 sur le patch** : la recommandation est « créer l'item Wikidata
  “AXION IA SAS” … puis poser l'env var ». Wikidata applique une **politique de
  notabilité (WD:N)** exigeant des références sérieuses et publiquement
  disponibles. Le dossier d'Axion-IA à ce jour — société immatriculée en 2026,
  **7 abonnés LinkedIn** (mesuré par F6-ADDENDUM), aucune couverture presse
  indépendante, 1 seul communiqué — expose l'item à une **suppression** ; un item
  supprimé ne triangule rien et laisse une trace de rejet. Les sources proposées
  (SIRENE, societe.com, Kbis) sont des **registres**, généralement jugés
  insuffisants seuls.
- **Requalification** : garder le finding, mais formuler le reste-Will comme
  « **conditionné à l'obtention de 2-3 sources tierces indépendantes** » et
  séquencer après les citations locales (B1-P1-2) et les retombées presse.
  L'impact « fort » est réel **si** l'item survit ; sinon il est nul.
- Le sous-patch S (afficher `getWikidataConfigStatus()` en console) est sûr et
  utile — le module est aujourd'hui invisible.

---

#### B1-P1-2 — Citations locales NAP : module 100 % inerte (0/10 annuaires)

**VERDICT : CONFIRMÉ — avec une réserve opérationnelle sur GBP.**

- **Preuve code relue** : `src/lib/seo/local-citations.ts:39-124` (10 entrées,
  toutes `listingUrl: null`), `:133-137` (filtre non-null → `[]`), et aucun
  appelant de production (référencé uniquement par son spec, qui verrouille même
  `listed = 0`). `buildLocalBusinessJsonLd` (`seo.ts:1415-1475`) n'injecte jamais
  ce `sameAs`. ✔ Cohérent avec les mesures live de B1 (aucun `sameAs` annuaire sur
  `/fr/a-propos` ni sur une page ville).
- **Réserve H1 sur le remède** : Google Business Profile exige une **vérification
  d'établissement**. Le siège déclaré est une **domiciliation en centre d'affaires**
  (« ELITE BUREAUX - boîte 53 », 11 Avenue Paul Verlaine, 38100 Grenoble). Les
  adresses de domiciliation/coworking sont un motif fréquent de refus ou de
  suspension GBP. À signaler à Will comme **risque à anticiper** (préparer les
  justificatifs, envisager le mode Service Area Business avec adresse masquée —
  ce que B1 recommande déjà), pas comme un blocage.
- **Do-not-touch confirmé** : ne pas créer de faux bureau par ville — le pattern
  Service Area Business de `buildLocalBusinessJsonLd` est correct (décision
  2026-05-23) et B1 le protège explicitement. ✔
- **P1 maintenu**, impact fort plausible (GBP = levier n°1 du Knowledge Panel local).

---

#### B2-P0 — JSON-LD commercial absent du HTML servi sur « ~4 300+ » pages villes

**VERDICT : CONFIRMÉ sur le mécanisme — PORTÉE ET VOLUME RÉFUTÉS. Requalifié P0 → P1.**

- **Mécanisme relu et exact** : `src/components/marketing/JsonLdGraph.tsx:75-83` —
  si `strategy !== "inline"`, le graphe part dans un `<Script strategy=…>`
  (`next/script`), donc hors du HTML SSR. Le docstring `:14-19` **reconnaît
  lui-même** le compromis (« Pour les schemas critiques où l'on doute de la
  capacité crawler à executer JS (LLM bots), garder `strategy="inline"` »). Sites
  d'appel confirmés : `VilleServicePageTemplate.tsx:863-867`,
  `implantations/[region]/[ville]/page.tsx:909-942`. ✔
- **Preuve live H1 (2026-08-15 01:29 UTC)**, comptage réel de balises :
  | URL | `<script type="application/ld+json">` inline | occurrences `AggregateOffer` |
  |---|---|---|
  | `/fr/implantations/auvergne-rhone-alpes/lyon` | **2** | **1** (payload RSC échappé, **pas** en `ld+json`) |
  | `/fr/audit` | **7** | — |
  Reproduction indépendante de la mesure de B2, sur un autre build. ✔

- **RÉFUTATION DU VOLUME ET DE LA GRAVITÉ.** B2 écrit : « c'est le canal machine
  des **~4 300 pages les plus nombreuses du site** ». Deux décisions actées le
  contredisent :
  1. **Les pages `*/par-ville/*` sont retirées de TOUS les sitemaps depuis le
     2026-06-20** — décision Will documentée dans `src/app/sitemap.ts:401-412` :
     « les ~5000 pages services×villes … sont **RETIRÉES du sitemap**. Elles sont
     **orphelines (0 lien interne, sitemap-only)** et diluaient le crawl-budget
     d'un domaine jeune. » Les IDs `services-villes-*` sont commentés hors de
     `staticIds` (l.408-410) et le `case` du switch est laissé **inerte**. Une page
     ni déclarée ni maillée reçoit un crawl proche de zéro : le JSON-LD qu'elle
     n'émet pas ne coûte presque rien.
  2. **Les hubs villes déclarés sont 480, pas ~2 150** —
     `src/content/villes/index.ts:266-288` : cap indexation T1/T2 + curées,
     décision Will 2026-07-03, `RANKED_INDEXABLE` ≈ 480 ; les ~1 336 restantes sont
     `noindex, follow` et hors sitemap. A2 a compté **480 `<loc>`** sur les 13
     chunks villes (0 EN).
  → Le défaut réel porte sur **480 pages déclarées et indexables**, plus un stock
  d'orphelines délibérément dépriorisées. Réel, à corriger — mais ce n'est pas
  « visibilité cassée sur le plus gros du site ». **P1.**
- **Réserve maintenue sur le patch** : passer en `inline` heurte le gate `lhci`
  (TBT ≤ 150 ms, contrat AGENTS.md). B2 propose à raison une mesure sur 2-3 villes
  pilotes et un STOP & ASK si le budget est menacé. À conserver comme **condition
  d'exécution**, pas comme option. Le découpage « commercial inline (~1,5 KB) +
  reste déféré » est la variante à privilégier.
- **⚠️ DOUBLON avec B4-P1-1** — même mécanisme, même patch, périmètres qui se
  recouvrent largement. Un seul lot en Phase 3.

---

#### B2-P1-1 — AggregateOffer des hubs ville incohérent et partiellement faux

**VERDICT : CONFIRMÉ — chaque sous-point vérifié à la source. Portée corrigée (480 pages, pas ~2 150) ; impact « fort » → « moyen ».**

Relecture ligne à ligne de `src/app/[locale]/implantations/[region]/[ville]/page.tsx:451-521` :

| Sous-point B2 | Vérification H1 | Verdict |
|---|---|---|
| `lowPrice: 1190` alors que 2 offres valent 990 | l.466 `lowPrice: auditFlashPrice` ; `pricing.ts:240` `priceFlat: 1190` ; offres l.493 et l.502 à 990 | ✔ exact |
| `highPrice: 1900` ne borne rien | l.467 `auditEtiHighPrice` = `priceMin` ETI ; l'offre la plus chère listée vaut 1 200 | ✔ exact |
| « Coaching 1-to-1 **dirigeant** » au prix collaborateur | l.493 `price: unAUnEntryPrice` = `getEntryPriceEur(UN_A_UN_TIERS)` ; `pricing.ts:619-622` place `INTERVENTION_MEMBRE_EQUIPE_TIER` (990, l.491) **en premier** ; dirigeant = 1 390 (l.470) | ✔ exact |
| Plateforme SaaS à `minPrice: 990` | l.514 `minPrice: implEntryPrice` = `impl-poc` `priceMin: 990` (`pricing.ts:661`) au lieu de `CODAGE_TIERS` (l.751) | ✔ exact |
| Naming « Audit IA Flash » aboli | l.474 `name: "Audit IA Flash"` alors que le SSOT porte `labelFr: "Audit sur place"` (`pricing.ts:232`) — conforme à l'harmonisation actée du 2026-08-13 | ✔ exact |

- **Correction de portée/gravité** : (a) ~**480** hubs déclarés, pas ~2 150 ;
  (b) ce nœud **n'est pas dans le HTML servi** (cf. B2-P0) → seul Googlebot le lit
  après rendu JS. L'impact passe de « fort » à **« moyen »**. Le patch reste
  excellent (S, aucun test ne verrouille ces bornes — vérifié).
- **Contrôle décision 4** : le patch ne modifie que des **valeurs**, pas le format ;
  `lowPrice` reste un nombre brut. **Conforme.**
- **Signalement complémentaire (non levé par B2, à faire trancher, pas à patcher)** :
  le tier `audit-flash` porte `isFromPrice: true` (`pricing.ts:241`) et le nœud
  émet `Offer.price: 1190`, c'est-à-dire un **prix ferme** au sens Schema.org sur
  un tier explicitement « à partir de ». La décision 4 protège nommément
  `AggregateOffer.lowPrice` ; elle ne dit rien de `Offer.price`. **STOP & ASK Will**
  plutôt qu'un patch unilatéral.

---

#### B2-P1-2 — Formations par-ville « sur devis » vs « prix publics et fixes » ailleurs

**VERDICT : CONFIRMÉ (contradiction réelle entre deux décisions Will) — requalifié P2 ; STOP & ASK maintenu.**

- **Preuve code relue** : `src/components/sections/VilleServicePageTemplate.tsx:302-310`
  — `const entryPriceEur = isFormationService ? undefined : …` avec le commentaire
  « Formations V2 : 100 % SUR DEVIS (**décision Will 2026-07-17**) » ; contre
  `src/content/pricing.ts:1168-1173` — « **Refonte 2026-07-19 (décision Will)** …
  les **PRIX SONT PUBLICS** — prix fixe HT par groupe » + la matrice l.1200-1202
  (1 200 / 1 900 / 3 600 · 1 900 / 3 600 · 2 200 / 3 900). Deux décisions actées à
  **2 jours d'écart**, jamais réconciliées. ✔
- **B2 a raison de ne PAS trancher** : corriger dans un sens ou l'autre reviendrait
  à écraser une décision actée. Le finding documente, il ne prescrit pas. Bonne
  pratique — à conserver telle quelle.
- **Correction de gravité** : les pages concernées sont **hors sitemap et
  orphelines** (décision 2026-06-20, cf. B2-P0) **et** leur FAQPage/Service n'est
  pas servi dans le HTML (afterInteractive). Le scénario « un moteur IA interrogé
  sur le prix d'une formation à Lyon reçoit deux réponses contradictoires » est
  donc largement **théorique aujourd'hui**. **P2**, à traiter lors du prochain
  arbitrage catalogue.

---

#### B2-P1-3 — Aucun prix machine-readable sur les 4 fiches audit ni sur `/tarifs`

**VERDICT : CONFIRMÉ — P1 maintenu.**

- **Preuve code relue** : `src/lib/seo.ts:478-488` — le nœud `offers` n'est émis
  que `...(typeof priceEur === "number" ? {…} : {})` ; et
  `src/components/sections/AuditDetailPage.tsx:136-142` appelle
  `buildServiceJsonLd({...})` **sans** `priceEur`. Donc zéro `Offer` sur les 4
  fiches. ✔
- **Contrôle décision 4** : le patch proposé (`priceSpecification.minPrice`) est
  exactement la traduction machine de « à partir de » — **aucun prix ferme n'est
  introduit**, la décision est respectée. B2 rappelle en outre de ne pas passer par
  `formatTierPrice` (usage transactionnel du nombre). ✔
- **Pourquoi ce finding survit là où B2-P1-1/1-2 sont dégradés** : les 4 fiches
  audit et `/tarifs` sont des pages **déclarées, indexables, à JSON-LD inline**
  (8 et 5 blocs réels mesurés par B2, 7 blocs re-mesurés par H1 sur `/fr/audit`).
  Le signal manquant y est donc réellement perdu. **P1.**
- **Do-not-touch confirmé** : étendre `buildServiceJsonLd` par un paramètre
  `minPriceEur` **optionnel** plutôt que modifier la branche `priceEur` (26+ pages
  la consomment). ✔

---

#### B3-P1-1 — `BlogPosting.description` vide sur tout le corpus blog DB

**VERDICT : CONFIRMÉ par trois sources indépendantes — P1 maintenu.**

- **Preuve 1 (la plus dure)** : `grep "excerpt"` sur
  `src/server/queue/workers/content-publish-worker.ts` → **0 occurrence dans tout
  le fichier**. Le champ `ArticleTranslation.excerpt` n'est effectivement **jamais
  écrit** par le pipeline de publication. ✔
- **Preuve 2** : `src/app/[locale]/blog/[slug]/page.tsx:353` →
  `description: view.excerpt` **sans repli**, alors que la **metadata HTML de la
  même page** utilise `ensureArticleMetaDescription(view.metaDescription ?? view.excerpt, …)`
  (l.114). L'asymétrie est dans le fichier lui-même : la meta est remplie, le
  JSON-LD est vide. ✔
- **Preuve 3 — live H1 (2026-08-15 01:30 UTC)** :
  `curl -s .../fr/blog/formation-ia-trappes | grep -o '"description":""' | wc -l`
  → **1**. Le champ vide est bien servi. ✔
- **P1 maintenu** : `description`/`abstract` sont les champs que les moteurs de
  réponse citent comme résumé, sur 134 URLs blog tier-1 déclarées. Le patch (a)
  (repli page) est S et sans risque ; le patch (b) (spread conditionnel dans la
  factory) est le vrai durcissement.

---

#### B3-P1-2 — `dateModified` JSON-LD ↔ `lastmod` sitemap désynchronisés

**VERDICT : CONFIRMÉ factuellement — requalifié P2 (bénéfice/risque défavorable en P1).**

- **Preuve code relue** : le sitemap lit `Article.updatedAt`
  (`sitemap.ts:775-777`, `select: { publishedAt, updatedAt, … }`) ; la page lit
  `ArticleTranslation.updatedAt` (`readers.ts:504`). Deux colonnes `@updatedAt`
  distinctes. ✔
- **Pourquoi la gravité doit baisser** :
  1. Les 5 écarts mesurés par B3 sont de **1 à 2 jours**. Aucune source ne
     documente que Google déprécie un `lastmod` pour un delta de cet ordre ; la
     doctrine « lastmod ignoré » vise les **bumps massifs simultanés**, que B3
     constate elle-même **ABSENTS** (« 22 dates distinctes sur 134 URLs », « pas de
     bump global au deploy »).
  2. B3 chiffre elle-même le **risque du patch à « moyen »** : aligner les deux
     lectures peut faire **reculer** la date « Dernière révision » affichée
     (`blog/[slug]/page.tsx:536-539`), c'est-à-dire dégrader un signal visible pour
     corriger un signal invisible.
  → Rapport bénéfice/risque défavorable à P1. **P2**, et à traiter de préférence
  par la voie « moyen terme » (colonne `contentReviewedAt` dédiée), pas par
  l'alignement rapide.

---

#### B4-P1-1 — Schémas d'autorité en `afterInteractive` sur ~30 gabarits

**VERDICT : CONFIRMÉ — ⚠️ DOUBLON PARTIEL de B2-P0 (même mécanisme, même patch). Portée à corriger de la même façon.**

- **Mécanisme** : identique à B2-P0, relu et vérifié (`JsonLd.tsx:39-47`,
  `JsonLdGraph.tsx:75-83`). Les mesures live de B4 (Grenoble = Place + layout
  seulement ; centre-aide sans QAPage ; glossaire hub sans ItemList) sont
  cohérentes avec ma re-mesure sur Lyon. ✔
- **Corrections de portée**, identiques à B2-P0 : « ~1 816 villes × variantes
  services » est faux — **480** hubs déclarés, `par-ville` hors sitemap et
  orphelines (décisions Will 2026-07-03 et 2026-06-20).
- **Correction spécifique à B4** : le gabarit **glossaire hub** est cité comme
  perte (« un crawler non-JS ne reçoit AUCUNE URL de fiche via JSON-LD »). Or
  l'`ItemList` en question énumère **60 URLs `noindex`, hors de tout sitemap**
  (cf. A2-P1-2, re-vérifié live). L'inliner avant l'arbitrage éditorial reviendrait
  à publier une liste d'URLs que le site refuse d'indexer. **À retirer du lot.**
- **Ce qui est NEUF et valide dans B4-P1-1** (au-delà de B2-P0) : les gabarits
  **centre-aide** (QAPage, 6 pages indexables), **secteurs** (FAQPage, 61 URLs
  déclarées) et **stack-ia** (11 outils déclarés) — surfaces **réellement
  sitemappées**, où l'inlining a un vrai retour. C'est là qu'il faut concentrer le
  patch.
- **Réserve maintenue** : gate `lhci` TBT + `size-limit`. Mesurer avant de
  généraliser.

---

#### B4-P1-2 — Nœud Person « Manon » DB-dépendant → `author @id` orphelin post-build

**VERDICT : CONFIRMÉ — impact ramené de « moyen-fort » à « moyen ».**

- **Preuve code relue** : `src/lib/seo/manon-person.ts:19-24` —
  `prisma.authorProfile.findUnique({...}).catch(() => null)` puis
  `return author?.slug === "manon" ? buildPersonManonJsonLd(author) : null`. Sous
  le stub, `null` → le nœud n'est pas émis, et `faq/[slug]/page.tsx:789` rend
  `{personJsonLd ? <JsonLd …/> : null}`. ✔ Le commentaire d'en-tête assume le
  compromis (« Stub-safe … l'ISR runtime réhydrate ») — mais rien ne déclenche
  cette réhydratation sur 1 500+ fiches.
- **Preuve live de B4 excellente et non contestée** : même URL, 3 blocs en cache
  (Person absent) vs 4 blocs en cache-bust (Person présent). C'est la preuve
  propre du différentiel build/runtime. ✔
- **Correction d'impact** : la conséquence est un **warning** Rich Results
  (« Missing field name in author ») et une perte de signal E-E-A-T sur une fenêtre
  ≤ 1 h par deploy à l'edge — pas une désindexation ni une perte de citation.
  **P1 conservé** (le patch est S, propre, sans risque : fallback fichier quand
  `DATABASE_URL` contient `stub.invalid`), mais impact **moyen**.
- **Do-not-touch confirmé** : ne pas modifier le Proxy de `prisma.ts` (contrat
  ADR 0026) ; le fallback doit vivre dans `manon-person.ts` seul. ✔

---

#### B4-P1-3 — Dataset observatoire : les deux `DataDownload.contentUrl` bloqués par robots.txt

**VERDICT : CONFIRMÉ — ⚠️ DOUBLON EXACT d'A1-P1-3. Ne compter qu'une fois.**

- Même preuve code (`robots.ts:16` + `:105-112`), même preuve live (exports en 200,
  aucun `Allow` les couvrant). B4 apporte en plus le versant émetteur :
  `observatoire-ia/page.tsx:65-66` et `:262-275` déclarent bien les deux
  `DataDownload` dans le `Dataset`. ✔
- **Arbitrage de forme** : retenir `"/api/observatoire/export-"` (forme étroite),
  pas `"/api/observatoire/"` — B4 le concède elle-même.
- **Un seul patch, un seul test** à ajouter dans `robots.spec.ts` (sur le modèle du
  verrou `/api/markdown/`, l.76-86).

---

#### B5-P0-1 — Les offres hybrides déclarées « 100 % télétravail » (10/54)

**VERDICT : CONFIRMÉ — P0 maintenu. STOP & ASK Will confirmé.**

- **Preuve code relue** : `src/lib/seo/job-posting.ts:144-150` — dans la branche
  `else if (offer.city)`, un `if (offer.workMode === "hybrid")` ajoute
  `jsonLd.jobLocationType = "TELECOMMUTE"` **en plus** du `jobLocation` Place déjà
  posé (l.135-143). Le commentaire l.144-146 assume le choix. ✔ Et le comportement
  est effectivement **verrouillé par un test** (`job-posting.spec.ts:93`) — donc le
  patch DOIT réécrire ce test dans la même PR, comme B5 le prescrit.
- **Contrôle de la doctrine Google** : la citation de B5 (« Set this property with
  the value TELECOMMUTE for jobs in which the employee may or must work remotely
  **100% of the time** » / « **Don't** mark up jobs that allow occasional
  work-from-home ») est conforme à la spécification JobPosting de Google. La
  branche `remote` pure (l.131-133) est, elle, **correcte** — do-not-touch bien
  identifié.
- **Ne contredit pas la décision 5** : le patch ne touche ni `datePosted`, ni
  `validThrough`, ni `baseSalary`, ni le `title`. ✔
- **P0 maintenu** : c'est une donnée structurée **trompeuse** servie sur 10 pages
  indexées, avec un risque documenté de retrait des annonces — le seul des 8 P0 qui
  coche littéralement « visibilité mensongère ».
- **La qualification STOP & ASK de B5 est correcte** : c'est un choix commenté, pas
  un oubli. Ne pas l'appliquer sans l'accord explicite de Will.

---

#### B5-P0-2 — 53 offres sur 54 partagent le même `datePosted` à la milliseconde

**VERDICT : CONFIRMÉ dans les faits — CLASSEMENT RÉFUTÉ (P0 → P1) et le volet 1 du patch est contre-productif.**

- **Faits vérifiés** :
  - `src/server/notifications/channels/telegram.ts:47-69` — **un seul POST
    `sendMessage`, aucun découpage**, et `if (!res.ok) { console.warn(…) }` puis
    `return res.ok` : échec silencieux confirmé. ✔
  - La distribution live mesurée par B5 (53 × `2026-08-13T05:49:03.239Z`) est
    incontestable. ✔
- **Pourquoi ce n'est pas un P0** :
  1. **Les 53 offres portent une date de la veille de l'audit.** Aux yeux de Google
     for Jobs, elles sont donc **fraîches aujourd'hui**. Aucune visibilité n'est
     cassée ni mensongère à date. Les trois conséquences décrites sont **futures**
     (falaise ≈ 2026-09-27) ou **internes** (l'alerte Telegram).
  2. Le volet Telegram est une **simulation** — B5 le reconnaît — reposant sur une
     hypothèse de longueur d'`ADMIN_URL_PREFIX` (secret non lisible), et son impact
     est la fiabilité d'un **garde-fou interne**, pas la visibilité GEO/AEO.
  3. Le « signal de génération en masse » est une **hypothèse non étayée** : aucune
     documentation Google ne pénalise un employeur qui publie 53 annonces le même
     jour.
- **RÉFUTATION DU VOLET 1 DU PATCH** — « redistribuer `published_at` … les dates
  doivent **reculer** ou rester égales ». Faire reculer les dates rend les offres
  **plus vieilles** aux yeux de Google for Jobs, et peut en basculer une partie
  au-delà du seuil de 45 jours **immédiatement** : le remède aggrave le symptôme
  qu'il vise. Il est de surcroît, dans son principe, une **fabrication de la date
  que Google lit** — exactement l'objet de la décision actée n°5, même si la
  direction est inverse. **Recommandation H1 : ne pas exécuter le volet 1.** Le
  remède conforme existe déjà et est explicitement protégé par B5 en do-not-touch :
  `republishJobOfferAction` (`admin-job-offers/actions.ts:508-555`) — geste humain,
  garde-fous statut/pourvue/expirée, ping IndexNow + Google Indexing. Il suffit
  d'**échelonner les republications à la main** avant la falaise.
- **Ce qui survit et mérite d'être fait** : volet 2 (plafonner l'alerte à
  `stale.slice(0, 15)` + « … et N autres ») et volet 3 (chunker `telegram.ts` à
  3 900 caractères). Les deux sont S, sans risque, et le volet 3 bénéficie à
  **toutes** les catégories de notification. **P2.**
- **Verdict d'ensemble** : **P1** pour le constat (à surveiller avant le
  2026-09-27), **P2** pour les patches exécutables, **volet 1 abandonné**.

---

#### B5-P1-1 — Deux JobPosting concurrents pour la même offre commerciale

**VERDICT : CONFIRMÉ.**

- **Preuve code relue** : `devenir-commercial-ia/page.tsx:122-165` (JobPosting,
  `jobLocation: hubPlaces` l.160) et `memo-isere/page.tsx:350-391`
  (`jobLocation: MEMO_ZONE_PRINCIPALES.map(…)`). Les deux URLs sont déclarées dans
  `src/content/recrutement/dates.ts:36-48` et poussées dans
  `sitemap-recrutement.xml/route.ts:26-32`. ✔ L'intersection de 20 communes
  calculée par B5 sur les JSON-LD servis est une mesure directe, pas une
  déduction.
- **Do-not-touch bien identifiés** (`MEMO_ZONE_CLUSTERS`/`MEMO_ZONE_TOTAL` servent
  aussi la prose ; `/memo-isere` doit rester dans `sitemap-recrutement.xml`). ✔
- **Point d'attention non levé par B5** : `/fr/memo-isere` est aussi l'une des
  pages ISR **absentes des listes du job warm** (A3-P1-1). Si le JobPosting y est
  retiré, le finding A3-P1-1 reste valable pour son bloc avis. Les deux patches
  sont indépendants — à ne pas fusionner par erreur.
- **P1 maintenu.**

---

#### B5-P1-2 — `title` non conformes aux règles Google for Jobs (~16 offres)

**VERDICT : CONFIRMÉ — réserve forte sur la forme du patch.**

- **Preuve code relue** : `src/lib/seo/job-posting.ts:72` —
  `const title = isFr ? offer.titleFr : offer.titleEn;`, **aucune normalisation**.
  Le même champ sert de `<h1>` (`carrieres/[slug]/page.tsx:278,391`), et la
  validation de saisie ne contrôle que la longueur ≤ 160
  (`admin-job-offers/actions.ts:209`). ✔
- Les 16 cas relevés (nom d'entreprise dans le titre, `(full remote)`, `(H/F)`,
  copy marketing > 75 car.) sont extraits des JSON-LD réellement servis — mesure
  directe. La règle Google citée (« Don't include job codes, addresses, dates,
  salaries, **company names** ») est conforme à la spécification.
- **Réserve H1 sur le patch** : le normaliseur par **coupe au premier séparateur**
  (` — `, ` - `, ` · `) est risqué et B5 le concède (« Consultant / Ingénieur IA —
  implémentation & développement perdrait la 2ᵉ moitié »). Un regex appliqué à
  l'aveugle sur 54 titres produira des coupes fausses. **Recommandation H1** :
  livrer directement la variante « propre » que B5 place en option moyen terme —
  une colonne `jobTitleClean` optionnelle en console, avec le normaliseur en repli
  **et une relecture humaine des 54 titres**. L'effort passe de S à S/M ; le risque
  passe de « faible/moyen » à faible.
- **Do-not-touch confirmé** : ne pas toucher `offer.titleFr` en base ni le `<h1>` ;
  ne pas réintroduire de lieu dans le titre (**décision 5**). ✔
- **P1 maintenu.**

---

#### B5-P1-3 — `hiringOrganization` auto-référencé sur `/devenir-commercial-ia`

**VERDICT : CONFIRMÉ — le patch le plus sûr de tout le lot B.**

- **Preuve code relue** :
  `src/app/[locale]/devenir-commercial-ia/page.tsx:154-159` →
  `{ "@type": "Organization", name: "Axion-IA (axion-ia.com)", url: SITE_URL, sameAs: SITE_URL }`
  — pas d'`@id`, `name` divergent du canonique, `sameAs` pointant sur le site
  lui-même, pas de `logo`. Contre `src/lib/seo/job-posting.ts:15-22` (`HIRING_ORG`)
  qui porte `@id: ${SITE_URL}/#organization`, `name: "Axion-IA"`, `logo` et
  `sameAs: ["https://www.linkedin.com/company/axion-ia-france"]`. ✔
- **Cohérence avec les preuves déjà établies** : le `sameAs` LinkedIn
  `company/axion-ia-france` est **la bonne page** (F6-ADDENDUM : 8 occurrences
  `axion-ia-france` contre 3 `axion-ia`) — **ne pas le « corriger »**. Le patch
  d'exportation de `HIRING_ORG` est donc à la fois la correction de B5-P1-3 **et**
  une élimination de l'une des 3 occurrences fautives repérées par F6.
- **P1 maintenu**, effort S, risque très faible.

---

#### B6-P0 — Home + 4 pages services hors des listes anti-stub du job `warm`

**VERDICT : CONFIRMÉ — et renforcé par une découverte H1. Recouvre A3-P0 sur `/fr`.**

- **Preuve code relue et complétée** : les 5 pages citées ont bien toutes
  `revalidate = 3600` **et** le bloc avis DB. Vérifications H1 supplémentaires
  (B6 ne citait que 2 des 4 services) :
  - `sites-web-augmentes/page.tsx:70` `revalidate = 3600` + `:42,245`
    `ServiceReviewsSection serviceLine="sites_web_augmentes"` ✔
  - `implementation/page.tsx:53` `revalidate = 3600` + `:47,261`
    `ServiceReviewsSection serviceLine="implementations"` ✔
  Les listes `PATHS` (l.747) et `FILES` (l.778) ne contiennent aucune de ces 5 URLs. ✔
- **DÉCOUVERTE H1 QUI RENFORCE LE FINDING** : le job **`lhci`**
  (`deploy-coolify.yml:555`, `needs: deploy`) tourne **en parallèle** du job `warm`
  et chauffe explicitement `/fr`, `/fr/formations` et `/fr/audit` (l.600-606) avec
  une passe navigateur jetable dédiée (l.609-619). **Trois des cinq URLs du finding
  sont donc re-cachées à l'edge par un job que le patch de B6 ne touche pas.**
  Ajouter les 5 URLs aux deux listes est nécessaire **mais insuffisant** : il faut
  aussi sérialiser `lhci` après `warm` (`needs: [deploy, warm]`) ou re-purger CF
  après lhci. À porter en H4/S2 — sinon le correctif restera intermittent sur
  exactement les pages les plus stratégiques.
- **Non re-observé directement par H1** : je n'ai pas pu capturer la fenêtre vide
  sur les pages services (mes mesures sont à ≥ 5 h 30 d'un atterrissage). La preuve
  du mécanisme reste celle, directe, de l'A3-ADDENDUM sur `/fr`, plus les
  commentaires de code horodatés (`page.tsx:54-70`, workflow l.737-744 et 762-768).
  **Le mécanisme étant identique et le code partagé, la généralisation est légitime.**
- **⚠️ Recouvrement avec A3-P0 et A3-P1-1 et B1-P0-A** : `/fr`, `/fr/blog`,
  `/fr/memo-isere`, `/fr/mentions-legales`, `/fr/audit`, `/fr/formations`,
  `/fr/implementation`, `/fr/sites-web-augmentes` → **une seule PR YAML**, 8 URLs
  ajoutées aux deux listes, plus la sérialisation de lhci. C'est le patch au
  meilleur rapport impact/effort de tout l'audit A+B.

---

#### B6-P1 — Étoiles SERP structurellement inaccessibles

**VERDICT : CONFIRMÉ — réserve sur la pérennité du patch.**

- **Preuve code relue** : `src/server/reviews/jsonld.ts:55-65` — l'AggregateRating
  global est niché sur `Organization` (home + hub /avis) ;
  `ServiceReviewsSection.tsx:6-7` documente explicitement le choix de **ne pas**
  étoiler les pages services ; `audit/page.tsx:89` n'émet qu'un `Service`
  (inéligible aux étoiles). ✔
- **Preuve live H1 (2026-08-15 01:29 UTC)** : `/fr/audit` → **7** blocs
  `<script type="application/ld+json">` inline, et **`grep -o 'aggregateRating' | wc -l`
  = 0**. Reproduction indépendante et nette de la mesure de B6. ✔
- **Contrôle de la politique Google** : la règle « pas d'étoiles pour les avis
  self-serving » vise nommément `LocalBusiness` et `Organization` — le diagnostic
  de B6 est exact, et le déplacement vers `Product`/`Course` est bien le seul
  chemin réaliste (c'est déjà ce que font les facettes `/avis/service/*`).
- **Réserve H1** : ce déplacement reste, dans l'esprit, un avis first-party sur
  ses propres prestations. La pratique est répandue et tolérée pour
  `Product`/`Course`, mais Google peut la requalifier. La condition posée par B6
  (« valider au **Rich Results Test** sur **1** page avant de généraliser ») doit
  être traitée comme une **condition d'exécution obligatoire**, pas comme une
  recommandation.
- **P1 maintenu** (impact fort : c'est l'unique voie vers des étoiles sur « audit
  IA », « formation IA entreprise »). Les helpers existent déjà
  (`serviceAggregateJsonLd`, gating `AGGREGATE_MIN_COUNT`), l'effort S-M est
  crédible.
- **Do-not-touch confirmés** : `buildServiceJsonLd`, le graphe `seo.ts`,
  `service-lines.ts` (verrouillé par `reviews.spec.ts:58-67`), décision 4. ✔

---

## Mesures brutes H1

Toutes les requêtes : `curl` GET/HEAD anonyme depuis le poste local,
**2026-08-15 entre 01:26 et 01:33 UTC**, ≥ 5 h 30 après le dernier atterrissage
(~19:50 UTC du 2026-08-14). Toutes les pages HTML mesurées portent
`x-axion-build-sha: f51d544b64c8ad50fc870d87b9941d6ce5419d7e`.

### Codes de statut

| URL | Statut | Finding concerné |
|---|---|---|
| `/api/markdown/glossaire/llm` | **404** | A5-P0-2 |
| `/api/markdown/centre-aide/preparer-une-intervention` | **404** | A5-P0-2 |
| `/api/markdown/faq/geo-france` | 200 (markdown, tokens résolus) | contre-exemple sain |
| `/api/observatoire/export-csv` | 200 (`text/csv`) | A1-P1-3 / B4-P1-3 |
| `/api/markdown/guides/formation-ia-champigny-sur-marne-2` | **200** | A5-P2 (fuite cross-type) |
| `/fr/guides/formation-ia-champigny-sur-marne-2` | **404** | A5-P2 (`Source:` mensongère) |
| `/security.txt` (racine) | **404** | A1-P2 |
| `/fr/galerie/` | **308** → `/fr/galerie` | A4-P2 |

### Contenus et compteurs

| Mesure | Résultat | Finding |
|---|---|---|
| `/llms-full.txt` — occurrences `{{price:` | **26** | A5-P0-1 ✔ (identique à J-1, autre build) |
| `/fr/faq/feed.xml` — occurrences `{{price:` | **70** | A5-P1-1 ✔ |
| `/fr/blog/formation-ia-trappes` — `"description":""` | **1** | B3-P1-1 ✔ |
| `/fr` — `AggregateRating` | présent, `"ratingValue":4.9` / `"reviewCount":77` | A3-P0 (état guéri) |
| `/fr/mentions-legales` — « communiqué sur demande » | **0** | B1-P0 volet A (état guéri) |
| `/fr/audit` — balises `ld+json` inline | **7** | B2-P0 (contre-exemple sain) |
| `/fr/audit` — `aggregateRating` | **0** | B6-P1 ✔ |
| `/fr/implantations/…/lyon` — balises `ld+json` inline | **2** | B2-P0 / B4-P1-1 ✔ |
| `/fr/implantations/…/lyon` — `AggregateOffer` | **1** (payload RSC, pas en `ld+json`) | B2-P0 ✔ |
| `/fr/glossaire/llm` — `<meta robots>` | **`noindex, follow`** | A2-P1-2 ✔ / réfute la portée d'A5-P0-2 |
| `/fr/centre-aide/preparer-une-intervention` — `<meta robots>` | `index, follow` | A5-P0-2 (les 6 vraies URLs) |

### Matrice `vatID` — ISR vs statique (même build)

| URL | `revalidate` déclaré | `Cache-Control` servi | `x-nextjs-cache` | `vatID` |
|---|---|---|---|---|
| `/fr` | 3600 | `s-maxage=3600, swr=31532400` | HIT (Age 3063) | **1** |
| `/fr/tarifs` | 3600 | `s-maxage=3600, swr=31532400` | STALE (Age 3117) | **1** |
| `/fr/faq` | ISR | — | — | **2** |
| `/fr/mentions-legales` | 3600 | — | — | **1** |
| `/fr/conditions-generales` | **aucun** | **`s-maxage=31536000`** | HIT | **0** |
| `/fr/a-propos` | **aucun** | — | — | **0** |
| `/fr/contact` | **aucun** | — | — | **0** |
| `/fr/implantations/auvergne-rhone-alpes/lyon` | **aucun** | — | — | **0** |

→ Corrélation parfaite ISR ⇒ `vatID` présent / statique ⇒ `vatID` absent, sur un
build unique et hors fenêtre. Preuve du caractère **permanent et site-wide** du
volet B de B1-P0.

### Vérifications statiques décisives

| Grep / lecture | Résultat | Finding |
|---|---|---|
| `trackUsage` dans `src/` | **1 occurrence = sa propre définition, 0 appelant** | **RÉFUTE la root-cause d'A4-P1-1** |
| `imageUsageLog` / `ImageUsageLog` dans `src/` | `create` uniquement dans `trackUsage` ; le reste = purge RGPD, effacement, console | idem |
| `excerpt` dans `content-publish-worker.ts` | **0 occurrence** | B3-P1-1 ✔ |
| `x-axion-indexnow-signature` dans `src/` | **0 occurrence** (seulement rapports + commentaire de la route) | A6-P1-2 ✔ |
| `bing-wmt-client` / `bingWmt` hors du fichier | **0 appelant** ; pas de fonction de soumission | A6-P1-1 ✔ + correction d'effort |
| `pingIndexNow` / `enqueueIndexing` dans `press/releases.ts` | **0** | A6-P1-3 ✔ |
| `ressources` dans `sitemap.ts` **et** dans `routing.ts` | **0 / 0** | A3-P1-2 ✔ + correction d'effort |
| `COMPANY_VAT_NUMBER` dans `.github/workflows/` | **0** | B1-P0 volet B ✔ |
| Ordre des steps du job `warm` | revalidate (729) → purge CF ciblée (768) → warm stratégique (801) → sweep (827) | **réfute la recommandation d'ordre de l'A3-ADDENDUM** |
| `lhci` : `needs: deploy` (555) + URLs chauffées (600-606, 619) | parallèle à `warm`, chauffe `/fr`, `/fr/formations`, `/fr/audit` | **complète A3-P0 et B6-P0** |
| `services-villes-*` dans `generateSitemaps()` | commentés hors de `staticIds` (`sitemap.ts:401-412`) | **réfute le volume de B2-P0** |
| `RANKED_INDEXABLE` | cap premium ≈ 480 (`villes/index.ts:266-288`) | idem |

---

## Limites

1. **Fenêtre post-déploiement non re-capturée.** Toutes mes mesures sont à
   ≥ 5 h 30 du dernier atterrissage : j'ai pu constater l'état **guéri** (ce qui
   borne les findings), mais je n'ai pas ré-observé la fenêtre vide en direct. Pour
   A3-P0 et B1-P0-A je m'appuie donc sur l'A3-ADDENDUM (mesure directe, solide) et
   sur les commentaires de code horodatés. Pour B6-P0 (pages services), **aucune
   observation directe de la fenêtre n'existe dans aucun rapport** — le mécanisme
   est établi par le code partagé, pas par une mesure.
2. **Pas d'accès DB.** Trois verdicts en dépendent partiellement : A2-P1-3
   (INCERTAIN — la requête de tranchage est fournie), A4-P1-1 (la cause réelle du
   `lastmod` uniforme reste à établir par SQL) et B5-P0-2 (origine de l'écriture de
   masse de `published_at`).
3. **Pas de POST**, donc : le 401 du bouton admin IndexNow (A6-P1-2) reste prouvé
   par lecture statique seule (mais la preuve est mathématiquement close : la
   signature n'est calculée nulle part) ; aucun Rich Results Test ni
   validator.schema.org n'a été exécuté (B6-P1, B2-P1-3, B5-P0-1 reposent sur la
   lecture des spécifications).
4. **Grammaire `ai.txt` (A1-P1-1)** : établie par sources secondaires concordantes,
   la page du générateur Spawning étant JS-only. Le verdict CONFIRMÉ porte sur la
   plausibilité forte, pas sur un texte normatif — ce qui est une raison de plus de
   le traiter en P2.
5. **Logs GH Actions non relus par moi** (A6-P1-1 : 403 `UserForbiddedToAccessSite`,
   runs 31807073238 et 31768771942). Je fais confiance aux citations horodatées
   d'A6, qui sont précises et croisées sur deux runs indépendants.
6. **Échantillonnage.** Une page ville (Lyon), une fiche blog, une fiche glossaire,
   une fiche centre-aide. Les mécanismes vivant dans des gabarits partagés, la
   généralisation est structurelle — mais elle n'est pas une mesure exhaustive.
7. **Je n'ai pas contre-vérifié les P2** des 12 rapports (hors mandat), sauf quand
   ils changeaient le verdict d'un P0/P1 (A2-P1-2 ↔ A5-P0-2, A1-P2 ↔ A5-P2).
