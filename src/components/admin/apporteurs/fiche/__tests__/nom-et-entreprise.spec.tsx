/**
 * Fiche apporteur (10/10) : le bloc « Le nom correspond-il à l'entreprise ? » relit le
 * registre par SIRET (sinon SIREN) et dit l'une des quatre phrases, sans jargon.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ registre: vi.fn() }));
vi.mock("@/features/apporteurs-reseau/annuaire", () => ({
  lireRegistre: (...a: unknown[]) => h.registre(...a),
}));

import { NomEtEntreprise } from "../NomEtEntreprise";

const rendre = async (p: Partial<Parameters<typeof NomEtEntreprise>[0]> = {}) =>
  renderToStaticMarkup(
    await NomEtEntreprise({
      prenom: "Claire",
      nom: "Martin",
      siren: "732829320",
      siret: "73282932000074",
      ...p,
    }),
  ).replace(/&#x27;/g, "'");

const entreprise = (over: Record<string, unknown>) => ({
  ok: true,
  entreprise: { siren: "732829320", siret: "73282932000074", active: true, ...over },
});

beforeEach(() => vi.clearAllMocks());

describe("NomEtEntreprise", () => {
  it("lit le registre par SIRET quand il existe, sinon par SIREN", async () => {
    h.registre.mockResolvedValue({ ok: false, raison: "indisponible" });
    await rendre();
    expect(h.registre).toHaveBeenLastCalledWith("73282932000074");
    await rendre({ siret: null });
    expect(h.registre).toHaveBeenLastCalledWith("732829320");
  });

  it("✅ le nom correspond", async () => {
    h.registre.mockResolvedValue(
      entreprise({ personnes: [{ nom: "MARTIN", prenoms: "Claire Anne", qualite: "Gérante" }] }),
    );
    expect(await rendre()).toContain(
      "Le nom du contrat correspond au titulaire de l'entreprise (Claire Anne MARTIN, gérante).",
    );
  });

  it("⚠️ le nom ne correspond pas : alerte rouge", async () => {
    h.registre.mockResolvedValue(
      entreprise({ personnes: [{ nom: "DURAND", prenoms: "Paul", qualite: "Gérant" }] }),
    );
    const html = await rendre();
    expect(html).toContain('role="alert"');
    expect(html).toContain(
      "Le nom du contrat (Claire Martin) ne correspond à personne dans le registre pour ce SIRET : personnes trouvées : Paul DURAND, gérant. Vérifiez la pièce d'identité et le RIB avant de contresigner.",
    );
  });

  it("gris : vérification impossible (diffusion partielle)", async () => {
    h.registre.mockResolvedValue(entreprise({ personnes: [], diffusionPartielle: true }));
    const html = await rendre();
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Vérification automatique impossible (");
    expect(html).toContain(": comparez vous-même la pièce d'identité avec l'entreprise.");
  });

  it("registre muet", async () => {
    h.registre.mockResolvedValue({ ok: false, raison: "indisponible" });
    expect(await rendre()).toContain("Registre indisponible, rechargez dans quelques minutes.");
  });
});
