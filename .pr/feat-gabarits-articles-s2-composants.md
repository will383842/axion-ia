# S2 — Composants communs, jetons et feuilles de style des gabarits d'articles

> ⚠️ **Cette branche est basée sur S1** (`feat/gabarits-articles-s1-socle`), qui n'était **pas encore fusionnée sur `main`** au moment de la poussée. À rebaser après la fusion de S1 : `git rebase --onto origin/main origin/feat/gabarits-articles-s1-socle`.
>
> ⚠️ **Rien n'a pu être exécuté** : `node_modules` est absent de l'environnement de cette tâche (l'installation a été refusée par le garde-fou). Tests Vitest, `pnpm typecheck`, `pnpm lint`, `check-i18n`, `anti-hex`, `use-client:check`, `radius:check`, `bundle:check` et la mesure du First Load JS de `/blog/[slug]` sont **à lancer en CI**. Le code a été relu à la main (et par un sous-agent) mais non compilé. Le formatage Prettier a été fait **sans le plugin Tailwind** (absent) : l'ordre des classes peut demander un `prettier --write` en CI.

## But

Livrer la couche commune des gabarits d'articles (DECOUPAGE.md, PR S2) pour que G1…G8 n'aient chacune que leurs propres fichiers. Tout reste derrière `BLOG_GABARITS_V2="true"` (éteint par défaut) : interrupteur coupé, `page.tsx` et le HTML V1 ne changent pas (`page.tsx` n'est pas touché par cette PR).

## Contenu

- **12 composants serveur** `src/components/article-v2/` : `EnteteArticle`, `HeroImageArticle` (enveloppe `<Image>` + `UnsplashCredit`, `loading="eager"`, `fetchPriority="high"`, `sizes` imposé ; ni sélection d'image ni attribution modifiées), `MiseEnPageLecture`, `CorpsArticle`, `TableauDefilant`, `ArticleEtapes`, `EncadreArticle`, `FicheContexte`, `BlocDefinition`, `BandeauDonnees`, `PiedArticle`, `CtaGabarit`, plus `types.ts`.
- **8 fichiers de gabarit** `gabarits/Gabarit*.tsx` créés d'avance (rendent la mise en page Analyse, avec leur CTA : audit / Journée IA / rendez-vous) ; `ArticleGabarit.tsx` = aiguillage exhaustif (`Record<GabaritArticle, …>`).
- **Feuilles** `src/styles/article-v2/{base,analyse,guide,comparatif,selection,cas,definition,faq,chiffres}.css`, **toutes** les règles bornées à `[data-gabarit]` / `html:has([data-gabarit])` (dont `scroll-padding-top`, `color-scheme: light`, `--focus-ring`, anneau de focus clair sur surface mocha, `forced-colors`). Aucun hexadécimal.
- **`globals.css`** : un seul ajout — jetons fluides `--article-*` dans `@theme` et neuf `@import` juste après `@import "tailwindcss"`.
- **Variantes par prop, V1 intacte par défaut** : `ArticleTOC` (`variante="v2"`, `cibleTactile`, `niveauMax`, `libelle` ; deux `<nav aria-label>`, `<ol>` imbriqués pour les H3) ; `ArticleFaq` (`variante`, `premiereOuverte`, `niveauTitre`, `titre` ; padding sur `<summary>`, id de titre dédié `art-faq-titre`) ; `AnswerCard` (`variante="v2"`, `libelle` ; `data-aeo="tldr"` et `.tldr-answer` conservés).
- **Messages** : `src/messages/gabarits/{commun,analyse,guide,…}.{fr,en}.json` (9 paires ; les 8 gabarits vides), chargeur `src/i18n/messages-gabarits.ts`, fusion dans `src/i18n/request.ts` sous `articleGabarits` (serveur seulement, hors `NAMESPACES_CLIENT`), `scripts/check-i18n.ts` étendu à ces fichiers.

## Tests (non exécutés ici)

- `tests/unit/blog/article-v2-composants.spec.tsx` : rendu de chaque composant, des huit gabarits (un h1, ancres du sommaire, deux `<nav>`, un seul CTA, pas de saut de titre), variantes V2, et V1 par défaut (fragments exacts de balisage V1 + égalité avec `variante="v1"`).
- `tests/unit/blog/article-v2-garde-fous.spec.ts` : aucun `"use client"`/hook d'état, aucun hexadécimal, chaque règle CSS bornée, `globals.css` (neuf imports avant toute règle), messages fr/en alignés, clés littérales utilisées présentes.
- Non couverts ici (à faire en CI / T1) : axe 1280/320 px, instantané complet du HTML V1 avant/après (le JSX V1 de `page.tsx` n'est pas modifié ; les trois composants partagés gardent leur chemin V1 inchangé, vérifié à la relecture).

## Risques / points à vérifier en CI

- **CSS inlinée** : estimée ≈ 1,8 Ko gz pour `base.css` (budget ≤ 2 Ko) : à mesurer sur build ; G1…G8 disposent de peu de marge.
- **First Load JS de `/blog/[slug]`** : aucun JS client ajouté, aucun cliquet relevé ; mesure avant/après **non faite** (base PLAN §7 : 249,70 Ko gz, chunks propres 30,49 Ko). À mesurer avec le script du PLAN.
- Les composants réutilisés (`ArticleSources`, `ArticleShareBar`, `ArticleKeyTakeaway`…) gardent leurs `Section`/`Container` V1 : espacements imbriqués résiduels dans `.art-pied`, dette notée pour G1.
- Les tableaux enveloppés par S3 (`table-scroll`) reçoivent le même style que `.art-tscroll`.
- Dates affichées en ISO brut (comme en V1) ; formatage à traiter en G1.
- Les pastilles du sommaire ne numérotent que les H2 alors que `position` de l'`ItemList` JSON-LD compte aussi les H3 : à aligner en J1.

## Relecture

Relecture Opus faite sur le diff (1 tour) : 2 problèmes P1 (rail de sommaire non collant ; tests V1 trop faibles) et plusieurs P2/P3 (CSS morte, id `faq` en double, double décalage d'ancre, classe de tableau S3) — **corrigés** dans cette branche, sauf la dette notée ci-dessus. Relecture de contrôle non refaite (limite de la tâche).

VERDICT OPUS : À CORRIGER
