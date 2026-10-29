/**
 * Fiche client, étape 3 : ce que le client a pris. Base SIMULÉE. Garde : les types/étapes viennent
 * du code, l'étape se calcule (et Will peut la forcer), le montant reste en centimes, et l'action
 * refuse un projet d'une autre fiche — sans jamais supprimer.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const CID = "11111111-1111-4111-8111-111111111111";
const PID = "22222222-2222-4222-8222-222222222222";

const bd = vi.hoisted(() => ({
  projet: { findUnique: vi.fn() },
  projetSuivi: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  activityLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const acces = vi.hoisted(() => ({
  exigerAccesEchanges: vi.fn(),
  AccesRefuse: class AccesRefuse extends Error {},
}));
vi.mock("@/lib/prisma", () => ({ prisma: bd }));
vi.mock("@/features/dossier-client/acces", () => acces);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/console/${p}` }));
vi.mock("@/features/dossier-client/message-de-retour", () => ({
  avecMessageDeRetour: (u: string, c: string, t: string) => `${u}&${c}=${t}`,
}));

import { enregistrerSuiviPrestationAction } from "../actions-prestations";
import {
  centimesEnEuros,
  etapeAffichee,
  etapeCalculee,
  eurosEnCentimes,
  messageMontantInvalide,
  TYPES_PRESTATION,
} from "../prestations";
import { assemblerPrestations } from "../suivi-prestations";

const formulaire = (o: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ clientId: CID, projetId: PID, type: "audit", ...o })) {
    fd.set(k, v);
  }
  return fd;
};
const issue = async (fd: FormData): Promise<string> =>
  enregistrerSuiviPrestationAction(fd).then(
    () => "pas de redirection",
    (e: Error) => e.message,
  );

beforeEach(() => {
  vi.clearAllMocks();
  bd.projet.findUnique.mockResolvedValue({ clientId: CID });
  bd.projetSuivi.upsert.mockResolvedValue({});
  bd.projetSuivi.findUnique.mockResolvedValue(null);
  bd.$transaction.mockImplementation(async (fn: (tx: typeof bd) => Promise<unknown>) => fn(bd));
  acces.exigerAccesEchanges.mockResolvedValue({ userId: "admin-1", role: "admin" });
});

describe("types et étapes", () => {
  it("les sept types de Will, « conférence » comprise", () => {
    expect([...TYPES_PRESTATION]).toEqual([
      "formation",
      "audit",
      "coaching",
      "integration_automatisation",
      "site_internet",
      "conference",
      "autre",
    ]);
  });

  it("l'étape se calcule depuis le projet et ses devis", () => {
    expect(etapeCalculee("ouvert", [])).toBe("besoin");
    expect(etapeCalculee("ouvert", ["brouillon"])).toBe("besoin");
    expect(etapeCalculee("ouvert", ["envoye"])).toBe("devis_envoye");
    expect(etapeCalculee("ouvert", ["accepte"])).toBe("accepte");
    expect(etapeCalculee("ouvert", ["envoye", "transforme_convention"])).toBe("accepte");
    expect(etapeCalculee("gagne", [])).toBe("accepte");
    expect(etapeCalculee("termine", [])).toBe("terminee");
    expect(etapeCalculee("en_pause", [])).toBe("en_pause");
    expect(etapeCalculee("perdu", [])).toBe("perdue");
    expect(etapeCalculee("abandonne", [])).toBe("perdue");
  });

  it("l'étape forcée par Will l'emporte ; une valeur inconnue est ignorée", () => {
    expect(etapeAffichee("terminee", "gagne", [])).toEqual({ etape: "terminee", forcee: true });
    expect(etapeAffichee("n'importe quoi", "gagne", [])).toEqual({
      etape: "accepte",
      forcee: false,
    });
  });

  it("le montant : euros -> centimes, vide -> null, négatif ou illisible -> refus", () => {
    expect(eurosEnCentimes("1 500,50")).toBe(150050);
    expect(eurosEnCentimes("1500.5")).toBe(150050);
    expect(eurosEnCentimes("")).toBeNull();
    expect(eurosEnCentimes("-3")).toBeUndefined();
    expect(eurosEnCentimes("abc")).toBeUndefined();
    expect(eurosEnCentimes("9999999.99")).toBe(999999999);
    expect(eurosEnCentimes("99999999")).toBeUndefined();
    expect(messageMontantInvalide("99999999")).toContain("trop grand");
    expect(eurosEnCentimes("1.500")).toBeUndefined();
    expect(messageMontantInvalide("1.500")).toContain("écrivez 1500 ou 1 500");
    expect(eurosEnCentimes("1 500")).toBe(150000);
    expect(centimesEnEuros(150050)).toBe("1500,50");
    expect(centimesEnEuros(null)).toBe("");
  });

  it("assemble les prestations avec ou sans suivi noté", () => {
    const r = assemblerPrestations(
      [
        { id: "a", numero: "P-1", titre: "A", statut: "ouvert", devis: [{ statut: "envoye" }] },
        { id: "b", numero: "P-2", titre: "B", statut: "gagne", devis: [] },
      ],
      new Map([["b", { type: "site_internet", etapeForcee: "terminee", montantCents: 90000 }]]),
    );
    expect(r[0]).toMatchObject({ type: null, etape: "devis_envoye", etapeForcee: false });
    expect(r[1]).toMatchObject({ type: "site_internet", etape: "terminee", etapeForcee: true });
  });
});

describe("enregistrerSuiviPrestationAction", () => {
  it("enregistre type, étape et montant puis revient à l'onglet avec un message", async () => {
    const r = await issue(formulaire({ type: "conference", etape: "terminee", montant: "1200,5" }));
    expect(r).toContain("onglet=prestations&bloc=suivi");
    expect(r).toContain("message=Prestation enregistrée.");
    expect(bd.projetSuivi.upsert).toHaveBeenCalledWith({
      where: { projetId: PID },
      create: { projetId: PID, type: "conference", etapeForcee: "terminee", montantCents: 120050 },
      update: { type: "conference", etapeForcee: "terminee", montantCents: 120050 },
    });
  });

  it("trace dans la même transaction : prestation.suivi_modifie avec avant et après", async () => {
    bd.projetSuivi.findUnique.mockResolvedValue({
      type: "audit",
      etapeForcee: null,
      montantCents: 1000,
    });
    await issue(formulaire({ type: "formation", etape: "accepte", montant: "20" }));
    expect(bd.$transaction).toHaveBeenCalledTimes(1);
    expect(bd.activityLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: "admin-1",
        action: "prestation.suivi_modifie",
        targetType: "projet",
        targetId: PID,
        changes: {
          avant: { type: "audit", etapeForcee: null, montantCents: 1000 },
          apres: { type: "formation", etapeForcee: "accepte", montantCents: 2000 },
        },
      },
    });
  });

  it("accès refusé : ni lecture du projet ni écriture", async () => {
    acces.exigerAccesEchanges.mockRejectedValue(new acces.AccesRefuse("non"));
    expect(await issue(formulaire({}))).toBe("non");
    expect(bd.projet.findUnique).not.toHaveBeenCalled();
    expect(bd.projetSuivi.upsert).not.toHaveBeenCalled();
    expect(bd.activityLog.create).not.toHaveBeenCalled();
  });

  it("projet introuvable : refus, rien n'est écrit", async () => {
    bd.projet.findUnique.mockResolvedValue(null);
    expect(await issue(formulaire({}))).toContain("erreur=Prestation inconnue.");
    expect(bd.projetSuivi.upsert).not.toHaveBeenCalled();
  });

  it("montant trop grand ou milliers à la française : message clair", async () => {
    expect(await issue(formulaire({ montant: "99999999" }))).toContain("trop grand");
    expect(await issue(formulaire({ montant: "1.500" }))).toContain("écrivez 1500 ou 1 500");
    expect(bd.projetSuivi.upsert).not.toHaveBeenCalled();
  });

  it("étape vide = calculée : le forçage est retiré, rien n'est supprimé", async () => {
    await issue(formulaire({ etape: "" }));
    expect(bd.projetSuivi.upsert.mock.calls[0]![0].update).toMatchObject({ etapeForcee: null });
    expect(bd.projetSuivi.delete).not.toHaveBeenCalled();
    expect(bd.projetSuivi.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ["type inconnu", { type: "piratage" }],
    ["étape inconnue", { etape: "mystère" }],
    ["montant illisible", { montant: "beaucoup" }],
    ["projet absent", { projetId: "pas-un-uuid" }],
  ])("refuse : %s — rien n'est écrit", async (_n, champs) => {
    const r = await issue(formulaire(champs));
    expect(r).toContain("erreur=");
    expect(bd.projetSuivi.upsert).not.toHaveBeenCalled();
  });

  it("refuse un projet qui appartient à une autre fiche", async () => {
    bd.projet.findUnique.mockResolvedValue({ clientId: "99999999-9999-4999-8999-999999999999" });
    expect(await issue(formulaire({}))).toContain("erreur=Prestation inconnue.");
    expect(bd.projetSuivi.upsert).not.toHaveBeenCalled();
  });

  it("sans fiche valide, ne lit ni n'écrit rien", async () => {
    const r = await issue(formulaire({ clientId: "x" }));
    expect(r).toContain("REDIRECT:");
    expect(bd.projet.findUnique).not.toHaveBeenCalled();
  });
});
