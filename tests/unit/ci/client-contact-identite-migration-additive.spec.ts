/**
 * Fiche M1 : la migration `client_contact_identite_devis_conditions` est ADDITIVE. Liste blanche EXACTE
 * des 9 instructions (lignes de commentaire retirées, texte découpé sur `;`, normalisé), mots interdits,
 * retour arrière sans instruction, et concordance avec les blocs model de schema.prisma.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = "20261118140000_client_contact_identite_devis_conditions";
const DOSSIER = join(RACINE, NOM);
const lireSql = (f: string): string => readFileSync(join(DOSSIER, f), "utf8");

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

const CHECK = (t: string, col: string, nom: string): string =>
  `ALTER TABLE "${t}" ADD CONSTRAINT "${nom}" CHECK ("${col}" IS NULL OR "${col}" IN ('madame', 'monsieur'))`;

const ATTENDUES: readonly string[] = [
  'ALTER TABLE "client_contacts" ADD COLUMN "civilite" VARCHAR(10)',
  'ALTER TABLE "client_contacts" ADD COLUMN "prenom" VARCHAR(80)',
  'ALTER TABLE "client_contacts" ADD COLUMN "nom_famille" VARCHAR(80)',
  CHECK("client_contacts", "civilite", "client_contacts_civilite_check"),
  'ALTER TABLE "clients" ADD COLUMN "contact_civilite" VARCHAR(10)',
  'ALTER TABLE "clients" ADD COLUMN "contact_prenom" VARCHAR(80)',
  'ALTER TABLE "clients" ADD COLUMN "contact_nom_famille" VARCHAR(80)',
  CHECK("clients", "contact_civilite", "clients_contact_civilite_check"),
  'ALTER TABLE "devis" ADD COLUMN "conditions_particulieres" TEXT',
];

const INTERDITS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:DROP|DELETE|UPDATE|INSERT|TRUNCATE|RENAME|CASCADE)\b/, "mot interdit"],
  [/\bDEFAULT\b/, "DEFAULT"],
  [/\bNOT NULL\b/, "NOT NULL"],
  [/\bSET SCHEMA\b/, "SET SCHEMA"],
  [/\bDO\b/, "bloc DO"],
  [/\$\w*\$/, "chaîne $…$"],
  [/--|\/\*/, "commentaire en fin de ligne ou en bloc"],
];

function fautesMigration(sql: string): string[] {
  const fautes: string[] = [];
  const ins = instructions(sql);
  for (const i of ins) {
    const extrait = i.slice(0, 90);
    if (!ATTENDUES.includes(i)) fautes.push(`instruction hors liste blanche : ${extrait}`);
    for (const [re, quoi] of INTERDITS) if (re.test(i)) fautes.push(`${quoi} : ${extrait}`);
  }
  if (ins.length !== ATTENDUES.length) fautes.push(`nombre d'instructions : ${ins.length}`);
  return fautes;
}

describe("migration client_contact_identite_devis_conditions : additive (liste blanche)", () => {
  it("migration.sql et rollback.sql existent ; le nom est unique", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
    expect(
      readdirSync(RACINE).filter((d) =>
        /^\d{14}_client_contact_identite_devis_conditions$/.test(d),
      ),
    ).toEqual([NOM]);
  });

  it("les instructions sont EXACTEMENT les 9 attendues, dans l'ordre", () => {
    expect(instructions(lireSql("migration.sql"))).toEqual([...ATTENDUES]);
    expect(fautesMigration(lireSql("migration.sql"))).toEqual([]);
  });

  it("l'en-tête annonce l'ordre de livraison et l'absence de lecteur", () => {
    const sql = lireSql("migration.sql");
    expect(sql).toContain("ADDITIVE");
    expect(sql).toContain("ORDRE DE LIVRAISON");
    expect(sql).toMatch(/aucun code ne lit ni n'écrit ces colonnes avant B4/i);
  });

  it("le retour arrière ne contient aucune instruction", () => {
    expect(instructions(lireSql("rollback.sql"))).toEqual([]);
  });

  it("contre-témoins : chaque écart ajouté à la migration est signalé", () => {
    const mig = lireSql("migration.sql");
    const ECARTS = [
      'ALTER TABLE "clients" ALTER COLUMN "contact_civilite" SET NOT NULL',
      `ALTER TABLE "devis" ADD COLUMN "x" TEXT DEFAULT 'x'`,
      `UPDATE "clients" SET "contact_prenom" = 'x'`,
      'DELETE FROM "clients"',
      'ALTER TABLE "clients" DROP COLUMN "contact_nom"',
      'ALTER TABLE "clients" RENAME COLUMN "contact_nom" TO "x"',
      'ALTER TABLE "clients" ADD COLUMN "autre" TEXT',
      'ALTER TABLE "devis" ADD COLUMN "y" TEXT NOT NULL',
      'ALTER TABLE "devis" ADD COLUMN "z" TEXT -- cache',
      'DO $$ BEGIN DELETE FROM "clients"; END $$',
    ];
    for (const e of ECARTS) expect(fautesMigration(`${mig}\n${e};\n`), e).not.toEqual([]);
    expect(fautesMigration(mig.replace(/'madame', /, ""))).not.toEqual([]);
  });

  it("schema.prisma porte les champs, String?, bon @map/@db, sans @default", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const bloc = (m: string): string =>
      schema.match(new RegExp(`model ${m} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
    const ligne = (b: string, champ: string): string =>
      b.split("\n").find((l) => new RegExp(`^\\s+${champ}\\s`).test(l)) ?? "";
    const verifier = (b: string, champ: string, map: string | null, db: string): void => {
      const l = ligne(b, champ);
      expect(l, champ).toMatch(/\sString\?\s/);
      expect(l, champ).toContain(db);
      if (map) expect(l, champ).toContain(`@map("${map}")`);
      else expect(l, champ).not.toContain("@map");
      expect(l, champ).not.toContain("@default");
    };
    const cc = bloc("ClientContact");
    verifier(cc, "civilite", null, "@db.VarChar(10)");
    verifier(cc, "prenom", null, "@db.VarChar(80)");
    verifier(cc, "nomFamille", "nom_famille", "@db.VarChar(80)");
    const cl = bloc("Client");
    verifier(cl, "contactCivilite", "contact_civilite", "@db.VarChar(10)");
    verifier(cl, "contactPrenom", "contact_prenom", "@db.VarChar(80)");
    verifier(cl, "contactNomFamille", "contact_nom_famille", "@db.VarChar(80)");
    verifier(bloc("Devis"), "conditionsParticulieres", "conditions_particulieres", "@db.Text");
  });
});
