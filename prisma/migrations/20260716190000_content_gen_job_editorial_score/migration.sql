-- Boucle qualite content-gen — score du juge LLM sur ContentGenJob (migration ADDITIVE).
--
-- Bug 2026-05-21 → 2026-07-16 : `content-quality-improver-worker` ecrivait
-- `editorialScore` via `prisma.contentGenJob.update()` alors que la colonne
-- n'existait que sur `articles`. Prisma rejetait l'update entier
-- (« Unknown argument `editorialScore` ») → tout job entre dans la boucle
-- qualite restait bloque en `quality_improving` indefiniment (44 jobs en prod).
--
-- Le TypeScript ne detectait rien : le champ etait passe via un spread
-- conditionnel (`...(x !== null ? { editorialScore: x } : {})`), forme sur
-- laquelle l'excess property check ne s'applique pas.
--
-- Nullable sans default : les lignes existantes restent NULL (juge pas passe).

ALTER TABLE "content_gen_jobs" ADD COLUMN "editorial_score" INTEGER;
