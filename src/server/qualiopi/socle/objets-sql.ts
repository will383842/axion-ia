/**
 * 🔴 CHANTIER QNC, LOT L00 — LE SQL BRUT DU SCHÉMA UNIQUE, LISTE UNIQUE
 * (modèle : `src/server/partages/objets-sql.ts`, ADR 0060 / 0063 / 0065).
 *
 * Prisma n'exprime ni CHECK ni trigger : ceux du socle vivent en SQL brut dans
 * `MIGRATION_SOCLE_QNC`, invisibles à `prisma migrate diff`. Une migration
 * ultérieure qui les retirerait rendrait les journaux de preuve RÉÉCRIVABLES
 * sans que rien ne rougisse. Cette liste est lue :
 *   - par le test de texte (`__tests__/le-sql-brut-du-socle-est-declare.spec.ts`) :
 *     la migration crée chaque objet, et rien de non déclaré ;
 *   - par la garde de dérive `fautesDeriveSocleQnc`, confrontée à
 *     `pg_constraint` / `pg_trigger` sur la base migrée à neuf (Gate D,
 *     `tests/integration/verrou-dossier/socle-qnc-ajout-seul.spec.ts`).
 *
 * C'est aussi le CONTRAT DU SCHÉMA pour les seize lots suivants : une table
 * listée dans `TABLES_AJOUT_SEUL` ne reçoit que des INSERT.
 *
 * ⚠️ Registre propre au chantier : rien ici ne va dans `prisma/objets-sql-bruts.ts`
 * (liée à la migration visio).
 */

export const MIGRATION_SOCLE_QNC = "20261016120000_qualiopi_qnc_l00_schema_unique";

/** Les dix journaux en ajout seul : UPDATE, DELETE et TRUNCATE refusés, sans exception. */
export const TABLES_AJOUT_SEUL = [
  "incident_notes",
  "reclamation_etapes",
  "remises_retours",
  "moyens_pedagogiques_historique",
  "sessions_changements_modalite_lieu",
  "relances_journal",
  "actions_amelioration",
  "actions_amelioration_etapes",
  "questionnaire_versions",
  "espace_stagiaire_ouvertures",
] as const;

export type TableAjoutSeul = (typeof TABLES_AJOUT_SEUL)[number];

/**
 * Les tables EXISTANTES qui reçoivent un trigger posé ÉTEINT : il ne refuse
 * que lorsque son interrupteur (table `settings`) vaut `actif`.
 */
export const TRIGGERS_SOUS_INTERRUPTEUR = {
  veilles: "qualiopi.veille.actif",
  revues_direction: "qualiopi.amelioration.actif",
} as const;

type TableSocle = TableAjoutSeul | keyof typeof TRIGGERS_SOUS_INTERRUPTEUR;

export interface ObjetSqlSocle {
  readonly nom: string;
  readonly type: "check" | "trigger";
  readonly table: TableSocle;
  readonly role: string;
}

const AJOUT_SEUL: ReadonlyArray<ObjetSqlSocle> = TABLES_AJOUT_SEUL.flatMap((table) => [
  {
    nom: `${table}_ajout_seul`,
    type: "trigger" as const,
    table,
    role: "UPDATE et DELETE refusés : journal en ajout seul.",
  },
  {
    nom: `${table}_pas_de_truncate`,
    type: "trigger" as const,
    table,
    role: "TRUNCATE refusé.",
  },
]);

export const OBJETS_SQL_SOCLE_QNC: ReadonlyArray<ObjetSqlSocle> = [
  ...AJOUT_SEUL,
  {
    nom: "moyens_pedagogiques_historique_motif",
    type: "check",
    table: "moyens_pedagogiques_historique",
    role: "Un changement de moyen porte un motif d'au moins 10 caractères (btrim).",
  },
  {
    nom: "sessions_changements_modalite_lieu_motif",
    type: "check",
    table: "sessions_changements_modalite_lieu",
    role: "Un changement de modalité ou de lieu porte un motif d'au moins 10 caractères (btrim).",
  },
  {
    nom: "remises_retours_retour_vise_une_remise",
    type: "check",
    table: "remises_retours",
    role: "Une remise ne vise rien ; un retour vise toujours sa remise.",
  },
  {
    nom: "relances_journal_rang_positif",
    type: "check",
    table: "relances_journal",
    role: "Le rang d'une relance commence à 1.",
  },
  {
    nom: "questionnaire_versions_version_positive",
    type: "check",
    table: "questionnaire_versions",
    role: "Les versions d'un questionnaire commencent à 1.",
  },
  {
    nom: "questionnaire_versions_empreinte_sha256",
    type: "check",
    table: "questionnaire_versions",
    role: "L'empreinte est un SHA-256 hexadécimal minuscule (64 caractères).",
  },
  {
    nom: "veilles_ajout_seul",
    type: "trigger",
    table: "veilles",
    role: "ÉTEINT : UPDATE et DELETE refusés seulement si `qualiopi.veille.actif` vaut `actif`.",
  },
  {
    nom: "veilles_pas_de_truncate",
    type: "trigger",
    table: "veilles",
    role: "ÉTEINT : TRUNCATE refusé seulement si `qualiopi.veille.actif` vaut `actif`.",
  },
  {
    nom: "revues_direction_plan_actions_lecture_seule",
    type: "trigger",
    table: "revues_direction",
    role: "ÉTEINT : `plan_actions` figé seulement si `qualiopi.amelioration.actif` vaut `actif`.",
  },
];

/** Les fonctions SQL créées par la migration (lues par le test de texte). */
export const FONCTIONS_SQL_SOCLE_QNC = [
  "qualiopi_ajout_seul",
  "qualiopi_interrupteur_etat",
  "qualiopi_veille_ajout_seul",
  "qualiopi_plan_actions_lecture_seule",
] as const;

export interface ObjetPresentSocle {
  readonly table: string;
  readonly nom: string;
  readonly type: "check" | "trigger" | "fk";
  /** Pour un trigger : `pg_trigger.tgenabled` ('D' = désactivé). */
  readonly actif?: boolean;
}

/**
 * Pure : ce qui manque ou est désactivé, et ce qui existe sur un journal du
 * socle sans être déclaré. Liste vide = aucune dérive. Sur `veilles` et
 * `revues_direction` (tables anciennes), seuls les objets déclarés sont exigés.
 */
export function fautesDeriveSocleQnc(presents: ReadonlyArray<ObjetPresentSocle>): string[] {
  const fautes: string[] = [];
  const cle = (o: { table: string; nom: string; type: string }): string =>
    `${o.type}:${o.table}.${o.nom}`;
  const parCle = new Map(presents.map((p) => [cle(p), p]));
  for (const o of OBJETS_SQL_SOCLE_QNC) {
    const p = parCle.get(cle(o));
    if (p === undefined) fautes.push(`déclaré mais ABSENT en base : ${cle(o)} — ${o.role}`);
    else if (p.actif === false)
      fautes.push(`présent mais DÉSACTIVÉ en base : ${cle(o)} — ${o.role}`);
  }
  const declares = new Set(OBJETS_SQL_SOCLE_QNC.map(cle));
  const tables = new Set<string>(TABLES_AJOUT_SEUL);
  for (const p of presents) {
    if (!tables.has(p.table)) continue;
    if (p.type === "fk" && p.nom.endsWith("_fkey")) continue;
    if (!declares.has(cle(p))) fautes.push(`présent en base mais NON DÉCLARÉ : ${cle(p)}`);
  }
  return fautes;
}

const TABLES_LUES = [...TABLES_AJOUT_SEUL, ...Object.keys(TRIGGERS_SOUS_INTERRUPTEUR)]
  .map((t) => `'${t}'`)
  .join(", ");

/** Requêtes de lecture du catalogue, pour la garde (exécutées par l'appelant). */
export const SQL_PRESENTS_SOCLE_QNC = `
  SELECT c.relname AS "table", t.tgname AS nom, 'trigger' AS type, t.tgenabled <> 'D' AS actif
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal AND c.relname IN (${TABLES_LUES})
  UNION ALL
  SELECT c.relname, k.conname, CASE k.contype WHEN 'c' THEN 'check' ELSE 'fk' END, NULL
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND k.contype IN ('c', 'f') AND c.relname IN (${TABLES_LUES})`;
