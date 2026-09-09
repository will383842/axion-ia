/**
 * Le battement du webhook doit distinguer DEUX pannes, pas les confondre.
 *
 * ## Ce que le 2026-09-07 a mesuré, en production
 *
 * Le tableau de bord portait depuis le 2026-08-31 une alerte critique :
 * « Aucun rebond d'e-mail ne peut être détecté — `ZEPTOMAIL_WEBHOOK_KEY` est
 * absente ». Elle était **fausse**. Vérifié sur le serveur :
 *
 *   · la clé est présente sur les DEUX conteneurs (application et worker) ;
 *   · la route est armée — un POST non signé rend
 *     `200 {ok:true, ignored:"invalid_signature"}`, et non le `not_configured`
 *     du cas sans clé ;
 *   · la sonde ne lève plus rien : le worker journalise `email-sante: RAS`.
 *
 * L'alerte est `resolutionAuto: false`, donc la ligne restait ouverte, à
 * afficher une cause disparue. Mais ce n'était pas le vrai défaut.
 *
 * ## Le vrai défaut : un zéro pour deux pannes opposées
 *
 * Le battement affichait `dernier appel webhook : JAMAIS`. Or
 * `noterAppelWebhook()` n'était appelé qu'**après** une signature valide, et la
 * route rend `200` sur signature invalide — choix délibéré et correct, parce
 * que ZeptoMail sonde l'URL en POST NON SIGNÉ avant d'autoriser la création du
 * webhook, et qu'un `401` fermait le cercle (pas de clé sans webhook, pas de
 * webhook sans clé).
 *
 * Conséquence : un appel refusé ne laissait **aucune trace lisible**. ZeptoMail
 * lisait un succès, ne réessayait pas, et `JAMAIS` s'affichait aussi bien pour
 *
 *   (a) « ZeptoMail ne nous appelle pas » — abonnement absent, URL fausse ;
 *   (b) « ZeptoMail nous appelle et nous le refusons » — clé désynchronisée.
 *
 * 🔑 Ces deux pannes appellent des gestes CONTRAIRES : créer l'abonnement d'un
 * côté, resynchroniser la clé de l'autre. Un instrument qui rend le même zéro
 * pour les deux ne mesure pas — il donne l'illusion d'avoir regardé. Et rien
 * ailleurs ne rattrapait : en production, Next ne journalise aucune requête
 * (vérifié — zéro ligne `GET`/`POST` dans le conteneur applicatif), donc les
 * journaux ne pouvaient pas non plus trancher.
 *
 * ## Ce que ce fichier verrouille
 *
 * L'ordre des appels dans la route. `noterAppelRecu()` doit rester AVANT la
 * vérification de signature ; le jour où quelqu'un le déplace après, les deux
 * pannes redeviennent un seul zéro — sans qu'aucun test de comportement ne
 * bronche, puisque le cas nominal (signature valide) continue de fonctionner.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const ROUTE = join(process.cwd(), "src/app/api/zeptomail/webhook/route.ts");
const SONDE = join(process.cwd(), "src/server/email/health.ts");

function source(chemin: string): string {
  return readFileSync(chemin, "utf8");
}

describe("le battement du webhook distingue les deux pannes", () => {
  it("🔑 CONTRE-TÉMOIN : les deux fichiers sont réellement lus", () => {
    // Sans ceci, un chemin faux rendrait une chaîne vide, et un `indexOf` à -1
    // ferait passer l'assertion d'ordre ci-dessous pour une mesure.
    expect(source(ROUTE).length, "la route est vide ou introuvable").toBeGreaterThan(2000);
    expect(source(SONDE).length, "la sonde est vide ou introuvable").toBeGreaterThan(2000);
  });

  it("la route enregistre l'appel AVANT de vérifier la signature", () => {
    const src = source(ROUTE);
    const posRecu = src.indexOf("noterAppelRecu()");
    const posSignature = src.indexOf("verifierSignatureZeptomail(");

    expect(posRecu, "`noterAppelRecu()` n'est plus appelé par la route").toBeGreaterThan(-1);
    expect(
      posSignature,
      "`verifierSignatureZeptomail(` n'est plus appelée — l'ordre n'a plus de sens à vérifier",
    ).toBeGreaterThan(-1);

    expect(
      posRecu < posSignature,
      "🔴 `noterAppelRecu()` est appelé APRÈS la vérification de signature.\n" +
        "\n" +
        "   Un appel refusé ne laisse alors aucune trace, et le battement rend\n" +
        "   `JAMAIS` aussi bien pour « ZeptoMail ne nous appelle pas » que pour\n" +
        "   « ZeptoMail nous appelle et on le refuse ». Ces deux pannes demandent\n" +
        "   des gestes contraires : créer l'abonnement, ou resynchroniser la clé.\n" +
        "\n" +
        "   La route rend `200` sur signature invalide — délibérément, pour que\n" +
        "   ZeptoMail puisse créer le webhook — donc personne d'autre ne verra\n" +
        "   passer l'appel refusé. Ce battement est la seule trace.",
    ).toBe(true);
  });

  it("l'appel reçu est noté même quand la signature échouera", () => {
    const src = source(ROUTE);
    // On exige que rien ne puisse court-circuiter le battement entre la
    // présence de la clé et son enregistrement : ni le contrôle de taille,
    // ni la limite de débit, qui rendent tous deux une réponse anticipée.
    const posRecu = src.indexOf("noterAppelRecu()");
    for (const sortieAnticipee of ["payload_too_large", "rate_limited", "unreadable_body"]) {
      expect(
        src.indexOf(sortieAnticipee),
        `🔴 « ${sortieAnticipee} » peut rendre une réponse AVANT que l'appel ne soit noté.\n` +
          "   Un appel rejeté pour sa taille ou son débit a bel et bien ATTEINT la\n" +
          "   route : c'est précisément ce que ce battement doit savoir dire.",
      ).toBeGreaterThan(posRecu);
    }
  });

  it("la sonde expose les DEUX battements", () => {
    const src = source(SONDE);
    for (const champ of ["dernierAppelWebhook", "dernierAppelRecu"]) {
      expect(src, `\`${champ}\` a disparu de la sonde de santé e-mail`).toContain(champ);
    }
  });
});
