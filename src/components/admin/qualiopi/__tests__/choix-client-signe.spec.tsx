/**
 * Fiche console : le choix du client (formule, durée, maintenance) se lit du choixOffre SCELLÉ.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChoixClientSigne } from "../ChoixClientSigne";
import { ResumeFormulesDevis } from "../ResumeFormulesDevis";
import { choixImprimable } from "@/server/qualiopi/devis/choix-exemplaire";
import { choixCanonique, sha256Choix, sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";

const NUMERO = "AXI-DEV-2026-001";

function resultat(over: {
  formule: "achat" | "abonnement";
  maintenance: boolean;
  mois: number | null;
}) {
  const offre = offreFictive();
  const offreSha256 = sha256Offre(offre);
  const choix = choixCanonique({
    devisNumero: NUMERO,
    offreSha256,
    formule: over.formule,
    automatisationsRetenues: [],
    maintenanceRetenue: over.maintenance,
    periodiciteMois: over.mois,
  });
  return choixImprimable(
    { offre, offreSha256, numero: NUMERO },
    { hashVersion: 4, choixOffre: choix, choixOffreSha256: sha256Choix(choix) },
  );
}

describe("ChoixClientSigne", () => {
  it("formule B : formule et durée payée d'avance", () => {
    const html = renderToStaticMarkup(
      <ChoixClientSigne
        resultat={resultat({ formule: "abonnement", maintenance: false, mois: 1 })}
        maintenanceFacultativeProposee
      />,
    );
    expect(html).toContain("Formule B");
    expect(html).toContain("payé 1 mois d&#x27;avance");
  });

  it("formule A avec maintenance : montant mensuel affiché", () => {
    const html = renderToStaticMarkup(
      <ChoixClientSigne
        resultat={resultat({ formule: "achat", maintenance: true, mois: 1 })}
        maintenanceFacultativeProposee
      />,
    );
    expect(html).toContain("Formule A");
    expect(html).toContain("Maintenance :");
    expect(html).not.toContain("non retenue");
  });

  it("formule A sans maintenance : « non retenue »", () => {
    const html = renderToStaticMarkup(
      <ChoixClientSigne
        resultat={resultat({ formule: "achat", maintenance: false, mois: null })}
        maintenanceFacultativeProposee
      />,
    );
    expect(html).toContain("Formule A");
    expect(html).toContain("non retenue");
  });

  it("choix scellé non conforme : rien n'est affiché, l'alerte le dit", () => {
    const html = renderToStaticMarkup(
      <ChoixClientSigne
        resultat={{ ok: false, motif: "choix_altere" }}
        maintenanceFacultativeProposee={false}
      />,
    );
    expect(html).toContain("choix-client-illisible");
    expect(html).not.toContain("Formule choisie");
  });
});

describe("ResumeFormulesDevis — maintenance", () => {
  it("la formule A mentionne la maintenance facultative et son montant mensuel", () => {
    const vue = vueFormules(offreFictive());
    const html = renderToStaticMarkup(<ResumeFormulesDevis vue={vue} />);
    expect(html).toContain("maintenance facultative");
  });
});
