/**
 * Chantier QNC, L04 — remises automatiques (fiche formateur, récapitulatif
 * stagiaire) et consignes de convocation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentFindMany = vi.fn();
const remiseCreate = vi.fn(async (_a: unknown) => ({}));
const enqueueEmail = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
const etat = vi.fn(async () => "eteint");
const lireCircuit = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findMany: (a: unknown) => enrollmentFindMany(a) },
    remiseRetour: { create: (a: unknown) => remiseCreate(a) },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("./portee", () => ({
  etatAdaptation: () => etat(),
  adaptationAutomatiquePourInscription: async () => true,
}));
vi.mock("../journal-consignation", () => ({
  lireCircuitAdaptation: (a: unknown) => lireCircuit(a),
}));

import { texteConsignationAutomatique, TYPES_BESOIN } from "./catalogue-mesures";
import { REPONSE_AUCUNE_ADAPTATION } from "../reponse-organisme";
import { consignesPourConvocation, passerRemisesAdaptation, remiseDue } from "./remises";

const MAINTENANT = new Date("2026-11-02T07:30:00Z");
const TEXTE = texteConsignationAutomatique(
  ["supports_agrandis", "pauses"],
  new Date("2026-10-30T10:00:00Z"),
);

/** Saisie libre du référent dans la console : porte une information de santé. */
const SAISIE_SANTE = [
  "Interprète LSF réservé, Mme X est malentendante",
  "- Pauses supplémentaires (traitement pour diabète)",
].join("\n");

function inscription(adaptationsRealisees: string, remisesRetours: unknown[] = []) {
  return {
    id: "e1",
    traineeId: "t1",
    adaptationsRealisees,
    trainee: { email: "s@exemple.invalid", prenom: "Camille", nom: "Martin" },
    session: {
      id: "s1",
      numero: "N",
      titreSession: "T",
      dateDebut: new Date("2026-11-20T08:00:00Z"),
      dateFin: new Date("2026-11-21T17:00:00Z"),
      formateurPrincipal: { email: "f@exemple.invalid", prenom: "Alex", nom: "Durand" },
    },
    remisesRetours,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.mockResolvedValue("eteint");
});

describe("purs", () => {
  it("remiseDue : jamais remise, ou consignée depuis", () => {
    const a = new Date("2026-10-30T10:00:00Z");
    const b = new Date("2026-10-31T10:00:00Z");
    expect(remiseDue(a, null, true)).toBe(true);
    expect(remiseDue(a, b)).toBe(false);
    expect(remiseDue(b, a)).toBe(true);
    expect(remiseDue(null, a)).toBe(false);
  });

  it("🔴 remiseDue : sans consignation datée, ou consignée à la main et jamais remise, rien", () => {
    const a = new Date("2026-10-30T10:00:00Z");
    expect(remiseDue(null, null)).toBe(false);
    expect(remiseDue(null, null, true)).toBe(false);
    expect(remiseDue(a, null)).toBe(false);
  });

  it("🔴 consignes de convocation : le texte saisi à la main ne sort jamais", () => {
    expect(consignesPourConvocation(`${TEXTE}\n\n${SAISIE_SANTE}`)).toEqual([
      "Supports en grands caractères et contrastés",
      "Pauses supplémentaires",
    ]);
    expect(consignesPourConvocation(SAISIE_SANTE)).toBeNull();
  });

  it("consignes de convocation : les mesures seules, rien pour « aucune adaptation »", () => {
    expect(consignesPourConvocation(TEXTE)).toEqual([
      "Supports en grands caractères et contrastés",
      "Pauses supplémentaires",
    ]);
    expect(consignesPourConvocation(REPONSE_AUCUNE_ADAPTATION)).toBeNull();
    expect(consignesPourConvocation(null)).toBeNull();
  });
});

describe("passerRemisesAdaptation", () => {
  it("éteint : aucune requête, aucun envoi", async () => {
    expect(await passerRemisesAdaptation(MAINTENANT)).toEqual({
      formateur: 0,
      stagiaire: 0,
      ko: 0,
    });
    expect(enrollmentFindMany).not.toHaveBeenCalled();
  });

  it("allumé : fiche (mesures seules) au formateur, récapitulatif au stagiaire, rangés au dossier", async () => {
    etat.mockResolvedValue("actif");
    lireCircuit.mockResolvedValue(
      new Map([["e1", { derniereConsignationLe: new Date("2026-10-30T10:00:00Z") }]]),
    );
    enrollmentFindMany.mockResolvedValue([
      {
        id: "e1",
        traineeId: "t1",
        adaptationsRealisees: TEXTE,
        trainee: { email: "s@exemple.invalid", prenom: "Camille", nom: "Martin" },
        session: {
          id: "s1",
          numero: "AXI-S-2026-010",
          titreSession: "IA générative",
          dateDebut: new Date("2026-11-20T08:00:00Z"),
          dateFin: new Date("2026-11-21T17:00:00Z"),
          formateurPrincipal: { email: "f@exemple.invalid", prenom: "Alex", nom: "Durand" },
        },
        remisesRetours: [],
      },
    ]);
    expect(await passerRemisesAdaptation(MAINTENANT)).toEqual({
      formateur: 1,
      stagiaire: 1,
      ko: 0,
    });
    const [gabarit, to, , payload] = enqueueEmail.mock.calls[0] ?? [];
    expect(gabarit).toBe("qualiopi-adaptation-formateur");
    expect(to).toBe("f@exemple.invalid");
    expect(payload).toMatchObject({ supportsAvant: true });
    for (const t of TYPES_BESOIN) expect(JSON.stringify(payload)).not.toContain(t.libelle);
    expect(remiseCreate).toHaveBeenCalledTimes(2);
    expect(remiseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ destinataire: "formateur", objet: "fiche_adaptation" }),
    });
  });

  it("déjà remise depuis la dernière consignation : rien ne repart", async () => {
    etat.mockResolvedValue("actif");
    lireCircuit.mockResolvedValue(
      new Map([["e1", { derniereConsignationLe: new Date("2026-10-30T10:00:00Z") }]]),
    );
    const remise = new Date("2026-10-31T07:30:00Z");
    enrollmentFindMany.mockResolvedValue([
      {
        id: "e1",
        traineeId: "t1",
        adaptationsRealisees: TEXTE,
        trainee: { email: "s@exemple.invalid", prenom: "Camille", nom: "Martin" },
        session: {
          id: "s1",
          numero: "N",
          titreSession: "T",
          dateDebut: new Date("2026-11-20T08:00:00Z"),
          dateFin: new Date("2026-11-21T17:00:00Z"),
          formateurPrincipal: { email: "f@exemple.invalid", prenom: "Alex", nom: "Durand" },
        },
        remisesRetours: [
          { objet: "fiche_adaptation", survenuLe: remise },
          { objet: "adaptation_mesures", survenuLe: remise },
        ],
      },
    ]);
    await passerRemisesAdaptation(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 texte saisi à la main avec une information de santé : ni fiche, ni récapitulatif, ni payload", async () => {
    etat.mockResolvedValue("actif");
    lireCircuit.mockResolvedValue(
      new Map([["e1", { derniereConsignationLe: new Date("2026-10-31T10:00:00Z") }]]),
    );
    enrollmentFindMany.mockResolvedValue([inscription(`${TEXTE}\n\n${SAISIE_SANTE}`)]);
    await passerRemisesAdaptation(MAINTENANT);
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
    for (const appel of enqueueEmail.mock.calls) {
      const json = JSON.stringify(appel);
      expect(json).not.toContain("malentendante");
      expect(json).not.toContain("LSF");
      expect(json).not.toContain("diabète");
      expect(json).not.toContain("Mesures d'adaptation retenues");
      expect((appel[3] as { mesures: string[] }).mesures).toEqual([
        "Supports en grands caractères et contrastés",
        "Pauses supplémentaires",
      ]);
    }
  });

  it("🔴 allumage : une inscription consignée à la main, jamais remise, ne reçoit rien", async () => {
    etat.mockResolvedValue("actif");
    lireCircuit.mockResolvedValue(
      new Map([["e1", { derniereConsignationLe: new Date("2026-09-01T10:00:00Z") }]]),
    );
    enrollmentFindMany.mockResolvedValue([
      inscription("- Pauses supplémentaires\n- Supports de formation transmis à l'avance"),
    ]);
    await passerRemisesAdaptation(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(remiseCreate).not.toHaveBeenCalled();
  });

  it("texte libre seul, sans mesure du catalogue : rien ne part, même après une remise", async () => {
    etat.mockResolvedValue("actif");
    lireCircuit.mockResolvedValue(
      new Map([["e1", { derniereConsignationLe: new Date("2026-11-01T10:00:00Z") }]]),
    );
    const remise = new Date("2026-10-31T07:30:00Z");
    enrollmentFindMany.mockResolvedValue([
      inscription(SAISIE_SANTE.split("\n")[0] ?? "", [
        { objet: "fiche_adaptation", survenuLe: remise },
        { objet: "adaptation_mesures", survenuLe: remise },
      ]),
    ]);
    await passerRemisesAdaptation(MAINTENANT);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("jobId sans l'heure : stable d'un passage à l'autre pour la même version de fiche", async () => {
    etat.mockResolvedValue("actif");
    const consigneLe = new Date("2026-10-30T10:00:00Z");
    lireCircuit.mockResolvedValue(new Map([["e1", { derniereConsignationLe: consigneLe }]]));
    enrollmentFindMany.mockResolvedValue([inscription(TEXTE)]);
    await passerRemisesAdaptation(MAINTENANT);
    await passerRemisesAdaptation(new Date("2026-11-03T07:30:00Z"));
    const ids = enqueueEmail.mock.calls.map((c) => (c[4] as { jobId: string }).jobId);
    expect(ids[0]).toBe(`qualiopi-adaptation-formateur-e1-${consigneLe.getTime()}`);
    expect(ids[2]).toBe(ids[0]);
    expect(ids[3]).toBe(ids[1]);
  });
});
