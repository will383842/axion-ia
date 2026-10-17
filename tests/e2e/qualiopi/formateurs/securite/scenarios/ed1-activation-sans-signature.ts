// E-D1 — Activer un indépendant dont le contrat-cadre n'est signé qu'« à la
// main » (date saisie en console) : refusé. Une signature partielle : refusé.
// Témoin : la même fiche avec un contrat réellement signé s'active — le refus
// vient donc bien de la signature, et de rien d'autre.
//
// Règle PROVISOIRE (interrupteur `activation_auto` coupé, état de production) :
// on coupe l'interrupteur par la console pour la durée du scénario.

import {
  setTrainerActifAction,
  updateTrainerSousTraitancePiecesAction,
} from "@/server/actions/qualiopi/trainers";

import { verserCompetencesDuBanc } from "../../../../fixtures/formateurs/competences-q21";
import {
  avecVerrouInterrupteurs,
  basculerParLaConsole,
  creerAdmin,
  creerIndependant,
  creerPieceASigner,
  menage,
  prisma,
  seConnecter,
} from "../donnees";

const SIRET_ED1 = "12345678900011";

const etat = (id: string) =>
  prisma.trainer.findUniqueOrThrow({
    where: { id },
    select: { actif: true, sousTraitantContratSigneAt: true },
  });

export default async function ed1(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const admin = await creerAdmin("admin");
      seConnecter(direction);
      const regleProvisoire = await basculerParLaConsole("activation_auto", false);

      const t = await creerIndependant({
        actif: false,
        sousTraitantVerifieAt: new Date(Date.now() - 86_400_000),
        sousTraitantNda: "84691234569",
        siret: SIRET_ED1,
      });
      // Qualiopi ind. 21 — grilles, formation à la méthode, CV et registre vert : la
      // fiche est complète de ce côté, le refus ne tient qu'à la signature.
      await verserCompetencesDuBanc(prisma, t.id, admin.id, { provisoire: { siret: SIRET_ED1 } });
      seConnecter(admin);
      const dateMain = await updateTrainerSousTraitancePiecesAction({
        id: t.id,
        sousTraitantContratSigneAt: new Date(Date.now() - 2 * 86_400_000),
      });
      const apresDate = await etat(t.id);
      const activationDateMain = await setTrainerActifAction({ id: t.id, actif: true });
      const apresRefus1 = await etat(t.id);

      const partiel = await creerPieceASigner(t.id, "contrat_sous_traitance", "partielle");
      const activationPartielle = await setTrainerActifAction({ id: t.id, actif: true });
      const apresRefus2 = await etat(t.id);

      // Témoin : le contrat devient réellement signé par toutes les parties.
      await prisma.documentGenere.update({
        where: { id: partiel.id },
        data: { statutSignature: "signee" },
      });
      const activationSignee = await setTrainerActifAction({ id: t.id, actif: true });
      const apresTemoin = await etat(t.id);

      return {
        regleProvisoire,
        dateMain,
        apresDate,
        activationDateMain,
        apresRefus1,
        activationPartielle,
        apresRefus2,
        activationSignee,
        apresTemoin,
      };
    });
  } finally {
    await menage();
  }
}
