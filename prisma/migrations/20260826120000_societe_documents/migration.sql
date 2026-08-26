-- Dossier societe (2026-08-26) — le coffre des pieces qu'un service achats de
-- grand compte reclame pour referencer Axion-IA comme fournisseur.
--
-- POURQUOI UNE TABLE DE PLUS. Trois voisins portent deja des fichiers, et aucun
-- ne repond au besoin :
--   * `console_documents`      — buckets generiques, SANS date d'echeance. Or
--     l'essentiel de ce dossier est fait de pieces qui PERIMENT (Kbis 3 mois,
--     vigilance URSSAF 6 mois, RC pro et regularite fiscale annuelles) ;
--   * `trainer_documents`      — exactement les memes natures de pieces, avec
--     leurs echeances, mais collectees AUPRES de nos formateurs. Cette table en
--     est le miroir : ce que NOUS produisons pour un donneur d'ordre ;
--   * `intervention_documents` — kits pedagogiques versionnes par prestation.
--
-- POURQUOI PAS DE COLONNE `rubrique`. La rubrique se derive du type via
-- `src/server/societe-documents/rubriques.ts`, et un test exige que chaque
-- membre de l'enum y figure exactement une fois. Une colonne redondante aurait
-- fini par diverger du type qu'elle est censee classer — ce depot a deja paye
-- ce motif quatre fois.
--
-- POURQUOI L'EXPIRATION N'EST PAS UN STATUT. `date_expiration` est une DATE, et
-- l'etat (a jour / bientot perimee / perimee) se recalcule a chaque lecture.
-- Un statut stocke laisserait une piece affichee « a jour » le lendemain de sa
-- peremption, faute de tache pour le retourner.
--
-- Additive : aucune table existante n'est modifiee, aucune contrainte n'est
-- ajoutee ailleurs. Rollback = DROP TABLE + DROP TYPE.

-- CreateEnum
CREATE TYPE "SocieteDocumentType" AS ENUM (
  'kbis',
  'attestation_vigilance_urssaf',
  'attestation_regularite_fiscale',
  'assurance_rc_pro',
  'rib',
  'statuts',
  'pv_pouvoirs',
  'liste_salaries_etrangers',
  'attestation_honneur',
  'autre_piece_legale',
  'recepisse_declaration_activite',
  'certificat_qualiopi',
  'reglement_interieur',
  'livret_accueil',
  'programme_type',
  'liste_formateurs',
  'cv_formateur',
  'autre_organisme_formation',
  'plaquette_presentation',
  'grille_tarifaire',
  'cgv',
  'fiche_offre',
  'nda',
  'modele_proposition',
  'autre_commercial',
  'methodologie_audit',
  'questionnaire_pre_audit',
  'modele_lettre_mission',
  'modele_rapport_audit',
  'autre_audit_methode',
  'registre_traitements',
  'modele_dpa',
  'note_securite',
  'politique_usage_ia',
  'questionnaire_securite',
  'autre_rgpd_securite'
);

-- CreateTable
CREATE TABLE "societe_documents" (
    "id" UUID NOT NULL,
    "type" "SocieteDocumentType" NOT NULL,
    "titre" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "numero_piece" VARCHAR(60),
    "file_name" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "hash_sha256" VARCHAR(64) NOT NULL,
    "date_emission" DATE,
    "date_expiration" DATE,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "societe_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "societe_documents_type_sort_order_idx" ON "societe_documents"("type", "sort_order");

-- CreateIndex
CREATE INDEX "societe_documents_date_expiration_idx" ON "societe_documents"("date_expiration");
