# Refonte des gabarits d'articles du blog — PLAN (phase 1 : conception)

Statut : conception uniquement, aucun code produit sous `src/` ni `prisma/`.
Branche : `feat/gabarits-articles-conception`, puis `docs/gabarits-articles-v2-visuel` (révision visuelle v2). Découpage des PR : `DECOUPAGE.md`.

> **Révision v2 du 2026-11-27 : la référence visuelle est désormais `maquettes-v2/index.html`.** Les maquettes v1
> (`maquettes/`) ont été refusées par le propriétaire (« manque de peps, de contraste, d'encadrés ; trop
> textuel ; des boutons bien visibles sur le côté ; le but : des prospects et de la visibilité »). Elles restent
> dans le dépôt pour l'historique, mais ne servent plus de référence. Ce qui change est décrit au **§15**. Le
> reste du plan reste valable (interrupteur, type de contenu, JSON-LD, tests), sauf mention contraire au §15.

> **Révision v3 du 2026-11-27 : les maquettes v3 validées par Will (PR #2423) remplacent la v2, dans le même
> dossier `maquettes-v2/`.** En-tête réel du site réutilisé, héros terracotta, vraie photo sous chaque titre,
> boutons latéraux, encart vidéo : voir le **§15.9**, qui prime sur le reste du §15. La branche
> `feat/gabarits-articles-s2-composants` (design v2) est abandonnée : S2 repart de `main` (`DECOUPAGE.md`).

## 1. Contraintes (non négociables)

1. **Images** : aucun changement de la sélection des images (une autre PR s'en occupe) ni de l'attribution du photographe Unsplash (`UnsplashCredit`, `resoudreImagePartageArticle`, `featuredImage*`). Les gabarits ne font que _placer_ l'image existante. **Révision v3** : quand un article n'a aucune image (`featuredImage` nul), le gabarit v2 affiche une photo de repli tirée de la banque d'images du site (§15.9) ; la sélection des images existantes, `og:image` et le JSON-LD ne changent pas.
2. **Prisma** : aucun changement de schéma, aucune migration. Le type de contenu se lit par `Article.generatedByJobId` → `ContentGenJob.contentType` (requête supplémentaire, sans relation Prisma).
3. **Interrupteur `BLOG_GABARITS_V2`** : `"true"` = nouveaux gabarits ; toute autre valeur (absente, `"false"`, vide) = page actuelle **au balisage identique** (même HTML qu'aujourd'hui, hors `<style>`), sans requête supplémentaire. Seule la feuille CSS commune, inlinée dans toutes les pages, peut grossir (≤ 2 Ko gz) ; toute règle ajoutée est **bornée** à `[data-gabarit]` ou `html:has([data-gabarit])` pour ne rien changer au rendu V1. Lecture au rendu côté serveur (jamais `NEXT_PUBLIC_`). Retour arrière = repasser la variable à autre chose que `true` et redémarrer (puis purge : `revalidate = 3600` + Cloudflare).
4. **Anglais** : la locale EN reste désactivée (301 vers FR). Tous les textes visibles des nouveaux composants passent par le système de traduction existant (`next-intl`, `src/messages/fr.json` et `src/messages/en.json`), jamais en dur.
5. **Performance** : aucun JavaScript client ajouté sans nécessité (voir §7). Aucun cliquet `size-limit` relevé.
6. **SEO** : `generateMetadata`, URL, slugs, canonical, hreflang, `og:image`, redirections (`guide-*` → `/guides`, `isNews` → `/actualites`), tombstone, historique de slugs : **inchangés**.
7. **Contenu** : pas de prix, pas de donnée client, pas de chiffre inventé. Le gabarit ne met jamais en valeur un chiffre ou un témoignage qui ne vient pas d'une donnée structurée vérifiée.
8. **Marque** : la couleur de marque est le **terracotta** (révision v3, décision de Will), sur ivoire et mocha, avec Manrope / Fraunces / Inconsolata. Le bleu `--color-primary` reste un jeton du site (liens, bouton « Réserver un appel » de l'en-tête réel), jamais une couleur de marque (§15.9). Uniquement les jetons existants de `src/app/globals.css` (le contrôle `anti-hex:check` interdit les hexadécimaux en dur dans `src/`).

## 2. État actuel (constats)

- Un **seul gabarit** sert tous les types (`src/app/[locale]/blog/[slug]/page.tsx`, 863 lignes) : mêmes blocs conditionnels pour tout.
- `BlogArticleView` n'expose pas le type de contenu.
- Défauts de mise en page : `Section`/`Container` imbriqués dans une colonne de grille (marges doublées) ; trois largeurs de lecture (`max-w-3xl`, `52rem`, `52rem text-lg` ≈ 90-95 caractères par ligne, au-delà des 75 visés) ; H2 du corps fixes à `2.1rem` (trop grands à 360 px) ; bandeau « Mis à jour » redondant avec la ligne de métadonnées ; liens du sommaire ≈ 32 px de haut ; sommaire limité aux H2 ; badge Qualiopi, auteur et partage placés **avant** la FAQ et les sources.
- Accessibilité : tableaux en `display:block` (sémantique perdue, zone défilante non focusable) ; `<details>` du sommaire mobile hors de tout `<nav>` ; `alt` de l'image principale = titre (doublon du h1) ; pas de `scroll-padding-top` sur `html` ; focus bleu invisible sur surfaces mocha/terracotta.
- JSON-LD : voir §8 (un `ItemList` « Sommaire » sans `@id`, graphe non relié, doublon `BreadcrumbList` sur `/guides/[slug]`).

## 3. Familles de gabarits et correspondance ContentType → gabarit

Huit gabarits (code `data-gabarit`). **v2 : l'actualité (`/actualites/[slug]`) et le guide pilier (`/guides/[slug]`) entrent dans le périmètre visuel** (voir §15.5) : ce sont des pages autonomes, donc couvertes par le même interrupteur mais pas par cette table.

| Gabarit                | Code         | ContentType                                                                                                          |
| ---------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Analyse** (défaut)   | `analyse`    | `blog_article`, `blog_from_keywords`, `blog_from_title`, `long_tail_keyword`, `pain_point_solution`, `landing_ville` |
| **Guide pratique**     | `guide`      | `how_to_x_in_y`, `calculator_roi`, `guide_pilier`                                                                    |
| **Comparatif**         | `comparatif` | `comparison`, `vs_comparator`, `alternative_to`                                                                      |
| **Sélection** (top X)  | `selection`  | `top_x_in_y`, `best_for_x_in_y`                                                                                      |
| **Étude de cas**       | `cas`        | `case_study_local`                                                                                                   |
| **Définition**         | `definition` | `what_is_x`, `glossary_term`                                                                                         |
| **Questions-réponses** | `faq`        | `faq_standalone`, `faq_geo`, `qa_derived`                                                                            |
| **Chiffres**           | `chiffres`   | `barometer_insight`                                                                                                  |
| _Actualité_            | `actualite`  | `blog_from_rss` : reste sur `/actualites/[slug]` (redirection 308 existante) ; habillage v2 par la PR A1 (§15.5)     |

Toute la table est un `Record<ContentType, GabaritArticle>` **exhaustif** : l'ajout d'une valeur d'énumération casse la compilation (et un test le vérifie).

**Repli** (type `null` : articles saisis en console, articles en fichiers) : heuristique pure sur le HTML, appliquée **uniquement** au repli : tableau d'au moins 3 lignes → Comparatif ; liste numérotée d'au moins 3 étapes → Guide ; sinon Analyse.

### Arbitrages (tranchés avec le critique design)

| Sujet                                                     | Décision                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glossary_term` : `/glossaire` ou `/blog` ?               | Le routage actuel ne change pas (hors périmètre) : l'article reste sur `/blog` avec le gabarit Définition, qui ajoute un lien vers `/glossaire`. L'incohérence de `resolve-article-route.ts` est notée comme point ouvert pour le propriétaire.             |
| `calculator_roi`                                          | Rendu « méthode de calcul » dans le gabarit Guide : formule mise en valeur, tableau des scénarios défilant. Aucun calculateur interactif (budget JS) et aucun prix.                                                                                         |
| `case_study_local`                                        | Pas d'encadré « résultats chiffrés » ni de « témoignage » mis en valeur : le générateur les demande mais ils ne sont pas vérifiables. Fiche « Contexte » tirée des seules métadonnées existantes. Point signalé : à revoir côté générateur (hors chantier). |
| `qa_derived`                                              | Le corps peut contenir un H1 et un JSON-LD QAPage : abaissement du H1 en H2 au rendu (transformation serveur), et vérification qu'aucun `<script>` JSON-LD ne survit dans le corps. À mesurer sur un article réel avant livraison du gabarit FAQ.           |
| `landing_ville`                                           | Plus généré ni servi sur `/blog` : repli sur Analyse.                                                                                                                                                                                                       |
| Image : à droite du titre (ordinateur) ou sous (mobile)   | Retenu. Mobile : sous la ligne de métadonnées, pleine largeur. Ordinateur : à droite du titre, ratio 16/10 réservé. Seule la position change.                                                                                                               |
| Image prioritaire : `priority` ou `fetchPriority` ?       | Next 16 déprécie `priority` au profit de `preload`, mais la doc le déconseille quand le LCP change selon l'écran (sur mobile le LCP est probablement le h1 ou le chapô). Retenu : `loading="eager"` + `fetchPriority="high"`, `sizes` corrigé.              |
| Sommaire : `<details>` + `<nav>` (a11y) vs pas de doublon | Deux `<nav aria-label="Sommaire">` : un `<details>` replié (mobile) et un rail collant (ordinateur), l'un masqué par `display:none` selon la largeur (donc absent de l'arbre d'accessibilité). Deux listes dans le DOM, pas trois. Aucun JavaScript.        |
| Suivi de la section active (scroll-spy)                   | Non retenu en V1 des gabarits. Option sans JS en amélioration progressive : `scroll-target-group` + `:target-current` (Chromium). Un îlot client n'est admis que s'il pèse < 1 Ko gz (modèle `ObservateurBarreGuide`) et après décision explicite.          |
| JSON-LD : parité d'abord ou enrichissement                | Parité d'abord : les PR de gabarits **n'altèrent pas** le graphe JSON-LD. Les enrichissements (WebPage, HowTo, ItemList…) viennent dans une PR dédiée, derrière le même interrupteur (voir §8).                                                             |
| Formulaire newsletter (≈ 24 Ko gz de JS)                  | Chargement différé = décision produit (texte validé par le propriétaire). Non inclus ; signalé comme première économie possible.                                                                                                                            |
| Réponse directe (`AnswerCard`)                            | Les maquettes la restylent (bordure 2 px encre, filet terracotta) : `AnswerCard` reçoit une prop `variante="v2"` (V1 intacte), les attributs `data-aeo="tldr"` et la classe `.tldr-answer` sont conservés.                                                  |
| Image en mobile (avant ou après la réponse directe)       | Conservée avant (repère visuel) ; à re-trancher d'après la mesure du LCP mobile après mise en ligne (option : image après la réponse directe).                                                                                                              |
| Mode sombre                                               | Le site n'en a pas. On n'en introduit pas ; on déclare `color-scheme: light` pour limiter l'inversion automatique des navigateurs.                                                                                                                          |

## 4. Squelette commun (ordre de lecture = ordre du DOM)

1. Fil d'Ariane (composant existant ; ajouter `py-1` pour des cibles ≥ 24 px quand il passe à la ligne).
2. **En-tête** : surtitre (libellé du gabarit + catégorie) · H1 (`splitTitleEm`) · chapô · **une seule ligne de métadonnées** : auteur · publié le · mis à jour le (seulement si différent) · temps de lecture, avec `<time datetime>`. Le bandeau « Mis à jour » séparé disparaît.
3. **Image** (inchangée : choix, `alt`, `UnsplashCredit`) ; ratio 16/10 réservé.
4. **Réponse directe** (`AnswerCard`, `data-aeo="tldr"`, 40 à 60 mots visés) puis « Point clé » (`ArticleKeyTakeaway`) si présent.
5. **Sommaire** (affiché à partir de 3 `<h2>`, seuil existant de `buildToc` ; sinon construit par le gabarit à partir des questions ou des étapes ; masqué sous 4 entrées pour Définition). Les ancres des H2 ne changent jamais ; celles des H3, questions et étapes sont posées par `ancrerSousTitres` (S3) _après_ `buildToc`.
6. **Corps** (`prose-axionia`, mesure `68ch`).
7. Blocs propres au gabarit (§5).
8. Citation d'expert si réellement renseignée.
9. **FAQ**, puis **Sources et méthode** (un seul encadré : `ArticleSources` + `ArticleTransparencyBlock`).
10. Carte auteur → badge Qualiopi → mention IA → partage → lien ville.
11. Questions associées, articles liés, précédent/suivant.
12. Encart vidéo, newsletter (capture « Guide IA entreprise »), **encart d'action de fin** adapté au gabarit (libellés sans prix, liens déjà utilisés).
13. **v2** : `aside.action[aria-label="Passer à l'action"]`, **hors** `<article>`, placé après lui dans le DOM. Sur ordinateur c'est la carte collante de la colonne droite, sur téléphone la barre fixe du bas (§15.3). Un encart d'action au milieu du corps (`CtaMilieu`) s'ajoute à celui de la fin.

Inchangés : JSON-LD (jusqu'à la PR dédiée), balise `alternate` markdown, barre de progression, attributs `data-aeo` / `data-speakable` / `data-faq-*` (les sélecteurs `speakable` en dépendent).

### Ce que chaque gabarit ajoute

> v2 : les visuels propres à chaque gabarit sont redéfinis au §15.4 ; la liste ci-dessous reste valable pour la logique de données.

- **Analyse** : sommaire H2+H3 (le gabarit reçoit le HTML brut et construit son sommaire ; `buildToc` et le `level: 2` de `page.tsx` ne sont pas modifiés) ; au-delà de 2 500 mots : numéros de chapitre (compteur CSS) et lien « Revenir au sommaire ».
- **Guide** : encadré « Avant de commencer » si le corps débute par des prérequis ; étapes en liste numérotée à pastilles (`ArticleEtapes`, via `parseStepsFromBody` exportée) ; le sommaire = les étapes. CTA audit.
- **Comparatif** : le premier tableau du corps remonté en « En bref », première colonne collante au défilement horizontal ; entrée « Tableau récapitulatif » au sommaire ; aucun « gagnant » ni note inventés. CTA audit.
- **Sélection** : H2 numérotés en grand (compteur CSS, sans JS) ; tableau de synthèse si présent. CTA audit.
- **Étude de cas** : fiche « Contexte » (secteur, ville via `getVille`, catégorie) à partir des métadonnées uniquement. CTA audit.
- **Définition** : bloc `<dfn>` en tête (la réponse directe), image réduite, « Termes liés » (`TermesGlossaireLies`), lien vers `/glossaire`. CTA Journée IA.
- **Questions-réponses** : la FAQ est le corps ; première question ouverte ; sommaire = questions ; pas d'image obligatoire. CTA rendez-vous.
- **Chiffres** : bandeau « Données au <date du relevé> » + lien vers l'Observatoire ; grands chiffres **uniquement** si un composant les reçoit structurés depuis le relevé (jamais extraits du HTML par expression régulière) ; sans donnée structurée, pas de bandeau de chiffres.

## 5. Mobile et ordinateur

**Mobile (< 1024 px)** : une colonne, gouttière 16 px ; sommaire `<details>` replié ; cibles ≥ 44 px (sommaire, questions de FAQ, partage, précédent/suivant) ; tableaux dans un conteneur défilant focusable avec ombre de bord ; aucun défilement horizontal de la page (vérifié sur les 8 maquettes à 360 px).

**Ordinateur (≥ 1024 px)** : grille `15rem | minmax(0, 68ch)` centrée (≈ 70 caractères à 18 px) ; rail de sommaire `position: sticky; top: 6rem; max-height: calc(100dvh - 7rem); overflow: auto` (aucun ancêtre en `overflow: hidden`) ; encadrés pleine colonne ; en-tête avec image à droite.

## 6. Règles de design

**Typographie fluide** (jetons à ajouter dans `@theme`, la grille ADR 0007 reste en place) :

| Élément                              | Valeur                                       | Interligne |
| ------------------------------------ | -------------------------------------------- | ---------- |
| H1 (Fraunces 600)                    | `clamp(2rem, 1.35rem + 2.6vw, 3.25rem)`      | 1,08       |
| Chapô                                | `clamp(1.1875rem, 1.1rem + .4vw, 1.4375rem)` | 1,5        |
| H2 du corps (remplace `2.1rem` fixe) | `clamp(1.5rem, 1.2rem + 1.2vw, 2.125rem)`    | 1,2        |
| H3                                   | `clamp(1.1875rem, 1.1rem + .5vw, 1.5rem)`    | 1,3        |
| Corps (Manrope 400)                  | `clamp(1.0625rem, 1rem + .25vw, 1.125rem)`   | 1,75       |
| Légendes, méta                       | 0,9375 rem                                   | 1,55       |

Polices : **aucune famille, graisse ni style ajouté** (Manrope 400/600, Fraunces 500/600 droit + italique du titre ; Inconsolata uniquement pour formules et code, jamais au-dessus de la ligne de flottaison). Les replis métriques sont manuels : ajouter une graisse décalerait la mise en page.

**Rythme** : paragraphes 1,25 em ; avant un H2 `clamp(2.5rem, 2rem + 2vw, 3.5rem)` ; blocs de fin de page espacés par un seul conteneur `space-y` (fin des `Section`/`Container` imbriqués).

**Couleurs** : ivoire (fond), papier (cartes), sable (encadrés), mocha (bandeaux, CTA), terracotta-deep (surtitres, accents texte), terracotta (filets, boutons), primaire (liens). Fraunces italique réservé à la partie `em` du titre et aux citations.

### Contrastes calculés sur les couleurs réelles (formule WCAG)

| Paire                                                 | Ratio                 | Verdict                                                                                         |
| ----------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| Texte `#1a1815` sur ivoire / papier / sable           | 16,69 / 17,72 / 14,66 | AAA                                                                                             |
| Chapô `#524b41` sur ivoire / papier / sable           | 8,10 / 8,60 / 7,12    | AAA                                                                                             |
| Légendes `#5a4f44` sur ivoire / papier                | 7,50 / 7,96           | AAA                                                                                             |
| Légendes sur sable / sable-deep / terracotta-soft     | 6,59 / 5,84 / 6,40    | AA seulement                                                                                    |
| Lien primaire `#1a4dd9` sur ivoire / papier / sable   | 6,37 / 6,76 / 5,59    | AA ; **soulignement obligatoire** (contre le texte voisin : 2,62:1)                             |
| Lien au survol `#0f3aae` sur ivoire                   | 8,85                  | AAA                                                                                             |
| Terracotta `#b23f16` sur ivoire / papier / sable      | 5,47 / 5,81 / 4,81    | AA (de justesse sur sable)                                                                      |
| Terracotta sur sable-deep                             | **4,26**              | **interdit en texte normal**                                                                    |
| Terracotta-deep `#8c3010` sur ivoire / papier / sable | 7,77 / 8,25 / 6,83    | AAA / AAA / AA : **surtitres et accents texte**                                                 |
| Blanc sur terracotta (bouton)                         | 5,81                  | AA                                                                                              |
| Ivoire `#f7f3ea` sur mocha                            | 13,70                 | AAA                                                                                             |
| Terracotta-on-mocha `#eb8560` sur mocha               | 5,82                  | AA                                                                                              |
| Terracotta, primaire, texte atténué sur mocha         | 2,61 / 2,25 / 1,91    | **interdits**                                                                                   |
| Ochre `#b06a12` sur ivoire                            | **4,02**              | **interdit en texte**                                                                           |
| Bordure `#e5ddc8` / `#c8bda0` sur ivoire              | 1,28 / 1,76           | décoratif seulement                                                                             |
| Contour de composant `#8a7f6c` sur papier / ivoire    | 3,94 / 3,71           | **seul contour autorisé** (≥ 3:1)                                                               |
| Anneau de focus primaire sur ivoire / papier          | 6,37 / 6,76           | OK                                                                                              |
| Anneau de focus primaire sur mocha / terracotta       | **2,25 / 1,16**       | **échec** → jeton `--focus-ring` à surcharger en surface sombre (terracotta-on-mocha ou ivoire) |

Règles : texte courant en `fg` ou `fg-soft` sur ivoire, papier ou sable (AAA) ; jamais d'opacité sur du texte ; jamais de lien sans soulignement ; `terracotta-deep` (et non `terracotta`) pour tout petit texte coloré ; le type d'un encadré reste porté par un libellé texte (pas par la seule couleur).

### Règles d'accessibilité par composant (RGAA 4.1 / WCAG 2.2 AA)

- Un seul `h1` ; aucun saut de niveau (contrôle au rendu, le corps généré peut commencer par un `h3`) ; `<article>` englobe l'en-tête jusqu'aux sources ; FAQ, sources et « Les gens demandent aussi » en `h2`.
- Sommaire : `<nav aria-label="Sommaire">`, `<summary>` natif (pas de bouton `aria-expanded` en JS), `<ol>` imbriqués pour les H3, pastilles numériques `aria-hidden`.
- Tableaux : `display: table` conservé ; conteneur `role="region" tabindex="0" aria-labelledby` (nom), `<caption>`, `scope` ; focus visible sur le conteneur. Même chose pour `<pre>`.
- FAQ : `<details>` natifs ; **padding sur le `<summary>`** (≥ 44 px) ; pas de `h3` dans le `<summary>`.
- Encadrés : pas de `role="note"`/`alert`/`status` ; `<section aria-labelledby>` plutôt que `<aside>` anonyme ; emojis et icônes de pseudo-éléments masqués aux lecteurs d'écran (`content: "…" / ""`).
- Citations : `figure` + `blockquote` + `figcaption` ; `lang` pour les citations dans une autre langue.
- Liens : intitulés explicites (le titre dans le lien, jamais « en savoir plus » seul) ; mention « (nouvelle fenêtre) » masquée visuellement pour `target="_blank"`.
- Image principale : `alt` = texte descriptif réel, **repli `alt=""`** (et non le titre, qui doublonne le h1) — la correction du texte alternatif est portée par la PR d'images, pas par les gabarits.
- Focus : `html { scroll-padding-top: calc(var(--header-total-h) + 1rem) }` (2.4.11) ; `outline-hidden` (et non `outline-none`) quand un `ring` remplace le contour (mode Contraste élevé de Windows) ; en-tête non collant si `max-height: 30rem` (zoom 400 %).
- Mouvement réduit : déjà géré globalement ; aucun nouveau mouvement hors `transform`/`opacity`.
- Cibles : 24 px minimum (2.5.8 AA), **44 px visés** (2.5.5).
- Reflow 320 px, espacement du texte : `overflow-wrap: break-word` étendu aux `h2`–`h4` et `a`, aucune hauteur fixe sur du texte.
- Sanitizer : `caption`, `scope`, `lang` ne sont pas dans la liste blanche. Deux options retenues : envelopper les tableaux **après** le sanitizer (post-traitement serveur) et ajouter `caption`/`scope`/`lang` en liste blanche dans une PR dédiée avec revue de sécurité (frontière anti-XSS).

## 7. Budget de performance

### Mesuré avant (build local de cette session, webpack, `--experimental-build-mode compile`)

Commande : `SKIP_ENV_VALIDATION=true DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub REDIS_URL=redis://stub.invalid:6379 BULLMQ_DISABLED=true SKIP_NEXT_TYPECHECK=true NODE_OPTIONS=--max-old-space-size=8192 pnpm exec next build --webpack --experimental-build-mode compile` (≈ 9 min sur 4 cœurs ; `--webpack` indispensable, la mémoire à 8 Go de tas sinon le noyau tue le worker). Le tableau de Next ne donne pas le First Load ; il a été reconstitué par script (chunks racine + modules client du layout et de la page, gzip -9).

| Route                                | First Load JS (gz)                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `/[locale]/blog/[slug]`              | **249,70 Ko** (21 fichiers ; 214,87 Ko brotli ; 814 Ko bruts)                       |
| accueil / `/blog` / `/contact`       | 234,78 / 231,87 / 258,63 Ko                                                         |
| `guides/[slug]`, `actualites/[slug]` | 249,70 Ko (même First Load ; **pages autonomes**, non couvertes par l'interrupteur) |

Répartition de `/blog/[slug]` : socle App Router 132,54 Ko · chunks du layout 45,03 Ko · partagés layout+page 41,63 Ko · **propres à la page 30,49 Ko** (dont ≈ 24 Ko pour le seul formulaire newsletter de fin d'article).

⚠️ **La cible de 75 Ko gz par route est dépassée d'un facteur ≈ 3,3 sur tout le site** : la dette vient du socle et du layout, pas du gabarit d'article. Cette refonte ne la résout pas et ne doit pas l'aggraver.

`pnpm bundle:check` sur ce build : vert. Shell 126,39 / 139 Ko ; somme des pages publiques 281,45 / 294 Ko (marge 12,55) ; console admin 598,9 / 600 Ko.

Angles morts constatés des garde-fous : (1) la somme « pages publiques » ne compte que les `page-*.js` (0,98 Ko pour l'article) : les 29,5 Ko restants sont dans des chunks numérotés qu'aucune gate ne voit ; (2) aucune URL de blog dans le `lhci` post-déploiement ; (3) le bucket « Shell » somme `framework-*` et `main-*` (Pages Router) et pas le socle App Router (à confirmer sur le HTML servi).

Chiffres de **temps** (LCP, INP, CLS, TBT) : non mesurés avant (le bruit du runner partagé, +13 à +36 % d'un run à l'autre, interdit un avant/après en deux passes ; voir AGENTS.md). Mesure en médiane de 3 runs, après mise en ligne.

### Attendu après

| Indicateur                              | Cible de cette refonte                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| Chunks propres à la page                | **≤ 30,5 Ko gz** (base mesurée), aucune hausse > 1 Ko sans justification |
| First Load total de la route            | **≤ 249,7 Ko gz** (aucune hausse)                                        |
| JavaScript client ajouté                | **0 octet** (tout en composants serveur, `<details>` et CSS)             |
| CSS inliné (≈ 39 Ko gz sur chaque page) | + ≤ 2 Ko gz (la CSS des gabarits est inlinée dans **toutes** les pages)  |
| `bundle:check`                          | vert, **aucun cliquet relevé**                                           |
| CLS                                     | 0 (image `aspect-ratio`, blocs rendus serveur, aucune insertion tardive) |
| LCP / INP / TBT                         | ≤ 1 800 ms / ≤ 100 ms / ≤ 150 ms en médiane (cibles internes AGENTS.md)  |

Règles : composants serveur par défaut ; tout `"use client"` porte un commentaire `// use-client: <raison>` (contrôle `use-client:check`) et est une feuille de l'arbre ; pas de nouvelle dépendance client ; `content-visibility: auto` + `contain-intrinsic-size` **uniquement** sur les blocs de bas de page, jamais sur le corps (ancres et barre de progression) ; `sizes` de l'image corrigé : `(min-width: 1366px) 565px, (min-width: 1024px) 45vw, calc(100vw - 2rem)` ; pas de requête Prisma en série ajoutée (`Promise.all`, le TTFB à froid pèse sur le LCP) ; toute nouvelle requête tolère le Proxy `stub.invalid` (contrat ADR 0026) ; aucune nouvelle règle dans `globals.css` hors des fichiers prévus (§DECOUPAGE).

Mesure dans les PR : commande ci-dessus + script de reconstitution (à copier sous `scripts/perf/`) ; Playwright `PerformanceObserver('layout-shift')` pour le CLS avec et sans cache de polices ; proposer d'ajouter une URL d'article au `lhci` post-déploiement, d'abord en `warn` (« seuil aligné d'abord, blocage ensuite »).

## 8. Données structurées (SEO / GEO)

### État actuel sur `/fr/blog/[slug]` (article en base)

Organization + WebSite + SiteNavigationElement (layout) · `BreadcrumbList` (composant `Breadcrumbs`) · `ItemList` « Sommaire » (sans `@id`) · `BlogPosting` `#article` (`buildBlogPostingEquipeJsonLd`) · `Organization` Qualiopi (fusion `#organization`) · `Organization` citation d'expert (si présente) · `FAQPage` (sans `@id`) · `ItemList` « À lire aussi » (sans `@id`) · nœud « Plume IA » `#person`.
Doublons / faiblesses : `BreadcrumbList` en double sur `/guides/[slug]` (même `@id`, contenus différents) ; graphe non relié (pas de `WebPage`) ; articles en fichiers : `Person` anonyme en plus ; `dateModified` = `@updatedAt` Prisma (bouge à chaque écriture de ligne).

### Cible

- **PR de gabarits** : aucun changement du graphe (parité). Même `<JsonLd>` en ligne, jamais `afterInteractive`.
- **PR JSON-LD dédiée** (derrière l'interrupteur), sans doublon :
  - nœud commun `WebPage` `<url>#webpage` (`breadcrumb`, `isPartOf`, `primaryImageOfPage`) ; `mainEntityOfPage` de l'article pointe dessus ; `FAQPage` reçoit `@id <url>#faq` et `about #article` ; `@id` sur les `ItemList`.
  - Guide : `HowTo` `<url>#howto` **seulement** si ≥ 2 étapes rendues, sans `totalTime`/`estimatedCost` inventés, aucun rich result promis (adapter `buildHowToJsonLd` qui code `/guides/` en dur).
  - Comparatif : `ItemList #comparatif` si un tableau est visible ; **jamais** `Review`, `AggregateRating` ni `Product` notés.
  - Sélection : `ItemList #classement` (ordre visible).
  - Étude de cas : `contentLocation` si ville ; jamais de `Review`.
  - Définition : `DefinedTerm` en `about`, en réutilisant les `@id` du glossaire quand le terme existe.
  - FAQ : la `FAQPage` unique d'`ArticleFaq` ; pas de seconde.
  - Chiffres : `isBasedOn` vers le `Dataset` de l'Observatoire ; pas de nouveau `Dataset` par article.
- Règle transverse : tout champ JSON-LD a son pendant **visible** sur la page.
- À corriger au passage : `BreadcrumbList` en double sur `/guides/[slug]` (`emitJsonLd={false}` sur `Breadcrumbs` ou retrait du `JsonLd` l. 205).

### GEO

Réponse directe en tête (40-60 mots) ; sommaire avec ancres **stables** (ne pas modifier `slugifyHeading`/`buildToc` : des liens profonds sont déjà cités) ; dates de publication et de mise à jour visibles et cohérentes avec `dateModified` et `article:modified_time` ; auteur visible ; sources citées ; fil d'Ariane visible = `BreadcrumbList` ; maillage par gabarit (service/secteur, glossaire, observatoire) ; titres sous forme de questions pour Définition, FAQ et Guide.

### À ne pas changer

URL, slugs, redirections, canonical, hreflang, metadata, `og:image`, `@id` existants (`#article`, `#breadcrumb`, `/#organization`, `/fr/equipe/manon#person`, `#blog`), calcul de la description (identique à la meta description).

## 9. Interrupteur : insertion technique

1. `src/env.ts` : `BLOG_GABARITS_V2: z.enum(["true","false"]).optional()` (forme de `CRM_SYNC_ENABLED`) ; lecture via `src/lib/blog/gabarits-v2.ts` : `gabaritsV2Actifs() = process.env.BLOG_GABARITS_V2 === "true"`.
2. `page.tsx` : tout le calcul existant est conservé ; **juste avant le `return (` principal** : `if (gabaritsV2Actifs()) { const type = await chargerTypeContenu(view); return <ArticleGabarit … /> }`. Le JSX actuel reste intact. `generateMetadata` n'est pas touché.
3. Interrupteur coupé : aucune requête supplémentaire, aucun module V2 chargé.
4. **ISR** : `generateStaticParams` et `revalidate = 3600` font pré-rendre des pages au build GitHub Actions, **sans** la variable ; un redéploiement qui recrée le conteneur repart du HTML du build. Allumer ou couper l'interrupteur n'agit donc que page par page, à la revalidation (≤ 1 h) ; la purge Cloudflare ne régénère pas le cache ISR. Si un effet immédiat est requis : `revalidatePath` en masse (action d'administration à prévoir, hors de cette conception) ou variable passée au build.
5. Mise en route : variable Coolify (portée RUN) + redémarrage ; effet complet après revalidation (≤ 1 h) ou purge Cloudflare. Aucun contrat app↔worker (rien à ordonnancer côté worker).

## 10. Composants

Existants réutilisés tels quels : `Breadcrumbs`, `AnswerCard`, `ArticleKeyTakeaway`, `ArticleExpertQuote`, `ArticleFaq`, `ArticleSources`, `ArticleTransparencyBlock`, `AuthorByline`, `QualiopiContentBadge`, `AiContentDisclaimer`, `ArticleShareBar`, `ArticlePeopleAlsoAsk`, `ArticlePrevNext`, `SuggestedContent`, `ArticleNewsletterInline`, `EncartEnVideo`, `CtaBlock`, `UnsplashCredit`, `TermesGlossaireLies`.
Existants ajustés par prop (V1 intacte) : `ArticleTOC` (`cibleTactile`, H3, variantes) ; `ArticleFaq` (`premiereOuverte`, `niveauTitre`, padding sur le `<summary>`).
À créer (`src/components/article-v2/`, tous serveur) : `ArticleGabarit`, `EnteteArticle`, `HeroImageArticle` (enveloppe l'`<Image>` + `UnsplashCredit` actuels), `MiseEnPageLecture`, `CorpsArticle`, `TableauDefilant`, `ArticleEtapes`, `EncadreArticle`, `FicheContexte`, `BlocDefinition`, `BandeauDonnees`, `PiedArticle`, `CtaGabarit`.
Fonctions pures : `src/server/content-gen/blog/gabarits.ts` (`gabaritPourType`, repli HTML — PR S1) ; `src/server/content-gen/blog/transformations.ts` (`envelopperTableaux`, `abaisserH1`, `controlerTitres`, `ancrerSousTitres`, `marquerLiensExternes` — PR S3). Deux fichiers distincts, deux PR parallèles.

## 11. Tests attendus (transversaux)

Rendu de chaque gabarit (Vitest, `renderToStaticMarkup`) · exhaustivité `Record<ContentType, …>` · interrupteur coupé = marqueurs V1 présents (`max-w-[52rem]`, bandeau « Mis à jour ») et aucun marqueur V2 · interrupteur allumé = `generateMetadata` identique et ensemble des `@id` identique · aucun `"use client"` dans `article-v2/` hors exception justifiée · un seul `h1`, pas de saut de titre, chaque ancre du sommaire a son `id`, chaque `table` enveloppée · accessibilité automatique : **axe via `@axe-core/playwright`** (déjà utilisé par `tests/e2e/a11y.spec.ts` ; `jest-axe` est déclaré mais inutilisable avec Vitest) à 1280 px et 320 px, mouvement réduit, couleurs forcées, focus non masqué · données structurées (un seul nœud article, un `BreadcrumbList`, au plus une `FAQPage`, aucun `@id` divergent, parité visible ↔ JSON-LD) · textes via `next-intl` (clés FR présentes et `src/messages/en.json` aligné).
⚠️ Les verrous existants qui lisent `page.tsx` par expression régulière (`metadata-editoriale`, `sources-eeat`, `un-seul-mis-a-jour-par-article`) peuvent passer à vide si le JSX migre : les étendre aux nouveaux fichiers. Les E2E `seo-jsonld.spec.ts:115` et `blog-article.spec.ts:39` attendent `Article` et ratent `BlogPosting` : accepter {Article, BlogPosting, NewsArticle, TechArticle}.

## 12. Risques

1. **Sanitizer** : l'élargir touche une frontière anti-XSS → PR dédiée + revue de sécurité ; en attendant, post-traitement après le sanitizer.
2. **Cache** : `revalidate = 3600` + purge Cloudflare : la bascule de l'interrupteur n'est pas instantanée.
3. **CSS inlinée dans toutes les pages** (+ ≤ 2 Ko gz visé) : toute règle de gabarit alourdit le site entier.
4. **Gates aveugles** : une régression de poids de l'article passerait au vert (voir §7) ; d'où le script de mesure et l'URL `lhci` proposée.
5. **Contenu produit par IA** : sauts de titres, `alt` absents, liens « ici » : contrôles au rendu, pas seulement à la génération.
6. **Marges de contraste minces** (terracotta sur sable 4,81 ; terracotta sur terracotta-soft 4,66 ; sage sur sage-soft 4,63) : couleurs pleines, aucune opacité sur le texte.
7. **Type de contenu inconnu** : requête supplémentaire (`ContentGenJob`) seulement si l'interrupteur est allumé ; repli Analyse.
8. **Verrous existants** lisant `page.tsx` (voir §11).
9. **Dette de poids du site** (249,7 Ko vs 75 Ko) : hors périmètre, mais à ne pas aggraver ni masquer.

## 13. Points ouverts pour le propriétaire

- Chargement différé du formulaire newsletter (≈ 24 Ko gz) : décision produit.
- `glossary_term` : page canonique `/blog` ou `/glossaire`.
- `case_study_local` : le générateur demande résultats chiffrés et témoignage (données non vérifiables) : à revoir côté générateur.
- Répartition réelle du stock par type : non mesurable ici (pas d'accès à la base). Requête à exécuter avant de prioriser : `SELECT j.content_type, count(*) FROM articles a JOIN content_gen_jobs j ON j.id = a.generated_by_job_id WHERE a.status='published' AND NOT a.is_news GROUP BY 1`.
- Alt de l'image principale (repli `alt=""`) : à traiter dans la PR images.

## 14. Points repris à l'implémentation (relevés par le critique, non bloquants)

- Guide : ids d'étapes uniques (`ancrerSousTitres`, test d'unicité) ; sommaire = une entrée par étape (corrigé dans la maquette).
- Séparateur de la ligne de métadonnées : `content: " · " / ""` (non lu par les lecteurs d'écran).
- Cibles tactiles des liens isolés (bandeau de données, termes liés) : ≥ 24 px de haut, 44 px visés.
- Définition : ratios d'image 16/7 (mobile) et 4/3 (ordinateur) → `object-fit: cover` et `sizes` cohérent ; ratio réservé, donc aucun décalage.
- Image avant la réponse directe en mobile : vérifier à la mesure post-déploiement que le LCP mobile reste ≤ 1 800 ms, sinon placer l'image après la réponse directe.

## 15. Révision visuelle v2 (2026-11-27)

Référence : `maquettes-v2/index.html` (10 maquettes autonomes, sans JavaScript, ordinateur et téléphone dans le même fichier). Socle commun : `maquettes-v2/_socle.css` (≈ 750 lignes commentées, recopié à l'identique dans chaque maquette entre les marqueurs « DÉBUT SOCLE » et « FIN SOCLE »).

### 15.1 Décisions qui remplacent la v1

| Sujet             | v1 (refusée)                                        | v2 (retenue)                                                                                                                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appels à l'action | **un seul** appel à l'action, en fin d'article      | **plusieurs** : carte collante (ordinateur) ou barre fixe (téléphone) avec 3 actions, un encart au milieu, un encart de fin, et 1 ou 2 micro-appels dans les encadrés. Le bouton principal dépend du gabarit (§15.3).                                                                                             |
| En-tête           | ivoire, sobre                                       | ⚠️ **remplacé en v3 (§15.9)** : en-tête réel du site + héros **terracotta**. Texte v2 d'origine : bandeau **mocha plein**, H1 Fraunces jusqu'à 4,5 rem avec la fin en italique `terracotta-on-mocha`, surtitre en pastille terracotta, temps de lecture en pastille pleine, image qui chevauche le bas du bandeau |
| Encadrés          | 2 ou 3 encadrés sable                               | bibliothèque de **12 encadrés et visuels**, une couleur fixe par fonction (§15.2), un élément visuel fort toutes les 2 ou 3 sections                                                                                                                                                                              |
| Rythme de lecture | sommaire et corps                                   | intertitres en questions, « 04 / 07 » au-dessus des H2, relances « Dans la suite : … », barre de progression CSS, résumé visuel de fin « Ce qu'il faut retenir »                                                                                                                                                  |
| Sommaire          | deux `<nav>` (mobile `<details>` + rail ordinateur) | **un seul** `<nav>` contenant un `<details>` : replié sur téléphone, toujours ouvert dans la colonne droite sur ordinateur (`::details-content`, sous `@supports` ; sans ce support, le `<summary>` reste cliquable)                                                                                              |
| Périmètre         | 8 gabarits du blog                                  | 8 gabarits + **actualités** + **guides pilier**, avec les mêmes boutons latéraux                                                                                                                                                                                                                                  |

### 15.2 Bibliothèque d'encadrés (fonction = couleur, toujours avec un libellé texte et une icône SVG)

| Encadré / visuel                       | Fond                                         | Classe de maquette                                         |
| -------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| « En bref » (réponse directe)          | papier, bordure encre 2 px, filet terracotta | `.en-bref` (`data-aeo="tldr"`, `.tldr-answer`)             |
| « À retenir »                          | sage-soft                                    | `.encadre--retenir`                                        |
| « Attention / piège à éviter »         | ochre-soft hachuré                           | `.encadre--attention`                                      |
| « Exemple concret »                    | plum-soft                                    | `.encadre--exemple`                                        |
| « Modèle à reprendre »                 | primary-soft                                 | `.encadre--modele`                                         |
| « Le saviez-vous ? »                   | sable                                        | `.encadre--saviez`                                         |
| « Bon à savoir »                       | papier, bordure pointillée                   | `.encadre--bon`                                            |
| « Chiffre clé » (chiffre géant sourcé) | terracotta-soft                              | `.chiffre-cle`                                             |
| Citation mise en avant                 | terracotta-soft, guillemet géant             | `.citation` (`figure`)                                     |
| Cartes, schéma, rangée de chiffres     | papier / mocha                               | `.cartes`, `.schema`, `.chiffres`                          |
| Étapes numérotées (frise)              | pastilles terracotta, rail pointillé         | `.etapes`                                                  |
| Tableau visuel                         | en-tête mocha, zébrures, coches SVG          | `.tableau` (région défilante nommée, 1re colonne collante) |
| Checklist, relance, séparateur, résumé | —                                            | `.checklist`, `.relance`, `.separateur`, `.resume`         |

Le contenu d'un encadré est du **texte réel** dans le DOM (jamais dans `::before`), pour les moteurs et les lecteurs d'écran. Côté production, les encadrés sont produits par le générateur (classes ou balises dédiées dans le HTML de l'article, à définir dans S3) **ou** par le gabarit à partir de données structurées. Le gabarit n'invente jamais un chiffre ni une citation.

### 15.3 Appels à l'action (spécialiste conversion)

- **Carte collante (≥ 1024 px)**, titrée « Passer de la lecture à l'action » :
  1. « Diagnostic IA, 45 min » (libellé exact du site, `method1Title`), bouton principal bleu, vers `/fr/appel?rdv=diagnostic&depuis=<gabarit>-colonne` ;
  2. « Découvrir la Journée IA », en terracotta, vers `/fr/journee-ia` ;
  3. « Écrire un message », en contour, vers `/fr/contact`.
     Réassurance : uniquement des libellés existants du site (« Confirmation immédiate », « Annulable en un clic », « Partout en France »). **Qualiopi n'est jamais écrit en dur** : il n'apparaît que si `getQualiopiPublicIdentity()` renvoie une identité. La garantie de la Journée IA n'est pas citée (elle renvoie à un prix).
- **Barre fixe (< 1024 px)** : « Journée IA » · « Diagnostic IA » (au centre, en bleu, avec une pastille « 45 min ») · « Message ». Elle fait 56 px de haut minimum et tient compte de `safe-area-inset-bottom`. Le `body` réserve sa hauteur en bas de page, et le focus n'est jamais masqué. Chaque `aria-label` contient le texte visible (2.5.3).
- **Un seul élément du DOM** sert à la fois de carte et de barre, repositionné en CSS : pas de doublon de liens pour les moteurs. Liens internes simples (ni `nofollow`, ni `target`, ni UTM) ; la mesure passe par le paramètre `depuis` et un attribut `data-cta`.
- **Bouton principal des encarts selon le gabarit** : Journée IA pour Guide, Sélection, Étude de cas et Chiffres ; « Écrire un message » pour la FAQ ; Diagnostic pour les autres. Le guide pilier a deux encarts au milieu.
- **Preuve de valeur sans faux témoignage** : déroulé du diagnostic en 3 étapes (libellés du site), ce que remet la Journée IA (attestation, rapport de priorités), et la phrase du site « Nous n'annonçons jamais un gain à l'avance. »
- Interdits : prix, frais de déplacement, « Grenoble », « Aucun gain garanti », compte à rebours, chiffre de résultat client.

### 15.3 bis Décisions issues de l'arbitrage qualité (2 tours)

- **Boutons dès le premier écran sur ordinateur.** La carte d'actions est posée dans le bandeau du héros (terracotta depuis la v3), puis reste collante. Le sommaire collant se place dessous, dans la hauteur qui reste : fondu en bas et indication « ↓ suite du sommaire » quand il défile. La réassurance est masquée sous 860 px de hauteur d'écran.
- ~~Bouton bleu « Diagnostic IA, 45 min » dans le bandeau de navigation du site~~ : **abandonné en v3**. L'en-tête est le `Header` réel, inchangé (son bouton « Réserver un appel » garde `depuis=entete`) ; le `depuis=<gabarit>-entete` des maquettes n'est pas repris. Toute retouche de l'en-tête global reste une PR distincte, sur décision de Will.
- **Un signe propre à chaque gabarit dans l'en-tête** (« RAG. », « A ou B », « ≈ 10 % », « Art. 4 », jalons…), en décor `aria-hidden`.
- **Typographie française** : espace fine insécable devant ? ! ; et insécable devant : et dans les « ». À appliquer au rendu des textes d'interface, via les messages.
- **Promesses vérifiées contre le site** : le rapport et le plan d'action à 90 jours de la Journée IA arrivent **sous 10 jours ouvrés**, pas le jour même.

### 15.4 Visuel signature de chaque gabarit

| Gabarit            | Visuel signature                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Analyse            | schéma constat → causes → leviers, chiffre clé, citation, cartes                                                                                        |
| Guide              | parcours en un coup d'œil (bandeau mocha), étapes à pastilles géantes « Étape n sur N », checklist « Avant de commencer », formule (`calculator_roi`)   |
| Comparatif         | face-à-face A / B en tête, tableau à coches et croix (vrai `<table>`), cartes « Pour qui ? », arbre de décision, verdict « ça dépend de… » sans gagnant |
| Sélection          | grandes cartes à numéro géant (« n sur 10 », pour qui / points forts / limites), critères en pastilles, tableau de synthèse rédigé                      |
| Étude de cas       | fiche « Contexte » mocha (« exemple type, pas un client »), frise Avant / Pendant / Après sans chiffre, « Ce que l'équipe a appris »                    |
| Définition         | terme géant avec prononciation et sigle développé, `<dfn>` dans « En bref », « En une phrase / En pratique / À ne pas confondre », termes liés          |
| Questions-réponses | grille mocha des questions, thèmes en pastilles colorées, cartes `<details>` numérotées (la première ouverte), « Votre question n'est pas là ? »        |
| Chiffres           | bandeau « Données au <date> », rangée de chiffres géants sourcés, barres horizontales en CSS (valeur écrite en texte), « Comment lire ces chiffres »    |
| Actualité          | triptyque « Ce qui change / Pour qui / Que faire maintenant », encadré « Source d'origine », frise des dates, « Ce que l'on ne sait pas encore »        |
| Guide pilier       | sommaire en grille de chapitres avec progression, bandeaux de chapitre (« Chapitre n sur 7 », temps restant), feuille de route finale                   |

Les chiffres des maquettes sont des **exemples d'illustration** (sources publiques citées de mémoire, marquées « à revérifier »). En production, la règle du §1.7 s'applique sans changement.

### 15.5 Extension aux actualités et aux guides

- `/actualites/[slug]` et `/guides/[slug]` sont des pages **autonomes** : leur habillage v2 passe par des composants partagés (`HerosArticle`, `PhotoArticle`, `ColonneActions`, encadrés), derrière le même interrupteur `BLOG_GABARITS_V2`, avec le même principe qu'au §9 (rendu v1 au balisage identique quand il est coupé).
- URL, slugs, canonical, metadata, redirections et `@id` ne changent pas. On conserve `data-aeo`, `data-speakable`, les ids `step-N` des guides et le lien `alternate` markdown.
- Constats SEO à traiter (PR dédiées, hors interrupteur si le propriétaire valide) :
  - `/guides` : `BreadcrumbList` en double (F1, déjà prévu) ; `HowTo.totalTime` rempli avec le temps de lecture (faux) ; articles liés codés en dur en `/blog/` (redirections 308) ; ni auteur ni date affichés.
  - `/actualites` : `<article>` n'entoure que le corps ; le badge « Brève (non indexée) » est visible du public (la v2 le retire de l'affichage).

### 15.6 Accessibilité (audit des 10 maquettes, Chromium)

Contrastes mesurés par script sur chaque texte visible à 1280 et 360 px : aucun échec après correction. Anneau de focus ivoire sur les fonds sombres (13,7:1 sur mocha, 5,24:1 sur terracotta). Cibles de 44 px pour les liens isolés et d'au moins 24 px pour les liens dans le texte. Aucun élément reçoit le focus sous la barre mobile. Reflow sans défilement horizontal à 320 px. Espacement du texte (1.4.12), mouvement réduit (barre de progression masquée) et couleurs forcées vérifiés.

Limites :

- « Copier le lien » demande un îlot client : on garde le composant existant.
- Les boutons pleins de la carte mocha ont un contraste de 2,25 et 2,61:1 avec leur fond. C'est accepté, car leur texte suffit à les identifier.
- Safari et Firefox restent à vérifier à l'implémentation.

### 15.7 Performance (audit des 10 maquettes)

- Zéro JavaScript, aucune ressource externe, graisses existantes uniquement.
- CLS = 0 avec les polices système. Avec les vraies polices simulées en retard, la cause trouvée était un `max-width` en `ch` sur le H1 ; il est corrigé (unité indépendante de la police). Les repli métriques de `next/font` restent la protection en production.
- LCP : le H1 sur ordinateur, le chapô ou le H1 sur téléphone. L'image devient le LCP en 1920 × 1080. On garde `loading="eager"` et on n'ajoute pas de `preload` d'image. **Révision v3** : la photo est désormais présente sur chaque article et chevauche le bas du héros ; elle porte `fetchPriority="high"` (comme dans les maquettes v3), avec ratio 16/10 réservé et AVIF/WebP ; on la traite comme l'élément LCP probable (§15.9).
- **CSS, point décisif** : le socle pèse ≈ 8,6 Ko gz, chaque gabarit 0,4 à 2,5 Ko gz, l'ensemble ≈ 19 Ko gz. **L'import dans `globals.css` prévu en v1 (S2) est abandonné** : il ajouterait ≈ +17 à +19 Ko gz à chaque page du site, environ neuf fois le budget de +2 Ko. À la place, la CSS des gabarits est importée **uniquement par les routes d'article** (`blog/[slug]`, `actualites/[slug]`, `guides/[slug]`), sur le modèle de `accueil.module.css` et `journee-ia.module.css`, et réécrite au maximum avec les utilitaires Tailwind déjà présents. Les règles `.v-*` (anciens dessins SVG de substitution) ne visent plus aucun élément dans les maquettes v3, qui affichent de vraies photos : il n'y a rien à en reprendre ; on reprend le cadre photo (`.visuel`, `.visuel__cadre`, `.visuel__etiquette`, légende) (§15.9).
- À mesurer au build de S2 : `/fr/contact` et l'accueil ne doivent pas bouger d'un octet de CSS ; la CSS d'une page d'article reste ≤ +12 Ko gz (socle + un gabarit) ; le First Load JS ne bouge pas.

### 15.8 Nouveaux composants (en plus du §10)

`ColonneActions` (carte collante et barre mobile, un seul élément), `CtaMilieu` et `CtaFin` (variantes par gabarit, `depuis` en prop), `Encadre` (prop `type` : retenir, attention, exemple, modele, saviez, bon), `ChiffreCle`, `CitationMiseEnAvant`, `Cartes`, `RangeeChiffres`, `BarresChiffres`, `Frise` (étapes et dates), `TableauVisuel` (enveloppe `TableauDefilant`), `Checklist`, `Relance`, `ResumeFin`, `HerosArticle` (remplace l'en-tête sobre d'`EnteteArticle`), `BarreProgression` (CSS pur), `FaceAFace`, `CarteSelection`, `FicheContexte` (restylée), `TriptyqueActualite`, `BandeauChapitre`. Tous serveur ; aucun `"use client"`.

### 15.9 Révision v3 (2026-11-27) : maquettes validées par Will

Référence : les maquettes v3 de `maquettes-v2/` (le dossier garde son nom), fusionnées par la PR #2423. Ce paragraphe prime sur le reste du §15. Découpage révisé : `DECOUPAGE.md` (S2, G1-G8, A1, GU1).

| Sujet            | v2 (remplacée)                                                | v3 (validée)                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| En-tête du site  | « en-tête mocha » propre au blog, bouton Diagnostic à ajouter | **le `Header` réel** (`src/components/nav/Header.tsx`), déjà rendu par `src/app/[locale]/layout.tsx` : barre terracotta, aucun changement. La section 06 du socle n'en est qu'une copie pour la maquette                                                                                                                          |
| Héros            | bandeau mocha plein, italique `terracotta-on-mocha`           | **aplat terracotta** (dégradé vers terracotta-deep, rayures), H1 papier, italique terracotta-soft souligné, pastilles papier / terracotta-deep, signe du gabarit en décor (`HerosArticle`, section 07)                                                                                                                            |
| Visuel principal | dessin SVG de substitution (`.v-*`)                           | **vraie photo** dans `.visuel__cadre` (ratio 16/10, passe-partout ivoire, chevauche le héros, `fetchPriority="high"`), photo de l'article ou, à défaut, photo de repli de la banque du site (`public/images/axion-ia-*`) ; jamais un dessin. Les règles `.v-*` restent en fin de `<style>` des maquettes mais ne visent plus rien |
| Boutons latéraux | carte dans le bandeau sombre                                  | carte mocha-soft dans la colonne droite, posée dans le bandeau terracotta puis collante ; barre fixe à 3 cellules sur téléphone ; un seul `<aside>`                                                                                                                                                                               |
| Encart vidéo     | —                                                             | `section.encart-video` entre FAQ et sources, rendu seulement si une vraie vidéo est publiée ; façade vers `/fr/videos/<slug>` (option A de `docs/pilotage-seo-geo/CONCEPTION-ENCART-VIDEO.md`) : aucun lecteur, aucun iframe YouTube, aucun `VideoObject`                                                                         |
| Typographie      | —                                                             | `text-wrap: balance` / `pretty`, largeurs en em (jamais en ch), chiffres tabulaires, espaces fines insécables françaises dans les messages, aucune graisse 700/800                                                                                                                                                                |

**Points ouverts pour Will avant S2** :

- **Bleu.** Les maquettes v3 emploient encore `--color-primary` (`#1a4dd9`) : bouton « Diagnostic IA, 45 min » (`btn--bleu`) dans la carte, la barre mobile et les encarts, liens du texte, anneau de focus clair, thème « Cadre légal » de la FAQ, et même le bouton Journée IA des encarts du milieu des maquettes Étude de cas, Chiffres et Guide pilier. La marque est terracotta : soit Will accepte le bleu comme couleur d'action (comme le « Réserver un appel » de l'en-tête réel), soit ces boutons passent en terracotta. En attendant, Journée IA est toujours en terracotta (§15.3).
- **Photos des maquettes Comparatif et Chiffres** : `…-comparatif-…-infographie.webp` est une infographie, et `…-avant-apres-tableau-bord-45-pourcent-photo-carre.webp` annonce un chiffre de résultat. Elles sont exclues de la table de repli.
- **Libellés de prise de rendez-vous** : la réassurance « Confirmation immédiate · Annulable en un clic » et le déroulé « Vous choisissez un créneau » décrivent une prise de rendez-vous en ligne pour le Diagnostic (page `/appel`) ; à confirmer au regard de l'interdit « réservation directe ».
- `maquettes-v2/index.html` annonce encore « un bouton bleu Diagnostic IA, 45 min » dans le bandeau du site : texte périmé, les maquettes elles-mêmes montrent l'en-tête réel (« Réserver un appel »).
