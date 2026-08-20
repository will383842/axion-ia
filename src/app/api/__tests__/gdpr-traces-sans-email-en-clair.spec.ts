/**
 * `D5-5-05` — la trace d'un effacement ne porte pas l'adresse effacée.
 *
 * Les routes RGPD self-service écrivent un `ActivityLog` forensique
 * (`gdpr.erase.completed`, `gdpr.export.delivered`). Ce journal est désormais
 * conservé `DOCUMENT_RETENTION_YEARS` — cinq ans — parce qu'il est la preuve
 * qu'un droit a été honoré.
 *
 * 🔑 **Allonger la conservation n'était défendable qu'à une condition** : que la
 * trace cesse de porter l'adresse en clair. Écrire l'e-mail d'une personne dans
 * le journal qui atteste qu'on a effacé ses données, puis garder ce journal cinq
 * ans, revient à conserver précisément ce qu'on affirme avoir supprimé.
 *
 * `hashEmailForLookup` est déterministe : re-hacher l'adresse fournie retrouve
 * la trace le jour où quelqu'un conteste. Rien n'est perdu de l'usage
 * forensique.
 *
 * ## Pourquoi une lecture de source
 *
 * Ces deux routes n'ont aucune suite : les exercer demanderait de reconstituer
 * un jeton HMAC valide, le rate-limit, et six services. La garde de forme est
 * ce qui tient aujourd'hui — et elle tient sur la seule chose qui compte : le
 * contenu du payload `changes`.
 *
 * ⚠️ Les commentaires sont retirés avant analyse. Ce fichier-ci et les routes
 * parlent abondamment d'« email » en prose ; un test statique qui trouverait ses
 * propres explications serait un faux positif, et ce dépôt l'a déjà payé.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES = [
  { nom: "gdpr-erase", chemin: join(process.cwd(), "src", "app", "api", "gdpr-erase", "route.ts") },
  {
    nom: "gdpr-export",
    chemin: join(process.cwd(), "src", "app", "api", "gdpr-export", "route.ts"),
  },
] as const;

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Extrait le corps de l'objet `changes: { … }` du `activityLog.create`. */
function payloadChanges(source: string): string {
  const debut = source.indexOf("changes:");
  expect(debut, "la route doit écrire un payload `changes`").toBeGreaterThan(-1);
  const ouvrante = source.indexOf("{", debut);
  let profondeur = 0;
  for (let i = ouvrante; i < source.length; i += 1) {
    if (source[i] === "{") profondeur += 1;
    if (source[i] === "}") {
      profondeur -= 1;
      if (profondeur === 0) return source.slice(ouvrante + 1, i);
    }
  }
  throw new Error("accolade de `changes` non refermée");
}

describe("`D5-5-05` — les traces RGPD ne portent pas l'e-mail en clair", () => {
  for (const route of ROUTES) {
    const brut = readFileSync(route.chemin, "utf-8");
    const payload = payloadChanges(sansCommentaires(brut));

    it(`🔴 ${route.nom} : aucun champ \`email\` nu dans \`changes\``, () => {
      // `email,` en abrégé d'objet, ou `email:` explicite — les deux formes.
      expect(payload, `payload analysé :\n${payload}`).not.toMatch(/(^|[\s{,])email\s*[,:]/);
    });

    it(`${route.nom} : un \`emailHash\` le remplace — la trace reste retrouvable`, () => {
      // 🔑 Témoin de non-vacuité. Sans lui, une route qui n'écrirait AUCUN
      // identifiant passerait le test ci-dessus : on aurait remplacé une fuite
      // par une preuve inutilisable, et la garde applaudirait.
      expect(payload).toMatch(/emailHash\s*:/);
    });
  }

  it("le témoin : la garde SAIT reconnaître un e-mail nu", () => {
    // 🔑 La règle de lecture s'applique à elle-même. Sur un payload fabriqué
    // qui contient la faute, elle doit la voir — sinon les deux tests ci-dessus
    // ne prouvent rien de plus que « le fichier existe ».
    const fautif = "\n        email,\n        submissionsAnonymized: 3,\n";
    expect(fautif).toMatch(/(^|[\s{,])email\s*[,:]/);
  });
});
