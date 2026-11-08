/**
 * Calendrier AI Act à jour dans la matière éditoriale (lot W2, 08/11/2026).
 *
 * Le règlement (UE) 2026/1744 (« omnibus numérique IA », en vigueur le 27/07/2026)
 * a reporté les obligations « haut risque » : annexe III au 02/12/2027, annexe I au
 * 02/08/2028. Il a réécrit l'article 4 (maîtrise de l'IA) sans le reporter.
 * Ce test lit le TEXTE des fichiers de contenu, ligne par ligne, et refuse les
 * formulations périmées. Il exige aussi que chaque fiche sectorielle qui parle du
 * calendrier cite l'omnibus et porte une date de relecture postérieure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_SECTOR_KB_ENTRIES } from "./sector-entries";

const RACINE = join(__dirname, "..", "..", "..");
const dossier = (d: string) =>
  readdirSync(join(RACINE, d))
    .filter((f) => f.endsWith(".ts") && !f.includes(".test.") && !f.includes(".spec."))
    .map((f) => join(d, f));

const FICHIERS: readonly string[] = [
  ...dossier("src/content/knowledge/sector-entries"),
  ...dossier("src/server/content-gen/kb"),
  ...dossier("src/content/keywords"),
  "src/content/transversal.ts",
  "src/content/glossary-extension.ts",
  "src/content/formations/catalog-v2.ts",
];

/** Une ligne reste juste si elle dit explicitement que la date a été reportée. */
const MENTION_DU_REPORT = /report|initialement|au lieu d|instead of|postponed|omnibus|2026\/1744/i;

const REGLES: ReadonlyArray<{ nom: string; motif: RegExp }> = [
  {
    nom: "haut risque / annexe III placé en août 2026 (reporté au 02/12/2027)",
    motif:
      /(haut risque|high-risk|annexe III|annex III)[^\n]*(ao[uû]t 2026|august 2026)|(ao[uû]t 2026|august 2026)[^\n]*(haut risque|high-risk|annexe III|annex III)/i,
  },
  {
    nom: "annexe I / produits réglementés placés en août 2027 (reporté au 02/08/2028)",
    motif:
      /(ao[uû]t 2027|august 2027)[^\n]*(annexe I\b|produits|dispositifs|directives|haut risque)|(annexe I\b|haut risque)[^\n]*(ao[uû]t 2027)/i,
  },
  {
    nom: "« 3 août 2026 » (la date d'application est le 2 août)",
    motif: /3 ao[uû]t 2026|3 august 2026/i,
  },
  {
    nom: "« plein effet » ou « application jusqu'à » août 2026 (le calendrier court jusqu'en 2028)",
    motif:
      /(plein effet|pleinement|fully applicable|jusqu'à ao[uû]t 2026|until august 2026)[^\n]*2026|(ao[uû]t 2026|august 2026)[^\n]*(plein effet|pleinement)/i,
  },
  {
    nom: "article 50 présenté comme applicable dès 2025",
    motif: /(art(icle)?\.? ?50)[^\n]*(depuis|dès|since)[^\n]*2025/i,
  },
  {
    nom: "« deadline » ou échéance AI Act en août 2026 pour le haut risque ou l'art. 22",
    motif: /deadline[^\n]*(ao[uû]t 2026)|(ao[uû]t 2026)[^\n]*deadline/i,
  },
];

describe("contenu AI Act : aucune date périmée", () => {
  for (const fichier of FICHIERS) {
    it(fichier, () => {
      const lignes = readFileSync(join(RACINE, fichier), "utf8").split("\n");
      const fautes: string[] = [];
      lignes.forEach((ligne, i) => {
        if (MENTION_DU_REPORT.test(ligne)) return;
        for (const r of REGLES) {
          if (r.motif.test(ligne)) fautes.push(`${fichier}:${i + 1} — ${r.nom}`);
        }
      });
      expect(fautes).toEqual([]);
    });
  }
});

describe("fiches sectorielles qui datent l'AI Act : source et relecture", () => {
  const PARLE_AI_ACT = /AI Act|2024\/1689|règlement européen sur l'IA/i;
  const DATE_D_ECHEANCE = /(février|ao[uû]t|décembre) 20(25|26|27|28)/i;
  const concernees = ALL_SECTOR_KB_ENTRIES.filter(
    (e) => PARLE_AI_ACT.test(e.bodyMarkdownFr) && DATE_D_ECHEANCE.test(e.bodyMarkdownFr),
  );

  it("au moins une fiche est concernée (le filtre n'est pas vide)", () => {
    expect(concernees.length).toBeGreaterThan(0);
  });

  for (const e of concernees) {
    it(`${e.slug} : cite l'omnibus (UE) 2026/1744 et relue le 08/11/2026 ou après`, () => {
      expect(e.sources.some((s) => /2026\/1744|32026R1744/.test(s))).toBe(true);
      expect(e.lastReviewedOn >= "2026-11-08").toBe(true);
    });
  }
});

describe("faits KB AI Act : calendrier de l'omnibus écrit en clair", () => {
  // Import dynamique : le module KB est lourd, on ne le charge que pour ce bloc.
  const charger = async () => {
    const m = await import("../../server/content-gen/kb/villes-facts");
    const a = await import("../../server/content-gen/kb/audits");
    const i = await import("../../server/content-gen/kb/interventions-formations");
    const im = await import("../../server/content-gen/kb/implementations");
    const w = await import("../../server/content-gen/kb/sites-web-augmentes");
    return [
      ...m.KB_VILLES_ALL,
      ...a.KB_AUDITS,
      ...i.KB_INTERVENTIONS_FORMATIONS,
      ...im.KB_IMPLEMENTATIONS,
      ...w.KB_SITES_WEB_AUGMENTES,
    ];
  };
  const fait = async (id: string) => {
    const f = (await charger()).find((x) => x.id === id);
    if (!f) throw new Error(`fait ${id} absent`);
    return f;
  };

  it("ai-act-001 donne les deux dates de report du haut risque", async () => {
    const t = (await fait("ai-act-001")).text;
    expect(t).toMatch(/2 décembre 2027/);
    expect(t).toMatch(/2 août 2028/);
    expect(t).toMatch(/2026\/1744/);
  });

  it("form-059 : article 4 applicable depuis le 2 février 2025, assoupli, sans niveau garanti", async () => {
    const t = (await fait("form-059")).text;
    expect(t).toMatch(/2 février 2025/);
    expect(t).toMatch(/sans (devoir )?garantir/);
    expect(t).not.toMatch(/suffisant/);
  });

  it("art. 50 : applicable depuis le 2 août 2026 (audit-026, ai-act-025, web-017)", async () => {
    for (const id of ["audit-026", "ai-act-025", "web-017"]) {
      expect((await fait(id)).text).toMatch(/2 août 2026/);
    }
  });

  it("ai-act-010 : n'affirme plus une désignation française qui n'a pas eu lieu", async () => {
    expect((await fait("ai-act-010")).text).not.toMatch(/a été confirmée/);
  });

  it("ai-act-029 : plus de chiffre attribué au CNNum sans source", async () => {
    expect((await fait("ai-act-029")).text).not.toMatch(/CNNum|200 000/);
  });

  it("tout fait qui invoque l'omnibus cite le règlement (UE) 2026/1744 dans sa source", async () => {
    const fautifs = (await charger())
      .filter((f) => /omnibus/i.test(f.text))
      .filter((f) => !/2026\/1744/.test(f.source + " " + f.sourceUrl))
      .map((f) => f.id);
    expect(fautifs).toEqual([]);
  });
});
