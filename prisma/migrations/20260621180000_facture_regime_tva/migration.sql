-- Régime de TVA des factures de formation (snapshot par facture).
-- Qualiopi n'a AUCUN effet sur la TVA : le régime dépend du statut fiscal de
-- l'OF (assujetti 20 % / exonération 261-4-4° / franchise 293 B), configurable
-- et évolutif. Cf. src/server/qualiopi/legal/tva.ts.
-- Migration ADDITIVE (aucun DROP) — conforme au contrat de build.

ALTER TABLE "factures_formation"
  ADD COLUMN "regime_tva" VARCHAR(30) NOT NULL DEFAULT 'assujetti',
  ADD COLUMN "montant_tva_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "montant_ttc_cents" INTEGER;

-- Backfill : les factures historiques marquées exonérées étaient traitées au
-- titre de l'exonération formation professionnelle (art. 261-4-4° CGI).
UPDATE "factures_formation"
  SET "regime_tva" = 'exoneration_261'
  WHERE "tva_exoneree" = true;

-- Backfill TTC = HT pour les factures existantes (TVA historiquement nulle).
UPDATE "factures_formation"
  SET "montant_ttc_cents" = "montant_ht_cents"
  WHERE "montant_ttc_cents" IS NULL;
