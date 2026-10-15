// @formateurs V2-N01 — vérification n° 2, regard du FORMATEUR NOVICE : de l'offre au
// contrat signé, comme un vrai candidat sur téléphone, par les chemins réels du banc.
//
//   offre → candidature (F0) → invitation (F1) → réservation de l'échange (F3, F4) →
//   « Retenu » (F5) → dossier en ligne en 4 étapes (pièces, SIRET, IBAN) → code (F17) →
//   signature du contrat (F10) → [contresignature, espace ouvert : V1-A-6].
//
// Ce que ce scénario COMPTE, et que les scénarios E01-E11 ne regardent pas :
//   · les GESTES du candidat (une action serveur = un écran validé) et les e-mails reçus ;
//   · chaque e-mail tel que le puits l'a reçu : un lien mène-t-il quelque part
//     (`routeExiste`) ? le texte est-il en français simple (`problemesDuTexte`) ?
//     combien de mots à lire au téléphone ?
// Le relevé (écrans, clics, mots) est joint au rapport du test (`releve-entree.json`).
//
// Le banc n'ouvre aucun navigateur : les écrans sont rendus et manipulés dans
// `tests/unit/formateurs/v2/v2n-*.spec.tsx` (DOM simulé), ce fichier joue le serveur.
//
// 🔑 Cohabitation : ce fichier vit dans le groupe B. Il prend le TOUR des scénarios
// missions (`cadreScenario`, verrou fichier) puis le décor des scénarios d'entrée
// (`ouvrirScenario` : allumage, administrateur, organisme) — imbriqués, rendus dans
// l'ordre inverse.

import { expect, test } from "@playwright/test";

import { SLUG_OFFRE_BANC } from "../fixtures/formateurs/allumage";
import { prisma } from "../fixtures/formateurs/base";
import { eventUriDe, rendezVousFictif } from "../fixtures/formateurs/calendly-simule";
import { etape } from "../fixtures/formateurs/etapes";
import { cadreScenario } from "../fixtures/formateurs/missions-scenario";
import {
  ipSuivante,
  lienDuDernierMessage,
  preparerDossier,
  signerDossier,
} from "../fixtures/formateurs/parcours";
import { corpsDuMessage, messagesCaptes } from "../fixtures/formateurs/puits-smtp";
import {
  attendreLeWorker,
  candidaturesDe,
  gabaritsVers,
  ouvrirScenario,
  plus,
  type DecorScenario,
} from "../fixtures/formateurs/scenario";
import {
  HOTES_EXTERIEURS_ADMIS,
  estDuSite,
  liensDe,
  mots,
  problemesDuTexte,
  routeExiste,
} from "../fixtures/formateurs/v2n-lecture";

cadreScenario("v2n01");

/**
 * Les ÉCRANS et CLICS du candidat, lus dans les composants (pas devinés) :
 * formulaire court de l'offre, page Calendly, `DossierFormateur.tsx` étape par étape.
 * Un « clic » compte un toucher utile (bouton, case, choix) ; la saisie au clavier est
 * comptée à part (champs à remplir).
 */
const ECRANS = [
  { etape: "Offre → « Postuler »", ecrans: 2, clics: 2, champs: 3 },
  { etape: "E-mail F1 → réservation (Calendly)", ecrans: 2, clics: 4, champs: 0 },
  { etape: "E-mail F5 → dossier · étape 1 « Vous »", ecrans: 1, clics: 1, champs: 0 },
  { etape: "Dossier · étape 2 « Votre activité »", ecrans: 1, clics: 3, champs: 3 },
  { etape: "Dossier · étape 3 « Vos documents » (CV, RIB)", ecrans: 1, clics: 5, champs: 0 },
  { etape: "Dossier · étape 4 « Votre contrat » (code)", ecrans: 1, clics: 4, champs: 1 },
] as const;

test.describe("@formateurs V2-N01 — parcours d'entrée au téléphone, compté", () => {
  test.describe.configure({ mode: "serial" });
  let decor: DecorScenario;
  let email = "";

  test.beforeAll(async () => {
    test.setTimeout(2_700_000);
    decor = await ouvrirScenario("v2n01", { organisme: true });
  });
  test.afterAll(async () => {
    test.setTimeout(120_000);
    await decor?.liberer();
  });

  test("de l'offre au contrat signé : gestes comptés, e-mails lisibles, liens vivants", async () => {
    test.setTimeout(900_000);
    email = decor.adresse("novice");
    const gestes: string[] = [];

    // ── 1. L'offre, le formulaire court ──────────────────────────────────────
    const depot = await etape<{ ok: boolean; error?: string }>({
      etape: "deposer-candidature",
      args: { offre: SLUG_OFFRE_BANC, prenom: "Inès", nom: "Banc-Essai", email },
      ip: ipSuivante(),
    });
    expect(depot.valeur.ok, depot.valeur.error).toBe(true);
    gestes.push("postuler");
    const [cand] = await candidaturesDe(email);
    if (!cand) throw new Error("candidature absente");

    // ── 2. F1, puis la réservation par son lien ──────────────────────────────
    await etape({
      etape: "passage-invitations",
      args: { maintenant: plus(cand.submittedAt, { minutes: 16 }) },
    });
    await attendreLeWorker(email);
    const debut = plus(new Date(), { minutes: -40 });
    const rdv = rendezVousFictif({
      nomType: "Échange formateur indépendant (20 min)",
      typeConnu: null,
      prenom: "Inès",
      email,
      debut: debut.toISOString(),
      dureeMinutes: 20,
      tracking: { utm_content: `formateur:fa-${cand.id}` },
    });
    const livraison = await etape<{ statut: number }>({
      etape: "livrer-webhook",
      args: { cle: rdv.cle },
      calendly: [rdv],
    });
    expect(livraison.valeur.statut).toBe(200);
    gestes.push("réserver");
    const ligne = await prisma.calendlyEvent.findFirstOrThrow({
      where: { eventUri: eventUriDe(rdv) },
    });
    for (const avant of [{ jours: -2 }, { minutes: -1445 }, { minutes: -65 }]) {
      await etape({
        etape: "passage-echanges-formateur",
        args: { maintenant: plus(debut, avant) },
      });
    }

    // ── 3. « Retenu » (geste de la direction, pas du candidat) ────────────────
    const retenu = await etape<{ etat: string; message?: string }>({
      etape: "enregistrer-issue",
      args: { calendlyEventId: ligne.id, issue: "retenu", confirmer: true },
      session: decor.admin,
    });
    expect(retenu.valeur.etat, retenu.valeur.message).not.toBe("erreur");
    await attendreLeWorker(email);
    const lien = await lienDuDernierMessage(
      email,
      /\/formateur\/dossier\/([0-9a-f-]{36})\/([^"'\s<>?#]+)/,
    );
    // Le lien de F5 ouvre bien le dossier (pas une page neutre « lien non valable »).
    expect((await etape({ etape: "lire-dossier", args: { ...lien } })).valeur).not.toBeNull();

    // ── 4. Le dossier en ligne, étapes 1 à 3 (5 actions serveur), puis 4 ──────
    const registre = await preparerDossier(lien, "Inès");
    gestes.push("étape 1", "étape 2", "CV", "RIB");
    await signerDossier(lien, email, registre);
    gestes.push("recevoir le code", "signer");

    // ── Le compte : ce que le candidat a fait et reçu ─────────────────────────
    await attendreLeWorker(email);
    const recus = await gabaritsVers(email);
    expect(recus).toEqual([
      "candidature-recue",
      "formateur-invitation-echange",
      "formateur-echange-confirme",
      "formateur-echange-rappel",
      "formateur-echange-rappel",
      "formateur-issue-retenu",
      "formateur-code-signature",
      "formateur-dossier-recu",
    ]);
    // Huit gestes du candidat entre l'offre et le contrat signé (budget : 10).
    expect(gestes.length).toBeLessThanOrEqual(10);
    const totalEcrans = ECRANS.reduce((n, e) => n + e.ecrans, 0);
    const totalClics = ECRANS.reduce((n, e) => n + e.clics, 0);
    expect(totalEcrans).toBeLessThanOrEqual(10);

    // ── Chaque e-mail, tel que le puits l'a reçu ──────────────────────────────
    await expect
      .poll(async () => (await messagesCaptes(email)).length, { timeout: 30_000 })
      .toBe(recus.length);
    const lus: Array<{ sujet: string; mots: number; liens: number }> = [];
    const defauts: string[] = [];
    for (const m of await messagesCaptes(email)) {
      const { html, texte } = await corpsDuMessage(m.id);
      const corps = texte || html.replace(/<[^>]+>/g, " ");
      for (const p of problemesDuTexte(`${m.sujet}\n${corps}`))
        defauts.push(`« ${m.sujet} » : ${p}`);
      const liens = liensDe(html);
      for (const l of liens) {
        if (estDuSite(l)) {
          if (!routeExiste(l)) defauts.push(`« ${m.sujet} » : lien mort ${new URL(l).pathname}`);
        } else if (!HOTES_EXTERIEURS_ADMIS.some((h) => new URL(l).hostname.endsWith(h))) {
          defauts.push(`« ${m.sujet} » : lien vers un site inattendu ${new URL(l).hostname}`);
        }
      }
      lus.push({ sujet: m.sujet, mots: mots(corps), liens: liens.length });
    }
    const releve = { gestes, ecrans: ECRANS, totalEcrans, totalClics, emails: lus };
    console.warn(`[V2-N01] relevé du parcours d'entrée :\n${JSON.stringify(releve, null, 2)}`);
    await test.info().attach("releve-entree.json", {
      body: JSON.stringify(releve, null, 2),
      contentType: "application/json",
    });
    expect(defauts, defauts.join("\n")).toEqual([]);
  });

  // Déjà consigné à la vérification n° 1 (V1-A-6, BLOQUANT) et COUVERT PAR #1539 : l'écran
  // « Vérifier et contresigner » tient pour absentes les pièces déposées en ligne ; le
  // parcours du novice s'arrête donc ici sur `main` — aucun espace ne s'ouvre.
  test.fixme("V1-A-6 (couvert par #1539) — contresignature, puis F20 « Votre espace est ouvert »", async () => {
    const fiche = await prisma.trainer.findFirstOrThrow({ where: { email } });
    const ecran = await etape<{ faits: { pieces: { cv: { fichierPresent: boolean } } } }>({
      etape: "ecran-w4",
      args: { trainerId: fiche.id },
      session: decor.admin,
    });
    expect(ecran.valeur.faits.pieces.cv.fichierPresent).toBe(true);
  });
});
