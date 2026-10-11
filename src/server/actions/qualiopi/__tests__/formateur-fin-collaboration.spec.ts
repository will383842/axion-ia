/**
 * Lot L14 — actions « fin de collaboration » : rôle, interrupteur, e-mail après la fin.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  auth: vi.fn(),
  allume: vi.fn(),
  terminer: vi.fn(),
  contexte: vi.fn(),
  missions: vi.fn(),
  envoyer: vi.fn(),
  apercu: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => d.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { adminUser: { findUnique: vi.fn(async () => ({ name: "Admin" })) } },
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: (...a: unknown[]) => d.allume(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  envoyer: (...a: unknown[]) => d.envoyer(...a),
  apercu: (...a: unknown[]) => d.apercu(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/fin-collaboration-service", () => ({
  terminerCollaboration: (...a: unknown[]) => d.terminer(...a),
  lireContexteFin: (...a: unknown[]) => d.contexte(...a),
  missionsApres: (...a: unknown[]) => d.missions(...a),
  estIndependant: (t: { statut: string; organismeSousTraitantId: string | null }) =>
    t.statut === "sous_traitant" && t.organismeSousTraitantId === null,
}));

import {
  apercuAvertissementAction,
  envoyerAvertissementFormateurAction,
  terminerCollaborationFormateurAction,
} from "../formateur-fin-collaboration";

const ID = "00000000-0000-4000-8000-0000000000aa";
const contexte = {
  trainer: {
    id: ID,
    prenom: "Camille",
    email: "camille@example.com",
    statut: "sous_traitant",
    organismeSousTraitantId: null,
    finCollaborationAt: null,
  },
  debutRelation: new Date("2026-01-01T00:00:00Z"),
  avertissementEnvoyeAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  d.auth.mockResolvedValue({ user: { id: "11111111-1111-4111-8111-111111111111", role: "admin" } });
  d.allume.mockResolvedValue(true);
  d.contexte.mockResolvedValue(contexte);
  d.missions.mockResolvedValue([]);
  d.terminer.mockResolvedValue({ ok: true, preavis: 30, contexte });
  d.envoyer.mockResolvedValue("envoye");
  d.apercu.mockResolvedValue({ sujet: "s", html: "<p></p>", destinataire: "x" });
});

const fin = { trainerId: ID, motif: "initiative_axion" as const, dateEffet: "2026-12-01" };

describe("terminerCollaborationFormateurAction", () => {
  it.each(["editor", "reader", "secretaire"])("rôle « %s » : refus, rien d'écrit", async (role) => {
    d.auth.mockResolvedValue({ user: { id: "u", role } });
    expect(await terminerCollaborationFormateurAction(fin)).toHaveProperty("error");
    expect(d.terminer).not.toHaveBeenCalled();
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("interrupteur absent : refus, rien d'écrit ni d'envoyé", async () => {
    d.allume.mockResolvedValue(false);
    expect(await terminerCollaborationFormateurAction(fin)).toHaveProperty("error");
    expect(d.allume).toHaveBeenCalledWith("fin_collaboration");
    expect(d.terminer).not.toHaveBeenCalled();
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("fin enregistrée : F47 part par l'adaptateur, avec le texte choisi", async () => {
    expect(await terminerCollaborationFormateurAction(fin)).toEqual({ data: { email: "envoye" } });
    const e = d.envoyer.mock.calls[0]![0] as { gabarit: string; payload: { texteLibre: string } };
    expect(e.gabarit).toBe("formateur-fin-collaboration");
    expect(e.payload.texteLibre).toContain("à notre demande, avec un préavis de 30 jours");
  });

  it("décès : la fin est enregistrée, aucun e-mail", async () => {
    expect(
      await terminerCollaborationFormateurAction({
        ...fin,
        motif: "deces",
        dateEffet: "2026-10-20",
      }),
    ).toEqual({ data: { email: "aucun" } });
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("refus du service : message clair, aucun e-mail", async () => {
    d.terminer.mockResolvedValue({
      ok: false,
      raison: "refus",
      refus: ["avertissement-manquant"],
      missions: [],
    });
    const r = await terminerCollaborationFormateurAction({ ...fin, motif: "manquement" });
    expect(r).toEqual({ error: expect.stringContaining("8 jours") });
    expect(d.envoyer).not.toHaveBeenCalled();
  });
});

describe("avertissement F49", () => {
  const av = { trainerId: ID, fait: "Absence non prévenue le 2 octobre." };

  it("interrupteur absent : ni aperçu ni envoi", async () => {
    d.allume.mockResolvedValue(false);
    expect(await apercuAvertissementAction(av)).toHaveProperty("error");
    expect(await envoyerAvertissementFormateurAction(av)).toHaveProperty("error");
    expect(d.apercu).not.toHaveBeenCalled();
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("salarié : refusé", async () => {
    d.contexte.mockResolvedValue({
      ...contexte,
      trainer: { ...contexte.trainer, statut: "salarie" },
    });
    expect(await envoyerAvertissementFormateurAction(av)).toHaveProperty("error");
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("envoi : les deux crochets remplis, clé d'un jour sans adresse", async () => {
    await envoyerAvertissementFormateurAction(av);
    const e = d.envoyer.mock.calls[0]![0] as {
      gabarit: string;
      jobId: string;
      payload: { valeurs: Record<string, string> };
    };
    expect(e.gabarit).toBe("formateur-avertissement");
    expect(e.payload.valeurs["fait précis, écrit par Will"]).toBe(av.fait);
    expect(e.payload.valeurs.date).toBeTruthy();
    expect(e.jobId).toMatch(new RegExp(`^fi-avertissement-${ID}-\\d{8}$`));
  });
});
