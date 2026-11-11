/**
 * Pack « Journée IA » du 10/11/2026 — garde d'import dans la base de connaissance.
 * Tests écrits avant le module : contrat de tri, de doctrine et d'idempotence.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyserPack,
  controlerFiche,
  lignesDepuisJsonl,
  versEntreeKnowledge,
  type LignePack,
} from "./pack-journee-ia";

const CHEMIN = join(process.cwd(), "docs/knowledge/pack-journee-ia-2026-11-10/Base_RAG.jsonl");

function faq(over: Partial<LignePack> = {}): LignePack {
  return {
    id: "GEO-900",
    type: "faq_knowledge",
    question: "Que contient la Journée IA ?",
    answer_draft: "Un audit le matin et une formation des équipes l’après-midi.",
    source: "INT-03",
    status: "Fait de l’offre",
    publication_gate: "À valider / ne pas publier automatiquement",
    source_date: "2026-11-10",
    publish_directly: false,
    ...over,
  };
}

describe("controlerFiche — doctrine et décisions de Williams", () => {
  it("accepte une fiche propre", () => {
    expect(controlerFiche(faq()).ok).toBe(true);
  });
  it("accepte le seul prix autorisé : Journée IA 1 490 € HT", () => {
    expect(controlerFiche(faq({ answer_draft: "La Journée IA coûte 1 490 € HT." })).ok).toBe(true);
  });
  it("refuse tout autre prix ou remise", () => {
    for (const t of [
      "Remise à 990 € en échange d’un tournage.",
      "Tarif : 2 000 euros.",
      "990 EUR pour la journée.",
      "Seulement €990.",
      "Une remise de 10 %.",
    ]) {
      const r = controlerFiche(faq({ answer_draft: t }));
      expect(r.ok, t).toBe(false);
    }
  });
  it("refuse « Aucun gain garanti », Grenoble et « Will » seul", () => {
    for (const t of ["Aucun gain garanti.", "Depuis Grenoble.", "Contactez Will."]) {
      expect(controlerFiche(faq({ answer_draft: t })).ok, t).toBe(false);
    }
  });
  it("laisse passer Williams et la négation d’une garantie", () => {
    expect(
      controlerFiche(faq({ answer_draft: "Williams précise : le gain n’est pas garanti." })).ok,
    ).toBe(true);
  });
  it("refuse une fiche qui promet un gain ou un remboursement", () => {
    expect(controlerFiche(faq({ answer_draft: "Gain garanti ou remboursé." })).ok).toBe(false);
  });
  it("refuse les variantes d’une promesse de gain", () => {
    for (const t of [
      "Aucun gain n’est garanti.",
      "L’audit garantit un gain.",
      "Satisfait ou remboursé.",
    ]) {
      expect(controlerFiche(faq({ answer_draft: t })).ok, t).toBe(false);
    }
  });
  it("ne rejette pas un millésime suivi du prix autorisé", () => {
    expect(controlerFiche(faq({ answer_draft: "En 2026, 1 490 € HT." })).ok).toBe(true);
  });
  it("contrôle aussi les champs libres repris dans la note", () => {
    expect(controlerFiche(faq({ source: "Contact Will, Grenoble" })).ok).toBe(false);
  });
  it("refuse une fiche vide", () => {
    expect(controlerFiche(faq({ answer_draft: "" })).ok).toBe(false);
  });
});

describe("versEntreeKnowledge — jamais publié", () => {
  const e = versEntreeKnowledge(faq());
  it("brouillon interne, type faq, jamais public", () => {
    expect(e.entry.status).toBe("draft");
    expect(e.entry.type).toBe("faq");
    expect(e.entry.audience).toBe("team");
    expect(e.entry.confidentiality).toBe("internal");
    expect(e.entry.publishedAt).toBeNull();
  });
  it("slug stable dérivé de l’id, traduction FR seule", () => {
    expect(e.entry.slug).toBe("pack-journee-ia-geo-900");
    expect(e.translation.locale).toBe("fr");
    expect(e.translation.slug).toBe(e.entry.slug);
    expect(e.translation.title).toContain("Journée IA");
  });
  it("source, date et garde de publication conservées dans la note de relecture", () => {
    expect(e.entry.briefMarkdown).toContain("INT-03");
    expect(e.entry.briefMarkdown).toContain("2026-11-10");
    expect(e.entry.briefMarkdown).toContain("ne pas publier automatiquement");
  });
  it("échappe le HTML", () => {
    const x = versEntreeKnowledge(faq({ answer_draft: "a <b>b</b> & c" }));
    expect(x.translation.body).toBe("<p>a &lt;b&gt;b&lt;/b&gt; &amp; c</p>");
  });
});

describe("analyserPack — pack réel", () => {
  const rapport = analyserPack(lignesDepuisJsonl(readFileSync(CHEMIN, "utf-8")));

  it("compte tout le fichier et n’en perd aucune ligne", () => {
    const somme = Object.values(rapport.parType).reduce((a, b) => a + b, 0);
    expect(somme).toBe(rapport.total);
    expect(rapport.parType.search_query).toBe(623);
    expect(rapport.parType.faq_knowledge).toBe(63);
  });
  it("n’importe que les fiches questions/réponses, toutes en brouillon", () => {
    expect(rapport.aImporter.length + rapport.rejets.length).toBe(63);
    expect(rapport.aImporter.length).toBe(62);
    expect(rapport.rejets.map((r) => r.id)).toEqual(["GEO-033"]);
    for (const f of rapport.aImporter) {
      expect(f.entry.status).toBe("draft");
      expect(f.entry.publishedAt).toBeNull();
    }
  });
  it("les 623 expressions restent hors RAG (référentiel, jamais des faits)", () => {
    expect(rapport.horsRag.search_query).toBe(623);
    expect(rapport.aImporter.some((f) => f.entry.slug.startsWith("pack-journee-ia-q-"))).toBe(
      false,
    );
  });
  it("signale la contradiction de remise D02 et la garantie D03", () => {
    expect(rapport.contradictions.map((c) => c.id)).toEqual(expect.arrayContaining(["D02", "D03"]));
  });
  it("slugs uniques", () => {
    const slugs = rapport.aImporter.map((f) => f.entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("lignesDepuisJsonl", () => {
  it("ignore les lignes vides et refuse un JSON invalide avec le numéro de ligne", () => {
    expect(lignesDepuisJsonl('{"id":"a","type":"x"}\n\n')).toHaveLength(1);
    expect(() => lignesDepuisJsonl('{"id":"a","type":"x"}\n{oops')).toThrow(/ligne 2/);
  });
});
