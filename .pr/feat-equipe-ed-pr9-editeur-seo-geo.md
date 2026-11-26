# Éditeur SEO / GEO (équipe éditoriale, PR 9)

**Dépend de #2363.** Cette branche part de `feat/equipe-ed-pr5-plan-bloquant`.

## But

Un éditeur qui corrige les articles par petites touches, derrière `CONTENT_EQUIPE_EDITORIALE` (éteint par défaut, actif seulement si la valeur vaut exactement `true`).

## Fichiers

- `src/server/content-gen/equipe/edition-seo.ts` (nouveau) : règles de code (méta-titre 50–60, méta-description 140–160, mot-clé dans H1, méta-titre, méta-description, premier paragraphe et un H2 au moins, 3 passages citables au moins, FAQ de 4 à 6 questions non redondantes avec les H2 ni entre elles, entités du brief) ; appel de claude-sonnet-5-5 par la porte Claude existante (`genererTexteBlogClaude`, rôle « ecriture »), injectable ; le modèle ne rend qu'une liste de remplacements (champ, ancien → nouveau). Un remplacement est refusé si l'ancien texte est introuvable ou ambigu, identique au nouveau, porteur de script ou d'attribut d'événement, au-delà de 12, ou si plus de 25 % du corps est touché (donc pas de réécriture). Échec du modèle : l'article reste tel quel.
- `src/server/content-gen/quality/passages-citables.ts` (nouveau, pur) : détection des passages citables (paragraphe autonome de 40 à 80 mots, sans renvoi en tête), partagé avec la note SEO sans importer de code serveur.
- `src/server/content-gen/quality/seo-score.ts` : grille « équipe » seulement interrupteur allumé (toujours 100 points) : mot-clé noté sur titre/H1/méta-description/premier paragraphe/H2, longueur 10 → 6 points + 4 points « 3 passages citables », l'auteur actuel (`hasAuteurActuelJsonLd`) satisfait le critère d'auteur. La FAQ compte dès 4 questions, sans condition d'affichage enrichi (c'était déjà le cas dans la note). Interrupteur éteint : grille et notes strictement inchangées.
- `src/lib/seo-content-gen-factories.ts` : `buildBlogPostingEquipeJsonLd` (éteint : identique à `buildBlogPostingJsonLd`) ; allumé : `isBasedOn`, `dateModified` honnête (jamais avant la publication ni dans le futur), `reviewedBy` seulement si un relecteur est fourni (jamais par défaut ; auteur/affichage inchangés).
- `src/app/[locale]/blog/[slug]/page.tsx` : appelle la nouvelle fabrique et passe les sources déjà chargées par `blog/loader.ts`. JSON-LD rendu côté serveur, aucun JS navigateur ajouté. BreadcrumbList (via `<Breadcrumbs>`) et Organization (`#organization`) sont déjà émis : pas de doublon.

## Tests

`edition-seo.test.ts` (bornes des métas, passages citables, FAQ, entités, remplacements, interrupteur éteint, injection du modèle), `seo-score-equipe.spec.ts` (nouvelle note, interrupteur éteint), `seo-content-gen-factories.spec.ts` étendu (JSON-LD, dateModified, relecteur). `pnpm typecheck`, eslint et les specs `quality/` : verts.

## Risques

- Interrupteur éteint : aucun changement de comportement (testé). Allumé : les notes SEO changent de grille.
- L'éditeur n'est pas encore branché dans un générateur : cette PR livre le module, la note et le JSON-LD.
- `typecheck` exige `NODE_OPTIONS=--max-old-space-size=8192` sur ce poste.
