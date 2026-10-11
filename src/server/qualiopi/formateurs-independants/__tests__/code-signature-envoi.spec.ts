// S6b — L'envoi du code de signature F17 : texte validé exigé, 2 minutes entre deux codes,
// 3 par heure ; le code ne va que dans l'e-mail ; aucune priorité, aucune clé fixe.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  codes: vi.fn(),
  emettre: vi.fn(),
  envoyer: vi.fn(),
  texteValide: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { documentSignatureCode: { findMany: (...a: unknown[]) => h.codes(...a) } },
}));
vi.mock("@/server/qualiopi/documents/signature/code-signature", () => ({
  CODE_VALIDITE_MS: 10 * 60 * 1000,
  emettreCodeSignature: (...a: unknown[]) => h.emettre(...a),
}));
vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  texteValide: (...a: unknown[]) => h.texteValide(...a),
}));

import { envoyerCodeSignature, libelleDuree } from "../code-signature-envoi";

const MAINTENANT = new Date("2026-10-13T08:00:00Z");
const MIN = 60 * 1000;
const demande = () =>
  envoyerCodeSignature({
    documentGenereId: "d-1",
    partie: "sous_traitant",
    trainerId: "t-1",
    destinataire: "claire@exemple.invalid",
    prenom: "Claire",
    maintenant: MAINTENANT,
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.texteValide.mockResolvedValue(true);
  h.codes.mockResolvedValue([]);
  h.emettre.mockResolvedValue({ code: "042517", expiresAt: new Date() });
  h.envoyer.mockResolvedValue("envoye");
});

describe("envoyerCodeSignature", () => {
  it("texte F17 non validé : aucun code n'est émis", async () => {
    h.texteValide.mockResolvedValue(false);
    expect(await demande()).toMatchObject({ ok: false, raison: "texte-non-valide" });
    expect(h.emettre).not.toHaveBeenCalled();
  });
  it("moins de 2 minutes après le précédent : refus", async () => {
    h.codes.mockResolvedValue([{ createdAt: new Date(MAINTENANT.getTime() - MIN) }]);
    expect(await demande()).toMatchObject({ ok: false, raison: "trop-tot" });
    expect(h.emettre).not.toHaveBeenCalled();
  });
  it("trois codes dans l'heure : refus", async () => {
    h.codes.mockResolvedValue([
      { createdAt: new Date(MAINTENANT.getTime() - 5 * MIN) },
      { createdAt: new Date(MAINTENANT.getTime() - 20 * MIN) },
      { createdAt: new Date(MAINTENANT.getTime() - 40 * MIN) },
    ]);
    expect(await demande()).toMatchObject({ ok: false, raison: "trop-de-codes" });
  });
  it("le code part dans l'e-mail, avec sa vraie durée, sans priorité ni clé fixe", async () => {
    const r = await demande();
    expect(r).toEqual({ ok: true });
    expect(JSON.stringify(r)).not.toContain("042517");
    expect(h.envoyer).toHaveBeenCalledWith({
      gabarit: "formateur-code-signature",
      destinataire: "claire@exemple.invalid",
      entityType: "Trainer",
      entityId: "t-1",
      payload: { prenom: "Claire", valeurs: { code: "042517", durée: "10 minutes" } },
    });
  });
  it("le mécanisme refuse d'émettre (secret absent) : envoi impossible", async () => {
    h.emettre.mockRejectedValue(new Error("indisponible"));
    expect(await demande()).toMatchObject({ ok: false, raison: "envoi-impossible" });
    expect(h.envoyer).not.toHaveBeenCalled();
  });
  it("la durée affichée est celle du mécanisme", () => {
    expect(libelleDuree(10 * MIN)).toBe("10 minutes");
    expect(libelleDuree(MIN)).toBe("1 minute");
  });
});
