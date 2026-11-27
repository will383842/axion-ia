Encart vidéo E0 : la catégorie « implémentations » a enfin son encart, et chaque encart a son propre identifiant

## Ce qui change

1. **Catégorie « implémentations »** : le slug réel est `blog-implementations-ia` (au pluriel). La table des mots de `src/server/videos/encarts.ts` ne connaissait que le singulier, donc ces articles n'avaient jamais d'encart. Le pluriel est ajouté (thème « automatisation »).
2. **Test sur les vrais slugs** : le test parcourt maintenant les vrais `BLOG_CATEGORY_SLUGS` et exige un thème pour chacun (avec la divulgation de l'organisme de formation allumée, comme dans le reste du fichier).
3. **Identifiant unique par encart** : l'identifiant fixe `encart-en-video` est remplacé par un identifiant propre à chaque instance (`useId`), pour que deux encarts sur une page ne partagent jamais le même. Le composant reste un composant serveur, sans aucun JavaScript côté navigateur.

## Contrôles

- Tests écrits d'abord : 3 rouges avant le correctif, tous verts après.
- `pnpm typecheck` : vert. `prettier --check` : vert.
- Tests ciblés (`tests/unit/videos`, `src/server/videos`, `src/components/videos`, pages vidéos) : 23 fichiers, 351 tests verts.
- Aucune migration, aucun « use client », aucun fichier interdit touché. Rien n'est allumé.

VERDICT OPUS : BON
