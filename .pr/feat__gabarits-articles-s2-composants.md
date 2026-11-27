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

## Points restants (relecture Opus)

1. **Photos de repli** : la banque `public/images/axion-ia-*` ne contient que des visuels de marque (affiches, citations, schémas) ; les huit choix sont les moins chargés de texte, mais ne sont pas de vraies photos. Leur `alt` est vide (décor). **À remplacer par de vraies photos validées.**
2. **Branche** : voir l'avertissement ci-dessus (DECOUPAGE.md demande `-v3` depuis `main`).
3. **CSS chargée sur les articles V1** même interrupteur éteint (import statique de l'aiguillage) : à mesurer.
4. **Composants du socle non livrés** : `ChiffreCle`, `CitationMiseEnAvant`, `Cartes`, `RangeeChiffres`, `Frise`, `TableauVisuel`, `Checklist`, `Relance`, `ResumeFin`, `NumeroSection`, `Relecteur`, `HistoriqueMaj`, variante `CarteVideo` ; leurs règles CSS existent sans composant.
5. **Textes à valider par Will** : réassurance (« Confirmation immédiate », « Annulable en un clic »), étape « Vous choisissez un créneau » (PLAN §15.9, interdit de « réservation directe »).
6. Règles globales du socle (`body:has(...)`, `a`, `svg`) susceptibles de restyler des composants V1 réutilisés : revue visuelle.
7. Textes FR codés en dur dans `EncartEnVideo`/`AnswerCard` v2 ; quelques clés de messages inutilisées ; tests « mots interdits » limités aux JSON.

VERDICT OPUS : À CORRIGER (tour 1 sur 3 ; défauts corrigés : sommaire H3, z-index de la barre, règles du Diagnostic, classes sans règle, cadre vidéo, `alt` de repli, import de `analyse.css` ; restent les points ci-dessus)
