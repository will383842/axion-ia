// E-D2 — Changement d'e-mail d'un indépendant par la console : ce que deviennent
// les liens et sessions émis sous l'ancienne adresse, et l'avis à l'ancienne
// adresse.
//
// Les liens sont fabriqués par les fonctions du dépôt elles-mêmes (session de
// l'espace, lien de connexion, lien du dossier, lien de réponse à une mission),
// puis relus par leurs lecteurs réels AVANT (témoin : ils marchent) et APRÈS le
// changement. Le geste est `updateTrainerAction`, session super-administrateur.

import { signFormateurSession } from "@/lib/formateur-session";
import { signMagicToken } from "@/lib/magic-token";
import { updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import { getFormateurSession } from "@/server/formateur/guard";
import { consumeFormateurMagicLink, createFormateurMagicLink } from "@/server/formateur/magic-link";
import { FORMATEUR_COOKIE_NAME } from "@/server/formateur/routes";
import { lireDossierParLien } from "@/server/qualiopi/formateurs-independants/dossier";
import { jetonDossierFormateur } from "@/server/qualiopi/formateurs-independants/jeton-dossier";
import {
  empreinteSessionFormateur,
  versionSessionFormateur,
} from "@/server/qualiopi/formateurs-independants/version-session";
import {
  lireMissionParJeton,
  signerJetonMission,
} from "@/server/qualiopi/trainers/mission-formateur";

import {
  adresse,
  allumerParLaConsole,
  attendre,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  creerSessionFormation,
  menage,
  prisma,
  seConnecter,
  validerTextesParLaConsole,
} from "../donnees";
import { poserCookie } from "../../../../fixtures/formateurs/securite-serveur/faux-next-headers";

async function sessionAvec(jeton: string | null): Promise<boolean> {
  poserCookie(FORMATEUR_COOKIE_NAME, jeton);
  return (await getFormateurSession()) !== null;
}

export default async function ed2(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      await allumerParLaConsole(direction, ["textes_valides", "dossier_en_ligne"]);
      await validerTextesParLaConsole(direction, [{ gabarit: "formateur-email-modifie" }]);

      const maintenant = new Date();
      // Fiche A : dossier encore modifiable (lien du dossier vivant, version 0).
      const a = await creerIndependant({ actif: true, dossierStatut: "a_completer" } as never);
      // Fiche B : dossier envoyé (« à vérifier »), son lien courant est en lecture seule.
      const b = await creerIndependant({
        actif: true,
        dossierStatut: "a_verifier",
        accesVersion: 1,
      } as never);
      const formation = await creerSessionFormation(
        new Date(maintenant.getTime() + 30 * 86_400_000),
      );
      const mission = await prisma.missionFormateur.create({
        data: { sessionId: formation.id, trainerId: a.id, statut: "en_attente" } as never,
        select: { id: true },
      });

      const version = versionSessionFormateur({ finCollaborationAt: null });
      const liens = {
        sessionA: await signFormateurSession(
          a.id,
          "formateur",
          undefined,
          version,
          empreinteSessionFormateur(a.email) ?? undefined,
        ),
        // Une session signée avant le lot C4 ne portait pas d'empreinte d'adresse.
        sessionSansEmpreinteA: await signFormateurSession(a.id, "formateur", undefined, version),
        connexionA: await createFormateurMagicLink(a.id),
        dossierA: jetonDossierFormateur(a.id, 0, maintenant) ?? "",
        dossierB: jetonDossierFormateur(b.id, 1, maintenant) ?? "",
        // V1-D-1 — le lien tel que le produit l'émet (empreinte de l'adresse comprise)…
        missionA: await signerJetonMission({
          missionId: mission.id,
          ttlMs: 7 * 86_400_000,
          trainer: { email: a.email, finCollaborationAt: null },
        }),
        // … et un lien émis AVANT la correction, sans empreinte.
        missionSansEmpreinteA: await signMagicToken({
          scope: "formateur_mission",
          resourceId: mission.id,
          ttlMs: 7 * 86_400_000,
          version,
        }),
      };

      const avant = {
        session: await sessionAvec(liens.sessionA),
        sessionSansEmpreinte: await sessionAvec(liens.sessionSansEmpreinteA),
        dossierA: (await lireDossierParLien(a.id, liens.dossierA)) !== null,
        dossierB: (await lireDossierParLien(b.id, liens.dossierB)) !== null,
        mission: (await lireMissionParJeton(liens.missionA)) !== null,
        missionSansEmpreinte: (await lireMissionParJeton(liens.missionSansEmpreinteA)) !== null,
      };

      seConnecter(direction);
      const nouvelleA = adresse("nouvelle-a");
      const nouvelleB = adresse("nouvelle-b");
      const changementA = await updateTrainerAction({ id: a.id, email: nouvelleA });
      const changementB = await updateTrainerAction({ id: b.id, email: nouvelleB });

      const apres = {
        session: await sessionAvec(liens.sessionA),
        sessionSansEmpreinte: await sessionAvec(liens.sessionSansEmpreinteA),
        connexion: (await consumeFormateurMagicLink(liens.connexionA)) !== null,
        dossierA: (await lireDossierParLien(a.id, liens.dossierA)) !== null,
        dossierB: (await lireDossierParLien(b.id, liens.dossierB)) !== null,
        mission: (await lireMissionParJeton(liens.missionA)) !== null,
        missionSansEmpreinte: (await lireMissionParJeton(liens.missionSansEmpreinteA)) !== null,
      };
      poserCookie(FORMATEUR_COOKIE_NAME, null);

      const avis = await attendre(
        () =>
          prisma.emailLog.findMany({
            where: { recipient: { in: [a.email, b.email] }, template: "formateur-email-modifie" },
            select: { recipient: true, status: true },
          }),
        (l) => l.length === 2 && l.every((x) => x.status !== "pending"),
      );
      const versLaNouvelle = await prisma.emailLog.count({
        where: { recipient: { in: [nouvelleA, nouvelleB] } },
      });
      const fiches = await prisma.trainer.findMany({
        where: { id: { in: [a.id, b.id] } },
        select: { id: true, email: true, accesVersion: true },
      });
      const journal = await prisma.activityLog.findMany({
        where: { targetId: { in: [a.id, b.id] } },
        select: { action: true, changes: true },
      });

      await prisma.emailLog.deleteMany({ where: { recipient: { in: [a.email, b.email] } } });
      return {
        anciennes: [a.email, b.email],
        nouvelles: [nouvelleA, nouvelleB],
        avant,
        changementA,
        changementB,
        apres,
        avis,
        versLaNouvelle,
        fiches,
        journal,
      };
    });
  } finally {
    await menage();
  }
}
