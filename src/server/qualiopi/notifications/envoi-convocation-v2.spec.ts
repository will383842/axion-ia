/**
 * Chantier QNC, L05 — envoyerConvocation derrière `qualiopi.convocation_v2.actif`.
 *
 *   - éteint : la convocation actuelle, INCHANGÉE (ni lecture du socle, ni pièce
 *     jointe, ni lien d'accès supplémentaire) ;
 *   - essai  : la v2 n'agit que sur le banc d'essai, et ses envois portent le
 *     drapeau d'essai (exclus des chiffres réels) ;
 *   - actif  : retenue sans convention signée / avec adaptation non traitée ;
 *     pièces produites AVANT l'envoi, jointes en PDF, `envoye_at` posé APRÈS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentFindUnique = vi.fn();
const enrollmentUpdate = vi.fn(async (_a: unknown) => ({}));
const activityCreate = vi.fn(async (_a: unknown) => ({}));
const clientFindUnique = vi.fn();
const enqueueEmail = vi.fn(
  async (..._a: unknown[]) => ({ enqueued: true }) as Record<string, unknown>,
);
const creerAcces = vi.fn(async (_t: string) => ({
  id: "1a2b3c4d-1111-4222-8333-444455556666",
  token: "t".repeat(64),
  expiresAt: new Date(),
}));
const etat = vi.fn(async () => "eteint");
const evaluerBlocage = vi.fn();
const journaliserRetenue = vi.fn(async (..._a: unknown[]) => undefined);
const assurerPieces = vi.fn();
const marquerEnvoyees = vi.fn(async (..._a: unknown[]) => undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findUnique: (a: unknown) => enrollmentFindUnique(a),
      update: (a: unknown) => enrollmentUpdate(a),
    },
    activityLog: { create: (a: unknown) => activityCreate(a) },
    client: { findUnique: (a: unknown) => clientFindUnique(a) },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  creerAcces: (t: string) => creerAcces(t),
}));
vi.mock("@/server/qualiopi/emargement/token-service", () => ({ creerTokenInscription: vi.fn() }));
vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  creerQuestionnaire: vi.fn(),
  emettreLienQuestionnaire: vi.fn(),
}));
vi.mock("@/server/qualiopi/adaptation/automatique/remises", () => ({
  consignesConvocationPourInscription: async () => null,
}));
vi.mock("@/server/qualiopi/convocation-v2/interrupteur", async () => ({
  ...(await vi.importActual<object>("@/server/qualiopi/convocation-v2/interrupteur")),
  etatConvocationV2: () => etat(),
}));
vi.mock("@/server/qualiopi/convocation-v2/blocage", async () => ({
  ...(await vi.importActual<object>("@/server/qualiopi/convocation-v2/blocage")),
  evaluerBlocageConvocation: (...a: unknown[]) => evaluerBlocage(...a),
  journaliserRetenue: (...a: unknown[]) => journaliserRetenue(...a),
}));
vi.mock("@/server/qualiopi/convocation-v2/pieces", async () => ({
  ...(await vi.importActual<object>("@/server/qualiopi/convocation-v2/pieces")),
  assurerPiecesConvocation: (...a: unknown[]) => assurerPieces(...a),
  marquerPiecesEnvoyees: (...a: unknown[]) => marquerEnvoyees(...a),
}));

import { envoyerConvocation } from "./notifications-service";
import {
  libelleModalite,
  libelleModaliteMinuscule,
  modaliteLabel,
  modaliteLabelLower,
} from "@/server/qualiopi/documents/libelles-enumerations";
import { formatModalitesFr } from "@/content/formations/catalog-v2-facts";

function inscription(
  over: {
    essai?: boolean;
    modalite?: string;
    visio?: string | null;
    inter?: boolean;
    clientInscription?: string | null;
  } = {},
) {
  return {
    id: "e1",
    adaptationsRealisees: null,
    estTestInterne: over.essai ?? false,
    clientId: over.clientInscription === undefined ? "c1" : over.clientInscription,
    trainee: { id: "t1", email: "stagiaire@exemple.fr", nom: "Durand", prenom: "Alice" },
    session: {
      id: "s1",
      estTestInterne: false,
      interEntreprises: over.inter ?? false,
      clientId: "c1",
      numero: "AXI-SESS-2026-001",
      titreSession: "IA au quotidien",
      dateDebut: new Date("2026-11-10T08:00:00Z"),
      dateFin: new Date("2026-11-11T16:00:00Z"),
      modalite: over.modalite ?? "presentiel",
      lieuType: null,
      lieuIntitule: null,
      lieuAdresse: null,
      lieuCodePostal: null,
      lieuVille: null,
      lieuSalle: null,
      lieuVisioUrl: over.visio ?? null,
    },
  };
}

const PIECES = [
  ["convocation", "d-conv", "AXI-DOC-2026-010"],
  ["programme", "d-prog", "AXI-DOC-2026-011"],
  ["reglement_interieur", "d-ri", "AXI-DOC-2026-012"],
  ["livret_accueil", "d-livret", "AXI-DOC-2026-013"],
].map(([type, documentId, numero]) => ({
  documentId,
  type,
  numero,
  nomFichier: `${numero} - ${type}.pdf`,
  r2Key: `documents/2026/${type}/${numero}.pdf`,
}));

const LIBRE = { decision: { autorisee: true, motifs: [] }, essai: false };

beforeEach(() => {
  vi.clearAllMocks();
  etat.mockResolvedValue("eteint");
  evaluerBlocage.mockResolvedValue(LIBRE);
  assurerPieces.mockResolvedValue({ ok: true, pieces: PIECES });
  enqueueEmail.mockResolvedValue({ enqueued: true });
  enrollmentFindUnique.mockResolvedValue(inscription());
});

describe("éteint : rien ne change", () => {
  it("convocation actuelle : aucune pièce jointe, aucune évaluation, aucun ajout au payload", async () => {
    expect(await envoyerConvocation("e1")).toBe(true);

    expect(evaluerBlocage).not.toHaveBeenCalled();
    expect(assurerPieces).not.toHaveBeenCalled();
    expect(marquerEnvoyees).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
    expect(clientFindUnique).not.toHaveBeenCalled();

    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const [, , , payload, options] = enqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(options).not.toHaveProperty("attachments");
    for (const cle of [
      "piecesJointes",
      "outilVisio",
      "lienVisio",
      "numeroAcces",
      "copieEntreprise",
    ]) {
      expect(payload).not.toHaveProperty(cle);
    }
    expect(enrollmentUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("actif : l'envoi est BLOQUÉ", () => {
  beforeEach(() => etat.mockResolvedValue("actif"));

  it("sans convention entièrement signée : rien ne part, rien n'est daté, aucun accès semé", async () => {
    evaluerBlocage.mockResolvedValue({
      decision: { autorisee: false, motifs: ["convention_non_signee"] },
      essai: false,
    });

    expect(await envoyerConvocation("e1")).toBe(false);

    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(enrollmentUpdate).not.toHaveBeenCalled();
    expect(creerAcces).not.toHaveBeenCalled();
    expect(assurerPieces).not.toHaveBeenCalled();
    expect(journaliserRetenue).toHaveBeenCalledWith("e1", ["convention_non_signee"], false);
  });

  it("avec un besoin d'adaptation non traité : même retenue, motif propre", async () => {
    evaluerBlocage.mockResolvedValue({
      decision: { autorisee: false, motifs: ["adaptation_non_traitee"] },
      essai: false,
    });

    expect(await envoyerConvocation("e1")).toBe(false);

    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(enrollmentUpdate).not.toHaveBeenCalled();
    expect(journaliserRetenue).toHaveBeenCalledWith("e1", ["adaptation_non_traitee"], false);
  });

  it("une pièce qui ne peut pas être jointe retient l'envoi (jamais parti sans la pièce annoncée)", async () => {
    assurerPieces.mockResolvedValue({ ok: false, motif: "Livret d'accueil non produite : x" });

    expect(await envoyerConvocation("e1")).toBe(false);

    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(enrollmentUpdate).not.toHaveBeenCalled();
  });
});

describe("actif : pièces produites AVANT l'envoi, jointes, datées APRÈS", () => {
  beforeEach(() => etat.mockResolvedValue("actif"));

  it("l'ordre : pièces → envoi → envoye_at", async () => {
    expect(await envoyerConvocation("e1")).toBe(true);

    const ordre = (m: { mock: { invocationCallOrder: number[] } }) =>
      m.mock.invocationCallOrder[0]!;
    expect(ordre(assurerPieces)).toBeLessThan(ordre(enqueueEmail));
    expect(ordre(enqueueEmail)).toBeLessThan(ordre(marquerEnvoyees));

    expect(assurerPieces).toHaveBeenCalledWith({
      enrollmentId: "e1",
      sessionId: "s1",
      traineeId: "t1",
    });
    const [, , , , options] = enqueueEmail.mock.calls[0] as [
      string,
      string,
      string,
      unknown,
      { attachments: { filename: string; r2Key: string; contentType: string }[] },
    ];
    expect(options.attachments).toHaveLength(4);
    expect(options.attachments.every((a) => a.contentType === "application/pdf")).toBe(true);
    expect(options.attachments.map((a) => a.r2Key)).toEqual(PIECES.map((p) => p.r2Key));

    const [ids, instant] = marquerEnvoyees.mock.calls[0] as [string[], Date];
    expect(ids).toEqual(["d-conv", "d-prog", "d-ri", "d-livret"]);
    expect(instant).toBeInstanceOf(Date);
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "qualiopi.convocation.envoyee_v2",
        targetId: "e1",
        changes: expect.objectContaining({ essai: false }),
      }),
    });
  });

  it("file indisponible : AUCUNE pièce n'est datée « envoyée »", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: false });

    expect(await envoyerConvocation("e1")).toBe(false);

    expect(marquerEnvoyees).not.toHaveBeenCalled();
    expect(enrollmentUpdate).not.toHaveBeenCalled();
  });

  it("le courriel porte la liste des pièces et le numéro d'accès", async () => {
    await envoyerConvocation("e1");
    const payload = enqueueEmail.mock.calls[0]![3] as Record<string, unknown>;
    expect(payload["piecesJointes"]).toEqual([
      "convocation",
      "programme de formation",
      "règlement intérieur",
      "livret d'accueil",
    ]);
    expect(payload["numeroAcces"]).toBe("ACC-1A2B3C4D");
  });

  it("distanciel : l'outil et le lien partent par le courriel", async () => {
    enrollmentFindUnique.mockResolvedValue(
      inscription({ modalite: "distanciel", visio: "https://us02web.zoom.us/j/123" }),
    );
    await envoyerConvocation("e1");
    const payload = enqueueEmail.mock.calls[0]![3] as Record<string, unknown>;
    expect(payload["outilVisio"]).toBe("Zoom");
    expect(payload["lienVisio"]).toBe("https://us02web.zoom.us/j/123");
    expect(payload).not.toHaveProperty("mentionLienVisio");
  });

  it("distanciel, champ vide : « Lien envoyé avant la formation »", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ modalite: "distanciel", visio: null }));
    await envoyerConvocation("e1");
    const payload = enqueueEmail.mock.calls[0]![3] as Record<string, unknown>;
    expect(payload["outilVisio"]).toBe("Zoom");
    expect(payload["mentionLienVisio"]).toBe("Lien envoyé avant la formation");
    expect(payload).not.toHaveProperty("lienVisio");
  });

  it("hybride : la partie à distance a aussi son outil", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ modalite: "hybride", visio: null }));
    await envoyerConvocation("e1");
    const payload = enqueueEmail.mock.calls[0]![3] as Record<string, unknown>;
    expect(payload["outilVisio"]).toBe("Zoom");
  });

  it("présentiel : aucune mention de visioconférence", async () => {
    await envoyerConvocation("e1");
    const payload = enqueueEmail.mock.calls[0]![3] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("outilVisio");
  });
});

describe("essai : exclu des chiffres réels", () => {
  beforeEach(() => etat.mockResolvedValue("essai"));

  it("une inscription RÉELLE garde la convocation actuelle (v2 n'agit pas)", async () => {
    expect(await envoyerConvocation("e1")).toBe(true);

    expect(evaluerBlocage).not.toHaveBeenCalled();
    expect(assurerPieces).not.toHaveBeenCalled();
    expect(marquerEnvoyees).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
    const options = enqueueEmail.mock.calls[0]![4] as Record<string, unknown>;
    expect(options).not.toHaveProperty("attachments");
  });

  it("une inscription du banc d'essai passe en v2, et son envoi porte le drapeau d'essai", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ essai: true }));
    evaluerBlocage.mockResolvedValue({ ...LIBRE, essai: true });

    expect(await envoyerConvocation("e1")).toBe(true);

    expect(assurerPieces).toHaveBeenCalledTimes(1);
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ changes: expect.objectContaining({ essai: true }) }),
    });
  });
});

describe("copie à l'entreprise : automatique avec la v2", () => {
  beforeEach(() => {
    etat.mockResolvedValue("actif");
    clientFindUnique.mockResolvedValue({ contactEmail: "rh@entreprise.fr" });
  });

  it("v2 éteinte : un seul courriel, au stagiaire, sans lecture du client", async () => {
    etat.mockResolvedValue("eteint");
    await envoyerConvocation("e1");
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(clientFindUnique).not.toHaveBeenCalled();
  });

  it("essai : copie pour une inscription du banc d'essai, pas pour les autres", async () => {
    etat.mockResolvedValue("essai");
    await envoyerConvocation("e1");
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    enqueueEmail.mockClear();
    enrollmentFindUnique.mockResolvedValue(inscription({ essai: true }));
    await envoyerConvocation("e1");
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
  });

  it("v2 active : copie automatique SANS lien personnel ni donnée de santé, passée en validation", async () => {
    await envoyerConvocation("e1");

    expect(enqueueEmail).toHaveBeenCalledTimes(2);
    const [template, to, , payload, options] = enqueueEmail.mock.calls[1] as [
      string,
      string,
      string,
      Record<string, unknown>,
      { exigerValidation: boolean; attachments: { filename: string }[] },
    ];
    expect(template).toBe("qualiopi-convocation");
    expect(to).toBe("rh@entreprise.fr");
    expect(payload["copieEntreprise"]).toBe(true);
    for (const cle of [
      "lienPortail",
      "numeroAcces",
      "amenagements",
      "lienVisio",
      "adaptations",
      "consignes",
    ]) {
      expect(payload).not.toHaveProperty(cle);
    }
    expect(options.exigerValidation).toBe(true);
    expect(options.attachments).toHaveLength(2);
  });

  it("l'échec de la copie ne défait pas l'envoi au stagiaire", async () => {
    enqueueEmail
      .mockResolvedValueOnce({ enqueued: true })
      .mockRejectedValueOnce(new Error("file en panne"));
    expect(await envoyerConvocation("e1")).toBe(true);
  });
});

describe("copie à l'entreprise : jamais au client d'une session inter pour un participant sans employeur", () => {
  beforeEach(() => {
    etat.mockResolvedValue("actif");
    clientFindUnique.mockResolvedValue({ contactEmail: "rh@autre-entreprise.fr" });
  });

  it("inter, sans employeur : un seul courriel (au stagiaire), aucune lecture du client", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ inter: true, clientInscription: null }));
    expect(await envoyerConvocation("e1")).toBe(true);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(enqueueEmail.mock.calls[0]![1]).toBe("stagiaire@exemple.fr");
    expect(clientFindUnique).not.toHaveBeenCalled();
  });

  it("inter, avec employeur B : copie à B seulement", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ inter: true, clientInscription: "c-b" }));
    await envoyerConvocation("e1");
    expect(clientFindUnique.mock.calls[0]![0]).toMatchObject({ where: { id: "c-b" } });
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
  });

  it("intra, sans client sur l'inscription : repli sur le client de la session", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ inter: false, clientInscription: null }));
    await envoyerConvocation("e1");
    expect(clientFindUnique.mock.calls[0]![0]).toMatchObject({ where: { id: "c1" } });
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
  });
});

describe("modalité hybride : un seul libellé", () => {
  it("le courriel porte le libellé commun, en bas de casse", async () => {
    etat.mockResolvedValue("actif");
    enrollmentFindUnique.mockResolvedValue(inscription({ modalite: "hybride" }));
    await envoyerConvocation("e1");
    const payload = enqueueEmail.mock.calls[0]![3] as Record<string, unknown>;
    expect(payload["modalite"]).toBe(libelleModaliteMinuscule("hybride"));
    expect(payload["modalite"]).toMatch(/^hybride/);
  });

  it("courriel, convocation, convention et site disent la même chose", () => {
    const commun = libelleModalite("hybride");
    expect(commun).toBe("Hybride (présentiel et distanciel)");
    expect(modaliteLabel("hybride")).toBe(commun);
    expect(modaliteLabelLower("hybride")).toBe(libelleModaliteMinuscule("hybride"));
    expect(formatModalitesFr(["hybride"])).toBe(commun);
    // « présentiel OU distanciel » ne s'appelle plus « hybride ».
    expect(formatModalitesFr(["presentiel", "distanciel"])).not.toMatch(/hybride/i);
  });
});

describe("trace de l'envoi : destinataire, canal et accès remis", () => {
  it("la ligne de journal porte l'accès dont le numéro a été remis au stagiaire", async () => {
    etat.mockResolvedValue("actif");
    await envoyerConvocation("e1");
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: expect.objectContaining({
          destinataire: "stagiaire",
          canal: "email",
          accesId: "1a2b3c4d-1111-4222-8333-444455556666",
        }),
      }),
    });
  });
});
