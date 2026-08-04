-- Incidents imputables à un intervenant externe (art. 7 et 8 de la procédure de
-- sous-traitance signée le 2026-08-03).
--
-- ── Pourquoi ces colonnes ────────────────────────────────────────────────────
--
-- L'article 7 impose de consigner « toute difficulté » rencontrée avec un
-- sous-traitant, et l'article 8 d'en tenir compte à la reconduction. Rien ne le
-- portait : un formateur pouvait annuler trois fois à la veille d'une session
-- sans qu'aucune trace ne subsiste, et être reconduit l'année suivante.
--
-- ── Pourquoi PAS une table dédiée ────────────────────────────────────────────
--
-- On étend le registre `incidents` existant plutôt que d'en créer un second.
-- Un formateur qui fait tomber une session est un incident de pilotage au même
-- titre qu'une panne de salle : une table `incidents_formateur` séparée l'aurait
-- rendu invisible aux métriques M7/M9 et à la revue de direction, et aurait
-- présenté DEUX registres « incidents » à l'auditeur — exactement le genre
-- d'écart qu'une visite de surveillance relève.
--
-- ── Une cible, deux natures, et le cas « aucune » ────────────────────────────
--
-- Axion a deux natures d'intervenant externe (personne physique, organisme). Un
-- incident en vise UNE, ou AUCUNE — un incident technique ne met personne en
-- cause. La contrainte autorise donc les trois états et interdit le seul qui n'a
-- pas de sens : les deux cibles à la fois.
--
-- ── Ce que le modèle ne fait PAS ─────────────────────────────────────────────
--
-- Il ne porte aucun jugement. `fait_intervenant` décrit un FAIT observable —
-- « annulation tardive » se constate, « peu sérieux » non. Le niveau de vigilance
-- est DÉRIVÉ de ces lignes, jamais saisi : une note attribuée à la main serait
-- une opinion, pas une preuve, alors que l'article 8 exige de motiver une
-- non-reconduction sur des faits.

CREATE TYPE "IncidentFaitIntervenant" AS ENUM (
  'annulation_tardive',
  'desistement',
  'retard',
  'preuve_manquante',
  'qualite_insuffisante',
  'autre'
);

-- Colonnes NULLABLES : aucune ligne existante n'est touchée, aucune mise en
-- cause rétroactive n'est inventée sur les incidents déjà consignés.
ALTER TABLE "incidents"
  ADD COLUMN IF NOT EXISTS "trainer_id"       UUID,
  ADD COLUMN IF NOT EXISTS "sous_traitant_id" UUID,
  ADD COLUMN IF NOT EXISTS "fait_intervenant" "IncidentFaitIntervenant";

-- Jamais les deux cibles à la fois. Aucune cible reste permis.
ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_une_seule_cible_intervenant"
  CHECK (NOT ("trainer_id" IS NOT NULL AND "sous_traitant_id" IS NOT NULL));

CREATE INDEX IF NOT EXISTS "incidents_trainer_id_idx"       ON "incidents" ("trainer_id");
CREATE INDEX IF NOT EXISTS "incidents_sous_traitant_id_idx" ON "incidents" ("sous_traitant_id");

-- ── Suppressions : SET NULL, jamais CASCADE ─────────────────────────────────
--
-- Supprimer un formateur ne doit PAS effacer les incidents qu'il a causés. Ces
-- lignes alimentent les métriques de pilotage et ont pu être présentées en revue
-- de direction : les faire disparaître réécrirait un historique déjà exploité.
-- L'incident survit, orphelin de sa cible — ce qui est l'information exacte.

ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_trainer_id_fkey"
  FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_sous_traitant_id_fkey"
  FOREIGN KEY ("sous_traitant_id") REFERENCES "sous_traitants_of"("id") ON DELETE SET NULL ON UPDATE CASCADE;
