-- 🔴 D6 — le remplacement d'un formateur DÉTRUISAIT sa trace (2026-09-05).
--
-- `assignTrainerToSessionAction`, le refus et le passage `sans_reponse`
-- supprimaient la ligne `session_formateurs` : avec elle partaient le tarif
-- snapshoté, les heures animées et les envois déjà faits (convocation J-7,
-- rappel J-1). Plus rien ne disait qu'une personne avait été le formateur de
-- cette session.
--
-- Le patron du dépôt (« retirer par une DATE », cf. trainer_habilitations,
-- 2026-08-17) n'est pas transplantable ici : `session_formateurs` signifie
-- « qui anime MAINTENANT » et une vingtaine de lectures s'en servent telle
-- quelle (convocation, émargement, signature, paie, alertes). Une ligne
-- conservée sans filtrer ces lecteurs paierait et convoquerait un formateur
-- écarté. On archive donc À CÔTÉ, sans toucher au sens de la table vivante.
--
-- Purement ADDITIF : aucune colonne, aucune contrainte existante n'est touchée.
-- Le worker (qui atterrit ~50 min avant l'app, cf. AGENTS.md) écrit dans cette
-- table en best-effort : tant qu'elle n'existe pas, il logue et poursuit.

CREATE TYPE "SessionFormateurRetraitMotif" AS ENUM (
  'remplacement',
  'desaffectation',
  'refus_formateur',
  'sans_reponse_delai'
);

CREATE TABLE "session_formateurs_retires" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "role" "SessionFormateurRole" NOT NULL,
    "heures_animees" DECIMAL(6,2),
    "tarif_ht_cents" INTEGER,
    "convocation_j7_envoyee_at" TIMESTAMP(3),
    "rappel_j1_envoye_at" TIMESTAMP(3),
    "affecte_at" TIMESTAMP(3) NOT NULL,
    "retire_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motif_retrait" "SessionFormateurRetraitMotif" NOT NULL,
    "retire_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_formateurs_retires_pkey" PRIMARY KEY ("id")
);

-- Noms d'index ÉPINGLÉS : le nom dérivé par Prisma
-- (`session_formateurs_retires_session_id_retire_at_idx`, 51 car.) tient sous
-- les 63 caractères de PostgreSQL, mais on l'écrit tout de même à la main pour
-- que le SQL et le schéma ne puissent pas diverger en silence.
CREATE INDEX "session_formateurs_retires_session_id_retire_at_idx"
  ON "session_formateurs_retires"("session_id", "retire_at");
CREATE INDEX "session_formateurs_retires_trainer_id_retire_at_idx"
  ON "session_formateurs_retires"("trainer_id", "retire_at");

ALTER TABLE "session_formateurs_retires"
  ADD CONSTRAINT "session_formateurs_retires_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_formateurs_retires"
  ADD CONSTRAINT "session_formateurs_retires_trainer_id_fkey"
  FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
