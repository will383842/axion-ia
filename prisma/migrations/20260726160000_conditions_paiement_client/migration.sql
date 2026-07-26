-- Conditions de paiement par client (audit certification 2026-07-26, F61).
--
-- Jusqu'ici, `delai_paiement_jours` était un réglage GLOBAL à 30 jours, appliqué
-- à tout le monde. Or un grand compte impose souvent 45 ou 60 jours, et un
-- nouveau client mérite parfois un acompte plus élevé. Aucun champ ne permettait
-- de le dire.
--
-- Trois colonnes nullables : `NULL` signifie « suivre le réglage global ». C'est
-- ce qui distingue un client sans condition particulière d'un client réglé
-- explicitement sur la même valeur — la nuance compte le jour où le défaut
-- global change.

CREATE TYPE "ModeFacturationClient" AS ENUM ('acompte_solde', 'solde_unique');

ALTER TABLE "clients"
  ADD COLUMN "delai_paiement_jours" INTEGER,
  ADD COLUMN "taux_acompte_pct" INTEGER,
  ADD COLUMN "mode_facturation" "ModeFacturationClient";

COMMENT ON COLUMN "clients"."delai_paiement_jours" IS
  'Délai de paiement propre à ce client (jours). NULL = réglage global. Plafond légal 60 jours (art. L441-10 C. com.).';
COMMENT ON COLUMN "clients"."taux_acompte_pct" IS
  'Taux d''acompte appliqué au RESTE À CHARGE (%). NULL = réglage global. Plafonné à 30 % pour un particulier (art. L6353-6).';
COMMENT ON COLUMN "clients"."mode_facturation" IS
  'acompte_solde = acompte à la signature puis solde ; solde_unique = tout à l''issue. NULL = réglage global.';

-- Garde-fou en base, doublant la validation applicative : un délai au-delà de
-- 60 jours est illicite entre professionnels, un taux hors [0,100] n'a pas de
-- sens. La contrainte évite qu'un import ou une correction SQL directe
-- n'introduise une valeur que le code refuserait.
ALTER TABLE "clients"
  ADD CONSTRAINT "ck_client_delai_paiement"
  CHECK ("delai_paiement_jours" IS NULL OR ("delai_paiement_jours" >= 0 AND "delai_paiement_jours" <= 60));

ALTER TABLE "clients"
  ADD CONSTRAINT "ck_client_taux_acompte"
  CHECK ("taux_acompte_pct" IS NULL OR ("taux_acompte_pct" >= 0 AND "taux_acompte_pct" <= 100));
