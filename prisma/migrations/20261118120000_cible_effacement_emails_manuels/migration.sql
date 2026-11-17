-- Lot I4, fiche F1c : une VALEUR ajoutée à l'énumération du journal d'effacement, pour que la
-- neutralisation des e-mails écrits à la main (fiche F1b) soit journalisée et REJOUÉE après une
-- restauration (procédure R33). ADDITIVE : aucune table, colonne ni ligne touchée.
-- Aucun code ne lit ni n'écrit cette valeur avant F1b. schema.prisma est volontairement inchangé ici :
-- F1b déclare la valeur en même temps que son écrivain et son rejeu (gardes du journal).
-- Précision sur 20261118100000 : la purge du pilote GARDE désormais une personne d'essai visée par un
-- e-mail écrit à la main (au lieu de refuser) ; voir F1b.
-- PG ≥ 12 : ADD VALUE est permis dans une transaction ; la valeur n'y est simplement pas utilisable
-- avant le COMMIT, et rien ne l'utilise ici. IF NOT EXISTS : rejouable sans erreur.
ALTER TYPE "cible_effacement" ADD VALUE IF NOT EXISTS 'emails_manuels';
