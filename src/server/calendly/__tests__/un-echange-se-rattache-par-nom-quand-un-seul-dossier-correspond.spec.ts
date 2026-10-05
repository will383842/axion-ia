// Repli « même nom, autre adresse » du rattachement automatique (2026-10-05,
// cas Marie Mafo : adresse relais Indeed sur la fiche, vraie adresse chez
// Calendly). On ne rattache que s'il y a EXACTEMENT UNE fiche apporteur au nom
// correspondant — sinon c'est le sélecteur de la console qui propose.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
    calendlyEvent: { updateMany: (...a: unknown[]) => updateMany(...a) },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (e: string) => `h-${e}` }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));

import { rattacherEchangeApporteur } from "../rattachement-apporteur";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };
const fiche = (id: string, nom: string, email: string) => ({
  id,
  details: APPORTEUR,
  contactName: nom,
  contactEmail: email,
});
const rdv = (o: Record<string, unknown> = {}) => ({
  id: "evt",
  eventTypeName: "Échange apporteur d'affaires (15 min)",
  inviteeEmail: "marienoelmafo1@exemple.fr",
  inviteeName: "Marie Mafo",
  linkedSubmissionId: null,
  linkedJobApplicationId: null,
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue(null);
  updateMany.mockResolvedValue({ count: 1 });
});

describe("rattachement par nom (repli)", () => {
  it("rattache quand une seule fiche porte le nom", async () => {
    findMany.mockResolvedValue([
      fiche("indeed", "Marie", "marienoelmafogangocxep_uuo@indeedemail.com"),
      fiche("autre", "Marie", "marie.dupont@exemple.fr"),
    ]);
    const r = await rattacherEchangeApporteur(rdv());
    expect(r).toEqual({ rattache: true, submissionId: "indeed", parNom: true });
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "evt", linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedSubmissionId: "indeed" },
    });
  });

  it("ne rattache rien quand deux fiches portent le nom", async () => {
    findMany.mockResolvedValue([
      fiche("a", "Marie", "mariemafo.a@indeedemail.com"),
      fiche("b", "Marie", "mariemafo.b@indeedemail.com"),
    ]);
    const r = await rattacherEchangeApporteur(rdv());
    expect(r).toEqual({ rattache: false, motif: "aucun_dossier_apporteur" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("ne cherche pas de nom sans nom confirmé de deux mots", async () => {
    const r = await rattacherEchangeApporteur(rdv({ inviteeName: "Marie" }));
    expect(r).toEqual({ rattache: false, motif: "aucun_dossier_apporteur" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("l'adresse l'emporte : un dossier trouvé par son adresse n'est pas cherché par nom", async () => {
    findFirst.mockResolvedValue({ id: "exact", details: APPORTEUR });
    const r = await rattacherEchangeApporteur(rdv());
    expect(r).toEqual({ rattache: true, submissionId: "exact" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("n'écrase jamais un rattachement existant", async () => {
    const r = await rattacherEchangeApporteur(rdv({ linkedSubmissionId: "deja" }));
    expect(r).toEqual({ rattache: false, motif: "deja_rattache" });
    expect(findMany).not.toHaveBeenCalled();
  });
});
