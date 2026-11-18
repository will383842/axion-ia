-- Retour arrière de 20261111210000 (manuel, jamais automatique) : ôte les quatre colonnes.
ALTER TABLE "contacts_guide_reseau" DROP COLUMN "infos_consenti_le";
ALTER TABLE "contacts_guide_reseau" DROP COLUMN "infos_empreinte";
ALTER TABLE "contacts_guide_reseau" DROP COLUMN "infos_version";
ALTER TABLE "contacts_guide_reseau" DROP COLUMN "infos_statut";
