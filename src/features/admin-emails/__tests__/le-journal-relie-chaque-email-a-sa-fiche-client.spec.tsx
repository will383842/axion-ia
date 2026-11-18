/**
 * Lot 1 « fiche client complète » (25/10/2026), PR-2 : le journal des e-mails dit pour quelle
 * fiche chaque e-mail est parti, se filtre par client, montre l'objet, et lit l'heure de Paris ;
 * la fiche montre l'état du questionnaire avant audit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  rencontre: { findMany: vi.fn() },
  questionnaireAvantAudit: { findMany: vi.fn() },
  questionnaireAvantAuditEnvoi: { findMany: vi.fn() },
  client: { findUnique: vi.fn() },
  clientFusion: { findMany: vi.fn() },
  devis: { findMany: vi.fn() },
  documentGenere: { findMany: vi.fn() },
  factureFormation: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/features/questionnaire-preaudit/actions-suivi-ouvertures", () => ({
  lireBrouillonAction: vi.fn(),
}));

import { clientsDesLignes, idsLiesAuClient } from "../rattachement-client";
import { BlocQuestionnaireFiche } from "@/components/admin/dossier-client/BlocQuestionnaireFiche";

const U = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = { id: U(9), numero: "AXI-CLI-005", raisonSociale: "Société test" };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.devis.findMany.mockResolvedValue([]);
  prismaMock.documentGenere.findMany.mockResolvedValue([]);
  prismaMock.factureFormation.findMany.mockResolvedValue([]);
});

describe("clientsDesLignes", () => {
  it("rattache une rencontre, un questionnaire et une réponse à leur fiche client", async () => {
    prismaMock.rencontre.findMany.mockResolvedValue([{ id: U(1), client: CLIENT }]);
    prismaMock.questionnaireAvantAudit.findMany.mockResolvedValue([
      { id: U(2), rencontre: { client: CLIENT } },
    ]);
    prismaMock.questionnaireAvantAuditEnvoi.findMany.mockResolvedValue([
      { id: U(3), questionnaire: { rencontre: { client: CLIENT } } },
    ]);
    const m = await clientsDesLignes([
      { id: "a", entityType: "Rencontre", entityId: U(1) },
      { id: "b", entityType: "QuestionnaireAvantAudit", entityId: U(2) },
      { id: "c", entityType: "QuestionnaireAvantAuditEnvoi", entityId: U(3) },
      { id: "d", entityType: "Enrollment", entityId: U(4) },
    ]);
    expect(m.get("a")?.numero).toBe("AXI-CLI-005");
    expect(m.get("b")?.nom).toBe("Société test");
    expect(m.get("c")?.id).toBe(U(9));
    // Une famille non rattachée n'affiche aucun lien, jamais un faux.
    expect(m.has("d")).toBe(false);
  });

  it("ne lit rien quand aucune ligne n'est rattachable, et ne plante pas sans base", async () => {
    expect((await clientsDesLignes([{ id: "x", entityType: null, entityId: null }])).size).toBe(0);
    expect(prismaMock.rencontre.findMany).not.toHaveBeenCalled();
    prismaMock.rencontre.findMany.mockRejectedValue(new Error("base absente"));
    const m = await clientsDesLignes([{ id: "a", entityType: "Rencontre", entityId: U(1) }]);
    expect(m.size).toBe(0);
  });
});

describe("idsLiesAuClient", () => {
  it("liste les rencontres, questionnaires et réponses de la fiche", async () => {
    prismaMock.rencontre.findMany.mockResolvedValue([
      { id: U(1), questionnaireAvantAudit: { id: U(2), envois: [{ id: U(3) }, { id: U(4) }] } },
      { id: U(5), questionnaireAvantAudit: null },
    ]);
    prismaMock.clientFusion.findMany.mockResolvedValueOnce([]);
    prismaMock.questionnaireAvantAudit.findMany.mockResolvedValueOnce([]);
    expect(await idsLiesAuClient(U(9))).toEqual([U(1), U(2), U(3), U(4), U(5)]);
  });

  it("couvre aussi les questionnaires envoyés SANS rendez-vous, de la fiche et des fiches absorbées", async () => {
    prismaMock.rencontre.findMany.mockResolvedValueOnce([]);
    prismaMock.clientFusion.findMany
      .mockResolvedValueOnce([{ absorbeId: U(8) }])
      .mockResolvedValueOnce([]);
    prismaMock.questionnaireAvantAudit.findMany.mockResolvedValueOnce([
      { id: U(6), envois: [{ id: U(7) }] },
    ]);
    expect(await idsLiesAuClient(U(9))).toEqual([U(6), U(7)]);
    expect(prismaMock.questionnaireAvantAudit.findMany.mock.calls[0]![0].where).toEqual({
      rencontreId: null,
      clientId: { in: [U(9), U(8)] },
    });
  });

  it("rend [] pour un identifiant qui n'est pas un UUID (zéro ligne, jamais tout le journal)", async () => {
    expect(await idsLiesAuClient("n'importe quoi")).toEqual([]);
    expect(prismaMock.rencontre.findMany).not.toHaveBeenCalled();
  });
});

describe("les e-mails de devis, de pièces et de factures sont rattachés (AD-C3)", () => {
  it("rattache un e-mail Devis et un e-mail DocumentGenere à la bonne fiche, pas celle d'un autre client", async () => {
    const AUTRE = { id: U(20), numero: "AXI-CLI-006", raisonSociale: "Autre société" };
    prismaMock.devis.findMany.mockResolvedValue([
      { id: U(30), client: CLIENT, documentGenere: null },
      { id: U(31), client: AUTRE, documentGenere: null },
    ]);
    prismaMock.documentGenere.findMany.mockResolvedValue([
      { id: U(40), client: CLIENT },
      { id: U(41), client: null },
    ]);
    prismaMock.factureFormation.findMany.mockResolvedValue([{ id: U(50), client: CLIENT }]);
    const m = await clientsDesLignes([
      { id: "d1", entityType: "Devis", entityId: U(30) },
      { id: "d2", entityType: "Devis", entityId: U(31) },
      { id: "p1", entityType: "DocumentGenere", entityId: U(40) },
      { id: "p2", entityType: "DocumentGenere", entityId: U(41) },
      { id: "f1", entityType: "FactureFormation", entityId: U(50) },
    ]);
    expect(m.get("d1")?.id).toBe(U(9));
    expect(m.get("d2")?.id).toBe(U(20));
    expect(m.get("p1")?.id).toBe(U(9));
    expect(m.get("f1")?.id).toBe(U(9));
    // Une pièce sans client ni devis reste sans lien : jamais de faux rattachement.
    expect(m.has("p2")).toBe(false);
  });

  it("une pièce sans client propre prend le client du devis qui la porte", async () => {
    prismaMock.devis.findMany.mockResolvedValue([]);
    prismaMock.documentGenere.findMany.mockResolvedValue([
      { id: U(42), client: null, devisPortes: [{ client: CLIENT }] },
    ]);
    const m = await clientsDesLignes([{ id: "p", entityType: "DocumentGenere", entityId: U(42) }]);
    expect(m.get("p")?.id).toBe(U(9));
  });

  it("une pièce portée par deux devis de clients différents n'a aucun lien", async () => {
    const AUTRE = { id: U(20), numero: "AXI-CLI-006", raisonSociale: "Autre société" };
    prismaMock.documentGenere.findMany.mockResolvedValue([
      { id: U(43), client: null, devisPortes: [{ client: CLIENT }, { client: AUTRE }] },
      { id: U(44), client: null, devisPortes: [{ client: CLIENT }, { client: CLIENT }] },
    ]);
    const m = await clientsDesLignes([
      { id: "p3", entityType: "DocumentGenere", entityId: U(43) },
      { id: "p4", entityType: "DocumentGenere", entityId: U(44) },
    ]);
    expect(m.has("p3")).toBe(false);
    expect(m.get("p4")?.id).toBe(U(9));
    const sel = prismaMock.documentGenere.findMany.mock.calls[0]![0].select.devisPortes;
    expect(sel.take).toBeUndefined();
  });

  it("idsLiesAuClient ajoute devis, pièces (clientId OU pièce d'un devis) et factures, fiches absorbées comprises, sans doublon", async () => {
    prismaMock.rencontre.findMany.mockResolvedValue([]);
    prismaMock.clientFusion.findMany
      .mockResolvedValueOnce([{ absorbeId: U(8) }])
      .mockResolvedValueOnce([]);
    prismaMock.questionnaireAvantAudit.findMany.mockResolvedValue([]);
    prismaMock.devis.findMany.mockResolvedValue([
      { id: U(30), documentGenereId: U(40) },
      { id: U(31), documentGenereId: null },
    ]);
    prismaMock.documentGenere.findMany.mockResolvedValue([{ id: U(40) }, { id: U(41) }]);
    prismaMock.factureFormation.findMany.mockResolvedValue([{ id: U(50) }]);
    const ids = await idsLiesAuClient(U(9));
    expect(ids).toEqual([U(30), U(31), U(40), U(41), U(50)]);
    expect(prismaMock.devis.findMany.mock.calls[0]![0].where).toEqual({
      clientId: { in: [U(9), U(8)] },
    });
    expect(prismaMock.documentGenere.findMany.mock.calls[0]![0].where).toEqual({
      OR: [{ clientId: { in: [U(9), U(8)] } }, { id: { in: [U(40)] } }],
    });
    expect(prismaMock.factureFormation.findMany.mock.calls[0]![0].where).toEqual({
      clientId: { in: [U(9), U(8)] },
    });
  });

  it("une fiche sans rien rend []", async () => {
    prismaMock.rencontre.findMany.mockResolvedValue([]);
    prismaMock.clientFusion.findMany.mockResolvedValue([]);
    prismaMock.questionnaireAvantAudit.findMany.mockResolvedValue([]);
    expect(await idsLiesAuClient(U(9))).toEqual([]);
  });
});

describe("le journal lit l'heure de Paris et propose le filtre par client", () => {
  const vue = readFileSync(
    join(
      process.cwd(),
      "src/app/[locale]/(admin)/[adminPrefix]/emails-envoyes/_components/VueEmails.tsx",
    ),
    "utf8",
  );
  it("la date de la liste porte timeZone Europe/Paris", () => {
    const debut = vue.indexOf("const quand =");
    expect(vue.slice(debut, debut + 400)).toContain('timeZone: "Europe/Paris"');
  });
  it("la liste montre l'objet et le lien vers la fiche, le filtre garde le client", () => {
    expect(vue).toContain("r.objet");
    expect(vue).toContain("qualiopi/clients/${r.client.id}");
    expect(vue).toContain('p.set("client", f.clientId)');
  });
});

describe("BlocQuestionnaireFiche", () => {
  const base = {
    id: U(2),
    rencontreId: U(1),
    rencontreTitre: "Audit sur place",
    rencontreDebut: new Date("2026-11-06T07:30:00Z"),
    creeLe: new Date("2026-10-25T10:00:00Z"),
    expireLe: null,
    closLe: null,
    reponses: { dirigeant: 1, referentInformatique: 1, collaborateurs: 3, aTraiter: 2 },
  };
  it("n'affiche rien sans questionnaire", () => {
    expect(
      renderToStaticMarkup(
        <BlocQuestionnaireFiche
          questionnaires={[]}
          adminPrefix="adm"
          ficheHref="/fr/adm/qualiopi/clients/c"
        />,
      ),
    ).toBe("");
  });
  it("dit l'envoi, les réponses d'équipe et les liens (heure de Paris)", () => {
    const html = renderToStaticMarkup(
      <BlocQuestionnaireFiche
        adminPrefix="adm"
        ficheHref="/fr/adm/qualiopi/clients/c"
        questionnaires={[
          {
            ...base,
            envoyeLe: new Date("2026-10-25T10:05:00Z"),
            invitationEmailLogId: U(7),
            invitationStatut: "sent",
          },
        ]}
      />,
    );
    expect(html).toContain("Envoyé le 25/10/2026");
    expect(html).toContain("11:05");
    expect(html).toContain("collaborateurs 3");
    expect(html).toContain("2 à traiter");
    expect(html).toContain(`/fr/adm/rendez-vous/rencontres/${U(1)}`);
    expect(html).toContain(`/fr/adm/emails-envoyes/${U(7)}`);
  });
  it("un brouillon dit que rien n'est parti et renvoie à l'aperçu", () => {
    const html = renderToStaticMarkup(
      <BlocQuestionnaireFiche
        adminPrefix="adm"
        ficheHref="/fr/adm/qualiopi/clients/c"
        questionnaires={[
          { ...base, envoyeLe: null, invitationEmailLogId: null, invitationStatut: null },
        ]}
      />,
    );
    expect(html).toContain("rien n&#x27;est parti");
    expect(html).toContain("aperçu de l&#x27;e-mail qui partira");
  });
});

// ── Le filtre par client ne montre JAMAIS tout le journal ───────────────────────────────────
describe("chargerEmails avec un filtre client", () => {
  const journal = vi.hoisted(() => ({
    emailLog: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    trainingSession: { findUnique: vi.fn() },
  }));

  it("un client sans entité rend where.entityId = { in: [] } (zéro ligne)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: { ...prismaMock, ...journal } }));
    journal.emailLog.count.mockResolvedValue(0);
    journal.emailLog.findMany.mockResolvedValue([]);
    journal.emailLog.groupBy.mockResolvedValue([]);
    prismaMock.rencontre.findMany.mockResolvedValue([]);
    prismaMock.client.findUnique.mockResolvedValue(CLIENT);
    const { chargerEmails } = await import("../query");
    const r = await chargerEmails({
      jours: 0,
      statut: null,
      gabarit: null,
      destinataire: null,
      sessionId: null,
      clientId: U(9),
      page: 1,
    });
    expect(journal.emailLog.findMany.mock.calls[0]![0].where.entityId).toEqual({ in: [] });
    expect(r.client?.numero).toBe("AXI-CLI-005");
  });

  it("session et client disjoints : l'intersection est vide", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: { ...prismaMock, ...journal } }));
    journal.emailLog.count.mockResolvedValue(0);
    journal.emailLog.findMany.mockResolvedValue([]);
    journal.emailLog.groupBy.mockResolvedValue([]);
    journal.trainingSession.findUnique.mockResolvedValue(null);
    prismaMock.rencontre.findMany.mockResolvedValue([{ id: U(1), questionnaireAvantAudit: null }]);
    prismaMock.client.findUnique.mockResolvedValue(CLIENT);
    const { chargerEmails } = await import("../query");
    await chargerEmails({
      jours: 0,
      statut: null,
      gabarit: null,
      destinataire: null,
      sessionId: U(8),
      clientId: U(9),
      page: 1,
    });
    // La session introuvable donne [] : l'intersection avec [U(1)] reste vide.
    expect(journal.emailLog.findMany.mock.calls[0]![0].where.entityId).toEqual({ in: [] });
  });
});

// ── Le résumé du questionnaire sur la fiche ─────────────────────────────────────────────────
describe("lireQuestionnairesDeLaFiche", () => {
  it("compte les réponses non écartées, à traiter = reçues après la dernière lecture", async () => {
    vi.resetModules();
    const bd = {
      questionnaireAvantAudit: { findMany: vi.fn() },
      emailLog: { findMany: vi.fn() },
      clientFusion: { findMany: vi.fn(async () => []) },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma: bd }));
    const lu = new Date("2026-10-25T12:00:00Z");
    bd.questionnaireAvantAudit.findMany.mockResolvedValue([
      {
        id: U(2),
        creeLe: new Date(),
        envoyeLe: new Date(),
        luLe: lu,
        expireLe: null,
        closLe: null,
        rencontre: { id: U(1), titre: "Audit", debutPrevu: null },
        envois: [
          { mode: "main", recuLe: new Date("2026-10-25T11:00:00Z") },
          { mode: "emp", recuLe: new Date("2026-10-25T13:00:00Z") },
          { mode: "it", recuLe: new Date("2026-10-25T14:00:00Z") },
        ],
      },
    ]);
    bd.emailLog.findMany.mockResolvedValue([
      { id: "recent", entityId: U(2), status: "bounced" },
      { id: "ancien", entityId: U(2), status: "sent" },
    ]);
    const { lireQuestionnairesDeLaFiche } =
      await import("@/features/dossier-client/questionnaires-de-la-fiche");
    const [q] = await lireQuestionnairesDeLaFiche(U(9));
    expect(q!.reponses).toEqual({
      dirigeant: 1,
      referentInformatique: 1,
      collaborateurs: 1,
      aTraiter: 2,
    });
    // Le log le plus récent (premier de la liste triée par date décroissante) l'emporte.
    expect(q!.invitationEmailLogId).toBe("recent");
    // La requête écarte déjà les réponses mises à l'écart.
    expect(bd.questionnaireAvantAudit.findMany.mock.calls[0]![0].select.envois.where).toEqual({
      ecarteLe: null,
    });
  });
});
