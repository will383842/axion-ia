# Découpage des PR d'implémentation — gabarits d'articles

Lire d'abord `PLAN.md` (contraintes §1, correspondance §3, règles §6-§9, révision v2 §15, **révision v3 §15.9**). La référence visuelle est `maquettes-v2/*.html` : **le dossier garde le nom « v2 », mais il contient les maquettes v3 validées par Will** (PR #2423, socle `maquettes-v2/_socle.css`, sommaire `maquettes-v2/index.html`). Les anciennes `maquettes/*.html` ont été refusées et ne servent plus.

> ⛔ **La branche `feat/gabarits-articles-s2-composants` est ABANDONNÉE.** Elle implémente l'ancien design (en-tête mocha propre au blog, visuel de substitution dessiné). Ne pas la reprendre, ne pas la rebaser, ne pas y piocher de composants : **repartir de `main`** avec la fiche S2 ci-dessous. Les branches `feat/gabarits-articles-s1-socle` et `feat/gabarits-articles-s3-transformations` ne portent pas de design : les relire contre leurs fiches avant toute reprise.

> **Révision v3 (2026-11-27)** — décisions de Will, prioritaires sur tout ce qui suit :
>
> - **en-tête du site identique à l'en-tête réel** : on réutilise `Header` (`src/components/nav/Header.tsx`), déjà rendu par `src/app/[locale]/layout.tsx` avec `<main id="main">`. Plus d'« en-tête mocha » propre au blog, aucun nouveau composant d'en-tête, aucune modification de `Header.tsx`, `NavLink.tsx`, `MobileNav.tsx` ni `HeaderPrestationsMenu.tsx` dans ce chantier (seul `Breadcrumbs.tsx` reçoit une variante v2, voir S2) ;
> - **héros (grand titre) sur fond terracotta** (`HerosArticle`, section 07 du socle) ;
> - **une vraie photo sous le titre pour chaque article**, tirée de la photo de l'article ou, à défaut, de la banque d'images du site (`public/images/axion-ia-*.avif|.webp`) ; jamais un dessin, jamais un SVG, jamais un aplat seul ;
> - **boutons sur le côté** : Journée IA, Diagnostic IA 45 min, Écrire un message (carte collante sur ordinateur, barre fixe sur téléphone, un seul `<aside>`) ;
> - **encart vidéo** selon `docs/pilotage-seo-geo/CONCEPTION-ENCART-VIDEO.md` (façade sans lecteur, rendu seulement si une vraie vidéo est publiée) ;
> - **mobile d'abord** et typographie française soignée au caractère près ;
> - **la marque est terracotta**. Le bleu `--color-primary` reste un jeton du site (liens, bouton « Réserver un appel » de l'en-tête réel), jamais une couleur de marque. Les maquettes l'emploient encore sur le bouton « Diagnostic IA » (`btn--bleu`) : **point ouvert soumis à Will avant S2** (PLAN §15.9).
>
> Rappels v2 toujours valables : plusieurs appels à l'action (PLAN §15.3) ; PR **A1** (actualités) et **GU1** (guides pilier) ; la CSS des gabarits n'entre jamais dans `globals.css`, elle est importée par les seules routes d'article (PLAN §15.7). **Chaque PR est ouverte en brouillon** (règle CI du dépôt) et passée « prête » une seule fois, à la fin. Aucune PR ne relève un cliquet `size-limit`. Aucune PR ne touche `prisma/`. Tous les textes visibles passent par `next-intl` (`src/messages/fr.json` et `src/messages/en.json`, EN toujours désactivé).

Règle commune de test pour toute PR qui rend un gabarit : (a) rendu serveur (`renderToStaticMarkup`) avec `data-gabarit="<code>"` ; (b) interrupteur coupé → aucun marqueur V2 ; (c) un seul `h1`, pas de saut de titre, chaque ancre du sommaire a son `id` ; (d) aucun `"use client"` ajouté ; (e) axe (`@axe-core/playwright`) à 1280 px et 320 px sur la page de rendu, sans violation `serious`/`critical` ; (f) le gabarit ne rend **ni `<main>` ni en-tête de site** (ils viennent du layout ; la page rendue contient exactement un `header[data-tone="terracotta"]` et un `main#main`) ; (g) `.visuel__cadre` contient un `<img>` de photo et **aucun `<svg>`** ; (h) aucun mot interdit dans le HTML produit par le gabarit : prix, « Grenoble », « frais de déplacement », « témoignage », « avocat », « réserver » / « réservation », prix barré (`<s>`, `<del>`, `line-through`).

Règle commune de budget (AGENTS.md, rappelée dans chaque fiche) : LCP ≤ 1 800 ms p75, INP ≤ 100 ms p75, CLS = 0, TBT ≤ 150 ms, First Load JS ≤ 75 KB gz par route. La photo sous le titre est l'élément LCP probable (au moins sur grand écran, PLAN §15.7) : dimensions fixes et ratio 16/10 réservé, `loading="eager"` + `fetchPriority="high"` (PLAN §3 : `priority` est déprécié en Next 16), `sizes` exact, AVIF puis WebP par `next/image` (`next.config` : `formats: ["image/avif", "image/webp"]`). **Le First Load JS par route n'est mesuré par aucune gate** (AGENTS.md, « ⛔ ce qui n'est mesuré par aucune gate ») : chaque PR le mesure à la main (`next build --experimental-build-mode compile`, puis lecture de `.next/static/chunks/app/`) avant et après, et l'écrit dans sa description. Les octets se lisent sur une passe ; LCP, TBT et INP se bornent en médiane sur plusieurs passages. Toute dégradation d'un seuil = **STOP & ASK Will + ADR**.

## Ordre et dépendances

```
S1 ──► S2 ──┬──► G1 analyse ──┐
        │   ├──► G2 guide     │
S3 ─────┘   ├──► G3 comparatif│
 (parallèle │   ├──► G4 sélection │──► J1 JSON-LD ──► (activation : décision humaine)
  avec S1)  ├──► G5 cas       │
            ├──► G6 définition│
            ├──► G7 FAQ       │
            ├──► G8 chiffres ─┘
            ├──► A1 actualités (dépend aussi de S1 pour l'interrupteur)
            └──► GU1 guides    (dépend aussi de S1 ; F1 peut passer avant ou après)
T1 (tests E2E / lhci) : parallèle avec G1..G8, A1, GU1 dès que S2 est fusionnée.
```

| PR    | Dépend de                             | Peut tourner en parallèle avec                        |
| ----- | ------------------------------------- | ----------------------------------------------------- |
| S1    | —                                     | S3                                                    |
| S3    | —                                     | S1                                                    |
| S2    | S1                                    | S3 (si S3 déjà fusionnée ou sans fichier commun)      |
| G1…G8 | S1, S2, S3                            | toutes les autres G, A1, GU1, T1 (fichiers disjoints) |
| A1    | S1, S2                                | G1…G8, GU1, T1                                        |
| GU1   | S1, S2 (S3 pour `parseStepsFromBody`) | G1…G8, A1, T1, F1                                     |
| T1    | S2                                    | G1…G8, J1                                             |
| J1    | S1, G2, G3, G4, G6 (selon familles)   | T1                                                    |

Les fichiers **partagés** (`page.tsx`, `ArticleGabarit.tsx`, `src/messages/*.json`, `src/styles/article-v2/socle.css`, `src/lib/blog/photos-repli.ts`) sont tous préparés par S1/S2 pour que G1…G8 n'aient chacune que **leurs propres fichiers** à modifier : S2 crée d'avance les huit fichiers de gabarit (rendu de repli = Analyse), les feuilles de style `@import`ées, et un fichier de messages **par gabarit et par langue** (`src/messages/gabarits/<code>.fr.json` et `.en.json`, fusionnés par `src/i18n/request.ts`, voir S2) afin d'éviter les conflits.

L'encart vidéo des gabarits réutilise le composant existant (`EncartEnVideo`) et son choix actuel de vidéo ; le futur choix par affectation (PR E6 de `CONCEPTION-ENCART-VIDEO.md`) le remplacera sans toucher aux gabarits. Aucune PR de ce découpage n'attend E1-E8.

---

## S1 — Socle : interrupteur, type de contenu, aiguillage

- **Branche** : `feat/gabarits-articles-s1-socle`
- **Fichiers touchés** : `src/env.ts` (déclaration + `runtimeEnv`) ; `src/lib/blog/gabarits-v2.ts` (nouveau) ; `src/server/content-gen/blog/gabarits.ts` (nouveau : `GabaritArticle`, `gabaritPourType`, heuristique de repli) ; `src/server/content-gen/blog/loader.ts` (ajouter `generatedByJobId: true` au `select` + `chargerTypeContenu`) ; `src/app/[locale]/blog/[slug]/page.tsx` (insertion unique juste avant le `return (` principal) ; `src/components/article-v2/ArticleGabarit.tsx` (nouveau, squelette qui rend un `<div data-gabarit>` minimal — jamais un second `<main>` ni un en-tête : `<main id="main">` et `Header` viennent de `src/app/[locale]/layout.tsx` (révision v3) — avec les composants existants dans l'ordre du PLAN §4 — pas encore de design) ; tests.
- **Consigne** : ajouter `BLOG_GABARITS_V2` (`z.enum(["true","false"]).optional()`) ; `gabaritsV2Actifs()` lit `process.env.BLOG_GABARITS_V2 === "true"` à chaque appel. Dans `page.tsx`, conserver à l'octet près le JSX actuel et tout le calcul existant ; juste avant le `return (` : `if (gabaritsV2Actifs()) { const type = await chargerTypeContenu(view); return <ArticleGabarit gabarit={gabaritPourType(type, html)} … /> }`. `chargerTypeContenu` fait `prisma.contentGenJob.findUnique({ where:{ id: generatedByJobId }, select:{ contentType:true } })` **seulement si l'interrupteur est allumé** et tolère le Proxy `stub.invalid` (retourne `null`). `gabaritPourType` est un `Record<ContentType, GabaritArticle>` exhaustif selon la table du PLAN §3 + repli HTML pour `null`. Ne pas modifier `generateMetadata`, le JSON-LD, ni la sélection d'image. Transmettre à `ArticleGabarit` le HTML et la table des matières **bruts** (le gabarit construit son sommaire ; `page.tsx:407` et `buildToc` ne changent pas). Test : le HTML V1 interrupteur coupé, hors `<style>`, est identique à celui d'avant la PR.
- **Tests** : table exhaustive (un test énumère `Object.values(ContentType)`) ; repli HTML (3 cas) ; interrupteur absent / `"false"` / `""` / `"true"` ; interrupteur coupé → le rendu de `page.tsx` contient `max-w-[52rem]` et le bandeau « Mis à jour », et **aucun** `data-gabarit` ; interrupteur coupé → `chargerTypeContenu` jamais appelé ; `generateMetadata` identique allumé/éteint ; ensemble des `@id` JSON-LD identique ; verrous existants (`metadata-editoriale`, `sources-eeat`, `un-seul-mis-a-jour-par-article`) toujours verts.

## S3 — Transformations de contenu et accessibilité du corps

- **Branche** : `feat/gabarits-articles-s3-transformations`
- **Fichiers touchés** : `src/server/content-gen/blog/transformations.ts` (nouveau : `envelopperTableaux`, `abaisserH1`, `controlerTitres`, `ancrerSousTitres`, `marquerLiensExternes`) ; `src/server/content-gen/shared/html-sanitizer.ts` (**seulement** si l'option liste blanche est retenue : `caption`, `scope`, `lang` ; **revue de sécurité obligatoire**) ; `src/server/content-gen/guides/loader.ts` (exporter `parseStepsFromBody`, sans changer son comportement) ; tests.
- **Consigne** : fonctions pures, serveur, appliquées **après** le sanitizer. `envelopperTableaux(html)` enveloppe chaque `<table>` dans `<div class="table-scroll" role="region" tabindex="0" aria-labelledby="cap-N">` et garantit un nom (utilise la `<caption>` si présente, sinon génère un libellé neutre passé en paramètre, déjà traduit). `abaisserH1` transforme `<h1>` en `<h2>` du corps. `controlerTitres` renvoie la liste des sauts de niveau (pour les tests et la journalisation) sans réécrire le HTML. `ancrerSousTitres(html, idsExistants)` pose un `id` stable sur les `<h3>`, les questions de FAQ et les étapes **sans jamais modifier l'`id` d'un `<h2>` produit par `buildToc`** (`buildToc` ne lit que les H2, n'agit qu'à partir de 3 H2 et reste gelé). `marquerLiensExternes` ajoute la mention « (nouvelle fenêtre) » masquée visuellement (libellé fourni en paramètre). Si la liste blanche du sanitizer est touchée : ajouter des tests XSS (attributs interdits toujours refusés, `javascript:` refusé).
- **Tests** : entrées/sorties de chaque fonction (tableau sans caption, avec caption, plusieurs tableaux, `colspan`) ; idempotence (double application) ; HTML malformé ; test XSS si sanitizer modifié ; aucune dépendance au DOM navigateur.

## S2 — Composants communs, héros terracotta, photo, colonne d'actions, encart vidéo et feuilles de style (révisée v3)

- **Branche** : `feat/gabarits-articles-s2-composants-v3`, **créée depuis `main`**. L'ancienne `feat/gabarits-articles-s2-composants` (design v2) est abandonnée : rien n'en est repris.
- **Référence** : `maquettes-v2/_socle.css` (sections 02 à 23) et la structure de `maquettes-v2/analyse.html`. Le socle décrit son ordre de DOM en tête de fichier : fil d'Ariane, `article.article` (`header.heros`, `div.article__ouverture` = photo + « En bref », `nav.sommaire`, `div.article__corps`), puis `aside.action`, puis hors article « Aller plus loin », « À lire aussi », guide gratuit, appel de fin.
- **Ce qu'on ne reproduit pas** (copie de maquette, pas du design à créer) :
  - section 06 « en-tête du site » (`.site-entete`, `.site-logo*`, `.site-nav*`, `.site-pastille*`, `.site-reserver*`, `.site-menu*`) : c'est une recopie fidèle de `Header.tsx` + `NavLink.tsx` pour que la maquette ait l'air vraie. **En production, l'en-tête est le composant `Header` lui-même**, déjà rendu par le layout. Le `depuis=<gabarit>-entete` des maquettes n'est pas repris (le `Header` garde `depuis=entete` / `entete-mobile`) ; toute retouche du `Header` serait une PR distincte, sur décision de Will, car elle touche toutes les pages (`Header.budget.spec.ts`, `entete-terracotta.spec.tsx`) ;
  - `.bandeau-maquette`, `.bandeau-fictif`, `.pastille--exemple`, la mention « Emplacement facultatif · maquette » de l'encart vidéo, le pied de page `.pied-site` (le pied réel vient du layout) et les `@font-face` (les polices viennent de `next/font` et de ses replis métriques) ;
  - les règles `.v-*` (`.visuel__cadre .v-anneau`, `.v-carte`, `.v-courbe`…) restées en fin de `<style>` dans les dix maquettes : **elles ne visent plus aucun élément** (vérifié : aucune classe `v-` dans le `<body>` des maquettes). Ce sont des vestiges des dessins SVG de la v2, que la v3 a remplacés par de vraies photos. Ce que les maquettes v3 font réellement, et qu'on reprend, c'est le cadre photo : `.visuel`, `.visuel__cadre`, `.visuel__etiquette` et la légende (voir `PhotoArticle`).
- **Fichiers touchés** :
  - `src/components/article-v2/*.tsx`, tous composants serveur :
    - mise en page : `MiseEnPageLecture` (`.mise-en-page` + `article.article`, sans `<main>`), `CorpsArticle`, `TableauDefilant`, `ArticleEtapes`, `PiedArticle` ;
    - **`HerosArticle`** (nouveau en v3, remplace l'en-tête mocha prévu en v2) ;
    - **`PhotoArticle`** (nouveau en v3, remplace `HeroImageArticle`) ;
    - `ColonneActions`, `CtaMilieu`, `CtaFin`, `Encadre`, `ChiffreCle`, `CitationMiseEnAvant`, `Cartes`, `RangeeChiffres`, `Frise`, `TableauVisuel`, `Checklist`, `Relance`, `ResumeFin`, `BarreProgression`, `NumeroSection` ;
    - `Relecteur` et `HistoriqueMaj` (blocs `.relu` et `.historique` du socle, section 23) : rendus **seulement** si la donnée existe déjà (relecteur réel enregistré, historique de mises à jour) ; sinon rien, et aucun champ Prisma n'est créé ;
  - `src/lib/blog/photos-repli.ts` (nouveau) : table statique `gabarit → { src, alt }` de photos de la banque du site (`public/images/axion-ia-*.webp`, chaque fichier ayant son `.avif`), utilisée **uniquement** quand l'article n'a pas de `featuredImage` ;
  - `src/components/videos/EncartEnVideo.tsx` et `CarteVideo.tsx` : prop `variante="article-v2"` (classes `.encart-video*` du socle) ; la variante par défaut reste inchangée sur les pages de service, de formation et de ville ;
  - `src/components/article-v2/gabarits/Gabarit{Analyse,Guide,Comparatif,Selection,Cas,Definition,Faq,Chiffres}.tsx` : huit fichiers créés d'avance, rendu Analyse ;
  - `src/components/article-v2/ArticleGabarit.tsx` ;
  - `src/styles/article-v2/socle.css`, plus une feuille par gabarit et `actualite.css`, `guide-pilier.css`, toutes créées vides ;
  - **import depuis les routes d'article uniquement**, jamais depuis `globals.css` (PLAN §15.7). `globals.css` ne reçoit au plus que les jetons fluides `@theme`, et seulement si la mesure montre + ≤ 0,3 Ko gz. Les jetons du socle existent déjà dans `globals.css` (`--color-*`, `--header-h: 5rem` l. 439) : on les relit, on ne les redéclare pas ;
  - `src/components/nav/Breadcrumbs.tsx` : variante v2 (une ligne, page courante tronquée par « … », cibles de 44 px) ; la v1 reste inchangée par défaut ;
  - `src/components/seo/ArticleTOC.tsx` : variante v2 avec un seul `<nav>` et le `<details>` toujours ouvert sur ordinateur sous `@supports selector(::details-content)` ; la v1 reste inchangée par défaut ;
  - `src/components/content-gen/ArticleFaq.tsx` (`premiereOuverte`, `niveauTitre`) ;
  - `src/components/marketing/AnswerCard.tsx` (`variante="v2"`, rendu `.en-bref`, `data-aeo="tldr"` conservé) ;
  - `src/i18n/request.ts` et `scripts/check-i18n.ts` ;
  - `src/messages/gabarits/{commun,actions,<code>}.{fr,en}.json` ;
  - `scripts/check-contrast.ts` (paires du héros terracotta) ;
  - tests.
- **Consigne** :
  - **En-tête** : ne rien créer. Le gabarit commence au fil d'Ariane ; il ne rend ni `<header>` de site, ni `<main>`. La barre de progression (`BarreProgression`, CSS pur, `animation-timeline: scroll()`, invisible sans support) se place juste sous la barre réelle (`top: calc(var(--header-h) + 1px)`) avec un `z-index` **inférieur** à celui du `Header` (`z-40`) ; l'`scroll-padding-top` se cale sur `--header-h`.
  - **`HerosArticle` = `header.heros.sur-terracotta`** (section 07 du socle) :
    - fond : dégradé vertical terracotta plein jusqu'à 58 %, puis mélange terracotta → terracotta-deep ; rayures terracotta-deep en haut à droite ; fond pleine largeur par `::before` débordant rogné par `clip-path: inset(0 -100vmax)` (et `html { overflow-x: clip }`), jamais de défilement horizontal. Règle de décor : tout ce qui passe sous du texte est plus **foncé** que le terracotta ;
    - surtitre en liste de pastilles : type `pastille--pleine` (papier, texte terracotta-deep, 8,25:1) et catégorie `pastille--contour` (terracotta-deep, texte ivoire, 7,45:1) ;
    - H1 Fraunces 500, couleur papier, `clamp(2.25rem, 1.3rem + 4vw, 4.5rem)` / 1,07, interlettrage − 0,028 em, puis `clamp(2.75rem, 1rem + 3vw, 3.75rem)` à partir de 1 024 px ; `max-width: 14.6em` (**en em, jamais en ch** : stable au chargement des polices) ; la fin du titre (`splitTitleEm`) en italique terracotta-soft avec soulignement terracotta-deep ;
    - chapô papier, filet gauche terracotta-soft ; méta (auteur avec avatar, « Publié le », « Mis à jour le » avec `data-aeo="freshness"`, temps de lecture en pastille papier) en `<time datetime>` ;
    - pied du héros : partage en icônes à gauche, **signe du gabarit** à droite (`.heros__signe`, décor typographique `aria-hidden`, boîte de taille fixe : 44 px, puis 5,5 rem à partir de 640 px) ;
    - téléphone (< 640 px) : pied du héros masqué, une seule date (la mise à jour), méta en une rangée par élément (le nombre de rangées ne dépend pas de la police : CLS) ;
    - contrastes mesurés à reprendre dans `check-contrast.ts` : ivoire sur terracotta 5,24:1, papier 5,81:1, terracotta-soft 4,66:1, sable 4,81:1 ; `mocha-fg-muted` (2,6:1) interdit dans le héros ; anneau de focus ivoire (`.sur-terracotta`).
  - **`PhotoArticle` = `figure.visuel > div.visuel__cadre`** (section 08) :
    - `next/image` d'une vraie photo, ratio 16/10 réservé, passe-partout ivoire de 6 px, rayon 28 px, ombre douce ; la figure **chevauche le bas du héros** (marge haute négative `clamp(4.5rem, 3rem + 6vw, 7.5rem)`) ;
    - source : `featuredImage` de l'article tel que le choisit déjà la chaîne existante (`src/server/content-gen/images/select-hero-image.ts` : Unsplash, ou banque interne si `HERO_IMAGE_BANK_FALLBACK=true`), avec son `alt` et son crédit `UnsplashCredit` (`src/components/media/UnsplashCredit.tsx`) en `figcaption`. **La sélection des images n'est pas modifiée** (PLAN §1.1) ;
    - sans `featuredImage` (articles en fichiers `source !== "db"`, actualité ou guide sans image) : photo de repli de `src/lib/blog/photos-repli.ts`. Jamais un dessin, un SVG, une infographie ni un aplat de couleur. La table exclut les fichiers dont le nom annonce une infographie ou un chiffre (ex. `…-infographie.webp`, `…-45-pourcent-…`, deux fichiers que les maquettes Comparatif et Chiffres emploient) ; la photo de repli n'entre ni dans `og:image` ni dans le JSON-LD (metadata inchangées) ;
    - `.visuel__etiquette` (pastille mocha, `aria-hidden`) : seulement si le gabarit dispose d'un libellé tiré des métadonnées ; sinon absente ;
    - LCP : `loading="eager"`, `fetchPriority="high"`, `sizes="(min-width: 1024px) 41.5em, calc(100vw - 32px)"` (à recaler sur la colonne réelle), `width`/`height` connus ou `fill` dans le cadre à ratio fixe.
  - **Grille** (section 09) : téléphone d'abord, une colonne, gouttière de 16 px ; à partir de 1 024 px, `grid-template-columns: minmax(0, 41.5em) minmax(17rem, 20rem)` et `article` en `subgrid`. Le héros occupe la colonne de lecture ; la carte d'action démarre à la ligne 1 de la colonne droite, **posée dans le bandeau terracotta**, puis colle sous la barre (`top: calc(var(--header-h) + 1rem)`) ; le sommaire colle juste dessous (`--hauteur-carte`, `--sommaire-haut`, `--sommaire-max`, recalés pour les écrans peu hauts : 1 000 px et 860 px).
  - **`ColonneActions`** (section 12) : **un seul `<aside aria-label="Passer à l'action">`** placé après `</article>`, qui sert à la fois de carte (≥ 1 024 px) et de barre fixe (< 1 024 px).
    - ordinateur : carte mocha-soft, filet terracotta-on-mocha, titre « Passer de la lecture _à l'action_ », sous-titre « Pour votre PME, partout en France. », trois actions dans l'ordre du DOM : « Diagnostic IA, 45 min » (`method1Title`), « Découvrir la Journée IA » (terracotta plein), « Écrire un message » (contour) ; réassurance (« Confirmation immédiate », « Annulable en un clic », « Partout en France ») masquée sous 860 px de haut ;
    - téléphone : barre fixe à 3 cellules de 56 px minimum, ordre visuel Journée IA · Diagnostic IA (au centre, pastille « 45 min ») · Message, `safe-area-inset-bottom`, `body` qui réserve la hauteur de la barre, `scroll-padding-bottom` pour que le focus ne passe jamais dessous ; chaque `aria-label` contient le texte visible ;
    - couleur du Diagnostic : les maquettes portent `btn--bleu` (jeton `--color-primary`). **À trancher par Will avant d'écrire ce bouton** : la marque est terracotta ; si Will retire le bleu, Diagnostic passe en terracotta plein et Journée IA en terracotta-deep ou contour, sans nouvelle couleur ;
    - props : `gabarit` (pour `depuis=<gabarit>-colonne`) et l'identité Qualiopi optionnelle : mention rendue **uniquement** si `getQualiopiPublicIdentity()` renvoie une valeur ;
    - liens : `lienDiagnostic(depuis)`, `/journee-ia` et `/contact`, via le `Link` de next-intl.
  - **`CtaMilieu`** (section 19) : papier, bordure mocha 2 px, filet gauche terracotta 8 px, ombre sable-deep, disque décoratif ; titre en `<p class="cta-milieu__titre">` (jamais un `<h2>` : hors sommaire) ; un bouton + un lien. Le bouton principal dépend du gabarit (PLAN §15.3). **`CtaFin`** : bloc mocha, trois actions, déroulé du Diagnostic en 3 étapes, réassurance factuelle.
  - **Encart vidéo** (section 23, `CONCEPTION-ENCART-VIDEO.md` §4) : `EncartEnVideo variante="article-v2"` = `section.encart-video` sable, repère en capitales terracotta-deep, titre Fraunces 600 en `<h2>` à identifiant **unique par instance**, cadre 16/9 mocha avec pastille de lecture terracotta, `<details>` « Lire le résumé » qui reprend le `resume` de la vidéo. Placé entre la FAQ et « Sources et méthode », comme dans les maquettes. **Façade seulement (option A de la conception)** : le clic mène à `/fr/videos/<slug>` ; aucun lecteur, aucun iframe YouTube (la mention « vidéo YouTube… chargée au clic » des maquettes n'est pas reprise), aucun `VideoObject`. Image `loading="lazy"`, `decoding="async"`, dimensions fixes, jamais `fetchpriority="high"`. Rendu `null` si aucune vidéo publiée (`VIDEOS_SITE_ENABLED` éteint, base `stub.invalid`, thème sans vidéo) : jamais d'emplacement vide.
  - **Typographie** (sections 03 et 22) :
    - polices : Manrope 400/600, Fraunces 500/600 (+ italique), Inconsolata pour les numéros ; jamais de graisse 700/800, aucune nouvelle graisse ;
    - corps `clamp(1.0625rem, 1rem + 0.25vw, 1.125rem)` / 1,68, puis 1,1875 rem à partir de 1 024 px ; colonne de texte 41,5 em (≈ 68 caractères), 35 em pour les paragraphes sur ordinateur ; tableaux, schémas et figures en pleine largeur ;
    - H2 Fraunces 600 `clamp(1.625rem, 1.2rem + 1.6vw, 2.375rem)` / 1,14, précédés du repère `.num-section` (« 04 / 07 », Inconsolata, décor) ; H3 et H4 en Manrope 600 ;
    - `text-wrap: balance` sur les titres, `pretty` sur les paragraphes, crénage et ligatures courantes ; chiffres en `lining-nums tabular-nums` ; toutes les largeurs en em ou rem, jamais en ch ;
    - espaces françaises posées **dans les messages** : espace fine insécable (U+202F) devant « ? », « ! », « ; », insécable (U+00A0) devant « : » et à l'intérieur des « » ; apostrophe typographique ’ ;
    - liens dans le texte : zone cliquable d'au moins 24 px sans changer l'interligne (`padding-block: 0.25em`).
  - **Couleurs** : jetons existants uniquement (`anti-hex:check`). Surfaces sombres : `.sur-sombre` (mocha) et `.sur-terracotta` pour des liens et anneaux de focus lisibles.
  - Tout est composant serveur ; aucun `"use client"`, aucun JavaScript ajouté (sommaire, FAQ, menu : `<details>` natifs ; « Copier le lien » garde son îlot existant).
- **Tests** :
  - rendu de chaque composant ;
  - **en-tête** : aucun fichier de `src/components/nav/` modifié sauf `Breadcrumbs.tsx` ; `Header.budget.spec.ts` et `entete-terracotta.spec.tsx` verts ; le rendu du gabarit ne contient ni `<main>` ni `header[data-tone]` ;
  - **héros** : `header.heros` porte `.sur-terracotta` ; les paires de contraste du héros sont dans `check-contrast.ts` et passent ;
  - **photo** : `.visuel__cadre img` présent avec `fetchpriority="high"` et `loading="eager"`, aucun `<svg>` dans le cadre ; sans `featuredImage`, la photo de repli est rendue ; chaque entrée de `photos-repli.ts` existe dans `public/images/` en `.webp` **et** `.avif` et n'a ni « infographie » ni chiffre dans son nom ; `generateMetadata` identique avec et sans repli ;
  - **actions** : un seul `aside.action` par page, avec ses 3 liens et des `aria-label` qui contiennent le texte visible ; aucune mention Qualiopi sans identité publiée ;
  - **vidéo** : sans vidéo publiée, aucun `.encart-video` ; avec vidéo, un seul lien vers `/fr/videos/<slug>`, aucun `<iframe>`, aucun `<video>`, aucun `VideoObject`, identifiant de titre unique ;
  - **garde des interdits** sur `actions.*`, `commun.*` et chaque `<code>.*` : aucun prix, « Grenoble », « frais de déplacement », « témoignage », « avocat », « réserver » / « réservation » ;
  - CSS : **`/fr/contact` et l'accueil identiques à l'octet** avant/après, et page d'article ≤ +12 Ko gz ;
  - `bundle:check` vert ;
  - HTML v1 interrupteur coupé identique, hors `<style>` ;
  - `anti-hex`, `use-client:check`, `radius:check` et `check-i18n` verts.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route. Ici : la photo sous le titre est l'élément LCP probable (ratio réservé, `fetchPriority="high"`, AVIF/WebP) ; le signe du héros, la méta et le H1 ont des boîtes indépendantes de la police (CLS) ; zéro JS ajouté. Le First Load JS par route n'est mesuré par aucune gate : mesure manuelle avant/après sur `/fr/blog/[slug]`, écrite dans la PR. Toute dégradation = STOP & ASK Will + ADR.

---

## G1 — Gabarit Analyse (défaut et repli)

- **Branche** : `feat/gabarits-articles-g1-analyse`
- **Fichiers touchés** : `src/components/article-v2/gabarits/GabaritAnalyse.tsx`, `src/styles/article-v2/analyse.css`, `src/messages/gabarits/analyse.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/analyse.html`.
  - Haut de page : `HerosArticle` (pastilles « Analyse » + catégorie, signe « 4 sem. » avec ses barres, décor), `PhotoArticle`, « En bref ».
  - Corps : sommaire H2+H3 ; numéros « 04 / 07 » au-dessus des H2 ; « Revenir au sommaire » au-delà de 2 500 mots ; relances « Dans la suite » ; schéma constat → causes → leviers, chiffre clé et citation **seulement** s'ils viennent du corps balisé par le générateur (`BALISAGE-ENCADRES.md`).
  - `CtaMilieu` après la 3e section : bouton principal « Diagnostic IA, 45 min », lien « Voir le déroulé de la Journée IA ».
  - Fin de page conforme PLAN §4 : résumé « Ce qu'il faut retenir », FAQ, encart vidéo (si vidéo publiée), sources, carte auteur, badge Qualiopi, mention IA, partage ; puis hors article « Aller plus loin », « À lire aussi », guide gratuit, `CtaFin`.
  - C'est aussi le rendu de repli de tous les autres gabarits tant qu'ils ne sont pas livrés : le garder robuste (tableaux, FAQ absente, image absente → photo de repli, aucune citation).
- **Tests** : règle commune ; rendu avec/sans FAQ, sans `featuredImage` (photo de repli, jamais de SVG), sans citation ; articles en fichiers (`source !== "db"`) ; seuil de 2 500 mots.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle, écrite dans la PR). Photo = LCP probable (dimensions fixes, `fetchPriority="high"`, AVIF/WebP) ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

## G2 — Gabarit Guide pratique

- **Branche** : `feat/gabarits-articles-g2-guide`
- **Fichiers touchés** : `GabaritGuide.tsx`, `src/styles/article-v2/guide.css`, `src/messages/gabarits/guide.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/guide.html`.
  - Héros terracotta, signe « frise 1 → 6 » ; fiche pratique sous le titre (durée, niveau, matériel) **seulement** si ces champs existent en métadonnées.
  - « Avant de commencer » : check-list à cases vides, si le corps débute par des prérequis, sinon rien. Bandeau mocha « Le parcours en un coup d'œil ».
  - `ArticleEtapes` à partir de `parseStepsFromBody` : pastilles géantes « Étape n sur N » avec jauge, durée par étape si présente ; sommaire = étapes.
  - Pour `calculator_roi` : formule en `code`/`pre` (Inconsolata, sous la ligne de flottaison) et tableau des scénarios via `TableauDefilant` ; **aucun prix, aucun calculateur interactif**.
  - Résumé de fin en check-list « Vous avez terminé si… ».
  - `CtaMilieu` et `CtaFin` mettent en avant la **Journée IA** (bouton terracotta, lien « ou un Diagnostic IA, 45 min »).
- **Tests** : règle commune ; rendu avec 0, 1 et 5 étapes (sans étapes → mise en page Analyse) ; `calculator_roi` sans aucun montant ajouté par le gabarit.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle, écrite dans la PR). Photo = LCP probable ; jauges et pastilles en CSS pur ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

## G3 — Gabarit Comparatif

- **Branche** : `feat/gabarits-articles-g3-comparatif`
- **Fichiers touchés** : `GabaritComparatif.tsx`, `src/styles/article-v2/comparatif.css`, `src/messages/gabarits/comparatif.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/comparatif.html`.
  - Héros terracotta, signe « A ou B ». Photo : jamais l'infographie employée par la maquette (`…-infographie.webp`) ; photo de l'article ou de repli.
  - Phrase de neutralité (`.neutralite`, `data-aeo="neutrality"`) puis face-à-face A / « ou » / B en tête (`.duel`, `role="group"`).
  - Premier tableau du corps remonté dans « En bref » (extraction serveur du premier `<table>`, retiré du corps pour éviter le doublon) ; `TableauVisuel` à coches et croix (texte « Oui » / « Non » / « Partiel » dans le DOM, vrai `<table>`, première colonne collante) ; entrée « Tableau récapitulatif » au sommaire ; surtitre « Alternatives à … » pour `alternative_to`.
  - Points forts / limites en deux colonnes, cartes « Pour qui ? », arbre de décision en 3 questions, verdict « ça dépend de… ». Aucun « gagnant », aucune note, aucun prix.
  - `CtaMilieu` : bouton « Diagnostic IA, 45 min », lien « Écrire un message ».
- **Tests** : règle commune ; sans tableau → pas de bloc « En bref » tabulaire ; tableau unique non dupliqué ; défilement horizontal à 320 px sans débordement de page ; contraste de l'en-tête de tableau (≥ AA).
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle, écrite dans la PR). Photo = LCP probable ; tableau défilant sans JS ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

## G4 — Gabarit Sélection (top X)

- **Branche** : `feat/gabarits-articles-g4-selection`
- **Fichiers touchés** : `GabaritSelection.tsx`, `src/styles/article-v2/selection.css`, `src/messages/gabarits/selection.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/selection.html`.
  - Héros terracotta, signe « 10 » ; phrase de neutralité ; critères de sélection en grandes pastilles.
  - Chaque option devient une `CarteSelection` (`.tache` : numéro géant Fraunces, « n sur N », rubriques pour qui / points forts / limites). Compteur CSS (aucun JS) limité aux H2 des options (pas à « FAQ », « Sources »).
  - Bandeau mocha « Par où commencer ? » à mi-liste ; tableau de synthèse (si présent) en résumé de fin, sans aucune note inventée.
  - `CtaMilieu` : bouton principal **Journée IA** (terracotta), lien « Diagnostic IA, 45 min ».
- **Tests** : règle commune ; compteur limité aux options ; 3 et 10 options ; lecteur d'écran : le numéro CSS ne duplique pas un numéro textuel déjà présent dans le titre.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle, écrite dans la PR). Photo = LCP probable ; numéros par compteur CSS ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

## G5 — Gabarit Étude de cas

- **Branche** : `feat/gabarits-articles-g5-cas`
- **Fichiers touchés** : `GabaritCas.tsx`, `FicheContexte` (usage), `src/styles/article-v2/cas.css`, `src/messages/gabarits/cas.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/etude-de-cas.html`.
  - Héros terracotta, signe « avant → après », pastille « cas illustratif ».
  - `FicheContexte` en carte mocha, alimentée **uniquement** par les métadonnées existantes (secteur, taille si présente, ville via `getVille`, catégorie) ; champs absents omis ; tampon « Exemple type, pas un client » si l'article n'est pas un cas client vérifié.
  - `Frise` Avant / Pendant / Après **sans chiffre** ; « Ce que l'équipe a appris » ; résumé de fin = frise compacte.
  - **Interdit** : encadré de résultats chiffrés, mise en valeur d'un témoignage, citation attribuée, tout chiffre extrait du corps.
  - `CtaMilieu` : bouton principal **Journée IA** en terracotta (la maquette le dessine en `btn--bleu` : on suit la règle PLAN §15.3, Journée IA = terracotta), lien « Diagnostic IA, 45 min ».
- **Tests** : règle commune ; fiche sans ville ni secteur ; test de garde : le rendu ne contient aucun `<strong>` de chiffre généré par le gabarit, ni le mot « témoignage ».
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle, écrite dans la PR). Photo = LCP probable ; frise en CSS ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

## G6 — Gabarit Définition

- **Branche** : `feat/gabarits-articles-g6-definition`
- **Fichiers touchés** : `GabaritDefinition.tsx`, `BlocDefinition` (usage), `src/styles/article-v2/definition.css`, `src/messages/gabarits/definition.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/definition.html`.
  - Héros terracotta, signe « RAG. » (le terme). Bloc définition qui chevauche le héros : terme géant, prononciation et sigle développé **seulement** s'ils existent en métadonnées, réponse directe dans `<dfn>` (balisage `aside.en-bref` conservé, sans double cadre).
  - Carte « En une phrase / En pratique / À ne pas confondre avec » ; photo réduite (même fichier, `sizes` plus petit, crédit conservé) à côté de la fiche du terme sur grand écran.
  - Sommaire masqué sous 4 entrées ; « Termes liés » en pastilles via `TermesGlossaireLies` ; lien vers `/glossaire`.
  - `CtaMilieu` : bouton principal « Diagnostic IA, 45 min », lien « Le glossaire complet ».
- **Tests** : règle commune ; 2 et 5 entrées de sommaire ; sans termes liés ; sans prononciation ni sigle.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle, écrite dans la PR). Ici la photo réduite n'est probablement pas le LCP (le terme géant l'est) : garder quand même ses dimensions réservées et `sizes` réduit ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

## G7 — Gabarit Questions-réponses

- **Branche** : `feat/gabarits-articles-g7-faq`
- **Fichiers touchés** : `GabaritFaq.tsx`, `src/styles/article-v2/faq.css`, `src/messages/gabarits/faq.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/faq.html`.
  - Héros terracotta, signe « ? ». La FAQ est le corps : `ArticleFaq` remonte après la réponse directe, première question ouverte (`premiereOuverte`), niveau de titre cohérent ; sommaire = questions ; photo comme les autres gabarits (de l'article ou de repli).
  - Grille mocha « Les N questions, par thème » (porte d'entrée, le sommaire reste le seul `<nav>`) ; thèmes en pastilles **si** le générateur fournit des thèmes, sinon une seule liste. Couleurs de thème fixées pour tout le site (plum, sage ; le thème « Cadre légal » de la maquette est en primary-soft : **à revoir avec Will** au même titre que le bleu du Diagnostic).
  - Cartes `<details>` numérotées ; encart « Votre question n'est pas là ? » après la 4e question : bouton principal **Écrire un message** (contour), lien « ou un Diagnostic IA, 45 min ».
  - Pour `qa_derived` : appliquer `abaisserH1` et vérifier qu'aucun `<script type="application/ld+json">` ne survit dans le corps (sinon double FAQPage/QAPage) ; **mesurer d'abord sur un article réel**.
- **Tests** : règle commune ; `qa_derived` avec H1 et JSON-LD dans le corps → un seul h1 et zéro script dans le corps ; une seule `FAQPage` émise ; chaque `Question.name` présent dans `[data-faq-q]`.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle, écrite dans la PR). Photo = LCP probable ; `<details>` natifs, aucun script d'accordéon ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

## G8 — Gabarit Chiffres (baromètre)

- **Branche** : `feat/gabarits-articles-g8-chiffres`
- **Fichiers touchés** : `GabaritChiffres.tsx`, `src/server/content-gen/blog/charger-releve.ts` (nouveau : lit le `BarometerSnapshot` rattaché à l'article ; **la clé de jointure est à établir d'abord** en lisant `generators/barometer-insight.ts` — l'`inputPayload` du job — sans changer le schéma ; absence de relevé → `null`, tolérant au Proxy `stub.invalid`), `BandeauDonnees` (usage), `src/styles/article-v2/chiffres.css`, `src/messages/gabarits/chiffres.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/chiffres.html`.
  - Héros terracotta, signe « ≈ 10 % » ; dans le héros, bandeau du relevé « Données au <date> » + sources + lien « Voir l'Observatoire » vers `/fr/observatoire-ia` (et non `/fr/observatoire`, qui n'existe pas), **seulement** si la date du relevé est disponible.
  - Photo : celle de l'article ou de repli ; jamais la photo de la maquette dont le nom annonce un chiffre (`…-45-pourcent-…`).
  - `RangeeChiffres` (chiffres géants) et barres horizontales CSS **uniquement** à partir du relevé structuré, valeur écrite en texte, piste en `aria-hidden` ; jamais par expression régulière du HTML. Encadré « Comment lire ces chiffres » (champ, période, échantillon). Le bandeau « chiffres d'illustration » de la maquette (`.bandeau-fictif`) n'existe pas en production.
  - Sans donnée structurée : rendu Analyse avec le bandeau (s'il a une date). Contraste : mocha + ivoire (13,70:1).
  - `CtaMilieu` : bouton principal **Journée IA** en terracotta (la maquette le dessine en `btn--bleu`), lien « Diagnostic IA, 45 min ».
- **Tests** : règle commune ; avec et sans relevé ; aucun chiffre rendu qui ne vient pas de la donnée structurée.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle, écrite dans la PR). Photo = LCP probable ; barres en CSS pur, aucune bibliothèque de graphiques ; la lecture du relevé reste serveur ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

---

## A1 — Actualités (`/actualites/[slug]`) — révisée v3

- **Branche** : `feat/gabarits-articles-a1-actualites`
- **Fichiers touchés** : `src/app/[locale]/actualites/[slug]/page.tsx` (insertion unique avant le `return (`, derrière `gabaritsV2Actifs()`, sur le même principe que S1) ; `src/components/article-v2/gabarits/GabaritActualite.tsx` et `TriptyqueActualite.tsx` (nouveaux) ; `src/styles/article-v2/actualite.css` ; `src/messages/gabarits/actualite.{fr,en}.json` ; tests.
- **Consigne** : maquette `maquettes-v2/actualite.html`.
  - En-tête du site : celui du layout, rien à faire. Héros terracotta : date du jour en évidence (`.date-une`, chiffre décoratif `aria-hidden`, la date lisible reste dans `<time>`), source d'origine en pastille, signe « Art. 4 » (ou équivalent tiré des métadonnées, sinon aucun signe).
  - Photo sous le titre : `article.featuredImage` (déjà rendue aujourd'hui seulement si elle existe) ou photo de repli `actualite` de `photos-repli.ts`.
  - Triptyque « Ce qui change / Pour qui / Que faire maintenant » qui reprend le « Point clé » existant (`data-aeo` conservé) ; encadré « Source d'origine » avec lien et date (`newsSourceName` / `newsSourceUrl`) ; frise des dates **si** l'article en fournit. Article court : pas de résumé de fin, le triptyque en tient lieu.
  - `ColonneActions` avec `depuis=actualite-colonne` ; `CtaMilieu` (bouton « Diagnostic IA, 45 min », lien « Écrire un message ») et `CtaFin`. La capture e-mail existante (`ArticleNewsletterInline`, `source="actualites-fin-article"`) reste la seule de la page.
  - Encart vidéo : `/actualites` n'est pas une page hôte aujourd'hui (`GABARITS_HOTES`, `apres-publication.ts`) ; l'encart n'y est rendu qu'une fois les hôtes étendus (PR E6 de la conception vidéo), sinon rien.
  - `<article>` englobe désormais l'en-tête et les sources, pas seulement le corps. Le badge « Brève (non indexée) » n'est plus affiché au public ; le `noindex` lui-même ne change pas.
  - Le JSON-LD (`NewsArticle`, `BreadcrumbList`), les metadata, `og:image` et l'URL restent identiques.
- **Tests** : règle commune ; interrupteur coupé → HTML identique ; un seul `aside.action` ; photo présente avec et sans `featuredImage` ; `NewsArticle` inchangé ; brève non indexée toujours `noindex` ; aucun encart vidéo tant que `/actualites` n'est pas hôte.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle sur `/fr/actualites/[slug]`, écrite dans la PR). Photo = LCP probable (dimensions fixes, `fetchPriority="high"`, AVIF/WebP) ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

## GU1 — Guides pilier (`/guides/[slug]`) — révisée v3

- **Branche** : `feat/gabarits-articles-gu1-guides`
- **Fichiers touchés** : `src/app/[locale]/guides/[slug]/page.tsx` (insertion unique avant le `return (`, derrière `gabaritsV2Actifs()`) ; `src/components/article-v2/gabarits/GabaritGuidePilier.tsx` et `BandeauChapitre.tsx` (nouveaux) ; `src/styles/article-v2/guide-pilier.css` ; `src/messages/gabarits/guide-pilier.{fr,en}.json` ; tests.
- **Consigne** : maquette `maquettes-v2/guide-pilier.html`.
  - En-tête du site : celui du layout. Héros terracotta avec **auteur et dates visibles en tête** (écart E-E-A-T corrigé par la maquette), signe des 7 jalons.
  - Photo sous le titre : `guide.featuredImage` (ratio 16/10, et non plus 16/9 comme la page actuelle) ou photo de repli `guide-pilier`.
  - Sommaire en grille de chapitres avec progression (`--p` en style en ligne, décor) et durée totale ; bandeaux de chapitre mocha / terracotta en alternance « Chapitre n sur N » (durée, temps restant, « Aller au chapitre suivant » avec le numéro masqué visuellement).
  - Étapes structurées : les ids `step-N` sont conservés. Feuille de route finale en résumé de fin. FAQ et sources ramenées **dans** l'article.
  - Mise en page ordinateur propre à ce gabarit : le sommaire reste dans la colonne de lecture, la carte d'action colle en haut de la colonne droite.
  - Deux `CtaMilieu` : « Diagnostic IA, 45 min » (lien « Le guide IA entreprise, 40 pages »), puis Journée IA en terracotta (la maquette le dessine en `btn--bleu`), lien « Écrire un message ». « Téléchargez le guide » : réutiliser `ArticleNewsletterInline` (`source="guides-fin-article"`), sans nouveau formulaire.
  - Encart vidéo : comme A1, seulement une fois `/guides` déclaré hôte (E6) ; sinon rien.
  - Corriger au passage, **seulement si le propriétaire valide** : les articles liés codés en dur en `/blog/` → route résolue (`segmentForArticleType`, supprime des 308) ; l'affichage de l'auteur et des dates.
  - `HowTo.totalTime` (rempli avec le temps de lecture) : signalé, traité dans J1 ou F1.
- **Tests** : règle commune ; interrupteur coupé → HTML identique ; ids `step-N` inchangés ; photo présente avec et sans `featuredImage` ; un seul `BreadcrumbList` une fois F1 fusionnée.
- **Budget Web Vitals (AGENTS.md)** : LCP ≤ 1 800 ms p75 · INP ≤ 100 ms p75 · CLS = 0 · TBT ≤ 150 ms · First Load JS ≤ 75 KB gz par route (aucune gate : mesure manuelle sur `/fr/guides/[slug]`, écrite dans la PR). Photo = LCP probable ; passage de 16/9 à 16/10 sans saut (ratio réservé) ; barres de progression en CSS ; aucun `"use client"`. Dégradation = STOP & ASK Will + ADR.

---

## J1 — Données structurées (enrichissements)

- **Branche** : `feat/gabarits-articles-j1-jsonld`
- **Fichiers touchés** : `src/lib/seo-content-gen-factories.ts` (+ `HowTo` : paramètre `urlSegment`) ; `src/lib/seo/*` (nœud `WebPage`, `ItemList`) ; `src/components/seo/ArticleTOC.tsx` (`@id` de l'`ItemList`, **seule** modification autorisée ici) ; `src/components/content-gen/ArticleFaq.tsx` (`@id`) ; tests unitaires JSON-LD ; E2E `tests/e2e/flows/seo-jsonld.spec.ts` et `tests/e2e/content-gen/blog-article.spec.ts` (accepter {Article, BlogPosting, NewsArticle, TechArticle}).
- **Consigne** : appliquer PLAN §8, **derrière `gabaritsV2Actifs()`** : interrupteur coupé → graphe identique à aujourd'hui. Conserver tous les `@id` existants. Chaque ajout a son pendant visible ; jamais `Review`/`AggregateRating`/`Product` ; `HowTo` seulement si ≥ 2 étapes rendues.
- **Tests** : par famille : un seul nœud article `#article`, un `BreadcrumbList`, au plus une `FAQPage`, aucun `@id` divergent, aucun `Person` sans `@id` ; parité visible ↔ JSON-LD (`HowToStep.name`, `ItemList.name`, `Question.name`) ; `dateModified` (jour) = `<time>` « Mis à jour » = `article:modified_time` ; interrupteur coupé → graphe strictement identique.

## F1 — Correctif `BreadcrumbList` en double sur `/guides/[slug]` (hors interrupteur)

- **Branche** : `fix/guides-breadcrumb-jsonld-double`
- **Fichiers touchés** : `src/app/[locale]/guides/[slug]/page.tsx` (`emitJsonLd={false}` sur `<Breadcrumbs>` **ou** retrait du `JsonLd` l. ≈ 205) ; test.
- **Consigne** : la page `/guides/[slug]` est **autonome** (ses propres `JsonLd` et `Breadcrumbs`) : l'interrupteur `BLOG_GABARITS_V2` ne la couvre pas. Ce correctif SEO change donc le graphe de cette page, indépendamment de l'interrupteur, et doit être validé par le propriétaire. Un seul `BreadcrumbList` (avec « Accueil », `@id` `#breadcrumb`).
- **Tests** : la page émet exactement un `BreadcrumbList`.

## T1 — Garde-fous de test et de mesure

- **Branche** : `feat/gabarits-articles-t1-garde-fous`
- **Fichiers touchés** : un **projet Playwright dédié** (ou serveur de test séparé) lancé avec `BLOG_GABARITS_V2=true`, pour ne pas changer le comportement des E2E existants (`blog-article.spec.ts`) ; `tests/e2e/a11y.spec.ts` (ajouter 2-3 articles de blog à `STRATEGIC_PATHS` : un avec tableau, un avec FAQ et encadrés, un sans image) ; `tests/e2e/content-gen/blog-a11y.spec.ts` (nouveau) ; `scripts/perf/first-load-route.cjs` (script de mesure du PLAN §7) ; `scripts/check-contrast.ts` (paires d'article manquantes : en-tête de tableau, FAQ, encadrés, anneau de focus ≥ 3:1) ; `.github/workflows/deploy-coolify.yml` + `lighthouserc.postdeploy*.json` (URL d'article **en `warn`** seulement, après décision humaine).
- **Consigne** : tests `@a11y` sur le modèle de `tests/e2e/qualiopi/_harness/audit-page.ts` : axe complet ; axe à 320 px ; `scrollWidth <= clientWidth` ; injection de l'espacement du texte (1.4.12) ; Tab sur le premier lien du corps puis vérifier qu'il n'est pas sous l'en-tête collant (2.4.11) ; `emulateMedia({ reducedMotion: "reduce" })` ; `emulateMedia({ forcedColors: "active" })` puis contour de focus non nul ; clavier sur `<summary>` du sommaire et de la FAQ. Ces tests tournent interrupteur allumé (variable d'environnement du serveur de test).
- **Tests** : ces fichiers _sont_ les tests ; vérifier qu'ils échouent sur une mutation volontaire (par exemple retirer `tabindex` d'un tableau).

---

## Mise en production (hors PR, décision humaine)

1. Fusionner S1, S3, S2, puis G1…G8, A1, GU1, J1, T1 (et F1 si validé) ; l'interrupteur reste coupé : le balisage de la prod est inchangé.
2. Sur un environnement de préproduction : `BLOG_GABARITS_V2=true`, relire un article de chaque famille, mesurer (PLAN §7).
3. Activer en production (Coolify, portée RUN, redémarrage) à un créneau de déploiement ; contrôle d'un article par famille. **Effet progressif** : les pages pré-rendues au build gardent le HTML V1 jusqu'à leur revalidation (≤ 1 h) ; la purge Cloudflare ne régénère pas le cache ISR (voir PLAN §9).
4. Retour arrière : retirer la variable (ou la passer à `false`), redémarrer, purger.
