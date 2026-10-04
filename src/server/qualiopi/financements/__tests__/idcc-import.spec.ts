/**
 * INT-T60-A — import IDCC → OPCO.
 *
 * ⚠️ FIXTURE FICTIVE. Les en-têtes, les libellés OPCO, la valeur d'échappement
 * et les couples IDCC → OPCO ci-dessous sont INVENTÉS pour exercer le code : ils
 * ne reproduisent PAS le fichier SIRO de France compétences, qui n'a pas pu être
 * lu depuis la session (cf. RAPPORT INT-T60-A). Ne rien en déduire sur le
 * rattachement réel d'une convention collective.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Opco } from "../../../../../prisma/generated/client";
import {
  calculerChangements,
  FichierIdccOpcoRefuse,
  IDCC_MOTIF,
  importerFichierIdccOpco,
  importerMillesimeIdccOpco,
  ImportIdccOpcoRefuse,
  lireFichierSiro,
  type BaseIdccOpco,
  type ConfigFichierSiro,
  type TxIdccOpco,
} from "../idcc-import";

const URL_FICTIVE = "https://exemple.invalid/FICTIF-siro.csv";

/** Configuration FICTIVE — à remplacer par le dictionnaire des données lu. */
const CONFIG_FICTIVE: ConfigFichierSiro = {
  separateur: ";",
  colonneIdcc: "FICTIF_IDCC",
  colonneOpco: "FICTIF_OPCO",
  libellesOpco: { "FICTIF-A": "atlas", "FICTIF-B": "akto", "FICTIF-C": "afdas" },
  idccEchappement: ["FICTIF-SANS"],
};

const FICHIER_FICTIF = [
  "FICTIF_SIRET;FICTIF_IDCC;FICTIF_OPCO",
  "00000000000001;9001;FICTIF-A",
  "00000000000002;9001;FICTIF-A",
  "00000000000003;9002;FICTIF-B",
  "00000000000004;9003;FICTIF-A",
  "00000000000005;9003;FICTIF-C",
  "00000000000006;FICTIF-SANS;FICTIF-B",
].join("\n");

interface Ligne {
  idcc: string;
  opco: Opco;
  millesimeSource: Date;
  sourceUrl: string;
  importeAt: Date;
  intitule: string | null;
  intituleSource: string | null;
}
interface Changement {
  idcc: string;
  ancienOpco: Opco | null;
  nouvelOpco: Opco | null;
  millesimeSource: Date;
  importeAt: Date;
}

/** Fausse base : la transaction travaille sur une copie, validée seulement au succès. */
function fausseBase() {
  const etat = { lignes: [] as Ligne[], changements: [] as Changement[], ecritures: 0 };
  const db: BaseIdccOpco = {
    async $transaction(fn) {
      const copie = { lignes: [...etat.lignes], changements: [...etat.changements] };
      let ecritures = 0;
      const tx: TxIdccOpco = {
        idccOpco: {
          async findMany() {
            return copie.lignes.map((l) => ({ ...l }));
          },
          async deleteMany() {
            ecritures++;
            const count = copie.lignes.length;
            copie.lignes = [];
            return { count };
          },
          async createMany({ data }) {
            ecritures++;
            for (const l of data) {
              // Rejoue la PK composée et le CHECK de la migration.
              if (!/^[0-9]{4}$/.test(l.idcc)) throw new Error("CHECK idcc");
              if (copie.lignes.some((x) => x.idcc === l.idcc && x.opco === l.opco)) {
                throw new Error("PK (idcc, opco)");
              }
              copie.lignes.push({ ...l });
            }
            return { count: data.length };
          },
        },
        idccOpcoChangement: {
          async createMany({ data }) {
            ecritures++;
            copie.changements.push(...data.map((c) => ({ ...c })));
            return { count: data.length };
          },
        },
      };
      const r = await fn(tx);
      etat.lignes = copie.lignes;
      etat.changements = copie.changements;
      etat.ecritures += ecritures;
      return r;
    },
  };
  return { db, etat };
}

const M1 = new Date("2026-05-11T00:00:00Z");
const M2 = new Date("2026-06-11T00:00:00Z");

describe("lireFichierSiro (fixture FICTIVE)", () => {
  it("rend les couples distincts, ignore l'échappement, garde deux OPCO pour un IDCC", () => {
    expect(lireFichierSiro(FICHIER_FICTIF, CONFIG_FICTIVE)).toEqual([
      { idcc: "9001", opco: "atlas" },
      { idcc: "9002", opco: "akto" },
      { idcc: "9003", opco: "afdas" },
      { idcc: "9003", opco: "atlas" },
    ]);
  });

  it("refuse un libellé OPCO non répertorié plutôt que de le deviner", () => {
    const texte = `${FICHIER_FICTIF}\n00000000000007;9004;FICTIF-INCONNU`;
    expect(() => lireFichierSiro(texte, CONFIG_FICTIVE)).toThrow(FichierIdccOpcoRefuse);
  });

  it("refuse un fichier vide, sans colonne attendue, ou aux IDCC invalides", () => {
    expect(() => lireFichierSiro("", CONFIG_FICTIVE)).toThrow(FichierIdccOpcoRefuse);
    expect(() => lireFichierSiro("FICTIF_IDCC;FICTIF_OPCO\n", CONFIG_FICTIVE)).toThrow(
      /aucun couple/,
    );
    expect(() => lireFichierSiro("A;B\n1;2", CONFIG_FICTIVE)).toThrow(/colonne absente/);
    expect(() => lireFichierSiro("FICTIF_IDCC;FICTIF_OPCO\n123;FICTIF-A", CONFIG_FICTIVE)).toThrow(
      /invalide/,
    );
    expect(() => lireFichierSiro("<html>erreur 503</html>", CONFIG_FICTIVE)).toThrow(
      FichierIdccOpcoRefuse,
    );
  });

  it("gère les champs entre guillemets et le BOM", () => {
    const texte = '﻿"FICTIF_IDCC";"FICTIF_OPCO"\n"9001";"FICTIF-A"';
    expect(lireFichierSiro(texte, CONFIG_FICTIVE)).toEqual([{ idcc: "9001", opco: "atlas" }]);
  });
});

describe("importerMillesimeIdccOpco — témoins INT-T60-A", () => {
  it("TÉMOIN — double import du même millésime : aucun effet, aucun changement journalisé", async () => {
    const { db, etat } = fausseBase();
    const premier = await importerFichierIdccOpco(db, {
      texte: FICHIER_FICTIF,
      config: CONFIG_FICTIVE,
      millesime: M1,
      sourceUrl: URL_FICTIVE,
    });
    expect(premier).toEqual({ statut: "importe", lignes: 4, changements: 0, premierImport: true });
    const instantane = JSON.stringify(etat.lignes);
    const ecritures = etat.ecritures;

    const second = await importerFichierIdccOpco(db, {
      texte: FICHIER_FICTIF,
      config: CONFIG_FICTIVE,
      millesime: M1,
      sourceUrl: URL_FICTIVE,
    });
    expect(second).toEqual({ statut: "deja_importe", lignes: 4 });
    expect(JSON.stringify(etat.lignes)).toBe(instantane);
    expect(etat.ecritures).toBe(ecritures);
    expect(etat.changements).toEqual([]);
  });

  it("TÉMOIN — un changement d'OPCO entre deux millésimes est journalisé", async () => {
    const { db, etat } = fausseBase();
    await importerMillesimeIdccOpco(db, {
      millesime: M1,
      sourceUrl: URL_FICTIVE,
      couples: [
        { idcc: "9001", opco: "atlas" },
        { idcc: "9002", opco: "akto" },
      ],
    });
    const r = await importerMillesimeIdccOpco(db, {
      millesime: M2,
      sourceUrl: URL_FICTIVE,
      couples: [
        { idcc: "9001", opco: "afdas" },
        { idcc: "9002", opco: "akto" },
      ],
    });
    expect(r).toMatchObject({ statut: "importe", changements: 1, premierImport: false });
    expect(etat.changements).toEqual([
      expect.objectContaining({
        idcc: "9001",
        ancienOpco: "atlas",
        nouvelOpco: "afdas",
        millesimeSource: M2,
      }),
    ]);
    // Le millésime entier est remplacé : plus aucune ligne de M1.
    expect(new Set(etat.lignes.map((l) => l.millesimeSource.toISOString()))).toEqual(
      new Set([M2.toISOString()]),
    );
  });

  it("TÉMOIN — un IDCC à deux OPCO garde deux lignes", async () => {
    const { db, etat } = fausseBase();
    await importerFichierIdccOpco(db, {
      texte: FICHIER_FICTIF,
      config: CONFIG_FICTIVE,
      millesime: M1,
      sourceUrl: URL_FICTIVE,
    });
    expect(
      etat.lignes
        .filter((l) => l.idcc === "9003")
        .map((l) => l.opco)
        .sort(),
    ).toEqual(["afdas", "atlas"]);
  });

  it("TÉMOIN — un fichier illisible ou vide ne touche pas la table", async () => {
    const { db, etat } = fausseBase();
    await importerFichierIdccOpco(db, {
      texte: FICHIER_FICTIF,
      config: CONFIG_FICTIVE,
      millesime: M1,
      sourceUrl: URL_FICTIVE,
    });
    const instantane = JSON.stringify(etat);
    for (const texte of ["", "   \n", "<html>503</html>", "FICTIF_IDCC;FICTIF_OPCO\n"]) {
      await expect(
        importerFichierIdccOpco(db, {
          texte,
          config: CONFIG_FICTIVE,
          millesime: M2,
          sourceUrl: URL_FICTIVE,
        }),
      ).rejects.toThrow(FichierIdccOpcoRefuse);
    }
    expect(JSON.stringify(etat)).toBe(instantane);
  });

  it("TÉMOIN — l'IDCC refuse « 123 » et « 12a4 » (code et CHECK de la migration)", async () => {
    expect(IDCC_MOTIF.test("123")).toBe(false);
    expect(IDCC_MOTIF.test("12a4")).toBe(false);
    expect(IDCC_MOTIF.test("1516")).toBe(true);
    const { db, etat } = fausseBase();
    for (const idcc of ["123", "12a4"]) {
      await expect(
        importerMillesimeIdccOpco(db, {
          millesime: M1,
          sourceUrl: URL_FICTIVE,
          couples: [{ idcc, opco: "atlas" }],
        }),
      ).rejects.toThrow(ImportIdccOpcoRefuse);
    }
    expect(etat.lignes).toEqual([]);
    // Le même motif est posé en base sur les deux tables.
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20261004200000_idcc_opco/migration.sql"),
      "utf8",
    );
    expect(sql).toContain(`ALTER TABLE "idcc_opco" ADD CONSTRAINT "idcc_opco_idcc_check"`);
    expect(sql).toContain(`CHECK ("idcc" ~ '^[0-9]{4}$')`);
    expect(sql).toContain(`PRIMARY KEY ("idcc", "opco")`);
  });

  it("refuse un millésime plus ancien, et un même millésime au contenu différent", async () => {
    const { db, etat } = fausseBase();
    await importerMillesimeIdccOpco(db, {
      millesime: M2,
      sourceUrl: URL_FICTIVE,
      couples: [{ idcc: "9001", opco: "atlas" }],
    });
    const instantane = JSON.stringify(etat);
    await expect(
      importerMillesimeIdccOpco(db, {
        millesime: M1,
        sourceUrl: URL_FICTIVE,
        couples: [{ idcc: "9001", opco: "akto" }],
      }),
    ).rejects.toThrow(/plus ancien/);
    await expect(
      importerMillesimeIdccOpco(db, {
        millesime: M2,
        sourceUrl: URL_FICTIVE,
        couples: [{ idcc: "9001", opco: "akto" }],
      }),
    ).rejects.toThrow(/contenu différent/);
    expect(JSON.stringify(etat)).toBe(instantane);
  });

  it("conserve l'intitulé (source distincte) d'un millésime à l'autre", async () => {
    const { db, etat } = fausseBase();
    await importerMillesimeIdccOpco(db, {
      millesime: M1,
      sourceUrl: URL_FICTIVE,
      couples: [{ idcc: "9001", opco: "atlas" }],
    });
    etat.lignes[0]!.intitule = "FICTIF — convention d'essai";
    etat.lignes[0]!.intituleSource = "https://exemple.invalid/FICTIF-liste";
    await importerMillesimeIdccOpco(db, {
      millesime: M2,
      sourceUrl: URL_FICTIVE,
      couples: [{ idcc: "9001", opco: "akto" }],
    });
    expect(etat.lignes).toEqual([
      expect.objectContaining({
        opco: "akto",
        intitule: "FICTIF — convention d'essai",
        intituleSource: "https://exemple.invalid/FICTIF-liste",
      }),
    ]);
  });
});

describe("calculerChangements", () => {
  it("journalise les ajouts et disparitions seuls, sans arbitrer entre deux OPCO", () => {
    expect(
      calculerChangements(
        [
          { idcc: "9001", opco: "atlas" },
          { idcc: "9002", opco: "akto" },
        ],
        [
          { idcc: "9001", opco: "atlas" },
          { idcc: "9001", opco: "afdas" },
          { idcc: "9003", opco: "akto" },
        ],
      ),
    ).toEqual([
      { idcc: "9001", ancienOpco: null, nouvelOpco: "afdas" },
      { idcc: "9002", ancienOpco: "akto", nouvelOpco: null },
      { idcc: "9003", ancienOpco: null, nouvelOpco: "akto" },
    ]);
  });
});
