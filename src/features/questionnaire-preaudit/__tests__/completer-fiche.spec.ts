// @vitest-environment node
/**
 * La fiche prospect se complète depuis la réponse du dirigeant (25/10/2026) — `completer-fiche.ts`.
 * Champs VIDES seulement, jamais un écrasement ; SIREN et SIRET JAMAIS posés (proposés à Will) ;
 * l'adresse tapée n'est reprise que si elle est celle du destinataire ou du titulaire Calendly ;
 * trace d'audit avec le lien vers le questionnaire ; seulement le dirigeant authentifié.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  q: null as null | Record<string, unknown>,
  fiche: null as null | Record<string, unknown>,
  update: vi.fn(),
  log: vi.fn(),
  personne: vi.fn(),
  emettre: vi.fn(),
  contacts: [] as Array<{ nom: string }>,
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    client: {
      findUnique: async () => m.fiche,
      update: m.update,
    },
    activityLog: { create: m.log },
    clientContact: { findMany: async () => m.contacts },
  };
  return {
    prisma: {
      questionnaireAvantAudit: { findUnique: async () => m.q },
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    },
  };
});
vi.mock("@/server/qualiopi/crm/porte-client", () => ({ ajouterPersonneAFiche: m.personne }));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: async () => null,
  emettreFaitClient: m.emettre,
}));

import { hashEmailForLookup } from "@/lib/security/email-hash";
import { codeDirigeantPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";
import {
  ACTION_COMPLETE_DEPUIS_QUESTIONNAIRE,
  aCompleter,
  champsObjectifsDe,
  completerFicheDepuisReponse,
  memeNom,
  sirenAProposer,
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
  m.q = {
    ref: "REF1",
    rencontreId: "r1",
    destinataireHash: hashEmailForLookup("sam@exemple-fictif.fr"),
    rencontre: { clientId: "c1", calendlyEvent: null },
  };
  m.fiche = { ...FICHE_VIDE };
  m.contacts = [];
  m.personne.mockResolvedValue({ contactId: "p1", cree: true });
});

describe("les champs objectifs (pur)", () => {
  it("SIRET valide → SIRET et SIREN lus ; adresse, secteur, personne ; jamais l'effectif", () => {
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

  it("adresse invalide : ignorée AVANT normalisation, le reste continue", () => {
    const c = champsObjectifsDe(charge({ ...DONNEES, contact_email: "pas une adresse" }));
    expect(c.personne).toEqual({
      nom: "Sam Leroy",
      telephone: "06 12 34 56 78",
      fonction: "Président",
    });
    expect(c.adresseVille).toBe("Exempleville");
    expect(champsObjectifsDe(charge({ contact_email: "x@" }))).toEqual({});
  });

  it("JAMAIS un écrasement, et JAMAIS le SIREN ni le SIRET", () => {
    const c = champsObjectifsDe(charge(DONNEES));
    const data = aCompleter({ ...FICHE_VIDE, adresseVille: "Ville de Will", secteur: " " }, c);
    expect(data).not.toHaveProperty("adresseVille");
    expect(data["secteur"]).toBe("Vêtements d'image");
    expect(aCompleter(FICHE_VIDE, c)).not.toHaveProperty("siren");
    expect(aCompleter(FICHE_VIDE, c)).not.toHaveProperty("siret");
  });

  it("le SIREN est PROPOSÉ seulement à une fiche qui n'a ni SIREN ni SIRET", () => {
    const c = champsObjectifsDe(charge(DONNEES));
    expect(sirenAProposer(FICHE_VIDE, c)).toEqual({ siren: SIRET.slice(0, 9), siret: SIRET });
    expect(sirenAProposer({ siren: "552100554", siret: null }, c)).toBeNull();
    expect(sirenAProposer({ siren: null, siret: SIRET }, c)).toBeNull();
    expect(sirenAProposer(FICHE_VIDE, {})).toBeNull();
  });

  it("même nom : sans casse, accents ni espaces", () => {
    expect(memeNom("  Élodie   Martin ", "elodie martin")).toBe(true);
    expect(memeNom("Élodie Martin", "Elodie Marti")).toBe(false);
    expect(memeNom("", "")).toBe(false);
  });
});

describe("la complétion de la fiche", () => {
  const dirigeant = (donnees: Record<string, unknown> = DONNEES) => ({
    mode: "main",
    membre: codeDirigeantPreaudit(QID) as string,
    json: charge(donnees),
  });

  it("complète les champs vides, ajoute la personne, émet le fait, laisse une trace liée", async () => {
    const r = await completerFicheDepuisReponse(QID, dirigeant());
    expect(r).toMatchObject({ statut: "complete", clientId: "c1", personneAjoutee: true });
    expect(m.update.mock.calls[0]?.[0]).toEqual({
      where: { id: "c1" },
      data: {
        adresseRue: "1 rue de l'Exemple",
        adresseCodePostal: "38000",
        adresseVille: "Exempleville",
        secteur: "Vêtements d'image",
      },
    });
    // L'adresse est celle du destinataire choisi par Will : reprise.
    expect(m.personne.mock.calls[0]?.[2]).toMatchObject({ email: "sam@exemple-fictif.fr" });
    expect(m.emettre).toHaveBeenCalledOnce();
    const trace = m.log.mock.calls[0]?.[0]?.data;
    expect(trace).toMatchObject({
      adminUserId: null,
      action: ACTION_COMPLETE_DEPUIS_QUESTIONNAIRE,
      targetType: "Client",
      targetId: "c1",
      changes: {
        origine: "questionnaire",
        questionnaireId: QID,
        ref: "REF1",
        rencontreId: "r1",
        sirenPropose: SIRET.slice(0, 9),
        siretPropose: SIRET,
        adresseNonReprise: false,
      },
    });
    expect(trace.changes.nonCopies).toContain("effectif (tranche)");
  });

  it("⛔ le SIREN et le SIRET tapés ne sont JAMAIS écrits : proposés dans la trace", async () => {
    const r = await completerFicheDepuisReponse(QID, dirigeant());
    expect(r).toMatchObject({ sirenPropose: SIRET.slice(0, 9) });
    for (const [arg] of m.update.mock.calls) {
      expect(arg.data).not.toHaveProperty("siren");
      expect(arg.data).not.toHaveProperty("siret");
    }
  });

  it("⛔ adresse ni du destinataire ni du titulaire : personne ajoutée SANS elle", async () => {
    const r = await completerFicheDepuisReponse(
      QID,
      dirigeant({ ...DONNEES, contact_email: "tiers@ailleurs-fictif.fr" }),
    );
    expect(r).toMatchObject({ adresseNonReprise: true, personneAjoutee: true });
    const p = m.personne.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(p).not.toHaveProperty("email");
    expect(p).toMatchObject({ nom: "Sam Leroy" });
    expect(JSON.stringify(m.log.mock.calls[0]?.[0])).not.toContain("tiers@ailleurs-fictif.fr");
  });

  it("l'adresse du titulaire Calendly est reprise", async () => {
    m.q = {
      ...m.q,
      destinataireHash: null,
      rencontre: { clientId: "c1", calendlyEvent: { inviteeEmail: "SAM@exemple-fictif.fr" } },
    };
    await completerFicheDepuisReponse(QID, dirigeant());
    expect(m.personne.mock.calls[0]?.[2]).toMatchObject({ email: "sam@exemple-fictif.fr" });
  });

  it("une personne sans adresse déjà sur la fiche (même nom) n'est pas ajoutée deux fois", async () => {
    m.contacts = [{ nom: "SAM LEROY" }];
    const r = await completerFicheDepuisReponse(
      QID,
      dirigeant({ ...DONNEES, contact_email: "tiers@ailleurs-fictif.fr" }),
    );
    expect(m.personne).not.toHaveBeenCalled();
    expect(r).toMatchObject({ personneAjoutee: false });
  });

  it("ce que Will a saisi n'est jamais touché ; aucun changement = aucun fait émis", async () => {
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
    expect(r).toMatchObject({
      statut: "complete",
      champs: [],
      personneAjoutee: false,
      sirenPropose: null,
    });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.emettre).not.toHaveBeenCalled();
    expect(m.log).not.toHaveBeenCalled();
  });

  it("ignorée : collaborateur, dirigeant sans son code, questionnaire sans fiche", async () => {
    expect(
      await completerFicheDepuisReponse(QID, { mode: "emp", membre: "a1b2c3d4e5f6", json: "{}" }),
    ).toMatchObject({ statut: "ignoree", raison: "pas_le_dirigeant" });
    expect(
      await completerFicheDepuisReponse(QID, { mode: "main", membre: null, json: "{}" }),
    ).toMatchObject({ statut: "ignoree", raison: "dirigeant_non_authentifie" });
    m.q = { ref: "REF1", rencontreId: null, destinataireHash: null, rencontre: null };
    expect(await completerFicheDepuisReponse(QID, dirigeant())).toMatchObject({
      statut: "ignoree",
      raison: "sans_fiche",
    });
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe("« Poser ce SIREN » : un clic de Will, par la porte unique", () => {
  it("la fiche console pose le SIREN proposé avec l'action à verrou", () => {
    const page = readFileSync(
      path.resolve(
        __dirname,
        "../../../app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx",
      ),
      "utf8",
    );
    const i = page.indexOf('data-bloc="siren-propose-questionnaire"');
    expect(i).toBeGreaterThan(0);
    const bloc = page.slice(page.lastIndexOf("<form", i), page.indexOf("</form>", i));
    expect(bloc).toContain("action={confirmerSirenFormAction}");
    expect(bloc).toContain("Poser ce SIREN");
    // L'action passe par `updateClientAction`, qui prend le verrou (`exigerSirenLibre`).
    const actions = readFileSync(
      path.resolve(__dirname, "../../dossier-client/actions.ts"),
      "utf8",
    );
    const corps = actions.slice(actions.indexOf("export async function confirmerSirenFormAction"));
    expect(corps.slice(0, 800)).toContain("updateClientAction({ id: clientId, siren })");
  });
});
