/**
 * Lot B, M17 — la tuile « à faire le point » et un échange FORMATEUR.
 *
 *   · le suivi des échanges formateurs allumé : un échange rattaché mène aux 5 issues
 *     formateur, un échange non rattaché au rattachement manuel — jamais au formulaire
 *     client ; le serveur refuse aussi le formulaire client pour un tel échange ;
 *   · coupé : comportement d'avant, à l'identique ;
 *   · apporteurs et clients : inchangés.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const findUnique = vi.fn();
const findMany = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/prisma", () => {
  const prisma = {
    calendlyEvent: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
    rendezVousSuivi: { upsert: (...a: unknown[]) => upsert(...a) },
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const etatsEntree = vi.fn();
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: () => etatsEntree(),
}));

import { formulaireDuPoint } from "../point-formateur";
import { enregistrerSuiviAction } from "../suivi-actions";
import { listRendezVousAFaireLePoint } from "../suivi-queries";

const INITIAL = { etat: "initial" } as const;
const CAND = "0b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10";

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c", role: "super_admin" } });
  etatsEntree.mockResolvedValue({ suivi_echange: true });
  upsert.mockResolvedValue({});
});

describe("formulaireDuPoint — quel formulaire porte la carte", () => {
  const base = { typeRendezVous: "autre" as const, echangeFormateur: false, rattache: false };
  it("apporteur : son formulaire, inchangé", () => {
    expect(formulaireDuPoint({ ...base, typeRendezVous: "apporteur" }, true)).toBe("apporteur");
    expect(formulaireDuPoint({ ...base, typeRendezVous: "apporteur" }, false)).toBe("apporteur");
  });
  it("client ou autre : le formulaire commun, inchangé", () => {
    expect(formulaireDuPoint(base, true)).toBe("commun");
    expect(formulaireDuPoint({ ...base, typeRendezVous: "diagnostic" }, true)).toBe("commun");
  });
  it("échange formateur, suivi allumé : ses 5 issues, ou le rattachement s'il manque", () => {
    expect(formulaireDuPoint({ ...base, echangeFormateur: true, rattache: true }, true)).toBe(
      "formateur",
    );
    expect(formulaireDuPoint({ ...base, echangeFormateur: true, rattache: false }, true)).toBe(
      "rattacher_formateur",
    );
  });
  it("échange formateur, suivi coupé : comportement d'avant", () => {
    expect(formulaireDuPoint({ ...base, echangeFormateur: true, rattache: true }, false)).toBe(
      "commun",
    );
  });
});

describe("listRendezVousAFaireLePoint — l'échange formateur est reconnu", () => {
  it("porte « échange formateur » et « rattaché »", async () => {
    const fin = new Date(Date.now() - 2 * 3_600_000);
    findMany.mockResolvedValue([
      {
        id: "evt_f",
        eventTypeName: "Échange formateur indépendant (20 min)",
        startTime: new Date(fin.getTime() - 20 * 60_000),
        endTime: fin,
        inviteeName: "Camille M.",
        inviteeEmail: "c@x.fr",
        rawPayload: null,
        typeRendezVous: "formateur",
        linkedJobApplicationId: CAND,
      },
    ]);
    const [r] = await listRendezVousAFaireLePoint();
    expect(r).toMatchObject({ id: "evt_f", echangeFormateur: true, rattache: true });
  });
});

describe("enregistrerSuiviAction — le formulaire client refuse un échange formateur", () => {
  const champs = {
    calendlyEventId: "evt_f",
    issue: "absent",
  };

  it("suivi formateur allumé : refus, rien n'est écrit", async () => {
    findUnique.mockResolvedValue({
      id: "evt_f",
      eventTypeName: "Échange formateur indépendant (20 min)",
      typeRendezVous: "formateur",
    });
    const r = await enregistrerSuiviAction(INITIAL, formulaire(champs));
    expect(r.etat).toBe("erreur");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("suivi formateur coupé : comportement d'avant (le point s'enregistre)", async () => {
    etatsEntree.mockResolvedValue({ suivi_echange: false });
    findUnique.mockResolvedValue({
      id: "evt_f",
      eventTypeName: "Échange formateur indépendant (20 min)",
      typeRendezVous: "formateur",
    });
    const r = await enregistrerSuiviAction(INITIAL, formulaire(champs));
    expect(r.etat).toBe("ok");
  });

  it("un rendez-vous qui n'est pas un échange formateur n'est jamais concerné (l'interrupteur n'est même pas lu)", async () => {
    findUnique.mockResolvedValue({
      id: "evt_c",
      eventTypeName: "Appel découverte",
      typeRendezVous: "autre",
    });
    const r = await enregistrerSuiviAction(
      INITIAL,
      formulaire({ ...champs, calendlyEventId: "evt_c" }),
    );
    expect(r.etat).toBe("ok");
    expect(etatsEntree).not.toHaveBeenCalled();
  });
});
