// @vitest-environment node
/**
 * ⛔ DEUX VOIX CLIENT EXIGENT DEUX ACCORDS (G16 ; plan §3.12, règle d'effet du
 * champ `consentement` : « sinon un signal “accord d'une personne non
 * retrouvé” est posé sur le compte rendu et Will confirme à la main »).
 *
 * La diarisation de la piste client distingue les voix (`A`, `B`) : chacune
 * doit avoir SON accord retrouvé. Sinon — ou si AUCUN accord n'est retrouvé —
 * le précontrôle POSE le signal ; la vue du compte rendu l'AFFICHE avec une
 * case de confirmation (`l-accord-non-retrouve-est-affiche-a-will.spec.tsx`) ;
 * et TOUTE validation (le compte rendu, « Valider
 * tous ») est REFUSÉE tant que Will n'a pas confirmé à la main. Avant ce
 * correctif, le compteur n'était écrit qu'au journal (tronqué, affiché nulle
 * part) : les propos d'un collègue sans accord pouvaient être validés sans
 * que Will le voie.
 *
 * Mutations qui rougissent : poser `accord_retrouve` au lieu du signal dans
 * `precontroler` ; retirer `exigerAccordConfirme` de
 * `exigerValidationPossible` (compte rendu ET « Valider tous »).
 * Contre-témoin : deux voix, deux accords → aucun signal, validation libre ;
 * après la confirmation de Will, la validation passe. Angle mort : un « oui »
 * à autre chose dans la fenêtre compte comme un accord — la preuve première
 * reste le clic « Accord obtenu » de Williams.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { validerApresLAppel } from "@/features/dossier-client/valider";
import {
  accordAConfirmer,
  EVT_ACCORD_A_CONFIRMER,
  EVT_ACCORD_RETROUVE,
} from "../accord-a-confirmer";
import { executerEtape } from "../etapes";
import { confirmerAccordALaMain, GesteRefuse, validerCompteRendu } from "../gestes-compte-rendu";
import { ajouterAuJournal } from "../journal-enregistrement";
import { planDePrecontrole, precontroler } from "../precontroles";
import { baseEspion } from "../../../../tests/outils/base-espion";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { CLE_DE_TEST } from "../../../../tests/outils/fixtures-enregistreur";
import { conversation, precontrole, seg } from "./outils-pipeline";

beforeAll(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
});

const RENCONTRE = "00000000-0000-4000-8000-000000000001";
const MAINTENANT = new Date("2026-10-06T11:00:00Z");
const base = conversation().map((s) => ({
  ...s,
  debutMs: s.debutMs + 200_000,
  finMs: s.finMs + 200_000,
}));
const OUI_A = seg({
  piste: "client",
  debutMs: 12_000,
  locuteurBrut: "A",
  texte: "Oui, pas de problème pour moi.",
});
const QUESTION_B = seg({
  piste: "client",
  debutMs: 16_000,
  locuteurBrut: "B",
  texte: "Je voulais juste savoir combien de temps ça dure.",
});
const OUI_B = seg({
  piste: "client",
  debutMs: 16_000,
  locuteurBrut: "B",
  texte: "Pour moi aussi, d'accord.",
});

/** Exécute `precontroler` et rend les types posés au journal de l'enregistrement. */
async function journalDuPrecontrole(segments: ReturnType<typeof seg>[]): Promise<string[]> {
  const depot = new FauxDepot();
  const t = depot.ajouter({
    rencontreId: "00000000-0000-4000-8000-0000000000f1",
    etape: "precontroler",
  });
  const types: string[] = [];
  const deps = depsDeTest({
    depot,
    gestionnaires: { precontroler },
    donnees: {
      pourPrecontrole: async () => [precontrole({ segments })],
      ecrirePreuvesAccord: async () => undefined,
      noterAuJournal: async (_tx, _id, entree) => {
        types.push(String(entree.type));
      },
    },
  });
  expect(await executerEtape(deps, t.id)).toBe("reussie");
  return types;
}

const AVEC_SIGNAL = ajouterAuJournal("[]", { le: MAINTENANT, type: EVT_ACCORD_A_CONFIRMER });

describe("deux voix client exigent deux accords", () => {
  it("deux voix, une seule dit oui → une voix sans accord, le signal est POSÉ", async () => {
    const plan = planDePrecontrole(precontrole({ segments: [OUI_A, QUESTION_B, ...base] }));
    expect(plan).toMatchObject({ voixClient: 2, voixSansAccord: 1 });
    expect(await journalDuPrecontrole([OUI_A, QUESTION_B, ...base])).toContain(
      EVT_ACCORD_A_CONFIRMER,
    );
  });

  it("aucun accord retrouvé du tout → le signal est posé aussi", async () => {
    expect(await journalDuPrecontrole([QUESTION_B, ...base])).toContain(EVT_ACCORD_A_CONFIRMER);
  });

  it("tant que Will n'a pas confirmé : le compte rendu ET « Valider tous » sont refusés", async () => {
    const e = baseEspion({
      "compteRendu.findUnique": () => ({ id: "cr1", rencontreId: RENCONTRE, statut: "a_valider" }),
      "enregistrement.findMany": () => [{ id: "e1", evenements: AVEC_SIGNAL }],
      "rencontre.findUnique": () => ({
        id: RENCONTRE,
        clientId: "c1",
        projetId: null,
        rattachementStatut: "valide",
        debutPrevu: null,
        debutReel: null,
      }),
    });
    await expect(
      validerCompteRendu(e.base, { compteRenduId: "cr1", parAdminId: "a", maintenant: MAINTENANT }),
    ).rejects.toThrow(/accord d'une personne/i);
    expect(e.de("compteRendu", "update")).toHaveLength(0);
    await expect(
      validerApresLAppel(e.base, {
        rencontreId: RENCONTRE,
        parAdminId: "admin",
        projet: { mode: "aucun" },
        faitsCoches: ["f1"],
        note: null,
        suivi: { issue: "a_rappeler" as never, suite: null, suiteLe: null },
      }),
    ).rejects.toBeInstanceOf(GesteRefuse);
  });

  it("la confirmation de Will lève le signal ; la validation passe ensuite", async () => {
    const e = baseEspion({
      "enregistrement.findMany": () => [{ id: "e1", evenements: AVEC_SIGNAL }],
    });
    await confirmerAccordALaMain(e.base, { rencontreId: RENCONTRE, maintenant: MAINTENANT });
    const ecrit = e.de("enregistrement", "update")[0]!.args as { data: { evenements: string } };
    expect(accordAConfirmer(ecrit.data.evenements)).toBe(false);

    const apres = baseEspion({
      "compteRendu.findUnique": () => ({ id: "cr1", rencontreId: RENCONTRE, statut: "a_valider" }),
      "enregistrement.findMany": () => [{ id: "e1", evenements: ecrit.data.evenements }],
    });
    await validerCompteRendu(apres.base, {
      compteRenduId: "cr1",
      parAdminId: "a",
      maintenant: MAINTENANT,
    });
    expect(apres.de("compteRendu", "update")[0]!.args).toMatchObject({
      data: { statut: "valide" },
    });
  });

  it("contre-témoin : chacune dit oui → deux accords, aucun signal", async () => {
    const plan = planDePrecontrole(precontrole({ segments: [OUI_A, OUI_B, ...base] }));
    expect(plan).toMatchObject({ voixClient: 2, voixSansAccord: 0 });
    expect(plan.accords).toHaveLength(2);
    const types = await journalDuPrecontrole([OUI_A, OUI_B, ...base]);
    expect(types).toContain(EVT_ACCORD_RETROUVE);
    expect(types).not.toContain(EVT_ACCORD_A_CONFIRMER);
  });
});
