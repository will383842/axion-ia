-- Autofacturation : le mandat, l'identité fiscale du sous-traitant,
-- et la fenêtre de contestation.
--
-- ## Pourquoi la colonne AVANT le code
--
-- Deux conteneurs, deux vitesses (cf. AGENTS.md). Le worker est reconstruit par
-- Coolify depuis les SOURCES en ~3 min ; l'app attend son image GHCR pendant
-- 47 à 56 min. Or c'est l'entrypoint de l'APP qui joue `prisma migrate deploy` :
-- pendant près d'une heure, le worker peut exécuter du code qui attend une
-- colonne que la migration n'a pas encore posée.
--
-- La règle du dépôt est donc « ajouter avant de lire ». Cette migration ne fait
-- qu'ajouter des colonnes NULLABLES, sans défaut, sans contrainte : aucune
-- lecture n'en dépend au moment où elle passe, et le code qui les lira arrivera
-- après.
--
-- ## Ce que ces colonnes rendent POSSIBLE, et qui ne l'était pas
--
-- 🔴 Une facture d'autofacturation exige QUATRE éléments pour être régulière :
-- un mandat écrit et PRÉALABLE, la mention « Autofacturation », l'émission au
-- nom et pour le compte du sous-traitant, et un droit de contestation. Il en
-- manque un seul et la pièce est irrégulière : la TVA qu'elle porte n'est pas
-- déductible.
--
-- Deux de ces quatre ne se déduisent d'aucun code : le mandat lui-même, et
-- l'identité fiscale du sous-traitant (SIRET, n° de TVA intracommunautaire) que
-- la facture émise en son nom doit porter. Sans elles, le code ne peut pas
-- REFUSER d'émettre — et un garde-fou qui ne peut pas refuser n'est pas un
-- garde-fou.
--
-- ⚠️ Le mandat est une DATE, pas un booléen : « préalable » se vérifie contre
-- la date d'émission de la pièce. Et la révocation est une SECONDE date plutôt
-- qu'un effacement de la première — révocable à tout moment, « sans effet
-- rétroactif sur les factures déjà émises » : effacer la signature rendrait
-- irrégulières, a posteriori, des pièces qui étaient régulières le jour de leur
-- émission.

-- ── Le sous-traitant : son identité fiscale et son mandat ───────────────────
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "siret" VARCHAR(14),
  ADD COLUMN IF NOT EXISTS "numero_tva_intracom" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "mandat_autofacturation_signe_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mandat_autofacturation_revoque_at" TIMESTAMP(3);

-- ── Le relevé : qui a émis la pièce, et où en est le droit de contester ─────
--
-- `numero_facture` / `date_facture` restent la seule identité de la facture,
-- qu'elle vienne du formateur ou de nous. Ces colonnes-ci ne disent pas
-- « quelle facture » mais « qui l'a émise, et jusqu'à quand elle se conteste ».
ALTER TABLE "trainer_statements"
  ADD COLUMN IF NOT EXISTS "autofacture_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autofacture_transmise_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contestation_avant_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contestee_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contestation_motif" TEXT;

-- Les relevés dont la fenêtre de contestation se ferme se balaient par ÉCHÉANCE,
-- jamais par identité — même raison que `trainer_statements_echeance_at_idx`.
CREATE INDEX IF NOT EXISTS "trainer_statements_contestation_avant_at_idx"
  ON "trainer_statements" ("contestation_avant_at");

-- ── La pièce au registre des documents générés ──────────────────────────────
--
-- ⚠️ AJOUTER LA VALEUR AVANT LE CODE QUI L'ÉMET. Le worker est reconstruit en
-- ~3 min depuis les sources, l'app attend son image GHCR 47-56 min, et c'est
-- l'entrypoint de l'APP qui joue les migrations : une valeur d'énumération
-- écrite par l'un et inconnue de l'autre casse pendant près d'une heure.
-- Ici la valeur n'est encore émise par personne : la fenêtre est inoffensive.
--
-- `ADD VALUE IF NOT EXISTS` est idempotent ; hors transaction sur les Postgres
-- antérieurs à 12, ce qui n'est pas notre cas.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'autofacture_honoraires';
