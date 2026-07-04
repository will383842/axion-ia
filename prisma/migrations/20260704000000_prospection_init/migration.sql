-- CreateEnum
CREATE TYPE "ProspectionTaille" AS ENUM ('TPE', 'PME', 'ETI', 'GE');

-- CreateEnum
CREATE TYPE "ProspectionTailleSource" AS ENUM ('effectif', 'categorie_insee');

-- CreateEnum
CREATE TYPE "ProspectionCategorieEntreprise" AS ENUM ('PME', 'ETI', 'GE');

-- CreateEnum
CREATE TYPE "ProspectionSecteur" AS ENUM ('btp', 'sante', 'action_sociale', 'droit', 'numerique', 'conseil', 'finance_assurance', 'immobilier', 'commerce', 'industrie', 'agriculture', 'transport_logistique', 'hotellerie_restauration', 'enseignement', 'administration_publique', 'arts_culture_sport', 'services_aux_entreprises', 'services_aux_particuliers', 'autre');

-- CreateEnum
CREATE TYPE "ProspectionTypeOrganisation" AS ENUM ('privee', 'publique', 'parapublique', 'association', 'collectivite', 'epic');

-- CreateEnum
CREATE TYPE "ProspectionContactabilite" AS ENUM ('exploitable', 'partiel', 'non_contactable');

-- CreateEnum
CREATE TYPE "ProspectionContactabiliteNuance" AS ENUM ('exploitable_nominatif', 'exploitable_generique', 'aucune');

-- CreateEnum
CREATE TYPE "ProspectionSeniorite" AS ENUM ('dirigeant', 'directeur', 'responsable', 'manager', 'cadre', 'autre');

-- CreateEnum
CREATE TYPE "ProspectionDepartementFonctionnel" AS ENUM ('direction', 'commercial', 'rh', 'achats', 'finance', 'technique', 'dsi', 'marketing', 'juridique', 'production', 'qhse', 'autre');

-- CreateEnum
CREATE TYPE "ProspectionFonctionNormalisee" AS ENUM ('gerant', 'president', 'directeur_general', 'directeur_general_delegue', 'directeur', 'directeur_administratif_financier', 'directeur_commercial', 'directeur_technique', 'directeur_des_systemes_information', 'directeur_marketing', 'directeur_ressources_humaines', 'directeur_achats', 'directeur_production', 'responsable_commercial', 'responsable_rh', 'responsable_achats', 'responsable_marketing', 'responsable_technique', 'responsable_qhse', 'responsable_administratif', 'associe', 'manager', 'cadre', 'autre');

-- CreateEnum
CREATE TYPE "ProspectionEnrichmentStatus" AS ENUM ('pending', 'enriching', 'enriched', 'failed', 'no_data');

-- CreateEnum
CREATE TYPE "ProspectionCampaignStatut" AS ENUM ('brouillon', 'active', 'en_pause', 'en_pause_quota', 'terminee');

-- CreateEnum
CREATE TYPE "ProspectionCellStatut" AS ENUM ('a_faire', 'en_cours', 'fait', 'erreur');

-- CreateEnum
CREATE TYPE "ProspectionStatutDiffusion" AS ENUM ('diffusible', 'non_diffusible', 'partiel');

-- CreateEnum
CREATE TYPE "ProspectionVerifStatus" AS ENUM ('verified_syntax', 'mx_ok', 'role', 'invalid', 'e164_ok', 'invalide');

-- CreateEnum
CREATE TYPE "ProspectionEtatAdministratif" AS ENUM ('actif', 'cesse');

-- CreateEnum
CREATE TYPE "ProspectionSource" AS ENUM ('stock_sirene', 'sirene', 'recherche_entreprises', 'rne', 'annuaire_administration', 'bodacc', 'ban', 'site_scrape', 'manuel');

-- CreateEnum
CREATE TYPE "ProspectionDomainMatchMethod" AS ENUM ('siren_on_page', 'denomination_on_page', 'open_data_field', 'heuristic', 'none');

-- CreateEnum
CREATE TYPE "ProspectionSiteWebStatus" AS ENUM ('verifie', 'mort', 'redirige', 'inconnu');

-- CreateEnum
CREATE TYPE "ProspectionContactType" AS ENUM ('email', 'telephone');

-- CreateEnum
CREATE TYPE "ProspectionAssignedBy" AS ENUM ('auto', 'user');

-- CreateEnum
CREATE TYPE "ProspectionTagType" AS ENUM ('SECTEUR', 'TAILLE', 'DEPARTEMENT', 'SOURCE', 'QUALITE');

-- CreateEnum
CREATE TYPE "ProspectionSuppressionType" AS ENUM ('siren', 'email', 'domaine', 'personKey');

-- CreateEnum
CREATE TYPE "ProspectionEventType" AS ENUM ('company_collected', 'person_added', 'contact_scraped', 'opt_out', 'export', 'campaign_started', 'paused', 'resumed', 'completed', 'refresh');

-- CreateEnum
CREATE TYPE "ProspectionAccessLogAction" AS ENUM ('view_person', 'search', 'export');

-- CreateEnum
CREATE TYPE "ProspectionCollectRunStatus" AS ENUM ('running', 'done', 'error');

-- CreateEnum
CREATE TYPE "ProspectionGeoScope" AS ENUM ('departement', 'region', 'france');

-- AlterEnum
ALTER TYPE "SiteSettingCategory" ADD VALUE IF NOT EXISTS 'prospection';

-- CreateTable
CREATE TABLE "prospection_company" (
    "id" UUID NOT NULL,
    "siren" VARCHAR(9) NOT NULL,
    "denomination" TEXT,
    "nom_complet" TEXT,
    "sigle" TEXT,
    "forme_juridique" TEXT,
    "forme_juridique_libelle" TEXT,
    "nature_juridique" TEXT,
    "nature_juridique_libelle" TEXT,
    "date_creation" TIMESTAMP(3),
    "etat_administratif" "ProspectionEtatAdministratif" NOT NULL DEFAULT 'actif',
    "economie_sociale_solidaire" BOOLEAN,
    "naf" TEXT,
    "naf_libelle" TEXT,
    "section_naf" TEXT,
    "secteur" "ProspectionSecteur",
    "tranche_effectif" TEXT,
    "effectif_estime" INTEGER,
    "taille" "ProspectionTaille",
    "taille_source" "ProspectionTailleSource",
    "categorie_entreprise" "ProspectionCategorieEntreprise",
    "type_organisation" "ProspectionTypeOrganisation",
    "departement" TEXT,
    "code_postal" TEXT,
    "commune" TEXT,
    "commune_code" TEXT,
    "region" TEXT,
    "adresse" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "site_web" TEXT,
    "site_web_status" "ProspectionSiteWebStatus",
    "domain_match_method" "ProspectionDomainMatchMethod",
    "domain_confidence" DOUBLE PRECISION,
    "email_public" TEXT,
    "telephone_public" TEXT,
    "contact_form_url" TEXT,
    "linkedin_url" TEXT,
    "socials" JSONB,
    "langue_site" TEXT,
    "tva_intracom" TEXT,
    "capital_social" TEXT,
    "rcs" TEXT,
    "horaires" TEXT,
    "contactabilite" "ProspectionContactabilite",
    "contactabilite_nuance" "ProspectionContactabiliteNuance",
    "has_email" BOOLEAN NOT NULL DEFAULT false,
    "has_telephone" BOOLEAN NOT NULL DEFAULT false,
    "lead_score" INTEGER,
    "enrichment_status" "ProspectionEnrichmentStatus" NOT NULL DEFAULT 'pending',
    "last_enriched_at" TIMESTAMP(3),
    "data_quality" INTEGER,
    "first_seen_at" TIMESTAMP(3),
    "last_collected_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "content_hash" TEXT,
    "refresh_after" TIMESTAMP(3),
    "statut_diffusion" "ProspectionStatutDiffusion",
    "opposition_prospection_rne" BOOLEAN NOT NULL DEFAULT false,
    "opt_out" BOOLEAN NOT NULL DEFAULT false,
    "opt_out_at" TIMESTAMP(3),
    "retention_until" TIMESTAMP(3),
    "field_provenance" JSONB,
    "source" "ProspectionSource",
    "collect_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_establishment" (
    "id" UUID NOT NULL,
    "siret" VARCHAR(14) NOT NULL,
    "company_id" UUID NOT NULL,
    "est_siege" BOOLEAN NOT NULL DEFAULT false,
    "naf" TEXT,
    "tranche_effectif" TEXT,
    "adresse" TEXT,
    "departement" TEXT,
    "code_postal" TEXT,
    "commune" TEXT,
    "commune_code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "etat_administratif" "ProspectionEtatAdministratif" NOT NULL DEFAULT 'actif',
    "statut_diffusion" "ProspectionStatutDiffusion",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_person" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "establishment_id" UUID,
    "nom" TEXT NOT NULL,
    "prenoms" TEXT,
    "titre_verbatim" TEXT,
    "photo_url" TEXT,
    "linkedin_url" TEXT,
    "person_key" TEXT NOT NULL,
    "opt_out" BOOLEAN NOT NULL DEFAULT false,
    "opt_out_at" TIMESTAMP(3),
    "retention_until" TIMESTAMP(3),
    "source" "ProspectionSource",
    "source_url" TEXT,
    "collected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_person_role" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "qualite_raw" TEXT,
    "fonction_normalisee" "ProspectionFonctionNormalisee",
    "seniorite" "ProspectionSeniorite",
    "departement_fonctionnel" "ProspectionDepartementFonctionnel",
    "est_dirigeant_legal" BOOLEAN NOT NULL DEFAULT false,
    "source" "ProspectionSource",
    "source_url" TEXT,
    "collected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_person_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_contact" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "establishment_id" UUID,
    "person_id" UUID,
    "type" "ProspectionContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "value_normalized" TEXT NOT NULL,
    "is_nominatif" BOOLEAN NOT NULL DEFAULT false,
    "is_generique" BOOLEAN NOT NULL DEFAULT false,
    "person_match_confidence" DOUBLE PRECISION,
    "label" TEXT,
    "role" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "shared_across_companies" BOOLEAN NOT NULL DEFAULT false,
    "source_url" TEXT,
    "confidence" DOUBLE PRECISION,
    "verif_status" "ProspectionVerifStatus",
    "collected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_campaign" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "statut" "ProspectionCampaignStatut" NOT NULL DEFAULT 'brouillon',
    "departements" TEXT[],
    "naf_codes" TEXT[],
    "secteurs" "ProspectionSecteur"[],
    "tailles" "ProspectionTaille"[],
    "types_organisation" "ProspectionTypeOrganisation"[],
    "enrichir_contacts" BOOLEAN NOT NULL DEFAULT true,
    "enrichir_personnes" BOOLEAN NOT NULL DEFAULT false,
    "quota_max" INTEGER,
    "rythme" TEXT,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "recurrence" TEXT,
    "next_run_at" TIMESTAMP(3),
    "cellules_total" INTEGER NOT NULL DEFAULT 0,
    "cellules_faites" INTEGER NOT NULL DEFAULT 0,
    "entreprises_collectees" INTEGER NOT NULL DEFAULT 0,
    "entreprises_enrichies" INTEGER NOT NULL DEFAULT 0,
    "debit_par_heure" DOUBLE PRECISION,
    "eta_completion" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_coverage_cell" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "departement" TEXT NOT NULL,
    "region" TEXT,
    "naf" TEXT NOT NULL,
    "secteur" "ProspectionSecteur",
    "taille" "ProspectionTaille" NOT NULL,
    "type_organisation" "ProspectionTypeOrganisation",
    "statut" "ProspectionCellStatut" NOT NULL DEFAULT 'a_faire',
    "attendu" INTEGER NOT NULL DEFAULT 0,
    "collecte" INTEGER NOT NULL DEFAULT 0,
    "enrichi" INTEGER NOT NULL DEFAULT 0,
    "page_cursor" TEXT,
    "last_error" TEXT,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_coverage_cell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_collect_run" (
    "id" UUID NOT NULL,
    "cell_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "nb_resultats" INTEGER NOT NULL DEFAULT 0,
    "nb_nouveaux" INTEGER NOT NULL DEFAULT 0,
    "nb_doublons" INTEGER NOT NULL DEFAULT 0,
    "api_calls" INTEGER NOT NULL DEFAULT 0,
    "status" "ProspectionCollectRunStatus" NOT NULL DEFAULT 'running',
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_collect_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_event" (
    "id" UUID NOT NULL,
    "type" "ProspectionEventType" NOT NULL,
    "actor_id" UUID,
    "reason" TEXT,
    "company_id" UUID,
    "campaign_id" UUID,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_access_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" "ProspectionAccessLogAction" NOT NULL,
    "cible" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_tag" (
    "id" UUID NOT NULL,
    "type" "ProspectionTagType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_company_tag" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "assigned_by" "ProspectionAssignedBy" NOT NULL DEFAULT 'auto',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_company_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_suppression_entry" (
    "id" UUID NOT NULL,
    "type" "ProspectionSuppressionType" NOT NULL,
    "value" TEXT NOT NULL,
    "value_normalized" TEXT NOT NULL,
    "raison" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_suppression_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_stock_reference" (
    "id" UUID NOT NULL,
    "departement" TEXT NOT NULL,
    "naf" TEXT NOT NULL,
    "taille" "ProspectionTaille" NOT NULL,
    "type_organisation" "ProspectionTypeOrganisation",
    "stock_attendu" INTEGER NOT NULL DEFAULT 0,
    "stock_refreshed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_stock_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_geo_coverage_stat" (
    "id" UUID NOT NULL,
    "scope" "ProspectionGeoScope" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "dim_key" TEXT NOT NULL,
    "secteur" "ProspectionSecteur",
    "taille" "ProspectionTaille",
    "type_organisation" "ProspectionTypeOrganisation",
    "stock_attendu" INTEGER NOT NULL DEFAULT 0,
    "collectees" INTEGER NOT NULL DEFAULT 0,
    "enrichies" INTEGER NOT NULL DEFAULT 0,
    "exploitables" INTEGER NOT NULL DEFAULT 0,
    "partiels" INTEGER NOT NULL DEFAULT 0,
    "non_contactables" INTEGER NOT NULL DEFAULT 0,
    "pct_completion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pct_exploitable_sur_collectees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pct_exploitable_sur_stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pct_perime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refreshed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_geo_coverage_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospection_stats_snapshot" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "scope" "ProspectionGeoScope" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "dim_key" TEXT NOT NULL,
    "stock_attendu" INTEGER NOT NULL DEFAULT 0,
    "collectees" INTEGER NOT NULL DEFAULT 0,
    "enrichies" INTEGER NOT NULL DEFAULT 0,
    "exploitables" INTEGER NOT NULL DEFAULT 0,
    "partiels" INTEGER NOT NULL DEFAULT 0,
    "non_contactables" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospection_stats_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prospection_company_siren_key" ON "prospection_company"("siren");

-- CreateIndex
CREATE INDEX "prospection_company_departement_taille_idx" ON "prospection_company"("departement", "taille");

-- CreateIndex
CREATE INDEX "prospection_company_secteur_departement_idx" ON "prospection_company"("secteur", "departement");

-- CreateIndex
CREATE INDEX "prospection_company_naf_taille_idx" ON "prospection_company"("naf", "taille");

-- CreateIndex
CREATE INDEX "prospection_company_region_idx" ON "prospection_company"("region");

-- CreateIndex
CREATE INDEX "prospection_company_enrichment_status_idx" ON "prospection_company"("enrichment_status");

-- CreateIndex
CREATE INDEX "prospection_company_contactabilite_idx" ON "prospection_company"("contactabilite");

-- CreateIndex
CREATE INDEX "prospection_company_statut_diffusion_idx" ON "prospection_company"("statut_diffusion");

-- CreateIndex
CREATE INDEX "prospection_company_opt_out_idx" ON "prospection_company"("opt_out");

-- CreateIndex
CREATE INDEX "prospection_company_retention_until_idx" ON "prospection_company"("retention_until");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_establishment_siret_key" ON "prospection_establishment"("siret");

-- CreateIndex
CREATE INDEX "prospection_establishment_company_id_idx" ON "prospection_establishment"("company_id");

-- CreateIndex
CREATE INDEX "prospection_establishment_departement_idx" ON "prospection_establishment"("departement");

-- CreateIndex
CREATE INDEX "prospection_person_person_key_idx" ON "prospection_person"("person_key");

-- CreateIndex
CREATE INDEX "prospection_person_opt_out_idx" ON "prospection_person"("opt_out");

-- CreateIndex
CREATE INDEX "prospection_person_retention_until_idx" ON "prospection_person"("retention_until");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_person_company_id_person_key_key" ON "prospection_person"("company_id", "person_key");

-- CreateIndex
CREATE INDEX "prospection_person_role_person_id_idx" ON "prospection_person_role"("person_id");

-- CreateIndex
CREATE INDEX "prospection_person_role_fonction_normalisee_idx" ON "prospection_person_role"("fonction_normalisee");

-- CreateIndex
CREATE INDEX "prospection_person_role_seniorite_idx" ON "prospection_person_role"("seniorite");

-- CreateIndex
CREATE INDEX "prospection_contact_company_id_idx" ON "prospection_contact"("company_id");

-- CreateIndex
CREATE INDEX "prospection_contact_person_id_idx" ON "prospection_contact"("person_id");

-- CreateIndex
CREATE INDEX "prospection_contact_value_normalized_idx" ON "prospection_contact"("value_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_contact_company_id_type_value_normalized_key" ON "prospection_contact"("company_id", "type", "value_normalized");

-- CreateIndex
CREATE INDEX "prospection_campaign_statut_idx" ON "prospection_campaign"("statut");

-- CreateIndex
CREATE INDEX "prospection_campaign_next_run_at_idx" ON "prospection_campaign"("next_run_at");

-- CreateIndex
CREATE INDEX "prospection_coverage_cell_campaign_id_statut_idx" ON "prospection_coverage_cell"("campaign_id", "statut");

-- CreateIndex
CREATE INDEX "prospection_coverage_cell_departement_secteur_taille_idx" ON "prospection_coverage_cell"("departement", "secteur", "taille");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_coverage_cell_campaign_id_departement_naf_taill_key" ON "prospection_coverage_cell"("campaign_id", "departement", "naf", "taille");

-- CreateIndex
CREATE INDEX "prospection_collect_run_cell_id_idx" ON "prospection_collect_run"("cell_id");

-- CreateIndex
CREATE INDEX "prospection_event_type_created_at_idx" ON "prospection_event"("type", "created_at");

-- CreateIndex
CREATE INDEX "prospection_event_company_id_idx" ON "prospection_event"("company_id");

-- CreateIndex
CREATE INDEX "prospection_event_campaign_id_idx" ON "prospection_event"("campaign_id");

-- CreateIndex
CREATE INDEX "prospection_access_log_user_id_created_at_idx" ON "prospection_access_log"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "prospection_access_log_created_at_idx" ON "prospection_access_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_tag_type_value_key" ON "prospection_tag"("type", "value");

-- CreateIndex
CREATE INDEX "prospection_company_tag_tag_id_idx" ON "prospection_company_tag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_company_tag_company_id_tag_id_key" ON "prospection_company_tag"("company_id", "tag_id");

-- CreateIndex
CREATE INDEX "prospection_suppression_entry_type_value_normalized_idx" ON "prospection_suppression_entry"("type", "value_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_suppression_entry_type_value_normalized_key" ON "prospection_suppression_entry"("type", "value_normalized");

-- CreateIndex
CREATE INDEX "prospection_stock_reference_departement_idx" ON "prospection_stock_reference"("departement");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_stock_reference_departement_naf_taille_key" ON "prospection_stock_reference"("departement", "naf", "taille");

-- CreateIndex
CREATE INDEX "prospection_geo_coverage_stat_scope_idx" ON "prospection_geo_coverage_stat"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_geo_coverage_stat_scope_scope_id_dim_key_key" ON "prospection_geo_coverage_stat"("scope", "scope_id", "dim_key");

-- CreateIndex
CREATE INDEX "prospection_stats_snapshot_scope_scope_id_date_idx" ON "prospection_stats_snapshot"("scope", "scope_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "prospection_stats_snapshot_date_scope_scope_id_dim_key_key" ON "prospection_stats_snapshot"("date", "scope", "scope_id", "dim_key");

-- AddForeignKey
ALTER TABLE "prospection_establishment" ADD CONSTRAINT "prospection_establishment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "prospection_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_person" ADD CONSTRAINT "prospection_person_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "prospection_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_person" ADD CONSTRAINT "prospection_person_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "prospection_establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_person_role" ADD CONSTRAINT "prospection_person_role_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "prospection_person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_contact" ADD CONSTRAINT "prospection_contact_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "prospection_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_contact" ADD CONSTRAINT "prospection_contact_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "prospection_establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_contact" ADD CONSTRAINT "prospection_contact_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "prospection_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_coverage_cell" ADD CONSTRAINT "prospection_coverage_cell_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "prospection_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_collect_run" ADD CONSTRAINT "prospection_collect_run_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "prospection_coverage_cell"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_event" ADD CONSTRAINT "prospection_event_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "prospection_company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_company_tag" ADD CONSTRAINT "prospection_company_tag_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "prospection_company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospection_company_tag" ADD CONSTRAINT "prospection_company_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "prospection_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

