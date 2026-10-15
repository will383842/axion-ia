// L5 — Le dossier en ligne du formateur : livré ÉTEINT, et cloisonné.
//
//   · interrupteur `dossier_en_ligne` ABSENT (comportement en ligne d'aujourd'hui) : aucun
//     dossier n'est lu, même avec un lien parfaitement valide — la page rend la 404 neutre ;
//   · allumé : seul le jeton de CETTE fiche, à SA version d'accès, non échu, ouvre ;
//     le jeton d'une autre fiche, d'un apporteur, un jeton échu ou révoqué → `null` ;
//   · toute écriture est conditionnée par l'identifiant ET la version d'accès du lien.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  settings: vi.fn(),
  trainer: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: (...a: unknown[]) => h.settings(...a) },
    trainer: {
      findUnique: (...a: unknown[]) => h.trainer(...a),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
    },
  },
}));

import { jetonDossier } from "@/features/apporteurs-reseau/jeton";

import { enregistrerActivite, enregistrerVous, lireDossierParLien } from "../dossier";
import {
  DUREE_LIEN_DOSSIER_JOURS,
  jetonDossierFormateur,
  jetonDossierFormateurValide,
} from "../jeton-dossier";

const A = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const B = "0a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a4c";
const MAINTENANT = new Date("2026-10-11T10:00:00.000Z");

function fiche(id: string, p: Record<string, unknown> = {}) {
  return {
    id,
    statut: "sous_traitant",
    prenom: "Marie",
    nom: "Dupont",
    email: "marie@exemple.fr",
    telephone: null,
    accesVersion: 0,
    dossierStatut: "en_cours",
    dossierEnvoyeAt: null,
    finCollaborationAt: null,
    organismeSousTraitantId: null,
    codePostalPro: null,
    siret: null,
    sousTraitantNda: null,
    regimeTvaHonoraires: null,
    ibanEmpreinte: null,
    candidatureOrigine: null,
    documents: [],
    ...p,
  };
}

function interrupteur(allume: boolean | undefined) {
  h.settings.mockResolvedValue(
    allume === undefined ? [] : [{ key: "formateurs.dossier_en_ligne", value: { actif: allume } }],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.trainer.mockImplementation(async (q: { where: { id: string } }) =>
    q.where.id === A ? fiche(A) : q.where.id === B ? fiche(B) : null,
  );
});

describe("dossier en ligne du formateur — livré éteint", () => {
  it("interrupteur ABSENT : aucun dossier, même avec un lien valide, et la base n'est pas lue", async () => {
    interrupteur(undefined);
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    expect(await lireDossierParLien(A, jeton, MAINTENANT)).toBeNull();
    expect(h.trainer).not.toHaveBeenCalled();
  });

  it("interrupteur COUPÉ : idem", async () => {
    interrupteur(false);
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    expect(await lireDossierParLien(A, jeton, MAINTENANT)).toBeNull();
  });

  it("allumé : le lien de la fiche ouvre SON dossier", async () => {
    interrupteur(true);
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    const d = await lireDossierParLien(A, jeton, MAINTENANT);
    expect(d?.id).toBe(A);
    expect(d?.etat).toBe("modifiable");
  });
});

describe("dossier en ligne du formateur — cloisonnement (IDOR)", () => {
  beforeEach(() => interrupteur(true));

  it("le jeton de A ne vaut pas pour B", async () => {
    const jetonA = jetonDossierFormateur(A, 0, MAINTENANT)!;
    expect(await lireDossierParLien(B, jetonA, MAINTENANT)).toBeNull();
  });

  it("un jeton d'apporteur ne vaut pas pour un formateur (domaine et clé distincts)", async () => {
    const apporteur = jetonDossier(A, 1)!;
    expect(await lireDossierParLien(A, apporteur, MAINTENANT)).toBeNull();
    expect(jetonDossierFormateurValide(A, 1, apporteur, MAINTENANT)).toBe(false);
  });

  it("un jeton échu (plus de 30 jours) est refusé", async () => {
    const ancien = new Date(MAINTENANT.getTime() - (DUREE_LIEN_DOSSIER_JOURS + 1) * 86_400_000);
    const jeton = jetonDossierFormateur(A, 0, ancien)!;
    expect(await lireDossierParLien(A, jeton, MAINTENANT)).toBeNull();
  });

  it("un jeton révoqué (version d'accès incrémentée à l'envoi) est refusé", async () => {
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    h.trainer.mockResolvedValue(fiche(A, { accesVersion: 1 }));
    expect(await lireDossierParLien(A, jeton, MAINTENANT)).toBeNull();
  });

  it("après l'envoi, l'ancien lien montre « Dossier reçu » en LECTURE SEULE, jamais plus vieux", async () => {
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    h.trainer.mockResolvedValue(fiche(A, { accesVersion: 1, dossierStatut: "a_verifier" }));
    expect((await lireDossierParLien(A, jeton, MAINTENANT))?.etat).toBe("a_verifier");
    h.trainer.mockResolvedValue(fiche(A, { accesVersion: 2, dossierStatut: "a_verifier" }));
    expect(await lireDossierParLien(A, jeton, MAINTENANT)).toBeNull();
    // Rouvert « à compléter » : l'ancien lien ne rouvre RIEN (un nouveau lien est envoyé).
    h.trainer.mockResolvedValue(fiche(A, { accesVersion: 1, dossierStatut: "a_completer" }));
    expect(await lireDossierParLien(A, jeton, MAINTENANT)).toBeNull();
  });

  it("fiche fermée, salariée, d'organisme ou sans dossier : neutre", async () => {
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    for (const p of [
      { finCollaborationAt: new Date() },
      { statut: "salarie" },
      { organismeSousTraitantId: B },
      { dossierStatut: null },
      { dossierStatut: "verifie" },
    ]) {
      h.trainer.mockResolvedValueOnce(fiche(A, p));
      expect(await lireDossierParLien(A, jeton, MAINTENANT)).toBeNull();
    }
  });

  it("lien mal formé : rien n'est lu en base", async () => {
    expect(await lireDossierParLien("pas-un-uuid", "x", MAINTENANT)).toBeNull();
    expect(h.trainer).not.toHaveBeenCalled();
  });

  it("une écriture est conditionnée par l'identifiant ET la version d'accès du lien", async () => {
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    const d = (await lireDossierParLien(A, jeton, MAINTENANT))!;
    h.updateMany.mockResolvedValue({ count: 0 });
    const r = await enregistrerVous(d, { telephone: null, codePostalPro: "69100" });
    expect(r.ok).toBe(false);
    const where = h.updateMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      id: A,
      accesVersion: 0,
      statut: "sous_traitant",
      finCollaborationAt: null,
      organismeSousTraitantId: null,
    });
  });

  it("V1-A-11 (relecture) — l'adresse n'est écrite que si le registre ne la donne pas", async () => {
    interrupteur(true);
    h.updateMany.mockResolvedValue({ count: 1 });
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    const d = (await lireDossierParLien(A, jeton, MAINTENANT))!;
    const saisie = {
      siret: "73282932000074",
      nda: "84691234569",
      regimeTva: "franchise_293b" as const,
      iban: null,
      adressePro: "99 avenue Ailleurs 75001 Paris",
    };
    await enregistrerActivite(d, saisie);
    await enregistrerActivite(d, { ...saisie, sansAdresseAuRegistre: false });
    await enregistrerActivite(d, { ...saisie, sansAdresseAuRegistre: true });
    const datas = h.updateMany.mock.calls.map((c) => c[0].data as Record<string, unknown>);
    expect(datas[0]).not.toHaveProperty("adresseProfessionnelle");
    expect(datas[1]).not.toHaveProperty("adresseProfessionnelle");
    expect(datas[2]).toMatchObject({ adresseProfessionnelle: "99 avenue Ailleurs 75001 Paris" });
  });

  it("l'IBAN ne s'enregistre pas sans secret d'empreinte, et n'est jamais écrit en clair", async () => {
    const jeton = jetonDossierFormateur(A, 0, MAINTENANT)!;
    const d = (await lireDossierParLien(A, jeton, MAINTENANT))!;
    const avant = process.env.IBAN_EMPREINTE_SECRET;
    delete process.env.IBAN_EMPREINTE_SECRET;
    try {
      const r = await enregistrerActivite(d, {
        siret: "73282932000074",
        nda: "84691234569",
        regimeTva: "franchise_293b",
        iban: "FR7630006000011234567890189",
      });
      expect(r.ok).toBe(false);
      expect(h.updateMany).not.toHaveBeenCalled();
    } finally {
      if (avant !== undefined) process.env.IBAN_EMPREINTE_SECRET = avant;
    }
  });
});
