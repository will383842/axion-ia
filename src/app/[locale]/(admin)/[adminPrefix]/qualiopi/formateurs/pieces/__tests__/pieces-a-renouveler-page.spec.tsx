/**
 * Lot L13 — page « Pièces à renouveler » : rôle jugé avant toute lecture,
 * interrupteur `formateurs.pieces_cron` absent = rien n'est lu.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  session: null as unknown,
  allume: vi.fn(),
  lire: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: (...a: unknown[]) => d.allume(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/pieces-a-renouveler-lecture", () => ({
  lirePiecesARenouveler: (...a: unknown[]) => d.lire(...a),
}));

import Page from "../page";

const rendre = async () =>
  renderToStaticMarkup(
    await Page({ params: Promise.resolve({ locale: "fr", adminPrefix: "adm" }) }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  d.lire.mockResolvedValue([
    {
      trainerId: "00000000-0000-4000-8000-000000000001",
      nom: "Camille Test",
      pieces: [
        {
          type: "attestation_vigilance_urssaf",
          bloquante: true,
          etat: { etat: "echue", echeance: new Date("2026-10-01T00:00:00Z") },
        },
        { type: "assurance_rc_pro", bloquante: false, etat: { etat: "en_verification" } },
      ],
    },
  ]);
});

describe("page « Pièces à renouveler »", () => {
  it.each(["editor", "reader", "secretaire"])(
    "rôle « %s » : refus, rien n'est lu",
    async (role) => {
      d.session = { user: { id: "u1", role } };
      const html = await rendre();
      expect(d.allume).not.toHaveBeenCalled();
      expect(d.lire).not.toHaveBeenCalled();
      expect(html).not.toContain("Camille Test");
    },
  );

  it("interrupteur absent : la page le dit, rien n'est lu", async () => {
    d.session = { user: { id: "u1", role: "admin" } };
    d.allume.mockResolvedValue(false);
    const html = await rendre();
    expect(d.allume).toHaveBeenCalledWith("pieces_cron");
    expect(d.lire).not.toHaveBeenCalled();
    expect(html).toContain("pas encore allumé");
  });

  it("allumé : les états des pièces s'affichent", async () => {
    d.session = { user: { id: "u1", role: "responsable_qualite" } };
    d.allume.mockResolvedValue(true);
    const html = await rendre();
    expect(html).toContain("Camille Test");
    expect(html).toContain("Échue le");
    expect(html).toContain("Reçue, en vérification");
    expect(html).toContain("(ne bloque pas)");
  });
});
