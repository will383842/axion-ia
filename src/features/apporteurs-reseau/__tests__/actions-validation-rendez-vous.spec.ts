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
  () => validerPropositionAction(INITIAL, form({ id: ID })),
  () => ecarterPropositionAction(INITIAL, form({ id: ID })),
  () =>
    saisirRendezVousAction(
      INITIAL,
      form({ presentationId: ID, canal: "telephone", tenuLe: "2026-11-10T10:00" }),
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
    expect((await validerPropositionAction(INITIAL, form({ id: ID }))).etat).toBe("ok");
    expect(h.valider).toHaveBeenCalledWith(
      expect.objectContaining({
        rendezVousCle: "calendly:ev1",
        source: "calendly",
        acteurId: "u1",
        tenuAt: new Date("2026-11-10T10:00:00Z"),
      }),
    );
  });

  it("saisie manuelle : source « saisie », sans clé, pris = tenu par défaut", async () => {
    expect((await gestes[2]!()).etat).toBe("ok");
    const e = (h.valider.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(e).toMatchObject({ source: "saisie", rendezVousCle: null });
    expect(e["prisAt"]).toEqual(e["tenuAt"]);
  });

  it("interrupteur éteint : aucune validation", async () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "");
    expect((await gestes[0]!()).etat).toBe("erreur");
    expect((await gestes[2]!()).etat).toBe("erreur");
    expect(h.valider).not.toHaveBeenCalled();
  });
});
