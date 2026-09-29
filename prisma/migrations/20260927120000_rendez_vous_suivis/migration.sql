-- Suivi des rendez-vous après l'appel (2026-09-27) — ADDITIF uniquement.
--
-- Nouvelle table `rendez_vous_suivis` (1 ligne au plus par `calendly_events`) et deux
-- énumérations. AUCUNE colonne ajoutée à `calendly_events` : le worker, qui écrit cette
-- table en continu, atterrit ~50 min avant que l'app ne joue la migration, et ne lit
-- jamais la nouvelle table — il n'est donc pas concerné par la fenêtre app/worker.
--
-- Réversible :
--   DROP TABLE "rendez_vous_suivis";
--   DROP TYPE "rendez_vous_suite";
--   DROP TYPE "rendez_vous_issue";

CREATE TYPE "rendez_vous_issue" AS ENUM ('eu_lieu', 'absent', 'reporte');

CREATE TYPE "rendez_vous_suite" AS ENUM ('devis', 'relance', 'proposition', 'aucune');

CREATE TABLE "rendez_vous_suivis" (
    "id" TEXT NOT NULL,
    "calendly_event_id" TEXT NOT NULL,
    "issue" "rendez_vous_issue" NOT NULL,
    "suite" "rendez_vous_suite",
    "suite_le" DATE,
    "note" TEXT,
    "renseigne_par" VARCHAR(255),
    "renseigne_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rendez_vous_suivis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rendez_vous_suivis_calendly_event_id_key" ON "rendez_vous_suivis"("calendly_event_id");

CREATE INDEX "rendez_vous_suivis_issue_idx" ON "rendez_vous_suivis"("issue");

CREATE INDEX "rendez_vous_suivis_suite_le_idx" ON "rendez_vous_suivis"("suite_le");

ALTER TABLE "rendez_vous_suivis" ADD CONSTRAINT "rendez_vous_suivis_calendly_event_id_fkey" FOREIGN KEY ("calendly_event_id") REFERENCES "calendly_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
