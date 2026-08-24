/**
 * CLIQUET — la date d'une signature vient de l'horloge SERVEUR, jamais de l'entrée.
 *
 * ## Ce qu'il garde, et pourquoi c'est le cœur de la valeur probante
 *
 * Un certificateur Qualiopi vérifie une **chronologie** : la convention précède
 * la formation, l'émargement est daté du jour, l'attestation suit la fin. Si une
 * date de signature pouvait venir de l'appelant, l'antidatage serait ouvert — et
 * toute la chaîne d'empreintes ne prouverait plus rien, puisqu'elle scellerait
 * fidèlement une date fausse.
 *
 * ## 🔑 La bonne nouvelle, et le vrai risque
 *
 * **Mesuré le 2026-08-24 (cahier D1-3) : la propriété est VRAIE aujourd'hui.**
 * Les trois services de signature prennent `input.maintenant ?? new Date()`, et
 * **aucun appelant de production ne passe `maintenant`** — le paramètre n'existe
 * que pour les tests, comme leur en-tête le dit.
 *
 * 🔴 **Mais rien ne la tient.** Aucun test n'interdit à une Server Action de
 * passer une date. Le jour où quelqu'un ajoute un « import d'historique » ou une
 * « saisie de signature papier » et branche une date d'entrée sur ces services,
 * rien ne rougit — et l'antidatage s'ouvre en silence, sur les pièces les plus
 * probantes du dossier.
 *
 * Une protection qui n'existe que par accident n'est pas une protection : c'est
 * une propriété qu'on n'a pas encore perdue. Ce fichier la transforme en garde.
 *
 * ## L'arbitrage que ce cliquet PROTÈGE, et ne renverse pas
 *
 * `document-signature-service.ts` le dit en toutes lettres : « le service
 * n'accepte pas de date de recueil distincte de `maintenant` : il ne pourrait
 * donc pas établir l'antériorité qui justifierait l'exception » — canal papier
 * compris. C'est une décision, prise et écrite. On la verrouille.
 *
 * ⚠️ Ce cliquet ne dit rien de `createdAt`, et c'est voulu : l'écart entre
 * `createdAt` (posé par PostgreSQL) et `signeAt` est **délibérément** conservé,
 * parce que c'est lui qui révèle une insertion tardive. Les confondre effacerait
 * la seule trace d'une signature antidatée.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ACTIONS = join(process.cwd(), "src", "server", "actions", "qualiopi");

/**
 * Les trois services qui SCELLENT une date dans une empreinte.
 *
 * Dérivé de ce qu'ils font, pas d'une liste de commodité : ce sont exactement
 * les fonctions dont la sortie entre dans un tuple haché portant `signeAt`.
 */
const SERVICES_QUI_SCELLENT = [
  "signerCreneau",
  "contresignerDemiJournee",
  "signerDocument",
] as const;

/** Les `.ts` de production du dossier des Server Actions Qualiopi. */
function actionsDeProduction(): string[] {
  return readdirSync(ACTIONS)
    .filter((f) => f.endsWith(".ts") && !f.includes(".spec.") && !f.includes(".test."))
    .map((f) => join(ACTIONS, f))
    .filter((f) => statSync(f).isFile());
}

/**
 * Le code seul, lignes de commentaire écartées.
 *
 * ⚠️ Ce fichier et ses cibles parlent tous d'« horloge » et de « maintenant » :
 * un extracteur naïf trouverait les explications au lieu du code. Ce dépôt s'est
 * fait piéger trois fois par ce motif le même jour.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join("\n");
}

/**
 * Les appels d'un service de scellement dans un fichier, avec leurs arguments.
 *
 * On borne la fenêtre à 800 caractères : un appel plus long que ça n'existe pas
 * dans ce dépôt, et une fenêtre non bornée finirait par avaler l'appel suivant.
 */
function appelsAvecArguments(code: string, service: string): string[] {
  const motif = new RegExp(`\\b${service}\\(\\s*\\{[\\s\\S]{0,800}?\\n\\s*\\}\\)`, "g");
  return code.match(motif) ?? [];
}

describe("l'horloge des signatures est au serveur", () => {
  it("le balayage voit réellement des appels — sinon il ne garde rien", () => {
    // 🔑 CONTRE-TÉMOIN, et c'est le plus important du fichier. Si le motif
    // cassait, ou si les Server Actions déménageaient, le test central
    // n'examinerait AUCUN appel et passerait au vert en ne mesurant rien.
    // C'est la panne que ce dépôt a payée cinq fois.
    const trouves = actionsDeProduction().flatMap((f) => {
      const code = codeSeul(f);
      return SERVICES_QUI_SCELLENT.flatMap((s) => appelsAvecArguments(code, s));
    });

    expect(
      trouves.length,
      "aucun appel aux services de signature n'a été trouvé dans les Server " +
        "Actions Qualiopi. Soit le motif ne reconnaît plus la forme des appels, " +
        "soit les actions ont déménagé — dans les deux cas, le test suivant ne " +
        "garde plus rien et l'antidatage n'est plus surveillé.",
    ).toBeGreaterThanOrEqual(5);
  });

  it("🔴 aucune Server Action ne fournit la date de signature", () => {
    // Le cœur. `signeAt` est SCELLÉ dans le tuple haché : une date venue de
    // l'entrée serait scellée fidèlement, et la chaîne d'empreintes certifierait
    // alors une chronologie fausse avec toute son autorité.
    const fautifs: string[] = [];
    for (const fichier of actionsDeProduction()) {
      const code = codeSeul(fichier);
      for (const service of SERVICES_QUI_SCELLENT) {
        for (const appel of appelsAvecArguments(code, service)) {
          if (/\bmaintenant\s*:/.test(appel)) {
            fautifs.push(`${fichier.slice(ACTIONS.length + 1)} → ${service}`);
          }
        }
      }
    }

    expect(
      fautifs,
      "une Server Action passe `maintenant:` à un service qui SCELLE cette date " +
        "dans une empreinte. L'antidatage devient possible : la chaîne de hachage " +
        "certifierait fidèlement une chronologie fausse. Le paramètre `maintenant` " +
        "n'existe que pour les tests — la production doit toujours laisser le " +
        "service lire l'horloge. Voir l'arbitrage écrit dans " +
        "`document-signature-service.ts` : le service refuse une date de recueil " +
        "distincte de `maintenant`, canal papier compris.",
    ).toEqual([]);
  });

  it("le contre-témoin : le motif reconnaîtrait bien une date fournie", () => {
    // 🔑 Sans ce cas, le test ci-dessus passerait au vert même si son motif ne
    // reconnaissait plus rien — il rendrait une liste vide de fautifs sur un
    // fichier plein de dates fournies.
    const faux = [
      "const res = await signerCreneau({",
      "  creneauId: input.creneauId,",
      "  maintenant: new Date(input.dateSaisie),",
      "});",
    ].join("\n");

    const appels = appelsAvecArguments(faux, "signerCreneau");
    expect(appels.length, "le motif ne reconnaît plus la forme d'un appel").toBe(1);
    expect(
      /\bmaintenant\s*:/.test(appels[0] ?? ""),
      "le motif ne reconnaît plus une date fournie en argument : le test central " +
        "ne garde donc plus rien.",
    ).toBe(true);
  });

  it("les trois services lisent bien l'horloge quand rien ne leur est fourni", () => {
    // L'autre moitié de la propriété. Interdire aux appelants de fournir la date
    // ne sert à rien si le service, lui, la prend ailleurs qu'à l'horloge.
    const SOURCES = [
      join(process.cwd(), "src", "server", "qualiopi", "emargement", "signature-service.ts"),
      join(process.cwd(), "src", "server", "qualiopi", "emargement", "contresignature-service.ts"),
      join(
        process.cwd(),
        "src",
        "server",
        "qualiopi",
        "documents",
        "signature",
        "document-signature-service.ts",
      ),
    ];

    for (const source of SOURCES) {
      expect(
        codeSeul(source),
        `${source.split(/[\\/]/).pop()} ne dérive plus sa date de l'horloge serveur ` +
          `en l'absence d'entrée. La forme attendue est \`input.maintenant ?? new Date()\` : ` +
          `elle rend le repli explicite et le laisse impossible à oublier.`,
      ).toMatch(/maintenant\s*\?\?\s*new Date\(\)/);
    }
  });
});
