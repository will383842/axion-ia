// @formateurs — E12 · Numéro de déclaration d'activité « en cours ».
//
// Qualiopi ind. 21 (2026-10-17) : le numéro est désormais OBLIGATOIRE. Le dossier refuse
// « en cours » ; une fiche ancienne qui le porte encore ne s'active pas ; et la règle de
// mission refuse toujours « en cours » sur une fiche par ailleurs complète (V1-A-9). Le
// parcours d'avant (espace ouvert avec « en cours », F21 à 1 puis 2 mois) n'existe plus
// pour un nouveau dossier.

import { expect, test } from "@playwright/test";

import {
  MANQUES_Q21,
  manquesActivationQ21,
} from "@/server/qualiopi/formateurs-independants/evaluation-competences/garde-activation-q21";
import {
  MANQUES_MISSION,
  peutRecevoirMission,
  type FaitsGardeMission,
} from "@/server/qualiopi/formateurs-independants/garde-mission";

import { prisma } from "../fixtures/formateurs/base";
import {
  NDA_BANC,
  actionDossier,
  formateurRetenu,
  registreDe,
} from "../fixtures/formateurs/parcours";
import { SIRET_BANC } from "../fixtures/formateurs/registre-entreprises";
import { ouvrirScenario, type DecorScenario } from "../fixtures/formateurs/scenario";

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

  // Qualiopi ind. 21 (2026-10-17) — le numéro de déclaration est OBLIGATOIRE : le dossier
  // ne reçoit plus « je n'ai pas encore de numéro », même envoyé à la main.
  test("« en cours » est refusé par le dossier ; rien n'est écrit", async () => {
    email = decor.adresse("nda");
    const { fiche, lien } = await formateurRetenu(email, "Zoé", decor.admin);
    trainerId = fiche.id;
    const registre = registreDe("Zoé", "vert", null);

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
    expect(activite.valeur.ok).toBe(false);
    const apres = await prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });
    expect(apres.sousTraitantNda ?? "").not.toMatch(/en\s*cours/i);
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

  // Qualiopi ind. 21 — une fiche d'AVANT le 17/10 qui porte encore « en cours » ne
  // s'active plus : le numéro est exigé à l'activation, sous les deux règles.
  test("ind. 21 — une fiche ancienne « en cours » ne s'active pas", () => {
    for (const regle of ["provisoire", "complete"] as const) {
      expect(manquesActivationQ21({ nda: "en cours" }, regle)).toContain(MANQUES_Q21.ndaEnCours);
    }
  });
});
