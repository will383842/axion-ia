-- Index composites du cockpit de pilotage.
--
-- Additif pur : aucun index existant n'est supprimé. Règle d'ordre des colonnes :
-- ÉGALITÉ d'abord, PLAGE ensuite — sinon Postgres ne peut pas utiliser l'index
-- pour la borne de plage.
--
-- Trous comblés (constatés à l'audit) :
--   * `training_sessions.date_fin`  n'avait AUCUN index → la requête calendrier
--     (`date_debut <= to AND date_fin >= from`) ne pouvait pas être servie.
--   * `presence_creneaux.date`      n'avait AUCUN index → heatmap des
--     demi-journées réalisées en Seq Scan (~800k lignes à 5 ans).
--   * `factures_formation`          n'avait aucun index temporel → prévisionnel
--     d'encaissement et relances impayés en Seq Scan.

-- CreateIndex — requête calendrier par plage de dates
CREATE INDEX "training_sessions_date_debut_date_fin_idx" ON "training_sessions"("date_debut", "date_fin");

-- CreateIndex — calendrier filtré par statut
CREATE INDEX "training_sessions_statut_date_debut_idx" ON "training_sessions"("statut", "date_debut");

-- CreateIndex — prévisionnel filtré par mode de financement
CREATE INDEX "training_sessions_financement_type_date_debut_idx" ON "training_sessions"("financement_type", "date_debut");

-- CreateIndex — charge d'un formateur sur une période
CREATE INDEX "training_sessions_formateur_principal_id_date_debut_idx" ON "training_sessions"("formateur_principal_id", "date_debut");

-- CreateIndex — charge d'un formateur (coaching 1-to-1)
CREATE INDEX "coaching_sessions_trainer_id_date_seance_idx" ON "coaching_sessions"("trainer_id", "date_seance");

-- CreateIndex — heatmap des demi-journées réalisées
CREATE INDEX "presence_creneaux_date_present_idx" ON "presence_creneaux"("date", "present");

-- CreateIndex — prévisionnel d'encaissement + relances impayés
CREATE INDEX "factures_formation_statut_emise_at_idx" ON "factures_formation"("statut", "emise_at");
CREATE INDEX "factures_formation_echeance_at_idx" ON "factures_formation"("echeance_at");
