/**
 * Un échange avec un candidat apporteur n'est PAS un appel de découverte client
 * (2026-09-19).
 *
 * La découverte relève TOUS les rendez-vous du compte Calendly. Sans ces
 * gardes, le candidat qui réserve l'échange de 15 minutes recevait les e-mails
 * « votre appel de découverte » (confirmation, J-1, H-1) et entrait au CRM des
 * ventes comme un prospect.
 *
 * Trois points, trois témoins :
 *   1. la règle de reconnaissance (nom du type d'événement) ;
 *   2. la passe des rappels exclut ces rendez-vous DANS SA REQUÊTE ;
 *   3. le point d'entrée CRM ne pousse rien pour eux — et pousse toujours le reste.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findMany: (...a: unknown[]) => findMany(...a),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

const enfilerCrm = vi.fn(async (..._a: unknown[]) => "evt");
vi.mock("@/server/crm-sync/enqueue", () => ({
  enqueueCrmSyncEvent: (...a: unknown[]) => enfilerCrm(...a),
  newCrmEventId: () => "id-1",
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => (e ? `h-${e}` : null),
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}));

import { estAppelApporteur, HORS_APPELS_APPORTEUR } from "../appel-apporteur";
import { executerPassage, PASSAGES } from "../rappels-appel";
import { syncCalendlyEventToCrm } from "@/server/crm-sync";

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("estAppelApporteur — la règle de reconnaissance", () => {
  it.each(["Échange apporteur d'affaires (15 min)", "ECHANGE APPORTEUR", "Appel apporteurs"])(
    "« %s » est un échange apporteur",
    (nom) => {
      expect(estAppelApporteur(nom)).toBe(true);
    },
  );

  it.each(["Premier contact", "Appel de découverte (45 min)", "", null, undefined])(
    "« %s » reste un appel client",
    (nom) => {
      expect(estAppelApporteur(nom)).toBe(false);
    },
  );
});

describe("les rappels « appel de découverte » excluent les échanges apporteur", () => {
  it.each(PASSAGES.map((p) => p.moment))(
    "passage « %s » : la requête porte l'exclusion",
    async (moment) => {
      const p = PASSAGES.find((x) => x.moment === moment);
      if (!p) throw new Error(`passage ${moment} introuvable`);
      await executerPassage(p, Date.UTC(2026, 8, 19, 10, 0, 0));
      const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
      // L'exclusion vit DANS la requête : filtrer après coup laisserait le
      // plafond par passage se remplir de lignes qu'on n'enverra jamais.
      expect(where["AND"]).toEqual([HORS_APPELS_APPORTEUR]);
      // …sans avoir écrasé la garde d'effacement RGPD qui partage la clé NOT.
      expect(where["NOT"]).toBeDefined();
    },
  );
});

describe("le CRM des ventes ne reçoit pas les échanges apporteur", () => {
  beforeEach(() => {
    process.env.CRM_SYNC_ENABLED = "true";
  });

  const personne = { email: "nadia@example.com", fullName: "Nadia", phone: null };

  it("un échange apporteur ne part pas", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:1",
      person: personne,
      payload: { eventTypeName: "Échange apporteur d'affaires (15 min)", source: "api_poll" },
    });
    expect(enfilerCrm).not.toHaveBeenCalled();
  });

  it("TÉMOIN — un appel client part toujours", async () => {
    // Sans ce témoin, une garde qui bloquerait TOUT serait verte ci-dessus.
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:2",
      person: personne,
      payload: { eventTypeName: "Premier contact", source: "api_poll" },
    });
    expect(enfilerCrm).toHaveBeenCalledTimes(1);
  });
});
