// @formateurs V2-N02 — vérification n° 2, regard du FORMATEUR NOVICE : il se TROMPE.
//
// Un vrai candidat tape mal son téléphone, oublie un chiffre du SIRET, colle un IBAN
// tronqué, envoie une photo au lieu d'un PDF, recopie mal son code. À chaque fois :
//   · le refus dit QUOI corriger, en français simple (pas de code, pas d'anglais, pas de
//     « erreur interne »), en une phrase lisible au téléphone ;
//   · rien de ce qui était déjà enregistré n'est perdu (relu en base après le refus) ;
//   · après correction, le parcours repart et aboutit.
// Puis, une fois le dossier en cours, il a perdu l'e-mail : « Recevoir un nouveau lien ».

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { etape } from "../fixtures/formateurs/etapes";
import { envoisVers } from "../fixtures/formateurs/missions-donnees";
import { envoiRendu } from "../fixtures/formateurs/missions-gestes";
import { ATTENTE_FILE, cadreScenario } from "../fixtures/formateurs/missions-scenario";
import {
  IBAN_BANC,
  NDA_BANC,
  actionDossier,
  demanderCode,
  formateurRetenu,
  preparerDossier,
  registreDe,
  signerAvecCode,
} from "../fixtures/formateurs/parcours";
import { SIRET_BANC } from "../fixtures/formateurs/registre-entreprises";
import { ouvrirScenario, type DecorScenario } from "../fixtures/formateurs/scenario";
import { problemesDuTexte } from "../fixtures/formateurs/v2n-lecture";

const sc = cadreScenario("v2n02");

/** Un refus lisible par un novice : une phrase, en français, qui dit quoi faire. */
function refusLisible(message: string | undefined, contexte: string): void {
  expect(message ?? "", `${contexte} : un message`).not.toBe("");
  const m = message ?? "";
  expect(problemesDuTexte(m), `${contexte} : « ${m} »`).toEqual([]);
  expect(m, contexte).not.toMatch(/erreur interne|exception|stack|error|undefined|500/i);
  expect(m.length, `${contexte} : « ${m} »`).toBeLessThanOrEqual(220);
}

test.describe("@formateurs V2-N02 — le candidat se trompe, rien n'est perdu", () => {
  test.describe.configure({ mode: "serial" });
  let decor: DecorScenario;

  test.beforeAll(async () => {
    test.setTimeout(45 * 60_000);
    decor = await ouvrirScenario("v2n02", { organisme: true });
  });
  test.afterAll(async () => {
    test.setTimeout(120_000);
    await decor?.liberer();
  });

  test("chaque erreur de saisie : un refus clair, la saisie d'avant gardée, puis ça aboutit", async () => {
    test.setTimeout(15 * 60_000);
    const email = decor.adresse("maladroit");
    const { fiche, lien } = await formateurRetenu(email, "Hugo", decor.admin);
    const registre = registreDe("Hugo");

    // Étape 1 : téléphone tronqué, code postal à 4 chiffres.
    const tel = await actionDossier(lien, "vous", { telephone: "06 12", codePostal: "69003" });
    expect(tel.valeur.ok).toBe(false);
    refusLisible(tel.valeur.message, "téléphone tronqué");
    const cp = await actionDossier(lien, "vous", { telephone: "0600000000", codePostal: "6900" });
    expect(cp.valeur.ok).toBe(false);
    refusLisible(cp.valeur.message, "code postal à 4 chiffres");
    const ok1 = await actionDossier(lien, "vous", { telephone: "0600000000", codePostal: "69003" });
    expect(ok1.valeur.ok, ok1.valeur.message).toBe(true);

    // Étape 2 : SIRET à 13 chiffres, puis IBAN tronqué.
    const base = { nda: NDA_BANC, regimeTva: "franchise_293b" };
    const siret = await actionDossier(
      lien,
      "activite",
      { ...base, siret: SIRET_BANC.slice(0, 13), iban: IBAN_BANC },
      { registre },
    );
    expect(siret.valeur.ok).toBe(false);
    refusLisible(siret.valeur.message, "SIRET à 13 chiffres");
    const iban = await actionDossier(
      lien,
      "activite",
      { ...base, siret: SIRET_BANC, iban: IBAN_BANC.slice(0, 20) },
      { registre },
    );
    expect(iban.valeur.ok).toBe(false);
    refusLisible(iban.valeur.message, "IBAN tronqué");

    // Rien de l'étape 1 n'est perdu par les deux refus ; le lien ouvre toujours le dossier.
    const relu = await prisma.trainer.findUniqueOrThrow({
      where: { id: fiche.id },
      select: { codePostalPro: true, telephone: true },
    });
    expect(relu.codePostalPro).toBe("69003");
    expect(relu.telephone).not.toBeNull();
    expect((await etape({ etape: "lire-dossier", args: { ...lien } })).valeur).not.toBeNull();

    // Étape 3 : un fichier texte au lieu d'un PDF ou d'une photo.
    const texte = {
      nom: "mon-cv.txt",
      type: "text/plain",
      base64: Buffer.from("Mon parcours de formateur").toString("base64"),
    };
    const mauvais = await actionDossier(lien, "piece", { type: "cv" }, { fichier: texte });
    expect(mauvais.valeur.ok).toBe(false);
    refusLisible(mauvais.valeur.message, "fichier texte au lieu d'un PDF");
    const sansFichier = await actionDossier(lien, "piece", { type: "rib" });
    expect(sansFichier.valeur.ok).toBe(false);
    refusLisible(sansFichier.valeur.message, "aucun fichier choisi");

    // Les étapes 1 à 3 corrigées, puis un code mal recopié, puis le bon.
    await preparerDossier(lien, "Hugo", { registre });
    const code = await demanderCode(lien, email, registre);
    const faux = code === "000000" ? "111111" : "000000";
    const signeFaux = await actionDossier(
      lien,
      "signer",
      { certifie: "1", accepte: "1", code: faux },
      { registre },
    );
    expect(signeFaux.valeur.ok).toBe(false);
    refusLisible(signeFaux.valeur.message, "code mal recopié");
    const sansCase = await actionDossier(lien, "signer", { accepte: "1", code }, { registre });
    expect(sansCase.valeur.ok).toBe(false);
    refusLisible(sansCase.valeur.message, "case « Je certifie » oubliée");
    await signerAvecCode(lien, email, registre, code);
    const signe = await prisma.trainer.findUniqueOrThrow({
      where: { id: fiche.id },
      select: { dossierStatut: true },
    });
    expect(signe.dossierStatut).toBe("a_verifier");
    // Le dossier envoyé reste lisible par son lien (écran « Dossier reçu »).
    expect((await etape({ etape: "lire-dossier", args: { ...lien } })).valeur).toMatchObject({
      etat: "a_verifier",
    });
  });

  test("il a perdu l'e-mail du dossier : « Recevoir un nouveau lien » le lui renvoie, et il marche", async () => {
    test.setTimeout(10 * 60_000);
    const email = decor.adresse("etourdi");
    const { fiche, lien } = await formateurRetenu(email, "Lina", decor.admin);
    await actionDossier(lien, "vous", { telephone: "0600000000", codePostal: "69003" });

    const fd = new FormData();
    fd.set("email", email.toUpperCase());
    fd.set("site", "");
    const r = await sc.pilote.appeler<{ envoye: boolean; message: string }>(
      "@/app/formateur/dossier/retrouver/actions",
      "demanderLienDossier",
      [undefined, fd],
    );
    expect(r.envoye).toBe(true);
    refusLisible(r.message, "réponse de « Recevoir un nouveau lien »");
    // L'e-mail part par la file du processus serveur des scénarios missions (Redis n° 1,
    // non consommée par le worker) : il est relu tel que le worker le rendra.
    await expect
      .poll(async () => (await envoisVers(email, "formateur-lien-espace")).length, ATTENTE_FILE)
      .toBe(1);
    const [envoi] = await envoisVers(email, "formateur-lien-espace");
    const rendu = await envoiRendu(sc.pilote, envoi!.jobId!);
    expect(problemesDuTexte(rendu.sujet)).toEqual([]);
    const t = /\/formateur\/dossier\/([0-9a-f-]{36})\/([^"'\s<>?#]+)/.exec(
      rendu.texte.replace(/&amp;/g, "&"),
    );
    expect(t, "un lien de dossier dans l'e-mail").not.toBeNull();
    const nouveau = { id: t![1]!, jeton: decodeURIComponent(t![2]!) };
    expect(nouveau.id).toBe(fiche.id);
    // Le nouveau lien ouvre le dossier là où il en était (étape 1 enregistrée).
    expect((await etape({ etape: "lire-dossier", args: { ...nouveau } })).valeur).not.toBeNull();
    const relu = await prisma.trainer.findUniqueOrThrow({
      where: { id: fiche.id },
      select: { codePostalPro: true },
    });
    expect(relu.codePostalPro).toBe("69003");
  });
});
