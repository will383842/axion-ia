// @formateurs E24 — CHANGEMENT D'IBAN :
//   · F43 à l'adresse connue (et à l'ancienne, si l'adresse a changé) ;
//   · 48 h d'attente, puis validation — refusée si l'ancienne adresse n'a pas été avisée ;
//   · les anciens liens meurent ;
//   · pendant l'attente, les virements continuent sur l'ANCIEN compte (texte de F43,
//     libellé de l'interrupteur, décision 72).
//
// DÉFAUT V1-C-1 (test.fixme) : pendant l'attente, le virement est BLOQUÉ, pas fait sur
// l'ancien compte. `gardeVirementMission` ajoute `compte_bancaire_a_valider` dès qu'une
// demande est en attente (paiement/virement-mission.ts ~l. 121, re-vérifié sous verrou
// dans trainer-remuneration.ts ~l. 487) — à l'inverse de F43 (« vos virements continuent
// sur l'ancien compte »), de `nouvelIbanUtilisableDes` (argent/calcul-mission.ts ~l. 367 :
// « avant l'accord, l'ancien compte reste utilisable ») et du libellé de l'interrupteur.
// Montant en jeu : toute facture due pendant 48 h au moins, retardée (et le retard,
// pénalités comprises, court contre l'organisme).
//
// DÉFAUT V1-C-6 (test.fixme) : F43 ne part qu'à l'adresse ACTUELLE de la fiche
// (changements-coordonnees.ts ~l. 160) ; l'adresse précédente n'est conservée nulle part :
// après un changement d'adresse, l'ancienne n'est pas avisée d'un changement de compte.
//
// DÉFAUT V1-C-7 (test.fixme) : un changement d'IBAN ne fait tomber AUCUN lien (ni liens
// de connexion, ni `accesVersion`) ; seul le changement d'adresse le fait
// (changement-email-console.ts ~l. 104-123).
//
// ÉCART : les 48 h se comptent depuis `createdAt` posé par la BASE (horloge réelle), pas
// depuis l'instant passé en paramètre : le banc pilote donc ces instants à partir de
// l'heure réelle de la demande.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC, attendreEnvois, dernierEnvoiRendu } from "../fixtures/formateurs/argent-commun";
import { jouer, jouerUne } from "../fixtures/formateurs/argent-execution";
import { IBAN_A, IBAN_B, factureDeMissionEmise } from "../fixtures/formateurs/argent-parcours";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

/** L'administrateur semé par `pnpm db:seed` : le journal de la décision le référence. */
async function administrateur(): Promise<string> {
  return (await prisma.adminUser.findFirstOrThrow({ select: { id: true } })).id;
}
const H = 3_600_000;
/** Le canal de changement de compte allumé, et les textes F43 / F44 validés. */
const IBAN_OUVERT = {
  allumer: { "formateurs.changement_coordonnees": { actif: true } },
  textes: ["formateur-iban-changement", "formateur-iban-valide"],
} as const;

interface Garde {
  verdict: { autorise: boolean; motifs: string[] };
  ibanFin4: string | null;
}

async function demandeEnCours(trainerId: string) {
  return prisma.demandeChangementFormateur.findFirstOrThrow({
    where: { trainerId, nature: "iban" },
    orderBy: { createdAt: "desc" },
    select: { id: true, statut: true, createdAt: true, ancienneAdresseAviseeAt: true },
  });
}

test.describe("@formateurs E24 — changement d'IBAN", () => {
  test.setTimeout(2_400_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("F43 sans l'IBAN, 48 h, validation ; refusée si l'ancienne adresse n'a pas été avisée", async () => {
    await avecVerrouArgent(async () => {
      const f = await factureDeMissionEmise({
        prenom: "Agathe",
        jours: ["2038-08-09", "2038-08-10"],
        emettre: false,
      });
      const t0 = new Date();
      const demande = await jouerUne<{ ok: boolean }>({
        etape: "demander-iban",
        ...IBAN_OUVERT,
        trainerId: f.formateur.id,
        iban: IBAN_B,
        maintenant: t0.toISOString(),
      });
      expect(demande).toEqual({ ok: true });
      const d = await demandeEnCours(f.formateur.id);
      expect(d.statut).toBe("en_attente");
      expect(d.ancienneAdresseAviseeAt?.toISOString()).toBe(t0.toISOString());

      // F43 : ni les valeurs du job ni le texte rendu ne portent l'IBAN, même en partie.
      await attendreEnvois(f.formateur.email, "formateur-iban-changement", 1);
      const f43 = await dernierEnvoiRendu(f.formateur.email, "formateur-iban-changement");
      for (const iban of [IBAN_A, IBAN_B]) {
        expect(JSON.stringify(f43.job.payload)).not.toContain(iban.slice(-4));
        expect(f43.texte).not.toContain(iban.slice(-4));
        expect(f43.texte.replace(/\s/g, "")).not.toContain(iban);
      }
      expect(f43.texte).toMatch(/continuent sur l.ancien compte/);

      // 48 h depuis la demande (horloge de la base) : à 47 h, trop tôt ; à 48 h 01, accepté.
      const base = d.createdAt.getTime();
      const [tot, accepte] = await jouer([
        {
          etape: "valider-demande",
          ...IBAN_OUVERT,
          demandeId: d.id,
          adminId: await administrateur(),
          maintenant: new Date(base + 47 * H).toISOString(),
        },
        {
          etape: "valider-demande",
          ...IBAN_OUVERT,
          demandeId: d.id,
          adminId: await administrateur(),
          maintenant: new Date(base + 48 * H + 60_000).toISOString(),
        },
      ]);
      expect(tot).toEqual({ ok: false, raison: "trop_tot" });
      expect(accepte).toEqual({ ok: true });
      // Le nouveau compte est celui de la fiche ; F44 le confirme.
      const apres = await jouerUne<Garde>({
        etape: "garde-virement",
        statementId: f.statementId,
        empreinteAffichee: (
          await prisma.trainer.findUniqueOrThrow({
            where: { id: f.formateur.id },
            select: { ibanEmpreinte: true },
          })
        ).ibanEmpreinte,
        maintenant: new Date(base + 49 * H).toISOString(),
      });
      expect(apres.ibanFin4).toBe(IBAN_B.slice(-4));
      await attendreEnvois(f.formateur.email, "formateur-iban-valide", 1);

      // Un second formateur : le texte F43 n'est PAS validé — l'avis ne part pas, et la
      // validation est refusée, même après 48 h.
      const g = await factureDeMissionEmise({
        prenom: "Bertrand",
        jours: ["2038-08-16", "2038-08-17"],
        emettre: false,
      });
      // Le temps de cette seule demande, le texte F43 est « non validé » (puis remis).
      await jouer([
        {
          etape: "demander-iban",
          ...IBAN_OUVERT,
          poser: { "textes_valides.formateur-iban-changement": { valide: false } },
          trainerId: g.formateur.id,
          iban: IBAN_B,
          maintenant: new Date().toISOString(),
        },
      ]);
      const dg = await demandeEnCours(g.formateur.id);
      expect(dg.ancienneAdresseAviseeAt).toBeNull();
      const refus = await jouerUne<unknown>({
        etape: "valider-demande",
        ...IBAN_OUVERT,
        demandeId: dg.id,
        adminId: await administrateur(),
        maintenant: new Date(dg.createdAt.getTime() + 49 * H).toISOString(),
      });
      expect(refus).toEqual({ ok: false, raison: "non_avisee" });
    });
  });

  // DÉFAUT V1-C-1 — pendant l'attente, le virement est bloqué au lieu de partir sur l'ancien compte.
  test.fixme("V1-C-1 : pendant les 48 h, le virement part sur l'ANCIEN compte", async () => {
    await avecVerrouArgent(async () => {
      const f = await factureDeMissionEmise({
        prenom: "Capucine",
        jours: ["2038-08-23", "2038-08-24"],
        emettre: false,
      });
      await jouer([
        {
          etape: "demander-iban",
          ...IBAN_OUVERT,
          trainerId: f.formateur.id,
          iban: IBAN_B,
          maintenant: new Date().toISOString(),
        },
      ]);
      const pendant = await jouerUne<Garde>({
        etape: "garde-virement",
        statementId: f.statementId,
        empreinteAffichee: f.empreinte,
        maintenant: new Date(Date.now() + H).toISOString(),
      });
      expect(pendant.verdict).toMatchObject({ autorise: true, motifs: [] });
      expect(pendant.ibanFin4).toBe(IBAN_A.slice(-4));
    });
  });

  // DÉFAUT V1-C-6 — l'ancienne adresse n'est pas avisée du changement de compte.
  test.fixme("V1-C-6 : après un changement d'adresse, F43 part aux DEUX adresses", async () => {
    await avecVerrouArgent(async () => {
      const f = await factureDeMissionEmise({
        prenom: "Damien",
        jours: ["2038-08-30", "2038-08-31"],
        emettre: false,
      });
      const ancienne = f.formateur.email;
      const nouvelle = ancienne.replace("@", ".nouvelle@");
      await prisma.trainer.update({ where: { id: f.formateur.id }, data: { email: nouvelle } });
      await jouer([
        {
          etape: "demander-iban",
          ...IBAN_OUVERT,
          trainerId: f.formateur.id,
          iban: IBAN_B,
          maintenant: new Date().toISOString(),
        },
      ]);
      await attendreEnvois(nouvelle, "formateur-iban-changement", 1);
      await attendreEnvois(ancienne, "formateur-iban-changement", 1);
    });
  });

  // DÉFAUT V1-C-7 — les anciens liens restent valables après le changement de compte.
  test.fixme("V1-C-7 : la validation du nouvel IBAN fait tomber les anciens liens", async () => {
    await avecVerrouArgent(async () => {
      const f = await factureDeMissionEmise({
        prenom: "Edgar",
        jours: ["2038-09-06", "2038-09-07"],
        emettre: false,
      });
      const lien = await prisma.formateurMagicLink.create({
        data: {
          trainerId: f.formateur.id,
          tokenHash: `banc${f.formateur.id.replace(/-/g, "")}`.slice(0, 64),
          expiresAt: new Date(Date.now() + 7 * 24 * H),
        },
        select: { id: true },
      });
      const avant = await prisma.trainer.findUniqueOrThrow({
        where: { id: f.formateur.id },
        select: { accesVersion: true },
      });
      await jouer([
        {
          etape: "demander-iban",
          ...IBAN_OUVERT,
          trainerId: f.formateur.id,
          iban: IBAN_B,
          maintenant: new Date().toISOString(),
        },
      ]);
      const d = await demandeEnCours(f.formateur.id);
      const [validee] = await jouer([
        {
          etape: "valider-demande",
          ...IBAN_OUVERT,
          demandeId: d.id,
          adminId: await administrateur(),
          maintenant: new Date(d.createdAt.getTime() + 49 * H).toISOString(),
        },
      ]);
      expect(validee).toEqual({ ok: true });
      const relu = await prisma.formateurMagicLink.findUniqueOrThrow({
        where: { id: lien.id },
        select: { usedAt: true },
      });
      const apres = await prisma.trainer.findUniqueOrThrow({
        where: { id: f.formateur.id },
        select: { accesVersion: true },
      });
      expect(relu.usedAt !== null || apres.accesVersion > avant.accesVersion).toBe(true);
    });
  });
});
