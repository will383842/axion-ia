// @vitest-environment node

/**
 * Vérification 1, défaut V1-C-8 — F38 « votre virement attend votre attestation »
 * part depuis le SUIVI QUOTIDIEN, pour chaque facture de mission due dont le virement
 * est suspendu par l'attestation URSSAF, une seule fois par facture, sans clic console.
 *
 *   · facture due (reçue, non payée), attestation en cause : F38 part, clé
 *     `formateur-virement-en-attente-<relevé>` ;
 *   · déjà parti (journal des envois, hors échec) ou garé en corbeille : rien ;
 *   · autre motif de suspension (IBAN, désaccord…) : rien ;
 *   · une lecture en échec : 0, jamais d'exception.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const emailLogs = vi.fn();
const corbeille = vi.fn();
const etats = vi.fn();
const f38 = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: { findMany: (...a: unknown[]) => findMany(...a) },
    emailLog: { count: (...a: unknown[]) => emailLogs(...a) },
    emailOutbox: { count: (...a: unknown[]) => corbeille(...a) },
  },
}));
vi.mock("../virements-a-faire-lecture", () => ({
  etatsVirementsMission: (...a: unknown[]) => etats(...a),
}));
vi.mock("../virement-fait-envoi", () => ({
  envoyerVirementEnAttente: (...a: unknown[]) => f38(...a),
}));

import { envoyerF38Dus } from "../virement-en-attente-suivi";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MAINTENANT = new Date("2038-08-03T07:15:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([{ id: A }, { id: B }]);
  etats.mockResolvedValue(
    new Map([
      [A, { motifs: ["attestation_urssaf_echue_a_la_mission"] }],
      [B, { motifs: ["iban_en_verification"] }],
    ]),
  );
  emailLogs.mockResolvedValue(0);
  corbeille.mockResolvedValue(0);
  f38.mockResolvedValue("envoye");
});

describe("V1-C-8 — F38 depuis le suivi quotidien", () => {
  it("facture due bloquée par l'attestation : F38 part, une fois ; l'autre motif n'envoie rien", async () => {
    expect(await envoyerF38Dus(MAINTENANT)).toBe(1);
    expect(f38).toHaveBeenCalledTimes(1);
    expect(f38).toHaveBeenCalledWith(A);
    // Les relevés lus : de mission, factures reçues, non payés, non contestés.
    const where = findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      origine: "passage_mission",
      statut: "facture_recue",
      payeAt: null,
      avoirDeId: null,
      numeroFacture: { not: null },
    });
    expect(etats).toHaveBeenCalledWith([A, B], MAINTENANT);
    expect(emailLogs).toHaveBeenCalledWith({
      where: { jobId: `formateur-virement-en-attente-${A}`, status: { not: "failed" } },
    });
  });

  it("déjà parti (clic console ou passage d'hier) : rien de plus", async () => {
    emailLogs.mockResolvedValue(1);
    expect(await envoyerF38Dus(MAINTENANT)).toBe(0);
    expect(f38).not.toHaveBeenCalled();
  });

  it("garé en corbeille de validation : jamais regaré chaque jour", async () => {
    corbeille.mockResolvedValue(1);
    expect(await envoyerF38Dus(MAINTENANT)).toBe(0);
    expect(f38).not.toHaveBeenCalled();
  });

  it("aucune facture due : rien n'est lu au-delà", async () => {
    findMany.mockResolvedValue([]);
    expect(await envoyerF38Dus(MAINTENANT)).toBe(0);
    expect(etats).not.toHaveBeenCalled();
  });

  it("une lecture en échec : 0, sans exception", async () => {
    etats.mockRejectedValue(new Error("base indisponible"));
    expect(await envoyerF38Dus(MAINTENANT)).toBe(0);
  });

  it("l'envoi d'une facture échoue : les suivantes partent quand même", async () => {
    etats.mockResolvedValue(
      new Map([
        [A, { motifs: ["attestation_urssaf_echue_a_la_mission"] }],
        [B, { motifs: ["attestation_urssaf_echue_a_la_mission"] }],
      ]),
    );
    f38.mockRejectedValueOnce(new Error("file indisponible")).mockResolvedValueOnce("envoye");
    expect(await envoyerF38Dus(MAINTENANT)).toBe(1);
    expect(f38).toHaveBeenCalledTimes(2);
  });
});
