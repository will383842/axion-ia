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
    // 🔴 2026-09-07 — le journal des envois (preuve de sollicitation, ind. 30)
    // entre désormais dans le dossier. Sans ce modèle au double, l'accès
    // `prisma.emailLog` lève, le fail-soft l'attrape, et un dossier
    // PARFAITEMENT sain repart avec un avertissement : un test rouge sur du
    // code juste.
    //
    // 🔑 C'est ce fichier-là qui l'a montré, pas les témoins du nouveau code :
    // le double d'un test ne modélise que ce que son auteur connaissait le jour
    // où il l'a écrit. Ajouter une lecture au code, c'est ajouter une ligne à
    // tous les doubles qui le traversent — sinon leur silence passe pour un
    // verdict.
    emailLog: { findMany: vi.fn(async () => []) },
    // 🔴 2026-09-15 — même leçon, même endroit : la section « indicateur 10 »
    // lit au journal la DATE des réponses d'adaptation. Sans ce modèle, le
    // fail-soft l'attraperait et un dossier sain repartirait avec un
    // avertissement.
    activityLog: { findMany: vi.fn(async () => []) },
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

// 🔴 X-documents-pdf-01 (audit initial 2026-09-14) — le dossier joint désormais
// le TIRAGE À JOUR de la feuille d'émargement, rendu par le même chemin que
// l'écran. Ce chemin est testé dans `documents/emargement-tirage.spec.ts` ; ici
// on teste ce que le DOSSIER en fait.
vi.mock("@/server/qualiopi/documents/emargement-tirage", () => ({
  rendreTirageEmargementAJour: vi.fn(),
}));

// 🔴 2026-08-24, cahier D9 — le dossier vérifie désormais la TROISIÈME famille
// de chaînes : celle des pièces contractuelles. Sa logique est testée dans
// `documents/signature/registre-verification.spec.ts` ; ici on la double, comme
// `construireFeuillePdf`, pour tester ce que le DOSSIER en fait.
//
// Défaut par défaut : `null` — « cette pièce ne porte aucune signature ». C'est
// le cas des fixtures existantes, et il ne doit ni compter au dénominateur ni
// lever d'anomalie.
vi.mock("@/server/qualiopi/documents/signature/registre-verification", () => ({
  verifierChaineDocument: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "@/lib/prisma";
import { isR2Configured, getObjectBufferR2 } from "@/lib/r2-storage";
import { construireFeuillePdf } from "@/server/qualiopi/emargement/feuille-pdf";
import { verifierChaineDocument } from "@/server/qualiopi/documents/signature/registre-verification";
import { rendreTirageEmargementAJour } from "@/server/qualiopi/documents/emargement-tirage";
import { genererDossierSessionZip } from "./dossier-session";
import { calculerSelfHash, type TupleSignatureV1 } from "@/server/qualiopi/emargement/hash";

const mockFindUnique = (
  prisma as unknown as { trainingSession: { findUnique: ReturnType<typeof vi.fn> } }
).trainingSession.findUnique;
const mockDocsAnnulees = (
  prisma as unknown as { documentGenere: { findMany: ReturnType<typeof vi.fn> } }
).documentGenere.findMany;
const mockEmailLogFindMany = (
  prisma as unknown as { emailLog: { findMany: ReturnType<typeof vi.fn> } }
).emailLog.findMany;
const mockR2Ok = isR2Configured as unknown as ReturnType<typeof vi.fn>;
const mockGetBuffer = getObjectBufferR2 as unknown as ReturnType<typeof vi.fn>;
const mockFeuille = construireFeuillePdf as unknown as ReturnType<typeof vi.fn>;
const mockVerifierChaineDocument = verifierChaineDocument as unknown as ReturnType<typeof vi.fn>;
const mockTirage = rendreTirageEmargementAJour as unknown as ReturnType<typeof vi.fn>;
/** Mention imprimée sur un tirage sans feuille au registre. */
const MENTION_SANS_ORIGINE =
  "Tirage à jour du 14/09/2026 à 15:32 (heure de Paris) — aucune feuille d'émargement émise au registre pour cette session";

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
    // Colonne NULLABLE en base. `null` par défaut, comme la majorité du
    // registre : la mention du financeur ne doit jamais s'inventer un payeur.
    financementType: null as string | null,
    dateDebut: new Date("2026-06-10T09:00:00Z"),
    dateFin: new Date("2026-06-10T17:00:00Z"),
    documents: [],
    enrollments: [
      {
        id: "enr-1",
        tauxPresencePct: 100,
        // Override du payeur POUR CE PARTICIPANT (R-INTER). `null` = pas
        // d'override : l'inscription relève du `financementType` de la session,
        // qui est le comportement d'avant le 2026-09-17.
        financementType: null as string | null,
        trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null },
        // Créneaux de présence (provenance, `G-prerequis-02`). Vide par défaut :
        // la fixture ne modélise que la chaîne de signatures.
        presences: [],
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
  // Journal des envois vide par défaut : la fixture ne modélise aucun e-mail,
  // et c'est le cas qui doit lever l'avertissement de sollicitation manquante.
  mockEmailLogFindMany.mockResolvedValue([]);
  // Journal d'activité vide : aucune réponse d'adaptation datée (ind. 10).
  (
    prisma as unknown as { activityLog: { findMany: ReturnType<typeof vi.fn> } }
  ).activityLog.findMany.mockResolvedValue([]);
  mockR2Ok.mockReturnValue(true);
  mockGetBuffer.mockResolvedValue(Buffer.from("%PDF-"));
  // `null` = « cette pièce ne porte aucune signature », le cas d'une convocation
  // ou d'un livret d'accueil. Reposé ici : `clearAllMocks` efface les valeurs de
  // retour posées dans la fabrique du `vi.mock`.
  mockVerifierChaineDocument.mockResolvedValue(null);
  mockFeuille.mockResolvedValue({
    intituleFormation: "Bien démarrer avec l'IA",
    numeroSession: "AXI-SESS-2026-001",
    journees: [{ dateLisible: "mercredi 10 juin 2026", lignes: [] }],
    totalSignatures: 2,
  });
  mockTirage.mockResolvedValue({
    ok: true,
    buffer: Buffer.from("%PDF-tirage-a-jour"),
    numeroOrigine: null,
    numeroSession: "AXI-SESS-2026-001",
    totalSignatures: 2,
    mention: MENTION_SANS_ORIGINE,
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
    // 🔴 2026-08-20 (`D3-3-01`) — n'exige plus AUCUN avertissement. La fixture
    // par défaut n'a aucune contresignature de formateur, ce qui en lève un
    // désormais. L'assertion d'origine était exacte sur son objet (l'intégrité
    // des chaînes) mais elle verrouillait un SILENCE qui n'était pas mérité :
    // le dossier ne disait rien d'une pièce manquante.
    // 🔴 2026-09-07 — même raisonnement, second cas. Le dossier porte désormais
    // le journal des envois (preuve de sollicitation, ind. 30), et la fixture
    // par défaut n'a aucun envoi : l'avertissement est MÉRITÉ. L'exiger absent
    // verrouillerait de nouveau un silence — exactement ce que la note de 08-20
    // reprochait à l'assertion d'origine. Ce cas porte sur l'INTÉGRITÉ DES
    // CHAÎNES, pas sur la complétude du dossier ; deux tests dédiés couvrent
    // l'avertissement d'envoi plus bas.
    expect(
      res?.avertissements.filter((a) => !a.includes("contresignature") && !a.includes("envoi")),
    ).toEqual([]);

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
            presences: [],
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

  it("🔴 DÉTECTE une chaîne rompue sur une PIÈCE CONTRACTUELLE", async () => {
    // 🔴 2026-08-24, cahier D9 — la troisième famille, qui n'était vérifiée par
    // RIEN. L'en-tête de ce module promet pourtant « la VÉRIFICATION
    // D'INTÉGRITÉ de chaque chaîne de signatures », et le bouton qui déclenche
    // le dossier le promet aussi.
    //
    // Une convention signée dont la chaîne aurait été rompue sortait du ZIP avec
    // le `[OK]` de son PDF et aucun verdict : le dossier avait l'air complet.
    //
    // 🔑 `verifierChaineDocument` existait déjà, écrite et testée — elle n'avait
    // simplement AUCUN appelant de production.
    mockVerifierChaineDocument.mockResolvedValue({
      valide: false,
      anomalies: [{ type: "empreinte_invalide", signatureId: "sig-doc-1" }],
      nbVerifies: 2,
    });
    // ⚠️ Une pièce doit exister, sinon la boucle de vérification ne tourne pas
    // et ce test passerait au vert sans rien mesurer.
    mockFindUnique.mockResolvedValue(
      session({
        documents: [
          {
            id: "doc-1",
            type: "convention",
            numero: "AXI-CONV-2026-001",
            createdAt: new Date("2026-06-01T09:00:00Z"),
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    // L'anomalie est ÉCRITE, pas seulement comptée.
    expect(
      res?.avertissements.join(" "),
      "une chaîne de signatures de pièce contractuelle est rompue et le dossier " +
        "ne le dit pas. C'est l'engagement contractuel lui-même qui n'est plus " +
        "opposable — plus grave qu'un émargement douteux.",
    ).toContain("pièces contractuelles");

    const rapport = await fichierDuZip(res!.base64, "verification-integrite.json");
    expect(JSON.parse(rapport!).piecesContractuelles[0].integrite).toBe("ANOMALIE");
  });

  it("une pièce SANS signature n'est ni une anomalie ni un dénominateur", async () => {
    // 🔑 Contre-témoin. `verifierChaineDocument` rend `null` pour une pièce qui
    // ne porte aucune signature — ce qui est le cas normal d'une convocation ou
    // d'un livret d'accueil. La compter au dénominateur referait le défaut
    // « 0/0 conformes » corrigé par `D3-3-01` : un ratio complet sur du vide se
    // lit « tout va bien ».
    mockVerifierChaineDocument.mockResolvedValue(null);
    // ⚠️ Une pièce doit exister, sinon la boucle de vérification ne tourne pas
    // et ce test passerait au vert sans rien mesurer.
    mockFindUnique.mockResolvedValue(
      session({
        documents: [
          {
            id: "doc-1",
            type: "convention",
            numero: "AXI-CONV-2026-001",
            createdAt: new Date("2026-06-01T09:00:00Z"),
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    expect(
      res?.avertissements.join(" "),
      "une pièce non signée est comptée comme une anomalie d'intégrité.",
    ).not.toContain("pièces contractuelles");

    const rapport = await fichierDuZip(res!.base64, "verification-integrite.json");
    expect(
      JSON.parse(rapport!).piecesContractuelles,
      "une pièce sans signature entre au dénominateur du ratio d'intégrité.",
    ).toEqual([]);
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
            presences: [],
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
            presences: [],
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

  it("🔴 D3-3-01 — ne dit JAMAIS « 0/0 conformes » : le vide est NOMMÉ", async () => {
    // Dans un dossier remis au certificateur, un ratio complet est le signe
    // qu'on cherche. Personne ne s'arrête sur un dénominateur nul : l'absence
    // TOTALE de contresignature prenait l'apparence d'une conformité parfaite.
    //
    // 🔑 Le témoin était même MEILLEUR quand la situation était pire — zéro
    // anomalie sur zéro chaîne.
    const res = await genererDossierSessionZip("s-1");
    const index = await fichierDuZip(res!.base64, "index.txt");

    expect(index, "« 0/0 conformes » est de retour").not.toContain("0/0 conformes");
    expect(index).toContain("AUCUNE contresignature de formateur au dossier");
  });

  it("🔴 D3-3-01 — l'absence de contresignature lève un AVERTISSEMENT", async () => {
    // La nommer dans l'index ne suffit pas : c'est la liste d'avertissements que
    // l'on relit avant de remettre le dossier. Et la contresignature n'est
    // exigée par AUCUNE garde en amont — c'est ici, et nulle part ailleurs, que
    // son absence se voit.
    const res = await genererDossierSessionZip("s-1");
    expect(res?.avertissements.join(" ")).toContain("Aucune contresignature de formateur");
  });

  it("se tait dès qu'une contresignature existe", async () => {
    // Témoin de non-vacuité : sans lui, un avertissement inconditionnel ferait
    // passer les deux cas ci-dessus sans rien prouver de leur condition.
    mockFindUnique.mockResolvedValue(
      session({
        emargementContresignatures: [
          {
            trainerId: "t-1",
            formateurNom: "Luc Bernard",
            selfHash: "h1",
            prevHash: null,
            sessionId: "s-1",
            signeAt: new Date("2026-06-10T17:00:00Z"),
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("s-1");
    expect(res?.avertissements.join(" ")).not.toContain("Aucune contresignature");
    const index = await fichierDuZip(res!.base64, "index.txt");
    expect(index).toContain("Intégrité des chaînes de contresignatures :");
    expect(index).not.toContain("AUCUNE contresignature");
  });

  /**
   * 🔴 LE CERTIFICATEUR ET LE FINANCEUR NE LISENT PAS LA MÊME CHOSE.
   *
   * La section « contresignatures » disait l'intégrité des chaînes — la
   * question du CERTIFICATEUR. Elle ne disait rien de la question du
   * FINANCEUR : « cette pièce conditionne-t-elle mon règlement ? ». Et c'est
   * celle qui coûte de l'argent, parce qu'elle ne se découvre qu'au refus.
   *
   * ⚠️ Le libellé doit rester HONNÊTE : contractuel, variable d'un financeur à
   * l'autre, à confirmer. Un dossier remis à un auditeur qui écrirait
   * « obligatoire » ferait chercher un texte qui n'existe pas.
   */
  describe("mention du FINANCEUR dans la section contresignatures", () => {
    /**
     * ⚠️ On lit LA LIGNE, pas l'index entier.
     *
     * L'index se termine par les AVERTISSEMENTS, qui portent eux aussi la
     * mention du financeur quand aucune contresignature n'existe. Chercher
     * « OPCO » n'importe où dans le fichier passerait donc au vert même si la
     * ligne dédiée disparaissait — un témoin satisfait par une autre source
     * que celle qu'il prétend surveiller. Mesuré : la mutation « retirer la
     * ligne » ne faisait alors rougir qu'un test sur quatre.
     */
    const ligneContresignature = (index: string | null): string =>
      (index ?? "").split("\n").find((l) => l.startsWith("Contresignature du formateur")) ?? "";

    it("dit que le financeur la réclamera quand un tiers paie", async () => {
      mockFindUnique.mockResolvedValue(session({ financementType: "opco" }));
      const res = await genererDossierSessionZip("s-1");
      const ligne = ligneContresignature(await fichierDuZip(res!.base64, "index.txt"));
      expect(ligne).toContain("OPCO");
      expect(ligne.toLowerCase()).toContain("contractuel");
    });

    it("le dit aussi pour le CPF, France Travail et un financement mixte", async () => {
      for (const [financement, attendu] of [
        ["cpf", "CPF"],
        ["france_travail", "France Travail"],
        ["mixte", "OPCO"],
      ] as const) {
        mockFindUnique.mockResolvedValue(session({ financementType: financement }));
        const res = await genererDossierSessionZip("s-1");
        const ligne = ligneContresignature(await fichierDuZip(res!.base64, "index.txt"));
        expect(ligne, `financement ${financement}`).toContain(attendu);
      }
    });

    it("n'invente AUCUN financeur sur une session en financement direct", async () => {
      // Témoin de non-vacuité de la règle : si la mention était
      // inconditionnelle, les deux tests ci-dessus ne prouveraient rien.
      mockFindUnique.mockResolvedValue(session({ financementType: "direct" }));
      const res = await genererDossierSessionZip("s-1");
      const index = await fichierDuZip(res!.base64, "index.txt");
      expect(index).not.toContain("OPCO");
      expect(index).not.toContain("France Travail");
      // Et il dit quand même ce qu'il en est : le silence total laisserait
      // croire que la question n'a pas été posée.
      expect(index?.toLowerCase()).toContain("directement par le client");
    });

    it("🔴 un SEUL inscrit en OPCO suffit : l'index n'affirme plus l'absence", async () => {
      // 🔴 R-INTER — LA FAUTE QUI A FAIT REFUSER LA PR, ET SON PIRE ENDROIT.
      //
      // Une session inter-entreprises se crée en `direct` par défaut
      // (`sessions.ts`), et la facturation se fait PAR PARTICIPANT. Ne lire que
      // `session.financementType` faisait écrire « aucun financeur tiers ne
      // réclame de pièce » dans `index.txt` — c'est-à-dire dans la pièce même
      // que l'organisme dépose chez l'OPCO de cet inscrit. Ce n'est pas un
      // silence : c'est une AFFIRMATION D'ABSENCE, et elle était fausse.
      //
      // ⚠️ La population est ce qui donne à ce témoin le pouvoir de voir :
      // la session reste `direct`, c'est l'INSCRIPTION qui porte l'override.
      mockFindUnique.mockResolvedValue(
        session({
          financementType: "direct",
          enrollments: [
            {
              id: "enr-1",
              tauxPresencePct: 100,
              financementType: "opco",
              trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null },
              presences: [],
              emargementSignatures: chaineSaine(),
            },
          ],
        }),
      );
      const res = await genererDossierSessionZip("s-1");
      const ligne = ligneContresignature(await fichierDuZip(res!.base64, "index.txt"));
      // Bornée À LA LIGNE, comme les autres témoins de ce bloc : les
      // avertissements de fin d'index portent eux aussi le nom du financeur, et
      // chercher partout ferait passer au vert une ligne disparue.
      expect(ligne).not.toContain("aucun financeur tiers ne réclame de pièce");
      expect(ligne).toContain("OPCO");
    });

    it("n'écrit jamais « obligatoire » ni « exigé par la loi »", async () => {
      for (const financement of ["opco", "cpf", "france_travail", "mixte", "direct"] as const) {
        mockFindUnique.mockResolvedValue(session({ financementType: financement }));
        const res = await genererDossierSessionZip("s-1");
        const index = (await fichierDuZip(res!.base64, "index.txt"))?.toLowerCase() ?? "";
        // Bornée à la ligne de contresignature : le reste de l'index parle
        // d'autres pièces, dont certaines SONT réglementaires.
        const ligneFinanceur =
          index.split("\n").find((l) => l.includes("contresignature du formateur")) ?? "";
        expect(ligneFinanceur, `financement ${financement}`).not.toContain("obligatoire");
        expect(ligneFinanceur, `financement ${financement}`).not.toContain("exigé par la loi");
        expect(ligneFinanceur, `financement ${financement}`).not.toContain("réglementaire");
      }
    });

    it("renforce l'AVERTISSEMENT d'absence quand un tiers finance", async () => {
      // La liste d'avertissements est ce qu'on relit avant de remettre le
      // dossier. Une absence de contresignature sur un dossier OPCO n'est pas
      // du même ordre qu'une absence sur un dossier payé par le client.
      mockFindUnique.mockResolvedValue(session({ financementType: "opco" }));
      const res = await genererDossierSessionZip("s-1");
      const avert = res?.avertissements.join(" ") ?? "";
      expect(avert).toContain("Aucune contresignature de formateur");
      expect(avert).toContain("OPCO");
    });

    it("n'ajoute PAS de mention de financeur à l'avertissement en direct", async () => {
      mockFindUnique.mockResolvedValue(session({ financementType: "direct" }));
      const avert = (await genererDossierSessionZip("s-1"))?.avertissements.join(" ") ?? "";
      expect(avert).toContain("Aucune contresignature de formateur");
      expect(avert).not.toContain("OPCO");
    });
  });

  /**
   * 🔴 LE JOURNAL DES ENVOIS — la preuve de SOLLICITATION (ind. 30), 2026-09-07.
   *
   * L'indicateur 30 n'exige pas que le stagiaire RÉPONDE — on ne peut pas l'y
   * contraindre. Il exige que l'organisme ait DEMANDÉ, et relancé. Ce que
   * l'auditeur regarde est donc la trace de la sollicitation, et elle ne
   * figurait nulle part dans le dossier remis : il fallait ouvrir la console en
   * séance et filtrer un écran à la main, adresse par adresse.
   */
  describe("journal des envois", () => {
    it("🔴 l'absence d'envoi est un AVERTISSEMENT, pas un silence", async () => {
      // Une session dont aucune trace d'envoi n'existe est un dossier auquel il
      // manque la preuve la plus demandée. Le taire le ferait passer pour
      // complet — et c'est en séance que le trou apparaîtrait.
      const res = await genererDossierSessionZip("s-1");
      expect(res?.avertissements.join(" ")).toContain("preuve de sollicitation");
    });

    it("joint le journal au ZIP et se tait dès qu'un envoi existe", async () => {
      // Témoin de non-vacuité : sans lui, un avertissement inconditionnel ferait
      // passer le cas ci-dessus sans rien prouver de sa condition.
      mockEmailLogFindMany.mockResolvedValue([
        {
          createdAt: new Date("2026-06-11T08:00:00Z"),
          template: "qualiopi-satisfaction-j1",
          recipient: "stagiaire@exemple.fr",
          status: "sent",
          bounceType: null,
          entityType: "Enrollment",
          entityId: "enr-1",
        },
      ]);

      const res = await genererDossierSessionZip("s-1");
      expect(res?.avertissements.join(" ")).not.toContain("preuve de sollicitation");

      const journal = await fichierDuZip(res!.base64, "journal-envois.csv");
      expect(journal).toContain("qualiopi-satisfaction-j1");
      expect(journal).toContain("stagiaire@exemple.fr");
      // Le journal doit DIRE ce qu'il n'est pas : un lecteur ne doit pas y
      // chercher le contenu des messages, qui n'y est pas et n'y sera jamais.
      expect(journal).toContain("ni sujet, ni texte");
    });
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
            presences: [],
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

  /**
   * 🔴 X-documents-pdf-01 (audit initial 2026-09-14) — la feuille d'émargement
   * du registre est un INSTANTANÉ : tirée avant la session (c'est l'usage), elle
   * porte à vie « Signatures enregistrées au tirage : 0 ». C'était la seule
   * feuille en PDF du dossier remis à l'auditrice ; les signatures réelles n'y
   * figuraient qu'en JSON.
   */
  describe("feuille d'émargement À JOUR", () => {
    // Émise le 31/07 à 01:30 heure de Paris — la veille en UTC.
    const emargement = {
      id: "doc-em",
      type: "emargement",
      numero: "AXI-DOC-2026-004",
      createdAt: new Date("2026-07-30T23:30:00Z"),
    };
    const MENTION =
      "Réimpression à jour du 14/09/2026 à 15:32 (heure de Paris) — pièce d'origine : AXI-DOC-2026-004, émise le 31/07/2026";

    it("🔴 joint le TIRAGE À JOUR — celui de l'écran, qui se déclare réimpression — à côté de la pièce figée", async () => {
      mockFindUnique.mockResolvedValue(session({ documents: [emargement] }));
      mockTirage.mockResolvedValue({
        ok: true,
        buffer: Buffer.from("%PDF-tirage-a-jour"),
        numeroOrigine: "AXI-DOC-2026-004",
        numeroSession: "AXI-SESS-2026-001",
        totalSignatures: 2,
        mention: MENTION,
      });

      const res = await genererDossierSessionZip("ses-1");
      const zip = await JSZip.loadAsync(res!.base64, { base64: true });

      const tirage = zip.file("documents/emargement/AXI-DOC-2026-004-a-jour.pdf");
      expect(
        tirage,
        "le dossier ne contient que l'instantané figé de la feuille d'émargement : " +
          "tirée avant la session, elle affiche 0 signature devant l'auditrice.",
      ).not.toBeNull();
      expect(await tirage!.async("string")).toBe("%PDF-tirage-a-jour");
      // 🔴 Le MÊME rendu que « Télécharger la feuille à jour » : même chemin, même
      // population d'inscriptions (aucun second argument qui l'élargirait).
      expect(mockTirage).toHaveBeenCalledWith("ses-1");
      // La pièce scellée du registre reste jointe, intacte.
      expect(zip.file("documents/emargement/AXI-DOC-2026-004.pdf")).not.toBeNull();

      const index = await fichierDuZip(res!.base64, "index.txt");
      expect(index).toContain("AXI-DOC-2026-004-a-jour.pdf");
      expect(index).toContain(MENTION);
      // Date de la pièce scellée en heure de PARIS, pas en UTC.
      expect(index).toContain("instantané scellé du 2026-07-31");
      // La règle de population est DITE.
      expect(index).toContain("droit à l'effacement");
    });

    it("joint le tirage à jour même sans feuille émise au registre", async () => {
      const res = await genererDossierSessionZip("ses-1");
      const zip = await JSZip.loadAsync(res!.base64, { base64: true });
      expect(zip.file("documents/emargement/emargement-a-jour.pdf")).not.toBeNull();
      const index = await fichierDuZip(res!.base64, "index.txt");
      expect(index).toContain(MENTION_SANS_ORIGINE);
    });

    it("🔴 un tirage impossible à rendre lève un AVERTISSEMENT, pas un silence", async () => {
      mockFindUnique.mockResolvedValue(session({ documents: [emargement] }));
      mockTirage.mockRejectedValue(new Error("police introuvable"));

      const res = await genererDossierSessionZip("ses-1");

      expect(res?.incomplet).toBe(true);
      expect(res?.avertissements.join(" ")).toContain("tirage à jour");
      const zip = await JSZip.loadAsync(res!.base64, { base64: true });
      expect(zip.file("documents/emargement/AXI-DOC-2026-004-a-jour.pdf")).toBeNull();
    });
  });

  /**
   * 🔴 X-mode-auditeur-05 / G-lieu-05 (audit initial 2026-09-14) — le dossier
   * remis à l'auditrice embarquait des pièces d'EMPLOYEUR et de rémunération
   * (contrat de travail, autofacture d'honoraires) qui ne prouvent aucun
   * indicateur du RNQ. Enjeu RGPD (minimisation, art. 5 §1 c) : elles restent
   * au registre, elles ne sortent pas dans le dossier de preuves.
   */
  describe("pièces RH et de rémunération", () => {
    const documents = [
      { id: "d-conv", type: "convention", numero: "AXI-DOC-2026-010", createdAt: new Date() },
      { id: "d-ct", type: "contrat_travail", numero: "AXI-DOC-2026-011", createdAt: new Date() },
      {
        id: "d-af",
        type: "autofacture_honoraires",
        numero: "AXI-DOC-2026-012",
        createdAt: new Date(),
      },
    ];

    it("🔴 ne joint NI le contrat de travail NI l'autofacture, et le DIT", async () => {
      mockFindUnique.mockResolvedValue(session({ documents }));

      const res = await genererDossierSessionZip("ses-1");
      const zip = await JSZip.loadAsync(res!.base64, { base64: true });

      expect(zip.file("documents/convention/AXI-DOC-2026-010.pdf")).not.toBeNull();
      expect(
        zip.file(/contrat_travail|autofacture_honoraires|AXI-DOC-2026-011|AXI-DOC-2026-012/),
        "le dossier remis à l'auditrice embarque un contrat de travail ou une autofacture.",
      ).toHaveLength(0);
      // Aucun octet de ces pièces n'est même téléchargé.
      const clesDemandees = mockGetBuffer.mock.calls.map((c) => String(c[0]));
      expect(clesDemandees.some((c) => c.includes("AXI-DOC-2026-011"))).toBe(false);
      expect(clesDemandees.some((c) => c.includes("AXI-DOC-2026-012"))).toBe(false);

      // Ni comptées comme pièces attendues — le dossier n'est pas « amputé »…
      // 🔴 …mais comptées EXACTEMENT : en base, jointes, écartées (constat n° 6).
      expect(res?.nbDocuments).toBe(3);
      expect(res?.nbDocumentsHorsDossier).toBe(2);
      expect(res?.nbDocumentsJoints).toBe(1);
      // …ni tues : l'index dit combien restent au registre, sans les nommer.
      const index = await fichierDuZip(res!.base64, "index.txt");
      expect(index).not.toContain("AXI-DOC-2026-011");
      expect(index).not.toContain("AXI-DOC-2026-012");
      expect(index).toContain("2 pièces RH, de rémunération ou de facturation");
    });

    it("🔴 ne joint NI facture NI avoir, et le DIT — mais JOINT le devis (ind. 4 et 6)", async () => {
      // Facture et avoir : aucune exigence du RNQ, et une facture à un
      // particulier nomme une personne physique et ce qu'elle a payé. Ils
      // restent au registre. Le devis, lui, peut prouver l'analyse du besoin
      // antérieure à la convention (arbitrage du 14/09).
      mockFindUnique.mockResolvedValue(
        session({
          documents: [
            documents[0],
            { id: "d-fa", type: "facture", numero: "AXI-DOC-2026-013", createdAt: new Date() },
            { id: "d-de", type: "devis", numero: "AXI-DOC-2026-014", createdAt: new Date() },
            { id: "d-av", type: "avoir", numero: "AXI-DOC-2026-015", createdAt: new Date() },
          ],
        }),
      );

      const res = await genererDossierSessionZip("ses-1");
      const zip = await JSZip.loadAsync(res!.base64, { base64: true });

      expect(zip.file("documents/convention/AXI-DOC-2026-010.pdf")).not.toBeNull();
      expect(
        zip.file(/documents\/(facture|avoir)\//),
        "le dossier remis à l'auditrice embarque une facture ou un avoir.",
      ).toHaveLength(0);
      expect(
        zip.file("documents/devis/AXI-DOC-2026-014.pdf"),
        "le devis, preuve possible de l'analyse du besoin (ind. 4 et 6), a disparu du dossier.",
      ).not.toBeNull();
      expect(res?.nbDocuments).toBe(4);
      expect(res?.nbDocumentsHorsDossier).toBe(2);
      expect(res?.nbDocumentsJoints).toBe(2);
      const index = await fichierDuZip(res!.base64, "index.txt");
      expect(index).not.toContain("AXI-DOC-2026-013");
      expect(index).toContain("2 pièces RH, de rémunération ou de facturation");
    });

    it("n'en tire aucune ligne au journal des envois ni à la vérification d'intégrité", async () => {
      mockFindUnique.mockResolvedValue(session({ documents }));
      await genererDossierSessionZip("ses-1");

      const idsVerifies = mockVerifierChaineDocument.mock.calls.map((c) => c[0]);
      expect(idsVerifies).toEqual(["d-conv"]);
      const where = mockEmailLogFindMany.mock.calls[0]![0] as {
        where: { entityId: { in: string[] } };
      };
      expect(where.where.entityId.in).not.toContain("d-ct");
      expect(where.where.entityId.in).not.toContain("d-af");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 2026-09-14 — `G-prerequis-02` : la PROVENANCE des présences au dossier.
//
// Le dossier ne rendait, par stagiaire, que `tauxPresencePct` et `nbSignatures`.
// Un taux de 100 % tapé à la main dans la grille se lisait donc comme un taux de
// 100 % émargé : rien, dans le paquet remis au certificateur, ne distinguait une
// déclaration de l'organisme d'une signature du stagiaire.
// ─────────────────────────────────────────────────────────────────────────────

describe("genererDossierSessionZip — provenance des présences (G-prerequis-02)", () => {
  it("🔴 une présence déclarée à la main est NOMMÉE, jamais comptée comme signée", async () => {
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null },
            presences: [
              { present: true, importId: null, emargementSignatures: [] },
              { present: true, importId: null, emargementSignatures: [] },
            ],
            emargementSignatures: [],
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    const rapport = JSON.parse((await fichierDuZip(res!.base64, "verification-integrite.json"))!);
    expect(
      rapport.signatures[0],
      "le dossier ne dit pas que ces présences sont des déclarations sans signature",
    ).toMatchObject({ nbSignatures: 0, presencesSignees: 0, presencesDeclareesSansSignature: 2 });
    expect(res?.avertissements.join(" ")).toContain("déclarée");
    expect(await fichierDuZip(res!.base64, "index.txt")).toContain("à la main sans signature");
  });

  it("contre-témoin : une présence SIGNÉE n'est pas rangée parmi les déclarations", async () => {
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null },
            presences: [
              { present: true, importId: null, emargementSignatures: [{ id: "sig-1" }] },
              { present: true, importId: null, emargementSignatures: [{ id: "sig-2" }] },
            ],
            emargementSignatures: chaineSaine(),
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    const rapport = JSON.parse((await fichierDuZip(res!.base64, "verification-integrite.json"))!);
    expect(rapport.signatures[0]).toMatchObject({
      presencesSignees: 2,
      presencesDeclareesSansSignature: 0,
    });
    expect(res?.avertissements.join(" ")).not.toContain("déclarée");
  });

  it("🔴 revue A09 §1 — un créneau importé où le stagiaire était ABSENT n'est pas « issu d'un relevé »", async () => {
    // Relevé à 0 min sur deux demi-journées, connecté sur une : UNE présence.
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 33,
            trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null },
            presences: [
              { present: true, importId: "imp-1", emargementSignatures: [] },
              { present: false, importId: "imp-1", emargementSignatures: [] },
              { present: false, importId: "imp-1", emargementSignatures: [] },
            ],
            emargementSignatures: [],
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    const rapport = JSON.parse((await fichierDuZip(res!.base64, "verification-integrite.json"))!);
    expect(
      rapport.signatures[0].presencesReleveConnexion,
      "le dossier compte des ABSENCES du relevé comme des présences issues du relevé",
    ).toBe(1);
    expect(await fichierDuZip(res!.base64, "index.txt")).toContain(
      "1 issu d'un relevé de connexion",
    );
  });

  it("🔴 revue A09 §6 — un créneau importé COCHÉ À LA MAIN est compté déclaré, pas « issu d'un relevé »", async () => {
    // Un créneau mesuré par la plateforme, un autre créé à 0 min par l'import
    // puis coché dans la grille (`source: manuel`, `importId` conservé).
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null },
            presences: [
              { present: true, importId: "imp-1", source: "import_zoom", emargementSignatures: [] },
              { present: true, importId: "imp-1", source: "manuel", emargementSignatures: [] },
            ],
            emargementSignatures: [],
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    const rapport = JSON.parse((await fichierDuZip(res!.base64, "verification-integrite.json"))!);
    expect(
      rapport.signatures[0],
      "le dossier présente une présence tapée à la main comme mesurée par la plateforme",
    ).toMatchObject({ presencesReleveConnexion: 1, presencesDeclareesSansSignature: 1 });
    expect(res?.avertissements.join(" ")).toContain("déclarée");
  });

  // ── 🔴 Indicateur 10 (2026-09-15) ────────────────────────────────────────
  // Le dossier ne disait rien, stagiaire par stagiaire, de la RÉPONSE de
  // l'organisme à un besoin d'adaptation déclaré, ni de sa date.

  it("🔴 ind. 10 : un besoin déclaré SANS réponse consignée est écrit dans l'index ET averti", async () => {
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            adaptationsRealisees: null,
            questionnaires: [{ reponses: { besoinAdaptation: true } }],
            trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null, situationHandicap: false },
            presences: [],
            emargementSignatures: chaineSaine(),
          },
        ],
      }),
    );

    const res = await genererDossierSessionZip("ses-1");

    const index = (await fichierDuZip(res!.base64, "index.txt"))!;
    expect(index).toContain("indicateur 10");
    expect(index).toContain("Alice Dupont — besoin déclaré — AUCUNE RÉPONSE CONSIGNÉE");
    expect(res?.avertissements.join(" ")).toContain("indicateur 10");
  });

  it("ind. 10 : la réponse consignée est datée au journal et située avant le début", async () => {
    mockFindUnique.mockResolvedValue(
      session({
        enrollments: [
          {
            id: "enr-1",
            tauxPresencePct: 100,
            adaptationsRealisees: "Échange avec le bénéficiaire : aucune adaptation nécessaire.",
            questionnaires: [{ reponses: { besoinAdaptation: true } }],
            trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null, situationHandicap: false },
            presences: [],
            emargementSignatures: chaineSaine(),
          },
        ],
      }),
    );
    (
      prisma as unknown as { activityLog: { findMany: ReturnType<typeof vi.fn> } }
    ).activityLog.findMany.mockResolvedValueOnce([
      {
        targetId: "enr-1",
        createdAt: new Date("2026-06-09T08:00:00Z"),
        changes: { adaptationsRenseignees: true, reponse: "aucune_adaptation_necessaire" },
      },
    ]);

    const res = await genererDossierSessionZip("ses-1");

    const index = (await fichierDuZip(res!.base64, "index.txt"))!;
    expect(index).toMatch(/Alice Dupont — besoin déclaré — réponse consignée le .*avant le début/);
    expect(index).toContain("aucune adaptation nécessaire après échange");
    expect(res?.avertissements.join(" ")).not.toContain("indicateur 10");
  });
});
