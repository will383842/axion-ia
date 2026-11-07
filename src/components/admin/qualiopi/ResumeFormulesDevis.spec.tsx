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
});
