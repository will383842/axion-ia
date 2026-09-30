/**
 * 🔴 ADR 0060 — LE SQL BRUT DU VERROU DU DOSSIER, LISTE UNIQUE.
 *
 * Prisma n'exprime ni CHECK ni trigger : ceux de `session_dossier_evenements`
 * vivent en SQL brut dans la migration `MIGRATION_VERROU_DOSSIER`, invisibles
 * à `prisma migrate diff`. Une migration ultérieure qui les retirerait (ou un
 * `DROP TRIGGER` à la main) rendrait le journal des réouvertures modifiable
 * SANS QUE RIEN NE ROUGISSE. Cette liste est lue par :
 *   - la garde de dérive (`fautesDeriveVerrouDossier`), confrontée à
 *     `pg_trigger` et `pg_constraint` sur la base migrée à neuf (Gate D) ;
 *   - le test de texte, qui vérifie que la migration crée chaque objet.
 */

export const MIGRATION_VERROU_DOSSIER = "20260930150000_session_dossier_verrou";

export const TABLE_EVENEMENTS_DOSSIER = "session_dossier_evenements";

export interface ObjetSqlVerrou {
  readonly nom: string;
  readonly type: "check" | "trigger";
  readonly table: string;
  readonly role: string;
}

export const OBJETS_SQL_VERROU_DOSSIER: ReadonlyArray<ObjetSqlVerrou> = [
  {
    nom: "session_dossier_evenements_motif_reouverture",
    type: "check",
    table: TABLE_EVENEMENTS_DOSSIER,
    role: "Une réouverture porte un motif d'au moins 10 caractères (btrim).",
  },
  {
    nom: "session_dossier_evenements_ajout_seul",
    type: "trigger",
    table: TABLE_EVENEMENTS_DOSSIER,
    role: "UPDATE et DELETE refusés : le journal des réouvertures est en ajout seul.",
  },
  {
    nom: "session_dossier_evenements_pas_de_truncate",
    type: "trigger",
    table: TABLE_EVENEMENTS_DOSSIER,
    role: "TRUNCATE refusé.",
  },
];

export interface ObjetPresent {
  readonly table: string;
  readonly nom: string;
  readonly type: "check" | "trigger" | "fk";
  /** Pour un trigger : `pg_trigger.tgenabled` ('D' = désactivé). */
  readonly actif?: boolean;
}

/**
 * Pure : ce qui manque ou est désactivé, et ce qui existe sur la table sans
 * être déclaré. Liste vide = aucune dérive.
 */
export function fautesDeriveVerrouDossier(presents: ReadonlyArray<ObjetPresent>): string[] {
  const fautes: string[] = [];
  const cle = (o: { table: string; nom: string; type: string }): string =>
    `${o.type}:${o.table}.${o.nom}`;
  const parCle = new Map(presents.map((p) => [cle(p), p]));
  for (const o of OBJETS_SQL_VERROU_DOSSIER) {
    const p = parCle.get(cle(o));
    if (p === undefined) fautes.push(`déclaré mais ABSENT en base : ${cle(o)} — ${o.role}`);
    else if (p.actif === false)
      fautes.push(`présent mais DÉSACTIVÉ en base : ${cle(o)} — ${o.role}`);
  }
  const declares = new Set(OBJETS_SQL_VERROU_DOSSIER.map(cle));
  for (const p of presents) {
    if (p.table !== TABLE_EVENEMENTS_DOSSIER || p.type === "fk") continue;
    if (!declares.has(cle(p))) fautes.push(`présent en base mais NON DÉCLARÉ : ${cle(p)}`);
  }
  return fautes;
}

/** Requêtes de lecture du catalogue, pour la garde (exécutées par l'appelant). */
export const SQL_TRIGGERS_PRESENTS = `
  SELECT c.relname AS "table", t.tgname AS nom, t.tgenabled <> 'D' AS actif
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal AND c.relname = '${TABLE_EVENEMENTS_DOSSIER}'`;

export const SQL_CHECKS_PRESENTS = `
  SELECT c.relname AS "table", k.conname AS nom
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND k.contype = 'c' AND c.relname = '${TABLE_EVENEMENTS_DOSSIER}'`;
