// « Enregistrer cette visio ? » au clic sur « Rejoindre la visio » (2026-10-01).
//
// Client du dossier, drapeau non fermé : la question, « Oui » par défaut.
// Apporteur, type hors liste blanche ou drapeau fermé : bouton inchangé, aucune
// question, aucun attribut lu par l'extension.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RejoindreVisioBouton } from "../RejoindreVisioBouton";
import { enregistrementPropose } from "../enregistrement-propose";

const debut = new Date("2026-09-28T13:30:00Z");
const fin = new Date("2026-09-28T14:15:00Z");
const maintenant = new Date("2026-09-28T13:00:00Z");
const href = "/api/admin/appels/evt_1/visio";

function rendu(enregistrer: string | null): string {
  return renderToStaticMarkup(
    <RejoindreVisioBouton
      href={href}
      debut={debut}
      fin={fin}
      maintenant={maintenant}
      enregistrer={enregistrer}
    />,
  );
}

describe("Enregistrer cette visio ?", () => {
  it("client du dossier : la question, « Oui » en premier et mis en avant, les deux ouvrent Meet", () => {
    const html = rendu("evt_1");
    expect(html).toContain("<details");
    expect(html).toContain("Enregistrer cette visio ?");
    const oui = html.indexOf("Oui, enregistrer");
    const non = html.indexOf("Non, sans enregistrement");
    expect(oui).toBeGreaterThan(-1);
    expect(non).toBeGreaterThan(oui);
    expect(html.match(new RegExp(`href="${href}"`, "g"))).toHaveLength(2);
    // « Oui » porte le bouton plein, « Non » le secondaire.
    expect(html).toMatch(/class="admin-button[^"]*"[^>]*data-enregistrer-visio="evt_1"/);
  });

  it("l'identifiant n'est porté QUE par « Oui » ; « Non » porte son seul marqueur", () => {
    const html = rendu("evt_1");
    expect(html.match(/data-enregistrer-visio=/g)).toHaveLength(1);
    expect(html.match(/data-sans-enregistrement/g)).toHaveLength(1);
    const lienNon = html.slice(html.lastIndexOf("<a", html.indexOf("Non, sans enregistrement")));
    expect(lienNon).not.toContain("data-enregistrer-visio");
  });

  it("sans identifiant (apporteur, hors liste blanche, drapeau fermé) : bouton inchangé", () => {
    const html = rendu(null);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Enregistrer cette visio");
    expect(html).not.toContain("data-enregistrer-visio");
    expect(html).not.toContain("data-sans-enregistrement");
    expect(html).toContain("Rejoindre la visio");
  });
});

describe("enregistrementPropose — qui reçoit la question", () => {
  const client = { titre: "Discutons de votre projet IA (45 min)", identifiant: "evt_1" };

  it("client du dossier, drapeau pilote ou ouvert : l'identifiant", () => {
    expect(enregistrementPropose({ ...client, drapeau: "ouvert" })).toBe("evt_1");
    expect(enregistrementPropose({ ...client, drapeau: "pilote" })).toBe("evt_1");
  });

  it("drapeau fermé : jamais", () => {
    expect(enregistrementPropose({ ...client, drapeau: "ferme" })).toBeNull();
  });

  it("apporteur ou type hors liste blanche : jamais", () => {
    expect(
      enregistrementPropose({
        titre: "Échange apporteur d'affaires",
        identifiant: "evt_2",
        drapeau: "ouvert",
      }),
    ).toBeNull();
    expect(
      enregistrementPropose({ titre: "Entretien", identifiant: "evt_3", drapeau: "ouvert" }),
    ).toBeNull();
  });

  it("un rendez-vous de candidature : jamais", () => {
    expect(
      enregistrementPropose({ ...client, drapeau: "ouvert", linkedJobApplicationId: "cand_1" }),
    ).toBeNull();
  });
});
