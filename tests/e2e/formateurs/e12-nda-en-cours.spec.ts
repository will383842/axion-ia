// @formateurs — E12 · Numéro de déclaration d'activité « en cours » : l'espace
// s'ouvre, mais AUCUNE mission ; F21 à 1 puis 2 mois ; arrêt dès que le numéro
// est connu.
//
// Le dossier accepte « en cours » et exige alors le récépissé ; la règle de mission
// refuse « en cours » sur une fiche par ailleurs complète (V1-A-9, corrigé) ; W-4 ouvre
// l'espace (V1-A-6, corrigé) ; F21 part à 1 mois, puis s'arrête quand la personne
// transmet son numéro depuis « Mon dossier » (V1-A-10, corrigé).

import { expect, test } from "@playwright/test";

import {
  MANQUES_MISSION,
  peutRecevoirMission,
  type FaitsGardeMission,
} from "@/server/qualiopi/formateurs-independants/garde-mission";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import {
  NDA_BANC,
  actionDossier,
  champsDePiece,
  formateurRetenu,
  formationDuBanc,
  pdfFictif,
  preparerDossier,
  registreDe,
  signerAvecCode,
  demanderCode,
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
      await actionDossier(lien, "piece", champsDePiece(type), { fichier: pdfFictif(type) });
    }
    // Le contrat ne se prépare que pour un dossier complet : sans récépissé, ni contrat
    // ni code, et le refus le dit.
    const sansRecepisse = await actionDossier(lien, "code", {}, { registre });
    expect(sansRecepisse.valeur.ok).toBe(false);
    expect(sansRecepisse.valeur.message).toMatch(/récépissé/);
    expect(
      await prisma.documentGenere.count({
        where: { trainerId, type: "contrat_sous_traitance" },
      }),
    ).toBe(0);

    // Avec le récépissé : code, signé, envoyé.
    await preparerDossier(lien, "Zoé", { ndaEnCours: true, registre });
    const code = await demanderCode(lien, email, registre);
    await signerAvecCode(lien, email, registre, code);
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

  // V1-A-9 (corrigé) — un numéro « en cours » n'est pas un numéro : la règle de mission
  // le refuse, avec son propre motif, sur une fiche par ailleurs complète.
  test("V1-A-9 — avec un numéro « en cours », aucune mission", () => {
    const maintenant = new Date();
    const verdict = peutRecevoirMission(ficheComplete("en cours", maintenant), 4, maintenant);
    expect(verdict).toEqual({ ok: false, manques: [MANQUES_MISSION.ndaEnCours] });
  });

  // V1-A-6 (corrigé, cf. E11) : W-4 ouvre l'espace. V1-A-10 (corrigé) : la personne
  // transmet son numéro depuis « Mon dossier », et F21 s'arrête. L'oracle d'origine
  // n'avait aucune assertion sur l'arrêt : F21 part à 1 mois, le numéro est transmis,
  // et le passage de 2 mois n'envoie plus rien.
  test("V1-A-6 / V1-A-10 — espace ouvert, F21 à 1 mois, arrêt au numéro reçu", async () => {
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
      expect((await prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } })).actif).toBe(
        true,
      );
      const f21 = async () =>
        (await gabaritsVers(email)).filter((g) => g === "formateur-nda-a-transmettre");
      const passage = (j: number) =>
        etape({
          etape: "passage-campagnes",
          args: { maintenant: jourOuvre(contresigne.signeAt, j).toISOString() },
        });

      await passage(30);
      await attendreLeWorker(email);
      expect(await f21()).toHaveLength(1);

      // « Mon dossier » : le numéro reçu.
      const recu = await etape<string>({
        etape: "transmettre-nda",
        args: { trainerId, nda: NDA_BANC },
      });
      expect(recu.valeur).toBe("nda_recu");
      const apres = await prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });
      expect(apres.sousTraitantNda).toBe(NDA_BANC);

      // Le passage de 2 mois n'envoie plus F21.
      await passage(60);
      await attendreLeWorker(email);
      expect(await f21()).toHaveLength(1);
    } finally {
      await formation.effacer();
    }
  });
});
