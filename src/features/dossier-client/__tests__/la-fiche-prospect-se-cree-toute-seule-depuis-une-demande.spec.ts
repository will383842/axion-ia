// @vitest-environment node
/**
 * Toute demande écrite reçue par le site crée toute seule sa fiche prospect, comme une
 * réservation d'appel — `fiche-demande.ts`.
 *
 * Ce qui est RÉEL ici : le prédicat des types, la comparaison de la porte (`preparerCandidat`,
 * `trouverFichesProches`), la recherche de la fiche sûre, le passage et ses interrupteurs.
 * Ce qui est simulé : la base (en mémoire), la LECTURE des fiches de la porte et son
 * écriture (`creerOuRetrouverClient`, testée à part). Aucune donnée réelle : cas génériques.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  refus: null as null | Record<string, unknown>,
  opposees: new Set<string>(),
}));

vi.mock("@/server/email/opposition", () => ({
  estOpposee: async (email: string) => etat.opposees.has(email.toLowerCase()),
}));

vi.mock("@/server/qualiopi/crm/porte-client", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/server/qualiopi/crm/porte-client")>();
  const { porteSimulee } = await import("./_porte-simulee");
  const { hashEmailForLookup } = await import("@/lib/security/email-hash");
  const { natureAdresse, domaineDe } = await import("@/lib/email/nature-adresse");
  type Lignes = Array<Record<string, unknown>>;
  return {
    ...reel,
    chargerFichesCandidates: async (db: Record<string, { findMany: () => Promise<Lignes> }>) => {
      const clients = await db["client"]!.findMany();
      const adresses = await db["clientContactAdresse"]!.findMany();
      const contacts = await db["clientContact"]!.findMany();
      return clients.map((c) => {
        const siennes = adresses.filter((a) =>
          contacts.some((p) => p["id"] === a["contactId"] && p["clientId"] === c["id"]),
        );
        const mails = [
          ...(c["contactEmail"] ? [String(c["contactEmail"]).toLowerCase()] : []),
          ...siennes.map((a) => String(a["email"]).toLowerCase()),
        ];
        return {
          id: c["id"],
          numero: c["numero"],
          raisonSociale: c["raisonSociale"],
          siren: c["siren"] ?? null,
          adresseVille: c["adresseVille"] ?? null,
          adresseCodePostal: c["adresseCodePostal"] ?? null,
          emailHashes: mails.map((m) => hashEmailForLookup(m)),
          domainesPro: [
            ...new Set(mails.filter((m) => natureAdresse(m) === "pro").map((m) => domaineDe(m))),
          ],
          absorbee: false,
        };
      });
    },
    creerOuRetrouverClient: (...a: Parameters<typeof porteSimulee>) =>
      etat.refus ? Promise.resolve(etat.refus) : porteSimulee(...a),
  };
});

vi.mock("@/server/visio/gestes-compte-rendu", () => ({
  completerApresRattachement: async () => null,
}));

import { passerBalayage } from "@/server/visio/balayage";
import { encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { empreinteSha256 } from "@/server/newsletter/exports";
import {
  assurerFicheDemande,
  assurerLesFichesDemande,
  borneEffective,
  ErreurDechiffrementDemande,
  estColonneFicheDemandeAbsente,
  estDemandeATracer,
  estDemandeAvecFiche,
  ficheDemandeDepuis,
  modeFicheDemande,
  TYPES_DEMANDE_AVEC_FICHE,
} from "../fiche-demande";
import { appelsPorte } from "./_porte-simulee";
import { CLE_TEST, dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";
import type { BaseEnMemoire, Ligne } from "./_prisma-en-memoire";

const DEPUIS = "2026-11-04";
const ID_A = "00000000-0000-4000-0006-aaaaaaaaaaaa";
const ID_B = "00000000-0000-4000-0007-bbbbbbbbbbbb";
const MAINTENANT = new Date("2026-11-06T10:00:00Z");
const APRES = new Date("2026-11-05T09:00:00Z");
const AVANT = new Date("2026-11-03T09:00:00Z");
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];

beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
  vi.stubEnv("DOSSIER_FICHE_DEMANDE", "true");
  vi.stubEnv("DOSSIER_FICHE_DEMANDE_DEPUIS", DEPUIS);
  appelsPorte.length = 0;
  etat.refus = null;
  etat.opposees.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

/** Une demande du formulaire de contact, adresse et nom chiffrés comme en production. */
function demande(partiel: Partial<Ligne> = {}, details: Record<string, unknown> = {}): Ligne {
  const email = (partiel["_email"] as string | undefined) ?? "alex@exemple-fictif.fr";
  const ligne: Ligne = {
    id: id(5),
    type: "contact",
    source: null,
    companyName: "Atelier Fictif",
    contactName: encryptPii("Alex Demandeur"),
    contactEmail: encryptPii(email),
    contactEmailHash: hashEmailForLookup(email),
    contactPhone: null,
    registrationNumber: null,
    details: { unifiedType: "audit", message: "Bonjour", ...details },
    submittedAt: APRES,
    deletedAt: null,
    archivedAt: null,
    ficheClientId: null,
    ...partiel,
  };
  delete ligne["_email"];
  return ligne;
}

const base = (soumissions: Ligne[], extra: Record<string, Ligne[]> = {}) =>
  dossierEnMemoire({ submission: soumissions, ...extra });
const passage = (b: BaseEnMemoire) =>
  assurerLesFichesDemande(b.client as never, { maintenant: MAINTENANT });
const clients = (b: BaseEnMemoire) => b.tables["client"] ?? [];
const traces = (b: BaseEnMemoire, action: string) =>
  (b.tables["activityLog"] ?? []).filter((l) => l["action"] === action);

describe("le prédicat des types (exporté pour les autres lots)", () => {
  it("couvre les types commerciaux et le simulateur ROI, pas « autre » ni le chatbot", () => {
    expect([...TYPES_DEMANDE_AVEC_FICHE].sort()).toEqual(
      ["audit", "devis", "formation", "implementation", "simulateur_roi", "un_a_un"].sort(),
    );
    for (const t of TYPES_DEMANDE_AVEC_FICHE) {
      expect(estDemandeAvecFiche({ type: "contact", details: { unifiedType: t } })).toBe(true);
    }
    expect(estDemandeAvecFiche({ type: "contact", details: { unifiedType: "autre" } })).toBe(false);
    expect(
      estDemandeAvecFiche({ type: "contact", source: "chatbot", details: { canal: "chatbot" } }),
    ).toBe(false);
  });

  it("« autre » et le chatbot sont à tracer (doute), le reste est ignoré", () => {
    expect(estDemandeATracer({ type: "contact", details: { unifiedType: "autre" } })).toBe(true);
    expect(estDemandeATracer({ type: "contact", source: "chatbot", details: {} })).toBe(true);
    expect(estDemandeATracer({ type: "contact", details: { unifiedType: "audit" } })).toBe(false);
    expect(estDemandeATracer({ type: "contact", details: { unifiedType: "presse" } })).toBe(false);
    expect(
      estDemandeATracer({
        type: "contact",
        details: { unifiedType: "autre", turnstilePassed: false },
      }),
    ).toBe(false);
  });

  it("exclut recrutement, partenariat, presse, speaker, investisseur, support client", () => {
    for (const t of [
      "recrutement",
      "partenariat",
      "presse",
      "speaker",
      "investisseur",
      "support_client",
    ]) {
      expect(estDemandeAvecFiche({ type: "contact", details: { unifiedType: t } })).toBe(false);
    }
  });

  it("exclut un dossier apporteur, un captcha non validé, la corbeille et un message sans type", () => {
    expect(
      estDemandeAvecFiche({
        type: "contact",
        details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
      }),
    ).toBe(false);
    expect(
      estDemandeAvecFiche({
        type: "contact",
        details: { unifiedType: "simulateur_roi", turnstilePassed: false },
      }),
    ).toBe(false);
    expect(
      estDemandeAvecFiche({
        type: "contact",
        deletedAt: new Date(),
        details: { unifiedType: "audit" },
      }),
    ).toBe(false);
    expect(estDemandeAvecFiche({ type: "contact", details: {} })).toBe(false);
  });
});

describe("les interrupteurs", () => {
  it("coupé par défaut, actif seulement si « true », « essai » à blanc", () => {
    expect(modeFicheDemande({})).toBe("coupe");
    expect(modeFicheDemande({ DOSSIER_FICHE_DEMANDE: "false" })).toBe("coupe");
    expect(modeFicheDemande({ DOSSIER_FICHE_DEMANDE: "true" })).toBe("actif");
    expect(modeFicheDemande({ DOSSIER_FICHE_DEMANDE: "essai" })).toBe("essai");
  });

  it("la date d'activation : AAAA-MM-JJ strict, aller-retour contrôlé, jamais rejetée pour son âge", () => {
    const lire = (v?: string) =>
      ficheDemandeDepuis(v === undefined ? {} : { DOSSIER_FICHE_DEMANDE_DEPUIS: v });
    expect(lire()).toBeNull();
    expect(lire("pas une date")).toBeNull();
    expect(lire("2026-11-04")?.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    // Le format français serait lu « 11 avril » : refusé.
    expect(lire("04/11/2026")).toBeNull();
    expect(lire("2026-02-30")).toBeNull();
    expect(lire("2026-13-01")).toBeNull();
    expect(lire("2026-11-04T00:00:00Z")).toBeNull();
    // Une vieille date n'est PLUS rejetée (c'était l'arrêt silencieux à J+90) : le plafond est ailleurs.
    expect(lire("2026-08-07")?.toISOString()).toBe("2026-08-07T00:00:00.000Z");
    expect(lire("2025-01-01")).not.toBeNull();
    // Une date future reste permise.
    expect(lire("2027-01-01")).not.toBeNull();
  });

  it("la borne effective : la plus récente de la date d'activation et de « maintenant − 90 jours »", () => {
    const m = new Date("2026-11-06T10:00:00Z");
    expect(borneEffective(new Date("2026-11-04T00:00:00Z"), m).toISOString()).toBe(
      "2026-11-04T00:00:00.000Z",
    );
    expect(borneEffective(new Date("2026-01-01T00:00:00Z"), m).toISOString()).toBe(
      "2026-08-08T10:00:00.000Z",
    );
    expect(borneEffective(new Date("2027-01-01T00:00:00Z"), m).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("coupé : aucune requête, aucune fiche", async () => {
    vi.stubEnv("DOSSIER_FICHE_DEMANDE", "false");
    const b = base([demande()]);
    const lire = vi.spyOn(b.client["submission"] as { findMany: () => unknown }, "findMany");
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ mode: "coupe", creees: 0 });
    expect(lire).not.toHaveBeenCalled();
    expect(clients(b)).toHaveLength(0);
  });

  it("date absente ou invalide en mode allumé : rien n'est fait, un avertissement, dateManquante", async () => {
    for (const valeur of ["", "04/11/2026", "2026-02-30"]) {
      vi.stubEnv("DOSSIER_FICHE_DEMANDE_DEPUIS", valeur);
      const avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const b = base([demande()]);
      const bilan = await passage(b);
      expect(bilan).toMatchObject({ mode: "actif", creees: 0, dateManquante: true });
      expect(clients(b)).toHaveLength(0);
      expect(avert).toHaveBeenCalledTimes(1);
      expect(String(avert.mock.calls[0]?.[0])).toContain("DOSSIER_FICHE_DEMANDE_DEPUIS");
      avert.mockRestore();
    }
  });

  it("coupé : pas d'avertissement, dateManquante reste faux même sans date", async () => {
    vi.stubEnv("DOSSIER_FICHE_DEMANDE", "false");
    vi.stubEnv("DOSSIER_FICHE_DEMANDE_DEPUIS", "");
    const avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bilan = await passage(base([demande()]));
    expect(bilan).toMatchObject({ mode: "coupe", dateManquante: false });
    expect(avert).not.toHaveBeenCalled();
    avert.mockRestore();
  });

  it("🔴 J+120 : la date d'activation ne tue pas l'étape ; un message de juillet reste sans fiche, un d'octobre en reçoit une", async () => {
    vi.stubEnv("DOSSIER_FICHE_DEMANDE_DEPUIS", "2026-07-01");
    const b = base([
      demande({
        id: ID_A,
        submittedAt: new Date("2026-07-15T09:00:00Z"),
        _email: "juillet@exemple-fictif.fr",
      }),
      demande({
        id: ID_B,
        submittedAt: new Date("2026-10-20T09:00:00Z"),
        _email: "octobre@exemple-fictif.fr",
      }),
    ]);
    const bilan = await assurerLesFichesDemande(b.client as never, {
      maintenant: new Date("2026-10-29T10:00:00Z"),
    });
    expect(bilan).toMatchObject({ creees: 1, dateManquante: false });
    expect(b.tables["submission"]?.find((m) => m["id"] === ID_A)?.["ficheClientId"]).toBeNull();
    expect(b.tables["submission"]?.find((m) => m["id"] === ID_B)?.["ficheClientId"]).not.toBeNull();
  });

  it("une date d'activation ancienne reste plafonnée à 90 jours", async () => {
    vi.stubEnv("DOSSIER_FICHE_DEMANDE_DEPUIS", "2026-01-01");
    const b = base([
      demande({
        id: ID_A,
        submittedAt: new Date("2026-03-01T09:00:00Z"),
        _email: "mars@exemple-fictif.fr",
      }),
      demande({ id: ID_B, submittedAt: APRES, _email: "recent@exemple-fictif.fr" }),
    ]);
    const bilan = await passage(b);
    expect(bilan.creees).toBe(1);
    expect(b.tables["submission"]?.find((m) => m["id"] === ID_A)?.["ficheClientId"]).toBeNull();
  });

  it("à blanc : décide et compte, n'écrit rien", async () => {
    vi.stubEnv("DOSSIER_FICHE_DEMANDE", "essai");
    const b = base([demande()]);
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ mode: "essai", creeraient: 1, creees: 0 });
    expect(clients(b)).toHaveLength(0);
    expect(b.tables["submission"]?.[0]?.["ficheClientId"]).toBeNull();
    expect(b.tables["activityLog"] ?? []).toHaveLength(0);
    expect(b.tables["alerteSysteme"] ?? []).toHaveLength(0);
  });

  it("à blanc : deux demandes de la même adresse comptent une création et une liaison", async () => {
    vi.stubEnv("DOSSIER_FICHE_DEMANDE", "essai");
    const b = base([demande(), demande({ submittedAt: new Date("2026-11-05T10:00:00Z") })]);
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ creeraient: 1, lieraient: 1, creees: 0 });
    expect(clients(b)).toHaveLength(0);
  });
});

describe("une demande crée sa fiche prospect", () => {
  it("crée la fiche au nom de l'entreprise, sans SIREN, reliée au message, avec sa trace", async () => {
    const b = base([demande({ registrationNumber: "123456782" }, { ville: "Lyon" })]);
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ creees: 1, liees: 0, doutes: 0, plantees: 0 });
    expect(clients(b)).toHaveLength(1);
    expect(clients(b)[0]).toMatchObject({
      raisonSociale: "Atelier Fictif",
      type: "entreprise",
      statut: "prospect",
      adresseVille: "Lyon",
    });
    // Jamais un SIREN posé tout seul, même si le message en portait un.
    expect(clients(b)[0]?.["siren"]).toBeUndefined();
    expect(appelsPorte[0]?.donnees["siren"]).toBeUndefined();
    expect(appelsPorte[0]?.personne).toMatchObject({
      nom: "Alex Demandeur",
      email: "alex@exemple-fictif.fr",
    });
    expect(appelsPorte[0]?.options).toMatchObject({ parAdminId: null });
    expect(b.tables["submission"]?.[0]?.["ficheClientId"]).toBe(clients(b)[0]?.["id"]);
    const trace = traces(b, "client.creation_automatique");
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({ adminUserId: null, targetId: clients(b)[0]?.["id"] });
    expect(trace[0]?.["changes"]).toMatchObject({
      origine: "automatique",
      origineFiche: "demande",
    });
  });

  it("l'annuaire des entreprises en panne n'y change rien : il n'est jamais appelé", async () => {
    const fetchCasse = vi.fn(() => Promise.reject(new Error("annuaire coupé")));
    vi.stubGlobal("fetch", fetchCasse);
    const b = base([demande()]);
    await passage(b);
    expect(clients(b)).toHaveLength(1);
    expect(fetchCasse).not.toHaveBeenCalled();
  });

  it("sans entreprise utilisable (« — », « Via chatbot »), une fiche de particulier au nom de la personne", async () => {
    const b = base([
      demande({ companyName: "—" }),
      demande({
        companyName: "Via chatbot",
        contactName: encryptPii("Sam Visiteur"),
        contactEmail: encryptPii("sam@autre-fictif.fr"),
        contactEmailHash: hashEmailForLookup("sam@autre-fictif.fr"),
      }),
    ]);
    await passage(b);
    expect(
      clients(b)
        .map((c) => [c["raisonSociale"], c["type"]])
        .sort(),
    ).toEqual([
      ["Alex Demandeur", "particulier"],
      ["Sam Visiteur", "particulier"],
    ]);
  });

  it("un nom trop long est coupé à 200 caractères (colonne VarChar(200))", async () => {
    const b = base([demande({ companyName: "—", contactName: encryptPii("Alex ".repeat(80)) })]);
    await passage(b);
    expect(String(appelsPorte[0]?.personne?.nom).length).toBe(200);
  });

  it("le simulateur ROI passe aussi ; le téléphone chiffré est lu", async () => {
    const b = base([
      demande({ contactPhone: encryptPii("06 12 34 56 78") }, { unifiedType: "simulateur_roi" }),
    ]);
    await passage(b);
    expect(clients(b)).toHaveLength(1);
    expect(appelsPorte[0]?.personne).toMatchObject({ telephone: "06 12 34 56 78" });
  });

  it("deux passages = une seule fiche ; deux messages de la même adresse = une seule fiche", async () => {
    const b = base([demande(), demande({ submittedAt: new Date("2026-11-05T10:00:00Z") })]);
    await passage(b);
    await passage(b);
    expect(clients(b)).toHaveLength(1);
    const liees = (b.tables["submission"] ?? []).map((s) => s["ficheClientId"]);
    expect(liees).toEqual([clients(b)[0]?.["id"], clients(b)[0]?.["id"]]);
  });

  it("un message reçu AVANT la date d'activation n'est pas traité", async () => {
    const b = base([demande({ submittedAt: AVANT })]);
    await passage(b);
    expect(clients(b)).toHaveLength(0);
  });
});

describe("les demandes qui ne créent jamais de fiche", () => {
  it("« autre » et le chatbot : un doute tracé, pas de fiche, message laissé tel quel", async () => {
    const b = base([
      demande({}, { unifiedType: "autre" }),
      demande({
        source: "chatbot",
        companyName: "Via chatbot",
        details: { canal: "chatbot" },
        contactEmail: encryptPii("sam@autre-fictif.fr"),
        contactEmailHash: hashEmailForLookup("sam@autre-fictif.fr"),
      }),
    ]);
    const un = await passage(b);
    expect(un).toMatchObject({ creees: 0, doutes: 2 });
    expect(clients(b)).toHaveLength(0);
    expect(traces(b, "dossier.fiche_demande_doute")).toHaveLength(2);
    expect(
      b.tables["submission"]?.every((m) => m["ficheClientId"] === null && m["deletedAt"] === null),
    ).toBe(true);
    // Noté une fois : le passage suivant ne le revoit pas.
    expect((await passage(b)).doutes).toBe(0);
  });

  it("un message du chatbot effacé (art. 17) ne recrée jamais de fiche", async () => {
    const efface = {
      source: "chatbot",
      companyName: "Via chatbot",
      contactName: "[erased-rgpd-art17]",
      contactEmail: "erased:0123456789abcdef@erased.local",
      contactEmailHash: null,
      details: {},
    };
    const b = base([
      demande(efface),
      // Même marques posées une à une : chacune suffit.
      demande({ ...efface, contactEmailHash: "abc", contactName: encryptPii("Alex Demandeur") }),
      demande({
        ...efface,
        contactEmailHash: "abc",
        contactEmail: encryptPii("alex@exemple-fictif.fr"),
      }),
      demande({ contactEmailHash: null }, { unifiedType: "audit" }),
    ]);
    const bilan = await passage(b);
    expect(clients(b)).toHaveLength(0);
    expect(bilan.creees).toBe(0);
    expect(appelsPorte).toHaveLength(0);
    expect(traces(b, "dossier.fiche_demande_doute").length).toBeGreaterThanOrEqual(3);
  });

  it("une adresse sous opposition : pas de fiche, un doute tracé, le message reste visible", async () => {
    etat.opposees.add("alex@exemple-fictif.fr");
    const b = base([demande()]);
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ creees: 0, doutes: 1 });
    expect(clients(b)).toHaveLength(0);
    expect(traces(b, "dossier.fiche_demande_doute")[0]?.["changes"]).toMatchObject({
      raison: "opposition",
    });
    const m = b.tables["submission"]?.[0];
    expect(m).toMatchObject({ deletedAt: null, archivedAt: null, ficheClientId: null });
  });

  it("un message archivé n'est pas traité", async () => {
    const b = base([demande({ archivedAt: new Date() })]);
    await passage(b);
    expect(clients(b)).toHaveLength(0);
  });

  it("un message ignoré n'occupe jamais les places : un ancien message reste traité", async () => {
    const ignores = Array.from({ length: 520 }, (_, i) =>
      demande(
        { submittedAt: new Date(Date.UTC(2026, 10, 6, 12, 0, i % 60)) },
        { unifiedType: "presse" },
      ),
    );
    const ancien = demande({ submittedAt: new Date("2026-11-04T08:00:00Z") });
    const b = base([...ignores, ancien]);
    const bilan = await passage(b);
    expect(bilan.creees).toBe(1);
    expect(
      b.tables["submission"]?.find((m) => m["id"] === ancien["id"])?.["ficheClientId"],
    ).not.toBeNull();
  });

  it("recrutement, partenariat, presse, apporteur, captcha non validé, corbeille, adresse exclue", async () => {
    vi.stubEnv("CRM_SYNC_EXCLUSIONS_SHA256", empreinteSha256("interne@exemple-fictif.fr"));
    const b = base([
      demande({}, { unifiedType: "recrutement" }),
      demande({}, { unifiedType: "partenariat" }),
      demande({}, { unifiedType: "presse" }),
      demande({}, { unifiedType: "recrutement", subType: "candidature-commerciale" }),
      demande({}, { turnstilePassed: false }),
      demande({ deletedAt: new Date() }),
      demande({ _email: "interne@exemple-fictif.fr" }),
    ]);
    const bilan = await passage(b);
    expect(clients(b)).toHaveLength(0);
    expect(bilan.creees).toBe(0);
    expect(appelsPorte).toHaveLength(0);
  });

  it("une adresse illisible ou un nom inutilisable : doute, aucune fiche, pas de nouvel essai", async () => {
    const b = base([
      demande({ companyName: "—", contactName: encryptPii("jean.dupont") }),
      demande({ contactEmail: encryptPii("pas-une-adresse"), contactEmailHash: "abc" }),
    ]);
    const un = await passage(b);
    expect(un).toMatchObject({ creees: 0, doutes: 2 });
    expect(clients(b)).toHaveLength(0);
    const deux = await passage(b);
    expect(deux.doutes).toBe(0);
  });
});

describe("une fiche existe déjà : aucune écriture sur elle", () => {
  it("même adresse : le message se relie à la fiche, la fiche reste intacte, aucune seconde fiche", async () => {
    const existante = fiche({
      raisonSociale: "Atelier Existant",
      contactEmail: "alex@exemple-fictif.fr",
      notes: "note de Will",
    });
    const avant = structuredClone(existante);
    const b = base([demande()], { client: [existante] });
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ creees: 0, liees: 1 });
    expect(clients(b)).toHaveLength(1);
    expect(clients(b)[0]).toEqual(avant);
    expect(appelsPorte).toHaveLength(0);
    expect(b.tables["submission"]?.[0]?.["ficheClientId"]).toBe(existante["id"]);
    expect(traces(b, "client.doublon_possible")).toHaveLength(0);
    expect(b.tables["alerteSysteme"] ?? []).toHaveLength(0);
  });

  it("la fiche faite à la main pour une demande déjà reçue : la demande s'y relie, sans doublon", async () => {
    // Cas réel : la fiche a été créée à la main avec la même adresse, le message n'y était pas relié.
    const ficheMain = fiche({
      raisonSociale: "Boutique Fictive",
      contactEmail: "Alex@Exemple-Fictif.fr",
    });
    const b = base([demande({ companyName: "BOUTIQUE FICTIVE" })], { client: [ficheMain] });
    await passage(b);
    expect(clients(b)).toHaveLength(1);
    expect(b.tables["submission"]?.[0]?.["ficheClientId"]).toBe(ficheMain["id"]);
  });

  it("une même adresse sur deux fiches : ambigu, rien n'est créé ni relié, doute noté", async () => {
    const f1 = fiche({ raisonSociale: "Une", contactEmail: "alex@exemple-fictif.fr" });
    const f2 = fiche({ raisonSociale: "Deux", contactEmail: "alex@exemple-fictif.fr" });
    const b = base([demande()], { client: [f1, f2] });
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ creees: 0, liees: 0, doutes: 1 });
    expect(clients(b)).toHaveLength(2);
    expect(b.tables["submission"]?.[0]?.["ficheClientId"]).toBeNull();
  });

  it("une fiche absorbée par une fusion n'est jamais choisie : une nouvelle fiche est créée", async () => {
    const absorbee = fiche({ raisonSociale: "Ancienne", contactEmail: "alex@exemple-fictif.fr" });
    const b = base([demande()], {
      client: [absorbee],
      clientFusion: [{ id: ID_B, absorbeId: absorbee["id"], defaiteLe: null }],
    });
    await passage(b);
    expect(clients(b)).toHaveLength(2);
    expect(b.tables["submission"]?.[0]?.["ficheClientId"]).not.toBe(absorbee["id"]);
    expect(b.tables["submission"]?.[0]?.["ficheClientId"]).not.toBeNull();
  });

  it("un refus de la porte laisse une trace, rien n'est écrit, le message est réessayé", async () => {
    etat.refus = { statut: "motif_requis", proches: [], message: "connue" };
    const b = base([demande()]);
    const un = await passage(b);
    expect(un).toMatchObject({ creees: 0, doutes: 1, plantees: 0, refusAbandonnes: 0 });
    expect(clients(b)).toHaveLength(0);
    expect(b.tables["submission"]?.[0]?.["ficheClientId"]).toBeNull();
    expect(traces(b, "dossier.fiche_demande_doute")).toHaveLength(0);
    expect(traces(b, "dossier.fiche_demande_refus_porte")).toHaveLength(1);
    etat.refus = null;
    const deux = await passage(b);
    expect(deux.creees).toBe(1);
  });

  it("🔴 au 3e refus le message est écarté, UNE alerte agrégée pour deux messages, plus de réessai", async () => {
    etat.refus = { statut: "motif_requis", proches: [], message: "connue" };
    const b = base([
      demande({ id: ID_A, _email: "un@exemple-fictif.fr" }),
      demande({ id: ID_B, _email: "deux@exemple-fictif.fr" }),
    ]);
    const creerAlerte = vi.fn(async () => null);
    const passer = () =>
      assurerLesFichesDemande(b.client as never, { maintenant: MAINTENANT, creerAlerte });
    expect((await passer()).refusAbandonnes).toBe(0);
    expect((await passer()).refusAbandonnes).toBe(0);
    expect(creerAlerte).not.toHaveBeenCalled();
    const trois = await passer();
    expect(trois).toMatchObject({ refusAbandonnes: 2, doutes: 2, creees: 0 });
    expect(creerAlerte).toHaveBeenCalledTimes(1);
    const alerte = (creerAlerte.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(alerte).toMatchObject({ code: "visio.fiche_demande_refus_porte" });
    expect(alerte["cibleId"]).toBeUndefined();
    expect(JSON.stringify(alerte)).not.toMatch(/exemple-fictif|Alex/i);
    expect(traces(b, "dossier.fiche_demande_refus_porte")).toHaveLength(6);
    expect(traces(b, "dossier.fiche_demande_doute")).toHaveLength(2);
    expect(traces(b, "dossier.fiche_demande_doute")[0]?.["changes"]).toMatchObject({
      raison: "refus_porte",
    });
    // La porte accepterait maintenant : les deux messages sont écartés, plus aucun réessai.
    etat.refus = null;
    const apres = await passer();
    expect(apres).toMatchObject({ creees: 0, doutes: 0, refusAbandonnes: 0 });
    expect(creerAlerte).toHaveBeenCalledTimes(1);
    expect(clients(b)).toHaveLength(0);
  });

  it("une alerte agrégée qui échoue ne fait pas planter le passage", async () => {
    etat.refus = { statut: "motif_requis", proches: [], message: "connue" };
    const b = base([demande()]);
    const creerAlerte = vi.fn(async () => {
      throw new Error("base indisponible");
    });
    const avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const passer = () =>
      assurerLesFichesDemande(b.client as never, { maintenant: MAINTENANT, creerAlerte });
    await passer();
    await passer();
    const trois = await passer();
    expect(trois).toMatchObject({ refusAbandonnes: 1, plantees: 0 });
    avert.mockRestore();
  });

  it("les doutes déjà vus sont relus du plus récent, depuis la borne seulement", async () => {
    const b = base([demande()]);
    const lire = vi.spyOn(
      b.client["activityLog"] as { findMany: (a: unknown) => unknown },
      "findMany",
    );
    await passage(b);
    const appel = lire.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } };
      orderBy: unknown;
      take: number;
    };
    expect(appel.orderBy).toEqual({ createdAt: "desc" });
    expect(appel.where.createdAt.gte.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(appel.take).toBe(5000);
  });

  it("fiche proche (même nom, même ville) : nouvelle fiche, doublon possible tracé, alerte, fiche proche intacte", async () => {
    const proche = fiche({
      raisonSociale: "Atelier Fictif",
      adresseVille: "Lyon",
      contactEmail: "autre@ailleurs-fictif.fr",
    });
    const avant = structuredClone(proche);
    const b = base([demande({}, { ville: "Lyon" })], { client: [proche] });
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ creees: 1 });
    expect(clients(b)).toHaveLength(2);
    expect(clients(b).find((c) => c["id"] === proche["id"])).toEqual(avant);
    const nouvelle = clients(b).find((c) => c["id"] !== proche["id"])!;
    const doublon = traces(b, "client.doublon_possible");
    expect(doublon).toHaveLength(1);
    expect(doublon[0]).toMatchObject({ targetId: nouvelle["id"] });
    expect(JSON.stringify(doublon[0]?.["changes"])).toContain(String(proche["id"]));
    expect(bilan.doublons).toEqual([{ clientId: nouvelle["id"], proches: 1 }]);
    const alertes = b.tables["alerteSysteme"] ?? [];
    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toMatchObject({ cibleType: "Client", cibleId: nouvelle["id"] });
  });
});

describe("une clé de chiffrement absente ou fausse est une panne, jamais un doute", () => {
  it("clé absente : le message est compté « planté », aucun doute noté, rien n'est créé", async () => {
    const b = base([demande()]);
    delete process.env["PII_ENCRYPTION_KEY"];
    const avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ creees: 0, doutes: 0, plantees: 1 });
    expect(traces(b, "dossier.fiche_demande_doute")).toHaveLength(0);
    expect(clients(b)).toHaveLength(0);
    // Le nom de l'erreur seulement, jamais une donnée.
    expect(avert).toHaveBeenCalledWith(expect.stringContaining("ErreurDechiffrementDemande"));
    avert.mockRestore();
    // La clé revient : le message est traité (il n'a pas été condamné).
    process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
    expect((await passage(b)).creees).toBe(1);
  });

  it("clé fausse : même panne", async () => {
    const b = base([demande()]);
    process.env["PII_ENCRYPTION_KEY"] = "1".repeat(64);
    const avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ creees: 0, doutes: 0, plantees: 1 });
    avert.mockRestore();
  });

  it("assurerFicheDemande lève ErreurDechiffrementDemande", async () => {
    const b = base([demande()]);
    delete process.env["PII_ENCRYPTION_KEY"];
    await expect(
      assurerFicheDemande(b.client as never, b.tables["submission"]![0]!["id"] as string),
    ).rejects.toBeInstanceOf(ErreurDechiffrementDemande);
  });

  it("le balayage signale la panne (étape en échec)", async () => {
    const b = base([demande()]);
    delete process.env["PII_ENCRYPTION_KEY"];
    const avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await passerBalayage(b.client as never, {
      maintenant: MAINTENANT,
      notifier: vi.fn(async () => ({ channels: { telegram: "sent" } })) as never,
      creerAlerte: async (input: { code: string }) => {
        await (
          b.client as unknown as {
            alerteSysteme: { create: (a: unknown) => Promise<unknown> };
          }
        ).alerteSysteme.create({
          data: { ...input, niveau: "important", titre: "t", message: "m" },
        });
      },
    });
    expect(r.etapesEnEchec).toContain("fiches-demande");
    avert.mockRestore();
  });
});

describe("la colonne n'existe pas encore (migration pas posée)", () => {
  const colonneAbsente = Object.assign(
    new Error("The column `submissions.fiche_client_id` does not exist in the current database."),
    { code: "P2022" },
  );

  it("reconnaît l'erreur de colonne absente, jamais un doublon", () => {
    expect(estColonneFicheDemandeAbsente(colonneAbsente)).toBe(true);
    expect(
      estColonneFicheDemandeAbsente(Object.assign(new Error("fiche_client_id"), { code: "P2002" })),
    ).toBe(false);
    expect(estColonneFicheDemandeAbsente(new Error("base indisponible"))).toBe(false);
  });

  it("le passage ne plante pas, ne crée rien et le dit", async () => {
    const b = base([demande()]);
    (b.client["submission"] as { findMany: () => Promise<never> }).findMany = () =>
      Promise.reject(colonneAbsente);
    const bilan = await passage(b);
    expect(bilan).toMatchObject({ colonneAbsente: true, creees: 0, plantees: 0 });
    expect(clients(b)).toHaveLength(0);
  });

  it("une autre panne de lecture remonte (elle n'est pas avalée)", async () => {
    const b = base([demande()]);
    (b.client["submission"] as { findMany: () => Promise<never> }).findMany = () =>
      Promise.reject(new Error("base indisponible"));
    await expect(passage(b)).rejects.toThrow("base indisponible");
  });
});

describe("assurerFicheDemande : un message", () => {
  it("un message déjà relié est laissé tel quel", async () => {
    const existante = fiche({ raisonSociale: "X" });
    const b = base([demande({ ficheClientId: existante["id"] })], { client: [existante] });
    const issue = await assurerFicheDemande(
      b.client as never,
      b.tables["submission"]![0]!["id"] as string,
    );
    expect(issue.statut).toBe("deja_liee");
    expect(appelsPorte).toHaveLength(0);
  });
});

describe("le balayage appelle la fiche des demandes", () => {
  const notifier = vi.fn(async () => ({ channels: { telegram: "sent" } })) as never;
  const maintenant = new Date("2026-11-06T10:00:00Z");

  it("crée la fiche sans compter de panne ; coupé : rien", async () => {
    const b = base([demande()]);
    const r = await passerBalayage(b.client as never, { maintenant, notifier });
    expect(r.fichesDemande).toMatchObject({ mode: "actif", creees: 1 });
    expect(r.etapesEnEchec).not.toContain("fiches-demande");
    expect(clients(b)).toHaveLength(1);

    vi.stubEnv("DOSSIER_FICHE_DEMANDE", "false");
    const c = base([demande()]);
    const coupe = await passerBalayage(c.client as never, { maintenant, notifier });
    expect(coupe.fichesDemande.mode).toBe("coupe");
    expect(clients(c)).toHaveLength(0);
  });
});
