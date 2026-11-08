/**
 * Calendrier AI Act à jour dans la matière éditoriale (lot W2, 08/11/2026).
 *
 * Le règlement (UE) 2026/1744 (« omnibus numérique IA », en vigueur le 27/07/2026)
 * a reporté les obligations « haut risque » : annexe III au 02/12/2027, annexe I au
 * 02/08/2028. Il a réécrit l'article 4 (maîtrise de l'IA) sans le reporter.
 * Ce test lit le TEXTE des fichiers de contenu, phrase par phrase, et refuse les
 * formulations périmées. Il exige aussi que chaque fiche sectorielle qui parle du
 * calendrier cite l'omnibus et porte une date de relecture postérieure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_SECTOR_KB_ENTRIES } from "../../../content/knowledge/sector-entries";
import { KB_VILLES_ALL } from "./villes-facts";
import { KB_AUDITS } from "./audits";
import { KB_INTERVENTIONS_FORMATIONS } from "./interventions-formations";
import { KB_IMPLEMENTATIONS } from "./implementations";
import { KB_SITES_WEB_AUGMENTES } from "./sites-web-augmentes";

const RACINE = join(__dirname, "..", "..", "..", "..");
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

/**
 * Une PHRASE reste juste si elle dit explicitement que la date a été reportée.
 * L'exemption s'applique phrase par phrase, jamais à toute la ligne : dans ces
 * fichiers, une ligne est souvent un paragraphe entier, et un seul « omnibus »
 * masquerait sinon une date fausse plus loin dans le même paragraphe.
 * « report » est borné (« reporté », « reportée »…) pour ne pas exempter « reporting ».
 */
const MENTION_DU_REPORT =
  /\breport(é|ée|és|ées|er|e)?\b|initialement|au lieu d|instead of|postponed|omnibus|2026\/1744/i;

/** Découpe une ligne en phrases, sans couper « art. 50 » ni « (UE) 2024/1689 ». */
const phrases = (ligne: string): string[] =>
  ligne.split(/(?<=\S[.;!?])\s+(?=[A-ZÀÂÇÉÈÊ«*\-–—#])|\\n/u);

const AOUT_2026 = String.raw`(ao[uû]t 2026|august 2026|aug\.? 2026|0?2\/08\/2026|2026-08-02|august 2, 2026)`;
const AOUT_2027 = String.raw`(ao[uû]t 2027|august 2027|aug\.? 2027|0?2\/08\/2027|2027-08-02)`;
const HAUT_RISQUE = String.raw`(haut risque|high-risk|annexe III|annex III)`;
const re = (src: string) => new RegExp(src, "i");

const REGLES: ReadonlyArray<{ nom: string; motif: RegExp }> = [
  {
    nom: "haut risque / annexe III placé en août 2026 (reporté au 02/12/2027)",
    motif: re(`${HAUT_RISQUE}.*${AOUT_2026}|${AOUT_2026}.*${HAUT_RISQUE}`),
  },
  {
    nom: "annexe I / produits réglementés placés en août 2027 (reporté au 02/08/2028)",
    motif: re(
      `${AOUT_2027}.*(annexe I\\b|produits|dispositifs|directives|haut risque)|(annexe I\\b|haut risque).*${AOUT_2027}`,
    ),
  },
  {
    nom: "« 3 août 2026 » (la date d'application est le 2 août)",
    motif: /\b3 ao[uû]t 2026|\b3 august 2026|03\/08\/2026/i,
  },
  {
    nom: "« plein effet » ou « application jusqu'à » août 2026 (le calendrier court jusqu'en 2028)",
    motif: re(
      `(plein effet|pleinement|fully applicable|jusqu'à ${AOUT_2026}|until ${AOUT_2026}).*2026|${AOUT_2026}.*(plein effet|pleinement)`,
    ),
  },
  {
    nom: "article 50 présenté comme applicable dès 2025",
    motif: /(art(icle)?\.? ?50)[^\n]*(depuis|dès|since)[^\n]*2025/i,
  },
  {
    nom: "« deadline » ou échéance AI Act en août 2026 pour le haut risque ou l'art. 22",
    motif: re(`deadline.*${AOUT_2026}|${AOUT_2026}.*deadline`),
  },
];

describe("le découpage en phrases ne laisse pas une exemption masquer une faute", () => {
  it("une phrase fausse après une phrase exemptée est détectée", () => {
    const ligne =
      "Le règlement (UE) 2026/1744 a reporté l'annexe III. Les obligations haut risque s'appliquent en août 2026.";
    const fautives = phrases(ligne).filter(
      (p) => !MENTION_DU_REPORT.test(p) && REGLES.some((r) => r.motif.test(p)),
    );
    expect(fautives).toHaveLength(1);
  });
  it("« reporting » n'exempte pas une phrase", () => {
    expect(MENTION_DU_REPORT.test("Un reporting haut risque dès août 2026.")).toBe(false);
  });
  it("une date numérique est vue", () => {
    expect(REGLES[0]!.motif.test("Obligations haut risque au 02/08/2026.")).toBe(true);
  });
});

describe("contenu AI Act : aucune date périmée", () => {
  for (const fichier of FICHIERS) {
    it(fichier, () => {
      const lignes = readFileSync(join(RACINE, fichier), "utf8").split("\n");
      const fautes: string[] = [];
      lignes.forEach((ligne, i) => {
        for (const p of phrases(ligne)) {
          if (MENTION_DU_REPORT.test(p)) continue;
          for (const r of REGLES) {
            if (r.motif.test(p))
              fautes.push(`${fichier}:${i + 1} — ${r.nom} — « ${p.slice(0, 120)} »`);
          }
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
  const TOUS = [
    ...KB_VILLES_ALL,
    ...KB_AUDITS,
    ...KB_INTERVENTIONS_FORMATIONS,
    ...KB_IMPLEMENTATIONS,
    ...KB_SITES_WEB_AUGMENTES,
  ];
  const fait = (id: string) => {
    const f = TOUS.find((x) => x.id === id);
    if (!f) throw new Error(`fait ${id} absent`);
    return f;
  };

  it("ai-act-001 donne les deux dates de report du haut risque", () => {
    const t = fait("ai-act-001").text;
    expect(t).toMatch(/2 décembre 2027/);
    expect(t).toMatch(/2 août 2028/);
    expect(t).toMatch(/2026\/1744/);
  });

  it("form-059 : article 4 applicable depuis le 2 février 2025, assoupli, sans niveau garanti", () => {
    const t = fait("form-059").text;
    expect(t).toMatch(/2 février 2025/);
    expect(t).toMatch(/sans (devoir )?garantir/);
    expect(t).not.toMatch(/suffisant/);
  });

  it("art. 50 : applicable depuis le 2 août 2026 (audit-026, ai-act-025, web-017)", () => {
    for (const id of ["audit-026", "ai-act-025", "web-017"]) {
      expect(fait(id).text).toMatch(/2 août 2026/);
    }
  });

  it("ai-act-010 : n'affirme plus une désignation française qui n'a pas eu lieu", () => {
    expect(fait("ai-act-010").text).not.toMatch(/a été confirmée/);
  });

  it("ai-act-029 : plus de chiffre attribué au CNNum sans source", () => {
    expect(fait("ai-act-029").text).not.toMatch(/CNNum|200 000/);
  });

  it("tout fait qui invoque l'omnibus cite le règlement (UE) 2026/1744 dans sa source", () => {
    const fautifs = TOUS.filter((f) => /omnibus/i.test(f.text))
      .filter((f) => !/2026\/1744/.test(f.source + " " + f.sourceUrl))
      .map((f) => f.id);
    expect(fautifs).toEqual([]);
  });
});
