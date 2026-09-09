-- L'accord donne HORS de l'outil a enfin ou s'ecrire.
--
-- Defaut vecu EN PRODUCTION le 2026-09-06, sur AXI-SESS-2026-001. La
-- proposition de mission a expire sans reponse ; la session a pourtant ete
-- animee — la stagiaire a signe son emargement. L'alerte critique
-- `formateur_mission_expiree` dit alors :
--
--     « verifiez que la session a bien ete animee, et consignez un incident si
--       elle ne l'a pas ete »
--
-- Deux branches. L'ecran n'en offrait qu'UNE : « Declarer une absence ». Le
-- bouton « Proposer a nouveau » est conditionne a `sessionAVenir`, donc absent
-- sur une session demarree. La branche « elle a bien ete animee » n'avait
-- AUCUN geste, et l'alerte est `resolutionAuto` : elle ne pouvait plus
-- s'eteindre. Une alerte critique inextinguible apprend a ignorer les
-- critiques — c'est le troisieme exemplaire de ce motif en une journee.
--
-- POURQUOI UNE VALEUR D'ENUM NEUVE, ET PAS `acceptee`.
--
-- `acceptee` signifie « le formateur a repondu par son lien » : la ligne porte
-- alors une trace horodatee de SON geste. L'ecrire pour un accord recueilli au
-- telephone fabriquerait cette trace. Le commentaire de `sans_reponse` refuse
-- deja la symetrie inverse — « un silence n'est pas un refus » — et pour la
-- meme raison : on ne salit pas une piece que l'auditeur va lire.
--
-- L'accord existe, mais sa preuve est ailleurs. Les trois colonnes la portent :
-- QUAND, PAR QUI, POURQUOI. Sans auteur ni motif, ce n'est pas une preuve,
-- c'est une affirmation.

ALTER TYPE "MissionFormateurStatut" ADD VALUE IF NOT EXISTS 'accord_hors_outil';

ALTER TABLE "missions_formateur"
  ADD COLUMN IF NOT EXISTS "accord_hors_outil_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accord_hors_outil_par_id" UUID,
  ADD COLUMN IF NOT EXISTS "accord_hors_outil_motif" TEXT;
