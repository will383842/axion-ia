// @formateurs — E12 · Numéro de déclaration d'activité « en cours » : l'espace
// s'ouvre, mais AUCUNE mission ; F21 à 1 puis 2 mois ; arrêt dès que le numéro
// est connu.
//
// Ce qui se vérifie aujourd'hui : le dossier accepte « en cours » et exige alors le
// récépissé ; la règle de mission, exécutée sur une fiche par ailleurs complète.
// Ce qui ne se vérifie pas : l'ouverture de l'espace et F21, qui passent par W-4,
// bloqué par V1-A-6 (cf. E11).

import { expect, test } from "@playwright/test";

import {
  peutRecevoirMission,
  type FaitsGardeMission,
} from "@/server/qualiopi/formateurs-independants/garde-mission";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import {
  NDA_BANC,
  actionDossier,
  formateurRetenu,
  formationDuBanc,
  pdfFictif,
  preparerDossier,
  registreDe,
  signerAvecCode,
  codeCapte,
} from "../fixtures/formateurs/parcours";
import { SIRET_BANC } from "../fixtures/formateurs/registre-entreprises";
import {
  attendreLeWorker,
  gabaritsVers,
  jourOuvre,
  ouvrirScenario,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

/** Une fiche indépendante ACTIVE, complète, sauf ce que le test fait varier. */
function ficheComplete(nda: string, maintenant: Date): FaitsGardeMission {
  return {
    statut: "sous_traitant",
    actif: true,
    finCollaborationAt: null,
    activationValideeSource: "controle",
    contratCadreVersion: 4,
    siret: SIRET_BANC,
    contratCadreSiret: SIRET_BANC,
    sousTraitantContratSigneAt: new Date(maintenant.getTime() - 86_400_000),
    sousTraitantVerifieAt: new Date(maintenant.getTime() - 86_400_000),
    sousTraitantNda: nda,
    pieces: [],
    cumulHonorairesHtCents: 0,
    montantMissionHtCents: 100_000,
  };
}

test.describe("@formateurs E12 — numéro de déclaration « en cours »", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600_000);
  let decor: DecorScenario;
  let email = "";
  let trainerId = "";

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("e12", { organisme: true });
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("« en cours » est accepté, le récépissé est alors exigé, le dossier part signé", async () => {
    email = decor.adresse("nda");
    const { fiche, lien } = await formateurRetenu(email, "Zoé", decor.admin);
    trainerId = fiche.id;
    const registre = registreDe("Zoé", "vert", null);

    // Sans le récépissé, l'envoi est refusé et le dit.
    await actionDossier(lien, "vous", { telephone: "0600000000", codePostal: "69003" });
    const activite = await actionDossier(
      lien,
      "activite",
      {
        siret: SIRET_BANC,
        ndaEnCours: "1",
        regimeTva: "franchise_293b",
        iban: "FR7630006000011234567890189",
      },
      { registre },
    );
    expect(activite.valeur.ok, activite.valeur.message).toBe(true);
    for (const type of ["rib", "cv"]) {
      await actionDossier(lien, "piece", { type }, { fichier: pdfFictif(type) });
    }
    const code = await actionDossier(lien, "code", {}, { registre });
    expect(code.valeur.ok, code.valeur.message).toBe(true);
    await attendreLeWorker(email);
    const sansRecepisse = await actionDossier(
      lien,
      "signer",
      { certifie: "1", accepte: "1", code: "123456" },
      { registre },
    );
    expect(sansRecepisse.valeur.ok).toBe(false);
    expect(sansRecepisse.valeur.message).toMatch(/récépissé/);

    // Avec le récépissé : signé, envoyé.
    await preparerDossier(lien, "Zoé", { ndaEnCours: true, registre });
    // Le code reçu plus haut n'a pas servi (le refus précède sa vérification).
    await signerAvecCode(lien, email, registre, await codeCapte(email));
    const apres = await prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });
    expect(apres.sousTraitantNda).toBe("en cours");
    expect(apres.dossierStatut).toBe("a_verifier");
    expect(apres.actif).toBe(false);
  });

  test("la règle de mission accepte une fiche complète avec un numéro (témoin)", () => {
    const maintenant = new Date();
    expect(peutRecevoirMission(ficheComplete(NDA_BANC, maintenant), 4, maintenant)).toEqual({
      ok: true,
    });
  });

  // V1-A-9 — la règle de mission ne refuse PAS un numéro « en cours » : elle ne vérifie
  // que la présence d'un texte (`garde-mission.ts`, `sousTraitantNda.trim() === ""`).
  // Exécuté ici sur une fiche par ailleurs complète (cf. le témoin ci-dessus) : la
  // mission est acceptée. Cf. rapport.
  test.fixme("V1-A-9 — avec un numéro « en cours », aucune mission", () => {
    const maintenant = new Date();
    const verdict = peutRecevoirMission(ficheComplete("en cours", maintenant), 4, maintenant);
    expect(verdict.ok).toBe(false);
  });

  // V1-A-6 (bloquant, cf. E11) : l'espace ne s'ouvre pas par W-4, donc F21 ne peut pas
  // être constaté. V1-A-10 : la personne n'a aucun moyen de transmettre son numéro
  // depuis son espace (seule la console l'écrit). Cf. rapport.
  test.fixme("V1-A-6 / V1-A-10 — espace ouvert, F21 à 1 et 2 mois, arrêt au numéro reçu", async () => {
    const formation = await formationDuBanc(`e12-${Date.now()}`);
    try {
      const w4 = await etape<{ ok: boolean; error?: string }>({
        etape: "contresigner-w4",
        args: {
          saisie: {
            trainerId,
            codeAttestation: "",
            attestationAuthentique: false,
            piecesVerifiees: true,
            formationIds: [formation.id],
            orangeVerifie: true,
            motifOrange: "Numéro de déclaration en cours d'attribution",
          },
        },
        session: decor.admin,
        registre: registreDe("Zoé", "vert", null),
      });
      expect(w4.valeur.ok, w4.valeur.error).toBe(true);
      const contresigne = await prisma.documentSignature.findFirstOrThrow({
        where: { documentGenere: { trainerId }, partie: "axionia" },
      });
      for (const j of [30, 60]) {
        await etape({
          etape: "passage-campagnes",
          args: { maintenant: jourOuvre(contresigne.signeAt, j).toISOString() },
        });
      }
      await attendreLeWorker(email);
      expect(
        (await gabaritsVers(email)).filter((g) => g === "formateur-nda-a-transmettre"),
      ).toHaveLength(2);
    } finally {
      await formation.effacer();
    }
  });
});
