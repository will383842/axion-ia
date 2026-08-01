-- Lettre de mission-CADRE — la pièce doit connaître son mandataire.
--
-- ## Ce que cette migration ferme
--
-- `documents_generes` ne portait AUCUNE clé vers `trainers` : le formateur
-- qu'une lettre de mission nomme n'était retrouvable que par un détour — la
-- session rattachée, puis son formateur principal. Ce détour suffisait tant
-- qu'une lettre = une session.
--
-- La lettre-cadre (une lettre couvrant PLUSIEURS sessions d'une période, une
-- seule signature du sous-traitant) casse ce détour : `session_id` y est NULL,
-- et sans lui plus rien ne sait à qui la pièce appartient — ni l'espace
-- formateur pour l'afficher, ni l'action de signature pour l'autoriser.
--
-- ⚠️ La solution de facilité aurait été `metadata.trainerId`. Refusée :
-- l'identité d'un signataire se résout depuis les RATTACHEMENTS de la pièce,
-- jamais depuis un champ libre (doctrine posée par refs-circuits.spec.ts après
-- les trois circuits inatteignables de la PR 452).
--
-- `ON DELETE SET NULL` : un formateur peut être retiré du référentiel ; la
-- pièce émise, elle, est immuable et doit survivre. Ses données de rendu sont
-- de toute façon figées dans `metadata.renderData`.
ALTER TABLE "documents_generes"
  ADD COLUMN "trainer_id" UUID;

ALTER TABLE "documents_generes"
  ADD CONSTRAINT "documents_generes_trainer_id_fkey"
  FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- (trainer_id, type) et non trainer_id seul : la lecture réelle est toujours
-- « les lettres de mission de CE formateur » (espace formateur + console).
CREATE INDEX "documents_generes_trainer_id_type_idx"
  ON "documents_generes"("trainer_id", "type");

COMMENT ON COLUMN "documents_generes"."trainer_id" IS
  'Formateur mandaté par la pièce (lettre de mission, dont lettre-cadre où session_id est NULL). Alimenté à la génération.';
