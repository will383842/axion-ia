/**
 * ⛔ UNE COLONNE ABSENTE REPORTE L'ÉTAPE SANS LA COMPTER (plan §2.5).
 *
 * Le worker atterrit ~50 min AVANT l'app, et c'est l'app qui migre la base :
 * une colonne ou une table attendue peut manquer (Prisma P2021/P2022,
 * PostgreSQL 42703/42P01/22P02). L'étape est reportée de 15 min SANS compter
 * d'essai ; au-delà de 2 h, une alerte part.
 *
 * Mutation qui rougit : retirer les codes de `CODES_SCHEMA_EN_RETARD` dans
 * `erreurs.ts` → l'erreur devient passagère et compte. Contre-témoin : au
 * bout de 2 h, l'alerte part. Angle mort : une migration qui renomme une
 * colonne sans la supprimer passe inaperçue ici.
 *
 * V1 F2 : une requête SQL BRUTE (`$executeRaw`, `$queryRaw` : `terminer`,
 * `planifierDans`) ne lève pas `42703` mais `P2010`, le code PostgreSQL étant
 * dans `meta.code`. Mutation qui rougit : rendre `e.code` avant de lire
 * `meta.code` pour `P2010` → le cas « requête brute » devient passager.
 */

import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../etapes";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

function colonneAbsente(code: string): Error {
  return Object.assign(new Error("The column `x` does not exist in the current database."), {
    code,
  });
}

/** La forme RÉELLE d'une requête brute qui échoue (Prisma 5.22) : `P2010`, code PG dans `meta`. */
function requeteBruteEnEchec(codePg: string): Error {
  return Object.assign(new Error("Raw query failed. Code: `" + codePg + "`."), {
    code: "P2010",
    meta: { code: codePg, message: "column does not exist" },
  });
}

describe("une colonne absente reporte l'étape sans la compter", () => {
  for (const code of ["P2022", "P2021", "42703", "42P01"]) {
    it(`${code} : +15 min, 0 échec, pas d'alerte`, async () => {
      const depot = new FauxDepot();
      const t = depot.ajouter({
        rencontreId: "00000000-0000-4000-8000-0000000000f1",
        etape: "extraire",
      });
      const g: Gestionnaire = async () => {
        throw colonneAbsente(code);
      };
      const deps = depsDeTest({ depot, gestionnaires: { extraire: g } });
      expect(await executerEtape(deps, t.id)).toBe("reportee");
      expect(depot.ligne(t.id)).toMatchObject({
        statut: "a_faire",
        echecs: 0,
        classeErreur: "schema_en_retard",
      });
      expect(depot.ligne(t.id).prochaineTentativeLe!.toISOString()).toBe(
        "2026-10-06T10:15:00.000Z",
      );
      expect(deps.alertes).toEqual([]);
    });
  }

  for (const codePg of ["42703", "42P01", "22P02"]) {
    it(`requête brute P2010 / ${codePg} : +15 min, 0 échec, pas d'alerte`, async () => {
      const depot = new FauxDepot();
      const t = depot.ajouter({
        rencontreId: "00000000-0000-4000-8000-0000000000f1",
        etape: "extraire",
      });
      const g: Gestionnaire = async () => {
        throw requeteBruteEnEchec(codePg);
      };
      const deps = depsDeTest({ depot, gestionnaires: { extraire: g } });
      expect(await executerEtape(deps, t.id)).toBe("reportee");
      expect(depot.ligne(t.id)).toMatchObject({
        statut: "a_faire",
        echecs: 0,
        classeErreur: "schema_en_retard",
      });
    });
  }

  it("contre-témoin : une requête brute P2010 sur un autre code PG reste passagère", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "extraire",
    });
    const g: Gestionnaire = async () => {
      throw requeteBruteEnEchec("23505");
    };
    const deps = depsDeTest({ depot, gestionnaires: { extraire: g } });
    expect(await executerEtape(deps, t.id)).toBe("a_reessayer");
    expect(depot.ligne(t.id).classeErreur).toBe("passagere");
  });

  it("contre-témoin : toujours absente après 2 h → alerte", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "extraire",
      premierEchecLe: new Date("2026-10-06T07:30:00Z"),
    });
    const g: Gestionnaire = async () => {
      throw colonneAbsente("P2022");
    };
    const deps = depsDeTest({ depot, gestionnaires: { extraire: g } });
    await executerEtape(deps, t.id);
    expect(deps.alertes.map((a) => a.code)).toEqual(["visio.schema_en_retard"]);
    expect(depot.ligne(t.id).echecs).toBe(0);
  });
});
