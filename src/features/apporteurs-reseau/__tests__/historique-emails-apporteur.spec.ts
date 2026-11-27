/* eslint-disable @typescript-eslint/no-explicit-any -- double de base en mémoire */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Historique des e-mails de la fiche apporteur : filtre par apporteur, tri, limite de 50.
type Ligne = Record<string, any>;
const bd = vi.hoisted(() => ({
  logs: [] as Ligne[],
  presentations: [] as Ligne[],
  dernierAppel: null as any,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findMany: async ({ where }: any) =>
        bd.presentations.filter((p) => p.apporteurId === where.apporteurId),
    },
    emailLog: {
      findMany: async (arg: any) => {
        bd.dernierAppel = arg;
        const { where, orderBy, take } = arg;
        expect(orderBy[0]).toEqual({ createdAt: "desc" });
        const clesOk = (l: Ligne) =>
          where.OR.some(
            (c: any) =>
              c.entityType === l.entityType &&
              (typeof c.entityId === "string"
                ? c.entityId === l.entityId
                : c.entityId.in.includes(l.entityId)),
          );
        return bd.logs
          .filter((l) => l.recipient.toLowerCase() === where.recipient.toLowerCase() && clesOk(l))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, take);
      },
    },
  },
}));

import { LIMITE_HISTORIQUE_EMAILS, lireHistoriqueEmailsApporteur } from "../requetes-console";

const log = (id: string, entityId: string, minutes: number, extra: Ligne = {}): Ligne => ({
  id,
  entityType: "ApporteurReseau",
  entityId,
  template: "apporteur-lien-espace",
  recipient: "camille@exemple.test",
  status: "sent",
  createdAt: new Date(Date.UTC(2026, 10, 1, 10, minutes)),
  sentAt: null,
  error: null,
  contenu: { subject: `Objet ${id}` },
  ...extra,
});

const EMAIL = "Camille@exemple.test";

describe("lireHistoriqueEmailsApporteur", () => {
  beforeEach(() => {
    bd.logs = [];
    bd.presentations = [];
    bd.dernierAppel = null;
  });

  it("ne lit que les e-mails de CET apporteur (type et identifiant)", async () => {
    bd.logs = [
      log("a", "app-1", 1),
      log("b", "app-2", 2),
      log("c", "app-1", 3, { entityType: "PresentationEntreprise" }),
    ];
    const r = await lireHistoriqueEmailsApporteur("app-1", EMAIL);
    expect(r.map((e) => e.id)).toEqual(["a"]);
    expect(bd.dernierAppel.where.OR).toEqual([
      { entityType: "ApporteurReseau", entityId: "app-1" },
    ]);
  });

  it("écarte les alertes internes posées sur la clé de l'apporteur (autre destinataire)", async () => {
    bd.logs = [
      log("pour-lui", "app-1", 1),
      log("interne", "app-1", 2, {
        recipient: "alertes@axion.test",
        template: "qualiopi-alerte-interne",
      }),
    ];
    const r = await lireHistoriqueEmailsApporteur("app-1", EMAIL);
    expect(r.map((e) => e.id)).toEqual(["pour-lui"]);
  });

  it("inclut les e-mails posés sur ses présentations, pas ceux d'un autre apporteur", async () => {
    bd.presentations = [
      { id: "pres-1", apporteurId: "app-1" },
      { id: "pres-2", apporteurId: "app-2" },
    ];
    bd.logs = [
      log("annonce", "pres-1", 3, { entityType: "PresentationEntreprise" }),
      log("autre", "pres-2", 4, { entityType: "PresentationEntreprise" }),
      log("entreprise", "pres-1", 5, {
        entityType: "PresentationEntreprise",
        recipient: "contact@entreprise.test",
      }),
      log("direct", "app-1", 1),
    ];
    const r = await lireHistoriqueEmailsApporteur("app-1", EMAIL);
    expect(r.map((e) => e.id)).toEqual(["annonce", "direct"]);
  });

  it("sans adresse connue : liste vide, sans lire le journal", async () => {
    bd.logs = [log("a", "app-1", 1)];
    expect(await lireHistoriqueEmailsApporteur("app-1", null)).toEqual([]);
    expect(bd.dernierAppel).toBeNull();
  });

  it("trie du plus récent au plus ancien", async () => {
    bd.logs = [log("vieux", "app-1", 1), log("recent", "app-1", 30), log("milieu", "app-1", 15)];
    const r = await lireHistoriqueEmailsApporteur("app-1", EMAIL);
    expect(r.map((e) => e.id)).toEqual(["recent", "milieu", "vieux"]);
  });

  it("borne à 50 lignes", async () => {
    bd.logs = Array.from({ length: 60 }, (_, i) => log(`l${i}`, "app-1", i));
    const r = await lireHistoriqueEmailsApporteur("app-1", EMAIL);
    expect(LIMITE_HISTORIQUE_EMAILS).toBe(50);
    expect(bd.dernierAppel.take).toBe(50);
    expect(r).toHaveLength(50);
    expect(r[0]!.id).toBe("l59");
  });

  it("date = envoi si parti, sinon création ; objet nul sans copie", async () => {
    const envoye = new Date("2026-11-02T08:00:00Z");
    bd.logs = [
      log("p", "app-1", 5, { sentAt: envoye }),
      log("q", "app-1", 4, { contenu: null, status: "failed", error: "refus" }),
    ];
    const [p, q] = await lireHistoriqueEmailsApporteur("app-1", EMAIL);
    expect(p!.date).toEqual(envoye);
    expect(p!.objet).toBe("Objet p");
    expect(q!.objet).toBeNull();
    expect(q!.date).toEqual(new Date(Date.UTC(2026, 10, 1, 10, 4)));
    expect(q!.status).toBe("failed");
  });

  it("aucun e-mail : liste vide", async () => {
    expect(await lireHistoriqueEmailsApporteur("app-1", EMAIL)).toEqual([]);
  });
});
