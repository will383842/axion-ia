# E3 — Qualité visuelle & compliance

Date : 2026-08-14, mesures live 18:25–18:32 UTC (déploiement en vol parti 17:33 UTC — aucune de mes surfaces n'est DB-vide-dépendante au moment des mesures, toutes les pages testées ont répondu 200 avec contenu).

Périmètre réellement couvert : galerie publique (`/fr/galerie` hub + détail + route `telecharger`), hero images villes (`/villes-hero/*` + sitemaps images villes T1/T2/T3-T4), `inject-body-images.ts` + `select-hero-image.ts` + provider Unsplash, doctrine `UNSPLASH-COMPLIANCE.md` vs code, inspection visuelle de 15 photos locales + 2 photos Unsplash servies en prod.

## Résumé exécutif

La banque d'images est de **haute qualité visuelle** (15/15 photos inspectées : nettes, sur-charte terracotta/ivoire, zéro N&B/délavé) et la conformité Unsplash de fond (filtre premium, trigger download CGU §6, attribution UTM, hotlink) est **réellement câblée et vérifiée en prod**. Trois vrais problèmes : (1) des **garanties de résultat incrustées dans des visuels publiés** (« GAINS MESURABLES ASSURÉS », « 100 % GAGNANT ») qui réintroduisent en image ce que la purge #580/#588 a retiré des textes ; (2) les **héros Unsplash des articles content-gen sont parfois hors-sujet avec des alt en anglais** (piège connu confirmé sur pièce) ; (3) les **sitemaps images villes déclarent une bannière générique absente des pages**, alors que 58 villes ont un hero dédié jamais déclaré. Le reste est du polish (double UTM, gates de doctrine non outillées, « 1 TO 1 » anglais dans 2 visuels).

## Findings

### [P1] Garanties de résultat incrustées dans des visuels publiés (« GAINS MESURABLES ASSURÉS », « 100 % GAGNANT »)

- **Symptôme** : l'affiche `axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche` porte en toutes lettres « GAINS MESURABLES **ASSURÉS** » ; les 58+ héros villes (`public/villes-hero/*.jpg|webp|avif`, template commun) portent « **100 % GAGNANT** ». Or les garanties de résultat ont été **purgées des textes** (décision actée n°8 : CGV = obligation de MOYENS, purge #580+#588). La purge par regex ne voit pas le texte incrusté dans les images — ces claims survivent donc en prod, sur des pages indexables, et sont lisibles par les moteurs IA multimodaux.
- **Preuve code** : `scripts/seed-images.cjs:69` (seed de l'affiche métro dans l'image-bank publique) ; `src/content/villes/hero-images-map.ts:10-70` (58 villes servies avec le template « 100 % GAGNANT ») ; rendu via `src/app/[locale]/implantations/[region]/[ville]/page.tsx:526-529`.
- **Preuve live** : inspection visuelle des fichiers locaux (Read images, 18:28-18:30 UTC) — `public/images/axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche.webp` (« GAINS MESURABLES ASSURÉS » + « $ » au lieu de « € ») ; `public/villes-hero/{grenoble,paris,lille,marseille,saint-marcellin}.jpg` (« 100 % GAGNANT » sur les 5/5). Page galerie de l'affiche : `GET /fr/galerie/axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche` → **200** (18:29:57 UTC).
- **Root-cause** : les visuels ont été générés avant la purge des garanties ; l'audit de purge a balayé les surfaces texte, pas le texte-dans-image.
- **Patch prescrit** : (a) retoucher/régénérer l'affiche métro (« gains mesurables » sans « assurés », « € ») ou la dépublier de la galerie (`isActive=false`) ; (b) pour les 58 héros villes, retoucher le cartouche bas (« 100 % gagnant » → ex. « Moins de complexité, plus de performance » seul) lors d'une prochaine régénération batch — ce n'est pas une urgence juridique (slogan marketing, pas une clause), mais c'est la même famille de risque que la purge.
- **Effort** : S (affiche seule) / M (batch 58 villes). **Impact GEO/AEO** : moyen (cohérence claims cross-surface, risque si un moteur IA cite l'image). **Risque de régression** : nul si retouche visuelle seule ; do-not-touch : `hero-images-map.ts` (le set de slugs), noms de fichiers (référencés par la galerie et les pages).

### [P1] Héros Unsplash hors-sujet + alt ANGLAIS sur les articles content-gen

- **Symptôme** : l'article `/fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` a pour image héro une photo de **pieds sur un trottoir devant « CITÉ MÉMOIRE »** (installation artistique à Montréal) — zéro rapport avec « mentor IA dirigeant ». Son alt est `alt="a person standing on a sidewalk next to a yellow sign"` — **en anglais**, sur un site français uniquement, et décrivant la photo au lieu du sujet. Idem corps d'article (`alt="green grass field near brown mountain under blue sky during daytime"`). C'est exactement le piège connu (l'API Unsplash ne garantit ni la pertinence ni la langue) — confirmé sur pièce.
- **Preuve code** : `src/server/content-gen/providers/unsplash.ts:354` (`altText = chosen.alt_description || chosen.description || query` → alt anglais brut d'Unsplash prioritaire) ; `src/server/content-gen/images/select-hero-image.ts:118` (`alt: selected.alt || query`) ; `src/server/content-gen/images/inject-body-images.ts:122` (`photo.alt`).
- **Preuve live** (18:26:44–18:30:20 UTC) : HTML de l'article (curl) → les 2 alt anglais ci-dessus ; téléchargement des 2 photos servies (`photo-1575350555350` héro « Cité Mémoire », `photo-1582127358359` paysage d'Auvergne) et inspection visuelle : héro hors-sujet, image de corps passable (évoque la région, pas le sujet).
- **Root-cause** : la cascade de requêtes (spécifique → 2 tokens → générique) garantit UNE photo mais pas une photo PERTINENTE ; et l'alt privilégie la description Unsplash (anglaise, littérale) au lieu du contexte éditorial français disponible (title/primaryKeyword/H2).
- **Patch prescrit** : dans `unsplash.ts` (et/ou aux 2 call-sites), inverser la priorité de l'alt : construire un alt français à partir du contexte (`query`/`primaryKeyword`/titre H2) et ne garder l'alt Unsplash qu'en fallback technique. Optionnel (M) : score de pertinence minimal (rejeter la photo si le matching Unsplash vient de la requête générique ET que le sujet est spécifique ; loguer `hero_image_pending` plutôt que publier un hors-sujet).
- **Effort** : S (alt) / M (pertinence). **Impact GEO/AEO** : fort (alt = signal Google Images + accessibilité + citabilité ; un héro absurde dégrade la crédibilité E-E-A-T de tout l'article). **Risque de régression** : faible — best-effort strict conservé ; do-not-touch : le contrat « la publication n'est JAMAIS bloquée » (inject-body-images.ts:18-20), l'ordre injection-après-détection-citations (`content-publish-worker.ts:643-652`).

### [P1] Sitemaps images villes : l'image déclarée n'est PAS celle rendue (et les 58 vrais héros ne sont déclarés nulle part pour les pages villes)

- **Symptôme** : les 3 sitemaps images villes (~450+ URLs live : 40 T1 + T2 + 357 T3-T4) déclarent pour CHAQUE ville la même bannière générique (`axion-ia-formation-acculturation-…-banniere.webp` ou variante T4), qui n'apparaît **pas** dans le HTML des pages `/fr/implantations/{region}/{ville}`. Ces pages rendent en réalité soit `/villes-hero/{slug}.avif` (58 villes, visuels dédiés de qualité), soit le triangle universel — et le JSON-LD `#hero-image` de la page déclare la bonne image. Signal incohérent pour Google Images : le sitemap pointe une image hors-page, et les 58 visuels dédiés (le vrai capital « Google Images local ») ne sont couverts par aucun sitemap pour ces URLs.
- **Preuve code** : `src/server/image-bank/utils/villes-sitemap.ts:17-20` (`GENERIC_SLUG_T3/T4`), `:48` (`imgUrl` générique) ; `src/app/sitemap-images-villes-t1.xml/route.ts:31-34` (`() => GENERIC_SLUG_T3`) ; vs `src/app/[locale]/implantations/[region]/[ville]/page.tsx:526-529` (rendu réel `/villes-hero/{slug}.avif` si `hasVilleHeroImage`) et `:548-558` (JSON-LD ImageObject sur la vraie image). `grep villes-hero src/app` → seul le page.tsx la référence, aucun sitemap.
- **Preuve live** (18:25:54–18:26:16 UTC) : `/fr/implantations/auvergne-rhone-alpes/grenoble` → 200, contient `villes-hero/grenoble.avif`, **0** occurrence de la bannière générique ; `sitemap-images-villes-t1.xml` → bloc Grenoble déclare la bannière générique ; `/villes-hero/grenoble.avif` → 200 (205 588 o) ; `sitemaps/images-fr.xml` → 0 occurrence `villes-hero` (les visuels `hero-ville-*.webp` de la GALERIE y sont, mais rattachés aux pages `/fr/galerie/*`, pas aux pages villes).
- **Root-cause** : le fix 404 de 2026-06-20 (commentaire t1 route.ts:3-10) a remplacé un pattern inexistant par une bannière générique « réelle » — correct à l'époque, mais jamais réaligné après l'arrivée des heroes dédiés du 2026-05-27 (`hero-images-map.ts`).
- **Patch prescrit** : dans `buildVillesSitemapXml`, passer un `getImageSlug` conscient de `hasVilleHeroImage` : custom → `https://axion-ia.com/villes-hero/{slug}.avif` (le fichier rendu, crawlable), sinon → le triangle universel réellement rendu (`axion-ia-ville-hero-triangle-3-piliers-temps-couts-resultats-carre.avif`) plutôt que la bannière hors-page. (L'« optimisation future » esquissée dans le commentaire de t1 route.ts:8-9 — c'est exactement ça.)
- **Effort** : S. **Impact GEO/AEO** : moyen-fort (cohérence sitemap/DOM/JSON-LD = condition de l'indexation Google Images locale sur ~2 150 pages). **Risque de régression** : faible ; do-not-touch : `GENERIC_SLUG_*` exportés (référencés par les 3 routes), URL des pages (`/fr/implantations/...`), le gate drip `isVilleIndexable`.

### [P2] Crédit photographe héros : UTM dupliqué → URL malformée

- **Symptôme** : le lien photographe du crédit héros rend `https://unsplash.com/@patrick63140?utm_source=axion-ia&utm_medium=referral**?**utm_source=axion-ia&utm_medium=referral` (deux `?`). Le lien fonctionne mais le tracking referral Unsplash (exigé par l'esprit des CGU API §9) est pollué (`utm_medium=referral?utm_source=…`).
- **Preuve code** : `src/server/content-gen/providers/unsplash.ts:284` stocke `photographerUrl` DÉJÀ suffixé UTM ; `src/components/media/UnsplashCredit.tsx:15-17` re-suffixe `?utm_source=…` sans vérifier. (Les figcaption du corps — `inject-body-images.ts:130` — utilisent l'URL stockée telle quelle : correctes.)
- **Preuve live** : HTML de l'article blog (18:27:29 UTC) — les deux formes coexistent : corps OK, héros malformé.
- **Root-cause** : double responsabilité de l'ajout UTM (provider ET composant).
- **Patch prescrit** : dans `UnsplashCredit.tsx`, n'ajouter l'UTM que si `!photographerUrl.includes("utm_source=")` (ou utiliser `new URL()` + `searchParams.set`).
- **Effort** : S. **Impact GEO/AEO** : faible. **Risque de régression** : nul ; do-not-touch : `unsplash.ts` (l'URL persistée en base est déjà UTM-isée pour les anciens articles).

### [P2] Doctrine UNSPLASH-COMPLIANCE : les gates automatiques promis n'existent pas

- **Symptôme** : la doctrine v3 (§ « Gates de conformité automatiques ») exige un `pnpm content-gen:html-audit` (vérif figcaption, UTM, premium, download trigger, disclaimer sensible) et un audit trail `ContentMetric.imageMetadata`. Aucun des deux n'existe : pas de script `html-audit` dans `package.json:61-70`, pas de champ `imageMetadata` dans `prisma/schema.prisma` (seulement un commentaire « V2 ajoutera » dans `image-optimizer.ts:50`), pas de mécanisme `SensitiveTopic`/disclaimer. Le rate-limit est resté in-memory par process (`unsplash.ts:109-131` — « Day 5 : passer à Redis ») : web + worker + N process peuvent cumuler > 50 req/h (mitigé : le 429 amont est géré et best-effort).
- **Preuve code** : `docs/content-gen/UNSPLASH-COMPLIANCE.md:170-201` (spec) vs `package.json`, `prisma/schema.prisma` (grep `imageMetadata` = 0), `unsplash.ts:112` (`inMemoryRateBuckets`).
- **Preuve live** : la conformité DE FOND est néanmoins observée en prod (18:26:44 UTC) : attribution photographe + UTM présents sur l'article testé ; filtre premium et trigger download présents au code (`unsplash.ts:155-169, 265-276, 351`). Le manque est l'OUTILLAGE de vérification, pas la conformité elle-même.
- **Root-cause** : Sprint 1 Day 4-5 jamais soldé ; l'attribution a été portée par le schéma Article (`schema.prisma:1228-1229`) au lieu de `ContentMetric.imageMetadata`.
- **Patch prescrit** : soit implémenter un check minimal (script statique : tout article publié avec `featuredImage` unsplash doit avoir `featuredImagePhotographerName` non-null — 20 lignes), soit **mettre à jour la doctrine** pour acter l'implémentation réelle (audit trail = colonnes Article, gates = revue humaine). Le désalignement doc/code est le vrai risque (un futur audit croira les gates actives).
- **Effort** : S. **Impact GEO/AEO** : faible (juridique/process, pas visibilité). **Risque de régression** : nul.

### [P2] Anglais et défauts résiduels dans certains visuels (« 1 TO 1 », bandeau tronqué, « $ »)

- **Symptôme** : sur un site français uniquement, des visuels publiés portent du texte anglais généré : « **1 TO 1** » (roue Dunkerque `public/images/axion-ia-hero-ville-dunkerque-consultant-ia-formation-pme.webp`, infographie Montélimar `public/villes-hero/montelimar.jpg`) ; le bandeau inférieur de Montélimar est **tronqué au cadrage** (« COMPÉTENCES | PERFORMANCE | … » coupé) ; l'affiche métro utilise « **$** » au lieu de « € ».
- **Preuve code** : fichiers cités (servis via galerie + pages implantations) ; `hero-images-map.ts:40` (montelimar dans le set → rendu sur la page ville).
- **Preuve live** : inspection visuelle Read (18:28-18:30 UTC) des 3 fichiers ; les pages porteuses répondent 200.
- **Root-cause** : artefacts de génération d'image non repassés en revue.
- **Patch prescrit** : liste de retouche pour la prochaine passe visuelle (Will ou batch régénération) : « 1 à 1 », recadrage Montélimar, « € ». Aucun changement de code.
- **Effort** : S (par visuel). **Impact GEO/AEO** : faible. **Risque** : nul.

### [P2] Route `telecharger` : le watermark est neutralisable par paramètre public et JAMAIS appliqué en JPEG

- **Symptôme** : `?watermark=false` (paramètre public, non authentifié) désactive le watermark ; et le chemin `?format=jpeg` (celui du bouton principal « Télécharger JPG » de la page détail) convertit depuis le buffer NON watermarké même quand `image.watermarkEnabled` est vrai — le watermark n'existe donc de facto que pour le WebP sans paramètres.
- **Preuve code** : `src/app/[locale]/galerie/[slug]/telecharger/route.ts:41` (`withWatermark = url.searchParams.get("watermark") !== "false"`), `:113` (skip si `format === "jpeg"`), `:126` (JPEG depuis `buffer` originel) ; bouton JPG : `src/app/[locale]/galerie/[slug]/page.tsx:196,403`.
- **Preuve live** : `HEAD …/telecharger?format=jpeg` → 200 `image/jpeg` (18:27:40 UTC).
- **Root-cause** : licence CC BY 4.0 assumée (réutilisation libre avec crédit) → le watermark est probablement décoratif par conception ; mais alors le flag `watermarkEnabled` en base ment.
- **Patch prescrit** : décision produit : soit appliquer le watermark AVANT la conversion JPEG et retirer le paramètre public `watermark`, soit acter que le watermark est cosmétique (et le documenter). Pas d'urgence : cohérent avec CC BY.
- **Effort** : S. **Impact GEO/AEO** : nul (compliance interne). **Risque** : faible ; do-not-touch : rate-limit et tracking RGPD ip-hash de la route (corrects).

## Points vérifiés SAINS (anti-faux-positifs)

- **Qualité visuelle du parc local : très bonne.** 15 visuels inspectés à l'œil : piqué, charte Editorial Premium (terracotta #c24a1b / ivoire), lisibilité typographique, zéro photo N&B ou délavée dans la banque. Le piège « Unsplash délavé » ne frappe PAS l'image-bank (visuels générés maîtrisés), il frappe les héros d'articles (cf. P1 n°2).
- **Compliance Unsplash de fond opérationnelle** : filtre premium/tier (`unsplash.ts:155-169`), trigger download CGU §6 (`:265-276, 351`), attribution photographe rendue (héro `UnsplashCredit` + figcaption corps, prouvé live), hotlink `images.unsplash.com` (recommandé CGU), anti-doublon inter-articles (sorted set Redis 30 j, `:198-258`), `content_filter=high`.
- **Galerie publique conforme** : badge + licence CC BY 4.0 cliquable, bloc attribution copiable, © Axion-IA (aucun visuel Unsplash relabellisé CC BY : `grep unsplash scripts/seed-images.cjs` = 0), garde anti-thin `noindex` tant que description/aiSummary < 100 car. (`[slug]/page.tsx:122-144`), canonique FR + gating EN aligné sur la doctrine.
- **Chiffre avis** : le visuel Paris affiche « Satisfaction client 4,8/5 » — cohérent avec la base vérifiée (77 avis, 4,88/5, arrondi bas) : PAS un mensonge.
- **Ordre injection images/citations respecté** (`content-publish-worker.ts:643-652` : injection après lecture du body brut, les liens d'attribution ne polluent pas la détection de citations).
- **Fichiers génériques des sitemaps villes tous en 200** (pas de 404 régressif).

## Mesures brutes

| URL / fichier | Vérif | Résultat | Heure UTC |
|---|---|---|---|
| `GET /fr/galerie` | status + volume | 200, « 288 images libres », 0,50 s | 18:25:17–39 |
| `GET /fr/galerie/axion-ia-hero-ville-paris-…` | détail + JSON-LD | 200, contentUrl cohérents, 33× « CC BY 4.0 » | 18:25:50 |
| `GET /images/axion-ia-formation-acculturation-…banniere.webp` | bannière générique T1-T3 | 200, 169 488 o | 18:25:17 |
| `GET /sitemap-images-villes-t1.xml` | contenu | 200, 40 `<url>`, 1 seule image générique pour toutes | 18:26:04 |
| `GET /sitemap-images-villes-t3-t4.xml` | volume | 200, 357 `<url>` | 18:31:37 |
| `GET /sitemaps/images-fr.xml` | couverture | 200, 289 `<url>`, 0 `villes-hero` | 18:26:16 |
| `GET /fr/implantations/auvergne-rhone-alpes/grenoble` | hero rendu | 200, `villes-hero/grenoble.avif` présent, bannière générique ABSENTE | 18:25:54 |
| `GET /villes-hero/grenoble.avif` | asset | 200, 205 588 o | 18:31:01 |
| `GET /fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` | attribution + alt | 200, 3× utm, figcaption OK, héros double-UTM, 2 alt ANGLAIS | 18:26:44–18:27:29 |
| `GET /fr/galerie/axion-ia-audit-entreprise-metro-…-affiche` | page du visuel « assurés » | 200 | 18:29:57 |
| `HEAD /fr/galerie/…/telecharger?format=jpeg` | download | 200 image/jpeg, no-store, X-Robots noindex | 18:27:40 |
| 15 visuels locaux (8 `public/images`, 5 `public/villes-hero`, 2 Unsplash prod) | inspection œil | qualité haute ; défauts listés en P1/P2 | 18:28–18:30 |

Visuels inspectés : 5-heures-saisie (bannière), automatisation-avant-après (carré), consultant-paris, formation-moins-stress, hero-ville-dunkerque, photo-formateur, traitement-réclamations, accueil-client-vip, atelier-pratique, audit-entreprise-métro (affiche), accompagnement-dirigeant, villes-hero {grenoble, paris, saint-marcellin, marseille, montelimar, lille}, Unsplash {photo-1575350555350 héro, photo-1582127358359 corps}.

## Limites

- **DB prod interdite pour E3** : je n'ai pas pu compter les articles avec `featuredImagePhotographerName` null (volume du problème « héro pending/hors-sujet ») ni lister les 288 assets publiés — l'échantillon visuel est de 15 fichiers + 1 article live.
- **AVIF non rendu par l'outil de lecture** : le triangle universel (`…triangle-3-piliers…carre.avif`, rendu sur ~2 000 pages villes sans hero custom) n'a pas pu être inspecté à l'œil (son équivalent stylistique villes-hero l'a été).
- **Pertinence Unsplash mesurée sur 1 article** (2 photos) : le taux de héros hors-sujet sur l'ensemble du blog n'est pas quantifié (nécessiterait la DB ou un crawl volumineux, exclu en machine partagée).
- **Déploiement en vol** (atterrissage estimé 18:30–19:00 UTC) : mes mesures se terminent à 18:32 ; toutes étaient des 200 avec contenu attendu, aucun symptôme de fenêtre ISR vide observé.
- Les scripts `curate-*-unsplash.mjs` visibles uniquement dans le worktree `.claude/worktrees/cal-grid` (non mergés) n'ont pas été audités (règle : auditer `main` + prod).
