// @vitest-environment node

/**
 * Renvoi EN LOT depuis le journal — 2026-09-17, après 43 heures de panne.
 *
 * ## Ce qui manquait
 *
 * Le journal portait un bouton « Renvoyer » PAR LIGNE. Le 17 septembre, il y
 * avait dix-huit lignes à reprendre, vers dix-huit personnes distinctes : dix-
 * huit clics, un par un, sans savoir combien il en restait. Et le résultat de
 * chaque clic partait dans un `console.warn` que personne ne lit.
 *
 * ## Les quatre propriétés gardées ici
 *
 *   1. RIEN ne part sans confirmation EXPLICITE — ce bouton écrit à des gens ;
 *   2. on ne renvoie JAMAIS plus que ce qui a été montré à l'écran ;
 *   3. un second renvoi simultané est REFUSÉ, et les lignes déjà revendiquées
 *      ne repartent pas une seconde fois ;
 *   4. le geste est TRACÉ au registre d'activité, sans carnet d'adresses.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  getJob: vi.fn(),
  requireAdminWrite: vi.fn(),
  logActivity: vi.fn(),
  revalidatePath: vi.fn(),
}));

/**
 * `$transaction` exécute la callback avec un `tx` qui porte exactement les
 * méthodes que l'action utilise. Un doublon incomplet rendrait `undefined`,
 * donc un `TypeError` — et le test passerait à côté de ce qu'il mesure.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        $queryRaw: (...a: unknown[]) => d.queryRaw(...a),
        emailLog: {
          findMany: (...a: unknown[]) => d.findMany(...a),
          updateMany: (...a: unknown[]) => d.updateMany(...a),
        },
      }),
    emailLog: {
      findUnique: vi.fn(),
      update: (...a: unknown[]) => d.update(...a),
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: (...a: unknown[]) => d.requireAdminWrite(...a),
  logQualiopiActivity: (...a: unknown[]) => d.logActivity(...a),
}));
vi.mock("@/server/queue/queues", () => ({
  emailsQueue: { getJob: (...a: unknown[]) => d.getJob(...a) },
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => d.revalidatePath(...a) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { renvoyerEchecsEnLotAction } from "../actions";

const verrouPris = (pris: boolean): void => {
  d.queryRaw.mockResolvedValue([{ locked: pris }]);
};

const ligne = (i: number) => ({
  id: `id-${i}`,
  jobId: `job-${i}`,
  template: "candidature-accuse-reception",
  recipient: `candidat${i}@exemple.fr`,
});

const jobEnEchec = () => ({ getState: async () => "failed", retry: vi.fn(async () => undefined) });

beforeEach(() => {
  vi.clearAllMocks();
  d.requireAdminWrite.mockResolvedValue({ userId: "u1" });
  d.logActivity.mockResolvedValue(undefined);
  d.updateMany.mockResolvedValue({ count: 0 });
  d.update.mockResolvedValue({});
  d.getJob.mockImplementation(async () => jobEnEchec());
  verrouPris(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("🔴 aucun envoi en masse sans confirmation explicite", () => {
  it("REFUSE sans la case cochée, et ne touche à RIEN", async () => {
    const r = await renvoyerEchecsEnLotAction({ confirmation: "", attendus: 18 });

    expect(r).toEqual({
      ok: false,
      error: "Renvoi non confirmé : cochez la case avant de renvoyer.",
    });
    expect(d.queryRaw).not.toHaveBeenCalled();
    expect(d.findMany).not.toHaveBeenCalled();
    expect(d.getJob).not.toHaveBeenCalled();
  });

  it("REFUSE une confirmation approchante — « oui » exactement, ou rien", async () => {
    for (const valeur of ["Oui", "OUI", "true", "1", "on", "o"]) {
      const r = await renvoyerEchecsEnLotAction({ confirmation: valeur, attendus: 18 });
      expect(r.ok, `« ${valeur} » a été accepté comme confirmation`).toBe(false);
    }
    expect(d.getJob).not.toHaveBeenCalled();
  });

  it("🔑 CONTRE-TÉMOIN : avec la confirmation, ça part vraiment", async () => {
    // Sans ce bloc, une action qui refuserait TOUT passerait les deux tests
    // précédents en paraissant prudente — et le bouton ne marcherait jamais.
    d.findMany.mockResolvedValue([ligne(1), ligne(2)]);

    const r = await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 2 });

    expect(r).toEqual({ ok: true, renvoyes: 2, destinataires: 2, irrecuperables: 0 });
    expect(d.getJob).toHaveBeenCalledTimes(2);
  });

  it("exige un administrateur en écriture AVANT toute lecture", async () => {
    d.requireAdminWrite.mockRejectedValue(new Error("interdit"));
    await expect(renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 5 })).rejects.toThrow(
      "interdit",
    );
    expect(d.findMany).not.toHaveBeenCalled();
  });
});

describe("🔴 on ne renvoie jamais plus que ce qui a été montré", () => {
  it("borne la lecture sur le nombre affiché à l'utilisateur", async () => {
    d.findMany.mockResolvedValue([ligne(1), ligne(2), ligne(3)]);

    await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 3 });

    // Le `take` est le consentement obtenu, pas un réglage de pagination :
    // trois échecs de plus tombés entre l'affichage et le clic attendront le
    // prochain geste.
    expect((d.findMany.mock.calls[0]?.[0] as { take: number }).take).toBe(3);
  });

  it("refuse un nombre absurde plutôt que de le tronquer en silence", async () => {
    for (const attendus of [0, -1, 1.5, 100_000]) {
      const r = await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus });
      expect(r.ok, `attendus=${attendus} accepté`).toBe(false);
    }
  });
});

describe("🔴 anti-doublon — un message déjà repris ne repart pas deux fois", () => {
  it("REFUSE quand le verrou consultatif est déjà tenu", async () => {
    verrouPris(false);

    const r = await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 18 });

    expect(r).toEqual({
      ok: false,
      error: "Un renvoi est déjà en cours : patientez quelques secondes.",
    });
    expect(d.findMany).not.toHaveBeenCalled();
    expect(d.getJob).not.toHaveBeenCalled();
  });

  it("🔑 REVENDIQUE les lignes dans la MÊME transaction que le verrou", async () => {
    // C'est la revendication, pas le verrou, qui tient l'idempotence dans la
    // durée : une fois passées en « en attente », ces lignes ne sont plus des
    // échecs, donc un second lot ne les voit plus — même verrou relâché.
    d.findMany.mockResolvedValue([ligne(1), ligne(2)]);

    await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 2 });

    expect(d.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["id-1", "id-2"] } },
      data: { status: "pending", failedAt: null },
    });
  });

  it("🔑 ne reprend le job BullMQ qu'APRÈS la revendication", async () => {
    // Un `retry()` n'est pas annulable par un rollback : le faire avant la
    // revendication laisserait un e-mail parti ET une ligne toujours « échec »,
    // donc rejouable une seconde fois.
    const ordre: string[] = [];
    d.findMany.mockResolvedValue([ligne(1)]);
    d.updateMany.mockImplementation(async () => {
      ordre.push("revendication");
      return { count: 1 };
    });
    d.getJob.mockImplementation(async () => {
      ordre.push("reprise");
      return jobEnEchec();
    });

    await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 1 });

    expect(ordre).toEqual(["revendication", "reprise"]);
  });

  it("REMET en échec la ligne dont le job a disparu — jamais laissée « en attente »", async () => {
    // Une ligne bloquée en « en attente » passerait pour un envoi en cours : elle
    // sortirait du seul écran qui la montre, et personne ne saurait qu'elle est
    // perdue.
    d.findMany.mockResolvedValue([ligne(1)]);
    d.getJob.mockResolvedValue(null);

    const r = await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 1 });

    expect(r).toEqual({ ok: true, renvoyes: 0, destinataires: 1, irrecuperables: 1 });
    expect(d.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "id-1" },
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("compte les destinataires DISTINCTS, pas les lignes", async () => {
    d.findMany.mockResolvedValue([
      { ...ligne(1), recipient: "Meme@Exemple.fr" },
      { ...ligne(2), recipient: "meme@exemple.fr" },
      ligne(3),
    ]);

    const r = await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 3 });

    expect(r).toEqual({ ok: true, renvoyes: 3, destinataires: 2, irrecuperables: 0 });
  });

  it("dit qu'il n'y a plus rien à renvoyer, sans faux succès", async () => {
    d.findMany.mockResolvedValue([]);

    const r = await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 5 });

    expect(r).toEqual({ ok: false, error: "Plus aucun envoi en échec à renvoyer." });
    expect(d.logActivity).not.toHaveBeenCalled();
  });
});

describe("🔴 le renvoi est tracé au registre d'activité", () => {
  it("écrit l'acte, ses comptes et ses gabarits — et AUCUNE adresse", async () => {
    d.findMany.mockResolvedValue([ligne(1), ligne(2)]);

    await renvoyerEchecsEnLotAction({ confirmation: "oui", attendus: 2 });

    expect(d.logActivity).toHaveBeenCalledTimes(1);
    const entree = d.logActivity.mock.calls[0]?.[0] as {
      action: string;
      targetType: string;
      changes: Record<string, unknown>;
    };
    expect(entree.action).toBe("emails.renvoi_en_lot");
    expect(entree.targetType).toBe("qualiopi.email_log");
    expect(entree.changes).toMatchObject({
      demandes: 2,
      renvoyes: 2,
      irrecuperables: 0,
      destinatairesDistincts: 2,
    });

    // 🔑 Le registre d'activité n'est pas un carnet d'adresses : une trace
    // d'audit conservée cinq ans ne doit pas recopier les e-mails de candidats.
    const serialise = JSON.stringify(entree.changes);
    expect(serialise).not.toContain("@exemple.fr");
  });
});
