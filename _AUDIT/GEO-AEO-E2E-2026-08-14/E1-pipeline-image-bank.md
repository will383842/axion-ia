# E1 — Pipeline image-bank (import → variants → EXIF/licence → watermark → RGPD → isolation)

- **Date** : 2026-08-14. Mesures live **19:30 → 19:39 UTC**.
- **Fenêtre de déploiement** : dernier deploy ATTERRI à **18:26 UTC** ; run suivant parti à **18:54 UTC**, encore `in_progress` à 19:30 UTC (`gh run view` / `gh run list -L 3`). Toutes mes mesures live portent donc sur le build de 18:26 UTC, **plus d'1 h après son atterrissage** : aucune de mes constatations n'est imputable à la fenêtre ISR post-deploy (et la galerie répondait déjà pleine — 288 images au sitemap).
- **Périmètre réellement couvert** : `src/server/image-bank/**` (services import, watermark, seo, bank, utils paths/ip-hash, constants, types), `src/server/actions/image-bank/upload.action.ts`, `src/app/api/image-bank/import/route.ts`, `src/app/[locale]/galerie/[slug]/telecharger/route.ts`, les 5 workers `image-bank-*`, `src/lib/image-utils.ts`, `scripts/seed-images.cjs`, `scripts/enrich-images.cjs`, `scripts/image-bank/{isolation-check.ts,reindex-convert.cjs}`, `.github/workflows/image-bank-seed.yml`, modèles Prisma `image_*` + `countries`, corpus disque `public/images` (806 fichiers) et fichiers servis en prod.
- **Hors périmètre (autres agents)** : sémantique/alt-text côté manifeste de pages + graph ImageObject des pages marketing (**E2**), qualité visuelle des photos, conformité Unsplash, héros villes (**E3**), sitemaps images en tant que sitemaps (**A4**), indexation Google Images (**E4**), prix affichés sur les pages d'offre (**B2**).
- **Recoupements** : je confirme depuis mon angle le constat E2 (`Organization` divergente `foundingDate:"2024"` sur les pages galerie — `image-jsonld-graph.service.ts`) et je ne le re-compte pas. Le point E2 « `acquireLicensePage` → /fr/cgu 404 » ne concerne PAS la galerie : côté image-bank `acquireLicensePage` = l'URL de la page image (vérifié live, correct).

## Résumé exécutif

Le pipeline image-bank est un **bel outillage largement débranché**. Deux choses cassent réellement la visibilité : (1) le job post-deploy `image-bank-seed.yml` **réécrit `title`/`alt`/`caption` des 133 images d'offre** avec un slug title-casé, et l'enrichissement Claude ne les régénère JAMAIS (garde `metaTitle`) — résultat mesuré live : **288/288 titres et 133/288 légendes du sitemap images sont mécaniques** (« Axion-IA — Veille Concurrentielle 847 Sources 12 Signaux IA Banniere »), alors que les descriptions riches, elles, ont survécu ; (2) l'enrichissement a gravé un **prix mort — « audit IA à 490 € »** — dans le `<title>` d'une page galerie et dans 2 légendes du sitemap, alors que les 490 € distanciels ont été supprimés le 2026-05-31 (plancher 1 190 €), sans aucun price-gate côté image-bank. À côté : **zéro EXIF/XMP/IPTC** sur les 806 fichiers publiés (la fonction d'embed existe mais n'a **aucun** appelant), **78/160 images typées portent des dimensions DB fictives** (JSON-LD live 1080×1920 pour un fichier 1536×1024), **75 `thumbnailUrl` en 404** dans les JSON-LD, la chaîne d'upload admin est cassée de bout en bout (worker sans insert DB, id ≠ dossier de stockage, chemin d'écriture ≠ chemin de lecture), `trackUsage()` (la seule instrumentation AEO/GEO du module : referrers Perplexity/ChatGPT/Claude) n'est appelée **nulle part**, et l'isolation-check est **rouge (18 violations)** tout en n'étant câblé dans aucune CI.

## Findings

### [P0] Le seed post-deploy écrase alt/titre/légende des 133 images — l'enrichissement ne les régénère jamais

- **Symptôme** : les 133 images du cœur d'offre (audit / formations / implémentations / 1-to-1 / logos) portent en prod un `alt`, un `title` et une `caption` **mécaniques**, dérivés du slug title-casé, sans accents ni sens (« …Signaux IA **Banniere** »), alors que leur `description` est un texte Claude Vision riche. Le signal n°1 de Google Images (l'alt) et le `<image:title>`/`<image:caption>` du sitemap images sont donc du bruit sur toute la banque.
- **Preuve code** :
  - `scripts/seed-images.cjs:298-305` — le bloc `update` de l'upsert de traduction réécrit `slug`, `title`, `alt: titleFr` (l.301) et `caption: \`${labelFr} — ${slugToTitle(entry.slug)}\`` (l.302) à CHAQUE exécution ; `titleFr` est construit l.283 par `slugToTitle()` (l.47-58).
  - `scripts/enrich-images.cjs:219-221` — la sélection des images à enrichir exclut celles qui ont déjà un `metaTitle` (`NOT: { translations: { some: { languageCode:"fr", metaTitle: { not: null } } } }`). Or le seed **ne touche pas** `metaTitle` : après un écrasement, l'enrichissement considère l'image « déjà faite » et ne repasse plus jamais.
  - `scripts/enrich-images.cjs:168-180` — le bloc `update` de l'enrichissement n'écrit **pas** `title` (seul le `create` l.181-195 le fait) : même une ré-exécution forcée (`--force`) laisserait les 288 titres mécaniques.
  - `.github/workflows/image-bank-seed.yml:36-39` — déclencheur `workflow_run` sur « Build & Deploy · GHCR + Coolify » : le mécanisme est **armé à chaque déploiement réussi** ; `:183-193` exécute `node /tmp/seed-images.cjs` dans le container prod.
- **Preuve live** (19:36 UTC, `sitemaps/images-fr.xml`, 288 blocs) :
  - **288/288** `<image:title>` valent exactement `Axion-IA — ` + `TitleCase(slug)` ;
  - **133/288** `<image:caption>` valent exactement `<label module> — ` + `TitleCase(slug)` — soit précisément les 133 entrées de `seed-images.cjs` (les 155 images villes, hors périmètre du seed, ont gardé leurs légendes rédigées) ;
  - page `/fr/galerie/axion-ia-veille-concurrentielle-847-sources-12-signaux-ia-banniere` (19:35 UTC) : `alt` du DOM = « Axion-IA — Veille Concurrentielle 847 Sources 12 Signaux IA Banniere », `caption` JSON-LD idem, mais `description` = texte Vision riche → signature exacte d'un écrasement postérieur à l'enrichissement ;
  - `gh run list --workflow image-bank-seed.yml` (19:37 UTC) : 24 runs, **le dernier le 2026-05-21 à 09:21 UTC** (39 s = seed + enrich qui ne trouve rien à faire). L'écrasement est donc **en production depuis ~85 jours**.
- **Root-cause** : deux scripts écrivent les mêmes colonnes avec des priorités inverses et aucune notion de « champ déjà enrichi = ne pas écraser » ; la garde d'idempotence de l'enrich (`metaTitle`) porte sur une colonne que le seed ne réinitialise pas, ce qui rend la perte **définitive** au lieu d'être auto-réparée.
- **Patch prescrit** : (a) dans `seed-images.cjs`, retirer `title`/`alt`/`caption` du bloc `update` (l.298-305) — le seed doit garantir l'EXISTENCE de la ligne, pas son contenu éditorial ; (b) faire porter la garde d'idempotence de l'enrich sur `alt` ET `metaTitle` (`OR: [{ metaTitle: null }, { alt: { equals: title } }]`) pour que toute ligne re-mécanisée soit automatiquement reprise ; (c) faire écrire `title` par le bloc `update` de l'enrich ; (d) après patch, un run `workflow_dispatch` avec `force_enrich=true` régénère les 133 (coût Anthropic ≈ 133 appels Vision).
- **Effort** : S (patchs) + M (re-run + relecture d'un échantillon). **Impact GEO/AEO** : **fort** — alt/titre/légende sont les 3 champs que Google Images et les moteurs génératifs lisent ; 288 URLs indexables concernées.
- **Risque de régression** : faible. Attention : le seed reste la seule source de `filePath`/`module`/dimensions — ne pas vider tout le bloc `update`. **Do-not-touch** : `enrich-images.cjs` (contrat CJS pur, `require('/app/prisma/generated/client')`, `--max-old-space-size=96` — le container est slim) ; `slug` des traductions (URL publiques déjà indexées) ; ne pas relancer l'enrich sans le patch (a) sinon nouvelle perte au prochain seed.

### [P0] Prix mort « 490 € » gravé par l'enrichissement dans un `<title>` indexable et dans le sitemap images

- **Symptôme** : le pipeline d'enrichissement a recopié un prix lu **dans le pixel d'une affiche** vers des métadonnées textuelles publiées. En prod : `<title>` de la page galerie de l'affiche métro = « **Audit IA en Entreprise — 490 €** | Axion-IA · Axion-IA » ; 2 légendes du sitemap images annoncent « audit IA à **490 €** » et « Audit IA Axion-IA (**490 € PME**) ». Or le 490 € distanciel a été **supprimé de l'offre le 2026-05-31** ; le prix de référence est « à partir de 1 190 € HT ».
- **Preuve code** : `src/content/pricing.ts:118-119` (« Will 2026-05-31 : suppression du 490 € distanciel, prix de référence unique 1190 € HT ») et `:231-241` (`audit-flash`, `priceFlat: 1190`, `isFromPrice: true`). Côté image-bank : **aucun** garde-fou prix — `scripts/enrich-images.cjs:130-153` mappe la sortie Claude telle quelle (`alt`, `caption`, `description`, `metaTitle`…) ; il n'existe pas d'équivalent du `price-gate` de content-gen dans `src/server/image-bank/**` (grep « price » sur le module = 0).
- **Preuve live** : 19:31 UTC — `curl https://axion-ia.com/fr/galerie/axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche` → `<title>Audit IA en Entreprise — 490 € | Axion-IA · Axion-IA</title>` ; 19:36 UTC — `sitemaps/images-fr.xml` contient 4 légendes avec `€`, dont 2 portant « 490 € ».
- **Root-cause** : enrichissement figé en base (mai 2026) + changement de tarif (mai/juillet 2026) + zéro re-vérification et zéro gate ; le prix vit dans le pixel de l'affiche, donc il ressort à chaque OCR Vision.
- **Patch prescrit** : (1) correctif immédiat : `UPDATE` ciblé des traductions dont `metaTitle`/`caption`/`description` matchent `/\b490\s?€/` (2 à 4 lignes) → reformuler sans montant ; (2) durable : ajouter au pipeline d'enrichissement un gate « aucun montant en € dans les champs générés » (l'image-bank n'a aucune raison d'annoncer un prix — le prix vit dans `pricing.ts`), en réutilisant la logique de `content-gen` price-gate ; (3) idéalement, dépublier/retoucher l'affiche source (recoupe E3, qui la signale déjà pour « GAINS MESURABLES ASSURÉS »).
- **Effort** : S (nettoyage) + S (gate regex). **Impact GEO/AEO** : **fort** — prix faux dans un `<title>` indexable + dans le sitemap = information mensongère pour Google et pour les moteurs génératifs qui citent la page.
- **Risque de régression** : nul côté rendu. **Do-not-touch** : `pricing.ts` (SSOT, décision actée « toujours à partir de » — ne rien y ajouter pour « faire coller » la légende) ; ne pas transformer le gate en interdiction du caractère « € » dans les descriptions de graphiques/dataviz **légendant un chiffre client** (ex. « perte de 8 400 €/an » est légitime) : gate sur les prix de l'offre Axion-IA uniquement.

### [P1] Zéro EXIF/XMP/IPTC sur 100 % des fichiers publiés — la fonction d'embed copyright n'a aucun appelant

- **Symptôme** : la doctrine du module (« EXIF/XMP/IPTC embed », en-tête `image-import.service.ts:9`) promet un ré-embed « copyright propre ». Aucun fichier publié ne porte le moindre bloc de métadonnées : Google Images n'a donc aucun `IPTC Copyright`/`Creator`/`Web Statement of Rights` à lire (ce sont ces champs qui alimentent le panneau « Détails de l'image » et la crédibilité du badge Licensable, en plus du JSON-LD).
- **Preuve code** :
  - `src/lib/image-utils.ts:284-301` — `embedCopyrightMetadata()` (Copyright + licence CC BY) existe… et **grep exhaustif : 0 appelant** hors du fichier lui-même (idem `stripExifPreserveOrientation`, `generateAllVariants`, `validateUploadBuffer`, `assertBudget` — tout le module est du code mort).
  - `scripts/image-bank/reindex-convert.cjs:66-84` — le convertisseur qui a RÉELLEMENT produit le corpus (webp + avif + thumb) n'appelle ni `withMetadata`, ni `withExif` : Sharp strippe donc tout par défaut.
  - Seul `src/server/queue/workers/image-bank-auto-convert-worker.ts:142-157` écrit un EXIF… mais ce worker n'a aucun producteur (cf. P2 « workers fantômes »).
- **Preuve live** (19:32 UTC) : `sharp().metadata()` sur les fichiers locaux ET sur le fichier téléchargé depuis la prod (`/images/axion-ia-veille-concurrentielle-…-banniere.webp`) → `exif: NONE | xmp: NONE | iptc: NONE` (idem `.avif`, idem `public/villes-hero/grenoble.jpg`).
- **Root-cause** : deux pipelines parallèles (le service applicatif et le script de conversion réel) ; le script réel, écrit pour un batch one-shot, n'a jamais intégré la brique copyright.
- **Patch prescrit** : ajouter dans `reindex-convert.cjs` (et dans `image-import.service.ts`) un `.withExif({ IFD0: { Copyright: "© <année> Axion-IA — CC BY 4.0 — https://axion-ia.com", Artist: "Axion-IA" } })` avant chaque `.toFile()` ; prévoir un script de backfill sur les 806 fichiers existants (ré-encodage identique + EXIF, ~2 min). Utiliser `withExif` (Sharp 0.35) et non `withMetadata` (déprécié, cf. finding suivant).
- **Effort** : S (pipeline) + S (backfill batch). **Impact GEO/AEO** : moyen-fort (signal de propriété/licence lisible par Google Images et par les crawlers d'images, cohérence avec le JSON-LD `license` déjà émis).
- **Risque de régression** : faible ; vérifier que le poids reste sous budget (`LCP_IMAGE_BYTES_MAX = 200 000`, `constants.ts:116`) — l'EXIF ajoute < 1 KB. **Do-not-touch** : ne pas ré-encoder à qualité différente (les fichiers actuels sont validés visuellement par E3) ; ne pas ré-embarquer de GPS (cf. RGPD ci-dessous).

### [P1] `withMetadata({orientation:1})` **conserve** l'EXIF (GPS compris) au lieu de le stripper — le commentaire RGPD dit l'inverse — et rien n'auto-oriente les photos

- **Symptôme** : le pipeline d'import affiche une garantie RGPD explicite (« strip EXIF GPS si présent (PII) », « Sécurité par défaut ») que le code ne tient pas : `withMetadata()` **inclut** toutes les métadonnées de l'entrée. Deuxième effet : forcer `orientation: 1` sans avoir tourné les pixels fait perdre l'orientation réelle → une photo iPhone (`Orientation=6`) sortira couchée, définitivement.
- **Preuve code** : `src/server/image-bank/services/image-import.service.ts:72-82` (le commentaire RGPD) puis `:92`, `:107`, `:118`, `:137` (`.withMetadata({ orientation: 1 })` sur chaque variant) ; même motif dans `src/lib/image-utils.ts:105-107`. Sémantique de l'API prouvée sur le paquet installé (**sharp 0.35.3**) : `node_modules/sharp/lib/index.d.ts:750-751` — « **Include all metadata (EXIF, XMP, IPTC) from the input image in the output image.** The default behaviour, when withMetadata is not used, is to **strip all metadata** » ; et `:1221` marque `withMetadata` **@deprecated** au profit de `withExif()/withExifMerge()`. L'auto-orientation existe (`autoOrient()`, `:417-421`) et n'est appelée nulle part.
- **Preuve live** : **non observable en prod** — aucune image de la famille UUID (upload admin) n'existe : le HTML de `/fr/galerie` (19:33 UTC) ne contient **aucune** occurrence de `/image-bank/`, et les 288 images publiées viennent du seed slug-based (fichiers sans EXIF, cf. finding précédent). **[À CONFIRMER en usage réel]** : le risque est armé pour le premier upload admin d'une photo smartphone.
- **Root-cause** : inversion de sémantique d'API (`withMetadata` lu comme « normalise/strippe » alors qu'il signifie « conserve »), jamais testée parce que le chemin d'upload n'a jamais servi.
- **Patch prescrit** : remplacer par `.autoOrient()` (tourne réellement les pixels) puis `.withExif({ IFD0: { Copyright, Artist } })` — qui repart d'un EXIF **vide** et n'écrit que ce qu'on lui donne : orientation correcte + GPS supprimé + copyright embarqué, les trois d'un coup. Corriger les deux commentaires mensongers.
- **Effort** : S. **Impact GEO/AEO** : faible directement, **fort en conformité** (PII GPS dans un fichier public = violation RGPD si un jour une photo terrain est uploadée).
- **Risque de régression** : faible ; `autoOrient()` change les dimensions de sortie pour les photos pivotées — c'est le comportement voulu, mais la colonne `width/height` doit être lue **après** rotation (voir finding dimensions). **Do-not-touch** : ne pas passer par `keepMetadata()` (rétablirait le GPS).

### [P1] Dimensions et poids de la base sont fictifs : 78/160 images typées ont un `width`/`height` faux, 14 orientations inversées, `fileSize = 0` partout

- **Symptôme** : les colonnes `width`/`height`/`orientation`/`aspectRatio` ne sont pas mesurées, elles sont **devinées à partir du suffixe du slug** via une table statique. Elles alimentent le JSON-LD `ImageObject` (`width`/`height` en `QuantitativeValue`) servi à Google. Un `ImageObject` qui annonce 1080×1920 pour un fichier 1536×1024 est une métadonnée fausse (et un mauvais ratio de prévisualisation).
- **Preuve code** : `scripts/seed-images.cjs:12-21` (table `DIMENSIONS` par type) + `:34-45` (`detectType(slug)` — le type est déduit du suffixe) + `:236-241` (écriture de `width/height/orientation/aspectRatio`) et `:234` (`fileSize: 0`). Émission JSON-LD : `src/server/image-bank/services/image-seo.service.ts` (bloc `ImageObject`), consommé par `/[locale]/galerie/[slug]/page.tsx`. Bug adjacent côté service applicatif : `image-import.service.ts:151-154` calcule `fileSize` via `sharp(<chemin fichier>).metadata().size` — or `size` n'est renseigné **que pour les entrées Buffer/Stream** ; vérifié localement (19:31 UTC) : `metadata().size` = `undefined` sur un chemin → `fileSize` vaudrait 0 pour tout upload aussi.
- **Preuve live** :
  - 19:31 UTC — JSON-LD de `/fr/galerie/axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche` : `width {value: 1080}`, `height {value: 1920}` (portrait 9:16) ; le fichier réellement servi mesure **1536×1024** (paysage) — mesuré au `sharp().metadata()` sur le fichier du dépôt, identique à celui servi (même octetage, 200 OK).
  - Balayage du corpus (19:34 UTC) : sur les **160** fichiers dont le suffixe est typé, **78** ont des dimensions différentes de la table, et **14** ont une **orientation inversée** (portrait annoncé pour un paysage, ou l'inverse).
- **Root-cause** : le seed a été écrit avant/indépendamment de la conversion réelle (`reindex-convert.cjs` cadre en 1920×1080 / 1200×1200 / 1600 inside selon SON propre plan, l.33-46) ; personne ne relit le fichier pour renseigner la base.
- **Patch prescrit** : dans `seed-images.cjs`, remplacer la table `DIMENSIONS` par une lecture réelle (`sharp(path).metadata()` sur `public/images/{slug}.webp` + `statSync().size` pour `fileSize`) — le script tourne dans le container, les fichiers y sont ; à défaut, script de backfill one-shot des 288 lignes. Corriger aussi `image-import.service.ts:151-154` (`fileSize` = `(await stat(lgPath)).size`).
- **Effort** : S. **Impact GEO/AEO** : moyen (fiabilité des `ImageObject` sur 288 URLs ; Google recoupe systématiquement les dimensions déclarées).
- **Risque de régression** : faible ; `aspectRatio` est en `VarChar(10)` — garder la réduction par PGCD et tronquer si besoin. **Do-not-touch** : `orientation` n'accepte que `landscape|portrait|square` (`constants.ts:216`).

### [P1] 75 `thumbnailUrl` en 404 dans les JSON-LD (et dans la console admin)

- **Symptôme** : le seed déclare pour chaque image un `thumbnailPath = images/{slug}-thumb.webp` ; **75** de ces fichiers n'ont jamais été générés. Le JSON-LD publie quand même un `thumbnailUrl` **et** un nœud `thumbnail: { ImageObject, contentUrl }` pointant sur une URL morte.
- **Preuve code** : `scripts/seed-images.cjs:232` (`thumbnailPath` systématique) ; `src/server/image-bank/services/image-seo.service.ts:125-128` (émission `thumbnailUrl` + `thumbnail` sans vérification d'existence) ; `scripts/image-bank/reindex-convert.cjs:80-83` ne génère de `-thumb.webp` que pour les 215 entrées de son manifeste ; le problème est déjà connu et contourné côté console (`src/server/image-bank/utils/paths.ts:95-110`, correctif du 2026-08-02) mais **pas** côté JSON-LD.
- **Preuve live** : inventaire disque (19:32 UTC) — 291 images de base, 216 `-thumb.webp` → **75 manquants** ; prod 19:31 UTC : `/images/axion-ia-audit-entreprise-metro-…-affiche-thumb.webp` → **404**, `/images/axion-ia-audit-ia-methode-5-etapes-…-infographie-thumb.webp` → **404**, tandis que les `.webp`/`.avif` correspondants répondent 200 ; JSON-LD de la page de l'affiche (19:31 UTC) : `thumbnailUrl` = exactement cette URL 404.
- **Root-cause** : le seed déclare un chemin par convention, sans vérifier le disque ; les 75 images hors manifeste n'ont jamais eu de vignette.
- **Patch prescrit** : (a) générer les 75 vignettes manquantes (une passe Sharp 400 px, ~30 s) — le plus simple et le plus utile (la console s'en sert) ; (b) et/ou ne renseigner `thumbnailPath` au seed que si le fichier existe (`fs.existsSync`) ; (c) ceinture : dans `image-seo.service.ts`, n'émettre `thumbnailUrl` que si `thumbnailPath` est non nul (déjà le cas) — la vraie garde est en amont.
- **Effort** : S. **Impact GEO/AEO** : moyen (métadonnée cassée sur 75 des 288 pages images ; Google ignore un thumbnail 404 mais l'incohérence pèse sur la confiance accordée au reste du balisage).
- **Risque de régression** : nul. **Do-not-touch** : `resolveAdminThumbSrc` (`paths.ts:91-122`) — son contournement reste utile tant que (a) n'est pas fait ; il est couvert par `paths.spec.ts`.

### [P1] Chaîne d'upload admin cassée de bout en bout (4 défauts cumulés) — aucune image UUID n'existe en prod

- **Symptôme** : les deux portes d'entrée « nouvelle image » sont hors service. Concrètement, la banque ne peut s'enrichir que par un script manuel lancé depuis le PC de Will.
- **Preuve code** :
  1. **API sans persistance** : `src/app/api/image-bank/import/route.ts:204-216` enfile un job avec `initialMetadata` (slug, alt, geo…) ; le worker `src/server/queue/workers/image-bank-import-worker.ts:53-60` appelle `imageImportService.importImage()` (qui ne fait que produire des fichiers) et **ne crée aucune ligne DB** — malgré son en-tête « pipeline Sharp variants, **DB insert** » (l.3) ; `initialMetadata` n'est jamais lu. Puis `:72-81` enfile un job d'enrichissement sur `result.uuid`, un identifiant qui **n'existe dans aucune table** → l'enrich échouera systématiquement.
  2. **id DB ≠ dossier de stockage** : `image-import.service.ts:64` génère un `randomUUID()` pour le dossier ; `image-bank.service.ts:93-105` laisse Prisma générer un **autre** uuid pour `ImageAsset.id`. Or la route de téléchargement reconstruit le chemin avec `image.id` (`telecharger/route.ts:103`) et la console fait de même (`paths.ts:119`) → chemin inexistant.
  3. **Chemin d'écriture ≠ chemin de lecture** : `utils/paths.ts:69` écrit dans `IMAGE_BANK_STORAGE_PATH ?? "/var/data/image-bank"`, `telecharger/route.ts:101` lit dans `IMAGE_BANK_STORAGE_PATH ?? "/data/image-bank"`. Et la variable **n'est déclarée ni dans `src/env.ts` ni dans `.env.example`/`.env.production.example`** (grep 19:29 UTC) → très probablement non définie en prod, donc les deux défauts divergent réellement.
  4. **URL protocol-relative** : `publicUrlFromLocalPath()` (`paths.ts:62-64`) ne strippe que le préfixe `public/` ; en prod le chemin `/var/data/image-bank/<uuid>/image-lg.webp` devient `//var/data/…` — une URL **protocol-relative** pointant sur l'hôte `var`. Le contournement de `paths.ts:118-120` documente ce cas comme observé en production.
- **Preuve live** (19:33 UTC) : le HTML de `/fr/galerie` ne contient **aucune** occurrence de `/image-bank/` — la totalité des 288 images publiées vient du seed slug-based. La chaîne d'upload n'a donc jamais produit une image visible en prod (cohérent avec les 4 défauts).
- **Root-cause** : trois auteurs successifs (service, worker, route de download) avec trois conventions de chemin, jamais exercées par un test d'intégration ni par un usage réel.
- **Patch prescrit** : (1) faire passer `ImageAsset.id = imported.uuid` (`imageBankService.create` accepte un `id` explicite) — un seul identifiant pour la ligne et le dossier ; (2) déplacer l'insert DB dans le worker d'import (réutiliser `uploadImageAction` en extrayant sa logique) et lui faire consommer `initialMetadata` ; (3) déclarer `IMAGE_BANK_STORAGE_PATH` dans `src/env.ts` avec un défaut UNIQUE, importé par les deux call-sites ; (4) faire retourner à `publicUrlFromLocalPath` une URL `/image-bank/<uuid>/…` (préfixe logique) plutôt qu'un chemin disque.
- **Effort** : M. **Impact GEO/AEO** : moyen (aucune perte actuelle — mais la banque est gelée : toute nouvelle image doit passer par un script local, ce qui est exactement pourquoi rien n'a été ajouté depuis mai 2026).
- **Risque de régression** : moyen — toucher aux chemins peut casser l'affichage des images seedées. **Do-not-touch** : la branche « slug-based » de `resolveImgSrc` (`GalleryGrid.tsx:42-50`) et de `telecharger/route.ts:87-98` : c'est elle qui sert les 288 images en prod. Tester d'abord sur une image jetable.

### [P1] `trackUsage()` n'est appelée nulle part : `image_usage_logs` reste vide, la mesure AEO/GEO des referrers IA est morte

- **Symptôme** : le module embarque une instrumentation explicitement conçue pour l'audit qui nous occupe — détecter que la visite vient de Perplexity / ChatGPT / Claude / Copilot / Gemini et la taguer `country_code = "AI-{source}"` pour mesurer le ROI AEO/GEO. Elle n'est jamais déclenchée : `viewCount` et `embedCount` restent à 0 sur toute la banque, et aucune vue n'est jamais journalisée.
- **Preuve code** : `src/server/image-bank/services/image-bank.service.ts:353-377` (`trackUsage`, seule écriture de `prisma.imageUsageLog.create`) — **grep exhaustif : 0 appelant** (`trackUsage|logUsage` hors définition). Les constantes dédiées existent bel et bien (`constants.ts:234-253`, `AI_REFERRER_PATTERNS` + `detectAiReferrerSource`) ; la page galerie ne l'appelle pas ; la route de téléchargement écrit directement dans `imageDownloadLog` (`telecharger/route.ts:132-149`) **en court-circuitant** `trackUsage` — donc même les downloads échappent à la détection de referrer IA (et `referrerUrl` n'y est pas capté).
- **Preuve live** : la console `image-bank/analytics` est un `AdminStubPageV2` (`analytics/page.tsx:24-29`) — donc l'absence de données n'est même pas visible. Aucune mesure DB possible depuis mon rôle (lecture DB prod réservée à A3/B6/D1/D5/D8/F7) → volume exact de `image_usage_logs` **[À CONFIRMER par un agent DB]**, mais le code prouve qu'aucune ligne `view` ne peut exister.
- **Root-cause** : brique livrée « prête à câbler » (Sprint AEO V1), jamais câblée sur la page de détail galerie.
- **Patch prescrit** : appeler `imageBankService.trackUsage({ imageId, action:"view", referrerUrl: headers().get("referer"), userAgent, ipHash: hashImageBankIp(ip) })` en fire-and-forget dans `/[locale]/galerie/[slug]/page.tsx` (ou via une route `POST /api/image-bank/track` si l'on veut préserver le cache ISR de la page) ; et faire passer le download par `trackUsage` pour bénéficier de la détection de referrer.
- **Effort** : S-M (attention au cache : un appel serveur dans une page ISR ne s'exécute qu'au (re)rendu — préférer un endpoint dédié ou un `after()`). **Impact GEO/AEO** : moyen (c'est l'unique capteur « les moteurs IA envoient-ils du trafic sur nos images ? » ; sans lui, l'arbitrage sur la banque d'images se fait à l'aveugle).
- **Risque de régression** : moyen sur les Web Vitals si mal câblé (ne pas rendre la page dynamique : budget LCP ≤ 1 800 ms, `/galerie` est gaté par `.size-limit.json:260`). **Do-not-touch** : `hashImageBankIp` (`utils/ip-hash.ts` — format historique 64 hex `salt:ip`, changer le format rendrait irréversible le droit à l'effacement déjà implémenté dans `forget-ip-hash.action.ts`).

### [P2] Workers fantômes : `image-bank-convert` sans producteur, `image-bank-crons` 100 % TODO — et les « 7 variants » n'existent nulle part

- **Symptôme** : deux des cinq workers du module tournent en prod sans jamais rien faire. Le worker `auto-convert` promet 7 variants (`-og`, `-square`, `-thumb`, `-md`, `-sm` + webp/avif pleine largeur) : le disque n'en porte **aucun** des quatre premiers.
- **Preuve code** : `src/server/queue/worker.ts:128` démarre `startImageBankAutoConvertWorker()` ; **grep : aucun `.add()` sur `AUTO_CONVERT_QUEUE_NAME`** (queue déclarée `queues.ts:540`, jamais alimentée). `image-bank-crons-worker.ts:35-52` : les 3 branches (`seo-score-recalc`, `taxonomy-redetect-batch`, `watermark-backfill`) sont des `break` vides, et aucun scheduler n'enfile de job (`imageBankCronsQueue` : 0 appelant).
- **Preuve live** (19:32 UTC) : `public/images` = 806 fichiers, dont **0** `-og.webp`, **0** `-square.webp`, **0** `-md.webp`, **0** `-sm.webp` ; en prod `/images/…-og.webp` → **404**. Corollaire : la colonne `srcset` reste nulle pour les 288 images (aucun variant responsive à référencer) — c'est `next/image` qui compense.
- **Root-cause** : Sprint 5.1+ jamais soldé ; la conversion réelle est passée par `reindex-convert.cjs` (3 fichiers par image), pas par le worker.
- **Patch prescrit** : soit brancher le worker (le seul producteur logique serait l'upload admin), soit le **supprimer** avec sa queue et ses TODO — deux workers inertes consomment une connexion Redis et brouillent la lecture de l'architecture. Décision produit (S).
- **Effort** : S. **Impact GEO/AEO** : faible. **Risque de régression** : faible ; `worker.ts` liste les démarrages — retirer proprement les deux entrées. **Do-not-touch** : ne pas supprimer `image-bank-enrich`/`-translate`/`-import` (utilisés ou utilisables).

### [P2] `image-bank:isolation-check` : absent de la CI et actuellement ROUGE (18 violations)

- **Symptôme** : la garde d'isolation du module n'est exécutée par **aucun** hook ni **aucune** CI — et lorsqu'on l'exécute, elle échoue. C'est le cas d'école « une garde ne vaut que si elle rougit » : celle-ci rougit, mais personne ne la lance.
- **Preuve code** : `package.json:72` définit le script ; il n'apparaît que dans `verify:all` (`package.json:100`), qui n'est appelé ni par `.husky/pre-commit` (lint-staged + anti-siren + anti-hex + use-client + typecheck), ni par `.husky/pre-push` (typecheck + i18n + zod + test + audit), ni par `.github/workflows/ci.yml` — qui n'exécute que le **sister** `content-gen:isolation-check` (`ci.yml:102`).
- **Preuve live** (exécution locale read-only, 19:38-19:39 UTC) : `❌ [image-bank:isolation-check] 18 violations détectées` — dont `src/server/content-gen/images/select-hero-image.ts`, `backfill-hero.ts`, `src/server/press/queries.ts`, `src/components/sections/PressImages.tsx`, `src/server/careers/cv-storage.ts`, `src/app/admin.css`, plusieurs tests admin. La majorité sont des références **textuelles légitimes** (le marqueur `ImageAsset` apparaît dans des sélections Prisma read-only déjà tolérées ailleurs par la liste d'exceptions).
- **Root-cause** : la liste d'exceptions (`isolation-check.ts:39-149`) n'a pas suivi les intégrations content-gen/presse/carrières ; et sans exécution automatique, la dérive n'a jamais été signalée.
- **Patch prescrit** : (1) trier les 18 : ajouter en exceptions documentées celles qui sont de vraies lectures cross-module (c'est déjà le motif retenu l.95-107), corriger les autres ; (2) **puis** ajouter `pnpm image-bank:isolation-check` à `ci.yml` à côté de son jumeau — dans cet ordre, sinon la CI passe rouge immédiatement.
- **Effort** : S. **Impact GEO/AEO** : nul directement (hygiène de code). **Risque de régression** : ajouter le check en CI **avant** d'avoir soldé les 18 bloquerait toutes les PR — ordre impératif. **Do-not-touch** : `scripts/content-gen/isolation-check.ts` (jumeau vert, sert de référence de forme).

### [P2] Aucun LQIP en production alors que la colonne et la génération existent

- **Symptôme** : `lqipDataUri` est nulle pour les 288 images seedées → la galerie affiche `placeholder="empty"`, sans flou de préchargement, sur une grille de 24 vignettes par page.
- **Preuve code** : `scripts/seed-images.cjs:225-263` n'écrit pas `lqipDataUri` ; `src/components/galerie/GalleryGrid.tsx:92,110-111` prévoit pourtant le blur si la valeur existe ; la génération LQIP existe dans `image-import.service.ts:141-146` (jamais empruntée par le corpus réel) et dans `image-bank-auto-convert-worker.ts:172-176` (worker sans producteur).
- **Preuve live** (19:33 UTC) : HTML de `/fr/galerie` → **0** occurrence de `data:image/jpeg;base64` et **0** de `data:image/webp;base64`.
- **Patch prescrit** : backfill one-shot (Sharp 20 px + blur, ~1 s/image) écrivant `lqipDataUri` pour les 288 lignes.
- **Effort** : S. **Impact GEO/AEO** : faible (confort perçu / CLS ; le budget CLS = 0 est déjà tenu par `fill` + `aspect-[4/3]`).
- **Risque de régression** : faible ; garder les LQIP ≤ 1 KB (sinon poids HTML de la grille). **Do-not-touch** : `GalleryGrid` (le `placeholder` conditionnel est déjà correct).

### [P2] Les 7 logos/icônes de marque sont publiés sous licence CC BY 4.0

- **Symptôme** : le seed applique `licenseType: "cc-by-4.0"` **à toutes** les entrées, y compris `axion-ia-logo-horizontal-*` et `axion-ia-icone-app-*`. Les pages galerie correspondantes affichent le badge « CC BY 4.0 » et le JSON-LD déclare `license: creativecommons.org/licenses/by/4.0/` : le site invite donc formellement quiconque à réutiliser, **modifier** et exploiter commercialement le logo, moyennant attribution. Une licence CC ne couvre pas le droit des marques, mais la déclaration publique affaiblit la position en cas d'usage abusif.
- **Preuve code** : `scripts/seed-images.cjs:242-245` (licence uniforme) + `:117-123` (les 7 entrées `module: "logo"`) ; badge CC BY affiché sans condition `GalleryGrid.tsx:117-119` ; licence émise dans le JSON-LD `image-seo.service.ts:100`.
- **Preuve live** (19:31 UTC) : sur la page image testée, `"license":"https://creativecommons.org/licenses/by/4.0/"` + `copyrightNotice: "© 2026 Axion-IA. Licensed under CC BY 4.0 — axion-ia.com"`.
- **Patch prescrit** : passer les entrées `module:"logo"` en `licenseType: "all-rights-reserved"` + `licenseUrl` vers une page d'usage de marque (ou simplement les dépublier de la galerie publique : `isPublished:false` sur la traduction), et conditionner le badge à la licence réelle.
- **Effort** : S. **Impact GEO/AEO** : faible (mais protège l'entité de marque, ce qui est un actif GEO). **Risque de régression** : faible. **Do-not-touch** : `resolveCopyrightHolder` (`constants.ts:69-73`, nettoyage « OÜ » → « Axion-IA » : décision actée, ne pas rétablir la mention estonienne) ; les logos utilisés par le site lui-même (`/logo-axion-ia.png`) ne passent pas par la banque.

### [P2] Route de téléchargement : `?variant=` ignoré côté slug, `variant=original` inexistant, `filename` mensonger

- **Symptôme** : pour la famille slug-based (soit 100 % des images publiques), le paramètre `variant` n'a aucun effet — le fichier principal est servi quel que soit le variant — mais le nom de fichier proposé à l'utilisateur porte quand même le suffixe demandé (`…-lg.webp`, `…-xl.webp`). Pour la famille UUID, `variant=original` construit un chemin `<storage>/<id>/original` qu'aucun pipeline ne produit (l'import écrit `image-{sm,md,lg,xl}.webp`, `thumb.webp`, `og.webp`, `image-{md,lg}.avif`) → 404 systématique.
- **Preuve code** : `src/app/[locale]/galerie/[slug]/telecharger/route.ts:87-98` (branche slug, `variant` non utilisé) vs `:99-109` (branche UUID) et `:151-152` (`filename` construit avec `variant`) ; inventaire des sorties : `image-import.service.ts:86-138`.
- **Preuve live** (19:37 UTC) : `HEAD /fr/galerie/axion-ia-veille-concurrentielle-…-banniere/telecharger` → **200**, `content-disposition: attachment; filename="…-lg.webp"`, `Cache-Control: no-store` — alors que le fichier servi est le `.webp` pleine largeur, pas un variant `lg`.
- **Patch prescrit** : côté slug, ignorer explicitement `variant` dans le `filename` (ou servir `-thumb`/`-md` quand ils existent) ; retirer `original` de `ALLOWED_VARIANTS` tant que le pipeline ne l'écrit pas.
- **Effort** : S. **Impact GEO/AEO** : faible (`X-Robots-Tag: noindex` correctement posé, route non indexable). **Risque de régression** : nul. **Do-not-touch** : le rate-limit Redis 10/min et le hash IP (RGPD) — corrects.

### [P2] Divers cohérence pipeline : année de copyright codée en dur, 5 vocabulaires `sourceType`, variant OG orphelin, double enfilement d'enrichissement

- **Symptôme / preuves code** :
  - `image-bank-auto-convert-worker.ts:145` — `Copyright: "© 2026 Axion-IA — CC BY 4.0"` **en dur** (le watermark, lui, calcule l'année : `constants.ts:188`) ; et les tags GPS y sont écrits dans `IFD0` (`:149-153`) alors qu'ils appartiennent à l'IFD GPS → EXIF GPS invalide même si le worker était branché.
  - `sourceType` : 5 vocabulaires incompatibles — défaut Prisma `"photo"` (`schema.prisma:4152`), `SOURCE_TYPES = ["local","upload","ai_generated"]` (`constants.ts:211`), union du worker `"photo"|"ai_generated"|"illustration"|"schema"` (`image-bank-import-worker.ts:30`), valeurs envoyées par l'API `"photo"|"illustration"` (`import/route.ts:212`), valeurs du seed `"imported"|"original"` (`seed-images.cjs:230`). Aucune validation ne rougit.
  - **Variant OG orphelin** : `image-import.service.ts:128-138` produit un `og.webp` 1200×630 (coût CPU) et `types.ts:22` l'expose… mais `schema.prisma` n'a **aucune** colonne `ogPath` (grep = 0) et `upload.action.ts:118-141` ne le stocke pas → généré puis perdu.
  - **Double enfilement** : `imageBankService.create()` enfile déjà un job d'enrichissement (`image-bank.service.ts:123-130`) et `uploadImageAction` en enfile un second (`upload.action.ts:155`) → 2 appels Claude Vision par upload.
- **Patch prescrit** : année dynamique ; un seul `sourceType` (enum Zod partagé + migration de normalisation) ; ajouter `ogPath` en base **ou** supprimer la génération OG ; supprimer l'un des deux `enqueueImageBankEnrich`.
- **Effort** : S chacun. **Impact GEO/AEO** : faible. **Risque de régression** : faible ; la normalisation `sourceType` doit être faite en lecture (fallback) avant d'être faite en écriture.

## Mesures brutes

### Prod — requêtes HTTP (2026-08-14, UTC)

| Heure | URL | Statut | Observation |
|---|---|---|---|
| 19:30:54 | `/fr/galerie` | 200 | 1 246 996 o ; 24 images page 1 ; **0** occurrence `/image-bank/` ; **0** LQIP base64 |
| 19:30:54 | `/images/…veille-concurrentielle…-banniere.webp` | 200 | 142 354 o, `image/webp` |
| 19:30:54 | `/images/…veille-concurrentielle…-banniere.avif` | 200 | 94 674 o, `image/avif` |
| 19:30:54 | `/images/…veille-concurrentielle…-banniere-thumb.webp` | 200 | 17 926 o |
| 19:30:54 | `/images/…veille-concurrentielle…-banniere-og.webp` | **404** | variant `-og` inexistant sur tout le corpus |
| 19:31:11 | `/images/…metro-gagner-temps…-affiche-thumb.webp` | **404** | 1 des 75 vignettes manquantes |
| 19:31:11 | `/images/…methode-5-etapes…-infographie-thumb.webp` | **404** | idem |
| 19:31:39 | `/fr/galerie/axion-ia-audit-entreprise-metro-…-affiche` | 200 | `<title>` « Audit IA en Entreprise — **490 €** … » ; JSON-LD `width 1080 × height 1920` ; `thumbnailUrl` = URL 404 ; `acquireLicensePage` = URL de la page (correct) |
| 19:32:14 | fichier prod téléchargé → `sharp().metadata()` | — | `exif: NONE, xmp: NONE, iptc: NONE` |
| 19:35:59 | `/fr/galerie/…veille-concurrentielle…-banniere` | 200 | `alt` DOM = « Axion-IA — Veille Concurrentielle 847 Sources 12 Signaux IA Banniere » ; `description` riche |
| 19:36:16 | `/sitemaps/images-fr.xml` | 200 | 310 501 o ; 288 `<image:loc>` ; 288 captions ; 0 thumbnail listé |
| 19:37:31 | `/fr/galerie/…-banniere/telecharger` (HEAD) | 200 | `image/webp`, `no-store`, `attachment; filename="…-lg.webp"` |

### Corpus — analyses locales (fichiers du dépôt = fichiers servis)

| Mesure | Valeur |
|---|---|
| Fichiers dans `public/images` | 806 |
| Images de base `.webp` (hors `-thumb`) | 291 |
| `.avif` | 289 |
| `-thumb.webp` | 216 → **75 manquants** |
| `-og.webp` / `-square.webp` / `-md.webp` / `-sm.webp` | **0 / 0 / 0 / 0** |
| Fichiers portant EXIF / XMP / IPTC (échantillon 4, dont 1 prod) | **0** |
| Images typées comparables au seed | 160 |
| … dont dimensions DB ≠ dimensions réelles | **78** |
| … dont orientation inversée | **14** |

### Sitemap images FR — qualité des libellés (19:36 UTC)

| Mesure | Valeur |
|---|---|
| Blocs `<image:image>` | 288 |
| `<image:title>` == `Axion-IA — TitleCase(slug)` | **288 / 288** |
| `<image:caption>` == `<label module> — TitleCase(slug)` | **133 / 288** (exactement les 133 entrées de `seed-images.cjs`) |
| Captions < 80 caractères (`CAPTION_LENGTH_MIN`) | 83 |
| Captions contenant `€` | 4, dont **2 avec « 490 € »** |

### Pipeline — état des exécutions

| Élément | État (19:37-19:39 UTC) |
|---|---|
| `image-bank-seed.yml` | 24 runs, **tous `workflow_dispatch`**, **0 `workflow_run`**, dernier le **2026-05-21 09:21 UTC** ; workflow `state: active` |
| Deploys du jour | atterri 18:26 UTC ; run suivant parti 18:54 UTC, `in_progress` à 19:30 UTC |
| `pnpm image-bank:isolation-check` | **18 violations** (exit 1) — non exécuté par la CI ni les hooks |
| Workers image-bank démarrés | 5 (`worker.ts:124-128`) ; **2 sans producteur** (`-convert`, `-crons`) |
| `src/lib/image-utils.ts` | 6 fonctions exportées, **0 appelant externe** |

## Limites

- **Aucune lecture de la DB prod** : mon rôle n'y donne pas accès (réservé à A3/B6/D1/D5/D8/F7). Les volumes exacts (`image_usage_logs`, `seoScore` moyen, nombre de lignes avec `metaTitle`, images `isActive=false`) restent à confirmer ; j'ai systématiquement déduit l'état DB depuis le rendu public (sitemap + JSON-LD + HTML), qui en est le miroir fidèle.
- **La cause exacte du non-déclenchement de `workflow_run`** sur `image-bank-seed.yml` (0 run automatique en ~3 mois alors que le `name:` du workflow déclencheur correspond exactement) n'a pas pu être établie — cela demanderait de lire les logs d'événements GitHub côté organisation. Le fait est mesuré ; l'explication est **[À CONFIRMER]**.
- **Le chemin d'upload admin n'a pas été exercé** (interdiction de POST en prod, pas de `next dev`) : les 4 défauts de ce chemin sont prouvés par le code et par l'absence totale d'images UUID en prod, pas par un essai réel.
- **Le rendu du watermark** (police Manrope dans le container, lisibilité, position) n'a pas été observé : `watermarkEnabled` vaut `false` pour toutes les images seedées (`seed-images.cjs:257`), donc aucune image prod ne déclenche le composite Sharp.
- **Le backfill EXIF proposé n'a pas été chiffré finement** : je n'ai pas ré-encodé de fichier (interdiction de toucher au dépôt hors `_AUDIT/`), l'estimation de poids ajouté (< 1 KB) vient de la spécification EXIF, pas d'une mesure.
- **Sujets délibérément non traités** car couverts ailleurs : qualité visuelle et claims incrustés dans les images (E3), alt-texts du manifeste `page-images.ts` et graphes ImageObject des pages marketing (E2), présence des sitemaps images dans l'index et dans GSC (A4/E4), `Organization` divergente des pages galerie (E2, confirmée sans être recomptée).
