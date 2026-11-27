/* eslint-disable @typescript-eslint/no-explicit-any -- doubles de base en mémoire */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 6 — les trois actions de validation sont réservées aux administrateurs (garde serveur) et
// ne touchent à rien tant que l'interrupteur est éteint.

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  valider: vi.fn(async () => ({ ok: true, message: "ok", avertissements: [] })),
  ecarter: vi.fn(async () => ({ ok: true })),
  proposition: null as null | Record<string, unknown>,
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../validation-rendez-vous", () => ({
  validerParRendezVous: (...a: unknown[]) => (h.valider as any)(...a),
  ecarterProposition: (...a: unknown[]) => (h.ecarter as any)(...a),
  MESSAGE_INTERRUPTEUR_ETEINT: "éteint",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    propositionRendezVousPresentation: { findUnique: async () => h.proposition },
  },
}));
vi.mock("../presentations", () => ({ REPONSES: [] }));
vi.mock("../annuaire", () => ({}));
vi.mock("../manquement", () => ({}));
vi.mock("@/features/admin-calendly/acces", () => ({ peutVoirLesAppels: () => true }));
vi.mock("@/server/auth/habilitations", () => ({ peutEngager: () => true }));
vi.mock("@/lib/email/templates/texte-libre-reseau", () => ({}));

import {
  ecarterPropositionAction,
  saisirRendezVousAction,
  validerPropositionAction,
} from "../actions-presentations";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const INITIAL = { etat: "initial" } as const;
function form(o: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
}
const gestes = [
  () => validerPropositionAction(INITIAL, form({ id: ID, confirmer: "oui" })),
  () => ecarterPropositionAction(INITIAL, form({ id: ID, confirmer: "oui" })),
  () =>
    saisirRendezVousAction(
      INITIAL,
      form({
        presentationId: ID,
        canal: "telephone",
        tenuLe: "2026-11-10T10:00",
        prisLe: "2026-11-05T10:00",
        motif: "Appel noté au carnet",
        confirmer: "oui",
      }),
    ),
];

beforeEach(() => {
  vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
  h.session = { user: { id: "u1", role: "admin" } };
  h.valider.mockClear();
  h.ecarter.mockClear();
  h.proposition = {
    presentationId: ID,
    rendezVousCle: "calendly:ev1",
    prisAt: new Date("2026-11-05T10:00:00Z"),
    rendezVousAt: new Date("2026-11-10T10:00:00Z"),
    ecarteeAt: null,
    retenueAt: null,
  };
});

describe("validation par rendez-vous : actions réservées aux administrateurs", () => {
  it.each(["editor", "reader", "responsable_qualite", "secretaire", "inconnu"])(
    "le rôle « %s » n'atteint jamais le métier",
    async (role) => {
      h.session = { user: { id: "u1", role } };
      for (const geste of gestes) expect((await geste()).etat).toBe("erreur");
      expect(h.valider).not.toHaveBeenCalled();
      expect(h.ecarter).not.toHaveBeenCalled();
    },
  );

  it("sans session : refus", async () => {
    h.session = null;
    for (const geste of gestes) expect((await geste()).etat).toBe("erreur");
  });

  it("un administrateur valide une proposition avec les dates de la base", async () => {
    expect((await validerPropositionAction(INITIAL, form({ id: ID, confirmer: "oui" }))).etat).toBe(
      "ok",
    );
    expect(h.valider).toHaveBeenCalledWith(
      expect.objectContaining({
        rendezVousCle: "calendly:ev1",
        source: "calendly",
        acteurId: "u1",
        tenuAt: new Date("2026-11-10T10:00:00Z"),
      }),
    );
  });

  it("saisie manuelle : source « saisie », sans clé, date de prise celle du formulaire", async () => {
    expect((await gestes[2]!()).etat).toBe("ok");
    const e = (h.valider.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(e).toMatchObject({ source: "saisie", rendezVousCle: null });
    expect(e["prisAt"]).not.toEqual(e["tenuAt"]);
  });

  it("saisie sans « pris le » : refus, aucun appel au métier", async () => {
    const r = await saisirRendezVousAction(
      INITIAL,
      form({
        presentationId: ID,
        canal: "telephone",
        tenuLe: "2026-11-10T10:00",
        motif: "Appel noté au carnet",
        confirmer: "oui",
      }),
    );
    expect(r.etat).toBe("erreur");
    expect(h.valider).not.toHaveBeenCalled();
  });

  it("sans confirmation côté serveur : aucun appel au métier (les trois gestes)", async () => {
    const sans = [
      validerPropositionAction(INITIAL, form({ id: ID })),
      ecarterPropositionAction(INITIAL, form({ id: ID })),
      saisirRendezVousAction(
        INITIAL,
        form({
          presentationId: ID,
          canal: "telephone",
          tenuLe: "2026-11-10T10:00",
          prisLe: "2026-11-05T10:00",
        }),
      ),
    ];
    for (const r of await Promise.all(sans)) expect(r.etat).toBe("erreur");
    expect(h.valider).not.toHaveBeenCalled();
    expect(h.ecarter).not.toHaveBeenCalled();
  });

  it("interrupteur éteint : aucune validation", async () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "");
    expect((await gestes[0]!()).etat).toBe("erreur");
    expect((await gestes[1]!()).etat).toBe("erreur");
    expect((await gestes[2]!()).etat).toBe("erreur");
    expect(h.valider).not.toHaveBeenCalled();
    expect(h.ecarter).not.toHaveBeenCalled();
  });

  it("« Annulé par Axion IA » : la date de prise est exigée", async () => {
    const r = await saisirRendezVousAction(
      INITIAL,
      form({
        presentationId: ID,
        canal: "annule_par_axion",
        tenuLe: "2026-11-10T10:00",
        motif: "Annulé par nous",
        confirmer: "oui",
      }),
    );
    expect(r.etat).toBe("erreur");
    expect(h.valider).not.toHaveBeenCalled();
  });

  it("« Annulé par Axion IA » avec la date de prise : le canal est transmis, prise ≠ tenue", async () => {
    const r = await saisirRendezVousAction(
      INITIAL,
      form({
        presentationId: ID,
        canal: "annule_par_axion",
        tenuLe: "2026-11-10T10:00",
        prisLe: "2026-11-05T10:00",
        motif: "Appel noté au carnet",
        confirmer: "oui",
      }),
    );
    expect(r.etat).toBe("ok");
    const e = (h.valider.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(e).toMatchObject({ canal: "annule_par_axion", source: "saisie" });
    expect(e["prisAt"]).not.toEqual(e["tenuAt"]);
  });

  it("saisie sans motif : refus, aucun appel au métier (E4)", async () => {
    for (const motif of [undefined, "", "   "]) {
      const o: Record<string, string> = {
        presentationId: ID,
        canal: "telephone",
        tenuLe: "2026-11-10T10:00",
        prisLe: "2026-11-05T10:00",
        confirmer: "oui",
      };
      if (motif !== undefined) o["motif"] = motif;
      expect((await saisirRendezVousAction(INITIAL, form(o))).etat).toBe("erreur");
    }
    expect(h.valider).not.toHaveBeenCalled();
  });

  it("saisie avec motif : transmis (rogné) au métier (E4)", async () => {
    await gestes[2]!();
    const e = (h.valider.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(e["motif"]).toBe("Appel noté au carnet");
  });

  describe("proposition « rencontre: » : « Pris (convenu) le » (L9)", () => {
    beforeEach(() => {
      h.proposition = {
        presentationId: ID,
        rendezVousCle: "rencontre:r1",
        prisAt: new Date("2026-11-05T10:00:00Z"),
        creeAt: new Date("2026-11-12T08:00:00Z"),
        rendezVousAt: new Date("2026-11-10T10:00:00Z"),
        ecarteeAt: null,
        retenueAt: null,
      };
    });
    const valide = (extra: Record<string, string>) =>
      validerPropositionAction(INITIAL, form({ id: ID, confirmer: "oui", ...extra }));

    it("date fournie : transmise comme prisAt", async () => {
      expect((await valide({ prisLe: "2026-11-03T10:00" })).etat).toBe("ok");
      const e = (h.valider.mock.calls[0] as unknown as [Record<string, unknown>])[0];
      expect(e["prisAt"]).toBeInstanceOf(Date);
      expect(e["source"]).toBe("rencontre");
    });

    it("date absente ou illisible : refus", async () => {
      expect((await valide({})).etat).toBe("erreur");
      expect((await valide({ prisLe: "demain" })).etat).toBe("erreur");
      expect(h.valider).not.toHaveBeenCalled();
    });

    it("date postérieure à la création de la proposition : refus", async () => {
      const r = await valide({ prisLe: "2026-11-13T10:00" });
      expect(r.etat).toBe("erreur");
      expect(h.valider).not.toHaveBeenCalled();
    });

    it("date dans le futur : refus", async () => {
      h.proposition!["creeAt"] = new Date("2099-01-01T00:00:00Z");
      const r = await valide({ prisLe: "2098-01-01T10:00" });
      expect(r.etat).toBe("erreur");
      expect(h.valider).not.toHaveBeenCalled();
    });

    it("une proposition calendly n'exige rien et ne transmet aucun prisAt", async () => {
      h.proposition!["rendezVousCle"] = "calendly:ev1";
      expect((await valide({ prisLe: "2026-11-03T10:00" })).etat).toBe("ok");
      const e = (h.valider.mock.calls[0] as unknown as [Record<string, unknown>])[0];
      expect(e["prisAt"]).toBeUndefined();
    });
  });
});
