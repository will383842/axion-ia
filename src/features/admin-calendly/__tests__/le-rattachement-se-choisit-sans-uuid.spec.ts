// Le rattachement manuel se CHOISIT dans une liste — on ne recopie plus d'UUID
// (2026-09-19).
//
// Mesure R5 du 19/09 : 37 rendez-vous, 37 rattachés à rien. Le champ texte qui
// attendait l'identifiant d'une demande n'était jamais rempli.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => `clair(${v})` }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h-${e}` : null),
}));

import { listerFichesRattachables } from "../fiches-rattachables";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

function ligne(id: string, details: unknown, jour = "2026-09-18") {
  return {
    id,
    type: "contact",
    details,
    submittedAt: new Date(`${jour}T10:00:00Z`),
    contactName: `nom-${id}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(null);
});

describe("listerFichesRattachables", () => {
  it("propose d'abord les fiches de la même personne, puis les récentes du même public", async () => {
    findMany
      // même personne
      .mockResolvedValueOnce([ligne("a", APPORTEUR)])
      // récentes
      .mockResolvedValueOnce([ligne("a", APPORTEUR), ligne("b", APPORTEUR)]);

    const fiches = await listerFichesRattachables({
      inviteeEmail: "lea@example.com",
      linkedSubmissionId: null,
      estEchangeApporteur: true,
    });

    expect(fiches.map((f) => [f.id, f.groupe])).toEqual([
      ["a", "meme-personne"],
      // « a » n'est pas proposée deux fois.
      ["b", "recentes"],
    ]);
    expect(fiches[0]?.libelle).toContain("Dossier apporteur");
    expect(fiches[0]?.libelle).toContain("clair(nom-a)");
    // La même personne est cherchée par EMPREINTE, parmi les fiches non supprimées.
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { contactEmailHash: "h-lea@example.com", deletedAt: null },
    });
  });

  it("pour un appel client, les récentes n'incluent aucun dossier apporteur", async () => {
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        ligne("apporteur", APPORTEUR),
        ligne("client", { unifiedType: "formation" }),
      ]);

    const fiches = await listerFichesRattachables({
      inviteeEmail: "x@example.com",
      linkedSubmissionId: null,
      estEchangeApporteur: false,
    });

    expect(fiches.map((f) => f.id)).toEqual(["client"]);
  });

  it("la fiche déjà rattachée est TOUJOURS proposée, sinon l'enregistrement la ferait disparaître", async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    findUnique.mockResolvedValueOnce(ligne("ancienne", { unifiedType: "formation" }, "2025-01-01"));

    const fiches = await listerFichesRattachables({
      inviteeEmail: null,
      linkedSubmissionId: "ancienne",
      estEchangeApporteur: false,
    });

    expect(fiches).toEqual([expect.objectContaining({ id: "ancienne", groupe: "actuelle" })]);
  });
});

describe("la saisie d'UUID a disparu de la fiche d'un appel", () => {
  it("l'éditeur rend un sélecteur, plus un champ texte à identifiant", () => {
    const chemin = join(process.cwd(), "src/components/admin/contacts/CalendlyEventEditor.tsx");
    if (!existsSync(chemin)) {
      throw new Error(`Garde inopérante : ${chemin} est introuvable — corrige le chemin.`);
    }
    const source = readFileSync(chemin, "utf8");
    // Témoin : c'est bien le bon fichier, et le champ existe toujours.
    expect(source).toContain('id="linkedSubmissionId"');
    expect(source).toMatch(/<select\s+id="linkedSubmissionId"/);
    // Le gabarit d'UUID qui servait d'indication de saisie est parti.
    expect(source).not.toContain("00000000-0000-0000-0000-000000000000");
  });
});
