// @vitest-environment node
//
// Rattrapage horaire du guide (lot L2, modèle ADR 0050). Les cas qui comptent
// sont ceux où il ne doit RIEN faire : un guide reçu deux fois vaut moins que
// zéro, et un rattrapage qui tourne pendant une rafale de rebonds l'aggrave.

import { describe, it, expect, vi, beforeEach } from "vitest";

const guideFindMany = vi.fn();
const guideFindUnique = vi.fn();
const guideUpdateMany = vi.fn();
const guideCount = vi.fn();
const emailLogFindMany = vi.fn();
const outboxCount = vi.fn();
const abonneFindUnique = vi.fn();
const abonneFindMany = vi.fn();
const abonneUpdate = vi.fn();
const abonneUpdateMany = vi.fn();
const mettreEnFileGuide = vi.fn();
const envoisDeLaDerniereHeure = vi.fn();
const coupeCircuitDeclenche = vi.fn();
const verdictAvantEnvoi = vi.fn();
const enqueueEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findMany: (...a: unknown[]) => guideFindMany(...a),
      findUnique: (...a: unknown[]) => guideFindUnique(...a),
      updateMany: (...a: unknown[]) => guideUpdateMany(...a),
      count: (...a: unknown[]) => guideCount(...a),
    },
    emailLog: { findMany: (...a: unknown[]) => emailLogFindMany(...a) },
    emailOutbox: { count: (...a: unknown[]) => outboxCount(...a) },
    newsletterSubscriber: {
      findUnique: (...a: unknown[]) => abonneFindUnique(...a),
      findMany: (...a: unknown[]) => abonneFindMany(...a),
      update: (...a: unknown[]) => abonneUpdate(...a),
      updateMany: (...a: unknown[]) => abonneUpdateMany(...a),
    },
  },
}));
vi.mock("../envoi", () => ({
  mettreEnFileGuide: (...a: unknown[]) => mettreEnFileGuide(...a),
  envoisDeLaDerniereHeure: (...a: unknown[]) => envoisDeLaDerniereHeure(...a),
}));
vi.mock("../coupe-circuit", () => ({
  coupeCircuitDeclenche: (...a: unknown[]) => coupeCircuitDeclenche(...a),
}));
vi.mock("@/server/email/verdict-envoi", () => ({
  verdictAvantEnvoi: (...a: unknown[]) => verdictAvantEnvoi(...a),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

import { rattraperGuides, rattraperConfirmations } from "../rattrapage";
import { PLAFOND_HORAIRE_GUIDE } from "../config";

const MAINTENANT = new Date("2026-09-24T12:00:00Z");
const CANDIDATE = {
  id: "demande-1",
  email: "jeanne@example.invalid",
  locale: "fr",
  downloadToken: "a".repeat(64),
  sendCount: 0,
};

beforeEach(() => {
  guideFindMany.mockReset().mockResolvedValue([CANDIDATE]);
  guideFindUnique.mockReset().mockResolvedValue({ sentAt: null, sendCount: 0 });
  guideUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  guideCount.mockReset().mockResolvedValue(0);
  emailLogFindMany.mockReset().mockResolvedValue([]);
  outboxCount.mockReset().mockResolvedValue(0);
  abonneFindUnique.mockReset().mockResolvedValue(null);
  abonneFindMany.mockReset().mockResolvedValue([]);
  abonneUpdate.mockReset().mockResolvedValue({});
  abonneUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mettreEnFileGuide.mockReset().mockResolvedValue("en-file");
  envoisDeLaDerniereHeure.mockReset().mockResolvedValue(0);
  coupeCircuitDeclenche.mockReset().mockResolvedValue(false);
  verdictAvantEnvoi.mockReset().mockResolvedValue({ retenu: false });
  enqueueEmail.mockReset().mockResolvedValue({ enqueued: true });
});

describe("rattraperGuides — ce qui est repris", () => {
  it("témoin positif : une demande restée sans envoi est remise en file", async () => {
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(1);
    expect(mettreEnFileGuide).toHaveBeenCalledTimes(1);
  });

  it("🔴 la requête : formulaire SEULEMENT, non partie, âge compté depuis queued_at", async () => {
    await rattraperGuides(MAINTENANT);
    const arg = guideFindMany.mock.calls[0]?.[0] as {
      where: {
        origine: string;
        sentAt: null;
        OR: Array<{ queuedAt: null | { lt: Date } }>;
      };
    };
    // Une ligne `origine = admin` est un geste humain : jamais rejouée.
    expect(arg.where.origine).toBe("formulaire");
    expect(arg.where.sentAt).toBeNull();
    expect(arg.where.OR).toEqual([
      { queuedAt: null },
      { queuedAt: { lt: new Date("2026-09-24T11:00:00Z") } },
    ]);
  });

  it("porte la confirmation de la lettre si l'abonné l'attend encore", async () => {
    abonneFindUnique.mockResolvedValue({ status: "pending", confirmToken: "c".repeat(64) });
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide.mock.calls[0]?.[1]).toMatchObject({ confirmToken: "c".repeat(64) });
    expect(abonneUpdateMany).toHaveBeenCalledWith({
      where: { email: CANDIDATE.email, status: "pending" },
      data: { confirmSentAt: MAINTENANT },
    });
  });
});

describe("rattraperGuides — ce qui ne doit JAMAIS être renvoyé", () => {
  it("🔴 en file depuis 2 h mais DÉJÀ envoyée (journal `sent`) : trace réparée, AUCUN renvoi", async () => {
    const envoyeLe = new Date("2026-09-24T10:01:00Z");
    emailLogFindMany.mockResolvedValue([{ status: "sent", sentAt: envoyeLe }]);
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(r.reparees).toBe(1);
    expect(guideUpdateMany).toHaveBeenCalledWith({
      where: { id: CANDIDATE.id, sentAt: null },
      data: { sentAt: envoyeLe },
    });
  });

  it("🔴 `send_count` relu juste avant : > 0 ⇒ pas de renvoi", async () => {
    guideFindUnique.mockResolvedValue({ sentAt: null, sendCount: 1 });
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("partie entre la requête et la relecture : écartée", async () => {
    guideFindUnique.mockResolvedValue({ sentAt: new Date(), sendCount: 1 });
    const r = await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(r.ecartees).toBe(1);
  });

  it("encore EN FILE (journal `pending`) : on n'en ajoute pas une seconde", async () => {
    emailLogFindMany.mockResolvedValue([{ status: "pending", sentAt: null }]);
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("garée en corbeille de validation : on ne la gare pas une seconde fois", async () => {
    outboxCount.mockResolvedValue(1);
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });

  it("adresse en rebond dur : pas de nouvelle tentative toutes les heures", async () => {
    verdictAvantEnvoi.mockResolvedValue({ retenu: true, motif: "rebond_dur", depuis: null });
    await rattraperGuides(MAINTENANT);
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
  });
});

describe("rattraperGuides — les freins", () => {
  it("🔴 coupe-circuit déclenché : le rattrapage est SUSPENDU, il ne lit même pas la file", async () => {
    coupeCircuitDeclenche.mockResolvedValue(true);
    const r = await rattraperGuides(MAINTENANT);
    expect(r.suspendu).toBe(true);
    expect(guideFindMany).not.toHaveBeenCalled();
    expect(mettreEnFileGuide).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 ne relâche que la PLACE restante sous le plafond horaire", async () => {
    envoisDeLaDerniereHeure.mockResolvedValue(PLAFOND_HORAIRE_GUIDE - 2);
    guideFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ ...CANDIDATE, id: `d-${i}` })),
    );
    const r = await rattraperGuides(MAINTENANT);
    expect(r.relancees).toBe(2);
    expect(mettreEnFileGuide).toHaveBeenCalledTimes(2);
  });

  it("table absente (le worker précède la migration) : rien à faire, en silence", async () => {
    guideFindMany.mockRejectedValue(Object.assign(new Error("no table"), { code: "P2021" }));
    const r = await rattraperGuides(MAINTENANT);
    expect(r.candidates).toBe(0);
  });
});

describe("rattraperConfirmations", () => {
  const ABONNE = {
    id: "abonne-1",
    email: "paul@example.invalid",
    locale: "fr",
    confirmToken: "c".repeat(64),
    unsubscribeToken: "u".repeat(64),
  };

  it("relance une confirmation orpheline, et ne pose confirm_sent_at qu'une fois en file", async () => {
    abonneFindMany.mockResolvedValue([ABONNE]);
    expect(await rattraperConfirmations(MAINTENANT)).toBe(1);
    expect(enqueueEmail.mock.calls[0]?.[0]).toBe("newsletter-confirm-optin");
    expect(abonneUpdate).toHaveBeenCalledTimes(1);
  });

  it("n'y touche pas si une demande du guide l'emporte déjà", async () => {
    abonneFindMany.mockResolvedValue([ABONNE]);
    guideCount.mockResolvedValue(1);
    expect(await rattraperConfirmations(MAINTENANT)).toBe(0);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("envoi retenu : confirm_sent_at reste vide", async () => {
    abonneFindMany.mockResolvedValue([ABONNE]);
    enqueueEmail.mockResolvedValue({ enqueued: false, retenu: "desabonne" });
    expect(await rattraperConfirmations(MAINTENANT)).toBe(0);
    expect(abonneUpdate).not.toHaveBeenCalled();
  });
});
