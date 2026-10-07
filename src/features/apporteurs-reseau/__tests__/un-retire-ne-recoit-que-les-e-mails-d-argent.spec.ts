// Un apporteur RETIRÉ du réseau ne reçoit plus que les e-mails liés à l'ARGENT
// (2026-10-07) : commande signée, relevé, vigilance, virement. Tous les autres s'arrêtent
// dans `envoyer()`, quel que soit l'appelant — y compris ceux qui partent d'une présentation.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  retraitDe: vi.fn(),
  enqueueEmail: vi.fn(),
  presentation: vi.fn(),
}));
vi.mock("../retrait", () => ({
  retraitDe: (...a: unknown[]) => h.retraitDe(...a),
  GABARITS_ARGENT: new Set([
    "apporteur-vigilance",
    "apporteur-commande-signee",
    "apporteur-releve",
    "apporteur-virement-fait",
  ]),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
  emailsQueue: null,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { presentationEntreprise: { findUnique: (...a: unknown[]) => h.presentation(...a) } },
}));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/lib/email/templates/apporteur-demarrage", () => ({ texteParDefaut: () => undefined }));

import { envoyer, type EnvoiApporteur } from "../envois";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const envoi = (gabarit: EnvoiApporteur["gabarit"], over: Partial<EnvoiApporteur> = {}) =>
  envoyer({
    gabarit,
    destinataire: "claire@exemple.fr",
    payload: {},
    entityType: "ApporteurReseau",
    entityId: ID,
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("apporteur retiré", () => {
  beforeEach(() => h.retraitDe.mockResolvedValue(new Date()));

  it.each([
    "apporteur-dossier-lien",
    "apporteur-dossier-a-completer",
    "apporteur-contrat-signe",
    "apporteur-presentation-recue",
  ] as const)("%s : ne part pas (fiche-retiree)", async (g) => {
    expect(await envoi(g)).toBe("fiche-retiree");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it.each([
    "apporteur-vigilance",
    "apporteur-commande-signee",
    "apporteur-releve",
    "apporteur-virement-fait",
  ] as const)("%s (argent) : part toujours", async (g) => {
    expect(await envoi(g)).toBe("envoye");
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("un e-mail rattaché à une PRÉSENTATION remonte à son apporteur", async () => {
    h.presentation.mockResolvedValue({ apporteurId: ID });
    const r = await envoi("apporteur-presentation-refusee", {
      entityType: "PresentationEntreprise",
      entityId: "pres-1",
    });
    expect(r).toBe("fiche-retiree");
    expect(h.retraitDe).toHaveBeenCalledWith(ID);
  });
});

describe("apporteur dans le réseau (contre-témoin)", () => {
  it("le lien du dossier part normalement", async () => {
    h.retraitDe.mockResolvedValue(null);
    expect(await envoi("apporteur-dossier-lien")).toBe("envoye");
  });
});
