// E27 — Fin de collaboration (F47) : ce que la décision ferme, révoque, garde.
//
// Le geste est l'ACTION de la console (`terminerCollaborationFormateurAction`),
// sous une session administrateur, interrupteur `fin_collaboration` allumé par
// la console. Deux formateurs fictifs : l'un pour une fin sans préavis (SIRET
// cessé), l'autre pour un décès. On rend ce que le code a répondu et ce qui est
// en base ; le spec juge.

import { terminerCollaborationFormateurAction } from "@/server/actions/qualiopi/formateur-fin-collaboration";
import { changerActivationFormateur } from "@/server/qualiopi/formateurs-independants/activation";
import { envoyer } from "@/server/qualiopi/formateurs-independants/envois";
import { evaluerAffectation } from "@/server/qualiopi/formateurs-independants/evaluer-affectation";

import {
  allumerParLaConsole,
  attendre,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  creerPieceASigner,
  creerSessionFormation,
  jourDeParis,
  menage,
  prisma,
  seConnecter,
  validerTextesParLaConsole,
  valeursDuBanc,
} from "../donnees";

async function photo(trainerId: string) {
  const docs = await prisma.documentGenere.findMany({
    where: { trainerId },
    select: { id: true, type: true, statutSignature: true, annuleeAt: true },
  });
  const jetons = await prisma.documentSignatureToken.findMany({
    where: { documentGenereId: { in: docs.map((d) => d.id) } },
    select: { documentGenereId: true, revokedAt: true },
  });
  const missions = await prisma.missionFormateur.findMany({
    where: { trainerId },
    select: { statut: true },
  });
  const t = await prisma.trainer.findUniqueOrThrow({
    where: { id: trainerId },
    select: {
      actif: true,
      finCollaborationAt: true,
      finCollaborationMotif: true,
      accesVersion: true,
    },
  });
  return { docs, jetons, missions, trainer: t };
}

export default async function e27(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const admin = await creerAdmin("admin");
      await allumerParLaConsole(direction, ["textes_valides", "fin_collaboration"]);
      await validerTextesParLaConsole(direction, [
        { gabarit: "formateur-fin-collaboration" },
        { gabarit: "formateur-virement-fait" },
        { gabarit: "formateur-dossier-relance" },
      ]);

      const maintenant = new Date();
      const session = await creerSessionFormation(new Date(maintenant.getTime() + 20 * 86_400_000));

      // ── Fin sans préavis (SIRET cessé) ──────────────────────────────────
      const a = await creerIndependant({
        actif: true,
        sousTraitantVerifieAt: new Date(maintenant.getTime() - 86_400_000),
        sousTraitantNda: "84691234569",
      });
      await prisma.missionFormateur.create({
        data: { sessionId: session.id, trainerId: a.id, statut: "en_attente" } as never,
      });
      await creerPieceASigner(a.id, "contrat_sous_traitance", "signee");
      await creerPieceASigner(a.id, "contrat_sous_traitance", "en_attente");
      await creerPieceASigner(a.id, "lettre_mission", "en_attente", session.id);
      const avantA = await photo(a.id);
      const nbJournalAvant = await prisma.activityLog.count({ where: { targetId: a.id } });

      seConnecter(admin);
      const fin = await terminerCollaborationFormateurAction({
        trainerId: a.id,
        motif: "siret_cesse",
        dateEffet: jourDeParis(maintenant),
        note: "",
        irreparable: false,
        envoyerEmail: true,
      } as never);
      const apresA = await photo(a.id);

      // F47 : une ligne au journal des envois, prise par le worker.
      const f47 = await attendre(
        () =>
          prisma.emailLog.findMany({
            where: { recipient: a.email, template: "formateur-fin-collaboration" },
            select: { status: true },
          }),
        (l) => l.some((x) => x.status === "sent"),
      );

      // Les relevés (e-mails d'argent) partent encore ; une relance, non.
      const virement = await envoyer({
        gabarit: "formateur-virement-fait",
        destinataire: a.email,
        payload: { prenom: a.prenom, valeurs: await valeursDuBanc("formateur-virement-fait") },
        entityType: "Trainer",
        entityId: a.id,
        jobId: `banc-secu-virement-${a.id}`,
      });
      const relance = await envoyer({
        gabarit: "formateur-dossier-relance",
        destinataire: a.email,
        payload: { prenom: a.prenom, valeurs: await valeursDuBanc("formateur-dossier-relance") },
        entityType: "Trainer",
        entityId: a.id,
      });

      // Plus affectable…
      const affectation = await evaluerAffectation(a.id, session, new Date());
      // … ni réactivable, même par la direction.
      const reactivation = await changerActivationFormateur({
        trainerId: a.id,
        actif: true,
        acteur: {
          type: "administrateur",
          session: { userId: direction.id, role: "super_admin" },
        } as never,
        motif: "Banc : tentative de réactivation après la fin",
      });
      // Et la console refuse une seconde fin.
      const secondeFin = await terminerCollaborationFormateurAction({
        trainerId: a.id,
        motif: "siret_cesse",
        dateEffet: jourDeParis(maintenant),
        envoyerEmail: true,
      } as never);
      const nbJournalApres = await prisma.activityLog.count({ where: { targetId: a.id } });

      // ── Décès ───────────────────────────────────────────────────────────
      const b = await creerIndependant({ actif: true, sousTraitantVerifieAt: new Date() });
      await creerPieceASigner(b.id, "lettre_mission", "en_attente", session.id);
      const finB = await terminerCollaborationFormateurAction({
        trainerId: b.id,
        motif: "deces",
        dateEffet: jourDeParis(maintenant),
        envoyerEmail: true,
      } as never);
      // On laisse au worker le temps qu'il aurait pour un envoi, puis on lit.
      await new Promise((r) => setTimeout(r, 4_000));
      const envoisB = await prisma.emailLog.findMany({
        where: { recipient: b.email },
        select: { template: true },
      });
      const apresB = await photo(b.id);
      // Observation (pas un contrôle du plan) : un e-mail d'argent vers le défunt.
      const argentApresDeces = await envoyer({
        gabarit: "formateur-virement-fait",
        destinataire: b.email,
        payload: { prenom: b.prenom, valeurs: await valeursDuBanc("formateur-virement-fait") },
        entityType: "Trainer",
        entityId: b.id,
        jobId: `banc-secu-virement-deces-${b.id}`,
      });
      // Un PDF de notification a-t-il été produit, d'un type ou d'un autre ?
      const piecesApresFin = await prisma.documentGenere.count({
        where: { trainerId: { in: [a.id, b.id] }, createdAt: { gte: maintenant } },
      });
      const piecesDeLaSaisie = 4; // 3 pour A, 1 pour B, créées par le banc

      // Le worker a fini avec ces adresses avant qu'on efface leurs traces.
      await attendre(
        () =>
          prisma.emailLog.count({
            where: { recipient: { in: [a.email, b.email] }, status: "pending" },
          }),
        (n) => n === 0,
      );
      await prisma.emailLog.deleteMany({ where: { recipient: { in: [a.email, b.email] } } });
      return {
        fin,
        avantA,
        apresA,
        f47: f47.map((l) => l.status),
        virement,
        relance,
        affectation: affectation.refus.map((r) => r.texte),
        reactivation,
        secondeFin,
        journal: { avant: nbJournalAvant, apres: nbJournalApres },
        finB,
        envoisB: envoisB.map((e) => e.template),
        apresB,
        argentApresDeces,
        pdfDeNotification: piecesApresFin - piecesDeLaSaisie,
        adresses: [a.email, b.email],
      };
    });
  } finally {
    await menage();
  }
}
