-- Le fixe RÉCUPÉRABLE d'un formateur salarié.
--
-- ## Ce que ces deux colonnes rendent possible
--
-- Un formateur salarié touche un fixe mensuel. Les commissions des formations
-- qu'il assure ne s'y AJOUTENT pas : elles viennent d'abord rembourser ce fixe,
-- et il ne perçoit un complément qu'au-delà. Avec REPORT — un mois sous le fixe
-- creuse une dette que les mois forts remboursent (décision Will, 2026-09-12).
--
-- Le dépôt ne savait rien en faire. Les quatre modèles de `CompensationModel`
-- sont EXCLUSIFS : une règle est un taux journalier OU une commission, jamais
-- « fixe + commission ». Le fixe vivait dans la paie, hors de l'outil, et
-- personne ne savait combien verser en plus ni ce qui restait à rattraper.
--
-- ⛔ CE N'EST PAS UN SALAIRE ET CE N'EST PAS UNE DETTE FOURNISSEUR. L'outil ne
-- paie personne avec ce chiffre : il dit combien porter EN PLUS sur la paie. Un
-- salarié n'est pas réglé sur facture, et le transformer en relevé facturable
-- fausserait la déclaration BPF, qui compte la sous-traitance en filtrant sur
-- `nature = 'honoraire_du'`.
--
-- ## Pourquoi la colonne AVANT le code qui la lit
--
-- Deux conteneurs, deux vitesses (cf. AGENTS.md) : le worker est reconstruit en
-- ~3 min depuis les sources, l'app attend son image GHCR 47-56 min, et c'est
-- l'entrypoint de l'APP qui joue les migrations. Colonnes NULLABLES, sans
-- défaut, sans contrainte : aucune lecture n'en dépend au moment où elles
-- arrivent.

ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "fixe_mensuel_brut_cents" INTEGER,
  -- Dette d'avance reprise d'avant l'entrée dans l'outil : permet de démarrer
  -- le déroulé sans réécrire l'historique des mois passés.
  ADD COLUMN IF NOT EXISTS "avance_reprise_cents" INTEGER;
