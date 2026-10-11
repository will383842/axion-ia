/**
 * 🔴 SCHÉMA N° 2 DU CHANTIER FORMATEURS FREELANCE — LE SQL BRUT, LISTE UNIQUE
 * (lots M-C « expand », M-E, M-F ; modèle : `socle-objets-sql.ts`, schéma n° 1).
 *
 * Prisma 5.22 n'exprime ni CHECK, ni trigger, ni index partiel. Ceux du paiement
 * par mission vivent en SQL brut dans `MIGRATION_FORMATEURS_PAIEMENT`, invisibles
 * à `prisma migrate diff`. Une migration ultérieure qui les retirerait rendrait
 * possible un DOUBLE PAIEMENT (deux relevés de mission pour la même session et
 * le même mois, deux indemnités d'annulation), une revendication RÉÉCRIVABLE, ou
 * un IBAN demandé stocké EN CLAIR — sans que rien ne rougisse. Cette liste est lue :
 *   - par le test de texte (`__tests__/le-sql-brut-du-paiement-est-declare.spec.ts`) :
 *     la migration crée chaque objet, avec le texte EXACT des index ci-dessous ;
 *   - par la garde de dérive `fautesDerivePaiementFormateurs`, confrontée à
 *     `pg_constraint` / `pg_trigger` / `pg_indexes` sur une base migrée à neuf
 *     (`tests/integration/formateurs-paiement/`).
 *
 * 🔑 Les index partiels des relevés ne portent QUE sur `origine = 'passage_mission'`
 * (sauf le mensuel, déjà couvert plus fort par l'unique historique) : aucune ligne
 * existante ne peut donc faire échouer leur création en production, et le run
 * mensuel n'en voit aucun.
 *
 * ⚠️ M-D (« contract ») n'est PAS ici : `statement_unique_trainer_periode` reste
 * en base. C'est un DROP, laissé pour plus tard (paiement par mission coupé d'ici là).
 */

import { StatementStatut } from "../../../../prisma/generated/client";

export const MIGRATION_FORMATEURS_PAIEMENT = "20261011130000_formateurs_paiement";

/**
 * Le seul statut qui LIBÈRE une place : un relevé annulé ne compte plus dans les
 * unicités (une réémission après avoir prend sa place). Tous les autres OCCUPENT.
 */
export const STATUT_RELEVE_LIBERE = "annule" as const satisfies StatementStatut;

/** Dérivés de l'énumération Prisma : un statut ajouté demain occupe d'office. */
export const STATUTS_RELEVE_OCCUPANTS: ReadonlyArray<StatementStatut> = Object.values(
  StatementStatut,
).filter((s) => s !== STATUT_RELEVE_LIBERE);

/** Clause d'occupation, commune au code et au SQL (relevés ET lignes). */
const OCCUPE = `"statut" <> '${STATUT_RELEVE_LIBERE}'`;
const MISSION = `"origine" = 'passage_mission'`;

/** Objets de ligne comptés par l'unicité (session, objet, mois). */
export const OBJETS_LIGNE_PAR_MOIS = ["animation", "deplacement"] as const;
/** Objets de ligne uniques PAR RELEVÉ (un retard = une pénalité, une indemnité de 40 €). */
export const OBJETS_LIGNE_PAR_RELEVE = ["penalites_retard", "indemnite_recouvrement"] as const;

const liste = (xs: ReadonlyArray<string>): string => xs.map((x) => `'${x}'`).join(", ");

/** Texte EXACT de chaque index partiel, recopié tel quel dans la migration. */
export const SQL_INDEX_PAIEMENT = {
  trainer_statements_mission_unique:
    `CREATE UNIQUE INDEX "trainer_statements_mission_unique" ON "trainer_statements" ` +
    `("trainer_id", "session_id", "periode_year", "periode_month") ` +
    `WHERE ${MISSION} AND "session_id" IS NOT NULL AND "organisme_sous_traitant_id" IS NULL ` +
    `AND "avoir_de_id" IS NULL AND ${OCCUPE};`,
  trainer_statements_mission_organisme_unique:
    `CREATE UNIQUE INDEX "trainer_statements_mission_organisme_unique" ON "trainer_statements" ` +
    `("organisme_sous_traitant_id", "session_id", "periode_year", "periode_month") ` +
    `WHERE ${MISSION} AND "session_id" IS NOT NULL AND "organisme_sous_traitant_id" IS NOT NULL ` +
    `AND "avoir_de_id" IS NULL AND ${OCCUPE};`,
  trainer_statements_mensuel_unique:
    `CREATE UNIQUE INDEX "trainer_statements_mensuel_unique" ON "trainer_statements" ` +
    `("trainer_id", "periode_year", "periode_month") ` +
    `WHERE "origine" = 'releve_mensuel' AND ${OCCUPE};`,
  trainer_statements_hors_mission_unique:
    `CREATE UNIQUE INDEX "trainer_statements_hors_mission_unique" ON "trainer_statements" ` +
    `("trainer_id", "periode_year", "periode_month") ` +
    `WHERE ${MISSION} AND "session_id" IS NULL AND "avoir_de_id" IS NULL AND ${OCCUPE};`,
  trainer_statements_avoir_unique:
    `CREATE UNIQUE INDEX "trainer_statements_avoir_unique" ON "trainer_statements" ` +
    `("avoir_de_id") WHERE "avoir_de_id" IS NOT NULL AND ${OCCUPE};`,
  trainer_statements_remplacement_unique:
    `CREATE UNIQUE INDEX "trainer_statements_remplacement_unique" ON "trainer_statements" ` +
    `("remplace_id") WHERE "remplace_id" IS NOT NULL AND ${OCCUPE};`,
  trainer_statements_facture_emetteur_unique:
    `CREATE UNIQUE INDEX "trainer_statements_facture_emetteur_unique" ON "trainer_statements" ` +
    `(COALESCE("organisme_sous_traitant_id", "trainer_id"), upper(btrim("numero_facture"))) ` +
    `WHERE ${MISSION} AND "autofacture_at" IS NULL AND "numero_facture" IS NOT NULL AND ${OCCUPE};`,
  trainer_fee_lines_mission_unique:
    `CREATE UNIQUE INDEX "trainer_fee_lines_mission_unique" ON "trainer_fee_lines" ` +
    `("trainer_id", "session_id", "objet", "periode_year", "periode_month") ` +
    `WHERE ${MISSION} AND "session_id" IS NOT NULL ` +
    `AND "objet" IN (${liste(OBJETS_LIGNE_PAR_MOIS)}) AND ${OCCUPE};`,
  trainer_fee_lines_indemnite_annulation_unique:
    `CREATE UNIQUE INDEX "trainer_fee_lines_indemnite_annulation_unique" ON "trainer_fee_lines" ` +
    `("trainer_id", "session_id") ` +
    `WHERE ${MISSION} AND "objet" = 'indemnite_annulation' AND ${OCCUPE};`,
  trainer_fee_lines_presentation_methode_unique:
    `CREATE UNIQUE INDEX "trainer_fee_lines_presentation_methode_unique" ON "trainer_fee_lines" ` +
    `("trainer_id") WHERE "objet" = 'presentation_methode' AND ${OCCUPE};`,
  trainer_fee_lines_retard_unique:
    `CREATE UNIQUE INDEX "trainer_fee_lines_retard_unique" ON "trainer_fee_lines" ` +
    `("statement_id", "objet") ` +
    `WHERE "objet" IN (${liste(OBJETS_LIGNE_PAR_RELEVE)}) AND ${OCCUPE};`,
  trainer_fee_lines_imputation_unique:
    `CREATE UNIQUE INDEX "trainer_fee_lines_imputation_unique" ON "trainer_fee_lines" ` +
    `("impute_de_statement_id", "statement_id") ` +
    `WHERE "impute_de_statement_id" IS NOT NULL AND ${OCCUPE};`,
  demandes_changement_formateur_une_en_attente:
    `CREATE UNIQUE INDEX "demandes_changement_formateur_une_en_attente" ON "demandes_changement_formateur" ` +
    `("trainer_id", "nature") WHERE "statut" = 'en_attente';`,
} as const;

export type NomIndexPaiement = keyof typeof SQL_INDEX_PAIEMENT;

/**
 * Le remplissage du stock (ADR 0066 v2 (e), 09-RELECTURE-ARGENT point 1) : toute
 * (formateur INDÉPENDANT, session) portée par une ligne mensuelle NON ANNULÉE,
 * QUEL QUE SOIT LE STATUT DU RELEVÉ (brouillon compris), appartient au relevé
 * mensuel. Insertion seule, rejouable. Texte exact de la migration.
 */
export const SQL_REVENDIQUER_STOCK_MENSUEL =
  `INSERT INTO "revendications_paiement" ("id", "trainer_id", "session_id", "regime", "source") ` +
  `SELECT gen_random_uuid(), l."trainer_id", l."session_id", 'releve_mensuel', 'stock_migration' ` +
  `FROM (SELECT DISTINCT fl."trainer_id", fl."session_id" FROM "trainer_fee_lines" fl ` +
  `JOIN "trainers" t ON t."id" = fl."trainer_id" ` +
  `WHERE t."statut" = 'sous_traitant' AND fl."session_id" IS NOT NULL ` +
  `AND fl."statut" <> 'annule' AND fl."origine" = 'releve_mensuel') l ` +
  `ON CONFLICT ("trainer_id", "session_id") DO NOTHING;`;

/** Tables CRÉÉES par le lot : sur elles, aucun objet non déclaré n'est admis. */
export const TABLES_CREEES_PAIEMENT = [
  "revendications_paiement",
  "demandes_changement_formateur",
  "pieces_organismes",
  "pieces_organismes_contenus",
  "commissions_motif_nul",
] as const;

/** Tables EXISTANTES qui reçoivent un objet du lot (présence vérifiée seule). */
export const TABLES_ETENDUES_PAIEMENT = ["trainer_statements", "trainer_fee_lines"] as const;

type TablePaiement =
  (typeof TABLES_CREEES_PAIEMENT)[number] | (typeof TABLES_ETENDUES_PAIEMENT)[number];

export interface ObjetSqlPaiement {
  readonly nom: string;
  readonly type: "check" | "trigger" | "index";
  readonly table: TablePaiement;
  readonly role: string;
  /** Pour un index : fragment que `pg_indexes.indexdef` doit contenir (clause partielle). */
  readonly definitionContient?: string;
}

const S = "trainer_statements";
const L = "trainer_fee_lines";
const R = "revendications_paiement";
const D = "demandes_changement_formateur";
const P = "pieces_organismes";
const PC = "pieces_organismes_contenus";
const CM = "commissions_motif_nul";

const index = (
  nom: NomIndexPaiement,
  table: TablePaiement,
  role: string,
  definitionContient: string,
): ObjetSqlPaiement => ({ nom, type: "index", table, role, definitionContient });

export const OBJETS_SQL_PAIEMENT_FORMATEURS: ReadonlyArray<ObjetSqlPaiement> = [
  // ── trainer_statements ────────────────────────────────────────────────────
  {
    nom: "trainer_statements_origine_coherente",
    type: "check",
    table: S,
    role: "Un relevé MENSUEL ne porte ni session ni organisme (ils n'appartiennent qu'au paiement par mission).",
  },
  {
    nom: "trainer_statements_iban_preuve_coherente",
    type: "check",
    table: S,
    role: "Preuve du compte payé : 4 derniers caractères ET empreinte (64 hexadécimaux), ensemble ou pas du tout.",
  },
  {
    nom: "trainer_statements_pas_soi_meme",
    type: "check",
    table: S,
    role: "Un relevé n'est ni l'avoir, ni le remplaçant de lui-même.",
  },
  {
    nom: "trainer_statements_sur_constat_coherent",
    type: "check",
    table: S,
    role: "« Payer sur constat » : date, auteur et motif ensemble, ou rien.",
  },
  index(
    "trainer_statements_mission_unique",
    S,
    "Un seul relevé de mission vivant par (formateur, session, mois) : pas de double paiement.",
    "'passage_mission'",
  ),
  index(
    "trainer_statements_mission_organisme_unique",
    S,
    "Décision 88 : un seul relevé vivant par (organisme, session, mois).",
    "organisme_sous_traitant_id IS NOT NULL",
  ),
  index(
    "trainer_statements_mensuel_unique",
    S,
    "Un seul relevé mensuel vivant par (formateur, mois) — survit au futur retrait de l'unique historique (M-D).",
    "'releve_mensuel'",
  ),
  index(
    "trainer_statements_hors_mission_unique",
    S,
    "Un seul relevé « hors mission » vivant par (formateur, mois).",
    "session_id IS NULL",
  ),
  index(
    "trainer_statements_avoir_unique",
    S,
    "Une pièce n'a qu'un avoir.",
    "avoir_de_id IS NOT NULL",
  ),
  index(
    "trainer_statements_remplacement_unique",
    S,
    "Une pièce n'est remplacée (réémise) qu'une fois.",
    "remplace_id IS NOT NULL",
  ),
  index(
    "trainer_statements_facture_emetteur_unique",
    S,
    "Une facture reçue ne se saisit pas deux fois : numéro unique par émetteur (organisme ou formateur), casse et espaces ignorés.",
    "autofacture_at IS NULL",
  ),
  // ── trainer_fee_lines ─────────────────────────────────────────────────────
  {
    nom: "trainer_fee_lines_objet_mission",
    type: "check",
    table: L,
    role: "Une ligne du paiement par mission dit ce qu'elle paie (`objet` obligatoire).",
  },
  {
    nom: "trainer_fee_lines_annule_motif_coherent",
    type: "check",
    table: L,
    role: "Un motif d'annulation n'existe que sur une ligne annulée.",
  },
  {
    nom: "trainer_fee_lines_retard_sur_releve",
    type: "check",
    table: L,
    role: "Une pénalité de retard ou l'indemnité de 40 € est toujours portée par un relevé.",
  },
  {
    nom: "trainer_fee_lines_quantites_positives",
    type: "check",
    table: L,
    role: "Demi-journées et journées de déplacement : entiers ≥ 0.",
  },
  index(
    "trainer_fee_lines_mission_unique",
    L,
    "Une seule ligne vivante d'animation (et de déplacement) par (formateur, session, mois).",
    "'passage_mission'",
  ),
  index(
    "trainer_fee_lines_indemnite_annulation_unique",
    L,
    "Une seule indemnité d'annulation vivante par (formateur, session), SANS le mois (§2.7 règle 4).",
    "'indemnite_annulation'",
  ),
  index(
    "trainer_fee_lines_presentation_methode_unique",
    L,
    "Une seule présentation de la méthode payée par formateur.",
    "'presentation_methode'",
  ),
  index(
    "trainer_fee_lines_retard_unique",
    L,
    "Une pénalité de retard et une indemnité de recouvrement au plus par relevé.",
    "'penalites_retard'",
  ),
  index(
    "trainer_fee_lines_imputation_unique",
    L,
    "Un avoir n'est imputé qu'une fois sur un même relevé.",
    "impute_de_statement_id IS NOT NULL",
  ),
  // ── revendications_paiement (ajout seul) ──────────────────────────────────
  {
    nom: "revendications_paiement_ajout_seul",
    type: "trigger",
    table: R,
    role: "Propriétaire du paiement : ni UPDATE ni DELETE (le premier inscrit est le seul).",
  },
  {
    nom: "revendications_paiement_pas_de_truncate",
    type: "trigger",
    table: R,
    role: "TRUNCATE refusé.",
  },
  // ── demandes_changement_formateur ─────────────────────────────────────────
  {
    nom: "demandes_changement_formateur_iban_chiffre",
    type: "check",
    table: D,
    role: "IBAN demandé : format complet `enc:v2:iv:chiffré:tag` avec son empreinte — jamais en clair.",
  },
  {
    nom: "demandes_changement_formateur_empreinte_hex",
    type: "check",
    table: D,
    role: "Empreinte : 64 hexadécimaux minuscules.",
  },
  {
    nom: "demandes_changement_formateur_traitement_coherent",
    type: "check",
    table: D,
    role: "En attente ⇔ non traitée ; une demande traitée est datée ; un refus est motivé.",
  },
  index(
    "demandes_changement_formateur_une_en_attente",
    D,
    "Une seule demande en attente par (formateur, nature).",
    "'en_attente'",
  ),
  // ── pieces_organismes ─────────────────────────────────────────────────────
  {
    nom: "pieces_organismes_validation_coherente",
    type: "check",
    table: P,
    role: "Une pièce rejetée porte son motif.",
  },
  // ── pieces_organismes_contenus ────────────────────────────────────────────
  {
    nom: "pieces_organismes_contenus_taille",
    type: "check",
    table: PC,
    role: "Taille déclarée = longueur des octets, 1 octet à 20 Mo.",
  },
  {
    nom: "pieces_organismes_contenus_sha256_hex",
    type: "check",
    table: PC,
    role: "Empreinte des octets clairs : 64 hexadécimaux minuscules.",
  },
  // ── commissions_motif_nul ─────────────────────────────────────────────────
  {
    nom: "commissions_motif_nul_siren",
    type: "check",
    table: CM,
    role: "SIREN : 9 chiffres.",
  },
];

export interface ObjetPresentPaiement {
  readonly table: string;
  readonly nom: string;
  readonly type: "check" | "trigger" | "index" | "fk";
  /** Pour un trigger : `pg_trigger.tgenabled <> 'D'`. */
  readonly actif?: boolean;
  /** Pour un index : `pg_indexes.indexdef`. */
  readonly definition?: string;
}

const GENERE_PAR_PRISMA = /_(pkey|key|idx|fkey)$/;

/**
 * Pure : ce qui manque, est désactivé ou a perdu sa clause partielle, et ce qui
 * existe sur les tables CRÉÉES par le lot sans être déclaré. Liste vide = aucune
 * dérive. Les objets que Prisma génère (`_pkey`, `_key`, `_idx`, `_fkey`) sont
 * ignorés.
 */
export function fautesDerivePaiementFormateurs(
  presents: ReadonlyArray<ObjetPresentPaiement>,
): string[] {
  const fautes: string[] = [];
  const cle = (o: { table: string; nom: string; type: string }): string =>
    `${o.type}:${o.table}.${o.nom}`;
  const parCle = new Map(presents.map((p) => [cle(p), p]));
  for (const o of OBJETS_SQL_PAIEMENT_FORMATEURS) {
    const p = parCle.get(cle(o));
    if (p === undefined) {
      fautes.push(`déclaré mais ABSENT en base : ${cle(o)} — ${o.role}`);
      continue;
    }
    if (p.actif === false) fautes.push(`présent mais DÉSACTIVÉ en base : ${cle(o)} — ${o.role}`);
    if (o.definitionContient && !(p.definition ?? "").includes(o.definitionContient)) {
      fautes.push(
        `index présent mais SANS sa clause « ${o.definitionContient} » : ${cle(o)} — lu : ${p.definition ?? "?"}`,
      );
    }
  }
  const declares = new Set(OBJETS_SQL_PAIEMENT_FORMATEURS.map(cle));
  const creees = new Set<string>(TABLES_CREEES_PAIEMENT);
  for (const p of presents) {
    if (!creees.has(p.table)) continue;
    if (p.type !== "check" && p.type !== "trigger" && GENERE_PAR_PRISMA.test(p.nom)) continue;
    if (!declares.has(cle(p))) fautes.push(`présent en base mais NON DÉCLARÉ : ${cle(p)}`);
  }
  return fautes;
}

const LISTE_TABLES = [...TABLES_CREEES_PAIEMENT, ...TABLES_ETENDUES_PAIEMENT]
  .map((t) => `'${t}'`)
  .join(", ");

/** Lectures du catalogue, pour la garde (exécutées par l'appelant). */
export const SQL_TRIGGERS_PRESENTS_PAIEMENT = `
  SELECT c.relname AS "table", t.tgname AS nom, 'trigger' AS type, t.tgenabled <> 'D' AS actif
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal AND c.relname IN (${LISTE_TABLES})`;

export const SQL_CONTRAINTES_PRESENTES_PAIEMENT = `
  SELECT c.relname AS "table", k.conname AS nom,
         CASE k.contype WHEN 'c' THEN 'check' ELSE 'fk' END AS type
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND k.contype IN ('c', 'f') AND c.relname IN (${LISTE_TABLES})`;

export const SQL_INDEX_PRESENTS_PAIEMENT = `
  SELECT tablename AS "table", indexname AS nom, 'index' AS type, indexdef AS definition
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename IN (${LISTE_TABLES})`;
