import { beforeEach, describe, expect, it, vi } from "vitest";

// Étape 2 du dossier : registre muet (D10) et nom d'un seul mot complété (D2).
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  enregistrerActivite: vi.fn(),
  enregistrerCoordonnees: vi.fn(),
  lireEntrepriseParSiren: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  TAILLE_MAX_PIECE: 10 * 1024 * 1024,
  deposerPiece: vi.fn(),
  enregistrerActivite: (...a: unknown[]) => h.enregistrerActivite(...a),
  enregistrerCoordonnees: (...a: unknown[]) => h.enregistrerCoordonnees(...a),
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/features/apporteurs-reseau/annuaire", () => ({
  lireEntrepriseParSiren: (...a: unknown[]) => h.lireEntrepriseParSiren(...a),
  lireRegistre: (...a: unknown[]) => h.lireEntrepriseParSiren(...a),
}));
vi.mock("@/features/apporteurs-reseau/signature", async () => {
  const regles = await import("@/features/apporteurs-reseau/signature-regles");
  return { ...regles, signerContrat: vi.fn() };
});
vi.mock("@/lib/client-ip", () => ({
  getClientIp: async () => "203.0.113.9",
  getClientUserAgent: async () => null,
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => h.checkRateLimit(...a),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { luhnValid } from "@/lib/siret";

import { enregistrerActiviteAction, enregistrerCoordonneesAction } from "./actions";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
// Contrat 2.4 : le dossier demande le SIRET. Un SIRET valide (clé de Luhn) de l'unité 732829320.
const SIRET_TEST = (() => {
  for (let i = 0; i < 100000; i++) {
    const c = `732829320${String(i).padStart(5, "0")}`;
    if (luhnValid(c)) return c;
  }
  throw new Error("aucun SIRET de test");
})();
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";

function formulaire(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    id: ID,
    jeton: JETON,
    siren: SIRET_TEST,
    denomination: "Ma société",
    adresse: "1 rue des Alpes 38000 Grenoble",
    statutJuridique: "micro_entrepreneur",
    regimeTva: "franchise_293b",
    iban: "FR7630006000011234567890189",
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

const REGISTRE_OK = {
  ok: true,
  entreprise: {
    siren: "732829320",
    denomination: "Registre SAS",
    adresse: "2 rue du Registre",
    naf: "7022Z",
    statutSuggere: null,
    diffusionPartielle: false,
    active: true,
    francaise: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.checkRateLimit.mockResolvedValue({ allowed: true });
  h.lireDossierParLien.mockResolvedValue({
    id: ID,
    statut: "dossier_en_cours",
    nom: "Durand",
    ibanSaisi: false,
  });
  h.enregistrerActivite.mockResolvedValue({ ok: true });
});

describe("D10 : registre muet, saisie manuelle gardée mais dossier à contrôler", () => {
  it("registre indisponible : la saisie passe, le marqueur est posé", async () => {
    h.lireEntrepriseParSiren.mockResolvedValue({ ok: false, raison: "indisponible" });
    const r = await enregistrerActiviteAction(formulaire());
    expect(r).toEqual({ ok: true });
    expect(h.enregistrerActivite.mock.calls[0]![1]).toMatchObject({
      registreIndisponible: true,
      denomination: "Ma société",
      codeNaf: null,
    });
  });

  it("entreprise introuvable au registre : même marqueur", async () => {
    h.lireEntrepriseParSiren.mockResolvedValue({ ok: false, raison: "introuvable" });
    await enregistrerActiviteAction(formulaire());
    expect(h.enregistrerActivite.mock.calls[0]![1].registreIndisponible).toBe(true);
  });

  it("registre qui répond : pas de marqueur (et un éventuel ancien est retiré)", async () => {
    h.lireEntrepriseParSiren.mockResolvedValue(REGISTRE_OK);
    await enregistrerActiviteAction(formulaire());
    expect(h.enregistrerActivite.mock.calls[0]![1]).toMatchObject({
      registreIndisponible: false,
      denomination: "Registre SAS",
      codeNaf: "7022Z",
    });
  });

  it("SIREN invalide : refusé, rien n'est écrit", async () => {
    h.lireEntrepriseParSiren.mockResolvedValue({ ok: false, raison: "siren_invalide" });
    const r = await enregistrerActiviteAction(formulaire());
    expect(r.ok).toBe(false);
    expect(h.enregistrerActivite).not.toHaveBeenCalled();
  });
});

describe("D2 : nom d'un seul mot", () => {
  beforeEach(() => {
    h.lireEntrepriseParSiren.mockResolvedValue(REGISTRE_OK);
  });

  it("dossier sans nom : le nom saisi à l'étape 1 est transmis", async () => {
    h.lireDossierParLien.mockResolvedValue({
      id: ID,
      statut: "dossier_en_cours",
      nom: "",
      ibanSaisi: false,
    });
    await enregistrerActiviteAction(formulaire({ nom: "  Ciccone  " }));
    expect(h.enregistrerActivite.mock.calls[0]![1].nom).toBe("Ciccone");
  });

  it("dossier avec un nom : un nom envoyé par le navigateur est IGNORÉ", async () => {
    await enregistrerActiviteAction(formulaire({ nom: "Pirate" }));
    expect(h.enregistrerActivite.mock.calls[0]![1]).not.toHaveProperty("nom");
  });

  it("dossier sans nom et rien de saisi : pas de nom écrit", async () => {
    h.lireDossierParLien.mockResolvedValue({
      id: ID,
      statut: "dossier_en_cours",
      nom: "",
      ibanSaisi: false,
    });
    await enregistrerActiviteAction(formulaire());
    expect(h.enregistrerActivite.mock.calls[0]![1]).not.toHaveProperty("nom");
  });
});

describe("07/10 : l'étape 1 enregistre le nom et le téléphone tout de suite", () => {
  it("téléphone et nom complété (dossier d'un seul mot) écrits dès « Continuer »", async () => {
    h.lireDossierParLien.mockResolvedValue({ id: ID, statut: "dossier_en_cours", nom: "" });
    h.enregistrerCoordonnees.mockResolvedValue({ ok: true });
    const fd = new FormData();
    fd.set("id", ID);
    fd.set("jeton", JETON);
    fd.set("nom", "Durand");
    fd.set("telephone", "06 12 34 56 78");
    expect(await enregistrerCoordonneesAction(fd)).toEqual({ ok: true });
    expect(h.enregistrerCoordonnees).toHaveBeenCalledWith(ID, {
      telephone: "06 12 34 56 78",
      nom: "Durand",
    });
  });

  it("téléphone invalide : refusé, rien n'est écrit", async () => {
    const fd = new FormData();
    fd.set("id", ID);
    fd.set("jeton", JETON);
    fd.set("telephone", "pas un numéro");
    expect(await enregistrerCoordonneesAction(fd)).toMatchObject({ ok: false });
    expect(h.enregistrerCoordonnees).not.toHaveBeenCalled();
  });
});

describe("étape 2 : SIRET de l'établissement (plusieurs activités, 2026-10-08)", () => {
  const SIRET = SIRET_TEST;
  const ETAB_OK = {
    ok: true,
    entreprise: {
      ...REGISTRE_OK.entreprise,
      siret: SIRET,
      adresse: "8 rue du Domicile 69003 Lyon",
      naf: "46.19B",
    },
  };

  it("un SIRET : SIREN déduit, établissement lu, ADRESSE ET NAF DE L'ÉTABLISSEMENT enregistrés", async () => {
    h.lireEntrepriseParSiren.mockResolvedValue(ETAB_OK);
    const r = await enregistrerActiviteAction(formulaire({ siren: SIRET }));
    expect(r).toMatchObject({ ok: true });
    expect(h.lireEntrepriseParSiren).toHaveBeenCalledWith(SIRET);
    expect(h.enregistrerActivite.mock.calls[0]![1]).toMatchObject({
      siren: "732829320",
      siret: SIRET,
      adresse: "8 rue du Domicile 69003 Lyon",
      codeNaf: "46.19B",
    });
  });

  it("établissement FERMÉ : refusé, rien n'est enregistré", async () => {
    h.lireEntrepriseParSiren.mockResolvedValue({
      ok: true,
      entreprise: { ...ETAB_OK.entreprise, active: false },
    });
    const r = await enregistrerActiviteAction(formulaire({ siren: SIRET }));
    expect(r).toMatchObject({ ok: false });
    expect(h.enregistrerActivite).not.toHaveBeenCalled();
  });

  it("SIRET mal formé (clé fausse) : refusé avec le bon message", async () => {
    const faux = `${SIRET.slice(0, 13)}${(Number(SIRET[13]) + 1) % 10}`;
    const r = await enregistrerActiviteAction(formulaire({ siren: faux }));
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("SIRET") });
  });

  it("contrat 2.4 : un dossier NEUF qui saisit un SIREN seul est refusé (le SIRET est demandé)", async () => {
    const r = await enregistrerActiviteAction(formulaire({ siren: "732829320" }));
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("SIRET") });
    expect(h.enregistrerActivite).not.toHaveBeenCalled();
  });

  it("dossier DÉJÀ saisi avec un SIREN seul : il reste valide, aucun SIRET (pas de régression)", async () => {
    h.lireDossierParLien.mockResolvedValue({
      id: ID,
      statut: "dossier_en_cours",
      nom: "Durand",
      ibanSaisi: false,
      siren: "732829320",
      siret: null,
    });
    h.lireEntrepriseParSiren.mockResolvedValue(REGISTRE_OK);
    await enregistrerActiviteAction(formulaire({ siren: "732829320" }));
    expect(h.enregistrerActivite.mock.calls[0]![1]).toMatchObject({
      siren: "732829320",
      siret: null,
    });
  });
});
