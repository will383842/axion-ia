// Vérification 2, sécurité — V2-S-1 (BLOQUANT, argent). Le dossier de « mise à
// niveau » d'un formateur ACTIF ne remplace jamais l'IBAN de ses virements : un IBAN
// différent saisi là devient une DEMANDE de changement de compte (avis F43, 48 h,
// accord d'un administrateur, virement suspendu pendant l'attente). Avant la
// correction, l'IBAN de la fiche était écrasé sur-le-champ.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  settings: vi.fn(),
  trainer: vi.fn(),
  updateMany: vi.fn(),
  demander: vi.fn(),
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
vi.mock("@/lib/iban-empreinte", () => ({
  ibanNormalise: (i: string) => i.replace(/\s+/g, "").toUpperCase(),
  empreinteIban: (i: string) => `emp:${i.replace(/\s+/g, "").toUpperCase()}`,
}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: () => "enc:v2:banc" }));
vi.mock("../changements-coordonnees", () => ({
  MESSAGES_CHANGEMENT: { indisponible: "Cette demande n'est pas ouverte pour le moment." },
  demanderChangementIban: (...a: unknown[]) => h.demander(...a),
}));

import { enregistrerActivite, lireDossierParLien } from "../dossier";
import { jetonDossierFormateur } from "../jeton-dossier";

const A = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ANCIEN = "FR7630006000011234567890189";
const NOUVEAU = "DE89370400440532013000";
const MAINTENANT = new Date();
const ACTIVITE = {
  siret: "73282932000074",
  nda: "84691234569",
  regimeTva: "franchise_293b",
} as const;

let ficheCourante: Record<string, unknown>;

function fiche(p: Record<string, unknown> = {}) {
  return {
    id: A,
    statut: "sous_traitant",
    actif: false,
    prenom: "Marie",
    nom: "Dupont",
    email: "marie@exemple.fr",
    telephone: null,
    accesVersion: 1,
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

async function dossier() {
  return (await lireDossierParLien(A, jetonDossierFormateur(A, 1, MAINTENANT)!, MAINTENANT))!;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.settings.mockResolvedValue([{ key: "formateurs.dossier_en_ligne", value: { actif: true } }]);
  h.trainer.mockImplementation(async () => ficheCourante);
  h.updateMany.mockResolvedValue({ count: 1 });
  h.demander.mockResolvedValue({ ok: true });
});

describe("V2-S-1 — mise à niveau d'un formateur actif : l'IBAN des virements ne change pas", () => {
  it("IBAN différent : une DEMANDE de changement est ouverte, l'IBAN de la fiche n'est pas écrit", async () => {
    ficheCourante = fiche({ actif: true, ibanEmpreinte: `emp:${ANCIEN}` });
    const d = await dossier();
    expect(d.ibanParDemande).toBe(true);
    const r = await enregistrerActivite(d, { ...ACTIVITE, iban: NOUVEAU });
    expect(r).toEqual({ ok: true });
    expect(h.demander).toHaveBeenCalledWith(A, NOUVEAU, expect.any(Date));
    expect(h.updateMany).toHaveBeenCalledTimes(1);
    const { data } = h.updateMany.mock.calls[0]![0];
    expect(data).not.toHaveProperty("iban");
    expect(data).not.toHaveProperty("ibanEmpreinte");
    expect(data).toMatchObject({ siret: ACTIVITE.siret });
  });

  it("circuit fermé (interrupteur coupé) : refus, rien n'est écrit", async () => {
    ficheCourante = fiche({ actif: true, ibanEmpreinte: `emp:${ANCIEN}` });
    h.demander.mockResolvedValue({
      ok: false,
      message: "Cette demande n'est pas ouverte pour le moment.",
    });
    const r = await enregistrerActivite(await dossier(), { ...ACTIVITE, iban: NOUVEAU });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/virements/);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("même IBAN : aucune demande, l'IBAN n'est pas réécrit", async () => {
    ficheCourante = fiche({ actif: true, ibanEmpreinte: `emp:${ANCIEN}` });
    const r = await enregistrerActivite(await dossier(), { ...ACTIVITE, iban: ANCIEN });
    expect(r).toEqual({ ok: true });
    expect(h.demander).not.toHaveBeenCalled();
    expect(h.updateMany.mock.calls[0]![0].data).not.toHaveProperty("iban");
  });

  it("fiche devenue active entre la lecture et l'écriture : la relecture en base l'emporte", async () => {
    ficheCourante = fiche({ actif: false, ibanEmpreinte: `emp:${ANCIEN}` });
    const d = await dossier();
    expect(d.ibanParDemande).toBe(false);
    ficheCourante = fiche({ actif: true, ibanEmpreinte: `emp:${ANCIEN}` });
    await enregistrerActivite(d, { ...ACTIVITE, iban: NOUVEAU });
    expect(h.demander).toHaveBeenCalledTimes(1);
    expect(h.updateMany.mock.calls[0]![0].data).not.toHaveProperty("iban");
  });

  it("candidat (non actif) : l'IBAN s'enregistre, la clause exige une fiche non active ou sans IBAN", async () => {
    ficheCourante = fiche();
    const r = await enregistrerActivite(await dossier(), { ...ACTIVITE, iban: NOUVEAU });
    expect(r).toEqual({ ok: true });
    expect(h.demander).not.toHaveBeenCalled();
    const { where, data } = h.updateMany.mock.calls[0]![0];
    expect(data).toMatchObject({ iban: "enc:v2:banc", ibanEmpreinte: `emp:${NOUVEAU}` });
    expect(where).toMatchObject({
      dossierEnvoyeAt: null,
      AND: [{ OR: [{ actif: false }, { ibanEmpreinte: null }] }],
    });
  });
});
