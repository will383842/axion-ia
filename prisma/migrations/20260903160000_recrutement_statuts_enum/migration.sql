-- Lot 3 — LES TROIS ÉTATS QUI MANQUAIENT (2026-09-03)
--
-- ⚠️ CETTE MIGRATION NE FAIT QUE L'AJOUT, ET C'EST OBLIGATOIRE.
--
-- PostgreSQL refuse d'UTILISER une valeur ajoutée par `ALTER TYPE … ADD VALUE`
-- dans la transaction qui l'ajoute. Une migration qui ajouterait `withdrawn`
-- puis ferait un `UPDATE … SET status = 'withdrawn'` passerait en développement
-- (où l'on rejoue souvent hors transaction) et ÉCHOUERAIT en production, où
-- Prisma enveloppe chaque fichier dans une transaction.
--
-- Les colonnes, la reprise et les contraintes vivent donc dans la migration
-- suivante, `20260903163000_recrutement_decision`.
--
-- Le type Postgres s'appelle `"JobApplicationStatus"` — l'enum Prisma ne porte
-- pas de `@@map`. Vérifié par `\dT` sur la base avant écriture, plutôt que
-- supposé : un nom de type erroné fait échouer la migration à l'atterrissage,
-- au moment le plus coûteux.

-- Au moins un entretien planifié ou tenu. Sans cet état, une candidature en
-- cours d'entretien reste « en revue », et rien ne distingue celle qu'on lit de
-- celle qu'on rencontre.
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'interview' AFTER 'shortlisted';

-- Proposition faite, réponse attendue. L'état le plus court et le plus coûteux
-- à confondre : un candidat qui attend NOTRE réponse et un candidat dont on
-- attend LA SIENNE n'appellent pas le même geste.
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'offer' AFTER 'interview';

-- Le candidat s'est retiré. DISTINCT de `rejected` : la décision n'est pas la
-- nôtre. Les confondre fausserait toute lecture des motifs — on lirait comme
-- une sélection ce qui est un renoncement.
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'withdrawn' AFTER 'rejected';
