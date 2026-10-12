/**
 * Lot F-CAL-2 — un échange formateur rejoint sa candidature : par le marqueur
 * `fa-<id>` que Calendly renvoie, puis par l'adresse ; jamais par le nom seul, jamais
 * sur une candidature salariée, jamais en écrasant un rattachement.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyJA = vi.fn();
const findUniqueJA = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findMany: (...a: unknown[]) => findManyJA(...a),
      findUnique: (...a: unknown[]) => findUniqueJA(...a),
    },
    calendlyEvent: { updateMany: (...a: unknown[]) => updateMany(...a) },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h-${e.toLowerCase()}` : null),
}));

import { rattacherEchangeApporteur } from "../rattachement-apporteur";
import { candidatureDuMarqueur, rattacherEchangeFormateur } from "../rattachement-formateur";

const ID = "0b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10";
const FREELANCE = {
  id: ID,
  offerTitleSnap: "Formateur IA indépendant",
  natureCollaboration: "freelance",
  offer: null,
};

function ligne(o: Record<string, unknown> = {}) {
  return {
    id: "evt_f1",
    eventTypeName: "Échange formateur indépendant (20 min)",
    typeRendezVous: "autre",
    inviteeEmail: "Camille@Example.com",
    inviteeName: "Camille Martin",
    linkedSubmissionId: null,
    linkedJobApplicationId: null,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
  findManyJA.mockResolvedValue([]);
  findUniqueJA.mockResolvedValue(null);
});

describe("le marqueur fa-<id>", () => {
  it("se lit dans utm_content, avec ou sans le préfixe du choix", () => {
    expect(candidatureDuMarqueur(`formateur:fa-${ID}`)).toBe(ID);
    expect(candidatureDuMarqueur(`fa-${ID.toUpperCase()}`)).toBe(ID);
    expect(candidatureDuMarqueur("formateur:email-composeur")).toBeNull();
    expect(candidatureDuMarqueur(`fa-${ID}-x`)).toBeNull();
    expect(candidatureDuMarqueur(null)).toBeNull();
  });

  it("rattache même une adresse relais, sans regarder l'empreinte", async () => {
    findUniqueJA.mockResolvedValue(FREELANCE);
    const r = await rattacherEchangeFormateur(
      ligne({ inviteeEmail: "x@relais.example" }),
      `formateur:fa-${ID}`,
    );
    expect(r).toEqual({ rattache: true, candidatureId: ID, par: "marqueur" });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "evt_f1", linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedJobApplicationId: ID },
    });
    expect(findManyJA).not.toHaveBeenCalled();
  });

  it("un marqueur vers une candidature SALARIÉE ne rattache rien par lui-même", async () => {
    findUniqueJA.mockResolvedValue({ ...FREELANCE, natureCollaboration: "salarie" });
    const r = await rattacherEchangeFormateur(ligne(), `fa-${ID}`);
    expect(r).toEqual({ rattache: false, motif: "aucune_candidature" });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("l'adresse, puis rien", () => {
  it("rattache la candidature freelance la plus récente à la même empreinte", async () => {
    findManyJA.mockResolvedValue([
      { ...FREELANCE, id: "11111111-1111-4111-8111-111111111111", natureCollaboration: "salarie" },
      { ...FREELANCE, natureCollaboration: null },
    ]);
    const r = await rattacherEchangeFormateur(ligne(), null);
    expect(r).toEqual({ rattache: true, candidatureId: ID, par: "empreinte" });
    expect(findManyJA.mock.calls[0]![0].where).toEqual({ emailHash: "h-camille@example.com" });
  });

  it("le NOM seul ne rattache jamais (« à vérifier »)", async () => {
    const r = await rattacherEchangeFormateur(ligne(), null);
    expect(r).toEqual({ rattache: false, motif: "aucune_candidature" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("n'écrase jamais un rattachement existant", async () => {
    findUniqueJA.mockResolvedValue(FREELANCE);
    const r = await rattacherEchangeFormateur(
      ligne({ linkedJobApplicationId: "22222222-2222-4222-8222-222222222222" }),
      `fa-${ID}`,
    );
    expect(r).toEqual({ rattache: false, motif: "deja_rattache" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("une course perdue ne rattache rien", async () => {
    findUniqueJA.mockResolvedValue(FREELANCE);
    updateMany.mockResolvedValue({ count: 0 });
    expect(await rattacherEchangeFormateur(ligne(), `fa-${ID}`)).toEqual({
      rattache: false,
      motif: "rattache_entre_temps",
    });
  });

  it("un appel client ou apporteur n'est jamais rattaché par cette voie", async () => {
    const r = await rattacherEchangeFormateur(
      ligne({
        eventTypeName: "Échange apporteur d'affaires (15 min)",
        typeRendezVous: "apporteur",
      }),
      `fa-${ID}`,
    );
    expect(r).toEqual({ rattache: false, motif: "pas_un_echange_formateur" });
  });
});

describe("la voie apporteur ignore un échange formateur", () => {
  it("rattacherEchangeApporteur rend « pas un échange apporteur » : aucune fiche apporteur n'est créée", async () => {
    const r = await rattacherEchangeApporteur(ligne());
    expect(r).toEqual({ rattache: false, motif: "pas_un_echange_apporteur" });
  });
});
