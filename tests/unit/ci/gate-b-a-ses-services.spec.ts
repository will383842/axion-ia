/**
 * CLIQUET — Gate B doit disposer des services dont la console admin dépend.
 *
 * 🔴 2026-08-21 — SANS REDIS, LA CONNEXION ADMIN EST REFUSÉE, PAS LENTE.
 *
 * `REDIS_URL` vaut `redis://stub.invalid` au niveau du job (ADR 0026 : le build
 * ne peut joindre aucun service). `src/lib/redis.ts` rend alors un Proxy qui
 * répond `null` à tout ; `checkRateLimit` y voit une PANNE du compteur de
 * tentatives ; et `signInAction`, qui applique `surPanne: "refuser"`, refuse.
 *
 * C'est la bonne posture — un limiteur de tentatives qui ne compte plus doit
 * fermer, pas ouvrir. Mais en CI cela refusait **toutes** les connexions admin :
 * 84 échecs sur le run 32506915097, tous présentés comme des délais dépassés.
 *
 * 🔑 J'ai d'abord cru à de la lenteur et porté l'attente de 15 s à 60 s. C'est
 * le TEXTE DE L'ÉCRAN — « Connexion momentanément indisponible : le compteur de
 * tentatives ne répond pas » — qui a nommé la cause. Un délai dépassé ne dit pas
 * POURQUOI ; sans le texte visible, on allonge des timeouts devant un refus.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CI = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");

/** Le bloc du job `gate-b`, du nom du job jusqu'au job suivant. */
function blocGateB(): string {
  const debut = CI.indexOf("\n  gate-b:");
  expect(debut, "job `gate-b` introuvable dans ci.yml").toBeGreaterThan(-1);
  const suite = CI.indexOf("\n  gate-", debut + 10);
  return CI.slice(debut, suite === -1 ? undefined : suite);
}

describe("Gate B dispose de ses services", () => {
  const bloc = blocGateB();

  it("déclare un service Postgres", () => {
    expect(bloc, "sans base, le seed ne tourne pas et toute la couverture admin se skippe").toMatch(
      /image:\s*pgvector\/pgvector/,
    );
  });

  it("déclare un service Redis", () => {
    expect(
      bloc,
      "sans Redis, `checkRateLimit` voit une panne du compteur de tentatives et " +
        '`signInAction` REFUSE toute connexion admin (`surPanne: "refuser"`) — ' +
        "84 échecs sur le run 32506915097, tous lus à tort comme des délais dépassés",
    ).toMatch(/image:\s*redis:/);
  });

  it("l'étape Playwright reçoit un Redis RÉEL, pas le stub de build", () => {
    // Le job garde `stub.invalid` — le build en dépend (ADR 0026). C'est
    // l'étape Playwright qui doit le surcharger, comme elle le fait déjà pour
    // `DATABASE_URL`.
    const etape = bloc.slice(bloc.indexOf("- name: Playwright suite"));
    expect(etape, "étape Playwright introuvable").toBeTruthy();
    const env = etape.slice(0, etape.indexOf("run:"));
    expect(
      env,
      "l'étape Playwright doit surcharger REDIS_URL avec le service, sinon elle " +
        "hérite du `stub.invalid` du job et la connexion admin est refusée",
    ).toMatch(/REDIS_URL:\s*"redis:\/\/localhost:6379"/);
    expect(env, "le stub de build ne doit pas atteindre l'étape Playwright").not.toMatch(
      /REDIS_URL:.*stub\.invalid/,
    );
  });

  it("le JOB garde bien le stub — le build en dépend", () => {
    // Contre-témoin : si quelqu'un remplaçait le stub au niveau du job « pour
    // simplifier », le build tenterait d'ouvrir une connexion Redis au SSG.
    expect(bloc).toMatch(/REDIS_URL:\s*"redis:\/\/stub\.invalid:6379"/);
  });
});
