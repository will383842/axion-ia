-- Aligne les valeurs enum InterventionType sur les slugs UI (Sprint 15 fix
-- Fork 2 audit C1-2). Avant : essentielle/equipes/managers/conference/
-- dirigeants/coaching_individuel. Apres : essentielle/approfondie/conference/
-- dirigeants/gagner_du_temps/intervention_claude (snake — UI utilise kebab,
-- Server Action convertit '-' → '_' avant insert).
--
-- Postgres 12+ : ALTER TYPE ... RENAME VALUE est non-transactionnel mais
-- autonome (chaque ALTER est sa propre commande).

ALTER TYPE "InterventionType" RENAME VALUE 'equipes' TO 'approfondie';
ALTER TYPE "InterventionType" RENAME VALUE 'managers' TO 'gagner_du_temps';
ALTER TYPE "InterventionType" RENAME VALUE 'coaching_individuel' TO 'intervention_claude';
