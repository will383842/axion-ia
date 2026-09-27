// Le point après l'appel (2026-09-27) : un appel tenu exige une suite datée,
// un absent se relance par un brouillon qu'on relit, et rien ne touche au
// statut Calendly (donc rien de neuf ne part au CRM).

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const findUnique = vi.fn();
const findMany = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    // 🔑 LECTURE SEULE, volontairement : aucune méthode d'écriture sur
    // `calendlyEvent`. Si l'action tentait d'y écrire (`update`,
    // `updateMany`…), l'appel lèverait, l'action rendrait « erreur » et le
    // test « ok » ci-dessous rougirait. Un `not.toHaveBeenCalled()` sur une
    // seule méthode ne prouvait rien des autres.
    calendlyEvent: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
    rendezVousSuivi: { upsert: (...a: unknown[]) => upsert(...a) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { mailtoRelanceAbsent, normaliserSuivi, prenomDe, suiviSchema } from "../suivi";
import { enregistrerSuiviAction } from "../suivi-actions";
import { listRendezVousAFaireLePoint } from "../suivi-queries";

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

const INITIAL = { etat: "initial" } as const;

describe("les règles du point", () => {
  it("« A eu lieu » sans suite est refusé", () => {
    const r = suiviSchema.safeParse({
      calendlyEventId: "evt_1",
      issue: "eu_lieu",
      suite: null,
      suiteLe: null,
      note: null,
    });
    expect(r.success).toBe(false);
  });

  it("une suite sans date est refusée — sauf « Pas de suite »", () => {
    const base = { calendlyEventId: "evt_1", issue: "eu_lieu", note: null } as const;
    expect(suiviSchema.safeParse({ ...base, suite: "devis", suiteLe: null }).success).toBe(false);
    expect(suiviSchema.safeParse({ ...base, suite: "devis", suiteLe: "2026-10-02" }).success).toBe(
      true,
    );
    expect(suiviSchema.safeParse({ ...base, suite: "aucune", suiteLe: null }).success).toBe(true);
  });

  it("un absent ne garde pas la suite d'une saisie précédente", () => {
    const n = normaliserSuivi({
      calendlyEventId: "evt_1",
      issue: "absent",
      suite: "devis",
      suiteLe: "2026-10-02",
      note: "",
    });
    expect(n).toEqual({ issue: "absent", suite: null, suiteLe: null, note: null });
  });
});

describe("l'e-mail de relance d'un absent", () => {
  it("est un brouillon mailto, avec le lien pour reprendre un créneau, et sans téléphone", () => {
    const lien = mailtoRelanceAbsent({
      email: "client@example.com",
      prenom: "Philippe",
      quand: "28/09/2026 à 15:30",
      lienNouveauCreneau: "https://calendly.com/reschedulings/abc",
    });
    expect(lien.startsWith("mailto:client%40example.com?")).toBe(true);
    const corps = decodeURIComponent(lien.split("body=")[1] ?? "");
    expect(corps).toContain("Bonjour Philippe,");
    expect(corps).toContain("https://calendly.com/reschedulings/abc");
    expect(corps).not.toMatch(/\+33|0[67]\s?\d{2}/);
  });

  it("ne tire pas de prénom d'un nom saisi en capitales", () => {
    expect(prenomDe("Philippe Legrand")).toBe("Philippe");
    expect(prenomDe("LE GRAND PHILIPPE")).toBeNull();
    expect(prenomDe(null)).toBeNull();
  });
});

describe("enregistrerSuiviAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ id: "evt_1" });
    upsert.mockResolvedValue({});
  });

  it("enregistre le point sans toucher au statut Calendly", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "super_admin", email: "w@example.com" } });

    const etat = await enregistrerSuiviAction(
      INITIAL,
      formulaire({
        calendlyEventId: "evt_1",
        issue: "eu_lieu",
        suite: "devis",
        suiteLe: "2026-10-02",
        note: "Intéressé par l'audit",
      }),
    );

    expect(etat.etat).toBe("ok");
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]?.[0] as { create: Record<string, unknown> };
    // 🔑 Le statut Calendly pilote la synchro CRM : seul le suivi est écrit,
    // avec exactement ces champs.
    expect(Object.keys(arg.create).sort()).toEqual(
      ["calendlyEventId", "issue", "note", "renseignePar", "suite", "suiteLe"].sort(),
    );
    expect(arg.create).toMatchObject({
      calendlyEventId: "evt_1",
      issue: "eu_lieu",
      suite: "devis",
      renseignePar: "w@example.com",
    });
  });

  it.each(["reader", "secretaire", "responsable_qualite"])(
    "refuse le rôle « %s » sans rien écrire",
    async (role) => {
      authMock.mockResolvedValue({ user: { id: "u1", role } });

      const etat = await enregistrerSuiviAction(
        INITIAL,
        formulaire({ calendlyEventId: "evt_1", issue: "absent" }),
      );

      expect(etat.etat).toBe("erreur");
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it("dit ce qui manque quand l'appel a eu lieu sans suite", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });

    const etat = await enregistrerSuiviAction(
      INITIAL,
      formulaire({ calendlyEventId: "evt_1", issue: "eu_lieu" }),
    );

    expect(etat).toEqual({
      etat: "erreur",
      message: "Le rendez-vous a eu lieu : choisissez la suite à donner.",
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("listRendezVousAFaireLePoint", () => {
  beforeEach(() => vi.clearAllMocks());

  const ligne = {
    id: "evt_1",
    eventTypeName: "Discutons de votre projet IA",
    startTime: new Date("2026-09-28T13:30:00Z"),
    endTime: new Date("2026-09-28T14:15:00Z"),
    inviteeName: "Philippe Legrand",
    inviteeEmail: "client@example.com",
    rawPayload: {},
  };

  it("n'arrive qu'une fois sorti de « À venir » (30 min après la fin)", async () => {
    findMany.mockResolvedValue([ligne]);

    expect(
      await listRendezVousAFaireLePoint({ maintenant: new Date("2026-09-28T14:40:00Z") }),
    ).toHaveLength(0);
    expect(
      await listRendezVousAFaireLePoint({ maintenant: new Date("2026-09-28T14:46:00Z") }),
    ).toHaveLength(1);
  });

  it("ne demande que les rendez-vous programmés, sans point, des 30 derniers jours", async () => {
    findMany.mockResolvedValue([]);

    await listRendezVousAFaireLePoint({ maintenant: new Date("2026-09-28T16:00:00Z") });

    const arg = findMany.mock.calls[0]?.[0] as {
      where: { status: string; suivi: null; startTime: { gte: Date } };
    };
    expect(arg.where.status).toBe("scheduled");
    expect(arg.where.suivi).toBeNull();
    expect(arg.where.startTime.gte.toISOString()).toBe("2026-08-29T16:00:00.000Z");
  });
});
