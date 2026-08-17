# H2 — Contre-vérification adversariale des squads C et D

- **Date** : 2026-08-15, mesures live 02:07 → 03:05 UTC (build servi `x-axion-build-sha: f51d544b…`).
- **Fenêtre deploy** : atterrissages 2026-08-14 à 14:57, 18:26 et 19:49:58 UTC. Toutes mes mesures sont **≥ 6 h après le dernier atterrissage** → hors fenêtre post-deploy, aucun « vide DB-driven » ne peut être imputé à l'ISR.
- **Périmètre** : les 56 findings P0 + P1 des 13 rapports C1-C5 et D1-D8.
- **Méthode** : relecture du code cité ligne à ligne (bon fichier, bonne ligne, code compensatoire ailleurs ?), re-test live en GET, recoupement inter-rapports, confrontation aux décisions actées et à l'acquis H1.

---

## Résumé exécutif

**56 findings examinés : 47 CONFIRMÉS, 5 RÉFUTÉS, 4 INCERTAINS.** Les squads C et D
sont globalement fiables — mais quatre choses doivent remonter en synthèse :

1. **Un faux positif net avec patch dangereux** : C4-P1 « 3 hubs catégorie blog listent
   0 article » est **RÉFUTÉ**. Les trois hubs servent aujourd'hui 84, 15 et 6 articles
   (mesuré 02:22 UTC ; la page affiche littéralement « 84 article… »). Aucun contenu
   n'a pu être créé depuis le 2026-07-20 (kill switch) : les articles étaient donc déjà
   rattachés. C4 a mesuré une **copie ISR/edge périmée** (mécanisme H1-(a)), pas un bug
   de `categoryId`. Le patch prescrit (« corriger l'assignation catégorie dans les
   générateurs OU backfill SQL `categoryId` ») aurait été un **UPDATE de masse sur une
   donnée saine**. À éliminer.
2. **Une contradiction inter-rapports tranchée** : D7-P1 « creds GSC absents du container
   worker » est **RÉFUTÉ par la mesure live de D8** (`GSC_OAUTH_*` + `GSC_PROPERTY_URL`
   présentes dans web ET worker, 18:36 UTC). La cause réelle de l'inertie de l'élagage
   est le **kill switch** (`content-tier-lifecycle-worker.ts:154-157` : `skip run`). Le
   patch ops prescrit par D7 (« poser les vars Coolify ») ne servirait à rien.
3. **Un patch qui renverse une décision Will documentée en code** : D2-P0 « le tier est
   écrasé en dur au publish » est **factuellement CONFIRMÉ** (`content-publish-worker.ts:618`,
   article de 195 mots servi `index, follow` et présent dans `sitemap-blog.xml`), mais
   le patch prescrit (`promoteToTier1 ? tier_1 : tier_2`) **annule la décision Will du
   2026-06-17** citée en commentaire aux lignes 602-606. C'est un **STOP & ASK**, pas un
   patch de 2 lignes. Le vrai trou est ailleurs : la jambe de rattrapage prévue par la
   même décision (démote CTR par `content-tier-lifecycle`) est gelée par le kill switch.
4. **Deux P0 « machine éteinte » à requalifier** : D1-P0 « machine à l'arrêt depuis 21 j »
   et D7-P1 « actualités gelées depuis 25 j » décrivent la **conséquence connue d'un
   reste-Will acté** (recharge OpenAI). Ils sont RÉFUTÉS comme findings nouveaux ; seules
   leurs sous-parties « pas de garde-fou d'ancienneté / pas d'alerte » survivent, en P2.

**Le finding le plus solide de toute la squade D** est D1-P0 « mix d'intentions cassé » :
`sampleWeighted` (`content-orchestrator-worker.ts:89`) calcule `position = (slotIndex + seed) % total`
avec `total = 1` (poids fractionnaires) → `n % 1 = 0` → **toujours la première clé**.
La signature forensique est parfaite : le ratio 2,002:1 mesuré en base correspond exactement
au cycle {0 ; 0,25 ; 0,5} prédit par `total = 0,75` (alias `commercial` perdu). Ce bug est
**dormant mais armé** : dès le rallumage, 100 % des contenus sortiront `informational`.
À corriger AVANT de recharger OpenAI.

**Deux P0 de conformité live à ne pas diluer** : la statistique propriétaire fabriquée
« 68 % des équipes formées par Axion-IA… » est publiée et indexable (D2-P0-3, vérifiée
02:44 UTC), et chaque article affirme dans son JSON-LD une supervision humaine que le
même HTML dément deux lignes plus bas (D6-P0-2, vérifié 02:52 UTC : `2 × "supervisé par
l'équipe Axion-IA"` face à `2 × "contrôlé automatiquement avant publication"`).

**Observation nouvelle hors périmètre C/D** : `/sitemaps/images-fr.xml` ne porte plus que
**289** `<loc>` (02:12 UTC) contre **867** mesurés par C1 à 18:07 UTC le 08-14. Une chute
de 67 % du sitemap images entre deux mesures espacées de 8 h, sans deploy dans l'intervalle
après 19:49. À faire trancher par A4 / la synthèse.

---

## SQUAD C

### C1-P0 — En-tête HTTP `Link` : hreflang `en` vers des 301 + `x-default` redirigeant — **CONFIRMÉ**

- **Preuve live (2026-08-15 02:07:01 UTC)** — `GET /fr/audit` :
  `link: <…/fr/audit>; hreflang="fr", <…/en/audit>; hreflang="en", <…/audit>; hreflang="x-default"`.
  `GET /en/audit` → **301** → `/fr/audit` ; `GET /audit` → **301** → `/fr/audit` (02:09 UTC).
  Les deux alternates non-`fr` du header pointent donc des URLs redirigeantes.
- **Preuve code re-vérifiée** — `src/i18n/routing.ts:12-15` : `defineRouting({ locales: ["fr","en"], localePrefix: "always" })`, **aucun `alternateLinks: false`**. Aucun code compensatoire trouvé (le gating est purement HTML).
- **La contradiction est explicitement documentée dans le repo** : `src/app/[locale]/layout.tsx:149-152` — « *on n'émet PAS de hreflang `en` (sinon Google reçoit un alternate pointant vers une URL 301 = signal de crawl gaspillé)* ». Le middleware fait exactement ce que ce commentaire interdit.
- **Verdict** : CONFIRMÉ, P0 maintenu. Patch `alternateLinks: false` : 1 ligne, ne touche ni le routing ni les 301 (`proxy.ts:39-55`), **ne contredit aucune décision actée** (la décision 1 « site FR uniquement » va dans le même sens).

### C1-P1 — Double suffixe « · Axion-IA · Axion-IA » — **CONFIRMÉ, volume à corriger (867 → ~290)**

- **Preuve live (02:15-02:22 UTC)** :
  `/fr/galerie/axion-ia-hero-ville-villeurbanne-…` → `<title>Consultant IA Villeurbanne — Formation PME | Axion-IA · Axion-IA</title>`, `robots index, follow`.
  `/fr/galerie` → `Banque d'images IA — Visuels libres CC BY · Axion-IA · Axion-IA`.
  `/fr/diagnostic` → `… · Axion-IA · Axion-IA` (noindex, donc inerte).
- **Correction de portée** : C1 annonce « ~870 pages indexables » sur la base de **867** URLs `/fr/galerie/` dans `/sitemaps/images-fr.xml` (18:07 UTC le 08-14). Recompté **02:12 UTC le 08-15 : 289** `<loc>` `/fr/galerie/` (dont le hub). Le corpus réellement touché est donc **~290 pages galerie + 6 pages de pagination blog**, soit **~296**, pas 870.
- **Verdict** : CONFIRMÉ sur le mécanisme et sur les 3/3 échantillons ; **impact requalifié moyen-fort → moyen** (volume ÷ 3). Le patch reste bon et sans risque.

### C1-P1 — Canonical hérité du layout (`/fr` sur les pages sans `alternates`) — **CONFIRMÉ, sévérité requalifiée P1 → P2**

- **Preuve live (02:16 UTC)** : `/fr/diagnostic` → `canonical https://axion-ia.com/fr` + `robots noindex, nofollow`. `/fr/components` → `canonical https://axion-ia.com/fr` + `robots index, follow` + `<title>Axion-IA — Cabinet IA opérationnel</title>` (titre de la home hérité).
- **Preuve code re-vérifiée** : `src/app/[locale]/layout.tsx:148-157` — le bloc `alternates` est bien au niveau layout, hérité par tout enfant sans `alternates` propre.
- **Tentative de réfutation** : j'ai vérifié le filet robots. `robots.txt` prod (02:17 UTC) porte `Disallow: /components`, `Disallow: /fr/components`, `Disallow: /en/components` **dans chacun des 12 blocs UA**. Les trois pages aujourd'hui touchées sont donc soit `noindex` (diagnostic, simulateur) soit `Disallow` (components) : **dégât réel actuel = nul**.
- **Verdict** : CONFIRMÉ comme piège systémique (toute future page sans `alternates` héritera d'un canonical faux), **mais P1 → P2** : aucune page indexable n'est affectée aujourd'hui. Le patch reste bon marché et préventif.

### C2-P1 — Aucune OG image générée n'est cachée par le CDN — **CONFIRMÉ**

- **Preuve live (02:11-02:12 UTC)** : `/api/og?title=Test%20H2%20cache%20refutation` →
  `Cache-Control: public, max-age=0, must-revalidate`, `cf-cache-status: DYNAMIC`, **1,985 s**.
  **2ᵉ fetch de la même URL** : `cf-cache-status: DYNAMIC`, **2,026 s** → aucun cache, rendu Satori intégral à chaque hit. Reproduction indépendante de C2.
- `/opengraph-image` : **deux** en-têtes `Cache-Control` contradictoires servis simultanément
  (`public, max-age=86400, s-maxage=604800` PUIS `public, max-age=0, must-revalidate`) → `cf-cache-status: DYNAMIC`. La règle `next.config.ts:721-728` s'empile au lieu de remplacer, exactement comme décrit.
- **Verdict** : CONFIRMÉ intégralement. Une réserve sur le patch : mettre `/api/og` en cache CDN avec un `title` libre en query string ouvre un vecteur de **remplissage de cache** par URLs arbitraires ; borner par `Vary` minimal et compter sur le `slice(140)` existant (`route.tsx:98-102`) suffit, mais à mentionner en H4.

### C2-P1 — og:image blog = Unsplash `w=1080`, dimensions déclarées fausses — **CONFIRMÉ**

- **Preuve live (02:13 UTC)** sur `/fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` :
  `og:image = https://images.unsplash.com/…&w=1080` avec `og:image:width = 1200` et `og:image:height = 630`. Les trois valeurs sont mutuellement incohérentes et l'image réelle est sous le plancher Discover.
- **Verdict** : CONFIRMÉ. Patch sans risque (branche `featuredImage` isolée).

### C3-P1 — `/en/book-a-call` → 404 (collision de préfixe `mapEnToFr`) — **CONFIRMÉ, impact requalifié**

- **Preuve live (02:20 UTC)** : `/en/book` → **308** → `/en/book-a-call` → **301** → `/fr/appel-a-call` → **404**. Chaîne reproduite à l'identique.
- **Preuve code re-vérifiée** : `src/lib/i18n/en-to-fr-redirect.ts:96` (`["/en/book", "/fr/appel"]`) et `:135-143` — `if (pathname === enPrefix || pathname.startsWith(enPrefix))` **sans frontière de segment**. J'ai balayé les 96 entrées d'`EN_TO_FR_PREFIXES` : `/en/book` est la **seule** dont un sibling partage le préfixe sans slash (les familles `help`, `blog/category`, `comparisons`, `gallery`, `locations`, `one-to-one` ont toutes leur variante avec slash déclarée AVANT). Le diagnostic de C3 est donc exact et exhaustif.
- **Requalification d'impact** : C3 annonce « moyen-fort ». EN est désactivé depuis le 2026-05-16, `/en/*` est hors sitemap, et la décision 1 (site FR uniquement) interdit d'investir sur EN. Le dégât se limite aux backlinks résiduels et à l'index GSC en cours de purge → **moyen-faible**. Le patch (1 ligne, entrée `/en/book-a-call` placée avant) reste évidemment à faire : il coûte 30 secondes.
- **Verdict** : CONFIRMÉ (impact moyen-faible).

### C3-P1 — Historique de slugs KB écrit partout, consommé par `/guides` seul — **CONFIRMÉ (code), volumétrie INCERTAINE**

- **Preuve code re-vérifiée** — grep `findRedirectFromHistory` sur `src/` :
  `src/lib/knowledge/slug-history.ts:56` (définition), `src/lib/knowledge/slug-history.ts:5` (docstring),
  `src/server/content-gen/slug-history.ts:11` (commentaire), et **un seul consumer réel** :
  `src/app/[locale]/guides/[slug]/page.tsx:20,92`. Zéro occurrence dans `glossaire/[slug]`, `cas-concrets/[slug]`, `centre-aide/[slug]`, `faq/[slug]`, `comparaisons`, `connaissances`.
- **Réserve** : le finding est **préventif**. Aucun rename non-`guide` n'est prouvé en prod (C3 n'a pas la DB, je ne l'ai pas non plus). Le coût est nul aujourd'hui ; il devient réel au premier rename de glossaire/FAQ.
- **Verdict** : CONFIRMÉ sur le code, **volumétrie INCERTAINE** — à trancher par un `SELECT "oldType", count(*) FROM "KnowledgeSlugHistory" GROUP BY 1` avant de chiffrer l'urgence.

### C4-P0 — Liens in-body `/implementations` → 404 — **CONFIRMÉ**

- **Preuve live (02:25-02:27 UTC)** : `/fr/implementations` → **404** ; `/fr/implementation` (singulier) → **200**.
  Article `/fr/blog/formation-ia-montmorency-definition` : `href="/implementations"` ×1, `href="/interventions/essentielle"` ×1, `href="/audit"` ×3. Le lien mort est bien présent dans le corps persisté.
- **Verdict** : CONFIRMÉ, P0 maintenu. Le patch (a) (règle `next.config` `/:locale(fr|en)/implementations` → `/:locale/implementation`) répare tout le stock d'un coup ; **attention absolue** au piège signalé par C4 : la règle ne doit PAS capturer `/implantations` (2 157 pages villes) — exiger le mot entier.

### C4-P0 — Silo FAQ : CTA rendus `/fr/fr/*` → 404 — **CONFIRMÉ**

- **Preuve live (02:25 UTC)** : le HTML de `/fr/faq` contient exactement
  `href="/fr/fr/faq/feed.xml"` (×1) et `href="/fr/fr/faq/par-thematique"` (×1).
  `GET /fr/fr/faq/par-thematique` → **404**.
- **Verdict** : CONFIRMÉ, P0 maintenu. C'est le meilleur rapport effort/impact de toute la squad C : 7 lignes, silo AEO n°1.

### C4-P1 — Liens internes in-body locale-less → un 301 par lien — **CONFIRMÉ**

- **Preuve live** : reproduite ci-dessus (`href="/audit"`, `href="/interventions/essentielle"`, `href="/implementations"` nus dans un article). `/audit` → 301 → `/fr/audit`.
- **Réserve sur le patch** : l'option (a) recommandée par C4 (réécriture au rendu) est la bonne, **mais** elle doit ignorer `#`, `mailto:`, `tel:`, les URLs absolues, et ne jamais double-préfixer — et elle s'exécutera sur chaque rendu d'article. À faire chiffrer en TBT par G1 avant merge (budget `TBT ≤ 150 ms`).
- **Verdict** : CONFIRMÉ.

### C4-P1 — Hub carrières : 54 liens locale-less — **CONFIRMÉ**

- **Preuve live (02:31 UTC)** : `/fr/carrieres` porte **54** `href="/carrieres/<slug>"` distincts, zéro `/fr/carrieres/<slug>`.
- **Verdict** : CONFIRMÉ. Impact « moyen » correctement calibré (la découverte Google for Jobs passe par le sitemap + JSON-LD, pas par ces liens).

### C4-P1 — « 3 des 5 hubs catégorie blog listent 0 article » — **RÉFUTÉ**

C'est le faux positif principal de la squad C.

- **Preuve live (2026-08-15 02:22-02:24 UTC)**, liens `/fr/blog/<slug>` distincts par hub :
  | Hub | C4 (08-14 18:09 UTC) | H2 (08-15 02:22 UTC) |
  |---|---|---|
  | `blog-formations-ia` | **0** | **84** |
  | `blog-coaching-1-to-1` | **0** | **15** |
  | `blog-implementations-ia` | **0** | **6** |
  | `blog-audits-ia` | 19 | 20 |
  Le hub `blog-formations-ia` **affiche littéralement « 84 article »** dans son en-tête (5 occurrences dans le HTML) : ce ne sont pas des liens de barre latérale, c'est la liste réelle, et les trois comptes sont distincts.
- **Réfutation du root-cause** : C4 propose « rattachement `categoryId` défaillant côté content-gen ». Or **aucun contenu n'a pu être créé depuis le 2026-07-24** (dernier job, D1 DB) et la production est arrêtée depuis le 2026-07-20 (kill switch). Aucun `categoryId` n'a donc pu être réparé entre les deux mesures : les articles étaient **déjà** correctement rattachés le 08-14.
- **Vraie cause** : une copie **périmée** servie au moment de la mesure. Headers relevés à 02:23 UTC sur `blog-coaching-1-to-1` : `Cache-Control: s-maxage=3600, stale-while-revalidate=31532400`, **`x-nextjs-cache: STALE`**, `cf-cache-status: EXPIRED`. Avec un SWR d'un an, une version bâtie sous le stub `stub.invalid` peut être servie très longtemps ; et le sweep du job `warm` (`.github/workflows/deploy-coolify.yml:827-862`) parcourt les URLs du sitemap **en GET simple** — chauffer une page ISR `STALE` re-cache la copie vide chez Cloudflare pour `s-maxage=3600`. C'est la mécanique H1-(a), appliquée aux hubs catégorie.
- **Danger du patch** : « corriger l'assignation catégorie dans les générateurs (ou **backfill `categoryId` par heuristique de slug**) » = un UPDATE de masse sur une donnée saine, avec risque de re-catégoriser 84 articles à tort. Alternative également prescrite (« gater les hubs vides hors sitemap/noindex ») : inutile, les hubs ne sont pas vides.
- **Verdict** : **RÉFUTÉ**. À requalifier en instance du problème connu de gel edge/ISR (H1-(a)/(b)) — les hubs `/blog/categorie/*` méritent de rejoindre la liste de revalidation + purge ciblée du job `warm`, comme `/fr/actualites` et consorts.

### C4-P1 — Chaînes de redirection doubles dans les corps persistés — **CONFIRMÉ (doublon partiel C3-P2)**

- **Preuve live** : l'article Montmorency porte `href="/interventions/essentielle"` → 301 → 308 → `/fr/formations` (chaîne mesurée par C3 à 18:05 UTC, mécanisme inchangé).
- **Doublon** : recouvre C3-P2 « chaînes à 2 sauts ». À fusionner en synthèse — un seul patch (mise à jour des prompts `v7-phase8-*` + réécriture au rendu) résout les deux.
- **Verdict** : CONFIRMÉ.

### C4-P1 — Hub `/fr/implantations` : 8,8 MB, ~78 % de liens vers du noindex — **CONFIRMÉ**

- **Preuve live (02:32 UTC)** : `size_download = 8 792 194 o` — chiffre identique au relevé de C4 à l'octet près.
- **Réserve forte sur le patch** : « ne lier que les villes tier-1 » retire ~1 677 liens internes qui irriguent aujourd'hui des pages `noindex, follow`. C4 le signale, je le souligne : **ce patch doit être co-signé par D4** (il change la profondeur de crawl de tout l'îlot pSEO) et n'a de sens qu'après arbitrage du tiering. Ne pas le traiter comme un « nettoyage ».
- **Verdict** : CONFIRMÉ, patch à séquencer après D4.

### C5-P1 — `/galerie` : canonical auto-référente sur query arbitraire + variantes 0-résultat indexables — **CONFIRMÉ**

- **Preuve live (02:35 UTC)** :
  `GET /fr/galerie?utm_source=test&foo=bar123` → 200, `robots index, follow, max-image-preview:large`,
  `canonical = https://axion-ia.com/fr/galerie?utm_source=test&foo=bar123` — **un paramètre totalement inventé (`foo`) est recopié dans la canonical**.
  `GET /fr/galerie?module=nimportequoi` → 200, corps « 0 image », `canonical = …?module=nimportequoi`, `index, follow`.
- **Verdict** : CONFIRMÉ, c'est bien un espace d'URLs indexables non borné, ouvrable par n'importe quel lien externe. P1 maintenu. Le patch est bien cadré et les do-not-touch sont justes.

---

## SQUAD D

### D1-P0 — « Machine à contenu à l'arrêt depuis 21 jours » — **RÉFUTÉ comme finding nouveau ; sous-partie CONFIRMÉE en P2**

- L'arrêt est la **conséquence directe d'un reste-Will déjà acté** (recharge du compte OpenAI, revue console #533 ; décision 10 du prompt maître : « ne pas répéter un reste Will déjà acté »). D1 le reconnaît lui-même (§ root-cause) mais garde le titre et la cote **P0**, ce qui le fera remonter en tête de la synthèse comme s'il s'agissait d'une découverte.
- **Ce qui survit** — vérifié ligne à ligne dans `src/server/queue/workers/content-monitoring-worker.ts:359-384` : la branche `update` de l'upsert réécrit `detectedAt: new Date().toISOString()` à **chaque** tick, et le message est **codé en dur** « aucune génération lancée depuis **4 h** » (`:355-357`) quelle que soit l'ancienneté réelle. Un arrêt de 21 jours s'affiche donc « depuis 4 h » — défaut réel, mais purement **observabilité**, sans effet GEO propre.
- **Verdict** : le finding tel que titré est **RÉFUTÉ** (P0 injustifié) ; la sous-partie « `detectedAt` écrasé + message figé à 4 h » est **CONFIRMÉE en P2**.

### D1-P0 — Mix d'intentions cassé (sampler modulo × poids fractionnaires) — **CONFIRMÉ, le finding le plus solide de la squad D**

- **Preuve code re-vérifiée ligne à ligne** — `src/server/queue/workers/content-orchestrator-worker.ts:87-95` :
  ```
  const total = entries.reduce((a, [, w]) => a + w, 0);
  const position = (slotIndex + seed) % total;
  ```
  Avec la config prod en fractions (somme 1), `total = 1` et `slotIndex + seed` entier → `position ≡ 0` → la boucle retourne **toujours la première clé** (`informational`, première propriété de `globalIntentMix` construit `:669-675`). Le commentaire `:660-661` (« l'échelle n'a pas d'importance ») est **faux pour ce sampler** : c'est le seul endroit du code où l'échelle est déterminante.
- **Vérification forensique du chiffre historique** : sous l'ancienne config (`commercial` perdu, `total = 0,75`), `n % 0,75` cycle sur {0 ; 0,25 ; 0,5} ; les cumuls (`informational` 0,4 → 0,4 → 0,5 → 0,65) donnent {info, info, transactional} = **2:1**. D1 mesure **1 295 / 647 = 2,002:1** en base. La correspondance est exacte : le diagnostic est prouvé, pas inféré.
- **Statut** : bug **dormant mais armé**. Il ne saigne pas aujourd'hui (rien ne génère), mais il produira **100 % d'`informational`** dès le premier tick après rallumage — donc zéro contenu `local` (pas de `hasLocalBusinessJsonLd`) et zéro `commercial_investigation`, sur une campagne géographique.
- **Verdict** : **CONFIRMÉ**. Je requalifie non pas à la baisse mais en **prérequis de rallumage** : à patcher AVANT que Will recharge OpenAI, sinon 3 semaines de production seront perdues sur un seul intent.

### D1-P1 — Plancher de cadence à 96 jobs/jour — **CONFIRMÉ**

- **Preuve code re-vérifiée** — `content-orchestrator-worker.ts:773-775` :
  `Math.max(1, Math.ceil(((campaign.dailyArticles ?? 30) as number) / 96))`. Pour tout `dailyArticles ∈ [1..96]` → 1 job/tick × 96 ticks/jour = **96/jour plancher**. Aucun décompte quotidien en mode per-campaign (l'anti-burst n'existe qu'en mode per-type, inactif : `dailyTargetByType = {}`).
- **Verdict** : CONFIRMÉ. Comme D1-P0-2, c'est un **prérequis de rallumage** (le ×4,8 a directement contribué à l'épuisement du quota qui a déclenché le kill switch).

### D1-P1 — Aucune rétroaction échec → cadence — **CONFIRMÉ, requalifié P1 → P2**

- Le fait est exact (la boucle de tick `:725-812` ne lit aucun taux d'échec). Mais une fois D1-P1 ci-dessus corrigé (cap quotidien réel) et le quota rechargé, le scénario « 101 jobs/j à 100 % d'échec » devient largement moins probable. C'est une **défense en profondeur**, pas la cause. Le seuil proposé (« > 80 % failed sur 1 h ») est de surcroît le genre de garde-fou qui **gèle la production** s'il est mal calibré — risque de régression sous-estimé à « moyen ».
- **Verdict** : CONFIRMÉ (P2), à traiter après le cap de cadence.

### D1-P1 — Cadence pilotée = jobs créés, jamais contenus publiés — **CONFIRMÉ, requalifié P1 → P2**

- Exact et bien argumenté, mais c'est de l'**observabilité pure** (bandeau + Telegram). Aucun effet GEO direct. P2.
- **Verdict** : CONFIRMÉ (P2).

### D2-P0 — Le tier est écrasé en dur au publish — **CONFIRMÉ, mais le PATCH RENVERSE UNE DÉCISION WILL**

- **Preuve code re-vérifiée** — `src/server/queue/workers/content-publish-worker.ts:618` : `const indexationTier = "tier_1_indexable";`. Les lignes **602-606** juste au-dessus portent la décision : « *Décision Will 2026-06-17 (audit indexation) : tout contenu GÉNÉRÉ + PUBLIÉ doit être automatiquement indexable […] (`promoteToTier1` reste loggué pour la traçabilité mais **ne gate plus le tier**.)* ».
- **Preuve live (02:39-02:41 UTC)** : `/fr/blog/coaching-ia-dirigeant-champs-sur-marne` → 200, `robots index, follow`, export markdown = **195 mots au total** (footer de provenance compris), et le slug apparaît **3 fois** dans `sitemap-blog.xml`. Le seuil soft-404 est de 350 mots. Symptôme intégralement reproduit.
- **Arbitrage adversarial** : le fait est confirmé, mais le patch prescrit (`promoteToTier1 ? "tier_1_indexable" : "tier_2_noindex_follow"`) **annule explicitement la décision Will du 2026-06-17**. Ce n'est pas dans la liste des 11 décisions du prompt maître, donc pas un faux positif d'office — mais c'est un **STOP & ASK obligatoire**, pas « S (2 lignes) ». D2 ne réserve le STOP & ASK qu'à la re-qualification rétroactive ; le renversement de doctrine lui-même passe sous silence.
- **Reformulation que je recommande à la synthèse** : la décision 2026-06-17 est **cohérente avec sa jambe complémentaire** de 2026-06-21 (naissance tier-1 + **démote CTR** par `content-tier-lifecycle`, documentée aux lignes 608-617 du même fichier). Or cette jambe est **gelée par le kill switch** (`content-tier-lifecycle-worker.ts:151-157`, vérifié). Le trou réel n'est donc pas « le tier est écrasé » mais **« l'élagage prévu n'a jamais tourné »**. Réparer l'élagage préserve la décision de Will ; renverser la naissance tier-1 la contredit.
- **Arbitrage du conflit D2 ↔ D3** : D3 affirme en résumé que « le soft-404 interdit le tier_1 même en tout indexable » (`content-gen-worker.ts:1221-1222`). **D2 a raison, D3 a tort** : le calcul est juste à cet endroit, mais son résultat est écrasé une étape plus loin au publish. La ligne du tableau des gates de D3 est à corriger.
- **Verdict** : **CONFIRMÉ (fait) / patch à requalifier STOP & ASK**.

### D2-P0 — 40 % du corpus indexé sous le plancher de longueur — **CONFIRMÉ**

- **Preuve live indépendante (02:40 UTC)** : l'article plancher cité (`coaching-ia-dirigeant-champs-sur-marne`) mesure **195 mots** via `/api/markdown/blog/…` (D2 annonçait 173 mots de corps ; l'écart est du boilerplate de l'export, cohérent). Indexable et en sitemap.
- **Preuve code re-vérifiée** : l'appel d'expansion de `expand-outline-chunked.ts:84-97` ne passe pas `responseFormatJson: true` alors que l'appel PLAN (`blog-article.ts:217-229`) le fait — asymétrie réelle ; et le `catch` fixe `chunkBody = ""` sans `logStep`.
- **Réserve sur le patch** : le geste 1 (activer JSON mode) est signalé par D2 comme pouvant basculer certains modèles sur le fallback Anthropic. **Ce fallback n'existe plus** : `provider-router.ts:118` fixe `text: [openaiProvider]` (retrait acté Will 2026-07-09, relevé par D6). Le risque annoncé est donc **surestimé** — mais il faut vérifier que le modèle OpenAI utilisé supporte bien `response_format` avant merge.
- **Verdict** : CONFIRMÉ.

### D2-P0 — 26 % du corpus porte une statistique propriétaire fabriquée ou un cas client anonyme — **CONFIRMÉ, le plus grave du lot**

- **Preuve live (2026-08-15 02:44 UTC)** sur `/fr/blog/formation-ia-clichy-sous-bois-optimisez-competences`, servi indexable :
  > « Les avantages de nos formations **68 % des équipes formées par Axion-IA intègrent l'IA dans au moins un processus quotidien sous trois mois.** »
  et, plus loin, « Nous **mesurons** l'impact de nos formations avec quatre indicateurs clés… ».
- **Preuve code re-vérifiée** : `FABRICATED_STAT_PATTERNS` exige le token littéral `Axion-?IA` accolé à « données/mesures/… » ou les formes « source interne / étude interne / n= / évaluations 20XX ». La formulation ci-dessus (« nos formations 68 % … par Axion-IA ») **ne matche aucune** de ces regex. Et même si elle matchait, elle serait `blocking` non-`hardFault` : `content-gen-worker.ts:823-828` ne retient que `SIREN/SIRET/RCS` (vérifié texto).
- **Ce n'est PAS une conséquence de la machine éteinte** : le contenu est en ligne, indexable, et le restera. C'est un risque **E-E-A-T + publicité trompeuse** (recoupe la doctrine CGV = obligation de moyens, décision 8).
- **Réserve sur le patch** : les regex proposées ont un vrai potentiel de faux positifs (« selon notre lecture du rapport DARES »). Livrer avec des exceptions dans `DOCTRINE_EXCEPTIONS`, et **tester à blanc sur les 129 articles avant activation**.
- **Verdict** : **CONFIRMÉ**, P0 maintenu — et je remonterais sa priorité au-dessus de D2-P0-1, car il ne dépend d'aucun arbitrage de doctrine.

### D2-P1 — Guides pilier : ni sommaire ni `HowTo` — **CONFIRMÉ**

- **Preuve live (02:57 UTC)** sur `/fr/guides/guide-audit-ia-grenoble` : JSON-LD servi = **`"@type":"Article"`** uniquement ; **zéro** `HowTo`, zéro `HowToStep`.
- **Tentative de réfutation du volet « pas de sommaire »** : le HTML contient bien la chaîne `toc` — mais vérification faite (03:00 UTC), ce sont **exclusivement des noms de classes CSS** du stylesheet inliné (`.group-hover\/toc\:text-fg`), aucun sommaire rendu. Le finding tient.
- **Verdict** : CONFIRMÉ.

### D2-P1 — `qa_derived` : `QAPage`, microdata et wrapper détruits par le sanitizer — **INCERTAIN**

- Je n'ai pas pu isoler en prod une page servie par le générateur `qa_derived` (pas d'accès DB pour lister les slugs par `contentType`, et rien ne distingue ces pages dans les sitemaps). Le raisonnement code de D2 est plausible (`html-sanitizer` retirant `itemscope`/`itemprop`), mais je n'ai ni relu ligne à ligne l'allowlist ni reproduit le symptôme.
- **Verdict** : **INCERTAIN** — « je n'ai pas pu vérifier » ≠ réfuté. À trancher par un `SELECT slug FROM articles WHERE "sourceGeneratorId" = 'qa_derived' LIMIT 3` puis curl.

### D2-P1 — Formats extractibles quasi absents (listes/tableaux/chiffres-clés) — **INCERTAIN**

- Constat de corpus (balayage de 129 exports markdown) que je n'ai pas ré-exécuté. Plausible au vu de l'article de 195 mots inspecté, mais le pourcentage n'est pas re-vérifié.
- **Verdict** : INCERTAIN (méthode saine, résultat non reproduit).

### D2-P1 — `<p data-aeo="answer">` absent sur 13 % des sections — **INCERTAIN** (même raison).

### D2-P1 — Double bloc « Sources » — **CONFIRMÉ**

- **Preuve live (02:53 UTC)** sur `/fr/blog/audit-ia-venissieux-comprendre-optimiser` : le HTML porte **à la fois** un `<h2 id="sources" data-speakable="true">Sources</h2>` issu du corps ET un bloc composant **« Sources & méthodologie »**. Le même lien `francecompetences` apparaît **2 fois** (une par bloc) — preuve directe de la duplication.
- **Verdict** : CONFIRMÉ. Effet secondaire réel sur le compteur de H2 du scorer et sur l'`ItemList`.

### D3-P1 — Doctrine « block » ≠ blocage réel — **CONFIRMÉ, impact requalifié fort → moyen**

- **Preuve code re-vérifiée texto** — `src/server/queue/workers/content-gen-worker.ts:823-828` :
  ```
  const doctrineHardFaults = doctrine.blockingViolations.filter(
    (v) => v.pattern === "SIREN/SIRET/RCS" ||
      (hardFaultGate.retainNonSsotPrice === true && v.pattern.startsWith("prix-non-SSOT:")),
  );
  ```
  CPF, financement, partenariat fabriqué, stat fabriquée ne sont effectivement **pas** dans le filtre. Le log l.834 le dit sans détour : « Doctrine hard-fault OK (**SIREN/prix**) ».
- **Requalification d'impact** : D3 cote « fort » en écrivant « une mention CPF publiée = revendication illégale sur URL vivante ». Nuance : le contenu fautif sort en `tier_3_noindex_nofollow`, **hors sitemaps, hors feeds, hors listings** (D3 le vérifie lui-même). Le risque est donc juridique/réputationnel (URL atteignable par un crawler IA autorisé), **pas** un risque d'indexation. → **moyen**, avec un caveat : combiné à D2-P0-1, un contenu au score ≥ 75 sort en `tier_1_indexable` malgré la violation — c'est **là** que l'impact redevient fort. Les deux findings doivent être livrés ensemble ou pas du tout.
- **Preuve d'occurrence** : aucune. D3 marque lui-même [À CONFIRMER] faute de DB, et je n'ai pas pu la lever.
- **Verdict** : CONFIRMÉ (mécanisme), impact moyen isolément / fort couplé à D2-P0-1.

### D3-P1 — Multi-judge inerte sur les 7 générateurs principaux — **CONFIRMÉ**

- **Preuve code re-vérifiée** — grep `runMultiJudge` sur `src/` : `multi-judge-ensemble.ts:142` (définition), `quality/index.ts:29` (ré-export), `generators/v7-phase8-shared.ts:52,407` (**unique appelant réel**). Zéro appel depuis `content-gen-worker.ts`. Le flag `MULTI_JUDGE_ENABLED=true` mesuré en prod donne bien une fausse assurance de couverture.
- **Réserve sur le patch** : brancher le multi-judge sur le chemin principal **ajoute une dépendance OpenAI au moment même où le quota est le facteur limitant** (D1). À livrer avec le fail-soft de `judge-outcome.ts` et à activer **après** la recharge, pas avant.
- **Verdict** : CONFIRMÉ.

### D3-P1 — Banned-phrases « block » sur des mots courants — **INCERTAIN**

- D3 marque lui-même [À CONFIRMER] : le seed ne tourne pas au deploy (`banned-phrases.ts:152-153`), donc l'état effectif de la table `banned_phrases` en prod est inconnu, et le taux de déclassement causé l'est aussi. Je n'ai pas d'accès DB.
- **Verdict** : **INCERTAIN**. À noter qu'il est en **tension directe** avec D3-P1-1 (l'un dit « la gate ne bloque pas assez », l'autre « elle bloque trop ») — il faut la mesure DB avant de toucher à quoi que ce soit.

### D4-P0 — 455 pages `/sites-web-augmentes/par-ville/*` indexables et indécouvrables — **CONFIRMÉ**

- **Preuve live (02:47 UTC)** : `/fr/sites-web-augmentes/par-ville/oyonnax` → **200, 1 207 020 octets**, `<meta name="robots" content="index, follow">`, `canonical` **auto-référente**.
  `sitemap-index.xml` (02:56 UTC, 38 sous-sitemaps) : **0** occurrence `services-villes`.
- Le contraste avec les satellites correctement gérés est net : `/fr/formations/par-ville/albertville` sert `noindex, follow` + `canonical → /fr/formations/par-ville/annecy` (hub-and-spoke). Les pages `sites-web` sont bien dans le « pire des deux mondes » décrit.
- **Verdict** : CONFIRMÉ. D4 a raison d'en faire un **STOP & ASK** : la voie B contredirait la décision documentée du 2026-06-20, et la voie A annonce +455 URLs d'un coup alors que F2 mesure une dégradation de position. L'ouverture par vagues est la seule variante défendable.

### D4-P1 — `X-Robots-Tag` absent sur `/formations/par-ville/*` et `/un-a-un/par-ville/*` — **CONFIRMÉ**

- **Preuve live (02:46 UTC)**, mesures croisées sur la même ville :
  | URL | Statut | `x-robots-tag` | `<meta robots>` |
  |---|---|---|---|
  | `/fr/audit/par-ville/albertville` | 200 | **`noindex, follow`** | — |
  | `/fr/formations/par-ville/albertville` | 200 | **absent** | `noindex, follow` |
  | `/fr/un-a-un/par-ville/albertville` | 200 | **absent** | `noindex, follow` |
- **Vérification du « pas de fuite d'indexation »** : confirmée — la page `formations` sert bien `<meta name="robots" content="noindex, follow">` + `canonical → /fr/formations/par-ville/annecy`. D4 a correctement calibré l'impact à « moyen (crawl-budget, pas d'indexation fautive) » : **pas d'inflation**.
- **Réserve majeure sur le patch** : étendre `INDEXABLE_SERVICE_VILLE_SLUGS` avec un set `sitesWeb` de **455 slugs saisis à la main** mettrait `noindex` sur des pages indexables au moindre oubli — le faux positif que le fichier qualifie lui-même de « CRITIQUE ». Le set **doit** être généré, comme `indexable-villes.ts`. À marquer en gras dans le plan de patches.
- **Verdict** : CONFIRMÉ.

### D4-P1 — 65 % des meta-descriptions villes partagent leurs 80 premiers caractères — **CONFIRMÉ (méthode et code)**

- Le code cité est cohérent (`page.tsx:174-181` reprend `directAnswerFr`, `seoHook` n'alimente que le title). Le comptage 1 854/2 153 et 308/476 provient d'une analyse statique des fichiers copy que je n'ai pas ré-exécutée ; les 4 échantillons live de D4 sont probants.
- **Verdict** : CONFIRMÉ. Nuance sur l'impact « fort » : Google réécrit largement les meta-descriptions dupliquées — le gain attendu porte sur le CTR des snippets non réécrits, pas sur le rang. **moyen-fort** serait plus juste.

### D4-P1 — H1 identique sur 2 157 pages villes — **CONFIRMÉ**

- Constat vérifiable au code (`page.tsx:599-612`) et cohérent avec les 4 pages live de D4. Le point le plus fort du finding est le **`data-speakable-hero` posé sur une question rhétorique** — c'est un vrai défaut AEO, indépendant du débat éditorial sur l'accroche.
- **Réserve** : changer le H1 de 2 157 pages touche la hauteur du héros → **CLS = 0 est un budget strict** (AGENTS.md). Vérification G1 obligatoire avant merge, comme D4 le note.
- **Verdict** : CONFIRMÉ.

### D4-P1 — JSON-LD des pages villes 100 % JavaScript — **CONFIRMÉ, doublon de l'acquis H1-(d)**

- Le fait est établi et déjà arbitré : l'acquis (d) de la session principale fixe la portée à **~480 pages villes déclarées** (les par-ville sont hors sitemap, décision Will 2026-06-20). D4 énonce « 480 + 623 pages », ce qui est compatible.
- **Verdict** : CONFIRMÉ, **à fusionner** avec le finding transverse H1 en synthèse (ne pas le compter deux fois dans le scoring).

### D4-P1 — 95/480 pages indexées portent un défaut qualité auto-déclaré — **CONFIRMÉ, patch à requalifier STOP & ASK**

- Le constat (headers `Quality score: NN` < 75 dans `src/content/villes/copy/*.ts`, croisés avec `low-quality-villes.json`) est vérifiable statiquement et D4 fournit un exemple live (`alfortville` = 200, `index, follow`, en sitemap).
- **Réserve dirimante** : le patch prescrit **rétracte l'indexation de 95 URLs déjà connues de Google** et contrarie l'invariant « monotone croissant » documenté (`villes/index.ts:224-227`). D4 le marque STOP & ASK — je le confirme et j'ajoute : la variante « sortir du sitemap sans toucher aux `<meta>` » est la seule à ne pas casser l'invariant, et devrait être présentée comme l'option par défaut, pas comme l'alternative.
- **Verdict** : CONFIRMÉ (fait), patch à n'appliquer qu'après arbitrage Will.

### D4-P1 — Garde anti-doorway qui mesure les fichiers, pas le rendu — **CONFIRMÉ**

- Le raisonnement est solide et recoupe la règle maison « une garde ne vaut que si elle rougit ». Le fait qu'aucun de ces scripts ne soit référencé dans `package.json` ni `ci.yml` est vérifiable statiquement et rend la garde structurellement incapable de rougir.
- **Verdict** : CONFIRMÉ. Les seuils proposés (shingles uniques < 20 %, Jaccard masqué > 0,55) sont à livrer **en mode informatif d'abord** comme D4 le prescrit — un gate bloquant calibré à l'aveugle sur 480 pages rougirait immédiatement.

### D5-P1 — La KB absente du canal llms.txt — **CONFIRMÉ**

- **Preuve live (02:55 UTC)** : `curl https://axion-ia.com/llms.txt | grep -in connaissances` → **une seule ligne**, la 30 : `## Connaissances & contenu` (le titre de section). **Aucune URL `/fr/connaissances`**.
- **Contre-mesure de la valeur du canal (02:55 UTC)** : `sitemap-knowledge.xml` = **507** `<loc>`. Il y a donc bien 507 fiches publiques invisibles du canal d'ingestion IA.
- **Verdict** : CONFIRMÉ. L'étage 1 du patch (une ligne statique) est le meilleur rapport effort/impact de la squad D.

### D5-P1 — 100 % du corpus KB sous les seuils de sa propre quality-gate — **CONFIRMÉ**

- **Corroboration live (02:56 UTC)** : `/fr/connaissances/kb-fact-roi-ia-009-fr` — les seuls `<h2>` du HTML sont ceux du gabarit (« Sources », « À lire aussi », « Mettre en pratique »), **aucun H2 dans le corps de la fiche**, cohérent avec le `count(*) FILTER (WHERE body ~* '<h2')` = 0 mesuré en base par D5.
- **Verdict** : CONFIRMÉ. Précision utile : c'est le cas d'école du **piège inverse** signalé dans ma mission — la gate `ingestEntry` n'a **jamais** tourné (`knowledge_ingest_requests` = 0 ligne), donc son bon fonctionnement n'est **pas** prouvé pour autant. Le patch option 3 de D5 (faire tourner `runHeuristicGates` en batch read-only) est la bonne première étape.

### D5-P1 — Hub `/connaissances` orphelin, 48/507 fiches — **CONFIRMÉ (doublon C4-P2)**

- **Preuve live (02:55 UTC)** : `/fr/connaissances` porte exactement **48** liens `/fr/connaissances/<slug>` distincts, face à **507** URLs dans le sitemap. Chiffres reproduits à l'unité près.
- **Doublon** : identique au P2 de C4 (« hub KB : 48 entrées liées sur 507 »). À fusionner.
- **Verdict** : CONFIRMÉ.

### D6-P0 — URLs de citation malformées (backtick) — **CONFIRMÉ, et plus grave que décrit**

- **Preuve live (2026-08-15 02:50 UTC)** sur `/fr/blog/audit-ia-venissieux-comprendre-optimiser` :
  `href="https://www.francecompetences.fr/recherche/rncp/\`"` — **2 occurrences** dans le HTML.
- **Aggravation trouvée par H2 (02:58 UTC)** : le backtick est **aussi dans le JSON-LD servi**, dans les deux champs :
  ```
  "@type":"CreativeWork","url":"https://www.francecompetences.fr/recherche/rncp/`","name":"https://www.francecompetences.fr/recherche/rncp/`"
  ```
  L'URL malformée n'est donc pas seulement visible à l'écran : elle est **déclarée comme citation machine-readable**, exactement le champ que les moteurs génératifs ingèrent pour évaluer le sourcing.
- **Verdict** : **CONFIRMÉ, renforcé**. Le patch 1 (nettoyage du catalogue) reste le seul strictement nécessaire ; le garde-fou regex dans `passesHardFilters()` est justifié.

### D6-P0 — Le JSON-LD affirme une supervision humaine inexistante — **CONFIRMÉ**

- **Preuve live (2026-08-15 02:52 UTC)** sur la même page, comptage exact :
  `"supervisé par l'équipe Axion-IA"` → **2 occurrences** ;
  `"contrôlé automatiquement avant publication"` → **2 occurrences**.
  Les deux affirmations contradictoires cohabitent dans la même réponse HTTP, et c'est la **fausse** qui est machine-readable (`disambiguatingDescription`).
- **Point de conformité corroboré** : D6 signale que la mention « Anthropic » est périmée pour la rédaction (`provider-router.ts:118` → `text: [openaiProvider]`, retrait acté Will 2026-07-09). Confirmé par recoupement avec D1, qui mesure en base des erreurs « Anthropic API 400 » **jusqu'au 24/07** — c'est-à-dire que le fallback était encore câblé en dur dans l'orchestrateur (`content-orchestrator-worker.ts:299-300`) après son retrait du router. Divergence à signaler, mais hors périmètre de ce finding.
- **Verdict** : **CONFIRMÉ**, P0 maintenu (AI Act art. 50 + E-E-A-T). Patch S, risque quasi nul.

### D6-P1 — 54 % des liens éligibles ont un intitulé inexploitable — **CONFIRMÉ**

- **Preuve live (02:58 UTC)** — les 4 `CreativeWork` servis sur l'article Vénissieux :
  | `url` | `name` |
  |---|---|
  | `https://www.cnam.fr/formation/…/intelligence-artificielle-2` | **URL brute** |
  | `https://www.francecompetences.fr/recherche/rncp/\`` | **URL brute (+ backtick)** |
  | `https://dares.travail-emploi.gouv.fr/` | `DARES — Études statistiques travail-emploi` ✅ |
  | `https://www.francetravail.fr/` | `France Travail (ex Pôle Emploi)` ✅ |
  Soit **2/4 (50 %)** d'intitulés = URL brute sur cet échantillon, très proche des 54 % annoncés.
- **Verdict** : CONFIRMÉ.

### D6-P1 — `organization` = hostname en MAJUSCULES sur 299/328 liens — **INCERTAIN**

- **Tentative de reproduction (02:59-03:01 UTC)** : recherche de hostnames en capitales dans le HTML servi de l'article Vénissieux (`[A-Z][A-Z0-9.-]{6,}\.(FR|COM|EU|ORG|GOUV\.FR)`) → **0 occurrence**. Les seules majuscules trouvées sont des acronymes légitimes (`DARES` ×6). Aucun champ `publisher` dérivé de `organization` n'apparaît dans le JSON-LD servi de cette page.
- Le constat de D6 porte sur le champ `organization` du **catalogue statique** ; je n'ai pas pu établir qu'il atteint le JSON-LD rendu, ce qui est pourtant le cœur du symptôme annoncé (« → `publisher` JSON-LD illisible »).
- **Verdict** : **INCERTAIN** — le fait catalogue est probablement exact, la **conséquence rendue** n'est pas prouvée. À re-tester sur une page dont les citations proviennent d'entrées `auto-seeded` récentes avant de chiffrer l'impact.

### D6-P1 — Monitor de fraîcheur des liens écrivant en système de fichiers éphémère — **CONFIRMÉ (sur le code)**

- Le mécanisme (écriture dans un FS de container reconstruit à chaque deploy) est structurellement vrai dans le contexte ADR 0026 (image reconstruite, container recréé). Je n'ai pas re-lu le fichier ligne à ligne.
- **Verdict** : CONFIRMÉ, avec la réserve que je m'appuie sur la cohérence architecturale plus que sur une relecture exhaustive.

### D6-P1 — « Dernière vérification : <date de l'article> » ne dit pas la vérité — **CONFIRMÉ**

- Défaut de véracité affiché, cohérent avec le finding précédent (le catalogue est figé au 2026-05-22, l'affichage suggère une vérification à la date de l'article). Aucun élément ne le contredit.
- **Verdict** : CONFIRMÉ, P1 maintenu (c'est une affirmation E-E-A-T fausse, même famille que D6-P0-2).

### D6-P1 — Correction auto des chiffres réfutés sans bouger `dateModified` ni trace publique — **CONFIRMÉ, avec une nuance importante**

- Le fait est exact, **mais l'absence de bump de `dateModified` est cohérente avec la doctrine anti-date-gaming du projet** (rappelée par D7 : `content-refresh-worker.ts:17-19`, et par la décision actée 5 sur `datePosted`). Le vrai défaut n'est donc pas « ça ne bump pas `dateModified` » — c'est **« ça ne laisse aucune trace publique »** (pas de mention de correction, pas d'historique).
- **Verdict** : CONFIRMÉ, mais le patch **ne doit pas** consister à bumper `dateModified` : ce serait re-fabriquer de la fraîcheur, exactement ce que le projet s'interdit. Trace publique uniquement.

### D7-P1 — Worker anti-decay `content-refresh` triple-mort — **CONFIRMÉ, impact requalifié fort → moyen**

- **Preuve code re-vérifiée** : `grep "content-refresh|gsc-hcu-monitor"` sur `src/server/queue/queues.ts` → **aucune correspondance**. Il n'existe effectivement ni queue ni repeatable job pour ces deux workers. Triple-mort confirmé (flag OFF + zéro cron + zéro producteur).
- **Requalification** : D7 cote « fort » en invoquant la perte de citations IA due au decay. Or ce worker est **scan + alerte uniquement** (D7 le dit et l'inscrit même en do-not-touch : « ne pas ajouter de bump `updatedAt` »). Le rebrancher ne rafraîchit **aucun contenu** — il produit une liste de candidats, dont le traitement exige… la machine de génération, aujourd'hui éteinte. Impact réel immédiat : **moyen** (observabilité), fort seulement après rallumage.
- **Verdict** : CONFIRMÉ (P1 sur le fond, impact moyen), à séquencer après la recharge OpenAI.

### D7-P1 — Élagage tier-lifecycle inopérant faute de creds GSC au container worker — **RÉFUTÉ**

- **Réfutation par recoupement inter-rapports** : D8 mesure en prod à **18:36 UTC le 08-14** que « les 4 env vars `GSC_OAUTH_*` + `GSC_PROPERTY_URL` sont **bien présentes dans les containers web ET worker** — les credentials ne sont PAS le blocage » (`D8-strategie-mots-cles.md`, finding « kill-switch OpenAI gèle aussi le sync GSC »). D7 marquait sa propre affirmation **[À CONFIRMER côté env Coolify]** faute de mesure ; D8, lui, a mesuré.
- **Cause réelle établie** — `src/server/queue/workers/content-tier-lifecycle-worker.ts:149-157` :
  ```
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", { active: false });
  if (killSwitch.active) { console.log("[tier-lifecycle] kill switch active, skip run"); return; }
  ```
  Le cron quotidien 06:00 UTC **sort avant toute lecture GSC**. L'élagage est gelé par le kill switch, pas par des credentials manquants.
- **Danger du patch** : le patch ops prescrit (« vérifier/poser les 4 vars Coolify sur l'app worker + restart ») ferait **redémarrer le container worker pour rien**, et laisserait croire le problème résolu alors que l'élagage resterait gelé.
- **Verdict** : **RÉFUTÉ**. À remplacer par le vrai constat : *le kill switch gèle l'élagage tier-lifecycle* — même famille que D8-P1-3 (couplage kill-switch trop large). Le second volet du patch de D7 (log de démarrage « GSC creds present: yes/no ») reste utile en P2 et ne coûte rien.

### D7-P1 — Fraîcheur « actualités » gelée depuis 25 jours — **RÉFUTÉ comme finding nouveau ; sous-partie CONFIRMÉE en P2**

- **Preuve live (02:42 UTC)** : `sitemap-news-evergreen.xml` — `lastmod` max = **2026-07-20T06:01:06Z**. Le gel est réel et re-mesuré.
- **Mais c'est la conséquence directe du kill switch**, reste-Will déjà acté (décision 10). D7 le reconnaît explicitement puis maintient le titre en P1.
- **Ce qui survit** : le fait que le kill switch gèle **aussi** l'archivage news > 90 j et tout promote/demote, par un simple `console.log` invisible. C'est un effet de bord non documenté côté alerting → **P2**, et c'est le **même patch** que D8-P1-3 (découpler / alerter sur le périmètre du kill switch). À fusionner.
- **Verdict** : **RÉFUTÉ** comme finding ; **CONFIRMÉ en P2** pour le volet « effet de bord silencieux ».

### D8-P1 — La banque de 1 835 mots-clés n'a jamais alimenté une génération — **CONFIRMÉ**

- Preuve DB de D8 (`sum(usage_count) = 0`, `count(last_used_at) = 0` sur 1 835 rows depuis le 2026-06-16) : mesure directe, non contestable sans accès DB contradictoire. Le raisonnement code (deux chemins d'alimentation passant devant le sélecteur) est cohérent.
- **Piège inverse à noter** : le sélecteur atomique `FOR UPDATE OF k SKIP LOCKED` n'a **jamais tourné en prod** — sa correction n'est donc pas prouvée par l'usage. À garder en tête au moment de le brancher.
- **Verdict** : CONFIRMÉ.

### D8-P1 — « Qualiopi » banni de la banque sur une prémisse périmée — **CONFIRMÉ, le meilleur finding stratégique de la squad D**

- **Preuve code re-vérifiée texto** — `src/content/keywords/master.ts:55-57` : `BANNED_TERMS = ["OPCO", "Qualiopi", "CPF", …]`, justifié `:71-74` par « *2026-06-02 — Axion-IA n'a NI Qualiopi NI OPCO/CPF…* ».
- **Preuve live que la prémisse est périmée (03:03 UTC)** : `GET /fr/certification-qualiopi` → **200** ; le HTML de `/fr` (home) contient **116 occurrences** de « Qualiopi ». Le site revendique publiquement et massivement la certification que sa banque de mots-clés s'interdit de cibler.
- **Cohérence avec les décisions actées** : le patch proposé ne retire **que** le token `"Qualiopi"` et conserve explicitement les bans `OPCO` / `CPF` / `financement` / `subvention`. Il ne contredit donc **ni** la décision 7 (jamais de logo OPCO/France Travail/CPF), **ni** la décision 8 (CGV = obligation de moyens). Qualiopi ≠ finançabilité.
- **Verdict** : **CONFIRMÉ**. Je remonterais ce finding en tête du plan de patches côté stratégie : c'est un différenciateur commercial acquis, payé, affiché, et volontairement exclu du ciblage.

### D8-P1 — Le kill-switch OpenAI gèle aussi le sync GSC (gratuit) — **CONFIRMÉ**

- **Preuve code re-vérifiée texto** — `src/server/queue/workers/content-keyword-sync-worker.ts:60-69` : le `processJob` lit `kill_switch` et `return` **avant** tout appel. Le commentaire l.61-62 justifie le couplage par « GSC/SerpAPI quota+coût » — or l'API GSC est gratuite et le worker n'appelle aucun LLM.
- **Verdict** : CONFIRMÉ. C'est la **cause commune** de D7-P1-2 (élagage gelé), D7-P1-3 (lifecycle news gelé) et D8-P1-4 (détecteur en cascade). **Un seul patch de découplage** résout les quatre — à présenter ainsi en synthèse plutôt qu'en quatre lignes séparées.

### D8-P1 — Détecteur d'opportunités structurellement inerte — **CONFIRMÉ**

- **Preuve code re-vérifiée** — grep `axionOpportunity|axion_opportunity` sur `src/` → **une seule occurrence** : `keyword-opportunity-detector.ts:56` (`if (pos > 10 && tracking.axionOpportunity === "high")`). Le champ est **lu et jamais écrit**. Corroboré par la mesure DB de D8 (`axion_opportunity` NULL sur 64/64).
- **Ce n'est pas une conséquence de la machine éteinte** : le cron tourne depuis mai et n'aurait jamais rien produit même à plein régime. Défaut structurel réel.
- **Verdict** : CONFIRMÉ.

### D8-P1 — Le tracking GSC ne couvre que les Articles blog/news — **CONFIRMÉ**

- Le code cité (`content-keyword-sync-worker.ts:74-83`, `prisma.article.findMany`) restreint bien le sync aux Articles ; la mesure DB (15 `targetUrl` distincts, tous `/fr/blog/*` orientés Grenoble) le corrobore.
- **Verdict** : CONFIRMÉ. Le patch (liste statique des ~15 pages stratégiques — celles déjà nommées par le budget Web Vitals) est propre et réutilise une constante existante.

---

## Récapitulatif des verdicts

| Rapport | Findings P0/P1 | CONFIRMÉS | RÉFUTÉS | INCERTAINS |
|---|---|---|---|---|
| C1 | 3 | 3 (dont 2 requalifiés) | 0 | 0 |
| C2 | 2 | 2 | 0 | 0 |
| C3 | 2 | 2 (dont 1 partiel) | 0 | 0 |
| C4 | 7 | 6 | **1** | 0 |
| C5 | 1 | 1 | 0 | 0 |
| D1 | 5 | 4 (dont 3 requalifiés) | **1** | 0 |
| D2 | 8 | 5 | 0 | **3** |
| D3 | 3 | 2 (dont 1 requalifié) | 0 | **1** |
| D4 | 7 | 7 | 0 | 0 |
| D5 | 3 | 3 | 0 | 0 |
| D6 | 7 | 6 | 0 | **1** |
| D7 | 3 | 1 (requalifié) | **2** | 0 |
| D8 | 5 | 5 | 0 | 0 |
| **Total** | **56** | **47** | **5** | **4** |

### Les 5 réfutations

1. **C4-P1 « 3 hubs catégorie blog vides »** — hubs peuplés (84/15/6 articles, 02:22 UTC) ; root-cause `categoryId` invalidé ; patch de backfill SQL dangereux. Instance du gel edge/ISR H1-(a).
2. **D7-P1 « creds GSC absents du worker »** — contredit par la mesure live de D8 (vars présentes) ; vraie cause = kill switch (`content-tier-lifecycle-worker.ts:154-157`).
3. **D7-P1 « actualités gelées 25 j »** — conséquence du reste-Will acté ; seule survit la sous-partie « effet de bord silencieux du kill switch » (P2).
4. **D1-P0 « machine à l'arrêt 21 j »** — idem ; seule survit la sous-partie `detectedAt` écrasé + message figé « depuis 4 h » (P2).
5. **D4-P1 « JSON-LD villes 100 % JS »** — non réfuté sur le fond, mais **doublon** de l'acquis H1-(d) : à fusionner, pas à compter deux fois.

### Requalifications de sévérité proposées

| Finding | Cote d'origine | Cote H2 | Motif |
|---|---|---|---|
| C1 canonical hérité | P1 | **P2** | toutes les pages touchées sont noindex ou `Disallow` |
| C1 double suffixe | P1 impact moyen-fort | P1 impact **moyen** | volume réel ~296 pages, pas 870 |
| C3 `/en/book-a-call` | impact moyen-fort | impact **moyen-faible** | EN désactivé, hors sitemap, décision 1 |
| D1 rétroaction échec | P1 | **P2** | défense en profondeur ; seuil mal calibré = risque de gel |
| D1 cadence publiés | P1 | **P2** | observabilité pure |
| D3 doctrine « block » | impact fort | **moyen** isolément / fort couplé à D2-P0-1 | sortie en tier_3 hors sitemaps/feeds |
| D7 content-refresh | impact fort | **moyen** | worker scan+alerte, ne rafraîchit rien seul |
| D4 meta-descriptions | impact fort | **moyen-fort** | Google réécrit les descriptions dupliquées |

### Patches à ne PAS appliquer tels quels

1. **C4** — backfill SQL `categoryId` : donnée saine, ne rien toucher.
2. **D7** — poser les vars GSC sur le worker Coolify : elles y sont déjà, redémarrage pour rien.
3. **D2-P0-1** — `promoteToTier1 ? tier_1 : tier_2` : **renverse la décision Will du 2026-06-17** documentée en commentaire du fichier patché. STOP & ASK. Réparer d'abord la jambe d'élagage prévue par la même décision.
4. **D4-P1 X-Robots-Tag** — ne jamais saisir à la main le set de 455 slugs `sitesWeb` : le générer, sinon `noindex` sur des pages indexables (faux positif « CRITIQUE » interdit par le fichier lui-même).
5. **D4-P1 20 % qualité villes** — la variante « exclure du sitemap sans toucher aux `<meta>` » doit devenir l'option par défaut : l'autre casse l'invariant d'indexation monotone.
6. **D6-P1 corrections auto** — ne PAS bumper `dateModified` (doctrine anti date-gaming) ; trace publique seulement.
7. **D3-P1 doctrine + D2-P0-3 regex** — à livrer ensemble et à tester à blanc sur les 129 articles ; D3-P1-3 (banned-phrases trop rouge) est en **tension directe** avec D3-P1-1 : exiger la mesure DB avant toute bascule de severity.

### Doublons à fusionner en synthèse

- C4-P1 « chaînes doubles » ≡ C3-P2 « chaînes à 2 sauts ».
- D5-P1 « hub /connaissances 48/507 » ≡ C4-P2 « hub KB 48/507 ».
- D4-P1 « JSON-LD villes JS » ≡ acquis H1-(d).
- **D7-P1-2 + D7-P1-3 + D8-P1-3 + D8-P1-4** : quatre symptômes, **une seule cause** (périmètre du kill switch trop large) et **un seul patch**.
- D2-P0-1 **arbitre** la ligne fausse du résumé de D3 (« le soft-404 interdit le tier_1 ») : D3 à corriger.

---

## Mesures brutes H2 (2026-08-15, UTC)

| # | Heure | Mesure | Résultat |
|---|---|---|---|
| 1 | 02:07:01 | `GET /fr/audit` headers | `link:` fr + **en** + **x-default sans locale** ; `x-axion-build-sha f51d544b…` ; `x-nextjs-cache: HIT` |
| 2 | 02:09 | `/audit` · `/en/audit` · `/fr/components` | 301→`/fr/audit` · 301→`/fr/audit` · 200 |
| 3 | 02:11 | `/api/og?title=Test…` 1er fetch | `max-age=0, must-revalidate`, CF `DYNAMIC`, **1,985 s** |
| 4 | 02:12 | `/api/og?title=Test…` 2ᵉ fetch (même URL) | CF `DYNAMIC`, **2,026 s** → zéro cache |
| 5 | 02:12 | `/opengraph-image` | **2 `Cache-Control` contradictoires**, CF `DYNAMIC` |
| 6 | 02:12 | `/sitemaps/images-fr.xml` | **289** `<loc>` (dont 289 `/fr/galerie/`) — contre **867** le 08-14 à 18:07 |
| 7 | 02:13 | blog Grenoble og:image | Unsplash `w=1080` + `width 1200` / `height 630` |
| 8 | 02:16 | `/fr/diagnostic` · `/fr/components` | canonical `→ /fr` sur les deux ; components `index, follow` + titre home |
| 9 | 02:17 | `robots.txt` | `Disallow: /components` + `/fr/components` + `/en/components` dans 12 blocs |
| 10 | 02:15-02:22 | titres galerie | double suffixe 2/2 (hub + slug) |
| 11 | 02:20 | `/en/book` → `/en/book-a-call` → `/fr/appel-a-call` | 308 → 301 → **404** |
| 12 | 02:25 | `/fr/implementations` · `/fr/implementation` | **404** · 200 |
| 13 | 02:25 | `/fr/faq` hrefs `/fr/fr/*` | `feed.xml` ×1, `par-thematique` ×1 ; cible = **404** |
| 14 | 02:22-02:24 | hubs catégorie blog | formations **84** (« 84 article » affiché), coaching **15**, implementations **6**, audits **20** |
| 15 | 02:23 | headers hub coaching | `x-nextjs-cache: STALE`, `cf-cache-status: EXPIRED`, `SWR 31532400` |
| 16 | 02:27 | article Montmorency | `href="/implementations"` ×1, `/interventions/essentielle"` ×1, `/audit"` ×3 |
| 17 | 02:31 | `/fr/carrieres` | **54** `href="/carrieres/*"` locale-less |
| 18 | 02:32 | `/fr/implantations` | **8 792 194 octets** |
| 19 | 02:35 | `/fr/galerie?utm_source=test&foo=bar123` | 200, `index, follow`, canonical **avec `foo=bar123`** |
| 20 | 02:35 | `/fr/galerie?module=nimportequoi` | 200, « 0 image », canonical auto-référente, `index` |
| 21 | 02:39-02:41 | `coaching-ia-dirigeant-champs-sur-marne` | 200, `index, follow`, **195 mots**, 3 hits dans `sitemap-blog.xml` |
| 22 | 02:42 | `sitemap-news-evergreen.xml` | `lastmod` max **2026-07-20T06:01:06Z** |
| 23 | 02:44 | `formation-ia-clichy-sous-bois-…` | « **68 % des équipes formées par Axion-IA** … » servi indexable |
| 24 | 02:46 | `x-robots-tag` par-ville albertville | audit **présent** · formations **absent** · un-a-un **absent** ; meta `noindex` OK sur les 2 derniers |
| 25 | 02:47 | `/fr/sites-web-augmentes/par-ville/oyonnax` | 200, **1 207 020 o**, `index, follow`, canonical self |
| 26 | 02:56 | `sitemap-index.xml` | 38 sous-sitemaps, **0** `services-villes` |
| 27 | 02:50 | article Vénissieux | `href=".../rncp/\`"` ×2 |
| 28 | 02:52 | article Vénissieux | `supervisé par l'équipe` ×2 **vs** `contrôlé automatiquement` ×2 |
| 29 | 02:53 | article Vénissieux | `<h2 id="sources">` + bloc « Sources & méthodologie » = **double** |
| 30 | 02:58 | JSON-LD Vénissieux | 4 `CreativeWork` : 2 `name` = URL brute (dont 1 avec backtick), 2 propres |
| 31 | 02:59-03:01 | hostnames MAJUSCULES | **0** occurrence (seul `DARES` ×6, acronyme légitime) |
| 32 | 02:55 | `llms.txt` | 1 seule ligne « connaissances » = titre §30, **aucune URL** |
| 33 | 02:55 | `/fr/connaissances` · `sitemap-knowledge.xml` | **48** liens · **507** `<loc>` |
| 34 | 02:56 | `/fr/connaissances/kb-fact-roi-ia-009-fr` | aucun `<h2>` de corps |
| 35 | 02:57-03:00 | `/fr/guides/guide-audit-ia-grenoble` | JSON-LD = `Article` seul, **0** `HowTo` ; « toc » = classes CSS uniquement |
| 36 | 03:03 | `/fr/certification-qualiopi` · `/fr` | 200 · **116** occurrences « Qualiopi » |

---

## Limites

- **Aucun accès DB** : je ne suis pas dans la liste des agents DB-autorisés. Les findings dont la preuve unique est un SELECT (D1 sur les 1 942 jobs, D5 sur les word counts KB, D8 sur `usage_count`/`keyword_tracking`, D3 sur `banned_phrases`) sont validés sur la **cohérence code + corroboration live indirecte**, pas re-mesurés à la source. Je n'ai pu lever aucun des `[À CONFIRMER]` que ces rapports ont eux-mêmes posés.
- **D2-P1 `qa_derived`, formats extractibles, réponse directe** : je n'ai pas pu identifier en prod les pages issues du générateur `qa_derived` (rien ne les distingue dans les sitemaps) ni ré-exécuter le balayage des 129 exports markdown. Classés INCERTAINS, pas réfutés.
- **D6-P1 `organization` MAJUSCULES** : symptôme non reproduit sur l'unique article testé ; un seul échantillon ne réfute pas un scan statique de 328 liens. Classé INCERTAIN.
- **Analyses de corpus non ré-exécutées** : les taux de D4 (65 % de meta-descriptions, similarité Jaccard 0,52, 95/480 pages) reposent sur des scripts maison que je n'ai pas relancés (interdiction de charger la machine — Will dort). Verdicts fondés sur la cohérence du code cité et les échantillons live des rapports.
- **Chute du sitemap images (867 → 289)** : constatée, non expliquée. Hors périmètre C/D — à trancher par A4 ou la synthèse. Peut invalider d'autres chiffrages de volume basés sur `images-fr.xml`.
- **Aucune vérification GSC/Bing** : les impacts en impressions/clics cités par C1, D4, D5 (via F2) n'ont pas été recoupés à la source.
- **Prod en GET only**, aucune commande git, aucune écriture hors `_AUDIT/GEO-AEO-E2E-2026-08-14/`, aucun build, aucun test, aucun Lighthouse. Aucune commande ne m'a été refusée.
