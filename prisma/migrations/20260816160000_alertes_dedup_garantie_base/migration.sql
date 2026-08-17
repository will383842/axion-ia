-- T3a — La déduplication des alertes devient une garantie de BASE.
--
-- Aujourd'hui, `creerOuDedup` fait un `findFirst` puis un `create`. Entre les
-- deux, rien n'empêche un second passage du cron (ou un appel manuel depuis la
-- console) d'insérer la même alerte : la lecture des deux voit « aucun
-- doublon », les deux écrivent. La dé-duplication n'est pas garantie, elle est
-- ESPÉRÉE. C'est aussi ce couple lecture-puis-écriture qui oblige le moteur à
-- traiter les alertes une par une, alors qu'un `createMany` suffirait.
--
-- Une contrainte d'unicité partielle règle les deux d'un coup : la base refuse
-- le doublon, et `ON CONFLICT DO NOTHING` (le `skipDuplicates` de Prisma)
-- devient utilisable pour une insertion en masse.

-- ── 1. Index composite de lecture ───────────────────────────────────────────
--
-- `(code, cible_id, resolue)` couvre exactement le prédicat de dé-duplication
-- et celui de la résolution automatique, qui lit toutes les alertes ouvertes
-- d'une liste de codes. Les index existants (`code` seul, `resolue` seul) ne
-- couvrent ni l'un ni l'autre : Postgres combine deux bitmaps ou balaie.
CREATE INDEX IF NOT EXISTS "alertes_systeme_code_cible_id_resolue_idx"
  ON "alertes_systeme" ("code", "cible_id", "resolue");

-- ── 2. Purge des doublons DÉJÀ présents ─────────────────────────────────────
--
-- 🔴 Sans cette étape, la création de l'index unique ci-dessous ÉCHOUE si la
-- base contient un seul doublon — et comme l'entrypoint du conteneur exécute
-- `prisma migrate deploy` au démarrage, l'échec empêcherait le conteneur de
-- démarrer. Une migration qui peut mettre le site à terre selon le contenu de
-- la base n'est pas acceptable.
--
-- On garde la PLUS ANCIENNE de chaque famille : c'est elle qui porte la date de
-- première détection, la seule information que le doublon n'a pas. Les autres
-- sont supprimées, pas « résolues » — les marquer résolues affirmerait qu'un
-- humain a traité quelque chose, ce qui serait faux.
DELETE FROM "alertes_systeme" a
USING "alertes_systeme" b
WHERE a."resolue" = false
  AND b."resolue" = false
  AND a."code" = b."code"
  AND a."cible_id" IS NOT DISTINCT FROM b."cible_id"
  AND (a."created_at" > b."created_at"
       OR (a."created_at" = b."created_at" AND a."id" > b."id"));

-- ── 3. La contrainte ────────────────────────────────────────────────────────
--
-- Partielle (`WHERE resolue = false`) : deux alertes du même code sur la même
-- cible sont parfaitement légitimes si la première a été résolue. Ce qui est
-- interdit, c'est d'en avoir deux OUVERTES en même temps.
--
-- `COALESCE(cible_id, ...)` et non `(code, cible_id)` : en SQL, deux NULL sont
-- distincts, donc un index unique ordinaire laisserait passer autant d'alertes
-- globales (sans cible) qu'on veut — précisément les alertes dont le doublon se
-- voit le plus dans la console, puisqu'elles ne sont rattachées à rien.
-- `NULLS NOT DISTINCT` ferait l'affaire depuis PG15, mais l'expression ci-
-- dessous ne suppose rien de la version.
CREATE UNIQUE INDEX IF NOT EXISTS "alertes_systeme_dedup_ouverte_uniq"
  ON "alertes_systeme" (
    "code",
    COALESCE("cible_id", '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE "resolue" = false;
