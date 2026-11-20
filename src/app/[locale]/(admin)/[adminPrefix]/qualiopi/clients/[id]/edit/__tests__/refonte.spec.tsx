/**
 * Refonte visuelle de « Modifier une fiche client » : tuiles, encadrés, repliable, actions identiques.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ garde: vi.fn(), client: vi.fn(), form: vi.fn(), type: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/auth/garde-page", () => ({ gardePage: m.garde }));
vi.mock("@/server/qualiopi/crm/clients", () => ({ getClient: m.client }));
vi.mock("@/server/qualiopi/crm/changer-type-client", () => ({
  raisonBlocageChangementType: async () => null,
}));
vi.mock("@/features/dossier-client/message-de-retour", () => ({
  lireMessageDeRetour: (sp: Record<string, string>, cle: string) => sp[cle] ?? null,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/crm-sync/lire-apercu", () => ({ lireApercuCrmPro: async () => null }));
vi.mock("@/components/admin/dossier-client/fiche/ProfilDeLaFiche", () => ({
  profilDeLaFiche: async () => null,
}));
vi.mock("@/components/admin/qualiopi/ChangerTypeClient", () => ({
  ChangerTypeClient: (p: unknown) => {
    m.type(p);
    return <div data-testid="changer-type" />;
  },
}));
vi.mock("@/components/admin/qualiopi/ClientEditForm", () => ({
  ClientEditForm: (p: unknown) => {
    m.form(p);
    return <div data-testid="formulaire-client" />;
  },
}));

import Page from "../page";

const client = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  numero: "AXI-CLI-001",
  raisonSociale: "ACME",
  type: "entreprise",
  siret: "12345678901234",
  contactEmail: "a@acme.fr",
  adresseRue: "1 rue X",
  adresseVille: "Lyon",
  ...over,
});
const props = (sp: Record<string, string> = {}) => ({
  params: Promise.resolve({ locale: "fr" as const, adminPrefix: "adm", id: "c1" }),
  searchParams: Promise.resolve(sp),
});

beforeEach(() => {
  vi.clearAllMocks();
  m.garde.mockResolvedValue({ autorise: true, role: "admin", peutEcrire: true });
  m.client.mockResolvedValue(client());
});

describe("Modifier une fiche client — refonte visuelle", () => {
  it("quatre tuiles, ton succès quand tout est renseigné", async () => {
    const { container } = render(await Page(props()));
    const tuiles = container.querySelectorAll(".admin-stat-card");
    expect(tuiles).toHaveLength(4);
    expect(screen.getByText("Entreprise")).toBeTruthy();
    expect(screen.queryByText("À compléter")).toBeNull();
    expect(screen.queryByText("Manquant")).toBeNull();
  });

  it("signale ce qui manque dans les tuiles", async () => {
    m.client.mockResolvedValue(client({ siret: null, contactEmail: null, adresseRue: null }));
    render(await Page(props()));
    expect(screen.getAllByText("À compléter")).toHaveLength(2);
    expect(screen.getByText("Manquant")).toBeTruthy();
  });

  it("explication dans un repliable fermé", async () => {
    const { container } = render(await Page(props()));
    const d = container.querySelector("details");
    expect(d?.hasAttribute("open")).toBe(false);
    expect(d?.textContent).toContain("La branche (IDCC, effectif)");
  });

  it("erreur et message de retour dans des encadrés teintés avec icône", async () => {
    render(await Page(props({ erreur: "Refusé", message: "Fait" })));
    const alerte = screen.getByRole("alert");
    const statut = screen.getByRole("status");
    expect(alerte.querySelector("svg")).not.toBeNull();
    expect(statut.querySelector("svg")).not.toBeNull();
    expect(alerte.className).toContain("destructive-soft");
    expect(statut.className).toContain("success-soft");
  });

  it("monte les mêmes formulaires avec les mêmes props", async () => {
    render(await Page(props()));
    expect(screen.getByTestId("formulaire-client")).toBeTruthy();
    expect(screen.getByTestId("changer-type")).toBeTruthy();
    expect(m.form.mock.calls[0]![0]).toMatchObject({
      clientId: "c1",
      estParticulier: false,
      retourHref: "/fr/adm/qualiopi/clients",
    });
  });

  it("aucune couleur Tailwind par défaut ; vocabulaire des textes ajoutés", async () => {
    const { container } = render(await Page(props()));
    expect(container.innerHTML).not.toMatch(/\b(bg|text|border)-(red|green|blue|gray|amber)-\d/);
    const ajoutes = Array.from(container.querySelectorAll(".admin-stat-card"))
      .map((n) => n.textContent)
      .join(" ");
    expect(ajoutes).not.toMatch(/qualiopi|opco|financement|prise en charge|certification|cpf/i);
  });
});
