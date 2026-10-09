// « Ouvrir mon espace » (décision de Will, 2026-10-09) : chaque e-mail adressé à l'apporteur
// porte son lien personnel, pour qu'il retrouve son espace depuis le dernier e-mail reçu.
// Jamais pour un dossier refusé, jamais pour un e-mail interne ; sans lien, l'e-mail part
// quand même.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  retraitDe: vi.fn(),
  enqueueEmail: vi.fn(),
  presentation: vi.fn(),
  apporteur: vi.fn(),
  urlDossier: vi.fn(),
}));
vi.mock("../retrait", () => ({
  retraitDe: (...a: unknown[]) => h.retraitDe(...a),
  GABARITS_ARGENT: new Set(["apporteur-releve", "apporteur-virement-fait"]),
}));
vi.mock("../jeton", () => ({ urlDossier: (...a: unknown[]) => h.urlDossier(...a) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
  emailsQueue: null,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: { findUnique: (...a: unknown[]) => h.presentation(...a) },
    apporteurReseau: { findUnique: (...a: unknown[]) => h.apporteur(...a) },
  },
}));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/lib/email/templates/apporteur-demarrage", () => ({ texteParDefaut: () => undefined }));

import { envoyer, type EnvoiApporteur } from "../envois";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const LIEN = `https://axion-ia.com/apporteur/dossier/${ID}/jeton`;
const payloadEnvoye = () => h.enqueueEmail.mock.calls[0]![3] as Record<string, unknown>;
const envoi = (gabarit: EnvoiApporteur["gabarit"], over: Partial<EnvoiApporteur> = {}) =>
  envoyer({
    gabarit,
    destinataire: "claire@exemple.fr",
    payload: { prenom: "Claire" },
    entityType: "ApporteurReseau",
    entityId: ID,
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.retraitDe.mockResolvedValue(null);
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
  h.apporteur.mockResolvedValue({
    versionLien: 2,
    statut: "signe",
    refuseAt: null,
    resilieAt: null,
  });
  h.urlDossier.mockReturnValue(LIEN);
});

describe("le lien de l'espace accompagne les e-mails à l'apporteur", () => {
  it.each([
    "apporteur-contrat-signe",
    "apporteur-attribution-confirmee",
    "apporteur-releve",
    "apporteur-virement-fait",
  ] as const)("%s : lienEspace ajouté, le reste du payload intact", async (g) => {
    expect(await envoi(g)).toBe("envoye");
    expect(payloadEnvoye()).toEqual({ prenom: "Claire", lienEspace: LIEN });
    expect(h.urlDossier).toHaveBeenCalledWith(ID, 2);
  });

  it("depuis une présentation : l'apporteur de la présentation", async () => {
    h.presentation.mockResolvedValue({ apporteurId: ID });
    await envoi("apporteur-presentation-recue", {
      entityType: "PresentationEntreprise",
      entityId: "p1",
    });
    expect(payloadEnvoye().lienEspace).toBe(LIEN);
  });

  it("dossier refusé : jamais (le lien mène à une page neutre)", async () => {
    await envoi("apporteur-dossier-refuse");
    expect(payloadEnvoye()).toEqual({ prenom: "Claire" });
  });

  it.each([
    ["statut refuse", { statut: "refuse" }],
    ["statut resilie", { statut: "resilie" }],
    ["refuseAt posé", { refuseAt: new Date() }],
    ["resilieAt posé", { resilieAt: new Date() }],
  ] as const)(
    "fiche refusée ou résiliée (%s) : jamais, vérifié sur la FICHE et pas sur le gabarit",
    async (_cas, fiche) => {
      h.apporteur.mockResolvedValue({
        versionLien: 2,
        statut: "signe",
        refuseAt: null,
        resilieAt: null,
        ...fiche,
      });
      expect(await envoi("apporteur-releve")).toBe("envoye");
      expect(payloadEnvoye()).toEqual({ prenom: "Claire" });
      expect(h.urlDossier).not.toHaveBeenCalled();
    },
  );

  it("alerte interne à Williams : jamais", async () => {
    await envoi("apporteur-dossier-a-verifier");
    expect(payloadEnvoye()).toEqual({ prenom: "Claire" });
  });

  it.each(["apporteur-releve", "apporteur-virement-fait"] as const)(
    "apporteur RETIRÉ : l'e-mail d'argent (%s) part, SANS lien d'espace",
    async (g) => {
      h.retraitDe.mockResolvedValue(new Date());
      expect(await envoi(g)).toBe("envoye");
      expect(payloadEnvoye()).toEqual({ prenom: "Claire" });
      expect(h.urlDossier).not.toHaveBeenCalled();
    },
  );

  it("base indisponible : l'e-mail part quand même, sans le lien", async () => {
    h.apporteur.mockRejectedValue(new Error("base"));
    expect(await envoi("apporteur-contrat-signe")).toBe("envoye");
    expect(payloadEnvoye()).toEqual({ prenom: "Claire" });
  });
});

describe("un lienEspace fourni par l'appelant n'est jamais repris (relecture de #1408)", () => {
  const PIRATE = "https://pirate.example/x";
  const avecPirate = { payload: { prenom: "Claire", lienEspace: PIRATE } };

  it("fiche normale : le lien CALCULÉ écrase celui du payload", async () => {
    expect(await envoi("apporteur-releve", avecPirate)).toBe("envoye");
    expect(payloadEnvoye()).toEqual({ prenom: "Claire", lienEspace: LIEN });
    expect(h.urlDossier).toHaveBeenCalledWith(ID, 2);
  });

  it("apporteur RETIRÉ : aucune clé lienEspace", async () => {
    h.retraitDe.mockResolvedValue(new Date());
    expect(await envoi("apporteur-releve", avecPirate)).toBe("envoye");
    expect(payloadEnvoye()).toEqual({ prenom: "Claire" });
    expect(payloadEnvoye()).not.toHaveProperty("lienEspace");
  });

  it("fiche résiliée : aucune clé lienEspace", async () => {
    h.apporteur.mockResolvedValue({
      versionLien: 2,
      statut: "resilie",
      refuseAt: null,
      resilieAt: new Date(),
    });
    expect(await envoi("apporteur-releve", avecPirate)).toBe("envoye");
    expect(payloadEnvoye()).toEqual({ prenom: "Claire" });
    expect(payloadEnvoye()).not.toHaveProperty("lienEspace");
  });
});
