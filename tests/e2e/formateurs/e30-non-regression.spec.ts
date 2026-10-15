// @formateurs E30 — Non-régression : ce que le chantier formateurs ne change pas.
//
//   1. rendez-vous client : webhook signé → « diagnostic », un `calendly_booked`
//      CRM, et la confirmation `appel-confirme` du passage réel (une seule) ;
//   2. tunnel apporteur : dossier ouvert, lien envoyé et lisible (un faux,
//      non), coordonnées et activité enregistrées, signature refusée tant que le
//      dossier est incomplet ; jamais de CRM ;
//   3. relevé d'un salarié au centime : spec existant du banc,
//      `tests/e2e/qualiopi/formateurs/releve-salarie-au-centime.spec.ts` ;
//   4. offre monteur « poste pourvu » : exclue de la réponse automatique, comme
//      l'offre formateur freelance ; une offre témoin y entre ;
//   5. convention client : l'objet « Convention à signer — … » ;
//   6. autofacture apporteur : données et numéro FIGÉS (valeurs de `main` au
//      2026-10-14). Un écart ici doit être DÉCIDÉ et dit dans la PR qui le fait.
//
// ÉCART consigné (banc) : le tunnel apporteur ne va pas jusqu'à la signature
// et la contresignature — le dépôt de pièces exige l'antivirus et le contrat
// signé le stockage R2, que le job du banc n'a pas. Le parcours est éprouvé
// jusqu'à la dernière étape que le banc sait jouer.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { messagesCaptes, viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

interface Observations {
  rdvClient: {
    adresse: string;
    statut: number;
    type: string;
    crm: Array<{ eventType: string; universe: string }>;
    passage: { candidats: number; envoyes: number };
    repassage: { envoyes: number };
    envois: Array<{ template: string; status: string }>;
  };
  tunnelApporteur: {
    adresse: string;
    ouvert: { ok: boolean; statut: string };
    lien: unknown;
    lisible: boolean;
    faux: boolean;
    coordonnees: unknown;
    activite: unknown;
    signature: unknown;
    statutFinal: string;
    envois: Array<{ template: string; status: string }>;
    crm: number;
  };
  monteur: Record<string, boolean>;
  convention: { fr: string; en: string };
  autofacture: { ok: boolean; data?: Record<string, unknown> };
}

const ATTENTE = { timeout: 30_000, intervals: [500, 1_000] };

const AUTOFACTURE_FIGEE = {
  numero: "AXI-APP-2026-0007",
  dateEmission: "6 octobre 2026",
  datePrestation: "6 octobre 2026",
  dateEcheance: "5 novembre 2026",
  contestationAvant: "5 novembre 2026",
  periodeLabel: "commissions exigibles au 6 octobre 2026",
  sousTraitant: {
    nom: "ATELIER BANC-ESSAI FORMATION",
    siret: "987654324",
    numeroTvaIntracom: "FR00987654324",
    adresseProfessionnelle: "1 RUE DU BANC D'ESSAI 69000 LYON",
    email: "camille@example.test",
  },
  // `\u202f` : l'espace fine insécable des milliers (`toLocaleString("fr-FR")`).
  lignes: [
    {
      designation:
        "Commission d'apport (Formation IA — 2 jours) — palier Palier 1 — prix public 1\u202f900,00 € HT, prix facturé 1\u202f710,00 € HT",
      montantHtCents: 12345,
    },
    { designation: "Parrainage (art. 4.6)", montantHtCents: 5000 },
  ],
  regimeHonoraires: "assujetti_20",
  delaiContestationJours: 30,
  libelleIdentifiantFournisseur: "SIREN",
  mandatReference:
    "Mandat de facturation donné par l'apporteur à la Société : annexe 2 du contrat d'apporteur, article 289, I, 2 du code général des impôts.",
  mandatFin:
    "Le mandat de facturation peut être dénoncé par écrit avec un préavis de trente jours (annexe 2 du contrat), sans effet rétroactif sur les factures déjà émises.",
};

test.describe("@formateurs E30 — non-régression", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("e30-non-regression", {});
  });

  test.afterAll(async () => {
    for (const a of [o?.rdvClient.adresse, o?.tunnelApporteur.adresse])
      if (a) await viderPuitsPour(a);
    await prisma.$disconnect();
  });

  test("1. rendez-vous client : classé, CRM, une confirmation par e-mail", async () => {
    expect(o.rdvClient).toMatchObject({
      statut: 200,
      type: "diagnostic",
      crm: [{ eventType: "calendly_booked", universe: "business" }],
      passage: { candidats: 1, envoyes: 1 },
      repassage: { envoyes: 0 },
      envois: [{ template: "appel-confirme", status: "sent" }],
    });
    await expect
      .poll(async () => (await messagesCaptes(o.rdvClient.adresse)).length, ATTENTE)
      .toBe(1);
    const [m] = await messagesCaptes(o.rdvClient.adresse);
    expect(m?.sujet).toMatch(/^Diagnostic IA/);
  });

  test("2. tunnel apporteur : jusqu'à la signature, sans CRM", () => {
    expect(o.tunnelApporteur).toMatchObject({
      ouvert: { ok: true, statut: "dossier_en_cours" },
      lien: true,
      lisible: true,
      faux: false,
      coordonnees: { ok: true },
      activite: { ok: true },
      signature: { ok: false, raison: "refus", message: "Votre dossier n'est pas encore complet." },
      statutFinal: "dossier_en_cours",
      envois: [{ template: "apporteur-dossier-lien", status: "sent" }],
      crm: 0,
    });
  });

  test("4. offre monteur « poste pourvu » : toujours exclue de la réponse automatique", () => {
    expect(o.monteur).toEqual({ monteur: false, formateurFreelance: false, temoin: true });
  });

  test("5. convention client : « Convention à signer » inchangé", () => {
    expect(o.convention).toEqual({
      fr: "Convention à signer — IA pour l'immobilier",
      en: "Agreement to sign — AI for real estate",
    });
  });

  test("6. autofacture apporteur : identique, au centime et au mot", () => {
    expect(o.autofacture.ok).toBe(true);
    const { identite: _identite, ...data } = o.autofacture.data ?? {};
    expect(data).toEqual(AUTOFACTURE_FIGEE);
  });
});
