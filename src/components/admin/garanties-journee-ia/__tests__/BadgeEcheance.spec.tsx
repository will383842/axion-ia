import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BadgeEcheance } from "../BadgeEcheance";
import { etatEcheance } from "@/lib/garantie-journee-ia/presentation";

describe("BadgeEcheance : la couleur ne porte jamais seule l'information", () => {
  const cas: [string, string, string][] = [
    ["2026-12-05", "rouge", "Dépassée de 5 j"],
    ["2026-12-10", "rouge", "Aujourd&#x27;hui"],
    ["2026-12-12", "orange", "Dans 2 j"],
    ["2026-12-14", "jaune", "Dans 4 j"],
    ["2026-12-20", "vert", "Dans 10 j"],
  ];
  it.each(cas)("%s → couleur %s ET texte %s", (date, couleur, texte) => {
    const html = renderToStaticMarkup(
      <BadgeEcheance etat={etatEcheance({ date, faite: false }, "2026-12-10")} />,
    );
    expect(html).toContain(`data-niveau="${couleur}"`);
    expect(html).toContain(texte);
  });
  it("gris et « Clos » pour une échéance faite", () => {
    const html = renderToStaticMarkup(
      <BadgeEcheance etat={etatEcheance({ date: "2026-12-01", faite: true }, "2026-12-10")} />,
    );
    expect(html).toContain('data-niveau="gris"');
    expect(html).toContain("Clos");
  });
});
