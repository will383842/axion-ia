/**
 * sendDevisAction — devis à formules : l'envoi est possible (interrupteur allumé, offre valide),
 * mais jamais sans pièce à signer, ni pour une formule à 0 € sans mensualité.
 * Devis classique : comportement inchangé (refus à 0,00 € HT).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { offreFictive as offreFictiveBrute } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import {
  MSG_FORMULES_PARTICULIER,
  MSG_INDEMNITE_SORTIE,
} from "@/server/qualiopi/devis/regles-commerciales";

/** D4 : indemnité de sortie à zéro pour un nouveau devis (la fixture porte 5000, surchargée ici). */
const offreFictive = () => {
  const o = offreFictiveBrute();
  return { ...o, abonnement: { ...o.abonnement!, indemniteSortieTauxBps: 0 } };
};

const findUnique = vi.fn();
const txDevisUpdateMany = vi.fn();
const generateDocument = vi.fn();
const creerToken = vi.fn();
const enqueueEmail = vi.fn();
const formulesActives = vi.fn();
const logActivity = vi.fn();
const outboxUpdateMany = vi.fn();
const LIGNE_CORBEILLE = {
  template: "devis-envoi",
  payload: { signatureUrl: "https://axion-ia.com/portail/signer/JETON-SECRET-123", numero: "X" },
};
const MAJ = new Date("2026-11-01T10:00:00Z");

// B1 : verrou + relecture du devis + écriture « envoye » gardée, tous DANS la transaction.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      updateMany: (...a: unknown[]) => outboxUpdateMany(...a),
      findUnique: async () => LIGNE_CORBEILLE,
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: async () => [{ locked: true }],
        emailOutbox: { findFirst: async () => null },
        devis: {
          findUnique: (...a: unknown[]) => findUnique(...a),
          updateMany: (...a: unknown[]) => txDevisUpdateMany(...a),
          update: vi.fn(),
        },
        client: { updateMany: vi.fn() },
        documentSignatureToken: { updateMany: vi.fn() },
      }),
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1" })),
  requireHabilitation: vi.fn(async () => ({ userId: "adm-1" })),
  logQualiopiActivity: (...a: unknown[]) => logActivity(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: (...a: unknown[]) => formulesActives(...a),
}));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  // Comme le vrai module : le booléen déjà calculé par l'envoi est repris tel quel.
  lireContextePdfDevis: async (formules: boolean) => ({
    identite: { raisonSociale: "Axion", site: "https://axion-ia.com" },
    regimeTva: "assujetti",
    tauxStandard: 20,
    certificationObtenue: false,
    formulesActives: formules,
  }),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => generateDocument(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => creerToken(...a),
  revoquerTokensDocument: vi.fn(async () => 0),
  TokenDocumentError: class extends Error {
    motif = "x";
  },
}));
// Ce fichier éprouve le chemin « auto » ; le mode « validation » est dans
// `__tests__/devis-premier-envoi-a-l-approbation.spec.ts`.
vi.mock("@/server/email/outbox-service", () => ({ resoudreMode: async () => "auto" }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: vi.fn(),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => undefined) }));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));

import { sendDevisAction } from "./devis";

const ID = "11111111-1111-4111-8111-111111111111";

function devis(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: "AXI-DEV-2026-001",
    clientId: "c1",
    statut: "brouillon",
    // Version lue : l'écriture « envoye » est gardée dessus.
    updatedAt: MAJ,
    lignes: [],
    activite: null,
    refClient: null,
    replacesDevisId: null,
    offre: offreFictive(),
    offreSha256: "a".repeat(64),
    replacesDevis: null,
    financementSuggere: null,
    montantTotalHtCents: 0,
    montantOpcoEstimeCents: null,
    resteAChargeCents: null,
    dateValidite: new Date("2026-12-31T00:00:00Z"),
    client: {
      type: "entreprise",
      raisonSociale: "Client SA",
      siret: null,
      adresse: null,
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      contactNom: "Camille",
      contactEmail: "client@example.test",
      contactFonction: null,
    },
    ...over,
  };
}

/** Offre à une seule formule « achat », à 0 € HT, sans abonnement donc sans mensualité. */
function offreAchatAZero() {
  const o = offreFictive();
  const { abonnement: _a, ...reste } = o;
  return {
    ...reste,
    formulesProposees: ["achat"],
    achat: {
      ...o.achat,
      lignes: [{ libelle: "Ligne offerte", quantite: 1, prixHtCents: 0, tauxTvaBps: 2000 }],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  formulesActives.mockResolvedValue(true);
  findUnique.mockResolvedValue(devis());
  generateDocument.mockResolvedValue({ id: "doc-1", numero: "AXI-DEV-2026-001" });
  creerToken.mockResolvedValue({ token: "tok" });
  enqueueEmail.mockResolvedValue({ enqueued: true });
  txDevisUpdateMany.mockResolvedValue({ count: 1 });
});

describe("sendDevisAction — devis à formules", () => {
  it("interrupteur éteint + offre : refus, aucune écriture ni rendu", async () => {
    formulesActives.mockResolvedValue(false);
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("2 formules, total de lignes à 0 : l'envoi passe (envoyé, pièce posée, lien émis)", async () => {
    const r = await sendDevisAction(ID);
    expect("data" in r).toBe(true);
    expect(txDevisUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID, statut: "brouillon", updatedAt: MAJ },
        data: expect.objectContaining({ statut: "envoye", documentGenereId: "doc-1" }),
      }),
    );
    expect(creerToken).toHaveBeenCalledOnce();
    if ("data" in r) expect(r.data.signatureCreee).toBe(true);
  });

  it("formule à 0 € HT sans mensualité : refus avant tout rendu", async () => {
    findUnique.mockResolvedValue(devis({ offre: offreAchatAZero() }));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
  });

  it("échec du rendu PDF : refus, aucune écriture « envoye », aucun e-mail", async () => {
    generateDocument.mockRejectedValue(new Error("rendu KO"));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
    expect(creerToken).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("pièce sans identifiant : refus, aucune écriture « envoye », aucun e-mail", async () => {
    generateDocument.mockResolvedValue({ id: null, numero: "AXI-DEV-2026-001" });
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

/** Offre abonnement seul, mise en service à 0 € : le total est 0, seules les périodes comptent. */
function offreAboSeul(periodes: { mois: number; remiseBps: number }[]) {
  const o = offreFictive();
  const { achat: _a, ...reste } = o;
  return {
    ...reste,
    formulesProposees: ["abonnement"],
    abonnement: {
      ...o.abonnement!,
      miseEnServiceLignes: [
        { libelle: "Mise en service offerte", quantite: 1, prixHtCents: 0, tauxTvaBps: 2000 },
      ],
      periodes,
    },
  };
}

describe("sendDevisAction — devis à formules : gardes complémentaires", () => {
  it("lien de signature non créé : refus, aucune écriture « envoye », aucun e-mail", async () => {
    creerToken.mockRejectedValue(new Error("panne"));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("lien de signature");
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("sans e-mail de contact : refus avant tout rendu", async () => {
    const d0 = devis();
    findUnique.mockResolvedValue({ ...d0, client: { ...d0.client, contactEmail: null } });
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("l'interrupteur est lu UNE seule fois, pour le client du devis, et sa valeur sert au PDF", async () => {
    const r = await sendDevisAction(ID);
    expect("data" in r).toBe(true);
    expect(formulesActives).toHaveBeenCalledTimes(1);
    expect(formulesActives).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ clientId: "c1" }),
    );
  });

  it("garde refusée (essai, vrai client) : aucun PDF ni jeton, message « formules_eteintes »", async () => {
    formulesActives.mockResolvedValue(false);
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(formulesActives).toHaveBeenCalledTimes(1);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(creerToken).not.toHaveBeenCalled();
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
  });

  it("rendu PDF en échec : message dédié « n'a pas pu être créé »", async () => {
    generateDocument.mockRejectedValue(new Error("rendu KO"));
    const r = await sendDevisAction(ID);
    if ("error" in r) expect(r.error).toContain("n'a pas pu être créé");
    else throw new Error("refus attendu");
  });

  it("pièce sans identifiant : traitée comme un PDF raté (message dédié)", async () => {
    generateDocument.mockResolvedValue({ id: null, numero: "AXI-DEV-2026-001" });
    const r = await sendDevisAction(ID);
    if ("error" in r) expect(r.error).toContain("n'a pas pu être créé");
    else throw new Error("refus attendu");
  });

  it("offre illisible : le message de l'offre remonte, pas « PDF non généré »", async () => {
    findUnique.mockResolvedValue(devis({ offre: { v: 99 } }));
    const r = await sendDevisAction(ID);
    if ("error" in r) {
      expect(r.error).toContain("Offre du devis invalide");
      expect(r.error).not.toContain("PDF");
    } else throw new Error("refus attendu");
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
  });

  it("remise 100 % : une période à 0 €/mois parmi des périodes payantes est refusée", async () => {
    findUnique.mockResolvedValue(
      devis({
        offre: offreAboSeul([
          { mois: 1, remiseBps: 10000 },
          { mois: 12, remiseBps: 0 },
        ]),
      }),
    );
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(generateDocument).not.toHaveBeenCalled();
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
  });

  it("total 0 et toutes périodes payantes : l'envoi passe", async () => {
    findUnique.mockResolvedValue(devis({ offre: offreAboSeul([{ mois: 12, remiseBps: 0 }]) }));
    const r = await sendDevisAction(ID);
    expect("data" in r).toBe(true);
  });
});

describe("sendDevisAction — devis à formules : le courriel ne part pas", () => {
  it("adresse retenue : refus sans « Remis en main propre », aucune écriture, lien révoqué", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: false, retenu: "desabonne" });
    const r = await sendDevisAction(ID);
    if (!("error" in r)) throw new Error("refus attendu");
    expect(r.error).toContain("L'adresse du client est bloquée (désabonnement)");
    expect(r.error).not.toContain("Remis en main propre");
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
  });

  it("corbeille indisponible : refus, aucune écriture « envoye »", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: false, corbeilleIndisponible: true });
    const r = await sendDevisAction(ID);
    if (!("error" in r)) throw new Error("refus attendu");
    expect(r.error).toContain("corbeille « E-mails à valider » est indisponible");
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
  });

  it("courriel garé en mode auto (règle changée) : refus sans écriture, la ligne de corbeille passe à « refuse »", async () => {
    enqueueEmail.mockResolvedValue({
      enqueued: false,
      garePourValidation: true,
      outboxId: "ob-1",
    });
    const r = await sendDevisAction(ID);
    if (!("error" in r)) throw new Error("refus attendu");
    expect(r.error).toContain("La règle d'envoi a changé");
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
    expect(outboxUpdateMany).toHaveBeenCalledWith({
      where: { id: "ob-1", statut: "a_valider" },
      data: expect.objectContaining({ statut: "refuse" }),
    });
    const ecrit = JSON.stringify(outboxUpdateMany.mock.calls[0]?.[0].data);
    expect(ecrit).not.toContain("JETON-SECRET");
    expect(ecrit).toContain("[masqué]");
  });
});

describe("sendDevisAction — devis classique (inchangé)", () => {
  it("à 0,00 € HT : refus", async () => {
    findUnique.mockResolvedValue(devis({ offre: null, montantTotalHtCents: 0 }));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("0,00");
    expect(generateDocument).not.toHaveBeenCalled();
  });

  it("échec du rendu PDF : refus (fin du fail-soft des devis classiques), rien n'est écrit", async () => {
    findUnique.mockResolvedValue(
      devis({
        offre: null,
        montantTotalHtCents: 1000,
        lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 1000 }],
      }),
    );
    generateDocument.mockRejectedValue(new Error("rendu KO"));
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("sendDevisAction — la salutation de l'e-mail (B4)", () => {
  function payloadEnvoye(): Record<string, unknown> {
    return enqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
  }
  function avecClient(extra: Record<string, unknown>) {
    const d0 = devis();
    findUnique.mockResolvedValue({ ...d0, client: { ...d0.client, ...extra } });
  }

  it("civilité + nom de famille : « Bonjour Madame Dupont, »", async () => {
    avecClient({ contactCivilite: "madame", contactPrenom: "Léa", contactNomFamille: "Dupont" });
    await sendDevisAction(ID);
    expect(payloadEnvoye()["salutation"]).toEqual({ civilite: "madame", nomFamille: "Dupont" });
    expect(payloadEnvoye()["clientNom"]).toBe("Madame Dupont");
  });

  it("prénom seul : { prenom }", async () => {
    avecClient({ contactPrenom: "Léa" });
    await sendDevisAction(ID);
    expect(payloadEnvoye()["salutation"]).toEqual({ prenom: "Léa" });
  });

  it("aucune identité fiable : jamais le nom complet de contactNom", async () => {
    await sendDevisAction(ID);
    expect(payloadEnvoye()["clientNom"]).toBe("");
    expect(JSON.stringify(payloadEnvoye())).not.toContain("Camille");
  });
});

describe("sendDevisAction — règles commerciales D4/D6 (refus avant PDF, jeton et courriel)", () => {
  function rienNeSort() {
    expect(generateDocument).not.toHaveBeenCalled();
    expect(creerToken).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(txDevisUpdateMany).not.toHaveBeenCalled();
  }

  it("D6 : devis à formules d'un particulier refusé", async () => {
    const d0 = devis();
    findUnique.mockResolvedValue({ ...d0, client: { ...d0.client, type: "particulier" } });
    const r = await sendDevisAction(ID);
    expect(r).toEqual({ error: MSG_FORMULES_PARTICULIER });
    rienNeSort();
  });

  it("D4 : taux d'indemnité 5000 refusé", async () => {
    findUnique.mockResolvedValue(devis({ offre: offreFictiveBrute() }));
    const r = await sendDevisAction(ID);
    expect(r).toEqual({ error: MSG_INDEMNITE_SORTIE });
    rienNeSort();
  });
});
