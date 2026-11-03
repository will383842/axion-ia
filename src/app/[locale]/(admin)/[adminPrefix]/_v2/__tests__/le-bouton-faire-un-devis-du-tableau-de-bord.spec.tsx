/**
 * Le tableau de bord porte un bouton « Faire un devis » pour les rôles qui
 * peuvent écrire (la page /qualiopi/devis/new est gardée en écriture), et
 * garde le formulaire de déconnexion à sa place.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

for (const f of [
  "EnTetePilotage",
  "AlertesCritiques",
  "ApporteursEnAttenteSection",
  "GuideLettreSection",
  "EtatServeurSection",
  "CalendrierPrevisionnel",
  "ActiviteSection",
  "FormateursSection",
  "FinancierSection",
  "PipelineSection",
]) {
  vi.doMock(`../pilotage/${f}`, () => ({ [f]: () => null }));
}

async function rendre(role: string): Promise<string> {
  const { DashboardV2 } = await import("../DashboardV2");
  const Composant = DashboardV2 as unknown as (p: Record<string, unknown>) => React.ReactElement;
  return renderToStaticMarkup(
    Composant({
      adminPrefix: "gestion",
      role,
      logoutAction: async () => {},
      dashboard: {},
      activityRows: [],
      guideLettre: null,
      etatServeur: null,
    }),
  );
}

describe("bouton « Faire un devis » du tableau de bord", () => {
  it.each(["super_admin", "admin", "responsable_qualite", "secretaire", "editor"])(
    "rôle « %s » : le bouton mène à /qualiopi/devis/new, la déconnexion reste",
    async (role) => {
      const html = await rendre(role);
      expect(html).toContain('href="/fr/gestion/qualiopi/devis/new"');
      expect(html).toContain("Faire un devis");
      expect(html).toContain("Déconnexion");
    },
  );

  it("rôle « reader » : pas de bouton (page gardée en écriture), déconnexion présente", async () => {
    const html = await rendre("reader");
    expect(html).not.toContain("Faire un devis");
    expect(html).not.toContain("/qualiopi/devis/new");
    expect(html).toContain("Déconnexion");
  });
});
