/**
 * Lot F-CAL-2 — F3 et F4 : la famille `formateur` des messages d'un rendez-vous.
 * Interrupteur coupé : rien, pas même une lecture de la table.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v.replace(/^enc:/, "") }));

import {
  PASSAGES_FORMATEUR,
  envoyerMessagesEchangeFormateur,
  executerPassageFormateur,
  payloadEchange,
} from "../rappels-echange-formateur";

const MAINTENANT = new Date("2026-10-20T08:00:00.000Z");
const RDV = {
  id: "evt_f1",
  inviteeName: "Camille Martin",
  inviteeEmail: "camille@example.com",
  startTime: new Date("2026-10-21T08:00:00.000Z"),
  location: "https://meet.example/abc",
  linkedJobApplicationId: "0b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10",
  linkedJobApplication: { email: "enc:camille@candidature.example" },
};

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([RDV]);
  update.mockResolvedValue({ id: "evt_f1" });
});

describe("interrupteur coupé", () => {
  it("aucun passage, aucune lecture, aucun envoi", async () => {
    const envoyer = vi.fn();
    const r = await envoyerMessagesEchangeFormateur(MAINTENANT, {
      allume: async () => false,
      envoyer,
    });
    expect(r).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("une lecture d'interrupteur qui lève vaut « coupé »", async () => {
    const r = await envoyerMessagesEchangeFormateur(MAINTENANT, {
      allume: async () => {
        throw new Error("base");
      },
      envoyer: vi.fn(),
    });
    expect(r).toEqual([]);
  });
});

describe("interrupteur allumé", () => {
  it("F3 part par l'adaptateur des formateurs, rattaché à la candidature, puis le marqueur est posé", async () => {
    const envoyer = vi.fn().mockResolvedValue("envoye");
    const b = await executerPassageFormateur(PASSAGES_FORMATEUR[0]!, MAINTENANT, envoyer);
    expect(b.envoyes).toBe(1);
    const e = envoyer.mock.calls[0]![0];
    expect(e.gabarit).toBe("formateur-echange-confirme");
    expect(e.entityType).toBe("JobApplication");
    // L'adresse de la candidature, jamais `inviteeEmail` (colonne qu'une route publique écrit).
    expect(e.destinataire).toBe("camille@candidature.example");
    expect(e.entityId).toBe(RDV.linkedJobApplicationId);
    expect(e.jobId).toBe("formateur-echange-confirmation-evt_f1");
    expect(e.jobId.startsWith("fi-")).toBe(false);
    expect(e.payload.valeurs).toEqual({
      jour: "mercredi 21 octobre",
      heure: "10:00",
      "HH:MM": "10:00",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "evt_f1" },
      data: { confirmationEnvoyeeAt: MAINTENANT },
      select: { id: true },
    });
  });

  it("la population : échange formateur RATTACHÉ, non annulé, non anonymisé, réservé depuis moins de 48 h", async () => {
    await executerPassageFormateur(
      PASSAGES_FORMATEUR[0]!,
      MAINTENANT,
      vi.fn().mockResolvedValue("envoye"),
    );
    const where = findMany.mock.calls[0]![0].where;
    expect(where.status).toBe("scheduled");
    expect(where.linkedJobApplicationId).toEqual({ not: null });
    expect(where.confirmationEnvoyeeAt).toBeNull();
    expect(where.capturedAt).toEqual({ gte: new Date("2026-10-18T08:00:00.000Z") });
    expect(JSON.stringify(where.AND)).toContain("formateur");
    expect(findMany.mock.calls[0]![0].take).toBe(31);
  });

  it("F4 veille et une heure avant : deux variantes, deux marqueurs distincts, fenêtres de 15 min", () => {
    const [, j1, h1] = PASSAGES_FORMATEUR;
    expect(j1).toMatchObject({
      etape: 1,
      marqueur: "rappelJ1EnvoyeAt",
      fenetre: { minMinutes: 1440, maxMinutes: 1455 },
    });
    expect(h1).toMatchObject({
      etape: 2,
      marqueur: "rappelEnvoyeAt",
      fenetre: { minMinutes: 60, maxMinutes: 75 },
    });
  });

  it("texte pas encore validé : aucun marqueur, on retente au passage suivant", async () => {
    const b = await executerPassageFormateur(
      PASSAGES_FORMATEUR[1]!,
      MAINTENANT,
      vi.fn().mockResolvedValue("texte-non-valide"),
    );
    expect(b.envoyes).toBe(0);
    expect(b.refus).toEqual({ "texte-non-valide": 1 });
    expect(update).not.toHaveBeenCalled();
  });

  it("adresse retenue : refus définitif, marqueur posé pour ne pas retenter chaque minute", async () => {
    const b = await executerPassageFormateur(
      PASSAGES_FORMATEUR[2]!,
      MAINTENANT,
      vi.fn().mockResolvedValue("retenu"),
    );
    expect(b.envoyes).toBe(0);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("une panne sur une ligne ne bloque pas les suivantes (aucun marqueur pour elle)", async () => {
    findMany.mockResolvedValue([RDV, { ...RDV, id: "evt_f2" }]);
    const envoyer = vi.fn().mockResolvedValueOnce("indisponible").mockResolvedValueOnce("envoye");
    const b = await executerPassageFormateur(PASSAGES_FORMATEUR[0]!, MAINTENANT, envoyer);
    expect(envoyer).toHaveBeenCalledTimes(2);
    expect(b.envoyes).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].where).toEqual({ id: "evt_f2" });
  });

  it("candidature effacée : rien ne part, marqueur posé", async () => {
    findMany.mockResolvedValue([{ ...RDV, linkedJobApplication: { email: "enc:x@erased.local" } }]);
    const envoyer = vi.fn();
    await executerPassageFormateur(PASSAGES_FORMATEUR[0]!, MAINTENANT, envoyer);
    expect(envoyer).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("plafond : 30 par passage au plus", async () => {
    findMany.mockResolvedValue(Array.from({ length: 31 }, (_, i) => ({ ...RDV, id: `e${i}` })));
    const envoyer = vi.fn().mockResolvedValue("envoye");
    const b = await executerPassageFormateur(PASSAGES_FORMATEUR[0]!, MAINTENANT, envoyer);
    expect(envoyer).toHaveBeenCalledTimes(30);
    expect(b.plafondAtteint).toBe(true);
  });

  it("le bouton « Rejoindre la visio » ne prend qu'un lien https", () => {
    expect(payloadEchange({ ...RDV, location: "Téléphone" }).lien).toBeUndefined();
    expect(payloadEchange(RDV).lien).toBe("https://meet.example/abc");
    expect(payloadEchange({ ...RDV, inviteeName: null }).prenom).toBeUndefined();
  });
});
