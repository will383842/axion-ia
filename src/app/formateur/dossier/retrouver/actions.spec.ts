// L6 — « Retrouver mon dossier » (F14) : éteint par défaut, réponse toujours neutre,
// envoi seulement à l'adresse ENREGISTRÉE d'un dossier encore à compléter.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  ouvert: vi.fn(),
  trainer: vi.fn(),
  envoyer: vi.fn(),
  limite: vi.fn(),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "ip-hachee" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => h.limite(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { trainer: { findFirst: (...a: unknown[]) => h.trainer(...a) } },
}));
vi.mock("@/server/qualiopi/formateurs-independants/dossier", () => ({
  dossierEnLigneOuvert: () => h.ouvert(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
}));
const magique = vi.fn();
vi.mock("@/server/formateur/magic-link", () => ({
  createFormateurMagicLink: (...a: unknown[]) => magique(...a),
}));

import { demanderLienDossier } from "./actions";
import { MESSAGE_RETROUVER } from "./messages";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
function fd(email: string) {
  const f = new FormData();
  f.set("email", email);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.limite.mockResolvedValue({ allowed: true });
  h.trainer.mockResolvedValue({
    id: ID,
    prenom: "Marie",
    email: "marie@exemple.fr",
    accesVersion: 0,
  });
});

describe("retrouver mon dossier (F14)", () => {
  it("interrupteur éteint : réponse neutre, rien n'est lu ni envoyé", async () => {
    h.ouvert.mockResolvedValue(false);
    const r = await demanderLienDossier(undefined, fd("marie@exemple.fr"));
    expect(r).toEqual({ envoye: true, message: MESSAGE_RETROUVER });
    expect(h.trainer).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("allumé : adresse inconnue et adresse connue rendent la MÊME réponse", async () => {
    h.ouvert.mockResolvedValue(true);
    h.trainer.mockResolvedValueOnce(null);
    const inconnue = await demanderLienDossier(undefined, fd("x@exemple.fr"));
    const connue = await demanderLienDossier(undefined, fd("marie@exemple.fr"));
    expect(inconnue).toEqual(connue);
    // L'envoi part sans être attendu (pas d'oracle de temps) : on laisse la file tourner.
    await vi.waitFor(() => expect(h.envoyer).toHaveBeenCalled());
    expect(h.envoyer).toHaveBeenCalledTimes(1);
    expect(h.envoyer.mock.calls[0]![0]).toMatchObject({
      gabarit: "formateur-lien-espace",
      destinataire: "marie@exemple.fr",
      entityId: ID,
    });
  });

  it("limite atteinte : réponse neutre, rien n'est envoyé", async () => {
    h.ouvert.mockResolvedValue(true);
    h.limite.mockResolvedValue({ allowed: false });
    await demanderLienDossier(undefined, fd("marie@exemple.fr"));
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("lot B — fiche ACTIVE : F14 avec « Ouvrir mon espace » et un lien de connexion (IP en empreinte)", async () => {
    h.ouvert.mockResolvedValue(true);
    h.trainer.mockResolvedValue({
      id: ID,
      prenom: "Marie",
      email: "marie@exemple.fr",
      accesVersion: 3,
      actif: true,
    });
    magique.mockResolvedValue("JETON-CONNEXION");
    await demanderLienDossier(undefined, fd("marie@exemple.fr"));
    await vi.waitFor(() => expect(h.envoyer).toHaveBeenCalled());
    expect(magique).toHaveBeenCalledWith(ID, "ip-hachee");
    const e = h.envoyer.mock.calls[0]![0];
    expect(e).toMatchObject({ gabarit: "formateur-lien-espace", entityId: ID });
    expect(e.payload.bouton).toBe(2);
    expect(e.payload.lien).toMatch(/\/fr\/espace-formateur\/connexion\/JETON-CONNEXION$/);
    // La recherche couvre le dossier en cours ET la fiche active.
    expect(h.trainer.mock.calls[0]![0].where.OR).toEqual([
      { dossierStatut: { in: ["en_cours", "a_completer"] } },
      { actif: true },
    ]);
  });
});
