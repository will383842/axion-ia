/**
 * Garde architecturale — les TROIS lectures du référent handicap (indicateur 26 ⭐)
 * doivent exiger le même signal : un référent NOMMÉ **et JOIGNABLE**.
 *
 * ## Ce qui s'était passé, mesuré le 2026-08-23
 *
 * Trois endroits du système répondaient à la question « le référent handicap
 * est-il désigné ? », et ils ne répondaient pas pareil :
 *
 * | lecture | ce qu'elle lisait | verdict sur une base VIERGE |
 * |---|---|---|
 * | `evaluerConformite` (off.26) | `referent_handicap_email` | non couvert ✅ juste |
 * | alerte R01 `regleReferentHandicap` | `referent_handicap_nom` | **muette** 🔴 |
 * | manifeste `genererManifesteAudit` | `referent_handicap_nom` | **« désigné : Williams Jullin »** 🔴 |
 *
 * La cause est unique : `referent_handicap_nom` porte au registre le défaut
 * `str("Williams Jullin")`, et `getQualiopiConfig` rend ce défaut quand la ligne
 * n'existe pas en base. Les deux lectures qui s'appuyaient sur le NOM lisaient
 * donc une valeur que personne n'avait saisie — l'une en se taisant, l'autre en
 * l'écrivant noir sur blanc dans la pièce remise au certificateur.
 *
 * Le moteur, lui, avait raison, et son code le disait déjà : « le NOM seul
 * (défaut config) ne prouve pas la désignation ». Cette remarque vivait en
 * commentaire dans un fichier, pendant que deux autres fichiers faisaient
 * exactement ce qu'elle déconseillait. **Une prière en commentaire n'est pas
 * une garde** — c'est l'aveu qu'on sait que ça va diverger.
 *
 * ## Ce que cette garde vérifie
 *
 * Que plus aucune de ces trois lectures ne conclut à une désignation à partir du
 * seul nom. Concrètement : tout fichier qui lit `referent_handicap_nom` doit
 * aussi lire `referent_handicap_email`.
 *
 * Elle est STATIQUE et porte sur l'architecture, délibérément : un test par
 * comportement ne garderait que les trois lectures d'aujourd'hui, et le défaut
 * est précisément qu'on en ajoute une quatrième sans y penser.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { QUALIOPI_CONFIG_REGISTRY } from "@/server/qualiopi/config/registry";

const RACINE = process.cwd();

/**
 * Les lectures connues du référent handicap, une par rôle.
 *
 * Cette liste est explicite et non dérivée : un balayage de tout `src/` serait
 * à la fois plus lent et moins clair à l'échec. Le test « aucune lecture
 * oubliée » ci-dessous la confronte au dépôt réel — c'est LUI qui garantit
 * qu'elle reste complète.
 */
const LECTURES = [
  {
    role: "moteur de conformité (off.26)",
    chemin: "src/server/qualiopi/conformite/conformite-service.ts",
  },
  {
    role: "alerte R01 (referent_handicap_absent)",
    chemin: "src/server/qualiopi/alertes/evaluateur.ts",
  },
  {
    role: "manifeste remis au certificateur",
    chemin: "src/server/qualiopi/conformite/audit-dossier.ts",
  },
  // Les deux suivantes ont été trouvées PAR le test de complétude ci-dessous,
  // pas par relecture — et elles lisaient déjà l'e-mail. Elles sont donc saines,
  // et listées pour que la garde continue de les surveiller.
  {
    role: "identité de l'organisme (alimente convocation, livret d'accueil, organisation de l'action)",
    chemin: "src/server/qualiopi/documents/organisme.ts",
  },
  {
    role: "export PDF de la fiche d'adaptation handicap",
    chemin: "src/server/actions/qualiopi/exports-pdf.ts",
  },
] as const;

/**
 * Fichiers qui NOMMENT la clé sans en tirer de verdict, et qui sont donc
 * légitimement hors de la liste : le registre la déclare, le dictionnaire de
 * libellés lui donne son intitulé d'écran.
 */
const SANS_VERDICT = [
  "src/server/qualiopi/config/registry.ts",
  "src/server/qualiopi/config/labels.ts",
];

const CLE_NOM = "referent_handicap_nom";
const CLE_EMAIL = "referent_handicap_email";

function lire(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

describe("référent handicap (ind. 26 ⭐) — un seul prédicat pour trois lectures", () => {
  it("le registre confirme la cause : le nom a un défaut, l'e-mail n'en a pas", () => {
    const registre = QUALIOPI_CONFIG_REGISTRY as Record<string, { default: unknown } | undefined>;

    // DÉRIVÉ du registre, jamais recopié : si quelqu'un retire le défaut du nom,
    // ce test le dit, et la garde principale devient moins critique — mais elle
    // reste juste.
    expect(
      registre[CLE_NOM]?.default,
      `Ce test documente POURQUOI le nom ne peut pas servir de preuve. Si « ${CLE_NOM} » ` +
        "n'a plus de défaut, mettre à jour cette explication plutôt que de la supprimer.",
    ).not.toBe("");

    expect(
      registre[CLE_EMAIL]?.default,
      `« ${CLE_EMAIL} » a acquis une valeur par défaut. Il devient alors, lui aussi, ` +
        "une preuve fantôme : toute la correction du 2026-08-23 repose sur le fait " +
        "que cette clé est vide tant que personne ne l'a saisie.",
    ).toBe("");
  });

  it.each(LECTURES.map((l) => [l.role, l.chemin] as const))(
    "%s ne conclut pas sur le seul nom",
    (role, chemin) => {
      const source = lire(chemin);

      if (!source.includes(CLE_NOM)) {
        // Cette lecture n'utilise plus le nom du tout : c'est encore mieux que
        // ce qu'on exige. Rien à vérifier.
        return;
      }

      expect(
        source.includes(CLE_EMAIL),
        `🔴 ${role} (${chemin}) lit « ${CLE_NOM} » sans jamais lire « ${CLE_EMAIL} ».\n` +
          `   Or « ${CLE_NOM} » a une valeur par défaut au registre : sur une base\n` +
          "   vierge, cette lecture voit un nom que PERSONNE n'a saisi et conclut\n" +
          "   à une désignation qui n'a pas eu lieu.\n" +
          "   Le référent handicap doit être nommé ET joignable — c'est ce que\n" +
          "   l'auditeur vérifie, et c'est déjà ce que fait evaluerConformite.",
      ).toBe(true);
    },
  );

  it("aucune lecture oubliée : tout fichier serveur qui lit le nom est dans la liste", () => {
    // Sans ce test, la liste ci-dessus vieillirait en silence — et une garde qui
    // ne regarde plus les bons fichiers passe toujours.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");

    const sortie = execSync(
      `git grep -l --fixed-strings "${CLE_NOM}" -- "src/server/**/*.ts" ":!*.spec.ts"`,
      { cwd: RACINE, encoding: "utf8" },
    );

    const trouves = sortie
      .split("\n")
      .map((l) => l.trim().replace(/\\/g, "/"))
      .filter((l) => l.length > 0)
      .filter((l) => !SANS_VERDICT.includes(l));

    const connus = new Set(LECTURES.map((l) => l.chemin));
    const inconnus = trouves.filter((f) => !connus.has(f));

    expect(
      inconnus,
      "Ces fichiers lisent « " +
        CLE_NOM +
        " » sans figurer dans LECTURES :\n  " +
        inconnus.join("\n  ") +
        "\nLes ajouter à la liste — et vérifier d'abord qu'ils ne concluent pas " +
        "sur le seul nom, qui a une valeur par défaut.",
    ).toEqual([]);
  });
});
