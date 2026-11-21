// Après un refus au rendu, « Renvoyer le devis » reste possible : la ligne de corbeille repasse
// « refusé » (ou, si cette écriture échoue, reste « envoyé ») — dans les deux cas
// `emailDevisEnAttente` rend faux (il ne compte que « à valider » et « approuvé »,
// email-devis-en-attente.ts, STATUTS_EN_ATTENTE).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lignes: [] as Array<Record<string, unknown>>,
  echecEcriture: false,
  telegram: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => h.telegram(...a) }));
vi.mock("@/server/email/email-log", () => ({ cloturerJournal: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        h.lignes.find(
          (l) => l["statut"] === where["statut"] && l["entityId"] === where["entityId"],
        ) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        if (h.echecEcriture) throw new Error("base muette");
        const l = h.lignes.find((x) => x["id"] === where.id);
        if (l) Object.assign(l, data);
        return { count: l ? 1 : 0 };
      },
    },
  },
}));

import { UnrecoverableError } from "bullmq";
import { traiterLienSignatureRefuse } from "../lien-signature-refuse-au-rendu";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

// Règle de `email-devis-en-attente.ts` (domaine qualiopi, non importé ici : cloisonnement). Le test
// lit la liste de statuts dans le source pour que la copie ne puisse pas diverger.
const STATUTS_EN_ATTENTE: string[] = JSON.parse(
  /STATUTS_EN_ATTENTE: EmailOutboxStatus\[\] = (\[[^\]]*\])/.exec(
    readFileSync("src/server/qualiopi/devis/email-devis-en-attente.ts", "utf8"),
  )![1]!,
);
async function emailDevisEnAttente(_db: unknown, devisId: string): Promise<boolean> {
  for (const statut of STATUTS_EN_ATTENTE) {
    const l = await prisma.emailOutbox.findFirst({
      where: { template: "devis-envoi", entityType: "Devis", entityId: devisId, statut } as never,
    } as never);
    if (l) return true;
  }
  return false;
}

const entree = {
  job: { id: "j1", timestamp: Date.now() },
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
  h.lignes.push({
    id: "l1",
    template: "devis-envoi",
    entityType: "Devis",
    entityId: "d1",
    recipient: "a@exemple.test",
    statut: "envoye",
    envoyeAt: new Date(),
  });
  h.telegram.mockResolvedValue(undefined);
});

describe("renvoi du devis après un refus au rendu", () => {
  it("ligne repassée « refusé » : plus d'e-mail en attente, le renvoi est autorisé", async () => {
    await expect(traiterLienSignatureRefuse(entree)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.lignes[0]!["statut"]).toBe("refuse");
    expect(await emailDevisEnAttente(prisma as never, "d1")).toBe(false);
  });
  it("écriture « au mieux » en échec : la ligne reste « envoyé », jamais comptée en attente", async () => {
    h.echecEcriture = true;
    await expect(traiterLienSignatureRefuse(entree)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(h.lignes[0]!["statut"]).toBe("envoye");
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
