# D6 — E-E-A-T & citations

**Date de rédaction** : 2026-08-15, mesures live entre **01:53 UTC et 02:12 UTC**
(hors fenêtre post-deploy : derniers atterrissages 2026-08-14 14:57 / 18:26 / ~19:50 UTC).

**Périmètre réellement couvert**

- Catalogue de liens externes : `src/data/external-links/**` (11 fichiers, 742 entrées
  `url:`, 736 entrées parsées id+url+title+organization) + `verification-status.json`
- Injection : `src/server/content-gen/links/external-links-injector.ts`,
  `src/data/external-links/helpers.ts` (`selectExternalLinks`, `passesHardFilters`,
  `detectHallucinations`, `buildExternalLinksPromptSection`)
- Trust tier : `src/server/content-gen/links/trust-tier.ts`
- Persistance citations : `src/server/content-gen/links/persist-citations.ts`,
  `backfill-citations.ts`, appel depuis `content-publish-worker.ts:876-932`
- Rendu public : `src/components/content-gen/ArticleSources.tsx`,
  `blog/[slug]/page.tsx`, `guides/[slug]/page.tsx`, `actualites/[slug]/page.tsx`,
  `src/server/content-gen/blog/loader.ts`
- Fact-check : `src/server/content-gen/fact-check/claims-extractor.ts`,
  `src/server/queue/workers/content-fact-check-worker.ts`
- Provenance : `src/server/content-gen/provenance/provenance-logger.ts`
- Fraîcheur du catalogue : `src/server/queue/workers/external-links-monitor-worker.ts`
- Bylines Person : `src/app/[locale]/equipe/[slug]/page.tsx`,
  `src/lib/seo-content-gen-factories.ts`, `src/lib/seo/williams-person.ts`
- Pages E-E-A-T publiques : `/fr/charte-editoriale`, `/fr/transparence`,
  `/fr/corrections`, `/fr/methodologie`, `/fr/equipe/{williams,manon}`
- Live : 9 articles blog échantillonnés, 6 pages E-E-A-T, `sitemap-index.xml`,
  `sitemap/pages.xml`

**Hors périmètre (autres agents)** : sitemaps eux-mêmes (A2/A3), `dateModified` global
et refresh (D7), avis/AggregateRating (B6), JSON-LD `afterInteractive` (constat
transverse déjà acté, non re-diagnostiqué ici).

---

## Résumé exécutif

La chaîne de citation existe de bout en bout (catalogue → sélection → détection
anti-hallucination → `ContentCitation` → bloc « Sources & méthodologie » + `isBasedOn`)
et elle FONCTIONNE : le bloc s'affiche sur 9/9 articles échantillonnés. Le problème
n'est pas l'architecture, c'est la **qualité de la matière première** et **deux
affirmations fausses publiées à grande échelle**.

1. **Le bug backtick du 2026-07-20 n'est PAS corrigé** : 171 URLs du catalogue portent
   encore un backtick parasite, dont **20 passent tous les filtres durs** et sont donc
   injectables. Vérifié live : `/fr/blog/audit-ia-venissieux-comprendre-optimiser` affiche
   deux fois `https://www.francecompetences.fr/recherche/rncp/\`` — dans la prose ET dans
   le bloc Sources, avec l'URL brute comme texte d'ancre.
2. **Le JSON-LD de chaque article affirme une supervision humaine qui n'existe pas.**
   `AI_DISCLAIMER_FR` (`seo-content-gen-factories.ts:141`) dit « supervisé par l'équipe
   Axion-IA avant publication » alors que le bandeau visible de la même page dit
   « contrôlé automatiquement ». La purge du 2026-07-26 a raté le JSON-LD.
3. **Seuls 152 des 328 liens éligibles (46 %) ont un intitulé exploitable** : 160 ont une
   URL brute en guise de titre, 33 ont du markdown `**…**` non nettoyé, 299 ont un
   `organization` de la forme `SAINT-ETIENNE` / `VITRY94` qui devient le `publisher` du
   JSON-LD `isBasedOn`. Mesuré en prod : 14 libellés de source sur 39 sont des URLs brutes.
4. **La fraîcheur du catalogue est structurellement morte** : le monitor mensuel écrit
   `verification-status.json` dans le FS éphémère du conteneur ; 740/742 entrées datent
   toujours du 2026-05-22 (85 jours), 220 liens 404 et 166 deprecated ne sont jamais purgés.

Verdict de la surface : **rouge sur la fiabilité affichée, vert sur la plomberie**.
2 P0, 5 P1, 8 P2.

---

## Findings

### [P0] URLs de citation malformées (backtick) toujours publiées — bug 2026-07-20 non résolu

**Symptôme** — Des liens de citation sortent avec un backtick parasite collé à l'URL, et
l'ancre visible est l'URL brute (backtick compris). Le lecteur voit
`https://www.francecompetences.fr/recherche/rncp/\`` en plein corps d'article.

**Preuve code**

- `src/data/external-links/auto-seeded-vertical.ts:215-216` :
  `url: "https://www.francecompetences.fr/recherche/rncp/38587/\`"` **et**
  `title:` identique (le backtick est dans les deux champs).
- 111 occurrences dans `auto-seeded-vertical.ts`, 60 dans `auto-seeded.ts`
  (motif `^\s+url: "https?://[^"]*\``), soit **171 / 742 URLs = 23 % du catalogue**.
- Origine : `src/scripts/seed-external-links-vertical-deep.ts:571` sérialise directement
  la sortie LLM ; le prompt (`:65`) demande un format `"1. [Titre] - URL"` et le modèle a
  rendu certaines URLs entre backticks markdown → le parseur a gardé le backtick fermant.
- Aucun garde-fou : `validateLink()` (`helpers.ts:139-162`) accepte l'URL car
  `new URL()` tolère un backtick dans le path ; et `validateLink()` n'est de toute façon
  **pas appelé** sur les entrées seedées (uniquement « avant ajout manuel admin »).
- `passesHardFilters()` (`helpers.ts:23-37`) ne filtre que sur `status` : les 20 URLs
  backtickées dont le serveur distant répond 200 sur le suffixe `%60` sont donc éligibles.

**Quantification** (scan statique du catalogue croisé avec `verification-status.json`) :

| Statut vérif. des 171 URLs backtickées | Nombre |
| --- | --- |
| `404` (donc filtrées) | 122 |
| `deprecated` (donc filtrées) | 29 |
| **`active` → INJECTABLES** | **20** |

Les 20 injectables : `auto-natfr-2-151` à `-160` (DARES), `auto-vert-audits-1-216`
(digital-strategy.ec.europa.eu), `auto-topic-ai-research-283/285/286` (Stanford HAI),
`v3-formation-cpf-044` (francecompetences RNCP), `v3-formation-cpf-047`
(travail-emploi.gouv.fr), `v3-audit-anssi-091` (cert.ssi.gouv.fr),
`v3-interventions-microsoft-copilot-142`, `v3-interventions-bpi-france-num-154/155`.

**Preuve live** (2026-08-15 01:58–02:00 UTC)

```
GET https://axion-ia.com/fr/blog/audit-ia-venissieux-comprendre-optimiser
→ <a href="https://www.francecompetences.fr/recherche/rncp/`" rel="nofollow noopener noreferrer">https://www.francecompetences.fr/recherche/rncp/`
→ <a href="https://www.francecompetences.fr/recherche/rncp/`" target="_blank" rel="nofollow noopener noreferrer" class="group border-border …">
```

Soit **2 occurrences** : une dans la prose, une dans le bloc « Sources & méthodologie ».
Balayage de 9 articles : **1 article sur 9 (11 %)** porte un href malformé
(02:12 UTC, `grep -c 'href="https://[^"]*[^-a-zA-Z0-9_./:?=&#%~+,;@$()]"'`).

Test de l'URL de destination (2026-08-15 02:02 UTC) :
`curl -L https://www.francecompetences.fr/recherche/rncp/%60` → **200**. C'est un
catch-all côté France Compétences (soft-404) : c'est exactement pour ça que le vérifieur
HEAD l'a classée `active` et que le filtre dur ne l'attrape pas.

**Root-cause** — Le seeder n'a jamais nettoyé les délimiteurs markdown de la sortie LLM,
et aucune validation syntaxique d'URL n'est appliquée aux entrées auto-seedées. Le
filtre `status` est un filet à mailles trop larges parce qu'il fait confiance au code
HTTP de la destination.

**Patch prescrit**

1. **Nettoyage du catalogue** (le seul patch strictement nécessaire pour arrêter
   l'hémorragie) : retirer les backticks de fin dans `url` et `title` des 171 entrées de
   `auto-seeded.ts` + `auto-seeded-vertical.ts`. Pour les 122 déjà `404` et 29
   `deprecated`, préférer la suppression pure des entrées (elles ne servent plus).
2. **Garde-fou permanent** dans `helpers.ts` — ajouter au début de `passesHardFilters()` :
   ```ts
   if (!/^https:\/\/[^\s"'`<>]+$/.test(link.url)) return false;
   ```
   Une garde ne vaut que si elle rougit : la coupler à un test Vitest qui itère
   `ALL_EXTERNAL_LINKS` et échoue si une seule URL contient un caractère hors
   `[-A-Za-z0-9_.~:/?#\[\]@!$&'()*+,;=%]`.
3. **Assainissement des articles déjà publiés** : rejouer `backfill-citations.ts` après
   le nettoyage du catalogue (il repart de `detectHallucinations().valid` et
   `persistArticleCitations` fait un `deleteMany` par article → idempotent). ⚠️ le corps
   HTML des articles, lui, garde le backtick : prévoir un `UPDATE` ciblé
   `ArticleTranslation.body` (remplacement littéral des 20 URLs backtickées par leur
   version propre) — pas de régénération LLM.

**Effort** : M (1 script de nettoyage + 1 garde + 1 test + 1 backfill).
**Impact GEO/AEO** : **fort**. Une URL de citation qui ne résout pas correctement est
inexploitable par un LLM qui suit ses sources ; et une ancre visible « https://…rncp/\` »
est un signal de négligence éditoriale directement lisible par un évaluateur qualité.

**Risque de régression** : faible. Le nettoyage est purement textuel. Attention à
`verification-status.json` : les IDs y sont référencés — si on **supprime** des entrées,
supprimer aussi les clés correspondantes (sinon override orphelin, sans effet mais
trompeur).
**Do-not-touch** : `src/data/external-links/master.ts` (ordre d'agrégation),
`src/scripts/verify-external-links-head.ts` (produit le JSON), la signature de
`passesHardFilters` (utilisée par `getExternalLinksStats`).

---

### [P0] Le JSON-LD de chaque article affirme une supervision humaine inexistante — et contredit le bandeau visible de la même page

**Symptôme** — Deux déclarations de transparence IA coexistent sur une même page
d'article et disent l'inverse l'une de l'autre. Celle qui est machine-readable (JSON-LD,
donc celle que les moteurs génératifs ingèrent) est la fausse.

**Preuve code**

- `src/lib/seo-content-gen-factories.ts:140-141` :
  ```
  const AI_DISCLAIMER_FR =
    "Contenu éditorial rédigé avec assistance d'IA générative (OpenAI / Anthropic / Perplexity) et supervisé par l'équipe Axion-IA avant publication. Voir /equipe/manon pour la transparence IA complète (AI Act EU art. 50).";
  ```
  Injecté en `disambiguatingDescription` sur **tous** les Article / BlogPosting /
  TechArticle / NewsArticle (`:210`) et sur les autres gabarits (`:357`).
- `src/lib/seo-content-gen-factories.ts:74` — même promesse sur la Person Manon :
  « contenus IA-assistés **supervisés par l'équipe Axion-IA** (AI Act EU art. 50) ».
- Version corrigée, visible, au même endroit :
  `src/components/marketing/AiContentDisclaimer.tsx:55` — « …puis **contrôlé
  automatiquement** avant publication (vérification factuelle et contrôle éditorial) ».
- Preuve que la contradiction est connue et que la purge a été incomplète :
  `src/app/[locale]/equipe/[slug]/page.tsx:128-132` documente explicitement la
  campagne du 2026-07-26 (« ce repli promettait que les contenus "sont supervisés par
  l'équipe", alors que le worker publie automatiquement tous les types de contenu sans
  relecture humaine. Même correction que sur le bandeau IA, /fr/transparence et la charte
  éditoriale ») — **`seo-content-gen-factories.ts` n'était pas dans la liste**.
- Le worker publie bien sans relecture : `content-publish-worker.ts` insère l'article puis
  enchaîne les post-traitements (`:876-932`, `:965-990`) sans aucun point d'arrêt humain.

**Preuve live** (2026-08-15 02:07 UTC) — sur
`/fr/blog/audit-ia-venissieux-comprendre-optimiser`, les deux chaînes sont présentes dans
la même réponse :

```
… IA générative (OpenAI GPT-4o), puis contrôlé automatiquement avant publication …
… IA générative (OpenAI / Anthropic / Perplexity) et supervisé par l'équipe Axion-IA avant publication …
… "Manon — portrait synthétique généré par IA, plume éditoriale fict…
… généré par IA, contenus IA-assistés supervisés par l'équipe Axion-IA (AI Act EU art. 50)","aiGenerated":true,"additionalType":"htt…
```

Cohérence croisée : `/fr/transparence` (02:04 UTC) porte bien la version corrigée
(« la relecture humaine intervient sur les contenus sensibles et à la demande, mais elle
n'est pas systématique ») — la contradiction est donc bien localisée dans le JSON-LD.

**Root-cause** — Balayage textuel incomplet le 2026-07-26 : la campagne a corrigé les
composants de rendu et les pages statiques mais pas les constantes de la factory JSON-LD.
Piège maison connu (« balayer par regex multi-surfaces ») non appliqué ici.

**Patch prescrit** — Aligner les deux constantes sur la réalité, en gardant la même
longueur d'ordre de grandeur (elles servent de `disambiguatingDescription`) :

```ts
const AI_DISCLAIMER_FR =
  "Contenu éditorial rédigé par IA générative (OpenAI / Perplexity), puis contrôlé automatiquement avant publication (vérification factuelle, gates qualité). La relecture humaine n'est pas systématique. Voir /equipe/manon pour la transparence IA complète (AI Act EU art. 50).";
```

et, ligne 74 : « Portrait généré par IA. Contenus produits par IA générative et contrôlés
automatiquement avant publication (AI Act EU art. 50). »

⚠️ Vérifier au passage la mention « Anthropic » : `provider-router.ts:118` fixe
`text: [openaiProvider]` et le commentaire `:103-117` acte que le fallback Anthropic a été
**retiré** (décision Will 2026-07-09, « NE PAS remettre `anthropicProvider` ici »). La
liste `OpenAI / Anthropic / Perplexity` est donc elle aussi périmée pour la rédaction.
`/fr/transparence` mentionne encore Anthropic, Claude et Mistral — à recaler dans le même
passage (mais c'est un point de conformité, pas de GEO).

**Effort** : S (2 constantes + recalage `/fr/transparence`).
**Impact GEO/AEO** : **fort**. C'est la seule affirmation E-E-A-T du site que l'on peut
qualifier de fausse, elle est dans le champ le plus lu par les crawlers AEO, et elle est
auto-contredite sur la même page — configuration idéale pour une pénalité de confiance.

**Risque de régression** : très faible. Vérifier qu'aucun test ne verrouille la chaîne
exacte (`src/lib/__tests__/seo-content-gen-factories.spec.ts`,
`src/lib/seo-content-gen-factories.test.ts`).
**Do-not-touch** : `aiGenerated: true`, `additionalType: AIGeneratedContent`,
`usageInfo`, `creator @id` — ces champs sont corrects et attendus par l'AI Act art. 50.

---

### [P1] 54 % des liens éligibles ont un intitulé inexploitable (URL brute ou markdown) → ancres et `isBasedOn` dégradés

**Symptôme** — Le bloc « Sources & méthodologie » et les ancres du corps affichent des
URLs brutes de 90+ caractères, ou du markdown non rendu (`**Le fil d'actualités FC**`),
au lieu d'un intitulé de source.

**Preuve code**

- `auto-seeded-vertical.ts:21-22` et `:64-65` (et 452 autres entrées) : `title` est une
  **copie littérale de `url`** — le seeder n'a pas extrait de titre.
- `helpers.ts:262` : `buildExternalLinksPromptSection` envoie au LLM
  `- **${l.title}** (${l.organization}) — ${l.url}` : quand `title === url`, le modèle
  n'a aucun intitulé à reprendre et recopie l'URL en ancre.
- `persist-citations.ts:108` / `:118` : `title: link.title` → `ExternalReference.title`
  hérite de l'URL brute.
- `persist-citations.ts:130` : `extractAnchorText(bodyHtml, link.url) ?? link.title` →
  fallback sur l'URL.
- `blog/loader.ts:233-236` : `name: c.externalReference.title` → c'est ce `name` que rend
  `ArticleSources.tsx:72` et qui alimente `isBasedOn`
  (`blog/[slug]/page.tsx:383`, `:366`).
- `ArticleSources.tsx:37-39` ne filtre que sur « URL http(s) valide » et « libellé non
  vide » : une URL brute comme libellé passe la garde.

**Quantification** (scan statique, 736 entrées parsées, 328 éligibles) :

| Catégorie | Total catalogue | Parmi les 328 éligibles |
| --- | --- | --- |
| `title` identique à `url` | 454 | **160** |
| `title` contenant du markdown `**` | — | **33** |
| `url` contenant un backtick | 171 | 20 |
| **Entrées « propres »** (titre ≠ URL, sans markdown, sans backtick) | — | **152 / 328 (46 %)** |

Exemples de fuite markdown éligibles : `auto-region-ile-de-france-052`
(`"**Institut Paris Region (observatoire régional aménagement, économie, innovation)**"`),
`auto-natfr-7-197` (`"**Le fil d'actualités FC**"`), `v3-impl-langchain-208`
(`"https://python.langchain.com/docs/tutorials/rag/**"` — markdown **et** URL-titre).

**Preuve live** (2026-08-15 01:55–02:05 UTC) — libellés du bloc Sources sur 9 articles :
**39 entrées, dont 14 URLs brutes (36 %) et 2 markdown littéral (5 %)**.

| Article (`/fr/blog/…`) | Entrées | URL brute | Markdown |
| --- | --- | --- | --- |
| mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble | 6 | 0 | 0 |
| audit-ia-venissieux-comprendre-optimiser | 4 | 2 | 0 |
| cabinet-audit-ia-grenoble-faq | 6 | 0 | 0 |
| formation-ia-gif-sur-yvette | 4 | 3 | 1 (`**Recherche RNCP "Intelligence artificielle"**`) |
| formation-ia-mantes-la-jolie-opportunites-enjeux | 4 | 3 | 1 (`**Le fil d'actualités FC**`) |
| accompagnement-ia-aubervilliers | 4 | 1 | 0 |
| audit-ia-bretigny-sur-orge | 3 | 3 | 0 |
| coaching-ia-dirigeant-bretigny-sur-orge | 4 | 1 | 0 |
| coaching-ia-dirigeant-champs-sur-marne | 4 | 1 | 0 |

**Root-cause** — Le seeder LLM n'a pas produit de champ titre distinct et a laissé les
délimiteurs markdown ; aucune normalisation en aval.

**Patch prescrit**

1. Normalisation one-shot du catalogue : pour chaque entrée où `title === url` ou
   `title` contient `**`, dériver un intitulé propre. Deux voies, par ordre de préférence :
   (a) réutiliser le `fetchPartial()` déjà écrit dans
   `external-links-monitor-worker.ts:96-124` pour lire le `<title>` de la destination ;
   (b) à défaut, `"<Organization> — <dernier segment de path humanisé>"`.
   Au minimum : `title.replace(/\*\*/g, "").trim()` (élimine 33 entrées en une ligne).
2. Garde de rendu : dans `ArticleSources.tsx:37-39`, écarter aussi les libellés qui sont
   des URLs (`/^https?:\/\//.test(s.name)`) — mieux vaut retomber sur le domaine seul que
   d'afficher une URL de 90 caractères. Et dans `persist-citations.ts:130`, ne pas retomber
   sur `link.title` quand celui-ci est une URL.
3. Test de non-régression : assertion sur `ALL_EXTERNAL_LINKS` — aucun `title` ne doit
   commencer par `http` ni contenir `**`.

**Effort** : M. **Impact GEO/AEO** : **moyen-fort**. Un bloc de sources dont un tiers des
intitulés sont des URLs brutes ne fournit aucune entité nommée exploitable par un LLM
(pas d'attribution « selon l'INSEE », juste une chaîne d'URL) et abîme le
`isBasedOn[].name` du JSON-LD.

**Risque de régression** : moyen — la modification des `title` change les
`ExternalReference` upsertés (clé = `url`, donc pas de doublon créé, seulement un `update`).
Prévoir un backfill pour que les articles déjà publiés reprennent les nouveaux titres.
**Do-not-touch** : le champ `url` (clé d'upsert et clé de `detectHallucinations`) —
le corriger casserait la correspondance avec les corps HTML déjà publiés ; c'est
précisément pourquoi le patch backtick (P0) doit être couplé à une réécriture des corps.

---

### [P1] `organization` = hostname en MAJUSCULES sur 299/328 liens éligibles → `publisher` JSON-LD illisible

**Symptôme** — Le `publisher` des `ExternalReference` (donc du `isBasedOn`) vaut
`SAINT-ETIENNE`, `VITRY94`, `CESER`, `FOAD`, `FORMATION`, `FRANCECOMPETENCES`,
`CHOOSEPARISREGION`…

**Preuve code**

- `auto-seeded-vertical.ts:45` : `organization: "FORMATION"` pour
  `formation.cnam.fr` ; `:66` `organization: "FOAD"` pour `foad.cnam.fr` ;
  `:217` `organization: "FRANCECOMPETENCES"`.
- `persist-citations.ts:109` / `:119` : `publisher: link.organization` → écrit tel quel
  dans `ExternalReference.publisher`.
- Effet de bord fonctionnel : `helpers.ts:126-129` diversifie la sélection par
  `link.organization`. Comme `formation.cnam.fr` = `FORMATION`, `foad.cnam.fr` = `FOAD`
  et `cnam.fr` = `CNAM` sont trois « organisations » distinctes, **trois liens vers le
  CNAM peuvent être sélectionnés pour un même article** — ce qui est exactement ce que la
  diversification devait empêcher. Inversement `CESER` collapse Île-de-France et
  Nouvelle-Aquitaine, qui sont deux organismes différents.

**Preuve live** — corollaire du finding précédent : sur
`/fr/blog/formation-ia-mantes-la-jolie-opportunites-enjeux` (02:05 UTC), deux des quatre
sources sont `cnam.fr` et `formation.cnam.fr`, présentées comme deux sources
indépendantes.

**Quantification** : 299 / 328 liens éligibles ont un `organization` de forme
`^[A-Z0-9-]+$` de plus de 2 caractères.

**Root-cause** — Le seeder dérive `organization` du premier label du hostname en
majuscules, sans table de correspondance.

**Patch prescrit** — Table de normalisation `hostname → organisation canonique` (registrable
domain plutôt que sous-domaine), appliquée (a) en one-shot sur le catalogue, (b) comme clé
de diversification dans `helpers.ts:126` (`usedOrgs.add(registrableDomain(link.url))`
plutôt que `link.organization`). Traiter en priorité les ~60 organisations les plus
citées ; le reste peut retomber sur le domaine enregistrable formaté.
**Effort** : M. **Impact GEO/AEO** : **moyen** (publisher = entité nommée dans `isBasedOn` ;
la diversification conditionne la largeur du profil de citation).
**Risque de régression** : changer la clé de diversification modifie la sélection future —
sans effet rétroactif sur le contenu publié. **Do-not-touch** : `link.id` (clé de
`ExternalLinkUsage` et de `verification-status.json`).

---

### [P1] Le monitor de fraîcheur des liens écrit dans un système de fichiers éphémère → catalogue figé au 2026-05-22

**Symptôme** — La « re-vérification mensuelle » du catalogue ne produit aucun effet
durable. Le catalogue publié conserve 220 liens `404` et 166 `deprecated`.

**Preuve code**

- `external-links-monitor-worker.ts:43` :
  `const OUTPUT_JSON = resolve(process.cwd(), "src/data/external-links/verification-status.json")`
  puis `:286` `writeFileSync(OUTPUT_JSON, …)`. En prod, `process.cwd()` est le répertoire
  de travail du conteneur : le fichier écrit est **perdu au prochain restart / redeploy**,
  puisque l'image est rebâtie depuis git (ADR 0026). Le commentaire `:285` l'admet à demi
  (« commit géré par Will manuellement post-run ») mais rien ne rapatrie le fichier.
- `master.ts:35-39` + `:66-78` : les overrides sont lus **au build**, depuis le JSON
  committé. Un run réussi en prod n'a donc aucun chemin vers le catalogue servi.
- `:364-369` : gate `EXTERNAL_LINKS_MONITOR_ENABLED !== "true"` → worker non démarré
  (`.env.production.example:178` le met à `true`, mais je n'ai pas pu vérifier la valeur
  réelle en prod — cf. Limites).

**Preuve (état du dépôt, 2026-08-15 02:10 UTC)** —
`grep -c '"lastCheckedAt": "2026-05-22'` sur `verification-status.json` → **740**.
`grep -o '"lastCheckedAt": "2026-0[6789]'` → **aucune correspondance**.
Le fichier n'a donc jamais été réécrit depuis le run initial du script :
**85 jours de retard**, alors que le worker est censé tourner le 1er de chaque mois
(3 runs manqués : 06-01, 07-01, 08-01).

**Distribution des 736 entrées parsées** :

| Statut d'override | Nombre |
| --- | --- |
| `active` | 328 |
| `404` | 220 |
| `deprecated` | 166 |
| aucun override | 22 |

**Root-cause** — Un worker conçu pour écrire dans le dépôt source, déployé dans une
architecture où le dépôt source n'est pas accessible en écriture depuis le runtime.

**Patch prescrit** — Déplacer la persistance des overrides de `writeFileSync` vers la DB
(par ex. une clé `ContentGenConfig` `external_links_verification` déjà voisine de
`external_links_last_check` écrit en `:308-319`), et faire lire `master.ts` en deux temps :
overrides statiques du JSON committé **puis** overrides DB au runtime (hydratation
analogue à `refreshUsageStats()` en `helpers.ts:209-219`, déjà en place et éprouvée).
Variante minimale si on veut rester statique : conserver `writeFileSync` mais faire ouvrir
une PR par le workflow GH Actions (le monitor tournerait en CI, pas dans le conteneur).
⚠️ Ne PAS ajouter de volume Docker pour ce seul fichier : le contrat ADR 0026 tient à ce
que l'image soit auto-suffisante.

**Effort** : M. **Impact GEO/AEO** : **moyen** — sans re-vérification, la proportion de
liens morts injectés ne peut que croître, et c'est le mécanisme même qui devait attraper
le bug backtick.
**Risque de régression** : ajouter une lecture DB dans `master.ts` casserait le build
`stub.invalid` (module chargé au SSG). Impératif : garder les overrides JSON comme socle
synchrone et n'appliquer les overrides DB que via une fonction async explicite appelée
côté worker/serveur — **jamais** au top-level du module.
**Do-not-touch** : `master.ts` top-level (import synchrone, chargé au build),
`src/lib/prisma.ts` (proxy stub).

---

### [P1] « Dernière vérification : <date de l'article> » sous le bloc Sources ne dit pas la vérité sur la fraîcheur des sources

**Symptôme** — Sous la liste des sources, le site affiche « Dernière vérification : »
suivi de la date de mise à jour de **l'article**, ce qui se lit naturellement comme « les
sources ont été vérifiées à cette date ». La vraie date de vérification des sources est
le 2026-05-22 pour la quasi-totalité d'entre elles.

**Preuve code**

- `ArticleSources.tsx:18-19` : le prop est documenté « Date de dernière vérification
  **éditoriale** (fraîcheur E-E-A-T) », rendu en `:94-99` sous le libellé
  « Dernière vérification : ».
- `blog/[slug]/page.tsx:667` : `lastVerified={view.updatedAt ?? view.publishedAt}`
- `guides/[slug]/page.tsx:331` : `lastVerified={guide.updatedAt.toISOString().slice(0,10)}`
- `actualites/[slug]/page.tsx:576` : `lastVerified={updatedIso}`
- La donnée honnête existe pourtant et est persistée :
  `persist-citations.ts:102` `lastVerifiedAt = toDate(link.verifiedAt) ?? toDate(link.lastCheckedAt)`
  → `ExternalReference.lastVerifiedAt` (`:114`, `:124`). Elle n'est simplement jamais lue :
  `blog/loader.ts:157` ne sélectionne que `{ url: true, title: true }`.
- La charte éditoriale promet explicitement cette information :
  `charte-editoriale/page.tsx:252` — « **Chaque citation est datée** et liée à l'URL
  d'origine. »

**Preuve live** (2026-08-15 01:55 UTC) — `/fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble`
affiche 4 occurrences de « Dernière vérification » ; la valeur affichée suit la date de
l'article, alors que les 6 sources listées ont toutes `lastVerifiedAt = 2026-05-22` dans
le catalogue.

**Root-cause** — Un libellé emprunté à une donnée qui n'était pas la sienne, au moment où
le bloc a été rendu visible (chantier templates 2026-06-21).

**Patch prescrit** — Deux options, la seconde préférable :
1. Renommer le libellé en « Article mis à jour le » (S, honnête immédiatement) ;
2. Ajouter `lastVerifiedAt: true` au `select` de `blog/loader.ts:157` (+ équivalents
   guides/actualites), remonter la date par source et l'afficher sous chaque entrée ;
   garder « Dernière vérification » avec la **plus ancienne** des dates de sources.
   L'option 2 ne devient vraie que si le monitor du P1 précédent est réparé — sinon elle
   affichera « 2026-05-22 » partout, ce qui est franc mais peu flatteur.

**Effort** : S (option 1) / M (option 2). **Impact GEO/AEO** : **moyen** — c'est une
promesse de la charte non tenue, et la fraîcheur affichée est un des rares signaux
E-E-A-T que les moteurs génératifs citent explicitement.
**Risque de régression** : nul pour l'option 1. **Do-not-touch** : la garde
`ArticleSources.tsx:33` / `:40` (retour `null` si 0 item valide) — elle évite un bloc vide.

---

### [P1] La correction automatique des chiffres réfutés réécrit des articles publiés sans bouger `dateModified` ni laisser de trace publique

**Symptôme** — Quand le fact-check juge un chiffre faux, le worker réécrit le corps de
l'article en place. L'article change, mais sa date de modification ne bouge pas et aucune
correction n'est consignée nulle part de visible — alors que `/fr/corrections` décrit un
workflow de correction en bonne et due forme.

**Preuve code**

- `content-fact-check-worker.ts:259-264` : la correction fait
  `prisma.articleTranslation.update({ where: { id: translation.id }, data: { body, bodyText } })`.
  **`Article` n'est pas touché** → son `@updatedAt` ne se déclenche pas.
- `blog/loader.ts:201` : `updatedAt: dbArticle.updatedAt` — c'est bien `Article.updatedAt`
  qui alimente `dateModified` (`blog/[slug]/page.tsx:659`) **et** le
  « Dernière vérification » du bloc Sources (`:667`).
- Conséquence : un article dont un chiffre a été corrigé garde exactement la même
  `dateModified`, le même `lastmod` de sitemap, et le même affichage.
- `:265-267` : `revalidateContent` est bien appelé → la page change à l'écran, mais les
  métadonnées de fraîcheur mentent.
- Aucun enregistrement de correction publiable : `FactCheckClaim` est écrit
  (`:193-218`) avec `claim` / `status` / `confidence`, **sans URL de preuve ni texte
  avant/après**, et n'est lu par aucune surface publique.
- `/fr/corrections` (live 02:03 UTC) annonce « Nous accusons réception sous 24 h ouvrées et
  corrigeons sous 48 h ouvrées » et décrit un « workflow correction » — il ne mentionne pas
  que des corrections automatiques ont lieu sans notification.

**Preuve live** — `/fr/corrections` répond 200 (02:00 UTC) et ne contient **aucune entrée
de journal** : uniquement H2 « TL;DR », « Comment signaler une erreur », « Process »,
« Notre workflow correction », « Cas particuliers », « Ce qui n'est PAS une correction »,
« Contacts », « Pour signaler une erreur ». Contact : `corrections@axion-ia.com`.

**Root-cause** — La correction en place a été greffée sur le worker fact-check (décision
Will « corriger plutôt que désindexer », commentaire `:234-240`) sans propager la mise à
jour de `Article` ni brancher de journal.

**Patch prescrit**

1. Dans la même transaction que `:259-264`, ajouter
   `prisma.article.update({ where: { id: articleId }, data: { updatedAt: new Date() } })`
   (ou tout champ qui déclenche `@updatedAt`), pour que `dateModified` et le `lastmod`
   suivent la modification réelle. ⚠️ **Coordonner avec D7** : c'est le même champ que le
   pipeline de refresh, et un bump non maîtrisé de `dateModified` est un anti-pattern
   (cf. décision 5 sur `datePosted`). Ici le bump est **légitime** : le contenu a
   réellement changé.
2. Étendre `FactCheckClaim` (ou une table `ContentCorrection`) avec `correctedAt`,
   `before`, `after`, `evidenceUrl` et alimenter `/fr/corrections` avec les N dernières
   corrections datées → transforme une page de politique en preuve E-E-A-T.

**Effort** : S (1) / M (2). **Impact GEO/AEO** : **moyen** — (1) répare un signal de
fraîcheur faux ; (2) est l'un des rares gestes qui distinguent un éditeur sérieux aux yeux
des évaluateurs qualité et des moteurs génératifs.
**Risque de régression** : (1) provoque une vague de `lastmod` modifiés lors du prochain
run fact-check → à ne déployer que si le pipeline d'indexation supporte le volume
(coordonner avec A6). **Do-not-touch** : le fail-safe `:271-280` (article gardé EN LIGNE,
jamais désindexé — décision Will), le garde-fou de cohérence `:72`.

---

### [P2] `/fr/corrections` : une politique de correction sans aucune correction

**Symptôme** — La page décrit un processus mais ne publie aucun journal de corrections.
**Preuve live** (02:00 UTC) : 200, structure ci-dessus, zéro entrée datée.
**Preuve code** : `src/app/[locale]/corrections/page.tsx` (page statique, aucune lecture DB).
**Patch** : brancher le journal du P1 précédent, ou à défaut publier manuellement les
corrections notables. **Effort** : S (coquille) / M (branché DB). **Impact** : moyen.
**Risque** : nul. Voir aussi P1 « correction automatique ».

### [P2] `/fr/equipe/manon` est indexable, porte la Person JSON-LD… et n'est dans aucun sitemap

**Symptôme** — La byline qui signe l'intégralité des contenus IA n'est pas déclarée.
**Preuve live** (02:01 UTC) : `/fr/equipe/manon` → 200,
`<meta name="robots" content="index, follow">`, canonical auto-référent, 2 nœuds
`"@type":"Person"`. `sitemap/pages.xml` (02:02 UTC) contient **1 seule** occurrence de
`equipe` (`/fr/equipe/williams`) — `manon` en est absente.
**Preuve code** : `src/app/[locale]/equipe/[slug]/page.tsx:33` `dynamicParams = true` ; la
page existe pour tout slug d'`AuthorProfile` actif, mais rien ne l'énumère côté sitemap.
**Nuance** : la page est bien maillée en interne (`/fr/blog/…` porte
`href="/fr/equipe/manon"` et `href="/fr/equipe/williams"`, mesuré 02:06 UTC) — ce n'est
donc pas une orpheline, seulement une non-déclarée.
**Patch** : ajouter les slugs `AuthorProfile.isActive` au sitemap `pages`. **Effort** : S.
**Impact** : faible-moyen (l'entité auteur est le pivot du graphe E-E-A-T ; `usageInfo` de
chaque article pointe vers elle). **Do-not-touch** : périmètre A2 — coordonner.

### [P2] Le trust tier persisté et le trust tier affiché sont calculés par deux fonctions différentes qui divergent

**Symptôme** — `ExternalReference.trustTier` peut valoir `official` pendant que le lien
rendu sort en `nofollow`.
**Preuve code** : `persist-citations.ts:33-38` (`mapAuthorityToTrustTier`, basé sur
`category`/`authority`) vs `ArticleSources.tsx:54-55` qui **recalcule** via
`computeTrustTier(domain)` (`trust-tier.ts:100-111`, basé sur des listes de domaines) en
ignorant la valeur persistée. Exemple concret : `francecompetences.fr` est `category:
"gov_fr"` (`auto-seeded-vertical.ts:218`) → persisté `official`, mais absent de
`OFFICIAL_DOMAINS` (`trust-tier.ts:23-49`) et ne finissant pas par `.gouv.fr` → recalculé
`standard` → `nofollow`.
**Preuve live** (02:00 UTC) : `rel="nofollow noopener noreferrer"` sur les deux ancres
France Compétences de l'article Vénissieux.
**Domaines officiels/haute autorité manquants** relevés dans les sources réellement
citées : `francecompetences.fr`, `unesco.org`, `afnor.org`, `bpifrance.fr`, `cnam.fr`,
`france-competences`-like, `cyber.gouv.fr` (couvert par `.gouv.fr`, OK).
**Patch** : `ArticleSources` doit consommer le `trustTier` persisté (le remonter dans
`loader.ts`) et `computeTrustTier` ne servir que de fallback ; compléter
`OFFICIAL_DOMAINS`/`HIGH_TRUST_DOMAINS`. **Effort** : S. **Impact** : faible
(le `nofollow` ne gêne pas la citation par un LLM ; c'est une incohérence de doctrine
plus qu'un problème de visibilité). **Do-not-touch** : la doctrine V-14 elle-même
(`trust-tier.ts:1-19`) — nofollow par défaut pour les inconnus est un choix assumé.

### [P2] Le fact-check jette les preuves qu'il demande

**Symptôme** — Le prompt exige `{"id", "status", "evidence": "url ou note"}`
(`content-fact-check-worker.ts:85`) mais `parseVerdicts` (`:98-122`) ne conserve que
`status` : l'URL de preuve est perdue à la ligne `:106-111`. `FactCheckClaim` est donc
écrit sans `sourceUrl`, et aucune surface publique n'expose « claim vérifié — source ».
**Patch** : conserver `evidence`, la valider (URL http(s)), la persister, et l'exposer
soit dans le bloc Sources soit dans un `ClaimReview` JSON-LD.
**Effort** : M. **Impact GEO/AEO** : **moyen** — `ClaimReview` est l'un des rares schémas
que les moteurs génératifs traitent comme une preuve de vérification.

### [P2] La charte éditoriale est périmée et promet une cadence qui n'existe plus

**Preuve live** (02:03 UTC) : « Dernière révision : 2026-05-18 » — 89 jours, alors que la
charte s'engage `charte-editoriale/page.tsx:364` sur une révision « a minima 1 fois par
an » (respectée) mais décrit une cadence de publication d'articles qui est **à zéro depuis
le 2026-07-20** (arrêt de production acté, kill switch OpenAI).
Elle nomme aussi « OpenAI GPT-4o pour la rédaction » (`:275`) — encore exact —, mais
`/fr/transparence` liste Anthropic / Claude / Mistral alors que
`provider-router.ts:118` ne route plus la génération de texte que vers OpenAI.
**Patch** : bump de `LAST_REVIEWED`, recalage de la liste de fournisseurs sur
`ROLE_TO_PROVIDERS`, et retrait/atténuation de toute promesse de cadence.
**Effort** : S. **Impact** : faible-moyen.
⚠️ Ce finding ne rouvre PAS la décision « production arrêtée » — il porte uniquement sur
la cohérence de la page publique avec l'état réel.

### [P2] Le commentaire d'architecture surestime le catalogue d'un facteur 3

`persist-citations.ts:14` : « seul le catalogue curé (**~2 400 liens vérifiés HEAD**) est
éligible ». Mesuré : **742 entrées `url:`**, 736 parsées, **328 éligibles**.
La garantie « zéro citation inventée » reste vraie (elle repose sur
`detectHallucinations`), mais le chiffre induit en erreur quiconque dimensionne la
rotation. **Patch** : corriger le commentaire, ou mieux : le remplacer par un renvoi à
`getExternalLinksStats().healthyForSelection` (`master.ts:116-123`). **Effort** : S.

### [P2] `computeFactCheckScore` : la documentation décrit une autre formule que le code

`claims-extractor.ts:86-87` annonce « (validated + neutral) / total * 100 » ; `:98`
implémente `((validated - refuted) / n + 1) / 2`. Les deux divergent dès qu'il y a un
`refuted` (ex. 1 validated / 1 refuted → doc = 50, code = 50 ; 0 validated / 1 refuted /
1 unclear → doc = 50, code = 25). Le seuil de quarantaine `refuteScore = 50` (`:241-243`)
est calibré sur le code, pas sur la doc → risque de mauvais réglage par un futur lecteur.
**Patch** : aligner le commentaire. **Effort** : S. **Impact** : faible.

### [P2] Le chaînage de hash de la provenance n'a jamais plus d'un maillon

`provenance-logger.ts:59-97` implémente une chaîne `previousHash → hash` présentée comme
garantissant l'intégrité de la trace. Mais `logProvenance` n'a **qu'un seul site
d'appel** — `content-publish-worker.ts:982`, `step: "publish"` — donc un article a
exactement **un** enregistrement, avec `previousHash = null` (`:84`). La chaîne ne chaîne
rien : c'est une garde qui ne garde rien.
De plus `:970-972` déclare explicitement approximer les tokens (« ~30 % output / 70 %
input »), ce qui rend la trace impropre à un audit de coût.
**Patch** : soit appeler `logProvenance` à chaque étape LLM réelle (génération, images,
fact-check, correction en place) — ce qui donnerait enfin du sens à la chaîne et
couvrirait l'AI Act art. 50 ; soit assumer un enregistrement unique et retirer le
vocabulaire de chaînage. **Effort** : M. **Impact GEO/AEO** : **faible** (surface
admin-only), mais impact conformité réel.

---

## Mesures brutes

### Live — pages E-E-A-T (2026-08-15, ~02:00 UTC, HEAD)

| URL | Statut |
| --- | --- |
| `https://axion-ia.com/fr/charte-editoriale` | 200 |
| `https://axion-ia.com/fr/transparence` | 200 |
| `https://axion-ia.com/fr/corrections` | 200 |
| `https://axion-ia.com/fr/methodologie` | 200 |
| `https://axion-ia.com/fr/a-propos` | 200 |
| `https://axion-ia.com/fr/equipe` | **404** (pas de page index — attendu, seul `/equipe/[slug]` existe) |
| `https://axion-ia.com/fr/equipe/williams` | 200 |
| `https://axion-ia.com/fr/equipe/manon` | 200 (index,follow — **absente des sitemaps**) |
| `https://axion-ia.com/fr/equipe/williams-jullin` | 404 (slug inexistant, normal) |

### Live — bloc « Sources & méthodologie » (9 articles, 01:53–02:12 UTC)

39 entrées de source au total. **14 libellés = URL brute (36 %)**,
**2 libellés = markdown littéral (5 %)**, **1 article sur 9 porte un href malformé**.
Détail par article : voir le tableau du finding P1 « intitulé inexploitable ».

### Live — URL de destination backtickée (02:02 UTC)

`curl -L https://www.francecompetences.fr/recherche/rncp/%60` → **200**
(catch-all / soft-404 : explique le classement `active` du vérifieur HEAD).

### Statique — catalogue `src/data/external-links/**` (02:10 UTC)

| Mesure | Valeur |
| --- | --- |
| Occurrences `url: "…"` (9 fichiers) | 742 |
| Entrées parsées id+url+title+organization | 736 |
| Éligibles (`status` ∈ {active, redirect_acceptable}) | **328** |
| `status: 404` | 220 |
| `status: deprecated` | 166 |
| Sans override de vérification | 22 |
| URLs contenant un backtick | **171** (auto-seeded-vertical 111 / auto-seeded 60) |
| … dont éligibles (donc **injectables**) | **20** |
| `title` identique à `url` | 454 (dont **160** éligibles) |
| `title` contenant du markdown `**` | 33 éligibles |
| `organization` de forme `^[A-Z0-9-]+$` | **299** éligibles |
| **Éligibles « propres »** (titre ≠ URL, sans `**`, sans backtick) | **152 / 328 (46 %)** |
| Entrées `lastCheckedAt = 2026-05-22` dans `verification-status.json` | **740** |
| Entrées `lastCheckedAt` ≥ 2026-06 | **0** |

### Statique — chaîne de citation

| Étape | Fichier:ligne | État |
| --- | --- | --- |
| Sélection | `data/external-links/helpers.ts:51-133` | OK (filtres durs + rotation + diversification) |
| Filtres durs | `helpers.ts:23-37` | ⚠️ aucun contrôle syntaxique d'URL |
| Prompt d'injection | `helpers.ts:259-274` | ⚠️ propage `title` = URL brute |
| Détection hallucination | `helpers.ts:227-253` | OK (match exact contre le catalogue) |
| Appel au publish | `content-publish-worker.ts:882-925` | OK, best-effort non bloquant |
| Persistance | `links/persist-citations.ts:82-144` | OK, idempotent (`deleteMany` par article) |
| Lecture publique | `content-gen/blog/loader.ts:153-236` | ⚠️ ne remonte ni `trustTier` ni `lastVerifiedAt` |
| Rendu | `components/content-gen/ArticleSources.tsx` | ⚠️ recalcule le trust tier, accepte les URL-libellés |
| `isBasedOn` | `blog/[slug]/page.tsx:365-366, 383` | OK (mais hérite des titres dégradés) |
| Backfill historique | `links/backfill-citations.ts` | Présent, réutilisable après nettoyage |

---

## Limites

- **Aucun accès à la DB de production.** D6 n'est pas dans la liste des agents autorisés
  (A3, B6, D1, D5, D8, F7). Je n'ai donc pas pu mesurer : le nombre réel de
  `ContentCitation` / `ExternalReference` en base, le nombre d'articles portant
  effectivement une URL backtickée dans leur corps, la distribution de
  `Article.factCheckScore` et de `ContentGenJob.status = quarantined_factcheck`, ni le
  nombre de lignes `GenerationProvenance`. **Toutes mes quantifications de la portée en
  prod reposent sur un échantillon de 9 articles** (`11 %` de href malformés, `36 %` de
  libellés en URL brute) — à confirmer par un `SELECT count(*) FROM "ExternalReference"
  WHERE url LIKE '%\`%'` et un `SELECT count(*) FROM "ArticleTranslation" WHERE body LIKE
  '%rncp/\`%'`. À rapprocher de D1/D5 qui disposent de l'accès.
- **Pas de vérification SSH de l'état du worker.** Je n'ai pas pu lire la valeur réelle de
  `EXTERNAL_LINKS_MONITOR_ENABLED` en prod ni les logs du worker
  `external-links-monitor`. La conclusion « le monitor n'a aucun effet durable » repose
  sur la preuve statique (écriture dans `process.cwd()` + `master.ts` lit le JSON au
  build) et sur le fait que le fichier committé n'a jamais bougé depuis le 2026-05-22 —
  ce qui est concluant sur l'effet, mais pas sur la question de savoir si le worker tourne.
- **Pas de mesure de performance en lab** (contrainte machine). Aucune donnée Lighthouse
  n'a été produite : le bloc `ArticleSources` est un composant serveur sans JS
  (`ArticleSources.tsx:30`), son impact Web Vitals est nul par construction — mais je ne
  l'ai pas mesuré.
- **JSON-LD non validé par un validateur externe.** Les `isBasedOn` ne sont pas dans le
  HTML brut (JSON-LD en `afterInteractive`, constat transverse déjà acté) : mes conclusions
  sur `isBasedOn` / `disambiguatingDescription` proviennent du code et de la charge utile
  RSC observée dans la réponse, pas d'un rendu exécuté. La chaîne
  `"…supervisé par l'équipe Axion-IA…","aiGenerated":true,"additionalType":"htt…` était
  bien présente dans la réponse live.
- **Échantillon d'articles non aléatoire** : les 9 slugs viennent des premières entrées de
  `sitemap-blog.xml` — probablement les plus récents, donc les plus représentatifs du
  dernier état du générateur, mais pas d'un tirage uniforme sur le corpus.
- **Portée du backtick dans les corps déjà publiés non bornée.** Je sais que 20 liens
  backtickés sont injectables et j'en ai vu 1 en prod ; je ne sais pas combien d'articles
  au total sont touchés (nécessite la DB).
- **Pages `/connaissances` (KB) non auditées** : `ArticleSources` n'y est pas monté
  (surface D5).
