/**
 * Chantier QNC, L11 — le chargement du dossier d'une session.
 *
 * Ce qui est gardé ici, et que la relecture sécurité vérifie :
 *   · AUCUNE FUITE ENTRE SESSIONS — chaque lecture est bornée par la session
 *     ou par des identifiants dérivés d'elle ; les e-mails par l'ENTITÉ ;
 *   · la DONNÉE DE SANTÉ n'est chargée que pour le référent handicap (les
 *     réponses du positionnement ne sont même pas lues pour un autre rôle) ;
 *   · l'original REMPLACÉ est gardé et étiqueté, l'annulé est nommé sans PDF,
 *     la pièce de facturation n'est pas reprise ;
 *   · le banc d'essai est étiqueté ;
 *   · une lecture qui échoue est DITE, jamais rendue comme « aucun ».
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn() },
    documentGenere: { findMany: vi.fn(async () => []) },
    emailLog: { findMany: vi.fn(async () => []) },
    remiseRetour: { findMany: vi.fn(async () => []) },
    relanceJournal: { findMany: vi.fn(async () => []) },
    moyenPedagogique: { findMany: vi.fn(async () => []) },
    reclamation: { findMany: vi.fn(async () => []) },
    questionnaire: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/features/admin-emails/query", () => ({
  idsLiesALaSession: vi.fn(async () => ["s1", "e1", "e2", "q1", "p1"]),
}));
vi.mock("@/server/qualiopi/adaptation/colonne-declaration", () => ({
  colonneDeclarationDisponible: vi.fn(async () => false),
}));
vi.mock("../adaptation-session", () => ({
  sectionIndicateur10Session: vi.fn(async () => ({
    lignes: [
      "Adaptations — indicateur 10 :",
      "  Alice Dupont — besoin déclaré — adaptation : « pauses »",
    ],
    nbAConsigner: 0,
  })),
}));

import { prisma } from "@/lib/prisma";
import { idsLiesALaSession } from "@/features/admin-emails/query";
import { sectionIndicateur10Session } from "../adaptation-session";
import { chargerDossierSession } from "../chargement";
import { inscriptionSurSessionTenue } from "../../conformite/piece-admissible";
import { MENTION_RESERVE_REFERENT } from "../blocs";

type Fn = ReturnType<typeof vi.fn>;
const p = prisma as unknown as Record<string, Record<string, Fn>>;

const SESSION = {
  numero: "AXI-SESS-2026-001",
  titreSession: "Bien démarrer avec l'IA",
  dateDebut: new Date("2026-06-10T07:00:00Z"),
  dateFin: new Date("2026-06-11T15:00:00Z"),
  estTestInterne: false,
  enrollments: [
    {
      id: "e1",
      traineeId: "t1",
      estTestInterne: false,
      adaptationsRealisees: "pauses",
      questionnaires: [{ id: "q1" }],
      trainee: { nom: "Dupont", prenom: "Alice", deletedAt: null, situationHandicap: true },
    },
    {
      id: "e2",
      traineeId: "t2",
      estTestInterne: true,
      adaptationsRealisees: null,
      questionnaires: [],
      trainee: { nom: "Martin", prenom: "Bob", deletedAt: null, situationHandicap: false },
    },
  ],
};

const piece = (over: Record<string, unknown>) => ({
  id: "p",
  type: "attestation",
  numero: "N",
  createdAt: new Date("2026-06-11T16:00:00Z"),
  envoyeAt: null,
  annuleeAt: null,
  annuleeMotif: null,
  remplaceeParNumero: null,
  metadata: {},
  traineeId: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  p["trainingSession"]!["findUnique"]!.mockResolvedValue(SESSION);
  p["documentGenere"]!["findMany"]!.mockResolvedValue([
    piece({
      id: "p0",
      numero: "AXI-ATT-2026-001",
      traineeId: "t1",
      remplaceeParNumero: "AXI-ATT-2026-002",
    }),
    piece({
      id: "p1",
      numero: "AXI-ATT-2026-002",
      traineeId: "t1",
      envoyeAt: new Date("2026-06-11T17:00:00Z"),
    }),
    piece({
      id: "p2",
      numero: "AXI-CONV-2026-001",
      type: "convention",
      annuleeAt: new Date("2026-06-01T10:00:00Z"),
      annuleeMotif: "erreur de dates",
    }),
    piece({ id: "p3", numero: "AXI-FAC-2026-001", type: "facture" }),
    piece({
      id: "p4",
      numero: "AXI-CONV-2026-002",
      type: "convention",
      metadata: { renderData: { data: { estSpecimen: true, specimenMotif: "NDA absent" } } },
    }),
  ]);
  p["emailLog"]!["findMany"]!.mockResolvedValue([
    {
      id: "m1",
      template: "qualiopi-convocation",
      recipient: "alice@example.test",
      status: "sent",
      bounceType: null,
      entityType: "Enrollment",
      entityId: "e1",
      sentAt: new Date("2026-06-03T08:00:00Z"),
      createdAt: new Date("2026-06-03T08:00:00Z"),
      contenu: {
        subject: "Votre convocation",
        html: "<p>x</p>",
        text: "Bonjour Alice",
        attachmentNames: [],
      },
    },
    {
      id: "m2",
      template: "qualiopi-convocation",
      recipient: "erased:0123456789abcdef@erased.local",
      status: "sent",
      bounceType: null,
      entityType: "Enrollment",
      entityId: "e2",
      sentAt: new Date("2026-06-03T08:00:00Z"),
      createdAt: new Date("2026-06-03T08:00:00Z"),
      contenu: null,
    },
    {
      id: "m3",
      template: "facture-envoi",
      recipient: "compta@example.test",
      status: "sent",
      bounceType: null,
      entityType: "DocumentGenere",
      entityId: "p3",
      sentAt: null,
      createdAt: new Date("2026-06-12T08:00:00Z"),
      contenu: null,
    },
  ]);
});

describe("🔒 aucune fuite entre sessions", () => {
  it("chaque lecture est bornée par la session ou ses identifiants", async () => {
    await chargerDossierSession("s1", { role: "admin" });
    expect(p["trainingSession"]!["findUnique"]!.mock.calls[0]![0].where).toEqual({ id: "s1" });
    expect(p["documentGenere"]!["findMany"]!.mock.calls[0]![0].where).toEqual({ sessionId: "s1" });
    expect(idsLiesALaSession).toHaveBeenCalledWith("s1");
    expect(p["emailLog"]!["findMany"]!.mock.calls[0]![0].where).toEqual({
      entityId: { in: ["s1", "e1", "e2", "q1", "p1"] },
    });
    expect(p["remiseRetour"]!["findMany"]!.mock.calls[0]![0].where).toEqual({ sessionId: "s1" });
    expect(p["relanceJournal"]!["findMany"]!.mock.calls[0]![0].where).toEqual({ sessionId: "s1" });
    expect(p["reclamation"]!["findMany"]!.mock.calls[0]![0].where).toEqual({
      enrollmentId: { in: ["e1", "e2"] },
    });
  });

  it("aucun rattachement e-mail : la liste VIDE ne lit rien, plutôt que tout le journal", async () => {
    (idsLiesALaSession as unknown as Fn).mockResolvedValueOnce([]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    expect(p["emailLog"]!["findMany"]).not.toHaveBeenCalled();
    expect(m?.elements.some((e) => e.nature === "email")).toBe(false);
  });

  it("une session inconnue rend null", async () => {
    p["trainingSession"]!["findUnique"]!.mockResolvedValueOnce(null);
    expect(await chargerDossierSession("inconnue", { role: "super_admin" })).toBeNull();
  });
});

describe("pièces : remplacée gardée, annulée nommée, facture écartée, non probante", () => {
  it("l'original remplacé est gardé, étiqueté, hors voyants, PDF sous documents/remplacees/", async () => {
    const m = await chargerDossierSession("s1", { role: "admin" });
    const p0 = m!.elements.find((e) => e.cle === "piece:p0")!;
    expect(p0.etiquettes).toContain("Remplacée par AXI-ATT-2026-002");
    expect(p0.horsVoyants).toBe(true);
    expect(p0.cheminPdf).toBe("documents/remplacees/attestation/AXI-ATT-2026-001.pdf");
    expect(p0.cleStockage).toBe("documents/2026/attestation/AXI-ATT-2026-001.pdf");
    expect(p0.details).toContain("Stagiaire : Alice Dupont");
  });

  it("la pièce en vigueur envoyée est rangée par e-mail, sous son destinataire", async () => {
    const m = await chargerDossierSession("s1", { role: "admin" });
    const p1 = m!.elements.find((e) => e.cle === "piece:p1")!;
    expect(p1.destinataire).toBe("stagiaire");
    expect(p1.canal).toBe("email");
    expect(p1.horsVoyants).toBe(false);
    expect(p1.cheminPdf).toBe("documents/attestation/AXI-ATT-2026-002.pdf");
  });

  it("l'annulée est nommée, sans PDF ; la facture n'est pas reprise mais comptée", async () => {
    const m = await chargerDossierSession("s1", { role: "admin" });
    const p2 = m!.elements.find((e) => e.cle === "piece:p2")!;
    expect(p2.cheminPdf).toBeNull();
    expect(p2.etiquettes.join(" ")).toContain("erreur de dates");
    expect(m!.elements.some((e) => e.cle === "piece:p3")).toBe(false);
    expect(m!.horsDossier).toEqual({ pieces: 1, emails: 1 });
  });

  it("badge « non probante » lu dans renderData", async () => {
    const m = await chargerDossierSession("s1", { role: "admin" });
    expect(m!.elements.find((e) => e.cle === "piece:p4")!.etiquettes).toContain(
      "Non probante — NDA absent",
    );
  });
});

describe("e-mails : contenu, adresse masquée, banc d'essai", () => {
  it("la copie est portée, l'adresse effacée est dite masquée, l'essai est étiqueté", async () => {
    const m = await chargerDossierSession("s1", { role: "admin" });
    const m1 = m!.elements.find((e) => e.cle === "email:m1")!;
    expect(m1.copie?.texte).toBe("Bonjour Alice");
    expect(m1.destinataire).toBe("stagiaire");
    expect(m1.essai).toBe(false);
    const m2 = m!.elements.find((e) => e.cle === "email:m2")!;
    expect(m2.details).toContain("Adressé à : [adresse masquée]");
    expect(m2.etiquettes).toContain("Copie du contenu non conservée");
    expect(m2.essai).toBe(true);
  });
});

describe("🔒 adaptation : donnée de santé, référent handicap seul", () => {
  it("pour un autre rôle, rien n'est chargé et le bloc dit sa réserve", async () => {
    const m = await chargerDossierSession("s1", { role: "admin" });
    // Seule la liste des questionnaires remplis (sans `reponses`) est lue.
    for (const [arg] of p["questionnaire"]!["findMany"]!.mock.calls) {
      expect(arg.select.reponses).toBeUndefined();
    }
    expect(sectionIndicateur10Session).not.toHaveBeenCalled();
    const bloc = m!.blocs.find((b) => b.id === "adaptation")!;
    expect(bloc.lignes).toEqual([MENTION_RESERVE_REFERENT]);
    expect(JSON.stringify(m)).not.toContain("pauses");
  });

  it("pour le référent, le bloc porte le besoin et la mesure", async () => {
    const m = await chargerDossierSession("s1", { role: "super_admin" });
    const appels = p["questionnaire"]!["findMany"]!.mock.calls.map((c) => c[0]);
    expect(appels.map((a) => a.where)).toContainEqual({
      enrollmentId: { in: ["e1", "e2"] },
      type: "positionnement",
      reponduAt: { not: null },
    });
    expect(m!.blocs.find((b) => b.id === "adaptation")!.lignes.join("\n")).toContain("pauses");
  });

  it("les réponses du positionnement ne sont jamais dans la requête de la session", async () => {
    await chargerDossierSession("s1", { role: "super_admin" });
    const select = p["trainingSession"]!["findUnique"]!.mock.calls[0]![0].select;
    expect(select.enrollments.select.questionnaires).toEqual({ select: { id: true } });
  });
});

describe("fail-soft, jamais muet", () => {
  it("une lecture qui échoue est dite, pas rendue comme « aucun »", async () => {
    p["remiseRetour"]!["findMany"]!.mockRejectedValueOnce(new Error("P2021"));
    const m = await chargerDossierSession("s1", { role: "admin" });
    expect(m!.avertissements.join(" ")).toContain("ce n'est PAS un constat d'absence");
  });
});

describe("modèles vierges et questionnaires remplis (dossier à 100 %)", () => {
  it("un modèle vierge est marqué `modeleVierge`, une pièce remplacée non", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([
      piece({ id: "pv", type: "positionnement", numero: "AXI-POS-2026-001" }),
      piece({ id: "pr", numero: "AXI-ATT-2026-001", remplaceeParNumero: "AXI-ATT-2026-002" }),
    ]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    expect(m!.elements.find((e) => e.cle === "piece:pv")!.modeleVierge).toBe(true);
    expect(m!.elements.find((e) => e.cle === "piece:pr")!.modeleVierge).toBeFalsy();
  });

  it("un positionnement généré est un modèle vierge : étiqueté, hors voyants, jamais joint", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([
      piece({ id: "pv", type: "positionnement", numero: "AXI-POS-2026-001" }),
    ]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    const pv = m!.elements.find((e) => e.cle === "piece:pv")!;
    expect(pv.etiquettes.join(" ")).toContain("Modèle vierge — non probant, non joint");
    expect(pv.horsVoyants).toBe(true);
    expect(pv.cheminPdf).toBeNull();
    expect(pv.cleStockage).toBeNull();
  });

  it("un questionnaire répondu devient un élément « rempli » ; `reponses` n'est jamais lue", async () => {
    p["questionnaire"]!["findMany"]!.mockResolvedValue([
      {
        id: "qr1",
        type: "satisfaction_chaud",
        reponduAt: new Date("2026-06-11T14:00:00Z"),
        enrollmentId: "e1",
      },
    ]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    const q = m!.elements.find((e) => e.cle === "questionnaire-rempli:qr1")!;
    expect(q.titre).toBe("Satisfaction à chaud remplie");
    expect(q.destinataire).toBe("stagiaire");
    expect(q.canal).toBe("espace");
    expect(q.details).toContain("Stagiaire : Alice Dupont");
    expect(q.details).toContain("PDF rempli : dossier questionnaires-remplis/ du ZIP");
    expect(q.cheminPdf).toBeNull();
    const appel = p["questionnaire"]!["findMany"]!.mock.calls.find(
      (c) => c[0].where.enrollment !== undefined,
    )![0];
    expect(appel.where).toEqual({
      enrollment: { sessionId: "s1", ...inscriptionSurSessionTenue() },
      reponduAt: { not: null },
      type: { in: ["positionnement", "satisfaction_chaud", "satisfaction_froid"] },
    });
    expect(appel.select).toEqual({ id: true, type: true, reponduAt: true, enrollmentId: true });
  });

  it("une lecture des questionnaires qui échoue est dite", async () => {
    p["questionnaire"]!["findMany"]!.mockRejectedValueOnce(new Error("boom"));
    const m = await chargerDossierSession("s1", { role: "admin" });
    expect(m!.avertissements.join(" ")).toContain("questionnaires remplis");
  });
});

describe("exemplaire signé : probant seulement s'il porte une signature en vigueur", () => {
  const base = {
    id: "ps",
    type: "convention",
    numero: "AXI-CONV-2026-009",
    exemplaireSigneKey: "documents/signes/x.pdf",
  };
  const revoquee = {
    signeAt: new Date("2026-10-20T10:00:00Z"),
    revokedAt: new Date("2026-10-21T10:00:00Z"),
  };
  const vivante = { signeAt: new Date("2026-10-22T10:00:00Z"), revokedAt: null };

  it("pièce remplacée : l'exemplaire signé est hors voyants et le dit", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([
      piece({ ...base, remplaceeParNumero: "AXI-CONV-2026-010", signatures: [vivante] }),
    ]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    const s = m!.elements.find((e) => e.cle === "piece-signee:ps")!;
    expect(s.horsVoyants).toBe(true);
    expect(s.etiquettes.join(" ")).toContain("Remplacée par AXI-CONV-2026-010");
  });

  it("toutes les signatures révoquées : hors voyants, étiqueté non probant", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([
      piece({ ...base, signatures: [revoquee] }),
    ]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    const s = m!.elements.find((e) => e.cle === "piece-signee:ps")!;
    expect(s.horsVoyants).toBe(true);
    expect(s.etiquettes.join(" ")).toContain("signatures révoquées");
  });

  it("une signature révoquée ET une en vigueur : reste probant, daté de la vivante", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([
      piece({ ...base, signatures: [revoquee, vivante] }),
    ]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    const s = m!.elements.find((e) => e.cle === "piece-signee:ps")!;
    expect(s.horsVoyants).toBe(false);
    expect(s.etiquettes).toContain("Signé le 22/10/2026");
  });
});

describe("exemplaire signé", () => {
  const signee = {
    id: "ps",
    type: "convention",
    numero: "AXI-CONV-2026-009",
    exemplaireSigneKey: "documents/signes/x.pdf",
    signatures: [{ signeAt: new Date("2026-10-20T10:00:00Z") }],
  };

  it("avec une clé : la pièce et son exemplaire signé, daté", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([piece(signee)]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    const els = m!.elements.filter((e) => e.cle.endsWith(":ps"));
    expect(els).toHaveLength(2);
    const s = els.find((e) => e.cle === "piece-signee:ps")!;
    expect(s.titre).toBe("AXI-CONV-2026-009 (convention) — exemplaire signé");
    expect(s.etiquettes).toContain("Signé le 20/10/2026");
    expect(s.cheminPdf).toBe("documents/signes/convention/AXI-CONV-2026-009.pdf");
    expect(s.cleStockage).toBe("documents/signes/x.pdf");
    expect(s.horsVoyants).toBe(false);
  });

  it("sans clé : un seul élément", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([
      piece({ ...signee, exemplaireSigneKey: null, signatures: [] }),
    ]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    expect(m!.elements.filter((e) => e.cle.endsWith(":ps"))).toHaveLength(1);
  });

  it("sans signature non révoquée : date de signature non retrouvée", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([piece({ ...signee, signatures: [] })]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    expect(m!.elements.find((e) => e.cle === "piece-signee:ps")!.etiquettes).toContain(
      "date de signature non retrouvée",
    );
  });

  it("une pièce annulée n'a pas d'exemplaire signé séparé", async () => {
    p["documentGenere"]!["findMany"]!.mockResolvedValue([
      piece({ ...signee, annuleeAt: new Date("2026-10-21T00:00:00Z") }),
    ]);
    const m = await chargerDossierSession("s1", { role: "admin" });
    expect(m!.elements.some((e) => e.cle === "piece-signee:ps")).toBe(false);
  });
});
