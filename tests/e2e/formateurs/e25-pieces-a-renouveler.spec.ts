// @formateurs E25 — PIÈCES À RENOUVELER (F40 attestation URSSAF, F41 autres pièces) :
//   · relance à J-30 puis à J-15 ; un dépôt arrête les relances ;
//   · deux campagnes dues le même jour pour la même personne → UN seul e-mail ce jour-là,
//     l'autre le lendemain.
//
// ÉCART noté (rapport V1-C) : le calendrier J-30 / J-15 est celui de F41 (CV, RC pro).
// F40 (attestation URSSAF) suit sa propre règle — J-15, J0, J+15 (`REGLE_VIGILANCE`,
// pieces-relances.ts ~l. 154) — et seulement au seuil de 5 000 € HT (décision du
// dirigeant : l'attestation n'est exigée qu'au seuil). Le scénario les éprouve donc chacun
// à son calendrier.
//
// Horloge : ce scénario est ancré sur le JOUR RÉEL. La limite « une relance par personne
// et par jour » relit la date des lignes du journal des envois, écrite à l'heure réelle par
// `enqueueEmail` : un jour piloté loin du jour réel ne l'éprouverait pas. L'instant passé
// aux passages est 10 h de Paris (dans la fenêtre d'envoi 8 h – 19 h), aujourd'hui puis
// les jours suivants ; aucune horloge du serveur n'est touchée.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC, semerTextesValides } from "../fixtures/formateurs/argent-commun";
import { aParis, jourDeParis, plusJours } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import { cle, semerFormateur, type FormateurSeme } from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

const textes = ["formateur-piece-a-renouveler", "formateur-vigilance"];
const interrupteurs = {
  "formateurs.dossier_en_ligne": { actif: true },
  "formateurs.pieces_cron": { actif: true },
};
const minuit = (jour: string) => new Date(`${jour}T00:00:00Z`);

/** Un indépendant DANS la population des relances : candidature freelance retenue, dossier vérifié. */
async function independantSuivi(prenom: string): Promise<FormateurSeme> {
  const k = cle();
  const candidature = await prisma.jobApplication.create({
    data: {
      offerTitleSnap: "Formateur IA freelance (banc)",
      firstName: prenom,
      lastName: `Banc-Argent-${k}`,
      email: `${prenom.toLowerCase()}.candidature.${k}@example.test`,
      phone: "+33600000000",
      consentVersion: "banc",
      natureCollaboration: "freelance",
    } as never,
    select: { id: true },
  });
  const f = await semerFormateur({ prenom, candidatureId: candidature.id });
  // Un CV récent, valable : il ne doit rien déclencher.
  await prisma.trainerDocument.create({
    data: {
      trainerId: f.id,
      type: "cv",
      statutValidation: "valide",
      fichierUrl: "banc://cv.pdf",
      dateEmission: minuit(plusJours(jourDeParis(new Date()), -1)),
      valideAt: new Date(),
    },
  });
  return f;
}

/** Une RC pro validée qui expire le `jour` (J). */
async function rcProExpirant(trainerId: string, jour: string): Promise<void> {
  await prisma.trainerDocument.create({
    data: {
      trainerId,
      type: "assurance_rc_pro",
      statutValidation: "valide",
      fichierUrl: "banc://rc-pro.pdf",
      dateEmission: minuit(plusJours(jour, -365)),
      dateExpiration: minuit(jour),
      valideAt: new Date(),
    },
  });
}

/**
 * Les relances de campagne (`fi-…`) parties pour ce formateur, dans l'ordre : une par
 * `jobId` (V1-C-11 : un même envoi peut laisser deux lignes au journal).
 */
async function relances(trainerId: string) {
  const lignes = await prisma.emailLog.findMany({
    where: { entityId: trainerId, jobId: { startsWith: "fi-" }, status: { not: "failed" } },
    orderBy: { createdAt: "asc" },
    select: { template: true, jobId: true },
  });
  return lignes.filter((l, i) => lignes.findIndex((x) => x.jobId === l.jobId) === i);
}

/**
 * Le jour réel ne doit pas changer PENDANT le scénario (la limite « une par jour » relit
 * des dates réelles) : à moins de cinq minutes de minuit à Paris, on attend minuit passé.
 */
async function loinDeMinuit(): Promise<void> {
  const h = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [hh, mm] = h.split(":").map(Number) as [number, number];
  const avantMinuit = (24 * 60 - (hh * 60 + mm)) % (24 * 60);
  if (avantMinuit > 0 && avantMinuit <= 5) {
    await new Promise((r) => setTimeout(r, (avantMinuit + 1) * 60_000));
  }
}

const passage = (jour: string, trainerIds: string[]) => ({
  etape: "campagnes" as const,
  maintenant: aParis(jour, "10:00").toISOString(),
  trainerIds,
  // V1-C-11 : la décision d'étape compte les lignes du journal ; on écarte la course.
  retenirLeWorker: true,
});

test.describe("@formateurs E25 — pièces à renouveler, une relance par jour", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("F41 à J-30 puis J-15 ; un dépôt arrête les relances", async () => {
    await avecVerrouArgent(async () => {
      await loinDeMinuit();
      const restaurer = await semerTextesValides(textes, interrupteurs);
      try {
        const aujourdhui = jourDeParis(new Date());
        const echeance = plusJours(aujourdhui, 30);
        const sansDepot = await independantSuivi("Josephine");
        const avecDepot = await independantSuivi("Kevin");
        for (const f of [sansDepot, avecDepot]) await rcProExpirant(f.id, echeance);
        const ids = [sansDepot.id, avecDepot.id];

        // J-30 : une relance chacun.
        await jouer([passage(aujourdhui, ids)]);
        for (const f of [sansDepot, avecDepot]) {
          expect((await relances(f.id)).map((r) => r.jobId?.endsWith("-j30"))).toEqual([true]);
        }
        // Kevin dépose sa nouvelle attestation d'assurance (en vérification).
        await prisma.trainerDocument.create({
          data: {
            trainerId: avecDepot.id,
            type: "assurance_rc_pro",
            statutValidation: "en_attente",
            fichierUrl: "banc://rc-pro-neuve.pdf",
            dateEmission: minuit(aujourdhui),
            dateExpiration: minuit(plusJours(aujourdhui, 365)),
          },
        });

        // Entre-deux (J-29) : rien. J-15 : Joséphine seulement. Le lendemain : rien de plus.
        await jouer([
          passage(plusJours(aujourdhui, 1), ids),
          passage(plusJours(aujourdhui, 15), ids),
          passage(plusJours(aujourdhui, 16), ids),
        ]);
        expect((await relances(sansDepot.id)).map((r) => r.jobId!.split("-").at(-1))).toEqual([
          "j30",
          "j15",
        ]);
        expect((await relances(avecDepot.id)).length).toBe(1);
        for (const r of await relances(sansDepot.id)) {
          expect(r.template).toBe("formateur-piece-a-renouveler");
        }
      } finally {
        await restaurer();
      }
    });
  });

  test("F40 et F41 dus le même jour : un seul e-mail ce jour-là, l'autre le lendemain", async () => {
    await avecVerrouArgent(async () => {
      await loinDeMinuit();
      const restaurer = await semerTextesValides(textes, interrupteurs);
      const f = await independantSuivi("Lucien");
      try {
        const aujourdhui = jourDeParis(new Date());
        // Au seuil : 5 200 € HT déjà payés.
        await prisma.trainerStatement.create({
          data: {
            trainerId: f.id,
            periodeYear: 2036,
            periodeMonth: 1,
            statut: "paye",
            origine: "releve_mensuel",
            tvaRegime: "franchise_293b",
            totalHtCents: 520_000,
            tvaCents: 0,
            totalTtcCents: 520_000,
            payeAt: new Date("2036-02-10T10:00:00Z"),
          } as never,
        });
        // F40 dû aujourd'hui (attestation échue dans 15 jours) ; F41 aussi (RC pro, J-30).
        const finUrssaf = plusJours(aujourdhui, 15);
        const [a, m, j] = finUrssaf.split("-").map(Number) as [number, number, number];
        await prisma.trainerDocument.create({
          data: {
            trainerId: f.id,
            type: "attestation_vigilance_urssaf",
            statutValidation: "valide",
            numeroPiece: "BANC-URSSAF",
            dateEmission: new Date(Date.UTC(a, m - 1 - 6, j)),
            dateExpiration: minuit(finUrssaf),
            valideAt: new Date(),
          },
        });
        await rcProExpirant(f.id, plusJours(aujourdhui, 30));

        await jouer([passage(aujourdhui, [f.id]), passage(aujourdhui, [f.id])]);
        const jour1 = await relances(f.id);
        expect(jour1.length).toBe(1);
        await jouer([passage(plusJours(aujourdhui, 1), [f.id])]);
        const jour2 = await relances(f.id);
        expect(jour2.length).toBe(2);
        expect(new Set(jour2.map((r) => r.template))).toEqual(
          new Set(["formateur-vigilance", "formateur-piece-a-renouveler"]),
        );
      } finally {
        await restaurer();
      }
    });
  });
});
