/**
 * La garde contre le double envoi tient face à deux requêtes simultanées : dans
 * la transaction d'écriture, le verrou consultatif est pris D'ABORD, la
 * recherche du doublon se fait ENSUITE, l'écriture en dernier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const ordre: string[] = [];
const replyFindMany = vi.fn();
const eventFindFirst = vi.fn();
const enqueue = vi.fn();
let verrouArgs: unknown[] = [];

const tx = {
  $executeRaw: (...a: unknown[]) => {
    ordre.push("verrou");
    verrouArgs = a;
    return Promise.resolve(1);
  },
  jobApplicationReply: {
    findMany: (...a: unknown[]) => {
      ordre.push("recherche");
      return replyFindMany(...a);
    },
    create: () => {
      ordre.push("ecriture");
      return Promise.resolve({ id: "neuve" });
    },
  },
  jobApplicationEvent: { findFirst: (...a: unknown[]) => eventFindFirst(...a) },
  jobApplication: { update: () => Promise.resolve({}) },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    jobApplicationReply: { update: vi.fn() },
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: () => "a@b.fr",
  isDecryptedEmailUsable: () => true,
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: async () => ({ subject: "s", html: "<p>h</p>", text: "t" }),
}));
vi.mock("@/server/careers/lien-suppression-candidature", () => ({
  lienSuppressionCandidature: async () => null,
}));
vi.mock("../journal", () => ({
  consignerEvenement: async () => {
    ordre.push("journal");
  },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueue(...a) }));

import { ecrireEtEnfilerReponse } from "../envoyer-reponse";

const candidature = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "chiffre",
  locale: "fr" as const,
  status: "reviewing",
  offerTitleSnap: null,
};
const acteur = { userId: "u1", nom: "Fondateur" };
const contenu = { subject: "Votre candidature", bodyMarkdown: "Bonjour", modele: "libre" as const };

beforeEach(() => {
  ordre.length = 0;
  verrouArgs = [];
  replyFindMany.mockReset().mockResolvedValue([]);
  eventFindFirst.mockReset().mockResolvedValue(null);
  enqueue.mockReset().mockResolvedValue({ enqueued: true });
});

describe("ecrireEtEnfilerReponse — garde contre le doublon", () => {
  it("🔴 verrou, puis recherche, puis écriture, dans cet ordre", async () => {
    const r = await ecrireEtEnfilerReponse(candidature, acteur, contenu, {
      garderContreDoublon: true,
    });
    expect(r).toEqual({ ecrit: true, enfile: true, replyId: "neuve" });
    expect(ordre.slice(0, 3)).toEqual(["verrou", "recherche", "ecriture"]);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("le verrou est paramétré (clé en valeur liée), jamais concaténée au SQL", async () => {
    await ecrireEtEnfilerReponse(candidature, acteur, contenu, { garderContreDoublon: true });
    const [gabarit, ...valeurs] = verrouArgs as [string[], ...unknown[]];
    expect(gabarit.join("?")).toContain("pg_advisory_xact_lock");
    expect(gabarit.join("")).not.toContain(candidature.id);
    expect(valeurs.join("")).toContain(candidature.id);
  });

  it("🔴 un doublon vu DANS la transaction n'écrit rien et n'enfile rien", async () => {
    replyFindMany.mockResolvedValue([{ id: "deja" }]);
    eventFindFirst.mockResolvedValue({ replyId: "deja" });
    const r = await ecrireEtEnfilerReponse(candidature, acteur, contenu, {
      garderContreDoublon: true,
    });
    expect(r).toEqual({ ecrit: false, error: "doublon", replyId: "deja" });
    expect(ordre).toEqual(["verrou", "recherche"]);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("la recherche exclut les réponses failed et bounced, et borne la fenêtre à 60 s", async () => {
    await ecrireEtEnfilerReponse(candidature, acteur, contenu, { garderContreDoublon: true });
    const where = (replyFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where.deliveryStatus).toEqual({ in: ["pending", "sent"] });
    expect(where.repliedByUserId).toBe("u1");
    expect(where.subject).toBe(contenu.subject);
    const depuis = (where.repliedAt as { gte: Date }).gte.getTime();
    expect(Date.now() - depuis).toBeGreaterThan(55_000);
    expect(Date.now() - depuis).toBeLessThan(65_000);
  });

  it("même objet mais autre corps : la réponse légitime est écrite", async () => {
    replyFindMany.mockResolvedValue([{ id: "autre" }]);
    eventFindFirst.mockResolvedValue(null);
    const r = await ecrireEtEnfilerReponse(candidature, acteur, contenu, {
      garderContreDoublon: true,
    });
    expect(r.ecrit).toBe(true);
  });

  it("sans l'option (envoi groupé, réponse automatique), ni verrou ni recherche", async () => {
    await ecrireEtEnfilerReponse(candidature, acteur, contenu);
    expect(ordre).not.toContain("verrou");
    expect(ordre).not.toContain("recherche");
    expect(ordre).toContain("ecriture");
  });
});
