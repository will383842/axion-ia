-- Rapport avant audit (2026-11-02) : au plus UN lancement en vol (en attente ou en cours) par
-- fiche client. Deux clics simultanés passaient tous deux le comptage de l'action : cet index
-- refuse le second (P2002, traduit en message par `lancerRapportAvantAudit`).
--
-- STRICTEMENT ADDITIF : un index, aucune colonne retirée, aucune ligne modifiée ni supprimée.
-- Index partiel : inconnu du schéma Prisma (comme les index partiels des relevés formateurs).
CREATE UNIQUE INDEX IF NOT EXISTS "rapports_avant_audit_un_en_vol_par_client"
  ON "rapports_avant_audit" ("client_id")
  WHERE "statut" IN ('en_attente', 'en_cours');
