-- Analyse de risques de la revue de direction — decret n° 2026-728.
--
-- L'indicateur 32 demandait « des mesures d'amelioration a partir de l'analyse
-- des appreciations et des reclamations » : on REAGIT a ce qui remonte. Le
-- referentiel en vigueur au 1er novembre 2026 exige en plus un processus qui
-- ANTICIPE — une analyse de risques.
--
-- Additive, avec defaut : aucune revue existante ne devient invalide, et le
-- worker peut lire la colonne des sa reconstruction sans attendre l'app
-- (AGENTS.md — le worker est reconstruit en ~3 min, l'app en 47-56).
ALTER TABLE "revues_direction"
  ADD COLUMN IF NOT EXISTS "risques" JSONB NOT NULL DEFAULT '[]'::jsonb;
