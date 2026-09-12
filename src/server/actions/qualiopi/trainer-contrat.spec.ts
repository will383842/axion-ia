// @vitest-environment node

/**
 * Tests — `notifierContratTravailAction`, le message qui envoie un salarié lire
 * et signer son contrat de travail.
 *
 * ## Ce qui se joue ici, et pourquoi ce sont les REFUS qu'on teste
 *
 * Cette action écrit à une personne réelle, au sujet de la pièce la plus
 * engageante qu'on lui adresse. Un envoi n'est pas rattrapable : on ne peut pas
 * reprendre un message parti.
 *
 * Les cas nominaux sont faciles à voir à l'œil nu ; ce sont les refus qui se
 * perdent au premier remaniement, et chacun d'eux évite une situation précise :
 *
 *  · annoncer un contrat qui N'EXISTE PAS envoie quelqu'un ouvrir un espace
 *    vide — pire que le silence qu'on corrige, parce que le silence n'engage
 *    rien tandis que l'annonce fausse abîme la confiance dans ce qui suivra ;
 *  · annoncer un SPÉCIMEN l'envoie buter sur un refus de signature, sur le
 *    document le plus engageant qu'on lui adresse ;
 *  · écrire à un SOUS-TRAITANT lui affirmerait qu'il est salarié — la
 *    qualification juridique exacte que le contrat de sous-traitance existe
 *    pour ne pas avoir.
 *
 * ⚠️ Ce fichier ne teste PAS le gabarit d'e-mail : son texte et ses champs sont
 * gardés par `payloads-exemple.spec.ts` et les tests de familles. On vérifie ce
 * que l'action DÉCIDE, et ce qu'elle passe à la file.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrainerFindUnique = vi.fn();
const mockDocFindFirst = vi.fn();
const mockEnqueueEmail = vi.fn();
const mockLog = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findUnique: (...a: unknown[]) => mockTrainerFindUnique(...a) },
    documentGenere: { findFirst: (...a: unknown[]) => mockDocFindFirst(...a) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: () => Promise.resolve({ userId: "admin-1", role: "super_admin" }),
  requireAdminWrite: () => Promise.resolve({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => mockEnqueueEmail(...a),
}));

import { notifierContratTravailAction } from "./trainer-contrat";

const ID = "11111111-1111-4111-8111-111111111111";

function salarie(o: Record<string, unknown> = {}) {
  return {
    email: "camille@exemple.invalid",
    nom: "Martin",
    prenom: "Camille",
    statut: "salarie",
    actif: true,
    contratType: "cdi",
    contratPoste: "Formateur en intelligence artificielle",
    dateEmbauche: new Date("2026-10-01T00:00:00.000Z"),
    ...o,
  };
}

function piece(o: Record<string, unknown> = {}) {
  return { numero: "AXI-DOC-2026-050", metadata: {}, ...o };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTrainerFindUnique.mockResolvedValue(salarie());
  mockDocFindFirst.mockResolvedValue(piece());
  mockEnqueueEmail.mockResolvedValue({ enqueued: true });
  mockLog.mockResolvedValue(undefined);
});

describe("notifierContratTravailAction — le cas où le message part", () => {
  it("envoie au salarié, et rend son adresse", async () => {
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("data" in res && res.data.destinataire).toBe("camille@exemple.invalid");
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("🔑 le message nomme la PIÈCE, pas seulement le salarié", async () => {
    // Sans le numéro, le destinataire n'a aucune référence à citer si une
    // mention lui paraît fausse — et c'est précisément ce qu'on lui demande de
    // faire avant de signer.
    await notifierContratTravailAction({ trainerId: ID });
    const payload = mockEnqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["numeroPiece"]).toBe("AXI-DOC-2026-050");
    expect(payload["natureContrat"]).toBe("CDI");
    expect(payload["poste"]).toBe("Formateur en intelligence artificielle");
  });

  it("🔴 un CDD est annoncé comme tel, jamais comme un CDI", async () => {
    // La nature change ce que le salarié doit vérifier — un terme, un motif.
    // Lui annoncer « CDI » sur un CDD le ferait signer sans les chercher.
    mockTrainerFindUnique.mockResolvedValue(salarie({ contratType: "cdd" }));
    await notifierContratTravailAction({ trainerId: ID });
    const payload = mockEnqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["natureContrat"]).toBe("CDD");
  });

  it("🔑 l'envoi est RETROUVABLE : il porte l'entité du salarié", async () => {
    // C'est ce que l'écran relit pour afficher « prévenu le … ». Sans ces deux
    // champs, la trace existerait dans le journal des e-mails sans qu'aucune
    // surface ne sache la rattacher à ce salarié — et l'opérateur réenverrait
    // par prudence, ou n'enverrait rien en croyant que c'est fait.
    await notifierContratTravailAction({ trainerId: ID });
    const opts = mockEnqueueEmail.mock.calls[0]?.[4] as Record<string, unknown>;
    expect(opts["entityType"]).toBe("Trainer");
    expect(opts["entityId"]).toBe(ID);
  });

  it("⚠️ AUCUN jobId fixe : réenvoyer doit rester possible", async () => {
    // Un identifiant stable rendrait l'envoi idempotent, donc un SECOND envoi
    // serait silencieusement avalé — alors que réenvoyer est légitime : le
    // premier message s'est perdu, ou le contrat a été refait.
    await notifierContratTravailAction({ trainerId: ID });
    const opts = mockEnqueueEmail.mock.calls[0]?.[4] as Record<string, unknown>;
    expect(opts["jobId"]).toBeUndefined();
  });
});

describe("🔴 les refus — chacun évite une situation précise", () => {
  it("refuse un SOUS-TRAITANT : il n'a pas de contrat de travail", async () => {
    mockTrainerFindUnique.mockResolvedValue(salarie({ statut: "sous_traitant" }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/pas salarié/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("refuse un DIRIGEANT : il relève de son mandat social", async () => {
    mockTrainerFindUnique.mockResolvedValue(salarie({ statut: "dirigeant" }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res).toBe(true);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 refuse quand AUCUN contrat n'a été établi", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/Aucun contrat/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 refuse d'annoncer un SPÉCIMEN", async () => {
    // Le service de signature le rejette : l'annoncer enverrait le salarié
    // buter sur un refus, et le message dit le geste qui répare.
    mockDocFindFirst.mockResolvedValue(piece({ metadata: { specimen: true } }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/SPÉCIMEN/);
    expect("error" in res && res.error).toMatch(/convention collective/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔑 une métadonnée MALFORMÉE ne passe pas pour un spécimen", async () => {
    // ⚠️ `metadata` est une colonne Json : rien ne garantit sa forme. Un tableau
    // ou une chaîne ne doit pas bloquer l'envoi — on teste la forme plutôt que
    // de caster, et l'absence de marquage vaut « pas un spécimen ».
    mockDocFindFirst.mockResolvedValue(piece({ metadata: ["inattendu"] }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("data" in res).toBe(true);
  });

  it("refuse un compte DÉSACTIVÉ", async () => {
    // Il ne pourrait pas se connecter pour lire la pièce : le message
    // l'enverrait sur une porte fermée.
    mockTrainerFindUnique.mockResolvedValue(salarie({ actif: false }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/désactivé/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("refuse une adresse e-mail VIDE, en disant où la renseigner", async () => {
    mockTrainerFindUnique.mockResolvedValue(salarie({ email: "   " }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/adresse e-mail/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("refuse un formateur introuvable", async () => {
    mockTrainerFindUnique.mockResolvedValue(null);
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res).toBe(true);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 une file INDISPONIBLE rend une erreur, jamais un faux succès", async () => {
    // Le pire cas possible : annoncer « salarié prévenu » alors que rien n'est
    // parti. L'écran afficherait la trace, personne ne relancerait, et
    // l'intéressé attendrait un message qui n'existe pas.
    mockEnqueueEmail.mockResolvedValue({ enqueued: false });
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/n'a PAS été prévenu/i);
  });

  it("un message GARÉ en validation le dit, sans faire croire qu'il est parti", async () => {
    mockEnqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true });
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/garé/i);
  });
});
