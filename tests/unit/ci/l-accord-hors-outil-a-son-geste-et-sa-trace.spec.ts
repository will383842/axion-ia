/**
 * 🔴 L'ALERTE `formateur_mission_expiree` OFFRAIT UNE SEULE DE SES DEUX BRANCHES.
 *
 * ## Vécu en production le 2026-09-06, sur AXI-SESS-2026-001
 *
 * La proposition de mission a expiré sans réponse. La session a pourtant été
 * animée — la stagiaire a signé son émargement le jour même. L'alerte critique
 * dit alors, mot pour mot :
 *
 *     « vérifiez que la session a bien été animée, et consignez un incident si
 *       elle ne l'a pas été »
 *
 * **Deux branches. L'écran n'en offrait qu'une.** Le seul bouton était
 * « Déclarer une absence » — la branche fausse pour ce dossier. « Proposer à
 * nouveau » est conditionné à `sessionAVenir`, donc absent dès le démarrage.
 *
 * Et l'alerte est `resolutionAuto` : elle ne s'éteint que si la condition
 * disparaît, c'est-à-dire si une réponse de mission existe. Aucun geste ne
 * pouvait en produire une. **Alerte critique, permanente, inextinguible** — le
 * mécanisme exact que le catalogue redoute : « le bruit apprend à ignorer les
 * critiques, c'est-à-dire l'unique fonction du dispositif ».
 *
 * ## 🔑 CE QUI SE SERAIT PASSÉ AVEC LE CORRECTIF ÉVIDENT
 *
 * Le raccourci était d'écrire `acceptee`. Il est refusé, et pas par prudence :
 * `acceptee` signifie « le formateur a répondu par son lien », et la ligne porte
 * alors la trace horodatée de SON geste. L'écrire pour un accord recueilli au
 * téléphone **fabriquerait cette trace**.
 *
 * Le dépôt refuse déjà la symétrie inverse, avec le même argument — le
 * commentaire de `sans_reponse` dit « un silence n'est pas un refus », parce
 * qu'inscrire un refus que personne n'a formulé salirait la pièce de pilotage
 * qui sert à motiver une non-reconduction. Un accord que personne n'a cliqué la
 * salirait autant.
 *
 * D'où une valeur d'énumération distincte, `accord_hors_outil`, et trois
 * colonnes de provenance : QUAND, PAR QUI, POURQUOI. Sans auteur ni motif, ce
 * n'est pas une preuve, c'est une affirmation.
 *
 * ⚠️ Cette garde surveille une CHAÎNE : la valeur existe, le service la pose
 * avec sa provenance, l'action la garde, l'écran l'offre, et **les trois règles
 * d'alerte la reconnaissent**. Le dernier maillon est le moins évident et le
 * plus important : sans lui, le geste existe et l'alerte reste allumée — on
 * aurait déplacé le défaut sans le fermer.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, ...relatif.split("/")), "utf8");
}

const SCHEMA = lire("prisma/schema.prisma");
const SERVICE = lire("src/server/qualiopi/trainers/mission-formateur.ts");
const ACTION = lire("src/server/actions/qualiopi/mission-formateur.ts");
const ECRAN = lire("src/components/admin/qualiopi/MissionFormateurPanel.tsx");
const PAGE = lire("src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx");
const EVALUATEUR = lire("src/server/qualiopi/alertes/evaluateur.ts");

describe("🔴 l'accord donné hors outil a un geste, une trace, et éteint l'alerte", () => {
  it("1/5 — le statut est DISTINCT de `acceptee`, et la base le porte", () => {
    expect(
      SCHEMA,
      "la valeur `accord_hors_outil` a disparu de l'énumération : un accord " +
        "recueilli hors de l'outil devrait alors s'écrire `acceptee`, c'est-à-dire " +
        "fabriquer la trace d'un clic qui n'a pas eu lieu.",
    ).toContain("accord_hors_outil");

    // Les trois colonnes vont ENSEMBLE. Une attestation sans auteur ni motif
    // n'est pas une preuve, c'est une affirmation.
    for (const colonne of ["accordHorsOutilAt", "accordHorsOutilParId", "accordHorsOutilMotif"]) {
      expect(SCHEMA, `la colonne de provenance \`${colonne}\` a disparu`).toContain(colonne);
    }
  });

  it("2/5 — le SERVICE exige un motif et refuse d'écraser une décision existante", () => {
    expect(SERVICE, "`consignerAccordHorsOutil` a disparu").toContain(
      "export async function consignerAccordHorsOutil",
    );
    expect(
      SERVICE,
      "le minimum de motif n'est plus exigé : une ligne sans justification ne " +
        "dit pas d'où vient l'accord, et c'est tout ce que l'auditeur cherche.",
    ).toContain("MOTIF_ACCORD_HORS_OUTIL_MIN");

    // Consigner par-dessus un refus ou un retrait effacerait le geste de
    // quelqu'un — c'est la trace même qu'on prétend protéger.
    for (const statut of ['"refusee"', '"retiree"', '"acceptee"']) {
      expect(
        SERVICE,
        `le service ne refuse plus de consigner par-dessus une mission ${statut}`,
      ).toContain(statut);
    }
  });

  it("3/5 — l'ACTION est gardée et journalise la provenance", () => {
    const depart = ACTION.indexOf("export async function consignerAccordHorsOutilAction");
    expect(depart, "`consignerAccordHorsOutilAction` a disparu").toBeGreaterThan(-1);
    const corps = ACTION.slice(depart, depart + 2000);
    expect(corps, "l'action n'est plus gardée par `requireAdminWrite`").toContain(
      "requireAdminWrite()",
    );
    expect(
      corps,
      "l'action ne journalise plus : l'accord serait consigné sans que le " +
        "registre d'activité en garde trace.",
    ).toContain("logQualiopiActivity");
  });

  it("4/5 — l'ÉCRAN offre le geste, et le page le conditionne au bon cas", () => {
    expect(ECRAN, "le bouton a disparu de l'écran").toContain("consignerAccordHorsOutilAction");
    expect(ECRAN, "la prop de conditionnement a disparu").toContain("accordConsignable");
    expect(
      PAGE,
      "la page ne passe plus `accordConsignable` : le bouton n'apparaîtrait jamais, " +
        "et l'absence d'un bouton ressemble exactement à un dossier sain.",
    ).toContain("accordConsignable");
  });

  it("🔴 5/5 — les TROIS règles d'alerte reconnaissent le nouveau statut", () => {
    // LE maillon qui compte. Sans lui, le geste existe, la trace existe, et
    // l'alerte critique reste allumée pour toujours : on aurait déplacé le
    // défaut d'un cran au lieu de le fermer.
    // ⚠️ Le motif tolère le retour à la ligne : Prettier a reformaté ces trois
    // lectures en bloc multi-lignes après la correction, et une regex écrite sur
    // la forme d'une seule ligne rendait 0 — c'est-à-dire un ROUGE sur un code
    // juste. Un témoin qui dépend du formatage ne mesure pas le code.
    const ouvertes = EVALUATEUR.match(
      /missionsFormateur:\s*\{\s*where:\s*\{\s*statut:\s*\{\s*in:\s*\["acceptee",\s*"accord_hors_outil"\]/g,
    );
    expect(
      ouvertes?.length ?? 0,
      "les trois règles qui lisent une mission acceptée comme la preuve que " +
        "quelqu'un tient la place ne reconnaissent plus `accord_hors_outil`. " +
        "L'alerte `formateur_mission_expiree` resterait critique et inextinguible " +
        "malgré l'accord consigné — le défaut d'origine, déplacé.",
    ).toBe(3);

    // Témoin négatif : plus aucune de ces lectures ne doit rester au statut seul.
    expect(
      /missionsFormateur:\s*\{\s*where:\s*\{\s*statut:\s*"acceptee"/.test(EVALUATEUR),
      'une règle lit encore `statut: "acceptee"` seul : elle ignorera les accords ' +
        "consignés hors outil.",
    ).toBe(false);
  });
});
