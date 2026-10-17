/**
 * QNC L06 — un rattrapage n'est PAS un lien rouvert.
 *
 *   - il est motivé, saisi par l'organisme, seulement sur une demi-journée close
 *     et non signée, et seulement interrupteur allumé ;
 *   - il n'écrit AUCUNE signature (hors du tuple haché) : la présence du
 *     créneau et sa trace au journal, dans la même transaction ;
 *   - il est compté comme ÉCART et visible comme tel.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    presenceCreneau: { findUnique: vi.fn(), update: vi.fn() },
    activityLog: { count: vi.fn(), create: vi.fn() },
    emargementSignature: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/server/qualiopi/presence/presence-service", () => ({ recomputeTauxPresence: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { ACTION_RATTRAPAGE, refusRattrapage, saisirRattrapage } from "../rattrapage";
import { ecartsDuSuivi, etatDemiJournee, ETATS_ECART, LIBELLE_ETAT } from "../suivi";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  setting: { findUnique: Fn };
  presenceCreneau: { findUnique: Fn; update: Fn };
  activityLog: { count: Fn; create: Fn };
  emargementSignature: { create: Fn };
  $transaction: Fn;
};

const JOUR_DATE = new Date("2026-10-15T00:00:00.000Z");
const APRES_LE_MATIN = new Date("2026-10-15T12:00:00.000Z");
const PENDANT_LE_MATIN = new Date("2026-10-15T08:00:00.000Z");
const MOTIF = "Téléphone du stagiaire déchargé, présence constatée par le formateur.";

function creneau(over: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    date: JOUR_DATE,
    demiJournee: "matin",
    dureePrevueMinutes: 240,
    importId: null,
    commentaire: "Arrivé à 09:20",
    enrollmentId: "enr-1",
    enrollment: {
      session: {
        id: "ses-1",
        statut: "en_cours",
        estTestInterne: false,
        jours: [{ date: JOUR_DATE, heureDebut: "09:00", heureFin: "17:00" }],
      },
    },
    emargementSignatures: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.setting.findUnique.mockResolvedValue({ value: { etat: "actif" } });
  db.presenceCreneau.findUnique.mockResolvedValue(creneau());
  db.activityLog.count.mockResolvedValue(0);
  db.activityLog.create.mockResolvedValue({});
  db.presenceCreneau.update.mockResolvedValue({});
  db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(db));
});

describe("refusRattrapage — pure", () => {
  const base = {
    actif: true,
    sessionStatut: "en_cours",
    position: "close" as const,
    motif: MOTIF,
    signee: false,
    dejaRattrape: false,
  };
  it("recevable : allumé, close, non signée, motivée", () => {
    expect(refusRattrapage(base)).toBeNull();
  });
  it("refusé sans motif suffisant", () => {
    expect(refusRattrapage({ ...base, motif: "   oubli   " })).toBe("motif_trop_court");
  });
  it("refusé tant que la demi-journée est ouverte : ce n'est pas un raccourci", () => {
    expect(refusRattrapage({ ...base, position: "ouverte" })).toBe("demi_journee_non_close");
  });
  it("refusé si déjà signée ou déjà rattrapée", () => {
    expect(refusRattrapage({ ...base, signee: true })).toBe("deja_signe");
    expect(refusRattrapage({ ...base, dejaRattrape: true })).toBe("deja_rattrape");
  });
  it("ÉTEINT : le rattrapage motivé n'existe pas", () => {
    expect(refusRattrapage({ ...base, actif: false })).toBe("interrupteur_eteint");
  });
});

describe("saisirRattrapage", () => {
  it("pose la présence et sa trace au journal, SANS aucune signature", async () => {
    const r = await saisirRattrapage({
      creneauId: "11111111-1111-4111-8111-111111111111",
      motif: MOTIF,
      adminUserId: "22222222-2222-4222-8222-222222222222",
      maintenant: APRES_LE_MATIN,
    });
    expect(r).toEqual({ ok: true });
    expect(db.emargementSignature.create).not.toHaveBeenCalled();

    const maj = db.presenceCreneau.update.mock.calls[0]?.[0].data;
    expect(maj.present).toBe(true);
    expect(maj.dureeRealiseeMinutes).toBe(240);
    // Rien ne s'efface : le commentaire existant est conservé.
    expect(maj.commentaire).toMatch(/^Arrivé à 09:20\nRattrapage de l'organisme/);
    expect(maj.commentaire).toContain(MOTIF);

    const trace = db.activityLog.create.mock.calls[0]?.[0].data;
    expect(trace.action).toBe(ACTION_RATTRAPAGE);
    expect(trace.targetId).toBe("11111111-1111-4111-8111-111111111111");
    expect(trace.adminUserId).toBe("22222222-2222-4222-8222-222222222222");
    expect(trace.changes).toMatchObject({ motif: MOTIF, demiJournee: "matin", date: "2026-10-15" });
  });

  it("sans trace, pas de rattrapage : un journal qui échoue annule tout", async () => {
    db.activityLog.create.mockRejectedValue(new Error("journal indisponible"));
    await expect(
      saisirRattrapage({
        creneauId: "11111111-1111-4111-8111-111111111111",
        motif: MOTIF,
        adminUserId: "22222222-2222-4222-8222-222222222222",
        maintenant: APRES_LE_MATIN,
      }),
    ).rejects.toThrow("journal indisponible");
  });

  it("refusé pendant la demi-journée : le stagiaire signe lui-même", async () => {
    const r = await saisirRattrapage({
      creneauId: "11111111-1111-4111-8111-111111111111",
      motif: MOTIF,
      adminUserId: "22222222-2222-4222-8222-222222222222",
      maintenant: PENDANT_LE_MATIN,
    });
    expect(r).toEqual({ ok: false, raison: "demi_journee_non_close" });
    expect(db.presenceCreneau.update).not.toHaveBeenCalled();
  });

  it("ÉTEINT (clé absente) : refusé, rien n'est écrit", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    const r = await saisirRattrapage({
      creneauId: "11111111-1111-4111-8111-111111111111",
      motif: MOTIF,
      adminUserId: "22222222-2222-4222-8222-222222222222",
      maintenant: APRES_LE_MATIN,
    });
    expect(r).toEqual({ ok: false, raison: "interrupteur_eteint" });
    expect(db.presenceCreneau.update).not.toHaveBeenCalled();
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });
});

describe("le rattrapage est compté comme écart, et visible comme tel", () => {
  const fenetre = {
    debut: new Date("2026-10-15T07:00:00.000Z"),
    fin: new Date("2026-10-15T11:00:00.000Z"),
  };

  it("états d'une demi-journée", () => {
    expect(etatDemiJournee({ position: "close", fenetre, signeAt: null, rattrapage: true })).toBe(
      "rattrapage",
    );
    expect(etatDemiJournee({ position: "close", fenetre, signeAt: null, rattrapage: false })).toBe(
      "non_signee",
    );
    expect(
      etatDemiJournee({
        position: "close",
        fenetre,
        signeAt: new Date("2026-10-15T08:30:00.000Z"),
        rattrapage: false,
      }),
    ).toBe("signee");
    // Une signature posée sous l'ancien régime (48 h) reste un écart visible.
    expect(
      etatDemiJournee({
        position: "close",
        fenetre,
        signeAt: new Date("2026-10-16T09:00:00.000Z"),
        rattrapage: false,
      }),
    ).toBe("signee_hors_creneau");
    expect(
      etatDemiJournee({ position: "ouverte", fenetre, signeAt: null, rattrapage: false }),
    ).toBe("a_signer");
  });

  it("ecartsDuSuivi compte le rattrapage, jamais la signature", () => {
    expect(ETATS_ECART.has("rattrapage")).toBe(true);
    expect(ETATS_ECART.has("signee")).toBe(false);
    expect(LIBELLE_ETAT.rattrapage).toMatch(/^Écart/);
    const dj = (etat: "signee" | "rattrapage") => ({
      creneauId: etat,
      date: "2026-10-15",
      demiJournee: "matin" as const,
      heureDebut: "09:00",
      heureFin: "13:00",
      etat,
      signeAt: null,
      motifRattrapage: etat === "rattrapage" ? MOTIF : null,
      rappelEnvoyeLe: null,
    });
    const ecarts = ecartsDuSuivi({
      stagiaires: [
        {
          enrollmentId: "enr-1",
          stagiaireNom: "Alice Dupont",
          adaptation: false,
          emailPresent: true,
          demiJournees: [dj("signee"), dj("rattrapage")],
        },
      ],
    });
    expect(ecarts.map((e) => e.demiJournee.etat)).toEqual(["rattrapage"]);
    expect(ecarts[0]?.demiJournee.motifRattrapage).toBe(MOTIF);
  });
});
