/**
 * Tests — `rendreTirageEmargementAJour`, le SEUL chemin qui produit le tirage à
 * jour d'une feuille d'émargement.
 *
 * 🔴 X-documents-pdf-01 (audit initial 2026-09-14, relecture de la PR 1089).
 * Le tirage était rendu à trois endroits — l'écran « Télécharger la feuille à
 * jour », le dossier d'audit d'une session, le ZIP du mode auditeur — et deux
 * d'entre eux ne portaient pas la même population d'inscriptions. Aucun des
 * trois ne disait, sur le PDF, qu'il était une réimpression ni quand il avait
 * été tiré. Ce module est désormais leur passage obligé : ce qui est vérifié
 * ici vaut pour les trois.
 *
 * Garde reprise de la route (ex-`route.spec.ts`) : le tirage ne porte jamais le
 * numéro d'une feuille ANNULÉE. Il se présente comme la réimpression de la pièce
 * dont il emprunte le numéro ; emprunter celui d'une feuille que le registre
 * déclare sans valeur produirait un document qui se réclame d'une pièce annulée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const findFirstMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: (...a: unknown[]) => findUniqueMock(...a) },
    documentGenere: { findFirst: (...a: unknown[]) => findFirstMock(...a) },
  },
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({ nda: "11380490538" })),
}));

const feuilleMock = vi.fn();
vi.mock("@/server/qualiopi/emargement/feuille-pdf", () => ({
  construireFeuillePdf: (...a: unknown[]) => feuilleMock(...a),
  LIBELLE_DEMI: { matin: "Matin", apres_midi: "Après-midi", journee: "Journée" },
}));

// `refusEmissionLieu` (I17-01, #1086) est appelé AVANT tout rendu : sans lui,
// le mock levait « No export is defined » et les cinq tests rougissaient sur
// `main` après la fusion conjointe de #1086 et #1089.
const refusLieuMock = vi.fn((_session: unknown): string | null => null);
vi.mock("@/server/qualiopi/lieu/resolve-lieu-document", () => ({
  LIEU_DOCUMENT_SELECT: {},
  resolveLieuDocument: () => "Paris",
  refusEmissionLieu: (session: unknown) => refusLieuMock(session),
}));

// Le gabarit réel est testé dans `templates/__tests__/` : ici, on lit ce que
// le module lui PASSE.
vi.mock("@/server/qualiopi/documents/templates/emargement", () => ({
  EmargementPdf: () => null,
}));

const rendus: Array<{ props: { data: { numero: string; reimpression?: string } } }> = [];
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: vi.fn(async (el: (typeof rendus)[number]) => {
    rendus.push(el);
    return { buffer: Buffer.from("%PDF-a-jour") };
  }),
}));

import { rendreTirageEmargementAJour } from "./emargement-tirage";

/** 15:32 à Paris (UTC+2 en septembre). */
const MAINTENANT = new Date("2026-09-14T13:32:00Z");

function feuille() {
  return {
    intituleFormation: "IA pour bien commencer",
    numeroSession: "AXI-SESS-2026-003",
    totalSignatures: 4,
    journees: [
      {
        dateLisible: "vendredi 1 août 2026",
        horaires: "09:00–17:00",
        formateurNom: "Williams Jullin",
        modules: [],
        demiJournees: ["matin"],
        lignes: [
          {
            stagiaireNom: "Alice Dupont",
            entreprise: null,
            cases: [{ signeAHeure: "09:12", ecart: null, surPosteFormateur: false }],
            empreinteTete: "abcdef1234567890",
            nbSignatures: 1,
          },
        ],
        contresignatures: [],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rendus.length = 0;
  findUniqueMock.mockResolvedValue({ id: "ses-1" });
  feuilleMock.mockResolvedValue(feuille());
  // Émise le 31/07 à 01:30 heure de Paris — la veille en UTC. Le piège exact
  // d'une date écrite en `toISOString()`.
  findFirstMock.mockResolvedValue({
    numero: "AXI-DOC-2026-004",
    createdAt: new Date("2026-07-30T23:30:00Z"),
  });
});

describe("🔴 rendreTirageEmargementAJour", () => {
  it("imprime SUR le PDF la date et l'heure du tirage (Paris), la pièce d'origine et sa date d'émission", async () => {
    const res = await rendreTirageEmargementAJour("ses-1", MAINTENANT);

    const attendu =
      "Réimpression à jour du 14/09/2026 à 15:32 (heure de Paris) — pièce d'origine : AXI-DOC-2026-004, émise le 31/07/2026";
    expect(res).toMatchObject({
      ok: true,
      numeroOrigine: "AXI-DOC-2026-004",
      numeroSession: "AXI-SESS-2026-003",
      totalSignatures: 4,
      mention: attendu,
    });
    expect(rendus).toHaveLength(1);
    expect(rendus[0]!.props.data.numero).toBe("AXI-DOC-2026-004");
    expect(rendus[0]!.props.data.reimpression).toBe(attendu);
  });

  it("sans feuille au registre, le tirage le DIT au lieu d'emprunter un numéro", async () => {
    findFirstMock.mockResolvedValue(null);

    const res = await rendreTirageEmargementAJour("ses-1", MAINTENANT);

    expect(res).toMatchObject({ ok: true, numeroOrigine: null });
    expect(rendus[0]!.props.data.numero).toBe("— non émise au registre —");
    expect(rendus[0]!.props.data.reimpression).toBe(
      "Tirage à jour du 14/09/2026 à 15:32 (heure de Paris) — aucune feuille d'émargement émise au registre pour cette session",
    );
  });

  it("n'emprunte jamais le numéro d'une feuille ANNULÉE — la plus récente qui fait encore foi", async () => {
    await rendreTirageEmargementAJour("ses-1", MAINTENANT);

    const arg = findFirstMock.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      orderBy: Record<string, unknown>;
    };
    expect(arg.where).toMatchObject({ type: "emargement", sessionId: "ses-1", annuleeAt: null });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("porte la MÊME population que l'écran : inscriptions sous droit à l'effacement exclues", async () => {
    await rendreTirageEmargementAJour("ses-1", MAINTENANT);
    // Un seul chemin, un seul réglage : le ZIP et l'écran ne peuvent plus
    // produire deux PDF différents sous le même numéro.
    expect(feuilleMock.mock.calls[0]![1] ?? false).toBe(false);
  });

  it("journées non déclarées : aucun rendu, un motif", async () => {
    feuilleMock.mockResolvedValue({ ...feuille(), journees: [] });

    const res = await rendreTirageEmargementAJour("ses-1", MAINTENANT);

    expect(res.ok).toBe(false);
    expect(rendus).toHaveLength(0);
  });

  it("🔴 I17-01 — session en présentiel sans lieu : le tirage est REFUSÉ avant tout rendu, avec le motif", async () => {
    refusLieuMock.mockReturnValueOnce("Lieu de la session non renseigné");

    const res = await rendreTirageEmargementAJour("ses-1", MAINTENANT);

    expect(res).toMatchObject({ ok: false, message: "Lieu de la session non renseigné" });
    expect(feuilleMock).not.toHaveBeenCalled();
    expect(rendus).toHaveLength(0);
  });
});
