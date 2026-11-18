-- Page « Recevoir le guide » (2026-11-11) : case FACULTATIVE « informations d'Axion-IA », séparée de
-- la case du guide (RGPD art. 7(4)). ADDITIF : quatre colonnes neuves, la première avec défaut
-- ('aucune') ; les trois autres nullables. Rien n'est supprimé, renommé ni écrit sur les lignes
-- existantes. Compatible avec l'ancien code (qui n'écrit pas ces colonnes : défaut / NULL).
-- Retour arrière : rollback.sql.

ALTER TABLE "contacts_guide_reseau" ADD COLUMN "infos_statut" VARCHAR(20) NOT NULL DEFAULT 'aucune';
ALTER TABLE "contacts_guide_reseau" ADD COLUMN "infos_version" VARCHAR(64);
ALTER TABLE "contacts_guide_reseau" ADD COLUMN "infos_empreinte" CHAR(64);
ALTER TABLE "contacts_guide_reseau" ADD COLUMN "infos_consenti_le" TIMESTAMPTZ(3);
