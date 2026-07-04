import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ingestSireneStock, type IngestDb } from "./sirene-stock-ingestor";
import { LocalFileStockSource } from "./stock-source";

const UL_CSV = `siren,denominationUniteLegale,activitePrincipaleUniteLegale,trancheEffectifsUniteLegale,categorieJuridiqueUniteLegale,statutDiffusionUniteLegale,etatAdministratifUniteLegale
100000001,ACME BTP,41.20A,12,5710,O,A
100000002,SANTE PLUS,86.10Z,21,5710,O,A
100000003,SECRET SARL,43.99Z,11,5710,N,A
100000004,DUPLICATA BTP,41.20A,12,5710,O,A
`;

const ET_CSV = `siret,siren,etablissementSiege,activitePrincipaleEtablissement,trancheEffectifsEtablissement,codeCommuneEtablissement,codePostalEtablissement,libelleCommuneEtablissement,statutDiffusionEtablissement,etatAdministratifEtablissement
10000000100011,100000001,true,41.20A,12,38185,38000,GRENOBLE,O,A
10000000200012,100000002,true,86.10Z,21,38185,38000,GRENOBLE,O,A
10000000300013,100000003,true,43.99Z,11,38185,38000,GRENOBLE,N,A
10000000400014,100000004,true,41.20A,12,38185,38000,GRENOBLE,O,A
`;

// Header délibérément cassé (SIREN majuscule) → toutes les lignes invalides.
const UL_CSV_ALTERED = `SIREN,denominationUniteLegale
100000001,ACME
100000002,SANTE
`;

interface FakeDb extends IngestDb {
  companies: Map<string, unknown>;
  establishments: Map<string, unknown>;
  stockRefs: Map<string, number>;
  updateManyCalls: number;
}

function makeFakeDb(): FakeDb {
  const companies = new Map<string, unknown>();
  const establishments = new Map<string, unknown>();
  const stockRefs = new Map<string, number>();
  const db = {
    companies,
    establishments,
    stockRefs,
    updateManyCalls: 0,
    prospectionCompany: {
      async upsert(args: { where: { siren: string }; create: unknown }) {
        companies.set(args.where.siren, args.create);
        return {};
      },
      async updateMany(args: { where: { siren?: string } }) {
        db.updateManyCalls++;
        const has = args.where.siren ? companies.has(args.where.siren) : false;
        return { count: has ? 1 : 0 };
      },
    },
    prospectionEstablishment: {
      async upsert(args: { where: { siret: string }; create: unknown }) {
        establishments.set(args.where.siret, args.create);
        return {};
      },
    },
    prospectionStockReference: {
      async upsert(args: {
        where: { departement_naf_taille: { departement: string; naf: string; taille: string } };
        create: { stockAttendu: number };
      }) {
        const k = args.where.departement_naf_taille;
        stockRefs.set(`${k.departement}|${k.naf}|${k.taille}`, args.create.stockAttendu);
        return {};
      },
    },
  };
  return db as unknown as FakeDb;
}

let dir: string;
let ulPath: string;
let etPath: string;
let ulAlteredPath: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "prospection-stock-"));
  ulPath = path.join(dir, "ul.csv");
  etPath = path.join(dir, "et.csv");
  ulAlteredPath = path.join(dir, "ul-altered.csv");
  writeFileSync(ulPath, UL_CSV);
  writeFileSync(etPath, ET_CSV);
  writeFileSync(ulAlteredPath, UL_CSV_ALTERED);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("ingestSireneStock — pipeline complet (fixtures)", () => {
  it("upsert les entreprises diffusibles, exclut les non-diffusibles (#4)", async () => {
    const db = makeFakeDb();
    const source = new LocalFileStockSource({ uniteLegale: ulPath, etablissement: etPath });
    const s = await ingestSireneStock(source, db, { batchSize: 2 });

    expect(s.uniteLegaleSeen).toBe(4);
    expect(s.uniteLegaleUpserted).toBe(3); // 100000003 non-diffusible exclu
    // RGPD : retentionUntil renseigné (sinon la purge est un no-op — vérif RGPD).
    const anyCompany = [...db.companies.values()][0] as { retentionUntil?: Date };
    expect(anyCompany.retentionUntil).toBeInstanceOf(Date);
    expect(s.uniteLegaleSkippedNonDiffusible).toBe(1);
    expect(db.companies.has("100000003")).toBe(false); // JAMAIS en base
    expect(db.companies.size).toBe(3);
  });

  it("exclut les établissements non-diffusibles + met à jour la géo du siège", async () => {
    const db = makeFakeDb();
    const source = new LocalFileStockSource({ uniteLegale: ulPath, etablissement: etPath });
    const s = await ingestSireneStock(source, db, { batchSize: 10 });

    expect(s.etablissementSeen).toBe(4);
    expect(s.etablissementUpserted).toBe(3);
    expect(s.etablissementSkippedNonDiffusible).toBe(1);
    expect(s.siegeGeoUpdated).toBe(3);
    expect(db.establishments.has("10000000300013")).toBe(false);
  });

  it("construit le dénominateur StockReference par (dép, naf, taille)", async () => {
    const db = makeFakeDb();
    const source = new LocalFileStockSource({ uniteLegale: ulPath, etablissement: etPath });
    const s = await ingestSireneStock(source, db, { batchSize: 10 });

    // (38, 41.20A, PME) = 2 entreprises ; (38, 86.10Z, PME) = 1
    expect(s.stockReferenceRows).toBe(2);
    expect(db.stockRefs.get("38|41.20A|PME")).toBe(2);
    expect(db.stockRefs.get("38|86.10Z|PME")).toBe(1);
  });

  it("compte les lignes invalides sans écrire de null (schéma altéré)", async () => {
    const db = makeFakeDb();
    const source = new LocalFileStockSource({ uniteLegale: ulAlteredPath });
    const s = await ingestSireneStock(source, db, { batchSize: 10 });

    expect(s.uniteLegaleSeen).toBe(2);
    expect(s.invalidUniteLegaleRows).toBe(2);
    expect(s.uniteLegaleUpserted).toBe(0);
    expect(db.companies.size).toBe(0); // aucune écriture bidon
  });

  it("idempotent : ré-ingérer ne crée AUCUN doublon (#6)", async () => {
    const db = makeFakeDb();
    const source1 = new LocalFileStockSource({ uniteLegale: ulPath, etablissement: etPath });
    await ingestSireneStock(source1, db, { batchSize: 10 });
    const source2 = new LocalFileStockSource({ uniteLegale: ulPath, etablissement: etPath });
    await ingestSireneStock(source2, db, { batchSize: 10 });

    expect(db.companies.size).toBe(3); // upsert (pas insert aveugle)
    expect(db.establishments.size).toBe(3);
    expect(db.stockRefs.get("38|41.20A|PME")).toBe(2);
  });

  it("établissement diffusible d'une UL non-diffusible = jamais connecté (garde-fou FK)", async () => {
    const ul = `siren,denominationUniteLegale,activitePrincipaleUniteLegale,trancheEffectifsUniteLegale,categorieJuridiqueUniteLegale,statutDiffusionUniteLegale,etatAdministratifUniteLegale
200000009,SECRET,41.20A,12,5710,N,A
`;
    const et = `siret,siren,etablissementSiege,activitePrincipaleEtablissement,trancheEffectifsEtablissement,codeCommuneEtablissement,codePostalEtablissement,libelleCommuneEtablissement,statutDiffusionEtablissement,etatAdministratifEtablissement
20000000900011,200000009,true,41.20A,12,38185,38000,GRENOBLE,O,A
`;
    const ulP = path.join(dir, "ul9.csv");
    const etP = path.join(dir, "et9.csv");
    writeFileSync(ulP, ul);
    writeFileSync(etP, et);
    const db = makeFakeDb();
    const s = await ingestSireneStock(
      new LocalFileStockSource({ uniteLegale: ulP, etablissement: etP }),
      db,
    );
    expect(s.uniteLegaleSkippedNonDiffusible).toBe(1);
    expect(s.etablissementSkippedNonDiffusible).toBe(1); // ET diffusible mais UL écartée
    expect(db.establishments.size).toBe(0); // aucun connect vers une Company absente
    expect(db.companies.size).toBe(0);
  });

  it("dénominateur dédupliqué par SIRET (un siège répété ne gonfle pas stockAttendu)", async () => {
    const ul = `siren,denominationUniteLegale,activitePrincipaleUniteLegale,trancheEffectifsUniteLegale,categorieJuridiqueUniteLegale,statutDiffusionUniteLegale,etatAdministratifUniteLegale
400000001,ACME,41.20A,12,5710,O,A
`;
    // Même SIRET siège répété (correction dans le fichier Stock).
    const et = `siret,siren,etablissementSiege,activitePrincipaleEtablissement,trancheEffectifsEtablissement,codeCommuneEtablissement,codePostalEtablissement,libelleCommuneEtablissement,statutDiffusionEtablissement,etatAdministratifEtablissement
40000000100011,400000001,true,41.20A,12,38185,38000,GRENOBLE,O,A
40000000100011,400000001,true,41.20A,12,38185,38000,GRENOBLE,O,A
`;
    const ulP = path.join(dir, "ul-dup.csv");
    const etP = path.join(dir, "et-dup.csv");
    writeFileSync(ulP, ul);
    writeFileSync(etP, et);
    const db = makeFakeDb();
    await ingestSireneStock(new LocalFileStockSource({ uniteLegale: ulP, etablissement: etP }), db);
    expect(db.establishments.size).toBe(1); // dédup SIRET
    expect(db.stockRefs.get("38|41.20A|PME")).toBe(1); // compté UNE fois, pas 2
  });

  it("une erreur DB par ligne (P2025 orphelin) ne casse pas tout le run", async () => {
    // Fake db dont l'upsert établissement jette P2025 (company introuvable).
    const companies = new Map<string, unknown>();
    const p2025 = Object.assign(new Error("not found"), { code: "P2025" });
    const db = {
      companies,
      prospectionCompany: {
        async upsert(a: { where: { siren: string }; create: unknown }) {
          companies.set(a.where.siren, a.create);
          return {};
        },
        async updateMany() {
          return { count: 0 };
        },
      },
      prospectionEstablishment: {
        async upsert() {
          throw p2025;
        },
      },
      prospectionStockReference: {
        async upsert() {
          return {};
        },
      },
    } as unknown as IngestDb;
    const source = new LocalFileStockSource({ uniteLegale: ulPath, etablissement: etPath });
    const s = await ingestSireneStock(source, db); // ne doit PAS throw
    expect(s.etablissementOrphanSkipped).toBeGreaterThan(0);
    expect(s.etablissementUpserted).toBe(0);
  });

  it("gère un BOM UTF-8 en tête de fichier (header non corrompu)", async () => {
    const ulBom =
      String.fromCharCode(0xfeff) +
      `siren,denominationUniteLegale,activitePrincipaleUniteLegale,trancheEffectifsUniteLegale,categorieJuridiqueUniteLegale,statutDiffusionUniteLegale,etatAdministratifUniteLegale
300000001,ACME,41.20A,12,5710,O,A
`;
    const ulP = path.join(dir, "ul-bom.csv");
    writeFileSync(ulP, ulBom);
    const db = makeFakeDb();
    const s = await ingestSireneStock(new LocalFileStockSource({ uniteLegale: ulP }), db);
    expect(s.uniteLegaleSeen).toBe(1);
    expect(s.invalidUniteLegaleRows).toBe(0); // le BOM n'a pas cassé la colonne siren
    expect(s.uniteLegaleUpserted).toBe(1);
    expect(db.companies.has("300000001")).toBe(true);
  });
});
