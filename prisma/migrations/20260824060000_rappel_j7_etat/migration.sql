-- Le rappel J-7 devient un ÉTAT, et devient donc prouvable.
--
-- Défaut mesuré le 2026-08-24 pendant l'audit D5 de la chaîne e-mail.
-- `handleRappelJ7` était un PUR COMPTE À REBOURS : il ne retenait que les
-- sessions dont `date_debut` tombait dans [J-7,5 ; J-6,5] au passage quotidien
-- de 08:00 UTC. Trois conséquences :
--
--   1. une session créée moins de 7,5 jours avant son début n'entrait JAMAIS
--      dans la fenêtre — et c'est le cas ordinaire, pas le cas limite : la
--      session du 31/07 a été créée le 31/07 pour un début le même jour,
--      celle du 16/08 la veille ;
--   2. un worker arrêté pendant le créneau perdait l'occurrence, sans rattrapage ;
--   3. surtout, AUCUNE donnée ne permettait d'affirmer devant un certificateur
--      qu'un rappel était parti. Le critère 2 du RNQ porte sur l'information du
--      bénéficiaire : une preuve inatteignable n'est pas une preuve.
--
-- C'est le même défaut, et le même correctif, que la convocation le 2026-08-15
-- (`Enrollment.convocation_envoyee_at`) : on remplace le balayage par date par
-- un état, et le cron devient rattrapant.
--
-- 100 % additif. Les sessions existantes gardent NULL, ce qui est la vérité :
-- personne ne peut affirmer qu'elles ont reçu leur rappel. Celles déjà commencées
-- sortent de la sélection par la borne `date_debut > now()` du cron, et sont
-- comptées séparément dans son journal comme un écart.

-- AlterTable
ALTER TABLE "training_sessions" ADD COLUMN "rappel_j7_envoye_at" TIMESTAMP(3);

-- CreateIndex
-- Sélection du cron : les sessions planifiées encore sans rappel, bornées haut.
CREATE INDEX "training_sessions_rappel_j7_envoye_at_statut_date_debut_idx"
  ON "training_sessions"("rappel_j7_envoye_at", "statut", "date_debut");
