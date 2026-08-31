// @vitest-environment node

/**
 * Verrou — le script d'abonnement webhook FOURNIT la clé de signature ; il ne
 * l'attend pas de Calendly.
 *
 * ## Le défaut que ce témoin ferme
 *
 * `calendly-webhook-subscribe.ts` lisait `resource.signing_key` dans la réponse
 * de création et l'affichait comme la valeur à poser dans Coolify. Ce champ
 * n'existe pas : Calendly ne génère aucune clé, c'est l'appelant qui la pose
 * dans le corps du POST.
 *
 * Le résultat, mesuré en production le 2026-08-31, est la pire forme de panne :
 * l'abonnement se créait bel et bien (201), le script se terminait en succès, et
 * affichait `CALENDLY_WEBHOOK_SIGNING_KEY=(absente)`. On repartait donc avec un
 * abonnement vivant qui livrait des évènements que la route ne pouvait pas
 * vérifier — donc qu'elle refusait, en silence.
 *
 * ## Pourquoi une garde sur la SOURCE
 *
 * Exercer le vrai script demanderait de simuler l'API Calendly entière, pour
 * finir par vérifier une propriété que l'on peut lire directement : la clé est
 * dans le corps envoyé, et nulle part on ne la relit de la réponse. C'est une
 * propriété de forme, et une garde de forme la couvre honnêtement — à condition
 * de dire ce qu'elle NE couvre pas, ce que fait ce commentaire.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CHEMIN = "scripts/calendly-webhook-subscribe.ts";

/**
 * Retire commentaires de bloc et de ligne.
 *
 * 🔑 Sans ce filtre, la garde rougirait sur sa propre documentation : le script
 * EXPLIQUE le défaut corrigé, donc il écrit `signing_key` dans sa réponse au
 * milieu d'un commentaire. Une garde doit mesurer ce qui s'EXÉCUTE, jamais ce
 * qui est écrit à côté. Le piège s'est présenté deux fois dans ce dépôt.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const source = readFileSync(join(process.cwd(), CHEMIN), "utf8");
const code = sansCommentaires(source);

describe("la clé de signature du webhook Calendly", () => {
  it("🔴 est ENVOYÉE dans le corps de la création", () => {
    expect(
      /signing_key:\s*signingKey/.test(code),
      "le POST de création doit porter `signing_key` — sans quoi l'abonnement est muet",
    ).toBe(true);
  });

  it("🔴 n'est JAMAIS relue de la réponse de Calendly", () => {
    // Le motif exact du défaut : une lecture de `signing_key` sur l'objet rendu.
    expect(
      /\[\s*"signing_key"\s*\]/.test(code),
      "le script relit `signing_key` dans la réponse : ce champ n'existe pas, " +
        "et sa valeur affichée sera « (absente) »",
    ).toBe(false);
  });

  it("est fabriquée avec assez d'entropie quand l'environnement n'en fournit pas", () => {
    expect(/randomBytes\(\s*(\d+)\s*\)/.test(code)).toBe(true);
    const octets = Number(/randomBytes\(\s*(\d+)\s*\)/.exec(code)?.[1]);
    expect(
      octets,
      "moins de 16 octets pour une clé HMAC-SHA256 est trop court",
    ).toBeGreaterThanOrEqual(16);
  });

  it("réutilise la clé déjà posée dans l'environnement", () => {
    // Sans cela, recréer un abonnement obligerait à retoucher Coolify à chaque
    // fois — et une clé oubliée rend l'abonnement muet sans le dire.
    expect(/process\.env\.CALENDLY_WEBHOOK_SIGNING_KEY/.test(code)).toBe(true);
  });

  it("🔑 CONTRE-TÉMOIN : le filtre de commentaires n'avale pas le code", () => {
    // Si `sansCommentaires` devenait trop gourmand, tous les tests ci-dessus
    // passeraient pour une mauvaise raison : ils ne mesureraient plus rien.
    expect(code, "le corps du script doit survivre au filtre").toContain("webhook_subscriptions");
    expect(code.length, "le filtre a mangé la quasi-totalité du fichier").toBeGreaterThan(
      source.length / 3,
    );
    // Et il retire bien quelque chose : le fichier EST commenté.
    expect(code.length).toBeLessThan(source.length);
  });
});
