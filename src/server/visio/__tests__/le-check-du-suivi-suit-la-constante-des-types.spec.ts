/**
 * ⛔ LE CHECK DU SUIVI SUIT LA CONSTANTE DES TYPES (chantier visio, PR 2).
 *
 * `TYPES_DE_FAITS` (src/server/visio/types-de-faits.ts) est la SOURCE UNIQUE
 * des types de faits. Le CHECK `faits_suivi_types_suivables` de la migration
 * en est PRODUIT (`sqlCheckSuivi()`) : un type rendu suivable dans la
 * constante sans migration — ou l'inverse — ferait refuser par la base un
 * suivi que l'écran propose, ou accepter un suivi sur un type qui n'en a pas.
 *
 * La même spec vérifie que la constante couvre EXACTEMENT l'énumération
 * Prisma `FaitType` (le `satisfies` le garantit à la compilation ; ce test le
 * dit en clair et sans dépendre du client généré).
 *
 * Mutation qui fait rougir : passer `suivable: true` sur `besoin`, ou retirer
 * `'prochaine_etape'` du CHECK dans la migration.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATION_VISIO, sqlCheckSuivi } from "../../../../prisma/objets-sql-bruts";
import {
  TYPES_DE_FAITS,
  TYPES_DEDUCTIBLES,
  TYPES_SUIVABLES,
  TYPES_VALIDES_UN_PAR_UN,
} from "../types-de-faits";

const RACINE = path.resolve(__dirname, "../../../..");
const SQL = readFileSync(
  path.join(RACINE, "prisma/migrations", MIGRATION_VISIO, "migration.sql"),
  "utf8",
);
const SCHEMA = readFileSync(path.join(RACINE, "prisma/schema.prisma"), "utf8");

function valeursEnum(nom: string): string[] {
  const bloc = new RegExp(`^enum ${nom} \\{([\\s\\S]*?)^\\}`, "m").exec(SCHEMA)?.[1] ?? "";
  return bloc
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+$/.test(l));
}

describe("le CHECK du suivi suit la constante des types", () => {
  it("la migration contient exactement le CHECK produit depuis la constante", () => {
    expect(SQL).toContain(sqlCheckSuivi());
  });

  it("la constante couvre exactement l'énumération FaitType", () => {
    expect(Object.keys(TYPES_DE_FAITS).sort()).toEqual(valeursEnum("FaitType").sort());
  });

  it("les types suivables sont ceux du plan (engagements, questions, objections, prochaine étape)", () => {
    expect([...TYPES_SUIVABLES].sort()).toEqual(
      [
        "engagement_axion",
        "engagement_client",
        "objection",
        "prochaine_etape",
        "question_ouverte",
      ].sort(),
    );
  });

  it("la déduction n'est permise que pour trois types", () => {
    expect([...TYPES_DEDUCTIBLES].sort()).toEqual(["activite", "info_societe", "niveau_ia"].sort());
  });

  it("budget, décideur et mise en relation se valident un par un", () => {
    for (const t of ["budget", "decideur", "mise_en_relation"] as const) {
      expect(TYPES_VALIDES_UN_PAR_UN).toContain(t);
    }
  });

  it("les engagements de Williams et ses prix ne sont admis que de sa bouche", () => {
    expect(TYPES_DE_FAITS.engagement_axion.locuteurs).toEqual({ client: false, axion: "oui" });
    expect(TYPES_DE_FAITS.prix_annonce_axion.locuteurs).toEqual({ client: false, axion: "oui" });
    expect(TYPES_DE_FAITS.budget.locuteurs.axion).toBe("jamais");
  });

  it("chaque portée par défaut est une portée admise", () => {
    for (const [type, meta] of Object.entries(TYPES_DE_FAITS)) {
      expect(meta.porteesAdmises as readonly string[], type).toContain(meta.porteeParDefaut);
    }
  });

  it("contre-témoin : un CHECK qui oublierait un type ne correspondrait plus", () => {
    const coupe = SQL.replace(", 'prochaine_etape'))", "))");
    expect(coupe).not.toBe(SQL);
    expect(coupe).not.toContain(sqlCheckSuivi());
  });
});
