/**
 * Relecture de #1539 (point « à surveiller ») — l'étape 2 du dossier en ligne écrit un
 * numéro de déclaration et un SIRET TAPÉS par le formateur. Comme la saisie du numéro
 * depuis l'espace (`numero-declaration-espace.ts`), un numéro ou un SIRET saisi ou changé
 * ici n'est pas un numéro vérifié : `sousTraitantVerifieAt` repasse à null, et la garde de
 * mission attend que la console revérifie.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ settings: vi.fn(), trainer: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: (...a: unknown[]) => h.settings(...a) },
    trainer: {
      findUnique: (...a: unknown[]) => h.trainer(...a),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
    },
  },
}));

import { enregistrerActivite, lireDossierParLien } from "../dossier";
import { jetonDossierFormateur } from "../jeton-dossier";

const A = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MAINTENANT = new Date("2026-10-15T10:00:00.000Z");
const SIRET = "73282932000074";
const NDA = "84691234569";

function fiche(p: Record<string, unknown> = {}) {
  return {
    id: A,
    statut: "sous_traitant",
    actif: false,
    prenom: "Marie",
    nom: "Dupont",
    email: "marie@exemple.fr",
    telephone: null,
    accesVersion: 0,
    dossierStatut: "a_completer",
    dossierEnvoyeAt: null,
    finCollaborationAt: null,
    organismeSousTraitantId: null,
    codePostalPro: "69003",
    siret: SIRET,
    sousTraitantNda: NDA,
    regimeTvaHonoraires: "franchise_293b",
    ibanEmpreinte: null,
    candidatureOrigine: null,
    documents: [],
    ...p,
  };
}

async function vueDe(p: Record<string, unknown> = {}) {
  h.trainer.mockResolvedValue(fiche(p));
  return (await lireDossierParLien(A, jetonDossierFormateur(A, 0, MAINTENANT)!, MAINTENANT))!;
}

async function enregistrer(p: Record<string, unknown>, saisie: { siret: string; nda: string }) {
  const d = await vueDe(p);
  h.updateMany.mockClear();
  const r = await enregistrerActivite(d, {
    ...saisie,
    regimeTva: "franchise_293b",
    iban: null,
  });
  expect(r.ok).toBe(true);
  return h.updateMany.mock.calls[0]![0].data as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.settings.mockResolvedValue([{ key: "formateurs.dossier_en_ligne", value: { actif: true } }]);
  h.updateMany.mockResolvedValue({ count: 1 });
});

describe("étape 2 — un numéro ou un SIRET saisi par le formateur est à revérifier", () => {
  it("numéro de déclaration CHANGÉ : la vérification de la console est remise à null", async () => {
    const data = await enregistrer({}, { siret: SIRET, nda: "11755555575" });
    expect(data).toMatchObject({ sousTraitantNda: "11755555575", sousTraitantVerifieAt: null });
  });

  it("SIRET CHANGÉ : la vérification de la console est remise à null", async () => {
    const data = await enregistrer({}, { siret: "55210055400013", nda: NDA });
    expect(data).toMatchObject({ siret: "55210055400013", sousTraitantVerifieAt: null });
  });

  it("première SAISIE (fiche sans numéro ni SIRET) : remise à null aussi", async () => {
    const data = await enregistrer(
      { siret: null, sousTraitantNda: null },
      { siret: SIRET, nda: NDA },
    );
    expect(data).toHaveProperty("sousTraitantVerifieAt", null);
  });

  it("numéro « en cours » remplacé par un numéro : remise à null", async () => {
    const data = await enregistrer({ sousTraitantNda: "en cours" }, { siret: SIRET, nda: NDA });
    expect(data).toHaveProperty("sousTraitantVerifieAt", null);
  });

  it("mêmes numéro et SIRET (écart d'espaces seulement) : la vérification n'est pas touchée", async () => {
    const data = await enregistrer(
      { siret: "732 829 320 00074", sousTraitantNda: "84 69 12345 69" },
      { siret: SIRET, nda: NDA },
    );
    expect(data).not.toHaveProperty("sousTraitantVerifieAt");
  });
});
