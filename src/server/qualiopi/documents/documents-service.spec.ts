/**
 * Tests — generateDocument (documents-service.ts).
 *
 * Cible le garde-fou de conformité SYSTÉMATIQUE : un document à valeur
 * juridique/fiscale (facture, convention…) est refusé si l'identité de l'OF est
 * incomplète, MÊME quand l'appelant ne passe pas `identite` (relecture config en
 * repli). Les types internes ne sont jamais bloqués. Le mode stub court-circuite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (déclarés avant les imports des modules testés)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      // `count` reste utilisé par `estUneRegenerationDe` (filigrane COPIE).
      count: vi.fn(),
      // `findMany` est le chemin d'ALLOCATION depuis V20 (borne haute).
      findMany: vi.fn(),
      // Résolution de la pièce RECTIFIÉE (motif seul) et contre-trace.
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: vi.fn(),
  storeAndSignPdf: vi.fn(),
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer, storeAndSignPdf } from "@/server/qualiopi/documents/render";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";

const mockPrisma = prisma as unknown as {
  documentGenere: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  activityLog: { create: ReturnType<typeof vi.fn> };
};
const mockRender = renderPdfToBuffer as ReturnType<typeof vi.fn>;
const mockStore = storeAndSignPdf as ReturnType<typeof vi.fn>;
const mockGetIdentite = getOrganismeIdentite as ReturnType<typeof vi.fn>;

const IDENTITE_VIDE = {
  raisonSociale: "",
  nda: "",
  qualiopi: "",
  siret: "",
  adresseSiege: "",
  adresseExercice: "",
  email: "",
  telephone: "",
  site: "",
};

/**
 * Identité SUFFISANTE pour qu'une pièce ne soit pas déclassée en spécimen.
 *
 * Les tests de rectification portent sur le filigrane COPIE et la contre-trace :
 * un déclassement SPÉCIMEN parasiterait le sujet sans rien y ajouter.
 */
const IDENTITE_COMPLETE = {
  ...IDENTITE_VIDE,
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "Certifié Qualiopi",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.com",
  telephone: "0743331201",
  site: "https://axion-ia.com",
};

const buildElement = () => React.createElement(React.Fragment);

let savedDbUrl: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedDbUrl = process.env["DATABASE_URL"];
  // Non-stub par défaut pour exercer le chemin persisté.
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  mockRender.mockResolvedValue({
    buffer: Buffer.from("%PDF-"),
    hashSha256: "a".repeat(64),
    sizeBytes: 5,
  });
  mockStore.mockResolvedValue("https://r2/signed.pdf");
  mockPrisma.documentGenere.count.mockResolvedValue(0);
  // Série documentaire vide → première allocation = …-001.
  mockPrisma.documentGenere.findMany.mockResolvedValue([]);
  // Par défaut aucune pièce antérieure : une rectification sans précédent est
  // un premier original, pas une erreur.
  mockPrisma.documentGenere.findFirst.mockResolvedValue(null);
  mockPrisma.documentGenere.findUnique.mockResolvedValue(null);
  mockPrisma.documentGenere.update.mockResolvedValue({});
  mockPrisma.documentGenere.create.mockResolvedValue({
    id: "doc-1",
    numero: "AXI-FACT-2026-001",
    pdfUrl: "https://r2/signed.pdf",
    hashSha256: "a".repeat(64),
  });
  mockPrisma.activityLog.create.mockResolvedValue({});
});

afterEach(() => {
  if (savedDbUrl === undefined) delete process.env["DATABASE_URL"];
  else process.env["DATABASE_URL"] = savedDbUrl;
});

describe("🔴 statut de signature posé à la naissance de la pièce", () => {
  beforeEach(() => {
    // Identité INCOMPLÈTE volontairement : les pièces produites sont donc des
    // SPÉCIMENS. C'est le cas réel d'Axion-IA aujourd'hui (SIRET et NDA
    // manquants), et il vérifie au passage la décision documentée dans
    // `generateDocument` — un SPÉCIMEN reste `en_attente`. Il EXIGE une
    // signature, il ne peut simplement pas la recevoir tant qu'il est déclassé.
    // Le marquer `non_requise` masquerait précisément la pièce à corriger.
    mockGetIdentite.mockResolvedValue(IDENTITE_VIDE);
  });

  /** Statut réellement passé à `create`. */
  function statutPasse(): string | undefined {
    const appel = mockPrisma.documentGenere.create.mock.calls[0]?.[0] as {
      data: { statutSignature?: string };
    };
    return appel.data.statutSignature;
  }

  it("une pièce SIGNABLE naît `en_attente`", async () => {
    // Sans cela, elle dirait qu'elle suit son cours sans être signée, et le
    // registre du mode auditeur ne la ferait jamais remonter — alors que
    // « cette pièce est-elle signée ? » est la question qu'un contrôle pose.
    await generateDocument({ type: "convention", buildElement });
    expect(statutPasse()).toBe("en_attente");
  });

  it("une pièce NON signable ne reçoit aucun statut — le défaut `non_requise` s'applique", async () => {
    // Sur les 26 types, la plupart sont des pièces ÉMISES, pas des engagements
    // négociés. Leur poser `en_attente` remplirait le registre de pièces qui
    // n'attendent rien, et le registre cesserait d'être lu.
    await generateDocument({ type: "facture", buildElement });
    expect(statutPasse()).toBeUndefined();
  });

  it("🔴 la décision vient du SSOT, pas d'une liste locale", async () => {
    // Le relevé de connexion et la lettre de mission sont signables au même
    // titre que la convention. Si ce test tombe alors que `parties-requises.ts`
    // les déclare, c'est que quelqu'un a réintroduit une liste en dur ici.
    for (const type of ["releve_connexion", "lettre_mission"] as const) {
      mockPrisma.documentGenere.create.mockClear();
      await generateDocument({ type, buildElement });
      expect(statutPasse()).toBe("en_attente");
    }
  });
});

describe("generateDocument — garde-fou conformité systématique", () => {
  it("🔴 DÉCLASSE en spécimen (au lieu de refuser) quand la config OF est incomplète", async () => {
    // Audit certification 2026-07-25 — changement de contrat assumé.
    // Refuser rendait la chaîne inexerçable avant l'obtention du SIRET/NDA, et
    // remontait à l'utilisateur en écran de plantage générique. On produit
    // désormais le document, marqué SPÉCIMEN : rien ne bloque, et rien
    // d'incomplet ne peut passer pour une pièce valable.
    mockGetIdentite.mockResolvedValue(IDENTITE_VIDE);

    const res = await generateDocument({ type: "facture", buildElement });
    // ⚠️ PIÈGE — `res.numero` vient du `create.mockResolvedValue` du beforeEach,
    // PAS du numéro alloué. Asserter dessus ne testait donc RIEN : le test
    // restait vert que le registre émette AXI-DOC ou AXI-FACT.
    expect(res.numero).toBe("AXI-FACT-2026-001");

    // 🔴 V19 — voici la vraie assertion : le numéro PASSÉ à `create`. Une facture
    // est classée `AXI-DOC-…` dans le registre documentaire ; le PDF, lui, porte
    // le numéro comptable de `factures_formation`. Une cote de classement qui
    // ressemble à un numéro de facture est introuvable dans les livres — refus
    // au contrôle. C'est le seul test exécutable du changement de scope.
    const annee = new Date().getFullYear();
    const alloue = mockPrisma.documentGenere.create.mock.calls[0]?.[0] as {
      data: { numero: string };
    };
    expect(alloue.data.numero).toBe(`AXI-DOC-${annee}-001`);

    // La relecture config a bien eu lieu (identite non fournie).
    expect(mockGetIdentite).toHaveBeenCalledOnce();

    // Le document est persisté ET tracé comme spécimen.
    expect(mockPrisma.documentGenere.create).toHaveBeenCalledOnce();
    const payload = mockPrisma.documentGenere.create.mock.calls[0]?.[0] as {
      data: { metadata?: { specimen?: boolean; champsManquants?: string[] } };
    };
    expect(payload.data.metadata?.specimen).toBe(true);
    expect(payload.data.metadata?.champsManquants).toEqual(
      expect.arrayContaining(["raison sociale", "SIRET", "adresse du siège"]),
    );
    // 🔴 2026-07-28 — le NDA a été retiré de `CHAMPS_OBLIGATOIRES.facture` :
    // l'art. L.6351-1 laisse trois mois après la première convention pour
    // déposer la déclaration d'activité, donc au moment d'émettre cette
    // convention et la facture qui la suit, le numéro n'existe pas encore. Et il
    // n'est pas une mention obligatoire de facture (R123-238 C. com. + 242
    // nonies A ann. II CGI). L'assertion inverse verrouille le contrat : si
    // quelqu'un le remet dans la liste, ce test tombe — sans elle, la
    // régression repasserait en silence.
    expect(payload.data.metadata?.champsManquants).not.toContain(
      "numéro de déclaration d'activité (NDA)",
    );
  });

  it("🔴 le marquage SPÉCIMEN atteint RÉELLEMENT le gabarit, pas seulement la base", async () => {
    // Même piège que le filigrane COPIE : une trace en base sans marquage sur
    // le PDF laisserait circuler un document d'apparence officielle.
    mockGetIdentite.mockResolvedValue(IDENTITE_VIDE);
    const Gabarit = (_: { data: { numero: string; estSpecimen?: boolean } }) => null;

    await generateDocument({
      type: "facture",
      buildElement: (numero) => React.createElement(Gabarit, { data: { numero } }),
    });

    const rendu = mockRender.mock.calls[0]![0] as {
      props: { data: { estSpecimen?: boolean; specimenMotif?: string } };
    };
    expect(rendu.props.data.estSpecimen).toBe(true);
    expect(rendu.props.data.specimenMotif).toMatch(/SPÉCIMEN/i);
  });

  it("ne relit pas la config quand identite complète est fournie", async () => {
    await expect(
      generateDocument({
        type: "facture",
        buildElement,
        identite: {
          ...IDENTITE_VIDE,
          raisonSociale: "Axion-IA SAS",
          nda: "84691234567",
          siret: "12345678901234",
          adresseSiege: "1 rue de la Paix, 75001 Paris",
        },
      }),
    ).resolves.toMatchObject({ id: "doc-1" });
    expect(mockGetIdentite).not.toHaveBeenCalled();
  });

  it("laisse passer un type interne sans identite (pas de garde-fou)", async () => {
    const res = await generateDocument({ type: "positionnement", buildElement });
    expect(res).toMatchObject({ id: "doc-1" });
    // Type non soumis → jamais de relecture ni d'assert.
    expect(mockGetIdentite).not.toHaveBeenCalled();
  });

  it("mode stub.invalid → retourne l'objet stub sans throw ni DB", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const res = await generateDocument({ type: "facture", buildElement });
    expect(res.id).toBe("stub-id");
    expect(mockGetIdentite).not.toHaveBeenCalled();
    expect(mockPrisma.documentGenere.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filigrane « COPIE »
// ─────────────────────────────────────────────────────────────────────────────

describe("generateDocument — détection de régénération", () => {
  /**
   * `documentGenere.count` sert DEUX usages : l'allocation du numéro séquentiel
   * (filtre `numero`) et la détection de régénération (filtre `type`). Les
   * distinguer est indispensable — les confondre ferait passer les tests pour de
   * mauvaises raisons.
   */
  function simulerDocumentsExistants(nb: number): void {
    mockPrisma.documentGenere.count.mockImplementation((args: unknown) => {
      const where = (args as { where: Record<string, unknown> }).where;
      return Promise.resolve(where["numero"] !== undefined ? 0 : nb);
    });
  }

  /** Le `where` utilisé pour décider s'il s'agit d'une régénération. */
  function whereDeDetection(): Record<string, unknown> | undefined {
    const appel = mockPrisma.documentGenere.count.mock.calls.find(
      (c) => (c[0] as { where: Record<string, unknown> }).where["numero"] === undefined,
    );
    return appel === undefined ? undefined : (appel[0] as { where: Record<string, unknown> }).where;
  }

  /** `estCopie` réellement écrit en base. */
  function estCopiePersiste(): unknown {
    return (mockPrisma.documentGenere.create.mock.calls[0]![0] as { data: { estCopie: unknown } })
      .data.estCopie;
  }

  it("un premier tirage n'est pas une copie", async () => {
    simulerDocumentsExistants(0);
    await generateDocument({
      type: "positionnement",
      buildElement,
      refs: { sessionId: "ses-1" },
    });
    expect(estCopiePersiste()).toBe(false);
  });

  it("un second tirage des MÊMES références est une copie", async () => {
    simulerDocumentsExistants(1);
    await generateDocument({
      type: "positionnement",
      buildElement,
      refs: { sessionId: "ses-1" },
    });
    expect(estCopiePersiste()).toBe(true);
  });

  it("🔴 deux stagiaires d'une MÊME session ne se marquent pas copie l'un l'autre", async () => {
    // Le bug : six types sont établis PAR STAGIAIRE mais n'étaient rattachés
    // qu'à la session. Sur une session de huit personnes, le premier contrat
    // était un original et les sept suivants étaient enregistrés « copie ».
    // La correspondance doit donc être EXACTE, références absentes comprises.
    simulerDocumentsExistants(0);
    await generateDocument({
      type: "positionnement",
      buildElement,
      refs: { sessionId: "ses-1", traineeId: "sta-2" },
    });

    const where = whereDeDetection();
    expect(where).toMatchObject({ sessionId: "ses-1", traineeId: "sta-2" });
    // Les références NON fournies sont comparées à `null`, pas ignorées : sans
    // cela, une pièce rattachée à la seule session serait confondue avec une
    // pièce rattachée à la session ET à un stagiaire.
    expect(where).toMatchObject({ clientId: null, coachingSessionId: null, formationId: null });
  });

  it("🔴 SANS aucune référence, on ne conclut pas — pas de compte, pas de copie", async () => {
    // Quatre types n'en portent aucune (inventaire des moyens, contrat de
    // sous-traitance, fiche formateur, facture 1-to-1). Le compte dégénérait en
    // « deuxième document de ce type jamais émis » : le contrat d'un AUTRE
    // sous-traitant était marqué copie, et la deuxième facture de l'histoire
    // aussi.
    simulerDocumentsExistants(42);
    await generateDocument({ type: "inventaire_moyens", buildElement });

    expect(estCopiePersiste()).toBe(false);
    expect(whereDeDetection()).toBeUndefined();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // `D2-5-07` (2026-08-20) — le contrat de sous-traitance n'avait AUCUNE identité
  // ───────────────────────────────────────────────────────────────────────────

  it("🔴 un second contrat du MÊME sous-traitant est reconnu comme régénération", async () => {
    // Le défaut : `sousTraitantId` manquait à la clé d'identité de pièce. Un
    // contrat de sous-traitance ne porte AUCUNE des cinq autres références, donc
    // `filtreMemePiece` rendait `null` et la question n'était jamais posée.
    // Régénérer produisait un SECOND ORIGINAL : deux contrats concurrents au
    // registre, aucun des deux ne disant lequel fait foi.
    simulerDocumentsExistants(1);
    await generateDocument({
      type: "contrat_sous_traitance",
      buildElement,
      refs: { sousTraitantId: "st-1" },
    });
    expect(estCopiePersiste()).toBe(true);
    expect(whereDeDetection(), "la détection doit avoir eu lieu").toBeDefined();
    expect(whereDeDetection()!["sousTraitantId"]).toBe("st-1");
  });

  it("un PREMIER contrat reste un original", async () => {
    // 🔑 Témoin négatif. Sans lui, une identité qui marquerait TOUT contrat
    // « copie » passerait le test ci-dessus.
    simulerDocumentsExistants(0);
    await generateDocument({
      type: "contrat_sous_traitance",
      buildElement,
      refs: { sousTraitantId: "st-1" },
    });
    expect(estCopiePersiste()).toBe(false);
  });

  it("🔴 deux sous-traitants DIFFÉRENTS ne se marquent pas copie l'un l'autre", async () => {
    // 🔑 Le témoin discriminant, et le piège symétrique : une identité qui
    // ignorerait `sousTraitantId` dans le `where` — tout en interrogeant la
    // base — estampillerait « COPIE » le contrat du deuxième sous-traitant
    // référencé. C'est le défaut que six types de pièces ont déjà payé côté
    // stagiaire (« deux stagiaires d'une même session », plus haut).
    simulerDocumentsExistants(1);
    await generateDocument({
      type: "contrat_sous_traitance",
      buildElement,
      refs: { sousTraitantId: "st-2" },
    });
    expect(whereDeDetection()!["sousTraitantId"]).toBe("st-2");
  });

  it("🔴 le renouvellement garde son échappement : `estCopie: false` l'emporte", async () => {
    // ⚠️ Un contrat-cadre renouvelé chaque année est un ORIGINAL, pas une copie.
    // L'identité seule ne peut pas distinguer une réédition d'un renouvellement
    // — rien dans les données ne le dit. L'échappement est celui qui existe déjà
    // partout ailleurs, et il doit rester praticable : sans lui, ce correctif
    // rendrait impossible d'émettre un vrai second contrat.
    simulerDocumentsExistants(3);
    await generateDocument({
      type: "contrat_sous_traitance",
      buildElement,
      refs: { sousTraitantId: "st-1" },
      estCopie: false,
    });
    expect(estCopiePersiste()).toBe(false);
    expect(whereDeDetection(), "aucune interrogation quand l'appelant tranche").toBeUndefined();
  });

  it("`estCopie: true` explicite l'emporte, sans interroger la base", async () => {
    simulerDocumentsExistants(0);
    await generateDocument({ type: "positionnement", buildElement, estCopie: true });
    expect(estCopiePersiste()).toBe(true);
    expect(whereDeDetection()).toBeUndefined();
  });

  it("🔴 le filigrane atteint RÉELLEMENT le gabarit, pas seulement la base", async () => {
    // ⚠️ Le défaut d'origine : `estCopie` était écrit en base et n'atteignait
    // jamais le PDF, `buildElement(numero)` ne recevant que le numéro. La base
    // disait « copie » et la pièce sortait identique à l'original — soit
    // exactement ce que le filigrane devait empêcher.
    simulerDocumentsExistants(1);
    const Gabarit = (_: { data: { numero: string; estCopie?: boolean } }) => null;

    await generateDocument({
      type: "positionnement",
      buildElement: (numero) => React.createElement(Gabarit, { data: { numero } }),
      refs: { sessionId: "ses-1" },
    });

    const rendu = mockRender.mock.calls[0]![0] as { props: { data: { estCopie?: boolean } } };
    expect(rendu.props.data.estCopie).toBe(true);
  });

  it("ne touche pas aux données du gabarit quand ce n'est pas une copie", async () => {
    simulerDocumentsExistants(0);
    const Gabarit = (_: { data: { numero: string; estCopie?: boolean } }) => null;

    await generateDocument({
      type: "positionnement",
      buildElement: (numero) => React.createElement(Gabarit, { data: { numero } }),
      refs: { sessionId: "ses-1" },
    });

    const rendu = mockRender.mock.calls[0]![0] as { props: { data: { estCopie?: boolean } } };
    expect(rendu.props.data.estCopie).toBeUndefined();
  });
});

describe("🔴 RECTIFICATION générique — une régénération motivée n'est pas un duplicata", () => {
  /** `estCopie` réellement écrit en base. */
  function estCopiePersiste(): unknown {
    return (mockPrisma.documentGenere.create.mock.calls[0]![0] as { data: { estCopie: unknown } })
      .data.estCopie;
  }

  /** `metadata.rectifie` réellement écrit en base. */
  function rectifiePersiste(): { numero?: string; motif?: string } | undefined {
    const data = mockPrisma.documentGenere.create.mock.calls[0]![0] as {
      data: { metadata?: { rectifie?: { numero?: string; motif?: string } } };
    };
    return data.data.metadata?.rectifie;
  }

  beforeEach(() => {
    mockGetIdentite.mockResolvedValue(IDENTITE_COMPLETE);
  });

  it("le motif seul suffit : le numéro de la pièce remplacée est résolu ici", async () => {
    // 🔴 C'est TOUT le sujet. `rectifie` était générique depuis le 03/08 et un
    // seul appelant sur vingt-quatre le passait, parce qu'il exige un numéro
    // que l'appelant n'a pas sous la main. Les vingt-trois actions de la
    // console régénéraient donc en « COPIE ».
    // ⚠️ `count` à 1, et c'est ESSENTIEL : sans une pièce antérieure détectée,
    // l'heuristique du filigrane rendrait `false` toute seule et l'assertion
    // ci-dessous resterait verte même si la rectification ne servait à rien.
    // Première version de ce test : `count` à 0 — il passait encore après
    // réintroduction du défaut. Un test qui ne discrimine pas ne garde rien.
    mockPrisma.documentGenere.count.mockResolvedValue(1);
    mockPrisma.documentGenere.findFirst.mockResolvedValue({
      id: "doc-018",
      numero: "AXI-DOC-2026-018",
    });

    await generateDocument({
      type: "kit_opco",
      buildElement,
      refs: { sessionId: "ses-1" },
      rectificationMotif: "Rendu illisible des pièces constitutives — mise en page corrigée.",
    });

    expect(estCopiePersiste()).toBe(false);
    expect(rectifiePersiste()).toMatchObject({
      numero: "AXI-DOC-2026-018",
      motif: "Rendu illisible des pièces constitutives — mise en page corrigée.",
    });
  });

  it("🔴 la pièce REMPLACÉE reçoit sa contre-trace", async () => {
    // Le commentaire du service affirmait depuis le 03/08 que « l'ancienne dit
    // par quoi elle est remplacée ». Ce n'était écrit NULLE PART : l'auditeur
    // qui ouvrait la pièce périmée n'avait aucun moyen d'apprendre qu'elle ne
    // faisait plus foi.
    mockPrisma.documentGenere.findFirst.mockResolvedValue({
      id: "doc-018",
      numero: "AXI-DOC-2026-018",
    });
    mockPrisma.documentGenere.create.mockResolvedValue({
      id: "doc-026",
      numero: "AXI-DOC-2026-026",
      pdfUrl: "https://r2/signed.pdf",
      hashSha256: "a".repeat(64),
    });

    await generateDocument({
      type: "kit_opco",
      buildElement,
      refs: { sessionId: "ses-1" },
      rectificationMotif: "Rendu illisible des pièces constitutives — mise en page corrigée.",
    });

    expect(mockPrisma.documentGenere.update).toHaveBeenCalledWith({
      where: { id: "doc-018" },
      data: { remplaceeParNumero: "AXI-DOC-2026-026" },
    });
  });

  it("🔴 rectifie la pièce la PLUS RÉCENTE, pas la première", async () => {
    // Le kit OPCO en est le cas d'école : `018` original cassé, `024` copie
    // corrigée, puis la rectification. Déclarer rectifier `018` laisserait
    // `024` vivante au registre sans que rien ne dise qu'elle est morte —
    // c'est-à-dire les deux pièces concurrentes que tout ceci évite.
    mockPrisma.documentGenere.findFirst.mockResolvedValue({
      id: "doc-024",
      numero: "AXI-DOC-2026-024",
    });

    await generateDocument({
      type: "kit_opco",
      buildElement,
      refs: { sessionId: "ses-1" },
      rectificationMotif: "Rendu illisible des pièces constitutives — mise en page corrigée.",
    });

    const appel = mockPrisma.documentGenere.findFirst.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      orderBy: unknown;
    };
    expect(appel.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    // Et jamais une pièce déjà annulée : la chaîne de remplacement doit
    // désigner la dernière qui faisait foi.
    expect(appel.where["annuleeAt"]).toBeNull();
  });

  it("sans pièce antérieure, c'est un premier original — pas un échec", async () => {
    mockPrisma.documentGenere.count.mockResolvedValue(0);
    mockPrisma.documentGenere.findFirst.mockResolvedValue(null);

    await generateDocument({
      type: "kit_opco",
      buildElement,
      refs: { sessionId: "ses-1" },
      rectificationMotif: "Motif parfaitement valable mais sans pièce à remplacer.",
    });

    expect(estCopiePersiste()).toBe(false);
    expect(rectifiePersiste()).toBeUndefined();
    expect(mockPrisma.documentGenere.update).not.toHaveBeenCalled();
  });

  it("SANS motif, une régénération reste une COPIE", async () => {
    // Le filigrane garde tout son sens pour un vrai duplicata : c'est le motif
    // qui distingue les deux gestes, et lui seul.
    mockPrisma.documentGenere.count.mockResolvedValue(1);

    await generateDocument({
      type: "kit_opco",
      buildElement,
      refs: { sessionId: "ses-1" },
    });

    expect(estCopiePersiste()).toBe(true);
    expect(rectifiePersiste()).toBeUndefined();
    expect(mockPrisma.documentGenere.findFirst).not.toHaveBeenCalled();
  });

  it("🔴 une pièce ANNULÉE ne fait pas filigraner son remplacement", async () => {
    // Une pièce annulée ne circule plus : marquer « COPIE » le tirage valable
    // ferait porter au bon document la marque d'un duplicata dont l'original a
    // précisément cessé de faire foi.
    mockPrisma.documentGenere.count.mockResolvedValue(0);

    await generateDocument({
      type: "kit_opco",
      buildElement,
      refs: { sessionId: "ses-1" },
    });

    const appel = mockPrisma.documentGenere.count.mock.calls.find(
      (c) => (c[0] as { where: Record<string, unknown> }).where["type"] === "kit_opco",
    );
    expect((appel![0] as { where: Record<string, unknown> }).where["annuleeAt"]).toBeNull();
    expect(estCopiePersiste()).toBe(false);
  });

  it("🔴 l'appelant EXPLICITE reçoit aussi la contre-trace", async () => {
    // `attestation-service` connaît le numéro qu'il remplace mais pas son id.
    // Sans cette résolution, la contre-trace n'aurait jamais couvert le seul
    // circuit qui rectifiait déjà.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: "att-004",
      numero: "AXI-ATT-2026-004",
    });
    mockPrisma.documentGenere.create.mockResolvedValue({
      id: "att-005",
      numero: "AXI-ATT-2026-005",
      pdfUrl: "https://r2/signed.pdf",
      hashSha256: "a".repeat(64),
    });

    await generateDocument({
      type: "attestation",
      buildElement,
      refs: { sessionId: "ses-1", traineeId: "sta-1" },
      rectifie: { numero: "AXI-ATT-2026-004", motif: "Évaluation des acquis enregistrée depuis." },
    });

    expect(mockPrisma.documentGenere.update).toHaveBeenCalledWith({
      where: { id: "att-004" },
      data: { remplaceeParNumero: "AXI-ATT-2026-005" },
    });
  });

  it("une contre-trace en échec ne fait PAS échouer la génération", async () => {
    // La pièce neuve EXISTE : un numéro est consommé et un PDF est en ligne.
    // Échouer laisserait l'appelant croire que rien n'a été produit.
    mockPrisma.documentGenere.findFirst.mockResolvedValue({
      id: "doc-018",
      numero: "AXI-DOC-2026-018",
    });
    mockPrisma.documentGenere.update.mockRejectedValue(new Error("colonne absente"));

    await expect(
      generateDocument({
        type: "kit_opco",
        buildElement,
        refs: { sessionId: "ses-1" },
        rectificationMotif: "Rendu illisible des pièces constitutives — corrigé.",
      }),
    ).resolves.toMatchObject({ numero: expect.any(String) });
  });
});
