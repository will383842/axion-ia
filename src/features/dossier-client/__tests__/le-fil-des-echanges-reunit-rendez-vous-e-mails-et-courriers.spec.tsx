/**
 * Lot 1 « fiche client complète », PR-3 : un fil unique d'échanges (rendez-vous, e-mails du
 * journal, e-mails à valider, courriers du questionnaire), objet seulement.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  rencontre: { findMany: vi.fn() },
  emailLog: { findMany: vi.fn() },
  emailOutbox: { findMany: vi.fn() },
  questionnaireAvantAuditCourrier: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
const idsMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/admin-emails/rattachement-client", () => ({ idsLiesAuClient: idsMock }));

import { assemblerFil, lireFilDesEchanges, type EchangeDuFil } from "../fil-des-echanges";
import { FilDesEchanges } from "@/components/admin/dossier-client/FilDesEchanges";

beforeEach(() => vi.clearAllMocks());

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
      { id: "o1", sujet: "Invitation : Audit", statut: "a_valider", createdAt: new Date("2026-10-25T09:30:00Z") },
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
    const fil = await lireFilDesEchanges("cl", "adm");
    expect(fil.map((x) => x.cle)).toEqual(["rdv:r1", "courrier:c1", "mail:l1", "outbox:o1"]);
    const mail = fil.find((x) => x.cle === "mail:l1")!;
    expect(mail.titre).toBe("Avant votre audit");
    expect(mail.lien).toBe("/fr/adm/emails-envoyes/l1");
    expect(fil.find((x) => x.cle === "courrier:c1")?.etat).toBe("annulé");
    expect(JSON.stringify(fil)).not.toMatch(/@/);
  });

  it("une source en panne ne vide pas le fil", async () => {
    prismaMock.rencontre.findMany.mockRejectedValue(new Error("x"));
    idsMock.mockResolvedValue([]);
    prismaMock.emailOutbox.findMany.mockResolvedValue([
      { id: "o1", sujet: "S", statut: "a_valider", createdAt: new Date() },
    ]);
    prismaMock.questionnaireAvantAuditCourrier.findMany.mockRejectedValue(new Error("x"));
    const fil = await lireFilDesEchanges("cl", "adm");
    expect(fil.map((x) => x.cle)).toEqual(["outbox:o1"]);
  });
});

describe("FilDesEchanges", () => {
  it("rend le fil et le lien vers le journal filtré par client", () => {
    const html = renderToStaticMarkup(
      <FilDesEchanges fil={[e("x", "2026-10-25T10:05:00Z")]} clientId="cl" adminPrefix="adm" />,
    );
    expect(html).toContain("/fr/adm/emails-envoyes?client=cl");
    expect(html).toContain("11:05");
  });
  it("dit quand il n'y a rien", () => {
    expect(
      renderToStaticMarkup(<FilDesEchanges fil={[]} clientId="cl" adminPrefix="adm" />),
    ).toContain("Aucun échange");
  });
});
