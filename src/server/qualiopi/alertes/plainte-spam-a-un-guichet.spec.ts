/**
 * L'alerte `email_plainte_spam` (webhook ZeptoMail) doit exister au catalogue.
 *
 * Absente, elle n'avait pas de guichet (`envoi-groupe` écrivait seulement une erreur, rien ne
 * partait) et le dédoublonnage des alertes déjà traitées n'agissait pas (un événement renvoyé par
 * le relais recréait l'alerte). Ces tests utilisent le VRAI catalogue.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerteSysteme: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    adminUser: { findMany: vi.fn() },
  },
}));

// Le balayage n'est pas l'objet ici (il tire des dépendances d'authentification).
vi.mock("./evaluateur", () => ({
  evaluerAlertes: vi.fn(),
  evaluerAlertesDetaille: vi.fn(),
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(async () => ({ enqueued: true })),
}));

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { notifierAlertesGroupees } from "./envoi-groupe";
import { creerOuDedup } from "./alertes-service";
import { ALERTE_CATALOGUE } from "./catalogue";

type Mock = ReturnType<typeof vi.fn>;
const findMany = prisma.alerteSysteme.findMany as unknown as Mock;
const findFirst = prisma.alerteSysteme.findFirst as unknown as Mock;
const create = prisma.alerteSysteme.create as unknown as Mock;
const updateMany = prisma.alerteSysteme.updateMany as unknown as Mock;
const adminFindMany = prisma.adminUser.findMany as unknown as Mock;
const enqueue = enqueueEmail as unknown as Mock;

const MESSAGE = "L'adresse « a***@e***.fr » a signalé un e-mail comme indésirable.";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  process.env["QUALIOPI_ALERTE_EMAIL"] = "secours@axion-ia.com";
  adminFindMany.mockResolvedValue([
    { email: "direction@axion-ia.com", role: "admin" },
    { email: "secretariat@axion-ia.com", role: "secretaire" },
  ]);
});

describe("email_plainte_spam : catalogue et guichet", () => {
  it("l'entrée existe, au guichet administratif, sans titre ni message interdits", () => {
    const e = ALERTE_CATALOGUE["email_plainte_spam"];
    expect(e).toBeDefined();
    expect(e!.guichet).toBe("administratif");
    expect(e!.resolutionAuto).toBe(false);
    expect(`${e!.titre} ${MESSAGE}`).not.toMatch(/qualiopi|opco|prise en charge/i);
  });

  it("(a) part dans l'envoi groupé, sans être rangée « sans guichet »", async () => {
    const ligne = {
      id: "p1",
      code: "email_plainte_spam",
      niveau: "important",
      titre: "Une plainte pour spam a été reçue",
      message: MESSAGE,
      cibleType: "EmailOpposition",
      cibleId: "empreinte",
      createdAt: new Date("2026-11-16T00:00:00.000Z"),
    };
    findMany.mockImplementation(async (args: { select?: Record<string, unknown> }) =>
      args?.select != null && Object.keys(args.select).length === 1 ? [{ id: "p1" }] : [ligne],
    );
    updateMany.mockResolvedValue({ count: 1 });

    const r = await notifierAlertesGroupees(new Date("2026-11-17T07:00:00.000Z"));

    expect(r.sansGuichet).toBe(0);
    expect(r.alertes).toBe(1);
    expect(enqueue).toHaveBeenCalled();
    expect(enqueue.mock.calls.map((c) => c[1])).toContain("secretariat@axion-ia.com");
  });
});

describe("email_plainte_spam : dédoublonnage", () => {
  it("(b) le même événement reçu après acquittement ne crée pas de seconde alerte", async () => {
    findFirst
      .mockResolvedValueOnce(null) // aucune ouverte
      .mockResolvedValueOnce({ id: "deja-resolue" }); // une résolue, même message

    const r = await creerOuDedup({
      code: "email_plainte_spam",
      niveau: "important",
      titre: "Une plainte pour spam a été reçue",
      message: MESSAGE,
      cibleType: "EmailOpposition",
      cibleId: "empreinte",
    });

    expect(r).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
