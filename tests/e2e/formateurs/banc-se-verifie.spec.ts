// @formateurs — le BANC se vérifie lui-même.
//
// Un banc qui dérive rend des verts qui ne prouvent rien. Avant que les lots
// du chantier s'appuient sur ces fixtures, ce spec établit que chacune fait ce
// qu'elle annonce, contre le code RÉEL du dépôt :
//   (a) une livraison signée puis altérée est refusée par la route (401) et
//       n'écrit rien — la signature du banc est donc bien celle qu'on vérifie ;
//   (b) les cinq réponses du registre produisent, chez l'appelant existant,
//       les cinq issues attendues ;
//   (c) un passage planifié appelé avec l'horloge pilotée en reçoit l'instant,
//       et un second passage plus tard ne recrée rien ;
//   (d) un interrupteur semé se lit, puis la restauration remet l'état d'avant ;
//   (e) le journal des envois se lit (et reste vide pour une adresse du banc).

import { expect, test } from "@playwright/test";

import { lireEntrepriseParSiren } from "@/features/apporteurs-reseau/annuaire";
import {
  rechercherSiren,
  viderCacheAnnuaire,
} from "@/features/dossier-client/recherche-entreprises";

import { effacerRendezVous, ligneDuRendezVous, prisma } from "../fixtures/formateurs/base";
import { rendezVousFictif } from "../fixtures/formateurs/calendly-simule";
import { executerCoteServeur } from "../fixtures/formateurs/execution";
import { horlogePilotee } from "../fixtures/formateurs/horloge";
import { lireInterrupteur, semerInterrupteurs } from "../fixtures/formateurs/interrupteurs";
import { compterEnvois } from "../fixtures/formateurs/journal-envois";
import type { ResultatPassage, ResultatWebhook } from "../fixtures/formateurs/protocole";
import {
  DENOMINATION_BANC,
  registreSimule,
  SIREN_BANC,
} from "../fixtures/formateurs/registre-entreprises";

const sansAttente = { attendre: () => Promise.resolve() };

test.describe("@formateurs le banc se vérifie", () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("(a) une livraison altérée après signature est refusée et n'écrit rien", async () => {
    const rdv = rendezVousFictif({
      nomType: "Diagnostic IA",
      typeConnu: "diagnostic",
      prenom: "Ysée",
    });
    try {
      const reponse = await executerCoteServeur<ResultatWebhook>({
        action: "livrer-webhook-calendly",
        rdv,
        alterer: true,
      });
      expect(reponse.statut).toBe(401);
      expect(reponse.corps).toBe("invalid_signature");
      expect(reponse.reseau.filter((a) => a.url.startsWith("https://api.calendly.com/"))).toEqual(
        [],
      );
      expect(await ligneDuRendezVous(rdv)).toBeNull();
    } finally {
      await effacerRendezVous(rdv);
    }
  });

  test("(b) les cinq réponses du registre", async () => {
    const vert = await lireEntrepriseParSiren(SIREN_BANC, {
      fetch: registreSimule("vert").fetch,
      ...sansAttente,
    });
    expect(vert.ok && vert.entreprise).toMatchObject({
      siren: SIREN_BANC,
      denomination: DENOMINATION_BANC,
      active: true,
      francaise: true,
      diffusionPartielle: false,
    });

    const orange = await lireEntrepriseParSiren(SIREN_BANC, {
      fetch: registreSimule("orange").fetch,
      ...sansAttente,
    });
    expect(orange.ok && orange.entreprise).toMatchObject({
      active: true,
      denomination: null,
      diffusionPartielle: true,
    });

    const rouge = await lireEntrepriseParSiren(SIREN_BANC, {
      fetch: registreSimule("rouge").fetch,
      ...sansAttente,
    });
    expect(rouge.ok && rouge.entreprise).toMatchObject({ active: false });

    // Muet : seul le délai de l'appelant (4 s) termine l'attente.
    const muet = await lireEntrepriseParSiren(SIREN_BANC, {
      fetch: registreSimule("muet").fetch,
      ...sansAttente,
    });
    expect(muet).toEqual({ ok: false, raison: "indisponible" });

    // 429 à chaque essai : trois tentatives, puis « indisponible ».
    const quota = registreSimule("429");
    const refuse = await lireEntrepriseParSiren(SIREN_BANC, { fetch: quota.fetch, ...sansAttente });
    expect(refuse).toEqual({ ok: false, raison: "indisponible" });
    expect(quota.appels).toHaveLength(3);

    // Le second appelant existant, par nom et ville, lit la même simulation.
    viderCacheAnnuaire();
    const parNom = await rechercherSiren("Atelier Banc-Essai", "Lyon", {
      fetch: registreSimule("vert").fetch,
    });
    expect(parNom).toEqual({
      ok: true,
      propositions: [
        { siren: SIREN_BANC, nom: DENOMINATION_BANC, ville: "LYON", codePostal: "69000" },
      ],
    });
  });

  test("(c) un passage planifié reçoit l'instant de l'horloge pilotée", async () => {
    const rdv = rendezVousFictif({
      nomType: "Diagnostic IA",
      typeConnu: "diagnostic",
      prenom: "Aurèle",
    });
    const horloge = horlogePilotee(new Date());
    try {
      const premier = await executerCoteServeur<ResultatPassage>({
        action: "passage-decouverte-calendly",
        rendezVous: [rdv],
        maintenant: horloge.iso(),
      });
      expect(premier.issue).toMatchObject({ ok: true, scanned: 1, created: 1 });
      // La fenêtre demandée à Calendly part de l'instant FOURNI, pas de l'horloge
      // du processus : on la relit dans l'adresse réellement appelée.
      const liste = premier.reseau.find((a) => a.url.includes("/scheduled_events?"));
      expect(liste, "la liste des rendez-vous a été demandée").toBeDefined();
      const maxStart = new URL(liste?.url ?? "https://x.invalid").searchParams.get(
        "max_start_time",
      );
      expect(Date.parse(maxStart ?? "")).toBe(horloge.maintenant().getTime() + 60 * 86_400_000);
      expect((await ligneDuRendezVous(rdv))?.typeRendezVous).toBe("diagnostic");

      horloge.avancer({ minutes: 10 });
      const second = await executerCoteServeur<ResultatPassage>({
        action: "passage-decouverte-calendly",
        rendezVous: [rdv],
        maintenant: horloge.iso(),
      });
      expect(second.issue).toMatchObject({ ok: true, scanned: 1, created: 0 });
    } finally {
      await effacerRendezVous(rdv);
    }
  });

  test("(d) un interrupteur semé se lit, puis la restauration remet l'état d'avant", async () => {
    const cle = `banc.formateurs.sonde.${Date.now()}`;
    expect(await lireInterrupteur(cle)).toBeUndefined();
    const restaurer = await semerInterrupteurs({ [cle]: { actif: true } });
    try {
      expect(await lireInterrupteur(cle)).toEqual({ actif: true });
    } finally {
      await restaurer();
    }
    expect(await lireInterrupteur(cle)).toBeUndefined();
  });

  test("(e) le journal des envois se lit", async () => {
    expect(await compterEnvois("personne.banc@example.test")).toBe(0);
  });
});
