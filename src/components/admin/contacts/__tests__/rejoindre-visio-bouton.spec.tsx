// Le bouton « Rejoindre la visio » : discret avant, en évidence 10 minutes
// avant l'heure, absent après (2026-09-27).

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RejoindreVisioBouton } from "../RejoindreVisioBouton";

const debut = new Date("2026-09-28T13:30:00Z");
const fin = new Date("2026-09-28T14:15:00Z");
const href = "/api/admin/appels/evt_1/visio";

function rendu(maintenant: string): string {
  return renderToStaticMarkup(
    <RejoindreVisioBouton href={href} debut={debut} fin={fin} maintenant={new Date(maintenant)} />,
  );
}

describe("RejoindreVisioBouton", () => {
  it("la veille : présent, discret, dans un nouvel onglet", () => {
    const html = rendu("2026-09-27T18:00:00Z");
    expect(html).toContain("Rejoindre la visio");
    expect(html).toContain("admin-button-secondary");
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain('target="_blank"');
  });

  it("10 minutes avant : en évidence", () => {
    const html = rendu("2026-09-28T13:21:00Z");
    expect(html).toContain("Rejoindre maintenant");
    expect(html).not.toContain("admin-button-secondary");
  });

  it("30 minutes après la fin : plus de bouton", () => {
    expect(rendu("2026-09-28T14:40:00Z")).toContain("Rejoindre maintenant");
    expect(rendu("2026-09-28T14:46:00Z")).toBe("");
  });
});
