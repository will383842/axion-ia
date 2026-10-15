// @formateurs — E11 · W-4 : attestation si exigible, pièces, habilitations →
// « Contresigner et ouvrir son espace » → activation par la personne qui
// contresigne → F19 (exemplaire complet) et F20 (« Votre espace est ouvert »).
// Les anciennes portes d'activation refusent ; le worker ne peut pas activer.
//
// Le formateur arrive à W-4 par le chemin réel : candidature, échange, « Retenu »,
// dossier en ligne rempli, contrat-cadre signé par code (cf. E08, E10).

import { expect, test } from "@playwright/test";

import { MOTIFS_ORANGE } from "@/server/qualiopi/formateurs-independants/verifier-contresigner-regles";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import {
  formateurRetenu,
  formationDuBanc,
  preparerDossier,
  registreDe,
  signerDossier,
} from "../fixtures/formateurs/parcours";
import {
  attendreLeWorker,
  gabaritsVers,
  ouvrirScenario,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E11 — contresigner et ouvrir son espace", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600_000);
  let decor: DecorScenario;
  let email = "";
  let trainerId = "";

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("e11", { organisme: true });
    email = decor.adresse("w4");
    const { fiche, lien } = await formateurRetenu(email, "Maël", decor.admin);
    trainerId = fiche.id;
    const registre = await preparerDossier(lien, "Maël");
    await signerDossier(lien, email, registre);
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("les anciennes portes refusent, le worker ne peut pas activer", async () => {
    for (const porte of ["fiche", "coaching"]) {
      const r = await etape<{ ok?: boolean; error?: string }>({
        etape: "porte-activation",
        args: { trainerId, porte },
        session: decor.admin,
      });
      expect(r.valeur.ok === true || (r.valeur.error ?? "") === "", `porte « ${porte} »`).toBe(
        false,
      );
    }
    const systeme = await etape<{ ok: boolean; code?: string }>({
      etape: "activer-par-le-systeme",
      args: { trainerId },
    });
    expect(systeme.valeur.ok).toBe(false);
    expect(systeme.valeur.code).toBe("acteur_systeme");

    const fiche = await prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });
    expect(fiche.actif).toBe(false);
    expect(fiche.activationValideeParId).toBeNull();
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).not.toContain("formateur-espace-ouvert");
  });

  // V1-A-6 (corrigé) — une pièce déposée dans le dossier n'a pas d'adresse, seulement ses
  // octets (`TrainerDocumentContenu`) : W-4, la porte de contresignature et l'activation
  // la reconnaissent désormais (`pieceAUnFichier`, `contenu` chargé).
  test("V1-A-6 — W-4 contresigne, active par la personne qui contresigne, F19 et F20 partent", async () => {
    const formation = await formationDuBanc(`e11-${Date.now()}`);
    try {
      const ecran = await etape<{
        faits: { pieces: { cv: { fichierPresent: boolean }; rib: { fichierPresent: boolean } } };
      }>({
        etape: "ecran-w4",
        args: { trainerId },
        session: decor.admin,
      });
      expect(ecran.valeur.faits.pieces.cv.fichierPresent).toBe(true);
      expect(ecran.valeur.faits.pieces.rib.fichierPresent).toBe(true);

      const contresigner = (orange: { orangeVerifie: boolean; motifOrange: string | null }) =>
        etape<{ ok: boolean; error?: string }>({
          etape: "contresigner-w4",
          args: {
            saisie: {
              trainerId,
              codeAttestation: "",
              attestationAuthentique: false,
              piecesVerifiees: true,
              formationIds: [formation.id],
              ...orange,
            },
          },
          session: decor.admin,
          registre: registreDe("Maël"),
        });

      // La contresignature relit le registre EN DIRECT, sans la liste publique des
      // organismes de formation (`sourceRegistreAnnuaire`) : elle inscrit un orange
      // « liste muette » que l'écran demande de vérifier. C'est le parcours documenté
      // de W-4 : contrat contresigné, puis « rechargez la page, vérifiez, cliquez de
      // nouveau ». (Oracle d'origine en un seul clic : il ne tenait pas compte de cette
      // relecture, que V1-A-6 masquait.)
      const premier = await contresigner({ orangeVerifie: false, motifOrange: null });
      expect(premier.valeur.ok).toBe(false);
      expect(premier.valeur.error).toMatch(/^Contrat contresigné\. Le registre relu/);
      const w4 = await contresigner({ orangeVerifie: true, motifOrange: MOTIFS_ORANGE[2] });
      expect(w4.valeur.ok, w4.valeur.error).toBe(true);
      const fiche = await prisma.trainer.findUniqueOrThrow({ where: { id: trainerId } });
      expect(fiche.actif).toBe(true);
      expect(fiche.activationValideeParId).toBe(decor.admin.id);
      await attendreLeWorker(email);
      const envois = await gabaritsVers(email);
      expect(envois).toContain("piece-exemplaire-signe");
      expect(envois.filter((g) => g === "formateur-espace-ouvert")).toHaveLength(1);
    } finally {
      await formation.effacer();
    }
  });
});
