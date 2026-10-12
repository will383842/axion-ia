// Lot E (M14) — à la clôture, les lettres de mission NON signées sont annulées, jamais supprimées.
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
const { allume } = vi.hoisted(() => ({ allume: vi.fn(async () => false) }));
vi.mock("../interrupteur-allume", () => ({ interrupteurAllume: allume }));

import {
  cloreFinsArrivees,
  deciderFinCollaboration as terminerCollaboration,
} from "../fin-collaboration-service";

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
  finCollaborationDecideeAt: null,
  finCollaborationMotifPrevu: null,
  finCollaborationEffetAt: null,
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

const LETTRE = "44444444-4444-4444-8444-444444444444";

describe("M14 — clôture : lettres de mission non signées", () => {
  it("annule (sans supprimer) les lettres que le formateur n'a pas signées, et révoque leurs liens", async () => {
    reponses["documentGenere.findMany"] = [{ id: LETTRE }];
    const r = await terminerCollaboration(
      { ...base, motif: "siret_cesse", dateEffet: MAINTENANT },
      MAINTENANT,
    );
    expect(r).toMatchObject({ ok: true });

    const lectures = appels.filter(
      (a) => a.modele === "documentGenere" && a.methode === "findMany",
    );
    const lecture = lectures.find(
      (a) => (a.args as { where: { type?: string } }).where.type === "lettre_mission",
    );
    expect(lecture?.args).toMatchObject({
      where: {
        trainerId: ID,
        type: "lettre_mission",
        annuleeAt: null,
        signatures: { none: { revokedAt: null, partie: "formateur" } },
      },
    });

    const annulations = appels.filter(
      (a) => a.modele === "documentGenere" && a.methode === "updateMany",
    );
    const lettre = annulations.find((a) =>
      String((a.args as { data: { annuleeMotif?: string } }).data.annuleeMotif).includes(
        "lettre de mission",
      ),
    );
    expect(lettre?.args).toMatchObject({
      where: {
        id: { in: [LETTRE] },
        annuleeAt: null,
        signatures: { none: { revokedAt: null, partie: "formateur" } },
      },
      data: { annuleeAt: MAINTENANT, annuleePar: "Administrateur" },
    });

    const journal = appels.find(
      (a) =>
        a.modele === "activityLog" &&
        (a.args as { data: { action?: string } }).data.action ===
          "qualiopi.trainer.fin_collaboration_close",
    );
    expect(JSON.stringify(journal?.args)).toContain('"lettresAnnulees":1');
  });

  it("clôture à la date d'effet par le passage quotidien : même annulation, par le système", async () => {
    allume.mockResolvedValue(true);
    reponses["trainer.findMany"] = [
      {
        id: ID,
        finCollaborationMotifPrevu: "initiative_axion",
        finCollaborationDecideeParId: ADMIN,
        finCollaborationEffetAt: new Date(MAINTENANT.getTime() - JOUR),
      },
    ];
    reponses["documentGenere.findMany"] = [{ id: LETTRE }];
    const b = await cloreFinsArrivees(MAINTENANT);
    expect(b).toMatchObject({ etat: "fait", closes: 1, erreurs: 0 });
    const lettre = appels.find(
      (a) =>
        a.modele === "documentGenere" &&
        a.methode === "updateMany" &&
        String((a.args as { data: { annuleeMotif?: string } }).data.annuleeMotif).includes(
          "lettre de mission",
        ),
    );
    expect(lettre?.args).toMatchObject({
      data: { annuleePar: "Système (fin de collaboration à la date d'effet)" },
    });
  });

  it("aucune lettre vivante : rien n'est annulé de ce côté", async () => {
    reponses["documentGenere.findMany"] = [];
    await terminerCollaboration(
      { ...base, motif: "siret_cesse", dateEffet: MAINTENANT },
      MAINTENANT,
    );
    const annulations = appels.filter(
      (a) => a.modele === "documentGenere" && a.methode === "updateMany",
    );
    expect(annulations).toHaveLength(0);
  });
});
