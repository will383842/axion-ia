# Découpage des PR d'implémentation — gabarits d'articles

Lire d'abord `PLAN.md` (contraintes §1, correspondance §3, règles §6-§9, **révision v2 §15**). La référence visuelle est désormais `maquettes-v2/*.html` ; les anciennes `maquettes/*.html` ont été refusées et ne servent plus.

> **Révision v2 (2026-11-27)** :
>
> - « plusieurs appels à l'action » remplace « un seul appel à l'action » (PLAN §15.3) ;
> - S2 et G1 à G8 sont révisés ;
> - deux PR s'ajoutent : **A1** (actualités) et **GU1** (guides) ;
> - la CSS des gabarits ne passe plus par `globals.css` : elle est importée par les seules routes d'article (PLAN §15.7). **Chaque PR est ouverte en brouillon** (règle CI du dépôt) et passée « prête » une seule fois, à la fin. Aucune PR ne relève un cliquet `size-limit`. Aucune PR ne touche `prisma/`. Tous les textes visibles passent par `next-intl` (`src/messages/fr.json` et `src/messages/en.json`, EN toujours désactivé).

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

Les fichiers **partagés** (`page.tsx`, `ArticleGabarit.tsx`, `src/messages/*.json`, `src/styles/article-v2/socle.css`) sont tous préparés par S1/S2 pour que G1…G8 n'aient chacune que **leurs propres fichiers** à modifier : S2 crée d'avance les huit fichiers de gabarit (rendu de repli = Analyse), les huit feuilles de style `@import`ées, et un fichier de messages **par gabarit et par langue** (`src/messages/gabarits/<code>.fr.json` et `.en.json`, fusionnés par `src/i18n/request.ts`, voir S2) afin d'éviter les conflits.

---

## S1 — Socle : interrupteur, type de contenu, aiguillage

- **Branche** : `feat/gabarits-articles-s1-socle`
- **Fichiers touchés** : `src/env.ts` (déclaration + `runtimeEnv`) ; `src/lib/blog/gabarits-v2.ts` (nouveau) ; `src/server/content-gen/blog/gabarits.ts` (nouveau : `GabaritArticle`, `gabaritPourType`, heuristique de repli) ; `src/server/content-gen/blog/loader.ts` (ajouter `generatedByJobId: true` au `select` + `chargerTypeContenu`) ; `src/app/[locale]/blog/[slug]/page.tsx` (insertion unique juste avant le `return (` principal) ; `src/components/article-v2/ArticleGabarit.tsx` (nouveau, squelette qui rend un `<main data-gabarit>` minimal avec les composants existants dans l'ordre du PLAN §4 — pas encore de design) ; tests.
- **Consigne** : ajouter `BLOG_GABARITS_V2` (`z.enum(["true","false"]).optional()`) ; `gabaritsV2Actifs()` lit `process.env.BLOG_GABARITS_V2 === "true"` à chaque appel. Dans `page.tsx`, conserver à l'octet près le JSX actuel et tout le calcul existant ; juste avant le `return (` : `if (gabaritsV2Actifs()) { const type = await chargerTypeContenu(view); return <ArticleGabarit gabarit={gabaritPourType(type, html)} … /> }`. `chargerTypeContenu` fait `prisma.contentGenJob.findUnique({ where:{ id: generatedByJobId }, select:{ contentType:true } })` **seulement si l'interrupteur est allumé** et tolère le Proxy `stub.invalid` (retourne `null`). `gabaritPourType` est un `Record<ContentType, GabaritArticle>` exhaustif selon la table du PLAN §3 + repli HTML pour `null`. Ne pas modifier `generateMetadata`, le JSON-LD, ni la sélection d'image. Transmettre à `ArticleGabarit` le HTML et la table des matières **bruts** (le gabarit construit son sommaire ; `page.tsx:407` et `buildToc` ne changent pas). Test : le HTML V1 interrupteur coupé, hors `<style>`, est identique à celui d'avant la PR.
- **Tests** : table exhaustive (un test énumère `Object.values(ContentType)`) ; repli HTML (3 cas) ; interrupteur absent / `"false"` / `""` / `"true"` ; interrupteur coupé → le rendu de `page.tsx` contient `max-w-[52rem]` et le bandeau « Mis à jour », et **aucun** `data-gabarit` ; interrupteur coupé → `chargerTypeContenu` jamais appelé ; `generateMetadata` identique allumé/éteint ; ensemble des `@id` JSON-LD identique ; verrous existants (`metadata-editoriale`, `sources-eeat`, `un-seul-mis-a-jour-par-article`) toujours verts.

## S3 — Transformations de contenu et accessibilité du corps

- **Branche** : `feat/gabarits-articles-s3-transformations`
- **Fichiers touchés** : `src/server/content-gen/blog/transformations.ts` (nouveau : `envelopperTableaux`, `abaisserH1`, `controlerTitres`, `ancrerSousTitres`, `marquerLiensExternes`) ; `src/server/content-gen/shared/html-sanitizer.ts` (**seulement** si l'option liste blanche est retenue : `caption`, `scope`, `lang` ; **revue de sécurité obligatoire**) ; `src/server/content-gen/guides/loader.ts` (exporter `parseStepsFromBody`, sans changer son comportement) ; tests.
- **Consigne** : fonctions pures, serveur, appliquées **après** le sanitizer. `envelopperTableaux(html)` enveloppe chaque `<table>` dans `<div class="table-scroll" role="region" tabindex="0" aria-labelledby="cap-N">` et garantit un nom (utilise la `<caption>` si présente, sinon génère un libellé neutre passé en paramètre, déjà traduit). `abaisserH1` transforme `<h1>` en `<h2>` du corps. `controlerTitres` renvoie la liste des sauts de niveau (pour les tests et la journalisation) sans réécrire le HTML. `ancrerSousTitres(html, idsExistants)` pose un `id` stable sur les `<h3>`, les questions de FAQ et les étapes **sans jamais modifier l'`id` d'un `<h2>` produit par `buildToc`** (`buildToc` ne lit que les H2, n'agit qu'à partir de 3 H2 et reste gelé). `marquerLiensExternes` ajoute la mention « (nouvelle fenêtre) » masquée visuellement (libellé fourni en paramètre). Si la liste blanche du sanitizer est touchée : ajouter des tests XSS (attributs interdits toujours refusés, `javascript:` refusé).
- **Tests** : entrées/sorties de chaque fonction (tableau sans caption, avec caption, plusieurs tableaux, `colspan`) ; idempotence (double application) ; HTML malformé ; test XSS si sanitizer modifié ; aucune dépendance au DOM navigateur.

## S2 — Composants communs, colonne d'actions, encadrés et feuilles de style (révisée v2)

- **Branche** : `feat/gabarits-articles-s2-composants`
- **Fichiers touchés** :
  - `src/components/article-v2/*.tsx` :
    - composants v1 : `EnteteArticle` → `HerosArticle`, `HeroImageArticle`, `MiseEnPageLecture`, `CorpsArticle`, `TableauDefilant`, `ArticleEtapes`, `PiedArticle` ;
    - **nouveaux en v2** : `ColonneActions`, `CtaMilieu`, `CtaFin`, `Encadre`, `ChiffreCle`, `CitationMiseEnAvant`, `Cartes`, `RangeeChiffres`, `Frise`, `TableauVisuel`, `Checklist`, `Relance`, `ResumeFin`, `BarreProgression` ;
  - `src/components/article-v2/gabarits/Gabarit{Analyse,Guide,Comparatif,Selection,Cas,Definition,Faq,Chiffres}.tsx` : huit fichiers créés d'avance, rendu Analyse ;
  - `src/components/article-v2/ArticleGabarit.tsx` ;
  - `src/styles/article-v2/socle.css`, plus une feuille par gabarit et `actualite.css`, `guide-pilier.css`, toutes créées vides ;
  - **import depuis les routes d'article uniquement**, jamais depuis `globals.css` (PLAN §15.7). `globals.css` ne reçoit au plus que les jetons fluides `@theme`, et seulement si la mesure montre + ≤ 0,3 Ko gz ;
  - `src/components/seo/ArticleTOC.tsx` : variante v2 avec un seul `<nav>` et le `<details>` toujours ouvert sur ordinateur sous `@supports selector(::details-content)` ; la v1 reste inchangée par défaut ;
  - `src/components/content-gen/ArticleFaq.tsx` (`premiereOuverte`, `niveauTitre`) ;
  - `src/components/marketing/AnswerCard.tsx` (`variante="v2"`) ;
  - `src/i18n/request.ts` et `scripts/check-i18n.ts` ;
  - `src/messages/gabarits/{commun,actions,<code>}.{fr,en}.json` ;
  - tests.
- **Consigne** :
  - **Reproduire `maquettes-v2/_socle.css`** et la structure de `maquettes-v2/analyse.html` : en-tête mocha, encadrés, sommaire unique, carte d'actions et barre mobile.
  - `ColonneActions` est **un seul `<aside aria-label="Passer à l'action">`** placé après `</article>`. Il prend en props `gabarit` (pour `depuis=<gabarit>-colonne`) et l'identité Qualiopi optionnelle : rendu **uniquement** si `getQualiopiPublicIdentity()` renvoie une valeur.
  - Les libellés viennent des messages existants (`method1Title` pour « Diagnostic IA, 45 min ») ou de `actions.fr.json`.
  - Les liens sont ceux de `lienDiagnostic(depuis)`, `/journee-ia` et `/contact`, via le `Link` de next-intl.
  - Tout est composant serveur. Jetons de couleur existants uniquement (`anti-hex:check`), aucune nouvelle graisse.
  - Le H1 n'a aucune largeur en `ch` (CLS au chargement des polices).
  - Les règles du visuel de substitution `.v-*` des maquettes ne sont pas reprises.
- **Tests** :
  - rendu de chaque composant ;
  - un seul `aside.action` par page, avec ses 3 liens et des `aria-label` qui contiennent le texte visible ;
  - aucune mention Qualiopi sans identité publiée ;
  - aucun prix ni « Grenoble » dans les messages `actions.*` (test de garde) ;
  - CSS : **`/fr/contact` et l'accueil identiques à l'octet** avant/après, et page d'article ≤ +12 Ko gz ;
  - `bundle:check` vert ;
  - HTML v1 interrupteur coupé identique, hors `<style>` ;
  - `anti-hex`, `use-client:check`, `radius:check` et `check-i18n` verts.

---

## G1 — Gabarit Analyse (défaut et repli)

- **Branche** : `feat/gabarits-articles-g1-analyse`
- **Fichiers touchés** : `src/components/article-v2/gabarits/GabaritAnalyse.tsx`, `src/styles/article-v2/analyse.css`, `src/messages/gabarits/analyse.*.json`, tests.
- **Consigne** : implémenter la maquette `maquettes-v2/analyse.html`. Sommaire H2+H3 ; numéros de chapitre (compteur CSS) et « Revenir au sommaire » au-delà de 2 500 mots ; ordre de fin de page conforme PLAN §4 (FAQ et sources **avant** carte auteur, badge Qualiopi, mention IA, partage). C'est aussi le rendu de repli de tous les autres gabarits tant qu'ils ne sont pas livrés : le garder robuste (tableaux, FAQ absente, image absente).
- **v2** : schéma constat → causes → leviers, chiffre clé et citation **seulement** s'ils viennent du corps balisé par le générateur. Numéros « 04 / 07 » au-dessus des H2, relances « Dans la suite », résumé de fin. `CtaMilieu` après la 3e section, bouton principal « Diagnostic IA, 45 min ».
- **Tests** : règle commune ; rendu avec/sans FAQ, sans image, sans citation ; articles en fichiers (`source !== "db"`) ; seuil de 2 500 mots.

## G2 — Gabarit Guide pratique

- **Branche** : `feat/gabarits-articles-g2-guide`
- **Fichiers touchés** : `GabaritGuide.tsx`, `src/styles/article-v2/guide.css`, `src/messages/gabarits/guide.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/guide.html`. `ArticleEtapes` à partir de `parseStepsFromBody` ; sommaire = étapes ; « Avant de commencer » si le corps débute par des prérequis, sinon rien. Pour `calculator_roi` : formule en `code`/`pre` (Inconsolata, sous la ligne de flottaison) et tableau des scénarios via `TableauDefilant` ; **aucun prix, aucun calculateur interactif**. CTA audit.
- **v2** : bandeau « Le parcours en un coup d'œil », étapes à pastilles géantes « Étape n sur N » avec jauge, checklist « Avant de commencer », consigne à copier (Inconsolata, sous la ligne de flottaison). `CtaMilieu` et `CtaFin` mettent en avant la **Journée IA**.
- **Tests** : règle commune ; rendu avec 0, 1 et 5 étapes (sans étapes → mise en page Analyse) ; `calculator_roi` sans aucun montant ajouté par le gabarit.

## G3 — Gabarit Comparatif

- **Branche** : `feat/gabarits-articles-g3-comparatif`
- **Fichiers touchés** : `GabaritComparatif.tsx`, `src/styles/article-v2/comparatif.css`, `src/messages/gabarits/comparatif.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/comparatif.html`. Premier tableau du corps remonté dans « En bref » (extraction serveur du premier `<table>`, retiré du corps pour éviter le doublon) ; première colonne collante ; entrée « Tableau récapitulatif » au sommaire ; surtitre « Alternatives à … » pour `alternative_to`. Aucun « gagnant », aucune note, aucun prix. CTA audit.
- **v2** : face-à-face A / B en tête, `TableauVisuel` à coches et croix (texte « Oui » et « Non » masqué visuellement, vrai `<table>`) vers 40 % de l'article, cartes « Pour qui ? », arbre de décision, verdict « ça dépend de… ». Bouton principal : Diagnostic.
- **Tests** : règle commune ; sans tableau → pas de bloc « En bref » ; tableau unique non dupliqué ; défilement horizontal à 320 px sans débordement de page ; contraste de l'en-tête de tableau (légende sur sable-deep ≥ AA).

## G4 — Gabarit Sélection (top X)

- **Branche** : `feat/gabarits-articles-g4-selection`
- **Fichiers touchés** : `GabaritSelection.tsx`, `src/styles/article-v2/selection.css`, `src/messages/gabarits/selection.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/selection.html`. H2 numérotés par compteur CSS (aucun JS) ; le compteur ne s'applique qu'aux H2 des options (pas à « FAQ », « Sources »). Tableau de synthèse si présent. CTA audit.
- **v2** : chaque option devient une `CarteSelection` (numéro géant, « n sur N », pour qui / points forts / limites), avec les critères en pastilles et un bandeau « Par où commencer ? ». Bouton principal : **Journée IA**.
- **Tests** : règle commune ; compteur limité aux options ; 3 et 10 options ; lecteur d'écran : le numéro CSS ne duplique pas un numéro textuel déjà présent dans le titre.

## G5 — Gabarit Étude de cas

- **Branche** : `feat/gabarits-articles-g5-cas`
- **Fichiers touchés** : `GabaritCas.tsx`, `FicheContexte` (usage), `src/styles/article-v2/cas.css`, `src/messages/gabarits/cas.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/etude-de-cas.html`. Fiche « Contexte » alimentée **uniquement** par les métadonnées existantes (secteur, ville via `getVille`, catégorie) ; champs absents omis. **Interdit** : encadré de résultats chiffrés, mise en valeur d'un témoignage, tout chiffre extrait du corps. CTA audit.
- **v2** : `FicheContexte` en carte mocha, avec la mention « exemple type » si l'article n'est pas un cas client vérifié, `Frise` Avant / Pendant / Après **sans chiffre**, et « Ce que l'équipe a appris ». Bouton principal : **Journée IA**.
- **Tests** : règle commune ; fiche sans ville ni secteur ; test de garde : le rendu ne contient aucun `<strong>` de chiffre généré par le gabarit.

## G6 — Gabarit Définition

- **Branche** : `feat/gabarits-articles-g6-definition`
- **Fichiers touchés** : `GabaritDefinition.tsx`, `BlocDefinition` (usage), `src/styles/article-v2/definition.css`, `src/messages/gabarits/definition.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/definition.html`. Réponse directe dans `<dfn>` ; image réduite (même fichier, `sizes` plus petit, crédit conservé) ; sommaire masqué sous 4 entrées ; « Termes liés » via `TermesGlossaireLies` ; lien vers `/glossaire`. CTA Journée IA.
- **v2** : terme géant (prononciation et sigle développé si présents en métadonnées), carte « En une phrase / En pratique / À ne pas confondre », termes liés en pastilles. Bouton principal : Diagnostic, comme dans CRO §15.3.
- **Tests** : règle commune ; 2 et 5 entrées de sommaire ; sans termes liés.

## G7 — Gabarit Questions-réponses

- **Branche** : `feat/gabarits-articles-g7-faq`
- **Fichiers touchés** : `GabaritFaq.tsx`, `src/styles/article-v2/faq.css`, `src/messages/gabarits/faq.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/faq.html`. La FAQ est le corps : `ArticleFaq` remonte après la réponse directe, première question ouverte (`premiereOuverte`), niveau de titre cohérent ; sommaire = questions ; image facultative. Pour `qa_derived` : appliquer `abaisserH1` et vérifier qu'aucun `<script type="application/ld+json">` ne survit dans le corps (sinon double FAQPage/QAPage) ; **mesurer d'abord sur un article réel**. CTA rendez-vous.
- **v2** : grille des questions et thèmes en pastilles (si le générateur fournit des thèmes, sinon une seule liste), cartes `<details>` numérotées, encart « Votre question n'est pas là ? » après la 4e question. Bouton principal : **Écrire un message**.
- **Tests** : règle commune ; `qa_derived` avec H1 et JSON-LD dans le corps → un seul h1 et zéro script dans le corps ; une seule `FAQPage` émise ; chaque `Question.name` présent dans `[data-faq-q]`.

## G8 — Gabarit Chiffres (baromètre)

- **Branche** : `feat/gabarits-articles-g8-chiffres`
- **Fichiers touchés** : `GabaritChiffres.tsx`, `src/server/content-gen/blog/charger-releve.ts` (nouveau : lit le `BarometerSnapshot` rattaché à l'article ; **la clé de jointure est à établir d'abord** en lisant `generators/barometer-insight.ts` — l'`inputPayload` du job — sans changer le schéma ; absence de relevé → `null`, tolérant au Proxy `stub.invalid`), `BandeauDonnees` (usage), `src/styles/article-v2/chiffres.css`, `src/messages/gabarits/chiffres.*.json`, tests.
- **Consigne** : maquette `maquettes-v2/chiffres.html`. Bandeau « Données au <date> » + lien Observatoire **seulement** si la date du relevé est disponible ; grands chiffres **seulement** si un composant les reçoit structurés depuis `BarometerSnapshot` (jamais par expression régulière du HTML). Sans donnée structurée : rendu Analyse avec le bandeau. Contraste : mocha + ivoire (13,70 : 1).
- **v2** : `RangeeChiffres` et barres CSS **uniquement** à partir du relevé structuré, avec la valeur écrite en texte et la piste en `aria-hidden` ; encadré « Comment lire ces chiffres ». Lien vers `/fr/observatoire-ia` (et non `/fr/observatoire`, qui n'existe pas). Bouton principal : **Journée IA**.
- **Tests** : règle commune ; avec et sans relevé ; aucun chiffre rendu qui ne vient pas de la donnée structurée.

---

## A1 — Actualités (`/actualites/[slug]`) — nouvelle en v2

- **Branche** : `feat/gabarits-articles-a1-actualites`
- **Fichiers touchés** : `src/app/[locale]/actualites/[slug]/page.tsx` (insertion unique avant le `return (`, derrière `gabaritsV2Actifs()`, sur le même principe que S1) ; `src/components/article-v2/gabarits/GabaritActualite.tsx` et `TriptyqueActualite.tsx` (nouveaux) ; `src/styles/article-v2/actualite.css` ; `src/messages/gabarits/actualite.{fr,en}.json` ; tests.
- **Consigne** : maquette `maquettes-v2/actualite.html`.
  - Format court : héros avec la date et la source d'origine en pastille, triptyque « Ce qui change / Pour qui / Que faire maintenant » qui reprend le « Point clé » existant (`data-aeo` conservé), encadré « Source d'origine » avec lien et date, frise des dates si l'article en fournit.
  - `ColonneActions` avec `depuis=actualite-colonne`, plus un `CtaMilieu` et un `CtaFin`.
  - `<article>` englobe désormais l'en-tête et les sources, pas seulement le corps.
  - Le badge « Brève (non indexée) » n'est plus affiché au public. Le `noindex` lui-même ne change pas.
  - Le JSON-LD (`NewsArticle`, `BreadcrumbList`), les metadata et l'URL restent identiques.
- **Tests** : règle commune ; interrupteur coupé → HTML identique ; un seul `aside.action` ; `NewsArticle` inchangé ; brève non indexée toujours `noindex`.

## GU1 — Guides pilier (`/guides/[slug]`) — nouvelle en v2

- **Branche** : `feat/gabarits-articles-gu1-guides`
- **Fichiers touchés** : `src/app/[locale]/guides/[slug]/page.tsx` (insertion unique avant le `return (`, derrière `gabaritsV2Actifs()`) ; `src/components/article-v2/gabarits/GabaritGuidePilier.tsx` et `BandeauChapitre.tsx` (nouveaux) ; `src/styles/article-v2/guide-pilier.css` ; `src/messages/gabarits/guide-pilier.{fr,en}.json` ; tests.
- **Consigne** : maquette `maquettes-v2/guide-pilier.html`.
  - Sommaire en grille de chapitres avec progression ; bandeaux de chapitre « Chapitre n sur N » (durée, temps restant, « Aller au chapitre suivant » avec le numéro masqué visuellement).
  - Étapes structurées : les ids `step-N` sont conservés. Feuille de route finale.
  - « Téléchargez le guide » : réutiliser `ArticleNewsletterInline`, sans nouveau formulaire. Deux `CtaMilieu`.
  - Mise en page ordinateur propre à ce gabarit : le sommaire reste dans la colonne de lecture, la carte d'action colle en haut de la colonne droite.
  - Corriger au passage, **seulement si le propriétaire valide** :
    - les articles liés codés en dur en `/blog/` → route résolue (supprime des 308) ;
    - l'affichage de l'auteur et des dates.
  - `HowTo.totalTime` (rempli avec le temps de lecture) : signalé, traité dans J1 ou F1.
- **Tests** : règle commune ; interrupteur coupé → HTML identique ; ids `step-N` inchangés ; un seul `BreadcrumbList` une fois F1 fusionnée.

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
