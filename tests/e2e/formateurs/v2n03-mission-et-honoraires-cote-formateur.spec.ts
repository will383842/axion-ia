// @formateurs V2-N03 — vérification n° 2, regard du FORMATEUR NOVICE, une fois son
// espace ouvert : une mission proposée, acceptée, sa lettre signée ; puis ses feuilles de
// présence, sa facture établie en son nom, son virement — tel qu'il les voit.
//
// Ce que ce fichier COMPTE : les gestes du formateur (« J'accepte », « Signer ma
// lettre », chaque contresignature de demi-journée), et chaque e-mail qu'il reçoit
// (liens vivants, français simple). Les mécanismes eux-mêmes (rangs, convention,
// passage, échéance) sont prouvés par E13-E26 ; ici on lit ce que le formateur lit.
//
// Le formateur est posé PRÊT (`creerFormateurPret`, `semerFormateur`) : sur `main`, un
// formateur venu du dossier en ligne ne peut pas encore être contresigné (V1-A-6,
// couvert par #1539) — voir V2-N01.

import { expect, test } from "@playwright/test";

import { BASCULE_2037 } from "../fixtures/formateurs/argent-commun";
import { jouerUne } from "../fixtures/formateurs/argent-execution";
import { factureDeMissionEmise, marquerPaye } from "../fixtures/formateurs/argent-parcours";
import { jobF36 } from "../fixtures/formateurs/argent-puits";
import { horlogePilotee } from "../fixtures/formateurs/horloge";
import {
  aParis,
  creerFormateurPret,
  creerPiece,
  creerSession,
  envoisVers,
  jourCivil,
} from "../fixtures/formateurs/missions-donnees";
import {
  M,
  choisir,
  contresignerLettre,
  derniereMission,
  envoiRendu,
  lettresVivantes,
  repondre,
  signerConvention,
  signerMaLettre,
} from "../fixtures/formateurs/missions-gestes";
import { ATTENTE_FILE, cadreScenario } from "../fixtures/formateurs/missions-scenario";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import {
  HOTES_EXTERIEURS_ADMIS,
  estDuSite,
  liensDe,
  mots,
  problemesDuTexte,
  routeExiste,
} from "../fixtures/formateurs/v2n-lecture";

const sc = cadreScenario("v2n03");

/** Ce qu'un e-mail rendu montre au novice : défauts de lecture et liens morts. */
function defautsDuRendu(r: { sujet: string; texte: string }): string[] {
  const d = problemesDuTexte(`${r.sujet}\n${r.texte.replace(/<[^>]+>/g, " ")}`).map(
    (p) => `« ${r.sujet} » : ${p}`,
  );
  for (const l of liensDe(r.texte)) {
    if (estDuSite(l)) {
      if (!routeExiste(l)) d.push(`« ${r.sujet} » : lien mort ${new URL(l).pathname}`);
    } else if (!HOTES_EXTERIEURS_ADMIS.some((h) => new URL(l).hostname.endsWith(h))) {
      d.push(`« ${r.sujet} » : lien vers ${new URL(l).hostname}`);
    }
  }
  return d;
}

test.describe("@formateurs V2-N03 — mission, lettre, honoraires : ce que le formateur voit", () => {
  test.setTimeout(600_000);

  test("proposition → « J'accepte » → lettre signée : deux gestes, e-mails lisibles, liens vivants", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Nina" });
    const session = await creerSession(monde, { dansJours: 20, nbJours: 2 });
    const gestes: string[] = [];

    // La direction propose (choix en cartes) : F23 part au formateur.
    const c = await choisir(pilote, monde, session.id, [{ trainerId: f.id }]);
    expect(c, JSON.stringify(c)).toEqual({
      data: expect.objectContaining({ missionProposee: true }),
    });
    const mission = await derniereMission(session.id, f.id);

    // L'accueil de l'espace : la proposition, son montant, sa date limite, « Voir et répondre ».
    const aConfirmer = await pilote.appeler<Array<{ id: string }>>(
      "@/server/qualiopi/trainers/mission-formateur",
      "listerMissionsAConfirmer",
      [f.id],
    );
    expect(aConfirmer.map((m) => m.id)).toEqual([mission.id]);
    const chiffree = await pilote.appeler<{ totalHtCents: number } | null>(
      "@/server/qualiopi/formateurs-independants/proposition-chiffree",
      "lirePropositionChiffree",
      [mission.id],
    );
    expect(chiffree?.totalHtCents ?? 0).toBeGreaterThan(0);
    expect(mission.echeanceReponseAt, "une date limite de réponse est affichée").not.toBeNull();
    expect(routeExiste(`/fr/espace-formateur?mission=${mission.id}`)).toBe(true);

    // « J'accepte » : un geste.
    const r = await repondre(pilote, f.id, mission.id, "acceptee");
    expect(r, JSON.stringify(r)).toEqual({ data: expect.objectContaining({ statut: "acceptee" }) });
    gestes.push("J'accepte");

    // La convention signée par le client : la lettre est prête, F26 part.
    const convention = await creerPiece(monde, {
      type: "convention",
      sessionId: session.id,
      clientId: monde.clientId,
    });
    await signerConvention(pilote, monde, convention);
    const passage = horlogePilotee(aParis(jourCivil(new Date(), 1), 10, 25));
    await pilote.appeler(M.moteur, "passerMoteurMissions", [passage.maintenant()]);
    const [lettre] = await lettresVivantes(session.id, f.id);
    expect(lettre, "une lettre de mission vivante").toBeDefined();

    // « Signer ma lettre » : un geste ; puis la direction contresigne.
    const signe = await signerMaLettre(pilote, f.id, lettre!.id);
    expect(signe, JSON.stringify(signe)).toMatchObject({ ok: true });
    gestes.push("Signer ma lettre");
    const contre = await contresignerLettre(pilote, monde, lettre!.id);
    expect(contre, JSON.stringify(contre)).toMatchObject({ ok: true, statutSignature: "signee" });

    // Deux gestes du formateur pour une mission (budget : 3).
    expect(gestes).toEqual(["J'accepte", "Signer ma lettre"]);

    // Chaque e-mail de la mission, rendu comme le worker l'enverra.
    const attendus = [
      "formateur-mission-proposee",
      "formateur-accord-enregistre",
      "formateur-lettre-a-signer",
      "formateur-lettre-copie-signature",
      "piece-exemplaire-signe",
    ];
    for (const g of attendus) {
      await expect
        .poll(async () => (await envoisVers(f.email, g)).length, ATTENTE_FILE)
        .toBeGreaterThan(0);
    }
    const defauts: string[] = [];
    const lus: Array<{ gabarit: string; sujet: string; mots: number }> = [];
    for (const e of await envoisVers(f.email)) {
      if (!e.jobId) continue;
      const rendu = await envoiRendu(pilote, e.jobId);
      defauts.push(...defautsDuRendu(rendu));
      lus.push({
        gabarit: e.template,
        sujet: rendu.sujet,
        mots: mots(rendu.texte.replace(/<[^>]+>/g, " ")),
      });
    }
    console.warn(`[V2-N03] e-mails de la mission :\n${JSON.stringify(lus, null, 2)}`);
    await test.info().attach("releve-mission.json", {
      body: JSON.stringify({ gestes, emails: lus }, null, 2),
      contentType: "application/json",
    });
    expect(defauts, defauts.join("\n")).toEqual([]);
  });

  test("feuilles de présence → facture à son nom → virement : ce que « Mes honoraires » affiche", async () => {
    test.setTimeout(1_200_000);
    // Deux journées animées, chaque demi-journée contresignée par le formateur (4 gestes),
    // le passage écrit le relevé, la direction valide : l'autofacture F36 part.
    const emise = await factureDeMissionEmise({
      prenom: "Yanis",
      jours: ["2037-11-09", "2037-11-10"],
    });
    try {
      type Releve = {
        id: string;
        numeroFacture: string | null;
        echeance: Date | string | null;
        payeAt: Date | string | null;
        deMission: boolean;
        totalTtcCents: number;
      };
      const lire = () =>
        sc.pilote.appeler<Releve[]>(
          "@/server/qualiopi/remuneration/queries",
          "listRelevesDuFormateur",
          [emise.formateur.id],
        );
      const [avant] = await lire();
      expect(avant, "la facture apparaît dans « Mes honoraires »").toBeDefined();
      expect(avant!.deMission).toBe(true);
      expect(avant!.numeroFacture).toBe(emise.numero);
      expect(avant!.totalTtcCents).toBe(emise.totalTtcCents);
      // « Règlement prévu au plus tard le … » : l'échéance est affichée, pas « en préparation ».
      expect(avant!.echeance).not.toBeNull();
      expect(avant!.payeAt).toBeNull();

      // F36 : la facture établie en son nom, lisible, liens vivants.
      const f36 = await jobF36(emise.statementId);
      expect(f36, "F36 demandé à la file").not.toBeNull();
      const rendu = await jouerUne<{ sujet: string; texte: string }>({
        etape: "apercu",
        gabarit: f36!.template,
        destinataire: emise.formateur.email,
        payload: f36!.payload,
      });
      expect(defautsDuRendu(rendu), rendu.sujet).toEqual([]);
      expect(rendu.texte).toContain(emise.numero);

      // « Virements faits » : le formateur lit « Payé le … ».
      await marquerPaye(emise.statementId, new Date(), {
        ibanFin4: "0189",
        ibanEmpreinte: emise.empreinte,
      });
      const [apres] = await lire();
      expect(apres!.payeAt, "« Payé le … » s'affiche").not.toBeNull();
      expect(BASCULE_2037).toMatch(/^2037-/);
    } finally {
      await viderPuitsPour(emise.formateur.email);
    }
  });

  // V2-N-5 (MAJEUR) — le lien de connexion à l'espace est À USAGE UNIQUE et se consomme
  // par une simple ouverture (GET) : `consumeFormateurMagicLink` marque `usedAt` dès le
  // premier accès (`magic-link.ts`, route `connexion/[token]`). Les messageries qui
  // ouvrent les liens pour les vérifier (filtres anti-hameçonnage d'entreprise) le
  // consomment avant la personne : elle lit « Ce lien de connexion est invalide ou a
  // expiré », redemande un lien, et le même sort l'attend. Mesuré ici : la deuxième
  // ouverture du même lien, une seconde après la première, est refusée.
  test.fixme("V2-N-5 — un lien de connexion ouvert une première fois (par la messagerie) s'ouvre encore pour la personne", async () => {
    const f = await creerFormateurPret(sc.monde, { prenom: "Oscar" });
    const jeton = await sc.pilote.appeler<string>(
      "@/server/formateur/magic-link",
      "createFormateurMagicLink",
      [f.id],
    );
    const premier = await sc.pilote.appeler<string | null>(
      "@/server/formateur/magic-link",
      "consumeFormateurMagicLink",
      [jeton],
    );
    expect(premier).toBe(f.id);
    const second = await sc.pilote.appeler<string | null>(
      "@/server/formateur/magic-link",
      "consumeFormateurMagicLink",
      [jeton],
    );
    expect(second).toBe(f.id);
  });

  // V2-N-18 (mineur) — « Mes honoraires » titre chaque facture par son MOIS (« novembre
  // 2037 ») : deux missions du même mois donnent deux lignes « novembre 2037 » que rien
  // ne distingue. `listRelevesDuFormateur` ne lit ni la session ni la mission
  // (`remuneration/queries.ts` ~l. 511-535) ; `remuneration/page.tsx` affiche le mois.
  test.fixme("V2-N-18 — une facture de mission dit de quelle mission il s'agit", async () => {
    const emise = await factureDeMissionEmise({
      prenom: "Zoé",
      jours: ["2037-12-07", "2037-12-08"],
    });
    const [r] = await sc.pilote.appeler<Array<Record<string, unknown>>>(
      "@/server/qualiopi/remuneration/queries",
      "listRelevesDuFormateur",
      [emise.formateur.id],
    );
    expect(Object.keys(r ?? {})).toEqual(expect.arrayContaining(["intitule"]));
  });
});
