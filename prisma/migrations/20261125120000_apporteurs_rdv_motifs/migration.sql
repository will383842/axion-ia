-- Réseau d'apporteurs, règle « rendez-vous » — L4a : les MOTIFS. Colonnes NULLABLES, ajout seul,
-- rejouable (IF NOT EXISTS) : aucun UPDATE, DELETE ni DROP. Migration neuve : celle du lot 1
-- (20261125090000) est déjà fusionnée et n'est pas réécrite. Aucun code ne les écrit encore.
ALTER TABLE "presentation_reservation" ADD COLUMN IF NOT EXISTS "validation_motif" TEXT;
ALTER TABLE "propositions_rendez_vous_presentation" ADD COLUMN IF NOT EXISTS "ecartee_motif" TEXT;
ALTER TABLE "propositions_rendez_vous_presentation" ADD COLUMN IF NOT EXISTS "ecartee_notifiee_at" TIMESTAMPTZ(3);
