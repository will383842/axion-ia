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
const creations = vi.fn();
const evenements: Array<{ replyId: string; body: string; meta?: Record<string, unknown> }> = [];
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
      creations();
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
  consignerEvenement: async (e: {
    replyId: string;
    body: string;
    meta?: Record<string, unknown>;
  }) => {
    evenements.push(e);
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
  creations.mockReset();
  evenements.length = 0;
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

  it("la recherche exclut failed et bounced : `pending` à tout âge, `sent` dans la fenêtre de 60 s", async () => {
    await ecrireEtEnfilerReponse(candidature, acteur, contenu, { garderContreDoublon: true });
    const where = (replyFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where.repliedByUserId).toBe("u1");
    expect(where.subject).toBe(contenu.subject);
    expect(where.deliveryStatus).toBeUndefined();
    expect(where.repliedAt).toBeUndefined();
    const ou = where.OR as Array<{ deliveryStatus: string; repliedAt?: { gte: Date } }>;
    expect(ou[0]).toEqual({ deliveryStatus: "pending" });
    expect(ou[1]?.deliveryStatus).toBe("sent");
    const depuis = (ou[1]?.repliedAt as { gte: Date }).gte.getTime();
    expect(Date.now() - depuis).toBeGreaterThan(55_000);
    expect(Date.now() - depuis).toBeLessThan(65_000);
  });

  describe("âge d'une réponse identique (filtre évalué sur des lignes réelles)", () => {
    type Filtre = { OR: Array<{ deliveryStatus: string; repliedAt?: { gte: Date } }> };
    function brancherLigne(statut: string, ageMs: number): void {
      const repliedAt = new Date(Date.now() - ageMs);
      replyFindMany.mockImplementation(async (arg: { where: Filtre }) =>
        arg.where.OR.some(
          (c) =>
            c.deliveryStatus === statut &&
            (c.repliedAt === undefined || repliedAt >= c.repliedAt.gte),
        )
          ? [{ id: "deja" }]
          : [],
      );
      eventFindFirst.mockResolvedValue({ replyId: "deja" });
    }

    it("🔴 A7 : `pending` vieille de 10 minutes est un doublon, rien n'est écrit", async () => {
      brancherLigne("pending", 10 * 60_000);
      const r = await ecrireEtEnfilerReponse(candidature, acteur, contenu, {
        garderContreDoublon: true,
      });
      expect(r).toEqual({ ecrit: false, error: "doublon", replyId: "deja" });
      expect(ordre).not.toContain("ecriture");
      expect(enqueue).not.toHaveBeenCalled();
    });

    it("A8 (témoin) : `sent` vieille de 10 minutes n'est pas un doublon", async () => {
      brancherLigne("sent", 10 * 60_000);
      const r = await ecrireEtEnfilerReponse(candidature, acteur, contenu, {
        garderContreDoublon: true,
      });
      expect(r).toMatchObject({ ecrit: true });
      expect(ordre).toContain("ecriture");
    });
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

describe("garde contre le doublon — texte saisi avec {lien_complement}", () => {
  type Cond = { body?: string; meta?: { path: string[]; equals: string }; OR?: Cond[] };
  const correspond = (ev: (typeof evenements)[number], c: Cond): boolean => {
    if (c.OR) return c.OR.some((x) => correspond(ev, x));
    if (c.body !== undefined && ev.body !== c.body) return false;
    if (c.meta && ev.meta?.[c.meta.path[0] as string] !== c.meta.equals) return false;
    return true;
  };
  /** Un journal en mémoire : la recherche du doublon relit ce qui a été écrit. */
  function brancherJournal(): void {
    replyFindMany.mockResolvedValue([{ id: "neuve" }]);
    eventFindFirst.mockImplementation(async (arg: { where: Cond }) => {
      const trouve = evenements.find((ev) => correspond(ev, arg.where));
      return trouve ? { replyId: trouve.replyId } : null;
    });
  }
  const saisi = "Bonjour, complétez : {lien_complement}";
  const envoi = (texte: string, corps: string) =>
    ecrireEtEnfilerReponse(
      candidature,
      acteur,
      { ...contenu, bodyMarkdown: corps, texteSaisi: texte },
      { garderContreDoublon: true },
    );

  it("🔴 (a) même texte saisi, liens aux jetons différents, le premier `pending` : doublon", async () => {
    brancherJournal();
    const premier = await envoi(saisi, "Bonjour, complétez : https://x/complement?jeton=AAA");
    expect(premier).toMatchObject({ ecrit: true });
    const second = await envoi(saisi, "Bonjour, complétez : https://x/complement?jeton=BBB");
    expect(second).toEqual({ ecrit: false, error: "doublon", replyId: "neuve" });
    expect(creations).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("l'empreinte est enregistrée, le texte saisi n'y figure pas en clair", async () => {
    await envoi(saisi, "corps rempli");
    const meta = evenements[0]?.meta ?? {};
    expect(meta.empreinte_saisie).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(meta)).not.toContain("complétez");
  });

  it("(b) deux textes différents contenant le lien : pas un doublon", async () => {
    brancherJournal();
    await envoi(saisi, "Bonjour, complétez : https://x/complement?jeton=AAA");
    const autre = await envoi(
      "Salut, voici le lien : {lien_complement}",
      "Salut, voici le lien : https://x/complement?jeton=BBB",
    );
    expect(autre).toMatchObject({ ecrit: true });
    expect(creations).toHaveBeenCalledTimes(2);
  });

  it("(c) ancienne ligne sans empreinte : comparaison sur le corps, comme avant", async () => {
    brancherJournal();
    evenements.push({ replyId: "ancienne", body: "Bonjour", meta: { modele: "libre" } });
    const r = await envoi("Bonjour", "Bonjour");
    expect(r).toEqual({ ecrit: false, error: "doublon", replyId: "ancienne" });
    expect(creations).not.toHaveBeenCalled();
  });
});
