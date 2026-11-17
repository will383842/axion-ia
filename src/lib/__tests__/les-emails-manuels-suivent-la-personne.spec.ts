// @vitest-environment node

/**
 * ⛔ LES E-MAILS ÉCRITS À LA MAIN SUIVENT LA PERSONNE (lot I4, fiche F1b ; plan
 * `PLAN-I4-CORRECTIF-F1.md`, section 3).
 *
 * Les deux tables (`emails_manuels`, `emails_manuels_pieces_jointes`) ont leurs clés étrangères en
 * RESTRICT : rien ne se supprime, rien ne se détache. Ce test prouve les trois gestes de la fiche :
 *
 *   1. EXPORT art. 15 : l'e-mail est retrouvé par `contact_id` ET par la seule empreinte (entité
 *      `CalendlyEvent`, sans `contact_id`) ; l'e-mail d'une autre personne est absent ; jamais
 *      l'adresse d'un tiers ; un brouillon rend son texte source ;
 *   2. NEUTRALISATION (geste manuel du fondateur) : lignes et pièces jointes GARDÉES, adresse
 *      remplacée par un pseudonyme chiffré, empreinte gardée, contenu vidé ; stagiaire : adresse
 *      masquée seulement ; `deleteFromR2` jamais appelé ; une autre personne n'est pas touchée ;
 *      idempotente ;
 *   3. PURGE DU PILOTE : refus lisible et AUCUNE ligne supprimée quand un e-mail manuel vise une
 *      fiche ou un contact du périmètre.
 *
 * Mutations qui font rougir : relire l'export sans la branche `destinataireHash` ou sans la branche
 * `contactId` ; remplacer `updateMany` par `deleteMany` dans la neutralisation ; appeler
 * `deleteFromR2` ; retirer le bloc de refus de `supprimerDonneesPilote`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ client: null as unknown, supprimerR2: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return d.client;
  },
}));
vi.mock("@/lib/r2-storage", () => ({ deleteFromR2: d.supprimerR2 }));

import {
  dossierEnMemoire,
  fiche,
  id,
} from "../../features/dossier-client/__tests__/_dossier-en-memoire";
import { decryptPii, encryptPii } from "../pii-crypto";
import { exporterDossierClientPour } from "../rgpd-dossier-client";
import {
  neutraliserEmailsManuelsPour,
  NOM_PIECE_JOINTE_EFFACE,
  OBJET_EMAIL_MANUEL_EFFACE,
  purgerPilote,
} from "../rgpd-erase";
import { hashEmailForLookup } from "../security/email-hash";

type Ligne = Record<string, unknown>;

const ALICE = "alice.fictive@exemple-fictif.fr";
const ALICE_BIS = "alice.perso@exemple-fictif.fr";
const BRUNO = "bruno.fictif@exemple-fictif.fr";
const h = (a: string): string => hashEmailForLookup(a) as string;

const CLIENT = "00000000-0000-4000-8000-0000000000c1";
const CONTACT_ALICE = "00000000-0000-4000-8000-0000000000a1";
const CONTACT_BRUNO = "00000000-0000-4000-8000-0000000000b1";

function email(over: Ligne): Ligne {
  return {
    id: id(9),
    cleIdempotence: `cle-${id(1)}`,
    entiteType: "ClientContact",
    entiteId: CONTACT_ALICE,
    clientId: CLIENT,
    contactId: null,
    destinataireChiffre: encryptPii(ALICE),
    destinataireHash: h(ALICE),
    destinataireNom: "Alice Fictive",
    expediteurNom: "Le fondateur",
    objet: "Votre rendez-vous",
    corpsSource: "Bonjour Alice, voici le texte source.",
    corpsHtml: "<p>Bonjour Alice, voici le texte rendu.</p>",
    corpsTexte: "Bonjour Alice, voici le texte rendu.",
    statut: "envoye",
    creeLe: new Date("2026-11-01T10:00:00Z"),
    envoyeLe: new Date("2026-11-01T10:05:00Z"),
    ...over,
  };
}

function piece(emailManuelId: unknown, cle: string, nom = "devis-alice.pdf"): Ligne {
  return {
    id: id(8),
    emailManuelId,
    nomFichier: nom,
    format: "pdf",
    tailleOctets: 1234,
    cleStockage: cle,
    creeLe: new Date("2026-11-01T10:00:00Z"),
  };
}

let base: ReturnType<typeof dossierEnMemoire>;
let courriels: { alice1: Ligne; alice2: Ligne; alice3: Ligne; brouillon: Ligne; bruno: Ligne };

beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = "e".repeat(64);
  d.supprimerR2.mockReset();
  courriels = {
    // Par `contact_id` ET par empreinte.
    alice1: email({ contactId: CONTACT_ALICE, objet: "Compte rendu" }),
    // Par la SEULE empreinte : entité `CalendlyEvent`, ni `client_id` ni `contact_id`.
    alice2: email({
      entiteType: "CalendlyEvent",
      entiteId: "cl_evt_1",
      clientId: null,
      contactId: null,
      objet: "Avant votre rendez-vous",
    }),
    // Par le SEUL `contact_id` : l'empreinte est celle d'une autre adresse, inconnue de la fiche.
    alice3: email({
      contactId: CONTACT_ALICE,
      destinataireHash: h("adresse.inconnue@exemple-fictif.fr"),
      objet: "Autre adresse",
    }),
    brouillon: email({
      contactId: CONTACT_ALICE,
      statut: "brouillon",
      objet: "Brouillon",
      corpsSource: "Texte source du brouillon.",
      corpsHtml: null,
      corpsTexte: null,
      envoyeLe: null,
    }),
    // Une AUTRE personne de la même fiche.
    bruno: email({
      contactId: CONTACT_BRUNO,
      destinataireChiffre: encryptPii(BRUNO),
      destinataireHash: h(BRUNO),
      destinataireNom: "Bruno Fictif",
      objet: "Pour Bruno seulement",
      corpsTexte: "Texte réservé à Bruno.",
    }),
  };
  base = dossierEnMemoire({
    client: [fiche({ id: CLIENT, raisonSociale: "Entreprise Fictive" })],
    clientContact: [
      { id: CONTACT_ALICE, clientId: CLIENT, nom: "Alice Fictive", statut: "actif" },
      { id: CONTACT_BRUNO, clientId: CLIENT, nom: "Bruno Fictif", statut: "actif" },
    ],
    clientContactAdresse: [
      { contactId: CONTACT_ALICE, email: ALICE, nature: "pro", emailHash: h(ALICE) },
      { contactId: CONTACT_ALICE, email: ALICE_BIS, nature: "perso", emailHash: h(ALICE_BIS) },
      { contactId: CONTACT_BRUNO, email: BRUNO, nature: "pro", emailHash: h(BRUNO) },
    ],
    emailManuel: Object.values(courriels),
    emailManuelPieceJointe: [
      piece(courriels.alice1["id"], "r2/pj/1"),
      piece(courriels.alice2["id"], "r2/pj/2", "photo-alice.png"),
      piece(courriels.bruno["id"], "r2/pj/3", "bruno.pdf"),
    ],
  });
  d.client = avecRelationsDeLaFiche(base.client as Record<string, unknown>);
});

/**
 * La base en mémoire ne rejoue pas les `select` imbriqués : `clientContact.findMany` de l'export
 * demande `client` et `adresses`. On les fournit depuis les tables, le reste reste la base en mémoire.
 */
function avecRelationsDeLaFiche(client: Record<string, unknown>): unknown {
  const tables = (): Record<string, Ligne[]> => base.tables as Record<string, Ligne[]>;
  return new Proxy(client, {
    get(cible, nom: string) {
      if (nom !== "clientContact") return cible[nom];
      return {
        ...(cible[nom] as object),
        findMany: async (a: { where: { id: { in: string[] } } }) =>
          (tables()["clientContact"] ?? [])
            .filter((c) => a.where.id.in.includes(c["id"] as string))
            .map((c) => ({
              ...c,
              fonction: null,
              telephone: null,
              partiLe: null,
              oppositionIaLe: null,
              client: { raisonSociale: "Entreprise Fictive" },
              adresses: (tables()["clientContactAdresse"] ?? []).filter(
                (x) => x["contactId"] === c["id"],
              ),
            })),
      };
    },
  });
}

describe("export art. 15 des e-mails écrits à la main", () => {
  it("retrouvé par `contact_id` ET par la seule empreinte ; l'e-mail d'une autre personne est absent", async () => {
    const r = await exporterDossierClientPour(ALICE);
    expect(r.avertissements).toEqual([]);
    expect(r.emailsEcritsALaMain.map((e) => e.objet).sort()).toEqual([
      "Autre adresse", // par `contact_id` seul
      "Avant votre rendez-vous", // par l'empreinte seule (CalendlyEvent)
      "Brouillon",
      "Compte rendu", // par les deux
    ]);
    const texte = JSON.stringify(r.emailsEcritsALaMain);
    expect(texte).not.toContain("Pour Bruno seulement");
    expect(texte).not.toContain("Texte réservé à Bruno");
    expect(texte).not.toContain("bruno.pdf");
  });

  it("un e-mail adressé à sa 2e adresse (autre empreinte de la même fiche personne) est rendu aussi", async () => {
    // Elle demande avec ALICE ; la ligne vise ALICE_BIS : l'empreinte est celle d'une adresse de SA fiche.
    (courriels.alice2["destinataireHash"] as string) = h(ALICE_BIS);
    const r = await exporterDossierClientPour(ALICE);
    expect(r.emailsEcritsALaMain.map((e) => e.objet)).toContain("Avant votre rendez-vous");
  });

  it("rend dates, statut, objet, texte (source pour un brouillon) et nom, format, taille des pièces", async () => {
    const r = await exporterDossierClientPour(ALICE);
    const parObjet = new Map(r.emailsEcritsALaMain.map((e) => [e.objet, e]));
    expect(parObjet.get("Compte rendu")).toMatchObject({
      statut: "envoye",
      creeLe: new Date("2026-11-01T10:00:00Z"),
      envoyeLe: new Date("2026-11-01T10:05:00Z"),
      corps: "Bonjour Alice, voici le texte rendu.",
      piecesJointes: [{ nomFichier: "devis-alice.pdf", format: "pdf", tailleOctets: 1234 }],
    });
    expect(parObjet.get("Brouillon")).toMatchObject({
      statut: "brouillon",
      corps: "Texte source du brouillon.",
      piecesJointes: [],
    });
  });

  it("jamais l'adresse d'un tiers (ni son chiffré, ni son empreinte, ni la clé de stockage)", async () => {
    const r = await exporterDossierClientPour(ALICE);
    const texte = JSON.stringify(r.emailsEcritsALaMain);
    for (const interdit of [BRUNO, h(BRUNO), "enc:", "r2/pj/", "destinataire"]) {
      expect(texte).not.toContain(interdit);
    }
    for (const e of r.emailsEcritsALaMain) {
      expect(Object.keys(e).sort()).toEqual([
        "corps",
        "creeLe",
        "envoyeLe",
        "objet",
        "piecesJointes",
        "statut",
      ]);
    }
  });

  it("une personne sans aucun e-mail manuel reçoit une liste vide", async () => {
    const r = await exporterDossierClientPour("inconnue@exemple-fictif.fr");
    expect(r.emailsEcritsALaMain).toEqual([]);
  });

  it("un e-mail neutralisé est rendu sans contenu (objet effacé, corps nul)", async () => {
    await neutraliserEmailsManuelsPour(ALICE);
    const r = await exporterDossierClientPour(ALICE);
    const effaces = r.emailsEcritsALaMain.filter((e) => e.objet === OBJET_EMAIL_MANUEL_EFFACE);
    expect(effaces.length).toBeGreaterThan(0);
    expect(effaces.every((e) => e.corps === null || e.corps === "")).toBe(true);
  });
});

describe("neutralisation (geste manuel du fondateur)", () => {
  const lignes = (): Ligne[] => base.tables["emailManuel"] ?? [];
  const parObjetOuId = (cle: unknown): Ligne => lignes().find((l) => l["id"] === cle) as Ligne;

  it("nombre de lignes inchangé ; pseudonyme déchiffrable ; empreinte gardée ; contenu vidé", async () => {
    const avant = lignes().length;
    const r = await neutraliserEmailsManuelsPour(ALICE);
    expect(lignes()).toHaveLength(avant);
    // Par l'empreinte : alice1, alice2 et le brouillon. `alice3` vise une autre empreinte.
    expect(r.emailsNeutralises).toBe(3);
    for (const k of ["alice1", "alice2"] as const) {
      const l = parObjetOuId(courriels[k]["id"]);
      expect(decryptPii(l["destinataireChiffre"] as string)).toBe(
        `erased:${h(ALICE)}@erased.local`,
      );
      expect(l["destinataireHash"]).toBe(h(ALICE));
      expect(l).toMatchObject({
        destinataireNom: null,
        objet: OBJET_EMAIL_MANUEL_EFFACE,
        corpsSource: "",
        corpsHtml: "",
        corpsTexte: null,
      });
    }
    // Le texte d'origine n'est plus nulle part dans les lignes de SON empreinte (le brouillon compris).
    const siennes = JSON.stringify(lignes().filter((l) => l["destinataireHash"] === h(ALICE)));
    expect(siennes).not.toContain("Bonjour Alice");
    expect(siennes).not.toContain("Texte source du brouillon");
    expect(siennes).not.toContain(ALICE);
  });

  it("le rendu reste non NULL pour une ligne partie (CHECK `rendu_si_parti`)", async () => {
    await neutraliserEmailsManuelsPour(ALICE);
    for (const l of lignes().filter(
      (x) => x["statut"] !== "brouillon" && x["destinataireHash"] === h(ALICE),
    )) {
      expect(l["corpsHtml"]).not.toBeNull();
    }
  });

  it("pièces jointes : lignes gardées, nom neutralisé ; clés R2 rendues, `deleteFromR2` jamais appelé", async () => {
    const avant = (base.tables["emailManuelPieceJointe"] ?? []).length;
    const r = await neutraliserEmailsManuelsPour(ALICE);
    const pj = base.tables["emailManuelPieceJointe"] ?? [];
    expect(pj).toHaveLength(avant);
    expect(r.piecesJointesNeutralisees).toBe(2);
    expect([...r.clesStockage].sort()).toEqual(["r2/pj/1", "r2/pj/2"]);
    const siennes = pj.filter((p) => ["r2/pj/1", "r2/pj/2"].includes(p["cleStockage"] as string));
    expect(siennes.every((p) => p["nomFichier"] === NOM_PIECE_JOINTE_EFFACE)).toBe(true);
    // La clé, le format, la taille restent : la ligne décrit toujours l'objet R2 conservé.
    expect(siennes.map((p) => p["tailleOctets"])).toEqual([1234, 1234]);
    expect(d.supprimerR2).not.toHaveBeenCalled();
  });

  it("stagiaire : le contenu est gardé, seule l'adresse est masquée", async () => {
    const stagiaire = email({
      entiteType: "Trainee",
      entiteId: "stagiaire-1",
      clientId: null,
      contactId: null,
      objet: `Convocation de ${ALICE}`,
      corpsSource: `Écrivez à ${ALICE} pour confirmer.`,
      corpsHtml: `<p>Lien : <a href="mailto:${encodeURIComponent(ALICE)}">${ALICE}</a></p>`,
      corpsTexte: `Écrivez à ${ALICE.toUpperCase()}.`,
    });
    base.tables["emailManuel"]?.push(stagiaire);
    await neutraliserEmailsManuelsPour(ALICE);
    const l = parObjetOuId(stagiaire["id"]);
    expect(decryptPii(l["destinataireChiffre"] as string)).toBe(`erased:${h(ALICE)}@erased.local`);
    expect(l["destinataireNom"]).toBe("Alice Fictive");
    expect(l["objet"]).toBe("Convocation de [adresse masquée]");
    expect(l["corpsSource"]).toBe("Écrivez à [adresse masquée] pour confirmer.");
    expect(l["corpsTexte"]).toBe("Écrivez à [adresse masquée].");
    expect(l["corpsHtml"]).toContain("Lien :");
    expect(JSON.stringify(l).toLowerCase()).not.toContain("alice.fictive");
    expect(JSON.stringify(l).toLowerCase()).not.toContain("alice.fictive%40");
  });

  it("une autre personne n'est pas touchée (lignes et pièces)", async () => {
    const brunoAvant = structuredClone(parObjetOuId(courriels.bruno["id"]));
    const alice3Avant = structuredClone(parObjetOuId(courriels.alice3["id"]));
    const pjBrunoAvant = structuredClone(
      (base.tables["emailManuelPieceJointe"] ?? []).find((p) => p["cleStockage"] === "r2/pj/3"),
    );
    await neutraliserEmailsManuelsPour(ALICE);
    expect(parObjetOuId(courriels.bruno["id"])).toEqual(brunoAvant);
    // Ligne `contact_id` d'Alice mais d'une AUTRE empreinte : traitée avec cette adresse-là.
    expect(parObjetOuId(courriels.alice3["id"])).toEqual(alice3Avant);
    expect(
      (base.tables["emailManuelPieceJointe"] ?? []).find((p) => p["cleStockage"] === "r2/pj/3"),
    ).toEqual(pjBrunoAvant);
  });

  it("idempotente : même nombre, même pseudonyme, même état", async () => {
    const r1 = await neutraliserEmailsManuelsPour(ALICE);
    const apres1 = lignes().map((l) => ({
      ...l,
      destinataireChiffre: decryptPii(l["destinataireChiffre"] as string),
    }));
    const r2 = await neutraliserEmailsManuelsPour(ALICE);
    const apres2 = lignes().map((l) => ({
      ...l,
      destinataireChiffre: decryptPii(l["destinataireChiffre"] as string),
    }));
    expect(r2).toEqual(r1);
    expect(apres2).toEqual(apres1);
    expect(d.supprimerR2).not.toHaveBeenCalled();
  });

  it("par la 2e adresse de la personne : ses lignes de cette empreinte seulement", async () => {
    const r = await neutraliserEmailsManuelsPour("adresse.inconnue@exemple-fictif.fr");
    expect(r.emailsNeutralises).toBe(1);
    expect(parObjetOuId(courriels.alice3["id"])["objet"]).toBe(OBJET_EMAIL_MANUEL_EFFACE);
    expect(parObjetOuId(courriels.alice1["id"])["objet"]).toBe("Compte rendu");
  });

  it("adresse vide ou inconnue : rien n'est touché", async () => {
    const avant = structuredClone(lignes());
    expect(await neutraliserEmailsManuelsPour("")).toEqual({
      emailsNeutralises: 0,
      piecesJointesNeutralisees: 0,
      clesStockage: [],
    });
    expect(
      (await neutraliserEmailsManuelsPour("personne@exemple-fictif.fr")).emailsNeutralises,
    ).toBe(0);
    expect(lignes()).toEqual(avant);
  });
});

describe("purge du pilote : refus lisible quand un e-mail manuel existe", () => {
  function pilote(manuels: Ligne[]) {
    const fictif = fiche({ raisonSociale: "Atelier Test Fictif" });
    const contact = id(7);
    const b = dossierEnMemoire({
      client: [fictif],
      clientTestInterne: [{ clientId: fictif["id"] }],
      clientContact: [{ id: contact, clientId: fictif["id"], nom: "Testeur" }],
      projet: [{ id: id(8), clientId: fictif["id"], numero: "AXI-PRJ-2026-901", titre: "p" }],
      emailManuel: manuels.map((m) => ({
        ...m,
        clientId: m["clientId"] === "FICHE" ? fictif["id"] : (m["clientId"] ?? null),
        contactId: m["contactId"] === "CONTACT" ? contact : (m["contactId"] ?? null),
      })),
    });
    d.client = b.client;
    return b;
  }
  const comptes = (b: ReturnType<typeof dossierEnMemoire>) =>
    Object.fromEntries(Object.entries(b.tables).map(([k, v]) => [k, v.length]));

  it.each([
    ["rattaché à la fiche", { clientId: "FICHE" }],
    ["rattaché à une personne de la fiche", { contactId: "CONTACT" }],
  ])("un e-mail manuel %s : erreur lisible, tout est annulé", async (_quoi, rattache) => {
    const b = pilote([email(rattache)]);
    const avant = comptes(b);
    await expect(purgerPilote()).rejects.toThrow(
      "purge refusée : 1 e-mail(s) écrit(s) à la main, à traiter par le fondateur",
    );
    expect(comptes(b)).toEqual(avant);
    expect(b.tables["emailManuel"]).toHaveLength(1);
    expect(b.tables["effacementJournal"] ?? []).toHaveLength(0);
  });

  it("un e-mail manuel d'une VRAIE fiche ne bloque pas : la purge se comporte comme avant", async () => {
    const b = pilote([email({ clientId: CLIENT, contactId: CONTACT_ALICE })]);
    const r = await purgerPilote();
    expect(r).toMatchObject({ personnes: 1, projets: 1 });
    expect(b.tables["emailManuel"]).toHaveLength(1);
  });
});
