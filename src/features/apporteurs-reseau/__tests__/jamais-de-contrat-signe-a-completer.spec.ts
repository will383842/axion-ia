import { beforeEach, describe, expect, it, vi } from "vitest";

// L2d — jamais de contrat d'apporteur signé avec une case « [à compléter] ».
// Mêmes remplacements que `signature.spec.ts` : on teste l'enchaînement, pas Prisma ni R2.
const lireDossierParLien = vi.fn();
const enregistrerDeclarations = vi.fn();
const envoyer = vi.fn();
const uploadToR2 = vi.fn();
const updateMany = vi.fn();
const rendreContratPdf = vi.fn();
const findUnique = vi.fn();
const forcerChampManquant = vi.hoisted(() => ({ actif: false }));

vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(),
  lireRegistre: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("../donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => lireDossierParLien(...a),
  enregistrerDeclarations: (...a: unknown[]) => enregistrerDeclarations(...a),
}));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => envoyer(...a) }));
vi.mock("@/lib/r2-storage", () => ({ uploadToR2: (...a: unknown[]) => uploadToR2(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      updateMany: (...a: unknown[]) => updateMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
  },
}));
vi.mock("../contrat-pdf", async () => {
  const { createHash } = await import("node:crypto");
  return {
    texteDuContrat: (v: Record<string, string>) => `CONTRAT ${JSON.stringify(v)}`,
    empreinte: (t: string) => createHash("sha256").update(t, "utf8").digest("hex"),
    rendreContratPdf: (...a: unknown[]) => rendreContratPdf(...a),
  };
});
// `valeursDuContrat` est la vraie fonction, sauf quand le test force un champ manquant.
vi.mock("../signature-regles", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../signature-regles")>();
  return {
    ...reel,
    valeursDuContrat: (...a: Parameters<typeof reel.valeursDuContrat>) => {
      const v = reel.valeursDuContrat(...a);
      return forcerChampManquant.actif ? { ...v, siege: "[à compléter]" } : v;
    },
  };
});

import { empreinte, texteDuContrat } from "../contrat-pdf";
import {
  CLES_ACCEPTATIONS,
  CLES_DECLARATIONS,
  signerContrat,
  valeursDuContrat,
} from "../signature";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd";

function dossierComplet(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    statut: "dossier_en_cours",
    prenom: "Éloïse",
    nom: "Lefèvre",
    email: "e@exemple.fr",
    siren: "732829320",
    adresse: "1 rue des Alpes 38000 Lyon",
    statutJuridique: "micro_entrepreneur",
    regimeTva: "franchise_293b",
    numeroTva: null,
    ibanSaisi: true,
    pieces: [
      { type: "identite", statut: "deposee" },
      { type: "rib", statut: "conforme" },
    ],
    ...over,
  };
}

const entree = {
  apporteurId: ID,
  jeton: JETON,
  nomTape: "eloise lefevre",
  declarations: [...CLES_DECLARATIONS],
  acceptations: [...CLES_ACCEPTATIONS],
  ipHash: "0123456789abcdef",
  userAgent: null,
  empreinteLue: "",
  maintenant: new Date("2026-10-05T12:34:00Z"),
};

describe("jamais de contrat signé avec « à compléter »", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forcerChampManquant.actif = false;
    rendreContratPdf.mockResolvedValue(Buffer.from("%PDF"));
    uploadToR2.mockResolvedValue({ key: "k", etag: null, sizeBytes: 4 });
    updateMany.mockResolvedValue({ count: 1 });
    envoyer.mockResolvedValue("envoye");
    findUnique.mockResolvedValue({ declarations: {} });
  });

  it("dossier sans SIREN : refus, ni R2 ni écriture", async () => {
    lireDossierParLien.mockResolvedValue(dossierComplet({ siren: null }));
    expect(await signerContrat(entree)).toMatchObject({ ok: false, raison: "refus" });
    expect(uploadToR2).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("🔴 valeursDuContrat forcé avec un champ manquant : refus avant le PDF, R2 et la base", async () => {
    forcerChampManquant.actif = true;
    lireDossierParLien.mockResolvedValue(dossierComplet());
    expect(await signerContrat(entree)).toMatchObject({ ok: false, raison: "refus" });
    expect(rendreContratPdf).not.toHaveBeenCalled();
    expect(uploadToR2).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("dossier complet : la signature passe comme avant", async () => {
    lireDossierParLien.mockResolvedValue(dossierComplet());
    const empreinteLue = empreinte(
      texteDuContrat(valeursDuContrat(dossierComplet() as never, entree.maintenant)),
    );
    expect(await signerContrat({ ...entree, empreinteLue })).toMatchObject({ ok: true });
    expect(uploadToR2).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
