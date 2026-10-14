// @formateurs E22 — « Virements à faire » (vue COMMUNE avec les apporteurs) :
//   · orange à J-5 de la date cible, rouge à l'échéance ;
//   · « Virements faits (N) » → F37 ; pénalité si retard ; empreinte d'IBAN RELUE au clic ;
//   · lot interrompu → F37 repris UNE fois ;
//   · un désaccord du formateur bloque le paiement (décision du dirigeant).
//
// DÉFAUT V1-C-9 (test.fixme) : le jour même de la date cible, la ligne est ORANGE ; elle
// ne devient rouge que le LENDEMAIN (`couleurDe`, paiements-sortants/virements.ts ~l. 63 :
// rouge si `reste < 0`). Rien n'est perdu (le virement reste dans les délais ce jour-là),
// mais l'écran ne dit pas « dernier jour ».
//
// ÉCARTS :
//   · « Virements faits » n'a pas de service hors session : le banc lit la garde du
//     dépôt AU CLIC (`contexteVirementMission`, empreinte affichée comprise), écrit
//     l'effet du clic (statut `paye`, preuve du compte), puis appelle le service F37 réel ;
//   · pénalité de retard : la garde CALCULE les jours de retard et l'indemnité de 40 €,
//     mais le taux BCE n'est pas renseigné (`tauxBceBp: null`, décision 87 ouverte) :
//     les pénalités sont « à calculer à la main » ; F37 ne mentionne aucune pénalité, et
//     rien n'est écrit en comptabilité ;
//   · la date de l'autofacture suit l'horloge réelle (voir E20) : les dates de la vue sont
//     contre-calculées depuis l'échéance écrite.

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
import {
  aParis,
  dernierJourOuvreAuPlusTard,
  ecartJours,
  jourDeParis,
  plusJours,
} from "../fixtures/formateurs/argent-contre-calcul";
import { jouer, jouerUne } from "../fixtures/formateurs/argent-execution";
import {
  IBAN_A,
  IBAN_B,
  factureDeMissionEmise,
  marquerPaye,
  poserIban,
} from "../fixtures/formateurs/argent-parcours";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { semerInterrupteurs } from "../fixtures/formateurs/interrupteurs";

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
  ibanFin4: string | null;
}
interface LigneVue {
  pieceId: string;
  flux: string;
  couleur: string;
  dateCible: string | null;
  echeance: string | null;
  montantCents: number;
}

const couleurLe = async (jour: string, id: string) =>
  (
    await jouerUne<LigneVue[]>({
      etape: "virements",
      maintenant: aParis(jour, "10:00").toISOString(),
      ids: [id],
    })
  )[0];

test.describe("@formateurs E22 — virements à faire", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("orange à J-5 de la date cible, rouge après ; le dû ; un désaccord bloque le paiement", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides([], {
        ...bascule(BASCULE_2037),
        "formateurs.bilan_fin_formation": { actif: false },
      });
      try {
        const f = await factureDeMissionEmise({
          prenom: "Victor",
          jours: ["2038-05-10", "2038-05-11"],
        });
        const echeance = jourDeParis(f.echeanceAt);
        // Contre-calcul : la date cible est le dernier jour ouvré au plus tard à l'échéance.
        const cible = dernierJourOuvreAuPlusTard(echeance);
        const vues = await jouer(
          [-6, -5, -1, 1].map((n) => ({
            etape: "virements" as const,
            maintenant: aParis(plusJours(cible, n), "10:00").toISOString(),
            ids: [f.statementId],
          })),
        );
        const lignes = (vues as LigneVue[][]).map((v) => v[0]!);
        expect(lignes.map((l) => l.couleur)).toEqual(["a_venir", "orange", "orange", "rouge"]);
        for (const l of lignes) {
          expect(l).toMatchObject({
            flux: "formateur",
            echeance,
            dateCible: cible,
            montantCents: f.totalTtcCents,
          });
        }
        expect(f.totalTtcCents).toBe(70_000);

        // Un désaccord du formateur bloque le paiement. Signalé dans les huit jours de la
        // transmission (horloge réelle : la fenêtre part de l'émission).
        const signale = await jouerUne<string>({
          etape: "signaler-desaccord",
          trainerId: f.formateur.id,
          statementId: f.statementId,
          texte: "La seconde journée a fini à midi, pas à 17 h.",
          maintenant: new Date().toISOString(),
        });
        expect(signale).toBe("enregistre");
        // Contesté : hors de « Virements à faire », jusqu'à ce qu'un humain tranche.
        expect(await couleurLe(plusJours(cible, -6), f.statementId)).toBeUndefined();
      } finally {
        await restaurer();
      }
    });
  });

  // DÉFAUT V1-C-9 — le jour de la date cible, la ligne n'est pas rouge.
  test.fixme("V1-C-9 : rouge à l'échéance (le jour même de la date cible)", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerInterrupteurs({
        ...bascule(BASCULE_2037),
        "formateurs.bilan_fin_formation": { actif: false },
      });
      try {
        const f = await factureDeMissionEmise({
          prenom: "Wanda",
          jours: ["2038-05-17", "2038-05-18"],
        });
        const cible = dernierJourOuvreAuPlusTard(jourDeParis(f.echeanceAt));
        expect((await couleurLe(cible, f.statementId))?.couleur).toBe("rouge");
      } finally {
        await restaurer();
      }
    });
  });

  test("« Virements faits » : empreinte relue au clic, retard compté, F37 enfilé et rendu", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides(["formateur-virement-fait"], {
        ...bascule(BASCULE_2037),
        "formateurs.bilan_fin_formation": { actif: false },
      });
      let email = "";
      try {
        const f = await factureDeMissionEmise({
          prenom: "Xavier",
          jours: ["2038-05-24", "2038-05-25"],
        });
        email = f.formateur.email;
        const echeance = jourDeParis(f.echeanceAt);
        const aLHeure = aParis(dernierJourOuvreAuPlusTard(echeance), "10:00").toISOString();
        const enRetard = plusJours(echeance, 10);

        // À l'heure, empreinte affichée = empreinte en base : autorisé, aucun retard.
        const ok = await jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: f.empreinte,
          maintenant: aLHeure,
        });
        expect(ok.verdict).toMatchObject({ autorise: true, motifs: [] });
        expect(ok.verdict.retard.joursDeRetard).toBe(0);
        expect(ok.ibanFin4).toBe(IBAN_A.slice(-4));

        // Le compte change entre l'affichage et le clic : refus.
        const nouvelle = await poserIban(f.formateur.id, IBAN_B);
        const change = await jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: f.empreinte,
          maintenant: aLHeure,
        });
        expect(change.verdict.autorise).toBe(false);
        expect(change.verdict.motifs).toEqual(["iban_change_depuis_l_affichage"]);

        // Page rechargée, 10 jours après l'échéance : autorisé, retard compté.
        const tard = await jouerUne<Garde>({
          etape: "garde-virement",
          statementId: f.statementId,
          empreinteAffichee: nouvelle,
          maintenant: aParis(enRetard, "10:00").toISOString(),
        });
        expect(tard.verdict.autorise).toBe(true);
        expect(tard.verdict.retard).toEqual({
          joursDeRetard: ecartJours(echeance, enRetard),
          // Taux BCE non renseigné (décision 87) : à calculer à la main, jamais inventé.
          penalitesCents: null,
          indemniteRecouvrementCents: 4_000,
        });
        expect(tard.verdict.retard.joursDeRetard).toBe(10);
        expect(tard.ibanFin4).toBe(IBAN_B.slice(-4));

        // Le clic : relevé payé, preuve du compte lue au clic ; puis F37.
        await marquerPaye(f.statementId, new Date(), {
          ibanFin4: tard.ibanFin4!,
          ibanEmpreinte: nouvelle,
        });
        await jouer([{ etape: "virements-faits", ids: [f.statementId] }]);
        await attendreEnvois(email, "formateur-virement-fait", 1);
        const f37 = await dernierEnvoiRendu(email, "formateur-virement-fait");
        expect(f37.sujet).toContain(f.numero);
        expect(f37.texte).toContain("700,00");
        // ÉCART (décision 87 ouverte) : F37 ne dit rien du retard ni de l'indemnité.
        expect(f37.texte).not.toMatch(/p[ée]nalit|40,00/i);
        // Le payé sort de la vue.
        expect(await couleurLe(enRetard, f.statementId)).toBeUndefined();
      } finally {
        await restaurer();
      }
    });
  });

  test("lot interrompu : le F37 perdu est repris, une seule fois", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerTextesValides(["formateur-virement-fait"], {
        ...bascule(BASCULE_2037),
        "formateurs.bilan_fin_formation": { actif: false },
      });
      let email = "";
      try {
        const f = await factureDeMissionEmise({
          prenom: "Yanis",
          jours: ["2038-06-14", "2038-06-15"],
        });
        email = f.formateur.email;
        // Le lot s'est arrêté APRÈS l'écriture « payé », AVANT F37 (une heure plus tôt).
        const maintenant = new Date();
        await marquerPaye(f.statementId, new Date(maintenant.getTime() - 3_600_000), {
          ibanFin4: IBAN_A.slice(-4),
          ibanEmpreinte: f.empreinte,
        });
        const [repris, encore] = await jouer([
          { etape: "reprendre-f37", maintenant: maintenant.toISOString() },
          {
            etape: "reprendre-f37",
            maintenant: new Date(maintenant.getTime() + 60_000).toISOString(),
          },
        ]);
        expect(repris).toBe(1);
        expect(encore).toBe(0);
        await attendreEnvois(email, "formateur-virement-fait", 1);
        const trace = await prisma.activityLog.count({
          where: { action: "qualiopi.formateur.f37_traite", targetId: f.statementId },
        });
        expect(trace).toBe(1);
      } finally {
        await restaurer();
      }
    });
  });
});
