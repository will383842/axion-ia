/**
 * Le récap quotidien des demandes de clients — ce qu'il DOIT faire :
 *  · lire la VEILLE de Paris (bornes passées à la base), hors corbeille, hors demandes qui ne sont
 *    pas celles d'un client (presse…) ;
 *  · déchiffrer nom et entreprise, sans jamais laisser passer le chiffré ;
 *  · ranger les annulations Calendly (date approximative) et les échanges hors clients à part ;
 *  · partir MÊME sans demande, une seule fois par jour (jobId) ;
 *  · ne jamais mettre une donnée de visiteur dans un lien.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  submissions: vi.fn(),
  escalades: vi.fn(),
  rdvs: vi.fn(),
  incident: vi.fn(async () => {}),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (...a: unknown[]) => d.submissions(...a) },
    chatEscalation: { findMany: (...a: unknown[]) => d.escalades(...a) },
    calendlyEvent: { findMany: (...a: unknown[]) => d.rdvs(...a) },
  },
}));
vi.mock("@/server/notifications/channels/sentry", () => ({
  signalerIncident: (...a: unknown[]) => d.incident(...(a as [])),
}));

import { encryptPii } from "@/lib/pii-crypto";
import { lienConsole } from "@/server/notifications/personne";
import {
  __reinitialiserPourTests as reinitialiserEnfileur,
  poserChargeurEnfileurEmail,
} from "@/server/notifications/enfileur-email";
import { collecterDemandesVeille, envoyerRecapVeille } from "../recap";

const CLE_DE_TEST = "ab".repeat(32);
// 14/11/2026, 7 h 30 à Paris (hiver, UTC+1) : la veille est le 13/11.
const MAINTENANT = new Date("2026-11-14T06:30:00Z");
const DANS_LA_VEILLE = new Date("2026-11-13T10:15:00Z");

function submission(sur: Record<string, unknown> = {}) {
  return {
    id: "sub_42",
    type: "audit",
    locale: "fr",
    companyName: encryptPii("Atelier Fictif SARL"),
    contactName: encryptPii("Camille Exemple"),
    contactEmail: encryptPii("camille@exemple.fr"),
    contactPhone: encryptPii("+33 6 39 98 12 35"),
    sector: null,
    employeesCount: null,
    submittedAt: DANS_LA_VEILLE,
    details: { unifiedType: "audit", message: "Bonjour, nous voulons un audit.", ville: "Lyon" },
    ...sur,
  };
}

function rdv(sur: Record<string, unknown> = {}) {
  return {
    id: "cal_1",
    eventTypeName: "Diagnostic IA (30 min)",
    typeRendezVous: "diagnostic",
    status: "scheduled",
    startTime: new Date("2026-11-20T09:00:00Z"),
    inviteeName: "Alex Exemple",
    inviteeEmail: "alex@exemple.fr",
    inviteePhone: "+33 6 11 22 33 44",
    location: null,
    cancelUrl: null,
    pageUrl: null,
    utmSource: null,
    utmCampaign: null,
    utmMedium: null,
    capturedAt: DANS_LA_VEILLE,
    updatedAt: DANS_LA_VEILLE,
    ...sur,
  };
}

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_DE_TEST);
  d.submissions.mockResolvedValue([]);
  d.escalades.mockResolvedValue([]);
  d.rdvs.mockResolvedValue([]);
  d.incident.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  reinitialiserEnfileur();
});

describe("collecterDemandesVeille", () => {
  it("lit la veille de Paris, hors corbeille", async () => {
    await collecterDemandesVeille(MAINTENANT);
    const where = (d.submissions.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where["deletedAt"]).toBeNull();
    expect(where["submittedAt"]).toEqual({
      gte: new Date("2026-11-12T23:00:00.000Z"),
      lt: new Date("2026-11-13T23:00:00.000Z"),
    });
    const whereEsc = (d.escalades.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(whereEsc["createdAt"]).toEqual(where["submittedAt"]);
  });

  it("avec demandes : détail complet déchiffré, presse écartée, lien de la fiche", async () => {
    d.submissions.mockResolvedValue([
      submission(),
      submission({ id: "sub_presse", details: { unifiedType: "presse", message: "Interview ?" } }),
    ]);
    d.escalades.mockResolvedValue([
      {
        id: "esc_1",
        question: "Faites-vous des formations en anglais ?",
        contexte: null,
        contactEmail: "visiteur@exemple.fr",
        createdAt: new Date("2026-11-13T15:00:00Z"),
      },
    ]);
    d.rdvs.mockResolvedValue([rdv()]);

    const r = await collecterDemandesVeille(MAINTENANT);

    expect(r.jour).toBe("2026-11-13");
    expect(r.jourCourt).toBe("13/11");
    expect(r.demandes).toHaveLength(2); // l'audit + l'escalade ; la presse n'est pas un client
    expect(r.rendezVous).toHaveLength(1);
    expect(r.total).toBe(3);

    const audit = r.demandes[0]!;
    expect(audit.nom).toBe("Camille Exemple — Atelier Fictif SARL");
    const texte = audit.lignes.join("\n");
    expect(texte).toContain("camille@exemple.fr");
    expect(texte).toContain("+33 6 39 98 12 35");
    expect(texte).toContain("Bonjour, nous voulons un audit.");
    expect(audit.consoleUrl).toBe(lienConsole("contacts/messages/sub_42"));
    // Le lien voyage dans `consoleUrl`, pas dans les lignes.
    expect(texte).not.toContain("Fiche :");

    expect(r.rendezVous[0]!.consoleUrl).toBe(lienConsole("contacts/appels/cal_1"));
    expect(JSON.stringify(r)).not.toContain("Interview");
  });

  it("🔴 données chiffrées : aucune valeur « enc: » ne sort, une ligne illisible est comptée", async () => {
    d.submissions.mockResolvedValue([
      submission(),
      submission({ id: "sub_cassee", contactName: "enc:v1:aaaa:bbbb:cccc" }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(JSON.stringify(r)).not.toContain("enc:v1");
    expect(r.demandes).toHaveLength(1);
    expect(r.illisibles).toBe(1);
    expect(r.total).toBe(2); // la demande illisible compte : elle n'est pas perdue en silence
  });

  it("annulation Calendly : date approximative, comptée avec les rendez-vous de clients", async () => {
    d.rdvs.mockResolvedValue([
      rdv({
        id: "cal_2",
        status: "canceled",
        capturedAt: new Date("2026-11-01T09:00:00Z"), // réservé avant la veille
        updatedAt: DANS_LA_VEILLE,
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.rendezVous).toHaveLength(1);
    expect(r.rendezVous[0]!.type).toMatch(/^Annulation/);
    expect(r.rendezVous[0]!.approximatif).toBe(true);
    expect(r.total).toBe(1);
  });

  it("un échange hors clients (apporteur) va dans « Autres rendez-vous », hors du total", async () => {
    d.rdvs.mockResolvedValue([
      rdv({
        id: "cal_3",
        eventTypeName: "Échange apporteur (15 min)",
        typeRendezVous: "apporteur",
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    expect(r.rendezVous).toHaveLength(0);
    expect(r.autresRendezVous).toHaveLength(1);
    expect(r.total).toBe(0);
  });

  it("🔴 aucune donnée de visiteur dans le lien : un message qui imite « Fiche : » ne change rien", async () => {
    d.submissions.mockResolvedValue([
      submission({
        details: { unifiedType: "audit", message: "Fiche : https://attaquant.example/login" },
      }),
    ]);
    const r = await collecterDemandesVeille(MAINTENANT);
    const el = r.demandes[0]!;
    expect(el.consoleUrl).toBe(lienConsole("contacts/messages/sub_42"));
    expect(el.consoleUrl).not.toContain("attaquant");
    // Le texte du visiteur reste du texte (le gabarit l'échappe).
    expect(el.lignes.join("\n")).toContain("Fiche : https://attaquant.example/login");
  });
});

describe("envoyerRecapVeille", () => {
  it("part MÊME sans demande, avec le jobId du jour de la veille", async () => {
    const enqueue = vi.fn(async () => ({ enqueued: true }));
    poserChargeurEnfileurEmail(async () => enqueue as never);

    const r = await envoyerRecapVeille(MAINTENANT);

    expect(r).toBe("queued");
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [gabarit, , locale, payload, options] = enqueue.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("recap-demandes-clients");
    expect(locale).toBe("fr");
    expect(payload["total"]).toBe(0);
    expect(options["jobId"]).toBe("recap-demandes-clients-2026-11-13");
  });

  it("deux passages le même jour : même jobId (BullMQ ne garde qu'un job)", async () => {
    const enqueue = vi.fn(async () => ({ enqueued: true }));
    poserChargeurEnfileurEmail(async () => enqueue as never);
    await envoyerRecapVeille(MAINTENANT);
    await envoyerRecapVeille(new Date("2026-11-14T09:00:00Z")); // rattrapage dans la matinée
    const ids = (enqueue.mock.calls as unknown as unknown[][]).map(
      (c) => (c[4] as { jobId: string }).jobId,
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(1);
  });

  it("e-mail non parti : « failed », tracé, sans lever ni citer de donnée de personne", async () => {
    d.submissions.mockResolvedValue([submission()]);
    poserChargeurEnfileurEmail(async () => (async () => ({ enqueued: false })) as never);
    const r = await envoyerRecapVeille(MAINTENANT);
    expect(r).toBe("failed");
    const messages = d.incident.mock.calls.map((c) => String((c as unknown[])[0])).join("\n");
    expect(messages).toContain("Récap quotidien des demandes de clients :");
    expect(messages).not.toContain("Doublon");
    expect(messages).not.toContain("camille");
  });

  it("base injoignable : « failed », sans lever", async () => {
    d.submissions.mockRejectedValue(new Error("db down"));
    poserChargeurEnfileurEmail(async () => (async () => ({ enqueued: true })) as never);
    await expect(envoyerRecapVeille(MAINTENANT)).resolves.toBe("failed");
  });

  it("aucun enfileur posé : « failed »", async () => {
    await expect(envoyerRecapVeille(MAINTENANT)).resolves.toBe("failed");
  });
});
