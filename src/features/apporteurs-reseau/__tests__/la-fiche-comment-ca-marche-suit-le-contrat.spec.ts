// Le PDF « Comment ça marche » (joint à « contrat signé ») suit le contrat 2.3 (2026-10-07).
// Sa source est `scripts/apporteurs/fiche-apporteur.html` ; ce test la lit et refuse les
// mentions périmées relevées par a1 (« dès 50 € », « 10 jours ouvrés », barème caché du
// 1-to-1, protection comptée depuis le contact).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CONTRAT_V2_MARKDOWN } from "../contrat-v2";

const html = readFileSync(
  path.join(process.cwd(), "scripts/apporteurs/fiche-apporteur.html"),
  "utf8",
);
const texte = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("fiche « Comment ça marche » ↔ contrat 2.3", () => {
  it.each([
    /dès 50 €/,
    /10 jours ouvrés/,
    /relevé chaque début de mois/,
    /Barème/,
    /Dès que nous l'avons contactée/,
  ])("ne contient plus %s", (motif) => expect(texte).not.toMatch(motif));

  it("dit ce que dit le contrat : formulaire seul, 6 mois depuis la déclaration, 3 mois une seule fois, prestation réalisée et payée, SIREN actif", () => {
    expect(texte).toMatch(/un e-mail ne vaut pas déclaration/);
    expect(texte).toMatch(/6 mois à compter de votre déclaration/);
    expect(texte).toMatch(/3 mois de plus, une seule fois/);
    expect(texte).toMatch(/prestation est réalisée/);
    expect(texte).toMatch(/SIREN valide et actif/);
    expect(texte).toMatch(/24 mois/);
    // Et le contrat le dit bien (si le contrat change, ce test oblige à relire la fiche).
    expect(CONTRAT_V2_MARKDOWN).toMatch(/au moyen du seul formulaire/);
    expect(CONTRAT_V2_MARKDOWN).toMatch(/6 mois à compter de la déclaration/);
    expect(CONTRAT_V2_MARKDOWN).toMatch(/une seule fois/);
    expect(CONTRAT_V2_MARKDOWN).toMatch(/réalisée et\s+que la Société a encaissé l'intégralité/);
    expect(CONTRAT_V2_MARKDOWN).toMatch(/SIREN valide \*\*et actif\*\*/);
  });

  it("les taux affichés sont ceux de l'annexe 1 (30 % audit et 1-to-1, 15 % implémentation, 500 € et 250 €)", () => {
    for (const m of [/500 €/, /250 €/, /30 %/, /15 %/]) expect(texte).toMatch(m);
    expect(texte).toMatch(/30 %\s*Accompagnement individuel/);
  });
});
