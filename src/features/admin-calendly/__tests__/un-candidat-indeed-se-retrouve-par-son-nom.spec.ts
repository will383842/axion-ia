// Un candidat venu d'Indeed porte une adresse RELAIS sur sa fiche, et réserve
// Calendly avec sa vraie adresse (2026-10-05, cas Marie Mafo).
//
// Aucune empreinte ne correspond, et sa fiche (de fin août) sort de la fenêtre
// des récentes : l'échange restait rattaché à rien, donc l'e-mail d'issue
// (« Absent », « Retenu »…) était bloqué. Le sélecteur PROPOSE désormais la
// fiche au nom correspondant — jamais de rattachement tout seul.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h-${e}` : null),
}));

import { listerFichesRattachables, motsDuNom, nomCorrespond } from "../fiches-rattachables";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

function ligne(id: string, nom: string, email: string) {
  return {
    id,
    type: "contact",
    details: APPORTEUR,
    submittedAt: new Date("2026-08-31T12:00:00Z"),
    contactName: nom,
    contactEmail: email,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(null);
});

describe("motsDuNom / nomCorrespond", () => {
  it("exige deux mots d'au moins trois lettres", () => {
    expect(motsDuNom("Marie Mafo")).toEqual(["marie", "mafo"]);
    expect(motsDuNom("Marie")).toEqual([]);
    expect(motsDuNom("Li Wu")).toEqual([]);
    expect(motsDuNom(null)).toEqual([]);
  });

  it("retrouve le prénom + nom dans l'adresse relais Indeed", () => {
    const mots = motsDuNom("Marie Mafo");
    expect(nomCorrespond(mots, "Marie", "marienoelmafogangocxep_uuo@indeedemail.com")).toBe(true);
  });

  it("ne confond pas deux personnes qui ne partagent qu'un prénom", () => {
    const mots = motsDuNom("Marie Mafo");
    expect(nomCorrespond(mots, "Marie", "marie.dupont@exemple.fr")).toBe(false);
  });

  it("ignore accents et tirets", () => {
    expect(nomCorrespond(motsDuNom("Noëlle Éloï-Bé"), "Noelle", "eloi.be@x.fr")).toBe(true);
  });
});

describe("listerFichesRattachables — même nom, autre adresse", () => {
  it("propose la fiche Indeed d'une personne qui réserve avec une autre adresse", async () => {
    findMany
      .mockResolvedValueOnce([]) // même adresse : rien
      .mockResolvedValueOnce([]) // récentes : rien (la fiche date d'août)
      .mockResolvedValueOnce([
        ligne("indeed", "Marie", "marienoelmafogangocxep_uuo@indeedemail.com"),
        ligne("autre", "Marie", "marie.dupont@exemple.fr"),
      ]);

    const fiches = await listerFichesRattachables({
      inviteeEmail: "marienoelmafo1@exemple.fr",
      inviteeName: "Marie Mafo",
      linkedSubmissionId: null,
      estEchangeApporteur: true,
    });

    expect(fiches.map((f) => [f.id, f.groupe])).toEqual([["indeed", "nom-probable"]]);
  });

  it("ne cherche aucun nom pour un appel client", async () => {
    findMany.mockResolvedValue([]);
    await listerFichesRattachables({
      inviteeEmail: "a@b.fr",
      inviteeName: "Marie Mafo",
      linkedSubmissionId: null,
      estEchangeApporteur: false,
    });
    // même personne + récentes seulement : pas de troisième lecture.
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("ne propose pas deux fois une fiche déjà trouvée par son adresse", async () => {
    const f = ligne("x", "Marie", "marienoelmafo1@exemple.fr");
    findMany.mockResolvedValueOnce([f]).mockResolvedValueOnce([]).mockResolvedValueOnce([f]);
    const fiches = await listerFichesRattachables({
      inviteeEmail: "marienoelmafo1@exemple.fr",
      inviteeName: "Marie Mafo",
      linkedSubmissionId: null,
      estEchangeApporteur: true,
    });
    expect(fiches.map((x) => [x.id, x.groupe])).toEqual([["x", "meme-personne"]]);
  });
});
