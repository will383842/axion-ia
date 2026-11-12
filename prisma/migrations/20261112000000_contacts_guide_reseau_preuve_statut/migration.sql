-- Page « Recevoir le guide » — preuve de l'accord en trois états (lot guide réseau 3, 2026-11-11) :
-- « en_attente » (case cochée) → « confirmee » (premier clic sur le bouton du lien du guide, après
-- l'accord) → « non_verifiee » (N jours sans clic : MISE À L'ÉCART, jamais une suppression).
--
-- STRICTEMENT ADDITIF : trois colonnes NULLABLES et un index sur "contacts_guide_reseau". Aucun
-- DROP / DELETE, aucune colonne existante touchée, aucune énumération. "merci_statut" n'est pas
-- touché. L'ancien conteneur (app ou worker), qui ignore ces colonnes, continue de tourner ; le
-- nouveau code lit NULL comme « en_attente ». Elle part AVANT tout code qui la lit.
--
-- REPRISE de l'existant (écrit les seules nouvelles colonnes ; AUCUNE ligne "consent_events" n'est
-- inventée : le registre ne s'invente pas de passé) :
--   1) les MARQUES d'adresse opposée (email_key = '-', aucune donnée de personne) → 'sans_objet' ;
--   2) un clic connu APRÈS l'accord → 'confirmee' (date : premier clic connu >= consenti_le,
--      sinon le dernier clic) ;
--   3) le reste → 'en_attente' (la mise à l'écart, plus tard, suivra la règle des N jours).
--
-- Retour arrière : aucun DROP. Revenir au code précédent suffit (il ignore les colonnes). Supprimer
-- les colonnes détruirait des dates de preuve : interdit sans décision de Williams.

-- AlterTable
ALTER TABLE "contacts_guide_reseau"
  ADD COLUMN "preuve_statut"       VARCHAR(16),
  ADD COLUMN "preuve_confirmee_le" TIMESTAMPTZ(3),
  ADD COLUMN "preuve_ecartee_le"   TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "contacts_guide_reseau_preuve_statut_consenti_le_idx"
  ON "contacts_guide_reseau" ("preuve_statut", "consenti_le");

-- 1) MARQUES → 'sans_objet'
UPDATE "contacts_guide_reseau" SET "preuve_statut" = 'sans_objet'
 WHERE "email_key" = '-' AND "preuve_statut" IS NULL;

-- 2) Un clic connu APRÈS l'accord → 'confirmee'
-- ("guide_requests".*_click_at sont des TIMESTAMP(3) sans fuseau, écrits en UTC par Prisma :
-- on les lit explicitement en UTC plutôt que selon le fuseau de la session.)
UPDATE "contacts_guide_reseau" c
   SET "preuve_statut" = 'confirmee',
       "preuve_confirmee_le" = CASE WHEN (g."first_click_at" AT TIME ZONE 'UTC') >= c."consenti_le"
                                    THEN (g."first_click_at" AT TIME ZONE 'UTC')
                                    ELSE (g."last_click_at" AT TIME ZONE 'UTC') END
  FROM "guide_requests" g
 WHERE c."guide_request_id" = g."id" AND c."preuve_statut" IS NULL
   AND g."last_click_at" IS NOT NULL
   AND (g."last_click_at" AT TIME ZONE 'UTC') >= c."consenti_le";

-- 3) Le reste → 'en_attente'
UPDATE "contacts_guide_reseau" SET "preuve_statut" = 'en_attente' WHERE "preuve_statut" IS NULL;
