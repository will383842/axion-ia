/**
 * V1-A-11 (vérification n° 1) — une entreprise en DIFFUSION PARTIELLE (cas fréquent des
 * micro-entrepreneurs) : le registre ne donne pas l'adresse, que le contrat-cadre imprime.
 * Le dossier ne la demandait jamais, et le contrat refusait de se préparer : la personne
 * restait bloquée à l'étape 4. L'étape 2 la demande désormais, et l'enregistre.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  enregistrerActivite: vi.fn(),
  lireEtablissementParSiret: vi.fn(),
}));

vi.mock("@/server/qualiopi/formateurs-independants/dossier", () => ({
  deposerPiece: vi.fn(),
  enregistrerActivite: (...a: unknown[]) => h.enregistrerActivite(...a),
  enregistrerCodeUrssaf: vi.fn(),
  enregistrerVous: vi.fn(),
  envoyerDossier: vi.fn(),
  etatDuDossier: vi.fn(),
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
  signalerSituation: vi.fn(),
}));
vi.mock("@/server/registre-entreprises/annuaire", () => ({
  lireEtablissementParSiret: (...a: unknown[]) => h.lireEtablissementParSiret(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/regles-admission", () => ({
  ECRANS_QUI_LAISSENT_CONTINUER: new Set(["trouvee", "muette"]),
  jugerAdmissionFormateur: (e: { registre: { ok: boolean } }) => ({
    ecran: e.registre.ok ? "trouvee" : "muette",
  }),
}));
vi.mock("@/server/qualiopi/formateurs-independants/contrat-dans-le-dossier", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/accuse-dossier", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/envois-dossier", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/source-registre", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { enregistrerActiviteAction } from "./actions";
import { TEXTES } from "./textes";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const SIRET = "98765432400019";

function registre(adresse: string | null) {
  return {
    ok: true,
    entreprise: {
      siren: "987654324",
      denomination: adresse === null ? null : "ATELIER",
      adresse,
      diffusionPartielle: adresse === null,
      active: true,
      francaise: true,
    },
  };
}

function formulaire(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const champs: Record<string, string> = {
    id: ID,
    jeton: "jeton",
    siret: SIRET,
    nda: "84691234569",
    regimeTva: "franchise_293b",
    iban: "FR7630006000011234567890189",
    ...extra,
  };
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

function dossier(adressePro: string | null) {
  return {
    id: ID,
    accesVersion: 1,
    etat: "modifiable",
    prenom: "Ilian",
    nom: "Banc",
    ibanFige: false,
    ibanSaisi: false,
    nda: null,
    adressePro,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.lireDossierParLien.mockResolvedValue(dossier(null));
  h.enregistrerActivite.mockResolvedValue({ ok: true });
});

describe("V1-A-11 — l'adresse professionnelle quand le registre ne la donne pas", () => {
  it("diffusion partielle, aucune adresse saisie : refus qui dit quoi faire, rien d'écrit", async () => {
    h.lireEtablissementParSiret.mockResolvedValue(registre(null));
    const r = await enregistrerActiviteAction(formulaire());
    expect(r).toEqual({ ok: false, message: TEXTES.adresseProManquante });
    expect(h.enregistrerActivite).not.toHaveBeenCalled();
  });

  it("diffusion partielle, adresse saisie : elle est enregistrée sur la fiche", async () => {
    h.lireEtablissementParSiret.mockResolvedValue(registre(null));
    const r = await enregistrerActiviteAction(
      formulaire({ adressePro: "  12 rue des Lilas\n69003   Lyon " }),
    );
    expect(r).toEqual({ ok: true });
    expect(h.enregistrerActivite.mock.calls[0]?.[1]).toMatchObject({
      adressePro: "12 rue des Lilas 69003 Lyon",
    });
  });

  it("une adresse illisible (sans code postal) est refusée", async () => {
    h.lireEtablissementParSiret.mockResolvedValue(registre(null));
    const r = await enregistrerActiviteAction(formulaire({ adressePro: "chez moi" }));
    expect(r).toEqual({ ok: false, message: TEXTES.adresseProManquante });
  });

  it("une adresse déjà portée par la fiche suffit", async () => {
    h.lireDossierParLien.mockResolvedValue(dossier("12 rue des Lilas 69003 Lyon"));
    h.lireEtablissementParSiret.mockResolvedValue(registre(null));
    expect(await enregistrerActiviteAction(formulaire())).toEqual({ ok: true });
  });

  it("le registre donne l'adresse : rien n'est demandé (INCHANGÉ)", async () => {
    h.lireEtablissementParSiret.mockResolvedValue(registre("1 RUE DU BANC 69000 LYON"));
    expect(await enregistrerActiviteAction(formulaire())).toEqual({ ok: true });
    expect(h.enregistrerActivite.mock.calls[0]?.[1]).toMatchObject({ adressePro: null });
  });
});
