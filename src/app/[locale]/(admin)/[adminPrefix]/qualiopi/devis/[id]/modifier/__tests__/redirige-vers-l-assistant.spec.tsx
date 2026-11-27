/**
 * Fiche S11 — `/qualiopi/devis/[id]/modifier` renvoie vers l'assistant quand l'interrupteur
 * `devis_assistant` est allumé ; éteint, la page actuelle (éditeur de formules) est INCHANGÉE.
 *
 * Mutations qui font rougir ces tests (essayées à la main) :
 *   - retirer le `redirect` → « allumé » rougit ;
 *   - lire l'interrupteur avant la garde d'accès → « accès refusé » rougit ;
 *   - rediriger aussi quand l'interrupteur est éteint → « éteint » rougit ;
 *   - ne pas regarder le statut du devis → « devis envoyé » rougit ;
 *   - rediriger vers l'assistant un devis SANS brouillon lié → « classique » / « à formules » rougissent.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  garde: vi.fn(),
  actif: vi.fn(),
  formules: vi.fn(),
  devis: vi.fn(),
}));

class Redirection extends Error {
  constructor(public readonly cible: string) {
    super(`REDIRECT:${cible}`);
  }
}
class Introuvable extends Error {}

vi.mock("next/navigation", () => ({
  redirect: (cible: string) => {
    throw new Redirection(cible);
  },
  notFound: () => {
    throw new Introuvable("NOT_FOUND");
  },
}));
vi.mock("@/server/auth/garde-page", () => ({ gardePage: m.garde }));
vi.mock("@/lib/prisma", () => ({ prisma: { devis: { findUnique: m.devis } } }));
vi.mock("@/server/qualiopi/devis/interrupteur-assistant", () => ({ assistantDevisActif: m.actif }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({ formulesActives: m.formules }));
vi.mock("@/components/admin/qualiopi/DevisFormulesEdition", () => ({
  DevisFormulesEdition: () => <div data-testid="editeur-formules" />,
}));

import QualiopiDevisModifierPage from "../page";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";

const ID = "550e8400-e29b-41d4-a716-446655440002";
const params = (id = ID, sansAssistant?: string) => ({
  params: Promise.resolve({ locale: "fr" as const, adminPrefix: "adm", id }),
  searchParams: Promise.resolve(
    sansAssistant === undefined ? {} : { "sans-assistant": sansAssistant },
  ),
});
const cible = async (p: ReturnType<typeof params> = params()) => {
  try {
    await QualiopiDevisModifierPage(p);
  } catch (e) {
    return e instanceof Redirection ? e.cible : `ERR:${(e as Error).message}`;
  }
  return null;
};

beforeEach(() => {
  vi.clearAllMocks();
  m.garde.mockResolvedValue({ autorise: true, role: "admin", peutEcrire: true });
  m.actif.mockResolvedValue(false);
  m.formules.mockResolvedValue(true);
  m.devis.mockResolvedValue({
    id: ID,
    numero: "AXI-DEV-2026-007",
    statut: "brouillon",
    offre: offreFictive(),
    offreSha256: "a".repeat(64),
    updatedAt: new Date("2026-11-08T10:00:00Z"),
    devisAssistantBrouillon: null,
  });
});

describe("/modifier → assistant", () => {
  it("interrupteur ALLUMÉ + brouillon AVEC brouillon d'assistant lié : /qualiopi/devis/new?devis=<id>", async () => {
    m.actif.mockResolvedValue(true);
    m.devis.mockResolvedValue({
      id: ID,
      numero: "N",
      statut: "brouillon",
      offre: offreFictive(),
      devisAssistantBrouillon: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    });
    expect(await cible()).toBe(`/fr/adm/qualiopi/devis/new?devis=${ID}`);
    m.devis.mockResolvedValue({
      id: ID,
      numero: "N",
      statut: "brouillon",
      offre: null,
      devisAssistantBrouillon: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    });
    expect(await cible()).toBe(`/fr/adm/qualiopi/devis/new?devis=${ID}`);
  });

  it("interrupteur ALLUMÉ, brouillon classique (offre nulle) SANS lien : /corriger, jamais l'assistant", async () => {
    m.actif.mockResolvedValue(true);
    m.devis.mockResolvedValue({
      id: ID,
      numero: "N",
      statut: "brouillon",
      offre: null,
      devisAssistantBrouillon: null,
    });
    expect(await cible()).toBe(`/fr/adm/qualiopi/devis/${ID}/corriger`);
  });

  it("interrupteur ALLUMÉ, brouillon à formules SANS lien : la branche d'avant (éditeur si les formules sont actives, sinon 404)", async () => {
    m.actif.mockResolvedValue(true);
    render(await QualiopiDevisModifierPage(params()));
    expect(screen.getByTestId("editeur-formules")).toBeTruthy();
    m.formules.mockResolvedValue(false);
    expect(await cible()).toBe("ERR:NOT_FOUND");
  });

  it("interrupteur ALLUMÉ + devis envoyé : renvoyé vers sa fiche, jamais vers l'édition", async () => {
    m.actif.mockResolvedValue(true);
    for (const lien of [null, { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }]) {
      m.devis.mockResolvedValue({
        id: ID,
        numero: "N",
        statut: "envoye",
        offre: null,
        devisAssistantBrouillon: lien,
      });
      expect(await cible()).toBe(`/fr/adm/qualiopi/devis/${ID}`);
    }
  });

  it("interrupteur ALLUMÉ + devis inexistant : 404", async () => {
    m.actif.mockResolvedValue(true);
    m.devis.mockResolvedValue(null);
    expect(await cible()).toBe("ERR:NOT_FOUND");
  });

  it("identifiant qui n'est pas un uuid : 404, aucune lecture", async () => {
    m.actif.mockResolvedValue(true);
    expect(await cible(params("pas-un-uuid"))).toBe("ERR:NOT_FOUND");
    expect(m.devis).not.toHaveBeenCalled();
  });

  it("accès refusé : aucune redirection, l'interrupteur n'est même pas lu", async () => {
    m.garde.mockResolvedValue({ autorise: false, motif: "ecriture" });
    m.actif.mockResolvedValue(true);
    const ui = await QualiopiDevisModifierPage(params());
    render(ui);
    expect(m.actif).not.toHaveBeenCalled();
    expect(m.devis).not.toHaveBeenCalled();
  });
});

describe("/modifier?sans-assistant=1 (carte de refus du chargeur)", () => {
  const LIE = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
  const devisLie = (extra: Record<string, unknown> = {}) => ({
    id: ID,
    numero: "AXI-DEV-2026-007",
    statut: "brouillon",
    offre: offreFictive(),
    updatedAt: new Date("2026-11-08T10:00:00Z"),
    devisAssistantBrouillon: LIE,
    ...extra,
  });
  beforeEach(() => m.actif.mockResolvedValue(true));

  it("brouillon à formules lié, formules actives : l'éditeur d'avant, pas de renvoi à l'assistant", async () => {
    m.devis.mockResolvedValue(devisLie());
    render(await QualiopiDevisModifierPage(params(ID, "1")));
    expect(screen.getByTestId("editeur-formules")).toBeTruthy();
  });

  it("sans le paramètre (ou autre valeur) : toujours l'assistant", async () => {
    m.devis.mockResolvedValue(devisLie());
    expect(await cible(params(ID))).toBe(`/fr/adm/qualiopi/devis/new?devis=${ID}`);
    expect(await cible(params(ID, "0"))).toBe(`/fr/adm/qualiopi/devis/new?devis=${ID}`);
  });

  it("formules éteintes : le paramètre est ignoré (comportement actuel, assistant)", async () => {
    m.devis.mockResolvedValue(devisLie());
    m.formules.mockResolvedValue(false);
    expect(await cible(params(ID, "1"))).toBe(`/fr/adm/qualiopi/devis/new?devis=${ID}`);
  });

  it("devis non brouillon : le paramètre est ignoré, renvoi vers la fiche", async () => {
    m.devis.mockResolvedValue(devisLie({ statut: "envoye" }));
    expect(await cible(params(ID, "1"))).toBe(`/fr/adm/qualiopi/devis/${ID}`);
  });

  it("devis classique lié : le paramètre ne monte pas l'éditeur de formules", async () => {
    m.devis.mockResolvedValue(devisLie({ offre: null }));
    expect(await cible(params(ID, "1"))).toBe(`/fr/adm/qualiopi/devis/new?devis=${ID}`);
  });

  it("accès refusé : le paramètre ne contourne pas la garde", async () => {
    m.garde.mockResolvedValue({ autorise: false, motif: "ecriture" });
    m.devis.mockResolvedValue(devisLie());
    render(await QualiopiDevisModifierPage(params(ID, "1")));
    expect(screen.queryByTestId("editeur-formules")).toBeNull();
    expect(m.devis).not.toHaveBeenCalled();
  });
});

describe("interrupteur ÉTEINT : la page actuelle est inchangée", () => {
  it("pas de redirection, l'éditeur de formules s'affiche", async () => {
    m.actif.mockResolvedValue(false);
    const ui = await QualiopiDevisModifierPage(params());
    render(ui);
    expect(screen.getByTestId("editeur-formules")).toBeTruthy();
    expect(screen.getByText("Modifier le brouillon AXI-DEV-2026-007")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Retour au devis/ }).getAttribute("href")).toBe(
      `/fr/adm/qualiopi/devis/${ID}`,
    );
  });

  it("devis classique : 404 comme aujourd'hui", async () => {
    m.devis.mockResolvedValue({ id: ID, numero: "N", statut: "brouillon", offre: null });
    expect(await cible()).toBe("ERR:NOT_FOUND");
  });

  it("devis envoyé : 404 comme aujourd'hui", async () => {
    m.devis.mockResolvedValue({ id: ID, numero: "N", statut: "envoye", offre: offreFictive() });
    expect(await cible()).toBe("ERR:NOT_FOUND");
  });

  it("formules éteintes : 404 comme aujourd'hui", async () => {
    m.formules.mockResolvedValue(false);
    expect(await cible()).toBe("ERR:NOT_FOUND");
  });
});
