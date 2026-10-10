/**
 * 🔴 ADR 0065 — LE SQL BRUT DES FICHIERS PARTAGÉS, LISTE UNIQUE
 * (modèle : `src/features/dossier-client/documents/objets-sql.ts`, ADR 0060 / 0063).
 *
 * Prisma n'exprime ni CHECK ni trigger : ceux des quatre tables du lot L4
 * vivent en SQL brut dans `MIGRATION_PARTAGES`, invisibles à `prisma migrate
 * diff`. Une migration ultérieure qui les retirerait rendrait les fichiers
 * SUPPRIMABLES ou réécrivables sans que rien ne rougisse. Cette liste est lue :
 *   - par le test de texte (`__tests__/le-sql-brut-des-partages-est-declare.spec.ts`) :
 *     la migration crée chaque objet, et rien de non déclaré ;
 *   - par la garde de dérive `fautesDerivePartages`, à confronter à
 *     `pg_constraint` / `pg_trigger` sur une base migrée à neuf (Gate D).
 *
 * ⚠️ Registre propre au chantier : ces tables ne vont PAS dans
 * `prisma/objets-sql-bruts.ts` (liée à la migration visio).
 */

export const MIGRATION_PARTAGES = "20261010100100_fichiers_partages";

export const TABLES_PARTAGES = [
  "fichiers_partages",
  "liens_partage",
  "liens_partage_fichiers",
  "liens_partage_acces",
] as const;

type TablePartages = (typeof TABLES_PARTAGES)[number];

export interface ObjetSqlPartages {
  readonly nom: string;
  readonly type: "check" | "trigger";
  readonly table: TablePartages;
  readonly role: string;
}

const F = "fichiers_partages";
const L = "liens_partage";
const LF = "liens_partage_fichiers";
const A = "liens_partage_acces";

export const OBJETS_SQL_PARTAGES: ReadonlyArray<ObjetSqlPartages> = [
  { nom: "fichiers_partages_titre_non_vide", type: "check", table: F, role: "Titre non vide." },
  {
    nom: "fichiers_partages_nature_coherente",
    type: "check",
    table: F,
    role: "Un fichier R2 porte clé, nom, taille, analyse ; un lien externe porte son URL seule.",
  },
  {
    nom: "fichiers_partages_url_https",
    type: "check",
    table: F,
    role: "Lien externe https, sans identifiants, sans espace ni caractère de contrôle.",
  },
  {
    nom: "fichiers_partages_r2_cle_prefixe",
    type: "check",
    table: F,
    role: "Clé R2 `partages/<id de la ligne>/<nom ascii>` : jamais hors du préfixe.",
  },
  {
    nom: "fichiers_partages_taille",
    type: "check",
    table: F,
    role: "1 octet à 20 Gio (équipe), 4 Gio (personne).",
  },
  {
    nom: "fichiers_partages_nom_fichier",
    type: "check",
    table: F,
    role: "Nom non vide, sans séparateur ni caractère de contrôle.",
  },
  {
    nom: "fichiers_partages_origine_personne",
    type: "check",
    table: F,
    role: "Un fichier renvoyé par une personne vient d'un lien, et seulement lui.",
  },
  {
    nom: "fichiers_partages_depot_coherent",
    type: "check",
    table: F,
    role: "Un envoi en cours a son identifiant R2 ; une date de mise à disposition seulement si disponible.",
  },
  {
    nom: "fichiers_partages_verdict_coherent",
    type: "check",
    table: F,
    role: "Un verdict est daté ; une signature implique « infecté ».",
  },
  {
    nom: "fichiers_partages_hors_limite_equipe",
    type: "check",
    table: F,
    role: "« Non analysé » seulement pour un fichier de l'équipe de plus de 200 Mio.",
  },
  {
    nom: "fichiers_partages_infecte_archive",
    type: "check",
    table: F,
    role: "Un fichier infecté reste archivé.",
  },
  {
    nom: "fichiers_partages_archive_coherent",
    type: "check",
    table: F,
    role: "Un auteur d'archivage implique un archivage.",
  },
  {
    nom: "liens_partage_une_personne",
    type: "check",
    table: L,
    role: "Un lien vise un candidat OU un futur apporteur (num_nonnulls = 1).",
  },
  {
    nom: "liens_partage_retrait_coherent",
    type: "check",
    table: L,
    role: "Un motif de retrait implique un retrait.",
  },
  {
    nom: "fichiers_partages_immuable",
    type: "trigger",
    table: F,
    role: "Ni DELETE (hors effacement RGPD manuel), ni réécriture hors état, verdict (une fois), bibliothèque, archivage.",
  },
  { nom: "fichiers_partages_pas_de_truncate", type: "trigger", table: F, role: "TRUNCATE refusé." },
  {
    nom: "liens_partage_reecriture_limitee",
    type: "trigger",
    table: L,
    role: "Seuls la date limite et le retrait changent ; un lien retiré le reste. PAS d'anti-DELETE (cascade).",
  },
  {
    nom: "liens_partage_fichiers_immuable",
    type: "trigger",
    table: LF,
    role: "Les fichiers d'un lien envoyé ne changent pas.",
  },
  {
    nom: "liens_partage_acces_ajout_seul",
    type: "trigger",
    table: A,
    role: "Journal des accès : ni UPDATE ni DELETE.",
  },
  {
    nom: "liens_partage_acces_pas_de_truncate",
    type: "trigger",
    table: A,
    role: "TRUNCATE refusé.",
  },
];

export interface ObjetPresentPartages {
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
export function fautesDerivePartages(presents: ReadonlyArray<ObjetPresentPartages>): string[] {
  const fautes: string[] = [];
  const cle = (o: { table: string; nom: string; type: string }): string =>
    `${o.type}:${o.table}.${o.nom}`;
  const parCle = new Map(presents.map((p) => [cle(p), p]));
  for (const o of OBJETS_SQL_PARTAGES) {
    const p = parCle.get(cle(o));
    if (p === undefined) fautes.push(`déclaré mais ABSENT en base : ${cle(o)} — ${o.role}`);
    else if (p.actif === false)
      fautes.push(`présent mais DÉSACTIVÉ en base : ${cle(o)} — ${o.role}`);
  }
  const declares = new Set(OBJETS_SQL_PARTAGES.map(cle));
  const tables = new Set<string>(TABLES_PARTAGES);
  for (const p of presents) {
    if (!tables.has(p.table)) continue;
    if (p.type === "fk" && p.nom.endsWith("_fkey")) continue;
    if (!declares.has(cle(p))) fautes.push(`présent en base mais NON DÉCLARÉ : ${cle(p)}`);
  }
  return fautes;
}
