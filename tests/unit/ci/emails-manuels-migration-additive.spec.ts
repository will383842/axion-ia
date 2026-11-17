/**
 * La migration `emails_manuels` (chantier e-mails, lot I4, fiche F1) est ADDITIVE. Garde en LISTE
 * BLANCHE : lignes de commentaire retirées, texte découpé sur `;`, chaque instruction doit être l'une de
 *   · CREATE TABLE d'une des deux tables neuves ;
 *   · CREATE [UNIQUE] INDEX … ON une des deux tables neuves ;
 *   · ALTER TABLE d'une table neuve ADD CONSTRAINT (FOREIGN KEY, CHECK ou UNIQUE).
 * Mots-clés lus sans tenir compte de la casse ; identifiants entre guillemets lus tels quels (Postgres
 * distingue "emails_manuels" de "EMAILS_MANUELS"). Refus partout : ON DELETE CASCADE / SET DEFAULT,
 * bloc DO, chaîne $…$, commentaire en fin de ligne ou en bloc, DELETE / UPDATE hors actions de clé,
 * clé étrangère vers une table non prévue. Le retour arrière, en liste blanche exacte, met de côté.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = "20261118100000_emails_manuels";
const DOSSIER = join(RACINE, NOM);
const lireSql = (f: string): string => readFileSync(join(DOSSIER, f), "utf8");

const NEUVE = `"(?:emails_manuels|emails_manuels_pieces_jointes)"`;
const IDENT = `"[a-z0-9_]+"`;
const CIBLES_PERMISES = new Set(["clients", "client_contacts", "admin_users", "emails_manuels"]);

/** Retire les lignes entièrement en commentaire ; un `--` ou `/*` restant est une faute. */
function sansLignesDeCommentaire(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

/** Majuscules hors des "identifiants" et des 'chaînes' ; blancs réduits à une espace. */
function normaliser(instruction: string): string {
  let sortie = "";
  let ouvert: string | null = null;
  for (const c of instruction) {
    if (ouvert === null) {
      if (c === '"' || c === "'") ouvert = c;
      sortie += ouvert === null ? c.toUpperCase() : c;
    } else {
      if (c === ouvert) ouvert = null;
      sortie += c;
    }
  }
  return sortie.replace(/\s+/g, " ").trim();
}

function instructions(sql: string): string[] {
  return sansLignesDeCommentaire(sql)
    .split(";")
    .map(normaliser)
    .filter((i) => i !== "");
}

const FORMES_PERMISES: readonly RegExp[] = [
  new RegExp(`^CREATE TABLE ${NEUVE} \\(.+\\)$`),
  new RegExp(`^CREATE (?:UNIQUE )?INDEX ${IDENT} ON ${NEUVE} ?\\(.+\\)$`),
  new RegExp(`^ALTER TABLE ${NEUVE} ADD CONSTRAINT ${IDENT} (?:FOREIGN KEY|CHECK|UNIQUE)\\b.+$`),
];

const INTERDITS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ON DELETE (?:CASCADE|SET DEFAULT)/, "suppression en cascade"],
  [/\bDO\b/, "bloc DO"],
  [/\$\w*\$/, "chaîne $…$"],
  [/--|\/\*/, "commentaire en fin de ligne ou en bloc"],
  [/\b(?:DROP|TRUNCATE|INSERT|RENAME|GRANT|REVOKE|COPY|OWNER)\b/, "mot interdit"],
  [/\b(?:ADD|ALTER) COLUMN\b|\bSET SCHEMA\b/, "colonne ou schéma modifié"],
  [/\b(?:INHERITS|PARTITION)\b/, "héritage ou partitionnement de table"],
];

function fautesMigration(sql: string): string[] {
  const fautes: string[] = [];
  for (const i of instructions(sql)) {
    const extrait = i.slice(0, 90);
    if (!FORMES_PERMISES.some((re) => re.test(i))) fautes.push(`forme non permise : ${extrait}`);
    for (const [re, quoi] of INTERDITS) if (re.test(i)) fautes.push(`${quoi} : ${extrait}`);
    const horsActionsDeCle = i.replace(
      /ON DELETE (?:RESTRICT|SET NULL)|ON UPDATE (?:CASCADE|RESTRICT)/g,
      "",
    );
    if (/\b(?:DELETE|UPDATE)\b/.test(horsActionsDeCle))
      fautes.push(`DELETE ou UPDATE : ${extrait}`);
    for (const m of i.matchAll(/REFERENCES ("[^"]*"|\S+)/g)) {
      const brut = m[1] as string;
      if (!brut.startsWith('"') || !CIBLES_PERMISES.has(brut.slice(1, -1))) {
        fautes.push(`clé vers une table non permise : ${extrait}`);
      }
    }
  }
  return fautes;
}

describe("migration emails_manuels : additive (liste blanche)", () => {
  it("migration.sql et rollback.sql existent ; le nom est unique", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
    expect(readdirSync(RACINE).filter((d) => d.endsWith("_emails_manuels"))).toEqual([NOM]);
  });

  it("chaque instruction est une forme permise, sans mot interdit", () => {
    expect(fautesMigration(lireSql("migration.sql"))).toEqual([]);
  });

  it("deux tables, huit index, quatre ADD CONSTRAINT : rien de plus", () => {
    const ins = instructions(lireSql("migration.sql"));
    expect(ins.filter((i) => i.startsWith("CREATE TABLE "))).toHaveLength(2);
    expect(ins.filter((i) => /^CREATE (?:UNIQUE )?INDEX /.test(i))).toHaveLength(8);
    expect(ins.filter((i) => i.startsWith("ALTER TABLE "))).toHaveLength(4);
    expect(ins).toHaveLength(14);
  });

  it("contre-témoins : chaque écart ajouté à la migration est signalé", () => {
    const mig = lireSql("migration.sql");
    const ECARTS = [
      'DROP TABLE "clients"',
      'delete from "clients"',
      `Update "clients" set "statut" = 'x'`,
      'TRUNCATE "client_contacts"',
      'insert into "emails_manuels" ("id") values (gen_random_uuid())',
      'CREATE TABLE "clients_bis" ("id" INT)',
      'create index "x" on "clients"("id")',
      'ALTER TABLE "clients" ADD CONSTRAINT "x" CHECK (true)',
      'ALTER TABLE "clients" ADD COLUMN "x" INT',
      'ALTER TABLE "emails_manuels" ALTER COLUMN "objet" DROP NOT NULL',
      'ALTER TABLE "EMAILS_MANUELS" ADD CONSTRAINT "x" CHECK (true)',
      'alter table "emails_manuels" add constraint "x" foreign key ("client_id") references "clients"("id") on delete cascade',
      'ALTER TABLE "emails_manuels" ADD CONSTRAINT "x" FOREIGN KEY ("client_id") REFERENCES "factures_formation"("id") ON DELETE RESTRICT',
      'ALTER TABLE "emails_manuels" ADD CONSTRAINT "x" CHECK (true) /* cache */',
      'ALTER TABLE "emails_manuels" ADD CONSTRAINT "x" CHECK (true) -- cache',
      'DO $$ BEGIN DELETE FROM "clients"; END $$',
      "CREATE FUNCTION f() RETURNS trigger AS $f$ BEGIN RETURN NULL; END $f$ LANGUAGE plpgsql",
    ];
    for (const e of ECARTS) expect(fautesMigration(`${mig}\n${e};\n`), e).not.toEqual([]);
  });

  it("contre-témoin : INHERITS et PARTITION, y compris dans une instruction d'origine, sont signalés", () => {
    const mig = lireSql("migration.sql");
    // Ajoutés en instruction à part : refusés (forme non permise ET mot interdit).
    for (const e of [
      'CREATE TABLE "emails_manuels_bis" () INHERITS ("clients")',
      'create table "emails_manuels_bis" (id int) partition by range (id)',
    ]) {
      expect(fautesMigration(`${mig}\n${e};\n`), e).not.toEqual([]);
    }
    // Greffés SUR une instruction d'origine, dont la forme reste permise : seul le mot interdit
    // les attrape. On remplace l'instruction d'origine, on ne se contente pas d'en ajouter une.
    const origine = 'CREATE TABLE "emails_manuels" (';
    const debut = mig.indexOf(origine);
    const fin = mig.indexOf(";", debut);
    expect(debut).toBeGreaterThan(-1);
    for (const queue of [
      ' INHERITS ("clients")',
      " PARTITION BY HASH (id)",
      " inherits (clients)",
    ]) {
      const remplacee = `${mig.slice(0, fin)}${queue}${mig.slice(fin)}`;
      const fautes = fautesMigration(remplacee);
      expect(
        fautes.some((f) => f.startsWith("héritage ou partitionnement")),
        queue,
      ).toBe(true);
    }
  });

  it("clés : RESTRICT vers clients et client_contacts, SET NULL pour l'auteur, RESTRICT vers l'e-mail", () => {
    const sql = instructions(lireSql("migration.sql")).join(";\n");
    expect(sql).toMatch(/REFERENCES "clients"\("id"\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/REFERENCES "client_contacts"\("id"\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/REFERENCES "admin_users"\("id"\) ON DELETE SET NULL/);
    expect(sql).toMatch(/REFERENCES "emails_manuels"\("id"\) ON DELETE RESTRICT/);
  });

  it("porte les contraintes du plan (types, statuts, empreinte, taille)", () => {
    const sql = sansLignesDeCommentaire(lireSql("migration.sql"));
    expect(sql).toMatch(
      /'Client','ClientContact','CalendlyEvent','ApporteurReseau','Trainer','Trainee'/,
    );
    expect(sql).toMatch(/'brouillon','en_file','envoye','echec','retenu','rebondi'/);
    expect(sql).toMatch(/"destinataire_hash" ~ '\^\[0-9a-f\]\{64\}\$'/);
    expect(sql).toMatch(/"taille_octets" > 0 AND "taille_octets" <= 10485760/);
    expect(sql).toMatch(/'attendue','controle','acceptee','refusee','non_recue'/);
  });

  it("le retour arrière est en liste blanche exacte : il met de côté, sans rien supprimer", () => {
    expect(instructions(lireSql("rollback.sql"))).toEqual([
      "BEGIN",
      'CREATE SCHEMA IF NOT EXISTS "retrait"',
      'ALTER TABLE "emails_manuels_pieces_jointes" SET SCHEMA "retrait"',
      'ALTER TABLE "emails_manuels" SET SCHEMA "retrait"',
      "COMMIT",
    ]);
  });

  it("le modèle Prisma porte les mêmes tables, colonnes et règles de clé", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const em = schema.match(/model EmailManuel \{[\s\S]*?\n\}/)?.[0] ?? "";
    const pj = schema.match(/model EmailManuelPieceJointe \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(em).toMatch(/@@map\("emails_manuels"\)/);
    expect(pj).toMatch(/@@map\("emails_manuels_pieces_jointes"\)/);
    for (const c of [
      "cle_idempotence",
      "destinataire_chiffre",
      "destinataire_hash",
      "corps_source",
      "message_id",
      "rebond_type",
      "ecrit_par_id",
    ]) {
      expect(em).toContain(`"${c}"`);
    }
    for (const c of ["email_manuel_id", "cle_stockage", "jeton_hash", "taille_octets"]) {
      expect(pj).toContain(`"${c}"`);
    }
    expect(em).toMatch(/@relation\("EmailManuelClient",[^)]*onDelete: Restrict\)/);
    expect(em).toMatch(/@relation\("EmailManuelContact",[^)]*onDelete: Restrict\)/);
    expect(`${em}\n${pj}`).not.toMatch(/onDelete: Cascade/);
  });
});
