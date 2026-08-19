/**
 * Tests — dossier-session.ts
 *
 * Ce module est le SEUL chemin par lequel la vérification d'intégrité des
 * chaînes de signatures devient atteignable depuis l'application. Ce qu'il doit
 * garantir tient en une phrase : **un dossier amputé ou suspect ne doit jamais
 * avoir l'air complet**.
 *
 * Livrer silencieusement à un auditeur un ZIP sans ses preuves est pire que de
 * ne rien livrer : personne n'ira vérifier ce qui manque.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn() },
    // Les pièces ANNULÉES sont lues à part : elles ne doivent pas entrer dans la
    // relation qui alimente le ZIP, mais le dossier doit quand même les NOMMER.
    documentGenere: { findMany: vi.fn() },
  },
}));

// `documentPdfKey` reste RÉEL — cf. audit-dossier.spec.ts : la clé est ce que
// ces tests vérifient, la doubler reviendrait à tester la copie.
vi.mock("@/lib/r2-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2-storage")>()),
  isR2Configured: vi.fn(),
  getObjectBufferR2: vi.fn(),
}));

vi.mock("@/server/qualiopi/emargement/feuille-pdf", () => ({
  construireFeuillePdf: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { isR2Configured, getObjectBufferR2 } from "@/lib/r2-storage";
import { construireFeuillePdf } from "@/server/qualiopi/emargement/feuille-pdf";
import { genererDossierSessionZip } from "./dossier-session";
import { calculerSelfHash, type TupleSignatureV1 } from "@/server/qualiopi/emargement/hash";

const mockFindUnique = (
  prisma as unknown as { trainingSession: { findUnique: ReturnType<typeof vi.fn> } }
).trainingSession.findUnique;
const mockDocsAnnulees = (
  prisma as unknown as { documentGenere: { findMany: ReturnType<typeof vi.fn> } }
).documentGenere.findMany;
const mockR2Ok = isR2Configured as unknown as ReturnType<typeof vi.fn>;
const mockGetBuffer = getObjectBufferR2 as unknown as ReturnType<typeof vi.fn>;
const mockFeuille = construireFeuillePdf as unknown as ReturnType<typeof vi.fn>;

/** Tuple d'une signature, tel que le service l'écrit. */
function tuple(prevHash: string | null, over: Partial<TupleSignatureV1> = {}): TupleSignatureV1 {
  return {
    contexteType: "collectif",
    enrollmentId: "enr-1",
    creneauId: "cre-1",
    coachingId: null,
    date: "2026-06-10",
    demiJournee: "matin",
    heureDebut: "09:00",
    heureFin: "12:30",
    formationIntitule: "Bien démarrer avec l'IA",
    modules: ["Module 1"],
    formateurNom: "Williams Jullin",
    signataireNom: "Alice Dupont",
    signataireEmail: "alice@example.test",
    methode: "canvas",
    signatureSha256: "a".repeat(64),
    signeAtIso: "2026-06-10T10:15:30.123Z",
    ipHash: null,
    userAgentSha256: null,
    mentionVersion: "v1",
    prevHash,
    ...over,
  };
}

/** Ligne de base correspondant à un tuple. */
function ligne(t: TupleSignatureV1, id: string, selfHash: string) {
  return {
    id,
    contexteType: t.contexteType,
    enrollmentId: t.enrollmentId,
    coachingId: t.coachingId,
    creneauId: t.creneauId,
    signataireNom: t.signataireNom,
    signataireEmail: t.signataireEmail,
    date: new Date(`${t.date}T00:00:00.000Z`),
    demiJournee: t.demiJournee,
    heureDebut: t.heureDebut,
    heureFin: t.heureFin,
    formateurNom: t.formateurNom,
    formationIntitule: t.formationIntitule,
    modulesSnapshot: t.modules,
    methode: t.methode,
    // Colonne toujours présente en base (null en modalité accessible). Sans elle,
    // la re-vérification d'image (M2) tenterait un download sur `undefined`.
    signatureKey: null as string | null,
    signatureSha256: t.signatureSha256,
    signeAt: new Date(t.signeAtIso),
    ipHash: t.ipHash,
    userAgentSha256: t.userAgentSha256,
    mentionVersion: t.mentionVersion,
    prevHash: t.prevHash,
    selfHash,
    hashVersion: 1,
  };
}

/** Chaîne saine de deux signatures. */
function chaineSaine() {
  const t1 = tuple(null);
  const h1 = calculerSelfHash(t1);
  const t2 = tuple(h1, { demiJournee: "apres_midi", creneauId: "cre-2" });
  const h2 = calculerSelfHash(t2);
  return [ligne(t1, "sig-1", h1), ligne(t2, "sig-2", h2)];
}

function session(over: Record<string, unknown> = {}) {
  return {
    numero: "AXI-SESS-2026-001",
    titreSession: "Bien démarrer avec l'IA",
    dateDebut: new Date("2026-06-10T09:00:00Z"),
    dateFin: new Date("2026-06-10T17:00:00Z"),
    documents: [],
    enrollments: [
      {
        id: "enr-1",
        tauxPresencePct: 100,
        trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null },
        emargementSignatures: chaineSaine(),
      },
    ],
    emargementContresignatures: [],
    ...over,
  };
}

/** Contenu texte d'une entrée du ZIP produit. */
async function fichierDuZip(base64: string, chemin: string): Promise<string | null> {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const f = zip.file(chemin);
  return f === null ? null : f.async("string");
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour : toute
  // valeur par défaut se repose ici, sinon elle fuit d'un test à l'autre.
  mockFindUnique.mockResolvedValue(session());
  mockDocsAnnulees.mockResolvedValue([]);
  mockR2Ok.mockReturnValue(true);
  mockGetBuffer.mockResolvedValue(Buffer.from("%PDF-"));
  mockFeuille.mockResolvedValue({
    intituleFormation: "Bien démarrer avec l'IA",
    numeroSession: "AXI-SESS-2026-001",
    journees: [{ dateLisible: "mercredi 10 juin 2026", lignes: [] }],
    totalSignatures: 2,
  });
});

describe("genererDossierSessionZip", () => {
  it("retourne null sur une session introuvable", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await genererDossierSessionZip("inconnue")).toBeNull();
  });

  it("porte le NUMÉRO de session dans le nom du fichier", async () => {
    // C'est l'objet même de ce dossier : le retrouver sans avoir à l'ouvrir.
    const res = await genererDossierSessionZip("ses-1");
    expect(res?.filename).toBe("dossier-session-AXI-SESS-2026-001");
  });

  it("déclare CONFORME une chaîne de signatures intacte", async () => {
    const res = await genererDossierSessionZip("ses-1");
    expect(res?.nbChainesAnormales).toBe(0);
    expect(res?.avertissements).toEqual([]);

    const rapport = await fichierDuZip(res!.base64, "verification-integrite.json");
    expect(JSON.parse(rapport!).signatures[0]).toMatchObject({ integrite: "OK", nbSignatures: 2 });
  });

  it("🔴 DÉTECTE une signature modifiée après coup", async () => {
    // Ce que ferait un UPDATE en base : le contenu change, l'empreinte non.
    const lignes = chaineSaine();
    lignes[1] = { ...lignes[1]!, heureFin: "18:00" };
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            trainee: { nom: "Dupont", prenom: "Alice" },
            emargementSignatures: lignes,
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    expect(res?.nbChainesAnormales).toBe(1);
    // 🔴 Et surtout : l'anomalie est ÉCRITE, pas seulement comptée. Un dossier
    // dont les empreintes ne concordent pas ne doit pas avoir l'air normal.
    expect(res?.avertissements.join(" ")).toContain("intégrité");
    const rapport = await fichierDuZip(res!.base64, "verification-integrite.json");
    expect(JSON.parse(rapport!).signatures[0].integrite).toBe("ANOMALIE");
  });

  it("🔴 DÉTECTE la suppression d'un maillon du milieu", async () => {
    const lignes = chaineSaine();
    // On retire le premier : le second pointe alors sur un prédécesseur absent.
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            trainee: { nom: "Dupont", prenom: "Alice" },
            emargementSignatures: [lignes[1]],
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");
    expect(res?.nbChainesAnormales).toBe(1);
  });

  it("🔴 SIGNALE qu'aucune feuille conforme n'est produisible sans journées déclarées", async () => {
    mockFeuille.mockResolvedValue(null);
    const res = await genererDossierSessionZip("ses-1");

    expect(res?.incomplet).toBe(true);
    expect(res?.avertissements.join(" ")).toContain("journées");
    expect(await fichierDuZip(res!.base64, "feuille-emargement.json")).toBeNull();
  });

  it("🔴 SIGNALE des documents en base dont AUCUN PDF n'est joignable", async () => {
    // Le cas le plus dangereux : un ZIP d'apparence complète, vide de preuves.
    mockFindUnique.mockResolvedValue(
      session({
        documents: [
          { id: "d1", type: "convention", numero: "AXI-FORM-2026-001", createdAt: new Date() },
        ],
      }),
    );
    mockGetBuffer.mockResolvedValue(null);

    const res = await genererDossierSessionZip("ses-1");

    expect(res?.nbDocuments).toBe(1);
    expect(res?.nbDocumentsJoints).toBe(0);
    expect(res?.incomplet).toBe(true);
    const index = await fichierDuZip(res!.base64, "index.txt");
    expect(index).toContain("[ABSENT]");
  });

  it("SIGNALE un stockage R2 non configuré plutôt que de livrer les seuls registres", async () => {
    mockR2Ok.mockReturnValue(false);
    mockFindUnique.mockResolvedValue(
      session({
        documents: [
          { id: "d1", type: "convention", numero: "AXI-FORM-2026-001", createdAt: new Date() },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    expect(res?.incomplet).toBe(true);
    expect(res?.avertissements.join(" ")).toContain("R2");
    expect(mockGetBuffer).not.toHaveBeenCalled();
  });

  it("lit les signatures dans l'ordre d'INSERTION, jamais de `signeAt`", async () => {
    // Trier sur `signeAt` produirait une rupture de chaînage FANTÔME : il est
    // figé avant l'écriture de l'image, donc deux onglets peuvent commiter dans
    // l'ordre inverse. Un faux verdict de corruption, dans un dossier d'audit.
    await genererDossierSessionZip("ses-1");
    const arg = mockFindUnique.mock.calls[0]![0] as {
      select: { enrollments: { select: { emargementSignatures: { orderBy: unknown } } } };
    };
    expect(arg.select.enrollments.select.emargementSignatures.orderBy).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });

  it("retourne null en mode build (stub)", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      expect(await genererDossierSessionZip("ses-1")).toBeNull();
      expect(mockFindUnique).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = original;
    }
  });

  it("🔴 H3 — n'exclut PAS l'inscription sous droit à l'effacement (ne filtre pas deletedAt)", async () => {
    await genererDossierSessionZip("ses-1");
    const arg = mockFindUnique.mock.calls[0]![0] as {
      select: { enrollments: { where?: unknown } };
    };
    // La requête ne doit PAS porter de filtre `trainee.deletedAt: null` :
    // les signatures conservées (art. 17 §3 b) restent justifiables à l'audit.
    expect(arg.select.enrollments.where).toBeUndefined();
  });

  it("🔴 H3 — inclut la chaîne d'un stagiaire effacé (nom anonymisé) et le SIGNALE", async () => {
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            // Anonymisé par supprimerStagiaire + deletedAt posé.
            trainee: { nom: "[supprime]", prenom: "[supprime]", deletedAt: new Date() },
            emargementSignatures: chaineSaine(),
          },
        ],
      }),
    );
    const res = await genererDossierSessionZip("ses-1");
    expect(res?.nbChainesAnormales).toBe(0);
    const rapport = await fichierDuZip(res!.base64, "verification-integrite.json");
    const parsed = JSON.parse(rapport!);
    expect(parsed.signatures[0].effaceRgpd).toBe(true);
    expect(parsed.signatures[0].integrite).toBe("OK");
    // Aucune PII fuitée (nom déjà anonymisé), mais l'inscription est bien comptée.
    expect(parsed.signatures[0].stagiaire).toContain("effacement");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Pièces ANNULÉES — « une pièce annulée ne se compte NULLE PART »
  //
  // Doctrine posée par `audit-dossier.ts` : glisser dans un dossier d'audit,
  // sans marquage, une pièce que l'organisme a lui-même annulée revient à la
  // présenter comme preuve. Ce ZIP-ci l'annonçait « [OK] » et la comptait.
  // ───────────────────────────────────────────────────────────────────────────

  it("🔴 la relation `documents` EXCLUT les pièces annulées", async () => {
    await genererDossierSessionZip("ses-1");
    const arg = mockFindUnique.mock.calls[0]![0] as {
      select: { documents: { where?: unknown } };
    };
    expect(arg.select.documents.where).toEqual({ annuleeAt: null });
  });

  it("🔴 une pièce annulée n'est ni jointe ni comptée, et le dossier la NOMME", async () => {
    // Le retrait doit rester VISIBLE : sans la section dédiée, on remplacerait
    // un mensonge (« [OK] ») par un silence, qui n'est pas plus honnête.
    mockDocsAnnulees.mockResolvedValue([
      {
        numero: "AXI-DOC-2026-003",
        type: "convention",
        annuleeAt: new Date("2026-08-12T09:00:00Z"),
        annuleeMotif: "Destinataire erroné, convention réémise",
      },
    ]);

    const res = await genererDossierSessionZip("ses-1");

    expect(res?.nbDocuments).toBe(0);
    expect(res?.nbDocumentsAnnulees).toBe(1);
    const index = await fichierDuZip(res!.base64, "index.txt");
    expect(index).toContain("Pièces annulées, non jointes");
    expect(index).toContain("AXI-DOC-2026-003");
    expect(index).toContain("Destinataire erroné, convention réémise");
    // Et surtout : aucun PDF de cette pièce dans le ZIP.
    const zip = await JSZip.loadAsync(res!.base64, { base64: true });
    expect(zip.file(/AXI-DOC-2026-003/)).toHaveLength(0);
  });

  it("🔴 une session dont TOUTES les pièces sont annulées n'accuse pas le stockage R2", async () => {
    // L'avertissement « X documents en base mais AUCUN PDF joint » vise une
    // panne de stockage. Le déclencher ici enverrait chercher une panne qui
    // n'existe pas : il n'y a simplement plus rien à joindre.
    mockDocsAnnulees.mockResolvedValue([
      {
        numero: "AXI-DOC-2026-003",
        type: "convention",
        annuleeAt: new Date("2026-08-12T09:00:00Z"),
        annuleeMotif: "Destinataire erroné, convention réémise",
      },
    ]);

    const res = await genererDossierSessionZip("ses-1");

    // Le dossier dit bien qu'il y avait une pièce…
    const index = await fichierDuZip(res!.base64, "index.txt");
    expect(index).toContain("Pièces annulées, non jointes");
    // …sans pour autant faire porter le chapeau au stockage.
    expect(res?.avertissements.join(" ")).not.toContain("AUCUN PDF joint");
  });

  it("🔴 M2 — signale une IMAGE de signature qui ne correspond plus à son condensat scellé", async () => {
    const chaine = chaineSaine();
    // Une signature avec image sur R2 (clé non nulle) : M2 doit re-télécharger.
    chaine[0] = { ...chaine[0]!, signatureKey: "emargement/2026/signatures/sig-1.png" };
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null },
            emargementSignatures: chaine,
          },
        ],
      }),
    );
    // R2 renvoie des octets dont le SHA-256 ≠ signature_sha256 scellé.
    mockGetBuffer.mockImplementation(async (cle: string) =>
      cle.includes("signatures/") ? Buffer.from("octets-falsifies") : Buffer.from("%PDF-"),
    );

    const res = await genererDossierSessionZip("ses-1");
    expect(res?.incomplet).toBe(true);
    expect(res?.avertissements.join(" ")).toContain("condensat scellé");
    const rapport = await fichierDuZip(res!.base64, "verification-integrite.json");
    expect(JSON.parse(rapport!).signatures[0].imagesAlterees).toBeDefined();
  });
});
