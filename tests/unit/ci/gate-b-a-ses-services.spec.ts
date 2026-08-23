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

  it("la base E2E reçoit le dossier de démonstration Qualiopi", () => {
    // 🔴 `qualiopi:seed` pose les données de RÉFÉRENCE (grille, indicateurs,
    // barèmes) et aucun dossier. Les sept parcours de la phase 6 ont besoin d'un
    // client, d'une session réalisée, d'une attestation — c'est
    // `qualiopi:seed-demo` qui les crée.
    //
    // Dès qu'ils ont pu s'exécuter en CI, les parcours l'ont dit eux-mêmes :
    // « session AXI-SES-DEMO-001 introuvable », « aucun client en base ».
    // 🔑 C'est ce qu'on attend d'un parcours : qu'il NOMME ce qui lui manque,
    // au lieu de se sauter en silence.
    // 🔴 CE TEST S'EST TROUVÉ LUI-MÊME. Un premier jet cherchait
    // `/pnpm qualiopi:seed-demo/` n'importe où dans le bloc — or le COMMENTAIRE
    // qui explique pourquoi la commande est là contient ces mots. Le témoin
    // négatif l'a démasqué : commande retirée, test toujours vert.
    //
    // 🔑 Une garde statique doit chercher la FORME de l'instruction, pas son
    // vocabulaire. On exige une ligne de commande, pas une mention.
    const commandes = bloc
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => !l.startsWith("#"));
    expect(
      commandes,
      "sans `qualiopi:seed-demo`, les parcours de la phase 6 n'ont aucun dossier " +
        "à parcourir et rougissent sur une absence de données",
    ).toContain("pnpm qualiopi:seed-demo");
  });

  it("l'étape Playwright lève le drapeau du hub facturation", () => {
    // 🔴 2026-08-22 — QUATRE ÉCRANS N'ÉTAIENT PAS COUVERTS, ET ÇA SE LISAIT
    // « 4 entrée(s) de navigation en panne … Timeout 15000ms ».
    //
    // Le hub facturation est derrière `FACTURATION_HUB_ENABLED` (rollout
    // progressif). Drapeau baissé, les pages appellent `notFound()` — mais le
    // dossier porte un `loading.tsx`, donc le statut 200 est DÉJÀ PARTI quand
    // `notFound()` s'exécute. Le test voyait 200, puis attendait un `<h1>` qui
    // ne viendrait pas.
    //
    // 🔑 Un module derrière un drapeau que la CI ne lève pas n'est pas
    // « couvert » : il est compté en panne. Lever le drapeau ici, c'est la
    // différence entre traverser quatre écrans et les déclarer cassés.
    const etape = bloc.slice(bloc.indexOf("- name: Playwright suite"));
    const env = etape.slice(0, etape.indexOf("run:"));
    expect(
      env,
      "sans ce drapeau, les quatre écrans `/qualiopi/facturation` rendent une " +
        "page introuvable et `admin-nav-clic` les compte en panne",
    ).toMatch(/FACTURATION_HUB_ENABLED:\s*"true"/);
  });

  it("l'étape Playwright PEUT ROUGIR", () => {
    // 🔴 2026-08-23 — LE POINT D'ARRIVÉE DE TOUTE LA SESSION.
    //
    // Ce harnais a porté `continue-on-error: true` pendant toute sa
    // construction. C'était justifié tant qu'on ignorait combien de tests
    // passaient — mais un drapeau posé « le temps de mesurer » se réinstalle
    // silencieusement, et le dépôt en compte déjà plusieurs qui ont survécu
    // des semaines à leur raison d'être.
    //
    // Trajectoire mesurée :
    //     avant         0 passés / 237   (le harnais ne mesurait RIEN)
    //     32520282915 206 / 19
    //     32525749387 210 / 17
    //     32598142374 224 /  3
    //
    // 🔑 Une garde qui ne peut pas rougir n'est pas une garde. Celle-ci le peut
    // désormais — et `Gate B` étant un contexte EXIGÉ avec `strict: true`, un
    // rouge y bloque TOUTES les PR. C'est le prix, et c'est le but.
    const etape = bloc.slice(bloc.indexOf("- name: Playwright suite"));
    const suivante = etape.indexOf("- name: ", 10);
    const bloque = suivante === -1 ? etape : etape.slice(0, suivante);
    expect(
      bloque,
      "`continue-on-error` sur la suite E2E la rend incapable de rougir : le " +
        "job passe au vert quels que soient les échecs, et un dépassement de " +
        "délai devient indiscernable d'un relevé complet",
    ).not.toMatch(/continue-on-error:\s*true/);
  });

  it("les étapes AVAL survivent à un rouge de la suite", () => {
    // Contre-témoin du test précédent : retirer le drapeau sans protéger l'aval
    // ferait disparaître le rapport d'artefacts exactement le jour où il sert.
    const lighthouse = bloc.slice(bloc.indexOf("- name: Lighthouse CI"));
    const enTete = lighthouse.slice(0, lighthouse.indexOf("run:"));
    expect(
      enTete,
      "sans `if: !cancelled()`, un échec Playwright saute Lighthouse ET le " +
        "report qui permettrait de le comprendre",
    ).toMatch(/if:\s*\$\{\{\s*!cancelled\(\)\s*\}\}/);

    const upload = bloc.slice(bloc.indexOf("- name: Upload artifacts"));
    expect(upload.slice(0, 400), "l'upload des artefacts doit rester en `always()`").toMatch(
      /if:\s*always\(\)/,
    );
  });

  it("le JOB garde bien le stub — le build en dépend", () => {
    // Contre-témoin : si quelqu'un remplaçait le stub au niveau du job « pour
    // simplifier », le build tenterait d'ouvrir une connexion Redis au SSG.
    expect(bloc).toMatch(/REDIS_URL:\s*"redis:\/\/stub\.invalid:6379"/);
  });
});
