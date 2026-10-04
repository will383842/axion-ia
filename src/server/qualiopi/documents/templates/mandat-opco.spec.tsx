/**
 * Tests — template PDF du mandat OPCO (INT-T66-A, REQ-JUR-061).
 *
 * Les témoins portent sur le TEXTE que lit l'entreprise, pas seulement sur le
 * « %PDF » du buffer : un mandat qui oublierait de se dire révocable, ou qui
 * laisserait croire à un pouvoir d'encaisser, passerait un test de magic bytes.
 */

import { createHash } from "node:crypto";
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
// Témoins de l'action de génération (fin du fichier).
const sessionFindUnique = vi.fn();
const dossierFindFirst = vi.fn();
const clientFindUnique = vi.fn();
const jetonFindFirst = vi.fn();
const documentFindFirst = vi.fn();
const requireAdminWrite = vi.fn();
const generateDocument = vi.fn();
const creerTokenDocument = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findFirst: (...a: unknown[]) => documentFindFirst(...a),
    },
    documentSignature: { findMany: (...a: unknown[]) => findMany(...a) },
    trainingSession: { findUnique: (...a: unknown[]) => sessionFindUnique(...a) },
    dossierFinancement: { findFirst: (...a: unknown[]) => dossierFindFirst(...a) },
    client: { findUnique: (...a: unknown[]) => clientFindUnique(...a) },
    documentSignatureToken: { findFirst: (...a: unknown[]) => jetonFindFirst(...a) },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: (...a: unknown[]) => requireAdminWrite(...a),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));
vi.mock("@/server/qualiopi/documents/documents-service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateDocument: (...a: unknown[]) => generateDocument(...a),
}));
vi.mock("@/server/qualiopi/documents/organisme", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getOrganismeIdentite: async () => IDENTITE,
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  creerTokenDocument: (...a: unknown[]) => creerTokenDocument(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { rendreExemplaireSigne } from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { MENTION_PLAFOND_CANAL_MAISON } from "@/server/qualiopi/documents/signature/mentions-document";
import {
  circuitPour,
  partiesRequisesPour,
} from "@/server/qualiopi/documents/signature/parties-requises";
import { libelleTypeDocument } from "@/server/qualiopi/documents/libelles-type-document";
import { versionGabaritCourante } from "./gabarit-versions";
import { MandatOpcoPdf, type MandatOpcoData } from "./mandat-opco";
import { render, screen, cleanup } from "@testing-library/react";
import { genererMandatOpcoAction } from "@/server/actions/qualiopi/documents";
// Le témoin du bouton vit ici : c'est le fichier de test déclaré de la tâche.
// eslint-disable-next-line no-restricted-imports -- témoin d'écran, pas une dépendance de code
import { DocumentsSection } from "@/components/admin/qualiopi/DocumentsSection";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "FR-2026-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
};

const DATA: MandatOpcoData = {
  numero: "AXI-DOC-2026-120",
  entreprise: {
    raisonSociale: "Menuiserie Durand SARL",
    siret: "98765432100011",
    adresse: "10 avenue du Client, 42000 Saint-Étienne",
    representant: "Claire Durand",
    qualiteRepresentant: "Gérante",
  },
  opco: { nom: "OPCO EP" },
  action: {
    intitule: "IA générative pour l'artisanat",
    dateDebut: "12/11/2026",
    dateFin: "13/11/2026",
    dureeHeures: 14,
    stagiaires: ["Camille Durand", "Lucas Martin"],
    numeroConvention: "AXI-DOC-2026-119",
  },
  dateMandat: "04/10/2026",
};

function texte(data: MandatOpcoData = DATA): string {
  return collectPdfTextNormalized(React.createElement(MandatOpcoPdf, { data, identite: IDENTITE }));
}

beforeAll(() => {
  registerPdfTestFontsFallback();
  // Le PDF embarque sa date de création (et son /ID en dérive) : sans horloge
  // figée, deux rendus identiques n'ont jamais les mêmes octets.
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

describe("MandatOpcoPdf — le texte que lit l'entreprise", () => {
  it("rend un PDF valide (%PDF)", async () => {
    const { buffer } = await renderPdfToBuffer(<MandatOpcoPdf data={DATA} identite={IDENTITE} />);
    expect(buffer.subarray(0, 5).toString()).toContain("%PDF");
  }, 30_000);

  it("se dit SPÉCIAL, LIMITÉ et RÉVOCABLE à tout moment par écrit", () => {
    const t = texte();
    expect(t).toContain("Mandat spécial");
    expect(t).toContain("mandat spécial d'accomplir");
    expect(t).toContain("Le mandat est limité à");
    expect(t).toContain("révocable");
    expect(t).toContain("peut révoquer le mandat à tout moment, sans motif, par écrit");
  });

  it("🔴 exclut TOUT pouvoir de recevoir des fonds, et ne vaut pas subrogation", () => {
    const t = texte();
    expect(t).toContain("ne confère aucun pouvoir de recevoir des fonds");
    expect(t).toContain("ni recevoir, ni encaisser, ni percevoir aucune somme");
    expect(t).toContain("ne vaut pas subrogation de paiement");
  });

  it("désigne l'action : formation, dates, stagiaires, OPCO", () => {
    const t = texte();
    expect(t).toContain("IA générative pour l'artisanat");
    expect(t).toContain("12/11/2026");
    expect(t).toContain("13/11/2026");
    expect(t).toContain("Camille Durand");
    expect(t).toContain("Lucas Martin");
    expect(t).toContain("OPCO EP");
    expect(t).toContain("n° AXI-DOC-2026-119");
  });

  it("n'engage l'organisme au-delà du dépôt : ni résultat, ni délai garantis", () => {
    const t = texte();
    expect(t).toContain(
      "ne garantit ni l'accord de l'OPCO, ni le montant pris en charge, ni le délai",
    );
    // Contre-témoins : aucune formule de promesse ne doit s'être glissée.
    expect(t).not.toMatch(/sous \d+ jours/);
    expect(t).not.toContain("garantit l'obtention");
  });

  it("porte mot pour mot les trois ajouts de la juriste (issue 656, commentaire 5981375404)", () => {
    const t = texte();
    expect(t).toContain(
      "Lorsque la convention de formation est conclue sous la condition de la prise en charge par l'OPCO, le dépôt accompli par le mandataire au titre du présent mandat vaut dépôt par le mandant ; un retard du mandataire dans ce dépôt n'est pas imputable au mandant.",
    );
    expect(t).toContain(
      "Toute nouvelle demande, même pour la même action, appelle un nouveau mandat.",
    );
    expect(t).toContain(
      "Si la demande a déjà été déposée, le mandataire informe sans délai l'OPCO de la révocation ; le mandant peut aussi l'en informer lui-même.",
    );
  });

  it("interdit la substitution — un apporteur ne tient aucun pouvoir de cette pièce", () => {
    expect(texte()).toContain(
      "ne peut se substituer aucune autre personne, notamment un apporteur",
    );
  });

  it("porte une SignatureZone à deux parties et la mention du plafond du canal maison", () => {
    const t = texte();
    expect(t).toContain("Le mandant");
    expect(t).toContain("Le mandataire, pour acceptation");
    expect(t).toContain("Fait à");
    expect(t).toContain(MENTION_PLAFOND_CANAL_MAISON);
  });

  it("un stagiaire seul s'accorde au singulier", () => {
    const t = texte({ ...DATA, action: { ...DATA.action, stagiaires: ["Camille Durand"] } });
    expect(t).toContain("Stagiaire concerné :");
    expect(t).not.toContain("Stagiaires concernés :");
  });
});

describe("mandat OPCO — circuit, libellé, version", () => {
  it("le circuit du mandat est `maison`, client puis organisme", () => {
    expect(circuitPour("mandat_opco")?.canal).toBe("maison");
    expect(partiesRequisesPour("mandat_opco")).toStrictEqual(["client", "axionia"]);
  });

  it("le libellé du registre existe", () => {
    expect(libelleTypeDocument("mandat_opco")).toBe("Mandat OPCO");
  });

  it("le gabarit est versionné (v1)", () => {
    expect(versionGabaritCourante("mandat_opco")).toBe(1);
  });
});

describe("🔴 l'exemplaire signé du mandat se rejoue à l'octet", () => {
  function lignesSignature() {
    return (["client", "axionia"] as const).map((partie, i) => ({
      partie,
      signataireNom: partie === "client" ? "Claire Durand" : "Williams Jullin",
      signataireQualite: partie === "client" ? "Gérante" : "Président",
      signeAt: new Date(Date.UTC(2026, 9, 4, 9, 15 + i)),
      selfHash: String(i + 1).repeat(64),
      methode: "trace",
      // Pas d'image : le test ne dépend pas de R2.
      signatureKey: null,
      imagePurgeeAt: null,
    }));
  }

  async function exemplaire() {
    findUnique.mockResolvedValueOnce({
      numero: DATA.numero,
      type: "mandat_opco",
      metadata: {
        renderData: JSON.parse(
          JSON.stringify({ data: DATA, identite: IDENTITE, gabaritVersion: 1 }),
        ) as unknown,
      },
      client: { raisonSociale: DATA.entreprise.raisonSociale },
      session: null,
    });
    findMany.mockResolvedValueOnce(lignesSignature());
    return rendreExemplaireSigne("doc-id");
  }

  it("deux rejouements du même instantané rendent les mêmes octets", async () => {
    const a = await exemplaire();
    const b = await exemplaire();
    expect(a.ok, a.ok ? "" : a.message).toBe(true);
    expect(b.ok, b.ok ? "" : b.message).toBe(true);
    if (!a.ok || !b.ok) return;
    const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");
    expect(sha(a.buffer)).toBe(sha(b.buffer));
    expect(a.buffer.subarray(0, 5).toString()).toContain("%PDF");
  }, 60_000);

  it("l'exemplaire signé porte les preuves des deux parties", () => {
    const t = collectPdfTextNormalized(
      React.createElement(MandatOpcoPdf, {
        data: {
          ...DATA,
          signatures: {
            client: {
              signataireNom: "Claire Durand",
              signataireQualite: "Gérante",
              signeAtLisible: "04/10/2026 11:15",
              empreinte: "1".repeat(64),
              methode: "trace",
              imageSrc: null,
            },
            axionia: {
              signataireNom: "Williams Jullin",
              signataireQualite: "Président",
              signeAtLisible: "04/10/2026 11:16",
              empreinte: "2".repeat(64),
              methode: "trace",
              imageSrc: null,
            },
          },
        },
        identite: IDENTITE,
      }),
    );
    expect(t).toContain("Signé le 04/10/2026 11:15");
    expect(t).toContain("Signé le 04/10/2026 11:16");
    expect(t).toContain(`Empreinte : ${"1".repeat(64)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Témoins de l'action et du bouton (rattrapage 110)
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_ID = "a1234567-89ab-4def-8123-456789abcdef";
const CLIENT_ID = "b1234567-89ab-4def-8123-456789abcdef";
const DOC_ID = "c1234567-89ab-4def-8123-456789abcdef";

function sessionEnBase() {
  return {
    id: SESSION_ID,
    clientId: CLIENT_ID,
    titreSession: "IA générative pour l'artisanat",
    dateDebut: new Date("2026-11-12T08:00:00Z"),
    dateFin: new Date("2026-11-13T16:00:00Z"),
    formationSnapshot: null,
    formation: { dureeHeures: 14 },
    enrollments: [
      { clientId: null, trainee: { nom: "Durand", prenom: "Camille" } },
      { clientId: null, trainee: { nom: "Martin", prenom: "Lucas" } },
    ],
  };
}

function preparerBase(opts: { conventionEnCircuit: boolean }) {
  requireAdminWrite.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
  sessionFindUnique.mockResolvedValue(sessionEnBase());
  dossierFindFirst.mockResolvedValue({ financeurNom: "OPCO EP" });
  clientFindUnique.mockResolvedValue({
    raisonSociale: "Menuiserie Durand SARL",
    siret: "98765432100011",
    adresse: "10 avenue du Client, 42000 Saint-Étienne",
    contactNom: "Claire Durand",
    contactEmail: "claire@durand.test",
    contactFonction: "Gérante",
    opco: null,
    opcoIdentifie: null,
  });
  jetonFindFirst.mockResolvedValue(
    opts.conventionEnCircuit
      ? {
          signataireNom: "Claire Durand",
          signataireEmail: "claire@durand.test",
          signataireQualite: "Gérante",
          expiresAt: new Date("2026-11-01T00:00:00Z"),
          documentGenere: { numero: "AXI-DOC-2026-119" },
        }
      : null,
  );
  documentFindFirst.mockResolvedValue(null);
  findUnique.mockResolvedValue({
    metadata: {},
    suppressionPrevueAt: new Date("2031-10-04T00:00:00Z"),
  });
  generateDocument.mockResolvedValue({
    id: DOC_ID,
    numero: "AXI-DOC-2026-120",
    pdfUrl: null,
    hashSha256: "a".repeat(64),
  });
  creerTokenDocument.mockResolvedValue({
    token: "jeton",
    tokenId: "t1",
    expiresAt: new Date("2026-11-01T00:00:00Z"),
  });
}

describe("🔴 genererMandatOpcoAction — garde, entrée, génération, envoi", () => {
  beforeEach(() => {
    for (const m of [
      sessionFindUnique,
      dossierFindFirst,
      clientFindUnique,
      jetonFindFirst,
      documentFindFirst,
      requireAdminWrite,
      generateDocument,
      creerTokenDocument,
      findUnique,
    ]) {
      m.mockReset();
    }
  });

  it("refuse sans droit admin, AVANT toute lecture", async () => {
    requireAdminWrite.mockRejectedValueOnce(new Error("Accès refusé"));
    await expect(
      genererMandatOpcoAction({ sessionId: SESSION_ID, clientId: CLIENT_ID }),
    ).rejects.toThrow("Accès refusé");
    expect(sessionFindUnique).not.toHaveBeenCalled();
    expect(clientFindUnique).not.toHaveBeenCalled();
    expect(dossierFindFirst).not.toHaveBeenCalled();
    expect(generateDocument).not.toHaveBeenCalled();
  });

  it("zod refuse une clé en trop (`.strict()`)", async () => {
    preparerBase({ conventionEnCircuit: false });
    const res = await genererMandatOpcoAction({
      sessionId: SESSION_ID,
      clientId: CLIENT_ID,
      opco: "Un autre OPCO",
    } as never);
    expect(res).toStrictEqual({ error: "Données invalides" });
    expect(sessionFindUnique).not.toHaveBeenCalled();
    expect(generateDocument).not.toHaveBeenCalled();
  });

  it("refuse sans dossier OPCO ou mixte ouvert : le mandat n'a pas d'objet", async () => {
    preparerBase({ conventionEnCircuit: false });
    dossierFindFirst.mockResolvedValueOnce(null);
    const res = await genererMandatOpcoAction({ sessionId: SESSION_ID, clientId: CLIENT_ID });
    expect("error" in res && res.error).toMatch(/OPCO ou mixte/);
    expect(generateDocument).not.toHaveBeenCalled();
  });

  it("génère un DocumentGenere `mandat_opco` avec ses refs, nourri par la base", async () => {
    preparerBase({ conventionEnCircuit: false });
    const res = await genererMandatOpcoAction({ sessionId: SESSION_ID, clientId: CLIENT_ID });
    expect("data" in res).toBe(true);
    expect(generateDocument).toHaveBeenCalledTimes(1);
    const appel = generateDocument.mock.calls[0]![0] as {
      type: string;
      refs: unknown;
      buildElement: (n: string) => React.ReactElement<{ data: MandatOpcoData }>;
    };
    expect(appel.type).toBe("mandat_opco");
    expect(appel.refs).toStrictEqual({ sessionId: SESSION_ID, clientId: CLIENT_ID });
    const data = appel.buildElement("AXI-DOC-2026-120").props.data;
    expect(data.opco.nom).toBe("OPCO EP");
    expect(data.entreprise.representant).toBe("Claire Durand");
    expect(data.action.stagiaires).toStrictEqual(["Camille Durand", "Lucas Martin"]);
    expect(data.action.dureeHeures).toBe(14);
    expect(data.action.dateDebut).toBe("12/11/2026");
  });

  it("sans convention en circuit : le mandat part SEUL, au contact de la fiche, et le dit", async () => {
    preparerBase({ conventionEnCircuit: false });
    const res = await genererMandatOpcoAction({ sessionId: SESSION_ID, clientId: CLIENT_ID });
    if (!("data" in res)) throw new Error(res.error);
    expect(res.data.envoi.mode).toBe("seul");
    const jeton = creerTokenDocument.mock.calls[0]![0] as Record<string, unknown>;
    expect(jeton["partie"]).toBe("client");
    expect(jeton["documentGenereId"]).toBe(DOC_ID);
    expect(jeton["signataireEmail"]).toBe("claire@durand.test");
  });

  it("convention en circuit : même envoi — même signataire, même échéance, convention citée", async () => {
    preparerBase({ conventionEnCircuit: true });
    const res = await genererMandatOpcoAction({ sessionId: SESSION_ID, clientId: CLIENT_ID });
    if (!("data" in res)) throw new Error(res.error);
    expect(res.data.envoi).toMatchObject({
      mode: "avec_convention",
      conventionNumero: "AXI-DOC-2026-119",
      destinataire: "claire@durand.test",
    });
    const jeton = creerTokenDocument.mock.calls[0]![0] as Record<string, unknown>;
    expect(jeton["borneMetier"]).toStrictEqual(new Date("2026-11-01T00:00:00Z"));
    const appel = generateDocument.mock.calls[0]![0] as {
      buildElement: (n: string) => React.ReactElement<{ data: MandatOpcoData }>;
    };
    expect(appel.buildElement("X").props.data.action.numeroConvention).toBe("AXI-DOC-2026-119");
  });
});

describe("🔴 le bouton « Générer le mandat OPCO » suit le financement", () => {
  afterEach(cleanup);

  function rendre(financement: "direct" | "opco" | "mixte" | "cpf" | null) {
    cleanup();
    render(
      <DocumentsSection
        sessionId={SESSION_ID}
        enrollments={[]}
        documentsExistants={[]}
        contexte={{ financement, typeClient: "entreprise", statut: "planifiee" }}
      />,
    );
  }

  it("absent sans dossier OPCO ni mixte (direct, CPF, non renseigné)", () => {
    for (const f of ["direct", "cpf", null] as const) {
      rendre(f);
      expect(screen.queryByRole("button", { name: "Générer le mandat OPCO" })).toBeNull();
    }
  });

  it("présent sur une session OPCO ou mixte", () => {
    for (const f of ["opco", "mixte"] as const) {
      rendre(f);
      expect(screen.getByRole("button", { name: "Générer le mandat OPCO" })).toBeTruthy();
    }
  });
});
