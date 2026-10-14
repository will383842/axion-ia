// @formateurs E23 — l'attestation URSSAF AU SEUIL (5 000 € HT cumulés, mission en cours
// comprise ; décision du dirigeant, « comme les apporteurs ») :
//   · au-delà du seuil, attestation échue à la date de la mission → la facture EST émise,
//     le virement est SUSPENDU (F38), le délai de paiement est suspendu — et la mission
//     est maintenue ;
//   · dépôt → « Reçue, en vérification » → validation → déblocage → F57 ;
//   · SOUS le seuil → aucun blocage.
//
// DÉFAUT V1-C-8 (test.fixme) : F38 ne part qu'au CLIC « Prévenir » de la console
// (`prevenirVirementEnAttenteFormAction`, actions/qualiopi/virements-a-faire.ts ~l. 134,
// seul appelant de `envoyerVirementEnAttente`) ; aucun passage ne l'envoie quand la
// facture est due et l'attestation échue, alors que son texte dit « une fois par facture »
// et que la décision attend F38 à la suspension.
//
// ÉCARTS : le dépôt réel passe par l'antivirus, absent du banc (`deposerPieceFormateur`
// refuse « antivirus muet ») : le banc écrit la pièce `en_attente` qu'il produit ; la
// validation (`validerAttestationVigilance` / `validateTrainerDocumentAction`) exige une
// session : le banc écrit son effet, puis appelle le service qui la suit
// (`apresDecisionPiece`), celui qui envoie F57. L'autofacture est datée à l'horloge réelle
// (2026) : le retard se compte depuis le jour de vérification, plus tardif.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  BASCULE_2037,
  HORS_BANC,
  attendreEnvois,
  bascule,
  dernierEnvoiRendu,
  semerTextesValides,
} from "../fixtures/formateurs/argent-commun";
import { ecartJours } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer, jouerUne } from "../fixtures/formateurs/argent-execution";
import { factureDeMissionEmise } from "../fixtures/formateurs/argent-parcours";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

interface Garde {
  verdict: {
    autorise: boolean;
    motifs: string[];
    retard: {
      joursDeRetard: number;
      penalitesCents: number | null;
      indemniteRecouvrementCents: number;
    };
  };
}

const SEUIL_CENTS = 500_000;
/** Honoraires déjà PAYÉS au formateur avant cette mission (un relevé mensuel de 2037). */
const DEJA_PAYES_HT = 450_000;

async function honorairesAnterieurs(trainerId: string): Promise<void> {
  await prisma.trainerStatement.create({
    data: {
      trainerId,
      periodeYear: 2037,
      periodeMonth: 6,
      statut: "paye",
      origine: "releve_mensuel",
      tvaRegime: "franchise_293b",
      totalHtCents: DEJA_PAYES_HT,
      tvaCents: 0,
      totalTtcCents: DEJA_PAYES_HT,
      payeAt: new Date("2037-07-20T10:00:00Z"),
    } as never,
  });
}

/** Une attestation VALIDÉE, échue le 01/06/2038 — avant la mission de juillet. */
async function attestationEchue(trainerId: string): Promise<void> {
  await prisma.trainerDocument.create({
    data: {
      trainerId,
      type: "attestation_vigilance_urssaf",
      statutValidation: "valide",
      dateEmission: new Date("2037-12-01T00:00:00Z"),
      dateExpiration: new Date("2038-06-01T00:00:00Z"),
      valideAt: new Date("2037-12-03T10:00:00Z"),
      numeroPiece: "BANC-URSSAF-ANCIENNE",
    },
  });
}

const textes = ["formateur-virement-en-attente", "formateur-dossier-a-jour"];
const interrupteurs = {
  ...bascule(BASCULE_2037),
  "formateurs.bilan_fin_formation": { actif: false },
  "formateurs.dossier_en_ligne": { actif: true },
};

test.describe("@formateurs E23 — seuil URSSAF, virement suspendu, F38, F57", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("au seuil : facture émise, virement suspendu (F38) ; dépôt, validation, déblocage, F57", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides(textes, interrupteurs);
      let email = "";
      try {
        const f = await factureDeMissionEmise({
          prenom: "Therese",
          jours: ["2038-07-12", "2038-07-13"],
        });
        email = f.formateur.email;
        await honorairesAnterieurs(f.formateur.id);
        await attestationEchue(f.formateur.id);
        // Contre-calcul du cumul : payé + la mission en cours de paiement (facture reçue).
        expect(DEJA_PAYES_HT + 70_000).toBeGreaterThanOrEqual(SEUIL_CENTS);

        // La facture EST émise ; le virement est suspendu, sans retard qui court.
        const suspendu = await jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: f.empreinte,
          maintenant: "2038-07-20T08:00:00Z",
        });
        expect(suspendu.verdict.autorise).toBe(false);
        expect(suspendu.verdict.motifs).toEqual(["attestation_urssaf_echue_a_la_mission"]);
        expect(suspendu.verdict.retard).toEqual({
          joursDeRetard: 0,
          penalitesCents: 0,
          indemniteRecouvrementCents: 0,
        });
        // La mission est maintenue.
        const mission = await prisma.missionFormateur.findFirstOrThrow({
          where: { trainerId: f.formateur.id, sessionId: f.sessionId },
          select: { statut: true },
        });
        expect(mission.statut).toBe("acceptee");

        // F38, une fois par facture (deux clics, un seul e-mail).
        const [f38, f38bis] = await jouer([
          { etape: "f38", statementId: f.statementId },
          { etape: "f38", statementId: f.statementId },
        ]);
        expect(f38).toBe("envoye");
        expect(f38bis).toBe("envoye");
        await attendreEnvois(email, "formateur-virement-en-attente", 1);

        // Dépôt d'une attestation neuve : « Reçue, en vérification ».
        const depot = await prisma.trainerDocument.create({
          data: {
            trainerId: f.formateur.id,
            type: "attestation_vigilance_urssaf",
            statutValidation: "en_attente",
            dateEmission: new Date("2038-07-20T00:00:00Z"),
            numeroPiece: "BANC-URSSAF-NEUVE",
          },
          select: { id: true },
        });
        const etat = await jouerUne<{ etat: string; libelle: string }>({
          etape: "etat-piece",
          trainerId: f.formateur.id,
          type: "attestation_vigilance_urssaf",
          maintenant: "2038-07-21T08:00:00Z",
        });
        expect(etat).toEqual({ etat: "en_verification", libelle: "Reçue, en vérification" });

        // Validation (effet du clic : valide, vérifiée le 25/07, valable 6 mois), puis
        // ce qui la suit : le dossier se débloque, F57 part.
        const verifieeLe = "2038-07-25";
        await prisma.trainerDocument.update({
          where: { id: depot.id },
          data: {
            statutValidation: "valide",
            valideAt: new Date(`${verifieeLe}T10:00:00Z`),
            dateExpiration: new Date("2039-01-20T00:00:00Z"),
          },
        });
        const [decision] = await jouer([
          {
            etape: "apres-decision-piece",
            documentId: depot.id,
            decision: "valide",
            maintenant: `${verifieeLe}T10:05:00Z`,
          },
        ]);
        expect(decision).toMatchObject({ etat: "fait", f57: true });
        await attendreEnvois(email, "formateur-dossier-a-jour", 1);

        // Débloqué : le retard ne court que depuis la vérification (délai suspendu), pas
        // depuis l'échéance de la facture.
        const paye = "2038-08-04";
        const debloque = await jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: f.empreinte,
          maintenant: `${paye}T08:00:00Z`,
        });
        expect(debloque.verdict).toMatchObject({ autorise: true, motifs: [] });
        expect(debloque.verdict.retard.joursDeRetard).toBe(ecartJours(verifieeLe, paye));
        expect(debloque.verdict.retard.joursDeRetard).toBe(10);

        // F38 dit le motif sans montant inventé ; F57 dit que le dossier est à jour.
        const f38Rendu = await dernierEnvoiRendu(email, "formateur-virement-en-attente");
        expect(f38Rendu.texte).toMatch(/attestation/i);
        await dernierEnvoiRendu(email, "formateur-dossier-a-jour");
      } finally {
        await restaurer();
      }
    });
  });

  test("sous le seuil : attestation échue, aucun blocage", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides([], interrupteurs);
      try {
        const f = await factureDeMissionEmise({
          prenom: "Ulysse",
          jours: ["2038-07-19", "2038-07-20"],
          emettre: false,
        });
        await attestationEchue(f.formateur.id);
        // Cumul : la seule mission, 700 € HT.
        expect(70_000).toBeLessThan(SEUIL_CENTS);
        const libre = await jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: f.empreinte,
          maintenant: "2038-07-27T08:00:00Z",
        });
        expect(libre.verdict.motifs).not.toContain("attestation_urssaf_echue_a_la_mission");
        expect(libre.verdict.autorise).toBe(true);
      } finally {
        await restaurer();
      }
    });
  });

  // DÉFAUT V1-C-8 — F38 n'est jamais envoyé sans un clic dans la console.
  test.fixme("V1-C-8 : F38 part seul quand la facture est due et l'attestation échue", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides(textes, interrupteurs);
      try {
        const f = await factureDeMissionEmise({
          prenom: "Valentin",
          jours: ["2038-07-26", "2038-07-27"],
        });
        await honorairesAnterieurs(f.formateur.id);
        await attestationEchue(f.formateur.id);
        await jouer([{ etape: "suivi", maintenant: "2038-08-03T07:15:00Z" }]);
        await attendreEnvois(f.formateur.email, "formateur-virement-en-attente", 1);
      } finally {
        await restaurer();
      }
    });
  });
});
