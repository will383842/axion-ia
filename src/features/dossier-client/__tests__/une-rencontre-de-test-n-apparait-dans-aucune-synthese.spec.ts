// @vitest-environment node
/**
 * ⛔ Une rencontre de TEST (pilote, client fictif) n'apparaît dans aucune
 * synthèse ni aucun compteur : ni F1, ni la veille, ni la couverture du mois,
 * ni « À classer ». Le pilote joue en production ; il ne doit rien fausser.
 *
 * Mutation qui fait rougir : retirer `estTestInterne: false` du filtre de
 * `couvertureDuMois` → la couverture compte la visio de test.
 * Contre-témoin : la même rencontre, sans le marqueur, est comptée partout.
 * Angle mort : la synthèse d'un AUTRE client ne lit que les faits de ce
 * client (`lireFaitsDuClient(clientId)`) : une rencontre de test, rangée sur
 * le client fictif, n'y entre pas par construction — non rejoué ici.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { couvertureDuMois, compterVeille, passerBalayage } from "@/server/visio/balayage";
import { dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";

const BORNE = new Date("2026-10-01T00:00:00Z");
const MAINTENANT = new Date("2026-10-08T14:00:00Z");

function scene(estTestInterne: boolean) {
  const f = fiche({ raisonSociale: "Atelier Test Fictif" });
  const rdv = (debut: Date) => ({
    id: id(5),
    source: "saisie_manuelle",
    type: "visio",
    titre: "Rendez-vous",
    clientId: f["id"],
    rattachementStatut: "valide",
    statut: "planifie",
    estTestInterne,
    repriseHistorique: false,
    debutPrevu: debut,
    finPrevue: new Date(debut.getTime() + 45 * 60_000),
  });
  return dossierEnMemoire({
    client: [f],
    battementCircuit: [
      {
        nom: "balayage",
        premierLe: BORNE,
        dernierLe: BORNE,
        drapeauVuParWorker: "true",
        version: "x",
      },
    ],
    rencontre: [rdv(new Date("2026-10-06T08:00:00Z")), rdv(new Date("2026-10-09T08:00:00Z"))],
  });
}

describe("⛔ une rencontre de test n'apparaît dans aucune synthèse", () => {
  it("rencontres de test : F1, veille et couverture à zéro", async () => {
    const base = scene(true);
    const r = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: vi.fn() as never,
    });
    expect(r.f1).toBe(0);
    expect(await compterVeille(base.client as never, MAINTENANT)).toBe(0);
    expect((await couvertureDuMois(base.client as never, MAINTENANT)).visios).toBe(0);
  });

  it("contre-témoin : les mêmes, sans le marqueur, sont comptées", async () => {
    const base = scene(false);
    const r = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: vi.fn() as never,
    });
    expect(r.f1).toBe(1);
    expect(await compterVeille(base.client as never, MAINTENANT)).toBe(1);
    expect((await couvertureDuMois(base.client as never, MAINTENANT)).visios).toBe(1);
  });

  it("« À classer » écarte les tests (lecture du code de la requête)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/features/dossier-client/queries-rencontres.ts"),
      "utf8",
    );
    const debut = src.indexOf("export async function lireRencontresAClasser(");
    const fin = src.indexOf("export async function lireNombreAClasser(");
    expect(src.slice(debut, fin)).toContain("estTestInterne: false");
    expect(src.slice(fin, fin + 400)).toContain("estTestInterne: false");
  });
});
