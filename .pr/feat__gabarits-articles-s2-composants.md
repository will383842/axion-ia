Briques communes des gabarits d'articles : héros terracotta, photo, actions, sommaire, FAQ et styles (derrière l'interrupteur éteint)

## Base de la PR

**Base : `main`, après la fusion de #2448 (socle S1).** Cette branche contient déjà S1 (fusionné dedans) : tant que #2448 n'est pas sur `main`, le diff affiche aussi S1.

## Ce que fait la PR

Livre la couche commune des gabarits d'articles du blog (DECOUPAGE.md, fiche S2, **révision v3**), pour que G1 à G8 n'aient chacune que leurs propres fichiers. Tout reste derrière `BLOG_GABARITS_V2="true"`, éteint par défaut : interrupteur coupé, le rendu de la page V1 ne change pas.

⚠️ La branche portait le premier plan (en-tête sobre, CSS importée par `globals.css`), que DECOUPAGE.md déclare abandonné. Elle a été **refondue sur les maquettes v3** plutôt que remplacée. DECOUPAGE.md prévoyait une branche `…-composants-v3` créée depuis `main` : à arbitrer par Will si cette reprise sur l'ancienne branche ne convient pas.

- **En-tête du site identique** : le gabarit ne rend ni `<main>` ni en-tête de site (le layout les porte). Aucun fichier de `src/components/nav/` modifié, sauf `Breadcrumbs.tsx` (variante `v2`, V1 par défaut).
- **Héros terracotta** (`HerosArticle`, `header.heros.sur-terracotta`) et **photo** sous le titre (`PhotoArticle` : ratio réservé, `loading="eager"`, `fetchPriority="high"`, crédit Unsplash conservé, photo de repli `src/lib/blog/photos-repli.ts`).
- **Colonne d'actions** (`ColonneActions`) : un seul `<aside>`, Diagnostic IA 45 min, Journée IA, message ; la mention Qualiopi n'existe que si l'identité est publiée. **La couleur de marque est terracotta** (aucun bouton bleu).
- Encart du milieu (`CtaMilieu`), appel de fin (`CtaFin`), barre de progression (CSS pur), mise en page (`MiseEnPageLecture`), corps, pied, encadré, étapes, tableau défilant, fiche de contexte, bloc de définition, bandeau de données.
- **Variantes par prop, V1 intacte par défaut** : `ArticleTOC` (un seul `<nav class="sommaire">`), `ArticleFaq`, `AnswerCard` (`.en-bref`), `Breadcrumbs`, `EncartEnVideo variante="article-v2"` (façade vers `/fr/videos/<slug>`, ni lecteur ni iframe ; rien sans vidéo publiée).
- **CSS** : le socle v3 est porté dans `src/styles/article-v2/socle.css` (+ `complements.css`), toutes les règles bornées à `[data-gabarit]`, importé par `ArticleGabarit.tsx` seulement. `globals.css` n'est pas touché. Pas de hexadécimal, pas de copie de l'en-tête du site.
- Messages `src/messages/gabarits/*.{fr,en}.json`, chargeur `src/i18n/messages-gabarits.ts`, `check-i18n` étendu ; paires de contraste du héros ajoutées à `scripts/check-contrast.ts` ; exceptions nominatives de `content-gen:isolation-check`.

## Tests

- `tests/unit/blog/article-v2-composants.spec.tsx` et `article-v2-garde-fous.spec.ts` (rendu de chaque composant et des huit gabarits, V1 par défaut des variantes, CSS bornée, `globals.css` intact, messages fr/en alignés, mots interdits, photos de repli).
- Verts en local : 114 tests de `tests/unit/blog`, `pnpm typecheck`, `check-i18n`, `anti-hex`, `use-client`, `radius`, `check-contrast`, `content-gen:isolation-check`, `image-bank:isolation-check`, prettier ; lint sans erreur.
- **Non fait** : axe 1280/320 px, vérification visuelle de l'en-tête du site (les règles `body:has([data-gabarit])` du socle changent la taille de police héritée), mesure du First Load JS de `/fr/blog/[slug]` (les builds de mesure ont été tués faute de mémoire ; aucun JS client n'est ajouté ; CSS du socle ≈ 10 Ko gz minifiée, cible ≤ +12 Ko).

## Mesures (First Load JS, `/fr/blog/[slug]`, build `--experimental-build-mode compile`, avant = `origin/main`, après = cette branche)

- JS client de la route (coque + chunks client du manifeste, brotli remplacé par gzip -9) : **261,07 KB gz avant, 261,07 KB gz après : +0**. Aucun JavaScript client ajouté. Chunk `page-*.js` : 1 022 o → 1 116 o gz (+94 o).
- CSS de la route : 41,13 KB gz → 51,15 KB gz, soit **+10 KB gz** (cible ≤ +12 KB), **chargée même interrupteur éteint** (l'aiguillage importe la feuille statiquement). Mesuré avant les derniers ajouts de CSS (≈ +0,3 KB).
- ⚠️ Le chiffre « First Load JS ≤ 75 KB » par route n'est pas lisible tel quel en mode compile (le manifeste de route n'expose pas `entryJSFiles`) : la mesure ci-dessus est un majorant identique avant/après, donc le delta est fiable, pas la valeur absolue. LCP/INP/TBT non mesurés (aucune mesure de temps ici).

## Tests

- `tests/unit/blog` : 122 tests verts (nouveau : `article-v2-briques-complementaires.spec.tsx` ; verrous ajoutés : aucun `max-width` en CSS, encart vidéo sans lecteur avec mention IA, H2 du corps stylés, photos `axion-ia-photo-*`).
- Verts : `pnpm typecheck`, `i18n:check`, `content-gen:isolation-check`, `image-bank:isolation-check`, `anti-hex`, `contrast:check`, eslint (0 erreur), prettier.
- Non fait : axe 1280/320 px, vérification visuelle (navigateur) de l'en-tête du site et des règles globales du socle (`body:has(...)`, `a`, `svg`).

## Ce qui a changé au tour 2 et 3

- Photos de repli : 5 vraies photos de la banque (`axion-ia-photo-*`, sans texte ni logo), réutilisées sur 8 gabarits ; `alt` vide (décor).
- CSS du socle passée en mobile first (cinq blocs `max-width` inversés en `min-width`).
- Briques livrées : `ChiffreCle`, `RangeeChiffres`, `CitationMiseEnAvant`, `Cartes`, `Frise`, `Checklist`, `Relance`, `ResumeFin`, `NumeroSection`, `Relecteur`, `HistoriqueMaj` (rien si la donnée manque). Textes de l'encart vidéo en messages ; mention IA de la vidéo conservée ; identifiants uniques (`useId`) ; H2 du corps stylés ; héros court à l'impression.
- Fusion de `origin/main` (S1 #2448) : conflits résolus côté S2.

## Points restants

1. Non livrés : variante `CarteVideo` et `TableauVisuel` (`TableauDefilant` couvre le tableau).
2. Branche : DECOUPAGE.md (sur `main`) la déclare abandonnée au profit de `…-composants-v3` : **Will doit confirmer cette reprise**.
3. Textes à valider par Will : réassurance (« Confirmation immédiate », « Annulable en un clic »), étape « Vous choisissez un créneau ».
4. Mineurs : largeur de colonne 35 em non appliquée à `.corps-html > p` ; lien `/fr/videos/…` en dur ; commentaires de `CorpsArticle` et `ArticleTOC` inexacts ; 5 photos pour 8 gabarits ; revue visuelle des règles globales du socle.

VERDICT OPUS : BON (tour 3 sur 3 ; aucun défaut majeur ; mineurs ci-dessus)
