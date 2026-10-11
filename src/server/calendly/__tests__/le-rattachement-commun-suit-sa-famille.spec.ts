// FAC-7 — Le moteur commun de rattachement d'un échange : la famille arrive par
// l'adaptateur, jamais par une condition ; l'ordre est empreinte puis nom unique ; on
// n'écrase jamais un rattachement.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { updateMany: (...a: unknown[]) => h.updateMany(...a) } },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h:${e}` : null),
}));

import {
  rattacherEchange,
  type AdaptateurRattachement,
  type LigneEchange,
} from "../rattachement-echange";

const ligne = (over: Partial<LigneEchange> = {}): LigneEchange => ({
  id: "evt-1",
  eventTypeName: "Échange de test",
  inviteeEmail: "a@exemple.invalid",
  inviteeName: "Claire Martin",
  linkedSubmissionId: null,
  linkedJobApplicationId: null,
  ...over,
});

function adaptateur(over: Partial<AdaptateurRattachement> = {}): AdaptateurRattachement {
  return {
    estEchange: () => true,
    ficheParEmpreinte: vi.fn(async () => null),
    fichesParNom: vi.fn(async () => []),
    colonne: "linkedJobApplicationId",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
});

describe("rattacherEchange", () => {
  it("hors famille : rien n'est lu ni écrit", async () => {
    const a = adaptateur({ estEchange: () => false });
    expect(await rattacherEchange(a, ligne())).toEqual({
      rattache: false,
      motif: "pas_un_echange_de_la_famille",
    });
    expect(a.ficheParEmpreinte).not.toHaveBeenCalled();
  });
  it("déjà rattachée (à n'importe quelle colonne) : jamais écrasée", async () => {
    for (const l of [ligne({ linkedSubmissionId: "s" }), ligne({ linkedJobApplicationId: "j" })]) {
      expect(await rattacherEchange(adaptateur(), l)).toEqual({
        rattache: false,
        motif: "deja_rattache",
      });
    }
    expect(h.updateMany).not.toHaveBeenCalled();
  });
  it("par l'empreinte : écrit la colonne de la famille, sous condition « rattachée à rien »", async () => {
    const a = adaptateur({ ficheParEmpreinte: vi.fn(async () => "fiche-1") });
    expect(await rattacherEchange(a, ligne())).toEqual({ rattache: true, ficheId: "fiche-1" });
    expect(a.ficheParEmpreinte).toHaveBeenCalledWith("h:a@exemple.invalid");
    expect(a.fichesParNom).not.toHaveBeenCalled();
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: "evt-1", linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedJobApplicationId: "fiche-1" },
    });
  });
  it("repli par le nom : seulement s'il n'y a qu'UNE fiche", async () => {
    const une = adaptateur({ fichesParNom: vi.fn(async () => ["f"]) });
    expect(await rattacherEchange(une, ligne())).toEqual({
      rattache: true,
      ficheId: "f",
      parNom: true,
    });
    const deux = adaptateur({ fichesParNom: vi.fn(async () => ["f", "g"]) });
    expect(await rattacherEchange(deux, ligne())).toEqual({
      rattache: false,
      motif: "aucune_fiche",
    });
  });
  it("une saisie manuelle arrivée entre-temps gagne", async () => {
    h.updateMany.mockResolvedValue({ count: 0 });
    const a = adaptateur({ ficheParEmpreinte: vi.fn(async () => "f") });
    expect(await rattacherEchange(a, ligne())).toEqual({
      rattache: false,
      motif: "rattache_entre_temps",
    });
  });
  it("sans adresse : rien", async () => {
    expect(await rattacherEchange(adaptateur(), ligne({ inviteeEmail: null }))).toEqual({
      rattache: false,
      motif: "sans_adresse",
    });
  });
});
