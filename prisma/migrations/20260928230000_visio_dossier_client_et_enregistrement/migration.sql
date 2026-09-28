-- ═════════════════════════════════════════════════════════════════════════════
-- Chantier visio — dossier client et enregistrement des visios (PR 2).
--
-- ADDITIF UNIQUEMENT. Tables, énumérations, index et objets SQL neufs ; un
-- index sur `clients(siren)` (colonne existante) et un index unique
-- `devis(id, client_id)` (aucune colonne). AUCUNE colonne ajoutée ni modifiée
-- sur une table existante. AUCUNE reprise de données.
--
-- Fenêtre app/worker : aucun code ne lit ni n'écrit ces tables dans cette PR.
-- Le worker et l'application peuvent donc tourner indifféremment avant ou
-- après la migration.
--
-- Structure du fichier :
--   1. partie Prisma — identique à `prisma migrate diff` (schéma de `main` →
--      schéma de cette PR) ;
--   2. SQL brut — chaque objet est déclaré dans `prisma/objets-sql-bruts.ts`
--      et vérifié en Gate D (dérive + comportement).
--
-- ── RÉVERSION (à n'exécuter qu'à la main, dans une transaction) ──────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS "enregistrement_consentements_ajout_seul" ON "enregistrement_consentements";
-- DROP TRIGGER IF EXISTS "client_fusion_elements_ajout_seul" ON "client_fusion_elements";
-- DROP TRIGGER IF EXISTS "effacements_journal_ajout_seul" ON "effacements_journal";
-- DROP TRIGGER IF EXISTS "rencontre_rattachement_evenements_ajout_seul" ON "rencontre_rattachement_evenements";
-- DROP TRIGGER IF EXISTS "projet_evenements_ajout_seul" ON "projet_evenements";
-- DROP TRIGGER IF EXISTS "fait_evenements_ajout_seul" ON "fait_evenements";
-- DROP TRIGGER IF EXISTS "faits_client_du_questionnaire" ON "faits";
-- DROP TRIGGER IF EXISTS "rencontres_client_de_ses_faits" ON "rencontres";
-- DROP TRIGGER IF EXISTS "faits_client_de_la_rencontre" ON "faits";
-- DROP TRIGGER IF EXISTS "faits_contenu_immuable" ON "faits";
-- DROP FUNCTION IF EXISTS "visio_preuves_accord_ajout_seul"();
-- DROP FUNCTION IF EXISTS "visio_journal_ajout_seul"();
-- DROP FUNCTION IF EXISTS "visio_faits_client_du_questionnaire"();
-- DROP FUNCTION IF EXISTS "visio_rencontres_client_de_ses_faits"();
-- DROP FUNCTION IF EXISTS "visio_faits_client_de_la_rencontre"();
-- DROP FUNCTION IF EXISTS "visio_faits_contenu_immuable"();
-- DROP TABLE IF EXISTS "traitements_visio", "compte_rendu_sources", "transcription_segments",
--   "transcriptions", "enregistrement_consentements", "enregistrement_morceaux",
--   "enregistrement_tranches", "enregistrements", "appareils_enregistrement",
--   "effacements_journal", "battements_circuit", "alertes_visio", "pre_remplissages",
--   "fait_evenements", "faits", "comptes_rendus", "emails_suivi", "questionnaire_questions",
--   "questionnaires_cadrage", "rencontre_suivis", "calendly_reports",
--   "rencontre_rattachement_evenements", "rencontre_participants", "rencontres",
--   "clients_test_interne", "client_fusion_elements", "client_fusions", "projet_devis",
--   "projet_contacts", "projet_evenements", "projets", "client_contact_adresses",
--   "client_contacts";
-- DROP INDEX IF EXISTS "devis_id_client_id_key";
-- DROP INDEX IF EXISTS "clients_siren_idx";
-- DROP TYPE IF EXISTS "code_erreur_visio", "classe_erreur", "statut_etape", "etape_visio",
--   "statut_transcription", "type_consentement", "tranche_statut", "motif_debut_tranche",
--   "piste_audio", "motif_arret", "enregistrement_statut", "nature_enregistrement",
--   "motif_effacement", "categorie_alerte_visio", "sort_pre_remplissage", "champ_pre_rempli",
--   "cible_pre_remplissage", "fait_evenement_action", "relation_fait", "fait_suivi",
--   "motif_rejet_fait", "fait_statut", "fait_source", "confiance", "fait_certitude",
--   "unite_fait", "precision_date", "periode_montant", "base_montant", "fait_type",
--   "fait_portee", "mode_generation", "compte_rendu_statut", "compte_rendu_origine",
--   "questionnaire_statut", "questionnaire_mode", "rencontre_rattachement_action",
--   "role_participant", "motif_proposition", "rattachement_statut", "rencontre_statut",
--   "rencontre_type", "rencontre_source", "element_fusion", "role_dans_projet",
--   "projet_evenement_action", "projet_statut", "nature_adresse", "contact_origine",
--   "contact_statut";
-- DELETE FROM "_prisma_migrations" WHERE "migration_name" = '<nom de ce dossier>';
-- COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

-- ═══ 1. PARTIE PRISMA (prisma migrate diff) ══════════════════════════════════

-- CreateEnum
CREATE TYPE "contact_statut" AS ENUM ('actif', 'parti');

-- CreateEnum
CREATE TYPE "contact_origine" AS ENUM ('saisie', 'calendly', 'reprise_client', 'mention');

-- CreateEnum
CREATE TYPE "nature_adresse" AS ENUM ('pro', 'perso');

-- CreateEnum
CREATE TYPE "projet_statut" AS ENUM ('ouvert', 'en_pause', 'gagne', 'perdu', 'abandonne', 'termine');

-- CreateEnum
CREATE TYPE "projet_evenement_action" AS ENUM ('cree', 'statut_change', 'reouvert', 'fusionne', 'deplace', 'renomme');

-- CreateEnum
CREATE TYPE "role_dans_projet" AS ENUM ('decideur', 'financeur', 'referent', 'utilisateur', 'prescripteur', 'autre');

-- CreateEnum
CREATE TYPE "element_fusion" AS ENUM ('contact', 'rencontre', 'projet');

-- CreateEnum
CREATE TYPE "rencontre_source" AS ENUM ('calendly', 'agenda', 'saisie_manuelle', 'dictee');

-- CreateEnum
CREATE TYPE "rencontre_type" AS ENUM ('visio', 'telephone', 'presentiel', 'inconnu');

-- CreateEnum
CREATE TYPE "rencontre_statut" AS ENUM ('planifie', 'tenu', 'annule', 'absent', 'reporte');

-- CreateEnum
CREATE TYPE "rattachement_statut" AS ENUM ('a_classer', 'propose', 'valide');

-- CreateEnum
CREATE TYPE "motif_proposition" AS ENUM ('email_calendly', 'contact_connu', 'domaine_email', 'entreprise_declaree', 'demande_liee', 'report', 'choix_extension', 'contenu_compte_rendu');

-- CreateEnum
CREATE TYPE "role_participant" AS ENUM ('axion', 'client', 'invite_non_identifie');

-- CreateEnum
CREATE TYPE "rencontre_rattachement_action" AS ENUM ('propose', 'valide', 'deplace', 'fusionne', 'annule');

-- CreateEnum
CREATE TYPE "questionnaire_mode" AS ENUM ('a_copier', 'en_ligne');

-- CreateEnum
CREATE TYPE "questionnaire_statut" AS ENUM ('brouillon', 'copie', 'reponse_recue', 'clos');

-- CreateEnum
CREATE TYPE "compte_rendu_origine" AS ENUM ('ia', 'manuel', 'dictee');

-- CreateEnum
CREATE TYPE "mode_generation" AS ENUM ('initial', 'reecrire', 'reextraire', 'completer_apres_rattachement');

-- CreateEnum
CREATE TYPE "compte_rendu_statut" AS ENUM ('brouillon', 'a_valider', 'valide', 'remplace', 'rejete', 'a_regenerer');

-- CreateEnum
CREATE TYPE "fait_portee" AS ENUM ('entreprise', 'projet', 'a_ranger');

-- CreateEnum
CREATE TYPE "fait_type" AS ENUM ('info_societe', 'activite', 'effectif', 'outil_utilise', 'niveau_ia', 'decideur', 'processus_decision', 'probleme', 'besoin', 'objectif', 'public_cible', 'nb_participants', 'modalite_souhaitee', 'lieu_intervention', 'contrainte', 'budget', 'financement', 'echeance', 'objection', 'concurrent', 'engagement_axion', 'engagement_client', 'prix_annonce_axion', 'offre_envisagee', 'question_ouverte', 'question_client_repondue', 'prochaine_etape', 'mise_en_relation', 'autre');

-- CreateEnum
CREATE TYPE "base_montant" AS ENUM ('ht', 'ttc', 'non_precise');

-- CreateEnum
CREATE TYPE "periode_montant" AS ENUM ('total', 'par_an', 'par_mois', 'par_personne', 'non_precise');

-- CreateEnum
CREATE TYPE "precision_date" AS ENUM ('jour', 'semaine', 'mois', 'trimestre', 'annee', 'avant_le', 'apres_le');

-- CreateEnum
CREATE TYPE "unite_fait" AS ENUM ('personnes', 'groupes', 'jours', 'heures', 'demi_journees', 'mois', 'sessions', 'salaries', 'forfait');

-- CreateEnum
CREATE TYPE "fait_certitude" AS ENUM ('dit_explicitement', 'confirme_sur_reformulation', 'deduit', 'rapporte_par_williams');

-- CreateEnum
CREATE TYPE "confiance" AS ENUM ('haute', 'moyenne', 'faible');

-- CreateEnum
CREATE TYPE "fait_source" AS ENUM ('transcription', 'dictee', 'formulaire_calendly', 'saisie_manuelle', 'questionnaire_cadrage');

-- CreateEnum
CREATE TYPE "fait_statut" AS ENUM ('propose', 'en_attente', 'valide', 'rejete', 'remplace', 'efface');

-- CreateEnum
CREATE TYPE "motif_rejet_fait" AS ENUM ('citation_introuvable', 'citation_trop_courte', 'citation_trop_longue', 'segment_inconnu', 'preuve_historique', 'locuteur_non_admis', 'valeur_non_prouvee', 'deduction_interdite', 'reference_catalogue_inconnue', 'relation_hors_projet', 'version_remplacee', 'doublon', 'rejete_par_williams', 'rectification');

-- CreateEnum
CREATE TYPE "fait_suivi" AS ENUM ('ouvert', 'tenu', 'repondu', 'leve', 'abandonne', 'a_reconfirmer');

-- CreateEnum
CREATE TYPE "relation_fait" AS ENUM ('confirme', 'precise', 'change', 'contredit', 'remet_en_cause');

-- CreateEnum
CREATE TYPE "fait_evenement_action" AS ENUM ('propose', 'valide', 'rejete', 'deplace', 'remplace', 'efface', 'suivi_change', 'relation_posee', 'doublon_lie', 'aligne_cle', 'rejete_regeneration');

-- CreateEnum
CREATE TYPE "cible_pre_remplissage" AS ENUM ('devis', 'formation', 'questionnaire_cadrage', 'client', 'email_suivi');

-- CreateEnum
CREATE TYPE "champ_pre_rempli" AS ENUM ('devis_activite', 'devis_ligne_offre', 'devis_quantite', 'devis_nb_participants', 'devis_duree_heures', 'devis_financement', 'devis_ref_client', 'devis_mise_en_relation', 'formation_niveau', 'formation_prerequis', 'formation_secteur_cible', 'formation_outils_client', 'questionnaire_question', 'client_siren', 'client_ville', 'client_raison_sociale', 'email_suivi_corps');

-- CreateEnum
CREATE TYPE "sort_pre_remplissage" AS ENUM ('garde', 'modifie', 'retire');

-- CreateEnum
CREATE TYPE "categorie_alerte_visio" AS ENUM ('configuration', 'circuit', 'audio', 'rgpd', 'cout', 'preavis');

-- CreateEnum
CREATE TYPE "motif_effacement" AS ENUM ('art17', 'art17_cible', 'retrait', 'conservation', 'pilote');

-- CreateEnum
CREATE TYPE "nature_enregistrement" AS ENUM ('visio', 'dictee');

-- CreateEnum
CREATE TYPE "enregistrement_statut" AS ENUM ('accord_en_attente', 'en_cours', 'interrompu', 'depose', 'en_traitement', 'transcrit', 'compte_rendu_pret', 'valide', 'echec', 'abandonne', 'refuse', 'accord_non_confirme');

-- CreateEnum
CREATE TYPE "motif_arret" AS ENUM ('manuel', 'onglet_ferme', 'salle_quittee', 'duree_max', 'plantage', 'refus_participant', 'accord_non_confirme', 'cloture_serveur', 'inconnu');

-- CreateEnum
CREATE TYPE "piste_audio" AS ENUM ('client', 'axion');

-- CreateEnum
CREATE TYPE "motif_debut_tranche" AS ENUM ('demarrage', 'nouvelle_tranche', 'reprise_apres_plantage', 'micro_reconnecte');

-- CreateEnum
CREATE TYPE "tranche_statut" AS ENUM ('en_reception', 'complete', 'incomplete', 'transcrite', 'echec', 'purgee');

-- CreateEnum
CREATE TYPE "type_consentement" AS ENUM ('declaration_axion', 'phrase_retrouvee_verifiee', 'reponse_calendly', 'nouveau_participant_signale', 'retrait');

-- CreateEnum
CREATE TYPE "statut_transcription" AS ENUM ('en_cours', 'echec', 'obtenue', 'retenue', 'ecartee');

-- CreateEnum
CREATE TYPE "etape_visio" AS ENUM ('transcrire', 'precontroler', 'extraire', 'verifier_faits', 'rattacher', 'consolider', 'ebaucher', 'rediger', 'verifier_compte_rendu', 'purger_audio', 'questionnaire', 'lire_reponses', 'email_suivi');

-- CreateEnum
CREATE TYPE "statut_etape" AS ENUM ('a_faire', 'en_cours', 'reussie', 'echec_definitif', 'annule', 'suspendu');

-- CreateEnum
CREATE TYPE "classe_erreur" AS ENUM ('passagere', 'configuration', 'contenu', 'schema_en_retard', 'plafond', 'quota');

-- CreateEnum
CREATE TYPE "code_erreur_visio" AS ENUM ('audio_incomplet', 'audio_illisible', 'audio_trop_gros', 'piste_muette', 'delai_depasse', 'sortie_invalide', 'sortie_tronquee', 'refus_modele', 'plafond_atteint', 'quota_epuise', 'authentification_openai', 'limite_debit', 'fournisseur_indisponible', 'cle_chiffrement_absente', 'stockage_indisponible', 'schema_en_retard', 'interrompu_par_arret', 'table_absente', 'inconnu');

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "fonction" VARCHAR(150),
    "telephone" VARCHAR(40),
    "statut" "contact_statut" NOT NULL DEFAULT 'actif',
    "parti_le" DATE,
    "origine" "contact_origine" NOT NULL,
    "est_contact_facturation" BOOLEAN NOT NULL DEFAULT false,
    "opposition_ia_le" TIMESTAMP(3),
    "cree_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contact_adresses" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "email_hash" VARCHAR(64) NOT NULL,
    "nature" "nature_adresse" NOT NULL,
    "confirmee_par_calendly" BOOLEAN NOT NULL DEFAULT false,
    "ajoutee_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contact_adresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projets" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "client_id" UUID NOT NULL,
    "titre" VARCHAR(200) NOT NULL,
    "activite" "ActiviteFacturation",
    "statut" "projet_statut" NOT NULL DEFAULT 'ouvert',
    "derniere_reouverture_le" TIMESTAMP(3),
    "fusionne_dans_id" UUID,
    "cree_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projet_evenements" (
    "id" UUID NOT NULL,
    "projet_id" UUID NOT NULL,
    "action" "projet_evenement_action" NOT NULL,
    "ancien_statut" "projet_statut",
    "nouveau_statut" "projet_statut",
    "autre_projet_id" UUID,
    "motif" VARCHAR(300),
    "par_admin_id" UUID,
    "survenu_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projet_evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projet_contacts" (
    "projet_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "role" "role_dans_projet" NOT NULL,

    CONSTRAINT "projet_contacts_pkey" PRIMARY KEY ("projet_id","contact_id","role")
);

-- CreateTable
CREATE TABLE "projet_devis" (
    "devis_id" UUID NOT NULL,
    "projet_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "lie_par_id" UUID,
    "lie_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projet_devis_pkey" PRIMARY KEY ("devis_id")
);

-- CreateTable
CREATE TABLE "client_fusions" (
    "id" UUID NOT NULL,
    "absorbe_id" UUID NOT NULL,
    "absorbant_id" UUID NOT NULL,
    "par_admin_id" UUID NOT NULL,
    "le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motif" VARCHAR(300) NOT NULL,
    "siren_reporte" BOOLEAN NOT NULL DEFAULT false,
    "siren_absorbe_avant" VARCHAR(9),
    "defaite_le" TIMESTAMP(3),
    "defaite_par_admin_id" UUID,
    "motif_defaite" VARCHAR(300),
    "emise_vers_partners_le" TIMESTAMP(3),

    CONSTRAINT "client_fusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_fusion_elements" (
    "fusion_id" UUID NOT NULL,
    "type" "element_fusion" NOT NULL,
    "element_id" UUID NOT NULL,

    CONSTRAINT "client_fusion_elements_pkey" PRIMARY KEY ("fusion_id","type","element_id")
);

-- CreateTable
CREATE TABLE "clients_test_interne" (
    "client_id" UUID NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_test_interne_pkey" PRIMARY KEY ("client_id")
);

-- CreateTable
CREATE TABLE "rencontres" (
    "id" UUID NOT NULL,
    "source" "rencontre_source" NOT NULL,
    "type" "rencontre_type" NOT NULL,
    "est_test_interne" BOOLEAN NOT NULL DEFAULT false,
    "calendly_event_id" TEXT,
    "calendly_event_uri" VARCHAR(255),
    "calendly_invitee_uri" VARCHAR(255),
    "ancien_invitee_uri" VARCHAR(255),
    "google_event_id" VARCHAR(255),
    "meet_code" VARCHAR(20),
    "titre" VARCHAR(255) NOT NULL,
    "debut_prevu" TIMESTAMP(3),
    "fin_prevue" TIMESTAMP(3),
    "debut_reel" TIMESTAMP(3),
    "fin_reelle" TIMESTAMP(3),
    "dates_synchronisees_le" TIMESTAMP(3),
    "statut" "rencontre_statut",
    "issue_figee" "rendez_vous_issue",
    "client_id" UUID,
    "projet_id" UUID,
    "rattachement_statut" "rattachement_statut" NOT NULL DEFAULT 'a_classer',
    "client_propose_id" UUID,
    "projet_propose_id" UUID,
    "motif_proposition" "motif_proposition",
    "rattache_par_id" UUID,
    "rattache_le" TIMESTAMP(3),
    "creee_par_id" UUID,
    "reprise_historique" BOOLEAN NOT NULL DEFAULT false,
    "fusionnee_dans_id" UUID,
    "audio_purge_sans_transcription_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rencontres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rencontre_participants" (
    "id" UUID NOT NULL,
    "rencontre_id" UUID NOT NULL,
    "client_id" UUID,
    "contact_id" UUID,
    "nom_affiche" VARCHAR(200) NOT NULL,
    "email_hash" VARCHAR(64),
    "role" "role_participant" NOT NULL,
    "etiquette_voix" VARCHAR(40),
    "voix_validee_le" TIMESTAMP(3),

    CONSTRAINT "rencontre_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rencontre_rattachement_evenements" (
    "id" UUID NOT NULL,
    "rencontre_id" UUID NOT NULL,
    "action" "rencontre_rattachement_action" NOT NULL,
    "ancien_client_id" UUID,
    "nouveau_client_id" UUID,
    "ancien_projet_id" UUID,
    "nouveau_projet_id" UUID,
    "motif" "motif_proposition",
    "par_admin_id" UUID,
    "survenu_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rencontre_rattachement_evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendly_reports" (
    "ancien_event_uri" VARCHAR(255) NOT NULL,
    "nouvel_event_uri" VARCHAR(255) NOT NULL,
    "reporte_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendly_reports_pkey" PRIMARY KEY ("ancien_event_uri")
);

-- CreateTable
CREATE TABLE "rencontre_suivis" (
    "rencontre_id" UUID NOT NULL,
    "issue" "rendez_vous_issue" NOT NULL,
    "suite" "rendez_vous_suite",
    "suite_le" DATE,
    "auteur_id" UUID,
    "valide_le" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rencontre_suivis_pkey" PRIMARY KEY ("rencontre_id")
);

-- CreateTable
CREATE TABLE "questionnaires_cadrage" (
    "id" UUID NOT NULL,
    "projet_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contact_destinataire_id" UUID,
    "version" SMALLINT NOT NULL,
    "mode" "questionnaire_mode" NOT NULL,
    "statut" "questionnaire_statut" NOT NULL,
    "genere_le" TIMESTAMP(3) NOT NULL,
    "copie_le" TIMESTAMP(3),
    "reponse_recue_le" TIMESTAMP(3),
    "clos_le" TIMESTAMP(3),
    "modele" VARCHAR(60),
    "prompt_hash" VARCHAR(64),
    "cree_par_id" UUID,

    CONSTRAINT "questionnaires_cadrage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_questions" (
    "id" UUID NOT NULL,
    "questionnaire_id" UUID NOT NULL,
    "ordre" SMALLINT NOT NULL,
    "texte" TEXT NOT NULL,
    "type_vise" "fait_type" NOT NULL,
    "cle_visee" VARCHAR(80),
    "fait_source_id" UUID,
    "posee_de_vive_voix" BOOLEAN NOT NULL DEFAULT false,
    "reponse" TEXT,
    "reponse_recue_le" TIMESTAMP(3),

    CONSTRAINT "questionnaire_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails_suivi" (
    "id" UUID NOT NULL,
    "rencontre_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "email_outbox_id" UUID,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par_id" UUID,

    CONSTRAINT "emails_suivi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comptes_rendus" (
    "id" UUID NOT NULL,
    "rencontre_id" UUID NOT NULL,
    "version" SMALLINT NOT NULL,
    "origine" "compte_rendu_origine" NOT NULL,
    "mode" "mode_generation",
    "statut" "compte_rendu_statut" NOT NULL DEFAULT 'brouillon',
    "modele" VARCHAR(60),
    "prompt_hash" VARCHAR(64),
    "schema_version" SMALLINT NOT NULL,
    "contenu" TEXT NOT NULL,
    "verification" TEXT,
    "valide_par_id" UUID,
    "valide_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comptes_rendus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faits" (
    "id" UUID NOT NULL,
    "client_id" UUID,
    "portee" "fait_portee" NOT NULL,
    "projet_id" UUID,
    "contact_sujet_id" UUID,
    "type" "fait_type" NOT NULL,
    "cle" VARCHAR(80) NOT NULL,
    "enonce" TEXT NOT NULL,
    "montant_min_cents" INTEGER,
    "montant_max_cents" INTEGER,
    "base_montant" "base_montant",
    "periode_montant" "periode_montant",
    "date_cible" DATE,
    "precision_date" "precision_date",
    "expression_temporelle" TEXT,
    "quantite" INTEGER,
    "unite" "unite_fait",
    "ref_catalogue" VARCHAR(80),
    "texte_court" TEXT,
    "certitude" "fait_certitude" NOT NULL,
    "confiance" "confiance" NOT NULL,
    "source" "fait_source" NOT NULL,
    "rencontre_id" UUID,
    "compte_rendu_id" UUID,
    "questionnaire_question_id" UUID,
    "ref_extraction" VARCHAR(8),
    "locuteur" "role_participant",
    "participant_locuteur_id" UUID,
    "contact_locuteur_id" UUID,
    "citation" TEXT,
    "citation_debut_ms" INTEGER,
    "citation_fin_ms" INTEGER,
    "confirmation_citation" TEXT,
    "confirmation_debut_ms" INTEGER,
    "confirmation_fin_ms" INTEGER,
    "citation_verifiee" BOOLEAN NOT NULL DEFAULT false,
    "ambiguite" TEXT,
    "constate_le" TIMESTAMP(3) NOT NULL,
    "statut" "fait_statut" NOT NULL DEFAULT 'propose',
    "motif_rejet" "motif_rejet_fait",
    "suivi" "fait_suivi",
    "resolu_par_fait_id" UUID,
    "relation" "relation_fait",
    "relation_avec_fait_id" UUID,
    "remplace_par_id" UUID,
    "doublon_de_fait_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fait_evenements" (
    "id" UUID NOT NULL,
    "fait_id" UUID NOT NULL,
    "action" "fait_evenement_action" NOT NULL,
    "ancien_client_id" UUID,
    "nouveau_client_id" UUID,
    "ancien_portee" "fait_portee",
    "nouveau_portee" "fait_portee",
    "ancien_projet_id" UUID,
    "nouveau_projet_id" UUID,
    "ancien_suivi" "fait_suivi",
    "nouveau_suivi" "fait_suivi",
    "motif" "motif_rejet_fait",
    "par_admin_id" UUID,
    "survenu_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fait_evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_remplissages" (
    "id" UUID NOT NULL,
    "cible" "cible_pre_remplissage" NOT NULL,
    "cible_id" UUID NOT NULL,
    "champ" "champ_pre_rempli" NOT NULL,
    "fait_id" UUID,
    "valeur_proposee" TEXT NOT NULL,
    "valeur_retenue" TEXT,
    "sort" "sort_pre_remplissage" NOT NULL,
    "par_admin_id" UUID NOT NULL,
    "le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_remplissages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertes_visio" (
    "cle" VARCHAR(120) NOT NULL,
    "categorie" "categorie_alerte_visio" NOT NULL,
    "premiere_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyee_le" TIMESTAMP(3),
    "dernier_essai_le" TIMESTAMP(3),
    "essais" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "alertes_visio_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "battements_circuit" (
    "nom" VARCHAR(40) NOT NULL,
    "premier_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dernier_le" TIMESTAMP(3) NOT NULL,
    "drapeau_vu_par_worker" VARCHAR(10) NOT NULL,
    "temoin_cle_ok_le" TIMESTAMP(3),
    "version" VARCHAR(40) NOT NULL,

    CONSTRAINT "battements_circuit_pkey" PRIMARY KEY ("nom")
);

-- CreateTable
CREATE TABLE "effacements_journal" (
    "id" UUID NOT NULL,
    "table_cible" VARCHAR(60) NOT NULL,
    "ligne_id" VARCHAR(64) NOT NULL,
    "motif" "motif_effacement" NOT NULL,
    "le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "effacements_journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appareils_enregistrement" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(80) NOT NULL,
    "jeton_hash" VARCHAR(64) NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "derniere_utilisation_le" TIMESTAMP(3),
    "revoque_le" TIMESTAMP(3),
    "version_extension" VARCHAR(20),
    "dernier_battement_le" TIMESTAMP(3),

    CONSTRAINT "appareils_enregistrement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enregistrements" (
    "id" UUID NOT NULL,
    "rencontre_id" UUID NOT NULL,
    "nature" "nature_enregistrement" NOT NULL,
    "cle_client" UUID NOT NULL,
    "appareil_id" UUID NOT NULL,
    "statut" "enregistrement_statut" NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3),
    "accord_confirme_le" TIMESTAMP(3),
    "motif_arret" "motif_arret",
    "incomplet" BOOLEAN NOT NULL DEFAULT false,
    "perdus" TEXT,
    "fenetres_hors_accord" TEXT,
    "evenements" TEXT NOT NULL,
    "version_extension" VARCHAR(20) NOT NULL,
    "version_contrat" INTEGER NOT NULL,
    "audio_a_purger_avant" TIMESTAMP(3),
    "audio_supprime_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enregistrements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enregistrement_tranches" (
    "id" UUID NOT NULL,
    "enregistrement_id" UUID NOT NULL,
    "piste" "piste_audio" NOT NULL,
    "numero" SMALLINT NOT NULL,
    "debut_capture_epoch_ms" BIGINT NOT NULL,
    "motif_debut" "motif_debut_tranche" NOT NULL,
    "duree_ms" INTEGER,
    "nb_morceaux_annonces" INTEGER,
    "empreinte_annoncee" VARCHAR(64),
    "taille_octets" INTEGER NOT NULL DEFAULT 0,
    "niveau_fin_muet" BOOLEAN,
    "statut" "tranche_statut" NOT NULL,
    "transcrite_le" TIMESTAMP(3),
    "audio_supprime_le" TIMESTAMP(3),

    CONSTRAINT "enregistrement_tranches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enregistrement_morceaux" (
    "tranche_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "cle_r2" VARCHAR(200) NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "empreinte" VARCHAR(64) NOT NULL,
    "recu_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enregistrement_morceaux_pkey" PRIMARY KEY ("tranche_id","seq")
);

-- CreateTable
CREATE TABLE "enregistrement_consentements" (
    "id" UUID NOT NULL,
    "enregistrement_id" UUID,
    "rencontre_id" UUID NOT NULL,
    "type" "type_consentement" NOT NULL,
    "version_texte" VARCHAR(64) NOT NULL,
    "nb_participants" SMALLINT,
    "texte_annonce" TEXT,
    "texte_reponse" TEXT,
    "annonce_ms" INTEGER,
    "reponse_ms" INTEGER,
    "empreinte_audio" VARCHAR(64),
    "declare_par_id" UUID,
    "survenu_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enregistrement_consentements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcriptions" (
    "id" UUID NOT NULL,
    "enregistrement_id" UUID NOT NULL,
    "version" SMALLINT NOT NULL,
    "modele" VARCHAR(80) NOT NULL,
    "statut" "statut_transcription" NOT NULL,
    "langue" VARCHAR(10) NOT NULL,
    "duree_audio_secondes" INTEGER,
    "empreinte_entree" VARCHAR(64) NOT NULL,
    "segments_supprimes_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_segments" (
    "transcription_id" UUID NOT NULL,
    "ordre" INTEGER NOT NULL,
    "tranche_id" UUID NOT NULL,
    "debut_ms" INTEGER NOT NULL,
    "fin_ms" INTEGER NOT NULL,
    "piste" "piste_audio" NOT NULL,
    "locuteur_brut" VARCHAR(8),
    "etiquette_voix" VARCHAR(40),
    "participant_id" UUID,
    "texte" TEXT NOT NULL,
    "apres_refus" BOOLEAN NOT NULL DEFAULT false,
    "hors_accord" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transcription_segments_pkey" PRIMARY KEY ("transcription_id","ordre")
);

-- CreateTable
CREATE TABLE "compte_rendu_sources" (
    "compte_rendu_id" UUID NOT NULL,
    "transcription_id" UUID NOT NULL,

    CONSTRAINT "compte_rendu_sources_pkey" PRIMARY KEY ("compte_rendu_id","transcription_id")
);

-- CreateTable
CREATE TABLE "traitements_visio" (
    "id" UUID NOT NULL,
    "rencontre_id" UUID NOT NULL,
    "etape" "etape_visio" NOT NULL,
    "statut" "statut_etape" NOT NULL DEFAULT 'a_faire',
    "execution" INTEGER NOT NULL DEFAULT 0,
    "echecs" INTEGER NOT NULL DEFAULT 0,
    "interruptions" INTEGER NOT NULL DEFAULT 0,
    "classe_erreur" "classe_erreur",
    "derniere_erreur" "code_erreur_visio",
    "verrou_jusqua" TIMESTAMP(3),
    "prochaine_tentative_le" TIMESTAMP(3),
    "premier_echec_le" TIMESTAMP(3),
    "termine_le" TIMESTAMP(3),
    "compte_rendu_id" UUID,

    CONSTRAINT "traitements_visio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_contacts_client_id_idx" ON "client_contacts"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_contacts_id_client_id_key" ON "client_contacts"("id", "client_id");

-- CreateIndex
CREATE INDEX "client_contact_adresses_email_hash_idx" ON "client_contact_adresses"("email_hash");

-- CreateIndex
CREATE UNIQUE INDEX "client_contact_adresses_contact_id_email_hash_key" ON "client_contact_adresses"("contact_id", "email_hash");

-- CreateIndex
CREATE UNIQUE INDEX "projets_numero_key" ON "projets"("numero");

-- CreateIndex
CREATE INDEX "projets_client_id_statut_idx" ON "projets"("client_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "projets_id_client_id_key" ON "projets"("id", "client_id");

-- CreateIndex
CREATE INDEX "projet_evenements_projet_id_idx" ON "projet_evenements"("projet_id");

-- CreateIndex
CREATE INDEX "projet_contacts_contact_id_idx" ON "projet_contacts"("contact_id");

-- CreateIndex
CREATE INDEX "projet_devis_projet_id_idx" ON "projet_devis"("projet_id");

-- CreateIndex
CREATE INDEX "client_fusions_absorbe_id_idx" ON "client_fusions"("absorbe_id");

-- CreateIndex
CREATE INDEX "client_fusions_absorbant_id_idx" ON "client_fusions"("absorbant_id");

-- CreateIndex
CREATE UNIQUE INDEX "rencontres_calendly_event_id_key" ON "rencontres"("calendly_event_id");

-- CreateIndex
CREATE INDEX "rencontres_client_id_debut_prevu_idx" ON "rencontres"("client_id", "debut_prevu");

-- CreateIndex
CREATE INDEX "rencontres_projet_id_idx" ON "rencontres"("projet_id");

-- CreateIndex
CREATE INDEX "rencontres_meet_code_debut_prevu_idx" ON "rencontres"("meet_code", "debut_prevu");

-- CreateIndex
CREATE INDEX "rencontres_rattachement_statut_idx" ON "rencontres"("rattachement_statut");

-- CreateIndex
CREATE INDEX "rencontres_calendly_event_uri_idx" ON "rencontres"("calendly_event_uri");

-- CreateIndex
CREATE INDEX "rencontre_participants_rencontre_id_idx" ON "rencontre_participants"("rencontre_id");

-- CreateIndex
CREATE INDEX "rencontre_participants_email_hash_idx" ON "rencontre_participants"("email_hash");

-- CreateIndex
CREATE INDEX "rencontre_participants_contact_id_idx" ON "rencontre_participants"("contact_id");

-- CreateIndex
CREATE INDEX "rencontre_rattachement_evenements_rencontre_id_idx" ON "rencontre_rattachement_evenements"("rencontre_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendly_reports_nouvel_event_uri_key" ON "calendly_reports"("nouvel_event_uri");

-- CreateIndex
CREATE INDEX "rencontre_suivis_suite_le_idx" ON "rencontre_suivis"("suite_le");

-- CreateIndex
CREATE INDEX "questionnaires_cadrage_client_id_idx" ON "questionnaires_cadrage"("client_id");

-- CreateIndex
CREATE INDEX "questionnaires_cadrage_contact_destinataire_id_idx" ON "questionnaires_cadrage"("contact_destinataire_id");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaires_cadrage_projet_id_version_key" ON "questionnaires_cadrage"("projet_id", "version");

-- CreateIndex
CREATE INDEX "questionnaire_questions_fait_source_id_idx" ON "questionnaire_questions"("fait_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_questions_questionnaire_id_ordre_key" ON "questionnaire_questions"("questionnaire_id", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "emails_suivi_email_outbox_id_key" ON "emails_suivi"("email_outbox_id");

-- CreateIndex
CREATE INDEX "emails_suivi_rencontre_id_idx" ON "emails_suivi"("rencontre_id");

-- CreateIndex
CREATE INDEX "emails_suivi_contact_id_idx" ON "emails_suivi"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "comptes_rendus_rencontre_id_version_key" ON "comptes_rendus"("rencontre_id", "version");

-- CreateIndex
CREATE INDEX "faits_client_id_portee_projet_id_type_cle_idx" ON "faits"("client_id", "portee", "projet_id", "type", "cle");

-- CreateIndex
CREATE INDEX "faits_rencontre_id_idx" ON "faits"("rencontre_id");

-- CreateIndex
CREATE INDEX "faits_statut_idx" ON "faits"("statut");

-- CreateIndex
CREATE INDEX "faits_suivi_idx" ON "faits"("suivi");

-- CreateIndex
CREATE INDEX "faits_contact_sujet_id_idx" ON "faits"("contact_sujet_id");

-- CreateIndex
CREATE INDEX "faits_contact_locuteur_id_idx" ON "faits"("contact_locuteur_id");

-- CreateIndex
CREATE INDEX "faits_questionnaire_question_id_idx" ON "faits"("questionnaire_question_id");

-- CreateIndex
CREATE UNIQUE INDEX "faits_compte_rendu_id_ref_extraction_key" ON "faits"("compte_rendu_id", "ref_extraction");

-- CreateIndex
CREATE INDEX "fait_evenements_fait_id_idx" ON "fait_evenements"("fait_id");

-- CreateIndex
CREATE INDEX "pre_remplissages_cible_cible_id_idx" ON "pre_remplissages"("cible", "cible_id");

-- CreateIndex
CREATE INDEX "pre_remplissages_fait_id_idx" ON "pre_remplissages"("fait_id");

-- CreateIndex
CREATE INDEX "effacements_journal_table_cible_ligne_id_idx" ON "effacements_journal"("table_cible", "ligne_id");

-- CreateIndex
CREATE UNIQUE INDEX "appareils_enregistrement_jeton_hash_key" ON "appareils_enregistrement"("jeton_hash");

-- CreateIndex
CREATE UNIQUE INDEX "enregistrements_cle_client_key" ON "enregistrements"("cle_client");

-- CreateIndex
CREATE INDEX "enregistrements_rencontre_id_idx" ON "enregistrements"("rencontre_id");

-- CreateIndex
CREATE INDEX "enregistrements_statut_idx" ON "enregistrements"("statut");

-- CreateIndex
CREATE INDEX "enregistrements_audio_a_purger_avant_idx" ON "enregistrements"("audio_a_purger_avant");

-- CreateIndex
CREATE UNIQUE INDEX "enregistrement_tranches_enregistrement_id_piste_numero_key" ON "enregistrement_tranches"("enregistrement_id", "piste", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "enregistrement_morceaux_cle_r2_key" ON "enregistrement_morceaux"("cle_r2");

-- CreateIndex
CREATE INDEX "enregistrement_consentements_rencontre_id_idx" ON "enregistrement_consentements"("rencontre_id");

-- CreateIndex
CREATE INDEX "enregistrement_consentements_enregistrement_id_idx" ON "enregistrement_consentements"("enregistrement_id");

-- CreateIndex
CREATE UNIQUE INDEX "transcriptions_enregistrement_id_version_key" ON "transcriptions"("enregistrement_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "transcriptions_enregistrement_id_empreinte_entree_key" ON "transcriptions"("enregistrement_id", "empreinte_entree");

-- CreateIndex
CREATE INDEX "transcription_segments_participant_id_idx" ON "transcription_segments"("participant_id");

-- CreateIndex
CREATE INDEX "traitements_visio_statut_prochaine_tentative_le_idx" ON "traitements_visio"("statut", "prochaine_tentative_le");

-- CreateIndex
CREATE UNIQUE INDEX "traitements_visio_rencontre_id_etape_compte_rendu_id_key" ON "traitements_visio"("rencontre_id", "etape", "compte_rendu_id");

-- CreateIndex
CREATE INDEX "clients_siren_idx" ON "clients"("siren");

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contact_adresses" ADD CONSTRAINT "client_contact_adresses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "client_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projets" ADD CONSTRAINT "projets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_fusions" ADD CONSTRAINT "client_fusions_absorbe_id_fkey" FOREIGN KEY ("absorbe_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_fusions" ADD CONSTRAINT "client_fusions_absorbant_id_fkey" FOREIGN KEY ("absorbant_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_fusion_elements" ADD CONSTRAINT "client_fusion_elements_fusion_id_fkey" FOREIGN KEY ("fusion_id") REFERENCES "client_fusions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients_test_interne" ADD CONSTRAINT "clients_test_interne_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_calendly_event_id_fkey" FOREIGN KEY ("calendly_event_id") REFERENCES "calendly_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rencontre_participants" ADD CONSTRAINT "rencontre_participants_rencontre_id_fkey" FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rencontre_suivis" ADD CONSTRAINT "rencontre_suivis_rencontre_id_fkey" FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_questions" ADD CONSTRAINT "questionnaire_questions_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires_cadrage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_questions" ADD CONSTRAINT "questionnaire_questions_fait_source_id_fkey" FOREIGN KEY ("fait_source_id") REFERENCES "faits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails_suivi" ADD CONSTRAINT "emails_suivi_rencontre_id_fkey" FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails_suivi" ADD CONSTRAINT "emails_suivi_email_outbox_id_fkey" FOREIGN KEY ("email_outbox_id") REFERENCES "email_outbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comptes_rendus" ADD CONSTRAINT "comptes_rendus_rencontre_id_fkey" FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faits" ADD CONSTRAINT "faits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faits" ADD CONSTRAINT "faits_rencontre_id_fkey" FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faits" ADD CONSTRAINT "faits_compte_rendu_id_fkey" FOREIGN KEY ("compte_rendu_id") REFERENCES "comptes_rendus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faits" ADD CONSTRAINT "faits_questionnaire_question_id_fkey" FOREIGN KEY ("questionnaire_question_id") REFERENCES "questionnaire_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_remplissages" ADD CONSTRAINT "pre_remplissages_fait_id_fkey" FOREIGN KEY ("fait_id") REFERENCES "faits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enregistrements" ADD CONSTRAINT "enregistrements_rencontre_id_fkey" FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enregistrements" ADD CONSTRAINT "enregistrements_appareil_id_fkey" FOREIGN KEY ("appareil_id") REFERENCES "appareils_enregistrement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enregistrement_tranches" ADD CONSTRAINT "enregistrement_tranches_enregistrement_id_fkey" FOREIGN KEY ("enregistrement_id") REFERENCES "enregistrements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enregistrement_morceaux" ADD CONSTRAINT "enregistrement_morceaux_tranche_id_fkey" FOREIGN KEY ("tranche_id") REFERENCES "enregistrement_tranches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enregistrement_consentements" ADD CONSTRAINT "enregistrement_consentements_enregistrement_id_fkey" FOREIGN KEY ("enregistrement_id") REFERENCES "enregistrements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_enregistrement_id_fkey" FOREIGN KEY ("enregistrement_id") REFERENCES "enregistrements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_segments" ADD CONSTRAINT "transcription_segments_transcription_id_fkey" FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compte_rendu_sources" ADD CONSTRAINT "compte_rendu_sources_compte_rendu_id_fkey" FOREIGN KEY ("compte_rendu_id") REFERENCES "comptes_rendus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compte_rendu_sources" ADD CONSTRAINT "compte_rendu_sources_transcription_id_fkey" FOREIGN KEY ("transcription_id") REFERENCES "transcriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traitements_visio" ADD CONSTRAINT "traitements_visio_rencontre_id_fkey" FOREIGN KEY ("rencontre_id") REFERENCES "rencontres"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══ 2. SQL BRUT (déclaré dans prisma/objets-sql-bruts.ts) ═══════════════════
--
-- Codes d'erreur propres au chantier (SQLSTATE), pour que les tests de Gate D
-- distinguent un refus attendu d'une panne :
--   AXV01 contenu d'un fait immuable      AXV02 journal en ajout seul
--   AXV03 fait hors du client de sa rencontre
--   AXV04 fait hors du client de son questionnaire
--   AXV05 preuve d'accord intouchable

-- ── Index ────────────────────────────────────────────────────────────────────

-- Cible des clés composées vers un devis. Aucune colonne ajoutée à `devis`.
CREATE UNIQUE INDEX "devis_id_client_id_key" ON "devis"("id", "client_id");

CREATE UNIQUE INDEX "client_contacts_un_contact_facturation" ON "client_contacts"("client_id") WHERE "est_contact_facturation";

CREATE UNIQUE INDEX "client_fusions_une_vivante_par_absorbee" ON "client_fusions"("absorbe_id") WHERE "defaite_le" IS NULL;

CREATE UNIQUE INDEX "comptes_rendus_un_valide" ON "comptes_rendus"("rencontre_id") WHERE "statut" = 'valide';

CREATE UNIQUE INDEX "comptes_rendus_un_en_cours" ON "comptes_rendus"("rencontre_id") WHERE "statut" IN ('brouillon', 'a_valider');

CREATE UNIQUE INDEX "transcriptions_une_retenue" ON "transcriptions"("enregistrement_id") WHERE "statut" = 'retenue';

-- Produit par sqlIndexEnregistrementsActifs() depuis ETATS_ENREGISTREMENT_ACTIFS.
CREATE UNIQUE INDEX "enregistrements_un_actif" ON "enregistrements"("rencontre_id") WHERE "statut" IN ('accord_en_attente', 'en_cours', 'interrompu');

-- ── CHECK ────────────────────────────────────────────────────────────────────

ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_statut_fige_calendly" CHECK ("source" <> 'calendly' OR "calendly_event_id" IS NULL OR "statut" IS NULL);

ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_projet_exige_client" CHECK ("projet_id" IS NULL OR "client_id" IS NOT NULL);

ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_saisie_sur_fiche_validee" CHECK ("source" <> 'saisie_manuelle' OR ("client_id" IS NOT NULL AND "rattachement_statut" = 'valide'));

ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_test_interne_saisie" CHECK (NOT "est_test_interne" OR "source" = 'saisie_manuelle');

ALTER TABLE "rencontre_participants" ADD CONSTRAINT "rencontre_participants_contact_exige_client" CHECK ("contact_id" IS NULL OR "client_id" IS NOT NULL);

ALTER TABLE "rencontre_suivis" ADD CONSTRAINT "rencontre_suivis_suite_datee" CHECK ("suite" IS NULL OR "suite" = 'aucune' OR "suite_le" IS NOT NULL);

ALTER TABLE "comptes_rendus" ADD CONSTRAINT "comptes_rendus_a_regenerer_vide" CHECK ("statut" <> 'a_regenerer' OR "contenu" = '');

ALTER TABLE "faits" ADD CONSTRAINT "faits_portee_projet" CHECK (("portee" = 'projet') = ("projet_id" IS NOT NULL));

ALTER TABLE "faits" ADD CONSTRAINT "faits_projet_exige_client" CHECK ("projet_id" IS NULL OR "client_id" IS NOT NULL);

ALTER TABLE "faits" ADD CONSTRAINT "faits_contact_exige_client" CHECK (("contact_sujet_id" IS NULL AND "contact_locuteur_id" IS NULL) OR "client_id" IS NOT NULL);

ALTER TABLE "faits" ADD CONSTRAINT "faits_valide_range" CHECK ("statut" <> 'valide' OR ("portee" <> 'a_ranger' AND "client_id" IS NOT NULL));

-- Produit par sqlCheckSuivi() depuis TYPES_DE_FAITS.
ALTER TABLE "faits" ADD CONSTRAINT "faits_suivi_types_suivables" CHECK ("suivi" IS NULL OR "suivi" = 'a_reconfirmer' OR "type" IN ('objection', 'engagement_axion', 'engagement_client', 'question_ouverte', 'prochaine_etape'));

ALTER TABLE "faits" ADD CONSTRAINT "faits_reponse_a_sa_question" CHECK (("source" = 'questionnaire_cadrage') = ("questionnaire_question_id" IS NOT NULL));

-- ── Clés étrangères composées : « du même client » ───────────────────────────
--
-- ON UPDATE CASCADE : quand une fusion déplace un projet ou une personne vers
-- une autre fiche, les liens suivent. ON DELETE : les tables de liens partent
-- avec ce qu'elles lient ; ailleurs, la suppression est refusée.

ALTER TABLE "projet_contacts" ADD CONSTRAINT "projet_contacts_projet_meme_client" FOREIGN KEY ("projet_id", "client_id") REFERENCES "projets"("id", "client_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projet_contacts" ADD CONSTRAINT "projet_contacts_contact_meme_client" FOREIGN KEY ("contact_id", "client_id") REFERENCES "client_contacts"("id", "client_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projet_devis" ADD CONSTRAINT "projet_devis_projet_meme_client" FOREIGN KEY ("projet_id", "client_id") REFERENCES "projets"("id", "client_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projet_devis" ADD CONSTRAINT "projet_devis_devis_meme_client" FOREIGN KEY ("devis_id", "client_id") REFERENCES "devis"("id", "client_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_projet_meme_client" FOREIGN KEY ("projet_id", "client_id") REFERENCES "projets"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rencontre_participants" ADD CONSTRAINT "rencontre_participants_contact_meme_client" FOREIGN KEY ("contact_id", "client_id") REFERENCES "client_contacts"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "questionnaires_cadrage" ADD CONSTRAINT "questionnaires_cadrage_projet_meme_client" FOREIGN KEY ("projet_id", "client_id") REFERENCES "projets"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "questionnaires_cadrage" ADD CONSTRAINT "questionnaires_cadrage_destinataire_meme_client" FOREIGN KEY ("contact_destinataire_id", "client_id") REFERENCES "client_contacts"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "emails_suivi" ADD CONSTRAINT "emails_suivi_contact_meme_client" FOREIGN KEY ("contact_id", "client_id") REFERENCES "client_contacts"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faits" ADD CONSTRAINT "faits_projet_meme_client" FOREIGN KEY ("projet_id", "client_id") REFERENCES "projets"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faits" ADD CONSTRAINT "faits_contact_sujet_meme_client" FOREIGN KEY ("contact_sujet_id", "client_id") REFERENCES "client_contacts"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faits" ADD CONSTRAINT "faits_contact_locuteur_meme_client" FOREIGN KEY ("contact_locuteur_id", "client_id") REFERENCES "client_contacts"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Triggers ─────────────────────────────────────────────────────────────────

-- Le contenu d'un fait ne se réécrit jamais. Seuls changent le rattachement,
-- le statut, le suivi et les liens entre faits (journalisés par le code). La
-- rencontre et le compte rendu ne peuvent que passer à NULL (leur suppression
-- les détache : clés SetNull). Exception : le drapeau de session
-- `axion.effacement_rgpd`, posé par `src/lib/rgpd-erase.ts` SEUL (garde), en
-- `SET LOCAL` dans une transaction.
CREATE FUNCTION "visio_faits_contenu_immuable"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  modifiables CONSTANT text[] := ARRAY[
    'client_id', 'portee', 'projet_id', 'contact_sujet_id', 'statut', 'motif_rejet',
    'suivi', 'resolu_par_fait_id', 'relation', 'relation_avec_fait_id', 'remplace_par_id',
    'doublon_de_fait_id', 'participant_locuteur_id', 'contact_locuteur_id',
    'rencontre_id', 'compte_rendu_id'
  ];
BEGIN
  IF current_setting('axion.effacement_rgpd', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW."rencontre_id" IS DISTINCT FROM OLD."rencontre_id" AND NEW."rencontre_id" IS NOT NULL THEN
    RAISE EXCEPTION 'faits : la rencontre d''un fait ne change pas' USING ERRCODE = 'AXV01';
  END IF;
  IF NEW."compte_rendu_id" IS DISTINCT FROM OLD."compte_rendu_id" AND NEW."compte_rendu_id" IS NOT NULL THEN
    RAISE EXCEPTION 'faits : le compte rendu d''un fait ne change pas' USING ERRCODE = 'AXV01';
  END IF;
  IF (to_jsonb(NEW) - modifiables) IS DISTINCT FROM (to_jsonb(OLD) - modifiables) THEN
    RAISE EXCEPTION 'faits : le contenu d''un fait est immuable (seuls le rattachement, le statut et le suivi changent)'
      USING ERRCODE = 'AXV01';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "faits_contenu_immuable" BEFORE UPDATE ON "faits"
  FOR EACH ROW EXECUTE FUNCTION "visio_faits_contenu_immuable"();

-- Un fait appartient au client de sa rencontre, vérifié en fin de transaction
-- (on range la rencontre et ses faits dans la même transaction). La ligne est
-- RELUE : l'image de l'événement peut être antérieure à la dernière écriture.
CREATE FUNCTION "visio_faits_client_de_la_rencontre"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "faits" f
    JOIN "rencontres" r ON r."id" = f."rencontre_id"
    WHERE f."id" = NEW."id" AND r."client_id" IS DISTINCT FROM f."client_id"
  ) THEN
    RAISE EXCEPTION 'faits : un fait appartient au client de sa rencontre' USING ERRCODE = 'AXV03';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "faits_client_de_la_rencontre"
  AFTER INSERT OR UPDATE OF "client_id", "rencontre_id" ON "faits"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "visio_faits_client_de_la_rencontre"();

-- Symétrique : ranger une rencontre ailleurs sans ses faits est refusé.
CREATE FUNCTION "visio_rencontres_client_de_ses_faits"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "faits" f
    JOIN "rencontres" r ON r."id" = f."rencontre_id"
    WHERE r."id" = NEW."id" AND r."client_id" IS DISTINCT FROM f."client_id"
  ) THEN
    RAISE EXCEPTION 'rencontres : les faits d''une rencontre suivent son client' USING ERRCODE = 'AXV03';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "rencontres_client_de_ses_faits"
  AFTER UPDATE OF "client_id" ON "rencontres"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "visio_rencontres_client_de_ses_faits"();

-- Un fait issu d'une réponse appartient au client du questionnaire.
CREATE FUNCTION "visio_faits_client_du_questionnaire"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "faits" f
    JOIN "questionnaire_questions" qq ON qq."id" = f."questionnaire_question_id"
    JOIN "questionnaires_cadrage" qc ON qc."id" = qq."questionnaire_id"
    WHERE f."id" = NEW."id" AND qc."client_id" IS DISTINCT FROM f."client_id"
  ) THEN
    RAISE EXCEPTION 'faits : un fait issu d''une réponse appartient au client du questionnaire'
      USING ERRCODE = 'AXV04';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "faits_client_du_questionnaire"
  AFTER INSERT OR UPDATE OF "client_id", "questionnaire_question_id" ON "faits"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "visio_faits_client_du_questionnaire"();

-- Journaux en ajout seul : ni modification ni suppression, pour personne.
CREATE FUNCTION "visio_journal_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% : journal en ajout seul (ni modification ni suppression)', TG_TABLE_NAME
    USING ERRCODE = 'AXV02';
END
$$;

CREATE TRIGGER "fait_evenements_ajout_seul" BEFORE UPDATE OR DELETE ON "fait_evenements"
  FOR EACH ROW EXECUTE FUNCTION "visio_journal_ajout_seul"();

CREATE TRIGGER "projet_evenements_ajout_seul" BEFORE UPDATE OR DELETE ON "projet_evenements"
  FOR EACH ROW EXECUTE FUNCTION "visio_journal_ajout_seul"();

CREATE TRIGGER "rencontre_rattachement_evenements_ajout_seul" BEFORE UPDATE OR DELETE ON "rencontre_rattachement_evenements"
  FOR EACH ROW EXECUTE FUNCTION "visio_journal_ajout_seul"();

CREATE TRIGGER "effacements_journal_ajout_seul" BEFORE UPDATE OR DELETE ON "effacements_journal"
  FOR EACH ROW EXECUTE FUNCTION "visio_journal_ajout_seul"();

CREATE TRIGGER "client_fusion_elements_ajout_seul" BEFORE UPDATE OR DELETE ON "client_fusion_elements"
  FOR EACH ROW EXECUTE FUNCTION "visio_journal_ajout_seul"();

-- Preuves d'accord : ajout seul. Deux exceptions, et deux seulement :
--   · la suppression d'un enregistrement DÉTACHE sa preuve (clé SetNull) — la
--     preuve survit au son ; c'est la seule modification admise ;
--   · le drapeau d'effacement RGPD (fin de conservation, pilote), posé par
--     `src/lib/rgpd-erase.ts` seul.
CREATE FUNCTION "visio_preuves_accord_ajout_seul"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('axion.effacement_rgpd', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW."enregistrement_id" IS NULL
     AND (to_jsonb(NEW) - 'enregistrement_id') = (to_jsonb(OLD) - 'enregistrement_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'enregistrement_consentements : une preuve d''accord ne se modifie ni ne se supprime'
    USING ERRCODE = 'AXV05';
END
$$;

CREATE TRIGGER "enregistrement_consentements_ajout_seul" BEFORE UPDATE OR DELETE ON "enregistrement_consentements"
  FOR EACH ROW EXECUTE FUNCTION "visio_preuves_accord_ajout_seul"();
