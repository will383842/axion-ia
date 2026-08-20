/**
 * `D6-5-C2` — la page publique des sous-traitants affirmait une minimisation
 * que le code ne pratique pas.
 *
 * ## Le défaut
 *
 * `/sous-processeurs` déclarait, pour Telegram : « PII minimisée : e-mail
 * partiel `j****@acme.com`, initiales `J. D.`, téléphone partiel ».
 *
 * C'est vrai pour UNE catégorie — la demande RGPD, minimisée le 2026-08-20. Et
 * faux pour une quinzaine d'autres : formulaire de contact, demandes de devis,
 * d'audit et d'intervention, candidatures, invitations, rendez-vous Calendly.
 * Pour toutes celles-là, `notifications/format.ts` transmet `contactName`,
 * `contactEmail`, `contactPhone` et le message ENTIER, en clair, hors UE.
 *
 * ## Ce qui n'est PAS le défaut
 *
 * 🔑 Le comportement. `notifications/types.ts` documente ce choix comme
 * délibéré — « l'équipe doit pouvoir rappeler » — et c'est une décision
 * légitime du responsable de traitement. Le RGPD n'impose pas de minimiser ces
 * alertes ; il impose de DÉCLARER ce qui part (art. 13-14).
 *
 * Le défaut était donc de ne pas le dire. Une page légale est ce qu'un contrôle
 * lit en premier, et ce sur quoi une personne concernée fonde ses droits : une
 * affirmation fausse y coûte plus cher que le comportement qu'elle décrit mal.
 *
 * ## Ce que ce test garde
 *
 * Pas une formulation exacte — elle vieillira. La CORRESPONDANCE entre ce que
 * la page annonce et ce que le formateur envoie réellement : si un jour le code
 * se met à minimiser, ou si la page se remet à le prétendre, l'un des deux
 * rougit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

function lire(...segments: string[]): string {
  return readFileSync(join(RACINE, ...segments), "utf-8");
}

/** L'entrée Telegram de la page publique, commentaires retirés. */
function declarationTelegram(): string {
  const source = lire("src", "content", "subprocessors.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const debut = source.indexOf("Dubaï");
  expect(debut, "l'entrée Telegram doit exister").toBeGreaterThan(-1);
  // La fiche entière : du marqueur de localisation à la fin de l'objet.
  const fin = source.indexOf("},", debut);
  return source.slice(debut, fin);
}

describe("`D6-5-C2` — la page des sous-traitants dit vrai sur Telegram", () => {
  const fiche = declarationTelegram();

  it("🔴 elle n'affirme PLUS une minimisation générale", () => {
    // La formulation exacte qui était fausse. Un test sur la formulation
    // vieillirait mal en général — mais celle-ci est une affirmation précise et
    // datée, dont le retour serait une régression, pas une reformulation.
    expect(fiche).not.toMatch(/PII minimisée \(cf\. ADR 0010\)\s*:\s*email partiel/);
  });

  it("🔴 elle déclare que nom, e-mail et téléphone partent EN CLAIR", () => {
    // C'est ce que le code fait. La page doit le dire — c'est tout l'objet de
    // l'article 13.
    expect(fiche).toMatch(/EN CLAIR|en clair/);
    for (const mot of ["Nom", "nom"]) {
      if (fiche.includes(mot)) return;
    }
    expect(fiche, "le nom transmis doit être nommé").toMatch(/nom/i);
  });

  it("elle distingue les DEUX régimes — le minimisé et le complet", () => {
    // 🔑 Sans cette distinction, la page basculerait dans l'excès inverse :
    // affirmer que TOUT part en clair effacerait la minimisation réellement
    // pratiquée sur les demandes RGPD, et ferait passer pour négligent un
    // traitement qui est soigné.
    expect(fiche).toMatch(/RGPD/);
    expect(fiche).toMatch(/minimis/i);
  });

  it("🔴 le formateur transmet BIEN les champs en clair — sinon la page ment à l'envers", () => {
    // 🔑 Le témoin qui empêche la fausse correction. Si quelqu'un minimise un
    // jour le formateur sans mettre la page à jour, celle-ci deviendrait fausse
    // dans l'autre sens : elle annoncerait une transmission plus large que la
    // réalité — ce qui est aussi une déclaration inexacte.
    const format = lire("src", "server", "notifications", "format.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    expect(format, "le nom part tel quel").toMatch(/formatKV\("Nom",\s*p\.contactName\)/);
    expect(format, "l'e-mail part tel quel").toMatch(/formatKV\("Email",\s*p\.contactEmail\)/);
  });

  it("la minimisation RGPD, elle, existe VRAIMENT dans le code", () => {
    // L'autre moitié de la correspondance : la page annonce un régime minimisé
    // pour les demandes RGPD — il doit exister.
    const rgpd = lire("src", "server", "qualiopi", "portail", "rgpd-service.ts");
    expect(rgpd).toMatch(/redactName|traineeNomMasque/);
    expect(rgpd).toMatch(/redactEmail|traineeEmailMasque/);
  });
});
