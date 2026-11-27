import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());
const captureMessage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { devis: { findFirst } } }));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

import { lireDevisASigner } from "./devis-signature-queries";

const LIGNE = { designation: "Formation IA", quantite: 2, prixUnitaireHtCents: 50000 };

function devisAvec(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    numero: "AXI-DEV-2026-001",
    statut: "envoye",
    offre: null,
    lignes: [LIGNE],
    dateValidite: new Date("2026-12-31T00:00:00Z"),
    mentionTva: null,
    montantTotalHtCents: 100000,
    client: { raisonSociale: "Client Actuel" },
    documentGenere: {
      metadata: {
        renderData: {
          data: {
            numero: "AXI-DEV-2026-001",
            lignes: [LIGNE],
            regimeTva: "assujetti",
            client: { raisonSociale: "Client Photo" },
          },
        },
      },
    },
    ...over,
  };
}

function photo(data: Record<string, unknown>) {
  return { documentGenere: { metadata: { renderData: { data } } } };
}

describe("lireDevisASigner — la page affiche la PHOTO de la pièce signée", () => {
  beforeEach(() => {
    findFirst.mockReset();
    captureMessage.mockReset();
  });

  it("(a) photo « exonere » : TTC = HT et mention d'exonération", async () => {
    findFirst.mockResolvedValue(
      devisAvec(
        photo({ lignes: [LIGNE], regimeTva: "exoneration_261", client: { raisonSociale: "C" } }),
      ),
    );
    const r = await lireDevisASigner("doc1");
    expect(r?.chiffrageIndisponible).toBe(false);
    expect(r?.totalTtcLisible).toBe(r?.totalHtLisible);
    expect(r?.mentionTva).toMatch(/261/);
  });

  it("(b) photo à 5,5 % : TTC à 5,5 %", async () => {
    findFirst.mockResolvedValue(
      devisAvec(
        photo({
          lignes: [LIGNE],
          regimeTva: "assujetti",
          tauxTvaStandardPercent: 5.5,
          client: { raisonSociale: "C" },
        }),
      ),
    );
    const r = await lireDevisASigner("doc1");
    // 1 000,00 € HT + 55,00 € = 1 055,00 €
    expect(r?.totalTtcLisible.replace(/\s/g, " ")).toContain("1 055,00");
    expect(r?.mentionTva).toBeNull();
  });

  it("(c) Devis.lignes diffère de la photo : la photo gagne", async () => {
    findFirst.mockResolvedValue(
      devisAvec({ lignes: [{ designation: "Autre", quantite: 1, prixUnitaireHtCents: 1 }] }),
    );
    const r = await lireDevisASigner("doc1");
    expect(r?.lignes.map((l) => l.designation)).toEqual(["Formation IA"]);
    expect(r?.clientRaisonSociale).toBe("Client Photo");
  });

  it("(c bis) HT de la photo ≠ montantTotalHtCents : alerte sans donnée perso, photo affichée", async () => {
    findFirst.mockResolvedValue(devisAvec({ montantTotalHtCents: 123 }));
    const r = await lireDevisASigner("doc1");
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(captureMessage.mock.calls)).not.toMatch(/Client|AXI-DEV/);
    expect(r?.totalHtLisible.replace(/\s/g, " ")).toContain("1 000,00");
  });

  it("(c ter) devis à formules accepté : écart de HT, aucune alerte Sentry", async () => {
    findFirst.mockResolvedValue(
      devisAvec({ montantTotalHtCents: 123, statut: "accepte", offre: { formules: [] } }),
    );
    const r = await lireDevisASigner("doc1");
    expect(captureMessage).not.toHaveBeenCalled();
    expect(r?.statutBloquant).toBe("deja_accepte");
  });

  it("(c quater) devis à formules encore envoyé : aucune alerte non plus", async () => {
    findFirst.mockResolvedValue(devisAvec({ montantTotalHtCents: 123, offre: { formules: [] } }));
    await lireDevisASigner("doc1");
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("(c quinquies) devis classique déjà accepté : aucune alerte", async () => {
    findFirst.mockResolvedValue(devisAvec({ montantTotalHtCents: 123, statut: "accepte" }));
    await lireDevisASigner("doc1");
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("(f) taux de TVA PAR LIGNE : 0 % sur A, taux standard sur B → 1 600,00 € TTC", async () => {
    findFirst.mockResolvedValue(
      devisAvec({
        montantTotalHtCents: 150000,
        ...photo({
          lignes: [
            { designation: "A", quantite: 1, prixUnitaireHtCents: 100000, tauxTvaPercent: 0 },
            { designation: "B", quantite: 1, prixUnitaireHtCents: 50000 },
          ],
          regimeTva: "assujetti",
          client: { raisonSociale: "C" },
        }),
      }),
    );
    const r = await lireDevisASigner("doc1");
    // 1 000 € à 0 % + 500 € à 20 % (100 €) = 1 600 €
    expect(r?.totalHtLisible.replace(/\s/g, " ")).toContain("1 500,00");
    expect(r?.totalTtcLisible.replace(/\s/g, " ")).toContain("1 600,00");
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("(g) tauxTvaPercent: null : traité comme absent (taux standard)", async () => {
    findFirst.mockResolvedValue(
      devisAvec(
        photo({
          lignes: [{ ...LIGNE, tauxTvaPercent: null }],
          regimeTva: "assujetti",
          client: { raisonSociale: "C" },
        }),
      ),
    );
    const r = await lireDevisASigner("doc1");
    expect(r?.chiffrageIndisponible).toBe(false);
    expect(r?.totalTtcLisible.replace(/\s/g, " ")).toContain("1 200,00");
  });

  it("(d) photo absente : chiffrageIndisponible, aucun recalcul", async () => {
    findFirst.mockResolvedValue(devisAvec({ documentGenere: { metadata: null } }));
    const r = await lireDevisASigner("doc1");
    expect(r?.chiffrageIndisponible).toBe(true);
    expect(r?.lignes).toEqual([]);
    expect(r?.totalTtcLisible).toBe("");
  });

  it("(e) photo malformée : chiffrageIndisponible", async () => {
    findFirst.mockResolvedValue(devisAvec(photo({ lignes: "nope", regimeTva: "bidon" })));
    const r = await lireDevisASigner("doc1");
    expect(r?.chiffrageIndisponible).toBe(true);
  });

  it("aucun devis : null", async () => {
    findFirst.mockResolvedValue(null);
    expect(await lireDevisASigner("doc1")).toBeNull();
  });

  describe("conditions particulières — lues dans la PHOTO, jamais dans la colonne", () => {
    it("la photo porte le texte : la page le reçoit", async () => {
      findFirst.mockResolvedValue(
        devisAvec(
          photo({
            lignes: [LIGNE],
            regimeTva: "assujetti",
            conditionsParticulieres: "Acompte de 30 %.",
          }),
        ),
      );
      const r = await lireDevisASigner("doc1");
      expect(r?.conditionsParticulieres).toBe("Acompte de 30 %.");
    });

    it("colonne modifiée APRÈS l'envoi : la page ignore la colonne", async () => {
      findFirst.mockResolvedValue(
        devisAvec({
          conditionsParticulieres: "TEXTE MODIFIÉ APRÈS L'ENVOI",
          ...photo({
            lignes: [LIGNE],
            regimeTva: "assujetti",
            conditionsParticulieres: "Texte envoyé.",
          }),
        }),
      );
      const r = await lireDevisASigner("doc1");
      expect(r?.conditionsParticulieres).toBe("Texte envoyé.");
    });

    it("photo sans le champ mais colonne remplie : null (la colonne n'est jamais lue)", async () => {
      findFirst.mockResolvedValue(
        devisAvec({
          conditionsParticulieres: "Colonne seule",
          ...photo({ lignes: [LIGNE], regimeTva: "assujetti" }),
        }),
      );
      const r = await lireDevisASigner("doc1");
      expect(r?.conditionsParticulieres).toBeNull();
      const select = findFirst.mock.calls.at(-1)?.[0].select as Record<string, unknown>;
      expect("conditionsParticulieres" in select).toBe(false);
    });

    it("la phrase de primauté est lue dans la PHOTO, à l'identique ; absente = null", async () => {
      findFirst.mockResolvedValue(
        devisAvec(
          photo({
            lignes: [LIGNE],
            regimeTva: "assujetti",
            conditionsParticulieres: "Acompte de 30 %.",
            phrasePrimaute: "Phrase figée dans la photo.",
          }),
        ),
      );
      expect((await lireDevisASigner("doc1"))?.phrasePrimaute).toBe("Phrase figée dans la photo.");
      findFirst.mockResolvedValue(
        devisAvec(
          photo({
            lignes: [LIGNE],
            regimeTva: "assujetti",
            conditionsParticulieres: "Acompte de 30 %.",
          }),
        ),
      );
      expect((await lireDevisASigner("doc1"))?.phrasePrimaute).toBeNull();
      findFirst.mockResolvedValue(
        devisAvec(
          photo({
            lignes: [LIGNE],
            regimeTva: "assujetti",
            conditionsParticulieres: "Acompte.",
            phrasePrimaute: null,
          }),
        ),
      );
      expect((await lireDevisASigner("doc1"))?.phrasePrimaute).toBeNull();
    });

    it("photo absente : null", async () => {
      findFirst.mockResolvedValue(devisAvec({ documentGenere: { metadata: null } }));
      const r = await lireDevisASigner("doc1");
      expect(r?.conditionsParticulieres).toBeNull();
    });

    it("champ de plus de 4000 caractères dans la photo : photo illisible (jamais tronqué en silence)", async () => {
      findFirst.mockResolvedValue(
        devisAvec(
          photo({
            lignes: [LIGNE],
            regimeTva: "assujetti",
            conditionsParticulieres: "x".repeat(4001),
          }),
        ),
      );
      const r = await lireDevisASigner("doc1");
      expect(r?.chiffrageIndisponible).toBe(true);
    });
  });
});

describe("lireDevisASigner — date de validité imprimée sur le PDF (lot E2)", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("date_imprimee_lue_dans_renderData", async () => {
    findFirst.mockResolvedValue(
      devisAvec(
        photo({
          lignes: [LIGNE],
          regimeTva: "assujetti",
          client: { raisonSociale: "C" },
          dateValidite: "15/07/2026",
        }),
      ),
    );
    const r = await lireDevisASigner("doc1");
    expect(r?.dateValiditeImprimee).toBe("15/07/2026");
    // La date en cours reste celle de la colonne.
    expect(r?.dateValiditeLisible).toBe(
      new Date("2026-12-31T00:00:00Z").toLocaleDateString("fr-FR"),
    );
  });

  it("absente_si_photo_ancienne", async () => {
    findFirst.mockResolvedValue(devisAvec());
    const r = await lireDevisASigner("doc1");
    expect(r?.dateValiditeImprimee).toBeNull();
    findFirst.mockResolvedValue(devisAvec({ documentGenere: { metadata: null } }));
    expect((await lireDevisASigner("doc1"))?.dateValiditeImprimee).toBeNull();
  });
});
