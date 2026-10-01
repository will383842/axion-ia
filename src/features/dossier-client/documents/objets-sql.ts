/**
 * 🔴 ADR 0063 — LE SQL BRUT DES DOCUMENTS DU PROJET, LISTE UNIQUE
 * (modèle : `src/server/qualiopi/sessions/verrou-dossier-objets-sql.ts`, ADR 0060).
 *
 * Prisma n'exprime ni CHECK, ni trigger, ni clé composée DEFERRABLE : ceux des
 * trois tables `documents_projet*` vivent en SQL brut dans la migration
 * `MIGRATION_DOCUMENTS_PROJET`, invisibles à `prisma migrate diff`. Une
 * migration ultérieure qui les retirerait (ou un `DROP TRIGGER` à la main)
 * rendrait les documents supprimables ou réécrivables SANS QUE RIEN NE
 * ROUGISSE. Cette liste est lue par :
 *   - le test de texte (`__tests__/le-sql-brut-des-documents-est-declare.spec.ts`) :
 *     la migration crée chaque objet, et rien de non déclaré ;
 *   - la garde de dérive (`fautesDeriveDocumentsProjet`), confrontée à
 *     `pg_constraint` / `pg_trigger` sur la base migrée à neuf (Gate D,
 *     `tests/integration/documents-projet/`).
 *
 * ⚠️ Ces tables ne vont PAS dans `TABLES_DU_CHANTIER` de
 * `prisma/objets-sql-bruts.ts` (liée à la migration visio) : registre propre au
 * chantier, comme l'ADR 0060.
 */

export const MIGRATION_DOCUMENTS_PROJET = "20261001120000_documents_projet";

export const TABLES_DOCUMENTS_PROJET = [
  "documents_projet",
  "documents_projet_contenus",
  "documents_projet_ouvertures",
] as const;

type TableDocuments = (typeof TABLES_DOCUMENTS_PROJET)[number];

export interface ObjetSqlDocuments {
  readonly nom: string;
  readonly type: "check" | "trigger" | "fk";
  readonly table: TableDocuments;
  readonly role: string;
}

const D = "documents_projet";
const C = "documents_projet_contenus";
const O = "documents_projet_ouvertures";

export const OBJETS_SQL_DOCUMENTS_PROJET: ReadonlyArray<ObjetSqlDocuments> = [
  {
    nom: "documents_projet_projet_meme_client",
    type: "fk",
    table: D,
    role: "Le projet est du même client (clé composée, RESTRICT / CASCADE, DEFERRABLE).",
  },
  { nom: "documents_projet_titre_non_vide", type: "check", table: D, role: "Titre non vide." },
  {
    nom: "documents_projet_lien_ou_fichier",
    type: "check",
    table: D,
    role: "Exactement un de lien / fichier ; un fichier porte ses cinq colonnes.",
  },
  {
    nom: "documents_projet_lien_https",
    type: "check",
    table: D,
    role: "Lien https, sans identifiants, sans espace ni caractère de contrôle.",
  },
  { nom: "documents_projet_fichier_taille", type: "check", table: D, role: "1 octet à 15 Mo." },
  {
    nom: "documents_projet_fichier_sha256",
    type: "check",
    table: D,
    role: "Empreinte SHA-256 hexadécimale minuscule.",
  },
  {
    nom: "documents_projet_fichier_nom",
    type: "check",
    table: D,
    role: "Nom de fichier non vide, sans séparateur ni caractère de contrôle.",
  },
  {
    nom: "documents_projet_date_envoi",
    type: "check",
    table: D,
    role: "Date d'envoi si et seulement si « envoyé au client ».",
  },
  {
    nom: "documents_projet_archive_coherent",
    type: "check",
    table: D,
    role: "Un auteur d'archivage implique un archivage.",
  },
  {
    nom: "documents_projet_verdict_coherent",
    type: "check",
    table: D,
    role: "Un verdict est daté ; une signature implique « infecté ».",
  },
  {
    nom: "documents_projet_infecte_archive",
    type: "check",
    table: D,
    role: "Un fichier infecté reste archivé.",
  },
  { nom: "documents_projet_contenus_taille", type: "check", table: C, role: "Octets : 1 à 15 Mo." },
  {
    nom: "documents_projet_immuable",
    type: "trigger",
    table: D,
    role: "Ni DELETE, ni réécriture hors archivage, verdict (une fois) et client_id.",
  },
  {
    nom: "documents_projet_contenus_immuable",
    type: "trigger",
    table: C,
    role: "Les octets ne se modifient ni ne se suppriment.",
  },
  { nom: "documents_projet_pas_de_truncate", type: "trigger", table: D, role: "TRUNCATE refusé." },
  {
    nom: "documents_projet_contenus_pas_de_truncate",
    type: "trigger",
    table: C,
    role: "TRUNCATE refusé.",
  },
  {
    nom: "documents_projet_contenu_conforme",
    type: "trigger",
    table: D,
    role: "Au COMMIT : un fichier a son contenu, taille et SHA-256 recalculés égaux ; un lien n'en a pas.",
  },
  {
    nom: "documents_projet_contenus_d_un_fichier",
    type: "trigger",
    table: C,
    role: "Au COMMIT : un contenu n'appartient qu'à un document fichier.",
  },
  {
    nom: "documents_projet_ouvertures_ajout_seul",
    type: "trigger",
    table: O,
    role: "Journal des ouvertures : ni UPDATE ni DELETE, même sous le drapeau d'effacement.",
  },
  {
    nom: "documents_projet_ouvertures_pas_de_truncate",
    type: "trigger",
    table: O,
    role: "TRUNCATE refusé.",
  },
];

export interface ObjetPresent {
  readonly table: string;
  readonly nom: string;
  readonly type: "check" | "trigger" | "fk";
  /** Pour un trigger : `pg_trigger.tgenabled <> 'D'`. */
  readonly actif?: boolean;
}

/**
 * Pure : ce qui manque ou est désactivé, et ce qui existe sur ces tables sans
 * être déclaré. Liste vide = aucune dérive. Les clés étrangères posées par
 * Prisma (`…_fkey`) ne sont pas du SQL brut : ignorées.
 */
export function fautesDeriveDocumentsProjet(presents: ReadonlyArray<ObjetPresent>): string[] {
  const fautes: string[] = [];
  const cle = (o: { table: string; nom: string; type: string }): string =>
    `${o.type}:${o.table}.${o.nom}`;
  const parCle = new Map(presents.map((p) => [cle(p), p]));
  for (const o of OBJETS_SQL_DOCUMENTS_PROJET) {
    const p = parCle.get(cle(o));
    if (p === undefined) fautes.push(`déclaré mais ABSENT en base : ${cle(o)} — ${o.role}`);
    else if (p.actif === false)
      fautes.push(`présent mais DÉSACTIVÉ en base : ${cle(o)} — ${o.role}`);
  }
  const declares = new Set(OBJETS_SQL_DOCUMENTS_PROJET.map(cle));
  const tables = new Set<string>(TABLES_DOCUMENTS_PROJET);
  for (const p of presents) {
    if (!tables.has(p.table)) continue;
    if (p.type === "fk" && p.nom.endsWith("_fkey")) continue;
    if (!declares.has(cle(p))) fautes.push(`présent en base mais NON DÉCLARÉ : ${cle(p)}`);
  }
  return fautes;
}

const LISTE_TABLES = TABLES_DOCUMENTS_PROJET.map((t) => `'${t}'`).join(", ");

/** Requêtes de lecture du catalogue, pour la garde (exécutées par l'appelant). */
export const SQL_TRIGGERS_PRESENTS = `
  SELECT c.relname AS "table", t.tgname AS nom, 'trigger' AS type, t.tgenabled <> 'D' AS actif
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal AND c.relname IN (${LISTE_TABLES})`;

export const SQL_CONTRAINTES_PRESENTES = `
  SELECT c.relname AS "table", k.conname AS nom,
         CASE k.contype WHEN 'c' THEN 'check' ELSE 'fk' END AS type
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND k.contype IN ('c', 'f') AND c.relname IN (${LISTE_TABLES})`;
