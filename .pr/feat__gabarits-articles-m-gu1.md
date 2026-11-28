Gabarit « Guide pilier » des articles : habillage de /guides/[slug] (derrière l'interrupteur éteint)

## Base de la PR

**Base : `main`.** La branche part de `feat/gabarits-articles-s2-composants` (briques S2, verdict « BON ») et y a fusionné `origin/main`. Tant que S1 et S2 ne sont pas sur `main`, le diff affiche aussi leurs commits : le travail propre à cette PR tient dans les commits `feat(blog): gabarit guide pilier…` et `fix(blog): gabarit guide pilier…`.

⚠️ **Fusion avec la PR sœur M-A1 (actualités)** : les deux PR partent de S2 et modifient les mêmes briques partagées. `PhotoArticle`, `HerosArticle` et `CtaMilieu` sont alignés sur la version de M-A1 (seuls ajouts propres à cette PR : `HerosArticle.publieLisible` et `CtaMilieu.lienSecondaire`). Le second merge produira des conflits **triviaux** (union `GabaritPage` et entrée de `photos-repli.ts`, `types.ts`, `messages-gabarits.ts`, `article-v2-garde-fous.spec.ts`, exception d'isolation) : garder les deux côtés.

## Ce que fait la PR

Habille la page autonome `/guides/[slug]` selon la fiche GU1 de `DECOUPAGE.md` (maquette v3 `guide-pilier.html`), derrière `BLOG_GABARITS_V2="true"` (éteint par défaut). Interrupteur coupé : le JSX V1 est inchangé, `generateMetadata`, `HowTo`/`Article` + `Person`, et l'URL aussi.

- **Une seule insertion dans `page.tsx`** (import de l'interrupteur + un bloc `if (gabaritsV2Actifs())` avant le `return` V1, import dynamique du gabarit).
- **`GabaritGuidePilier`** : héros terracotta avec **auteur et dates visibles en tête** (écart E-E-A-T corrigé), signe = nombre de chapitres, photo (article ou repli `guide-pilier`, ratio 16/10, jamais un SVG), « En bref » (la réponse rapide du guide), **sommaire en grille de chapitres** avec progression et durée, **bandeaux de chapitre** mocha / terracotta en alternance (« Chapitre n sur N », durée, temps restant, barre de progression décor, « Aller au chapitre suivant » avec le numéro masqué visuellement, « Revenir au sommaire »), **feuille de route finale** (titres des chapitres), FAQ, sources, carte auteur, termes du glossaire, capture e-mail existante (`guides-fin-article`, la seule), appel de fin. `<article>` englobe tout cela ; un seul `aside.action` (`depuis=guide-pilier-colonne`) après `</article>`.
- **Chapitres = étapes structurées existantes** (`parseStepsFromBody`) ; ids `step-N` conservés (ceux de la V1 et du sommaire) même si la numérotation du texte saute ou se répète : le numéro affiché, l'alternance et l'avancement suivent le **rang**. Durées estimées sur le texte de chaque étape (200 mots/min). **Rien n'est inventé** : sans étapes (corps libre), pas de chapitres ni de feuille de route ni de sommaire.
- **Deux encarts du milieu** : « Diagnostic IA, 45 min » (lien « Le guide IA entreprise, 40 pages » vers `/guide-ia`), puis Journée IA en terracotta (lien « Écrire un message »). Avec moins de 4 chapitres, un seul encart.
- Pas d'encart vidéo (`/guides` n'est pas page hôte, PR E6). Les articles liés restent codés en `/blog/` comme en V1 (correction réservée à la décision du propriétaire, cf. fiche GU1).
- Variantes par prop, défauts inchangés pour les huit gabarits du blog : `ArticleTOC` v2 (`id`, `total`, `TocItem.detail`/`progression`), `HerosArticle` (surtitre, signe, dates déjà formatées, temps de lecture absent), `CtaMilieu` (`secondaire`, `lienSecondaire`, `titre`, `texte`), type `GabaritPage`.
- CSS `src/styles/article-v2/guide-pilier.css` (bornée à `[data-gabarit="guide-pilier"]`, mobile d'abord, jetons du site, aucun hexadécimal ; règles `.v-*` de la maquette non reprises), messages `guide-pilier.{fr,en}.json` (typographie française, aucun mot interdit). Le gabarit importe lui-même socle, compléments puis sa feuille.

## Tests

- Nouveau `tests/unit/blog/gabarit-guide-pilier.spec.tsx` (≈ 30 tests) : structure (un h1, ni `<main>` ni en-tête de site, `<article>` englobant, un seul `aside.action`), auteur et dates dans le héros, deux-points du titre conservé, 7 chapitres (ids, alternance, durées), positions non contiguës, 2 / 3 / 7 chapitres, corps libre, photo article / repli, deux encarts, feuille de route, une seule mention « Mis à jour », `ArticleTOC` v2 (sans options : rendu identique), aiguillage de la page (garde unique, V1 intacte, `generateMetadata` indépendant, JSON-LD de la V1, comparaison des dates au jour), ordre des feuilles, mots interdits.
- Verrous S2 ajustés : liste des messages (`+ guide-pilier`) et clés de `PHOTOS_REPLI` ; exception nominative de `content-gen:isolation-check` pour le fichier de test.
- Verts en local : `tests/unit/blog` + `tests/unit/seo` (401 tests), `pnpm typecheck`, `content-gen:isolation-check`, `image-bank:isolation-check`, `i18n:check`, `anti-hex:check`, `use-client:check`, `radius:check`, eslint (0 erreur, 1 avertissement d'import de type dans le test, comme en S2), prettier.
- **Non fait** : axe 1280/320 px et vérification visuelle dans un navigateur (reportés à T1), mesures de temps (LCP/INP/TBT).

## Mesures (`next build --webpack --experimental-build-mode compile`, route `/fr/guides/[slug]`)

- JS client de la route (modules du manifeste client, gzip -9) : **123,6 Ko, identique à `/fr/actualites/[slug]` non modifiée** : **aucun JavaScript client ajouté**. ⚠️ Ce n'est pas le « First Load JS ≤ 75 Ko » de l'AGENTS.md (dette du socle ≈ 250 Ko, hors périmètre, non aggravée) ; la valeur absolue n'est pas lisible en mode compile, le delta l'est.
- CSS de la route : 41,1 Ko gz (route de référence sans gabarit) → **53,0 Ko gz** (+11,9 Ko, cible ≤ +12 Ko). ⚠️ **Chargée même interrupteur éteint** (webpack rattache la feuille d'un `import()` à la route) : sans effet visuel (tout est borné à `[data-gabarit]`), mais le « HTML identique interrupteur coupé » ne tient qu'au balisage, pas aux `<link rel="stylesheet">`.

## Points restants (non bloquants)

1. Axe, revue visuelle, mesures de temps (T1) ; durées de chapitre presque toujours « ≈ 1 min » (le texte des étapes est court) ; le total affiché diffère de `HowTo.totalTime` (renvoyé à J1).
2. Les sauts de ligne simples dans une étape sont fondus (la V1 les gardait avec `whitespace-pre-line`) ; ids `step-N` en double possibles si le texte répète une position (hérité de la V1).
3. Deux pastilles de durée/total en dur dans les messages : « 10 jours ouvrés » devrait reprendre `DELAI_RAPPORT_JOURS_OUVRES`.
4. `splitTitleEm` (V1 du blog) supprime le « : » du titre ; ce gabarit utilise `decouperTitre`, qui le garde. À traiter ailleurs pour le blog.
5. CSS morte héritée de la maquette (`.chapitre__bandeau .lien-fleche`, `.ancre`, `.visuel__cadre svg`) ; `data-cta` absent du lien secondaire libre ; dates en « 1 novembre » (pas « 1er »).

## Relecture

Relecture Opus : tour 1 « À CORRIGER » (4 P2 : deux-points du titre, date « mis à jour » au jour près, numéros de chapitre par rang, API partagées avec M-A1) → corrigés ; tour 2 : points confirmés, un nouveau P2 (deux « Mis à jour le » : carte auteur) → corrigé et testé ; tour 3 : BON (P3 restants : clés du sommaire v2 sur ancre répétée, cible du lien `#step-N` à vérifier visuellement en T1).

VERDICT OPUS : BON (tour 3 sur 3 ; aucun P1 ni P2 ; P3 ci-dessus)
