-- Socle formateurs : habilitations normalisées + indisponibilités.
--
-- ADDITIF PUR. Aucune colonne supprimée, aucune donnée touchée.
--
-- 1. `trainer_habilitations` remplace `trainers.formations_habilitees` (text[]).
--    Le tableau reste EN PLACE et continue d'être écrit (dual-write) : la lecture
--    bascule sur la table quand elle est peuplée, sinon retombe sur le tableau.
--    Le backfill (`prisma/scripts/backfill-trainer-habilitations-2026-07-10.ts`)
--    se lance UNE fois après le deploy. Zéro perte, retour arrière possible.
--
--    Pourquoi : un `text[]` n'a ni FK (une formation supprimée laissait un id
--    fantôme), ni index utilisable (« qui peut animer cette formation ? » forçait
--    un scan), ni traçabilité (Qualiopi ind. 21/22 exige de savoir QUI a habilité
--    QUAND).
--
-- 2. `trainer_availabilities` : fenêtres pendant lesquelles un formateur ne peut
--    pas être mobilisé. Remplace conceptuellement `capacity_windows`, vestige du
--    module de réservation retiré, qui comptait des créneaux globaux et jamais la
--    disponibilité d'une personne. `capacity_windows` n'est PAS supprimée ici
--    (suppression dure = décision séparée).
--
--    Bornes INCLUSIVES en `date` : un congé « du 3 au 7 » couvre le 3 ET le 7.
--    La contrainte CHECK interdit une fenêtre qui finit avant de commencer — une
--    inversion de saisie produirait une indisponibilité vide, donc invisible.

-- CreateEnum
CREATE TYPE "TrainerAvailabilityType" AS ENUM ('conge', 'maladie', 'formation_interne', 'indisponible');

-- CreateTable
CREATE TABLE "trainer_habilitations" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "formation_id" UUID NOT NULL,
    "habilite_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "habilite_by_id" UUID,
    "note" TEXT,

    CONSTRAINT "trainer_habilitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_availabilities" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "type" "TrainerAvailabilityType" NOT NULL DEFAULT 'conge',
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "motif" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainer_habilitation_unique" ON "trainer_habilitations"("trainer_id", "formation_id");

-- CreateIndex
CREATE INDEX "trainer_habilitations_formation_id_idx" ON "trainer_habilitations"("formation_id");

-- CreateIndex
CREATE INDEX "trainer_availabilities_trainer_id_date_debut_date_fin_idx" ON "trainer_availabilities"("trainer_id", "date_debut", "date_fin");

-- CreateIndex
CREATE INDEX "trainer_availabilities_date_debut_idx" ON "trainer_availabilities"("date_debut");

-- AddForeignKey
ALTER TABLE "trainer_habilitations" ADD CONSTRAINT "trainer_habilitations_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_habilitations" ADD CONSTRAINT "trainer_habilitations_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_availabilities" ADD CONSTRAINT "trainer_availabilities_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une fenêtre d'indisponibilité qui se termine avant de commencer ne couvre aucun
-- jour : elle serait silencieusement sans effet. On refuse la saisie.
ALTER TABLE "trainer_availabilities" ADD CONSTRAINT "ck_availability_bornes"
  CHECK ("date_fin" >= "date_debut");
