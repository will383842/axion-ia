/**
 * LE CHANGEMENT D'IBAN N'AJOUTE RIEN AUX TABLES EXISTANTES (plan §3.1, lot 1).
 *
 * Pendant une mise en ligne, l'application et le worker ne tournent pas le même code, et la migration est jouée
 * par l'application seule. Donc : quatre tables NEUVES, aucune clé étrangère, aucun DROP, aucune colonne sur
 * `apporteurs_reseau`, aucune énumération Postgres créée ou étendue. Retour arrière : les tables restent.
 * Les règles de transition du code doublent le déclencheur SQL : ce test les compare.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STATUTS_CHANGEMENT_IBAN, TRANSITIONS_CHANGEMENT_IBAN } from "../changement-iban-regles";

const RACINE = path.resolve(__dirname, "../../../..");
const MIGRATION = "prisma/migrations/20261126120000_apporteur_changement_iban/migration.sql";
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");
const sansCommentaires = (sql: string) => sql.replace(/--.*$/gm, "");
const TABLES = [
  "apporteur_changements_iban",
  "apporteur_changements_iban_rib",
  "apporteur_iban_historique",
  "apporteur_virements_compte",
];

/** Une analyse qui rend les fautes ; le contre-témoin la nourrit d'un texte muté. */
function fautes(sqlBrut: string): string[] {
  const sql = sansCommentaires(sqlBrut);
  // Les corps de fonctions (`$$ … $$`) contiennent des RAISE : on les retire avant de lire les instructions.
  const instructions = sql.replace(/\$\$[\s\S]*?\$\$/g, " ");
  const out: string[] = [];
  if (/\bDROP\b/i.test(instructions)) out.push("DROP");
  if (/\bREFERENCES\b|\bFOREIGN\s+KEY\b/i.test(instructions)) out.push("clé étrangère");
  if (/\bCREATE\s+TYPE\b|\bALTER\s+TYPE\b/i.test(instructions)) out.push("énumération ou type");
  if (/\bADD\s+VALUE\b/i.test(instructions)) out.push("valeur d'énumération ajoutée");
  for (const m of instructions.matchAll(
    /\bALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi,
  )) {
    if (!TABLES.includes(m[1] as string)) out.push(`ALTER TABLE ${m[1]}`);
  }
  for (const m of instructions.matchAll(
    /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi,
  )) {
    if (!TABLES.includes(m[1] as string)) out.push(`CREATE TABLE ${m[1]}`);
  }
  for (const m of instructions.matchAll(/\bON\s+"?(\w+)"?\s*(?:\(|FOR|$)/gim)) {
    if (!TABLES.includes(m[1] as string)) out.push(`objet sur ${m[1]}`);
  }
  const sansTriggers = instructions.replace(/CREATE\s+TRIGGER[\s\S]*?;/gi, " ");
  if (/\b(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\b/i.test(sansTriggers))
    out.push("écriture de données");
  if (/apporteurs_reseau/i.test(instructions)) out.push("touche apporteurs_reseau");
  return out;
}

describe("la migration du changement d'IBAN est additive", () => {
  const sql = lire(MIGRATION);

  it("crée exactement les quatre tables prévues, rien d'autre", () => {
    const creees = [...sansCommentaires(sql).matchAll(/CREATE TABLE\s+"(\w+)"/g)].map((m) => m[1]);
    expect(creees.sort()).toEqual([...TABLES].sort());
  });

  it("ni DROP, ni clé étrangère, ni énumération, ni colonne sur une table existante", () => {
    expect(fautes(sql)).toEqual([]);
  });

  it("contre-témoins : chaque faute interdite fait rougir la garde", () => {
    expect(fautes(sql + '\nDROP TABLE "x";')).toContain("DROP");
    expect(fautes(sql + '\nALTER TABLE "apporteurs_reseau" ADD COLUMN "z" TEXT;')).toContain(
      "ALTER TABLE apporteurs_reseau",
    );
    expect(fautes(sql + "\nALTER TYPE \"type_piece_apporteur\" ADD VALUE 'x';")).toContain(
      "énumération ou type",
    );
    expect(fautes(sql + "\nCREATE TYPE \"nouveau\" AS ENUM ('a');")).toContain(
      "énumération ou type",
    );
    expect(
      fautes(
        sql +
          '\nALTER TABLE "apporteur_iban_historique" ADD FOREIGN KEY ("a") REFERENCES "apporteurs_reseau"("id");',
      ),
    ).toContain("clé étrangère");
    expect(fautes(sql + '\nCREATE INDEX "i" ON "apporteurs_reseau" ("email");')).toContain(
      "objet sur apporteurs_reseau",
    );
    expect(
      fautes(sql + '\nUPDATE "apporteur_iban_historique" SET "iban_fin4" = \'0000\';'),
    ).toContain("écriture de données");
  });

  it("aucune énumération dans le schéma Prisma pour ces tables : `statut` est un texte contraint", () => {
    const schema = lire("prisma/schema.prisma");
    const bloc = /model ApporteurChangementIban \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
    expect(bloc).toMatch(/statut\s+String\s+@default\("a_confirmer"\)/);
    expect(schema).not.toMatch(/enum\s+StatutChangementIban/i);
    // Aucune relation déclarée entre ces modèles et `ApporteurReseau` (sans clé étrangère, à dessein).
    for (const nom of [
      "ApporteurChangementIban",
      "ApporteurChangementIbanRib",
      "ApporteurIbanHistorique",
      "ApporteurVirementCompte",
    ]) {
      const b = new RegExp(`model ${nom} \\{[\\s\\S]*?\\n\\}`).exec(schema)?.[0] ?? "";
      expect(b, nom).not.toBe("");
      expect(b, nom).not.toContain("@relation");
    }
  });

  it("`apporteurs_reseau` ne gagne aucune colonne : le modèle ApporteurReseau ne cite aucune des quatre tables", () => {
    const schema = lire("prisma/schema.prisma");
    const bloc = /model ApporteurReseau \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
    expect(bloc).not.toMatch(/ChangementIban|IbanHistorique|VirementCompte/);
  });
});

describe("les transitions du code sont celles du déclencheur SQL", () => {
  const sql = sansCommentaires(lire(MIGRATION));
  const corps =
    /"apporteur_changements_iban_garde_update"\(\) RETURNS trigger AS \$\$([\s\S]*?)\$\$ LANGUAGE/.exec(
      sql,
    )?.[1] ?? "";

  it("le déclencheur existe", () => {
    expect(corps).not.toBe("");
  });

  it("chaque couple permis par le code l'est par le SQL, et inversement", () => {
    const permisSql = new Set<string>();
    for (const m of corps.matchAll(/OLD\."statut" = '(\w+)' AND NEW\."statut" IN \(([^)]*)\)/g)) {
      for (const v of (m[2] as string).matchAll(/'(\w+)'/g)) permisSql.add(`${m[1]}>${v[1]}`);
    }
    const permisCode = new Set<string>();
    for (const de of STATUTS_CHANGEMENT_IBAN)
      for (const vers of TRANSITIONS_CHANGEMENT_IBAN[de]) permisCode.add(`${de}>${vers}`);
    expect([...permisSql].sort()).toEqual([...permisCode].sort());
  });

  it("les sept statuts du code sont ceux du CHECK SQL", () => {
    const m =
      /"apporteur_changements_iban_statut" CHECK \(\s*"statut" IN \(([^)]*)\)/.exec(sql)?.[1] ?? "";
    const enSql = [...m.matchAll(/'(\w+)'/g)].map((x) => x[1]);
    expect(enSql.sort()).toEqual([...STATUTS_CHANGEMENT_IBAN].sort());
  });
});
