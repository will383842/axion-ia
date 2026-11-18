/**
 * Lot 1 « fiche client complète », PR-3 : un fil unique d'échanges (rendez-vous, e-mails du
 * journal, e-mails à valider, courriers du questionnaire), objet seulement.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  rencontre: { findMany: vi.fn() },
  emailLog: { findMany: vi.fn() },
  emailOutbox: { findMany: vi.fn() },
  questionnaireAvantAuditCourrier: { findMany: vi.fn() },
  // Fusions de fiches : aucune dans ces scénarios (la fiche ne couvre qu'elle-même).
  clientFusion: { findMany: vi.fn(async () => []) },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
const idsMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/admin-emails/rattachement-client", () => ({ idsLiesAuClient: idsMock }));

import { GABARITS_INTERNES } from "../gabarits-internes";
import { assemblerFil, lireFilDesEchanges, type EchangeDuFil } from "../fil-des-echanges";
import { FilDesEchanges } from "@/components/admin/dossier-client/FilDesEchanges";

afterEach(() => {
  idsMock.mockReset();
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.clientFusion.findMany.mockResolvedValue([]);
});

const e = (cle: string, iso: string): EchangeDuFil => ({
  cle,
  genre: "email",
  date: new Date(iso),
  titre: cle,
  etat: "Envoyé",
  lien: null,
});

describe("assemblerFil", () => {
  it("trie du plus récent au plus ancien, stable à date égale", () => {
    const fil = assemblerFil([
      [e("b", "2026-10-01T10:00:00Z"), e("a", "2026-10-01T10:00:00Z")],
      [e("c", "2026-10-25T10:00:00Z")],
    ]);
    expect(fil.map((x) => x.cle)).toEqual(["c", "a", "b"]);
  });
});

describe("lireFilDesEchanges : client sans rencontre, avec un devis (AD-C3)", () => {
  it("le fil contient l'e-mail du devis, et dernierEmailParti n'est plus nul", async () => {
    const reel = await vi.importActual<
      typeof import("@/features/admin-emails/rattachement-client")
    >("@/features/admin-emails/rattachement-client");
    const bd = prismaMock as unknown as Record<string, { findMany: ReturnType<typeof vi.fn> }>;
    idsMock.mockImplementation(reel.idsLiesAuClient);
    const U = "00000000-0000-4000-8000-";
    const client = `${U}000000000009`;
    const devisId = `${U}000000000030`;
    prismaMock.rencontre.findMany.mockResolvedValue([]);
    bd.questionnaireAvantAudit = { findMany: vi.fn(async () => []) };
    bd.devis = { findMany: vi.fn(async () => [{ id: devisId, documentGenereId: null }]) };
    bd.documentGenere = { findMany: vi.fn(async () => []) };
    bd.factureFormation = { findMany: vi.fn(async () => []) };
    prismaMock.emailLog.findMany.mockResolvedValue([
      {
        id: "l9",
        template: "devis-envoi",
        status: "sent",
        createdAt: new Date("2026-11-10T10:00:00Z"),
        sentAt: new Date("2026-11-10T10:01:00Z"),
        contenu: { subject: "Votre devis" },
      },
    ]);
    prismaMock.emailOutbox.findMany.mockResolvedValue([]);
    prismaMock.questionnaireAvantAuditCourrier.findMany.mockResolvedValue([]);
    const { fil } = await lireFilDesEchanges(client, "adm");
    expect(prismaMock.emailLog.findMany.mock.calls[0]![0].where.entityId).toEqual({
      in: [devisId],
    });
    expect(fil.map((x) => x.cle)).toContain("mail:l9");
    const { dernierEmailParti } = await import("../fiche/lire-en-tete");
    expect(dernierEmailParti(fil, new Date("2026-11-18T00:00:00Z"))).toEqual(
      new Date("2026-11-10T10:01:00Z"),
    );
  });
});

describe("lireFilDesEchanges", () => {
  it("réunit les quatre sources, objet seulement, sans adresse ni corps", async () => {
    prismaMock.rencontre.findMany.mockResolvedValue([
      {
        id: "r1",
        titre: "Audit",
        debutPrevu: new Date("2026-11-06T07:30:00Z"),
        createdAt: new Date("2026-10-25T09:00:00Z"),
        statut: "planifie",
      },
    ]);
    idsMock.mockResolvedValue(["r1", "q1"]);
    prismaMock.emailLog.findMany.mockResolvedValue([
      {
        id: "l1",
        template: "questionnaire-avant-audit",
        status: "sent",
        createdAt: new Date("2026-10-25T10:00:00Z"),
        sentAt: new Date("2026-10-25T10:05:00Z"),
        contenu: { subject: "Avant votre audit" },
      },
    ]);
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      {
        id: "o1",
        sujet: "Invitation : Audit",
        statut: "a_valider",
        createdAt: new Date("2026-10-25T09:30:00Z"),
      },
    ]);
    prismaMock.questionnaireAvantAuditCourrier.findMany.mockResolvedValue([
      {
        id: "c1",
        nature: "relance_1",
        statut: "annule",
        prevuLe: new Date("2026-10-27T08:30:00Z"),
        faitLe: null,
        questionnaire: { rencontreId: "r1" },
      },
    ]);
    const { fil, sourcesEnPanne } = await lireFilDesEchanges("cl", "adm");
    expect(sourcesEnPanne).toBe(0);
    expect(fil.map((x) => x.cle)).toEqual(["rdv:r1", "courrier:c1", "mail:l1", "outbox:o1"]);
    expect(fil.find((x) => x.cle === "rdv:r1")?.etat).toBe("rendez-vous à venir");

    // Ce que chaque source demande à la base (le coeur du filtre) et ce qu'elle ne lit JAMAIS.
    const where = (m: { mock: { calls: unknown[][] } }): Record<string, unknown> =>
      (m.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    const select = (m: { mock: { calls: unknown[][] } }): Record<string, unknown> =>
      (m.mock.calls[0]![0] as { select: Record<string, unknown> }).select;
    expect(where(prismaMock.emailLog.findMany)).toEqual({
      entityId: { in: ["r1", "q1"] },
      template: { notIn: [...GABARITS_INTERNES] },
    });
    expect(where(prismaMock.emailOutbox.findMany)).toEqual({
      clientId: "cl",
      statut: { in: ["a_valider", "refuse"] },
    });
    const c = where(prismaMock.questionnaireAvantAuditCourrier.findMany);
    expect(c["OR"]).toEqual([
      { canal: "telegram" },
      { statut: { in: ["prevu", "en_cours", "annule", "echec"] } },
    ]);
    expect(c["NOT"]).toEqual([{ canal: "journal" }, { nature: "essai" }]);
    for (const m of [
      prismaMock.rencontre.findMany,
      prismaMock.emailLog.findMany,
      prismaMock.emailOutbox.findMany,
      prismaMock.questionnaireAvantAuditCourrier.findMany,
    ]) {
      const cles = Object.keys(select(m));
      for (const interdit of [
        "recipient",
        "payload",
        "html",
        "text",
        "destinataireHash",
        "messagePersonnalise",
      ]) {
        expect(cles).not.toContain(interdit);
      }
    }
    const mail = fil.find((x) => x.cle === "mail:l1")!;
    expect(mail.titre).toBe("Avant votre audit");
    expect(mail.lien).toBe("/fr/adm/emails-envoyes/l1");
    expect(fil.find((x) => x.cle === "courrier:c1")?.etat).toBe("annulé");
    expect(JSON.stringify(fil)).not.toMatch(/@/);
  });

  it("les courriers d'un questionnaire envoyé SANS rendez-vous sont dans le fil de la fiche", async () => {
    prismaMock.rencontre.findMany.mockResolvedValue([]);
    idsMock.mockResolvedValue([]);
    prismaMock.emailLog.findMany.mockResolvedValue([]);
    prismaMock.emailOutbox.findMany.mockResolvedValue([]);
    prismaMock.questionnaireAvantAuditCourrier.findMany.mockResolvedValue([
      {
        id: "c9",
        nature: "invitation",
        statut: "prevu",
        prevuLe: new Date("2026-10-26T08:00:00Z"),
        faitLe: null,
        questionnaire: { rencontreId: null, clientId: "cid" },
      },
    ]);
    const { fil } = await lireFilDesEchanges("cid", "adm");
    // Le filtre cherche par rendez-vous OU par rattachement direct à la fiche.
    const where = prismaMock.questionnaireAvantAuditCourrier.findMany.mock.calls[0]![0].where;
    expect(where.questionnaire).toEqual({
      OR: [{ clientId: { in: ["cid"] } }, { rencontre: { clientId: { in: ["cid"] } } }],
    });
    expect(fil).toHaveLength(1);
    expect(fil[0]!.lien).toBe("/fr/adm/qualiopi/clients/cid/questionnaire");
  });

  it("une source en panne ne vide pas le fil", async () => {
    prismaMock.rencontre.findMany.mockRejectedValue(new Error("x"));
    idsMock.mockResolvedValue([]);
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      { id: "o1", sujet: "S", statut: "a_valider", createdAt: new Date() },
    ]);
    prismaMock.questionnaireAvantAuditCourrier.findMany.mockRejectedValue(new Error("x"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fil, sourcesEnPanne } = await lireFilDesEchanges("cl", "adm");
    expect(fil.map((x) => x.cle)).toEqual(["outbox:o1"]);
    // La panne est comptée (et journalisée) : le fil ne passe pas pour « vide ».
    expect(sourcesEnPanne).toBe(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("FilDesEchanges", () => {
  it("rend le fil et le lien vers le journal filtré par client", () => {
    const html = renderToStaticMarkup(
      // Les noms sont lus par un composant asynchrone (non rendu ici) : on les donne déjà lus.
      <FilDesEchanges
        fil={[e("x", "2026-10-25T10:05:00Z")]}
        clientId="cl"
        adminPrefix="adm"
        destinataires={{}}
      />,
    );
    expect(html).toContain("/fr/adm/emails-envoyes?client=cl");
    expect(html).toContain("11:05");
  });
  it("dit qu'il est incomplet quand une source est en panne, au lieu de « aucun échange »", () => {
    const html = renderToStaticMarkup(
      <FilDesEchanges fil={[]} sourcesEnPanne={2} clientId="cl" adminPrefix="adm" />,
    );
    expect(html).toContain("n&#x27;a pas pu être lue");
    expect(html).not.toContain("Aucun échange");
  });
  it("dit quand il n'y a rien", () => {
    expect(
      renderToStaticMarkup(<FilDesEchanges fil={[]} clientId="cl" adminPrefix="adm" />),
    ).toContain("Aucun échange");
  });
});

describe("lireFilDesEchanges : les alertes internes ne sont pas des échanges avec le client", () => {
  it("écarte les gabarits internes du fil", async () => {
    idsMock.mockResolvedValue(["d1"]);
    prismaMock.rencontre.findMany.mockResolvedValue([]);
    prismaMock.emailOutbox.findMany.mockResolvedValue([]);
    prismaMock.questionnaireAvantAuditCourrier.findMany.mockResolvedValue([]);
    const log = (id: string, template: string) => ({
      id,
      template,
      status: "sent",
      createdAt: new Date("2026-11-10T10:00:00Z"),
      sentAt: new Date("2026-11-10T10:01:00Z"),
      contenu: { subject: "x" },
    });
    prismaMock.emailLog.findMany.mockResolvedValue([
      log("interne", "devis-signe-a-contresigner"),
      log("client", "devis-envoi"),
    ]);
    const { fil } = await lireFilDesEchanges("c-interne", "adm");
    expect(fil.map((x) => x.cle)).toEqual(["mail:client"]);
    expect(prismaMock.emailLog.findMany.mock.calls[0]![0].where.template).toEqual({
      notIn: [...GABARITS_INTERNES],
    });
  });
});
