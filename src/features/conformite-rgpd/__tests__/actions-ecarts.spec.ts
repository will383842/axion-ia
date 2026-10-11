// @vitest-environment node
// « Marquer corrigé » / « Rouvrir » / « Archiver » : rôle administrateur revérifié
// CÔTÉ SERVEUR, aucune écriture pour un autre rôle, trace sans contenu.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; name?: string } },
  updateEcart: vi.fn(),
  updateTraitement: vi.fn(),
  journal: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ecartRgpd: { updateMany: (...a: unknown[]) => h.updateEcart(...a) },
    traitementRgpd: { updateMany: (...a: unknown[]) => h.updateTraitement(...a) },
  },
}));
vi.mock("@/server/journal/journaliser", () => ({
  journaliser: (...a: unknown[]) => h.journal(...a),
}));

import {
  archiverTraitement,
  marquerEcartCorrige,
  marquerEcartCorrigeAction,
  rouvrirEcart,
} from "../actions-ecarts";

const USER = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ECART = "0b1c2d3e-4f50-4a6b-8c7d-8e9fa0b1c2d3";

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

beforeEach(() => {
  h.session = { user: { id: USER, role: "admin", name: "Admin Exemple" } };
  h.updateEcart.mockReset().mockResolvedValue({ count: 1 });
  h.updateTraitement.mockReset().mockResolvedValue({ count: 1 });
  h.journal.mockReset();
});

describe("Gestes sur les écarts", () => {
  it.each(["responsable_qualite", "secretaire", "editor", "reader", "inconnu"])(
    "refuse le rôle %s pour « Marquer corrigé » et « Rouvrir », sans rien écrire",
    async (role) => {
      h.session = { user: { id: USER, role } };
      const corrige = await marquerEcartCorrige(fd({ ecartId: ECART }));
      const rouvert = await rouvrirEcart(fd({ ecartId: ECART }));
      const archive = await archiverTraitement(fd({ traitementId: ECART }));
      for (const r of [corrige, rouvert, archive]) {
        expect(r).toEqual({ ok: false, erreur: "Réservé aux administrateurs." });
      }
      expect(h.updateEcart).not.toHaveBeenCalled();
      expect(h.updateTraitement).not.toHaveBeenCalled();
      expect(h.journal).not.toHaveBeenCalled();
    },
  );

  it("refuse sans session", async () => {
    h.session = null;
    expect((await marquerEcartCorrige(fd({ ecartId: ECART }))).ok).toBe(false);
    expect(h.updateEcart).not.toHaveBeenCalled();
  });

  it("marque corrigé un écart OUVERT seulement, avec la note, et journalise sans contenu", async () => {
    const r = await marquerEcartCorrige(fd({ ecartId: ECART, note: "Note fictive" }));
    expect(r).toEqual({ ok: true });
    const arg = h.updateEcart.mock.calls[0]![0] as {
      where: unknown;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: ECART, statut: "ouvert" });
    expect(arg.data).toMatchObject({
      statut: "corrige",
      corrigeParId: USER,
      corrigeParNom: "Admin Exemple",
      note: "Note fictive",
    });
    const trace = JSON.stringify(h.journal.mock.calls[0]);
    expect(trace).toContain("conformite.ecart.corrige");
    expect(trace).not.toContain("Note fictive");
  });

  it("rouvre un écart CORRIGÉ seulement", async () => {
    expect(await rouvrirEcart(fd({ ecartId: ECART }))).toEqual({ ok: true });
    const arg = h.updateEcart.mock.calls[0]![0] as {
      where: unknown;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: ECART, statut: "corrige" });
    expect(arg.data).toMatchObject({ statut: "ouvert", corrigeLe: null });
  });

  it("un identifiant qui n'est pas un UUID n'atteint pas la base", async () => {
    expect((await marquerEcartCorrige(fd({ ecartId: "1 OR 1=1" }))).ok).toBe(false);
    expect(h.updateEcart).not.toHaveBeenCalled();
  });

  it("le retour n'accepte que les vues connues", async () => {
    await expect(
      marquerEcartCorrigeAction(fd({ ecartId: ECART, retour: "fiche", cle: "activite-a" })),
    ).rejects.toThrow("REDIRECT:/fr/adm/conformite-rgpd/activite-a");
    await expect(
      marquerEcartCorrigeAction(fd({ ecartId: ECART, retour: "fiche", cle: "//ailleurs" })),
    ).rejects.toThrow("REDIRECT:/fr/adm/conformite-rgpd?onglet=points");
  });
});
