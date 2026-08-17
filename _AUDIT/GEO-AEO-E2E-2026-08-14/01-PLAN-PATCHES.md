# 01 — PLAN DE PATCHES (agent S2, squad synthèse)

- **Date de rédaction** : 2026-08-15.
- **Source de vérité** : `H6-coherence-inter-rapports.md` (liste canonique dédupliquée,
  155 findings `GEO-001` → `GEO-155`) pour le QUOI, `H4-anti-regression-patches.md`
  (58 prescriptions ramenées à **45 patches distincts**) pour le RISQUE, les
  do-not-touch et les tests. H1/H2/H3 pour les verdicts CONFIRMÉ/RÉFUTÉ.
  Les 40 rapports A1→G4 ne sont cités que pour les chemins de fichiers.
- **Règle appliquée** : aucun patch qui ne figure pas dans un rapport d'agent dont le
  finding est CONFIRMÉ. Les 8 findings éliminés, les 8 patches retirés et les 8 items
  de checklist écartés par H6 **ne réapparaissent nulle part ici** (liste de rappel
  au § 6, pour qu'un futur lecteur ne les repêche pas).
- **Mode** : AUDIT-ONLY. Rien n'est appliqué. Ce document prescrit et ordonne.

## Comment lire ce plan

Un **lot** = une PR. Règle maison : on fusionne les PR en lot, un seul build.
Un lot regroupe des **fichiers voisins** et un **même niveau de risque** — jamais un
patch de 2 lignes de YAML avec un patch qui peut 500-er une famille d'URLs.

Convention d'effort : **S** ≤ 1 h · **M** 2 à 6 h · **L** 1 à 3 j.
Les totaux horaires sont des estimations de S2, pas des mesures.

Convention de risque : **faible** (additif, réversible, couvert par un test),
**moyen** (touche un chemin partagé ou le déploiement), **ÉLEVÉ** (peut casser une
surface entière **sans qu'aucune gate ne rougisse** — ADR obligatoire).

Les lots sont ordonnés par **impact ÷ risque**, P0 d'abord. Le **lot 1** est celui
que Will peut poser ce soir sans réfléchir.

---

## 0. Trois faits qui conditionnent tout le plan

**(a) Aucune gate de budget ne bloque quoi que ce soit.** `size-limit` et le budget
First Load sont en `continue-on-error` (G1-P0-1, confirmé H4). Conséquence directe
sur ce plan : **toute notation de risque « bundle » suppose une mesure manuelle
avant/après**. Sans elle, lire le risque un cran plus haut. C'est pourquoi le lot 1
commence par rétablir la vérité sur les gates : tant que ce mensonge tient, chaque
notation de risque de ce document repose sur une fausse sécurité (H4, C-17).

**(b) La revendication Qualiopi est un fait établi hors de cet audit.** L'audit blanc
Qualiopi du 2026-08-15 a conclu que la certification **n'a jamais été délivrée** et
que le drapeau `QUALIOPI_CERTIFICATION_OBTENUE=true` neutralise une garde que le code
avait pourtant posée. Will a déjà acté l'action corrective (drapeau à `false` côté
Coolify + redémarrage) : **ce plan ne prescrit aucune action Qualiopi** et renvoie à
l'audit dédié. Mais le fait a **quatre conséquences d'ordonnancement** ici, parce
qu'il corrobore par voie indépendante le finding F5 (`est_organisme_formation: false`,
`est_qualiopi: false` aux registres, aucun NDA publié, le seul « Axion » vérifiablement
Qualiopi étant l'homonyme AXION FORMATIONS de Saint-Quentin, GEO-021) :

1. **GEO-075 (débannir le token « Qualiopi » de la banque de mots-clés) est GELÉ.**
   Poser ce patch ferait générer, au rallumage du pipeline, du contenu qui affirme une
   certification inexistante — à l'échelle industrielle. À rouvrir seulement quand le
   certificat existe. C'est le seul patch de ce plan que je classe **à ne pas poser**
   alors que son finding est confirmé.
2. **GEO-022 (boilerplate presse) garde son ordre imposé** : n'y ajouter Qualiopi
   qu'après GEO-021. La lecture devient : **ne pas l'y ajouter du tout** pour l'instant,
   et corriger uniquement « fondé en 2024 » → 2026 + ancrage Grenoble + SIREN.
3. **Le bloc Qualiopi conditionnel de `llms.txt` (l.59-67)** est déjà en do-not-touch
   chez H4 ; il se videra tout seul quand le drapeau retombera. Ne pas le « réparer ».
4. **GEO-027 (logo Qualiopi PNG de 1,27 Mo sur 100 % des pages)** : vérifier d'abord
   si la garde retire le logo quand le drapeau passe à `false`. Si oui, optimiser ce
   PNG est du travail perdu — et le poids disparaît gratuitement. Le lot 6 est
   construit pour rester utile dans les deux cas.

Pourquoi ce fait aggrave le déficit d'existence vérifiable : un moteur de réponse ne
peut pas reprendre à son compte une affirmation qu'il ne peut corroborer nulle part.
F4 mesure d'ailleurs que le critère de tri du moteur testé **est** Qualiopi (GEO-107).
Le site affirme le maximum sans aucune ancre vérifiable, et c'est exactement ce que
`llms.txt` fait aujourd'hui (GEO-109).

**(c) Le pipeline content-gen est à l'arrêt (kill switch OpenAI).** Les patches du
domaine CONTENT n'ont **aucun effet public immédiat** et **aucun risque de régression
en production** tant que le kill switch tient (H4, Limite 4). Ils descendent donc bas
dans l'ordre — sauf ceux qui sont **prérequis du rallumage** (lot 17), qui doivent
être posés **avant** la recharge, pas après.

---

## 1. Vue d'ensemble des lots

| # | Lot | Findings | Sév. | Effort | Impact GEO/AEO | Risque |
|---|---|---|---|---|---|---|
| 1 | Chauffe post-déploiement + vérité des gates | GEO-023, GEO-025, GEO-146 (volet warm) | P0 | S×3, ~1 h | **fort** | faible |
| 2 | Fermer la fenêtre stub avant les moteurs | GEO-024 | P0 | S-M, ~1 h | fort | moyen |
| 3 | Liens internes morts (404 servis) | GEO-013, GEO-012, GEO-080, GEO-060, GEO-016 | P0/P1 | S×5, ~3 h | fort | faible |
| 4 | Canaux d'ingestion IA : ni tokens bruts, ni 404 | GEO-002, GEO-038, GEO-039, GEO-031, GEO-041, GEO-132, GEO-040 (volet tokens) | P0/P1 | S×5 + M, ~6 h | **fort** | faible |
| 5 | Hreflang, canonical, double marque | GEO-005, GEO-138, GEO-057 | P0/P2 | S×3, ~2 h | fort | faible-moyen |
| 6 | Poids mort du rendu (2,7 Mo de PNG) | GEO-028, GEO-125, GEO-027 (conditionnel) | P0 | S×3, ~2 h | moyen-fort | faible |
| 7 | E-E-A-T : les sources d'article | GEO-010, GEO-011, GEO-071, GEO-065, GEO-069, GEO-072, GEO-070 | P0/P1 | M + backfill, ~1,5 j | fort | faible (patch incomplet sans backfill) |
| 8 | Google for Jobs | GEO-051, GEO-049, GEO-050, GEO-137, GEO-004 (STOP) | P0/P1 | S×4 + M, ~4 h | moyen-fort | faible |
| 9 | Galerie : le crawl écrit en base | GEO-035, GEO-036, GEO-033 | P1 | S + M, ~3 h | moyen-fort | faible-moyen |
| 10 | Identité vérifiable (SIREN dans le HTML statique) | GEO-003, GEO-111, GEO-053, GEO-054, GEO-022, puis GEO-109 | P0/P1 | M×2, ~1 j | **fort** | moyen (ADR) |
| 11 | Images déclarées ≠ images rendues | GEO-056, GEO-096, GEO-099, GEO-101, GEO-037 | P1 | S×3 + M, ~5 h | moyen | faible |
| 12 | JSON-LD offre & preuve sociale | GEO-042, GEO-043, GEO-052, GEO-044, GEO-047, GEO-046 | P1 | M×2, ~1 j | moyen-fort | faible-moyen |
| 13 | Maillage in-body & hub KB | GEO-079, GEO-081, GEO-088, GEO-082 | P1 | M, ~6 h | moyen-fort | moyen (TBT à chiffrer) |
| 14 | Metadata éditoriale & aperçus | GEO-058, GEO-059, GEO-142, GEO-143 | P1/P2 | S×3 + M, ~5 h | moyen | faible |
| 15 | Structure du document & a11y | GEO-123, GEO-124, GEO-122 | P1 | S×3, ~2 h | moyen | faible |
| 16 | Ce qui mesure : gates, GSC, Bing, logs | GEO-114, GEO-121, GEO-115 (volet listes), GEO-104, GEO-105, GEO-106, GEO-030, GEO-032, GEO-100, GEO-078, GEO-133, GEO-134, GEO-155 | P1/P2 | M×3, ~1,5 j | moyen (préventif fort) | faible |
| 17 | Content-gen : prérequis du rallumage | GEO-006, GEO-063, GEO-008, GEO-009, GEO-066, GEO-076, GEO-074, GEO-077, GEO-064, GEO-139/140/141 | P0/P1 | L, ~3 j | fort (différé) | faible aujourd'hui |
| 18 | Pipeline image-bank | GEO-089, GEO-092, GEO-091, GEO-090, GEO-093, GEO-094, GEO-095, GEO-015, GEO-098, GEO-102 | P1 | L, ~2,5 j | moyen | moyen (ordre imposé) |
| 19 | Rendu dynamique & caches | GEO-061, GEO-118, GEO-120 | P1 | M×2, ~1 j | moyen | moyen |
| 20 | Sitemaps : hygiène | GEO-130, GEO-131, GEO-145, GEO-147, GEO-136 | P2 | S×4 + S/M, ~3 h | faible | faible |
| 21 | Schémas d'autorité dans le HTML servi | GEO-029 | P1 | M, ~4 h | **fort** | STOP + ADR |
| 22 | pSEO villes : X-Robots-Tag et maillage du hub | GEO-083, GEO-084, GEO-085, GEO-034 | P1 | M×2, ~1 j | moyen-fort | **ÉLEVÉ** + ADR |
| 23 | Poids du document (CSS, payload RSC) | GEO-117, GEO-116, GEO-026 | P1 | L | moyen | **ÉLEVÉ** + ADR |

**Effort total estimé** : ~14 à 17 jours-homme, dont **~2,5 jours pour les lots 1 à 6**
qui portent la majorité du gain immédiat.

**Non couverts par un patch** (constats, reste-Will, incertains) : voir § 5.

---

## 2. Les lots en détail

### LOT 1 — Chauffe post-déploiement + vérité des gates [P0]

> **C'est le lot du soir.** Trois fichiers, aucune ligne de code applicatif, aucun
> risque de rendu. Huit agents indépendants ont prescrit le même patch de deux lignes.

**Findings couverts** : GEO-023 (pages ISR absentes des deux listes du job `warm` —
fusion de A3-P0, A3-P1-1, A3-ADDENDUM, B1-P0 volet A, B6-P0, F3-P1-1, F5-P0-b,
F7-P0-a volet 2, G3-P0 volet 1) · GEO-025 (les deux gates annoncées « bloquantes »
sont en `continue-on-error`, et `size-limit` cible 3 buckets `/reserver` morts) ·
GEO-146 volet warm (`/fr/memo-isere`).

**Fichiers touchés**
- `.github/workflows/deploy-coolify.yml` : `PATHS` (l.747), `FILES` (l.778),
  `STRATEGIC` (l.808).
- `AGENTS.md` (racine du dépôt) : l.17 et l.21.
- `package.json` : l.223 (`_size_limit_doctrine`), l.239-258 (buckets).

**Contenu du patch**
1. Ajouter aux **deux** listes (`PATHS` et `FILES`, qui doivent rester identiques) :
   `/fr`, `/fr/blog`, `/fr/memo-isere`, `/fr/mentions-legales`,
   `/fr/conditions-generales`, `/fr/sites-web-augmentes`, `/fr/audit`,
   `/fr/formations`, `/fr/implementation`. Avec les 5 existantes : **14 URLs**, sous
   le plafond Cloudflare Free de 30 URLs par appel de purge (H4, C-1). Ajouter aussi
   `/fr/sites-web-augmentes` à `STRATEGIC` pour cohérence (H4 : c'est la seule des
   trois listes où elle manque).
   *Option* : les 5 hubs `/fr/blog/categorie/*` (H6 : leur finding « 0 article » était
   un faux positif de cache, mais ils méritent la chauffe) → 19 URLs, toujours sous
   le plafond.
2. `AGENTS.md` : remplacer les deux phrases par l'état réel — « le seul gate bloquant
   est le `lhci` **post-deploy** sur 5 URLs prod ; les gates PR sont en reporting ».
   Corriger aussi l'exception de budget : elle porte sur `/appel`, pas sur `/reserver`
   (le dépôt est déjà juste ; c'est le `AGENTS.md` **global** de `C:\Users\willi` et le
   prompt maître de cet audit qui portent la valeur périmée — H6, C-05).
3. `package.json` : supprimer les **3** buckets `size-limit` `/reserver` (globs qui ne
   matchent plus rien depuis la suppression de la page le 2026-06-26) et créer un
   bucket `/appel` (`.next/static/chunks/app/**/appel/**/page-*.js`). Sans lui,
   l'exception d'AGENTS.md n'a aucun support technique et `/appel` est mesurée à 75 KB
   au lieu des 110 KB promis.

**Impact GEO/AEO attendu — fort.** Aujourd'hui, après **chaque** atterrissage
(plusieurs par jour), la home est resservie sans `AggregateRating` ni bloc avis, et
`/fr/mentions-legales` — la page que Google et les LLM recoupent avec SIRENE pour la
fusion d'entité — affiche « communiqué sur demande » six fois. Fenêtre d'environ 1 h
à l'origine, prolongée à l'edge parce que le warmer chauffe `/fr` **avant** de l'avoir
revalidée : il met en cache la version amputée pour `s-maxage=3600`.

**Risque de régression — faible**, et H4 l'a vérifié plutôt que supposé :
`/api/internal/revalidate` accepte tout chemin commençant par `/`, chaque
`revalidatePath` est dans un `try/catch` silencieux, le rate-limit est de 60/min par IP
pour un seul POST, et les deux steps sortent en 0 si le secret est absent.

**Tests de non-régression à écrire AVANT**
1. Un test Vitest qui parse `deploy-coolify.yml`, extrait `PATHS` et `FILES` et asserte
   qu'ils décrivent **le même ensemble d'URLs** (modulo le préfixe
   `https://axion-ia.com`). La classe de bug « ajouté dans une liste, oublié dans
   l'autre » est littéralement ce que 8 agents viennent de trouver.
2. Un test qui asserte qu'aucun glob `size-limit` de `package.json` ne pointe un
   chemin inexistant (le symptôme « Size Limit can't find files » était vert en CI).

**Do-not-touch** : le `purge_everything` du job `deploy` · l'ordre des steps du job
`warm` (revalidate → purge ciblée → warm → sweep, **déjà correct**, H6 C-17) ·
`concurrency.group: warm-edge-cache` (il protège l'origine CPX42) · la magic string
`stub.invalid` et ses 6 points de propagation · `/fr/roi` (documenté l.745-746 comme
n'ayant **pas** besoin d'être listée — ne pas « corriger » ce commentaire) ·
`/fr/avis`, `/fr/carrieres`, `/fr/presse` (dynamiques via `await searchParams`, les
ajouter serait du bruit) · `.github/workflows/ci.yml:255-262` (bloc
`BUILD_SSG_VILLES_INDEXABLE_ONLY` / ENOSPC) · `package.json:224` (`running:false`,
sinon `size-limit` relance Chrome et SIGTERM Gate B).

**Ce qu'il ne faut PAS faire dans ce lot** : recalibrer le bucket « Shell partagé »
(134,87 kB réels contre 100 kB) **en le repassant bloquant**. Un ratchet mal posé
rouvre un rouge permanent sur toutes les PR (H4). Le recalibrage se fait plus tard,
seuil aligné d'abord, blocage ensuite. Et ne PAS repasser `Lighthouse CI` PR-time en
bloquant tant que le bind loopback CI n'est pas réparé.

---

### LOT 2 — Fermer la fenêtre stub avant les moteurs [P0]

**Finding** : GEO-024 — `lhci`, `indexnow` et `warm` ont **tous les trois**
`needs: deploy` (l.556, l.650, l.716) : ils démarrent en parallèle. Les moteurs sont
donc pingés, et la page mesurée par le seul gate bloquant, **pendant** la fenêtre où
la prod sert encore la version bakée sous stub.

**Fichier touché** : `.github/workflows/deploy-coolify.yml` uniquement.

**Contenu du patch — variante G3, arbitrée par H6 (C-03) contre la variante G1** :
déplacer les deux steps « Revalidate DB-dependent index pages » (l.729-766) et « Purge
CF des pages revalidées » (l.768-799) **à la fin du job `deploy`**, juste après le
`purge_everything` (l.510-530). Deux appels HTTP, quelques secondes de section
critique, et les trois jobs parallèles démarrent alors sur une prod déjà saine.

**Pourquoi pas la variante G1 (`lhci: needs: [deploy, warm]`)** : `warm` n'a pas
`continue-on-error` (l'unique occurrence du workflow est l.902, sur `notify`) et porte
`cancel-in-progress: true` (l.722). Deux merges rapprochés — piège déjà en mémoire —
annulent `warm`, et un `needs` non-success **skippe** le job dépendant : on
désarmerait le seul gate bloquant du pipeline pour corriger une course de cache. Elle
allonge en outre le pipeline de ~8 min et **ne couvre pas `indexnow`**, qui reste le
canal de découverte lui-même.

**Impact — fort.** C'est le patch qui empêche de notifier les moteurs sur une version
amputée, et qui rend enfin honnête la mesure `lhci` post-deploy.

**Risque — moyen** : on modifie la section critique du job de déploiement. Aucun effet
sur le rendu, mais un déploiement qui échouerait sur ces steps échouerait plus tôt.

**Tests à écrire AVANT**
1. Assertion statique sur le YAML : « tout job ayant plus d'un `needs` porte un `if`
   commençant par `always()` » (verrou générique, il protège aussi le futur).
2. Assertion : le job `deploy` contient bien les steps revalidate + purge ciblée
   **après** `purge_everything`, et le job `warm` ne les contient plus.

**Do-not-touch** : le bloc `concurrency` de `warm` · `needs.deploy.result == 'success'`
si la variante G1 est malgré tout retenue (dans ce cas le garde-fou
`if: always() && needs.deploy.result == 'success'` devient **obligatoire**, pas
optionnel) · le job `indexnow` lui-même.

**Note d'ordonnancement** : les lots 1 et 2 touchent le **même fichier**. Si Will veut
les deux, en faire **une seule PR à deux commits** — deux PR concurrentes sur ce YAML
se conflictent à coup sûr. Le lot 1 reste posable seul.

---

### LOT 3 — Liens internes morts (404 servis aux crawlers) [P0/P1]

**Findings** : GEO-013 (silo FAQ : CTA rendus `/fr/fr/*` → 404) · GEO-012 (liens
in-body `/implementations` → 404 sur environ la moitié du corpus blog) · GEO-080 (hub
carrières : 54 liens locale-less) · GEO-060 (`/en/book-a-call` → 301
`/fr/appel-a-call` → 404) · GEO-016 (`acquireLicensePage` → `/fr/cgu` 404 sur les 141
`ImageObject` des pages marketing).

**Fichiers touchés**
- `src/app/[locale]/faq/page.tsx`, `faq/par-thematique/**` : passer les chemins **nus**
  aux `Cta` (`/faq`, `/faq/par-thematique`) ; pour `feed.xml` (pas une route
  next-intl), un `<a>` brut comme celui déjà correct à la l.347.
- `next.config.ts` : règle de redirection `/implementations` → `/implementation`.
- `src/app/[locale]/carrieres/page.tsx:5,377` et `carrieres/[slug]/page.tsx:6,681` :
  `Link` de `@/i18n/navigation` au lieu de `next/link`.
- `src/lib/i18n/en-to-fr-redirect.ts` : `mapEnToFr` — frontière de segment (collision
  de préfixe `book` / `book-a-call`). Une ligne.
- `src/lib/seo.ts:2089` : `acquireLicensePage` → pathname localisé de
  `/fr/conditions-generales` (ou la page hôte, comme le fait déjà la galerie).

**Impact — fort.** Le silo FAQ est la surface de citation LLM n°1 du site (87 fiches) :
ses CTA inter-étages sont en 404. Le corpus blog envoie la moitié de ses liens
« implémentation » dans le vide. Ce sont des signaux de qualité négatifs bruts, et le
meilleur rapport effort/impact de toute la squad C.

**Risque — faible.** Le seul point de vigilance est explicite : **la règle de redirect
ne doit pas capturer `/implantations`** (les 2 157 pages villes).

**Tests à écrire AVANT**
1. Sonde de rendu : aucun `href` émis par les 3 gabarits FAQ ne commence par `/fr/fr`.
2. Étendre `en-to-fr-redirect.test.ts` : `/en/book-a-call` et `/en/book` mappent vers
   deux cibles distinctes, toutes deux en 200.
3. Test de la règle `next.config` : `/implementations` redirige, `/implantations` non.
4. Test unitaire : `acquireLicensePage` pointe une URL qui existe dans `routing.pathnames`.

**Do-not-touch** : `Cta.tsx` lui-même (son comportement est correct partout ailleurs) ·
le `<a>` correct de la l.347 · `careers/freshness.ts` et `datePosted` (décision actée 5)
· la règle `next.config` `/en/book` (utile au re-enable EN) · `image-seo.service.ts`
(la galerie est déjà correcte) · `robots.ts`.

---

### LOT 4 — Canaux d'ingestion IA : ni tokens bruts, ni 404 [P0/P1]

**Findings** : GEO-002 (`llms-full.txt` sert **26 tokens `{{price:…}}` bruts** aux
moteurs IA) · GEO-040 volet tokens (le feed FAQ en sert **70**) · GEO-038
(`/api/markdown/glossaire` et `/api/markdown/centre-aide` annoncés en
`<link rel="alternate">` et répondant 404) · GEO-039 (`/api/markdown/cas-concrets/*`
répond 200 avec un corps vide — pire qu'un 404) · GEO-031 (les deux exports
Observatoire, annoncés « données ouvertes » dans `llms.txt` et déclarés en
`DataDownload`, sont bloqués par `robots.txt`) · GEO-041 (les 507 fiches citables de
la base de connaissances sont absentes du canal `llms.txt`) · GEO-132 (`llms.txt` et
`llms-full.txt` annoncent une publication « hebdomadaire » devenue fausse depuis le
2026-07-20).

**Fichiers touchés** : `src/app/llms-full.txt/route.ts` · `src/app/llms.txt/route.ts` ·
`src/app/api/markdown/[type]/[slug]/route.ts` · `src/app/[locale]/faq/feed.xml/route.ts`
· `src/lib/seo/robots.ts` (`COMMON_ALLOW`) · lecture via `src/lib/knowledge/readers.ts`.

**Contenu**
1. Envelopper question/réponse du `faqBlock` (et par sûreté `caseBlock`) de
   `llms-full.txt` dans `collapsePriceProseDuplicates(resolvePriceTokens(s, "fr"))` —
   même motif qu'`api/markdown/route.ts:221`. `pricing-tokens.ts` est **edge-safe**
   (vérifié par H4 : il n'importe que `@/lib/intl` + `@/content/pricing`) : **aucun
   besoin** de basculer la route en `runtime="nodejs"`.
2. Même résolution sur le feed FAQ. **Livrer le volet « tokens » séparément** des
   volets cap/`pubDate` (un cap fait perdre au flux des items qu'un agrégateur aurait
   déjà indexés) — les volets 2 et 3 vont au lot 14.
3. `/api/markdown` : ajouter `glossaire` à `ALLOWED_TYPES` avec une branche lisant la
   **même source que la page** ; réécrire la branche `centre-aide` sur
   `getHelpArticleBySlug(slug, "fr")` ; corriger `cas-concrets` (corps vide).
4. `COMMON_ALLOW` : ajouter **deux entrées explicites**,
   `/api/observatoire/export-csv` et `/api/observatoire/export-json` — forme étroite
   arbitrée par H4 (C-6) contre la forme large `/api/observatoire/`, qui ouvrirait par
   avance toute route future.
5. `llms.txt` : une ligne statique déclarant la base de connaissances
   (507 faits sourcés) + mention de `sitemap-knowledge.xml` en « Optional ». C'est le
   meilleur rapport effort/impact de la squad D.
6. Retirer ou adoucir le mot « hebdomadaire ».

**Impact — fort.** Ce sont littéralement les fichiers que les moteurs de réponse
lisent. Les prix sont la requête n°1 aux assistants, et le canal les sert
aujourd'hui sous forme de gabarits non résolus.

**Risque — faible** : routes additives. `robots.spec.ts` n'utilise que
`toContain`/`not.toContain`, aucune assertion ne verrouille la longueur de
`COMMON_ALLOW` (H4).

**Tests à écrire AVANT**
1. Test paramétré : « pour chaque type déclaré dans un `<link rel="alternate"
   type="text/markdown">` d'une page, `/api/markdown/<type>/<slug>` répond 200 **avec
   un corps non vide** ». Il ferme les trois défauts d'un coup (GEO-038 + GEO-039).
2. Test : aucune réponse de `/llms.txt`, `/llms-full.txt`, `/fr/faq/feed.xml` ne
   contient la sous-chaîne `{{price:`.
3. Test A1 (excellent, à retenir tel quel) : extraire les URLs `/api/*` du corps de
   `llms.txt` et asserter qu'elles sont toutes couvertes par un `Allow`. Il ferme la
   classe entière « on annonce un canal qu'on interdit ».

**Do-not-touch** : décision actée 4 — **ne PAS** convertir les `|flat` en `|from` (la
prose porte déjà « à partir de ») · `src/content/pricing.ts`, `transversal.ts`,
`no-hardcoded-prices.spec.ts` · les branches `blog`/`actualites`/`faq` existantes ·
le flag `HELP_BACKEND_UNIFIED` de `src/lib/help-articles/reader.ts` (**ne pas
l'activer au passage** — piège classique du « tant qu'on y est ») · l'invariant
`Allow: /api/og` (`robots.spec.ts:88`) · `AI_BOTS_TRAINING_DISALLOWED` /
`AI_BOTS_DISALLOWED` (décision actée 2) · `Disallow: /api/` · l'**absence** de
`Disallow: /en/` (`robots.spec.ts:133` — l'ajouter casserait la purge des URLs EN) ·
`listFaqs()` · la sémantique « N derniers items sans fenêtre » des feeds (fix 2026-07-31)
· les blocs prix SSOT de `llms.txt` · le bloc Qualiopi conditionnel (l.59-67).

**Ce qui n'est PAS dans ce lot** : déclarer les 60 fiches glossaire dans un sitemap.
Patch **éliminé** (H4 D-1) : elles sont `noindex, follow`, les déclarer produirait la
classe d'erreur GSC « exclue par la balise noindex » et dégraderait la confiance dans
le sitemap-index entier, au moment précis où F2 mesure un drainage. Le préalable est
d'écrire le contenu (GEO-127, effort L) → `03-RESTE-WILL`.

---

### LOT 5 — Hreflang, canonical, double marque [P0/P2]

**Findings** : GEO-005 (en-tête HTTP `Link` : hreflang `en` vers des 301 et `x-default`
vers une URL redirigeante, **sur toutes les pages**) · GEO-138 (canonical hérité du
layout : toute page sans `alternates` annonce `canonical = /fr`) · GEO-057 (double
marque dans les `<title>` sur ~290 pages galerie et les fiches FAQ).

**Fichiers touchés** : `src/i18n/routing.ts` (une ligne : `alternateLinks: false` dans
`defineRouting()` — l'API est vérifiée, `alternateLinks?: boolean` est bien une clé de
`RoutingConfig`) · `src/app/[locale]/layout.tsx:148-157` · `galerie/page.tsx`,
`galerie/[slug]/page.tsx`, `BlogListingView`, `not-found.tsx`, `diagnostic/page.tsx`,
`simulateur/page.tsx`.

**Impact — fort pour GEO-005** : on émet aujourd'hui un signal hreflang mensonger sur
100 % des pages, confirmé live hors fenêtre post-deploy (H4, 02:16Z, `cf-cache-status:
HIT`). Le hreflang HTML, lui, est déjà correctement gaté par `isEnLocaleDisabled()`.

**Risque — faible pour GEO-005, moyen pour GEO-138** : retirer `alternates` du layout
fait perdre son canonical à **toute** page qui n'en définit pas. C'est le comportement
voulu, mais il exige l'inventaire préalable et les canonicals explicites de
`/fr/diagnostic` et `/fr/simulateur` **dans le même commit** — sinon on troque un
canonical faux contre un canonical **absent** sur la page qui reçoit le trafic payant.

**Tests à écrire AVANT**
1. Sonde HTTP dans la suite « probe » : **absence** de `hreflang="en"` dans l'en-tête
   `Link`. Aucune garde HTTP n'existe aujourd'hui — c'est exactement pourquoi ce
   défaut a vécu trois mois.
2. Test énumérant les `page.tsx` publics : chacun définit `alternates.canonical` ou
   appelle `buildProductMetadata`.
3. Test : aucun `<title>` rendu ne contient deux fois « Axion-IA ».

**Do-not-touch** : `routing.locales` (garder la toggle EN — AGENTS.md) ·
`localePrefix: "always"` · le bloc 0 EN→FR de `src/proxy.ts:39-55` · les `pathnames`
mappings · `mapEnToFr` · `en-to-fr-redirect.test.ts` · le `metadataBase` du layout
(l.135-138, vital pour résoudre les URLs relatives) · le gate `isEnLocaleDisabled()`
des `languages` · les `metaTitle` DB de la galerie (ne pas les réécrire en masse :
envelopper en `{ absolute: … }`).

---

### LOT 6 — Poids mort du rendu [P0]

**Findings** : GEO-028 (avatar auteur : PNG de **1 513 427 o** affiché en 64 × 64 sur
toutes les pages éditoriales) · GEO-125 (la home mobile télécharge 62 Ko d'image hero
jamais affichée : `hidden lg:block` + `priority`) · GEO-027 (logo Qualiopi : PNG de
**1 304 554 o** servi brut sur 100 % des pages) — **conditionnel, voir § 0(b)**.

**Fichiers touchés** : `AuthorByline.tsx` (brancher `next/image` quand l'URL est
locale, conserver le `<img>` brut sinon) · la page d'accueil, pour **surcharger
`sizes="600px"`** · `public/qualiopi/*` (variante redimensionnée 420 × 280 + `oxipng
-o max --strip safe`, sortie pixel-identique).

**Impact — moyen-fort.** 2,7 Mo de PNG servis sur toutes les pages, c'est une taxe
directe sur le budget de crawl et sur le LCP mobile, et c'est le genre de dépense que
`lhci` desktop sur 5 URLs ne voit pas.

**Risque — faible**, avec deux précisions qui viennent de H3 et H4 :
- **NE PAS patcher `Illustration.tsx`.** Le `sizes` fautif vient de son défaut,
  partagé par tout le site : surcharger depuis la home, pas à la source.
- Logo Qualiopi : **redimensionnement sans recomposition** (charte de marque). Et
  avant de dépenser du temps dessus, vérifier si la garde retire le logo quand
  `QUALIOPI_CERTIFICATION_OBTENUE` passe à `false` — auquel cas le poids disparaît
  gratuitement (§ 0(b)). À signaler à Will, hors périmètre GEO : le fichier porte un
  manifeste C2PA « GPT-4o / trainedAlgorithmicMedia » — information à router vers
  l'audit Qualiopi dédié, pas vers ce plan.

**Tests à écrire AVANT** : un test asserant qu'aucun fichier de `public/` servi sur le
layout global ne dépasse 200 Ko (garde générique, elle empêchera le prochain).

---

### LOT 7 — E-E-A-T : les sources d'article [P0/P1]

**Findings** : GEO-010 (URLs de citation malformées — backtick — servies dans le HTML
**et** dans le `CreativeWork` JSON-LD) · GEO-011 (le JSON-LD affirme une supervision
humaine que le HTML de la même page dément deux lignes plus bas) · GEO-071
(« Dernière vérification : `<date de l'article>` » = affirmation E-E-A-T fausse) ·
GEO-065 (double bloc « Sources » : corps + composant, qui pollue le sommaire,
l'`ItemList` et le compteur de H2 du scorer) · GEO-069 (54 % des liens de citation ont
un intitulé inexploitable) · GEO-072 (la correction automatique des chiffres réfutés
réécrit des articles publiés sans laisser aucune trace publique) · GEO-070 (le monitor
de fraîcheur des liens écrit dans un système de fichiers éphémère → catalogue figé au
2026-05-22).

**Fichiers touchés** : `ArticleSources.tsx:32-40` · `auto-seeded.ts` (catalogue) ·
`passesHardFilters()` · le worker de publication (bloc « supervision humaine ») ·
migration/backfill des lignes `ContentCitation`.

**Le patch est incomplet sans ses deux moitiés** (H4, C-12) : nettoyer `auto-seeded.ts`
ne corrige que les **futures** publications ; les URLs à backtick déjà publiées vivent
dans les lignes `ContentCitation` et continueront d'être servies. Et le filtre de rendu
`/^https?:\/\//.test(...)` ne teste que le **préfixe** : une URL finissant par une
backtick le franchit. Donc : **(a)** backfill DB des citations publiées + **(b)**
durcissement du filtre de rendu avec la regex complète proposée par D6.

**Bonne nouvelle vérifiée par H4** : `ArticleSources` rend depuis `view.citations`
(données persistées par article), sans résolution par `id` dans le catalogue —
supprimer les 122 entrées « 404 » et 29 « deprecated » du catalogue **ne casse aucun
article publié**.

**Risque — faible** sur le rendu, **moyen** sur le backfill (écriture de masse).

**Tests à écrire AVANT** : un test sur `ArticleSources` avec une URL à backtick en
entrée, asserant qu'elle est écartée du rendu ; un test asserant qu'un article ne
contient qu'**un seul** bloc « Sources ».

**Do-not-touch** : `link.id` (clé de diversification) · **ne PAS bumper
`dateModified`** sur correction automatique (H6 : patch éliminé, c'est de la
re-fabrication de fraîcheur — trace publique seulement).

---

### LOT 8 — Google for Jobs [P0/P1]

**Findings** : GEO-051 (`hiringOrganization` auto-référencé et hors graphe sur
`/devenir-commercial-ia` — « le patch le plus sûr du lot B », il corrige au passage une
des 3 occurrences LinkedIn fautives) · GEO-049 (deux `JobPosting` concurrents pour la
même offre, sur deux URLs, 20 communes en intersection) · GEO-050 (~16 offres avec un
`title` non conforme : nom d'entreprise, `(H/F)`, `(full remote)`, > 75 car.) ·
GEO-137 (plafonner l'alerte Telegram à 15 items et chunker `telegram.ts` à 3 900
caractères — échec silencieux aujourd'hui, et le bénéfice porte sur **toutes** les
catégories de notification) · GEO-004 (10 offres hybrides déclarées
`jobLocationType: TELECOMMUTE` en plus du `jobLocation`) — **STOP, voir § 3**.

**Fichiers touchés** : les builders `JobPosting` · `src/app/[locale]/devenir-commercial-ia/**`
· `qualiopi-formation-crons-worker.ts:1155-1166` · `telegram.ts`.

**Risque — faible**, sauf GEO-050 : livrer la variante `jobTitleClean` **avec relecture
humaine**, pas un regex aveugle (réserve H1).

**Do-not-touch** : `datePosted` — jamais de bump automatique (décision actée 5) ·
`validThrough` et `baseSalary` absents = décisions de Will, ne pas re-signaler · le
lieu est **interdit** dans le `title` · `republishJobOfferAction`
(`admin-job-offers/actions.ts:508-555`) est le **seul** geste de fraîcheur légitime.

**Patch éliminé, ne pas le repêcher** : redistribuer les `published_at` des 53 offres
qui partagent le même horodatage. Reculer les dates rend les offres **plus vieilles**
pour Google for Jobs et peut en basculer au-delà du seuil de fraîcheur : remède pire
que le mal (H1 puis H4). Le finding GEO-048 survit, son volet 1 non.

---

### LOT 9 — Galerie : le crawl écrit en base [P1]

**Findings** : GEO-035 (**nouveau, découvert par H6**) — les 288 pages galerie exposent
**2 ancres crawlables** vers `/telecharger`, sans `rel="nofollow"`, sans `Disallow` :
576 URLs qui, à chaque visite, exécutent une transformation Sharp + 2 écritures DB ·
GEO-036 (conséquence : le `lastmod` d'`images-fr.xml` est détruit sur 288 URLs —
7 lignes bumpées en 8 h 20 de nuit, sans production de contenu, sans seed, sans
activité humaine) · GEO-033 (`/galerie` : canonical auto-référente sur n'importe quel
paramètre inventé + variantes 0-résultat indexables = piège à crawl).

**À faire AVANT le patch, 5 secondes, agent autorisé DB** :
`SELECT "userAgent", count(*) FROM image_download_logs WHERE "downloadedAt" > now() - interval '48 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 20;`
Si les UA sont des bots, la démonstration est close.

**Fichiers touchés** : `src/app/[locale]/galerie/[slug]/page.tsx` (les 2 ancres) ·
`galerie/[slug]/telecharger/route.ts:144-149` (`X-Robots-Tag: noindex, nofollow` +
découpler le compteur de la ligne éditoriale : écrire dans `image_download_logs`
seulement, ou une colonne `downloadCountUpdatedAt` séparée) · `src/lib/seo/robots.ts`
(`Disallow: /*/telecharger`) · `galerie/page.tsx` (canonical + facettes).

**Ordre imposé** : ce lot vient **avant** GEO-095 (lot 18). Poser GEO-095 sans cette
précaution fabriquerait une **seconde** source de pollution du `lastmod`, sur la page
elle-même cette fois (H4, D-2).

**Patch éliminé** : basculer le `lastmod` sur `publishedAt ?? createdAt`. Il
masquerait la cause au lieu de la traiter.

**Do-not-touch** : `hashImageBankIp` (`utils/ip-hash.ts`) — le format historique
`salt:ip` conditionne le droit à l'effacement déjà implémenté · l'early-exit
`stub.invalid` de la route (l.84).

**Test à écrire AVANT** : le HTML d'une page galerie ne contient aucune ancre
`/telecharger` dépourvue de `rel="nofollow"` ; `robots.txt` contient le `Disallow`.

---

### LOT 10 — Identité vérifiable [P0/P1, ADR]

**Findings** : GEO-003 (`vatID` et `identifier` SIRET **absents en permanence** du nœud
`#organization` de toutes les pages 100 % statiques, dont les 480 hubs villes
indexables — défaut permanent et site-wide, pas une fenêtre post-deploy : H1 a établi
la corrélation parfaite ISR ⇒ présent / statique ⇒ absent) · GEO-111 (le lien LinkedIn
sitewide du footer et deux `sameAs` divergent du slug déclaré partout ailleurs :
3 occurrences `axion-ia` contre 8 `axion-ia-france`, **servies dans le même HTML**) ·
GEO-053 (`Organization` divergente ré-émise sous le même `@id` sur les 288 pages
galerie — `foundingDate` 2024 **et** 2026 dans le même document) · GEO-054
(`x.com/AxionIA` répond **404** sur 289 pages galerie) · GEO-022 (le boilerplate presse
public annonce « fondé en 2024 » contre le Kbis, et n'ancre ni Grenoble ni le SIREN) ·
puis GEO-109 (`llms.txt` sans siège, sans SIREN, et qui désambiguïse le mauvais
homonyme).

**Fichiers touchés** : `.github/workflows/deploy-coolify.yml` + `Dockerfile`
(`COMPANY_VAT_NUMBER` et `COMPANY_REGISTRATION_NUMBER` en `--build-arg` + `ARG/ENV`
dans le stage builder) · `src/lib/seo.ts:874-875` · `src/lib/brand.ts` (constante
unique pour le slug LinkedIn) · `buildImageDetailGraph` / `buildGalleryHubGraph`
(remplacer le nœud Organization complet par une référence `{ "@id": ORG_ID }`) · le
boilerplate presse.

**Chemin sûr unique, et il est contraint** (H4, C-9 et D-6) :
- **Ne PAS** figer le SIREN en code : `scripts/check-anti-siren.sh` scanne `src/` en
  `.ts/.tsx/.js/.jsx/.mjs` et rougirait. Et **ne pas contourner la garde** en écrivant
  « SIREN 108 018 631 » avec des espaces : la regex passerait, mais c'est un
  contournement de garde, à proscrire explicitement.
- Le build-arg, lui, est **hors périmètre du scan** (workflow + Dockerfile) : c'est la
  branche à prendre.
- **GEO-109 dépend de ce lot** : `llms.txt` et `llms-full.txt` sont `runtime = "edge"`
  et `legal-identity.ts:23` importe Prisma au **niveau module**. Le seul chemin sûr est
  de dériver de `env.COMPANY_*`.

**ADR requis** — point à y écrire noir sur blanc : l'image GHCR est **publique** et un
build-arg reste lisible dans l'historique de l'image. C'est acceptable ici (SIREN et
n° de TVA sont des données publiques du Kbis) mais doit être écrit, sinon un futur
patch y glissera un secret par mimétisme.

**Impact — fort.** C'est la matière première de la fusion d'entité (SIRENE/INPI →
Knowledge Panel) et le socle de tout ce que les moteurs de réponse peuvent corroborer.

**Tests à écrire AVANT** : étendre `identite-legale-registre.spec.ts` d'une garde
« 3c » calquée sur la 3a-bis existante — `vatID` et `identifier` SIRET présents
**sans** variable d'environnement RUN · un test qui `GET /llms.txt` en environnement de
test et asserte la présence du SIREN **résolu** (pas du littéral), plus un cas « env
absente ⇒ le bloc identité est omis, pas rendu avec `undefined` ».

**Do-not-touch** : `SKIP_ENV_VALIDATION`, `BULLMQ_DISABLED`, la magic string
`stub.invalid` et ses 6 points de propagation, `Dockerfile.coolify-pull` (un-liner),
`src/lib/prisma.ts`, `src/lib/redis.ts` · la garde 3a-bis (adresse sans env, elle est
correcte) · `check-anti-siren.sh` lui-même · les blocs prix SSOT de `llms.txt`
(décision 4) · le bloc Qualiopi conditionnel (l.59-67) · les graphies `sameAs`
LinkedIn/X existantes tant que GEO-045 n'est pas arbitré · `image-seo.service.ts`.

**Hors de ce lot** : GEO-045 (`sameAs` de l'Organization) est un STOP & ASK avec un
**ordre imposé** — corriger d'abord les fiches tierces qui ancrent l'entité à Paris
(GEO-112, reste-Will), **puis** les déclarer. Déclarer une fiche encore « Paris »
reviendrait à signer soi-même l'erreur d'entité qu'on veut supprimer.

---

### LOT 11 — Images déclarées ≠ images rendues [P1]

**Findings** : GEO-056 (9 images déclarées en JSON-LD et au sitemap ne sont plus
affichées — `/roi` ×4, `/formations/entreprise` ×5 — et l'image `representativeOfPage`
n'est pas rendue du tout) · GEO-096 (5 pages éditoriales au sitemap images sans graph
`ImageObject` ni `primaryImageOfPage`, dont 3 des 15 pages stratégiques) · GEO-099
(sitemaps images villes : l'image déclarée n'est pas celle rendue — 6/6 premiers
`<image:loc>` identiques, bannière générique partagée) · GEO-101 (les 129
`<image:loc>` du sitemap blog pointent tous `images.unsplash.com` : la valeur
d'indexation image du corpus éditorial est cédée à un hôte tiers) · GEO-037
(`<image:license>` CC BY 4.0 déclarée **inconditionnellement** sur des photos
Unsplash — P1 juridique autant que GEO).

**Fichiers touchés** : les builders de sitemaps images (services, villes, blog) ·
`buildPageImageGraphJsonLd` / `buildPrimaryImageOfPage` sur 5 pages (motif déjà câblé
sur 30 autres — copier `/fr/comparaisons` sur `/fr/audit`).

**Option retenue pour GEO-101** : émettre l'URL servie **par le domaine**
(`${SITE_URL}/_next/image?url=…&w=1200&q=75`) — crawlable (`Allow: /_next/image` en
place), sur le domaine, et identique à ce que le DOM affiche. Le ré-hébergement des
102 fichiers sous `public/images/blog/**` est l'option durable (effort L) : à
arbitrer, pas à faire dans ce lot.

**Risque — faible** (métadonnées et balisage, ~1 Ko de HTML par page).

**Do-not-touch** : ne pas re-rendre les images sur `/roi` (la coupe tunnel est une
décision produit, #594) · ne pas toucher le bloc `ofPublic` Qualiopi · ne pas dupliquer
l'alt court du DOM (aligner d'abord le manifeste, cf. lot 18).

---

### LOT 12 — JSON-LD offre & preuve sociale [P1]

**Findings** : GEO-042 (`AggregateOffer` des hubs ville incohérent et partiellement
faux : `lowPrice` 1190 alors que 2 offres valent 990, `highPrice` qui ne borne rien,
coaching dirigeant au prix collaborateur, naming « Audit IA Flash » aboli — 5/5
sous-points vérifiés) · GEO-043 (aucun prix machine-readable sur les 4 fiches audit ni
sur `/tarifs`) · GEO-052 (étoiles SERP structurellement inaccessibles :
`AggregateRating` uniquement sur `Organization`, self-serving, et sur 5 facettes sans
autorité — `/fr/audit` porte 7 blocs `ld+json` et **zéro** `aggregateRating`) ·
GEO-044 (`BlogPosting.description` vide sur **126** articles : `excerpt` n'est jamais
écrit par le worker de publication) · GEO-047 (nœud `Person` « Manon » DB-dépendant :
`author @id` orphelin sur 1 500+ fiches servies depuis le rendu de build) · GEO-046
(citations locales NAP : module 100 % inerte, 0/10 annuaires, jamais injecté dans aucun
JSON-LD, alors que 8 profils existent réellement).

**Fichiers touchés** : `src/lib/seo.ts` (builders offre + rating) · le worker de
publication (`excerpt`) · `src/lib/seo/local-citations.ts` +
`src/lib/seo/__tests__/local-citations.spec.ts`.

**Piège vérifié par H4 (C-7)** : `local-citations.spec.ts:36-46` verrouille **en dur**
`expect(cov.listed).toBe(0)`. Le patch rend ce test rouge. F6 le dit, B1 ne le dit
pas : poser le patch sans amender la spec **dans le même commit** produit une CI rouge
sans cause apparente. Le bon test de remplacement est une assertion de **cohérence**
(« toute entrée avec `listingUrl` non nul compte dans `listed`, et réciproquement »),
pas une valeur figée — le verrou actuel interdit le progrès qu'il était censé protéger.

**Condition d'exécution pour GEO-052** : valider au Rich Results Test sur **une** page
avant de généraliser.

**Do-not-touch** : décision actée 4 — `AggregateOffer.lowPrice` reste un **nombre
brut**, les prix restent « à partir de » via `isFromPrice`/`formatTierPrice`, et
`priceSpecification.minPrice` est la traduction machine correcte · ne pas réordonner
`UN_A_UN_TIERS` · le pattern Service Area Business de `buildLocalBusinessJsonLd` (pas
de faux bureau par ville, décision 2026-05-23) · le regex `^Q\d+$` de validation
Wikidata · le Proxy de `src/lib/prisma.ts` (ADR 0026).

---

### LOT 13 — Maillage in-body & hub KB [P1]

**Findings** : GEO-079 (tous les liens internes injectés in-body sont locale-less → un
301 par lien sur tout le corpus ; 22/23 articles échantillonnés en portent au moins un)
· GEO-081 (chaînes de redirection à **2 sauts** dans les corps persistés : `/reserver`
et `/interventions/*`) · GEO-088 (hub `/connaissances` orphelin : **48** fiches liées
sur **507**) · GEO-082 (l'historique de slugs KB est écrit pour tous les types mais
consommé par `/guides` seul : un rename ailleurs = 404 sec).

**Fichiers touchés** : `src/app/[locale]/blog/[slug]/page.tsx` (+ pages sœurs
actualites/guides) pour la réécriture au rendu ·
`src/server/content-gen/generators/v7-phase8-generators.ts:136-137` et
`v7-phase8-shared.ts:210,382` (routes actuelles dans les prompts) · le hub
`/connaissances` (pagination ou sous-hubs, lien Footer, lien « Toutes les
connaissances » au pied de `RelatedKnowledge`).

**Option retenue pour GEO-079** : post-process **au rendu** (couvre tout le stock
persisté, zéro backfill, un seul point de code) plutôt qu'à l'injection (ne couvre que
le futur). Le rewrite doit ignorer les ancres `#`, `mailto:`, les URLs absolues, et ne
jamais double-préfixer.

**Risque — moyen** : c'est le seul patch de ce lot qui s'exécute à chaque rendu.
**Ordre imposé** : la réécriture au rendu doit être **chiffrée en TBT** avant merge
(budget CLS = 0 strict, INP ≤ 100 ms) — et comme aucune gate ne le verrait, la mesure
est manuelle.

**Do-not-touch** : `anchor-safe-link.ts` (garde anti-imbrication, saine) · les règles
308 de `next.config.ts` (des liens entrants externes en dépendent) · `publicEntryFilter`
· le budget Web Vitals du hub `/connaissances` (paginer plutôt qu'allonger la liste).

**À trancher par SQL avant de chiffrer GEO-082** :
`SELECT "oldType", count(*) FROM "KnowledgeSlugHistory" GROUP BY 1`.

---

### LOT 14 — Metadata éditoriale & aperçus [P1/P2]

**Findings** : GEO-058 (aucune image OG générée n'est cachée par le CDN : ~2 s de rendu
Satori à l'origine **à chaque** fetch, `cf-cache-status: DYNAMIC`, reproduit deux fois)
· GEO-059 (`og:image` des articles = Unsplash `w=1080`, sous le plancher Discover, avec
`width`/`height` déclarés 1200×630 — faux) · GEO-142 (`article:published_time` /
`modified_time` / `author` / `section` / `tag` absents des **126** articles de blog,
alors qu'ils sont présents sur `/actualites/`) · GEO-143 (aucune date d'article n'est
balisée `<time datetime>`) · GEO-040 volets 2-3 (cap et `pubDate` du feed FAQ, séparés
du volet tokens du lot 4).

**Risque — faible.** Réserve pour GEO-058 : borner le remplissage de cache par `title`
arbitraire (sinon on offre un générateur d'images gratuit).

**Do-not-touch** : ne pas recalculer les dates pour GEO-142 — réutiliser celles du
JSON-LD (le signal porteur reste `datePublished`/`dateModified`).

---

### LOT 15 — Structure du document & a11y [P1]

**Findings** : GEO-123 (deux `<main>` — en réalité **7 imbriqués** — sur ~291 pages
publiques : le contenu principal n'est plus identifiable) · GEO-124 (outline de titres
cassé, `h1 → h3`, sur des hubs stratégiques) · GEO-122 (`aria-label` plus court que le
texte visible : WCAG 2.5.3 niveau A échoué sur la home et toute la famille villes).

**Fichiers touchés** : les 3 fichiers publics portant un `<main>` interne →
`<div>` / `<section aria-labelledby>` · `Footer.tsx:325` → `h2`, `:331` → `h3` ·
`cas-concrets/page.tsx:286` et `comparaisons/page.tsx:209` → `h2` ·
`ServicesGrid.tsx` : `aria-labelledby` pointant le titre visible plutôt qu'un
`aria-label` tronqué.

**Risque — faible, aucun changement visuel** (les tailles sont imposées par les
classes, pas par les balises). Le bon patron existe déjà dans 3 gabarits.

**Test à écrire AVANT** : garde statique (test unitaire ou règle ESLint maison)
« aucun `<main>` hors du layout ». Elle explique aussi **pourquoi** la garde axe
existante ne rougit pas sur GEO-122 : la règle WCAG 2.5.3 y est expérimentale.

**Do-not-touch** : le `<main id="main">` du layout comme unique repère (cible du lien
d'évitement, `SkipToContent.tsx:9`).

---

### LOT 16 — Ce qui mesure : gates, GSC, Bing, logs [P1/P2]

**Findings** : GEO-114 (le seul gate bloquant mesure 5 URLs, desktop seul, **sans
assertion INP**) · GEO-121 (aucune gate ne mesure le mobile : les 2 projets Playwright
mobile existent et ne sont exécutés nulle part) · GEO-115 volet listes (les deux pages
les plus lourdes du site ne sont dans aucune gate, et l'audit `dom-size` qui les aurait
détectées est désactivé) · GEO-104 (chaîne de soumission GSC morte : token OAuth
`readonly`, 6 derniers runs planifiés = 6 échecs) · GEO-105 (IndexNow n'atteint que
Yandex ; le client Bing WMT existe mais n'a **aucun appelant** et sa fonction de
soumission n'est même pas écrite — effort **M**, pas S) · GEO-106 (Bing :
observabilité zéro) · GEO-030 (monitoring d'indexation inexistant : HCU-monitor est un
stub, `gscInspectUrl` n'a aucun appelant) · GEO-032 (les CSV « crawl-stats » ne
contiennent pas de crawl stats : le gate « crawl budget < 30 % » n'a jamais été mesuré)
· GEO-100 (`type: "image"` n'est demandé nulle part : tout le pilotage GSC est aveugle
aux images) · GEO-078 (le tracking GSC ne couvre que les Articles blog/news) ·
GEO-133 (bouton admin « Ping IndexNow » structurellement mort) · GEO-134 (communiqués
de presse : aucune notification aux moteurs à la publication) · GEO-155 (créer un
capteur d'UA — pas « brancher » : `sendDefaultPii: false` fait que le SDK n'attache
pas les en-têtes, la prémisse initiale était probablement fausse).

**Précautions de livraison**
- GEO-121 : livrer la passe mobile en **WARN** pendant 2-3 déploiements pour établir
  la ligne de base, sinon blocage immédiat des déploiements.
- GEO-032 : renommer script + workflow + glob **dans le même commit**, et prévenir que
  F2 et F3 ont raisonné sur ces fichiers.
- GEO-078 : réutiliser la constante des 15 pages du budget Web Vitals.

**Do-not-touch** : ne PAS relâcher `sendDefaultPii: false` ; `piiScrubBeforeSend*` et
`SEGMENTS_SECRETS` · ne pas réduire la cascade d'`indexnow.ts` · ne pas re-diagnostiquer
la clé IndexNow (décision actée 11, audit du 2026-08-11) · utiliser `@/lib/indexnow` et
**pas** le helper content-gen (isolation-check) · la cause racine côté Microsoft est un
reste-Will déjà acté (ticket UCM000007450870) — ne pas la re-lister.

---

### LOT 17 — Content-gen : prérequis du rallumage [P0/P1, différé]

> À poser **avant** la recharge OpenAI, pas après. Aucun effet public tant que le kill
> switch tient — donc aucun risque de régression en production aujourd'hui, et aucune
> urgence calendaire autre que : ne pas rallumer sans.

**Findings** : GEO-006 (le sampler `(slotIndex + seed) % total` avec des poids
fractionnaires retourne **toujours** la première clé → 100 % `informational` au
rallumage — le finding le plus solide de la squad D) · GEO-063 (plancher de cadence à
96 jobs/jour : `dailyArticles` est décoratif sous 96, mesuré ×4,8 la cible ; a
contribué à l'épuisement du quota) · GEO-008 (40 % du corpus indexé est sous le
plancher de longueur de ses propres générateurs : les tranches d'expansion sont perdues
en silence) · GEO-009 (26 % du corpus indexé publie une statistique propriétaire
fabriquée ou un cas client anonyme — le plus grave du lot D) · GEO-066 (la doctrine
« block » ne bloque rien : seuls SIREN/SIRET/RCS sont des hard-faults) · GEO-076 (le
kill switch OpenAI gèle aussi le sync GSC — gratuit —, l'élagage tier-lifecycle, le
cycle de vie news et le détecteur d'opportunités : **une cause commune, un seul patch
de découplage**) · GEO-074 (la banque de 1 835 mots-clés n'a jamais alimenté une seule
génération) · GEO-077 (détecteur d'opportunités structurellement inerte) · GEO-064 (les
guides pilier n'ont ni sommaire ni `HowTo` : l'extracteur attend du markdown, le
générateur écrit du HTML) · GEO-139/140/141 (observabilité : bandeau « depuis 4 h »
codé en dur, pas de rétroaction échec → cadence, cadence pilotée sur les jobs créés).

**Ordres imposés**
- GEO-009 : tester **à blanc** sur les 129 articles avant activation.
- GEO-066 : livrer **avec** GEO-009, ou pas du tout.
- GEO-076 : ajouter au patch la correction du commentaire périmé
  `content-publish-worker.ts:615-617` (« creds GSC absents du worker ») — c'est la
  source documentaire d'un finding faux (D7-P1-2), et sans correction le prochain
  auditeur le retrouvera.
- **GEO-075 : GELÉ** (§ 0(b)). Ne pas débannir le token « Qualiopi ».

**Do-not-touch** : `judge-outcome.ts` · les seuils `judge_thresholds` en base · ne pas
re-lister le kill switch lui-même (décision actée 10).

**À trancher par SQL avant de chiffrer** : GEO-149 (`SELECT slug FROM articles WHERE
"sourceGeneratorId" = 'qa_derived' LIMIT 3;` puis curl), GEO-152 (état effectif de
`banned_phrases` en prod — **en tension directe avec GEO-066**, exiger la mesure avant
toute bascule de severity), GEO-150 et GEO-151 (balayage des 129 exports markdown non
rejoué).

---

### LOT 18 — Pipeline image-bank [P1]

**Findings** : GEO-089 (le seed écrase `alt`/`title`/`caption` par une dérivation
mécanique du slug, et l'enrichissement ne les régénère jamais) · GEO-092 (dimensions et
poids de la base sont **fictifs**, devinés depuis le suffixe du slug ; `fileSize = 0`
partout) · GEO-091 (`withMetadata({orientation:1})` **conserve** l'EXIF, GPS compris,
alors que le commentaire RGPD affirme l'inverse) · GEO-090 (zéro EXIF/XMP/IPTC :
`embedCopyrightMetadata()` n'a aucun appelant) · GEO-093 (75 `thumbnailUrl` en 404) ·
GEO-094 (chaîne d'upload admin cassée de bout en bout, 3 valeurs par défaut divergentes
pour `IMAGE_BANK_STORAGE_PATH`, absente d'`env.ts`) · GEO-095 (`trackUsage()` n'est
appelée nulle part) · GEO-015 (prix mort « 490 € » gravé dans un `<title>` indexable et
2 légendes — root-cause corrigée : le prix est **injecté dans le prompt système**,
`scripts/enrich-images.cjs:41`, il n'est pas lu dans l'image) · GEO-098 (héros Unsplash
hors-sujet et `alt` en **anglais**, ce qui contredit frontalement la décision actée 1 —
et c'est précisément ce qui renforce le finding) · GEO-102 (deux visuels affichent
« Axion-IA.com », graphie LinkedIn, et l'un porte la faute « RECOMMANDATIONS
CONCRÉTÉS »).

**Ordres imposés (non négociables)**
1. **GEO-092 avant GEO-091** : `autoOrient()` change les dimensions de sortie des
   photos pivotées ; posé avant la lecture des dimensions réelles, il **aggrave** les
   dimensions fausses déjà en base.
2. **Lot 9 avant GEO-095** : sinon `trackUsage` fabrique la pollution de `lastmod`
   qu'on vient de corriger.
3. **Ne pas relancer l'enrichissement avant le patch de seed** (GEO-089), sous peine de
   tout reperdre au seed suivant. Le seed se déclenche sur `workflow_run` du workflow
   de déploiement : **un seed cassé dégrade 288 pages galerie à chaque mise en prod**,
   sans aucune gate pour le voir.
4. **Ne pas ajouter `image-bank:isolation-check` à la CI** avant d'avoir soldé les
   18 violations existantes : le check bloquerait **toutes** les PR (H4, C-15). C'est
   une contrainte dure, pas une note de bas de page.

**Volume à trancher par SQL avant patch** (H6, C-21) :
`SELECT count(*) FROM image_assets a JOIN image_asset_translations t ON t."imageId" = a.id WHERE t."languageCode" = 'fr' AND t.title LIKE 'Axion-IA — %';`
E1 titre sur 133 images, chiffre son impact sur 288, et H3 trouve 12/12 titres
mécaniques sur son échantillon. Question ouverte à joindre au ticket : **pourquoi le
`workflow_run` du seed ne se déclenche-t-il jamais** (24 runs, tous en mai 2026) ?

**Test à écrire AVANT** : assertion statique sur `seed-images.cjs` — les champs `alt`,
`title` et `caption` figurent dans le bloc `create` et **pas** dans le bloc `update` de
l'upsert.

**Do-not-touch** : le contrat CJS pur d'`enrich-images.cjs`
(`require('/app/prisma/generated/client')`, `--max-old-space-size=96` — le container
est slim) · les `slug` de traduction (URLs déjà indexées) · `keepMetadata()` (il
rétablirait le GPS — enjeu RGPD) · le champ `orientation` (n'accepte que
`landscape|portrait|square`) · le chemin **Server Action** de l'upload, déjà correct
(ne pas réécrire ce qui existe) · `scripts/content-gen/isolation-check.ts` (jumeau
vert, référence de forme).

**Patch éliminé** : « retoucher l'affiche » pour le prix 490 € — la root-cause est le
prompt système, pas l'image.

---

### LOT 19 — Rendu dynamique & caches [P1]

**Findings** : GEO-061 (11 URLs publiques stratégiques rendues dynamiquement —
`private, no-store`, `cf BYPASS`, 3 `Set-Cookie` — malgré leur `revalidate` ; le
correctif de l'audit GSC du 2026-07-31 a été appliqué à `/blog` et `/cas-concrets`
puis jamais propagé) · GEO-118 (les ~480 hubs villes ne régénèrent jamais : le bloc
« contenus IA à {ville} » est structurellement absent) · GEO-120 (aucune mutation de
contenu ne purge l'edge : `revalidatePath` n'invalide que l'origine — une seule
occurrence de `purge_cache` dans tout `src/`).

**Corrections de périmètre apportées par H3** : `/fr/galerie` est à 60 s et `/fr/appel`
à 900 s (normal) ; **retirer `/fr/recherche`** de la liste des 11.

**Contenu** : helper partagé `revalidateAndPurge(paths)` dans `src/server/cache/`
(revalidatePath + POST CF, gaté sur `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID`, no-op
propre si absents), branché sur `/api/internal/revalidate` — ce qui couvre d'un coup le
worker de publication et le job `warm`. **Borner à 30 URLs par publication** (quota CF
Free).

**Pour GEO-118, ne PAS baisser `revalidate` à 3600** : cela multiplierait par 24 les
rendus origine sur 480 pages pour un contenu quasi figé. L'option (a) — étendre la
liste `PATHS` du warm aux hubs villes « chauds » — est la moins risquée. Amplitude à
trancher : compter `Article.mentionedCities` avant de chiffrer le gain.

---

### LOT 20 — Sitemaps : hygiène [P2]

**Findings** : GEO-130 (`/fr/demande-devis/confirmation` est `noindex` **et** déclarée
dans `pages.xml` — 1 URL sur 86) · GEO-131 (`/fr/ressources` n'est déclaré dans aucun
sitemap alors qu'il est indexable ; **effort corrigé S → S/M** : la clé n'existe pas
dans `routing.pathnames`, le patch touche le routage i18n) · GEO-145
(`/fr/equipe/manon` — la page cible du `@id` `Person` de tout le JSON-LD éditorial —
n'est déclarée dans aucun sitemap, contrairement à `/fr/equipe/williams`) · GEO-147
(`guides.xml` : sub-sitemap redondant à 1 URL, `lastmod` figé au 2026-06-08 pour
toujours — option retenue : retirer l'id `guides` de `generateSitemaps()`) · GEO-136
(`dateModified` du JSON-LD et `lastmod` du sitemap lisent deux colonnes `@updatedAt`
différentes — préférer la voie « colonne `contentReviewedAt` dédiée » : aligner
bêtement peut faire **reculer** une date affichée).

**Do-not-touch** : ne PAS lever `isSlugTemplate` sur `/equipe/[slug]` · le gating
anti-vide de l'index et la doctrine « l'index ne doit JAMAIS 500 »
(`sitemap-index.xml/route.ts:241-247`) · `buildExcludeSlugsByType`.

**Latent, à surveiller sans patcher** : GEO-148 (`faq.xml` reste sur la convention
metadata bakée sous stub — perte actuelle = 0 URL ; risque au moment d'une promotion).

---

### LOT 21 — Schémas d'autorité dans le HTML servi [P1, STOP + ADR]

**Finding** : GEO-029 — les schémas d'autorité (`FAQPage`, `QAPage`, `ItemList`,
`Place`, `AggregateOffer`) sont émis en `afterInteractive` et **absents du HTML
servi**. Portée corrigée : **480 pages déclarées**, pas ~4 300.

**Pourquoi ce lot est seul** : il touche 31 fichiers / 54 appels d'un composant
partagé, et il exige un ADR par contrat AGENTS.md.

**Ce que H4 change dans l'instruction de l'ADR** — et c'est le point important :
l'hypothèse de travail doit être **« TBT neutre à améliorant »**, pas « TBT
dégradant ». `JsonLd.tsx:39-47` rend un `next/script` quand `strategy !== "inline"` :
le JSON **transite déjà** dans le document, sérialisé dans le flux RSC comme prop d'un
composant client. Repasser en `inline` **déplace** les octets du payload vers le HTML
au lieu de les ajouter, et **retire** une frontière de composant client et son
hydratation. Les « −300 ms TBT » inscrits en commentaire dans le code sont des
estimations d'époque, jamais re-mesurées. Sans cette correction, Will arbitrerait sur
un risque fantôme.

**Mesure manuelle obligatoire** avant/après sur 3 pages pilotes (1 ville indexable,
1 secteur, 1 fiche centre-aide) : `lhci` n'a pas d'assertion INP et `size-limit` est en
`continue-on-error` — une dégradation réelle passerait inaperçue.

**Test à écrire AVANT — c'est le verrou manquant** : un test de rendu SSR
(`renderToStaticMarkup` sur un gabarit ville indexable) asserant la présence d'au moins
un `<script type="application/ld+json">` contenant `"@type":"FAQPage"` **dans le
HTML**. Son absence explique pourquoi cette régression a vécu invisible jusqu'à cet
audit.

**Do-not-touch** : `JsonLd.tsx` et `JsonLdGraph.tsx` eux-mêmes (contrat partagé par
31 fichiers) · `Plausible.tsx` et `Clarity.tsx` — leurs `afterInteractive`
(`layout.tsx:317-327`) ne sont **pas** du JSON-LD, ne pas les toucher par balayage
automatique · la dé-duplication FAQPage documentée en commentaire
(`[ville]/page.tsx:906-908`) · les **1 677 pages villes noindex**, qui doivent garder
`afterInteractive` (inliner du JSON-LD sur une page noindex ne rapporte rien et coûte
du poids).

---

### LOT 22 — pSEO villes : X-Robots-Tag et maillage du hub [P1, RISQUE ÉLEVÉ + ADR]

**Findings** : GEO-083 (`X-Robots-Tag` absent sur `/formations/par-ville/*` et
`/un-a-un/par-ville/*` — et le test verrouille une route qui n'existe plus) · GEO-084
(65 % des meta-descriptions des villes indexées partagent leurs 80 premiers caractères
— Google réécrit les descriptions dupliquées) · GEO-085 (H1 identique sur les 2 157
pages villes, sans mot-clé de service, avec `data-speakable-hero` posé sur une question
rhétorique) · GEO-034 (le hub `/fr/implantations` pèse **8 792 194 o** et émet 2 157
liens dont ~1 677 vers des pages `noindex`).

**Pourquoi RISQUE ÉLEVÉ** (H4, D-4) : `seo-noindex-routes.ts` est consommé par
`proxy.ts:336`, **middleware Edge sans try/catch**. Ajouter `formations` à
`SERVICE_PATH_TO_KEY` sans étendre `INDEXABLE_SERVICE_VILLE_SLUGS` lève un `TypeError`
sur **chaque** requête `/fr/formations/par-ville/*` → 500 sur toute la famille. Et
mapper vers une clé existante applique le jeu de villes d'un **autre** service, soit un
faux positif `noindex` sur des pages indexables — cas que le fichier lui-même qualifie
de « CRITIQUE » (l.158).

**Tests à écrire AVANT (bloquants, pas optionnels)**
1. Assertion de complétude : « toute clé de `SERVICE_PATH_TO_KEY` possède une entrée
   dans `INDEXABLE_SERVICE_VILLE_SLUGS` ».
2. Un cas par nouveau service : aucune ville indexable de CE service ne reçoit le
   header.
3. Supprimer ou corriger l'assertion `interventions/par-ville` devenue fictive
   (`seo-noindex-routes.test.ts:91`).

**Do-not-touch** : `ALL_SERVICE_VILLE_SLUGS` (40 métropoles) ·
`src/generated/indexable-villes.ts` — **fichier généré, jamais édité à la main** : le
set des 455 slugs doit être **généré** · la sémantique « faux négatif OK / faux positif
interdit » · le tiering lui-même (décision pSEO).

**Ordres imposés** : GEO-034 est à co-signer avec D4 (il change la profondeur de crawl
de tout l'îlot pSEO) · GEO-085 exige une vérification **CLS** avant merge (budget CLS =
0 strict) · corriger au passage le commentaire `implantations/[region]/[ville]/page.tsx:524`
qui dit « 58 villes » alors qu'il y en a **59** (source de l'erreur d'E3).

**Deux volets de ce domaine sont des arbitrages, pas des patches** : GEO-014 (ouvrir ou
refermer les 455 pages) et GEO-086 (retirer 95 villes de l'index) → § 3.

---

### LOT 23 — Poids du document [P1, RISQUE ÉLEVÉ + ADR]

**Findings** : GEO-117 (le HTML brut transporte ~920 Ko de CSS **dupliqués 4 fois** —
52 % du document sur `/fr`, jusqu'à 81 % sur les pages légères — avec fuite des
utilitaires admin dans la feuille publique) · GEO-116 (~90 % du poids de chaque
document est de la charge non-contenu : payload RSC + CSS inlinée — taxe directe sur le
budget de crawl) · GEO-026 (First Load JS ≈ 240 KB gz sur 100 % des routes, ×3,2 le
budget, chunk de route de 0,8 à 3 KB : tout le dépassement est dans le socle partagé).

**Pourquoi ce lot est le dernier** : le patch évident (`@source not` sur
`(admin)`/`components/admin`) a une **panne silencieuse**. `src/app/admin.css` ne
contient **aucun** `@import "tailwindcss"` : `globals.css:1` est la seule invocation
Tailwind du projet, et elle génère 100 % des utilitaires de la console admin. Le
`@source not` les supprimerait. Aucun test visuel admin, aucune gate CSS, et
`size-limit` — qui verrait la feuille maigrir — est en `continue-on-error` : **la panne
se découvrirait en ouvrant la console, c'est-à-dire par Will, après coup.**

**Chemin sûr** : ne pas exclure ; donner à `admin.css` sa **propre** invocation
Tailwind scopée, ou n'accepter le `@source not` qu'après un **diff exhaustif des
sélecteurs générés** avant/après.

**GEO-116 (`inlineCss: false`) contredit frontalement la décision Sprint 24bis** (gain
FCP/LCP documenté) : STOP & ASK, et ne pas commencer par là.

**Test à écrire AVANT** : un script qui extrait la liste des sélecteurs du CSS buildé
et asserte qu'**aucun** sélecteur contenant `admin` ne disparaît entre avant et après.

**Do-not-touch** : `src/app/admin.css` (ADR 0028) · le `@theme` de `globals.css` ·
`lighthouserc.json`.

---

## 3. (a) Patches nécessitant un ARBITRAGE WILL — STOP & ASK

Chaque ligne : la **question précise** à trancher, et les options réelles. Aucune n'est
tranchable par un agent.

**A1 — GEO-029, schémas d'autorité en `inline` (lot 21).**
*Question* : autorise-t-on `strategy="inline"` sur les pages **indexables** (480 villes
+ hubs + fiches), au prix d'un ADR budgets ?
*Options* : (A) inline sur les indexables seulement, avec mesure manuelle avant/après
sur 3 pages pilotes — **recommandé** ; (B) statu quo, en assumant que 5 familles de
schémas d'autorité restent invisibles des moteurs ; (C) inline partout, y compris les
1 677 pages noindex — à écarter (coût sans gain).
*Élément neuf pour décider* : l'hypothèse « TBT dégradant » est fausse (H4, § lot 21).

**A2 — GEO-014, les 455 pages `/sites-web-augmentes/par-ville`.**
*Question* : ces 455 pages sont `index, follow`, riches, et déclarées dans **aucun**
sitemap ni lien interne. On ouvre ou on referme ?
*Options* : (A) ouvrir — les déclarer au sitemap **avec** maillage depuis les hubs
régionaux (contredit la décision du 2026-06-20 inscrite en code,
`sitemap.ts:401-412`) ; (B) refermer — les passer en `noindex` comme leurs 4 familles
sœurs. Binaire, il n'y a pas de troisième voie cohérente : aujourd'hui elles sont
indexables **et** indécouvrables.

**A3 — GEO-086, les 95 villes indexées sous le seuil de qualité.**
*Question* : 95 des 480 pages villes indexées portent un défaut qualité **auto-déclaré**
(`Quality score` < 75), jamais remédié. On rétracte, on remédie, ou on assume ?
*Options* : (A) les sortir du sitemap **sans toucher aux `<meta>`** — option par
défaut recommandée ; (B) les passer `noindex` — casse l'invariant « monotone
croissant » (`villes/index.ts:224-227`) et rétracte 95 URLs déjà connues de Google ;
(C) remédier le contenu (effort L).

**A4 — GEO-045, `sameAs` de l'Organization.**
*Question* : quelles fiches tierces déclare-t-on, et dans quel ordre ?
*Contrainte dure* : les 2 fiches les plus visibles (Les Pépites Tech, LinkedIn) ancrent
l'entité à **PARIS** (138 Champs-Élysées, 75008) et écorchent le nom du fondateur
(GEO-112). Les déclarer avant de les corriger revient à **signer soi-même** l'erreur
d'entité qu'on veut supprimer. *Ordre imposé* : GEO-111 (constante unique `brand.ts`)
→ correction des fiches par Will (reste-Will, cf. `03-RESTE-WILL.md`) → **puis** un
patch `sameAs` **unique** (quatre agents éditent les mêmes 6 lignes de `seo.ts:906-911`
— quatre PR = conflit garanti).

**A5 — GEO-021, Qualiopi.**
**Ne pas rouvrir : l'action corrective est déjà actée par Will** et relève de l'audit
Qualiopi dédié du 2026-08-15. La seule question qui reste **côté GEO**, à trancher
conjointement avec cet audit : une fois le drapeau retombé, que fait-on des URLs qui
portaient la revendication (`/fr/certification-qualiopi` et les 116 occurrences de la
home) — 200 réécrites, ou retrait de l'index ? Les quatre conséquences d'ordonnancement
sont au § 0(b) ; la plus coûteuse si on l'oublie est **GEO-075**.

**A6 — GEO-001 volet 3, auto-deploy Coolify.**
*Question* : coupe-t-on l'auto-deploy côté Coolify, pour qu'un redémarrage de conteneur
hors pipeline ne puisse plus laisser la prod sans purge, sans revalidate et sans
chauffe ?
*Contrainte* : la mémoire avertit déjà qu'un changement côté UI Coolify
(`dockerfile_location`) re-sature le disque du CPX42. Touche la plateforme, pas le
code. L'événement du 18:49:06 qui a motivé le finding reste `[À CONFIRMER]` ; le
**mécanisme**, lui, est confirmé.

**A7 — GEO-116 / GEO-117, poids du document (lot 23).**
*Question* : bascule-t-on `inlineCss: false` (contredit le Sprint 24bis, gain FCP/LCP
documenté) et accepte-t-on de toucher à la génération Tailwind ?
*Options* : (A) ne rien faire tant que la console admin n'a pas sa propre invocation
Tailwind — **recommandé** ; (B) `@source not` après diff exhaustif des sélecteurs ;
(C) `inlineCss: false` avec ADR et mesure FCP/LCP avant/après.

**A8 — GEO-119, Cache Rules Cloudflare sur les `.xml`.**
*Question* : 100 % console CF, zéro fichier. Quel réglage ?
*Options* : (A) **Edge TTL explicite de 600 s** sur `*.xml` — recommandé par H4 : même
effet de fraîcheur, borne de charge connue ; (B) « Respect origin » : sur 38
sub-sitemaps dont plusieurs `force-dynamic` lisant la DB, cela multiplie par ~6 les
rendus origine sur le CPX42 à chaque passage de crawler, et **personne n'a chiffré ce
coût**.
*Do-not-touch* : ne pas remonter `max-age` dans le code pour compenser.

**A9 — GEO-067, multi-judge avant auto-publication.**
*Question* de **calendrier** uniquement : le patch introduit une dépendance OpenAI dans
le chemin de publication, au moment où le kill switch est à zéro. Posé maintenant sans
fail-soft, il **bloquerait toute publication** au redémarrage.
*Réponse par défaut* : après la recharge, avec fail-soft **non négociable**.

**A10 — GEO-007, le tier d'indexation écrasé en dur.**
*Question* : `content-publish-worker.ts:618` écrit `const indexationTier =
"tier_1_indexable"` sans jamais lire le `promoteToTier1` calculé en amont — donc le
garde-fou soft-404 n'interdit rien. Rétablit-on le gate ?
*Contexte* : le patch **renverse une décision de Will du 2026-06-17**. La lecture de H2
tient : le trou réel est que **la jambe d'élagage prévue par cette même décision n'a
jamais tourné** (cause : GEO-076, le kill switch).
*Options* : (A) faire tourner l'élagage (découplage du kill switch, lot 17) et laisser
la décision intacte — recommandé ; (B) rétablir le gate au publish et renverser la
décision.

**A11 — GEO-004, les 10 offres « 100 % télétravail ».**
*Question factuelle* : ces 10 offres hybrides sont-elles réellement full remote ? Si
non, `jobLocationType: TELECOMMUTE` doit sauter — mais le choix est commenté dans le
code et un test le verrouille : les deux doivent être réécrits dans le même commit.

**A12 — GEO-097, garanties de résultat incrustées dans des visuels publiés.**
*Question éditoriale* : « GAINS MESURABLES ASSURÉS », « 100 % GAGNANT » sont incrustés
dans des visuels en ligne, ce qui **contredit la décision actée 8** (CGV = obligation
de moyens ; les garanties de résultat ont été purgées du texte). Refait-on les visuels
(59 héros concernés) ou les retire-t-on ?
*Note* : c'est aussi le seul finding de l'audit qui porte un risque juridique direct.

**A13 — GEO-135, formations par-ville « sur devis ».**
*Question* : deux décisions de Will à deux jours d'écart n'ont jamais été réconciliées —
les formations par-ville annoncent « sur devis » alors que les prix sont publics
partout ailleurs. B2 a raison de documenter sans trancher.

**A14 — GEO-146, `/fr/memo-isere`.**
*Question* : indexable, absente de `pages.xml`, sans lien entrant. Deux lectures
également défendables : `noindex` assumé (landing de campagne) ou déclaration au
sitemap. Le volet « chauffe » (lot 1) est indépendant et se pose dans les deux cas.

**A15 — GEO-042 annexe, `Offer.price` sur un tier `isFromPrice`.**
*Question* : émettre un `Offer.price` ferme sur un tier dont le prix est « à partir de »
crée une promesse machine que la page ne fait pas. Décision 4 impose « à partir de » ;
`priceSpecification.minPrice` est la traduction machine correcte. À confirmer.

**A16 — GEO-115 / GEO-034, paginer `/fr/implantations`.**
*Question* : le hub pèse 8,8 Mo et émet 2 157 liens dont 78 % vers des `noindex`. Le
paginer allège massivement, mais **change la découvrabilité** de tout l'îlot pSEO. À
arbitrer avec A2 et A3, pas isolément.

---

## 4. (b) Patches à RISQUE ÉLEVÉ — pas un octet sans ADR

Ces sept patches partagent une propriété : **ils peuvent casser une surface entière
sans qu'aucune gate ne rougisse.** C'est ce qui justifie l'ADR, plus que leur taille.

| # | Patch | Ce qui casse, et pourquoi personne ne le verrait |
|---|---|---|
| R1 | GEO-083 — `X-Robots-Tag` sur `formations`/`un-a-un` par-ville (lot 22) | `seo-noindex-routes.ts` est consommé par `proxy.ts:336`, **middleware Edge sans try/catch**. Une clé manquante ⇒ `TypeError` ⇒ **500 sur toute la famille d'URLs**. Le set des 455 slugs doit être **généré**, jamais saisi. |
| R2 | GEO-117 — `@source not` Tailwind (lot 23) | `admin.css` n'a **aucun** `@import "tailwindcss"` : l'exclusion supprime 100 % des utilitaires de la console admin. Aucun test visuel admin, aucune gate CSS, `size-limit` en `continue-on-error`. **La panne se découvre en ouvrant la console.** |
| R3 | GEO-109 — SIREN dans `llms.txt` (lot 10) | Les 2 routes sont `runtime = "edge"` et `legal-identity.ts:23` importe Prisma au niveau module ⇒ casse la compilation edge. Et écrire le numéro en dur rougit `check-anti-siren.sh`. Seul chemin sûr : `env.COMPANY_*` ⇒ **dépend de GEO-003**. |
| R4 | GEO-003 — identifiants légaux en build-args (lot 10) | Touche le chemin de déploiement. L'examen de H4 est **favorable** (hors périmètre du scan anti-SIREN, sans rapport avec le contrat `stub.invalid`), mais l'ADR doit acter que **l'image GHCR est publique**. |
| R5 | GEO-024 variante G1 (lot 2, écartée) | `lhci: needs: [deploy, warm]` **skippe silencieusement le seul gate bloquant** dès que `warm` est annulé — cas fréquent sur deux merges rapprochés. Si Will la préfère malgré tout, `if: always() && needs.deploy.result == 'success'` devient **obligatoire**. |
| R6 | GEO-095 — appeler `trackUsage()` (lot 18) | Fabriquerait la pollution de `lastmod` que le lot 9 vient de corriger, sur la page galerie cette fois. **Ordre imposé** : lot 9 d'abord, et vérifier que `trackUsage` n'écrit **que** dans `image_usage_logs`. |
| R7 | `image-bank:isolation-check` en CI (lot 18) | Ajouté avant d'avoir soldé les 18 violations existantes, il **bloque toutes les PR**. Contrainte d'ordonnancement dure. |

**Deux fausses sécurités à ne jamais oublier en lisant ce tableau** : `size-limit` ne
rougit pas, et `lhci` n'a pas d'assertion INP. Tout patch qui alourdit le bundle ou
dégrade l'interactivité passera vert.

---

## 5. Ce qui n'a PAS de patch dans ce plan

**Constats sans patch code** (ils alimentent `00-VERDICT-FINAL.md` et `02-SCORING.md`) :
GEO-017 (drainage : position 22,2 → 25,5, clics ÷1,5, CTR ÷2,7 en deux semaines, et
pire sur cohorte stable) · GEO-018 (top 10 sur 119 pages, mais sur des requêtes sans
demande : 26 pages en top 3 → 60 impressions → 2 clics) · GEO-019 (`/fr/audit`, le
service phare, à 1 impression/semaine pendant que 117 pages villes en captent 481) ·
GEO-020 (requête de marque : 9 liens, 0 sur le domaine) · GEO-103 (Google corrige
« axion-ia » en « action ia ») · GEO-107 et GEO-108 (les listicles tiers et l'homonyme
Axion Formations captent la place). **Réserve de portée** : un seul moteur de réponse a
été interrogé (F4, re-tiré par H3).

**Reste-Will purs** (→ `03-RESTE-WILL.md`, nouveautés seulement) : GEO-110 (le profil
LinkedIn contredit le registre sur trois attributs, et compte 7 abonnés) · GEO-112 (les
2 fiches tierces ancrent l'entité à Paris) · GEO-055 (aucun téléphone public, aucun
Google Business Profile — réserve : le siège est une domiciliation en centre
d'affaires, risque de refus GBP) · Wikidata (item à créer, puis
`WIKIDATA_QNUMBER_AXIONIA` en env RUN) · GEO-144 (`/qr/podcast` répond 404 : créer le
`QrLink` en console **avant** toute nouvelle impression du flyer) · GEO-127 (écrire les
~60 × 60 mots du glossaire) · GEO-119 (console Cloudflare) · GEO-062 (la checklist des
60 items SEO/AEO n'est gardée par rien : préférer la vérité de documentation, **ne pas**
ajouter un 3ᵉ gate décoratif).

**Incertains, à trancher par une requête avant tout patch** : GEO-148, GEO-149,
GEO-150, GEO-151, GEO-152, GEO-153, GEO-154, GEO-155 — plus les trois volumétries
laissées ouvertes (GEO-089 : 133 ou 288 images ; GEO-082 : `KnowledgeSlugHistory` ;
GEO-035/036 : attribution des bumps aux bots).

---

## 6. Rappel : ce qui a été éliminé et ne doit pas revenir

**8 findings éliminés** (H6) : flux Google News éteint (A3-P1-3) et fraîcheur des
2 feeds (A5-P1-2) — conséquences d'un reste-Will acté ; la root-cause `trackUsage()` du
`lastmod` (A4-P1-1) — réfutée, remplacée par GEO-035 ; « 3 des 5 hubs catégorie blog
listent 0 article » (C4-P1-3) — **faux positif de cache**, le backfill SQL prescrit
aurait été un UPDATE de masse sur une donnée saine ; « machine à contenu à l'arrêt »
(D1-P0-1) ; « élagage inopérant faute de creds GSC » (D7-P1-2) — les vars sont présentes
dans le worker, l'erreur venait d'un commentaire de code périmé ; « fraîcheur actualités
gelée » (D7-P1-3) ; volet guides de F1-P1-4 — les guides **sont** dans
`sitemap-blog.xml` (3 slugs, mesurés deux fois).

**8 patches retirés dont le finding survit** : `lastmod` sur `publishedAt ?? createdAt`
· redistribuer les `published_at` des offres · déclarer 60 URLs `noindex` du glossaire
au sitemap · backfill `categoryId` · poser les vars GSC sur le worker · bumper
`dateModified` sur correction automatique · « vérifier l'ordre des steps du warm »
(l'ordre est déjà correct) · `lhci: needs: [deploy, warm]`.

**8 items de checklist écartés comme faux besoins 2026** : `geo.region`,
`geo.placename`, `geo.position`, `ICBM` (le signal moderne équivalent,
`GeoCoordinates`, existe déjà — `seo.ts:1457`, `:1511`) · `meta author` / `publisher` /
`copyright` · `dns-prefetch images.unsplash.com` (les images transitent par
l'optimiseur same-origin). À retenir quand même : `search-intent-validator.ts:78`
**nomme** ces balises dans son message d'erreur alors que le champ testé ne regarde
jamais le HTML — **le libellé ment, pas le code**.

---

## 7. Chemin critique recommandé

```
Ce soir        LOT 1  (warm + gates)            → puis LOT 2 dans la même PR si Will veut
Semaine 1      LOT 3  (404 internes)
               LOT 4  (canaux d'ingestion IA)
               LOT 5  (hreflang / canonical)
               LOT 6  (poids mort du rendu)
Semaine 2      LOT 10 (identité, ADR) ─────────→ débloque GEO-109
               LOT 9  (galerie) ───────────────→ débloque GEO-095 (lot 18)
               LOT 7  (E-E-A-T) · LOT 8 (jobs)
Semaine 3+     LOT 11, 12, 13, 14, 15, 16
Sur décision   LOT 21 (ADR inline) · LOT 22 (ADR pSEO) · LOT 23 (ADR poids)
Avant recharge LOT 17 (content-gen) — GEO-006 est un prérequis, GEO-075 reste GELÉ
```

**Trois dépendances à ne pas inverser** : lot 9 avant GEO-095 · GEO-092 avant GEO-091 ·
GEO-003 avant GEO-109. **Une correction de fiches avant un patch** : GEO-112 avant
GEO-045.

---

## 8. Limites de ce plan

1. **Je n'ai pas rouvert les 40 rapports intégralement.** J'ai travaillé sur la liste
   canonique de H6 et l'analyse de risque de H4, et je ne suis descendu dans les
   rapports d'origine (A3, A5, B1, C1, C4, D5, E2, G1, G3, G4) que pour récupérer des
   **chemins de fichiers**. Les lots 11 à 23 citent donc moins de `fichier:ligne` que
   les lots 1 à 10 : c'est délibéré et proportionné, pas un oubli.
2. **Aucun effort n'est mesuré.** Les S/M/L viennent des agents ; les conversions en
   heures sont mes estimations et doivent être lues comme des ordres de grandeur.
3. **Aucune commande n'a été exécutée** : ni build, ni test, ni Lighthouse, ni requête
   DB. Toutes les affirmations « ce test rougirait » sont des lectures de fichiers de
   test faites par H4, jamais des exécutions.
4. **Les volumétries `[À CONFIRMER]`** (78 dimensions fausses, 75 vignettes 404, ~30
   fiches FAQ à double marque, les taux de corpus de D2 et D4) sont reprises telles
   quelles, au statut que leur auteur leur a donné. Elles peuvent faire bouger l'effort
   des lots 18 et 22, pas leur ordre.
5. **Le fait Qualiopi n'a pas été re-vérifié par moi** : il m'est transmis comme établi
   par l'audit dédié du 2026-08-15, et je l'ai uniquement croisé avec GEO-021, GEO-075,
   GEO-022, GEO-027 et GEO-107, qui sont eux confirmés dans cet audit-ci.
