-- Formateurs — ce qu'il fallait pouvoir saisir et qu'aucun écran ne permettait.
--
-- ## Ce que cette migration ferme
--
-- 1. RÉGIONS D'INTERVENTION. `region` est un VarChar(60) MONO-VALEUR : un
--    intervenant qui se déplace dans trois régions ne pouvait en déclarer
--    qu'une, et le champ devenait faux au moment précis où il servait. On
--    ajoute un tableau + un drapeau « France entière », qui évite d'énumérer
--    treize slugs pour dire une chose simple.
--
--    ⚠️ `region` est CONSERVÉ : le calendrier et les filtres existants le
--    lisent. Les écrans écrivent les deux, la première région retenue
--    alimentant la colonne historique. Aucune lecture existante ne casse.
--
-- 2. ADRESSE PROFESSIONNELLE. Le champ n'existait pas. La lettre de mission,
--    qui doit identifier les deux parties, imprimait donc un tiret figé à la
--    ligne « Adresse » — un champ manquant crié sur une pièce contractuelle
--    (d'où son passage en ligne optionnelle le 2026-08-01, qui masquait le
--    symptôme sans traiter la cause).
--
--    RGPD : adresse d'EXERCICE, jamais le domicile. C'est elle qui identifie la
--    partie à un contrat ; le domicile n'a pas à figurer au dossier.
--
-- Migration ADDITIVE : trois colonnes avec valeurs par défaut, aucune donnée
-- existante touchée, aucune contrainte ajoutée sur l'existant.
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "regions_intervention" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "intervention_france_entiere" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "adresse_professionnelle" TEXT;

-- Reprise de l'existant : la région unique déjà saisie devient le premier
-- élément du tableau, pour que les fiches déjà renseignées ne régressent pas.
UPDATE "trainers"
SET "regions_intervention" = ARRAY["region"]
WHERE "region" IS NOT NULL
  AND "region" <> ''
  AND cardinality("regions_intervention") = 0;
