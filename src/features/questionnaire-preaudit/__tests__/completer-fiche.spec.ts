// @vitest-environment node
/**
 * La fiche prospect se complète depuis la réponse du dirigeant (25/10/2026) — `completer-fiche.ts`.
 * Champs VIDES seulement, jamais un écrasement ; SIREN par le verrou de la porte (déjà pris :
 * rien posé, rien fusionné) ; trace d'audit avec le lien vers le questionnaire ; seulement la
 * réponse du dirigeant authentifiée par son code.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  q: null as null | Record<string, unknown>,
  fiche: null as null | Record<string, unknown>,
  update: vi.fn(),
  log: vi.fn(),
  exiger: vi.fn(),
  personne: vi.fn(),
  emettre: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    client: {
      findUnique: async () => m.fiche,
      update: m.update,
    },
    activityLog: { create: m.log },
  };
  return {
    prisma: {
      questionnaireAvantAudit: { findUnique: async () => m.q },
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    },
  };
});
vi.mock("@/server/qualiopi/crm/porte-client", () => {
  class ErreurSirenDejaPris extends Error {}
  return {
    ErreurSirenDejaPris,
    exigerSirenLibre: m.exiger,
    ajouterPersonneAFiche: m.personne,
  };
});
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: async () => null,
  emettreFaitClient: m.emettre,
}));

import { codeDirigeantPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";
import { ErreurSirenDejaPris } from "@/server/qualiopi/crm/porte-client";
import {
  ACTION_COMPLETE_DEPUIS_QUESTIONNAIRE,
  aCompleter,
  champsObjectifsDe,
  completerFicheDepuisReponse,
} from "../completer-fiche";

const QID = "00000000-0000-4000-8000-000000000042";
const SIRET = "73282932000074"; // SIRET valide (clé de Luhn)
const charge = (donnees: Record<string, unknown>) =>
  JSON.stringify({ schema: 4, mode: "main", consentements: { traitement: true }, donnees });
const DONNEES = {
  ent_nom: "Exemple Création",
  ent_siret: SIRET,
  ent_adresse: "1 rue de l'Exemple",
  ent_cp: "38000",
  ent_ville: "Exempleville",
  ent_activite: "Vêtements d'image",
  ent_effectif: "20 à 49",
  contact_prenom: "Sam",
  contact_nom: "Leroy",
  contact_email: "sam@exemple-fictif.fr",
  contact_tel: "06 12 34 56 78",
  contact_role: "Président",
};
const FICHE_VIDE = {
  siret: null,
  siren: null,
  adresseRue: null,
  adresseCodePostal: null,
  adresseVille: null,
  secteur: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env["PII_ENCRYPTION_KEY"] = "d".repeat(64);
  m.q = { ref: "REF1", rencontreId: "r1", rencontre: { clientId: "c1" } };
  m.fiche = { ...FICHE_VIDE };
  m.personne.mockResolvedValue({ contactId: "p1", cree: true });
});

describe("les champs objectifs (pur)", () => {
  it("SIRET valide → SIRET et SIREN ; adresse, secteur, personne ; jamais l'effectif ni la raison sociale", () => {
    const c = champsObjectifsDe(charge(DONNEES));
    expect(c).toEqual({
      siret: SIRET,
      siren: SIRET.slice(0, 9),
      adresseRue: "1 rue de l'Exemple",
      adresseCodePostal: "38000",
      adresseVille: "Exempleville",
      secteur: "Vêtements d'image",
      personne: {
        nom: "Sam Leroy",
        email: "sam@exemple-fictif.fr",
        telephone: "06 12 34 56 78",
        fonction: "Président",
      },
    });
    expect(champsObjectifsDe(charge({ ent_siret: "123" }))).toEqual({});
    expect(champsObjectifsDe(charge({ ent_activite: "x".repeat(201) }))).toEqual({});
    expect(champsObjectifsDe("{pas du json")).toEqual({});
  });

  it("JAMAIS un écrasement : seuls les champs vides sont gardés", () => {
    const c = champsObjectifsDe(charge(DONNEES));
    const data = aCompleter({ ...FICHE_VIDE, adresseVille: "Ville de Will", secteur: " " }, c);
    expect(data).not.toHaveProperty("adresseVille");
    expect(data["secteur"]).toBe("Vêtements d'image");
    // Un autre SIREN déjà sur la fiche : ni SIREN ni SIRET incompatible.
    const autre = aCompleter({ ...FICHE_VIDE, siren: "552100554" }, c);
    expect(autre).not.toHaveProperty("siren");
    expect(autre).not.toHaveProperty("siret");
  });
});

describe("la complétion de la fiche", () => {
  const dirigeant = (donnees = DONNEES) => ({
    mode: "main",
    membre: codeDirigeantPreaudit(QID) as string,
    json: charge(donnees),
  });

  it("complète les champs vides, ajoute la personne, émet le fait, laisse une trace liée", async () => {
    const r = await completerFicheDepuisReponse(QID, dirigeant());
    expect(r).toMatchObject({ statut: "complete", clientId: "c1", personneAjoutee: true });
    expect(m.exiger).toHaveBeenCalledWith(expect.anything(), "c1", SIRET.slice(0, 9));
    expect(m.update.mock.calls[0]?.[0]).toEqual({
      where: { id: "c1" },
      data: {
        siret: SIRET,
        siren: SIRET.slice(0, 9),
        adresseRue: "1 rue de l'Exemple",
        adresseCodePostal: "38000",
        adresseVille: "Exempleville",
        secteur: "Vêtements d'image",
      },
    });
    expect(m.emettre).toHaveBeenCalledOnce();
    const trace = m.log.mock.calls[0]?.[0]?.data;
    expect(trace).toMatchObject({
      adminUserId: null,
      action: ACTION_COMPLETE_DEPUIS_QUESTIONNAIRE,
      targetType: "Client",
      targetId: "c1",
      changes: { origine: "questionnaire", questionnaireId: QID, ref: "REF1", rencontreId: "r1" },
    });
    expect(trace.changes.nonCopies).toContain("effectif (tranche)");
  });

  it("ce que Will a saisi n'est jamais touché", async () => {
    m.fiche = {
      siret: SIRET,
      siren: SIRET.slice(0, 9),
      adresseRue: "Sa rue",
      adresseCodePostal: "75001",
      adresseVille: "Paris",
      secteur: "Son secteur",
    };
    m.personne.mockResolvedValue({ contactId: "p1", cree: false });
    const r = await completerFicheDepuisReponse(QID, dirigeant());
    expect(r).toMatchObject({ statut: "complete", champs: [], personneAjoutee: false });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.exiger).not.toHaveBeenCalled();
    expect(m.log).not.toHaveBeenCalled();
  });

  it("SIREN déjà celui d'une autre fiche : ni SIREN ni SIRET posés, rien fusionné, la trace le dit", async () => {
    m.exiger.mockRejectedValue(new ErreurSirenDejaPris("pris" as never));
    const r = await completerFicheDepuisReponse(QID, dirigeant());
    expect(r).toMatchObject({ statut: "complete", sirenDejaPris: true });
    const data = m.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty("siren");
    expect(data).not.toHaveProperty("siret");
    expect(data["adresseVille"]).toBe("Exempleville");
    expect(m.log.mock.calls[0]?.[0]?.data?.changes?.sirenDejaPris).toBe(true);
  });

  it("ignorée : collaborateur, dirigeant sans son code, questionnaire sans fiche", async () => {
    expect(
      await completerFicheDepuisReponse(QID, { mode: "emp", membre: "a1b2c3d4e5f6", json: "{}" }),
    ).toMatchObject({ statut: "ignoree", raison: "pas_le_dirigeant" });
    expect(
      await completerFicheDepuisReponse(QID, { mode: "main", membre: null, json: "{}" }),
    ).toMatchObject({ statut: "ignoree", raison: "dirigeant_non_authentifie" });
    m.q = { ref: "REF1", rencontreId: null, rencontre: null };
    expect(await completerFicheDepuisReponse(QID, dirigeant())).toMatchObject({
      statut: "ignoree",
      raison: "sans_fiche",
    });
    expect(m.update).not.toHaveBeenCalled();
  });
});
