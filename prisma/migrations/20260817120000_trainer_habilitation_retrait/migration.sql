-- 🔴 L'habilitation d'un formateur cesse de s'effacer sans laisser de trace.
--
-- Avant : dé-habiliter = `DELETE`. La ligne disparaissait, et avec elle la
-- réponse à « depuis quand ce formateur n'est-il plus habilité ? ».
--
-- Pire : si une session a été ANIMÉE alors que le formateur était habilité,
-- retirer l'habilitation aujourd'hui détruisait la preuve de conformité de
-- cette session PASSÉE. Un auditeur remontant un dossier de l'an dernier ne
-- pouvait plus établir que l'intervenant y était habilité (ind. 21/22).

-- ── 1. Les colonnes de retrait ──────────────────────────────────────────────
ALTER TABLE "trainer_habilitations"
  ADD COLUMN IF NOT EXISTS "retire_at"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "retire_by_id"  UUID,
  ADD COLUMN IF NOT EXISTS "motif_retrait" TEXT;

-- ── 2. L'unicité devient PARTIELLE ─────────────────────────────────────────
--
-- 🔴 Sans cela, ré-habiliter un formateur après un retrait ÉCHOUERAIT : la
-- ligne retirée occupe encore le couple (trainer, formation). L'unicité ne doit
-- porter que sur les habilitations ACTIVES — deux habilitations successives sur
-- la même formation sont légitimes, c'est même le cas normal d'un retrait suivi
-- d'une re-prononciation.
--
-- ⚠️ Aucune donnée n'est touchée : toutes les lignes existantes ont
-- `retire_at IS NULL`, donc l'index partiel les couvre exactement comme
-- l'ancien index total. La migration est réversible sans perte.
DROP INDEX IF EXISTS "trainer_habilitation_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "trainer_habilitation_active_uniq"
  ON "trainer_habilitations" ("trainer_id", "formation_id")
  WHERE "retire_at" IS NULL;

-- Lecture : le prédicat courant est (trainer, formation), avec ou sans filtre
-- sur le retrait. L'index partiel ne couvre pas les lectures d'historique.
CREATE INDEX IF NOT EXISTS "trainer_habilitations_trainer_id_formation_id_idx"
  ON "trainer_habilitations" ("trainer_id", "formation_id");
