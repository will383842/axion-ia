// Effacement RGPD (art. 17) et rapports avant audit (2026-11-02) : MISE À L'ÉCART, jamais une
// suppression (règle de Will : aucune purge de données clients). Un lancement encore en attente
// ou en cours est annulé ; la route alerte Will (`src/app/api/gdpr-erase/route.ts`).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const qFindMany = vi.fn();
const rUpdateMany = vi.fn();
const rDelete = vi.fn();
const eUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaireAvantAudit: { findMany: (...a: unknown[]) => qFindMany(...a) },
    questionnaireAvantAuditEnvoi: {
      updateMany: (...a: unknown[]) => eUpdateMany(...a),
      delete: (...a: unknown[]) => rDelete(...a),
      deleteMany: (...a: unknown[]) => rDelete(...a),
    },
    rapportAvantAudit: {
      updateMany: (...a: unknown[]) => rUpdateMany(...a),
      delete: (...a: unknown[]) => rDelete(...a),
      deleteMany: (...a: unknown[]) => rDelete(...a),
    },
    $transaction: (ops: unknown[]) => Promise.all(ops),
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "hash" }));

beforeEach(() => {
  vi.clearAllMocks();
  rUpdateMany.mockResolvedValue({ count: 2 });
});

describe("rapports avant audit à l'effacement", () => {
  it("met à l'écart et annule, sans jamais supprimer", async () => {
    qFindMany.mockResolvedValue([{ id: "q1" }, { id: "q2" }]);
    const { ecarterRapportsAvantAuditPourEmail, MOTIF_ECART_RAPPORT_RGPD } =
      await import("../rgpd-erase");
    const t = new Date("2026-11-02T10:00:00Z");
    const r = await ecarterRapportsAvantAuditPourEmail("dirigeant@example.invalid", t);
    expect(r).toEqual({ ecartes: 2, annules: 2 });
    expect(rDelete).not.toHaveBeenCalled();
    const appels = rUpdateMany.mock.calls.map((c) => c[0]);
    expect(appels).toContainEqual({
      where: {
        questionnaireIds: { hasSome: ["q1", "q2"] },
        statut: { in: ["en_attente", "en_cours"] },
      },
      data: expect.objectContaining({ statut: "annule" }),
    });
    expect(appels).toContainEqual({
      where: { questionnaireIds: { hasSome: ["q1", "q2"] }, ecarteLe: null },
      data: { ecarteLe: t, ecarteMotif: MOTIF_ECART_RAPPORT_RGPD },
    });
    // Aucune donnée vidée : la base chiffrée reste, Will décide.
    for (const a of appels) expect(a.data).not.toHaveProperty("baseAudit");
  });

  it("aucun questionnaire du dirigeant : rien n'est touché", async () => {
    qFindMany.mockResolvedValue([]);
    const { ecarterRapportsAvantAuditPourEmail } = await import("../rgpd-erase");
    expect(await ecarterRapportsAvantAuditPourEmail("x@example.invalid")).toEqual({
      ecartes: 0,
      annules: 0,
    });
    expect(rUpdateMany).not.toHaveBeenCalled();
  });

  it("la demande d'effacement (11/11/2026 : mise à l'écart) écarte les rapports, sans rien anonymiser", () => {
    // Décision de Williams du 11/11/2026 : la route passe par le module d'écart, qui écarte les
    // rapports avant audit et n'appelle plus l'anonymisation Calendly.
    const moduleEcart = readFileSync(
      join(process.cwd(), "src/server/rgpd/ecarter-au-lieu-d-effacer.ts"),
      "utf8",
    ).replace(/^\s*\/\/.*$/gm, "");
    expect(moduleEcart).toContain("ecarterRapportsAvantAuditPourEmail(email, quand)");
    expect(moduleEcart).not.toContain("eraseCalendlyEventsForEmail");
    const route = readFileSync(join(process.cwd(), "src/app/api/gdpr-erase/route.ts"), "utf8");
    expect(route).toContain("ecarterPourDemandeEffacement(");
  });

  it("effacement d'un MEMBRE : les rapports qui contiennent ses réponses sont mis à l'écart, rien n'est supprimé", async () => {
    eUpdateMany.mockResolvedValue({ count: 1 });
    qFindMany.mockResolvedValue([{ id: "q7" }]);
    rUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 3 });
    const { ecarterQuestionnairePreauditMembre, MOTIF_ECART_RAPPORT_RGPD_MEMBRE } =
      await import("../rgpd-erase");
    const t = new Date("2026-11-02T10:00:00Z");
    const r = await ecarterQuestionnairePreauditMembre("REF", "a1b2c3d4e5f6", t);
    expect(r).toEqual({ reponses: 1, rapportsEcartes: 3, rapportsAnnules: 1 });
    expect(rDelete).not.toHaveBeenCalled();
    expect(qFindMany).toHaveBeenCalledWith({ where: { ref: "REF" }, select: { id: true } });
    const appels = rUpdateMany.mock.calls.map((c) => c[0]);
    expect(appels).toContainEqual({
      where: { questionnaireIds: { has: "q7" }, statut: { in: ["en_attente", "en_cours"] } },
      data: expect.objectContaining({ statut: "annule" }),
    });
    expect(appels).toContainEqual({
      where: { questionnaireIds: { has: "q7" }, ecarteLe: null },
      data: { ecarteLe: t, ecarteMotif: MOTIF_ECART_RAPPORT_RGPD_MEMBRE },
    });
    for (const a of appels) expect(a.data).not.toHaveProperty("baseAudit");
  });

  it("effacement d'un membre sans réponse à écarter : aucun rapport touché", async () => {
    eUpdateMany.mockResolvedValue({ count: 0 });
    const { ecarterQuestionnairePreauditMembre } = await import("../rgpd-erase");
    expect(await ecarterQuestionnairePreauditMembre("REF", "a1b2c3d4e5f6")).toEqual({
      reponses: 0,
      rapportsEcartes: 0,
      rapportsAnnules: 0,
    });
    expect(rUpdateMany).not.toHaveBeenCalled();
  });
});
