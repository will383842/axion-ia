// Bug « Ce rendez-vous n'est rattaché à aucune fiche candidat » (cas NEKKACH, 2026-11-27).
// Le rattachement n'avait lieu qu'à l'enrichissement : un candidat créé APRÈS le rendez-vous,
// ou une adresse écrite en majuscules, restait orphelin. Ces tests rougissent sans le correctif.

import { describe, it, expect, vi, beforeEach } from "vitest";

const evtFindUnique = vi.fn();
const evtFindMany = vi.fn();
const evtUpdateMany = vi.fn();
const subFindUnique = vi.fn();
const subFindMany = vi.fn();
const subFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findUnique: (...a: unknown[]) => evtFindUnique(...a),
      findMany: (...a: unknown[]) => evtFindMany(...a),
      updateMany: (...a: unknown[]) => evtUpdateMany(...a),
    },
    submission: {
      findUnique: (...a: unknown[]) => subFindUnique(...a),
      findMany: (...a: unknown[]) => subFindMany(...a),
      findFirst: (...a: unknown[]) => subFindFirst(...a),
    },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null) => (e ? `h-${e.trim().toLowerCase()}` : null),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));

import {
  rattacherOrphelinsDeLaFiche,
  rattacherRendezVousOrphelin,
} from "../rattachement-orphelins";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };
const TYPE = "Échange apporteur d'affaires (15 min)";
const fiche = (id: string, email: string, tel: string | null = null) => ({
  id,
  details: APPORTEUR,
  contactName: "Karim Nekkach",
  contactEmail: email,
  contactPhone: tel,
});
const orphelin = (o: Record<string, unknown> = {}) => ({
  id: "evt",
  eventTypeName: TYPE,
  typeRendezVous: null,
  inviteeEmail: "KARIM.NEKKACH@Exemple.FR ",
  inviteeName: "Karim Nekkach",
  inviteePhone: null,
  linkedSubmissionId: null,
  linkedJobApplicationId: null,
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  subFindFirst.mockResolvedValue(null);
  evtUpdateMany.mockResolvedValue({ count: 1 });
});

describe("clic « Absent » sur un rendez-vous orphelin", () => {
  it("rattache par e-mail en majuscules, même si la fiche n'a pas d'empreinte", async () => {
    evtFindUnique.mockResolvedValue(orphelin());
    subFindMany.mockResolvedValue([
      fiche("sub-1", "karim.nekkach@exemple.fr"),
      fiche("sub-2", "autre@exemple.fr"),
    ]);
    expect(await rattacherRendezVousOrphelin("evt")).toBe("sub-1");
    expect(evtUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt", linkedSubmissionId: null, linkedJobApplicationId: null },
        data: { linkedSubmissionId: "sub-1" },
      }),
    );
  });

  it("rattache par téléphone normalisé quand l'adresse diffère", async () => {
    evtFindUnique.mockResolvedValue(
      orphelin({
        inviteeEmail: "relais@indeed.fr",
        inviteeName: null,
        inviteePhone: "06 39 98 12 34",
      }),
    );
    subFindMany.mockResolvedValue([fiche("sub-1", "vraie@exemple.fr", "+33639981234")]);
    expect(await rattacherRendezVousOrphelin("evt")).toBe("sub-1");
  });

  it("ne devine pas quand deux fiches portent la même adresse", async () => {
    evtFindUnique.mockResolvedValue(orphelin());
    subFindMany.mockResolvedValue([
      fiche("sub-1", "karim.nekkach@exemple.fr"),
      fiche("sub-2", "KARIM.NEKKACH@exemple.fr"),
    ]);
    expect(await rattacherRendezVousOrphelin("evt")).toBeNull();
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });

  it("n'écrase jamais un rattachement existant", async () => {
    evtFindUnique.mockResolvedValue(orphelin({ linkedSubmissionId: "deja" }));
    expect(await rattacherRendezVousOrphelin("evt")).toBe("deja");
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });
});

describe("fiche candidat créée APRÈS le rendez-vous", () => {
  it("rattache les rendez-vous orphelins de même e-mail (casse et espaces ignorés)", async () => {
    subFindUnique.mockResolvedValue({
      ...fiche("sub-9", " Karim.Nekkach@exemple.fr"),
      deletedAt: null,
    });
    subFindMany.mockResolvedValue([]);
    evtFindMany.mockResolvedValue([
      orphelin({ id: "e1" }),
      orphelin({ id: "e2", inviteeEmail: "x@y.fr" }),
    ]);
    expect(await rattacherOrphelinsDeLaFiche("sub-9")).toBe(1);
    expect(evtUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["e1"] } }),
        data: { linkedSubmissionId: "sub-9" },
      }),
    );
  });

  it("ne rattache rien si une autre fiche porte déjà la même adresse", async () => {
    subFindUnique.mockResolvedValue({
      ...fiche("sub-9", "karim.nekkach@exemple.fr"),
      deletedAt: null,
    });
    subFindMany.mockResolvedValue([fiche("sub-1", "KARIM.NEKKACH@exemple.fr")]);
    evtFindMany.mockResolvedValue([orphelin({ id: "e1" })]);
    expect(await rattacherOrphelinsDeLaFiche("sub-9")).toBe(0);
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });

  it("ignore une fiche qui n'est pas un dossier apporteur", async () => {
    subFindUnique.mockResolvedValue({
      ...fiche("sub-9", "karim.nekkach@exemple.fr"),
      details: { unifiedType: "contact" },
      deletedAt: null,
    });
    expect(await rattacherOrphelinsDeLaFiche("sub-9")).toBe(0);
  });
});
