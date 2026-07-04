/**
 * PILOTE — Test d'acceptation end-to-end (Isère 38 · BTP + Santé), grandeur
 * réduite, sur fixtures (aucun SIREN réel, aucune collecte prod — directive Will).
 *
 * Compose les vraies fonctions du pipeline : ingest Stock → dénominateur →
 * expansion campagne → collecte (comptage + exhaustivité) → enrichissement 2
 * passes → rollup couverture dép→région→France → opt-out post-collecte → export
 * segmenté re-filtré. Prouve la définition de « done » (reference/02).
 */

import { describe, it, expect } from "vitest";
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
import { enrichCompany, type EnrichConfig, type EnrichDb } from "./enrichment/enrich-service";
import type { MxResolver } from "./enrichment/email";
import { buildSegmentedExport, type ExportRowWithRgpd } from "./export/generate";
import { buildSuppressionSets } from "./rgpd/export-filter";

// --- Fixtures Stock Isère (38) : BTP (41.20A) + Santé (86.10Z), + 1 non-diffusible ---
const UL = `siren,denominationUniteLegale,activitePrincipaleUniteLegale,trancheEffectifsUniteLegale,categorieJuridiqueUniteLegale,statutDiffusionUniteLegale,etatAdministratifUniteLegale
380000001,ISERE CONSTRUCTION,41.20A,12,5710,O,A
380000002,ALPES BATIMENT,41.20A,12,5710,O,A
380000003,CABINET MEDICAL VERCORS,86.10Z,21,5710,O,A
380000004,SECRET BTP,41.20A,11,5710,N,A
`;
const ET = `siret,siren,etablissementSiege,activitePrincipaleEtablissement,trancheEffectifsEtablissement,codeCommuneEtablissement,codePostalEtablissement,libelleCommuneEtablissement,statutDiffusionEtablissement,etatAdministratifEtablissement
38000000100011,380000001,true,41.20A,12,38185,38000,GRENOBLE,O,A
38000000200012,380000002,true,41.20A,12,38185,38000,GRENOBLE,O,A
38000000300013,380000003,true,86.10Z,21,38185,38000,GRENOBLE,O,A
38000000400014,380000004,true,41.20A,11,38185,38000,GRENOBLE,N,A
`;

// Site public d'une entreprise pilote (confirme domaine + coordonnées + équipe).
const SITE_PAGES: Record<string, string> = {
  "/": `<p>ISERE CONSTRUCTION SAS — SIREN 380000001</p><a href="mailto:contact@isere-construction.fr">c</a><a href="tel:0476001122">t</a>`,
  "/equipe": `<ul><li>Jean DUPONT — Directeur Général</li><li>Marie MARTIN, Responsable des achats</li></ul>`,
};

interface Store {
  companies: Map<
    string,
    {
      siren: string;
      naf: string;
      taille: string;
      statutDiffusion: string;
      departement: string;
      secteur: string;
      optOut: boolean;
    }
  >;
  stockRefs: Map<string, StockRefRow>;
}

function ingestDb(store: Store): IngestDb {
  return {
    prospectionCompany: {
      async upsert(a: {
        where: { siren: string };
        create: { naf?: string | null; taille?: string | null; secteur?: string | null };
      }) {
        store.companies.set(a.where.siren, {
          siren: a.where.siren,
          naf: a.create.naf ?? "",
          taille: a.create.taille ?? "",
          secteur: a.create.secteur ?? "",
          statutDiffusion: "diffusible",
          departement: "",
          optOut: false,
        });
        return {};
      },
      async updateMany(a: { where: { siren?: string }; data: { departement?: string | null } }) {
        const c = a.where.siren ? store.companies.get(a.where.siren) : undefined;
        if (c && a.data.departement) c.departement = a.data.departement;
        return { count: c ? 1 : 0 };
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
const ENRICH_CONFIG: EnrichConfig = {
  contactPaths: ["/mentions-legales", "/contact"],
  teamPaths: ["/equipe"],
  maxPagesContact: 3,
  maxPagesPersonnes: 4,
  maxPagesEntreprise: 10,
  maxTeamAttempts: 6,
  enrichirPersonnes: true,
};

describe("PILOTE Isère 38 · BTP + Santé — end-to-end (fixtures)", () => {
  it("ingest → collecte → enrichissement → couverture → opt-out → export", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pilot-"));
    const ulP = path.join(dir, "ul.csv");
    const etP = path.join(dir, "et.csv");
    writeFileSync(ulP, UL);
    writeFileSync(etP, ET);

    const store: Store = { companies: new Map(), stockRefs: new Map() };

    // 1) INGEST Stock (le non-diffusible 380000004 est exclu — RGPD #4)
    const summary = await ingestSireneStock(
      new LocalFileStockSource({ uniteLegale: ulP, etablissement: etP }),
      ingestDb(store),
    );
    expect(summary.uniteLegaleUpserted).toBe(3); // 3 diffusibles
    expect(store.companies.has("380000004")).toBe(false); // non-diffusible jamais en base
    // Dénominateur : (38,41.20A,PME)=2, (38,86.10Z,PME)=1
    expect(store.stockRefs.get("38|41.20A|PME")?.stockAttendu).toBe(2);
    expect(store.stockRefs.get("38|86.10Z|PME")?.stockAttendu).toBe(1);

    // 2) EXPANSION campagne (38 · BTP+Santé · PME) → cellules paresseuses
    const refs = [...store.stockRefs.values()];
    const cells = cellsFromStockRefs(
      { departements: ["38"], secteurs: ["btp", "sante"], nafCodes: [], tailles: ["PME"] },
      refs,
    );
    expect(cells).toHaveLength(2); // BTP + Santé

    // 3) COLLECTE : compte les entreprises prospectables de chaque cellule
    for (const cell of cells) {
      const collecte = [...store.companies.values()].filter(
        (c) =>
          c.naf === cell.naf &&
          c.taille === cell.taille &&
          c.statutDiffusion === "diffusible" &&
          !c.optOut,
      ).length;
      const statut = decideCellOutcome(collecte, cell.attendu);
      expect(statut).toBe("fait"); // exhaustivité prouvée (collecte == attendu)
    }

    // 4) ENRICHISSEMENT (2 passes) d'une entreprise pilote → responsables captés (#7)
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
    const enrichRes = await enrichCompany(
      {
        id: "380000001",
        siren: "380000001",
        denomination: "ISERE CONSTRUCTION",
        siteWeb: "https://isere-construction.fr",
      },
      ENRICH_CONFIG,
      {
        mxResolver: mxOk,
        db: enrichDb,
        async fetchPage(url) {
          const p = new URL(url).pathname;
          const html = SITE_PAGES[p];
          return html
            ? { url, ok: true, status: 200, text: html }
            : { url, ok: false, status: 404, text: "" };
        },
      },
    );
    expect(enrichRes.domainConfirmed).toBe(true);
    expect(enrichRes.persons).toBe(2); // Jean DUPONT + Marie MARTIN (responsables de secteur)
    expect(enrichRes.contactabilite).toBe("exploitable");

    // 5) COUVERTURE dép→région→France
    const perDep = aggregatePerDepartement({
      contactabilite: [
        { departement: "38", contactabilite: "exploitable", count: 1 },
        { departement: "38", contactabilite: "non_contactable", count: 2 },
      ],
      enriched: [{ departement: "38", count: 1 }],
      stock: [{ departement: "38", stockAttendu: 3 }],
    });
    const stats = rollupDepartementsToRegionsToFrance(perDep);
    const ara = stats.find((s) => s.scope === "region" && s.scopeId === "84");
    const fr = stats.find((s) => s.scope === "france");
    expect(ara?.collectees).toBe(3); // Isère → Auvergne-Rhône-Alpes
    expect(fr?.pctCompletion).toBeCloseTo(1); // 3 collectées / 3 stock

    // 6) OPT-OUT post-collecte sur une entreprise (droit d'opposition)
    const suppressions = buildSuppressionSets([{ type: "siren", valueNormalized: "380000002" }]);

    // 7) EXPORT segmenté re-filtré : exclut non-diffusible (#4) + opt-out (#5)
    const rows: ExportRowWithRgpd[] = [...store.companies.values()].map((c) => ({
      siren: c.siren,
      denomination: c.siren,
      naf: c.naf,
      secteur: c.secteur,
      taille: c.taille,
      departement: "38",
      commune: "Grenoble",
      emailPrincipal: c.siren === "380000001" ? "contact@isere-construction.fr" : null,
      telephonePrincipal: null,
      contactabilite: c.siren === "380000001" ? "exploitable" : "non_contactable",
      leadScore: null,
      source: "stock_sirene",
      lastCollectedAt: null,
      statutDiffusion: c.statutDiffusion,
      optOut: c.optOut,
      emails: c.siren === "380000001" ? ["contact@isere-construction.fr"] : [],
    }));
    const exp = buildSegmentedExport(rows, suppressions);
    expect(exp.excluded).toBe(1); // 380000002 opposé (#5)
    expect(exp.excludedByReason.siren).toBe(1);
    expect(exp.counts.exploitables).toBe(1); // ISERE CONSTRUCTION
    // 380000004 (non-diffusible) n'est jamais entré en base → jamais exporté (#4)
    expect(rows.find((r) => r.siren === "380000004")).toBeUndefined();

    rmSync(dir, { recursive: true, force: true });
  });
});
