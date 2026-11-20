/**
 * Corrections de l'audit Opus (8e passe, `AUDIT-PR-2170-passe8.md`). Chaque test échouait avant la
 * correction correspondante.
 */
import { describe, expect, it } from "vitest";
import { reecrirePerks } from "./plan";
import {
  classer,
  motsNonRetirables,
  reecrireFaq,
  reecrireHtml,
  reecrireJson,
  type Resultat,
} from "./regles";

const ambiguIntact = (r: Resultat<unknown>, origine: unknown) => {
  expect(classer(r)).toBe("ambigu");
  expect(r.modifie).toBe(false);
  expect(r.valeur).toEqual(origine);
};

const para = (t: string) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const tiptap = (...b: unknown[]) => ({ type: "doc", content: b });
const h2 = (t: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text: t }],
});

describe("1. phrase du lexique non visée : jamais « pure »", () => {
  for (const p of [
    "Qualité certifiée.",
    "Certification possible.",
    "Oui, accessible et disponible.",
  ]) {
    it(`section HTML : « ${p} » gardée, signalée à relire`, () => {
      const html = `<h2>Financement</h2><p>Le financement OPCO est possible.</p><p>${p}</p>`;
      const r = reecrireHtml(html, "fr");
      expect(r.valeur).toContain(`<p>${p}</p>`); // la phrase non visée est gardée
      expect(r.ambigus.some((a) => a.includes("à relire"))).toBe(true);
    });
  }
  it("section Tiptap : « Qualité certifiée. » gardée", () => {
    const doc = tiptap(
      h2("Financement"),
      para("Le financement OPCO est possible."),
      para("Qualité certifiée."),
    );
    const r = reecrireJson(doc, "fr");
    expect(JSON.stringify(r.valeur)).toContain("Qualité certifiée.");
    expect(r.ambigus.some((a) => a.includes("à relire"))).toBe(true);
  });
  it("FAQ : « Oui. Accessible. » gardée", () => {
    const f = {
      question: "Est-ce finançable par l'OPCO et accessible ?",
      reponse: "Oui. Accessible.",
    };
    const r = reecrireFaq(f, "fr");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toEqual(f);
  });
  it("tableau : « OPCO : non ; accessible : oui » gardée", () => {
    const html =
      "<table><tbody><tr><td>Financement</td><td>OPCO : non ; accessible : oui</td></tr></tbody></table>";
    const r = reecrireHtml(html, "fr");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toBe(html);
  });
  it("formes prouvées inchangées : « Oui. » et « Via votre OPCO. » restent pures", () => {
    const html = "<h2>Financement</h2><p>Le financement OPCO est possible.</p><p>Oui.</p>";
    expect(reecrireHtml(html, "fr").modifie).toBe(true);
  });
});

describe("2. avantage : l'autre libellé non visé est protégé", () => {
  it("« Training budget » en EN : avantage gardé", () => {
    const p = [{ labelFr: "Prise en charge OPCO", labelEn: "Training budget" }];
    const r = reecrirePerks(p);
    expect(r.modifie).toBe(false);
    expect(r.valeur).toEqual(p);
  });
  it("« Learning allowance » en EN : avantage gardé", () => {
    const p = [{ labelFr: "Prise en charge OPCO", labelEn: "Learning allowance" }];
    expect(reecrirePerks(p).valeur).toEqual(p);
  });
  it("avantage entièrement financier : toujours retiré", () => {
    const r = reecrirePerks([{ labelFr: "Financement OPCO", labelEn: "OPCO funding" }]);
    expect(r.modifie).toBe(true);
    expect(r.valeur).toEqual([]);
  });
});

describe("3. racine fund : formes réelles seulement", () => {
  it("« fundamentals » n'est pas retirable", () => {
    expect(motsNonRetirables("fundamentals", "")).toEqual(["fundamentals"]);
    expect(motsNonRetirables("funding funds funded fundable fund", "")).toEqual([]);
  });
  it("« OPCO funding: fundamentals available. » gardée", () => {
    const html = "<p>OPCO funding: fundamentals available.</p>";
    const r = reecrireHtml(html, "en");
    expect(r.modifie).toBe(false);
    expect(r.valeur).toBe(html);
  });
});

describe("4. exemption des nombres : ceux des décomptes seulement", () => {
  it("le « 80 » d'une section n'est pas exempté par un décompte ailleurs", () => {
    const html =
      "<p>Les 3 piliers sont audit, financement OPCO et suivi.</p><h2>Financement</h2><p>Le financement OPCO est possible à 80 %.</p>";
    const r = reecrireHtml(html, "fr");
    ambiguIntact(r, html); // le « 80 » perdu n'est pas exempté : toute la réécriture est annulée
  });
  it("motsNonRetirables : seuls les nombres d'origine listés sont exemptés", () => {
    expect(motsNonRetirables("3 piliers 80", "piliers", ["3"])).toEqual(["80"]);
    expect(motsNonRetirables("3 piliers 3", "piliers", ["3"])).toEqual(["3"]);
  });
});

describe("5. mots injectés ôtés avant la comparaison", () => {
  it("« formations » perdu n'est pas masqué par le lien injecté", () => {
    const origine = "Votre OPCO finance vos formations. Voir le lien.";
    const resultat = "Voir le lien. nos formations";
    expect(motsNonRetirables(origine, resultat)).toEqual([]); // masqué sans correction
    expect(motsNonRetirables(origine, resultat, [], ["nos", "formations"])).toEqual(["formations"]);
  });
});

describe("6. tableau sans ligne", () => {
  it("la seule ligne pure retirée : tableau ambigu, valeur intacte", () => {
    const html = "<table><tbody><tr><td>Financement</td><td>OPCO</td></tr></tbody></table>";
    ambiguIntact(reecrireHtml(html, "fr"), html);
  });
});
