import { describe, expect, it, vi } from "vitest";

import {
  MOTIF_RELANCE_DEVIS_ACCEPTE,
  MOTIF_RELANCE_DEVIS_INTROUVABLE,
  MOTIF_RELANCE_DEVIS_MAIN_PROPRE,
  MOTIF_RELANCE_DEVIS_PERIME,
  MOTIF_RELANCE_DEVIS_REFUSE,
  MOTIF_RELANCE_DEVIS_REMPLACE,
  MOTIF_RELANCE_DEVIS_SIGNE,
  motifRelanceDevisSansObjet,
  type LecteurRelanceDevis,
} from "./relance-devis-sans-objet";

const MAINTENANT = new Date("2026-11-20T10:00:00Z");
const FUTUR = new Date("2026-12-20T10:00:00Z");
const PASSE = new Date("2026-11-01T10:00:00Z");

function lecteur(o: {
  devis?: { statut: string; dateValidite: Date } | null;
  suivantes?: number;
  nonSigne?: number;
  mainPropre?: boolean;
}): LecteurRelanceDevis {
  const devis = o.devis === undefined ? { statut: "envoye", dateValidite: FUTUR } : o.devis;
  return {
    devis: {
      findUnique: vi.fn().mockResolvedValue(devis),
      count: vi.fn(async (a: { where: { replacesDevisId?: string } }) =>
        a.where.replacesDevisId !== undefined ? (o.suivantes ?? 0) : (o.nonSigne ?? 1),
      ),
    },
    activityLog: {
      findFirst: vi.fn().mockResolvedValue(o.mainPropre ? { id: "t" } : null),
    },
  } as unknown as LecteurRelanceDevis;
}

const motif = (o: Parameters<typeof lecteur>[0]) =>
  motifRelanceDevisSansObjet(lecteur(o), "d1", MAINTENANT);

describe("motifRelanceDevisSansObjet", () => {
  it("devis introuvable", async () => {
    expect(await motif({ devis: null })).toBe(MOTIF_RELANCE_DEVIS_INTROUVABLE);
  });
  it.each(["accepte", "transforme_convention"])("statut %s", async (statut) => {
    expect(await motif({ devis: { statut, dateValidite: FUTUR } })).toBe(
      MOTIF_RELANCE_DEVIS_ACCEPTE,
    );
  });
  it("refusé", async () => {
    expect(await motif({ devis: { statut: "refuse", dateValidite: FUTUR } })).toBe(
      MOTIF_RELANCE_DEVIS_REFUSE,
    );
  });
  it("expiré avec une version suivante émise", async () => {
    expect(await motif({ devis: { statut: "expire", dateValidite: PASSE }, suivantes: 1 })).toBe(
      MOTIF_RELANCE_DEVIS_REMPLACE,
    );
  });
  it("expiré sans version suivante", async () => {
    expect(await motif({ devis: { statut: "expire", dateValidite: PASSE } })).toBe(
      MOTIF_RELANCE_DEVIS_PERIME,
    );
  });
  it("envoyé mais validité dépassée", async () => {
    expect(await motif({ devis: { statut: "envoye", dateValidite: PASSE } })).toBe(
      MOTIF_RELANCE_DEVIS_PERIME,
    );
  });
  it("signé par le client", async () => {
    expect(await motif({ nonSigne: 0 })).toBe(MOTIF_RELANCE_DEVIS_SIGNE);
  });
  it("remis en main propre", async () => {
    expect(await motif({ mainPropre: true })).toBe(MOTIF_RELANCE_DEVIS_MAIN_PROPRE);
  });
  it("relance utile : null", async () => {
    expect(await motif({})).toBeNull();
  });
  it("priorité : refusé ET périmé → motif « refusé »", async () => {
    expect(await motif({ devis: { statut: "refuse", dateValidite: PASSE } })).toBe(
      MOTIF_RELANCE_DEVIS_REFUSE,
    );
  });
});
