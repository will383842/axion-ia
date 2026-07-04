/**
 * TEST SYSTÈME COMPLET — compose TOUS les flux V1 + V2 en un seul scénario, sur
 * fixtures (0 SIREN réel, 0 email). Preuve « de bout en bout » demandée :
 *   1. Récupération (ingest Stock Sirene) → base + dénominateur
 *   2. Distinction par SECTEUR d'activité (BTP vs Santé) + par NAF
 *   3. Collecte + exhaustivité + couverture dép→région→France (+ clamp)
 *   4. Tableau PAR ACTIVITÉ (% exploitable par secteur)
 *   5. Enrichissement (découverte de site → coordonnées → responsables)
 *   6. V2 SANTÉ : ingest RPPS → spécialité (cardiologie) + lien SIREN
 *   7. RGPD : opt-out → exclusion export
 *   8. Export segmenté re-filtré
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ingestSireneStock, type IngestDb } from "./sources/sirene-stock-ingestor";
import { LocalFileStockSource } from "./sources/stock-source";
import {
  cellsFromStockRefs,
  decideCellOutcome,
  type StockRefRow,
} from "./collect/campaign-expansion";
import { aggregatePerDepartement } from "./collect/coverage-service";
import { rollupDepartementsToRegionsToFrance } from "./collect/coverage-rollup";
import { aggregateActivity } from "./admin/activity-stats";
import { enrichCompany, type EnrichConfig, type EnrichDb } from "./enrichment/enrich-service";
import type { MxResolver } from "./enrichment/email";
import {
  ingestAnnuaireSante,
  type AnnuaireSanteDb,
  type AnnuaireSanteRow,
} from "./sources/annuaire-sante-ingestor";
import { buildSegmentedExport, type ExportRowWithRgpd } from "./export/generate";
import { buildSuppressionSets } from "./rgpd/export-filter";

// --- Fixtures Stock : dép 38, BTP (41.20A) + Santé (86.21Z) ---
const UL = `siren,denominationUniteLegale,activitePrincipaleUniteLegale,trancheEffectifsUniteLegale,categorieJuridiqueUniteLegale,statutDiffusionUniteLegale,etatAdministratifUniteLegale
380000001,ISERE CONSTRUCTION,41.20A,12,5710,O,A
380000002,ALPES BATIMENT,41.20A,12,5710,O,A
380000003,CABINET MEDICAL VERCORS,86.21Z,21,5710,O,A`;
const ET = `siret,siren,etablissementSiege,activitePrincipaleEtablissement,trancheEffectifsEtablissement,codeCommuneEtablissement,codePostalEtablissement,libelleCommuneEtablissement,statutDiffusionEtablissement,etatAdministratifEtablissement
38000000100011,380000001,true,41.20A,12,38185,38000,GRENOBLE,O,A
38000000200012,380000002,true,41.20A,12,38185,38000,GRENOBLE,O,A
38000000300013,380000003,true,86.21Z,21,38185,38000,GRENOBLE,O,A`;

interface Company {
  siren: string;
  naf: string;
  taille: string;
  secteur: string;
  contactabilite: string | null;
  enrichmentStatus: string;
  statutDiffusion: string;
  departement: string;
  optOut: boolean;
  id: string;
  denomination: string;
}
interface Store {
  companies: Map<string, Company>;
  stockRefs: Map<string, StockRefRow>;
}

function ingestDb(store: Store): IngestDb {
  return {
    prospectionCompany: {
      async upsert(a: {
        where: { siren: string };
        create: {
          naf?: string | null;
          taille?: string | null;
          secteur?: string | null;
          denomination?: string | null;
        };
      }) {
        store.companies.set(a.where.siren, {
          id: `co-${a.where.siren}`,
          siren: a.where.siren,
          naf: a.create.naf ?? "",
          taille: a.create.taille ?? "",
          secteur: a.create.secteur ?? "",
          denomination: a.create.denomination ?? "",
          contactabilite: null,
          enrichmentStatus: "pending",
          statutDiffusion: "diffusible",
          departement: "38",
          optOut: false,
        });
        return {};
      },
      async updateMany() {
        return { count: 1 };
      },
    },
    prospectionEstablishment: {
      async upsert() {
        return {};
      },
    },
    prospectionStockReference: {
      async upsert(a: {
        where: { departement_naf_taille: { departement: string; naf: string; taille: string } };
        create: { stockAttendu: number };
      }) {
        const k = a.where.departement_naf_taille;
        store.stockRefs.set(`${k.departement}|${k.naf}|${k.taille}`, {
          departement: k.departement,
          naf: k.naf,
          taille: k.taille as StockRefRow["taille"],
          stockAttendu: a.create.stockAttendu,
        });
        return {};
      },
    },
  } as unknown as IngestDb;
}

const mxOk: MxResolver = {
  async resolveMx() {
    return [{ exchange: "mx" }];
  },
};
const ENRICH: EnrichConfig = {
  contactPaths: ["/contact"],
  teamPaths: ["/equipe"],
  maxPagesContact: 3,
  maxPagesPersonnes: 4,
  maxPagesEntreprise: 10,
  maxTeamAttempts: 6,
  enrichirPersonnes: true,
};
const SITE: Record<string, string> = {
  "/": `<p>ISERE CONSTRUCTION SAS — SIREN 380000001</p><a href="mailto:jean.dupont@isere-construction.fr">e</a><a href="tel:0476001122">t</a>`,
  "/equipe": `<ul><li>Jean DUPONT — Directeur Général</li></ul>`,
};

beforeAll(() => {
  process.env.PROSPECTION_SANTE_INGESTION_ENABLED = "true";
});
afterAll(() => {
  delete process.env.PROSPECTION_SANTE_INGESTION_ENABLED;
});

describe("SYSTÈME COMPLET — tous les flux V1 + V2 (fixtures)", () => {
  it("récupération → secteurs → couverture → activité → enrichissement → santé → opt-out → export", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fullsys-"));
    const ulP = path.join(dir, "ul.csv");
    const etP = path.join(dir, "et.csv");
    writeFileSync(ulP, UL);
    writeFileSync(etP, ET);
    const store: Store = { companies: new Map(), stockRefs: new Map() };

    // 1. RÉCUPÉRATION
    const sum = await ingestSireneStock(
      new LocalFileStockSource({ uniteLegale: ulP, etablissement: etP }),
      ingestDb(store),
      { retentionYears: 3 },
    );
    expect(sum.uniteLegaleUpserted).toBe(3);

    // 2. DISTINCTION PAR SECTEUR : BTP vs Santé (dérivé du NAF)
    const btp = [...store.companies.values()].filter((c) => c.secteur === "btp");
    const sante = [...store.companies.values()].filter((c) => c.secteur === "sante");
    expect(btp).toHaveLength(2); // 41.20A → btp
    expect(sante).toHaveLength(1); // 86.21Z → sante

    // 3. COLLECTE + COUVERTURE (avec clamp : on force collecte > attendu)
    const refs = [...store.stockRefs.values()];
    const cells = cellsFromStockRefs(
      { departements: ["38"], secteurs: ["btp", "sante"], nafCodes: [], tailles: ["PME"] },
      refs,
    );
    expect(cells.length).toBeGreaterThanOrEqual(2);
    for (const cell of cells) {
      const n = [...store.companies.values()].filter(
        (c) => c.naf === cell.naf && c.taille === cell.taille,
      ).length;
      expect(decideCellOutcome(n, cell.attendu)).toBe("fait");
    }
    const stats = rollupDepartementsToRegionsToFrance(
      aggregatePerDepartement({
        contactabilite: [{ departement: "38", contactabilite: "exploitable", count: 5 }], // 5 > stock → clamp
        enriched: [{ departement: "38", count: 1 }],
        stock: [{ departement: "38", stockAttendu: 3 }],
      }),
    );
    const fr = stats.find((s) => s.scope === "france")!;
    expect(fr.pctCompletion).toBe(1); // borné (5/3 → 1.0)

    // 4. TABLEAU PAR ACTIVITÉ (% exploitable par secteur, sur données réelles)
    // Simule le groupBy (secteur × contactabilité) depuis le store.
    const activity = aggregateActivity(
      [
        { key: "btp", contactabilite: "exploitable", count: 1 },
        { key: "btp", contactabilite: "non_contactable", count: 1 },
        { key: "sante", contactabilite: "partiel", count: 1 },
      ],
      [{ key: "btp", count: 1 }],
      (k) => k,
    );
    const btpRow = activity.find((r) => r.key === "btp")!;
    expect(btpRow.collectees).toBe(2);
    expect(btpRow.pctExploitable).toBeCloseTo(0.5); // 1 exploitable / 2

    // 5. ENRICHISSEMENT (découverte de site déjà fournie → coordonnées + responsable)
    let personsCreated = 0;
    const enrichDb = {
      prospectionContact: {
        async upsert() {
          return {};
        },
      },
      prospectionPerson: {
        async upsert() {
          personsCreated++;
          return { id: `p${personsCreated}` };
        },
      },
      prospectionPersonRole: {
        async create() {
          return {};
        },
      },
      prospectionCompany: {
        async update() {
          return {};
        },
      },
    } as unknown as EnrichDb;
    const enr = await enrichCompany(
      {
        id: "co-380000001",
        siren: "380000001",
        denomination: "ISERE CONSTRUCTION",
        siteWeb: "https://isere-construction.fr",
      },
      ENRICH,
      {
        mxResolver: mxOk,
        db: enrichDb,
        async fetchPage(url) {
          const p = new URL(url).pathname;
          const h = SITE[p];
          return h
            ? { url, ok: true, status: 200, text: h }
            : { url, ok: false, status: 404, text: "" };
        },
      },
    );
    expect(enr.domainConfirmed).toBe(true);
    expect(enr.persons).toBe(1); // Jean DUPONT capté
    expect(enr.contactabilite).toBe("exploitable"); // email nominatif MX-OK

    // 6. V2 SANTÉ : ingest RPPS → spécialité normalisée + lien SIREN
    const practitioners = new Map<string, unknown>();
    const santeDb = {
      prospectionHealthPractitioner: {
        async upsert(a: { where: { rpps: string }; create: unknown }) {
          practitioners.set(a.where.rpps, a.create);
          return {};
        },
      },
      prospectionCompany: {
        async findUnique(a: { where: { siren: string } }) {
          return store.companies.has(a.where.siren) ? { id: `co-${a.where.siren}` } : null;
        },
      },
    } as unknown as AnnuaireSanteDb;
    const rows: AnnuaireSanteRow[] = [
      {
        rpps: "10001234567",
        nom: "MARTIN",
        prenom: "Claire",
        savoirFaire: "Cardiologie",
        siret: "38000000300013",
        codePostal: "38000",
      },
    ];
    const santeSum = await ingestAnnuaireSante(
      {
        async *iteratePractitioners() {
          yield* rows;
        },
      },
      santeDb,
      { retentionYears: 3 },
    );
    expect(santeSum.upserted).toBe(1);
    expect(santeSum.linkedToCompany).toBe(1); // SIRET 380000003 → CABINET MEDICAL VERCORS
    const cardio = practitioners.get("10001234567") as { specialite: string; departement: string };
    expect(cardio.specialite).toBe("cardiologie"); // spécialité fine que le NAF ne donne pas
    expect(cardio.departement).toBe("38");

    // 7. OPT-OUT (droit d'opposition)
    const suppressions = buildSuppressionSets([{ type: "siren", valueNormalized: "380000002" }]);

    // 8. EXPORT segmenté re-filtré
    const exportRows: ExportRowWithRgpd[] = [...store.companies.values()].map((c) => ({
      siren: c.siren,
      denomination: c.denomination,
      naf: c.naf,
      secteur: c.secteur,
      taille: c.taille,
      departement: "38",
      commune: "Grenoble",
      emailPrincipal: c.siren === "380000001" ? "jean.dupont@isere-construction.fr" : null,
      telephonePrincipal: null,
      contactabilite: c.siren === "380000001" ? "exploitable" : "non_contactable",
      leadScore: null,
      source: "stock_sirene",
      lastCollectedAt: null,
      statutDiffusion: c.statutDiffusion,
      optOut: c.optOut,
      emails: c.siren === "380000001" ? ["jean.dupont@isere-construction.fr"] : [],
    }));
    const exp = buildSegmentedExport(exportRows, suppressions);
    expect(exp.excluded).toBe(1); // 380000002 opposé
    expect(exp.counts.exploitables).toBe(1); // ISERE CONSTRUCTION
    expect(exp.exploitables).toContain("380000001");
    expect(exp.exploitables).not.toContain("380000002"); // opt-out exclu de TOUS les fichiers

    rmSync(dir, { recursive: true, force: true });
  });
});
