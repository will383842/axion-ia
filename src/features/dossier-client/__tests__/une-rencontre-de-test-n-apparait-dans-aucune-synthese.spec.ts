// @vitest-environment node
/**
 * ⛔ Une rencontre de TEST (pilote, client fictif) n'apparaît dans aucune
 * synthèse ni aucun compteur : ni la veille, ni la couverture du mois,
 * ni « À classer ». Le pilote joue en production ; il ne doit rien fausser.
 *
 * Mutation qui fait rougir : retirer `...HORS_RENCONTRES_DE_TEST` du filtre
 * de `couvertureDuMois` → la couverture compte la visio de test ; retaper
 * `estTestInterne: false` dans une requête → le test « une source » rougit.
 * Contre-témoin : la même rencontre, sans le marqueur, est comptée partout.
 * Angle mort : la synthèse d'un AUTRE client ne lit que les faits de ce
 * client (`lireFaitsDuClient(clientId)`) : une rencontre de test, rangée sur
 * le client fictif, n'y entre pas par construction — non rejoué ici.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { couvertureDuMois, compterVeille, passerBalayage } from "@/server/visio/balayage";
import { HORS_RENCONTRES_DE_TEST } from "../client-test";
import { dossierEnMemoire, fiche, id, rendezVousCalendly } from "./_dossier-en-memoire";

const BORNE = new Date("2026-10-01T00:00:00Z");
const MAINTENANT = new Date("2026-10-08T14:00:00Z");

function scene(estTestInterne: boolean) {
  const f = fiche({ raisonSociale: "Atelier Test Fictif" });
  // La couverture ne compte que les visios TENUES selon le bilan (point
  // « A eu lieu » sur le rendez-vous Calendly, `rendez-vous-tenu.ts`) : la
  // visio passée porte donc un rendez-vous et son point. Rendez-vous lié à une
  // candidature : le balayage ne cherche pas à lui assurer une rencontre.
  const passe = rendezVousCalendly({
    startTime: new Date("2026-10-06T08:00:00Z"),
    endTime: new Date("2026-10-06T08:45:00Z"),
    linkedJobApplicationId: "candidature-hors-dossier",
  });
  const rdv = (debut: Date, calendlyEventId: string | null) => ({
    id: id(5),
    calendlyEventId,
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
    calendlyEvent: [passe],
    rendezVousSuivi: [
      { id: id(6), calendlyEventId: passe["id"], issue: "eu_lieu", suite: "aucune", suiteLe: null },
    ],
    rencontre: [
      rdv(new Date("2026-10-06T08:00:00Z"), passe["id"] as string),
      rdv(new Date("2026-10-09T08:00:00Z"), null),
    ],
  });
}

describe("⛔ une rencontre de test n'apparaît dans aucune synthèse", () => {
  it("rencontres de test : veille et couverture à zéro", async () => {
    const base = scene(true);
    const r = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: vi.fn() as never,
    });
    expect(r.etapesEnEchec).toEqual([]);
    expect(await compterVeille(base.client as never, MAINTENANT)).toBe(0);
    expect((await couvertureDuMois(base.client as never, MAINTENANT)).visios).toBe(0);
  });

  it("contre-témoin : les mêmes, sans le marqueur, sont comptées", async () => {
    const base = scene(false);
    const r = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: vi.fn() as never,
    });
    expect(r.etapesEnEchec).toEqual([]);
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
    expect(src.slice(debut, fin)).toContain("...HORS_RENCONTRES_DE_TEST");
    expect(src.slice(fin, fin + 400)).toContain("...HORS_RENCONTRES_DE_TEST");
  });

  it("le filtre a UNE source : personne ne retape `estTestInterne: false`", () => {
    expect(HORS_RENCONTRES_DE_TEST).toEqual({ estTestInterne: false });
    // Toute lecture de rencontres du circuit et du dossier passe par le filtre
    // nommé ; un littéral retapé est une requête qu'on oubliera de corriger.
    // `git grep` rend 1 quand il ne trouve rien : on lit la sortie, pas le code.
    const sortie = spawnSync(
      "git",
      ["grep", "-n", "-E", "estTestInterne:[[:space:]]*false", "--", "src"],
      { encoding: "utf8", cwd: process.cwd() },
    );
    expect(sortie.error).toBeUndefined();
    const fautifs = sortie.stdout
      .split("\n")
      .filter((l) => l !== "")
      .filter((l) => !/__tests__|\.spec\.tsx?:/.test(l))
      .filter((l) => !l.startsWith("src/features/dossier-client/client-test.ts:"));
    expect(fautifs).toEqual([]);
  });

  it("chaque compteur du balayage pose le filtre (lecture du code)", () => {
    const src = readFileSync(join(process.cwd(), "src/server/visio/balayage.ts"), "utf8");
    for (const fn of [
      "export async function compterVeille(",
      "export async function couvertureDuMois(",
    ]) {
      const debut = src.indexOf(fn);
      expect(debut, fn).toBeGreaterThan(-1);
      expect(src.slice(debut, debut + 900), fn).toContain("...HORS_RENCONTRES_DE_TEST");
    }
  });
});
