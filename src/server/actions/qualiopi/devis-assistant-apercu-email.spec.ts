/**
 * `apercuEmailDevisAction` — LECTURE SEULE : aucune écriture, aucun jeton, aucun envoi.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  devisFindUnique: vi.fn(),
  ecriture: vi.fn(),
  creerToken: vi.fn(),
  enqueue: vi.fn(),
  etat: vi.fn(),
  formules: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const ecrit =
    () =>
    (...a: unknown[]) =>
      h.ecriture(...a);
  const modele = (lecture: unknown) => ({
    findUnique: lecture,
    create: ecrit(),
    createMany: ecrit(),
    update: ecrit(),
    updateMany: ecrit(),
    upsert: ecrit(),
    delete: ecrit(),
    deleteMany: ecrit(),
  });
  return {
    prisma: {
      devis: modele((...a: unknown[]) => h.devisFindUnique(...a)),
      emailOutbox: modele(vi.fn()),
      documentSignatureToken: modele(vi.fn()),
      $transaction: ecrit(),
      $executeRaw: ecrit(),
    },
  };
});
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "adm-1", role: "super_admin" })),
}));
vi.mock("@/server/qualiopi/socle/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/socle/interrupteurs")>()),
  lireInterrupteurQualiopi: async () => h.etat(),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => h.formules(),
}));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: vi.fn(async () => ({})),
  donneesPdfDevis: vi.fn(() => ({ formules: undefined })),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => h.creerToken(...a),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));

// Origine publique du site, modifiable par test : le bouton de signature n'existe que si le lien
// fictif de l'aperçu est sur cette origine (`lienSignatureValide`).
const site = vi.hoisted(() => ({ origine: "https://axion-ia.com" }));
vi.mock("@/lib/site-url", async (orig) => ({
  ...(await orig<typeof import("@/lib/site-url")>()),
  get SITE_URL() {
    return site.origine;
  },
}));

import { apercuEmailDevisAction, type ApercuEmailDevis } from "./devis-assistant-apercu-email";

const ID = "11111111-1111-4111-8111-111111111111";
const devis = (over: Record<string, unknown> = {}, client: Record<string, unknown> = {}) => ({
  id: ID,
  numero: "AXI-DEV-2026-001",
  statut: "brouillon",
  clientId: "c1",
  lignes: [],
  activite: null,
  refClient: null,
  financementSuggere: null,
  montantOpcoEstimeCents: null,
  resteAChargeCents: null,
  montantTotalHtCents: 150000,
  dateValidite: new Date("2026-12-31T00:00:00Z"),
  offre: null,
  conditionsParticulieres: null,
  client: {
    type: "entreprise",
    raisonSociale: "Client SA",
    siret: null,
    adresse: null,
    adresseRue: null,
    adresseCodePostal: null,
    adresseVille: null,
    contactNom: "Camille",
    contactCivilite: "monsieur",
    contactPrenom: "Paul",
    contactNomFamille: "Dupont",
    contactEmail: "client@example.test",
    ...client,
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.mockReturnValue("essai");
  h.formules.mockReturnValue(false);
  h.devisFindUnique.mockResolvedValue(devis());
  site.origine = "https://axion-ia.com";
});

function ok(r: unknown): ApercuEmailDevis {
  if (typeof r === "object" && r !== null && "data" in r)
    return (r as { data: ApercuEmailDevis }).data;
  throw new Error("données attendues, obtenu : " + JSON.stringify(r));
}

describe("apercuEmailDevisAction", () => {
  it("rend l'e-mail complet : de, à, objet, pièce jointe, lien « créé à l'envoi », salutation", async () => {
    const d = ok(await apercuEmailDevisAction({ devisId: ID }));
    expect(d.a).toBe("client@example.test");
    expect(d.de).toContain("@");
    expect(d.objet).toBe(d.objetOrigine);
    expect(d.piecesJointes).toEqual(["AXI-DEV-2026-001.pdf"]);
    expect(d.lienSignature).toBe("créé à l'envoi");
    expect(d.salutation).toBe("Bonjour Monsieur Dupont,");
    expect(d.adresseManquante).toBe(false);
    expect(d.html).toContain("Monsieur Dupont");
  });

  it("l'objet et le message modifiés se voient dans l'aperçu ; l'objet d'origine reste donné", async () => {
    const d = ok(
      await apercuEmailDevisAction({
        devisId: ID,
        sujet: "Mon objet",
        message: "Un mot personnel.",
      }),
    );
    expect(d.objet).toBe("Mon objet");
    expect(d.objetOrigine).not.toBe("Mon objet");
    expect(d.html).toContain("Un mot personnel.");
  });

  it("aucune écriture, aucun jeton, aucun envoi", async () => {
    await apercuEmailDevisAction({ devisId: ID, sujet: "Objet", message: "Message" });
    expect(h.ecriture).not.toHaveBeenCalled();
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("le lien de signature montré est fictif et inerte (aucun jeton réel dans la page)", async () => {
    const d = ok(await apercuEmailDevisAction({ devisId: ID }));
    expect(d.html).not.toMatch(/href="https?:/);
    expect(d.html).not.toMatch(/href="[^"]*signer/);
    // Le bouton est présent ; l'adresse de signature n'est jamais imprimée en clair.
    expect(d.html).toContain("Signer le devis en ligne");
    expect(d.html.replace(/<[^>]*>/g, " ")).not.toMatch(/signer\//);
  });

  it("origine du site différente : pas de bouton, pas de lien, et l'action ne plante pas", async () => {
    site.origine = "https://autre-site.test";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const d = ok(await apercuEmailDevisAction({ devisId: ID }));
      expect(d.html).not.toContain("Signer le devis en ligne");
      expect(d.html).not.toContain("signer/");
      expect(d.html).not.toMatch(/href="https?:/);
    } finally {
      warn.mockRestore();
    }
  });

  it("sans adresse sur la fiche : adresseManquante vrai et adresse vide", async () => {
    h.devisFindUnique.mockResolvedValue(devis({}, { contactEmail: null }));
    const d = ok(await apercuEmailDevisAction({ devisId: ID }));
    expect(d.adresseManquante).toBe(true);
    expect(d.a).toBe("");
  });

  it("sans civilité ni nom : « Bonjour, »", async () => {
    h.devisFindUnique.mockResolvedValue(
      devis({}, { contactCivilite: null, contactPrenom: null, contactNomFamille: null }),
    );
    expect(ok(await apercuEmailDevisAction({ devisId: ID })).salutation).toBe("Bonjour,");
  });

  it("refuse un devis qui n'est plus brouillon", async () => {
    h.devisFindUnique.mockResolvedValue(devis({ statut: "envoye" }));
    expect(await apercuEmailDevisAction({ devisId: ID })).toHaveProperty("error");
  });

  it("refuse quand l'interrupteur est éteint (relu à l'appel)", async () => {
    h.etat.mockReturnValue("eteint");
    expect(await apercuEmailDevisAction({ devisId: ID })).toHaveProperty("error");
    expect(h.devisFindUnique).not.toHaveBeenCalled();
  });

  it("refuse un mot interdit, un identifiant invalide, un devis introuvable", async () => {
    expect(
      await apercuEmailDevisAction({ devisId: ID, message: "prise en charge" }),
    ).toHaveProperty("error");
    expect(await apercuEmailDevisAction({ devisId: "x" })).toHaveProperty("error");
    h.devisFindUnique.mockResolvedValue(null);
    expect(await apercuEmailDevisAction({ devisId: ID })).toHaveProperty("error");
  });

  it("salutation : la vraie du contenu (prénom seul), pas la raison sociale", async () => {
    h.devisFindUnique.mockResolvedValue(
      devis({}, { contactCivilite: null, contactNomFamille: null, contactPrenom: "Léa" }),
    );
    expect(ok(await apercuEmailDevisAction({ devisId: ID })).salutation).toBe("Bonjour Léa,");
  });

  it("entrée non textuelle ou trop longue : erreur claire, jamais d'exception", async () => {
    const mauvaises = [
      { devisId: ID, sujet: 42 },
      { devisId: ID, message: { a: 1 } },
      { devisId: ID, sujet: "x".repeat(301) },
      { devisId: ID, message: "x".repeat(4001) },
      { devisId: 12 },
    ] as unknown as Array<Parameters<typeof apercuEmailDevisAction>[0]>;
    for (const m of mauvaises) {
      const r = await apercuEmailDevisAction(m);
      expect(r).toHaveProperty("error");
      expect((r as { error: string }).error).not.toBe("");
    }
  });

  it("objet avec caractère de contrôle : refusé", async () => {
    expect(await apercuEmailDevisAction({ devisId: ID, sujet: "Objet\u0007x" })).toHaveProperty(
      "error",
    );
  });
});
