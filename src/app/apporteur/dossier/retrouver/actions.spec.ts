// « Retrouver mon espace » : la réponse ne dit JAMAIS si l'adresse est celle d'un apporteur ;
// le lien part seulement à une fiche du réseau (pas refusée ni résiliée), dans la limite des
// envois ; un robot (champ piège) et un abus n'envoient rien.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  fiche: vi.fn(),
  envoyer: vi.fn(),
  limite: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { apporteurReseau: { findUnique: (...a: unknown[]) => h.fiche(...a) } },
}));
vi.mock("@/features/apporteurs-reseau/envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
}));
vi.mock("@/features/apporteurs-reseau/jeton", () => ({
  urlDossier: (id: string, v: number) => `https://axion-ia.com/apporteur/dossier/${id}/jeton-v${v}`,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => h.limite(...a) }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => (e ? `h:${e}` : null),
}));

import { demanderLienEspace } from "./actions";
import { MESSAGE_RETROUVER } from "./messages";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const demande = (champs: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return demanderLienEspace(undefined, f);
};

beforeEach(() => {
  vi.clearAllMocks();
  h.limite.mockResolvedValue({ allowed: true });
  h.envoyer.mockResolvedValue("envoye");
  h.fiche.mockResolvedValue(null);
});

describe("la réponse est toujours la même", () => {
  it("adresse inconnue : le message générique, aucun envoi", async () => {
    expect(await demande({ email: "inconnue@exemple.fr" })).toEqual({
      envoye: true,
      message: MESSAGE_RETROUVER,
    });
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("apporteur signé : le même message, et son lien part", async () => {
    h.fiche.mockResolvedValue({ id: ID, prenom: "Claire", statut: "signe", versionLien: 3 });
    expect(await demande({ email: " Claire@Exemple.fr " })).toEqual({
      envoye: true,
      message: MESSAGE_RETROUVER,
    });
    expect(h.fiche).toHaveBeenCalledWith(
      expect.objectContaining({ where: { emailHash: "h:claire@exemple.fr" } }),
    );
    expect(h.envoyer).toHaveBeenCalledWith({
      gabarit: "apporteur-lien-espace",
      destinataire: "claire@exemple.fr",
      payload: { prenom: "Claire", lien: `https://axion-ia.com/apporteur/dossier/${ID}/jeton-v3` },
      entityType: "ApporteurReseau",
      entityId: ID,
    });
  });

  it.each(["dossier_en_cours", "a_completer", "a_verifier"])(
    "dossier « %s » : le lien part",
    async (statut) => {
      h.fiche.mockResolvedValue({ id: ID, prenom: "Claire", statut, versionLien: 1 });
      await demande({ email: "claire@exemple.fr" });
      expect(h.envoyer).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["refuse", "resilie"])(
    "dossier « %s » : le même message, rien ne part",
    async (statut) => {
      h.fiche.mockResolvedValue({ id: ID, prenom: "Claire", statut, versionLien: 1 });
      expect((await demande({ email: "claire@exemple.fr" })).message).toBe(MESSAGE_RETROUVER);
      expect(h.envoyer).not.toHaveBeenCalled();
    },
  );
});

describe("abus", () => {
  it("limite atteinte (ou indisponible) : le message générique, sans même chercher la fiche", async () => {
    h.limite.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
    expect((await demande({ email: "claire@exemple.fr" })).message).toBe(MESSAGE_RETROUVER);
    expect(h.fiche).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("la limite refuse quand elle est indisponible (envoi d'e-mail)", async () => {
    await demande({ email: "claire@exemple.fr" });
    for (const appel of h.limite.mock.calls) {
      expect(appel[1]).toMatchObject({ surPanne: "refuser" });
    }
  });

  it("champ piège rempli : rien n'est cherché ni envoyé", async () => {
    await demande({ email: "claire@exemple.fr", site: "http://spam" });
    expect(h.fiche).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("adresse mal formée : on le dit, sans rien chercher", async () => {
    expect(await demande({ email: "pas-une-adresse" })).toEqual({
      envoye: false,
      message: "Cette adresse e-mail ne semble pas valide.",
    });
    expect(h.fiche).not.toHaveBeenCalled();
  });
});
