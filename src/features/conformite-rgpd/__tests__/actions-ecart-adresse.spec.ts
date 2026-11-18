// @vitest-environment node
// « Mettre une adresse à l'écart » (console Conformité RGPD) : super_admin, motif obligatoire,
// origine `console`, aucune suppression, l'adresse n'est jamais répétée dans la réponse.
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  session: null as unknown,
  ecarter: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: async () => d.session }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => d.revalidate(...a) }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/server/rgpd/ecarter-au-lieu-d-effacer", () => ({
  ecarterPourDemandeEffacement: (...a: unknown[]) => d.ecarter(...a),
}));

import { ecarterAdresseAction } from "../actions-ecart-adresse";

const form = (c: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(c)) f.set(k, v);
  return f;
};
const ADRESSE = "stagiaire@exemple.test";

beforeEach(() => {
  d.ecarter.mockReset().mockResolvedValue({ etapesEnEchec: [] });
  d.revalidate.mockReset();
  d.session = { user: { id: "super-1", role: "super_admin" } };
});

describe("ecarterAdresseAction", () => {
  it("🔴 super_admin : appelle la mise à l'écart avec l'origine « console » et le motif", async () => {
    const r = await ecarterAdresseAction(
      null,
      form({ email: ADRESSE, motif: "demande par e-mail" }),
    );
    expect(r).toMatchObject({ ok: true });
    expect(d.ecarter).toHaveBeenCalledWith(
      expect.objectContaining({
        email: ADRESSE,
        origine: "console",
        adminUserId: "super-1",
        motif: "demande par e-mail",
      }),
    );
    expect(JSON.stringify(r)).not.toContain(ADRESSE);
  });

  it.each(["admin", "editor", undefined])("🔴 rôle %s refusé, rien n'est écarté", async (role) => {
    d.session = { user: { id: "u-1", role } };
    const r = await ecarterAdresseAction(null, form({ email: ADRESSE, motif: "motif" }));
    expect(r).toMatchObject({ ok: false });
    expect(d.ecarter).not.toHaveBeenCalled();
  });

  it("sans session : refusé", async () => {
    d.session = null;
    const r = await ecarterAdresseAction(null, form({ email: ADRESSE, motif: "motif" }));
    expect(r).toMatchObject({ ok: false });
    expect(d.ecarter).not.toHaveBeenCalled();
  });

  it("🔴 motif obligatoire", async () => {
    for (const motif of ["", "  ", "ab"]) {
      const r = await ecarterAdresseAction(null, form({ email: ADRESSE, motif }));
      expect(r).toMatchObject({ ok: false });
    }
    expect(d.ecarter).not.toHaveBeenCalled();
  });

  it("adresse invalide refusée ; adresse dans le motif refusée (le journal n'a pas d'adresse)", async () => {
    expect(
      await ecarterAdresseAction(null, form({ email: "pas-une-adresse", motif: "motif" })),
    ).toMatchObject({ ok: false });
    expect(
      await ecarterAdresseAction(null, form({ email: ADRESSE, motif: `écrit par ${ADRESSE}` })),
    ).toMatchObject({ ok: false });
    expect(d.ecarter).not.toHaveBeenCalled();
  });

  it("🔴 marque ou opposition en échec : « incomplète », pas « fait »", async () => {
    d.ecarter.mockResolvedValue({ etapesEnEchec: ["marque"] });
    const r = await ecarterAdresseAction(null, form({ email: ADRESSE, motif: "motif" }));
    expect(r).toMatchObject({ ok: false, erreur: expect.stringMatching(/incompl[eè]te.*marque/i) });
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it("panne totale : erreur lisible, sans l'adresse", async () => {
    d.ecarter.mockRejectedValue(new Error("empreinte"));
    const r = await ecarterAdresseAction(null, form({ email: ADRESSE, motif: "motif" }));
    expect(r).toMatchObject({ ok: false });
    expect(JSON.stringify(r)).not.toContain(ADRESSE);
  });
});
