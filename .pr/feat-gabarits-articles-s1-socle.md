# S1 — Socle des gabarits d'articles : interrupteur, type de contenu, aiguillage

## But

Poser le socle de la fiche S1 (`docs/design/gabarits-articles/DECOUPAGE.md`) : un interrupteur
`BLOG_GABARITS_V2` **éteint par défaut**, la lecture du type de contenu d'un article, et
l'aiguillage vers le bon gabarit. Aucun design ici : S2 puis G1…G8 viennent remplacer le squelette,
en suivant les maquettes v3 validées (#2423 : en-tête du site, héros terracotta, vraie photo).
**Rien ne change pour le visiteur** tant que l'interrupteur reste éteint.

## Fichiers

- `src/env.ts` : déclaration `BLOG_GABARITS_V2` (`"true" | "false"`, optionnelle) + `runtimeEnv`.
- `src/lib/blog/gabarits-v2.ts` : `gabaritsV2Actifs()`, seule la valeur exacte `"true"` allume, lue à chaque appel, serveur seulement.
- `src/server/content-gen/blog/gabarits.ts` : `GABARIT_PAR_TYPE` (`Record<ContentType, …>` exhaustif), `gabaritDeRepli` (tableau ≥ 3 lignes → comparatif, liste ≥ 3 étapes → guide, sinon analyse), `gabaritPourType`.
- `src/server/content-gen/blog/loader.ts` : `generatedByJobId` ajouté au `select` existant ; `chargerTypeContenu` (aucune requête sans job, tolère le Proxy `stub.invalid`).
- `src/app/[locale]/blog/[slug]/page.tsx` : une seule insertion, derrière `gabaritsV2Actifs()`, avant le `return` V1 ; le JSX V1, `generateMetadata` et le JSON-LD ne sont pas touchés.
- `src/components/article-v2/ArticleGabarit.tsx` : squelette serveur (composants existants, aucun CSS ni jeton nouveau, pas de JS client). Conteneur `<div data-gabarit>` : le `main` est porté par le layout.
- `src/messages/{fr,en}.json` : clés `articleV2.*` (mêmes libellés que la V1).
- `docs/design/gabarits-articles/DECOUPAGE.md` : fiche S1 alignée (`div` et non `main`).
- Tests : `tests/unit/blog/gabarits-{socle,rendu-socle,aiguillage-page}.spec.ts*`.

## Rebase

Rebasée sur `origin/main` (6765b2bc) : 2 commits rejoués, **aucun conflit**.

## Vérifications exécutées (2026-11-27)

- `pnpm typecheck` : OK.
- `vitest` : `tests/unit/blog` (50 tests) + `tests/unit/seo/metadata-editoriale.spec.ts` : OK.
- `pnpm i18n:check` : OK (622 clés synchronisées).
- Neutralité design : le squelette n'ajoute aucun style ; en-tête du site, héros (`Section`) et vraie photo (`featuredImage` + crédit) sont ceux de l'existant.
- Aucune mention interdite (Grenoble, faux témoignage, prix barré, frais de déplacement, réservation directe, avocat).

## Relecture Opus

1re passe (relecture Opus) : « À CORRIGER » pour (a) corps de PR vide, (b) tests de parité `generateMetadata` / JSON-LD manquants, (c) commentaire de `page.tsx` inexact (« aucun module V2 évalué »). Les trois sont corrigés dans ce lot (+ fiche `<main>` → `<div>`).

## Risques

Faible : interrupteur éteint = chemin V1 inchangé, aucune requête ajoutée (hors un champ dans un `select` existant). À l'allumage, rendu volontairement sans design (S2).

2e passe (Opus, sur le contenu indexé puis commité à l'identique) : corrections jugées justes ; verdict conditionné au commit sans modification, condition remplie.

VERDICT OPUS : BON
