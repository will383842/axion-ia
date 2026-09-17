// @vitest-environment node

/**
 * 🔴 UN BANDEAU ROUGE PERMANENT APPREND À NE PLUS LIRE LES BANDEAUX ROUGES.
 *
 * Défaut relevé en relecture le 2026-09-17. La première version passait une
 * fenêtre de TRENTE JOURS à `analyserSerie`, dont la précondition écrite est
 * « ces lignes sont consécutives, postérieures au dernier succès ». Elle violait
 * donc son propre contrat, et l'écran affichait « série en cours » sur des
 * échecs vieux de semaines — que RIEN ne pouvait faire redescendre, puisqu'une
 * ligne dont le job BullMQ a été purgé n'est plus rejouable.
 *
 * Deux grandeurs, deux usages :
 *   - le STOCK à rattraper (`total`, `sansJob`) → l'action ;
 *   - la SÉRIE en cours (`panneEnCours`), lue avec la borne de la sonde →
 *     l'alarme, et elle seule met du rouge.
 *
 * ⚠️ Ce fichier existe parce qu'une mutation est restée VERTE : remplacer
 * `panneEnCours` par la série calculée sur le stock ne rougissait nulle part.
 * `resumerEchecsRenvoyables` n'avait aucun test — une garde absente, pas une
 * garde faible.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findMany: (...a: unknown[]) => d.findMany(...a),
      findFirst: (...a: unknown[]) => d.findFirst(...a),
      count: (...a: unknown[]) => d.count(...a),
    },
  },
}));

import { resumerEchecsRenvoyables } from "../query";

const T = new Date("2026-09-17T08:40:00.000Z");

/** Un échec, daté en heures AVANT `T`. */
const echec = (heures: number, recipient: string, error = "535 Authentication Failed") => ({
  recipient,
  template: "candidature-accuse-reception",
  error,
  failedAt: new Date(T.getTime() - heures * 3600_000),
  createdAt: new Date(T.getTime() - heures * 3600_000),
});

beforeEach(() => {
  vi.clearAllMocks();
  d.count.mockResolvedValue(0);
});

describe("resumerEchecsRenvoyables — le stock et la panne ne sont pas la même chose", () => {
  it("🔴 un STOCK ancien ne déclare PAS de panne en cours", () => {
    // Trois échecs d'il y a trois semaines, et un envoi réussi il y a une
    // minute : il reste du rattrapage à faire, la chaîne va bien.
    const vieux = [echec(500, "a@x.fr"), echec(490, "b@x.fr"), echec(480, "c@x.fr")];
    d.findMany.mockResolvedValueOnce(vieux).mockResolvedValueOnce([]);
    d.findFirst.mockResolvedValue({ sentAt: new Date(T.getTime() - 60_000) });

    return resumerEchecsRenvoyables(T).then((r) => {
      expect(r.total).toBe(3);
      expect(
        r.panneEnCours,
        "le bandeau serait rouge en permanence sur un stock que rien ne fait redescendre",
      ).toBe(false);
    });
  });

  it("🔴 une SÉRIE en cours déclare bien la panne", async () => {
    // Témoin positif : sans lui, un `panneEnCours` codé à `false` passerait le
    // test précédent en paraissant prudent, et le rouge ne s'allumerait JAMAIS.
    const serie = [echec(30, "a@x.fr"), echec(20, "b@x.fr"), echec(10, "c@x.fr")];
    d.findMany.mockResolvedValueOnce(serie).mockResolvedValueOnce(serie);
    d.findFirst.mockResolvedValue({ sentAt: new Date(T.getTime() - 44 * 3600_000) });

    const r = await resumerEchecsRenvoyables(T);

    expect(r.panneEnCours).toBe(true);
    expect(r.total).toBe(3);
  });

  it("🔑 la série est lue avec la BORNE de la sonde, pas avec la fenêtre de l'écran", async () => {
    const succes = new Date(T.getTime() - 44 * 3600_000);
    d.findMany.mockResolvedValue([]);
    d.findFirst.mockResolvedValue({ sentAt: succes });

    await resumerEchecsRenvoyables(T);

    // Deuxième lecture = la série. Son `where` doit porter la borne « postérieur
    // au dernier succès », pas la fenêtre de trente jours de l'écran.
    const whereSerie = (d.findMany.mock.calls[1]?.[0] as { where: { OR?: unknown[] } }).where;
    expect(whereSerie.OR, "la borne du dernier succès n'est pas appliquée").toBeDefined();
    expect(JSON.stringify(whereSerie)).toContain(succes.toISOString());
  });

  it("expose l'instant de lecture, qui borne le consentement du renvoi", async () => {
    d.findMany.mockResolvedValue([]);
    d.findFirst.mockResolvedValue(null);

    const r = await resumerEchecsRenvoyables(T);

    expect(r.luA).toEqual(T);
  });

  it("une base illisible n'affiche rien plutôt que de mentir", async () => {
    d.findMany.mockRejectedValue(new Error("connexion perdue"));

    const r = await resumerEchecsRenvoyables(T);

    expect(r.total).toBe(0);
    expect(r.panneEnCours).toBe(false);
    expect(r.luA).toEqual(T);
  });

  it("compte séparément les échecs qu'on ne sait pas rejouer", async () => {
    d.findMany.mockResolvedValue([]);
    d.findFirst.mockResolvedValue(null);
    d.count.mockResolvedValue(4);

    const r = await resumerEchecsRenvoyables(T);

    expect(r.sansJob).toBe(4);
    expect(r.total).toBe(0);
  });
});
