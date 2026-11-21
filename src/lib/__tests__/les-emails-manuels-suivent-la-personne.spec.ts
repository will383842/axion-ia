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
 *   3. PURGE DU PILOTE : une personne d'essai visée par un e-mail manuel est GARDÉE et signalée,
 *      la purge ne lève jamais ; un e-mail rattaché à la seule fiche ne change rien.
 *
 * Mutations qui font rougir : relire l'export sans la branche `destinataireHash` ou sans la branche
 * `contactId` ; remplacer `updateMany` par `deleteMany` dans la neutralisation ; appeler
 * `deleteFromR2` ; remettre le refus dans `supprimerDonneesPilote` ; ne plus basculer `en_file`/`echec` en `retenu` ;
 * ne plus journaliser ; vider `rattachesAutreAdresse` sans l'option.
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
  MOTIF_EMAIL_MANUEL_NEUTRALISE,
  NOM_PIECE_JOINTE_EFFACE,
  OBJET_EMAIL_MANUEL_EFFACE,
  purgerPilote,
} from "../rgpd-erase";
import { hashEmailForLookup } from "../security/email-hash";
import { prefixesStockageEmail } from "../email-manuel/pieces-jointes";

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

  it("corpsTexte nul avec un rendu HTML présent : l'export rend le texte source ; jamais le HTML", async () => {
    courriels.alice1["corpsTexte"] = null;
    const r = await exporterDossierClientPour(ALICE);
    const l = r.emailsEcritsALaMain.find((e) => e.objet === "Compte rendu");
    expect(l?.corps).toBe("Bonjour Alice, voici le texte source.");
  });

  it("un e-mail neutralisé est rendu sans contenu (objet effacé, corps nul)", async () => {
    await neutraliserEmailsManuelsPour(ALICE);
    const r = await exporterDossierClientPour(ALICE);
    const effaces = r.emailsEcritsALaMain.filter((e) => e.objet === OBJET_EMAIL_MANUEL_EFFACE);
    expect(effaces.length).toBeGreaterThan(0);
    expect(effaces.every((e) => e.corps === null)).toBe(true);
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

  it("idempotente : une seconde passe ne modifie ni ne journalise rien", async () => {
    const r1 = await neutraliserEmailsManuelsPour(ALICE);
    expect(r1.emailsNeutralises).toBe(3);
    const apres1 = structuredClone(lignes());
    const journal1 = (base.tables["effacementJournal"] ?? []).length;
    const r2 = await neutraliserEmailsManuelsPour(ALICE);
    expect(r2.emailsNeutralises).toBe(0);
    expect(r2.clesStockage).toEqual(r1.clesStockage);
    expect(lignes()).toEqual(apres1);
    expect((base.tables["effacementJournal"] ?? []).length).toBe(journal1);
    expect(d.supprimerR2).not.toHaveBeenCalled();
  });

  it("(a) ligne non stagiaire : motif, in_reply_to, references vidés, id_relais masqué ; stagiaire : masqués, non vidés", async () => {
    const commun = {
      motif: `retenu pour ${ALICE}`,
      inReplyTo: `<fil-${ALICE}@x>`,
      referencesEntete: `<a-${ALICE}@x>`,
      idRelais: `relais-${ALICE}`,
    };
    const simple = email({ ...commun, statut: "envoye" });
    const stagiaire = email({ ...commun, entiteType: "Trainee", entiteId: "s1", statut: "envoye" });
    base.tables["emailManuel"]?.push(simple, stagiaire);
    await neutraliserEmailsManuelsPour(ALICE);
    expect(parObjetOuId(simple["id"])).toMatchObject({
      motif: null,
      inReplyTo: null,
      referencesEntete: null,
      idRelais: "relais-[adresse masquée]",
    });
    const t = parObjetOuId(stagiaire["id"]);
    expect(t["motif"]).toBe("retenu pour [adresse masquée]");
    expect(t["inReplyTo"]).toBe("<fil-[adresse masquée]@x>");
    expect(t["referencesEntete"]).toBe("<a-[adresse masquée]@x>");
    expect(t["idRelais"]).toBe("relais-[adresse masquée]");
  });

  it("(b) `en_file` et `echec` passent `retenu` avec le motif ; un brouillon reste brouillon ; le rendu reste non NULL", async () => {
    const enFile = email({ statut: "en_file", envoyeLe: null });
    const echec = email({ statut: "echec", envoyeLe: null });
    base.tables["emailManuel"]?.push(enFile, echec);
    await neutraliserEmailsManuelsPour(ALICE);
    for (const l of [enFile, echec]) {
      expect(parObjetOuId(l["id"])).toMatchObject({
        statut: "retenu",
        motif: MOTIF_EMAIL_MANUEL_NEUTRALISE,
        corpsHtml: "",
      });
    }
    expect(parObjetOuId(courriels.brouillon["id"])["statut"]).toBe("brouillon");
    expect(parObjetOuId(courriels.alice1["id"])["statut"]).toBe("envoye");
  });

  it("(c) une ligne de journal `emails_manuels` / art17 par ligne modifiée", async () => {
    await neutraliserEmailsManuelsPour(ALICE);
    const journal = base.tables["effacementJournal"] ?? [];
    expect(
      journal.every((j) => j["tableCible"] === "emails_manuels" && j["motif"] === "art17"),
    ).toBe(true);
    expect(journal.map((j) => j["ligneId"]).sort()).toEqual(
      [courriels.alice1, courriels.alice2, courriels.brouillon]
        .map((l) => l["id"] as string)
        .sort(),
    );
  });

  it("(d) un e-mail rattaché à la fiche mais envoyé à une autre adresse est listé et laissé intact", async () => {
    const avant = structuredClone(parObjetOuId(courriels.alice3["id"]));
    const r = await neutraliserEmailsManuelsPour(ALICE);
    expect(r.rattachesAutreAdresse).toEqual([courriels.alice3["id"]]);
    expect(parObjetOuId(courriels.alice3["id"])).toEqual(avant);
  });

  it("(d) avec l'option : contenu vidé, adresse du tiers gardée, journal `<id>:contenu`", async () => {
    const tiers = email({
      contactId: CONTACT_ALICE,
      destinataireChiffre: encryptPii("assistante@exemple-fictif.fr"),
      destinataireHash: h("assistante@exemple-fictif.fr"),
      destinataireNom: "L'assistante",
      statut: "en_file",
      envoyeLe: null,
      objet: "Pour Alice via son assistante",
    });
    base.tables["emailManuel"]?.push(tiers);
    const r = await neutraliserEmailsManuelsPour(ALICE, { aussiRattachesAutreAdresse: true });
    expect(r.rattachesAutreAdresse).toEqual(expect.arrayContaining([tiers["id"]]));
    const l = parObjetOuId(tiers["id"]);
    expect(l).toMatchObject({
      objet: OBJET_EMAIL_MANUEL_EFFACE,
      corpsSource: "",
      corpsTexte: null,
      destinataireNom: "L'assistante",
      statut: "retenu",
      motif: MOTIF_EMAIL_MANUEL_NEUTRALISE,
    });
    expect(decryptPii(l["destinataireChiffre"] as string)).toBe("assistante@exemple-fictif.fr");
    expect((base.tables["effacementJournal"] ?? []).map((j) => j["ligneId"])).toContain(
      `${tiers["id"] as string}:contenu`,
    );
    expect(d.supprimerR2).not.toHaveBeenCalled();
  });

  it("🔴 écrit depuis la fiche de A, envoyé à B : A puis B neutralise aussi l'adresse et le nom de B ; seconde passe sur B sans écriture ni journal", async () => {
    const TIERS = "assistante@exemple-fictif.fr";
    const tiers = email({
      id: id(7),
      contactId: CONTACT_ALICE,
      destinataireChiffre: encryptPii(TIERS),
      destinataireHash: h(TIERS),
      destinataireNom: "L'assistante",
      statut: "en_file",
      envoyeLe: null,
      objet: "Pour Alice via son assistante",
    });
    base.tables["emailManuel"]?.push(tiers);
    base.tables["emailManuelPieceJointe"]?.push(
      piece(tiers["id"], "r2/pj/tiers", "devis-alice-pour-assistante.pdf"),
    );
    // 1. Effacement de A avec l'option : contenu vidé, adresse et nom de B gardés ; pièces : nom neutralisé.
    const rA = await neutraliserEmailsManuelsPour(ALICE, { aussiRattachesAutreAdresse: true });
    expect(rA.clesStockage).toContain("r2/pj/tiers");
    expect(
      (base.tables["emailManuelPieceJointe"] ?? []).find((x) => x["cleStockage"] === "r2/pj/tiers"),
    ).toMatchObject({ nomFichier: NOM_PIECE_JOINTE_EFFACE });
    expect(parObjetOuId(tiers["id"])).toMatchObject({
      objet: OBJET_EMAIL_MANUEL_EFFACE,
      destinataireNom: "L'assistante",
    });
    // 2. Plus tard, B demande l'effacement : la ligne n'est PAS sautée.
    const rB = await neutraliserEmailsManuelsPour(TIERS);
    expect(rB.emailsNeutralises).toBe(1);
    const l = parObjetOuId(tiers["id"]);
    expect(l["destinataireNom"]).toBeNull();
    expect(decryptPii(l["destinataireChiffre"] as string)).toBe(`erased:${h(TIERS)}@erased.local`);
    expect(
      (base.tables["effacementJournal"] ?? []).filter((j) => j["ligneId"] === tiers["id"]),
    ).toHaveLength(1);
    // 3. Seconde passe sur B : ni écriture ni journal.
    const avant = structuredClone(lignes());
    const journal1 = (base.tables["effacementJournal"] ?? []).length;
    expect((await neutraliserEmailsManuelsPour(TIERS)).emailsNeutralises).toBe(0);
    expect(lignes()).toEqual(avant);
    expect((base.tables["effacementJournal"] ?? []).length).toBe(journal1);
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
      prefixesStockage: [],
      rattachesAutreAdresse: [],
    });
    expect(
      (await neutraliserEmailsManuelsPour("personne@exemple-fictif.fr")).emailsNeutralises,
    ).toBe(0);
    expect(lignes()).toEqual(avant);
  });
});

describe("dossiers de stockage rendus par la neutralisation (F7-S1)", () => {
  const lignes = (): Ligne[] => base.tables["emailManuel"] ?? [];
  const pieces = (): Ligne[] => base.tables["emailManuelPieceJointe"] ?? [];
  const idDe = (k: keyof typeof courriels): string => courriels[k]["id"] as string;

  function ajouterTiers(): string {
    const TIERS = "assistante@exemple-fictif.fr";
    const tiers = email({
      id: id(7),
      contactId: CONTACT_ALICE,
      destinataireChiffre: encryptPii(TIERS),
      destinataireHash: h(TIERS),
      destinataireNom: "L'assistante",
      statut: "en_file",
      envoyeLe: null,
    });
    lignes().push(tiers);
    return tiers["id"] as string;
  }

  it("un e-mail à trois pièces (acceptée, refusée, attendue) : ses trois dossiers, et chaque clé en base en dépend", async () => {
    const alice1 = idDe("alice1");
    const [def, tmp, ref] = prefixesStockageEmail(alice1);
    const lot: Ligne[] = [
      { ...piece(alice1, `${def}a.pdf`), id: id(1), statut: "acceptee" },
      { ...piece(alice1, `${tmp}b.pdf`), id: id(2), statut: "refusee" },
      { ...piece(alice1, `${ref}c.pdf`), id: id(3), statut: "attendue" },
    ];
    pieces().push(...lot);
    const r = await neutraliserEmailsManuelsPour(ALICE);
    for (const p of prefixesStockageEmail(alice1)) expect(r.prefixesStockage).toContain(p);
    const siennes = pieces().filter((p) => p["emailManuelId"] === alice1);
    expect(siennes.length).toBeGreaterThanOrEqual(3);
    for (const p of lot) {
      expect(
        prefixesStockageEmail(alice1).some((x) => (p["cleStockage"] as string).startsWith(x)),
      ).toBe(true);
    }
    expect(d.supprimerR2).not.toHaveBeenCalled();
  });

  it("un e-mail sans aucune pièce : ses trois dossiers sont quand même rendus", async () => {
    const r = await neutraliserEmailsManuelsPour(ALICE);
    expect(pieces().some((p) => p["emailManuelId"] === idDe("alice3"))).toBe(false);
    // `alice2` n'a qu'une pièce : on vérifie un e-mail sans pièce, le brouillon.
    expect(pieces().some((p) => p["emailManuelId"] === idDe("brouillon"))).toBe(false);
    for (const p of prefixesStockageEmail(idDe("brouillon"))) {
      expect(r.prefixesStockage).toContain(p);
    }
  });

  it("l'e-mail d'une autre personne : aucun de ses dossiers", async () => {
    const r = await neutraliserEmailsManuelsPour(ALICE);
    for (const p of prefixesStockageEmail(idDe("bruno"))) {
      expect(r.prefixesStockage).not.toContain(p);
    }
  });

  it("liste triée, sans doublon, et identique à la seconde passe (avec et sans l'option)", async () => {
    ajouterTiers();
    for (const options of [{}, { aussiRattachesAutreAdresse: true }]) {
      const r1 = await neutraliserEmailsManuelsPour(ALICE, options);
      const r2 = await neutraliserEmailsManuelsPour(ALICE, options);
      expect(r1.prefixesStockage.length).toBeGreaterThan(0);
      expect(r2.prefixesStockage).toEqual(r1.prefixesStockage);
      expect(r1.prefixesStockage).toEqual([...new Set(r1.prefixesStockage)].sort());
    }
  });

  it("les dossiers d'un e-mail « rattaché autre adresse » ne sont rendus qu'avec l'option", async () => {
    const tiersId = ajouterTiers();
    const sans = await neutraliserEmailsManuelsPour(ALICE);
    for (const p of prefixesStockageEmail(tiersId)) expect(sans.prefixesStockage).not.toContain(p);
    for (const p of prefixesStockageEmail(idDe("alice3"))) {
      expect(sans.prefixesStockage).not.toContain(p);
    }
    const avec = await neutraliserEmailsManuelsPour(ALICE, { aussiRattachesAutreAdresse: true });
    for (const p of prefixesStockageEmail(tiersId)) expect(avec.prefixesStockage).toContain(p);
    // Seconde passe avec l'option : rien n'est modifié mais la liste reste complète.
    const encore = await neutraliserEmailsManuelsPour(ALICE, { aussiRattachesAutreAdresse: true });
    expect(encore.emailsNeutralises).toBe(0);
    expect(encore.prefixesStockage).toEqual(avec.prefixesStockage);
    expect(d.supprimerR2).not.toHaveBeenCalled();
  });
});

describe("purge du pilote : une personne d'essai visée par un e-mail manuel est gardée", () => {
  function pilote(manuels: Ligne[]) {
    const fictif = fiche({ raisonSociale: "Atelier Test Fictif" });
    const contact = id(7);
    const autre = id(6);
    const b = dossierEnMemoire({
      client: [fictif],
      clientTestInterne: [{ clientId: fictif["id"] }],
      clientContact: [
        { id: contact, clientId: fictif["id"], nom: "Testeur" },
        { id: autre, clientId: fictif["id"], nom: "Autre testeur" },
      ],
      projet: [{ id: id(8), clientId: fictif["id"], numero: "AXI-PRJ-2026-901", titre: "p" }],
      emailManuel: manuels.map((m) => ({
        ...m,
        clientId: m["clientId"] === "FICHE" ? fictif["id"] : (m["clientId"] ?? null),
        contactId: m["contactId"] === "CONTACT" ? contact : (m["contactId"] ?? null),
      })),
    });
    d.client = b.client;
    return { b, contact, autre };
  }

  it("un e-mail manuel vers une personne d'essai : la purge réussit, la personne est gardée et absente du journal, les autres partent", async () => {
    const { b, contact, autre } = pilote([email({ contactId: "CONTACT" })]);
    const r = await purgerPilote();
    expect(r).toMatchObject({ personnes: 1, personnesGardees: 1, projets: 1 });
    const restantes = (b.tables["clientContact"] ?? []).map((c) => c["id"]);
    expect(restantes).toEqual([contact]);
    const journalContacts = (b.tables["effacementJournal"] ?? []).filter(
      (j) => j["tableCible"] === "client_contacts",
    );
    expect(journalContacts.map((j) => j["ligneId"])).toEqual([autre]);
    // La ligne e-mail est inchangée et toujours rattachée.
    expect(b.tables["emailManuel"]).toHaveLength(1);
    expect(b.tables["emailManuel"]?.[0]?.["contactId"]).toBe(contact);
  });

  it("un e-mail rattaché seulement par `client_id` à une fiche d'essai : la purge se déroule comme avant", async () => {
    const { b } = pilote([email({ clientId: "FICHE" })]);
    const r = await purgerPilote();
    expect(r).toMatchObject({ personnes: 2, personnesGardees: 0, projets: 1 });
    expect(b.tables["clientContact"] ?? []).toHaveLength(0);
    expect(b.tables["emailManuel"]).toHaveLength(1);
  });

  it("un e-mail manuel d'une VRAIE fiche ne bloque pas : la purge se comporte comme avant", async () => {
    const { b } = pilote([email({ clientId: CLIENT, contactId: CONTACT_ALICE })]);
    const r = await purgerPilote();
    expect(r).toMatchObject({ personnes: 2, projets: 1, personnesGardees: 0 });
    expect(b.tables["emailManuel"]).toHaveLength(1);
  });
});
