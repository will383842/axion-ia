// @vitest-environment node
/**
 * OUT-1 — le balayage horaire des « approuvé » abandonnés lit le journal avant de décider.
 *
 * Un « approuvé » de plus de 15 minutes dont la tâche `outbox-<id>` a une ligne « en attente » au
 * journal n'est PAS un tombeau : la mise en file a pu aboutir. Le remettre « à valider » ferait
 * approuver une 2e fois un e-mail peut-être déjà parti. Prisma, l'alerte et la notification sont simulés.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  anciens: [] as unknown[],
  journaux: [] as Array<{ id?: string; jobId: string; status: string; error?: string | null }>,
  outboxUpdateMany: vi.fn(),
  alerte: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async (args: { where: { jobId?: { in: string[] } } }) =>
        args.where.jobId
          ? d.journaux
              .filter((j) => args.where.jobId!.in.includes(j.jobId))
              .map((j) => ({ id: "J1", error: null, ...j }))
          : [],
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    emailOutbox: {
      findMany: vi.fn(async () => d.anciens),
      updateMany: (...a: unknown[]) => d.outboxUpdateMany(...a),
    },
  },
}));
// Règle du balayage : état réel de la tâche dans la file (ici absente), puis dernière ligne du journal.
vi.mock("@/server/queue/queues", () => ({ lireEtatTacheOutbox: async () => "absente" }));
vi.mock("@/server/email/email-log", () => ({ marquerAnnule: vi.fn(async () => 1) }));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(async () => null), set: vi.fn() } }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => d.alerte(...a),
  creerOuActualiser: (...a: unknown[]) => d.alerte(...a),
  resoudreAlertesParCode: vi.fn(async () => 0),
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn(async () => ({ ok: true })) }));

import { verifierSanteEmails } from "@/server/email/health";

const MAINTENANT = new Date("2026-11-20T10:00:00Z");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Ce que `updateMany` a reçu, par statut visé. */
const ecritures = (statut: string) =>
  d.outboxUpdateMany.mock.calls
    .map((c) => c[0] as { where: Record<string, unknown>; data: Record<string, unknown> })
    .filter((c) => c.data["statut"] === statut);

beforeEach(() => {
  vi.clearAllMocks();
  d.anciens = [
    {
      id: A,
      template: "facture-envoi",
      payload: {},
      approuveAt: new Date("2026-11-20T08:00:00Z"),
      entityType: null,
      entityId: null,
    },
  ];
  d.journaux = [];
  d.outboxUpdateMany.mockResolvedValue({ count: 1 });
  d.alerte.mockResolvedValue(null);
  process.env["ZEPTOMAIL_WEBHOOK_KEY"] = "cle";
});

describe("balayage des « approuvé » de plus de 15 minutes", () => {
  it("journal « en attente » : la ligne reste « approuvé », alerte « envoi incertain »", async () => {
    d.journaux = [{ jobId: `outbox-${A}`, status: "pending" }];
    d.outboxUpdateMany.mockResolvedValue({ count: 0 });
    const s = await verifierSanteEmails(MAINTENANT);
    // Aucune remise « à valider » ne vise cette ligne.
    expect(
      ecritures("a_valider").some(
        (e) => JSON.stringify(e.where).includes(A) && !JSON.stringify(e.where).includes("notIn"),
      ),
    ).toBe(false);
    expect(ecritures("envoye")).toHaveLength(0);
    expect(s.alertesLevees).toContain("emails_envoi_incertain");
    expect(s.approuvesEnvoiIncertain).toBe(1);
    expect(
      d.alerte.mock.calls.some((c) => (c[0] as { code: string }).code === "emails_envoi_incertain"),
    ).toBe(true);
  });

  it("journal « envoyé » : passage conditionnel « approuvé → envoyé », même alerte", async () => {
    d.journaux = [{ jobId: `outbox-${A}`, status: "sent" }];
    const s = await verifierSanteEmails(MAINTENANT);
    const e = ecritures("envoye");
    expect(e).toHaveLength(1);
    expect(e[0]!.where).toMatchObject({ statut: "approuve" });
    expect(JSON.stringify(e[0]!.where)).toContain(A);
    expect(s.alertesLevees).toContain("emails_envoi_incertain");
  });

  it("aucun journal : remise « à valider » comme avant, aucune alerte d'envoi incertain", async () => {
    const s = await verifierSanteEmails(MAINTENANT);
    expect(ecritures("a_valider")).toHaveLength(1);
    expect(ecritures("envoye")).toHaveLength(0);
    expect(s.alertesLevees).toContain("emails_approuves_abandonnes");
    expect(s.alertesLevees).not.toContain("emails_envoi_incertain");
    expect(s.approuvesEnvoiIncertain).toBe(0);
  });

  it("journal « échec » : remise « à valider » (rien n'est parti)", async () => {
    d.journaux = [{ jobId: `outbox-${A}`, status: "failed" }];
    await verifierSanteEmails(MAINTENANT);
    expect(ecritures("a_valider")).toHaveLength(1);
    expect(ecritures("envoye")).toHaveLength(0);
  });

  it("l'alerte ne porte ni adresse ni lien : un nombre et des identifiants de ligne seulement", async () => {
    d.journaux = [{ jobId: `outbox-${A}`, status: "pending" }];
    d.outboxUpdateMany.mockResolvedValue({ count: 0 });
    await verifierSanteEmails(MAINTENANT);
    const texte = JSON.stringify(d.alerte.mock.calls);
    expect(texte).not.toMatch(/@|signer\//);
  });
});
