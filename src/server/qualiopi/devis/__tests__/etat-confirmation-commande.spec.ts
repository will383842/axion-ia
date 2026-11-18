/**
 * État de la confirmation de commande d'un devis classique : lecture seule, trois valeurs.
 * « a_valider » : une ligne de la file des e-mails attend validation ; « aucune » : rien nulle
 * part (ou base muette : la reprise est idempotente) ; « autre » : approuvée, envoyée, refusée
 * ou présente seulement au journal.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  outbox: [] as Array<{ statut: string }>,
  log: null as { id: string } | null,
  erreur: false,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findMany: () =>
        etat.erreur ? Promise.reject(new Error("base muette")) : Promise.resolve(etat.outbox),
      findFirst: () =>
        etat.erreur
          ? Promise.reject(new Error("base muette"))
          : Promise.resolve(etat.outbox[0] ?? null),
    },
    emailLog: { findFirst: () => Promise.resolve(etat.log) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ existsInR2: vi.fn(), uploadToR2: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/cgv-pdf", () => ({ rendreCgvPdf: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({ formulesActives: vi.fn() }));

import { etatConfirmationCommande } from "../confirmation-commande";

describe("etatConfirmationCommande", () => {
  beforeEach(() => {
    etat.outbox = [];
    etat.log = null;
    etat.erreur = false;
  });

  it("aucune ligne nulle part : « aucune »", async () => {
    expect(await etatConfirmationCommande("d1")).toBe("aucune");
  });

  it("une ligne « à valider » : « a_valider »", async () => {
    etat.outbox = [{ statut: "a_valider" }];
    expect(await etatConfirmationCommande("d1")).toBe("a_valider");
  });

  it.each(["approuve", "envoye", "refuse"])("ligne au statut %s : « autre »", async (statut) => {
    etat.outbox = [{ statut }];
    expect(await etatConfirmationCommande("d1")).toBe("autre");
  });

  it("présente seulement au journal : « autre »", async () => {
    etat.log = { id: "l1" };
    expect(await etatConfirmationCommande("d1")).toBe("autre");
  });

  it("base muette : « aucune » (la reprise reste idempotente)", async () => {
    etat.erreur = true;
    expect(await etatConfirmationCommande("d1")).toBe("aucune");
  });
});
