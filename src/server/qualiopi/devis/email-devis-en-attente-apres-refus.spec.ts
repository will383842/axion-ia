// Après un refus au rendu, « Renvoyer le devis » reste possible : on appelle la VRAIE
// `emailDevisEnAttente` après la VRAIE `traiterLienSignatureRefuse` (base simulée, lignes en mémoire).
// Et le refus ne vise QUE la ligne de la tâche `outbox-<id>`.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = { id: string; entityId: string; statut: string; [k: string]: unknown };
const h = vi.hoisted(() => ({
  lignes: [] as Ligne[],
  echecEcriture: false,
  telegram: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => h.telegram(...a) }));
vi.mock("@/server/email/email-log", () => ({ cloturerJournal: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findFirst: async ({ where }: { where: { entityId: string; statut: { in: string[] } } }) =>
        h.lignes.find((l) => l.entityId === where.entityId && where.statut.in.includes(l.statut)) ??
        null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; statut: { in: string[] } };
        data: Record<string, unknown>;
      }) => {
        if (h.echecEcriture) throw new Error("base muette");
        const l = h.lignes.find((x) => x.id === where.id && where.statut.in.includes(x.statut));
        if (l) Object.assign(l, data);
        return { count: l ? 1 : 0 };
      },
    },
  },
}));

import { UnrecoverableError } from "bullmq";
import { traiterLienSignatureRefuse } from "@/server/email/lien-signature-refuse-au-rendu";
import { prisma } from "@/lib/prisma";
import { emailDevisEnAttente } from "./email-devis-en-attente";

const entree = {
  job: { id: "outbox-l1", timestamp: Date.now() },
  template: "devis-envoi",
  to: "a@exemple.test",
  locale: "fr",
  marketing: false,
  attempts: 1,
  entityType: "Devis",
  entityId: "d1",
  payload: { numero: "D-1" },
};

beforeEach(() => {
  h.echecEcriture = false;
  h.lignes.length = 0;
  h.lignes.push({ id: "l1", entityId: "d1", statut: "envoye" });
  h.telegram.mockResolvedValue(undefined);
});

describe("renvoi du devis après un refus au rendu (vraie emailDevisEnAttente)", () => {
  it("ligne « envoyé » repassée « refusé » : plus d'e-mail en attente", async () => {
    await expect(traiterLienSignatureRefuse(entree)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.lignes[0]!.statut).toBe("refuse");
    expect(await emailDevisEnAttente(prisma as never, "d1")).toBe(false);
  });
  it("ligne encore « approuvé » (écriture « envoyé » du site pas encore passée) : « refusé » aussi", async () => {
    h.lignes[0]!.statut = "approuve";
    expect(await emailDevisEnAttente(prisma as never, "d1")).toBe(true);
    await traiterLienSignatureRefuse(entree).catch(() => {});
    expect(h.lignes[0]!.statut).toBe("refuse");
    expect(await emailDevisEnAttente(prisma as never, "d1")).toBe(false);
  });
  it("une AUTRE ligne « envoyé » du même devis n'est pas touchée", async () => {
    h.lignes.push({ id: "l2", entityId: "d1", statut: "envoye" });
    await traiterLienSignatureRefuse(entree).catch(() => {});
    expect(h.lignes.find((l) => l.id === "l1")!.statut).toBe("refuse");
    expect(h.lignes.find((l) => l.id === "l2")!.statut).toBe("envoye");
  });
  it("tâche sans `outbox-` (envoi direct) : aucune écriture de corbeille", async () => {
    await expect(
      traiterLienSignatureRefuse({ ...entree, job: { id: "job-9", timestamp: 1 } }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.lignes[0]!.statut).toBe("envoye");
  });
  it("écriture en échec : la ligne reste « envoyé », jamais comptée en attente", async () => {
    h.echecEcriture = true;
    await expect(traiterLienSignatureRefuse(entree)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.lignes[0]!.statut).toBe("envoye");
    expect(await emailDevisEnAttente(prisma as never, "d1")).toBe(false);
  });
  it("l'alerte du premier envoi dit : devis marqué envoyé mais aucun e-mail parti", async () => {
    await traiterLienSignatureRefuse(entree).catch(() => {});
    expect(h.telegram.mock.calls[0]![0].body).toContain(
      "le devis est marqué envoyé mais aucun e-mail n'est parti",
    );
    expect(h.telegram.mock.calls[0]![0].body).toContain("lien neuf n'a été remis à personne");
  });
});
