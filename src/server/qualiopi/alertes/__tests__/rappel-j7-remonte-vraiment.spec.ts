/**
 * CLIQUET — une session partie sans rappel J-7 REMONTE, elle ne se contente pas
 * d'être comptée dans un journal.
 *
 * ## Le défaut (2026-08-24, cahier D5)
 *
 * 🔴 `TrainingSession.rappelJ7EnvoyeAt` était écrite par un seul service et lue
 * par un seul lecteur : le cron, qui **comptait** les sessions parties sans
 * rappel et sortait le résultat en **`console.error`**. Pas de ligne d'alerte,
 * pas d'écran, rien dans le parcours de session.
 *
 * Le worker le disait lui-même : « *le journal est donc le SEUL endroit où
 * l'échec peut se voir* ». Ce n'était pas une décision — c'était un reste, et il
 * le nommait comme tel (`D5-1-C2`, « à traiter à part »).
 *
 * Un journal de conteneur n'est lu par personne le lendemain matin. Or le rappel
 * J-7 porte les informations logistiques finales — lieu, horaires, accès — et le
 * certificateur vérifie que le stagiaire a bien été informé.
 *
 * ## Ce que ce fichier garde
 *
 * Que la mesure **atteigne quelqu'un**. Pas qu'elle existe : elle existait.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import {
  sessionsSansRappelJ7,
  FENETRE_CONSTAT_JOURS,
} from "@/server/qualiopi/notifications/rappel-j7-manquant";

const MAINTENANT = new Date("2026-08-24T09:00:00Z");

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe("le rappel J-7 manquant remonte vraiment", () => {
  it("ne retient que les sessions DÉJÀ commencées", async () => {
    // Borne haute dure : après le début, rappeler n'informe plus personne. Le
    // geste n'est plus posable, c'est un écart à constater — pas une tâche.
    await sessionsSansRappelJ7(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, never> }).where;
    const dateDebut = where["dateDebut"] as unknown as { lte: Date; gte: Date };

    expect(
      dateDebut.lte,
      "la règle remonterait des sessions À VENIR, pour lesquelles le rappel est " +
        "encore parfaitement envoyable : elle crierait sur des dossiers sains.",
    ).toEqual(MAINTENANT);
  });

  it("ne remonte pas tout l'historique", async () => {
    // 🔑 Sans borne basse, le PREMIER balayage sortirait toutes les sessions
    // closes depuis des mois d'un coup, et noierait le signal utile. Même garde
    // que sa règle sœur sur le dispositif d'émargement.
    await sessionsSansRappelJ7(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, never> }).where;
    const dateDebut = where["dateDebut"] as unknown as { lte: Date; gte: Date };

    const attendu = new Date(MAINTENANT.getTime() - FENETRE_CONSTAT_JOURS * 24 * 60 * 60 * 1000);
    expect(
      dateDebut.gte,
      "la fenêtre de constat a disparu : le premier balayage remonterait tout " +
        "l'historique et personne ne lirait plus ces alertes.",
    ).toEqual(attendu);
  });

  it("🔑 exige au moins un inscrit ACTIF — sinon toute session vide crierait", async () => {
    // Une session sans personne à rappeler n'est pas en faute. Et le prédicat
    // vient du SSOT `inscriptionsActives()` : un abandon n'est pas quelqu'un
    // qu'on a oublié d'informer.
    await sessionsSansRappelJ7(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;

    expect(
      where["enrollments"],
      "la règle ne vérifie plus qu'il y a quelqu'un à rappeler : une session sans " +
        "inscrit — ou dont tout le monde a abandonné — lèverait une alerte.",
    ).toBeDefined();
  });

  it("🔴 la règle d'alerte produit bien une candidate par session muette", async () => {
    // Le cœur : la mesure doit ATTEINDRE quelqu'un. Elle existait déjà et
    // n'allait qu'au journal.
    findMany.mockResolvedValue([
      {
        id: "sess-1",
        numero: "AXI-SESS-2026-004",
        titreSession: "IA pour bien commencer",
        dateDebut: new Date("2026-08-20T09:00:00Z"),
      },
    ]);

    const trouvees = await sessionsSansRappelJ7(MAINTENANT);
    expect(
      trouvees,
      "la mesure ne rend plus les sessions muettes : la règle d'alerte n'aurait " +
        "rien à signaler, et l'écart resterait invisible.",
    ).toHaveLength(1);
    expect(trouvees[0]?.numero).toBe("AXI-SESS-2026-004");
  });

  it("le contre-témoin : un dossier sain ne remonte rien", async () => {
    // 🔑 Sans lui, une implantation qui remonterait TOUTES les sessions
    // passerait les tests ci-dessus — et noierait le signal utile sous une
    // alerte quotidienne que plus personne ne lirait. C'est le défaut
    // symétrique, et il est aussi grave que le silence.
    findMany.mockResolvedValue([]);
    expect(
      await sessionsSansRappelJ7(MAINTENANT),
      "une base sans session muette produit quand même des candidates.",
    ).toEqual([]);
  });
});
