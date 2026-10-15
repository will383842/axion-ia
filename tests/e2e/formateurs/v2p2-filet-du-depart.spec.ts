// @formateurs V2P2 — Le filet du départ, séquence par séquence (requête directe).
//
// Pour chaque campagne de relance du registre réel, le lecteur que le worker
// d'e-mails appelle juste avant l'envoi (`RELECTURES_AU_DEPART`) est interrogé sur un
// job de la forme exacte que le passage enfile, contre la base réelle du banc :
//   · témoin : tout allumé, rien n'a changé → l'envoi peut partir (`null`) ;
//   · `coupe:<clé>` : la clé de la séquence (ou sa mère) coupée PAR LA CONSOLE ;
//   · `reponse` : le formateur (ou le candidat) a répondu depuis l'envoi de départ.
// Un `null` après une coupure ou une réponse : la relance déjà en file — ou garée,
// puis approuvée tard — part quand même. V2P1 le prouve de bout en bout pour F18.
//
// Hors de ce scénario : les relances de pièces (F40, F41), dont le lecteur relit la
// pièce d'origine — sans pièce réelle à renouveler il retient toujours (écart).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { ouvrirScenario, type DecorScenario } from "../fixtures/formateurs/scenario";
import { executerScenarioV2p } from "../fixtures/formateurs/v2p-execution";

interface Cas {
  campagne: string;
  gabarit: string;
  evenement: string;
  motif: string | null;
}
interface Observations {
  adresses: string[];
  allumage: Record<string, boolean>;
  cas: Cas[];
}

/** Ce que la séquence doit faire : `retenue` (motif rendu) ou partir (témoin). */
interface Attendu {
  readonly campagne: string;
  readonly evenement: string;
  /** Identifiant du défaut quand le code de main ne tient pas l'attendu. */
  readonly defaut?: string;
}

const TEMOINS = [
  "dossier-relance",
  "invit-relance",
  "contrat-relance",
  "contrat-version-relance",
  "lettre-1re",
  "lettre-j3",
  "nda-a-transmettre",
  "bilan-fin-formation",
];

const RETENUES: readonly Attendu[] = [
  // F9 (dossier) et F2 (invitation) : la coupure est relue au départ.
  { campagne: "dossier-relance", evenement: "coupe:relances_auto" },
  { campagne: "dossier-relance", evenement: "coupe:dossier_en_ligne" },
  { campagne: "invit-relance", evenement: "coupe:invitation_auto" },
  { campagne: "invit-relance", evenement: "coupe:echange_ouvert" },
  { campagne: "invit-relance", evenement: "reponse" },
  // V2-P-2 — la réponse du formateur n'est relue au départ d'aucune relance sur fiche.
  { campagne: "dossier-relance", evenement: "reponse", defaut: "V2-P-2" },
  { campagne: "contrat-relance", evenement: "reponse", defaut: "V2-P-2" },
  { campagne: "contrat-version-relance", evenement: "reponse", defaut: "V2-P-2" },
  { campagne: "lettre-1re", evenement: "reponse", defaut: "V2-P-2" },
  { campagne: "lettre-j3", evenement: "reponse", defaut: "V2-P-2" },
  { campagne: "nda-a-transmettre", evenement: "reponse", defaut: "V2-P-2" },
  { campagne: "bilan-fin-formation", evenement: "reponse", defaut: "V2-P-2" },
  // V2-P-3 — la coupure de l'interrupteur de la séquence n'est pas relue au départ.
  { campagne: "contrat-relance", evenement: "coupe:relances_auto", defaut: "V2-P-3" },
  { campagne: "contrat-relance", evenement: "coupe:dossier_en_ligne", defaut: "V2-P-3" },
  { campagne: "contrat-version-relance", evenement: "coupe:relances_auto", defaut: "V2-P-3" },
  {
    campagne: "contrat-version-relance",
    evenement: "coupe:nouvelle_version_contrat",
    defaut: "V2-P-3",
  },
  { campagne: "lettre-1re", evenement: "coupe:lettre_auto", defaut: "V2-P-3" },
  { campagne: "lettre-1re", evenement: "coupe:contrat_auto", defaut: "V2-P-3" },
  { campagne: "lettre-j3", evenement: "coupe:lettre_auto", defaut: "V2-P-3" },
  { campagne: "lettre-j3", evenement: "coupe:contrat_auto", defaut: "V2-P-3" },
  { campagne: "nda-a-transmettre", evenement: "coupe:relances_auto", defaut: "V2-P-3" },
  { campagne: "nda-a-transmettre", evenement: "coupe:dossier_en_ligne", defaut: "V2-P-3" },
  {
    campagne: "bilan-fin-formation",
    evenement: "coupe:bilan_fin_formation",
    defaut: "V2-P-3",
  },
];

test.describe("@formateurs V2P2 — le filet du départ, séquence par séquence", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);
  let decor: DecorScenario;
  let o: Observations;
  const cas = (campagne: string, evenement: string) => {
    const c = o.cas.find((x) => x.campagne === campagne && x.evenement === evenement);
    if (c === undefined) throw new Error(`cas absent : ${campagne} / ${evenement}`);
    return c;
  };

  test.beforeAll(async () => {
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("v2p2");
    o = await executerScenarioV2p<Observations>("v2p2-filet-du-depart");
  });
  test.afterAll(async () => {
    for (const a of o?.adresses ?? []) await viderPuitsPour(a);
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("la console allume les clés éteintes du banc, et chaque témoin peut partir", () => {
    expect(o.allumage).toEqual({
      lettre_auto: true,
      bilan_fin_formation: true,
      nouvelle_version_contrat: true,
    });
    for (const c of TEMOINS) expect(cas(c, "temoin").motif, c).toBeNull();
  });

  for (const a of RETENUES) {
    const titre = `${a.defaut ? `${a.defaut} — ` : ""}${a.campagne} · ${a.evenement} : retenue au départ`;
    const corps = () => {
      expect(cas(a.campagne, a.evenement).motif).not.toBeNull();
    };
    if (a.defaut) test.fixme(titre, corps);
    else test(titre, corps);
  }
});
