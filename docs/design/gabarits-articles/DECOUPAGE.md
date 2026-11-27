# Découpage des PR d'implémentation — gabarits d'articles

Lire d'abord `PLAN.md` (contraintes §1, correspondance §3, règles §6-§9) et ouvrir les maquettes `maquettes/*.html` (la référence visuelle). **Chaque PR est ouverte en brouillon** (règle CI du dépôt) et passée « prête » une seule fois, à la fin. Aucune PR ne relève un cliquet `size-limit`. Aucune PR ne touche `prisma/`. Tous les textes visibles passent par `next-intl` (`messages/fr.json` et `messages/en.json`, EN toujours désactivé).

Règle commune de test pour toute PR qui rend un gabarit : (a) rendu serveur (`renderToStaticMarkup`) avec `data-gabarit="<code>"` ; (b) interrupteur coupé → aucun marqueur V2 ; (c) un seul `h1`, pas de saut de titre, chaque ancre du sommaire a son `id` ; (d) aucun `"use client"` ajouté ; (e) axe (`@axe-core/playwright`) à 1280 px et 320 px sur la page de rendu, sans violation `serious`/`critical`.

## Ordre et dépendances

```
S1 ──► S2 ──┬──► G1 analyse ──┐
        │   ├──► G2 guide     │
S3 ─────┘   ├──► G3 comparatif│
 (parallèle │   ├──► G4 sélection │──► J1 JSON-LD ──► (activation : décision humaine)
  avec S1)  ├──► G5 cas       │
            ├──► G6 définition│
            ├──► G7 FAQ       │
            └──► G8 chiffres ─┘
T1 (tests E2E / lhci) : parallèle avec G1..G8 dès que S2 est fusionnée.
```

| PR    | Dépend de                           | Peut tourner en parallèle avec                   |
| ----- | ----------------------------------- | ------------------------------------------------ |
| S1    | —                                   | S3                                               |
| S3    | —                                   | S1                                               |
| S2    | S1                                  | S3 (si S3 déjà fusionnée ou sans fichier commun) |
| G1…G8 | S1, S2, S3                          | toutes les autres G, T1 (fichiers disjoints)     |
| T1    | S2                                  | G1…G8, J1                                        |
| J1    | S1, G2, G3, G4, G6 (selon familles) | T1                                               |

Les fichiers **partagés** (`page.tsx`, `globals.css`, `ArticleGabarit.tsx`, `messages/*.json`) sont tous préparés par S1/S2 pour que G1…G8 n'aient chacune que **leurs propres fichiers** à modifier : S2 crée d'avance les huit fichiers de gabarit (rendu de repli = Analyse), les huit feuilles de style `@import`ées, et un fichier de messages **par gabarit** (`messages/gabarits/<code>.fr.json` fusionné au chargement, voir S2) afin d'éviter les conflits.

---

## S1 — Socle : interrupteur, type de contenu, aiguillage

- **Branche** : `feat/gabarits-articles-s1-socle`
- **Fichiers touchés** : `src/env.ts` (déclaration + `runtimeEnv`) ; `src/lib/blog/gabarits-v2.ts` (nouveau) ; `src/server/content-gen/blog/gabarits.ts` (nouveau : `GabaritArticle`, `gabaritPourType`, heuristique de repli) ; `src/server/content-gen/blog/loader.ts` (ajouter `generatedByJobId: true` au `select` + `chargerTypeContenu`) ; `src/app/[locale]/blog/[slug]/page.tsx` (insertion unique juste avant le `return (` principal) ; `src/components/article-v2/ArticleGabarit.tsx` (nouveau, squelette qui rend un `<main data-gabarit>` minimal avec les composants existants dans l'ordre du PLAN §4 — pas encore de design) ; tests.
- **Consigne** : ajouter `BLOG_GABARITS_V2` (`z.enum(["true","false"]).optional()`) ; `gabaritsV2Actifs()` lit `process.env.BLOG_GABARITS_V2 === "true"` à chaque appel. Dans `page.tsx`, conserver à l'octet près le JSX actuel et tout le calcul existant ; juste avant le `return (` : `if (gabaritsV2Actifs()) { const type = await chargerTypeContenu(view); return <ArticleGabarit gabarit={gabaritPourType(type, html)} … /> }`. `chargerTypeContenu` fait `prisma.contentGenJob.findUnique({ where:{ id: generatedByJobId }, select:{ contentType:true } })` **seulement si l'interrupteur est allumé** et tolère le Proxy `stub.invalid` (retourne `null`). `gabaritPourType` est un `Record<ContentType, GabaritArticle>` exhaustif selon la table du PLAN §3 + repli HTML pour `null`. Ne pas modifier `generateMetadata`, le JSON-LD, ni la sélection d'image.
- **Tests** : table exhaustive (un test énumère `Object.values(ContentType)`) ; repli HTML (3 cas) ; interrupteur absent / `"false"` / `""` / `"true"` ; interrupteur coupé → le rendu de `page.tsx` contient `max-w-[52rem]` et le bandeau « Mis à jour », et **aucun** `data-gabarit` ; interrupteur coupé → `chargerTypeContenu` jamais appelé ; `generateMetadata` identique allumé/éteint ; ensemble des `@id` JSON-LD identique ; verrous existants (`metadata-editoriale`, `sources-eeat`, `un-seul-mis-a-jour-par-article`) toujours verts.

## S3 — Transformations de contenu et accessibilité du corps

- **Branche** : `feat/gabarits-articles-s3-transformations`
- **Fichiers touchés** : `src/server/content-gen/blog/transformations.ts` (nouveau : `envelopperTableaux`, `abaisserH1`, `controlerTitres`, `marquerLiensExternes`) ; `src/server/content-gen/shared/html-sanitizer.ts` (**seulement** si l'option liste blanche est retenue : `caption`, `scope`, `lang` ; **revue de sécurité obligatoire**) ; `src/server/content-gen/guides/loader.ts` (exporter `parseStepsFromBody`, sans changer son comportement) ; tests.
- **Consigne** : fonctions pures, serveur, appliquées **après** le sanitizer. `envelopperTableaux(html)` enveloppe chaque `<table>` dans `<div class="table-scroll" role="region" tabindex="0" aria-labelledby="cap-N">` et garantit un nom (utilise la `<caption>` si présente, sinon génère un libellé neutre passé en paramètre, déjà traduit). `abaisserH1` transforme `<h1>` en `<h2>` du corps. `controlerTitres` renvoie la liste des sauts de niveau (pour les tests et la journalisation) sans réécrire le HTML. `marquerLiensExternes` ajoute la mention « (nouvelle fenêtre) » masquée visuellement (libellé fourni en paramètre). Si la liste blanche du sanitizer est touchée : ajouter des tests XSS (attributs interdits toujours refusés, `javascript:` refusé).
- **Tests** : entrées/sorties de chaque fonction (tableau sans caption, avec caption, plusieurs tableaux, `colspan`) ; idempotence (double application) ; HTML malformé ; test XSS si sanitizer modifié ; aucune dépendance au DOM navigateur.

## S2 — Composants communs, jetons et feuilles de style

- **Branche** : `feat/gabarits-articles-s2-composants`
- **Fichiers touchés** : `src/components/article-v2/*.tsx` (`EnteteArticle`, `HeroImageArticle`, `MiseEnPageLecture`, `CorpsArticle`, `TableauDefilant`, `ArticleEtapes`, `EncadreArticle`, `FicheContexte`, `BlocDefinition`, `BandeauDonnees`, `PiedArticle`, `CtaGabarit`) ; `src/components/article-v2/gabarits/Gabarit{Analyse,Guide,Comparatif,Selection,Cas,Definition,Faq,Chiffres}.tsx` (huit fichiers créés **d'avance**, chacun rend pour l'instant la mise en page Analyse) ; `src/components/article-v2/ArticleGabarit.tsx` (aiguillage complet vers les huit fichiers) ; `src/app/globals.css` (**un seul** ajout : jetons fluides `@theme`, `scroll-padding-top`, `color-scheme: light`, `--focus-ring`, `@import` des huit feuilles ci-dessous) ; `src/styles/article-v2/{base,analyse,guide,comparatif,selection,cas,definition,faq,chiffres}.css` (neuf fichiers, le gabarit n'écrit que dans sa feuille) ; `src/components/seo/ArticleTOC.tsx` (props `cibleTactile`, H3, variantes, deux `<nav>` ; V1 inchangée par défaut) ; `src/components/content-gen/ArticleFaq.tsx` (props `premiereOuverte`, `niveauTitre`, padding sur `<summary>`) ; `messages/gabarits/*.json` (un fichier par gabarit + `commun`) et son chargeur ; tests.
- **Consigne** : reproduire fidèlement les maquettes (`maquettes/*.html` : structure, jetons, espacements). Tout est composant **serveur** ; aucun `"use client"`. `HeroImageArticle` **enveloppe** l'`<Image>` et `UnsplashCredit` actuels sans changer leur logique : `loading="eager"`, `fetchPriority="high"`, `aspect-[16/10]`, `sizes="(min-width: 1366px) 565px, (min-width: 1024px) 45vw, calc(100vw - 2rem)"`. Utiliser uniquement les jetons de couleur existants (pas d'hexadécimal : `anti-hex:check`). Pas de nouvelle famille/graisse de police. Cibles tactiles ≥ 44 px. Respect de `prefers-reduced-motion` et `forced-colors` (voir maquettes). Mesurer le CSS inliné : ≤ + 2 Ko gz sur la page.
- **Tests** : rendu de chaque composant ; `ArticleTOC` V1 inchangé (snapshot) ; deux `<nav aria-label>` en V2 ; aucun `"use client"` dans `article-v2/` ; clés de messages FR et EN présentes ; `pnpm bundle:check` vert et chunks propres à la page ≤ 30,5 Ko gz (script de mesure du PLAN §7) ; `anti-hex`, `use-client:check`, `radius:check` verts.

---

## G1 — Gabarit Analyse (défaut et repli)

- **Branche** : `feat/gabarits-articles-g1-analyse`
- **Fichiers touchés** : `src/components/article-v2/gabarits/GabaritAnalyse.tsx`, `src/styles/article-v2/analyse.css`, `messages/gabarits/analyse.*.json`, tests.
- **Consigne** : implémenter la maquette `maquettes/analyse.html`. Sommaire H2+H3 ; numéros de chapitre (compteur CSS) et « Revenir au sommaire » au-delà de 2 500 mots ; ordre de fin de page conforme PLAN §4 (FAQ et sources **avant** carte auteur, badge Qualiopi, mention IA, partage). C'est aussi le rendu de repli de tous les autres gabarits tant qu'ils ne sont pas livrés : le garder robuste (tableaux, FAQ absente, image absente).
- **Tests** : règle commune ; rendu avec/sans FAQ, sans image, sans citation ; articles en fichiers (`source !== "db"`) ; seuil de 2 500 mots.

## G2 — Gabarit Guide pratique

- **Branche** : `feat/gabarits-articles-g2-guide`
- **Fichiers touchés** : `GabaritGuide.tsx`, `src/styles/article-v2/guide.css`, `messages/gabarits/guide.*.json`, tests.
- **Consigne** : maquette `maquettes/guide.html`. `ArticleEtapes` à partir de `parseStepsFromBody` ; sommaire = étapes ; « Avant de commencer » si le corps débute par des prérequis, sinon rien. Pour `calculator_roi` : formule en `code`/`pre` (Inconsolata, sous la ligne de flottaison) et tableau des scénarios via `TableauDefilant` ; **aucun prix, aucun calculateur interactif**. CTA audit.
- **Tests** : règle commune ; rendu avec 0, 1 et 5 étapes (sans étapes → mise en page Analyse) ; `calculator_roi` sans aucun montant ajouté par le gabarit.

## G3 — Gabarit Comparatif

- **Branche** : `feat/gabarits-articles-g3-comparatif`
- **Fichiers touchés** : `GabaritComparatif.tsx`, `src/styles/article-v2/comparatif.css`, `messages/gabarits/comparatif.*.json`, tests.
- **Consigne** : maquette `maquettes/comparatif.html`. Premier tableau du corps remonté dans « En bref » (extraction serveur du premier `<table>`, retiré du corps pour éviter le doublon) ; première colonne collante ; entrée « Tableau récapitulatif » au sommaire ; surtitre « Alternatives à … » pour `alternative_to`. Aucun « gagnant », aucune note, aucun prix. CTA audit.
- **Tests** : règle commune ; sans tableau → pas de bloc « En bref » ; tableau unique non dupliqué ; défilement horizontal à 320 px sans débordement de page ; contraste de l'en-tête de tableau (légende sur sable-deep ≥ AA).

## G4 — Gabarit Sélection (top X)

- **Branche** : `feat/gabarits-articles-g4-selection`
- **Fichiers touchés** : `GabaritSelection.tsx`, `src/styles/article-v2/selection.css`, `messages/gabarits/selection.*.json`, tests.
- **Consigne** : maquette `maquettes/selection.html`. H2 numérotés par compteur CSS (aucun JS) ; le compteur ne s'applique qu'aux H2 des options (pas à « FAQ », « Sources »). Tableau de synthèse si présent. CTA audit.
- **Tests** : règle commune ; compteur limité aux options ; 3 et 10 options ; lecteur d'écran : le numéro CSS ne duplique pas un numéro textuel déjà présent dans le titre.

## G5 — Gabarit Étude de cas

- **Branche** : `feat/gabarits-articles-g5-cas`
- **Fichiers touchés** : `GabaritCas.tsx`, `FicheContexte` (usage), `src/styles/article-v2/cas.css`, `messages/gabarits/cas.*.json`, tests.
- **Consigne** : maquette `maquettes/etude-de-cas.html`. Fiche « Contexte » alimentée **uniquement** par les métadonnées existantes (secteur, ville via `getVille`, catégorie) ; champs absents omis. **Interdit** : encadré de résultats chiffrés, mise en valeur d'un témoignage, tout chiffre extrait du corps. CTA audit.
- **Tests** : règle commune ; fiche sans ville ni secteur ; test de garde : le rendu ne contient aucun `<strong>` de chiffre généré par le gabarit.

## G6 — Gabarit Définition

- **Branche** : `feat/gabarits-articles-g6-definition`
- **Fichiers touchés** : `GabaritDefinition.tsx`, `BlocDefinition` (usage), `src/styles/article-v2/definition.css`, `messages/gabarits/definition.*.json`, tests.
- **Consigne** : maquette `maquettes/definition.html`. Réponse directe dans `<dfn>` ; image réduite (même fichier, `sizes` plus petit, crédit conservé) ; sommaire masqué sous 4 entrées ; « Termes liés » via `TermesGlossaireLies` ; lien vers `/glossaire`. CTA Journée IA.
- **Tests** : règle commune ; 2 et 5 entrées de sommaire ; sans termes liés.

## G7 — Gabarit Questions-réponses

- **Branche** : `feat/gabarits-articles-g7-faq`
- **Fichiers touchés** : `GabaritFaq.tsx`, `src/styles/article-v2/faq.css`, `messages/gabarits/faq.*.json`, tests.
- **Consigne** : maquette `maquettes/faq.html`. La FAQ est le corps : `ArticleFaq` remonte après la réponse directe, première question ouverte (`premiereOuverte`), niveau de titre cohérent ; sommaire = questions ; image facultative. Pour `qa_derived` : appliquer `abaisserH1` et vérifier qu'aucun `<script type="application/ld+json">` ne survit dans le corps (sinon double FAQPage/QAPage) ; **mesurer d'abord sur un article réel**. CTA rendez-vous.
- **Tests** : règle commune ; `qa_derived` avec H1 et JSON-LD dans le corps → un seul h1 et zéro script dans le corps ; une seule `FAQPage` émise ; chaque `Question.name` présent dans `[data-faq-q]`.

## G8 — Gabarit Chiffres (baromètre)

- **Branche** : `feat/gabarits-articles-g8-chiffres`
- **Fichiers touchés** : `GabaritChiffres.tsx`, `BandeauDonnees` (usage), `src/styles/article-v2/chiffres.css`, `messages/gabarits/chiffres.*.json`, tests.
- **Consigne** : maquette `maquettes/chiffres.html`. Bandeau « Données au <date> » + lien Observatoire **seulement** si la date du relevé est disponible ; grands chiffres **seulement** si un composant les reçoit structurés depuis `BarometerSnapshot` (jamais par expression régulière du HTML). Sans donnée structurée : rendu Analyse avec le bandeau. Contraste : mocha + ivoire (13,70 : 1).
- **Tests** : règle commune ; avec et sans relevé ; aucun chiffre rendu qui ne vient pas de la donnée structurée.

---

## J1 — Données structurées (enrichissements)

- **Branche** : `feat/gabarits-articles-j1-jsonld`
- **Fichiers touchés** : `src/lib/seo-content-gen-factories.ts` (+ `HowTo` : paramètre `urlSegment`) ; `src/lib/seo/*` (nœud `WebPage`, `ItemList`) ; `src/components/seo/ArticleTOC.tsx` (`@id` de l'`ItemList`, **seule** modification autorisée ici) ; `src/components/content-gen/ArticleFaq.tsx` (`@id`) ; `src/app/[locale]/guides/[slug]/page.tsx` (suppression du `BreadcrumbList` en double) ; tests unitaires JSON-LD ; E2E `tests/e2e/flows/seo-jsonld.spec.ts` et `tests/e2e/content-gen/blog-article.spec.ts` (accepter {Article, BlogPosting, NewsArticle, TechArticle}).
- **Consigne** : appliquer PLAN §8, **derrière `gabaritsV2Actifs()`** : interrupteur coupé → graphe identique à aujourd'hui. Conserver tous les `@id` existants. Chaque ajout a son pendant visible ; jamais `Review`/`AggregateRating`/`Product` ; `HowTo` seulement si ≥ 2 étapes rendues.
- **Tests** : par famille : un seul nœud article `#article`, un `BreadcrumbList`, au plus une `FAQPage`, aucun `@id` divergent, aucun `Person` sans `@id` ; parité visible ↔ JSON-LD (`HowToStep.name`, `ItemList.name`, `Question.name`) ; `dateModified` (jour) = `<time>` « Mis à jour » = `article:modified_time` ; interrupteur coupé → graphe strictement identique ; `/guides/[slug]` : un seul `BreadcrumbList`.

## T1 — Garde-fous de test et de mesure

- **Branche** : `feat/gabarits-articles-t1-garde-fous`
- **Fichiers touchés** : `tests/e2e/a11y.spec.ts` (ajouter 2-3 articles de blog à `STRATEGIC_PATHS` : un avec tableau, un avec FAQ et encadrés, un sans image) ; `tests/e2e/content-gen/blog-a11y.spec.ts` (nouveau) ; `scripts/perf/first-load-route.cjs` (script de mesure du PLAN §7) ; `scripts/check-contrast.ts` (paires d'article manquantes : en-tête de tableau, FAQ, encadrés, anneau de focus ≥ 3:1) ; `.github/workflows/deploy-coolify.yml` + `lighthouserc.postdeploy*.json` (URL d'article **en `warn`** seulement, après décision humaine).
- **Consigne** : tests `@a11y` sur le modèle de `tests/e2e/qualiopi/_harness/audit-page.ts` : axe complet ; axe à 320 px ; `scrollWidth <= clientWidth` ; injection de l'espacement du texte (1.4.12) ; Tab sur le premier lien du corps puis vérifier qu'il n'est pas sous l'en-tête collant (2.4.11) ; `emulateMedia({ reducedMotion: "reduce" })` ; `emulateMedia({ forcedColors: "active" })` puis contour de focus non nul ; clavier sur `<summary>` du sommaire et de la FAQ. Ces tests tournent interrupteur allumé (variable d'environnement du serveur de test).
- **Tests** : ces fichiers _sont_ les tests ; vérifier qu'ils échouent sur une mutation volontaire (par exemple retirer `tabindex` d'un tableau).

---

## Mise en production (hors PR, décision humaine)

1. Fusionner S1, S3, S2, puis G1…G8, J1, T1 ; l'interrupteur reste coupé : la prod est inchangée.
2. Sur un environnement de préproduction : `BLOG_GABARITS_V2=true`, relire un article de chaque famille, mesurer (PLAN §7).
3. Activer en production (Coolify, portée RUN, redémarrage) à un créneau de déploiement ; purge Cloudflare ; contrôle d'un article par famille.
4. Retour arrière : retirer la variable (ou la passer à `false`), redémarrer, purger.
