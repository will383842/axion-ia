import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";
import { LIBELLE_MONTANT_AU_CHOIX, ResumeFormulesDevis } from "./ResumeFormulesDevis";

describe("ResumeFormulesDevis", () => {
  it("annonce le montant au choix du client et résume chaque formule", () => {
    const html = renderToStaticMarkup(<ResumeFormulesDevis vue={vueFormules(offreFictive())} />);
    expect(html).toContain(LIBELLE_MONTANT_AU_CHOIX);
    expect(html).toContain("Formule A");
    expect(html).toContain("Formule B");
    expect(html).toContain("/ mois");
    expect(html).not.toContain("Aucune ligne");
  });

  it("mois offerts (1re période à 0 €) : affiche la mensualité de la première période payante", () => {
    const o = offreFictive();
    o.abonnement!.periodes = [
      { mois: 1, remiseBps: 10000 },
      { mois: 12, remiseBps: 0 },
    ];
    const vue = vueFormules(o);
    const html = renderToStaticMarkup(<ResumeFormulesDevis vue={vue} />);
    const mensuel = vue.formules
      .find((f) => f.abonnement)!
      .abonnement!.periodes.find((p) => p.mensuelNetHtCents > 0)!.mensuelNetHtCents;
    const attendu = (mensuel / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(html).toContain("/ mois");
    expect(html).toContain(attendu);
  });
});
