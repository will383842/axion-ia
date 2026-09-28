/**
 * SQL BRUT DU CHANTIER VISIO — LA LISTE UNIQUE (ADR 0053, plan §3.3 g).
 *
 * Prisma n'exprime ni les index partiels, ni les CHECK, ni les clés étrangères
 * composées, ni les triggers. Ceux du dossier client et de l'enregistrement
 * vivent donc en SQL brut, à la fin de la migration
 * `MIGRATION_VISIO/migration.sql`, et CHACUN est déclaré ici.
 *
 * Cette liste est lue par trois contrôles, et c'est ce qui la rend vraie :
 *   1. `tests/unit/ci/tout-objet-sql-brut-est-dans-une-migration.spec.ts` —
 *      chaque objet déclaré est créé par la migration, et chaque objet créé en
 *      SQL brut par la migration est déclaré (dans les deux sens) ;
 *   2. `scripts/ci/garde-derive-sql-brut.ts` (Gate D) — après
 *      `prisma migrate deploy` sur une base neuve, chaque objet existe
 *      RÉELLEMENT (`pg_indexes`, `pg_constraint`, `pg_trigger`) sur sa table, et
 *      aucun objet non déclaré n'existe sur les tables du chantier ;
 *   3. `tests/sql/dossier-client-comportement.sql` (Gate D) — les objets font ce
 *      qu'ils promettent (un second compte rendu validé est refusé, etc.).
 *
 * Deux fragments sont PRODUITS depuis le code, jamais recopiés : l'index
 * `enregistrements_un_actif` (depuis `ETATS_ENREGISTREMENT_ACTIFS`) et le CHECK
 * `faits_suivi_types_suivables` (depuis `TYPES_DE_FAITS`). Leurs gardes
 * comparent la migration au fragment produit ici.
 *
 * ⚠️ Nommage : les clés étrangères composées se terminent par `_meme_client`,
 * jamais par `_fkey` (réservé aux clés que Prisma génère). C'est ce qui permet
 * à la garde de dérive de voir une clé composée NON déclarée.
 */

import { ETATS_ENREGISTREMENT_ACTIFS } from "../src/server/visio/etats";
import { TYPES_SUIVABLES } from "../src/server/visio/types-de-faits";

/** Dossier de la migration qui crée tout le chantier (une seule, additive). */
export const MIGRATION_VISIO = "20260928230000_visio_dossier_client_et_enregistrement";

export type TypeObjetSqlBrut = "index" | "check" | "fk" | "trigger";

export interface ObjetSqlBrut {
  /** Nom exact en base (index, contrainte ou trigger). */
  readonly nom: string;
  readonly type: TypeObjetSqlBrut;
  /** Table qui porte l'objet. */
  readonly table: string;
  /** Pourquoi il existe, en une phrase. */
  readonly role: string;
}

/**
 * Les tables créées par le chantier. La garde de dérive refuse, sur elles,
 * tout index, CHECK, clé non `_fkey` ou trigger qui ne serait pas déclaré.
 */
export const TABLES_DU_CHANTIER = [
  "client_contacts",
  "client_contact_adresses",
  "projets",
  "projet_evenements",
  "projet_contacts",
  "projet_devis",
  "client_fusions",
  "client_fusion_elements",
  "clients_test_interne",
  "rencontres",
  "rencontre_participants",
  "rencontre_rattachement_evenements",
  "calendly_reports",
  "rencontre_suivis",
  "questionnaires_cadrage",
  "questionnaire_questions",
  "emails_suivi",
  "comptes_rendus",
  "faits",
  "fait_evenements",
  "pre_remplissages",
  "alertes_visio",
  "battements_circuit",
  "effacements_journal",
  "appareils_enregistrement",
  "enregistrements",
  "enregistrement_tranches",
  "enregistrement_morceaux",
  "enregistrement_consentements",
  "transcriptions",
  "transcription_segments",
  "compte_rendu_sources",
  "traitements_visio",
] as const;

export const OBJETS_SQL_BRUTS: readonly ObjetSqlBrut[] = [
  // ── Index ──────────────────────────────────────────────────────────────────
  {
    nom: "devis_id_client_id_key",
    type: "index",
    table: "devis",
    role: "cible des clés composées vers un devis (aucune colonne ajoutée à `devis`)",
  },
  {
    nom: "client_contacts_un_contact_facturation",
    type: "index",
    table: "client_contacts",
    role: "un seul contact de facturation par fiche",
  },
  {
    nom: "client_fusions_une_vivante_par_absorbee",
    type: "index",
    table: "client_fusions",
    role: "une seule fusion non défaite par fiche absorbée (refusionner après « Défaire »)",
  },
  {
    nom: "comptes_rendus_un_valide",
    type: "index",
    table: "comptes_rendus",
    role: "un seul compte rendu validé par rencontre",
  },
  {
    nom: "comptes_rendus_un_en_cours",
    type: "index",
    table: "comptes_rendus",
    role: "un seul compte rendu en cours (brouillon ou à valider) par rencontre",
  },
  {
    nom: "transcriptions_une_retenue",
    type: "index",
    table: "transcriptions",
    role: "une seule transcription retenue par enregistrement",
  },
  {
    nom: "enregistrements_un_actif",
    type: "index",
    table: "enregistrements",
    role: "un seul enregistrement actif par rencontre (ETATS_ENREGISTREMENT_ACTIFS)",
  },

  // ── CHECK ──────────────────────────────────────────────────────────────────
  {
    nom: "rencontres_statut_fige_calendly",
    type: "check",
    table: "rencontres",
    role: "le statut reste NULL tant que le lien Calendly vit (il se lit chez Calendly)",
  },
  {
    nom: "rencontres_projet_exige_client",
    type: "check",
    table: "rencontres",
    role: "pas de projet sans client (sinon la clé composée ne vérifie rien)",
  },
  {
    nom: "rencontres_saisie_sur_fiche_validee",
    type: "check",
    table: "rencontres",
    role: "une rencontre saisie naît sur une fiche client existante, validée",
  },
  {
    nom: "rencontres_test_interne_saisie",
    type: "check",
    table: "rencontres",
    role: "une rencontre du pilote est toujours saisie dans la console",
  },
  {
    nom: "rencontre_participants_contact_exige_client",
    type: "check",
    table: "rencontre_participants",
    role: "pas de personne sans client (sinon la clé composée ne vérifie rien)",
  },
  {
    nom: "rencontre_suivis_suite_datee",
    type: "check",
    table: "rencontre_suivis",
    role: "une suite (devis, relance…) porte une échéance",
  },
  {
    nom: "comptes_rendus_a_regenerer_vide",
    type: "check",
    table: "comptes_rendus",
    role: "un contenu effacé ne revient jamais",
  },
  {
    nom: "faits_portee_projet",
    type: "check",
    table: "faits",
    role: "portée « projet » si et seulement si un projet est désigné",
  },
  {
    nom: "faits_projet_exige_client",
    type: "check",
    table: "faits",
    role: "pas de projet sans client (sinon la clé composée ne vérifie rien)",
  },
  {
    nom: "faits_contact_exige_client",
    type: "check",
    table: "faits",
    role: "pas de personne (sujet ou locutrice) sans client",
  },
  {
    nom: "faits_valide_range",
    type: "check",
    table: "faits",
    role: "un fait validé est rangé chez un client",
  },
  {
    nom: "faits_suivi_types_suivables",
    type: "check",
    table: "faits",
    role: "seuls les types suivables portent un suivi (produit depuis TYPES_DE_FAITS)",
  },
  {
    nom: "faits_reponse_a_sa_question",
    type: "check",
    table: "faits",
    role: "un fait de questionnaire a sa question source, et lui seul",
  },

  // ── Clés étrangères composées : « du même client » ────────────────────────
  {
    nom: "projet_contacts_projet_meme_client",
    type: "fk",
    table: "projet_contacts",
    role: "(projet_id, client_id) → projets",
  },
  {
    nom: "projet_contacts_contact_meme_client",
    type: "fk",
    table: "projet_contacts",
    role: "(contact_id, client_id) → client_contacts",
  },
  {
    nom: "projet_devis_projet_meme_client",
    type: "fk",
    table: "projet_devis",
    role: "(projet_id, client_id) → projets",
  },
  {
    nom: "projet_devis_devis_meme_client",
    type: "fk",
    table: "projet_devis",
    role: "(devis_id, client_id) → devis",
  },
  {
    nom: "rencontres_projet_meme_client",
    type: "fk",
    table: "rencontres",
    role: "(projet_id, client_id) → projets",
  },
  {
    nom: "rencontre_participants_contact_meme_client",
    type: "fk",
    table: "rencontre_participants",
    role: "(contact_id, client_id) → client_contacts",
  },
  {
    nom: "questionnaires_cadrage_projet_meme_client",
    type: "fk",
    table: "questionnaires_cadrage",
    role: "(projet_id, client_id) → projets",
  },
  {
    nom: "questionnaires_cadrage_destinataire_meme_client",
    type: "fk",
    table: "questionnaires_cadrage",
    role: "(contact_destinataire_id, client_id) → client_contacts",
  },
  {
    nom: "emails_suivi_contact_meme_client",
    type: "fk",
    table: "emails_suivi",
    role: "(contact_id, client_id) → client_contacts",
  },
  {
    nom: "faits_projet_meme_client",
    type: "fk",
    table: "faits",
    role: "(projet_id, client_id) → projets",
  },
  {
    nom: "faits_contact_sujet_meme_client",
    type: "fk",
    table: "faits",
    role: "(contact_sujet_id, client_id) → client_contacts",
  },
  {
    nom: "faits_contact_locuteur_meme_client",
    type: "fk",
    table: "faits",
    role: "(contact_locuteur_id, client_id) → client_contacts",
  },

  // ── Triggers ───────────────────────────────────────────────────────────────
  {
    nom: "faits_contenu_immuable",
    type: "trigger",
    table: "faits",
    role: "le contenu d'un fait ne se réécrit pas, sauf sous le drapeau d'effacement RGPD",
  },
  {
    nom: "faits_client_de_la_rencontre",
    type: "trigger",
    table: "faits",
    role: "un fait appartient au client de sa rencontre (vérifié en fin de transaction)",
  },
  {
    nom: "rencontres_client_de_ses_faits",
    type: "trigger",
    table: "rencontres",
    role: "déplacer une rencontre sans ses faits est refusé (en fin de transaction)",
  },
  {
    nom: "faits_client_du_questionnaire",
    type: "trigger",
    table: "faits",
    role: "un fait issu d'une réponse appartient au client du questionnaire",
  },
  {
    nom: "fait_evenements_ajout_seul",
    type: "trigger",
    table: "fait_evenements",
    role: "journal en ajout seul",
  },
  {
    nom: "projet_evenements_ajout_seul",
    type: "trigger",
    table: "projet_evenements",
    role: "journal en ajout seul",
  },
  {
    nom: "rencontre_rattachement_evenements_ajout_seul",
    type: "trigger",
    table: "rencontre_rattachement_evenements",
    role: "journal en ajout seul",
  },
  {
    nom: "effacements_journal_ajout_seul",
    type: "trigger",
    table: "effacements_journal",
    role: "journal en ajout seul (rejoué après une restauration)",
  },
  {
    nom: "client_fusion_elements_ajout_seul",
    type: "trigger",
    table: "client_fusion_elements",
    role: "ce qu'une fusion a déplacé ne se réécrit pas",
  },
  {
    nom: "enregistrement_consentements_ajout_seul",
    type: "trigger",
    table: "enregistrement_consentements",
    role: "une preuve d'accord ne se modifie ni ne se supprime (sauf effacement RGPD)",
  },
];

/** Liste SQL `('a', 'b')` d'identifiants simples (lettres, chiffres, soulignés). */
function listeSql(valeurs: readonly string[]): string {
  for (const v of valeurs) {
    if (!/^[a-z0-9_]+$/.test(v)) throw new Error(`valeur non sûre pour du SQL brut : ${v}`);
  }
  return `(${valeurs.map((v) => `'${v}'`).join(", ")})`;
}

/**
 * L'index partiel « un seul enregistrement actif », PRODUIT depuis
 * `ETATS_ENREGISTREMENT_ACTIFS`. La migration doit en contenir le texte exact.
 */
export function sqlIndexEnregistrementsActifs(): string {
  return (
    `CREATE UNIQUE INDEX "enregistrements_un_actif" ON "enregistrements"("rencontre_id") ` +
    `WHERE "statut" IN ${listeSql(ETATS_ENREGISTREMENT_ACTIFS)};`
  );
}

/**
 * Le CHECK « seuls les types suivables portent un suivi », PRODUIT depuis
 * `TYPES_DE_FAITS`. `a_reconfirmer` est admis sur tout type (un fait à
 * reconfirmer au prochain échange, quel qu'il soit).
 */
export function sqlCheckSuivi(): string {
  return (
    `ALTER TABLE "faits" ADD CONSTRAINT "faits_suivi_types_suivables" CHECK ` +
    `("suivi" IS NULL OR "suivi" = 'a_reconfirmer' OR "type" IN ${listeSql(TYPES_SUIVABLES)});`
  );
}
