/**
 * CLIQUET — une adresse chiffrée doit rester ATTEIGNABLE par les droits RGPD.
 *
 * ## Le défaut, et pourquoi il se reproduit
 *
 * 🔴 2026-08-24 (`D5-5-04`) — QUATRIÈME occurrence de la même faute.
 *
 * `podcast_requests` n'était **ni effacée ni exemptée**. Une personne remplit
 * le formulaire public `/podcast` — nom du dirigeant, adresse, téléphone,
 * ville, activité — puis demande l'effacement. La route lui répondait « Vos
 * données identifiantes ont été effacées ou anonymisées » sans toucher une
 * seule de ces colonnes.
 *
 * Les trois précédentes, mot pour mot la même forme :
 *   · `D5-5-01` `email_logs` · `D5-5-02` `email_outbox` · `D5-5-03` les
 *     candidatures (CV, photo, téléphone).
 *
 * ## Le piège SPÉCIFIQUE que ce fichier garde
 *
 * Brancher la table ne suffit pas, et c'est là que le correctif se perd. `email`
 * est chiffré par `encryptPii` avec un **IV aléatoire** : deux chiffrements de
 * la même adresse donnent deux valeurs différentes, donc `where: { email }` ne
 * correspond **jamais**. Un branchement sans empreinte produirait donc le pire
 * résultat possible — un effacement qui touche **zéro ligne en répondant
 * « succès »**.
 *
 * Ce n'est pas une hypothèse : l'en-tête de `src/lib/security/email-hash.ts` le
 * raconte au passé, pour les `Submission`, observé en production le 2026-08-12.
 *
 * 🔑 D'où la garde ci-dessous, qui ne porte PAS sur l'existence de la colonne
 * (le schéma la déclare) mais sur son **ÉCRITURE À LA CRÉATION**. Une colonne
 * `emailHash` déclarée et jamais remplie laisse la ligne introuvable
 * exactement comme avant, tout en donnant l'apparence du correctif. C'est la
 * forme « corrigé à moitié » que ce dépôt a déjà payée avec `bounced` : la
 * donnée arrive, personne ne la lit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), "utf8");

const ACTIONS = lire("src", "features", "podcast-request", "actions.ts");
const SCHEMA = lire("prisma", "schema.prisma");
const ROUTE_EFFACEMENT = lire("src", "app", "api", "gdpr-erase", "route.ts");
const ROUTE_EXPORT = lire("src", "app", "api", "gdpr-export", "route.ts");

describe("une demande de podcast reste atteignable par les droits RGPD", () => {
  it("le schéma porte bien `emailHash` — sinon tout le reste garde une règle imaginaire", () => {
    // Contre-témoin. Sans lui, un renommage de colonne ferait passer les tests
    // suivants au vert en ne gardant plus rien.
    const modele = /model PodcastRequest \{([\s\S]*?)^\}/m.exec(SCHEMA)?.[1] ?? "";
    expect(
      modele,
      "`PodcastRequest.emailHash` a disparu du schéma : l'adresse est chiffrée à " +
        "IV aléatoire, la ligne redevient INTROUVABLE par son adresse, et les " +
        "deux droits RGPD retombent en panne silencieuse.",
    ).toMatch(/emailHash\s+String\?/);
  });

  it("l'empreinte est ÉCRITE À LA CRÉATION, pas seulement déclarée", () => {
    // 🔑 Le cœur du cliquet. Une colonne déclarée et jamais remplie a
    // exactement le même effet que pas de colonne du tout — en donnant
    // l'apparence du correctif.
    expect(
      ACTIONS,
      "le formulaire public ne calcule plus `emailHash` à la création. La colonne " +
        "restera vide, la demande sera INTROUVABLE par son adresse, et l'effacement " +
        "art. 17 touchera zéro ligne EN RÉPONDANT « succès » — la panne silencieuse " +
        "observée en production le 2026-08-12 sur les submissions.",
    ).toMatch(/emailHash:\s*hashEmailForLookup\(/);
  });

  it("l'empreinte est calculée sur l'adresse EN CLAIR, jamais sur le chiffré", () => {
    // Hacher `encryptPii(email)` produirait une empreinte différente à chaque
    // dépôt — donc un index qui ne correspond à rien, et une panne identique
    // sous une apparence de correctif.
    expect(
      ACTIONS,
      "`emailHash` semble calculé sur une valeur déjà chiffrée. L'IV étant " +
        "aléatoire, l'empreinte différerait à chaque dépôt et n'indexerait rien.",
    ).not.toMatch(/hashEmailForLookup\(\s*encryptPii/);
  });

  it("les DEUX droits atteignent la table — pas seulement l'effacement", () => {
    // `D5-5-03` a manqué aux deux. Corriger l'un sans l'autre laisserait un
    // export qui se présente comme complet en omettant une table détenue.
    expect(
      ROUTE_EFFACEMENT,
      "la route d'effacement (art. 17) ne touche plus les demandes de podcast",
    ).toContain("effacerDemandesPodcastPour");

    expect(
      ROUTE_EXPORT,
      "la route d'export (art. 15) n'inclut plus les demandes de podcast : un " +
        "export qui omet une table détenue n'est pas partiel, il est faux",
    ).toContain("trouverDemandesPodcast");
  });

  it("la personne est PRÉVENUE si la recherche a été tronquée", () => {
    // Le repli déchiffrant est borné. Une recherche tronquée présentée comme
    // complète est pire qu'une recherche refusée — la doctrine est déjà écrite
    // dans `candidature-rgpd.ts`, elle doit valoir ici aussi.
    expect(
      ROUTE_EXPORT,
      "l'avertissement de troncature a disparu de l'export : la personne croirait " +
        "sa liste complète alors que le balayage a mordu son plafond",
    ).toContain("podcastAvertissement");

    expect(
      ROUTE_EFFACEMENT,
      "l'avertissement de troncature a disparu de l'effacement : des lignes " +
        "anciennes peuvent subsister sans que la personne l'apprenne",
    ).toMatch(/podcastResult\.tronque/);
  });
});
