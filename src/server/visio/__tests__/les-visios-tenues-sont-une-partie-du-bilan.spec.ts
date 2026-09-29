// @vitest-environment node
/**
 * ⛔ « Visios tenues » (couverture du circuit) est une PARTIE de « ont eu
 * lieu » (bilan du mois) : les deux compteurs de la page Rendez-vous lisent la
 * même règle, `rendez-vous-tenu.ts` (correction anti-doublon A3).
 *
 * Scène d'octobre 2026, vue le 20 :
 *   A · visio client, point « A eu lieu »            → couverture ET bilan ;
 *   B · visio client passée, AUCUN point             → ni l'un ni l'autre ;
 *   C · visio client, point « Absent »               → ni l'un ni l'autre ;
 *   D · échange apporteur, « A eu lieu », sans rencontre → bilan seulement ;
 *   E · 30/09 à 22 h (Paris), « A eu lieu »          → septembre : aucun ;
 *   F · 30/09 à 22 h 30 UTC = 1er/10 à 0 h 30 (Paris) → octobre : les deux ;
 *   G · visio saisie à la main, statut « tenu », sans Calendly → aucun.
 *
 * Mutation qui fait rougir : revenir à l'ancienne règle de la couverture
 * (rencontres visio passées du mois, statut ni annulé ni absent ni reporté)
 * → B et G comptés, « Visios tenues » dépasse « ont eu lieu ». Retaper
 * `issue === "eu_lieu"` ou une fenêtre de 40 jours dans l'un des deux
 * fichiers → le test « une seule règle » rougit.
 * Contre-témoin : A et F, tenues du mois, sont comptées des deux côtés.
 * Angle mort : `bilanDuMois` lit ici une base simulée qui applique la fenêtre
 * de dates sans le reste de Prisma ; la requête réelle est prouvée par Gate D.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  dossierEnMemoire,
  fiche,
  id,
  rendezVousCalendly,
} from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import type { Ligne } from "@/features/dossier-client/__tests__/_prisma-en-memoire";

const MAINTENANT = new Date("2026-10-20T14:00:00Z");

const donnees = vi.hoisted(() => ({
  evenements: [] as Array<Record<string, unknown>>,
  suivis: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rendezVousSuivi: {
      findMany: async (a: {
        where: { calendlyEvent: { startTime: { gte: Date; lte: Date } } };
      }) => {
        const { gte, lte } = a.where.calendlyEvent.startTime;
        return donnees.suivis.flatMap((s) => {
          const ev = donnees.evenements.find((e) => e["id"] === s["calendlyEventId"]);
          const debut = ev?.["startTime"] as Date | null | undefined;
          if (!debut || debut < gte || debut > lte) return [];
          return [{ issue: s["issue"], suite: s["suite"], calendlyEvent: { startTime: debut } }];
        });
      },
    },
  },
}));

const { bilanDuMois } = await import("@/features/admin-rendezvous/suivi-queries");
const { couvertureDuMois } = await import("../balayage");

function scene() {
  const client = fiche({ raisonSociale: "Atelier Bilan" });
  const ev = (nom: string, debut: string, partiel: Partial<Ligne> = {}) =>
    rendezVousCalendly({
      id: `cal_${nom}`,
      startTime: new Date(debut),
      endTime: new Date(new Date(debut).getTime() + 45 * 60_000),
      ...partiel,
    });
  const evs = {
    A: ev("A", "2026-10-06T08:00:00Z"),
    B: ev("B", "2026-10-07T08:00:00Z"),
    C: ev("C", "2026-10-08T08:00:00Z"),
    D: ev("D", "2026-10-09T08:00:00Z", { linkedJobApplicationId: "candidature-1" }),
    E: ev("E", "2026-09-30T20:00:00Z"),
    F: ev("F", "2026-09-30T22:30:00Z"),
  };
  const point = (e: Ligne, issue: string) => ({
    id: id(6),
    calendlyEventId: e["id"],
    issue,
    suite: issue === "eu_lieu" ? "aucune" : null,
    suiteLe: null,
  });
  const visioCalendly = (e: Ligne) => ({
    id: id(5),
    source: "calendly",
    type: "visio",
    titre: "Discutons",
    calendlyEventId: e["id"],
    clientId: client["id"],
    rattachementStatut: "valide",
    statut: null,
    estTestInterne: false,
    repriseHistorique: false,
    debutPrevu: e["startTime"],
    finPrevue: e["endTime"],
  });
  const suivis = [
    point(evs.A, "eu_lieu"),
    point(evs.C, "absent"),
    point(evs.D, "eu_lieu"),
    point(evs.E, "eu_lieu"),
    point(evs.F, "eu_lieu"),
  ];
  donnees.evenements = Object.values(evs);
  donnees.suivis = suivis;
  return dossierEnMemoire({
    client: [client],
    calendlyEvent: Object.values(evs),
    rendezVousSuivi: suivis,
    rencontre: [
      visioCalendly(evs.A),
      visioCalendly(evs.B),
      visioCalendly(evs.C),
      visioCalendly(evs.E),
      visioCalendly(evs.F),
      {
        id: id(5),
        source: "saisie_manuelle",
        type: "visio",
        titre: "Visio saisie",
        clientId: client["id"],
        rattachementStatut: "valide",
        statut: "tenu",
        estTestInterne: false,
        repriseHistorique: false,
        debutPrevu: new Date("2026-10-12T08:00:00Z"),
        finPrevue: new Date("2026-10-12T08:45:00Z"),
      },
    ],
  });
}

describe("⛔ les visios tenues sont une partie du bilan du mois", () => {
  it("la couverture ne compte que les visios que le bilan dit tenues ce mois-ci", async () => {
    const base = scene();
    const couverture = await couvertureDuMois(base.client as never, MAINTENANT);
    const bilan = await bilanDuMois(MAINTENANT);
    expect(bilan.euLieu).toBe(3); // A, D, F
    expect(couverture.visios).toBe(2); // A, F
    expect(couverture.visios).toBeLessThanOrEqual(bilan.euLieu);
    expect(couverture.sansRien).toBe(2);
  });

  it("une seule règle : les deux fichiers lisent `rendez-vous-tenu.ts`", () => {
    const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
    for (const f of [
      "src/features/admin-rendezvous/suivi-queries.ts",
      "src/server/visio/balayage.ts",
    ]) {
      const src = lire(f);
      expect(src, f).toMatch(/from "(\.|@\/features\/admin-rendezvous)\/rendez-vous-tenu"/);
      expect(src, f).not.toMatch(/issue\s*===\s*"eu_lieu"/);
      expect(src, f).not.toMatch(/40\s*\*\s*86_400_000/);
    }
  });
});
