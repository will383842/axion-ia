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
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { clientsDesLignes, idsLiesAuClient } from "../rattachement-client";
import { BlocQuestionnaireFiche } from "@/components/admin/dossier-client/BlocQuestionnaireFiche";

const U = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = { id: U(9), numero: "AXI-CLI-005", raisonSociale: "Société test" };

beforeEach(() => vi.clearAllMocks());

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
    expect(await idsLiesAuClient(U(9))).toEqual([U(1), U(2), U(3), U(4), U(5)]);
  });

  it("rend [] pour un identifiant qui n'est pas un UUID (zéro ligne, jamais tout le journal)", async () => {
    expect(await idsLiesAuClient("n'importe quoi")).toEqual([]);
    expect(prismaMock.rencontre.findMany).not.toHaveBeenCalled();
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
      renderToStaticMarkup(<BlocQuestionnaireFiche questionnaires={[]} adminPrefix="adm" />),
    ).toBe("");
  });
  it("dit l'envoi, les réponses d'équipe et les liens (heure de Paris)", () => {
    const html = renderToStaticMarkup(
      <BlocQuestionnaireFiche
        adminPrefix="adm"
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
        questionnaires={[
          { ...base, envoyeLe: null, invitationEmailLogId: null, invitationStatut: null },
        ]}
      />,
    );
    expect(html).toContain("rien n&#x27;est parti");
    expect(html).toContain("aperçu de l&#x27;e-mail qui partira");
  });
});
