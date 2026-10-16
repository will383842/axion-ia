-- Date du CV (décision de Will du 15/10). AJOUT SEUL : une colonne nullable sur
-- `trainer_documents`. Le formateur y déclare, au dépôt de son CV dans le dossier en
-- ligne, le mois et l'année de son CV ; la règle « CV de moins de 24 mois » se calcule
-- sur cette date, jamais sur la date de dépôt. Aucune ligne existante n'est réécrite :
-- les CV déjà déposés gardent NULL et restent « à vérifier ».
ALTER TABLE "trainer_documents" ADD COLUMN "date_cv_declaree" TIMESTAMP(3);
