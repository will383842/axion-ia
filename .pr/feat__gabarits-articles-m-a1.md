Gabarit « Actualité » des articles : habillage de /actualites/[slug] (derrière l'interrupteur éteint)

## Base de la PR

**Base : `main`.** La branche part de `feat/gabarits-articles-s2-composants` (briques S2, verdict « BON ») et y a fusionné `origin/main`. Tant que S1 et S2 ne sont pas sur `main`, le diff affiche aussi leurs commits : le travail propre à cette PR tient dans les commits `feat(blog): gabarit Actualité (M-A1)…` et `fix(blog): gabarit actualité…`.

## Ce que fait la PR

Habille la page autonome `/actualites/[slug]` selon la fiche A1 de `DECOUPAGE.md` (maquette v3 `actualite.html`), derrière `BLOG_GABARITS_V2="true"` (éteint par défaut). Interrupteur coupé : le JSX V1 est inchangé, `generateMetadata`, `NewsArticle`/`Person`, `og:image` et l'URL aussi.

- **Une seule insertion dans `page.tsx`** (import de l'interrupteur + un bloc `if (gabaritsV2Actifs())` avant le `return` V1, import dynamique du gabarit).
- **`GabaritActualite`** : héros terracotta, date du jour en évidence (chiffre décoratif `aria-hidden`, date lisible dans `<time>`), source d'origine en pastille, photo sous le titre (`featuredImage` ou photo de repli `actualite`, jamais un SVG), « En bref », triptyque, sommaire, corps, encadré « Source d'origine » (nom + lien sortant `rel="noopener noreferrer"`), encart du milieu (Diagnostic IA 45 min + lien « Écrire un message »), FAQ, sources, carte auteur, partage, « À lire aussi », capture e-mail existante (`actualites-fin-article`, la seule), appel de fin. `<article>` englobe désormais l'en-tête et les sources ; un seul `aside.action` (`depuis=actualite-colonne`) après `</article>`. Le badge « Brève (non indexée) » n'est plus affiché ; le `noindex` ne change pas.
- **`TriptyqueActualite`** : ne rend que le « Point clé » existant (`Article.keyTakeaway`) en première carte (« Ce qui change »). « Pour qui » et « Que faire maintenant » n'existent pas comme données : le composant les accepte mais la page ne les fournit pas, **rien n'est déduit du texte**.
- Pas de signe du héros (aucune donnée de métadonnées ne le porte), pas de frise des dates (idem), pas d'encart vidéo (`/actualites` n'est pas page hôte, PR E6).
- Petites variantes par prop sur les briques S2, valeurs par défaut inchangées pour les huit gabarits du blog : `HerosArticle` (`surtitreType`, `signe`, `dateUne`, `pastilleSource`, `misAJourLisible`, dates et temps de lecture nuls), `CtaMilieu` (`secondaire`, `titre`, `texte`), `PhotoArticle`/`photos-repli` (type `GabaritPage` = gabarits du blog + `actualite`).
- CSS `src/styles/article-v2/actualite.css` (bornée à `[data-gabarit="actualite"]`, mobile d'abord, jetons du site, aucun hexadécimal), messages `actualite.{fr,en}.json` (typographie française, aucun mot interdit). La route importe elle-même socle, compléments puis `actualite.css`.

## Tests

- Nouveau `tests/unit/blog/gabarit-actualite.spec.tsx` (37 tests) : structure (un h1, ni `<main>` ni en-tête de site, `<article>` englobant, un seul `aside.action`, encart du milieu), photo (article / repli / aucun SVG), date du jour, absence de date de publication, source avec et sans lien, triptyque (1 ou 3 cartes, rien sans contenu, ids uniques), ordre des feuilles de style, mots interdits, aiguillage de la page (garde unique avant le `return` V1, V1 intacte, `generateMetadata` indépendant de l'interrupteur, JSON-LD de la V1).
- Verrous S2 ajustés volontairement : liste des messages (`+ actualite`) et clés de `PHOTOS_REPLI` (`+ actualite`).
- Verts en local : `tests/unit/blog` (157 tests), `pnpm typecheck`, `content-gen:isolation-check`, `image-bank:isolation-check`, `i18n:check`, `anti-hex:check`, `use-client:check`, `radius:check`, eslint (0 erreur, 1 avertissement d'import de type dans le test, comme en S2), prettier.
- **Non fait** : axe 1280/320 px et vérification visuelle dans un navigateur (reportés à T1), mesures de temps (LCP/INP/TBT).

## Mesures (`next build --webpack --experimental-build-mode compile`, route `/fr/actualites/[slug]`)

- JS client de la route (modules du manifeste client, gzip -9) : **123,6 Ko, identique à `/guides/[slug]`** (route non modifiée par la PR) : **aucun JavaScript client ajouté**. ⚠️ Ce n'est pas le « First Load JS ≤ 75 Ko » de l'AGENTS.md (la dette du socle, ≈ 250 Ko, est hors périmètre et n'est pas aggravée) ; la valeur absolue n'est pas lisible en mode compile, le delta l'est.
- CSS de la route : 41,1 Ko gz (`/guides/[slug]`, sans gabarit) → **52,3 Ko gz** (≈ +11 Ko, cible ≤ +12 Ko). ⚠️ **Chargée même interrupteur éteint** : webpack rattache la feuille importée par `import()` à la route (vérifié sur le manifeste). Sans effet visuel (tout est borné à `[data-gabarit]`) mais le « HTML identique interrupteur coupé » ne tient qu'au balisage, pas aux `<link rel="stylesheet">`.

## Points restants (non bloquants)

1. Mesures de temps et axe à faire (T1) ; revue visuelle (en-tête du site, pastille de source longue à 360 px : risque de rangée supplémentaire).
2. Deux « Publié le » sur la page réelle (héros + carte auteur), comme en V1 et sur le blog.
3. Sans `newsCategory`, pastilles « Actualité » puis « Actualité IA » (repli hérité de la V1).
4. Libellés en dur hérités : fil d'Ariane « Actualités ».
5. Temps de lecture estimé à 220 mots/min (le blog utilise `estimateReadingTimeFromBody`).
6. Dates en « 1 novembre » (pas « 1er »).

## Relecture

Relecture Opus : tour 1 « À CORRIGER » (P1 : feuilles du socle non importées par la route ; P2 : date de publication vide) → corrigés et testés ; tour 2 : tous les points vérifiés, aucune régression, P3 restants ci-dessus.

VERDICT OPUS : BON (tour 2 sur 3)
