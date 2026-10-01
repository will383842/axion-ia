// @vitest-environment node
/**
 * M-1 (2e vérification du chantier visio) — une rencontre de TEST
 * (`estTestInterne`) ne se range jamais chez un VRAI client.
 *
 * L'adresse de test de Will peut être celle d'une personne d'une vraie fiche :
 * la proposition « email_calendly » pointerait alors ce client, un clic sur
 * « Confirmer » rangerait les faits de test dans sa Synthèse, et la purge du
 * pilote retirerait ensuite la rencontre de ce client.
 *
 *   · `validerRattachement` refuse une fiche absente de `clients_test_interne` ;
 *   · `deplacerRencontre` aussi ;
 *   · `proposerRattachement` ne propose rien pour une rencontre de test ;
 *   · contre-témoins : la fiche fictive est acceptée ; une vraie rencontre
 *     reçoit toujours sa proposition.
 *
 * Mutation qui rougit : retirer le contrôle `estTestInterne` de
 * `validerRattachement` → le premier test rougit.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { proposerRattachement, validerRattachement } from "../rattacher";
import { deplacerRencontre } from "../deplacer";
import { fusionnerFiches, MESSAGE_FICHE_D_ESSAI } from "../fusionner";
import { CLE_TEST, dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";
import { baseEspion } from "../../../../tests/outils/base-espion";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

function scene(rangeeChez: "rien" | "fictive" = "rien") {
  const vraie = fiche({ raisonSociale: "Vraie Fiche Fictive" });
  const fictive = fiche({ raisonSociale: "Atelier Test Fictif" });
  const rencontreId = id(11);
  const base = dossierEnMemoire({
    client: [vraie, fictive],
    clientTestInterne: [{ clientId: fictive["id"] }],
    rencontre: [
      {
        id: rencontreId,
        source: "calendly",
        type: "visio",
        titre: "Discutons de votre projet IA",
        estTestInterne: true,
        rattachementStatut: rangeeChez === "rien" ? "propose" : "valide",
        clientId: rangeeChez === "fictive" ? fictive["id"] : null,
        clientProposeId: rangeeChez === "rien" ? vraie["id"] : null,
        motifProposition: rangeeChez === "rien" ? "email_calendly" : null,
      },
    ],
  });
  return { base, rencontreId, vraie: vraie["id"] as string, fictive: fictive["id"] as string };
}

describe("M-1 — une rencontre de test ne se range jamais chez un vrai client", () => {
  it("« Confirmer » vers une vraie fiche est refusé, rien n'est écrit", async () => {
    const { base, rencontreId, vraie } = scene();
    await expect(
      base.client.$transaction((tx: unknown) =>
        validerRattachement(tx as never, { rencontreId, clientId: vraie, parAdminId: ADMIN }),
      ),
    ).rejects.toThrow(/rendez-vous de test/i);
    expect(base.tables["rencontre"]?.[0]?.["clientId"]).toBeNull();
  });

  it("contre-témoin : la fiche fictive du pilote est acceptée", async () => {
    const { base, rencontreId, fictive } = scene();
    await base.client.$transaction((tx: unknown) =>
      validerRattachement(tx as never, { rencontreId, clientId: fictive, parAdminId: ADMIN }),
    );
    expect(base.tables["rencontre"]?.[0]?.["clientId"]).toBe(fictive);
  });

  it("« Déplacer » une rencontre de test vers une vraie fiche est refusé", async () => {
    const { base, rencontreId, vraie } = scene("fictive");
    await expect(
      deplacerRencontre(base.client as never, {
        rencontreId,
        versClientId: vraie,
        versProjetId: null,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/rendez-vous de test/i);
  });

  it("aucune proposition pour une rencontre de test ; une vraie rencontre en reçoit une", async () => {
    const indices = {
      emailTitulaire: null,
      emailsInvites: [],
      entrepriseDeclaree: null,
      clientDuReport: "00000000-0000-4000-8000-00000000c11e",
      demandeLiee: null,
    };
    const test = baseEspion({
      "rencontre.findUnique": () => ({
        rattachementStatut: "a_classer",
        clientProposeId: null,
        motifProposition: null,
        estTestInterne: true,
      }),
    });
    expect(await proposerRattachement(test.base as never, "r1", indices)).toBeNull();
    expect(test.de("rencontre", "update")).toHaveLength(0);

    const vraie = baseEspion({
      "rencontre.findUnique": () => ({
        rattachementStatut: "a_classer",
        clientProposeId: null,
        motifProposition: null,
        estTestInterne: false,
      }),
    });
    expect(await proposerRattachement(vraie.base as never, "r1", indices)).toMatchObject({
      motif: "report",
    });
  });

  it.each(["fictive dans vraie", "vraie dans fictive"])(
    "la fusion d'une fiche d'essai avec une vraie fiche est refusée (%s)",
    async (sens) => {
      const { base, vraie, fictive } = scene("fictive");
      const [absorbeeId, absorbanteId] =
        sens === "fictive dans vraie" ? [fictive, vraie] : [vraie, fictive];
      await expect(
        fusionnerFiches(base.client as never, {
          absorbeeId,
          absorbanteId,
          motif: "Même client, fiche en double",
          reporterSiren: false,
          parAdminId: ADMIN,
        }),
      ).rejects.toThrow(MESSAGE_FICHE_D_ESSAI);
      expect(base.tables["rencontre"]?.[0]?.["clientId"]).toBe(fictive);
    },
  );
});
