// V2-S09 — Contourner les portes d'activation : affecter, ou reproposer une
// mission, à un formateur qui n'est pas (ou plus) actif ; activer sans en avoir
// le droit, par la fiche ou par la porte de la console « coaching ».
//
// Interrupteurs allumés par la console (état cible) : `affectation_sure`.
// Tout passe par les actions réelles de la console, sous une session réelle.
// `SessionJour.trainerId` : aucun code du dépôt ne l'écrit (relu au rapport) —
// la porte éprouvée est donc celle de l'affectation à la session.

import { setFormateurActifAction } from "@/server/actions/coaching-admin/formateurs.actions";
import { basculerFormateursAffectationSureAction } from "@/server/actions/qualiopi/formateurs-interrupteurs";
import { renvoyerPropositionMissionAction } from "@/server/actions/qualiopi/mission-formateur";
import {
  assignTrainerToSessionAction,
  setTrainerActifAction,
} from "@/server/actions/qualiopi/trainers";

import {
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  creerSessionFormation,
  menage,
  noterReglage,
  prisma,
  seConnecter,
} from "../donnees";
import { formulaire } from "../v2s-outils";

const erreur = (r: unknown): string | null =>
  r !== null && typeof r === "object" && "error" in r
    ? String((r as { error: unknown }).error)
    : null;

export default async function v2s09(): Promise<unknown> {
  const formateurs: string[] = [];
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const admin = await creerAdmin("admin");
      const editeur = await creerAdmin("editor");
      await noterReglage("formateurs.affectation_sure");
      seConnecter(direction);
      const allumage = await basculerFormateursAffectationSureAction(
        { ok: true, message: "" },
        formulaire({ actif: "1" }),
      );

      const session = await creerSessionFormation(new Date(Date.now() + 30 * 86_400_000));
      const verifie = { sousTraitantVerifieAt: new Date(Date.now() - 86_400_000) };
      const inactif = await creerIndependant({ actif: false, ...verifie });
      const desactive = await creerIndependant({ actif: true, ...verifie });
      formateurs.push(inactif.id, desactive.id);
      for (const t of [inactif, desactive]) {
        await prisma.trainerHabilitation.create({
          data: { trainerId: t.id, formationId: session.formationId },
        });
      }

      // 1. Affecter un formateur inactif, par l'action de la fiche session.
      seConnecter(admin);
      const affecterInactif = await assignTrainerToSessionAction({
        sessionId: session.id,
        trainerId: inactif.id,
      });

      // 2. Un formateur affecté (actif), désactivé ensuite par la console, puis
      //    la mission lui est reproposée.
      await prisma.sessionFormateur.create({
        data: { sessionId: session.id, trainerId: desactive.id, role: "principal" },
      });
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: { formateurPrincipalId: desactive.id },
      });
      seConnecter(direction);
      const desactivation = await setTrainerActifAction({ id: desactive.id, actif: false });
      const missionsAvant = await prisma.missionFormateur.count({
        where: { trainerId: desactive.id },
      });
      seConnecter(admin);
      const renvoi = await renvoyerPropositionMissionAction({
        sessionId: session.id,
        trainerId: desactive.id,
      });
      const missionsApres = await prisma.missionFormateur.count({
        where: { trainerId: desactive.id },
      });

      // 3. Activer sans le droit (un éditeur), par les deux portes.
      seConnecter(editeur);
      const editeurFiche = await setTrainerActifAction({ id: inactif.id, actif: true }).catch(
        (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }),
      );
      const editeurCoaching = await setFormateurActifAction({
        trainerId: inactif.id,
        actif: true,
      }).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      seConnecter(null);

      const etat = await prisma.trainer.findMany({
        where: { id: { in: [inactif.id, desactive.id] } },
        select: { id: true, actif: true },
      });
      const affectations = await prisma.sessionFormateur.count({
        where: { trainerId: inactif.id },
      });
      return {
        allumage,
        affecterInactif: erreur(affecterInactif),
        affectations,
        desactivation: erreur(desactivation),
        renvoi: erreur(renvoi),
        missionsCreees: missionsApres - missionsAvant,
        editeurFiche: erreur(editeurFiche),
        editeurCoaching: (editeurCoaching as { ok?: boolean }).ok === true ? null : "refus",
        inactifEncoreInactif: etat.find((e) => e.id === inactif.id)?.actif === false,
      };
    });
  } finally {
    if (formateurs.length > 0) {
      await prisma.missionFormateur.deleteMany({ where: { trainerId: { in: formateurs } } });
      await prisma.sessionFormateur.deleteMany({ where: { trainerId: { in: formateurs } } });
      await prisma.trainingSession.updateMany({
        where: { formateurPrincipalId: { in: formateurs } },
        data: { formateurPrincipalId: null },
      });
      await prisma.trainerHabilitation.deleteMany({ where: { trainerId: { in: formateurs } } });
    }
    await menage();
  }
}
