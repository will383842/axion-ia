// La ligne « Tour France IA » (et apporteur) n'a jamais de questionnaire : y
// afficher 0 serait une mesure inventée. Elle renvoie vers son onglet.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { agregerTunnels } from "@/features/admin-tunnels/aggregate";
import { VueEnsemble } from "../VueEnsemble";

describe("VueEnsemble — tunnels sans questionnaire", () => {
  it("affiche « voir l'onglet » et non 0 pour le Tour et les apporteurs", () => {
    const html = renderToStaticMarkup(
      VueEnsemble({
        synthese: agregerTunnels([]),
        jours: 30,
        lignes: 0,
        tronquee: false,
        adminPrefix: "x",
      }),
    );
    const ligne = (libelle: string) => {
      const i = html.indexOf(`>${libelle.replace("'", "&#x27;")}`, html.indexOf("<tbody"));
      return html.slice(i, html.indexOf("</tr>", i));
    };
    for (const l of ["Tour France IA", "Recrutement d'apporteurs"]) {
      const tr = ligne(l);
      expect(tr).toContain("voir l&#x27;onglet");
      expect((tr.match(/voir l&#x27;onglet/g) ?? []).length).toBe(4);
    }
    expect(ligne("Questionnaire nu")).not.toContain("onglet");
  });
});
