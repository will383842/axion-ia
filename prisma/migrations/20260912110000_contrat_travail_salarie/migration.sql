-- Contrat de travail des formateurs SALARIÉS.
--
-- ## Ce que ces colonnes portent
--
-- Les mentions que le contrat doit contenir, et rien de plus. Chacune figure
-- sur la pièce ; aucune n'est collectée « au cas où ».
--
-- ⛔ LE NUMÉRO DE SÉCURITÉ SOCIALE EST DÉLIBÉRÉMENT ABSENT. Il est exigé sur le
-- BULLETIN DE PAIE, pas sur le contrat de travail — et la paie se fait hors de
-- cet outil. Le stocker ici collecterait une donnée sensible sans finalité dans
-- le traitement : exactement ce que la minimisation interdit, et ce que le
-- registre RGPD aurait à justifier.
--
-- ⛔ NE CONCERNE QUE LES SALARIÉS. Un sous-traitant a un contrat de
-- sous-traitance (relation commerciale), un dirigeant son mandat social. Leur
-- établir un contrat de travail serait la requalification que tout le reste du
-- domaine s'emploie à éviter.
--
-- ## Deux colonnes qui décident d'une requalification
--
-- `contrat_date_fin` et `contrat_motif_cdd` : un CDD sans terme ni motif écrit
-- est requalifiable en CDI (art. L.1242-12). La garde d'émission les exige
-- avant de produire la pièce — les colonnes existent pour qu'elle PUISSE.
--
-- ## Pourquoi la colonne avant le code
--
-- Deux conteneurs, deux vitesses (cf. AGENTS.md) : le worker est reconstruit en
-- ~3 min, l'app attend son image GHCR 47-56 min, et c'est l'entrypoint de l'APP
-- qui migre. Colonnes NULLABLES et valeur d'énumération ajoutées AVANT tout code
-- qui les lit.

-- ⚠️ `CREATE TYPE` n'est pas idempotent : le bloc conditionnel évite l'échec sur
-- une base déjà migrée (reprise, environnement de secours).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TypeContratTravail') THEN
    CREATE TYPE "TypeContratTravail" AS ENUM ('cdi', 'cdd');
  END IF;
END
$$;

ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "contrat_type" "TypeContratTravail",
  ADD COLUMN IF NOT EXISTS "date_naissance" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lieu_naissance" VARCHAR(120),
  -- Distincte d'`adresse_professionnelle`, qui est l'adresse d'EXERCICE d'un
  -- indépendant : un contrat de travail identifie le salarié à son domicile.
  ADD COLUMN IF NOT EXISTS "adresse_personnelle" TEXT,
  ADD COLUMN IF NOT EXISTS "contrat_poste" VARCHAR(160),
  -- Classification et coefficient : ils déterminent le minimum conventionnel.
  -- Une classification fausse se paie en rappel de salaire, d'où la saisie
  -- explicite plutôt qu'un défaut pré-rempli.
  ADD COLUMN IF NOT EXISTS "contrat_classification" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "contrat_duree_hebdo_heures" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "contrat_periode_essai_mois" INTEGER,
  ADD COLUMN IF NOT EXISTS "contrat_lieu_travail" TEXT,
  ADD COLUMN IF NOT EXISTS "contrat_date_fin" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contrat_motif_cdd" TEXT;
