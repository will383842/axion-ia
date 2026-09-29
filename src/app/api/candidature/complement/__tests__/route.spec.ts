// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const completer = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ ok: true }));
vi.mock("@/features/job-application/complement-envoi", () => ({
  completerCandidature: (...a: unknown[]) => completer(...a),
}));

import { POST } from "../route";

const requete = (fd: FormData) =>
  new Request("https://axion-ia.com/api/candidature/complement", { method: "POST", body: fd });

describe("POST /api/candidature/complement — l'adresse fixe du formulaire tarifs", () => {
  it("transmet le formulaire et rend l'état en JSON (200 si enregistré)", async () => {
    const fd = new FormData();
    fd.set("jeton", "j");
    const rep = await POST(requete(fd) as never);
    expect(rep.status).toBe(200);
    expect(await rep.json()).toEqual({ ok: true });
    expect((completer.mock.calls[0]![0] as FormData).get("jeton")).toBe("j");
  });

  it("un refus (lien invalide, prix manquant) rend 422 avec le message à afficher", async () => {
    completer.mockResolvedValueOnce({ ok: false, error: "Ce lien n'est plus valide." });
    const rep = await POST(requete(new FormData()) as never);
    expect(rep.status).toBe(422);
    expect(await rep.json()).toEqual({ ok: false, error: "Ce lien n'est plus valide." });
  });
});
