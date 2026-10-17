// @formateurs — E09 · Registre ORANGE validé sur W-4 avec motif ; registre MUET
// « à contrôler », relu à la contresignature ; la preuve est inaltérable.
//
// (a) Orange : l'entreprise est active, mais la liste publique des organismes de
//     formation ne rattache pas le numéro déclaré à ce SIREN. Le dossier passe ;
//     la preuve du contrôle est ORANGE, avec son motif, et ne se modifie ni ne
//     s'efface. La validation de l'orange se fait sur W-4, avec un motif de la
//     liste fermée. L'autre orange courant — l'entreprise en DIFFUSION PARTIELLE —
//     fait demander l'adresse professionnelle à l'étape 2 (V1-A-11, corrigé).
// (b) Muet : le registre ne répond pas.
//
// ÉCART AU PLAN (b) : le plan voulait un dossier qui passe « à contrôler » puis
// une relecture à la contresignature. Le code a tranché autrement, et l'écrit
// (`contrat-dans-le-dossier.ts`) : « Registre muet = refus, à chacun des trois
// moments ». Le banc vérifie donc CE comportement : l'étape 2 continue (écran
// « muette »), mais ni le code ni la signature ne passent tant que le registre
// se tait — sans rien consommer — puis tout reprend quand il répond.

import { expect, test } from "@playwright/test";

import { MOTIFS_ORANGE } from "@/server/qualiopi/formateurs-independants/verifier-contresigner-regles";

import { prisma } from "../fixtures/formateurs/base";
import { verserCompetencesDuBanc } from "../fixtures/formateurs/competences-q21";
import { etape } from "../fixtures/formateurs/etapes";
import {
  IBAN_BANC,
  NDA_BANC,
  actionDossier,
  codeCapte,
  demanderCode,
  formateurRetenu,
  formationDuBanc,
  preparerDossier,
  registreDe,
  signerAvecCode,
} from "../fixtures/formateurs/parcours";
import { SIRET_BANC } from "../fixtures/formateurs/registre-entreprises";
import {
  attendreLeWorker,
  gabaritsVers,
  ouvrirScenario,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";

test.describe("@formateurs E09 — registre orange et muet, preuve inaltérable", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600_000);
  let decor: DecorScenario;
  let trainerOrange = "";

  test.beforeAll(async () => {
    // Les scénarios passent un par un (verrou) : l'attente peut être longue.
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("e09", { organisme: true });
  });
  test.afterAll(async () => {
    await decor?.liberer();
    await prisma.$disconnect();
  });

  test("(a) orange : le dossier passe, la preuve est orange, motivée, inaltérable", async () => {
    const email = decor.adresse("orange");
    const { fiche, lien } = await formateurRetenu(email, "Hugo", decor.admin);
    trainerOrange = fiche.id;
    const orange = registreDe("Hugo", "vert", null);
    const registre = await preparerDossier(lien, "Hugo", { registre: orange });
    const code = await demanderCode(lien, email, registre);
    await signerAvecCode(lien, email, registre, code);
    expect(
      (await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } })).dossierStatut,
    ).toBe("a_verifier");

    const preuves = await prisma.verificationRegistreSousTraitance.findMany({
      where: { trainerId: fiche.id },
      orderBy: { createdAt: "asc" },
    });
    expect(preuves.length).toBeGreaterThan(0);
    for (const p of preuves) {
      expect(p.verdict).toBe("orange");
      expect(p.motif ?? "").not.toBe("");
      expect(p.reponseSource).not.toBeNull();
    }

    // Inaltérable : ni modification, ni effacement (base en ajout seul).
    const derniere = preuves.at(-1);
    if (!derniere) return;
    await expect(
      prisma.verificationRegistreSousTraitance.update({
        where: { id: derniere.id },
        data: { verdict: "vert" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.verificationRegistreSousTraitance.delete({ where: { id: derniere.id } }),
    ).rejects.toThrow();
    const relue = await prisma.verificationRegistreSousTraitance.findUniqueOrThrow({
      where: { id: derniere.id },
    });
    expect(relue).toEqual(derniere);
  });

  // V1-A-6 (corrigé, cf. E11) — W-4 reconnaît le CV et le RIB déposés en ligne : la
  // validation de l'orange (étape 5 de W-4) est atteinte.
  test("(a) V1-A-6 — l'orange est validé sur W-4, avec un motif de la liste fermée", async () => {
    const formation = await formationDuBanc(`e09-${Date.now()}`);
    // Qualiopi ind. 21 — sans grilles d'évaluation versées, l'espace ne s'ouvre pas.
    await verserCompetencesDuBanc(prisma, trainerOrange, decor.admin.id);
    try {
      const w4 = await etape<{ ok: boolean; error?: string }>({
        etape: "contresigner-w4",
        args: {
          saisie: {
            trainerId: trainerOrange,
            codeAttestation: "",
            attestationAuthentique: false,
            piecesVerifiees: true,
            formationIds: [formation.id],
            orangeVerifie: true,
            motifOrange: MOTIFS_ORANGE[2],
          },
        },
        session: decor.admin,
        registre: registreDe("Hugo", "vert", null),
      });
      expect(w4.valeur.ok, w4.valeur.error).toBe(true);
      const validation = await prisma.verificationRegistreSousTraitance.findFirstOrThrow({
        where: { trainerId: trainerOrange, source: "validation_administrateur" },
      });
      expect(validation.motif).toContain(MOTIFS_ORANGE[2]);
      expect(validation.verifieParId).toBe(decor.admin.id);
    } finally {
      await formation.effacer();
    }
  });

  // V1-A-11 (corrigé) — une entreprise en DIFFUSION PARTIELLE (cas fréquent des
  // micro-entrepreneurs) : le registre ne donne pas l'adresse que le contrat imprime.
  // L'étape 2 la demande (refus qui le dit, rien d'écrit), puis l'enregistre : le contrat
  // se prépare et le dossier part.
  test("(a) V1-A-11 — diffusion partielle : le contrat se prépare et le dossier part", async () => {
    const email = decor.adresse("diffusion");
    const { fiche, lien } = await formateurRetenu(email, "Ilian", decor.admin);
    const diffusionPartielle = registreDe("Ilian", "orange");
    await actionDossier(lien, "vous", { telephone: "0600000000", codePostal: "69003" });
    const sansAdresse = await actionDossier(
      lien,
      "activite",
      {
        siret: SIRET_BANC,
        nda: NDA_BANC,
        regimeTva: "franchise_293b",
        iban: IBAN_BANC,
      },
      { registre: diffusionPartielle },
    );
    expect(sansAdresse.valeur.ok).toBe(false);
    expect(sansAdresse.valeur.message).toMatch(/adresse professionnelle/);
    expect(
      (await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } })).adresseProfessionnelle,
    ).toBeNull();

    const registre = await preparerDossier(lien, "Ilian", {
      registre: diffusionPartielle,
      adressePro: "12 rue des Lilas, 69003 Lyon",
    });
    expect(
      (await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } })).adresseProfessionnelle,
    ).toBe("12 rue des Lilas, 69003 Lyon");
    const code = await demanderCode(lien, email, registre);
    await signerAvecCode(lien, email, registre, code);
    expect(
      (await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } })).dossierStatut,
    ).toBe("a_verifier");
  });

  test("(b) muet : l'étape 2 continue, mais ni code ni signature tant qu'il se tait", async () => {
    const email = decor.adresse("muet");
    const { fiche, lien } = await formateurRetenu(email, "Iris", decor.admin);
    const muet = registreDe("Iris", "muet");
    const vert = registreDe("Iris");

    // Étape 2 sous registre muet : l'écran « muette » laisse continuer.
    await preparerDossier(lien, "Iris", { registre: muet });
    expect(
      (await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } })).siret,
    ).not.toBeNull();

    // « Recevoir mon code » : refusé, rien n'est créé ni envoyé.
    const refus = await actionDossier(lien, "code", {}, { registre: muet });
    expect(refus.valeur.ok).toBe(false);
    expect(refus.valeur.message).toMatch(/registre public des entreprises ne répond pas/);
    expect(
      await prisma.documentGenere.count({
        where: { trainerId: fiche.id, type: "contrat_sous_traitance" },
      }),
    ).toBe(0);
    await attendreLeWorker(email);
    expect(await gabaritsVers(email)).not.toContain("formateur-code-signature");

    // Le registre répond : le code part.
    const code = await demanderCode(lien, email, vert);
    expect(await codeCapte(email)).toBe(code);

    // Il se tait de nouveau à la signature : refusé, le code n'est PAS consommé.
    const signe = await actionDossier(
      lien,
      "signer",
      { certifie: "1", accepte: "1", code },
      { registre: muet },
    );
    expect(signe.valeur.ok).toBe(false);
    const contrat = await prisma.documentGenere.findFirstOrThrow({
      where: { trainerId: fiche.id, type: "contrat_sous_traitance", annuleeAt: null },
    });
    expect(await prisma.documentSignature.count({ where: { documentGenereId: contrat.id } })).toBe(
      0,
    );
    expect(
      (
        await prisma.documentSignatureCode.findFirstOrThrow({
          where: { documentGenereId: contrat.id },
        })
      ).utiliseAt,
    ).toBeNull();

    // Il répond : le même code signe, le dossier part.
    await signerAvecCode(lien, email, vert, code);
    expect(
      (await prisma.trainer.findUniqueOrThrow({ where: { id: fiche.id } })).dossierStatut,
    ).toBe("a_verifier");
  });
});
