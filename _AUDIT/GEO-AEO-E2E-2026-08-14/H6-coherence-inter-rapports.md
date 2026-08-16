# H6 — Cohérence inter-rapports : contradictions arbitrées, doublons fusionnés, liste canonique

- **Date d'exécution** : 2026-08-15, mesures live **02:25 → 02:32 UTC**
  (dernier atterrissage prod : 2026-08-14 **19:49:58 UTC** — toutes mes mesures sont
  à **T+6 h 35**, très au-delà de la fenêtre ISR/edge d'une heure).
- **Build servi pendant mes mesures** : `x-axion-build-sha: f51d544b64c8ad50fc870d87b9941d6ce5419d7e`
  — le même que celui mesuré par H1, H2, H3, H4 et H5. Toutes les mesures de la
  Phase 2 sont donc comparables entre elles sans biais de build.
- **Périmètre** : les 40 rapports A1→G4, les 2 addenda (A3, F6), les 5 rapports de
  contre-vérification H1→H5. **165 en-têtes de findings P0/P1** relevés par balayage
  systématique, plus les P2 dès qu'un agent H les a promus, dégradés ou fusionnés.
- **Méthode** : (1) relevé exhaustif des en-têtes de findings par grep sur les
  40 rapports ; (2) confrontation des chiffres, dates, volumes et verdicts portant
  sur le **même objet** ; (3) arbitrage de chaque divergence par relecture du code
  ou re-mesure live indépendante ; (4) consolidation sous identifiant unique.

---

## Résumé exécutif

**21 contradictions arbitrées · 25 doublons fusionnés en 15 identifiants ·
155 findings canoniques retenus (28 P0, 98 P1, 21 P2, 8 INCERTAINS) ·
8 findings éliminés.**

Cinq résultats structurants pour la Phase 3 :

1. **La « chute du sitemap images » n'existe pas.** 867 (C1) et 289 (H2) mesurent
   deux choses différentes du **même fichier inchangé** : chaque bloc `<url>` contient
   **3** occurrences de la chaîne `/fr/galerie/` (le `<loc>` + les 2 `xhtml:link`
   alternates fr et x-default). **867 = 3 × 289**, à l'unité près. Re-mesuré par moi
   à 02:25 UTC : **289 `<loc>` et 867 occurrences de `/fr/galerie/` dans la même
   réponse**. Aucun chiffrage n'est invalidé — A4 (288 images + 1 hub), E2, E4 et F6
   (289) étaient tous justes ; seul le « ~870 pages » de C1 est un artefact de
   comptage, déjà corrigé par H2.
2. **La root-cause du `lastmod` d'`images-fr.xml` est trouvée, et ce n'est ni celle
   d'A4 ni « inexpliqué ».** A4 accusait `trackUsage()` ; H1 a prouvé qu'elle n'a
   aucun appelant et a laissé le symptôme sans explication. J'ai re-mesuré la
   distribution des `lastmod` à 8 h 20 d'intervalle : **7 lignes ont changé de jour
   pendant la nuit** (108 vs 104 au 08-14, 3 nouvelles au 08-15, −2 sur 08-08, −2 sur
   08-07, −2 sur 08-09, −1 sur 08-11), sans production de contenu, sans seed et sans
   activité humaine. Le seul chemin d'écriture vivant est
   `galerie/[slug]/telecharger/route.ts:147` (`downloadCount: { increment: 1 }` sur la
   ligne `imageAsset`, colonne `@updatedAt`) — et **les 288 pages galerie exposent
   2 liens `<a href>` crawlables vers ce endpoint, sans `rel="nofollow"` et sans
   `Disallow` dans robots.txt** (vérifié live). A4 avait raison sur le mécanisme
   (« une visite de crawler rafraîchit le `lastmod` »), faux sur la fonction. Nouveau
   finding canonique, avec la requête SQL de confirmation.
3. **`AGENTS.md` du dépôt fait foi : l'exception de budget porte sur `/appel`, pas
   sur `/reserver`.** `next.config.ts:280-289` documente la suppression de `/reserver`
   le 2026-06-26 et son 301 vers `/appel`. **Le `AGENTS.md` global de `C:\Users\willi`
   ET le prompt maître de cet audit (l. 420) portent tous deux la valeur périmée.**
   `package.json` conserve **3 buckets `size-limit` morts** sur `/reserver` et
   **aucun bucket `/appel`** : la page à laquelle la doctrine accorde 110 KB est
   aujourd'hui mesurée à 75 KB. G1 avait raison sur toute la ligne.
4. **Sur l'ordonnancement du pipeline, G3 gagne — et pour une raison de plus que
   celle qu'il donne.** Vérifié : `lhci` (l.556), `indexnow` (l.650) et `warm` (l.716)
   ont tous `needs: deploy` → **trois jobs en parallèle**. La variante G1
   (`lhci: needs: [deploy, warm]`) allonge le pipeline de ~8 min, peut **désarmer le
   seul gate bloquant** (H4 : `warm` a `cancel-in-progress: true` et pas de
   `continue-on-error`), et **ne couvre pas `indexnow`** — qui pingue donc les moteurs
   pendant la fenêtre stub. La variante G3 (déplacer revalidate + purge à la fin du
   job `deploy`) couvre les trois jobs pour ~5 s de section critique.
5. **D2 a raison contre D3 sur le garde-fou soft-404, et j'ai la preuve des deux
   côtés.** `content-gen-worker.ts:1221-1222` calcule bien
   `shouldPromoteTier1 = score ≥ seuil && finalIndexationTier !== "tier_3"` — D3 décrit
   correctement **le calcul**. Mais ce booléen n'est transmis qu'en paramètre
   `promoteToTier1`, et `content-publish-worker.ts:618` écrit
   `const indexationTier = "tier_1_indexable"` **en dur, sans le lire**. L'effet est
   celui décrit par D2 : le soft-404 n'interdit rien. La ligne du tableau des gates de
   D3 est à corriger. **Découverte de contexte** : le commentaire `:615-617` du même
   fichier affirme que les creds GSC sont absents du worker — c'est **la source de
   l'erreur de D7**, réfutée par la mesure de D8. Un commentaire périmé a produit un
   finding faux.

---

# VOLET 1 — LES 21 CONTRADICTIONS ARBITRÉES

## C-01 🔴 PRIORITAIRE — Volume d'`/sitemaps/images-fr.xml` : 867 (C1) vs 289 (H2)

| Source | Heure UTC | Valeur | Objet réellement mesuré |
|---|---|---|---|
| C1 | 2026-08-14 18:07 | **867** | occurrences de la chaîne `/fr/galerie/` |
| A4 | 2026-08-14 18:06 | **289 `<loc>` / 288 images** | balises `<loc>` |
| F6 | 2026-08-14 19:20 | **289** | URLs `/fr/galerie/*` |
| H2 | 2026-08-15 02:12 | **289** | balises `<loc>` |
| **H6** | **2026-08-15 02:25** | **289 `<loc>` ET 867 occurrences `/fr/galerie/`** | **les deux, sur la même réponse** |

**ARBITRAGE : aucune instabilité. C'est un artefact de comptage, et H2 a raison sur
le volume.**

- **Preuve arithmétique** : `src/app/sitemaps/images-fr.xml/route.ts:173-188` — chaque
  bloc `<url>` émet le `<loc>` de la page galerie (l.175), **puis** un
  `xhtml:link hreflang="fr"` vers la même URL (l.156-158, EN filtré car
  `EN_ENABLED = false`), **puis** un `xhtml:link hreflang="x-default"` vers la même URL
  (l.163-165). Soit **3 occurrences de `/fr/galerie/` par URL**. Le bloc d'index
  (l.134-141) suit la même règle. **289 × 3 = 867.**
- **Preuve live H6 (02:25:34Z)** : `grep -c "<loc>"` → **289** ;
  `grep -o "/fr/galerie/" | wc -l` → **867**, sur la **même** réponse
  (`size=310 501 o`, `x-axion-build-sha: f51d544b…`, `last-modified: 01:47:32Z`).
  La taille est **identique à l'octet** à celle relevée par A4 le 08-14 à 18:06
  (310 501 o) : le fichier n'a pas bougé.
- **Contrôle de non-troncature** : `SITEMAP_CHUNK_SIZE = 1000`
  (`src/server/image-bank/constants.ts:198`) et `take: MAX_URLS` (route l.108) — 289 est
  très en-deçà du cap, aucune coupe possible.

**Conséquences (importantes, car elles annulent une alerte de H2)** :
- ❌ Le point « chute de 67 % à faire trancher par la synthèse » (H2, résumé exécutif
  et Limites) **est retiré** : rien n'a chuté.
- ✅ **Aucun autre chiffrage n'est invalidé.** A4 (288 `lastmod`, 288 images),
  E1 (288 pages galerie), E2 (288, `numberOfItems`), E4 (288 URLs uniques),
  F6 (289 pages porteuses du mauvais `sameAs`) sont tous cohérents entre eux et avec ma
  mesure. Le double suffixe de titre (C1) porte donc sur **~290 pages galerie**
  (+ 6 pages de pagination blog), pas 870 — requalification déjà faite par H2, que je
  confirme.
- ⚠️ **Règle à retenir pour la Phase 3** : sur les sitemaps images/hreflang, ne jamais
  compter une chaîne d'URL — compter `<loc>`. Trois agents s'y sont fait prendre à des
  degrés divers.

---

## C-02 🔴 PRIORITAIRE — Root-cause du `lastmod` uniformément frais d'`images-fr.xml`

**Trois versions en présence** : A4 (« `trackUsage()` pollue le `lastmod` à chaque
vue, même de crawler »), H1 (« `trackUsage` n'a aucun appelant → root-cause réfutée,
symptôme réel mais **inexpliqué**, ne pas patcher »), H4 (« et E1-P1-7 prescrit
d'appeler `trackUsage`, ce qui **créerait** le bug »).

**ARBITRAGE : H1 a raison contre A4 sur la fonction ; mais le symptôme n'est pas
inexpliqué — j'établis la root-cause réelle, et elle valide le *mécanisme* d'A4.**

**Preuve n°1 — le phénomène est VIVANT, pas un batch historique.** Distribution des
`lastmod` du même fichier, à 8 h 20 d'intervalle :

| Jour | A4 (08-14 18:06 UTC) | H6 (08-15 02:30 UTC) | Δ |
|---|---:|---:|---:|
| 2026-08-15 | — | **3** | **+3** |
| 2026-08-14 | 104 | **108** | **+4** |
| 2026-08-13 | 8 | 8 | 0 |
| 2026-08-12 | 3 | 3 | 0 |
| 2026-08-11 | 32 | 31 | −1 |
| 2026-08-10 | 2 | 2 | 0 |
| 2026-08-09 | 4 | 2 | −2 |
| 2026-08-08 | 82 | 80 | −2 |
| 2026-08-07 | 53 | 51 | −2 |
| **Total** | **288** | **288** | **0** |

**7 lignes ont vu leur `updatedAt` bumpé pendant la nuit**, sans production de contenu
(kill switch depuis le 2026-07-20), sans seed (H3 : `image-bank-seed.yml` = 24 runs,
tous en mai 2026), sans activité admin plausible à 2 h du matin.

**Preuve n°2 — le seul chemin d'écriture vivant, et il est CRAWLABLE.**
- `src/app/[locale]/galerie/[slug]/telecharger/route.ts:144-149` :
  `prisma.imageAsset.update({ data: { downloadCount: { increment: 1 } } })` — la colonne
  `updatedAt @updatedAt` du modèle `ImageAsset` est donc bumpée **à chaque hit**.
- **Live H6 (02:31 UTC)** — le HTML d'une page galerie contient **2 ancres crawlables**
  vers cet endpoint :
  `<a href="/fr/galerie/<slug>/telecharger" download="">` et
  `<a href="/fr/galerie/<slug>/telecharger?format=jpeg" download="">`.
  **Aucun `rel="nofollow"`.**
- **Live H6 (02:26 UTC)** — `robots.txt` prod : **0 occurrence** de `telecharger`,
  **0 occurrence** de `galerie` en `Disallow`. Le endpoint est explicitement autorisé
  à tous les UA autorisés.

⇒ **288 pages × 2 liens = 576 URLs crawlables qui, à chaque visite, exécutent une
transformation Sharp + 2 écritures DB et détruisent le signal de fraîcheur du
sitemap images.** C'est exactement le mécanisme décrit par A4 (« même une visite de
crawler rafraîchit le `lastmod` »), par un autre chemin que celui qu'elle avait
identifié.

**Ce qui change dans le plan** :
- Le finding A4-P1-1 **survit**, reformulé (voir **GEO-036**). Son patch d'origine
  (basculer sur `publishedAt ?? createdAt`) reste **à ne pas appliquer seul** : il
  masquerait le vrai problème, qui est une écriture DB déclenchée par le crawl.
- Le correctif de premier rang est de **rendre le endpoint non-crawlable**
  (`rel="nofollow"` + `Disallow: /*/telecharger` + `X-Robots-Tag: noindex, nofollow`),
  puis de **découpler le compteur de la ligne éditoriale** (écrire dans
  `image_download_logs` seulement, ou colonne `downloadCountUpdatedAt` séparée).
- **Confirmation à 5 secondes, à faire avant patch** (agent DB-autorisé) :
  `SELECT "userAgent", count(*) FROM image_download_logs WHERE "downloadedAt" > now() - interval '48 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 20;`
  — si les UA sont des bots, la démonstration est close.
- **L'alerte d'ordonnancement de H4 (D-2) est CONFIRMÉE et renforcée** : poser E1-P1-7
  (appeler `trackUsage()` depuis la page galerie) ajouterait **une seconde** source de
  pollution, sur la page elle-même cette fois. Ordre imposé maintenu.

---

## C-03 — G1-P1-3 vs G3-P0 : deux ordonnancements incompatibles pour la même course

**ARBITRAGE : retenir G3 (déplacer revalidate + purge ciblée à la fin du job
`deploy`). Confirmé par lecture du workflow, et pour une troisième raison que ni G1,
ni G3, ni H3 ne donnent.**

**Preuve H6 (lecture de `.github/workflows/deploy-coolify.yml`)** :
`build` (l.96) → `deploy` (l.336, `needs: build`) → puis **trois jobs en parallèle** :
`lhci` (l.554-556, `needs: deploy`), `indexnow` (l.648-650, `needs: deploy`),
`warm` (l.714-716, `needs: deploy`). `warm` porte `cancel-in-progress: true` (l.722).
`continue-on-error` n'apparaît **qu'une fois** dans tout le fichier : l.902, sur
`notify`.

Trois raisons de préférer G3, dont la troisième est neuve :
1. **Effet de bord** (H4) : `lhci: needs: [deploy, warm]` **skippe `lhci`** dès que
   `warm` est annulé — cas fréquent sur deux merges rapprochés. On désarmerait le seul
   gate bloquant du pipeline pour corriger une course de cache.
2. **Coût** : G1 reconnaît elle-même que sa variante allonge le pipeline de ~8 min.
3. **Couverture — argument H6** : la variante G1 ne dit rien du job **`indexnow`**, qui
   reste en parallèle et **notifie les moteurs pendant la fenêtre stub**. Déplacer
   revalidate + purge à la fin de `deploy` (variante G3) les place avant le démarrage
   des **trois** jobs, `indexnow` compris. C'est le seul correctif qui ferme la
   fenêtre pour le canal de découverte lui-même.

⇒ **La variante G1 sort du plan ; la variante G3 la remplace.** Si Will préfère malgré
tout `needs: [deploy, warm]`, le garde-fou H4 (`if: always() && needs.deploy.result == 'success'`)
devient **obligatoire**, pas optionnel.

---

## C-04 — D3 vs D2 : « le soft-404 interdit le tier_1 »

**ARBITRAGE : D2 a raison sur l'effet, D3 a raison sur le calcul, la ligne du tableau
des gates de D3 est FAUSSE et doit être corrigée dans son rapport.**

**Preuve H6, les deux côtés du fil** :
- `src/server/queue/workers/content-gen-worker.ts:1221-1222` :
  `const shouldPromoteTier1 = score >= autoPromoteTier1MinScore && finalIndexationTier !== "tier_3_noindex_nofollow";`
  → **D3 décrit correctement le calcul** : à cet endroit, un soft-404 interdit bien la
  promotion. La valeur part en `promoteToTier1` dans le job de publication (l.1232).
- `src/server/queue/workers/content-publish-worker.ts:618` :
  `const indexationTier = "tier_1_indexable";`
  → **le paramètre n'est jamais lu**. Le commentaire l.602-606 l'assume (« `promoteToTier1`
  reste loggué pour la traçabilité mais **ne gate plus le tier** »).

⇒ Effet net : **le garde-fou soft-404 ne protège rien**. D2-P0-1 est le finding
canonique ; D3 doit corriger sa ligne de tableau. Le patch reste **STOP & ASK Will**
(il renverse la décision du 2026-06-17), et la reformulation de H2 tient : le trou
réel est que **la jambe d'élagage prévue par la même décision n'a jamais tourné**.

**Découverte de contexte, à porter au plan** : les lignes **615-617** du même fichier
affirment « ⚠️ INERTE tant que les creds GSC (`GSC_OAUTH_*`/`GSC_PROPERTY_URL`) sont
absents du worker ». **C'est la source documentaire de D7-P1-2** — un commentaire
périmé, que D8 a réfuté par la mesure. Corriger ce commentaire fait partie du patch
(sinon le prochain auditeur retrouvera le même faux finding).

---

## C-05 — `AGENTS.md` du dépôt (`/appel`) vs `AGENTS.md` global (`/reserver`)

**ARBITRAGE : le `AGENTS.md` DU DÉPÔT fait foi. Le fichier global de `C:\Users\willi`
est périmé — et le prompt maître de cet audit l'est aussi.**

**Preuves** :
- `next.config.ts:280-289` : « **Suppression page /reserver (Will 2026-06-26)** — le
  calendrier de booking est retiré ; toute prise de contact passe désormais par
  `/appel` … Le pathname `/reserver` a été **retiré de `routing.ts`** » + redirect
  301 `/fr/reserver` → `/fr/appel`.
- `axionia/AGENTS.md` : « Exception : **`/appel`** (réservation d'appel, iframe Calendly
  client-heavy) → INP ≤ 150 ms, First Load ≤ 110 KB gz. »
- `C:\Users\willi\AGENTS.md` : « Exception : **`/reserver`** (calendrier client-heavy) ».
- `_AUDIT/PROMPT-AUDIT-GEO-AEO-END-TO-END-50-AGENTS-2026-08-14.md:420` : « exception
  **/reserver** » — **le prompt maître propage la même valeur périmée**.
- `package.json:223, 239-254` : **3 buckets `size-limit` sur `/reserver`** (chemins
  `.next/static/chunks/app/**/reserver/**`, qui ne peuvent plus rien matcher) et
  **aucun bucket `/appel`** ; le bucket « Pages standard » exclut `/reserver` mais
  **inclut `/appel`**, qui est donc mesuré à 75 KB au lieu des 110 KB promis.

⇒ **G1-P0-1 est intégralement validé**, et son patch 2 (créer un bucket `/appel`)
gagne un volet : **supprimer les 3 buckets `/reserver` morts**. À signaler aussi à
Will : le `AGENTS.md` global et le prompt maître doivent être rectifiés, sinon tout
futur agent raisonnera sur une exception de budget qui n'existe plus.

---

## C-06 — D7 vs D8 : les credentials GSC du container worker

**ARBITRAGE : D8 a raison (mesure), D7 a tort (lecture d'un commentaire de code
périmé). Verdict de H2 confirmé, avec la source de l'erreur identifiée.**

- D7 marquait lui-même son affirmation `[À CONFIRMER côté env Coolify]` ; D8 a mesuré
  en prod le 08-14 à 18:36 UTC que `GSC_OAUTH_*` + `GSC_PROPERTY_URL` sont présentes
  **dans les containers web ET worker**.
- **Origine de l'erreur trouvée par H6** : `content-publish-worker.ts:615-617` porte le
  commentaire « ⚠️ INERTE tant que les creds GSC … sont absents du worker ». D7 a
  répété un commentaire, pas une mesure.
- **Cause réelle** de l'élagage gelé : `content-tier-lifecycle-worker.ts:149-157`, le
  kill switch sort **avant** toute lecture GSC.
- ⇒ **Patch ops de D7 éliminé** (redémarrer le worker pour rien) ; le finding est
  absorbé par **GEO-076** (périmètre du kill switch). **Ajouter au patch** : corriger
  le commentaire `:615-617`.

---

## C-07 — F1 vs A2 : les guides sont-ils déclarés dans un sitemap ?

**ARBITRAGE : A2 a raison, F1 a tort. Verdict de H3 confirmé par mesure indépendante.**

`sitemap-blog.xml` déclare bien les `/fr/guides/<slug>` ; c'est un choix documenté
(`src/app/sitemap.ts:131-133` : « Les guides individuels restent émis via sub-sitemap
`blog` … Le sub-sitemap `guides` ne contient que le hub lui-même »).
Seul le volet **glossaire** de F1-P1-4 est un vrai défaut — et son patch est éliminé
par H4 (publier 60 URLs `noindex` dans un sitemap est un remède pire que le mal).

---

## C-08 — Combien de guides dans `sitemap-blog.xml` ? A2 = 9, D2 = 1, F1 = 0, H3 = 3

**ARBITRAGE : 3. Mesuré, et le fichier n'a pas bougé depuis le 08-14 18:57.**

**Mesure H6 (2026-08-15 02:27:32Z)** — `sitemap-blog.xml`, `size=59 246 o` :

| Segment | Compte |
|---|---:|
| `<loc>` total | **134** |
| `/fr/guides/<slug>` | **3** |
| `/fr/blog/categorie/<slug>` | **5** |
| `/fr/blog/<slug>` (articles) | **126** |

- **Le fichier est identique à l'octet** à celui mesuré par F1 le 08-14 à 18:57
  (59 246 o) : la composition n'a pas changé depuis, et aucune publication n'est
  possible (kill switch depuis le 07-20).
- **Corroboration croisée** : H3 a relevé exactement **3** slugs guides
  (`guide-audit-ia-grenoble`, `guide-agence-web-ia-auvergne-rhone-alpes`,
  `guide-integration-ia-grenoble`) à 02:05 UTC. Deux mesures indépendantes, même
  résultat.
- **Verdicts** : A2 « 9 » = faux ; D2 « 4 hubs + 1 guide » = faux (5 hubs + 3 guides) ;
  F1 « zéro slug préfixé `guide-` » = faux (et cette erreur a directement produit une
  Limite injustifiée dans F1). D7 « 5 URLs `/fr/blog/categorie/blog-*` » = **juste**.
- **Aucun verdict ne bascule** : le point d'A2 (les guides sont dans `sitemap-blog`)
  reste vrai, et celui de D2 (129 exports markdown = 100 % du corpus non-hub) est
  **exact** — 126 + 3 = 129.

---

## C-09 — Taille réelle du corpus blog : 134 (B3), 129 (D2), 61 (C4, H5)

**ARBITRAGE : 126 articles de blog + 3 guides + 5 hubs catégorie = 134 `<loc>`.
Le « 61 » est un chiffre mal recopié.**

- **B3** (« 134 URLs blog tier-1 portent un `description` vide ») **surestime de 8** :
  les 5 hubs catégorie et les 3 guides ne sont pas des `BlogPosting`. Le finding porte
  sur **126 articles**. Gravité inchangée.
- **D2** (129) est **exact** pour son périmètre (tout ce qui n'est pas un hub).
- **C4:86** écrit « Avec **61 articles blog et 452 entrées KB non atteintes par le
  BFS** (cap 400 pages) » : 61 = le nombre d'articles **non atteints par son crawl**,
  pas la taille du corpus.
- **H5 (Bloc 4)** a recopié ce 61 comme s'il s'agissait du corpus (« `article:*` absent
  sur les **61 articles** de `/blog/` »). **Chiffre non sourcé propagé** : le finding
  H5 porte en réalité sur **126 articles**. Sévérité inchangée (P2), volume × 2.

---

## C-10 — B1 : « `/fr/mentions-legales` est absente du sitemap »

**ARBITRAGE : FAUX. F5 avait raison de corriger B1 ; H3 l'avait validé ; je le
confirme par mesure directe.**

**Mesure H6 (2026-08-15 02:29:40Z)** — `sitemap/pages.xml` (86 `<loc>`, 31 204 o) :
- `<loc>https://axion-ia.com/fr/mentions-legales</loc>` → **présent**
- `<loc>https://axion-ia.com/fr/conditions-generales</loc>` → **présent**
- `memo-isere` → **0 occurrence** (confirme H5-6.5)
- `ressources` → **0 occurrence** (confirme A3-P1-2)

**Origine de l'erreur** : B1 a grepé `mentions-legales` dans `src/app/sitemap.ts` → 0.
C'est exact, mais `buildPagesSitemap` (`sitemap.ts:696-727`) **itère
`routing.pathnames`** : la clé vit dans `src/i18n/routing.ts`, pas dans `sitemap.ts`.
Le grep était sur le mauvais fichier.

**Conséquence sur le plan** : les deux pistes induites par cette root-cause erronée
(« ajouter la page au sitemap », « augmenter le cap du sweep ») sont **sans objet et
sortent du plan**. Le patch réel (ajouter la page aux deux listes du job `warm`) est
**inchangé** — car H1 a établi qu'un simple GET du sweep ne revalide pas un prerender
frais.

---

## C-11 — `pages.xml` : 85 `<loc>` (A2) vs 86 (H6)

**ARBITRAGE : 86 aujourd'hui.** A2 a mesuré à 17:52 le 08-14, avant deux
atterrissages. Écart d'une URL, sans effet sur aucun verdict. La formulation de H1
(« 1 URL sur 85 » pour A2-P1-1) devient « 1 URL sur 86 ».

---

## C-12 — E1 vs E2/E4 : que valent les `<image:title>` / `<image:caption>` ?

**ARBITRAGE : E2 et E4 l'emportent. Verdict de H3 confirmé.**

E1-P0-a fonde **la moitié de son impact** sur la dégradation des `<image:title>` /
`<image:caption>` du sitemap images. E2-P2 établit que Google a **déprécié ces
extensions en 2022** (seul `<image:loc>` compte), et E4-P2 montre que l'URL indexée
n'est même pas celle déclarée. ⇒ **Cette moitié d'impact est nulle.** Le dommage réel
d'E1-P0-a se réduit à l'`alt` du DOM et au `<title>` des 288 pages galerie — ce qui,
combiné à la réfutation de la récurrence par H3 (24 runs de seed, tous en mai 2026,
aucun `workflow_run`), **justifie le passage P0 → P1** (voir GEO-064).

---

## C-13 — Héros villes : 58 (E3) ou 59 (code) ?

**ARBITRAGE : 59. Double vérification H6.**
- `src/content/villes/hero-images-map.ts` : **59** entrées dans
  `VILLES_WITH_HERO_IMAGE`.
- `public/villes-hero/` : **59** basenames uniques.
- La source de l'erreur est le commentaire du code lui-même
  (`implantations/[region]/[ville]/page.tsx:524` : « 58 villes ») — E3 a repris
  l'erreur. **Le commentaire est à corriger dans le même patch.**

---

## C-14 — Taxonomie des volumes villes (B2 « ~2 150 », B4 « ~1 816 », C4 « 2 157 », D4 « 480 »)

**ARBITRAGE — taxonomie canonique unique, à utiliser par toute la Phase 3 :**

| Grandeur | Valeur | Source de vérité |
|---|---:|---|
| Slugs villes uniques déclarés | **1 816** | `src/content/villes/unique-ville-slugs.ts` |
| Pages hub ville **rendues** (`/implantations/<region>/<ville>`) | **2 157** | liens du hub (C4, mesuré 2 157) ; `low-quality-villes.json` `totalVilles: 2157` |
| Pages hub ville **indexables et déclarées** | **480** | `src/generated/indexable-villes.ts` = 480 slugs ; somme des 13 sitemaps régionaux = 480 (C4) |
| Pages hub ville `noindex, follow` hors sitemap | **~1 677** | 2 157 − 480 |
| Pages `*/par-ville/*` (5 familles) | **~10 785** | 5 routes × `VILLES` (voir ci-dessous) |
| Pages `/sites-web-augmentes/par-ville/*` `index, follow` | **455** | D4-P0, mesuré live |

- ⚠️ **B2 (« ~2 150 hubs ville ») et B4 (« ~1 816 villes × variantes »)** confondent
  respectivement le rendu et les slugs avec l'**indexable déclaré**. Volume de leurs
  findings : **480**, comme arbitré par H1 et H2.
- ⚠️ **D4 lui-même est incohérent** : « 2 153 `directAnswerFr` » et « 476 villes
  indexables » (l.57) contre « 2 157 » et « 480 » ailleurs. Écarts de 4, sans effet.

---

## C-15 — Univers `par-ville` : « ~4 300 » (B2, G4) vs « ~10 785 » (D4)

**ARBITRAGE : D4 a raison — ~10 785 URLs adressables.**

**Preuve H6** : 5 familles `par-ville` existent
(`ls src/app/[locale]/*/par-ville` → `audit`, `formations`, `implementation`,
`sites-web-augmentes`, `un-a-un`), et les 5 partagent
`export const generateStaticParams = buildStaticParams` ;
`VilleServicePageTemplate.tsx:196-204` retourne `VILLES.map(...)` (soit les 2 157)
sauf si `BUILD_SSG_VILLES_INDEXABLE_ONLY === "true"`. Les 5 routes portent
`dynamicParams = true` : **toutes les combinaisons sont servables**, qu'elles soient
pré-rendues ou non. 5 × 2 157 = **10 785**.

**Aucun verdict ne bascule** : la totalité de cette famille est **hors de tous les
sitemaps depuis le 2026-06-20** (décision Will, `sitemap.ts:401-412`), sauf les 455
pages `sites-web-augmentes` qui sortent `index, follow` (**GEO-014**, P0). Le chiffre
« ~4 300 » de B2 et G4 est à remplacer par « ~10 785 » **ou**, mieux, par la
formulation qui porte le sens : « une famille entière hors sitemap, dont 455 pages
indexables et indécouvrables ».

---

## C-16 — « Le warmer fige la version stub à l'edge » (A3-ADDENDUM, F3, F5, G3)

**ARBITRAGE : H3 l'emporte. Le cache Cloudflare est par PoP ; le warmer lancé depuis
un runner GitHub ne chauffe pas le PoP MRS que voient les visiteurs français et
Googlebot-EU.** La preuve est interne à F5 (MISS sur `/fr/mentions-legales` à
19:09:38, soit 34 min **après** la fin du job `warm`).

- Le **fait mesuré** tient (home et mentions légales servies sans identité/avis
  pendant ~1 h après chaque atterrissage : A3-ADDENDUM 18:53 et 19:16, F7 19:20,
  G3, F5 19:23).
- **Ce qui change** : la justification du patch. Ce n'est pas « le warm fige la
  mauvaise version partout », c'est « le warm ne couvre pas les PoP qui comptent, et
  ce qui fige la version amputée est **le premier crawler ou visiteur de chaque
  PoP** ». Le patch (ajouter les URLs aux deux listes + variante G3 d'ordonnancement)
  reste **le bon et devient le seul qui fonctionne** : la purge CF ciblée est globale à
  la zone, et `revalidatePath` agit sur l'origine.
- ❌ **Ne PAS prescrire** « faire chauffer davantage d'URLs par le warmer » : la chauffe
  depuis un runner ne couvre pas les PoP utiles.

---

## C-17 — A3-ADDENDUM : « vérifier l'ordre des steps (purge puis revalidate puis warm) »

**ARBITRAGE : recommandation SANS OBJET, retirée du plan.** H1 a vérifié que l'ordre
interne du job `warm` est **déjà** revalidate (l.729) → purge CF ciblée (l.768) → warm
stratégique (l.801) → sweep (l.827). L'addendum a d'ailleurs été amendé en ce sens.
Le vrai défaut d'ordonnancement est **inter-jobs** (C-03), pas intra-job.

---

## C-18 — B1 : « fenêtre post-deploy » vs H1 : « défaut permanent site-wide »

**ARBITRAGE : les deux, mais sur deux objets différents. Ne jamais les fusionner.**

| Volet | Nature | Preuve |
|---|---|---|
| **A — mentions légales « communiqué sur demande »** | **transitoire**, ~1 h par atterrissage | guéri à 01:27 UTC (H1), à 01:47 (H3), 0 occurrence |
| **B — `vatID` + `identifier` SIRET** | **PERMANENT et SITE-WIDE** | H1, même build, T+5 h 30 : corrélation parfaite ISR ⇒ `vatID` présent / statique ⇒ `vatID` absent, sur 8 URLs dont un hub ville indexable |

⇒ Deux entrées canoniques distinctes (**GEO-023** pour le volet A, dans le lot `warm` ;
**GEO-003** pour le volet B, P0, dont **seul** le patch build-args corrige quoi que ce
soit). F3-P1-1 pose explicitement cette distinction ; elle doit survivre à la synthèse.

---

## C-19 — G2 : « 76 à 81 % du document » vs 52,7 % sur `/fr`

**ARBITRAGE : les deux chiffres sont de G2 et ne portent pas sur la même page.**
H3 a reproduit 52,3 % sur `/fr` (4 × 228 829 o sur 1 750 744 o), ce qui correspond au
52,7 % que G2 annonce **pour `/fr`**. Le « 76 à 81 % » est le taux sur les pages
**légères**. Formulation à retenir en synthèse : « **52 % du document sur la home,
jusqu'à 81 % sur les pages légères** ». Aucune requalification.

---

## C-20 — `/fr/audit` : 8 blocs `ld+json` (B2) vs 7 (H1, H6)

**ARBITRAGE : 7 aujourd'hui.** Mesure H6 (02:32 UTC) : `grep -o 'type="application/ld+json"' | wc -l`
→ **7**. B2 mesurait sur un build antérieur. Sans effet : le point de B2/B6 est que
`/fr/audit` a des blocs **inline** (contre-exemple sain) et **zéro `aggregateRating`**
— les deux sont confirmés.

---

## C-21 — E1 : « 133 images » vs 288 pages galerie

**ARBITRAGE : NON TRANCHÉ — divergence de périmètre à lever par SQL avant patch.**

E1-P0-a titre sur « les **133** images du cœur d'offre » puis chiffre son impact sur
« **288** URLs indexables ». H3 a échantillonné 12 `<image:title>` du sitemap :
**12/12 mécaniques**, ce qui suggère que la dégradation dépasse les 133. Je ne peux
pas trancher sans DB.
**Requête de tranchage** :
`SELECT count(*) FROM image_assets a JOIN image_asset_translations t ON t."imageId" = a.id WHERE t."languageCode" = 'fr' AND t.title LIKE 'Axion-IA — %';`
⇒ à porter en Limites du plan, pas à arbitrer au doigt mouillé.

---

## ✅ Contrôles de cohérence NÉGATIFS (aucune contradiction — à ne pas rouvrir)

- **Avis clients** : 8 rapports citent le chiffre, **tous concordants** — 77 avis,
  moyenne exacte **4,8831** (breakdown mesuré par B6 : 68×5★ + 9×4★ + 0 + 0 + 0),
  affichée **4,9** par arrondi à 1 décimale (`queries.ts:189`), `reviewCount: 77` en
  JSON-LD, 77 slugs dans `sitemap-avis.xml` (103 `<loc>` = hub + deposer + 77 + 24
  facettes). E3 note que le visuel Paris affiche « 4,8/5 » — arrondi **bas**, donc pas
  mensonger. **Le seul écart réel est un cap** : `/fr/avis/feed.xml` n'expose que
  **48** des 77 avis (A5, F1) — c'est un finding, pas une contradiction.
- **Sitemap-index** : 38 sub-sitemaps (A2 17:48, F1 18:57, H2 02:56, D4 02:56) —
  4 mesures concordantes. Total 2 603 URLs (F1).
- **CSV GSC W31/W32/W33** : H3 a refait l'arithmétique à la main et reproduit
  **exactement** les chiffres de F2 (805/19/22,15 → 1 292/14/25,26 → 1 515/13/25,46).
- **`llms-full.txt`** : 26 tokens `{{price:` mesurés par A5 (08-14 18:07) et par H1
  (08-15 01:29), **sur deux builds différents** — défaut stable, pas un artefact.

---

# VOLET 2 — LES 25 DOUBLONS FUSIONNÉS EN 15 IDENTIFIANTS

| # | Identifiant canonique | Agents fusionnés | Doublons absorbés |
|---|---|---|---:|
| F-1 | **GEO-023** — pages ISR absentes des deux listes du job `warm` | A3-P0, A3-P1-1, A3-ADDENDUM, B1-P0 volet A, B6-P0, F3-P1-1, F5-P0-b, F7-P0-a volet 2, G3-P0 volet 1 | **7** |
| F-2 | **GEO-029** — schémas d'autorité en `afterInteractive`, absents du HTML servi | B2-P0, B4-P1-1, D4-P1-4, D5-P1-3 volet (d), G2-P1-2 (corroboration) | **4** |
| F-3 | **GEO-038** — `/api/markdown/<type>` : types annoncés non enregistrés | A5-P0-2, F1-P1-1 (centre-aide), F1-P1-3 (glossaire) | **2** |
| F-4 | **GEO-031** — exports Observatoire annoncés dans `llms.txt` et bloqués par robots.txt | A1-P1-3, B4-P1-3 | **1** |
| F-5 | **GEO-045** — `sameAs` de l'Organization sans nœud registre ni Wikidata | B1-P1-1, F5-P1-2 | **1** |
| F-6 | **GEO-046** — citations locales NAP : module 100 % inerte | B1-P1-2, F6-P1-2 | **1** |
| F-7 | **GEO-024** — course `lhci` ⇄ `warm` ⇄ `indexnow` (3 jobs parallèles) | G1-P1-3, G3-P0 volet 2 | **1** |
| F-8 | **GEO-119** — Cache Rules Cloudflare sur les `.xml` | G3-P1-2, F1-P2 | **1** |
| F-9 | **GEO-081** — chaînes de redirection à 2 sauts dans les corps persistés | C4-P1-5, C3-P2 | **1** |
| F-10 | **GEO-088** — hub `/connaissances` orphelin, 48/507 fiches liées | D5-P1-3, C4-P2 | **1** |
| F-11 | **GEO-030** — `gscInspectUrl` / monitoring d'indexation : code mort | F2-P1-4, F7-P1-3 | **1** |
| F-12 | **GEO-105** — IndexNow n'atteint que Yandex, aucun fallback Bing | A6-P1-1, F2-P1-2 | **1** |
| F-13 | **GEO-109** — `llms.txt` : ni siège, ni SIREN, et désambiguïse le mauvais homonyme | F4-P1-3, F5-P1-5 | **1** |
| F-14 | **GEO-057** — double marque dans les `<title>` (`· X · Axion-IA · Axion-IA`) | C1-P1-1, F3-P1-2 | **1** |
| F-15 | **GEO-146** — `/fr/memo-isere` : ISR non revalidée, hors sitemap, orpheline | A3-P1-1 (volet memo), H5-6.5 | **1** |
| | | **TOTAL** | **25** |

### Chiffres non sourcés propagés d'un rapport à l'autre (à ne pas reprendre)

| Chiffre | Propagé par | Valeur réelle | Détail |
|---|---|---|---|
| « ~870 pages galerie » | C1 → (repris nulle part ailleurs) | **289** | C-01 |
| « 61 articles blog » | C4 (sens correct) → **H5** (sens faux) | **126** | C-09 |
| « 9 guides dans `sitemap-blog` » | A2 | **3** | C-08 |
| « 4 hubs catégorie + 1 guide » | D2 | **5 hubs + 3 guides** | C-08 |
| « zéro slug `guide-` » | F1 | **3** | C-08 |
| « 58 héros villes » | commentaire du code → E3 | **59** | C-13 |
| « ~2 150 hubs ville » | B2 | **480** déclarés | C-14 |
| « ~1 816 villes × variantes » | B4 | **480** déclarés | C-14 |
| « ~4 300 pages `par-ville` » | B2, G4 | **~10 785** | C-15 |
| « 134 URLs blog tier-1 » | B3 | **126** articles | C-09 |
| « 66 pages tier-1 avec markdown 404 » | A5 | **6** indexables | H1 |
| « 78/160 dimensions fausses », « 75 vignettes 404 », « ~30 fiches FAQ double marque » | E1, F3 | **[À CONFIRMER]** — inventaires disque/corpus non rejoués par H3 | H3, Limites |

---

# VOLET 3 — LISTE CANONIQUE DÉDUPLIQUÉE

**Mode d'emploi pour la Phase 3.** Cette liste est la **source de vérité unique** :
les 45 rapports n'ont plus à être relus. Chaque ligne porte l'identifiant stable, le
titre canonique, la sévérité **après** les requalifications de H1/H2/H3, les agents
d'origine (doublons entre parenthèses), le statut et le domaine de scoring.
Colonne **⚠️** : `H4-ÉLEVÉ` = patch classé RISQUE ÉLEVÉ par H4 ; `STOP` = arbitrage
Will obligatoire ; `ORDRE` = contrainte d'ordonnancement entre patches.

Domaines : **CRAWL** (crawl & découverte) · **SITEMAPS** (sitemaps & feeds) ·
**JSONLD** (JSON-LD & entité) · **META** (metadata & indexabilité) ·
**CONTENT** (content-gen qualité AEO) · **PSEO** (pSEO & maillage) · **IMAGES** ·
**SERP** (présence moteurs classiques) · **IA-ENT** (moteurs IA & entité vérifiable) ·
**PERF** (perf & rendu).

---

## Bloc P0 — 28 findings (visibilité cassée ou mensongère)

| ID | Titre canonique | Domaine | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|---|
| GEO-001 | Un redémarrage de conteneur hors pipeline laisse la prod sans aucune remédiation (ni purge, ni revalidate, ni chauffe) et sert des hubs vides aux crawlers | CRAWL | F7-P0-a | CONFIRMÉ (mécanisme) — l'événement du 18:49:06 reste `[À CONFIRMER]` | STOP (volet 3 : couper l'auto-deploy Coolify) |
| GEO-002 | `llms-full.txt` sert 26 tokens `{{price:…}}` bruts aux moteurs IA | SITEMAPS | A5-P0-1 | CONFIRMÉ | |
| GEO-003 | `vatID` et `identifier` SIRET **absents en permanence** du nœud `#organization` de toutes les pages 100 % statiques (dont les 480 hubs villes indexables) | JSONLD | B1-P0 volet B | CONFIRMÉ (aggravé par H1 : permanent, pas une fenêtre) | STOP si variante « figer en code » (gate anti-SIREN) |
| GEO-004 | 10 offres d'emploi hybrides déclarées « 100 % télétravail » (`jobLocationType: TELECOMMUTE` en plus du `jobLocation`) | JSONLD | B5-P0-1 | CONFIRMÉ | STOP (choix commenté + test verrou à réécrire) |
| GEO-005 | En-tête HTTP `Link` : hreflang `en` vers des 301 et `x-default` vers une URL redirigeante, sur **toutes** les pages | META | C1-P0 | CONFIRMÉ | |
| GEO-006 | Mix d'intentions de recherche cassé : le sampler `(slotIndex + seed) % total` avec des poids fractionnaires retourne **toujours** la première clé → 100 % `informational` au rallumage | CONTENT | D1-P0-2 | CONFIRMÉ (le plus solide de la squad D) | ORDRE : à corriger **avant** la recharge OpenAI |
| GEO-007 | Le tier d'indexation est écrasé en dur au publish (`tier_1_indexable`) : le garde-fou soft-404 calculé en amont n'a aucun effet | CONTENT | D2-P0-1 (arbitre D3) | CONFIRMÉ (fait) | STOP — le patch renverse la décision Will du 2026-06-17 |
| GEO-008 | 40 % du corpus indexé est sous le plancher de longueur de ses propres générateurs : les tranches d'expansion sont perdues en silence | CONTENT | D2-P0-2 | CONFIRMÉ | |
| GEO-009 | 26 % du corpus indexé publie une statistique propriétaire fabriquée ou un cas client anonyme, que le détecteur de doctrine ne voit pas | CONTENT | D2-P0-3 | CONFIRMÉ (le plus grave du lot D) | ORDRE : tester à blanc sur les 129 articles avant activation |
| GEO-010 | URLs de citation malformées (backtick) servies dans le HTML **et** dans le `CreativeWork` JSON-LD | CONTENT | D6-P0-1 | CONFIRMÉ (renforcé par H2 : aussi dans le JSON-LD) | patch incomplet sans backfill DB (H4 C-12) |
| GEO-011 | Le JSON-LD de chaque article affirme une supervision humaine que le HTML de la même page dément deux lignes plus bas | CONTENT | D6-P0-2 | CONFIRMÉ | |
| GEO-012 | Liens in-body `/implementations` → 404 sur environ la moitié du corpus blog | PSEO | C4-P0-1 | CONFIRMÉ | la règle de redirect ne doit **pas** capturer `/implantations` |
| GEO-013 | Silo FAQ : les CTA hub ↔ thématiques sont rendus `/fr/fr/*` → 404 | PSEO | C4-P0-2 | CONFIRMÉ (meilleur rapport effort/impact de la squad C) | |
| GEO-014 | 455 pages `/sites-web-augmentes/par-ville/*` sont `index, follow`, riches, et déclarées dans **aucun** sitemap ni lien interne | PSEO | D4-P0 | CONFIRMÉ | STOP (contredit la décision Will du 2026-06-20) |
| GEO-015 | Prix mort « 490 € » gravé dans un `<title>` indexable et dans 2 légendes du sitemap images | IMAGES | E1-P0-b | CONFIRMÉ (root-cause corrigée : le prix est **injecté dans le prompt système**, `scripts/enrich-images.cjs:41`, pas lu dans l'image) | patch « retoucher l'affiche » **éliminé** |
| GEO-016 | `acquireLicensePage` pointe `/fr/cgu` → 404 sur les 141 `ImageObject` des pages marketing | IMAGES | E2-P0 | CONFIRMÉ | |
| GEO-017 | Le drainage de visibilité continue sans inflexion : position 22,2 → 25,5, clics ÷1,5, CTR ÷2,7 en 2 semaines — **et pire sur cohorte stable** (23,19 → 30,17) | SERP | F2-P0 | CONFIRMÉ (renforcé : la contre-hypothèse de composition a échoué) | |
| GEO-018 | Top 10 atteint sur 119 pages, mais sur des requêtes sans demande : 26 pages en top 3 → 60 impressions → 2 clics | SERP | F3-P0-1 | CONFIRMÉ (Google Suggest re-tiré : liste vide) | |
| GEO-019 | `/fr/audit`, page du service phare, est quasi absente de la SERP (1 impression/semaine) pendant que 117 pages villes en captent 481 | SERP | F3-P0-2 | CONFIRMÉ | |
| GEO-020 | Requête de marque : le moteur de réponse parle d'Axion-IA sans jamais citer `axion-ia.com` (9 liens, 0 sur le domaine) | IA-ENT | F4-P0 | CONFIRMÉ (re-tiré, mix de sources différent, verdict identique) | portée : **un seul** moteur de réponse testé |
| GEO-021 | Le statut « organisme de formation certifié Qualiopi » n'est corroboré par aucun registre public (`est_qualiopi: false`, `est_organisme_formation: false`) | IA-ENT | F5-P0-a | CONFIRMÉ (vérifié au registre par H3) | STOP (question factuelle à Will) |
| GEO-022 | Le boilerplate presse public annonce « fondé en 2024 » (vs Kbis et JSON-LD 2026) et n'ancre ni Grenoble ni le SIREN | IA-ENT | F6-P0-b | CONFIRMÉ (fichier lu intégralement) | ORDRE : n'y ajouter Qualiopi **qu'après** GEO-021 |
| GEO-023 | Les pages ISR lisant la DB sont absentes des deux listes du job `warm` : identité légale et bloc avis amputés ~1 h après chaque atterrissage | PERF | A3-P0 (+A3-P1-1, A3-ADD, B1-P0-A, B6-P0, F3-P1-1, F5-P0-b, F7-P0-a v2, G3-P0 v1) | CONFIRMÉ | mécanisme corrigé (cache CF **par PoP**, C-16) |
| GEO-024 | `lhci`, `indexnow` et `warm` démarrent **en parallèle** après `deploy` : les moteurs sont pingés et la page mesurée pendant la fenêtre stub | PERF | G3-P0 (+G1-P1-3) | CONFIRMÉ | STOP/ORDRE — retenir la variante **G3** (C-03) ; la variante G1 peut désarmer le seul gate bloquant |
| GEO-025 | Les deux gates de budget annoncés « bloquants » dans AGENTS.md sont en `continue-on-error` — et `size-limit` cible 3 buckets `/reserver` morts, sans bucket `/appel` | PERF | G1-P0-1 | CONFIRMÉ (+ arbitrage C-05) | **à faire en premier** : tout le reste des notations de risque en dépend |
| GEO-026 | First Load JS ≈ 240 KB gz sur 100 % des routes, soit ×3,2 le budget de 75 KB, et aucune gate ne le mesure | PERF | G1-P0-2 | CONFIRMÉ (5 chunks = 167 KB gz hors polyfills) | |
| GEO-027 | Le logo Qualiopi est un PNG de 1,27 Mo servi brut sur 100 % des pages | PERF | G4-P0-1 | CONFIRMÉ (pesé : 1 304 554 o) | STOP (charte de marque) — **hors GEO** : le fichier porte un manifeste C2PA « GPT-4o / trainedAlgorithmicMedia » |
| GEO-028 | L'avatar auteur est un PNG de 1,44 Mo affiché en 64 × 64 sur toutes les pages éditoriales | PERF | G4-P0-2 | CONFIRMÉ (pesé : 1 513 427 o) | |

---

## Bloc P1 — 98 findings (opportunité forte perdue)

### Domaine CRAWL & découverte (7)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-029 | Les schémas d'autorité (FAQPage, QAPage, ItemList, Place, AggregateOffer) sont émis en `afterInteractive` et absents du HTML servi | B2-P0 (+B4-P1-1, D4-P1-4, D5-P1-3d, G2-P1-2) | CONFIRMÉ — P0 → **P1** (portée : 480 pages déclarées, pas ~4 300) | STOP + ADR ; hypothèse H4 corrigée : **TBT neutre à améliorant** |
| GEO-030 | Monitoring d'indexation inexistant : HCU-monitor est un stub, `gscInspectUrl` n'a aucun appelant | F2-P1-4 (+F7-P1-3) | CONFIRMÉ | |
| GEO-031 | Les deux exports Observatoire, annoncés « données ouvertes » dans `llms.txt` et déclarés en `DataDownload`, sont bloqués par `robots.txt` | A1-P1-3 (+B4-P1-3) | CONFIRMÉ | forme **étroite** retenue (2 entrées explicites, arbitrage H4 C-6) |
| GEO-032 | Les CSV hebdomadaires « crawl-stats » ne contiennent pas de crawl stats (ce sont des données Search Analytics) : le gate « crawl budget < 30 % » n'a jamais été mesuré | F7-P1-2 | CONFIRMÉ | renommer script + workflow + glob dans **le même** commit ; prévenir F2 et F3 |
| GEO-033 | `/galerie` : canonical auto-référente sur n'importe quel paramètre inventé + variantes 0-résultat indexables (piège à crawl) | C5-P1 | CONFIRMÉ | |
| GEO-034 | Le hub `/fr/implantations` pèse 8,8 Mo et émet 2 157 liens dont ~1 677 (78 %) vers des pages `noindex` | C4-P1-6 | CONFIRMÉ (8 792 194 o reproduits à l'octet) | ORDRE : à co-signer avec D4 (change la profondeur de crawl de tout l'îlot pSEO) |
| GEO-035 | Les 576 liens de téléchargement de la galerie sont crawlables et écrivent en base à chaque hit (Sharp + 2 `INSERT/UPDATE`) | **H6 (nouveau)** ; reformule A4-P1-1 | CONFIRMÉ (mécanisme) — attribution aux bots `[À CONFIRMER]` par SQL | **cross-ref GEO-036 et GEO-095** |

### Domaine SITEMAPS & feeds (6)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-036 | Le `lastmod` d'`images-fr.xml` est détruit sur 288 URLs par des écritures DB déclenchées par le crawl (7 lignes bumpées en 8 h de nuit) | A4-P1-1, arbitré par H1 puis **H6** | CONFIRMÉ (symptôme + nouvelle root-cause) | ❌ patch d'origine (`publishedAt ?? createdAt`) **éliminé seul** ; ORDRE avec GEO-035 et GEO-095 |
| GEO-037 | `<image:license>` CC BY 4.0 déclarée inconditionnellement sur des photos Unsplash dans `sitemap-images-services.xml` | A4-P1-2 | CONFIRMÉ | P1 juridique / P2 GEO — à porter dans les deux colonnes |
| GEO-038 | `/api/markdown/<type>` : les types `glossaire` et `centre-aide` sont annoncés en `<link rel="alternate">` mais répondent 404 | A5-P0-2 (+F1-P1-1, F1-P1-3) | CONFIRMÉ — P0 → **P1** (6 pages indexables, pas 66) | ORDRE : le volet glossaire n'a de sens qu'**après** GEO-127 |
| GEO-039 | `/api/markdown/cas-concrets/*` répond 200 avec un corps vide (titre + pied de page, zéro contenu) — pire qu'un 404 | F1-P1-2 | CONFIRMÉ (corps intégral relevé) | cas **distinct** de GEO-038, même PR |
| GEO-040 | Le feed FAQ sert 70 tokens de prix bruts, 1 550 items et 1,1 Mo sans aucun `pubDate` | A5-P1-1 | CONFIRMÉ | livrer le volet « tokens » **séparément** des volets cap/pubDate (risque agrégateur) |
| GEO-041 | La base de connaissances (507 fiches citables) est absente du canal `llms.txt` ; l'exporter d'enrichissement est du code mort | D5-P1-1 | CONFIRMÉ (`llms.txt` : 0 URL `/fr/connaissances`) | meilleur rapport effort/impact de la squad D (1 ligne statique) |

### Domaine JSON-LD & entité (15)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-042 | `AggregateOffer` des hubs ville incohérent et partiellement faux (`lowPrice` 1190 alors que 2 offres valent 990 ; `highPrice` qui ne borne rien ; coaching dirigeant au prix collaborateur ; naming « Audit IA Flash » aboli) | B2-P1-1 | CONFIRMÉ (5/5 sous-points vérifiés) | STOP annexe : `Offer.price` ferme sur un tier `isFromPrice` |
| GEO-043 | Aucun prix machine-readable sur les 4 fiches audit ni sur `/tarifs` (le nœud `offers` n'est émis que si `priceEur` est passé) | B2-P1-3 | CONFIRMÉ | `priceSpecification.minPrice` = traduction machine de « à partir de » — décision 4 respectée |
| GEO-044 | `BlogPosting.description` vide sur tout le corpus blog DB (`excerpt` n'est jamais écrit par le worker de publication) | B3-P1-1 | CONFIRMÉ (3 preuves indépendantes) | volume réel : **126** articles (C-09) |
| GEO-045 | `sameAs` de l'Organization à 3 entrées, aucun nœud registre ; Wikidata à zéro item | B1-P1-1 (+F5-P1-2) | CONFIRMÉ (Wikidata : `"search":[]`) | STOP + ORDRE : corriger les fiches tierces (GEO-112) **avant** de les déclarer |
| GEO-046 | Citations locales NAP : module 100 % inerte (0/10 annuaires), jamais injecté dans aucun JSON-LD, alors que 8 profils existent réellement | B1-P1-2 (+F6-P1-2) | CONFIRMÉ | le test LC5/LC6 fige `listed = 0` → **à amender dans le même commit** (H4 C-7) |
| GEO-047 | Nœud `Person` « Manon » DB-dépendant : `author @id` orphelin sur 1 500+ fiches servies depuis le rendu de build | B4-P1-2 | CONFIRMÉ (impact ramené à **moyen**) | do-not-touch : le Proxy de `prisma.ts` (ADR 0026) |
| GEO-048 | 53 offres d'emploi sur 54 partagent le même `datePosted` à la milliseconde (falaise de fraîcheur ≈ 2026-09-27) | B5-P0-2 | CONFIRMÉ — P0 → **P1** (les offres sont fraîches à date) | ❌ volet 1 du patch (reculer les dates) **éliminé** — remède pire que le mal |
| GEO-049 | Deux `JobPosting` concurrents pour la même offre commerciale, sur deux URLs (20 communes en intersection) | B5-P1-1 | CONFIRMÉ | ne pas fusionner avec GEO-023 (patches indépendants) |
| GEO-050 | `title` des offres non conformes aux règles Google for Jobs sur ~16 offres (nom d'entreprise, `(H/F)`, `(full remote)`, > 75 car.) | B5-P1-2 | CONFIRMÉ | réserve H1 : livrer la variante `jobTitleClean` + relecture humaine, pas le regex aveugle |
| GEO-051 | `hiringOrganization` auto-référencé et hors graphe sur `/devenir-commercial-ia` (pas d'`@id`, `sameAs` pointant le site lui-même) | B5-P1-3 | CONFIRMÉ (le patch le plus sûr du lot B) | corrige au passage 1 des 3 occurrences LinkedIn fautives |
| GEO-052 | Étoiles SERP structurellement inaccessibles : `AggregateRating` uniquement sur `Organization` (self-serving) et sur 5 facettes sans autorité | B6-P1 | CONFIRMÉ (`/fr/audit` : 7 blocs `ld+json`, **0** `aggregateRating`) | condition d'exécution : valider au Rich Results Test sur **1** page avant de généraliser |
| GEO-053 | `Organization` divergente ré-émise sous le même `@id` sur les 288 pages galerie (`foundingDate` 2024 **et** 2026 dans le même document) | E2-P1-3 | CONFIRMÉ live | |
| GEO-054 | `sameAs` du graphe images : `x.com/AxionIA` répond **404** sur 289 pages galerie | F6-P1-1 | CONFIRMÉ (`curl -L -I` → 404) | |
| GEO-055 | NAP sans « P » : aucun téléphone public dans le graphe, aucun Google Business Profile | F5-P1-3 | CONFIRMÉ | réserve : siège = domiciliation en centre d'affaires → risque de refus GBP |
| GEO-056 | 9 images déclarées en JSON-LD et au sitemap ne sont plus affichées (`/roi` ×4, `/formations/entreprise` ×5), et l'image `representativeOfPage` n'est pas rendue du tout | E2-P1-1 | CONFIRMÉ (aggravé par H3) | |

### Domaine METADATA & indexabilité (6)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-057 | Double marque dans les `<title>` : `· Axion-IA · Axion-IA` sur ~290 pages galerie et `· FAQ Axion-IA · Axion-IA` sur les fiches FAQ | C1-P1-1 (+F3-P1-2) | CONFIRMÉ — impact **moyen** (volume ÷ 3, C-01) | |
| GEO-058 | Aucune image OG générée n'est cachée par le CDN : ~2 s de rendu Satori à l'origine **à chaque** fetch, `cf-cache-status: DYNAMIC` | C2-P1-1 | CONFIRMÉ (2 fetches identiques, 1,985 s puis 2,026 s) | réserve : borner le remplissage de cache par `title` arbitraire |
| GEO-059 | `og:image` des articles blog = Unsplash `w=1080` sous le plancher Discover, avec `width`/`height` déclarés 1200×630 (faux) | C2-P1-2 | CONFIRMÉ | |
| GEO-060 | `/en/book-a-call` → 301 `/fr/appel-a-call` → **404** (collision de préfixe sans frontière de segment dans `mapEnToFr`) | C3-P1-1 | CONFIRMÉ — impact **moyen-faible** (EN désactivé, décision 1) | 1 ligne, 30 secondes |
| GEO-061 | 11 URLs publiques stratégiques sont rendues dynamiquement (`private, no-store`, `cf BYPASS`, 3 `Set-Cookie`) malgré leur `revalidate` | G1-P1-1 | CONFIRMÉ (6/6 reproduites hors fenêtre) | corrections H3 : `/fr/galerie` = 60 s, `/fr/appel` = 900 s ; **retirer `/fr/recherche`** de la liste |
| GEO-062 | La checklist des 60 items SEO/AEO n'est gardée par rien : son exécutant est un stub de 195 octets, absent de tous les workflows, et son composant de revue n'existe pas | H5-Bloc 2 | CONFIRMÉ | préférer l'option 1 (vérité de documentation) ; **ne pas** ajouter un 3ᵉ gate décoratif |

### Domaine CONTENT-GEN qualité AEO (16)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-063 | Plancher de cadence à 96 jobs/jour : `dailyArticles` est décoratif sous 96 (mesuré ×4,8 la cible) | D1-P1-1 | CONFIRMÉ | ORDRE : prérequis de rallumage (a contribué à l'épuisement du quota) |
| GEO-064 | Les guides pilier n'ont ni sommaire ni `HowTo` : l'extracteur d'étapes attend du markdown, le générateur écrit du HTML | D2-P1-1 | CONFIRMÉ (JSON-LD = `Article` seul, 0 `HowTo`) | le « toc » présent dans le HTML n'est **que** des classes CSS |
| GEO-065 | Double bloc « Sources » sur chaque article (corps + composant), qui pollue le sommaire, l'`ItemList` et le compteur de H2 du scorer | D2-P1-5 | CONFIRMÉ (même lien présent 2 fois) | |
| GEO-066 | La doctrine « block » ne bloque rien : seuls SIREN/SIRET/RCS sont des hard-faults ; CPF, sur-promesses de financement, partenariats et stats fabriqués sont publiés | D3-P1-1 | CONFIRMÉ — impact **moyen** isolément, **fort** couplé à GEO-007 | ORDRE : livrer avec GEO-009, ou pas du tout |
| GEO-067 | Le multi-judge est activé en prod mais inerte sur les 7 générateurs principaux : l'auto-publication tier-1 ne passe par aucun juge LLM | D3-P1-2 | CONFIRMÉ (1 seul appelant réel) | STOP/ORDRE : à poser **après** la recharge OpenAI, avec fail-soft non négociable |
| GEO-068 | 100 % du corpus KB publié est sous les seuils de sa propre quality-gate (44 mots vs 500, 0 `<h2>`) — les gates n'ont jamais tourné en prod | D5-P1-2 | CONFIRMÉ (aucun `<h2>` de corps sur la fiche témoin) | piège inverse : la gate n'ayant jamais tourné, sa justesse n'est pas prouvée non plus |
| GEO-069 | 54 % des liens de citation ont un intitulé inexploitable (URL brute ou markdown) → ancres et `isBasedOn` dégradés | D6-P1-1 | CONFIRMÉ (2/4 sur l'échantillon live) | |
| GEO-070 | Le monitor de fraîcheur des liens écrit dans un système de fichiers éphémère → catalogue de citations figé au 2026-05-22 | D6-P1-3 | CONFIRMÉ (cohérence architecturale ADR 0026) | |
| GEO-071 | « Dernière vérification : `<date de l'article>` » sous le bloc Sources est une affirmation E-E-A-T fausse | D6-P1-4 | CONFIRMÉ | |
| GEO-072 | La correction automatique des chiffres réfutés réécrit des articles publiés sans laisser aucune trace publique | D6-P1-5 | CONFIRMÉ | ❌ le patch **ne doit pas** bumper `dateModified` (doctrine anti date-gaming) — trace publique seulement |
| GEO-073 | Le worker anti-decay `content-refresh` est triple-mort : flag OFF, aucun cron, aucun producteur | D7-P1-1 | CONFIRMÉ — impact **moyen** (scan + alerte seulement, ne rafraîchit rien) | ORDRE : après la recharge OpenAI |
| GEO-074 | La banque stratégique de 1 835 mots-clés n'a jamais alimenté une seule génération (`usage_count` = 0 depuis le 2026-06-16) | D8-P1-1 | CONFIRMÉ | piège inverse : le sélecteur `FOR UPDATE SKIP LOCKED` n'a jamais tourné en prod |
| GEO-075 | « Qualiopi » est banni de la banque de mots-clés sur une prémisse périmée : couverture **zéro** de la famille « organisme de formation IA Qualiopi » | D8-P1-2 | CONFIRMÉ (le site sert `/fr/certification-qualiopi` en 200 et 116 occurrences en home) | ne retirer **que** le token « Qualiopi » — les bans OPCO/CPF/financement restent (décisions 7 et 8) |
| GEO-076 | Le kill-switch OpenAI gèle aussi le sync GSC (gratuit), l'élagage tier-lifecycle, le cycle de vie news et le détecteur d'opportunités | D8-P1-3 (absorbe D7-P1-2 et D7-P1-3 réfutés) | CONFIRMÉ — **cause commune de 4 symptômes, un seul patch de découplage** | ajouter : corriger le commentaire périmé `content-publish-worker.ts:615-617` |
| GEO-077 | Détecteur d'opportunités structurellement inerte : `axionOpportunity` est lu et jamais écrit ; les alertes concurrents n'ont jamais été implémentées | D8-P1-4 | CONFIRMÉ (défaut structurel, **pas** une conséquence du kill switch) | |
| GEO-078 | Le tracking GSC ne couvre que les Articles blog/news : les requêtes cœur nationales et les pages stratégiques sont invisibles | D8-P1-5 | CONFIRMÉ | réutiliser la constante des 15 pages du budget Web Vitals |

### Domaine pSEO & maillage (10)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-079 | Tous les liens internes injectés in-body sont locale-less → un 301 par lien sur tout le corpus | C4-P1-1 | CONFIRMÉ | ORDRE : la réécriture au rendu doit être chiffrée en TBT par G1 avant merge |
| GEO-080 | Hub carrières : les 54 liens d'offres sont locale-less (`next/link` au lieu de next-intl) | C4-P1-2 | CONFIRMÉ (54 reproduits) | |
| GEO-081 | Chaînes de redirection à 2 sauts dans les corps persistés (`/reserver`, `/interventions/*`) | C4-P1-5 (+C3-P2) | CONFIRMÉ | un seul patch résout les deux |
| GEO-082 | L'historique de slugs KB est écrit pour tous les types mais consommé par `/guides` seul : un rename ailleurs = 404 sec | C3-P1-2 | CONFIRMÉ (code) — **volumétrie INCERTAINE** | trancher par `SELECT "oldType", count(*) FROM "KnowledgeSlugHistory" GROUP BY 1` |
| GEO-083 | `X-Robots-Tag` absent sur `/formations/par-ville/*` et `/un-a-un/par-ville/*` — et le test verrouille une route qui n'existe plus | D4-P1-1 | CONFIRMÉ | **H4-ÉLEVÉ** — le set de 455 slugs doit être **généré**, jamais saisi ; sinon 500 sur toute la famille (middleware Edge sans try/catch) |
| GEO-084 | 65 % des meta-descriptions des villes indexées partagent leurs 80 premiers caractères | D4-P1-2 | CONFIRMÉ — impact **moyen-fort** (Google réécrit les descriptions dupliquées) | |
| GEO-085 | H1 identique sur les 2 157 pages villes, sans mot-clé de service, avec `data-speakable-hero` posé sur une question rhétorique | D4-P1-3 | CONFIRMÉ | ORDRE : vérification CLS par G1 avant merge (budget CLS = 0 strict) |
| GEO-086 | 95 des 480 pages villes indexées portent un défaut qualité auto-déclaré (`Quality score` < 75), jamais remédié | D4-P1-6 | CONFIRMÉ (fait) | STOP — option par défaut = **sortir du sitemap sans toucher aux `<meta>`** (l'autre casse l'invariant monotone) |
| GEO-087 | La garde anti-doorway mesure les fichiers copy (verte à 20 %) pendant que le rendu affiche 52 % de similarité — et aucune CI ne l'exécute | D4-P1-7 | CONFIRMÉ | livrer en mode **informatif** d'abord |
| GEO-088 | Hub `/connaissances` orphelin de la navigation : 48 fiches liées sur 507 | D5-P1-3 (+C4-P2) | CONFIRMÉ (48 et 507 reproduits à l'unité) | |

### Domaine IMAGES (14)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-089 | Le seed écrase `alt`/`title`/`caption` par une dérivation mécanique du slug, et l'enrichissement ne les régénère jamais | E1-P0-a | CONFIRMÉ — P0 → **P1** (récurrence réfutée : 24 runs de seed, tous en mai 2026 ; et la moitié de l'impact est nulle, C-12) | volume **non tranché** : 133 ou 288 (C-21) ; question neuve : pourquoi le `workflow_run` ne se déclenche-t-il jamais ? |
| GEO-090 | Zéro EXIF/XMP/IPTC sur 100 % des fichiers publiés : `embedCopyrightMetadata()` n'a aucun appelant | E1-P1-1 | CONFIRMÉ (module intégralement mort) | |
| GEO-091 | `withMetadata({orientation:1})` **conserve** l'EXIF (GPS compris) au lieu de le stripper — le commentaire RGPD affirme l'inverse — et rien n'auto-oriente les photos | E1-P1-2 | CONFIRMÉ | ORDRE imposé : **dimensions réelles d'abord** (GEO-092), orientation ensuite ; ne pas justifier par une dépréciation inexistante |
| GEO-092 | Dimensions et poids de la base sont fictifs (devinés depuis le suffixe du slug), `fileSize = 0` partout | E1-P1-3 | CONFIRMÉ (mécanisme) — comptages `[À CONFIRMER]` | |
| GEO-093 | 75 `thumbnailUrl` en 404 dans les JSON-LD (et dans la console admin) | E1-P1-4 | CONFIRMÉ (404 reproduit) | comptage `[À CONFIRMER]` |
| GEO-094 | Chaîne d'upload admin cassée de bout en bout : aucune image UUID n'existe en prod, 3 valeurs par défaut divergentes pour `IMAGE_BANK_STORAGE_PATH`, absente de `env.ts` | E1-P1-5 | CONFIRMÉ (aggravé par H3) | le chemin **Server Action** est déjà correct — ne pas réécrire ce qui existe |
| GEO-095 | `trackUsage()` n'est appelée nulle part : `image_usage_logs` reste vide, la mesure des referrers IA est morte | E1-P1-7 | CONFIRMÉ | **ORDRE critique** : ne poser ce patch qu'après avoir vérifié qu'il n'écrit pas sur la ligne image (sinon il fabrique GEO-036) |
| GEO-096 | 5 pages éditoriales sont au sitemap images mais sans graph `ImageObject` ni `primaryImageOfPage` | E2-P1-2 | CONFIRMÉ | |
| GEO-097 | Garanties de résultat incrustées dans des visuels publiés (« GAINS MESURABLES ASSURÉS », « 100 % GAGNANT ») | E3-P1-1 | CONFIRMÉ par inspection visuelle | 59 héros (pas 58, C-13) ; contredit la décision actée 8 |
| GEO-098 | Héros Unsplash hors-sujet et `alt` en **anglais** sur les articles content-gen (aucune normalisation FR nulle part) | E3-P1-2 | CONFIRMÉ (volet alt, sans échappatoire) | contredit frontalement la décision actée 1 — ce qui **renforce** le finding |
| GEO-099 | Sitemaps images villes : l'image déclarée n'est pas celle rendue (bannière générique partagée pour toutes les villes) | E3-P1-3 | CONFIRMÉ live (6/6 premiers `<image:loc>` identiques) | |
| GEO-100 | Zéro instrument ne mesure la recherche d'images : `type: "image"` n'est demandé nulle part, tout le pilotage GSC est aveugle aux images | E4-P1-1 | CONFIRMÉ | |
| GEO-101 | Les 129 `<image:loc>` du sitemap blog pointent tous vers `images.unsplash.com` : la valeur d'indexation image du corpus éditorial est cédée à un hôte tiers | E4-P1-2 | CONFIRMÉ (129/129, 0 sur `axion-ia.com`) | l'option « passer par l'optimiseur » est techniquement praticable (`remotePatterns`) |
| GEO-102 | Deux visuels publiés affichent la marque sous la forme « Axion-IA.com » (graphie LinkedIn) et l'un porte la faute « RECOMMANDATIONS CONCRÉTÉS » | **H3 (neuf, dans E3)** | CONFIRMÉ par inspection visuelle | cohérent avec GEO-110 (même graphie de marque) |

### Domaine SERP — moteurs classiques (4)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-103 | Google ne reconnaît pas la marque et corrige « axion-ia » en « action ia » ; aucune requête de marque n'existe dans son autocomplete | F3-P1-3 | CONFIRMÉ (liste **identique**, même ordre, sur un second tirage à 7 h d'écart) | |
| GEO-104 | Chaîne de soumission GSC morte : token OAuth `readonly`, 6 derniers runs planifiés = 6 échecs (06/07 → 10/08) | F2-P1-1 | CONFIRMÉ (`gh run list`) | |
| GEO-105 | IndexNow n'atteint que Yandex ; le client Bing WMT existe mais n'a **aucun appelant** et sa fonction de soumission n'est même pas écrite | A6-P1-1 (+F2-P1-2) | CONFIRMÉ | effort **M**, pas S — il faut écrire la fonction ; ne pas re-diagnostiquer la clé (décision 11) |
| GEO-106 | Bing : observabilité zéro — les 3 fonctions du client API n'ont aucun consommateur, aucune donnée mesurable | F2-P1-2 | CONFIRMÉ | la cause racine côté Microsoft est un reste-Will acté (ticket UCM000007450870) |

### Domaine IA & entité vérifiable (7)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-107 | Requêtes commerciales : 0 citation, la place est captée par des listicles tiers où Axion-IA n'existe pas — et le critère de tri du moteur est **Qualiopi** | F4-P1-1 | CONFIRMÉ (reproduit, 7 sources, 0 mention) | relie directement à GEO-021 |
| GEO-108 | Intent « avis » : l'homonyme Axion Formations (Saint-Quentin) capte la réputation ; aucune page `/fr/avis/**` ne remonte | F4-P1-4 | CONFIRMÉ (reproduit) | |
| GEO-109 | `llms.txt` affirme le maximum (Qualiopi, financements) sans aucune ancre vérifiable — ni siège, ni SIREN, ni raison sociale — et désambiguïse le mauvais homonyme (`axionai.fr` au lieu d'AXION FORMATIONS et « action ia ») | F4-P1-3 (+F5-P1-5) | CONFIRMÉ (0 `SIREN`, 0 `108018631`, 0 `Grenoble`) | **H4-ÉLEVÉ** — les 2 routes sont `runtime = "edge"` et `legal-identity.ts` importe Prisma au niveau module ; écrire le SIREN en dur rougit `check-anti-siren.sh`. Seul chemin sûr : `env.COMPANY_*` ⇒ **dépend de GEO-003** |
| GEO-110 | Le profil LinkedIn — seul tiers à autorité — contredit le registre sur trois attributs : « Paris » vs Grenoble, « 2025 » vs 2026, « Axion-IA.com » vs AXION IA (et 7 abonnés) | F5-P1-1 | CONFIRMÉ (re-fetch indépendant + addendum F6) | reste-Will pur (hors code) |
| GEO-111 | Le lien LinkedIn sitewide du footer et deux `sameAs` divergent du slug déclaré partout ailleurs (3 occurrences `axion-ia` contre 8 `axion-ia-france`, les deux servies dans le même HTML) | F6-P0-a | CONFIRMÉ (incohérence) — P0 → **P1** ; l'attribution « société homonyme canadienne » reste **INCERTAINE** (authwall) | correctif identique dans les deux cas : constante unique dans `brand.ts` |
| GEO-112 | Les 2 fiches tierces les plus visibles ancrent l'entité à **PARIS** (138 Champs-Élysées, 75008) et écorchent le nom du fondateur | F6-P1-3 | CONFIRMÉ (re-fetch indépendant) | **ORDRE** : à corriger **avant** GEO-045 |
| GEO-113 | Le « moteur de backlinks passif CC BY » est du code mort : `EmbedCodeButton` n'est monté nulle part, et son propre commentaire affirme le contraire | F6-P1-5 | CONFIRMÉ (3 hits, tous dans le fichier lui-même) | |

### Domaine PERF & rendu (13)

| ID | Titre canonique | Agents (doublons) | Statut | ⚠️ |
|---|---|---|---|---|
| GEO-114 | Le seul gate bloquant mesure 5 URLs, en desktop seul, **sans assertion INP**, et 26 s après l'atterrissage | G1-P1-2 | CONFIRMÉ (INP absent des 2 branches d'`assertMatrix`, `warn` à 80 ms jamais `error`) | |
| GEO-115 | Les deux pages les plus lourdes du site (`/fr/implantations`, `/fr/faq`) ne sont dans aucune gate, et l'audit qui les aurait détectées (`dom-size`) est désactivé | G1-P1-4 | CONFIRMÉ | STOP sur le volet « paginer `/fr/implantations` » (découvrabilité) — arbitrage avec GEO-034 et D4 |
| GEO-116 | ~90 % du poids de chaque document est de la charge non-contenu (payload RSC + CSS inlinée) — taxe directe sur le budget de crawl | G1-P1-5 | CONFIRMÉ (1 750 744 o reproduits à 0,3 %) | STOP + ADR sur la bascule `inlineCss` (contredit le Sprint 24bis) |
| GEO-117 | Le HTML brut transporte ~920 Ko de CSS dupliqués 4 fois (52 % du document sur `/fr`, jusqu'à 81 % sur les pages légères), avec fuite des utilitaires admin dans la feuille publique | G2-P1-1 | CONFIRMÉ (3 corroborations indépendantes) | **H4-ÉLEVÉ** sur le patch `@source not` : `admin.css` n'a **aucun** `@import "tailwindcss"` → l'exclusion casserait la console admin **sans qu'aucune gate ne rougisse** |
| GEO-118 | Les ~480 hubs villes (`revalidate = 86400`, aucun `cacheHandler`, aucun volume `.next/cache`) ne régénèrent jamais : le bloc « contenus IA à {ville} » est structurellement absent | G3-P1-1 | CONFIRMÉ (mécanisme) — **amplitude INCERTAINE** | trancher `Article.mentionedCities` avant de chiffrer le gain |
| GEO-119 | Cloudflare réécrit `max-age` (300 → 3600) et ignore `s-maxage=600` sur tous les XML : le correctif d'indexation P1-13 est inopérant en prod | G3-P1-2 (+F1-P2) | CONFIRMÉ (reproduit sur une réponse `EXPIRED`, donc non issue du cache) | STOP — préférer un **Edge TTL explicite de 600 s** à « Respect origin » aveugle (coût origine non chiffré) ; do-not-touch : ne pas remonter `max-age` dans le code |
| GEO-120 | Aucune mutation de contenu ne purge l'edge : `revalidatePath` n'invalide que l'origine, et Cloudflare fige même les réponses `x-nextjs-cache: STALE` | G3-P1-3 | CONFIRMÉ (1 seule occurrence de `purge_cache` dans tout `src/`) | borner à 30 URLs/publication (quota CF Free) |
| GEO-121 | Aucune gate ne mesure le mobile : les 2 projets Playwright mobile existent et ne sont exécutés nulle part, le gate post-deploy est desktop-only | G4-P1-1 | CONFIRMÉ | livrer en **WARN** d'abord (sinon blocage immédiat des déploiements) |
| GEO-122 | `aria-label` plus court que le texte visible : WCAG 2.5.3 (niveau A) échoué sur la home et sur toute la famille villes | G4-P1-2 | CONFIRMÉ (code + Lighthouse nocturne, 3 runs) | explique **pourquoi** la garde axe existante ne rougit pas (règle expérimentale) |
| GEO-123 | Deux `<main>` (en réalité **7** imbriqués) sur ~291 pages publiques : le contenu principal n'est plus identifiable | G4-P1-3 | CONFIRMÉ — **sous-évalué** (7 emplacements, pas 4) | le bon patron existe déjà dans 3 gabarits |
| GEO-124 | Outline de titres cassé (`h1 → h3`) sur des hubs stratégiques | G4-P1-4 | CONFIRMÉ | patch sans risque visuel |
| GEO-125 | La home mobile télécharge 62 Ko d'image hero jamais affichée (`hidden lg:block` + `priority`) | G4-P1-5 | CONFIRMÉ — **patch corrigé** : le `sizes` fautif vient du défaut d'`Illustration.tsx`, partagé par tout le site | ❌ ne PAS patcher `Illustration.tsx` — surcharger `sizes` **depuis la home** |
| GEO-126 | `/fr/faq` : 13 174 nœuds DOM et 1 646 éléments interactifs hydratés sur mobile (le cap 50 a été posé sur le JSON-LD, pas sur le payload client) | G4-P1-6 | CONFIRMÉ | garde-fou **capital** : toute solution qui sort les Q/R du HTML initial est une régression AEO nette |

---

## Bloc P2 — 21 findings (polish, dette, ou requalifiés à la baisse)

| ID | Titre canonique | Domaine | Agents | Statut | ⚠️ |
|---|---|---|---|---|---|
| GEO-127 | Glossaire : 60 termes sous le seuil `GLOSSARY_MIN_INDEX_WORDS` donc `noindex`, `glossaire.xml` n'émet que le hub | SITEMAPS | A2-P1-2, F1-P1-4 (volet glossaire) | CONFIRMÉ — **dette de contenu déjà tracée dans le code**, pas un bug | ❌ patch « déclarer les enfants au sitemap » **éliminé** (publierait 60 URLs `noindex`) ; seul remède : écrire ~60 × 60 mots (effort L) → `03-RESTE-WILL` |
| GEO-128 | `ai.txt` : `Allow: /` vaut opt-**IN** au training au sens du standard Spawning cité par le fichier lui-même | CRAWL | A1-P1-1 | CONFIRMÉ — P1 → **P2** (aucun bot de citation ne lit `ai.txt`) | ne rouvre pas la décision 2 |
| GEO-129 | `ai-policy.json` : `license: CC-BY-4.0` à la racine contredit `training.allowed: false` | CRAWL | A1-P1-2 | CONFIRMÉ — P1 → **P2** en grille GEO (prioritaire en grille juridique) | |
| GEO-130 | `/fr/demande-devis/confirmation` est `noindex` **et** déclarée dans `sitemap/pages.xml` | SITEMAPS | A2-P1-1 | CONFIRMÉ — P1 → **P2** (1 URL sur **86**, C-11) | |
| GEO-131 | `/fr/ressources` n'est déclaré dans aucun sitemap alors qu'il est indexable | SITEMAPS | A3-P1-2 | CONFIRMÉ — P1 → **P2** ; **effort corrigé S → S/M** : la clé n'existe pas dans `routing.pathnames` | touche le routage i18n |
| GEO-132 | `llms.txt` / `llms-full.txt` annoncent une publication « hebdomadaire » devenue fausse depuis le 2026-07-20 | SITEMAPS | A3-P1-3 / A5-P1-2 (seul survivant) | CONFIRMÉ | le reste de ces deux findings est éliminé (décision 10) |
| GEO-133 | Bouton admin « Ping IndexNow » structurellement mort : 401 garanti (la signature HMAC n'est calculée nulle part) puis endpoint unique 403 | CRAWL | A6-P1-2 | CONFIRMÉ — P1 → **P2** (outil interne ; le pipeline réel fonctionne) | |
| GEO-134 | Communiqués de presse : aucune notification aux moteurs à la publication | CRAWL | A6-P1-3 | CONFIRMÉ — P1 → **P2** (1 seul communiqué, rattrapé par le cron J-7) | utiliser `@/lib/indexnow`, **pas** le helper content-gen (isolation-check) |
| GEO-135 | Formations par-ville annoncées « sur devis » alors que les prix sont publics partout ailleurs (deux décisions Will à 2 jours d'écart, jamais réconciliées) | JSONLD | B2-P1-2 | CONFIRMÉ — P1 → **P2** | STOP — B2 a raison de documenter sans trancher |
| GEO-136 | `dateModified` du JSON-LD et `lastmod` du sitemap lisent deux colonnes `@updatedAt` différentes (écarts de 1 à 2 jours) | JSONLD | B3-P1-2 | CONFIRMÉ — P1 → **P2** (bénéfice/risque défavorable : aligner peut faire **reculer** une date affichée) | préférer la voie « colonne `contentReviewedAt` dédiée » |
| GEO-137 | Volets 2 et 3 de l'alerte offres : plafonner l'alerte Telegram à 15 items et chunker `telegram.ts` à 3 900 caractères (échec silencieux aujourd'hui) | JSONLD | B5-P0-2 volets 2-3 | CONFIRMÉ | bénéficie à **toutes** les catégories de notification |
| GEO-138 | Canonical hérité du layout : toute page sans `alternates` annonce `canonical = /fr` | META | C1-P1-3 | CONFIRMÉ — P1 → **P2** (les 3 pages touchées sont `noindex` ou `Disallow`) | piège systémique préventif ; le patch exige les canonicals de `/fr/diagnostic` et `/fr/simulateur` **dans le même commit** |
| GEO-139 | Le bandeau « aucune génération depuis 4 h » est codé en dur et `detectedAt` est réécrit à chaque tick : un arrêt de 21 jours s'affiche « depuis 4 h » | CONTENT | D1-P0-1 (sous-partie survivante) | CONFIRMÉ en **P2** (observabilité pure) | ne pas re-lister le kill switch lui-même (décision 10) |
| GEO-140 | Aucune rétroaction échec → cadence : la boucle de tick ne lit aucun taux d'échec | CONTENT | D1-P1-2 | CONFIRMÉ — P1 → **P2** (défense en profondeur) | un seuil mal calibré **gèle** la production |
| GEO-141 | La cadence pilotée est celle des jobs créés, jamais celle des contenus publiés | CONTENT | D1-P1-3 | CONFIRMÉ — P1 → **P2** (observabilité pure) | |
| GEO-142 | `article:published_time` / `modified_time` / `author` / `section` / `tag` absents des articles de blog (présents sur `/actualites/`) | META | H5-Bloc 4 | CONFIRMÉ | volume réel **126** articles, pas 61 (C-09) ; ne pas recalculer les dates — réutiliser celles du JSON-LD |
| GEO-143 | Aucune date d'article n'est balisée `<time datetime>` | META | H5-Bloc 5 | CONFIRMÉ | P2 assumé : le signal porteur est `datePublished`/`dateModified` du JSON-LD |
| GEO-144 | `/qr/podcast` répond 404 en production alors que deux fichiers du code le documentent comme cible du flyer papier et du QR dynamique | CRAWL | H5-6.4 | CONFIRMÉ (live, avec contrôle négatif) | **reste-Will**, zéro code : créer le `QrLink` en console — à faire **avant** toute nouvelle impression |
| GEO-145 | `/fr/equipe/manon` — la page cible du `@id` `Person` de tout le JSON-LD éditorial — n'est déclarée dans aucun sitemap (contrairement à `/fr/equipe/williams`) | SITEMAPS | H5-6.6 | CONFIRMÉ (live) | ne PAS lever `isSlugTemplate` sur `/equipe/[slug]` |
| GEO-146 | `/fr/memo-isere` : indexable, absente de `pages.xml`, sans lien entrant, et hors des listes du job `warm` | SITEMAPS | A3-P1-1 (volet memo) + H5-6.5 | CONFIRMÉ (0 occurrence dans `pages.xml`, vérifié 02:29 UTC) | deux lectures possibles (noindex assumé vs déclaration) — **ne pas trancher seul** |
| GEO-147 | `guides.xml` : sub-sitemap redondant à 1 URL, `lastmod` figé au 2026-06-08 pour toujours | SITEMAPS | A2-P2 | CONFIRMÉ | option (a) : retirer l'id `guides` de `generateSitemaps()` |

---

## Bloc INCERTAIN — 8 findings (ni confirmés, ni réfutés)

| ID | Titre canonique | Domaine | Agents | Ce qui manque pour trancher |
|---|---|---|---|---|
| GEO-148 | `faq.xml` reste sur la convention metadata bakée sous stub : les Q/R DB-only peuvent disparaître du sitemap à chaque deploy | SITEMAPS | A2-P1-3 | Mécanisme réel, **perte actuelle = 0 URL**. `SELECT count(*) FROM faqs WHERE status='published' AND slug IS NOT NULL AND "indexationTier"='tier_1_indexable';` — risque **latent**, à traiter au moment d'une promotion |
| GEO-149 | `qa_derived` : le `QAPage` JSON-LD, la microdata et le wrapper de réponse directe sont détruits par le sanitizer au rendu | CONTENT | D2-P1-2 | Aucune page `qa_derived` isolable en prod. `SELECT slug FROM articles WHERE "sourceGeneratorId" = 'qa_derived' LIMIT 3;` puis curl |
| GEO-150 | Formats extractibles quasi absents du corpus (ni listes, ni tableaux, ni chiffres-clés) et rien ne le vérifie | CONTENT | D2-P1-3 | Balayage des 129 exports markdown non ré-exécuté (méthode saine, résultat non reproduit) |
| GEO-151 | La réponse directe par section (`<p data-aeo="answer">`) absente sur 13 % des sections et sur 100 % des contenus comparatifs | CONTENT | D2-P1-4 | Idem |
| GEO-152 | Banned-phrases « block » sur des mots courants (« unique », « le meilleur ») → sur-rougissement silencieux et déclassement en tier_3 | CONTENT | D3-P1-3 | L'état effectif de `banned_phrases` en prod est inconnu (le seed ne tourne pas au deploy). ⚠️ **en tension directe avec GEO-066** — exiger la mesure DB avant toute bascule de severity |
| GEO-153 | `organization` = hostname en MAJUSCULES sur 299/328 liens → `publisher` JSON-LD illisible | CONTENT | D6-P1-2 | Le fait **catalogue** est probablement exact ; la **conséquence rendue** n'est pas prouvée (0 occurrence sur l'article témoin). Re-tester sur une page à citations `auto-seeded` récentes |
| GEO-154 | Zéro observabilité du crawl réel : aucun access log HTTP nulle part, et l'endroit où en poser un est derrière le cache | CRAWL | F7-P0-b | Nécessite SSH (Traefik, `/var/log`, drivers Docker). Fortement corroboré côté code ; le caveat « un log d'origine sous-compterait le crawl » est **renforcé** par le cache par PoP (C-16) |
| GEO-155 | Sentry capte-t-il le `user-agent` ? La « télémétrie de crawl gratuite que personne n'exploite » existe-t-elle ? | CRAWL | F7-P1-1 | `sendDefaultPii: false` ⇒ le SDK n'attache normalement pas les en-têtes. **Prémisse probablement fausse** : présenter le patch comme la **création** d'un capteur (effort S → S-M), pas comme un branchement |

---

## Bloc ÉLIMINÉ — 8 findings écartés, avec le motif

| Finding d'origine | Agent | Motif d'élimination | Ce qui survit |
|---|---|---|---|
| « Flux Google News éteint depuis ~25 jours — escalader le diagnostic content-gen » | A3-P1-3 | **Décision actée n°10** : reste-Will déjà acté (recharger OpenAI, désarmer le kill switch, mémoire 2026-08-04). A3 conclut elle-même « aucun patch côté sitemaps » : le gating fait son travail | **GEO-132** (« hebdomadaire » devenu mensonger) |
| « Fraîcheur morte sur les 2 feeds vitrines (dernier item = 20 juillet) » | A5-P1-2 | Idem + **doublon** d'A3-P1-3. A5 écrit elle-même « déjà acté comme reste-Will → non répété » puis maintient le P1 | **GEO-132** |
| « Le `lastmod` d'`images-fr.xml` est pollué par `trackUsage()` » (root-cause) | A4-P1-1 | **Root-cause réfutée** : `grep -rn "trackUsage" src/` → 1 occurrence, sa propre définition, **zéro appelant** (H1) | **GEO-036** : symptôme confirmé, root-cause **remplacée** par H6 (liens `/telecharger` crawlables) |
| « 3 des 5 hubs catégorie blog listent 0 article » | C4-P1-3 | **Faux positif** : mesure prise sur une copie ISR/edge périmée (`x-nextjs-cache: STALE`, `cf-cache-status: EXPIRED`, SWR d'un an). Les hubs servent 84, 15 et 6 articles (H2, 02:22 UTC) — et aucun contenu n'a pu être créé depuis le 2026-07-20. ❌ Le patch (backfill SQL `categoryId`) aurait été un **UPDATE de masse sur une donnée saine** | Les hubs `/blog/categorie/*` méritent de rejoindre les listes du job `warm` (**GEO-023**) |
| « Machine à contenu à l'arrêt depuis 21 jours, sans garde-fou ni escalade » | D1-P0-1 | **Décision actée n°10** : conséquence connue d'un reste-Will acté. Le maintenir en P0 le ferait remonter en tête de synthèse comme une découverte | **GEO-139** (`detectedAt` écrasé + message figé « 4 h ») en P2 |
| « Élagage tier-lifecycle inopérant faute de creds GSC au container worker » | D7-P1-2 | **Réfuté par mesure** : D8 a constaté les 4 vars présentes dans web **et** worker (18:36 UTC). D7 a répété un **commentaire de code périmé** (`content-publish-worker.ts:615-617`). ❌ Le patch ops aurait redémarré le worker pour rien | **GEO-076** (le kill switch gèle l'élagage) + corriger le commentaire |
| « Fraîcheur "actualités" gelée depuis 25 jours » | D7-P1-3 | **Décision actée n°10** (conséquence du kill switch) | **GEO-076** (effet de bord silencieux du kill switch) |
| « `guides.xml` ne déclare que le hub, les fiches enfants ne sont dans aucun sitemap » — **volet guides** | F1-P1-4 | **Choix d'architecture documenté** (`sitemap.ts:131-133`) : les guides sont émis dans `sitemap-blog.xml` (3 relevés live par H3 **et** par H6). ❌ Le patch créerait des **doublons** entre deux sub-sitemaps | **GEO-127** (volet glossaire), dont le patch est lui aussi éliminé |

### Patches éliminés alors que leur finding survit (6)

1. **A4-P1-1** — basculer le `lastmod` sur `publishedAt ?? createdAt` : masque la cause. → **GEO-036**, traiter GEO-035 d'abord.
2. **B5-P0-2 volet 1** — redistribuer les `published_at` : rend les offres **plus vieilles** pour Google for Jobs et fabrique la date que Google lit (esprit de la décision 5). Le geste conforme existe : `republishJobOfferAction`. → **GEO-048**.
3. **F1-P1-4 volet glossaire** — déclarer 60 URLs `noindex` dans un sitemap : produit la classe d'erreur GSC « exclue par la balise noindex » et dégrade la confiance dans le sitemap-index entier, au moment précis où F2 mesure un drainage. → **GEO-127**.
4. **C4-P1-3** — backfill SQL `categoryId` : donnée saine. → finding éliminé.
5. **D7-P1-2** — poser les vars GSC sur le worker Coolify : elles y sont déjà. → finding éliminé.
6. **D6-P1-5** — bumper `dateModified` sur correction automatique : re-fabrique de la fraîcheur, exactement ce que le projet s'interdit. → **GEO-072**, trace publique seulement.
7. **A3-ADDENDUM** — « vérifier l'ordre des steps : purge puis revalidate puis warm » : **sans objet**, l'ordre est déjà correct (C-17).
8. **G1-P1-3** — `lhci: needs: [deploy, warm]` : remplacé par la variante G3 (C-03).

### Items de checklist écartés comme faux besoins 2026 (8) — ne PAS les combler

`geo.region`, `geo.placename`, `geo.position`, `ICBM` (D1-D4 de la checklist, marqués
`[BLOQUANT landings]`) : Google ne les lit plus, et le signal moderne équivalent
(`GeoCoordinates` dans le JSON-LD) **existe déjà** (`seo.ts:1457`, `:1511`). Les
ajouter à ~480 pages villes serait un patch à risque non nul pour un gain nul.
`meta author` / `publisher` / `copyright` (A10-A12) : aucun moteur ne les consomme.
`dns-prefetch images.unsplash.com` (A14) : les images transitent par l'optimiseur
**same-origin**, le navigateur ne résout jamais `unsplash.com`.
⚠️ À retenir quand même : le validator `search-intent-validator.ts:78` **nomme** ces
balises dans son message d'erreur alors que le champ testé (`hasGeoMeta`) est un proxy
sur un champ de job qui ne regarde jamais le HTML — **le libellé ment, pas le code**.

---

## Mesures brutes H6 (2026-08-15, UTC)

| # | Heure | Mesure | Résultat |
|---|---|---|---|
| 1 | 02:25:29 | `GET /sitemaps/images-fr.xml` | 200, **310 501 o**, 0,148 s — taille **identique** à A4 (08-14 18:06) |
| 2 | 02:25:34 | idem — `grep -c "<loc>"` | **289** |
| 3 | 02:25:48 | idem — en-têtes | `Age: 2296`, `cf-cache-status: HIT`, `last-modified: 01:47:32Z`, `x-axion-build-sha: f51d544b…` |
| 4 | 02:26:0x | idem — `grep -o "/fr/galerie/" \| wc -l` | **867** = 3 × 289 ⇒ **contradiction C-01 résolue** |
| 5 | 02:30 | idem — distribution des `lastmod` | 108×08-14, 80×08-08, 51×08-07, 31×08-11, 8×08-13, **3×08-15**, 3×08-12, 2×08-10, 2×08-09 — **7 lignes bumpées en 8 h 20** |
| 6 | 02:26 | `robots.txt` — `telecharger` / `galerie` en `Disallow` | **0** occurrence |
| 7 | 02:31 | HTML d'une page galerie — ancres `/telecharger` | **2** `<a href … download="">`, **aucun `rel="nofollow"`** |
| 8 | 02:27:32 | `GET /sitemap-blog.xml` | 200, **59 246 o** — identique à l'octet à F1 (08-14 18:57) |
| 9 | 02:27:32 | idem — composition | **134** `<loc>` = **126** articles + **5** hubs catégorie + **3** guides |
| 10 | 02:29:40 | `GET /sitemap/pages.xml` | 200, 31 204 o, **86** `<loc>` ; `mentions-legales` ✔ ; `conditions-generales` ✔ ; `memo-isere` **0** ; `ressources` **0** |
| 11 | 02:32 | `GET /fr/audit` — `type="application/ld+json"` | **7** |
| 12 | — | `src/content/villes/hero-images-map.ts` + `public/villes-hero/` | **59** entrées **et** 59 basenames uniques |
| 13 | — | `.github/workflows/deploy-coolify.yml` | `lhci:556`, `indexnow:650`, `warm:716` = 3 × `needs: deploy` ; `warm` `cancel-in-progress: true` (l.722) ; `continue-on-error` = **1 seule occurrence** (l.902, `notify`) |
| 14 | — | `content-gen-worker.ts:1221-1222` vs `content-publish-worker.ts:618` | `shouldPromoteTier1` calculé correctement, **jamais lu** — `tier_1_indexable` en dur |
| 15 | — | `content-publish-worker.ts:615-617` | commentaire périmé « creds GSC absents du worker » = **source de D7-P1-2** |
| 16 | — | `next.config.ts:280-289` + `package.json:239-254` | `/reserver` supprimée le 2026-06-26 (301 → `/appel`) ; **3 buckets `size-limit` morts**, **0 bucket `/appel`** |
| 17 | — | `ls src/app/[locale]/*/par-ville` + `VilleServicePageTemplate.tsx:196-204` | **5** familles × `VILLES` (2 157) = **~10 785** URLs adressables, `dynamicParams = true` |
| 18 | — | `src/app/sitemaps/images-fr.xml/route.ts:156-165` + `constants.ts:198` | 3 occurrences `/fr/galerie/` par bloc `<url>` ; cap = 1 000 (aucune troncature à 289) |
| 19 | — | `galerie/[slug]/telecharger/route.ts:144-149` | `imageAsset.update({ downloadCount: { increment: 1 } })` sur la ligne portant `updatedAt @updatedAt` |

---

## Limites

1. **Aucun accès DB.** Cinq arbitrages restent partiels et sont marqués comme tels,
   avec leur requête de tranchage : GEO-036/GEO-035 (attribution des bumps à des bots),
   GEO-089 (133 vs 288 images), GEO-148 (`faq.xml`), GEO-149 (`qa_derived`),
   GEO-152 (`banned_phrases`), GEO-082 (volumétrie `KnowledgeSlugHistory`).
2. **Je n'ai pas relu les 40 rapports intégralement.** J'ai balayé systématiquement
   les **en-têtes** de tous les findings P0/P1 (165 relevés) et lu intégralement les
   5 rapports H et les 2 addenda ; les corps de rapport n'ont été ouverts que là où
   une divergence chiffrée le demandait. Une contradiction enterrée dans un paragraphe
   de prose, sans chiffre ni en-tête, a pu m'échapper.
3. **Les requalifications de sévérité ne sont pas de moi**, sauf trois, que je signale
   comme telles : GEO-089 (P0 → P1, conséquence mécanique des deux réfutations de H3),
   GEO-035 (finding neuf) et GEO-102 (relevé neuf de H3 promu en entrée canonique).
   Toutes les autres reprennent H1, H2 ou H3.
4. **Un seul moteur de réponse** a été interrogé par l'audit (F4, re-tiré par H3) :
   les verdicts GEO-020, GEO-107 et GEO-108 ne sont pas transposables tels quels à
   Perplexity, ChatGPT Search ou Gemini.
5. **Les comptages non rejoués** par la Phase 2 restent au statut que H3 leur donne :
   « 78/160 dimensions fausses », « 75 vignettes manquantes », « ~30 fiches FAQ à
   double marque », les taux de corpus de D2 et de D4. Ils sont **repris tels quels**
   dans la liste canonique, avec la mention `[À CONFIRMER]` de leur auteur.
6. **Aucun build, aucun Lighthouse, aucune suite de tests, aucune commande git
   mutante, aucun POST.** Toutes mes mesures prod sont des GET anonymes. Aucune
   commande ne m'a été refusée.
7. **Le total « 155 findings canoniques » n'est pas comparable au « 162 findings P0/P1
   examinés » des rapports H** : j'y ai ajouté les P2 requalifiés, les 6 apports de H5
   et 2 findings neufs, et j'en ai retiré 25 doublons et 8 réfutations.

### Contrôle de numérotation (pour les agents de synthèse)

Les identifiants `GEO-001` → `GEO-155` sont **continus et sans trou** :
P0 = 001-028 · P1 = 029-126 (CRAWL 029-035, SITEMAPS 036-041, JSONLD 042-056,
META 057-062, CONTENT 063-078, PSEO 079-088, IMAGES 089-102, SERP 103-106,
IA-ENT 107-113, PERF 114-126) · P2 = 127-147 · INCERTAIN = 148-155.
Les 8 findings éliminés **n'ont pas d'identifiant** — c'est volontaire : un ID
attribué finit toujours par être repêché.
