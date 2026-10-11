/**
 * Lot L15a — actions « lieu d'exercice » : rôle, interrupteur, retour fermé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  auth: vi.fn(),
  allume: vi.fn(),
  enregistrer: vi.fn(),
  rattraper: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => d.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: (...a: unknown[]) => d.allume(...a),
}));
vi.mock("@/server/qualiopi/formateurs-proches/lieu-formateur-service", () => ({
  enregistrerLieuFormateur: (...a: unknown[]) => d.enregistrer(...a),
  rattraperLieuxFormateurs: (...a: unknown[]) => d.rattraper(...a),
}));

import {
  enregistrerLieuFormateurFormAction,
  rattraperLieuxFormateursFormAction,
} from "../formateur-lieu";

const ID = "00000000-0000-4000-8000-0000000000aa";
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const redirige = async (p: Promise<void>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return "aucune redirection";
};

beforeEach(() => {
  vi.clearAllMocks();
  d.allume.mockResolvedValue(true);
  d.enregistrer.mockResolvedValue("enregistre");
  d.rattraper.mockResolvedValue({ examinees: 1, trouvees: 1, sansCodePostal: 0, sansCommune: 0 });
});

describe("enregistrerLieuFormateurFormAction", () => {
  it.each(["editor", "reader", "secretaire"])("rôle « %s » : refus, rien d'écrit", async (role) => {
    d.auth.mockResolvedValue({ user: { id: "u", role } });
    expect(
      await redirige(
        enregistrerLieuFormateurFormAction(form({ trainerId: ID, codePostal: "74000" })),
      ),
    ).toBe(`REDIRECT /fr/adm/qualiopi/formateurs/${ID}?lieu=droit#lieu-exercice`);
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("interrupteur absent : refus, rien d'écrit", async () => {
    d.auth.mockResolvedValue({ user: { id: "u", role: "admin" } });
    d.allume.mockResolvedValue(false);
    expect(
      await redirige(
        enregistrerLieuFormateurFormAction(form({ trainerId: ID, codePostal: "74000" })),
      ),
    ).toContain("?lieu=eteint");
    expect(d.allume).toHaveBeenCalledWith("proches_bloc");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it("responsable qualité, allumé : écrit et rend le code de l'issue", async () => {
    d.auth.mockResolvedValue({ user: { id: "u", role: "responsable_qualite" } });
    expect(
      await redirige(
        enregistrerLieuFormateurFormAction(
          form({ trainerId: ID, codePostal: "74000", ville: "Annecy" }),
        ),
      ),
    ).toContain("?lieu=enregistre");
    expect(d.enregistrer).toHaveBeenCalledWith(ID, "74000", "Annecy", "u", expect.any(Date));
  });

  it("identifiant forgé : retour à la liste, rien d'écrit", async () => {
    d.auth.mockResolvedValue({ user: { id: "u", role: "admin" } });
    expect(
      await redirige(
        enregistrerLieuFormateurFormAction(form({ trainerId: "x", codePostal: "74000" })),
      ),
    ).toBe("REDIRECT /fr/adm/qualiopi/formateurs");
    expect(d.enregistrer).not.toHaveBeenCalled();
  });
});

describe("rattraperLieuxFormateursFormAction", () => {
  it("sans session : refus", async () => {
    d.auth.mockResolvedValue(null);
    expect(await redirige(rattraperLieuxFormateursFormAction())).toContain("?lieu=session");
    expect(d.rattraper).not.toHaveBeenCalled();
  });
  it("admin, allumé : rattrape", async () => {
    d.auth.mockResolvedValue({ user: { id: "u", role: "admin" } });
    expect(await redirige(rattraperLieuxFormateursFormAction())).toContain("?lieu=rattrapage_fait");
  });
});
