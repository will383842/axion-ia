-- Période d'essai : une VALEUR et son UNITÉ, au lieu d'un nombre de mois.
--
-- 🔴 POURQUOI
--
-- `contrat_periode_essai_mois` ne saisissait que des mois entiers. Or les deux
-- articles du Code du travail ne comptent pas dans la même unité :
--
--   · CDI (L.1221-19) : 2, 3 ou 4 MOIS CALENDAIRES selon la classification ;
--   · CDD (L.1242-10) : un JOUR par semaine de durée prévue, plafonné à DEUX
--     SEMAINES jusqu'à six mois, à UN MOIS au-delà.
--
-- Sur un CDD d'au plus six mois, AUCUNE valeur non nulle n'était donc légale
-- dans ce champ — et le gabarit PDF imprimait « N mois » en dur.
--
-- ⚠️ Passer le champ « en jours » aurait réparé le CDD en DÉFORMANT le CDI :
-- deux mois commencés le 15 janvier finissent le 15 mars, ce ne sont pas
-- 60 jours. On aurait échangé un champ inexprimable contre un champ qui exprime
-- faux — une absence se voit, une affirmation fausse se signe.
--
-- ADDITIVE, ET L'ANCIENNE COLONNE EST CONSERVÉE
--
-- Aucune colonne n'est renommée ni supprimée. L'app et le worker ne se
-- déploient pas ensemble (fenêtre mesurée ~50 min) : pendant cette fenêtre, du
-- code ancien et du code neuf lisent la même base. Une colonne renommée les
-- ferait diverger en silence.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UnitePeriodeEssai') THEN
    CREATE TYPE "UnitePeriodeEssai" AS ENUM ('jours', 'semaines', 'mois');
  END IF;
END $$;

ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "contrat_periode_essai_valeur" INTEGER,
  ADD COLUMN IF NOT EXISTS "contrat_periode_essai_unite" "UnitePeriodeEssai";

-- BACKFILL — et voici pourquoi `'mois'` est EXACT, pas une supposition :
-- la colonne s'appelle `contrat_periode_essai_mois`, le champ de saisie était
-- étiqueté « Période d'essai (mois) » à l'écran, et le PDF imprimait
-- « {valeur} mois ». Les trois surfaces s'accordaient : toute valeur déjà
-- enregistrée a bien été saisie EN MOIS.
--
-- ⚠️ `WHERE … IS NULL` sur la cible : la migration doit pouvoir être rejouée
-- sans écraser une saisie faite APRÈS elle dans la nouvelle unité.
UPDATE "trainers"
SET "contrat_periode_essai_valeur" = "contrat_periode_essai_mois",
    "contrat_periode_essai_unite"  = 'mois'
WHERE "contrat_periode_essai_mois" IS NOT NULL
  AND "contrat_periode_essai_valeur" IS NULL;

-- Les deux colonnes vont TOUJOURS ensemble : une valeur sans unité serait un
-- nombre sans signification, et une unité sans valeur une promesse vide.
-- CHECK plutôt que confiance dans l'applicatif — le worker écrit aussi.
ALTER TABLE "trainers"
  DROP CONSTRAINT IF EXISTS "trainers_periode_essai_valeur_et_unite";
ALTER TABLE "trainers"
  ADD CONSTRAINT "trainers_periode_essai_valeur_et_unite"
  CHECK (
    ("contrat_periode_essai_valeur" IS NULL AND "contrat_periode_essai_unite" IS NULL)
    OR ("contrat_periode_essai_valeur" IS NOT NULL AND "contrat_periode_essai_unite" IS NOT NULL)
  );
