// @vitest-environment node
//
// Les garde-fous de l'envoi du guide (lot L2, 2026-09-24) : ce qui protège le
// compte d'envoi qui porte AUSSI les factures, les convocations et les liens
// de connexion. Chaque borne a son cas, et chaque cas son témoin positif.

import { describe, it, expect, vi, beforeEach } from "vitest";

const emailLogCount = vi.fn();
const guideUpdate = vi.fn();
const enqueueEmail = vi.fn();
const coupeCircuitDeclenche = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { count: (...a: unknown[]) => emailLogCount(...a) },
    guideRequest: { update: (...a: unknown[]) => guideUpdate(...a) },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("../coupe-circuit", () => ({
  coupeCircuitDeclenche: (...a: unknown[]) => coupeCircuitDeclenche(...a),
}));

import { mettreEnFileGuide } from "../envoi";
import {
  LIMITE_PAR_DESTINATAIRE,
  PLAFOND_HORAIRE_GUIDE,
  PRIORITE_GUIDE,
  GABARIT_GUIDE,
} from "../config";

const DEMANDE = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "jeanne@example.invalid",
  locale: "fr" as const,
  downloadToken: "a".repeat(64),
};
const MAINTENANT = new Date("2026-09-24T10:00:00Z");

/** `count` rend d'abord les envois au destinataire (24 h), puis ceux de l'heure. */
function compteurs(destinataire: number, heure: number): void {
  emailLogCount.mockImplementation(async (arg: { where: { recipient?: string } }) =>
    arg.where.recipient ? destinataire : heure,
  );
}

beforeEach(() => {
  emailLogCount.mockReset();
  guideUpdate.mockReset().mockResolvedValue({});
  enqueueEmail.mockReset().mockResolvedValue({ enqueued: true });
  coupeCircuitDeclenche.mockReset().mockResolvedValue(false);
  compteurs(0, 0);
});

describe("mettreEnFileGuide — le chemin nominal (témoin positif)", () => {
  it("met en file « Votre guide », priorité basse, lié à la demande, et pose queued_at", async () => {
    const r = await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT });
    expect(r).toBe("en-file");
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const [gabarit, a, locale, payload, options] = enqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe(GABARIT_GUIDE);
    expect(a).toBe(DEMANDE.email);
    expect(locale).toBe("fr");
    expect(payload).toEqual({ downloadToken: DEMANDE.downloadToken });
    expect(options).toMatchObject({
      entityType: "GuideRequest",
      entityId: DEMANDE.id,
      priority: PRIORITE_GUIDE,
    });
    expect(guideUpdate).toHaveBeenCalledWith({
      where: { id: DEMANDE.id },
      data: { queuedAt: MAINTENANT },
    });
  });

  it("⛔ n'est JAMAIS marketing : ZeptoMail interdit la lettre, pas la livraison d'un document", async () => {
    await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT });
    const options = enqueueEmail.mock.calls[0]?.[4] as Record<string, unknown>;
    expect(options["marketing"]).toBeUndefined();
  });

  it("porte le jeton de confirmation de la lettre quand il y en a un", async () => {
    await mettreEnFileGuide(DEMANDE, { confirmToken: "c".repeat(64), maintenant: MAINTENANT });
    expect(enqueueEmail.mock.calls[0]?.[3]).toEqual({
      downloadToken: DEMANDE.downloadToken,
      confirmToken: "c".repeat(64),
    });
  });
});

describe("les bornes", () => {
  it(`🔴 ${LIMITE_PAR_DESTINATAIRE} envois vers la même adresse en 24 h : le suivant ne part pas`, async () => {
    compteurs(LIMITE_PAR_DESTINATAIRE, 0);
    expect(await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT })).toBe(
      "limite-destinataire",
    );
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(guideUpdate).not.toHaveBeenCalled();
  });

  it("témoin : juste sous la limite, l'envoi part", async () => {
    compteurs(LIMITE_PAR_DESTINATAIRE - 1, 0);
    expect(await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT })).toBe("en-file");
  });

  it("la limite par destinataire se compte sur 24 h GLISSANTES, pour ce gabarit et cette adresse", async () => {
    await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT });
    const arg = emailLogCount.mock.calls.find(
      (c) => (c[0] as { where: { recipient?: string } }).where.recipient,
    )?.[0] as { where: { template: string; recipient: string; createdAt: { gte: Date } } };
    expect(arg.where.template).toBe(GABARIT_GUIDE);
    expect(arg.where.recipient).toBe(DEMANDE.email);
    expect(arg.where.createdAt.gte.toISOString()).toBe("2026-09-23T10:00:00.000Z");
  });

  it(`🔴 plafond horaire (${PLAFOND_HORAIRE_GUIDE}/h) atteint : la demande ATTEND, queued_at reste vide`, async () => {
    compteurs(0, PLAFOND_HORAIRE_GUIDE);
    expect(await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT })).toBe("plafond");
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(guideUpdate).not.toHaveBeenCalled();
  });

  it("🔴 coupe-circuit déclenché : rien ne part, et rien n'est même compté", async () => {
    coupeCircuitDeclenche.mockResolvedValue(true);
    expect(await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT })).toBe("suspendu");
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("la trace suit l'envoi, jamais l'intention", () => {
  it("🔴 envoi RETENU (liste de suppression) : queued_at n'est PAS posé", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: false, retenu: "rebond_dur" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT })).toBe("non-parti");
    expect(guideUpdate).not.toHaveBeenCalled();
  });

  it("garé en corbeille de validation : queued_at posé, pour ne pas le garer deux fois dans l'heure", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true, outboxId: "x" });
    expect(await mettreEnFileGuide(DEMANDE, { maintenant: MAINTENANT })).toBe("en-validation");
    expect(guideUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("🔴 un pic de 300 demandes en une heure", () => {
  it(`${PLAFOND_HORAIRE_GUIDE} partent tout de suite, les autres attendent le rattrapage — les factures ne font pas la queue`, async () => {
    let enFileCetteHeure = 0;
    emailLogCount.mockImplementation(async (arg: { where: { recipient?: string } }) =>
      arg.where.recipient ? 0 : enFileCetteHeure,
    );
    enqueueEmail.mockImplementation(async () => {
      enFileCetteHeure++;
      return { enqueued: true };
    });

    const resultats: string[] = [];
    for (let i = 0; i < 300; i++) {
      resultats.push(
        await mettreEnFileGuide(
          { ...DEMANDE, id: `demande-${i}`, email: `personne-${i}@example.invalid` },
          { maintenant: MAINTENANT },
        ),
      );
    }
    expect(resultats.filter((r) => r === "en-file")).toHaveLength(PLAFOND_HORAIRE_GUIDE);
    expect(resultats.filter((r) => r === "plafond")).toHaveLength(300 - PLAFOND_HORAIRE_GUIDE);
    // Chaque e-mail du guide porte une priorité : BullMQ sert d'abord les jobs
    // SANS priorité (factures, convocations, liens de connexion).
    for (const appel of enqueueEmail.mock.calls) {
      expect((appel[4] as { priority: number }).priority).toBeGreaterThan(0);
    }
    // Et le plafond laisse de la place sous le limiteur global de 40/h.
    expect(PLAFOND_HORAIRE_GUIDE).toBeLessThan(40);
  });
});
