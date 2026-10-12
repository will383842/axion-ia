/**
 * Lot L11b — T3 par construction, et l'écran d'avant quand l'interrupteur est
 * absent.
 *
 * T3 : aucune carte cliquable refusée par l'action, aucune carte grisée
 * acceptée. Les cartes, l'action qui enregistre le choix et le moteur du rang
 * suivant lisent UNE évaluation (`evaluerAffectation`) ; l'écran n'en refait
 * aucune.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

describe("T3 — une seule évaluation", () => {
  it("les cartes et le rang suivant passent par `evaluerAffectation`", () => {
    const service = lire("src/server/qualiopi/formateurs-independants/choix-formateur-service.ts");
    expect(service.match(/evaluerAffectation\(/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("l'action relit les cartes et les fige avec `figerChoix`, puis passe par la porte d'affectation", () => {
    const action = lire("src/server/actions/qualiopi/choix-formateur.ts");
    expect(action).toMatch(/lireCartesChoix\(/);
    expect(action).toMatch(/figerChoix\(/);
    expect(action).toMatch(/assignTrainerToSessionAction\(/);
    expect(action).toMatch(/requireAdminWrite\(\)/);
    expect(action).toMatch(/interrupteurAllume\("choix_cartes"\)/);
  });
  it("l'écran ne décide rien : aucune évaluation côté client", () => {
    const ecran = lire("src/components/admin/qualiopi/ChoixFormateurCartes.tsx");
    expect(ecran).not.toMatch(/evaluerAffectation|controlerGardeMission|isTrainerHabilite/);
  });
  it("le désistement vérifie le formateur connecté", () => {
    const action = lire("src/server/actions/qualiopi/choix-formateur.ts");
    expect(action).toMatch(/const \{ trainerId \} = await requireFormateurAction\(\)/);
    const page = lire("src/components/espace-formateur/VueMission.tsx");
    expect(page).toMatch(/where: \{ id, trainerId \}/);
  });
});

vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: vi.fn(async () => false),
}));
vi.mock("@/server/qualiopi/formateurs-independants/choix-formateur-service", () => ({
  lireCartesChoix: vi.fn(async () => {
    throw new Error("ne doit pas être lu");
  }),
}));
vi.mock("@/components/admin/qualiopi/ChoixFormateurCartes", () => ({
  ChoixFormateurCartes: () => null,
}));

describe("interrupteur `formateurs.choix_cartes` absent : la fiche d'avant", () => {
  it("la section rend la liste déroulante seule, sans rien lire de plus", async () => {
    const { SectionChoixFormateur } =
      await import("@/components/admin/qualiopi/SectionChoixFormateur");
    const avant = { type: "liste-d-avant" } as unknown as React.ReactNode;
    const rendu = await SectionChoixFormateur({ sessionId: "s", children: avant });
    expect((rendu.props as { children: unknown }).children).toBe(avant);
  });
});
