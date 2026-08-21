-- CreateEnum
CREATE TYPE "EdPlateforme" AS ENUM ('linkedin', 'youtube', 'facebook', 'instagram', 'tiktok', 'email', 'site');

-- CreateEnum
CREATE TYPE "EdCompteType" AS ENUM ('publication', 'publicitaire');

-- CreateEnum
CREATE TYPE "EdIdentite" AS ENUM ('perso', 'pro');

-- CreateEnum
CREATE TYPE "EdStatutRedaction" AS ENUM ('idee', 'redige', 'valide');

-- CreateEnum
CREATE TYPE "EdStatutAsset" AS ENUM ('non_requis', 'a_produire', 'en_cours', 'a_valider', 'pret');

-- CreateEnum
CREATE TYPE "EdStatutDiffusion" AS ENUM ('non_programme', 'programme', 'publie', 'annule');

-- CreateEnum
CREATE TYPE "EdAssetType" AS ENUM ('video', 'carrousel', 'image', 'photo', 'audio', 'document');

-- CreateEnum
CREATE TYPE "EdAssetNature" AS ENUM ('source', 'derive', 'variante_plateforme', 'autonome');

-- CreateEnum
CREATE TYPE "EdAssetUsage" AS ENUM ('organique', 'payant', 'mixte');

-- CreateEnum
CREATE TYPE "EdRole" AS ENUM ('admin', 'stratege', 'production', 'montage', 'lecture');

-- CreateEnum
CREATE TYPE "EdAutorisationStatut" AS ENUM ('non_demandee', 'envoyee', 'signee', 'refusee');

-- CreateEnum
CREATE TYPE "EdGravite" AS ENUM ('info', 'avertissement', 'bloquant');

-- CreateEnum
CREATE TYPE "EdIdeeStatut" AS ENUM ('capturee', 'qualifiee', 'promue', 'archivee');

-- AlterEnum
ALTER TYPE "SiteSettingCategory" ADD VALUE 'editorial';

-- CreateTable
CREATE TABLE "ed_marques" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ed_marques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_comptes" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "plateforme" "EdPlateforme" NOT NULL,
    "type" "EdCompteType" NOT NULL DEFAULT 'publication',
    "libelle" VARCHAR(160) NOT NULL,
    "identite" "EdIdentite" NOT NULL,
    "marque_id" UUID,
    "url_publique" VARCHAR(512),
    "cadence_cible" INTEGER,
    "derniere_parution_a" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ed_comptes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_piliers" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "part_cible" INTEGER,
    "couleur" VARCHAR(9),
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_piliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_familles" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "type" "EdAssetType" NOT NULL,
    "duree_min_sec" INTEGER,
    "duree_max_sec" INTEGER,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_familles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_specs_plateforme" (
    "id" UUID NOT NULL,
    "plateforme" "EdPlateforme" NOT NULL,
    "famille_id" UUID NOT NULL,
    "ratio" VARCHAR(12) NOT NULL,
    "duree_min_sec" INTEGER,
    "duree_max_sec" INTEGER,
    "poids_max_mo" INTEGER,
    "sous_titres_incrustes" BOOLEAN NOT NULL DEFAULT false,
    "zone_securite_haut_px" INTEGER,
    "zone_securite_bas_px" INTEGER,
    "note" TEXT,

    CONSTRAINT "ed_specs_plateforme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_series" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "compte_id" UUID,
    "jour_semaine" INTEGER,
    "heure" VARCHAR(5),
    "periode_jours" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_publications" (
    "id" UUID NOT NULL,
    "compte_id" UUID NOT NULL,
    "pilier_id" UUID,
    "serie_id" UUID,
    "ref_import" VARCHAR(40),
    "date_prevue" DATE NOT NULL,
    "heure_prevue" VARCHAR(5) NOT NULL,
    "titre_interne" VARCHAR(200) NOT NULL,
    "accroche" TEXT,
    "corps" TEXT,
    "premier_commentaire" TEXT,
    "tags" TEXT[],
    "lien_url" VARCHAR(1024),
    "statut_redaction" "EdStatutRedaction" NOT NULL DEFAULT 'idee',
    "statut_asset" "EdStatutAsset" NOT NULL DEFAULT 'non_requis',
    "statut_diffusion" "EdStatutDiffusion" NOT NULL DEFAULT 'non_programme',
    "outil_programmation" VARCHAR(60),
    "ref_externe" VARCHAR(160),
    "url_publiee" VARCHAR(1024),
    "publiee_a" TIMESTAMP(3),
    "cout_centimes" INTEGER NOT NULL DEFAULT 0,
    "source_id" UUID,
    "responsable_id" UUID,
    "version_courante" INTEGER NOT NULL DEFAULT 1,
    "archivee_a" TIMESTAMP(3),
    "campagne" VARCHAR(60) DEFAULT 'q4-2026',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ed_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_assets" (
    "id" UUID NOT NULL,
    "type" "EdAssetType" NOT NULL,
    "famille_id" UUID,
    "nature" "EdAssetNature" NOT NULL DEFAULT 'autonome',
    "usage" "EdAssetUsage" NOT NULL DEFAULT 'organique',
    "libelle" VARCHAR(200) NOT NULL,
    "parent_id" UUID,
    "offset_source_sec" INTEGER,
    "emplacement_externe" VARCHAR(512),
    "chemin_objet" VARCHAR(512),
    "chemin_proxy" VARCHAR(512),
    "chemin_vignette" VARCHAR(512),
    "duree_sec" INTEGER,
    "largeur_px" INTEGER,
    "hauteur_px" INTEGER,
    "poids_octets" BIGINT,
    "empreinte" VARCHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "transcription" TEXT,
    "chapitres" JSONB,
    "statut" "EdStatutAsset" NOT NULL DEFAULT 'a_produire',
    "responsable_id" UUID,
    "revue_commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_assets_publications" (
    "asset_id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ed_assets_publications_pkey" PRIMARY KEY ("asset_id","publication_id")
);

-- CreateTable
CREATE TABLE "ed_invites" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(160) NOT NULL,
    "entreprise" VARCHAR(200),
    "email" VARCHAR(255),
    "telephone" VARCHAR(40),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ed_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_episodes_invites" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "invite_id" UUID NOT NULL,
    "autorisation_statut" "EdAutorisationStatut" NOT NULL DEFAULT 'non_demandee',
    "docuseal_submission_id" VARCHAR(120),
    "document_chemin" VARCHAR(512),
    "signee_a" TIMESTAMP(3),
    "valable_jusqu_a" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ed_episodes_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_recettes" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(160) NOT NULL,
    "famille_source_id" UUID NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_recettes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_recettes_lignes" (
    "id" UUID NOT NULL,
    "recette_id" UUID NOT NULL,
    "famille_id" UUID NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "compte_id" UUID,
    "note" TEXT,

    CONSTRAINT "ed_recettes_lignes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_idees" (
    "id" UUID NOT NULL,
    "titre" VARCHAR(240) NOT NULL,
    "detail" TEXT,
    "lien" VARCHAR(1024),
    "famille_id" UUID,
    "compte_id" UUID,
    "pilier_id" UUID,
    "interet" INTEGER,
    "origine" VARCHAR(120),
    "statut" "EdIdeeStatut" NOT NULL DEFAULT 'capturee',
    "promue_vers_id" UUID,
    "motif_archivage" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ed_idees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_metriques" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "releve_a" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER,
    "reactions" INTEGER,
    "commentaires" INTEGER,
    "partages" INTEGER,
    "clics" INTEGER,
    "abonnes_gagnes" INTEGER,
    "vues_completes" INTEGER,
    "duree_moyenne_sec" INTEGER,
    "ouvertures" INTEGER,
    "rdv_attribues" INTEGER,
    "devis_attribues" INTEGER,
    "source" VARCHAR(40) NOT NULL DEFAULT 'manuel',

    CONSTRAINT "ed_metriques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_objectifs" (
    "id" UUID NOT NULL,
    "mois" DATE NOT NULL,
    "compte_id" UUID,
    "famille_id" UUID,
    "cible" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "ed_objectifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_regles_conformite" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "libelle" VARCHAR(200) NOT NULL,
    "motif" TEXT NOT NULL,
    "motif_regex" TEXT NOT NULL,
    "parametres" JSONB,
    "interdit" BOOLEAN NOT NULL DEFAULT true,
    "gravite" "EdGravite" NOT NULL DEFAULT 'bloquant',
    "message" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_regles_conformite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_regles_alerte" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "libelle" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "parametres" JSONB NOT NULL,
    "gravite" "EdGravite" NOT NULL DEFAULT 'avertissement',
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_regles_alerte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_alertes_declenchees" (
    "id" UUID NOT NULL,
    "regle_id" UUID NOT NULL,
    "publication_id" UUID,
    "asset_id" UUID,
    "compte_id" UUID,
    "detail" TEXT,
    "declenchee_a" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolue_a" TIMESTAMP(3),

    CONSTRAINT "ed_alertes_declenchees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_membres" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "nom" VARCHAR(160) NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "EdRole" NOT NULL DEFAULT 'lecture',
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_membres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_journal" (
    "id" UUID NOT NULL,
    "membre_id" UUID,
    "entite" VARCHAR(60) NOT NULL,
    "entite_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "avant" JSONB,
    "apres" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ed_journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_publications_versions" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "accroche" TEXT,
    "corps" TEXT,
    "premier_commentaire" TEXT,
    "tags" TEXT[],
    "motif" TEXT,
    "auteur_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ed_publications_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_gabarits" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(160) NOT NULL,
    "compte_id" UUID,
    "serie_id" UUID,
    "pilier_id" UUID,
    "famille_id" UUID,
    "heure_prevue" VARCHAR(5),
    "corps_squelette" TEXT,
    "premier_commentaire" TEXT,
    "tags" TEXT[],
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_gabarits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ed_canaux_notification" (
    "id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "destination" VARCHAR(255) NOT NULL,
    "gravite_min" "EdGravite" NOT NULL DEFAULT 'avertissement',
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ed_canaux_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ed_marques_slug_key" ON "ed_marques"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ed_comptes_slug_key" ON "ed_comptes"("slug");

-- CreateIndex
CREATE INDEX "ed_comptes_plateforme_actif_idx" ON "ed_comptes"("plateforme", "actif");

-- CreateIndex
CREATE INDEX "ed_comptes_identite_idx" ON "ed_comptes"("identite");

-- CreateIndex
CREATE UNIQUE INDEX "ed_piliers_slug_key" ON "ed_piliers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ed_familles_slug_key" ON "ed_familles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ed_specs_plateforme_plateforme_famille_id_key" ON "ed_specs_plateforme"("plateforme", "famille_id");

-- CreateIndex
CREATE UNIQUE INDEX "ed_series_slug_key" ON "ed_series"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ed_publications_ref_import_key" ON "ed_publications"("ref_import");

-- CreateIndex
CREATE INDEX "ed_publications_date_prevue_compte_id_idx" ON "ed_publications"("date_prevue", "compte_id");

-- CreateIndex
CREATE INDEX "ed_publications_statut_diffusion_date_prevue_idx" ON "ed_publications"("statut_diffusion", "date_prevue");

-- CreateIndex
CREATE INDEX "ed_publications_statut_asset_idx" ON "ed_publications"("statut_asset");

-- CreateIndex
CREATE INDEX "ed_assets_parent_id_idx" ON "ed_assets"("parent_id");

-- CreateIndex
CREATE INDEX "ed_assets_statut_idx" ON "ed_assets"("statut");

-- CreateIndex
CREATE INDEX "ed_assets_type_famille_id_idx" ON "ed_assets"("type", "famille_id");

-- CreateIndex
CREATE INDEX "ed_episodes_invites_autorisation_statut_idx" ON "ed_episodes_invites"("autorisation_statut");

-- CreateIndex
CREATE UNIQUE INDEX "ed_episodes_invites_asset_id_invite_id_key" ON "ed_episodes_invites"("asset_id", "invite_id");

-- CreateIndex
CREATE INDEX "ed_idees_statut_interet_idx" ON "ed_idees"("statut", "interet");

-- CreateIndex
CREATE INDEX "ed_metriques_releve_a_idx" ON "ed_metriques"("releve_a");

-- CreateIndex
CREATE UNIQUE INDEX "ed_metriques_publication_id_releve_a_key" ON "ed_metriques"("publication_id", "releve_a");

-- CreateIndex
CREATE UNIQUE INDEX "ed_objectifs_mois_compte_id_famille_id_key" ON "ed_objectifs"("mois", "compte_id", "famille_id");

-- CreateIndex
CREATE UNIQUE INDEX "ed_regles_conformite_code_key" ON "ed_regles_conformite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ed_regles_alerte_code_key" ON "ed_regles_alerte"("code");

-- CreateIndex
CREATE INDEX "ed_alertes_declenchees_resolue_a_declenchee_a_idx" ON "ed_alertes_declenchees"("resolue_a", "declenchee_a");

-- CreateIndex
CREATE UNIQUE INDEX "ed_membres_user_id_key" ON "ed_membres"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ed_membres_email_key" ON "ed_membres"("email");

-- CreateIndex
CREATE INDEX "ed_journal_entite_entite_id_idx" ON "ed_journal"("entite", "entite_id");

-- CreateIndex
CREATE INDEX "ed_journal_created_at_idx" ON "ed_journal"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ed_publications_versions_publication_id_version_key" ON "ed_publications_versions"("publication_id", "version");

-- AddForeignKey
ALTER TABLE "ed_comptes" ADD CONSTRAINT "ed_comptes_marque_id_fkey" FOREIGN KEY ("marque_id") REFERENCES "ed_marques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_specs_plateforme" ADD CONSTRAINT "ed_specs_plateforme_famille_id_fkey" FOREIGN KEY ("famille_id") REFERENCES "ed_familles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_series" ADD CONSTRAINT "ed_series_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "ed_comptes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_publications" ADD CONSTRAINT "ed_publications_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "ed_comptes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_publications" ADD CONSTRAINT "ed_publications_pilier_id_fkey" FOREIGN KEY ("pilier_id") REFERENCES "ed_piliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_publications" ADD CONSTRAINT "ed_publications_serie_id_fkey" FOREIGN KEY ("serie_id") REFERENCES "ed_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_publications" ADD CONSTRAINT "ed_publications_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "ed_publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_publications" ADD CONSTRAINT "ed_publications_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "ed_membres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_assets" ADD CONSTRAINT "ed_assets_famille_id_fkey" FOREIGN KEY ("famille_id") REFERENCES "ed_familles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_assets" ADD CONSTRAINT "ed_assets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ed_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_assets" ADD CONSTRAINT "ed_assets_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "ed_membres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_assets_publications" ADD CONSTRAINT "ed_assets_publications_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "ed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_assets_publications" ADD CONSTRAINT "ed_assets_publications_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "ed_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_episodes_invites" ADD CONSTRAINT "ed_episodes_invites_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "ed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_episodes_invites" ADD CONSTRAINT "ed_episodes_invites_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "ed_invites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_recettes" ADD CONSTRAINT "ed_recettes_famille_source_id_fkey" FOREIGN KEY ("famille_source_id") REFERENCES "ed_familles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_recettes_lignes" ADD CONSTRAINT "ed_recettes_lignes_recette_id_fkey" FOREIGN KEY ("recette_id") REFERENCES "ed_recettes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_recettes_lignes" ADD CONSTRAINT "ed_recettes_lignes_famille_id_fkey" FOREIGN KEY ("famille_id") REFERENCES "ed_familles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_recettes_lignes" ADD CONSTRAINT "ed_recettes_lignes_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "ed_comptes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_idees" ADD CONSTRAINT "ed_idees_famille_id_fkey" FOREIGN KEY ("famille_id") REFERENCES "ed_familles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_idees" ADD CONSTRAINT "ed_idees_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "ed_comptes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_idees" ADD CONSTRAINT "ed_idees_pilier_id_fkey" FOREIGN KEY ("pilier_id") REFERENCES "ed_piliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_idees" ADD CONSTRAINT "ed_idees_promue_vers_id_fkey" FOREIGN KEY ("promue_vers_id") REFERENCES "ed_publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_metriques" ADD CONSTRAINT "ed_metriques_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "ed_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_objectifs" ADD CONSTRAINT "ed_objectifs_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "ed_comptes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_objectifs" ADD CONSTRAINT "ed_objectifs_famille_id_fkey" FOREIGN KEY ("famille_id") REFERENCES "ed_familles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_alertes_declenchees" ADD CONSTRAINT "ed_alertes_declenchees_regle_id_fkey" FOREIGN KEY ("regle_id") REFERENCES "ed_regles_alerte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_alertes_declenchees" ADD CONSTRAINT "ed_alertes_declenchees_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "ed_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_alertes_declenchees" ADD CONSTRAINT "ed_alertes_declenchees_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "ed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_alertes_declenchees" ADD CONSTRAINT "ed_alertes_declenchees_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "ed_comptes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_membres" ADD CONSTRAINT "ed_membres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_journal" ADD CONSTRAINT "ed_journal_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "ed_membres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_publications_versions" ADD CONSTRAINT "ed_publications_versions_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "ed_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_publications_versions" ADD CONSTRAINT "ed_publications_versions_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "ed_membres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_gabarits" ADD CONSTRAINT "ed_gabarits_compte_id_fkey" FOREIGN KEY ("compte_id") REFERENCES "ed_comptes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_gabarits" ADD CONSTRAINT "ed_gabarits_serie_id_fkey" FOREIGN KEY ("serie_id") REFERENCES "ed_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_gabarits" ADD CONSTRAINT "ed_gabarits_pilier_id_fkey" FOREIGN KEY ("pilier_id") REFERENCES "ed_piliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ed_gabarits" ADD CONSTRAINT "ed_gabarits_famille_id_fkey" FOREIGN KEY ("famille_id") REFERENCES "ed_familles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

