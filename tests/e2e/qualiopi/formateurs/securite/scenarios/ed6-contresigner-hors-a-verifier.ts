// E-D6 — « Vérifier et contresigner » refuse un dossier qui n'est pas envoyé.
//
// ⚠️ L'écran exige `activation_auto` allumé ; or la console REFUSE de l'allumer
// (son préalable `contrat_auto` est marqué « non lisible »). On le constate,
// puis — seule écriture directe de ce banc — on pose la ligne pour éprouver la
// règle elle-même, et on la remet en l'état au ménage.

import { contresignerEtOuvrirEspaceAction } from "@/server/actions/qualiopi/formateurs-verifier-contresigner";

import {
  avecVerrouInterrupteurs,
  basculerParLaConsole,
  creerAdmin,
  creerIndependant,
  creerPieceASigner,
  menage,
  noterReglage,
  prisma,
  seConnecter,
} from "../donnees";

const SAISIE = {
  codeAttestation: "",
  attestationAuthentique: false,
  piecesVerifiees: false,
  formationIds: [] as string[],
  orangeVerifie: false,
  motifOrange: null,
};

export default async function ed6(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      const admin = await creerAdmin("admin");
      seConnecter(direction);
      const consoleActivationAuto = await basculerParLaConsole("activation_auto", true);

      seConnecter(admin);
      const fiches: Record<string, string> = {};
      for (const statut of ["en_cours", "a_completer", "a_verifier"] as const) {
        const t = await creerIndependant({
          actif: false,
          dossierStatut: statut,
          sousTraitantVerifieAt: new Date(Date.now() - 86_400_000),
          sousTraitantNda: "84691234569",
        } as never);
        await creerPieceASigner(t.id, "contrat_sous_traitance", "partielle");
        fiches[statut] = t.id;
      }

      const ecranFerme = await contresignerEtOuvrirEspaceAction({
        trainerId: fiches["en_cours"],
        ...SAISIE,
      } as never);

      await noterReglage("formateurs.activation_auto");
      await prisma.setting.upsert({
        where: { key: "formateurs.activation_auto" },
        create: { key: "formateurs.activation_auto", value: { actif: true } },
        update: { value: { actif: true } },
      });
      const reponses: Record<string, unknown> = {};
      for (const [statut, id] of Object.entries(fiches)) {
        reponses[statut] = await contresignerEtOuvrirEspaceAction({
          trainerId: id,
          ...SAISIE,
        } as never);
      }
      const apres = await prisma.trainer.findMany({
        where: { id: { in: Object.values(fiches) } },
        select: { id: true, actif: true, dossierStatut: true },
      });
      const contrats = await prisma.documentGenere.findMany({
        where: { trainerId: { in: Object.values(fiches) } },
        select: { statutSignature: true },
      });
      return { consoleActivationAuto, ecranFerme, reponses, apres, contrats, fiches };
    });
  } finally {
    await menage();
  }
}
