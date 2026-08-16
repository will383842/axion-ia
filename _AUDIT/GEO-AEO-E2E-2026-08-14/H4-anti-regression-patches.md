# H4 — Anti-régression des patches prescrits (Phase 2, squad H)

- **Date d'exécution** : 2026-08-15, 01:55 → 03:05 UTC.
- **Périmètre réellement couvert** : les **58 prescriptions de patch P0/P1** des
  40 rapports A1→G4, regroupées en **45 patches distincts** (les doublons entre
  agents sont fusionnés et comptés une seule fois). Les P2 ne sont traités que
  lorsqu'ils entrent en collision avec un P0/P1 ou qu'ils portent un risque de
  régression supérieur à leur priorité affichée (2 cas : `@source` Tailwind,
  `image-bank:isolation-check`).
- **Méthode** : pour chaque patch, une seule question — **que peut-il casser ?**
  Vérification systématique contre (1) le contrat `stub.invalid` et ses 6 points
  de propagation, (2) l'invariant `Allow: /api/og`, (3) les tests-verrous
  existants (relus ligne à ligne, pas cités de mémoire), (4) les budgets Web
  Vitals + `size-limit`, (5) le job `warm`, le job `lhci` et leur parallélisme,
  l'ISR et les caches Cloudflare, (6) les décisions actées de Will.
- **Mesures live H4** : 2026-08-15 02:15:59Z et 02:16Z (≥ 6 h après le dernier
  atterrissage de 19:49:58Z le 2026-08-14) — **hors de toute fenêtre
  post-déploiement**.
- **Aligné sans les re-débattre** sur les acquis (a) à (f) de la session
  principale et de H1.

---

## Résumé exécutif

| Verdict | Nombre |
|---|---|
| **Patches sûrs en l'état** (risque faible, posables tels quels) | **24** |
| **Patches à éliminer** (redondants ou dangereux en l'état) | **25** |
| **Patches nécessitant un arbitrage Will** (STOP & ASK) | **9** |

**Le chiffre le plus important : 19 des 58 prescriptions sont des doublons.**
Sept agents prescrivent le même patch de deux lignes sur le job `warm`, cinq
prescrivent le même lot `strategy="inline"`, quatre éditent les mêmes six lignes
de `seo.ts:906-911`. Le plan de Phase 3 doit compter **45 patches, pas 58**,
sous peine de PR concurrentes sur les mêmes lignes.

**Les six découvertes qui changent le plan :**

1. **Le patch « sérialiser lhci après warm » peut désarmer le seul gate
   bloquant du pipeline.** `warm` n'a **pas** `continue-on-error` (vérifié :
   l'unique occurrence du workflow est ligne 902, sur `notify`) et porte
   `concurrency: cancel-in-progress: true` (l.720-722). Avec
   `needs: [deploy, warm]`, tout `warm` annulé — cas fréquent lors de deux merges
   rapprochés, piège déjà en mémoire — **skippe silencieusement `lhci`**. Le
   correctif du correctif est obligatoire : `if: always() && needs.deploy.result
   == 'success'`, ou `continue-on-error: true` sur `warm`.
2. **Le risque du lot `strategy="inline"` a été surestimé par tout le monde, y
   compris par les agents qui le prescrivent.** `JsonLd.tsx:39-47` rend un
   `next/script` quand `strategy !== "inline"` : le JSON **est déjà sérialisé
   dans le payload RSC** et coûte en plus une frontière de composant client et
   son hydratation. Repasser en `inline` **déplace** les octets du payload RSC
   vers le HTML au lieu de les ajouter, et **retire** du travail d'hydratation.
   Les « −300 ms TBT » inscrits en commentaire dans le code sont des estimations
   jamais re-mesurées. L'ADR reste requis (contrat AGENTS.md), mais l'hypothèse
   de travail doit être « TBT neutre à améliorant », pas « TBT dégradant ».
3. **Un patch peut faire tomber la console admin sans qu'aucune gate ne rougisse.**
   `src/app/admin.css` ne contient **aucun** `@import "tailwindcss"` (uniquement
   des `@layer`) : 100 % des utilitaires Tailwind de la console sont générés par
   l'unique invocation de `globals.css:1`. Le `@source not` prescrit par G2
   supprimerait ces utilitaires. Aucun test visuel admin, aucune gate CSS —
   **panne silencieuse sur la surface que Will utilise tous les jours**. Risque
   relevé de « moyen » à **ÉLEVÉ**.
4. **Un patch de deux lignes peut 500-er une famille entière d'URLs.**
   `seo-noindex-routes.ts` est consommé par `proxy.ts:336` (middleware Edge,
   **sans try/catch**). Ajouter `formations` à `SERVICE_PATH_TO_KEY` sans
   étendre `INDEXABLE_SERVICE_VILLE_SLUGS` lève un `TypeError` sur chaque
   requête `/fr/formations/par-ville/*` ; le mapper vers une clé existante
   applique le jeu de villes d'un **autre** service — c'est-à-dire un faux
   positif `noindex` sur des pages indexables, que le fichier lui-même qualifie
   de « CRITIQUE » (l.158).
5. **Deux patches « ancrer le SIREN dans llms.txt » cassent une route edge.**
   `llms.txt/route.ts:30` et `llms-full.txt/route.ts:20` sont `runtime = "edge"` ;
   `legal-identity.ts:23` importe `@/lib/prisma` au niveau module. Et écrire le
   numéro en dur déclenche `scripts/check-anti-siren.sh`. Le seul chemin sûr
   passe par `env.COMPANY_*` — ce qui rend ces patches **dépendants** du patch
   build-args de B1.
6. **Un patch prescrit crée le bug qu'un autre patch croyait observer.**
   E1-P1-7 prescrit d'appeler `trackUsage()` sur la page galerie ; A4-P1-1
   accusait précisément ce compteur de polluer le `lastmod` d'`images-fr.xml`.
   H1 a réfuté A4 en prouvant que `trackUsage` n'a aucun appelant — poser E1-P1-7
   sans précaution **fabriquerait** la pollution réfutée.

**Trois patches sont des remèdes pires que le mal** et doivent sortir du plan :
F1-P1-4 (déclarer les enfants de `glossaire.xml` = publier 60 URLs `noindex`
dans un sitemap), A4-P1-1 (masque une root-cause réfutée), B5-P0-2 volet 1
(reculer les `published_at` — déjà réfuté par H1, confirmé ici).

**Facteur aggravant transverse** (établi par G1, appliqué par moi à chaque
notation) : `size-limit` et le budget First Load sont en `continue-on-error`.
**Aucun patch qui alourdit le bundle ne rougira.** Toute notation « risque
bundle » de ce rapport suppose donc une mesure **manuelle** avant/après ; sans
elle, le risque doit être lu d'un cran plus haut.

---

# Bloc 1 — Les clusters redondants (à compter une seule fois)

## C-1. Job `warm` : ajouter des URLs aux DEUX listes — **RISQUE FAIBLE**

**Prescrit 8 fois** : A3-P0 + A3-ADDENDUM, A3-P1-1, B1-P0 volet 1, B6-P0,
F3-P1-1, F5-P0-2, G3-P0 volet 1, F7-P0-1 volet 2. → **1 patch, 7 doublons.**

**Ce qu'il peut casser : quasi rien, et je l'ai vérifié plutôt que supposé.**

- `src/app/api/internal/revalidate/route.ts:69-78` accepte **tout** chemin
  commençant par `/`, chaque `revalidatePath` est dans un `try/catch`
  silencieux : aucune URL ajoutée ne peut faire échouer l'appel.
- Rate-limit `60/min` par IP (`:49`) — le job envoie **un seul** POST : marge ×60.
- Purge Cloudflare par liste : plan Free = 30 URLs/appel. Union de toutes les
  URLs demandées par les 8 agents (`/fr`, `/fr/mentions-legales`,
  `/fr/conditions-generales`, `/fr/audit`, `/fr/formations`,
  `/fr/implementation`, `/fr/sites-web-augmentes`, `/fr/memo-isere`, `/fr/blog`)
  + les 5 existantes = **14** → sous le plafond.
- Les deux steps sont `set -uo pipefail` avec sortie 0 sur secret absent
  (l.732-735, l.774-777) : jamais bloquants.

**Précision que personne n'a faite** : il existe **trois** listes, pas deux.
`STRATEGIC` (l.808) contient **déjà** `/fr`, `/fr/audit`, `/fr/formations`,
`/fr/implementation`. C'est exactement pour cela que le warmer **fige** la
version amputée : il fait un GET sur `/fr` sans l'avoir revalidée ni purgée.
`/fr/sites-web-augmentes` n'est dans **aucune** des trois — s'il est ajouté aux
deux premières, l'ajouter aussi à `STRATEGIC` pour cohérence.

- **Do-not-touch** : le `purge_everything` du job `deploy` ; l'ordre des steps
  (revalidate → purge ciblée → warm, déjà correct) ; `concurrency.group:
  warm-edge-cache` ; la magic string `stub.invalid` et ses 6 points de
  propagation ; `/fr/roi` (documenté l.745-746 comme n'ayant **pas** besoin
  d'être listée : elle ne lit pas la base — ne pas « corriger » ce commentaire).
- **Test de non-régression à écrire AVANT** : un test Vitest qui parse
  `.github/workflows/deploy-coolify.yml`, extrait `PATHS` et `FILES` et asserte
  qu'ils décrivent **le même ensemble d'URLs** (modulo le préfixe
  `https://axion-ia.com`). La classe de bug « ajouté dans une liste, oublié dans
  l'autre » est littéralement ce que 8 agents indépendants viennent de trouver ;
  c'est le seul verrou qui l'empêchera de revenir.

---

## C-2. Sérialiser `lhci` après `warm` — **RISQUE MOYEN** (relevé de « faible »)

**Prescrit 2 fois** : G1-P1-3, G3-P0 volet 2. → **1 patch, 1 doublon.**

**Ce qu'il peut casser — et c'est sérieux.** Structure vérifiée du workflow :
`lhci` (l.554-556), `indexnow` (l.648-650) et `warm` (l.714-716) ont tous
`needs: deploy` → **trois jobs en parallèle**. Le patch
`needs: [deploy, warm]` a un effet de bord non signalé par G1 ni par G3 :

- `warm` n'a **pas** `continue-on-error` — l'unique occurrence du workflow est
  ligne 902, sur `notify`.
- `warm` porte `concurrency: { group: warm-edge-cache, cancel-in-progress: true }`
  (l.720-722) : deux merges rapprochés ⇒ le premier `warm` sort en `cancelled`.
- En GitHub Actions, un `needs` non `success` **skippe** le job dépendant.

⇒ **`lhci`, que G1 identifie comme le seul gate réellement bloquant, ne
tournerait plus dès que le warmer est annulé ou échoue.** On corrigerait une
course de cache en désarmant un gate — exactement la classe de régression que
cette mission doit intercepter.

- **Correctif du correctif (obligatoire)** : `needs: [deploy, warm]` **et**
  `if: always() && needs.deploy.result == 'success'` ; ou `continue-on-error:
  true` sur `warm`. Sans l'un des deux, ne pas poser le patch.
- **Do-not-touch** : le bloc `concurrency` de `warm` (il protège l'origine
  CPX42) ; `needs.deploy.result == 'success'` (ne pas le remplacer par
  `always()` seul, sinon lhci mesure une prod non déployée) ; le job `indexnow`
  — noter au passage qu'il **reste** en parallèle et ping donc encore les
  moteurs pendant la fenêtre stub (constat neuf, à traiter en Phase 3).
- **Test à écrire AVANT** : assertion statique sur le YAML — « tout job ayant
  plus d'un `needs` porte un `if` commençant par `always()` ».

---

## C-3. Lot `strategy="inline"` des schémas — **STOP & ASK WILL + ADR**

**Prescrit 5 fois** : B2-P0, B4-P1-1, D4-P1-4, G2-P1-2 (corroboration),
D5-P1-3 volet (d). → **1 lot, 4 doublons.** (H1 avait déjà fusionné B2≡B4.)

**Ce qu'il peut casser — recalculé, à la baisse.** `JsonLd.tsx:36-48` : quand
`strategy !== "inline"`, le composant rend un `<Script>` `next/script` avec
`dangerouslySetInnerHTML`. Conséquences que ni B2, ni B4, ni D4 n'ont tirées :

1. Le JSON **transite déjà** dans le document, sérialisé dans le flux RSC comme
   prop d'un composant client. Repasser en `inline` ne fait donc **pas**
   « +2 à 10 Ko » : il **déplace** ~les mêmes octets du payload vers le HTML.
   La mesure de G2 (920 Ko de CSS déjà présents, JSON-LD = +0,2 à +0,9 %) va
   dans le même sens par un autre chemin.
2. `inline` **supprime** une frontière de composant client et son hydratation
   par schéma déféré — soit, sur un gabarit ville, plusieurs `next/script` en
   moins. Effet attendu sur le TBT : **neutre à positif**.
3. Les gains inscrits en commentaire (`implantations/[region]/[ville]/page.tsx:903`
   « −300 ms TBT », `[region]/page.tsx:196` « −150 à −250 ms », `audit/page.tsx:270`
   « −100 à −200 ms ») sont des **estimations d'époque**, jamais re-mesurées.

L'ADR reste obligatoire (AGENTS.md : « tout patch qui dégrade ces seuils requiert
un STOP & ASK Will + ADR ») — mais il doit être instruit avec cette hypothèse
inversée, sinon Will arbitrera sur un risque fantôme.

- **⚠️ Facteur aggravant** : `lhci` mesure 5 URLs desktop **sans assertion INP**
  (G1-P1-2) et `size-limit` est en `continue-on-error` (G1-P0-1). Une dégradation
  réelle passerait inaperçue ⇒ **mesure manuelle avant/après obligatoire** sur
  3 pages pilotes (1 ville indexable, 1 secteur, 1 fiche centre-aide).
- **Do-not-touch** : `JsonLd.tsx` et `JsonLdGraph.tsx` eux-mêmes (contrat partagé
  par 31 fichiers / 54 appels) ; `Plausible.tsx` et `Clarity.tsx` — leurs
  `afterInteractive` (`layout.tsx:317-327`) ne sont **pas** du JSON-LD, ne pas
  les toucher par balayage automatique ; la dé-duplication FAQPage documentée en
  commentaire (`[ville]/page.tsx:906-908`) ; les pages **noindex** (1 677 villes
  hors cap) qui doivent garder `afterInteractive` — inliner du JSON-LD sur des
  pages noindex ne rapporte rien et coûte du poids.
- **Test à écrire AVANT** : un test de rendu SSR (`renderToStaticMarkup` sur un
  gabarit ville indexable) qui asserte la présence d'au moins un
  `<script type="application/ld+json">` contenant `"@type":"FAQPage"` dans le
  HTML. C'est **le verrou manquant** : son absence explique pourquoi la
  régression a vécu invisible jusqu'à cet audit.

---

## C-4. `sameAs` de l'Organization (`seo.ts:906-911`) — **STOP & ASK WILL**

**Prescrit 4 fois** : F4-P1-1 (Crunchbase, f6s), F5-P1-4 (3 URLs registre +
Crunchbase), F6-P1-4 (Crunchbase, F6S, Les Pépites Tech), B1-P1-2 (Wikidata).
→ **1 patch, 3 doublons.** Quatre PR sur les mêmes six lignes = conflit garanti.

**Ce qu'il peut casser** : techniquement rien (tableau additif ;
`jsonld-validation.spec.ts` ne couvre pas Organization — vérifié : ses 6 `it`
portent sur Article/News/HowTo/QAPage/FAQPage/Person). **Le risque est
sémantique et il est réel** : F6-P1-3 établit que les fiches Les Pépites Tech et
LinkedIn ancrent l'entité à **Paris** et écorchent le nom du fondateur.
Déclarer ces fiches en `sameAs` **avant** de les corriger revient à signer
soi-même l'erreur d'entité que F4/F5 veulent supprimer — remède pire que le mal
si l'ordre est inversé.

- **Ordre imposé** : F6-P0-1 (LinkedIn homonyme canadien, SSOT `brand.ts`) →
  correction des fiches par Will → **puis** patch `sameAs` unique.
- **Do-not-touch** : les graphies `sameAs` LinkedIn/X existantes (E2 impose un
  STOP & ASK avant tout changement de handle) ; le regex `^Q\d+$` de validation
  Wikidata ; `buildLocalBusinessJsonLd` et son pattern Service Area Business
  (pas de faux bureau par ville, décision 2026-05-23).
- **Test à écrire AVANT** : un test qui asserte que **chaque** entrée du tableau
  `sameAs` est présente dans une liste blanche documentée — pour que l'ajout
  d'une fiche non vérifiée exige un geste explicite.

---

## C-5. `/api/markdown` : types manquants — **RISQUE FAIBLE**

**Prescrit 3 fois** : A5-P0-2, F1-P1-1 (centre-aide), F1-P1-3 (glossaire).
F1-P1-2 (`cas-concrets` répond 200 avec un corps **vide**) est un **troisième
cas distinct**, à traiter dans la même PR mais à ne pas confondre.
→ **1 patch, 2 doublons.** Portée corrigée par H1 : **6 pages indexables**,
pas 66 → **P1**, pas P0.

**Ce qu'il peut casser** : la route est additive (nouvelle branche dans un
`switch`). Deux gardes vérifiées : l'invariant `Allow: /api/markdown/` existe
déjà dans `COMMON_ALLOW` (`robots.ts:109`) et est **testé**
(`robots.spec.ts:76`) — aucune action robots nécessaire ; le contrat
`stub.invalid` n'est pas concerné si la branche glossaire lit la **même source
fichier** que la page (pas la DB).

- **Do-not-touch** : les branches `blog`/`actualites`/`faq` existantes ; le flag
  `HELP_BACKEND_UNIFIED` de `src/lib/help-articles/reader.ts` (**ne pas
  l'activer au passage** — A5 le signale, c'est le piège classique du « tant
  qu'on y est ») ; `robots.ts` (rien à y changer).
- **Nuance H4** : 60 des 66 fiches glossaire sont `noindex, follow`. Servir leur
  markdown a une valeur GEO réelle (les crawlers IA lisent le canal), mais ce
  patch **ne doit pas** servir d'argument pour les remettre dans un sitemap
  (cf. C-8, réfuté).
- **Test à écrire AVANT** : un test paramétré « pour chaque type déclaré dans
  `<link rel="alternate" type="text/markdown">` d'une page, `/api/markdown/<type>/<slug>`
  répond 200 avec un corps non vide » — il couvre les trois défauts d'un coup et
  interdit la classe entière.

---

## C-6. `COMMON_ALLOW` + Observatoire — **RISQUE FAIBLE**, avec une contradiction à arbitrer

**Prescrit 2 fois, dans deux formes incompatibles** : A1-P1-3 veut
`/api/observatoire/export-csv` (forme étroite, et met explicitement en garde
contre l'élargissement) ; B4-P1-3 veut `/api/observatoire/` (forme large).
→ **1 patch, 1 doublon + 1 contradiction.**

**Arbitrage H4** : `ls src/app/api/observatoire/` → **exactement deux routes**,
`export-csv` et `export-json`, toutes deux publiques. La forme large est donc
sûre **aujourd'hui** mais ouvre par avance toute route future ajoutée sous ce
préfixe. → **retenir la forme étroite à deux entrées explicites**
(`/api/observatoire/export-csv` + `/api/observatoire/export-json`) : elle
satisfait les deux agents et ne parie pas sur l'avenir.

**Ce qu'il peut casser** : rien. Vérifié dans `robots.spec.ts` : les assertions
utilisent `toContain` / `not.toContain`, **aucune ne verrouille la longueur** de
`COMMON_ALLOW` → l'ajout est purement additif. L'invariant `Allow: /api/og` est
explicitement gardé (`robots.spec.ts:88` — « conserve /api/og — son oubli casse
TOUS les aperçus sociaux ») : intact.

- **Do-not-touch** : `AI_BOTS_TRAINING_DISALLOWED` / `AI_BOTS_DISALLOWED`
  (`robots.ts:140-153`), verrouillés par `robots.spec.ts:101` (« n'accorde
  AUCUNE autorisation aux bots d'entraînement ») ; `Disallow: /api/`
  (`robots.spec.ts:118`) ; l'**absence** de `Disallow: /en/` (`robots.spec.ts:133`)
  — un patch de « ménage EN » qui l'ajouterait casserait la purge des URLs EN.
- **Test à écrire AVANT** : celui proposé par A1 est excellent et doit être
  retenu — extraire les URLs `/api/*` du corps de `llms.txt` et asserter
  qu'elles sont toutes couvertes par un `Allow`. Il ferme la classe entière
  « on annonce un canal qu'on interdit ».

---

## C-7. Citations locales (`local-citations.ts`) — **RISQUE FAIBLE si fusionné, MOYEN sinon**

**Prescrit 2 fois** : B1-P1-3 et F6-P1-2. → **1 patch, 1 doublon.**

**Ce qu'il peut casser — vérifié, et B1 ne le mentionne pas.**
`src/lib/seo/__tests__/local-citations.spec.ts:36-46` verrouille **en dur** :
`expect(cov.listed).toBe(0)` et `expect(cov.byPriority[1].listed).toBe(0)`
(LC5/LC6, « V1 défaut »). **Les deux patches rendent ce test rouge.** F6 le dit
et prescrit d'amender la spec dans le même commit ; B1 ne le dit pas. Poser B1
seul produit une CI rouge sans cause apparente.

- **Do-not-touch** : le pattern Service Area Business de `buildLocalBusinessJsonLd`.
- **Test à écrire AVANT** : remplacer l'assertion figée `listed === 0` par une
  assertion de **cohérence** (« toute entrée avec `listingUrl` non nul compte
  dans `listed`, et réciproquement ») — c'est un verrou qui survit à
  l'évolution des données, contrairement au verrou actuel qui interdit le
  progrès qu'il était censé protéger.

---

## C-8. Cache Rules Cloudflare sur les `.xml` — **STOP & ASK WILL** (charge origine)

**Prescrit 2 fois** : G3-P1-3 et F1-P2. → **1 patch (100 % console CF, zéro
fichier), 1 doublon.**

**Ce qu'il peut casser — non chiffré par les deux agents.** Passer les `.xml` en
« Respect origin » les fait tomber du TTL edge actuel (~1 h observé) à
`s-maxage=600`. Sur 38 sub-sitemaps, dont plusieurs `force-dynamic` lisant la
DB, cela **multiplie par ~6 les rendus origine** sur le CPX42 à chaque passage
de crawler. Le bénéfice (discovery plus fraîche) est réel mais le coût n'est
mesuré nulle part.

- **Recommandation H4** : ne pas prendre « Respect origin » à l'aveugle ; fixer
  un **Edge TTL explicite de 600 s** sur `*.xml`, qui obtient le même effet de
  fraîcheur avec une borne de charge connue.
- **Do-not-touch** : la doctrine « l'index ne doit JAMAIS 500 »
  (`sitemap-index.xml/route.ts:241-247`) et le gating anti-vide.

---

# Bloc 2 — Les patches dangereux en l'état

## D-1. F1-P1-4 « faire déclarer leurs enfants à `guides.xml` et `glossaire.xml` » — **RÉFUTÉ, remède pire que le mal**

Les deux moitiés tombent, pour deux raisons différentes.

- **Volet guides — déjà résolu, le patch créerait un doublon.** A2 a établi (et
  mesuré live : 9 `<loc>` `/guides/` parmi 134 URLs) que les 9 guides **sont
  émis dans `sitemap-blog.xml`**, et que le hub-only de `guides.xml` est un
  **choix documenté** (`sitemap.ts:1049-1061`). Appliquer F1 déclarerait les 9
  mêmes URLs dans **deux** sub-sitemaps — précisément le défaut qu'A2 relève par
  ailleurs (« 7 URLs double-déclarées entre `pages.xml` et les sub-sitemaps »).
- **Volet glossaire — le patch publierait 60 URLs `noindex` dans un sitemap.**
  A2-P1-2 établit que les 60 fiches sont sous le seuil et donc `noindex, follow` ;
  H1 l'a re-vérifié live (`/fr/glossaire/llm` → `noindex, follow`). Déclarer des
  URLs `noindex` dans un sitemap produit mécaniquement la classe d'erreur GSC
  « exclue par la balise noindex » et **dégrade la confiance accordée au
  sitemap-index entier** — au moment précis où F2 mesure un drainage de
  visibilité. Le préalable est **A2-P1-2 (écrire le contenu)**, pas le sitemap.

→ **À retirer du plan.** Conserver A2-P1-2 (contenu, effort L) et A2-P2
(retirer l'id `guides` de `generateSitemaps()`).

---

## D-2. A4-P1-1 `lastmod` d'`images-fr.xml` — **RÉFUTÉ (aligné H1) + contradiction d'ordonnancement inédite**

H1 a réfuté la root-cause : `trackUsage` n'a **aucun appelant** dans `src/`. Le
patch (`publishedAt ?? createdAt`) masquerait une cause inconnue.

**Ce que H4 ajoute** : **E1-P1-7 prescrit d'appeler `trackUsage()`** en
fire-and-forget depuis `/[locale]/galerie/[slug]/page.tsx`. Si ce patch est posé
tel quel et que `trackUsage` touche la ligne image (colonne `@updatedAt`), il
**fabriquera** exactement la pollution de `lastmod` qu'A4 croyait observer et
que H1 a réfutée.

→ **Ordre imposé** : avant de poser E1-P1-7, vérifier que `trackUsage` écrit
**uniquement** dans `image_usage_logs` et ne met pas à jour la ligne image ;
sinon, neutraliser d'abord le calcul du `lastmod`. Et rouvrir A4 par une requête
DB (`SELECT max(updated_at), min(updated_at) FROM image_bank_images`) avant tout
patch, comme H1 le demande.

- **Do-not-touch** : `hashImageBankIp` (`utils/ip-hash.ts`) — le format
  historique `salt:ip` conditionne le droit à l'effacement déjà implémenté ;
  l'early-exit `stub.invalid` de la route (l.84).

---

## D-3. B5-P0-2 volet 1 « redistribuer les `published_at` » — **RÉFUTÉ (aligné H1)**

Reculer les dates rend les offres **plus vieilles** pour Google for Jobs et peut
en basculer immédiatement au-delà du seuil de fraîcheur : le remède aggrave le
symptôme. C'est de surcroît une fabrication de la date que Google lit — l'objet
même de la décision actée n°5, direction inverse mais principe identique.

→ **Ne pas exécuter.** Le geste conforme existe déjà :
`republishJobOfferAction` (`admin-job-offers/actions.ts:508-555`).
**Le volet 2 survit et est sûr** : plafonner l'alerte Telegram à
`stale.slice(0, 15)` (`qualiopi-formation-crons-worker.ts:1155-1166`) —
**RISQUE FAIBLE**, 5 lignes, aucun effet public.

---

## D-4. D4-P1-1 `X-Robots-Tag` sur `/formations/par-ville` et `/un-a-un/par-ville` — **RISQUE ÉLEVÉ en l'état**

Le **constat** est juste et je le confirme : `ls src/app/[locale]/interventions/`
ne contient **aucun** `par-ville`, alors que `seo-noindex-routes.test.ts:91`
verrouille `isNoindexStubRoute("/fr/interventions/par-ville/petite-foret")` —
le test verrouille bien une route morte, comme D4 l'affirme. Et
`/formations/par-ville` **existe** sans être couvert.

**Le patch, lui, est dangereux tel que prescrit** :

- `seo-noindex-routes.ts:139-143` — `SERVICE_PATH_TO_KEY` est typé
  `Record<string, "audit" | "interventions" | "implementation">` et
  `INDEXABLE_SERVICE_VILLE_SLUGS` (l.103-110) n'a **que ces trois clés**.
- Mapper `"formations"` vers l'une des trois clés existantes applique le jeu de
  villes d'un **autre service** ⇒ `noindex` sur des pages `formations`
  indexables. Le fichier qualifie lui-même ce cas de « **CRITIQUE** » (l.158).
- Ajouter une clé sans étendre le `Record` fait lever un `TypeError` à
  `INDEXABLE_SERVICE_VILLE_SLUGS[serviceKey].has(ville)` — et le seul appelant
  runtime est `proxy.ts:336`, **middleware Edge sans try/catch** ⇒ **500 sur
  toute la famille d'URLs**.

- **Do-not-touch** : `ALL_SERVICE_VILLE_SLUGS` (40 métropoles),
  `src/generated/indexable-villes.ts` (**fichier généré**, jamais édité à la
  main), la sémantique « faux négatif OK / faux positif interdit ».
- **Test à écrire AVANT (bloquant)** : (1) une assertion de complétude « toute
  clé de `SERVICE_PATH_TO_KEY` possède une entrée dans
  `INDEXABLE_SERVICE_VILLE_SLUGS` » ; (2) un cas par nouveau service asserant
  qu'aucune ville indexable de CE service ne reçoit le header ; (3) supprimer ou
  corriger l'assertion `interventions/par-ville` devenue fictive.

---

## D-5. G2-P2 `@source` Tailwind — **RISQUE ÉLEVÉ** (relevé de « moyen »)

Le constat (28 Ko d'utilitaires admin dans la feuille publique, ×4 par
sérialisation) est solide. Le patch, lui, a une **panne silencieuse** que G2
sous-estime.

**Preuve H4** : `grep "@import|@layer|@source|@theme" src/app/admin.css` →
`@layer admin-tokens`, `@layer base`, `@layer admin-rail`, `@layer admin-actions`
— **aucun `@import "tailwindcss"`**. `globals.css:1` est la **seule** invocation
Tailwind du projet. Toutes les classes utilitaires employées par la console
admin (y compris les valeurs arbitraires `bg-[color:var(--color-admin-bg)]`)
sont donc générées par ce scan unique. Un `@source not` sur `(admin)` /
`components/admin` les **supprime**.

**Ce qui rend le risque élevé et non moyen** : aucune gate ne le verrait. Pas de
test visuel admin, `qualiopi:isolation-check` et `image-bank:isolation-check`
vérifient des **imports**, pas du CSS, et `size-limit` (qui verrait la feuille
maigrir) est en `continue-on-error`. La panne se découvre en ouvrant la console
— c'est-à-dire par Will, après coup.

- **Chemin sûr** : ne pas exclure ; donner à `admin.css` sa **propre** invocation
  Tailwind scopée, ou n'accepter le `@source not` qu'après un **diff exhaustif
  des sélecteurs** générés avant/après.
- **Do-not-touch** : `src/app/admin.css` (ADR 0028), le `@theme` de
  `globals.css`, `lighthouserc.json`.
- **Test à écrire AVANT** : un script qui extrait la liste des sélecteurs du CSS
  buildé et asserte qu'**aucun** sélecteur contenant `admin` ne disparaît entre
  avant et après.

---

## D-6. F4-P1-3 / F5-P1-5 « ancrer SIREN + siège dans `llms.txt` » — **RISQUE ÉLEVÉ en l'état**

Le besoin est réel (F4 mesure que le canal d'ingestion IA ne dit nulle part où
est le siège). **Les deux chemins d'implémentation évidents cassent quelque chose :**

- `src/app/llms.txt/route.ts:30` et `src/app/llms-full.txt/route.ts:20` sont
  `runtime = "edge"`. `src/lib/legal-identity.ts:23` importe `@/lib/prisma` au
  **niveau module** ⇒ importer `resolveLegalIdentity()` dans ces routes casse la
  compilation/l'exécution edge.
- Écrire `SIREN 108018631` en dur dans un `.ts` de `src/` déclenche
  `scripts/check-anti-siren.sh` (motif `(SIREN|SIRET)\s+[0-9]{9,14}`, scan de
  `src/` en `.ts/.tsx/.js/.jsx/.mjs`, exclusion des `*.spec.ts`) ⇒ **gate rouge**.
  Écrire « SIREN 108 018 631 » avec des espaces passerait la regex : c'est un
  contournement de garde, à proscrire explicitement dans le plan.

- **Chemin sûr unique** : dériver de `env.COMPANY_REGISTRATION_NUMBER` /
  `env.COMPANY_VAT_NUMBER` (lecture `process.env`, edge-safe) — ce qui rend ce
  patch **dépendant** de C-9 (build-args) si l'on veut aussi la valeur au build.
- **Do-not-touch** : les blocs prix SSOT de `llms.txt` (décision actée n°4) ;
  le bloc Qualiopi conditionnel (l.59-67) ; `check-anti-siren.sh` lui-même.
- **Test à écrire AVANT** : un test qui `GET /llms.txt` en environnement de test
  et asserte la présence du SIREN **résolu** (pas du littéral) — plus un cas
  « env absente ⇒ le bloc identité est omis, pas rendu avec `undefined` ».

---

# Bloc 3 — Les patches à faire, avec leur garde

## C-9. B1-P0 volet 2 — identifiants légaux en build-args — **RISQUE MOYEN, à faire**

C'est, d'après H1, **le seul patch qui corrige le volet permanent** de B1
(`vatID`/SIRET absents de toutes les pages 100 % statiques, hubs villes
indexables compris). Il touche le chemin de déploiement : il mérite un examen,
et cet examen est **favorable**.

- **Il ne rougit pas la gate anti-SIREN** : `check-anti-siren.sh` ne scanne que
  `src/` en `.ts/.tsx/.js/.jsx/.mjs`. Ajouter les valeurs dans
  `deploy-coolify.yml` et `Dockerfile` est hors périmètre du scan. **En
  revanche, l'alternative « figer en code comme l'adresse » la rougit à coup
  sûr** — B1 le signale, c'est correct, ne pas prendre cette branche.
- **Il ne touche pas le contrat `stub.invalid`** : deux `ARG`/`ENV` de plus dans
  le stage builder, sans rapport avec `DATABASE_URL`, `REDIS_URL`,
  `SKIP_ENV_VALIDATION` ni `BULLMQ_DISABLED`.
- **Point à écrire dans l'ADR** : l'image GHCR est **publique** et un build-arg
  reste lisible dans l'historique de l'image. C'est acceptable ici (SIREN et
  n° de TVA sont des données publiques du Kbis) mais doit être écrit noir sur
  blanc, sinon un futur patch y glissera un secret par mimétisme.
- **Do-not-touch** : `SKIP_ENV_VALIDATION`, `BULLMQ_DISABLED`, la magic string
  `stub.invalid`, `Dockerfile.coolify-pull` (un-liner), `src/lib/prisma.ts`,
  `src/lib/redis.ts`, la garde 3a-bis d'`identite-legale-registre.spec.ts`
  (adresse sans env — elle est correcte).
- **Test à écrire AVANT** : étendre `identite-legale-registre.spec.ts` d'une
  garde « 3c » calquée sur la 3a-bis existante — `vatID` et `identifier` SIRET
  présents **sans** variable d'environnement RUN.

---

## C-10. C1-P0 `alternateLinks: false` — **RISQUE FAIBLE, confirmé live**

**Preuve live H4 (2026-08-15 02:16Z, `/fr/audit`)** — la cible du patch existe
toujours et n'est pas un artefact de fenêtre post-deploy :
`link: <…/fr/audit>; hreflang="fr", <…/en/audit>; hreflang="en", <…/audit>;
hreflang="x-default"` avec `cf-cache-status: HIT`, `x-nextjs-cache: HIT`,
`Age: 543`.

**API vérifiée** (le patch aurait pu viser le mauvais fichier) :
`alternateLinks?: boolean` est bien une clé de `RoutingConfig`
(`node_modules/next-intl/dist/types/routing/config.d.ts:34`) ⇒ le poser dans
`defineRouting()` est **correct**, il n'est pas nécessaire de modifier
`createIntlMiddleware(routing)` dans `proxy.ts:36`.

**Ce qu'il peut casser** : le `Link` HTTP disparaît **entièrement**, y compris
l'auto-référence `fr`. Sans conséquence : le hreflang HTML existe et est
**déjà correctement gaté** (`layout.tsx:148-157` n'émet pas `en` quand
`isEnLocaleDisabled()`).

- **Do-not-touch** : `routing.locales` (garder la toggle EN — décision AGENTS.md),
  `localePrefix: "always"`, le bloc 0 EN→FR de `proxy.ts`,
  `en-to-fr-redirect.test.ts`.
- **Test à écrire AVANT** : une sonde HTTP dans la suite « probe » qui asserte
  l'**absence** de `hreflang="en"` dans l'en-tête `Link`. Aucune garde HTTP
  n'existe aujourd'hui — c'est exactement pourquoi ce défaut a vécu trois mois.

---

## C-11. C1-P1-3 retirer `alternates` du layout — **RISQUE MOYEN**

**Deux vérifications qui changent la lecture** :
(1) le bloc `layout.tsx:148-157` **n'est pas** la source du P0 — il est déjà gaté
EN correctement ; la source est bien l'en-tête HTTP next-intl (C-10).
(2) la home **ne perdra rien** : `[locale]/page.tsx:84,103` appelle
`buildProductMetadata` avec ses propres `alternates`.

Reste le vrai risque : **toute page sans `alternates` perdra son canonical**.
C'est le comportement voulu, mais il exige l'inventaire préalable et les
canonicals explicites de `/fr/diagnostic` et `/fr/simulateur` **dans le même
commit** — sinon on troque un canonical faux contre un canonical **absent** sur
la page qui reçoit le trafic **payant**.

- **Test à écrire AVANT** : un test qui énumère les `page.tsx` publics et
  asserte que chacun définit `alternates.canonical` (ou appelle
  `buildProductMetadata`).

---

## C-12. D6-P0-1 URLs de citation malformées — **RISQUE FAIBLE mais PATCH INCOMPLET**

**Vérification H4** : `ArticleSources.tsx:32-40` rend depuis `view.citations`
(données **persistées par article**), sans aucune résolution par `id` dans le
catalogue. Deux conséquences que D6 ne tire pas :

1. **Bonne nouvelle** : supprimer les 122 entrées « 404 » et 29 « deprecated »
   du catalogue **ne casse aucun article publié**. Risque de suppression : nul.
2. **Mauvaise nouvelle** : nettoyer `auto-seeded.ts` ne corrige que les **futures**
   publications. Les URLs à backtick déjà publiées vivent dans les lignes
   `ContentCitation` et continueront d'être servies. Et le filtre de rendu
   `/^https?:\/\//.test(...)` (`:38`) ne teste que le **préfixe** : une URL
   finissant par une backtick le franchit.

→ Le patch doit inclure **(a)** un backfill DB des citations publiées et **(b)**
le durcissement du filtre de rendu avec la regex complète que D6 propose pour
`passesHardFilters()`. Sans les deux, le symptôme **live** reste.

- **Do-not-touch** : `link.id` (clé de diversification).
- **Test à écrire AVANT** : un test sur `ArticleSources` avec une URL à backtick
  en entrée, asserant qu'elle est écartée du rendu.

---

## C-13. E1-P0-1 seed qui écrase alt/titre/légende — **RISQUE MOYEN, chemin post-deploy**

**Vérification H4** : `.github/workflows/image-bank-seed.yml:36-39` se déclenche
sur `workflow_run` du workflow de déploiement ⇒ **le patch touche un maillon qui
s'exécute après chaque déploiement réussi**. Un seed cassé dégrade 288 pages
galerie à chaque mise en prod, sans aucune gate pour le voir.

- **Do-not-touch** : le contrat CJS pur d'`enrich-images.cjs`
  (`require('/app/prisma/generated/client')`, `--max-old-space-size=96` — le
  container est slim) ; les `slug` de traduction (URLs déjà indexées) ; ne pas
  relancer l'enrichissement avant le patch, sous peine de reperdre au seed
  suivant.
- **Test à écrire AVANT** : une assertion statique sur `seed-images.cjs` — les
  champs `alt`, `title` et `caption` figurent dans le bloc `create` et **pas**
  dans le bloc `update` de l'upsert.

---

## C-14. E1-P1-2 `withMetadata` → `autoOrient` + `withExif` — **RISQUE MOYEN, ordre imposé**

`autoOrient()` **change les dimensions de sortie** des photos pivotées. Si ce
patch est posé avant le patch « dimensions réelles » (E1-P1-3), il **aggrave**
les 78 dimensions fausses déjà en base au lieu de les corriger.
→ **Ordre imposé : dimensions d'abord (lecture réelle via `sharp().metadata()`
après rotation), orientation ensuite.**
**Do-not-touch** : `keepMetadata()` (rétablirait le GPS — enjeu RGPD),
`orientation` qui n'accepte que `landscape|portrait|square`.

---

## C-15. E1-P2 ajouter `image-bank:isolation-check` à la CI — **RISQUE FAIBLE si l'ordre est respecté, sinon BLOQUANT TOTAL**

E1 le dit et je le confirme comme contrainte dure : ajouter le check **avant**
d'avoir soldé les 18 violations **bloque toutes les PR**. À remonter en tête du
plan de Phase 3 comme contrainte d'ordonnancement, pas comme note de bas de page.
**Do-not-touch** : `scripts/content-gen/isolation-check.ts` (jumeau vert, sert
de référence de forme).

---

## C-16. D3-P1-2 multi-judge avant auto-publication — **RISQUE MOYEN, dépendance temporelle**

Le patch introduit une dépendance **OpenAI** dans le chemin de publication, au
moment précis où le kill switch OpenAI est à zéro (acquis (f) : reste-Will déjà
acté). Posé maintenant sans fail-soft, il **bloquerait toute publication** au
redémarrage du pipeline. D3 prévoit le fail-soft — il doit être **non
négociable**, et le patch posé **après** la recharge, pas avant.
**Do-not-touch** : `judge-outcome.ts` (garde-fou déjà correct), les seuils
`judge_thresholds` en base.

---

## C-17. G1-P0-1 corriger AGENTS.md sur les gates — **RISQUE NUL, à faire en premier**

Aucun code touché ; la documentation affirme aujourd'hui que deux gates bloquent
alors qu'elles sont en `continue-on-error`. Tant que ce mensonge tient, **chaque
notation de risque bundle de ce rapport et des 40 autres repose sur une fausse
sécurité**. C'est le patch au meilleur rapport valeur/risque du plan.

---

## C-18. Les 12 patches restants, sûrs en l'état — **RISQUE FAIBLE**

Examinés, aucun ne heurte un invariant, un test-verrou ou une décision actée.
Notés ici avec leur seule garde utile.

| Patch | Garde / do-not-touch |
|---|---|
| A2-P1-1 `/demande-devis/confirmation` hors `pages.xml` | reste de `EXCLUDED_FROM_INDEX` |
| A3-P1-2 `/ressources` au sitemap | cross-ref A2 (même fichier) — dédupliquer |
| A5-P0-1 tokens prix dans `llms-full.txt` | **vérifié edge-safe** : `pricing-tokens.ts` n'importe que `@/lib/intl` + `@/content/pricing`, lui-même sans import Node → aucun besoin de basculer en `runtime="nodejs"`. Ne PAS convertir les `\|flat` en `\|from` (décision 4) |
| A6-P1-1 fallback Bing IndexNow | gaté par env, fail-soft ; ne pas réduire la cascade d'`indexnow.ts` ; ne pas re-diagnostiquer la clé (décision 11) |
| A6-P1-2 bouton admin IndexNow | chemin déjà mort ; garder la vérification HMAC si la route survit |
| B2-P1-2 bornes `AggregateOffer` | `lowPrice` reste un **nombre brut** (décision 4) ; ne pas réordonner `UN_A_UN_TIERS` |
| B4-P1-2 Person « Manon » fallback sous stub | additif, cohérent avec `jsonld-validation.spec.ts:137` |
| C2-P1-1 cache CDN des OG | ne touche pas `robots.ts` — invariant `Allow: /api/og` intact |
| C3-P1-1 `/en/book-a-call` | couvert par `en-to-fr-redirect.test.ts` ; ne pas retirer la règle `next.config` `/en/book` (utile au re-enable) |
| C4-P0-1 `/implementations` → 404 | vérifier que la règle ne capte pas `/implantations` |
| D1-P0-1 alerte kill switch > 48 h | alerting **seul** ; ne pas re-lister le kill switch lui-même (décision 10) |
| E2-P0 `acquireLicensePage` → `/fr/cgu` 404 | 1 ligne ; ne pas modifier `image-seo.service.ts` (galerie déjà correcte) |
| F7-P1-1 UA dans Sentry | ne PAS relâcher `sendDefaultPii: false` ; do-not-touch `piiScrubBeforeSend*` et `SEGMENTS_SECRETS` |
| G4-P0-1/P0-2 PNG 1,27 Mo / 1,44 Mo | redimensionnement **sans recomposition** (charte Qualiopi) |
| G4-P1-3 deux `<main>` | garder le `<main id="main">` du layout comme unique repère |

---

# Bloc 4 — Les arbitrages qui remontent à Will (STOP & ASK)

| # | Patch | Pourquoi Will, et pas un agent |
|---|---|---|
| 1 | Lot `strategy="inline"` (C-3) | Contrat AGENTS.md : tout patch touchant les budgets exige un ADR. Instruire l'ADR avec l'hypothèse corrigée (TBT neutre à améliorant), pas avec la peur initiale. |
| 2 | D4-P0 ouvrir `/sites-web-augmentes/par-ville` (455 URLs) | Contredit frontalement la décision Will du 2026-06-20 inscrite en code (`sitemap.ts:401-412`). Binaire : ouvrir **avec** maillage, ou refermer en `noindex`. |
| 3 | D4-P1-6 retirer 95 villes de l'index | **Rétraction d'indexation** de 95 URLs déjà connues de Google ; contredit l'invariant « monotone croissant » (`villes/index.ts:224-227`). |
| 4 | `sameAs` Organization (C-4) | Dépend d'une vérification humaine, fiche par fiche : déclarer une fiche encore « Paris » aggraverait l'erreur d'entité. |
| 5 | F5-P0-1 Qualiopi | Question factuelle en une ligne (certificat et NDA délivrés, oui/non, à quelle date). Le code retombe seul sur « aucune mention » si non. |
| 6 | F7-P0-1 volet 3 désactiver l'auto-deploy Coolify | Touche la plateforme de déploiement ; la mémoire avertit déjà qu'un changement côté UI Coolify re-sature le disque du CPX42. |
| 7 | G2 patch 3 `inlineCss: false` | Contredit frontalement la décision Sprint 24bis (gain FCP/LCP documenté). G2 le classe lui-même STOP & ASK. Ne pas commencer par là. |
| 8 | Cache Rules Cloudflare `.xml` (C-8) | Coût origine non chiffré ; préférer un Edge TTL 600 s borné à « Respect origin » aveugle. |
| 9 | D3-P1-2 multi-judge (C-16) | Arbitrage de **calendrier** : à poser après la recharge OpenAI, pas avant. |

---

## Mesures brutes

| # | Vérification | Fichier / commande | Résultat |
|---|---|---|---|
| 1 | Parallélisme des jobs | `deploy-coolify.yml` | `lhci:556`, `indexnow:650`, `warm:716` → tous `needs: deploy` ⇒ 3 jobs parallèles |
| 2 | `continue-on-error` du workflow | idem | **1 seule occurrence**, l.902 (`notify`) — `warm` n'en a pas |
| 3 | Concurrency de `warm` | idem l.720-722 | `group: warm-edge-cache`, `cancel-in-progress: true` |
| 4 | Les « deux listes » | idem l.747 / l.778 | 5 URLs chacune, identiques, **sans `/fr`** |
| 5 | La 3ᵉ liste (jamais nommée) | idem l.808 | `STRATEGIC` contient **déjà** `/fr`, `/fr/audit`, `/fr/formations`, `/fr/implementation` |
| 6 | Périmètre de `/api/internal/revalidate` | `route.ts:69-78` | tout path `/…`, try/catch, rate-limit 60/min/IP |
| 7 | Invariant `Allow: /api/og` | `robots.ts:107` + `robots.spec.ts:88` | présent **et** testé nommément |
| 8 | Verrouillage de `COMMON_ALLOW` | `robots.spec.ts` | `toContain`/`not.toContain` uniquement — **aucun verrou de longueur** |
| 9 | Routes sous `/api/observatoire/` | `ls` | **2** : `export-csv`, `export-json` |
| 10 | Verrou LC5/LC6 | `local-citations.spec.ts:36-46` | `listed` figé à `0` — 2 patches le rendent rouge |
| 11 | Portée de la gate anti-SIREN | `check-anti-siren.sh:11-16` | scan de `src/` en `.ts/.tsx/.js/.jsx/.mjs` seulement |
| 12 | Runtime des routes llms | `llms.txt:30`, `llms-full.txt:20` | `runtime = "edge"` |
| 13 | Import Prisma de `legal-identity` | `legal-identity.ts:23` | `import { prisma } from "@/lib/prisma"` au niveau module |
| 14 | Edge-safety de `pricing-tokens` | `pricing-tokens.ts:26-39`, `pricing.ts:896` | seuls `@/lib/intl` + `@/content/pricing` — edge-safe |
| 15 | Invocation Tailwind | `globals.css:1` / `admin.css` | 1 seul `@import "tailwindcss"` ; `admin.css` = `@layer` uniquement |
| 16 | Appelant de `isNoindexStubRoute` | `proxy.ts:336` | middleware Edge, **sans try/catch** |
| 17 | Clés de service noindex | `seo-noindex-routes.ts:103-110,139-143` | 3 clés ; `formations` et `un-a-un` absents |
| 18 | Existence des routes `par-ville` | `ls src/app/[locale]/…` | `audit/par-ville` ✔, `formations/par-ville` ✔, `interventions/par-ville` **✘** |
| 19 | Rendu de `JsonLd` non-inline | `JsonLd.tsx:39-47` | `next/script` + `dangerouslySetInnerHTML` ⇒ payload RSC |
| 20 | Source des sources d'article | `ArticleSources.tsx:32-40` | `view.citations` persistées ; filtre `^https?://` = préfixe seul |
| 21 | Déclenchement du seed images | `image-bank-seed.yml:36-39` | `workflow_run` sur le workflow de déploiement |
| 22 | Live — en-tête `Link` | `curl -I https://axion-ia.com/fr/audit`, 02:16Z | `hreflang="en"` → `/en/audit` (301) et `x-default` → `/audit` |
| 23 | Live — home | `curl https://axion-ia.com/fr`, 02:15:59Z | `200`, 0,17 s |
| 24 | API `alternateLinks` | `next-intl/dist/types/routing/config.d.ts:34` | clé valide de `RoutingConfig` ⇒ patch C1 bien placé |

---

## Limites

1. **Aucun test exécuté, aucun build, aucun Lighthouse** (machine de Will,
   consigne). Toutes les affirmations « ce test rougirait » reposent sur la
   lecture du fichier de test, jamais sur son exécution. Les deux affirmations
   les plus fortes (LC5/LC6, anti-SIREN) sont des lectures littérales de
   constantes et de regex, donc robustes ; les autres sont des inférences.
2. **Le comportement RSC du `next/script`** (argument central de ma révision du
   risque sur le lot `strategy="inline"`) est déduit de la lecture du composant
   et de l'architecture Next 16, **pas mesuré** sur un payload réel. La mesure
   décisive — comparer le poids du payload RSC avec et sans `afterInteractive`
   sur la même page — reste à faire, et c'est elle qui doit instruire l'ADR.
3. **Je n'ai pas relu les 40 rapports intégralement**, mais l'ensemble des
   blocs « Patch prescrit » et « Risque de régression / do-not-touch » de tous
   les P0 et P1. Un patch enterré dans un paragraphe de prose sans en-tête
   « Patch prescrit » a pu m'échapper.
4. **D2 et D7** (générateurs AEO, fraîcheur/lifecycle) sont les deux surfaces
   que j'ai le moins instrumentées : leurs patches vivent dans le pipeline
   content-gen, aujourd'hui **à l'arrêt** (acquis (f)), donc sans effet public
   immédiat et sans risque de régression en production tant que le kill switch
   tient. Ils devront être re-examinés **avant** le redémarrage du pipeline, pas
   maintenant — je le signale comme un angle mort assumé plutôt que comme une
   couverture.
5. **Aucune requête DB** (hors mandat H4) : les patches dont la sûreté dépend
   d'un volume réel (A4/E1 `lastmod`, D6 backfill des citations, C4-P1-5 hubs
   catégorie vides) sont notés « à confirmer par SQL avant patch ».
6. **Les gates CI n'ont pas été relues dans `ci.yml`** : je prends pour acquis
   l'établissement par G1 du `continue-on-error` sur `size-limit` et du
   caractère non bloquant du budget First Load, conformément à ma consigne de
   mission.
