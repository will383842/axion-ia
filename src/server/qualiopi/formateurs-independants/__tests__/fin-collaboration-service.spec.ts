// Lot L14 — le service de fin de collaboration : une transaction, aucune suppression.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { appels, reponses, client } = vi.hoisted(() => {
  const appels: Array<{ modele: string; methode: string; args: unknown }> = [];
  const reponses: Record<string, unknown> = {};

  function modele(nom: string) {
    return new Proxy(
      {},
      {
        get(_t, methode: string) {
          if (/^delete/.test(methode)) {
            throw new Error(`INTERDIT : ${nom}.${methode}`);
          }
          return async (args: unknown) => {
            appels.push({ modele: nom, methode, args });
            return (
              reponses[`${nom}.${methode}`] ?? (methode.endsWith("Many") ? { count: 1 } : null)
            );
          };
        },
      },
    );
  }

  const client: object = new Proxy(
    {},
    {
      get(_t, cle: string) {
        if (cle === "$transaction") return async (fn: (tx: unknown) => unknown) => fn(client);
        return modele(cle);
      },
    },
  );

  return { appels, reponses, client };
});

vi.mock("@/lib/prisma", () => ({ prisma: client }));
const { activation, retrait } = vi.hoisted(() => ({
  activation: vi.fn(async () => ({ ok: true })),
  retrait: vi.fn(async () => 0),
}));
vi.mock("@/server/qualiopi/trainers/mission-formateur", () => ({
  retirerSollicitationsDuFormateur: retrait,
}));
vi.mock("../activation", () => ({ changerActivationFormateur: activation }));

import { terminerCollaboration } from "../fin-collaboration-service";

const ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const MAINTENANT = new Date("2026-10-13T08:00:00Z");
const JOUR = 24 * 60 * 60 * 1000;

const fiche = (over: Record<string, unknown> = {}) => ({
  id: ID,
  prenom: "Camille",
  email: "camille@example.com",
  statut: "sous_traitant",
  organismeSousTraitantId: null,
  finCollaborationAt: null,
  sousTraitantContratSigneAt: null,
  createdAt: new Date("2026-03-01T00:00:00Z"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  appels.length = 0;
  for (const k of Object.keys(reponses)) delete reponses[k];
  reponses["trainer.findUnique"] = fiche();
  reponses["documentGenere.findMany"] = [];
  reponses["missionFormateur.findMany"] = [];
  reponses["sessionFormateur.findMany"] = [];
  reponses["trainingSession.findMany"] = [];
  reponses["emailLog.findFirst"] = null;
});

const base = {
  trainerId: ID,
  note: "",
  irreparable: false,
  userId: ADMIN,
  role: "admin",
  annuleePar: "Administrateur",
};

describe("terminerCollaboration", () => {
  it("salarié ou intervenant d'un organisme : refusé, rien n'est écrit", async () => {
    reponses["trainer.findUnique"] = fiche({ statut: "salarie" });
    const r = await terminerCollaboration(
      { ...base, motif: "siret_cesse", dateEffet: MAINTENANT },
      MAINTENANT,
    );
    expect(r).toEqual({ ok: false, raison: "pas-independant" });
    reponses["trainer.findUnique"] = fiche({ organismeSousTraitantId: ADMIN });
    expect(
      await terminerCollaboration(
        { ...base, motif: "siret_cesse", dateEffet: MAINTENANT },
        MAINTENANT,
      ),
    ).toEqual({ ok: false, raison: "pas-independant" });
    expect(appels.some((a) => a.methode.startsWith("update") || a.methode === "create")).toBe(
      false,
    );
  });

  it("déjà terminée : refusé", async () => {
    reponses["trainer.findUnique"] = fiche({ finCollaborationAt: new Date("2026-09-01") });
    const r = await terminerCollaboration(
      { ...base, motif: "siret_cesse", dateEffet: MAINTENANT },
      MAINTENANT,
    );
    expect(r).toEqual({ ok: false, raison: "deja-terminee" });
  });

  it("manquement sans avertissement de 8 jours : refusé, rien n'est écrit", async () => {
    reponses["emailLog.findFirst"] = { createdAt: new Date(MAINTENANT.getTime() - 2 * JOUR) };
    const r = await terminerCollaboration(
      { ...base, motif: "manquement", dateEffet: MAINTENANT },
      MAINTENANT,
    );
    expect(r).toMatchObject({ ok: false, raison: "refus", refus: ["avertissement-manquant"] });
    expect(appels.some((a) => a.methode.startsWith("update"))).toBe(false);
  });

  it("missions acceptées après la date d'effet : refusé et listées", async () => {
    reponses["missionFormateur.findMany"] = [
      { sessionId: "s1", session: { dateDebut: new Date("2026-12-01T00:00:00Z") } },
    ];
    const r = await terminerCollaboration(
      { ...base, motif: "initiative_axion", dateEffet: new Date("2026-11-12T00:00:00Z") },
      MAINTENANT,
    );
    expect(r).toMatchObject({ ok: false, raison: "refus", refus: ["missions-apres-effet"] });
  });

  it("fin immédiate : fiche fermée, accès révoqués, contrat non signé annulé, journal sans note", async () => {
    reponses["documentGenere.findMany"] = [{ id: "33333333-3333-4333-8333-333333333333" }];
    const r = await terminerCollaboration(
      { ...base, motif: "siret_cesse", dateEffet: MAINTENANT, note: "Note privée de Will" },
      MAINTENANT,
    );
    expect(r).toMatchObject({ ok: true });

    const maj = appels.find((a) => a.modele === "trainer" && a.methode === "updateMany");
    expect(maj?.args).toMatchObject({
      where: { id: ID, finCollaborationAt: null },
      data: {
        finCollaborationAt: MAINTENANT,
        finCollaborationMotif: "siret_cesse",
        finCollaborationParId: ADMIN,
        finCollaborationNote: "Note privée de Will",
        accesVersion: { increment: 1 },
      },
    });
    // `actif` passe par son écrivain unique, jamais par cette transaction.
    expect((maj?.args as { data: Record<string, unknown> }).data.actif).toBeUndefined();
    expect(activation).toHaveBeenCalledWith(
      expect.objectContaining({ trainerId: ID, actif: false, motif: "Fin de collaboration" }),
    );

    const annulation = appels.find(
      (a) => a.modele === "documentGenere" && a.methode === "updateMany",
    );
    expect(annulation?.args).toMatchObject({
      where: { id: { in: ["33333333-3333-4333-8333-333333333333"] }, annuleeAt: null },
      data: { annuleeAt: MAINTENANT, annuleePar: "Administrateur" },
    });
    const jetons = appels.find(
      (a) => a.modele === "documentSignatureToken" && a.methode === "updateMany",
    );
    expect(jetons?.args).toMatchObject({
      where: { revokedAt: null, usedAt: null },
      data: { revokedAt: MAINTENANT, revokedById: ADMIN },
    });

    const journal = appels.find((a) => a.modele === "activityLog" && a.methode === "create");
    const data = (journal?.args as { data: Record<string, unknown> }).data;
    expect(data.targetId).toBe(ID);
    expect(JSON.stringify(data)).not.toContain("Note privée");
    expect(JSON.stringify(data)).not.toContain("camille");
  });

  it("avec préavis : la fiche reste active jusqu'à la date d'effet", async () => {
    const r = await terminerCollaboration(
      { ...base, motif: "initiative_axion", dateEffet: new Date("2026-11-12T00:00:00Z") },
      MAINTENANT,
    );
    expect(r).toMatchObject({ ok: true, preavis: 30 });
    const maj = appels.find((a) => a.modele === "trainer" && a.methode === "updateMany");
    expect((maj?.args as { data: Record<string, unknown> }).data.actif).toBeUndefined();
    expect(activation).not.toHaveBeenCalled();
    expect(retrait).toHaveBeenCalledWith(ID);
  });

  it("une fin concurrente déjà écrite : refusé, journal non écrit", async () => {
    reponses["trainer.updateMany"] = { count: 0 };
    const r = await terminerCollaboration(
      { ...base, motif: "siret_cesse", dateEffet: MAINTENANT },
      MAINTENANT,
    );
    expect(r).toEqual({ ok: false, raison: "deja-terminee" });
    expect(appels.some((a) => a.modele === "activityLog")).toBe(false);
  });
});
