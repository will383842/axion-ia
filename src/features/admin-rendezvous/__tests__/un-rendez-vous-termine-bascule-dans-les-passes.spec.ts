// Le cycle d'un rendez-vous après la visio (2026-09-28).
//
// Demande de Will : « une fois une visio passée, ça indique toujours "en
// cours" et il reste visible sur la page Rendez-vous ; il ne faudrait pas qu'il
// bascule sur une page rendez-vous passés ? Et une fois la visio terminée, je
// ne sais pas s'il se passe quelque chose ou pas. »

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyEvents = vi.fn();
const findManySuivis = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { findMany: (...a: unknown[]) => findManyEvents(...a) },
    rendezVousSuivi: { findMany: (...a: unknown[]) => findManySuivis(...a) },
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));

import {
  JOURS_PASSES,
  listRendezVousAVenir,
  listRendezVousPasses,
  lirePointsDesRendezVous,
} from "../queries";
import { listRendezVousAFaireLePoint } from "../suivi-queries";
import { etatRendezVous, MINUTES_APRES_FIN } from "../visio";
import { joursDeRetard, libelleDuPoint } from "../point";

const DEBUT = new Date("2026-09-28T13:30:00Z");
const FIN = new Date("2026-09-28T13:45:00Z");
const ms = (d: Date, deltaMs: number) => new Date(d.getTime() + deltaMs);

type Suivi = {
  issue: "eu_lieu" | "absent" | "reporte";
  suite: "devis" | "relance" | "proposition" | "aucune" | null;
  suiteLe: Date | null;
  note: string | null;
  decision: "retenu" | "a_revoir" | "non_retenu" | null;
  noteSur20: number | null;
} | null;

function ligne(
  id: string,
  debut: Date,
  fin: Date | null,
  extra: { status?: string; eventTypeName?: string; suivi?: Suivi } = {},
) {
  return {
    id,
    eventTypeName: extra.eventTypeName ?? "Discutons de votre projet IA",
    status: extra.status ?? "scheduled",
    startTime: debut,
    endTime: fin,
    inviteeName: `Personne ${id}`,
    inviteeEmail: `${id}@example.com`,
    inviteePhone: null,
    location: "https://calendly.com/events/x/google_meet",
    rawPayload: {},
    notes: null,
    capturedAt: new Date("2026-09-20T10:00:00Z"),
    suivi: extra.suivi ?? null,
  };
}

const APPORTEUR = "Échange apporteur d'affaires (15 min)";

beforeEach(() => vi.clearAllMocks());

describe("l'état d'un rendez-vous : à venir, en cours, terminé", () => {
  it("bascule EXACTEMENT au début, puis EXACTEMENT à la fin", () => {
    expect(etatRendezVous(DEBUT, FIN, ms(DEBUT, -1))).toBe("a_venir");
    expect(etatRendezVous(DEBUT, FIN, DEBUT)).toBe("en_cours");
    expect(etatRendezVous(DEBUT, FIN, ms(FIN, -1))).toBe("en_cours");
    expect(etatRendezVous(DEBUT, FIN, FIN)).toBe("termine");
    expect(etatRendezVous(DEBUT, FIN, ms(FIN, 30 * 60_000))).toBe("termine");
  });

  it("fin inconnue : début + 60 minutes", () => {
    expect(etatRendezVous(DEBUT, null, ms(DEBUT, 59 * 60_000))).toBe("en_cours");
    expect(etatRendezVous(DEBUT, null, ms(DEBUT, 60 * 60_000))).toBe("termine");
  });

  it("la carte : « en cours » pendant, « terminé » dans la grâce, puis elle quitte À venir", async () => {
    findManyEvents.mockResolvedValue([ligne("evt_1", DEBUT, FIN)]);

    const pendant = await listRendezVousAVenir({ maintenant: ms(FIN, -1) });
    expect(pendant[0]?.etat).toBe("en_cours");
    expect(pendant[0]?.enCours).toBe(true);

    const aLaFin = await listRendezVousAVenir({ maintenant: FIN });
    expect(aLaFin[0]?.etat).toBe("termine");
    // Les boutons du point (et de la visio) restent pendant la grâce.
    expect(aLaFin[0]?.enCours).toBe(true);

    const finDeGrace = ms(FIN, MINUTES_APRES_FIN * 60_000);
    const derniereMinute = await listRendezVousAVenir({ maintenant: finDeGrace });
    expect(derniereMinute).toHaveLength(1);
    expect(derniereMinute[0]?.etat).toBe("termine");

    const apres = await listRendezVousAVenir({ maintenant: ms(finDeGrace, 1) });
    expect(apres).toHaveLength(0);
  });

  it("la carte terminée porte le point déjà fait", async () => {
    findManyEvents.mockResolvedValue([
      ligne("evt_1", DEBUT, FIN, {
        eventTypeName: APPORTEUR,
        suivi: {
          issue: "eu_lieu",
          suite: null,
          suiteLe: null,
          note: null,
          decision: "retenu",
          noteSur20: 16,
        },
      }),
    ]);
    const [r] = await listRendezVousAVenir({ maintenant: ms(FIN, 60_000) });
    expect(r?.etat).toBe("termine");
    expect(r?.suivi?.decision).toBe("retenu");
  });
});

describe("l'onglet « Passés »", () => {
  const MAINTENANT = new Date("2026-09-28T18:00:00Z");
  const jour = (n: number) => ms(MAINTENANT, -n * 86_400_000);

  it("liste les terminés, du plus récent au plus ancien, avec leur point ou « sans point »", async () => {
    findManyEvents.mockResolvedValue([
      ligne("ancien", jour(40), ms(jour(40), 15 * 60_000)),
      ligne("recent", jour(1), ms(jour(1), 15 * 60_000), {
        suivi: {
          issue: "eu_lieu",
          suite: "devis",
          suiteLe: new Date("2026-10-01T00:00:00Z"),
          note: "Veut un devis formation",
          decision: null,
          noteSur20: null,
        },
      }),
    ]);

    const passes = await listRendezVousPasses({ maintenant: MAINTENANT });

    expect(passes.map((r) => r.sourceRecordId)).toEqual(["recent", "ancien"]);
    expect(passes[0]?.suivi && libelleDuPoint(passes[0].suivi)).toBe("A eu lieu · Devis à envoyer");
    expect(passes[0]?.suivi?.note).toBe("Veut un devis formation");
    // Plus de 30 jours sans point : il ne disparaît plus, il est « sans point ».
    expect(passes[1]?.suivi).toBeNull();
  });

  it("exclut les annulés et ceux qui ne sont pas terminés", async () => {
    findManyEvents.mockResolvedValue([
      ligne("annule", jour(2), ms(jour(2), 15 * 60_000), { status: "canceled" }),
      ligne("en-cours", ms(MAINTENANT, -5 * 60_000), ms(MAINTENANT, 10 * 60_000)),
      ligne("absent-coche", jour(3), ms(jour(3), 15 * 60_000), { status: "no_show" }),
    ]);

    const passes = await listRendezVousPasses({ maintenant: MAINTENANT });

    expect(passes.map((r) => r.sourceRecordId)).toEqual(["absent-coche"]);
    const arg = findManyEvents.mock.calls[0]?.[0] as {
      where: { status: { in: string[] }; startTime: { gte: Date; lte: Date } };
    };
    expect(arg.where.status.in).not.toContain("canceled");
    // Fenêtre de 90 jours, demandée à la base.
    expect(arg.where.startTime.gte.getTime()).toBe(jour(JOURS_PASSES).getTime());
    expect(JOURS_PASSES).toBe(90);
  });

  it("se filtre par public, comme les autres onglets", async () => {
    findManyEvents.mockResolvedValue([
      ligne("client", jour(1), ms(jour(1), 15 * 60_000)),
      ligne("apporteur", jour(2), ms(jour(2), 15 * 60_000), {
        eventTypeName: APPORTEUR,
        suivi: {
          issue: "eu_lieu",
          suite: null,
          suiteLe: null,
          note: null,
          decision: "non_retenu",
          noteSur20: 8,
        },
      }),
    ]);

    const apporteurs = await listRendezVousPasses({ maintenant: MAINTENANT, public: "apporteurs" });
    expect(apporteurs.map((r) => r.sourceRecordId)).toEqual(["apporteur"]);
    expect(apporteurs[0]?.suivi && libelleDuPoint(apporteurs[0].suivi)).toBe(
      "A eu lieu · Sans suite",
    );

    const clients = await listRendezVousPasses({ maintenant: MAINTENANT, public: "clients" });
    expect(clients.map((r) => r.sourceRecordId)).toEqual(["client"]);
  });
});

describe("le libellé du point", () => {
  it("dit l'issue, puis la décision apporteur ou la suite client", () => {
    expect(libelleDuPoint({ issue: "absent", suite: null, decision: null })).toBe("Absent");
    expect(libelleDuPoint({ issue: "reporte", suite: null })).toBe("Reporté");
    expect(libelleDuPoint({ issue: "eu_lieu", suite: null, decision: "a_revoir" })).toBe(
      "A eu lieu · À revoir",
    );
    expect(libelleDuPoint({ issue: "eu_lieu", suite: "aucune" })).toBe("A eu lieu · Pas de suite");
  });

  it("la liste des appels lit le point de chaque rendez-vous affiché", async () => {
    findManySuivis.mockResolvedValue([
      { calendlyEventId: "evt_1", issue: "absent", suite: null, decision: null },
    ]);
    const points = await lirePointsDesRendezVous(["evt_1", "evt_2"]);
    expect(points.get("evt_1")).toEqual({ issue: "absent", suite: null, decision: null });
    expect(points.has("evt_2")).toBe(false);
  });

  it("aucune requête quand aucun rendez-vous n'est affiché", async () => {
    const points = await lirePointsDesRendezVous([]);
    expect(points.size).toBe(0);
    expect(findManySuivis).not.toHaveBeenCalled();
  });
});

describe("le rappel des 24 heures dans « À faire le point »", () => {
  it("bornes : fin + 23 h 59 pas en retard, fin + 24 h en retard d'un jour", () => {
    expect(joursDeRetard(FIN, ms(FIN, 24 * 3_600_000 - 60_000))).toBeNull();
    expect(joursDeRetard(FIN, ms(FIN, 24 * 3_600_000))).toBe(1);
    expect(joursDeRetard(FIN, ms(FIN, 3 * 86_400_000 + 3_600_000))).toBe(3);
  });

  it("les retards passent en tête, le plus ancien d'abord", async () => {
    const MAINTENANT = new Date("2026-09-28T18:00:00Z");
    const h = (n: number) => ms(MAINTENANT, n * 3_600_000);
    // La base rend par début croissant. L'atelier de 7 h commence AVANT
    // « retard-1j » mais finit il y a 20 h : pas en retard, il passe derrière.
    findManyEvents.mockResolvedValue([
      ligne("retard-3j", h(-73), h(-72.75)),
      ligne("atelier-7h", h(-27), h(-20)),
      ligne("retard-1j", h(-26), h(-25)),
      ligne("ce-matin", h(-6), h(-5)),
    ]);

    const liste = await listRendezVousAFaireLePoint({ maintenant: MAINTENANT });

    expect(liste.map((r) => [r.id, r.retardJours])).toEqual([
      ["retard-3j", 3],
      ["retard-1j", 1],
      ["atelier-7h", null],
      ["ce-matin", null],
    ]);
  });
});
