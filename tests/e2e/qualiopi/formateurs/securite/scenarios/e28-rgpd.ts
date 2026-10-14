// E28 — Export art. 15 et effacement art. 17 d'un formateur indépendant dont
// l'adresse est AUSSI celle d'un apporteur d'affaires.
//
// Trois fiches : sans lien contractuel (pseudonymisée), avec un relevé payé
// (identité de facturation gardée), avec un virement de mission DÛ. L'effacement
// passe par l'ACTION de la console (super-administrateur, mot « EFFACER »).

import { effacerFormateurIndependantAction } from "@/server/actions/qualiopi/rgpd-formateur-independant";
import { exporterFormateurIndependantPour } from "@/lib/rgpd-formateur-independant";
import { exporterReseauApporteurPour } from "@/lib/rgpd-reseau-apporteur";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { encryptPii } from "@/lib/pii-crypto";
import { aUnVirementMissionDu } from "@/server/qualiopi/formateurs-independants/paiement/virements-a-faire-lecture";

import {
  aNettoyer,
  allumerParLaConsole,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  menage,
  prisma,
  seConnecter,
} from "../donnees";

async function fiche(id: string) {
  return prisma.trainer.findUniqueOrThrow({
    where: { id },
    select: {
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      adresseProfessionnelle: true,
      accesVersion: true,
      documents: { select: { type: true, archiveAt: true } },
    },
  });
}

export default async function e28(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const admin = await creerAdmin("admin");
      await allumerParLaConsole(direction, ["textes_valides", "dossier_en_ligne"]);

      // ── Fiche 1 : sans lien, adresse partagée avec un apporteur ─────────
      const f1 = await creerIndependant({
        sousTraitantNda: "84691234569",
        siret: "98765432400019",
      });
      await prisma.trainerDocument.createMany({
        data: [
          { trainerId: f1.id, type: "cv" },
          { trainerId: f1.id, type: "kbis_avis_sirene", dateEmission: new Date() },
        ] as never,
      });
      const apporteur = await prisma.apporteurReseau.create({
        data: {
          prenom: encryptPii("Apporteur") ?? "",
          nom: encryptPii("Banc-Sécu") ?? "",
          email: encryptPii(f1.email) ?? "",
          emailHash: hashEmailForLookup(f1.email) ?? "",
          telephone: encryptPii("0600000017"),
        },
        select: {
          id: true,
          nom: true,
          email: true,
          telephone: true,
          statut: true,
          emailHash: true,
        },
      });
      aNettoyer(() => prisma.apporteurReseau.delete({ where: { id: apporteur.id } }));

      const export1 = await exporterFormateurIndependantPour(f1.email);
      const exportApporteurAvant = await exporterReseauApporteurPour(f1.email);

      // Un administrateur (non super-admin) ne peut pas effacer.
      seConnecter(admin);
      let refusAdmin: string;
      try {
        refusAdmin = JSON.stringify(
          await effacerFormateurIndependantAction({ trainerId: f1.id, confirmation: "EFFACER" }),
        );
      } catch (e) {
        refusAdmin = e instanceof Error ? e.message : String(e);
      }
      const apresRefus = await fiche(f1.id);

      seConnecter(direction);
      const sansMot = await effacerFormateurIndependantAction({
        trainerId: f1.id,
        confirmation: "effacer" as never,
      });
      const eff1 = await effacerFormateurIndependantAction({
        trainerId: f1.id,
        confirmation: "EFFACER",
      });
      const apres1 = await fiche(f1.id);
      const apporteurApres = await prisma.apporteurReseau.findUniqueOrThrow({
        where: { id: apporteur.id },
        select: { nom: true, email: true, telephone: true, statut: true, emailHash: true },
      });
      const export1Apres = await exporterFormateurIndependantPour(f1.email);
      const exportApporteurApres = await exporterReseauApporteurPour(f1.email);
      const journal1 = await prisma.activityLog.findMany({
        where: { targetId: f1.id, action: "qualiopi.trainer.rgpd_effacement" },
        select: { changes: true },
      });

      // ── Fiche 2 : relevé payé (lien contractuel) ────────────────────────
      const f2 = await creerIndependant({ siret: "98765432400019" });
      await prisma.trainerStatement.create({
        data: {
          trainerId: f2.id,
          periodeYear: 2026,
          periodeMonth: 8,
          tvaRegime: "franchise_293b",
          statut: "paye",
          payeAt: new Date(),
        } as never,
      });
      await prisma.trainerDocument.createMany({
        data: [
          { trainerId: f2.id, type: "contrat_sous_traitance" },
          { trainerId: f2.id, type: "autre" },
        ] as never,
      });
      const eff2 = await effacerFormateurIndependantAction({
        trainerId: f2.id,
        confirmation: "EFFACER",
      });
      const apres2 = await fiche(f2.id);

      // ── Fiche 3 : virement de mission DÛ ────────────────────────────────
      const f3 = await creerIndependant({ siret: "98765432400019" });
      await prisma.trainerStatement.create({
        data: {
          trainerId: f3.id,
          periodeYear: 2026,
          periodeMonth: 9,
          tvaRegime: "franchise_293b",
          statut: "facture_recue",
          origine: "passage_mission",
          totalHtCents: 70_000,
        } as never,
      });
      const virementDu = await aUnVirementMissionDu(f3.id);
      const eff3 = await effacerFormateurIndependantAction({
        trainerId: f3.id,
        confirmation: "EFFACER",
      });
      const apres3 = await fiche(f3.id);
      const virementToujoursDu = await aUnVirementMissionDu(f3.id);

      return {
        identites: { f1, f2, f3 },
        export1: export1 && {
          email: export1.identite.email,
          telephone: export1.identite.telephone,
          iban: export1.iban,
          pieces: export1.pieces.map((p) => p.type).sort(),
        },
        exportApporteurAvant: exportApporteurAvant.apporteur !== null,
        refusAdmin,
        apresRefus,
        sansMot,
        eff1,
        apres1,
        apporteurAvant: apporteur,
        apporteurApres,
        export1Apres,
        exportApporteurApres: exportApporteurApres.apporteur !== null,
        journal1: journal1.map((j) => j.changes),
        eff2,
        apres2,
        virementDu,
        eff3,
        apres3,
        virementToujoursDu,
      };
    });
  } finally {
    await menage();
  }
}
