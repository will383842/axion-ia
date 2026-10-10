/**
 * 🔴 SCHÉMA N° 1 DU CHANTIER FORMATEURS FREELANCE — LE SQL BRUT, LISTE UNIQUE
 * (modèle : `src/features/dossier-client/documents/objets-sql.ts`, ADR 0063 ;
 * index partiel de l'e-mail : ADR 0067).
 *
 * Prisma 5.22 n'exprime ni CHECK, ni trigger, ni index partiel : ceux du socle
 * vivent en SQL brut dans `MIGRATION_FORMATEURS_SOCLE`, invisibles à
 * `prisma migrate diff`. Une migration ultérieure qui les retirerait rendrait
 * les preuves de vigilance RÉÉCRIVABLES, un IBAN stockable EN CLAIR, ou deux
 * fiches ouvertes possibles sur la même adresse, SANS QUE RIEN NE ROUGISSE.
 * Cette liste est lue :
 *   - par le test de texte (`__tests__/le-sql-brut-du-socle-est-declare.spec.ts`) :
 *     la migration crée chaque objet, et rien de non déclaré ;
 *   - par la garde de dérive `fautesDeriveSocleFormateurs`, confrontée à
 *     `pg_constraint` / `pg_trigger` / `pg_indexes` sur une base migrée à neuf
 *     (`tests/integration/formateurs-socle/`).
 *
 * ⚠️ Registre propre au chantier : ces objets ne vont PAS dans
 * `prisma/objets-sql-bruts.ts` (liée à la migration visio).
 */

export const MIGRATION_FORMATEURS_SOCLE = "20261010150000_formateurs_socle";

/** Tables CRÉÉES par le lot : sur elles, aucun objet non déclaré n'est admis. */
export const TABLES_CREEES_SOCLE = [
  "verifications_registre_sous_traitance",
  "preuves_vigilance",
  "trainer_document_contenus",
  "choix_formateur_session",
] as const;

/** Tables EXISTANTES qui reçoivent un objet du lot (présence vérifiée seule). */
export const TABLES_ETENDUES_SOCLE = [
  "trainers",
  "missions_formateur",
  "trainer_documents",
] as const;

type TableSocle = (typeof TABLES_CREEES_SOCLE)[number] | (typeof TABLES_ETENDUES_SOCLE)[number];

export interface ObjetSqlSocle {
  readonly nom: string;
  readonly type: "check" | "trigger" | "index";
  readonly table: TableSocle;
  readonly role: string;
  /** Pour un index : fragment que `pg_indexes.indexdef` doit contenir (clause partielle). */
  readonly definitionContient?: string;
}

const T = "trainers";
const M = "missions_formateur";
const D = "trainer_documents";
const V = "verifications_registre_sous_traitance";
const P = "preuves_vigilance";
const C = "trainer_document_contenus";
const CH = "choix_formateur_session";

export const OBJETS_SQL_SOCLE_FORMATEURS: ReadonlyArray<ObjetSqlSocle> = [
  // ── trainers ──────────────────────────────────────────────────────────────
  {
    nom: "trainers_activation_coherente",
    type: "check",
    table: T,
    role: "Activation : rien, ou « contrôle » daté ET attribué, ou « antérieure au contrôle » datée sans auteur.",
  },
  {
    nom: "trainers_iban_chiffre_v2",
    type: "check",
    table: T,
    role: "IBAN NULL ou chiffré `enc:v2:` — jamais en clair, jamais en v1 (sans AAD).",
  },
  {
    nom: "trainers_iban_empreinte_coherente",
    type: "check",
    table: T,
    role: "Empreinte présente si et seulement si l'IBAN l'est ; 64 hexadécimaux minuscules.",
  },
  {
    nom: "trainers_acces_version_positive",
    type: "check",
    table: T,
    role: "Version d'accès ≥ 0.",
  },
  {
    nom: "trainers_fin_collaboration_coherente",
    type: "check",
    table: T,
    role: "Une fin de collaboration est datée ET motivée, ou n'existe pas.",
  },
  {
    nom: "trainers_geo_coherente",
    type: "check",
    table: T,
    role: "Latitude et longitude vont ensemble, dans leurs bornes.",
  },
  {
    nom: "trainers_email_hash_hex",
    type: "check",
    table: T,
    role: "Empreinte d'e-mail : 64 hexadécimaux minuscules.",
  },
  {
    nom: "trainers_email_ouverte_unique",
    type: "index",
    table: T,
    role: "ADR 0067 : une seule fiche OUVERTE par adresse (expand ; l'unique global reste).",
    definitionContient: "WHERE (fin_collaboration_at IS NULL)",
  },
  {
    nom: "trainers_candidature_unique",
    type: "index",
    table: T,
    role: "Une candidature n'ouvre qu'une fiche.",
    definitionContient: "WHERE (candidature_id IS NOT NULL)",
  },
  // ── missions_formateur ────────────────────────────────────────────────────
  {
    nom: "missions_formateur_montants_positifs",
    type: "check",
    table: M,
    role: "Tarif et forfait de déplacement : centimes ≥ 0.",
  },
  {
    nom: "missions_formateur_desistement_coherent",
    type: "check",
    table: M,
    role: "Un motif de désistement implique une date de désistement.",
  },
  {
    nom: "missions_formateur_blocage_coherent",
    type: "check",
    table: M,
    role: "Un blocage notifié porte son motif.",
  },
  // ── trainer_documents ─────────────────────────────────────────────────────
  {
    nom: "trainer_documents_archive_coherent",
    type: "check",
    table: D,
    role: "Un auteur ou un motif d'archivage implique un archivage daté.",
  },
  // ── verifications_registre_sous_traitance (ajout seul) ────────────────────
  {
    nom: "verifications_registre_sous_traitance_sha256_hex",
    type: "check",
    table: V,
    role: "Empreinte de la réponse source : 64 hexadécimaux minuscules.",
  },
  {
    nom: "verifications_registre_sous_traitance_ajout_seul",
    type: "trigger",
    table: V,
    role: "Preuve horodatée : ni UPDATE ni DELETE.",
  },
  {
    nom: "verifications_registre_sous_traitance_pas_de_truncate",
    type: "trigger",
    table: V,
    role: "TRUNCATE refusé.",
  },
  // ── preuves_vigilance (ajout seul) ────────────────────────────────────────
  {
    nom: "preuves_vigilance_sha256_hex",
    type: "check",
    table: P,
    role: "Empreinte de la pièce : 64 hexadécimaux minuscules.",
  },
  {
    nom: "preuves_vigilance_ajout_seul",
    type: "trigger",
    table: P,
    role: "Preuve de vigilance (L.8222-1) : ni UPDATE ni DELETE.",
  },
  {
    nom: "preuves_vigilance_pas_de_truncate",
    type: "trigger",
    table: P,
    role: "TRUNCATE refusé.",
  },
  // ── trainer_document_contenus ─────────────────────────────────────────────
  {
    nom: "trainer_document_contenus_taille",
    type: "check",
    table: C,
    role: "Taille déclarée = longueur des octets, 1 octet à 20 Mo.",
  },
  {
    nom: "trainer_document_contenus_sha256_hex",
    type: "check",
    table: C,
    role: "Empreinte des octets clairs : 64 hexadécimaux minuscules.",
  },
  // ── choix_formateur_session ───────────────────────────────────────────────
  {
    nom: "choix_formateur_session_rang_positif",
    type: "check",
    table: CH,
    role: "Rang ≥ 1.",
  },
  {
    nom: "choix_formateur_session_montants_positifs",
    type: "check",
    table: CH,
    role: "Tarif et forfait de déplacement : centimes ≥ 0.",
  },
  {
    nom: "choix_formateur_session_saut_coherent",
    type: "check",
    table: CH,
    role: "Un motif de saut implique une date de saut.",
  },
];

export interface ObjetPresentSocle {
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
 * existe sur les tables CRÉÉES par le lot sans être déclaré. Liste vide =
 * aucune dérive. Les objets que Prisma génère (`_pkey`, `_key`, `_idx`,
 * `_fkey`) ne sont pas du SQL brut : ignorés.
 */
export function fautesDeriveSocleFormateurs(presents: ReadonlyArray<ObjetPresentSocle>): string[] {
  const fautes: string[] = [];
  const cle = (o: { table: string; nom: string; type: string }): string =>
    `${o.type}:${o.table}.${o.nom}`;
  const parCle = new Map(presents.map((p) => [cle(p), p]));
  for (const o of OBJETS_SQL_SOCLE_FORMATEURS) {
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
  const declares = new Set(OBJETS_SQL_SOCLE_FORMATEURS.map(cle));
  const creees = new Set<string>(TABLES_CREEES_SOCLE);
  for (const p of presents) {
    if (!creees.has(p.table)) continue;
    if (p.type !== "check" && p.type !== "trigger" && GENERE_PAR_PRISMA.test(p.nom)) continue;
    if (!declares.has(cle(p))) fautes.push(`présent en base mais NON DÉCLARÉ : ${cle(p)}`);
  }
  return fautes;
}

const LISTE_TABLES = [...TABLES_CREEES_SOCLE, ...TABLES_ETENDUES_SOCLE]
  .map((t) => `'${t}'`)
  .join(", ");

/** Lectures du catalogue, pour la garde (exécutées par l'appelant). */
export const SQL_TRIGGERS_PRESENTS_SOCLE = `
  SELECT c.relname AS "table", t.tgname AS nom, 'trigger' AS type, t.tgenabled <> 'D' AS actif
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal AND c.relname IN (${LISTE_TABLES})`;

export const SQL_CONTRAINTES_PRESENTES_SOCLE = `
  SELECT c.relname AS "table", k.conname AS nom,
         CASE k.contype WHEN 'c' THEN 'check' ELSE 'fk' END AS type
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND k.contype IN ('c', 'f') AND c.relname IN (${LISTE_TABLES})`;

export const SQL_INDEX_PRESENTS_SOCLE = `
  SELECT tablename AS "table", indexname AS nom, 'index' AS type, indexdef AS definition
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename IN (${LISTE_TABLES})`;

/**
 * Le marquage du stock : tout formateur ACTIF au moment de la migration a été
 * activé AVANT le contrôle (ADR 0066 étape 8). Date = celle de la migration,
 * aucun auteur : ce n'est pas une validation, c'est un constat. Texte exact de
 * la migration (vérifié par le test de texte, rejoué par le test d'intégration).
 */
export const SQL_STOCK_ACTIF_ANTERIEUR_AU_CONTROLE =
  `UPDATE "trainers" SET "activation_validee_source" = 'anterieure_au_controle', ` +
  `"activation_validee_at" = now() WHERE "actif" = true`;
