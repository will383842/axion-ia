// Le point se fait en un geste (2026-09-27) : « Reporté » enregistre au clic,
// « Absent » propose d'abord la relance, « A eu lieu » demande la suite.

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/features/admin-rendezvous/suivi-actions", () => ({
  enregistrerSuiviAction: vi.fn(),
}));

import { SuiviRendezVousForm } from "../SuiviRendezVousForm";

function boutons(html: string): string[] {
  return html.match(/<button[^>]*>/g) ?? [];
}

describe("SuiviRendezVousForm", () => {
  it("« Reporté » est un bouton d'envoi qui porte sa valeur", () => {
    const html = renderToStaticMarkup(<SuiviRendezVousForm calendlyEventId="evt_1" />);
    const reporte = boutons(html).find((b) => b.includes('value="reporte"'));
    expect(reporte).toContain('type="submit"');
    expect(reporte).toContain('name="issue"');
  });

  it("« Absent » et « A eu lieu » n'envoient pas au premier clic", () => {
    const html = renderToStaticMarkup(<SuiviRendezVousForm calendlyEventId="evt_1" />);
    const envois = boutons(html).filter((b) => b.includes('type="submit"'));
    // Au repos, un seul bouton envoie : « Reporté ».
    expect(envois).toHaveLength(1);
    expect(html).toContain("Absent");
    expect(html).toContain("A eu lieu");
  });

  it("un absent déjà noté montre la relance et « Enregistrer : absent »", () => {
    const html = renderToStaticMarkup(
      <SuiviRendezVousForm
        calendlyEventId="evt_1"
        initial={{ issue: "absent", suite: null, suiteLe: null, note: null }}
        mailtoRelance="mailto:client%40example.com?subject=x"
      />,
    );
    expect(html).toContain('href="mailto:client%40example.com?subject=x"');
    expect(html).toContain("Enregistrer : absent");
  });
});
