# Images du blog : qualité, zéro doublon, pertinence

## But

Les articles du blog générés reçoivent des photos Unsplash (Unsplash UNIQUEMENT, aucune image IA, attribution du photographe conservée). Cette PR garantit :

- **aucun doublon** : une photo (image principale ou corps, article publié ou en attente) n'est jamais reprise, ni deux fois dans un même article, repli générique compris ;
- **qualité** : 20 résultats par recherche ; photos < 1 600 px, non paysage, ou dont la description évoque capture d'écran / texte / logo / maquette écartées ; à pertinence égale, la plus aimée ;
- **pertinence** : note de correspondance entre description/tags de la photo et le sujet (requête traduite en anglais par un petit dictionnaire, sans appel au modèle de langue : 0 coût). Rien de pertinent et d'inutilisé → image principale en attente (`hero_image_pending`, comportement existant), image du corps omise ;
- **rattrapage** : rapport en lecture seule des articles publiés en doublon sur la page console « Photos hero Unsplash », et bouton « Remplacer » par article (chemin `hero-backfill`, un seul article à la fois, aucun remplacement en masse).

Interrupteur `CONTENT_IMAGES_QUALITE` : actif par défaut ; seule la valeur exacte `"false"` rétablit l'ancien comportement.

## Détection des doublons SANS migration

L'identifiant d'API n'est stocké nulle part ; la clé commune est `photo-<ts>-<hash>` lue dans l'URL `images.unsplash.com` de `Article.featuredImage` et du HTML de `ArticleTranslation.body` (extraction côté base par regex, seules les clés sont rapatriées). Les photos choisies mais pas encore enregistrées sont réservées dans Redis (7 j). Base illisible → pas de photo (en attente) plutôt qu'un doublon ; Redis indisponible → la base fait foi.

## Fichiers

- `src/server/content-gen/images/photo-quality.ts` (nouveau, règles pures), `used-photos.ts` (mémoire des doublons), `duplicate-report.ts` (rapport)
- `providers/unsplash.ts` : `findQualityUnsplashPhoto` (1 appel, 20 résultats)
- `select-hero-image.ts`, `inject-body-images.ts`, `backfill-hero.ts` (option `articleIds`)
- `actions/content-gen/hero-backfill.ts` : `reportDuplicateImages`, `replaceDuplicateHero` (admin)
- page console `hero-images` + `_v2/ImageDuplicatesReport.tsx`
- ⚠️ `content-publish-worker.ts` : 1 ligne (passe l'URL de l'image principale au corps). `content-gen-worker.ts` NON modifié.

## Tests

`photo-quality.spec.ts`, `unsplash-quality.spec.ts` (photo déjà utilisée, doublon dans un article, repli générique, petite/portrait/capture, hors sujet → rien, attribution, interrupteur "false"), `duplicate-report.spec.ts` (rapport et remplacement réservés aux admins). Les anciennes specs hero/corps tournent avec l'interrupteur à "false".

## Risques

- Plus strict : davantage d'images principales « en attente » si les descriptions Unsplash sont pauvres (volontaire). Seuil réglable : `MIN_RELEVANCE`.
- Quota Unsplash : au plus 3 recherches par hero, 2 par image de corps (inchangé en ordre de grandeur).
- La requête générique est notée sur ses propres mots (photo « IA/business » valide), avec le même anti-doublon.
- « Admin » = garde existante `requireAdmin` (admin, super_admin, editor).

## Relecture Opus

Tour 1 : « À CORRIGER » (l'aperçu dry-run réservait des photos ; réservation Redis sans expiration réelle ; « real estate » jamais reconnu ; tests manquants). Tout a été corrigé : dry-run sans réservation, une clé Redis par photo avec TTL 7 j, termes multi-mots, tests ajoutés (dry-run, réservation Redis, `articleIds`, `premium_photo-`). Restent mineurs et assumés : une photo reste réservée si l'attribution manque (cas rare) ; la page article reste en cache ISR jusqu'à 1 h après un remplacement (comme le rattrapage existant). Le test `kb-ingest/url-extractor.spec.ts` échoue déjà sur `main` (sans lien).

VERDICT OPUS : BON
